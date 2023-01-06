const garTool = require("./garTool");
const endpoints = require("./endpoints");

const {
    ApiPromise,
    WsProvider
} = require("@polkadot/api");

const fs = require('fs');
const path = require("path");

module.exports = class GlobalAssetRegistry {

    fnDirFn = {};

    publicEndpointsMap = {};
    chainAPIs = {}

    assetMap = {}; // ex: {"Token":"DOT"}~polkadot-0-> { assetType: 'Token', name: 'DOT', symbol: 'DOT', decimals: 10 }
    xcmAssetMap = {};
    relaychain = false;
    debugLevel;

    constructor(debugLevel = false) {
        if (debugLevel) {
            this.debugLevel = debugLevel;
        }
    }

    readJSONFn(relayChain, fExt = 'endpoint') {
        const logDir = "./"
        let fnDir = path.join(logDir, fExt);
        let fn = `${relayChain}_${fExt}.json`
        let fnDirFn = false
        let jsonObj = false
        try {
            fnDirFn = path.join(fnDir, fn)
            const fnContent = fs.readFileSync(fnDirFn, 'utf8');
            jsonObj = JSON.parse(fnContent)
        } catch (err) {
            console.log(err, "readJSONFn", fnDirFn);
            return false
        }
        return jsonObj
    }

    async writeJSONFn(relayChain, fExt = 'endpoint', jsonObj = {}) {
        let jsonStr = JSON.stringify(jsonObj, null, 4)
        if (jsonObj == undefined) {
            console.log(`jsonObj missing`)
            return false
        }
        const logDir = "./"
        let fn = `${relayChain}_${fExt}.json`
        let fnDirFn = false
        try {
            // create fnDir directory
            let fnDir = path.join(logDir, fExt);
            if (!fs.existsSync(fnDir)) {
                await fs.mkdirSync(fnDir);
            }
            // set up fnDir fn  (deleting old file if exists)
            try {
                fnDirFn = path.join(fnDir, fn);
                console.log("****open_file****", fnDirFn);
                await fs.closeSync(fs.openSync(fnDirFn, 'w'));
            } catch (err) {
                console.log(err);
            }
        } catch (err) {
            console.log(err, "open_file", fn);
        }
        try {
            console.log("***** write_json ***** ", fnDirFn)
            await fs.appendFileSync(fnDirFn, jsonStr);
        } catch (err1) {
            console.log(err1, "write_json", fnDirFn, jsonObj);
        }
    }

    async open_log(relayChain, fType = 'endpoint') {
        const logDir = "./"
        let fn = `${relayChain}_${fType}.json`
        try {
            // create fnDir directory
            let fnDir = path.join(logDir, fType);
            if (!fs.existsSync(fnDir)) {
                await fs.mkdirSync(fnDir);
            }
            // set up fnDir fn  (deleting old file if exists)
            try {
                this.fnDirFn = path.join(fnDir, fn);
                console.log("****open_log****", this.fnDirFn);
                await fs.closeSync(fs.openSync(this.fnDirFn, 'w'));
            } catch (err) {
                console.log(err);
            }
        } catch (err) {
            console.log(err, "open_log", fn);
        }
    }

    async write_log(list = []) {
        if (list.length > 0) {
            list.push("");
            try {
                console.log("***** write_log ***** ", this.fnDirFn)
                await fs.appendFileSync(this.fnDirFn, list.join("\n"));
            } catch (err) {
                console.log(err, "write_log", this.fnDirFn, list);
            }
        }
    }

    async write_json(jsonObj = {}) {
        if (jsonObj != undefined) {
            let jsonStr = JSON.stringify(jsonObj, null, 4)
            try {
                console.log("***** write_json ***** ", this.fnDirFn)
                await fs.appendFileSync(this.fnDirFn, jsonStr);
            } catch (err) {
                console.log(err, "write_json", this.fnDirFn, jsonObj);
            }
        }
    }

    async updatePublicEndpoints(relaychains = ['polkadot', 'kusama']) {
        for (const relayChain of relaychains) {
            let [supportedList, unsupportedList] = endpoints.getEndpointsByRelaychain(relayChain);
            console.log(`Supported: ${relayChain} endpoints[${Object.keys(supportedList).length}]`, Object.keys(supportedList))
            console.log(`Unsuppored ${relayChain} endpoints[${Object.keys(unsupportedList).length}]`, Object.keys(unsupportedList))
            await this.writeJSONFn(relayChain, 'publicEndpoints', supportedList)
        }
    }

    async initPublicEndpointsMap(relaychain = 'polkadot') {
        let publicEndpoints = this.readJSONFn(relaychain, 'publicEndpoints')
        this.publicEndpointsMap = publicEndpoints
        this.relaychain = relaychain
        console.log(`[${relaychain}] publicEndpointsMap`, this.publicEndpointsMap)
    }

    //return all supported chains
    getSupportedChainKeys() {
        let supportedChains = Object.keys(this.publicEndpointsMap)
        return supportedChains
    }

    getSupportedChains() {
        return this.publicEndpointsMap
    }

    //return endpoint given relaychain-paraID
    getEndpointsBykey(key = 'kusama-0') {
        if (this.publicEndpointsMap[key] != undefined) {
            return this.publicEndpointsMap[key]
        } else {
            return false
        }
    }

    printChainhelper() {
        let h = []
        let supportedChains = this.getSupportedChains()
        for (const s of Object.keys(supportedChains)) {
            let c = supportedChains[s]
            h.push(`${c.relaychain}-${c.paraID}|${c.id}`)
        }
        return h
    }

    async batchApiInit(supportedChainKeys = ['polkadot-0','polkadot-2000', 'polkadot-2004']) {
        let batchApiInitStartTS = new Date().getTime();
        let initChainkeys = []
        for (const chainkey of supportedChainKeys) {
            initChainkeys.push(chainkey)
        }
        let apiInitPromise = await initChainkeys.map(async (initChainkey) => {
            try {
                return this.initAPI(initChainkey)
            } catch (err) {
                console.log(`batch ApiInit ${initChainkey}`, err)
                return false
            }
        });

        // parallel init..
        let apiInitStates;
        try {
            apiInitStates = await Promise.allSettled(apiInitPromise);
            //{ status: 'fulfilled', value: ... },
            //{ status: 'rejected', reason: Error: '.....'}
        } catch (e) {
            console.log(`apiInitPromise error`, e, apiInitStates)
        }
        let failedChainkeys = []
        for (let i = 0; i < apiInitPromise.length; i += 1) {
            let initChainkey = initChainkeys[i]
            let apiInitState = apiInitStates[i]
            if (apiInitState.status != undefined && apiInitState.status == "fulfilled") {
                //console.log(`api Init ${initChainkey} Init Completed DONE`)
            } else {
                this.crawlUsageMap[initChainkey].initStatus = `Failed`
                console.log(`api Init ${initChainkey} state`, apiInitState)
                console.log(`api Init ${initChainkey} Failed! reason=${apiInitState['reason']}`)
                failedChainkeys.push(initChainkey)
            }
        }
        let batchApiInitTS = (new Date().getTime() - batchApiInitStartTS) / 1000
        console.log(`batchApiInit Completed in ${batchApiInitTS}s`)
        return failedChainkeys
    }

    async init_api(wsEndpoint) {
        const provider = new WsProvider(wsEndpoint);
        const api = await ApiPromise.create({
            provider
        });
        await api.isReady;
        return api
    }

    async initAPI(chainkey = 'kusama-0') {
        if (this.chainAPIs[chainkey] != undefined) {
            //console.log(`${chainkey} already initiated`)
            return this.chainAPIs[chainkey]
        }
        let ep = this.getEndpointsBykey(chainkey)
        if (ep) {
            let wsEndpoint = ep.WSEndpoints[0]
            let api = await this.init_api(wsEndpoint)
            this.chainAPIs[chainkey] = api
            console.log(`[${chainkey}] endpoint:${wsEndpoint} ready`)
            return this.chainAPIs[chainkey]
        } else {
            console.log(`${chainkey} not supported`)
            return false
        }
    }

    async getAPI(chainkey = 'kusama-0') {
        if (this.chainAPIs[chainkey] != undefined) {
            console.log(`${chainkey} already initiated`)
            return this.chainAPIs[chainkey]
        }else{
            return false
        }
    }

    /*
    [polkadot] SupportedChains [
      'polkadot-0|polkadot',
      'polkadot-1000|statemint',
      'polkadot-2000|acala',
      'polkadot-2002|clover',
      'polkadot-2004|moonbeam',
      'polkadot-2006|astar',
      'polkadot-2011|equilibrium',
      'polkadot-2012|parallel',
      'polkadot-2013|litentry',
      'polkadot-2019|composableFinance',
      'polkadot-2021|efinity',
      'polkadot-2026|nodle',
      'polkadot-2030|bifrost',
      'polkadot-2031|centrifuge',
      'polkadot-2032|interlay',
      'polkadot-2034|hydra',
      'polkadot-2035|phala',
      'polkadot-2037|unique',
      'polkadot-2039|integritee',
      'polkadot-2043|origintrail-parachain',
      'polkadot-2046|darwinia',
      'polkadot-2052|kylin'
    ]

    [kusama] SupportedChains [
      'kusama-0|kusama',
      'kusama-1000|statemine',
      'kusama-2000|karura',
      'kusama-2001|bifrost',
      'kusama-2004|khala',
      'kusama-2007|shiden',
      'kusama-2011|sora_ksm',
      'kusama-2012|shadow',
      'kusama-2015|integritee',
      'kusama-2023|moonriver',
      'kusama-2024|genshiro',
      'kusama-2048|robonomics',
      'kusama-2084|calamari',
      'kusama-2085|heiko',
      'kusama-2087|picasso',
      'kusama-2088|altair',
      'kusama-2090|basilisk',
      'kusama-2092|kintsugi',
      'kusama-2095|quartz',
      'kusama-2096|bitcountryPioneer',
      'kusama-2100|subsocialX',
      'kusama-2101|zeitgeist',
      'kusama-2102|pichiu',
      'kusama-2105|crab',
      'kusama-2106|litmus',
      'kusama-2110|mangata',
      'kusama-2113|kabocha',
      'kusama-2114|turing',
      'kusama-2115|dorafactory',
      'kusama-2118|listen',
      'kusama-2119|bajun',
      'kusama-2121|imbue',
      'kusama-2222|ipci'
    ]
    */

    /*
    isMatched matches parachain's identifier(i.e statemine, moonriver), chainkey(i.e kusama-1000, kusama-2023), fullchainkey(i.e kusama-1000|statemine, kusama-2023|moonriver) to a specific parser group.
    For ex, all the following are true:
     isMatched('kusama-1000',['kusama-1000|statemine'])
     isMatched('acala',['kusama-1000|acala'])
     isMatched('kusama-1000|moonriver',['kusama-1000|moonriver'])

     parachain team are encouraged to use chainfilter like 'relaychain-paraID|networkIdentifier' to take advantage of existing parser
    */
    isMatched(chainkey, chainFilters = ['kusama-1000|statemine', 'kusama-2023|moonriver']) {
        let i = chainFilters.findIndex(e => e.includes(chainkey))
        return chainFilters.findIndex(e => e.includes(chainkey)) != -1
    }

    async setupRegistryParser(api, chainkey){
        console.log(`**** [${chainkey}] RegistryParser START ****`)
        // step0: load native token of the chain
        await this.getSystemProperties(api, chainkey);
        if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura',
                'polkadot-2030|bifrost', 'kusama-2001|bifrost'
            ])) {
            if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
                console.log(`[${chainkey}] Fetch assetRegistry:assetMetadatas`)
                //await this.chainParser.fetchAssetRegistry(this)
                console.log(`[${chainkey}] Fetch assetRegistry:foreignAssetLocations`)
                //await this.chainParser.fetchXCMAssetRegistryLocations(this)
                //await this.chainParser.updateLiquidityInfo(this)
            }
            if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
                console.log(`[${chainkey}] Fetch assetRegistry:currencyMetadatas`)
                //await this.chainParser.fetchAssetRegistry(this)
                //await this.chainParser.fetchAssetRegistryCurrencyMetadatas(this)
                console.log(`[${chainkey}] Fetch assetRegistry:currencyIdToLocations`)
                //await this.chainParser.fetchXCMAssetRegistryLocations(this)
            }
        } else if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden',
                'polkadot-2004|moonbeam', 'kusama-2023|moonriver',
                'polkadot-2012|parallel', 'kusama-2007|heiko',
                'polkadot-1000|statemint', 'kusama-1000|statemine',
                'polkadot-2035|phala', 'kusama-2004|khala',
                'polkadot-2034|hydra', 'kusama-2090|basilisk',
                'kusama-2084|calamari',
                'kusama-2048|robonomics',
                'kusama-2110|mangata',
                'kusama-2118|listen',
                'kusama-2012|shadow'
            ])) {
            console.log(`[${chainkey}] fetch asset pallet`)
            await this.fetchAssetPallet(api, chainkey)
            if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2007|heiko'])) {
                //await this.chainParser.fetchAsset(this)
                //await this.chainParser.updateLiquidityInfo(this)
            }
            if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])) {
                console.log(`[${chainkey}] fetch LocalAsset?`)
                //await this.chainParser.fetchLocalAsset(this)
            }
            if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver',
                    'polkadot-2012|parallel', 'kusama-2007|heiko',
                    'polkadot-2034|hydra', 'kusama-2090|basilisk',
                    'kusama-2012|shadow'
                ])) {
                console.log(`[${chainkey}] fetch assetManager:assetIdType`)
                await this.fetchXCMAssetIdType(api, chainkey)
            }
            if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden',
                    'kusama-2084|calamari'
                ])) {
                console.log(`[${chainkey}] fetch xcAssetConfig:assetIdToLocation (assetRegistry:assetIdToLocation)`)
                //await this.chainParser.fetchXCMAssetIdToLocation(this)
            }
        } else {
            console.log(`WARN @ ${chainkey} parser not selected/covered!`)
        }
        console.log(`**** [${chainkey}] RegistryParser DONE ****`)
    }

    setChainAsset(assetChainkey, assetInfo){
        this.assetMap[assetChainkey] = assetInfo
    }

    getChainAsset(assetChainkey){
        if (this.assetMap[assetChainkey] != undefined){
            return this.assetMap[assetChainkey]
        }else{
            return false
        }
    }

    getXcmAssetMap(){
        return this.xcmAssetMap
    }

    setXcmAsset(xcmInteriorKey, xcmAssetInfo){
        if (this.xcmAssetMap[xcmInteriorKey] == undefined){
            console.log(`add new xcm Asset ${xcmInteriorKey}`)
            this.xcmAssetMap[xcmInteriorKey] = xcmAssetInfo
        }
    }

    addXcmAssetLocalCurrencyID(xcmInteriorKey, localParaID, localCurrencyID){
        let xcmAsset = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAsset != undefined){
            console.log(`add LocalCurrencyID ${xcmInteriorKey}`)
            this.xcmAssetMap[xcmInteriorKey]['xcCurrencyID'][localParaID] = localCurrencyID
        }
    }

    addXcmAssetLocalxcContractAddress(xcmInteriorKey, localParaID, localCurrencyID){
        let xcmAsset = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAsset != undefined){
            let xcContractAddress = garTool.xcAssetIDToContractAddr(localCurrencyID)
            console.log(`add xcContractAddress ${xcContractAddress}`)
            this.xcmAssetMap[xcmInteriorKey]['xcContractAddress'][localParaID] = xcContractAddress
        }
    }

    getXcmAsset(xcmInteriorKey){
        if (this.xcmAssetMap[xcmInteriorKey] != undefined){
            return this.xcmAssetMap[xcmInteriorKey]
        }else{
            return false
        }
    }

    getchainAssetMap(){
        return this.assetMap
    }

    async getSystemProperties(api, chainkey) {
        //let chainID = chain.chainID;
        let propsNative = await api.rpc.system.properties();
        let props = JSON.parse(propsNative.toString());
        // {"ss58Format":10,"tokenDecimals":[12,12,10,10],"tokenSymbol":["ACA","AUSD","DOT","LDOT"]}
        // NOT MAINTAINED let ss58Format = props.ss58Format;
        //console.log(propsNative)
        if (props.tokenSymbol) {
            for (let i = 0; i < props.tokenSymbol.length; i++) {
                let symbol = props.tokenSymbol[i];
                let decimals = props.tokenDecimals[i];
                let asset = JSON.stringify({
                    Token: symbol
                })
                let assetInfo = {
                    assetType: "Token",
                    name: symbol,
                    symbol: symbol,
                    decimals: decimals
                };
                let assetChainkey = garTool.makeAssetChain(asset, chainkey);
                console.log(`[${chainkey}] assetChainkey=${assetChainkey}`, assetInfo)
                this.setChainAsset(assetChainkey, assetInfo)
            }
        }
    }



    /*
    Fetch asset registry for parachain that use generic asset pallet, currently
    covering the following chains:

    [
    'polkadot-2006|astar', 'kusama-2007|shiden',
    'polkadot-2004|moonbeam', 'kusama-2023|moonriver',
    'polkadot-2012|parallel', 'kusama-2007|heiko',
    'polkadot-1000|statemint', 'kusama-1000|statemine',
    'polkadot-2035|phala', 'kusama-2004|khala',
    'polkadot-2034|hydra', 'kusama-2090|basilisk',
    'kusama-2084|calamari',
    'kusama-2048|robonomics',
    'kusama-2110|mangata',
    'kusama-2118|listen',
    'kusama-2012|shadow'
    ]
    */
    //moonbeam/parallel/astar
    //asset:metadata
    //assetRegistry:assetMetadataMap
    //assetsInfo:assetsInfo
    async fetchAssetPallet(api, chainkey) {
        if (!api) {
            console.log(`[fetchAssetPallet] Fatal: ${chainkey} api not initiated`)
            return
        }
        var a;
        // each parachain team may have slightly different pallet:section name that uses the same/similar logic. In this case, redirect parser to the proper section
        if (this.isMatched(chainkey, ['kusama-2118|listen'])){
            console.log(`[${chainkey}] GAR - currencies:listenAssetsInfo`)
            a = await api.query.currencies.listenAssetsInfo.entries()
        }else if (this.isMatched(chainkey, ['kusama-2110|mangata'])){
            console.log(`[${chainkey}] GAR - assetsInfo:assetsInfo TODO`)
            //a = await api.query.assetsInfo.assetsInfo.entries()
        }else if (this.isMatched(chainkey, ['polkadot-2034|hydra', 'kusama-2090|basilisk'])){
            console.log(`[${chainkey}] GAR - assetRegistry:assetMetadataMap`)
            a = await api.query.assetRegistry.assetMetadataMap.entries()
        }else{
            console.log(`[${chainkey}] GAR - asset:metadata`)
            a = await api.query.assets.metadata.entries()
        }
        if (!a) {
            console.log(`[${chainkey}] onchain GAR not found - returned`)
            return
        }
        let assetList = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let assetMetadata = val.toHuman()
            let parsedAsset = {
                Token: assetID
            }
            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            if  (this.isMatched(chainkey, ['kusama-2118|listen'])) assetMetadata = assetMetadata.metadata
            if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                let name = (assetMetadata.name != undefined) ? assetMetadata.name : `${assetMetadata.symbol}` //kusama-2090|basilisk doens't have assetName, use symbol in this case
                let assetInfo = {
                    name: name,
                    symbol: assetMetadata.symbol,
                    decimals: assetMetadata.decimals,
                    assetType: garTool.assetTypeToken,
                    currencyID: assetID
                };
                if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2007|heiko'])) {
                    if (assetInfo.symbol.includes('LP-')) assetInfo.assetType = garTool.assetTypeLiquidityPair
                    //console.log('im here fetchAssetPallet assetInfo', assetInfo)
                }
                assetList[assetChainkey] = assetInfo
                this.setChainAsset(assetChainkey, assetInfo)
                //if (this.debugLevel >= garTool.debugInfo) console.log(`addAssetInfo [${asset}]`, assetInfo)
                //await indexer.addAssetInfo(asset, indexer.chainID, assetInfo, 'fetchAsset');
            } else {
                //if (this.debugLevel >= garTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
            }
        }
        console.log(`[${chainkey}] onchain GAR:`, assetList);
    }


    //moonbeam/heiko/basilisk
    //assetManager:assetIdType
    //assetRegistry:assetIdType
    //assetRegistry.assetLocations
    async fetchXCMAssetIdType(api, chainkey) {
        if (!api) {
            console.log(`[fetchXCMAssetIdType] Fatal: ${chainkey} api not initiated`)
            return
        }
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        //let relayChainID = paraTool.getRelayChainID(relayChain)
        //let paraIDExtra = paraTool.getParaIDExtra(relayChain)

        var a;
        if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver', 'kusama-2012|shadow'])) {
            var a = await api.query.assetManager.assetIdType.entries()
        } else if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2007|heiko'])) {
            var a = await api.query.assetRegistry.assetIdType.entries()
        } else if (this.isMatched(chainkey, ['polkadot-2034|hydra', 'kusama-2090|basilisk'])) {
            var a = await api.query.assetRegistry.assetLocations.entries()
        }
        if (!a) return
        let assetList = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let parsedAsset = {
                Token: assetID
            }
            let paraID = 0
            let chainID = -1
            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            let cachedAssetInfo = this.getChainAsset(assetChainkey)
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol.replace('xc', '') : ''
                let nativeSymbol = symbol
                let xcmAssetJSON = val.toJSON()
                let xcmAsset = (xcmAssetJSON.xcm != undefined) ? xcmAssetJSON.xcm : xcmAssetJSON
                let parents = xcmAsset.parents
                let interior = xcmAsset.interior
                //x1/x2/x3 refers to the number to params
                let interiorK = Object.keys(interior)[0]
                let interiork = garTool.firstCharLowerCase(interiorK)
                let interiorV = interior[interiorK]
                let interiorVStr = JSON.stringify(interiorV)
                if (((interiorK == 'here') || (interiork == "here")) && interior[interiorK] == null) {
                    interiorVStr = 'here'
                    //chainID = relayChainID
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, relayChain)
                let updateXcmConcept = true
                /*
                let cachedXcmAssetInfo = indexer.getXcmAssetInfoByInteriorkey(xcmInteriorKey)
                if (cachedXcmAssetInfo != undefined && cachedXcmAssetInfo.nativeAssetChain != undefined) {
                    //if (this.debugLevel >= paraTool.debugVerbose) console.log(`known asset ${xcmInteriorKey} (assetChain) - skip update`, cachedXcmAssetInfo)
                    updateXcmConcept = false
                    //already cached
                }
                */

                if ((typeof interiorK == "string") && (interiorK.toLowerCase() == 'here')) {
                    //relaychain case
                    //chainID = relayChainID
                } else if (interiorK == 'x1') {
                    paraID = interiorV['parachain']
                    //chainID = paraID + paraIDExtra
                } else {
                    let generalIndex = -1
                    for (const v of interiorV) {
                        if (v.parachain != undefined) {
                            paraID = v.parachain
                            //chainID = paraID + paraIDExtra
                        } else if (v.generalIndex != undefined) {
                            generalIndex = v.generalIndex
                        }
                    }
                    //over-write statemine asset with assetID
                    if (paraID == 1000) {
                        nativeSymbol = `${generalIndex}`
                    }
                }

                // standarizing ausd -> to kusd on kusama;
                if (symbol == 'AUSD') {
                    nativeSymbol = 'KUSD'
                } else if (symbol == 'aUSD') {
                    nativeSymbol = 'AUSD'
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);

                console.log(`'${interiorVStr}' ${nativeAsset} [${paraID}] | [${symbol}] [${interiorK}]`)
                //if (this.debugLevel >= paraTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)
                let nativechainKey = `${relayChain}-${paraID}`
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, nativechainKey);
                let xcmAssetInfo = {
                    //chainID: chainID,
                    xcmConcept: interiorVStr, //interior
                    asset: nativeAsset,
                    paraID: paraID,
                    relayChain: relayChain,
                    parents: parents,
                    interiorType: interiorK,
                    xcmInteriorKey: xcmInteriorKey,
                    nativeAssetChainkey: nativeAssetChainkey,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    source: chainkey,
                }

                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                this.setChainAsset(assetChainkey, cachedAssetInfo)

                console.log(`xcmAssetInfo ${xcmInteriorKey}`, xcmAssetInfo)
                this.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                this.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])){
                    //For isEVMChain, compute the extra xcContractAddress
                    this.addXcmAssetLocalxcContractAddress(xcmInteriorKey, paraIDSoure, assetID)
                }
            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
            }
        }
    }
}
