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

    async updateXcmConcept() {
        let relayChain = this.relaychain
        await this.writeJSONFn(relayChain, 'xcmConcept', this.getXcmAssetMap())
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

    async batchApiInit(supportedChainKeys = ['polkadot-0', 'polkadot-2000', 'polkadot-2004']) {
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
        } else {
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
    isMatched matches an input to a parachain using
    {identifier, identifier, fullchainkey} to a specific parser group:

    identifier(i.e statemine, moonriver),
    chainkey(i.e kusama-1000, kusama-2023),
    fullchainkey(i.e kusama-1000|statemine, kusama-2023|moonriver)

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

    async crawlRegistry(api, chainkey) {
        console.log(`**** [${chainkey}] RegistryParser START ****`)
        // step0: load native token of the chain
        await this.getSystemProperties(api, chainkey);
        if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura',
                'polkadot-2030|bifrost', 'kusama-2001|bifrost'
            ])) {
            // step 1a: load asset registry
            await this.fetchTokenPallet(api, chainkey)
            if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
                console.log(`[${chainkey}] Fetch assetRegistry:foreignAssetLocations`)
                await this.fetchXCMAssetRegistryLocations(api, chainkey)
            }
            if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
                //await this.fetchAssetRegistryCurrencyMetadatas(api, chainkey)
                console.log(`[${chainkey}] Fetch assetRegistry:currencyIdToLocations`)
                await this.fetchXCMAssetRegistryLocations(api, chainkey)
            }
        } else if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden',
                'polkadot-2004|moonbeam', 'kusama-2023|moonriver',
                'polkadot-2012|parallel', 'kusama-2085|heiko',
                'polkadot-1000|statemint', 'kusama-1000|statemine',
                'polkadot-2035|phala', 'kusama-2004|khala',
                'polkadot-2034|hydra', 'kusama-2090|basilisk',
                'kusama-2084|calamari',
                'kusama-2048|robonomics',
                'kusama-2118|listen',
                'kusama-2012|shadow'
            ])) {
            // step 1a: load asset registry
            console.log(`[${chainkey}] fetch asset pallet`)
            await this.fetchAssetPallet(api, chainkey)
            if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver',
                    'polkadot-2012|parallel', 'kusama-2085|heiko',
                    'polkadot-2034|hydra', 'kusama-2090|basilisk',
                    'kusama-2012|shadow'
                ])) {
                // step 1b: load asset registry
                await this.fetchXCMAssetIdType(api, chainkey)
                /*
                if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])) {
                    // step 1c: TODO: load local xc asset registry
                }
                */
            }
            if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden',
                    'kusama-2084|calamari'
                ])) {
                // step 1b: load asset registry
                await this.fetchXCMAssetIdToLocation(api, chainkey)
            }
        } else {
            console.log(`WARN @ ${chainkey} parser not selected/covered!`)
        }
        console.log(`**** [${chainkey}] RegistryParser DONE ****`)
    }

    setChainAsset(assetChainkey, assetInfo, isUpdate = false) {
        this.assetMap[assetChainkey] = assetInfo
        if (isUpdate) console.log(`UPDATED ${assetChainkey}`, assetInfo)
    }

    getChainAsset(assetChainkey) {
        if (this.assetMap[assetChainkey] != undefined) {
            return this.assetMap[assetChainkey]
        } else {
            return false
        }
    }

    getXcmAssetMap() {
        return this.xcmAssetMap
    }

    setXcmAsset(xcmInteriorKey, xcmAssetInfo) {
        if (this.xcmAssetMap[xcmInteriorKey] == undefined) {
            console.log(`add new xcm Asset ${xcmInteriorKey}`)
            this.xcmAssetMap[xcmInteriorKey] = xcmAssetInfo
        }
    }

    addXcmAssetLocalCurrencyID(xcmInteriorKey, localParaID, localCurrencyID) {
        let xcmAsset = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAsset != undefined) {
            console.log(`add LocalCurrencyID ${xcmInteriorKey}`)
            this.xcmAssetMap[xcmInteriorKey]['xcCurrencyID'][localParaID] = localCurrencyID
        }
    }

    addXcmAssetLocalxcContractAddress(xcmInteriorKey, localParaID, localCurrencyID) {
        let xcmAsset = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAsset != undefined) {
            let xcContractAddress = garTool.xcAssetIDToContractAddr(localCurrencyID)
            console.log(`add xcContractAddress ${xcContractAddress}`)
            this.xcmAssetMap[xcmInteriorKey]['xcContractAddress'][localParaID] = xcContractAddress.toLowerCase()
        }
    }

    getXcmAsset(xcmInteriorKey) {
        if (this.xcmAssetMap[xcmInteriorKey] != undefined) {
            return this.xcmAssetMap[xcmInteriorKey]
        } else {
            return false
        }
    }

    getchainAssetMap() {
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
    'polkadot-2012|parallel', 'kusama-2085|heiko',
    'polkadot-1000|statemint', 'kusama-1000|statemine',
    'polkadot-2035|phala', 'kusama-2004|khala',
    'polkadot-2034|hydra', 'kusama-2090|basilisk',
    'kusama-2084|calamari',
    'kusama-2048|robonomics',
    'kusama-2118|listen',
    'kusama-2012|shadow'
    ]
    */
    /*
    [hydra]assetRegistry:assetMetadataMap
    [listen]currencies:listenAssetsInfo
    [generic] asset:metadata
    */
    async fetchAssetPallet(api, chainkey) {
        if (!api) {
            console.log(`[fetchAssetPallet] Fatal: ${chainkey} api not initiated`)
            return
        }
        /* each parachain team may have slightly different pallet:storage name
        that uses the same/similar logic. The parser should redirect itself to
        the proper section
        */
        var pallet, storage; // where GAR is stored (i.e asset:metadata for statemine's GAR)
        if (this.isMatched(chainkey, ['kusama-2118|listen'])) {
            pallet = 'currencies'
            storage = 'listenAssetsInfo'
        } else if (this.isMatched(chainkey, ['polkadot-2034|hydra', 'kusama-2090|basilisk'])) {
            pallet = 'assetRegistry'
            storage = 'assetMetadataMap'
        } else {
            pallet = 'assets'
            storage = 'metadata'
        }
        console.log(`[${chainkey}] selected GAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
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
            if (this.isMatched(chainkey, ['kusama-2118|listen'])) assetMetadata = assetMetadata.metadata
            if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                let name = (assetMetadata.name != undefined) ? assetMetadata.name : `${assetMetadata.symbol}` //kusama-2090|basilisk doens't have assetName, use symbol in this case
                let assetInfo = {
                    name: name,
                    symbol: assetMetadata.symbol,
                    decimals: assetMetadata.decimals,
                    assetType: garTool.assetTypeToken,
                    currencyID: assetID
                };
                if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2085|heiko'])) {
                    if (assetInfo.symbol.includes('LP-')) assetInfo.assetType = garTool.assetTypeLiquidityPair
                    //console.log('im here fetchAssetPallet assetInfo', assetInfo)
                }
                assetList[assetChainkey] = assetInfo
                this.setChainAsset(assetChainkey, assetInfo)
            } else {
                //if (this.debugLevel >= garTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
            }
        }
        console.log(`[${chainkey}] onchain GAR:`, assetList);
    }

    /* Token Pallet Parsing
    Fetch asset registry for parachain that use generic token pallet, currently
    covering the following chains:
    [
    'polkadot-2000|acala', 'kusama-2000|karura',
    'polkadot-2030|bifrost', 'kusama-2001|bifrost'
    ]
    */
    /*
    [bifrost] assetRegistry:currencyMetadatas - TODO
    [acala] assetRegistry:assetMetadatas
    */
    async fetchTokenPallet(api, chainkey) {
        if (!api) {
            console.log(`[fetchTokenPallet] Fatal: ${chainkey} api not initiated`)
            return
        }
        /* each parachain team may have slightly different pallet:storage name
        that uses the same/similar logic. The parser should redirect itself to
        the proper section
        */
        var pallet, storage; // where GAR is stored (i.e assetRegistry:assetMetadatas for acala GAR)
        if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
            pallet = 'assetRegistry'
            storage = 'currencyMetadatas'
        } else if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
            pallet = 'assetRegistry'
            storage = 'assetMetadatas'
        }
        console.log(`[${chainkey}] selected GAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) return
        let assetList = {}
        // ForeignAssetId/{"NativeAssetId":{"Token":"XXX"}}/{"Erc20":"0x1f3a10587a20114ea25ba1b388ee2dd4a337ce27"}/{"StableAssetId":"0"}
        // remove the Id prefix here
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetMetadata = val.toHuman()
            let parsedAsset = {}
            let assetKeyWithID = key.args.map((k) => k.toHuman())[0] //{"ForeignAssetId":"0"}
            let assetKey = Object.keys(assetKeyWithID)[0] // ForeignAssetId
            let assetKeyVal = garTool.cleanedAssetID(assetKeyWithID[assetKey]) // "123,456" or {"Token":"XXX"}
            if (assetKey == 'NativeAssetId') {
                //this is the bifrost case
                parsedAsset = assetKeyVal
            } else {
                // this is the acala/karura case
                let assetKeyWithoutID = assetKey.replace('Id', '') //ForeignAssetId -> ForeignAsset
                parsedAsset[assetKeyWithoutID] = assetKeyVal
            }
            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                let symbol = assetMetadata.symbol
                let name = assetMetadata.name
                if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
                    //biforst VSToken has ambiguous symbol representation
                    if (parsedAsset.VSToken != undefined) {
                        symbol = 'VS' + symbol
                        name = `Bifrost Voucher Slot ` + name
                    }
                }
                let assetInfo = {
                    name: name,
                    symbol: symbol,
                    decimals: assetMetadata.decimals,
                    assetType: garTool.assetTypeToken
                };
                assetList[assetChainkey] = assetInfo
                console.log(`addAssetInfo [${asset}]`, assetInfo)
                this.setChainAsset(assetChainkey, assetInfo)
            } else {
                //if (this.debugLevel >= garTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
            }
        }
        console.log(`[${chainkey}] onchain GAR:`, assetList);
    }


    /* Asset Pallet Parsing
    Fetch xcm asset registry for parachain that uses similar assetRegistry pallet, currently
    covering the following chains:
    [
    'polkadot-2004|moonbeam', 'kusama-2023|moonriver',
    'polkadot-2012|parallel', 'kusama-2085|heiko'
    'polkadot-2034|hydra', 'kusama-2090|basilisk'
    'kusama-2012|shadow'
    ]
    */
    /*
    [Moonbeam/Shadow] assetManager:assetIdType
    [Parallel] assetRegistry:assetIdType
    [Hydra] assetRegistry.assetLocations
    */
    async fetchXCMAssetIdType(api, chainkey) {
        if (!api) {
            console.log(`[fetchXCMAssetIdType] Fatal: ${chainkey} api not initiated`)
            return
        }
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        //let relayChainID = garTool.getRelayChainID(relayChain)
        //let paraIDExtra = garTool.getParaIDExtra(relayChain)

        var pallet, storage; // where xcGAR is stored (i.e xcAssetConfig:assetIdToLocation)
        if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver', 'kusama-2012|shadow'])) {
            pallet = 'assetManager'
            storage = 'assetIdType'
        } else if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2085|heiko'])) {
            pallet = 'assetRegistry'
            storage = 'assetIdType'
        } else if (this.isMatched(chainkey, ['polkadot-2034|hydra', 'kusama-2090|basilisk'])) {
            pallet = 'assetRegistry'
            storage = 'assetLocations'
        }
        console.log(`[${chainkey}] selected xcGAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
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
                /*
                //old xcmInteriorKey format
                if (((interiorK == 'here') || (interiork == "here")) && interior[interiorK] == null) {
                    interiorVStr = 'here'
                    //chainID = relayChainID
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, relayChain)
                */
                let network = {}
                if (relayChain == 'kusama' || relayChain == 'polkadot') {
                    network = {
                        network: relayChain
                    }
                } else {
                    network = {
                        named: garTool.stringToHex(relayChain)
                    }
                }
                if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultilocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null
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
                //if (this.debugLevel >= garTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)
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
                    xcmV1multilocationByte: xcmV1MultilocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    nativeAssetChainkey: nativeAssetChainkey,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    source: chainkey,
                }

                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                this.setChainAsset(assetChainkey, cachedAssetInfo, true)

                console.log(`xcmAssetInfo ${xcmInteriorKey}`, xcmAssetInfo)
                this.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                this.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])) {
                    //For isEVMChain, compute the extra xcContractAddress
                    this.addXcmAssetLocalxcContractAddress(xcmInteriorKey, paraIDSoure, assetID)
                }
            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
            }
        }
    }

    /*
    Fetch xcm asset registry for parachain that uses similar xcAssetConfig pallet, currently
    covering the following chains:
    [
    'polkadot-2006|astar', 'kusama-2007|shiden',
    'kusama-2084|calamari'
    ]
    */
    /*
    [Astar] xcAssetConfig:assetIdToLocation
    [Calamari] assetManager:assetIdLocation
    */
    async fetchXCMAssetIdToLocation(api, chainkey) {
        if (!api) {
            console.log(`[fetchXCMAssetIdToLocation] Fatal: ${chainkey} api not initiated`)
            return
        }

        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]

        var pallet, storage; // where xcGAR is stored (i.e xcAssetConfig:assetIdToLocation for astar)
        if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden'])) {
            pallet = 'xcAssetConfig'
            storage = 'assetIdToLocation'
        } else if (this.isMatched(chainkey, ['kusama-2084|calamari'])) {
            pallet = 'assetManager'
            storage = 'assetIdLocation'
        }
        console.log(`[${chainkey}] selected xcGAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) return
        let assetList = {}
        let xcmInteriorUpdates = []
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
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol : ''
                let nativeSymbol = symbol

                let xcmAssetType = val.toJSON()
                // type V0/V1/...
                let xcmAssetTypeV = Object.keys(xcmAssetType)[0]
                let xcmAsset = xcmAssetType[xcmAssetTypeV]
                let parents = xcmAsset.parents
                let interior = xcmAsset.interior
                //x1/x2/x3 refers to the number to params

                let interiorK = Object.keys(interior)[0]
                let interiork = garTool.firstCharLowerCase(interiorK)
                let interiorVRaw = interior[interiorK]

                //console.log(`${interiork} interiorVRawV`, interiorVRawV)
                let interiorVStr0 = JSON.stringify(interiorVRaw)
                interiorVStr0.replace('Parachain', 'parachain').replace('PalletInstance', 'palletInstance').replace('GeneralIndex', 'generalIndex').replace('GeneralKey', 'generalKey')
                //hack: lower first char
                let interiorV = JSON.parse(interiorVStr0)

                if (interiork == 'here' || interiork == 'Here') {
                    //relaychain case
                    //chainID = relayChainID
                } else if (interiork == 'x1') {
                    paraID = interiorV['parachain']
                    //chainID = paraID + paraIDExtra
                } else {
                    let generalIndex = -1
                    for (let i = 0; i < interiorV.length; i++) {
                        let v = interiorV[i]
                        if (v.parachain != undefined) {
                            paraID = v.parachain
                            //chainID = paraID + paraIDExtra
                        } else if (v.generalIndex != undefined) {
                            generalIndex = v.generalIndex
                        } else if (v.generalKey != undefined) {
                            let generalKey = v.generalKey
                            if (generalKey.substr(0, 2) != '0x') {
                                generalKey = garTool.stringToHex(generalKey)
                                v.generalKey = generalKey
                            }
                        }
                    }
                    //over-write statemine asset with assetID
                    if (paraID == 1000) {
                        nativeSymbol = `${generalIndex}`
                    }
                }
                if (symbol == 'AUSD') {
                    nativeSymbol = 'KUSD'
                } else if (symbol == 'aUSD') {
                    nativeSymbol = 'AUSD'
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);
                let interiorVStr = JSON.stringify(interiorV)
                let network = {}
                if (relayChain == 'kusama' || relayChain == 'polkadot') {
                    network = {
                        network: relayChain
                    }
                } else {
                    network = {
                        named: garTool.stringToHex(relayChain)
                    }
                }
                if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultilocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, chainkey);

                let xcmAssetInfo = {
                    //chainID: chainID,
                    xcmConcept: interiorVStr, //interior
                    asset: nativeAsset,
                    paraID: paraID,
                    relayChain: relayChain,
                    parents: parents,
                    interiorType: interiorK,
                    xcmInteriorKey: xcmInteriorKey,
                    xcmV1multilocationByte: xcmV1MultilocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    nativeAssetChainkey: nativeAssetChainkey,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    source: chainkey,
                }
                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                this.setChainAsset(assetChainkey, cachedAssetInfo, true)

                console.log(`xcmAssetInfo`, xcmAssetInfo)

                this.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                this.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden'])) {
                    //For isEVMChain, compute the extra xcContractAddress
                    this.addXcmAssetLocalxcContractAddress(xcmInteriorKey, paraIDSoure, assetID)
                }
            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
            }
        }
    }

    /*
    Fetch xcm asset registry for parachain that uses similar foreignAssetLocations pallet, currently
    covering the following chains:
    [
    'polkadot-2000|acala', 'kusama-2000|karura'
    polkadot-2030|bifrost, 'kusama-2001|bifrost'
    ]
    */
    /*
    [acala] assetRegistry:foreignAssetLocations
    [bifrost] assetRegistry:currencyIdToLocations
    */
    async fetchXCMAssetRegistryLocations(api, chainkey) {
        if (!api) {
            console.log(`[fetchXCMAssetRegistryLocations] Fatal: ${chainkey} api not initiated`)
            return
        }

        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]

        var pallet, storage; // where xcGAR is stored (i.e xcAssetConfig:assetIdToLocation for astar)
        var useForeignAssetPrefix = false // acala uses foreignAsset to specify the external xcm asset
        if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
            pallet = 'assetRegistry'
            storage = 'foreignAssetLocations'
            useForeignAssetPrefix = true
        } else if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
            pallet = 'assetRegistry'
            storage = 'currencyIdToLocations'
        }

        console.log(`[${chainkey}] selected xcGAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) return
        let assetList = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let parsedAsset = {};
            if (useForeignAssetPrefix) {
                parsedAsset.ForeignAsset = assetID
            } else {
                parsedAsset = assetID
            }
            let paraID = 0
            let chainID = -1

            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            let cachedAssetInfo = this.getChainAsset(assetChainkey)
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol : ''
                let nativeSymbol = symbol

                let xcmAsset = val.toJSON()
                let parents = xcmAsset.parents
                let interior = xcmAsset.interior
                //x1/x2/x3 refers to the number to params

                let interiorK = Object.keys(interior)[0]
                let interiork = garTool.firstCharLowerCase(interiorK)
                let interiorVRaw = interior[interiorK]

                //console.log(`${interiork} interiorVRaw`, interiorVRaw)
                let interiorVStr0 = JSON.stringify(interiorVRaw)
                interiorVStr0.replace('Parachain', 'parachain').replace('Parachain', 'parachain').replace('PalletInstance', 'palletInstance').replace('GeneralIndex', 'generalIndex').replace('GeneralKey', 'generalKey')
                //hack: lower first char
                let interiorV = JSON.parse(interiorVStr0)

                if (interiork == 'here') {
                    //relaychain case
                    //chainID = relayChainID
                } else if (interiork == 'x1') {
                    paraID = interiorV['parachain']
                    //chainID = paraID + paraIDExtra
                } else {
                    let generalIndex = -1
                    for (let i = 0; i < interiorV.length; i++) {
                        let v = interiorV[i]
                        if (v.parachain != undefined) {
                            paraID = v.parachain
                            //chainID = paraID + paraIDExtra
                        } else if (v.generalIndex != undefined) {
                            generalIndex = v.generalIndex
                        } else if (v.generalKey != undefined) {
                            let generalKey = v.generalKey
                            if (generalKey.substr(0, 2) != '0x') {
                                generalKey = garTool.stringToHex(generalKey)
                                v.generalKey = generalKey
                            }
                        }
                    }
                    //over-write statemine asset with assetID
                    if (paraID == 1000) {
                        nativeSymbol = `${generalIndex}`
                    }
                }
                if (symbol == 'AUSD') {
                    nativeSymbol = 'KUSD'
                } else if (symbol == 'aUSD') {
                    nativeSymbol = 'AUSD'
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);
                let interiorVStr = JSON.stringify(interiorV)

                let network = {}
                if (relayChain == 'kusama' || relayChain == 'polkadot') {
                    network = {
                        network: relayChain
                    }
                } else {
                    network = {
                        named: garTool.stringToHex(relayChain)
                    }
                }
                if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultilocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null

                //console.log(`${chainID} '${interiorVStr}' ${nativeAsset} [${paraID}] | [${symbol}] [${interiorK}]`)
                //if (this.debugLevel >= garTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, chainID);
                let xcmAssetInfo = {
                    //chainID: chainID,
                    xcmConcept: interiorVStr, //interior
                    asset: nativeAsset,
                    paraID: paraID,
                    relayChain: relayChain,
                    parents: parents,
                    interiorType: interiorK,
                    xcmInteriorKey: xcmInteriorKey,
                    xcmV1multilocationByte: xcmV1MultilocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    nativeAssetChainkey: nativeAssetChainkey,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    source: chainkey,
                }

                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                this.setChainAsset(assetChainkey, cachedAssetInfo, true)

                console.log(`xcmAssetInfo ${xcmInteriorKey}`, xcmAssetInfo)
                this.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                //this.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)

            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
            }
        }
    }
}
