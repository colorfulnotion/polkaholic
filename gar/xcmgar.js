const xcmgarTool = require("./xcmgarTool");
const endpoints = require("./endpoints");

//const SampleParser = require("./chains/custom_parser_template") // fork this file to include new chain parser
const CommonChainParser = require("./chains/common_chainparser");
const AcalaParser = require("./chains/acala");
const MoonbeamParser = require("./chains/moonbeam");
const ParallelParser = require("./chains/parallel");
const AstarParser = require("./chains/astar");
const HydraParser = require("./chains/hydra");
const ListenParser = require("./chains/listen");
const CalamariParser = require("./chains/calamari");
const ShadowParser = require("./chains/shadow");
const StatemintParser = require("./chains/statemint")
const BifrostParser = require("./chains/bifrost")
const PhalaParser = require("./chains/phala")
const InterlayParser = require("./chains/interlay")
const MangataxParser = require("./chains/mangatax")
const OakParser = require("./chains/oak")
const RobonomicsParser = require("./chains/robonomics")
const CentrifugeParser = require("./chains/centrifuge")
const CloverParser = require("./chains/clover")
const OriginTrailParser = require("./chains/origintrail")

const {
    ApiPromise,
    WsProvider
} = require("@polkadot/api");

const fs = require('fs');
const path = require("path");

module.exports = class XCMGlobalAssetRegistry {

    fnDirFn = {};

    publicEndpointsMap = {};
    validParachains = [];
    knownParathreads = [];
    chainAPIs = {} // chainkey -> {crawler, ... }
    assetMap = {}; // ex: {"Token":"DOT"}~polkadot-0-> { assetType: 'Token', name: 'DOT', symbol: 'DOT', decimals: 10 }
    chainAssetMap = {};
    xcmAssetMap = {};
    chainXcmAssetMap = {};
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

    //asset/{relaychain}/{relaychain_paraID_fExt}
    async writeParaJSONFn(relayChain, paraID, fExt = 'asset', jsonObj = {}) {
        let jsonStr = JSON.stringify(jsonObj, null, 4)
        if (jsonObj == undefined) {
            console.log(`jsonObj missing`)
            return false
        }
        const logDir = "./"
        let fn = `${relayChain}_${paraID}_${fExt}.json`
        let fnDirFn = false
        try {
            // create fnDir directory
            let fnDir = path.join(logDir, fExt, relayChain);
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

    async fetchParaIDs(relayEndpoints) {
        let validParachainList = []
        for (const relayEndpoint of relayEndpoints) {
            let relay_api = await this.init_api(relayEndpoint.endpoints[0])
            let [validParachains, knownParathreads] = await this.crawl_valid_parachains(relay_api, relayEndpoint.relaychain)
            if (validParachains.length > 0) {
                validParachainList = validParachainList.concat(validParachains)
            }
        }
        return validParachainList
    }

    async crawl_valid_parachains(api, relaychain) {
        var allParaIds = (await api.query.paras.paraLifecycles.entries()).map(([key, _]) => key.args[0].toJSON());
        var allParaTypes = (await api.query.paras.paraLifecycles.entries()).map(([_, v]) => v.toString()); //Parathread/Parachain

        let relay_chainkey = `${relaychain}-0`
        let parachainList = [relay_chainkey] //store relaychain itself as paraID:0
        let paraIDs = [];
        let parathreadList = []

        for (let x = 0; x < allParaIds.length; x++) {
            let paraID = allParaIds[x]
            let paraType = allParaTypes[x]
            let chainkey = `${relaychain}-${paraID}`
            if (paraType == 'Parathread') {
                parathreadList.push(chainkey)
            } else if (paraType == 'Parachain') {
                parachainList.push(chainkey)
            }
        }
        this.validParachains = parachainList.sort()
        this.knownParathreads = parathreadList.sort()
        console.log(`[${relaychain}] validParachains`, parachainList)
        console.log(`[${relaychain}] knownParathreads`, parathreadList)
        return [parachainList, parathreadList]
    }

    async updatePublicEndpoints(relaychains = ['polkadot', 'kusama'], validParachainList = []) {
        for (const relayChain of relaychains) {
            let [supportedList, unverifiedList, rejectedList, missingList] = endpoints.getEndpointsByRelaychain(relayChain, validParachainList);
            console.log(`Missing ${relayChain} endpoints[${Object.keys(missingList).length}]`, Object.keys(missingList))
            console.log(`Rejected: ${relayChain} endpoints[${Object.keys(rejectedList).length}]`, Object.keys(rejectedList))
            console.log(`Supported: ${relayChain} endpoints[${Object.keys(supportedList).length}]`, Object.keys(supportedList))
            console.log(`Unverified ${relayChain} endpoints[${Object.keys(unverifiedList).length}]`, Object.keys(unverifiedList))
            await this.writeJSONFn(relayChain, 'publicEndpoints', supportedList)
        }
    }

    async updateXcmGar() {
        let relayChain = this.relaychain
        await this.writeJSONFn(relayChain, 'xcmgar', this.getXcmAssetMap())
    }

    async updateLocalAsset() {
        let relayChain = this.relaychain
        let chainAssetMap = this.getChainAssetMap()
        for (const chainkey of Object.keys(chainAssetMap)) {
            let pieces = chainkey.split('-')
            let paraIDSoure = pieces[1]
            let localAssetMap = chainAssetMap[chainkey]
            let localAssetList = []
            let localAssetChainkeys = Object.keys(localAssetMap)
            localAssetChainkeys.sort()
            for (const localAssetChainkey of localAssetChainkeys) {
                let localAsset = localAssetMap[localAssetChainkey]
                //delete localAsset.xcmInteriorKeyV1;
                let [parseAssetChain, _] = xcmgarTool.parseAssetChain(localAssetChainkey)
                let a = {
                    asset: JSON.parse(parseAssetChain),
                    name: localAsset.name,
                    symbol: localAsset.symbol,
                    decimals: localAsset.decimals,
                    currencyID: localAsset.currencyID,
                    xcmInteriorKey: localAsset.xcmInteriorKey,
                }
                localAssetList.push(a)
            }
            if (localAssetList.length > 0) {
                await this.writeParaJSONFn(relayChain, paraIDSoure, 'assets', localAssetList)
            }
        }
    }

    async initPublicEndpointsMap(relaychain = 'polkadot') {
        let publicEndpoints = this.readJSONFn(relaychain, 'publicEndpoints')
        this.publicEndpointsMap = publicEndpoints
        this.relaychain = relaychain
        //console.log(`[${relaychain}] publicEndpointsMap`, this.publicEndpointsMap)
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

    async batchApiInit(supportedChainKeys = ['polkadot-0']) {
        let batchApiInitStartTS = new Date().getTime();
        let initChainkeys = []
        for (const chainkey of supportedChainKeys) {
            initChainkeys.push(chainkey)
        }
        let apiInitPromise = await initChainkeys.map(async (initChainkey) => {
            try {
                return this.init_api_crawler(initChainkey)
                //return this.initAPI(initChainkey)
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

    async init_api_crawler(chainkey) {
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        let ep = this.getEndpointsBykey(chainkey)
        if (ep) {
            let wsEndpoint = ep.WSEndpoints[0]
            let api = await this.init_api(wsEndpoint)
            let chainParser = this.chainParserInit(chainkey, api, this)
            let crawler = {
                chainkey: chainkey,
                chainParser: chainParser,
                api: api,
                paraID: ep.paraID,
            }
            this.chainAPIs[chainkey] = crawler
            if (paraIDSoure == '0') {
                await this.crawl_valid_parachains(api, relayChain)
            }
            console.log(`[${chainkey}] endpoint:${wsEndpoint} ready`)
            return true
        } else {
            console.log(`${chainkey} not supported`)
            return false
        }
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

    async getCrawler(chainkey = 'kusama-0') {
        if (this.chainAPIs[chainkey] != undefined) {
            console.log(`${chainkey} already initiated`)
            return this.chainAPIs[chainkey]
        } else {
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


    /*
    chainParserInit returns generic chainParser by default. If a custom
    chainParser implemented, use it instead.
    */
    chainParserInit(chainkey, api, manager) {
        console.log(`chainParserInit start`)
        let chainParser;
        if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
            chainParser = new AcalaParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])) {
            chainParser = new MoonbeamParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-1000|statemint', 'kusama-1000|statemine'])) {
            chainParser = new StatemintParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
            chainParser = new BifrostParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2034|hydra', 'kusama-2090|basilisk'])) {
            chainParser = new HydraParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2035|phala', 'kusama-2004|khala'])) {
            chainParser = new PhalaParser(api, manager)
        } else if (this.isMatched(chainkey, ['kusama-2012|shadow'])) {
            chainParser = new ShadowParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2085|heiko'])) {
            chainParser = new ParallelParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden'])) {
            chainParser = new AstarParser(api, manager)
        } else if (this.isMatched(chainkey, ['kusama-2084|calamari'])) {
            chainParser = new CalamariParser(api, manager)
        } else if (this.isMatched(chainkey, ['kusama-2118|listen'])) {
            chainParser = new ListenParser(api, manager)
        } else if (this.isMatched(chainkey, ['kusama-2110|mangatax'])) {
            chainParser = new MangataxParser(api, manager)
        } else if (this.isMatched(chainkey, ['kusama-2048|robonomics'])) {
            chainParser = new RobonomicsParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2031|centrifuge','kusama-2088|altair'])) {
            chainParser = new CentrifugeParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2090|oak', 'kusama-2114|turing'])) {
            chainParser = new OakParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2032|interlay', 'kusama-2092|kintsugi'])) {
            chainParser = new InterlayParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2002|clover'])) {
            chainParser = new CloverParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2043|origintrail'])) {
            chainParser = new OriginTrailParser(api, manager)
        } else {
            chainParser = new CommonChainParser(api, manager, false) // set isCustomParser to false
        }
        console.log(`chainParserInit end`)
        return chainParser
    }

    async crawlRegistry(crawler) {
        let chainkey = crawler.chainkey
        let isCustomParser = crawler.chainParser.isCustomParser
        console.log(`**** [${chainkey}] RegistryParser START (custom:${isCustomParser}) ****`)
        // step 0: load native token of the chain
        await crawler.chainParser.getSystemProperties(chainkey);
        if (isCustomParser) {
            // If custom paser is set, bypass generic parser and use the custom one

            // step 1a: process gar pallet, storage
            await crawler.chainParser.fetchGar(chainkey)
            // step 1b: process xcgar pallet, storage
            await crawler.chainParser.fetchXcGar(chainkey)

            // step 1c: optional augment using extrinsicID
            await crawler.chainParser.fetchAugments(chainkey)

        } else if (this.isMatched(chainkey, ['polkadot-2030|bifrost'])) {
            // step 1a: process asset registry from tokens Pallet
            await crawler.chainParser.processCommonTokensPalletGar(chainkey, 'assetRegistry', 'assetMetadatas')
        } else if (this.isMatched(chainkey, ['kusama-2048|robonomics'])) {
            // step 1a: process asset registry from assets Pallet
            await crawler.chainParser.processCommonAssetPalletGar(chainkey, 'assets', 'metadata')
        } else {
            console.log(`WARN @ ${chainkey} parser not selected/covered!`)
            // step 0b: pallet detection: test to see if assets:metadata is available, if yes, try auto parse
            let isCommonAssetPallet = await crawler.chainParser.detectPalletStorage(chainkey, 'assets', 'metadata')
            // step 1a: process asset registry from assets Pallet
            if (isCommonAssetPallet) {
                console.log(`WARN @ ${chainkey} try parsing GAR`)
                //await crawler.chainParser.processCommonAssetPalletGar(chainkey, 'assets', 'metadata')
            }
        }
        console.log(`**** [${chainkey}] RegistryParser DONE ****`)
    }

    setChainAsset(chainkey, assetChainkey, assetInfo, isUpdate = false) {
        if (assetInfo.xcmInteriorKey != undefined) assetInfo.xcmInteriorKeyV1 = xcmgarTool.convertXcmInteriorKeyV2toV1(assetInfo.xcmInteriorKey)

        if (this.assetMap[assetChainkey] != undefined) console.log(`UPDATED [${chainkey}] ${assetChainkey}`, assetInfo)
        this.assetMap[assetChainkey] = assetInfo

        if (this.chainAssetMap[chainkey] == undefined) this.chainAssetMap[chainkey] = {}
        this.chainAssetMap[chainkey][assetChainkey] = assetInfo
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

    setXcmAsset(xcmInteriorKey, xcmAssetInfo, chainkey) {
        let paraIDSoure = xcmgarTool.dechexToInt(xcmAssetInfo.source[0])
        if (this.xcmAssetMap[xcmInteriorKey] == undefined) {
            console.log(`add new xcm Asset ${xcmInteriorKey}`)
            this.xcmAssetMap[xcmInteriorKey] = xcmAssetInfo
        } else {
            this.xcmAssetMap[xcmInteriorKey].confidence += 1
            this.xcmAssetMap[xcmInteriorKey].source.push(paraIDSoure)
        }
        if (this.chainXcmAssetMap[chainkey] == undefined) this.chainXcmAssetMap[chainkey] = {}
        if (this.chainXcmAssetMap[chainkey][xcmInteriorKey] == undefined) this.chainXcmAssetMap[chainkey][xcmInteriorKey] = {}
        this.chainXcmAssetMap[chainkey][xcmInteriorKey] = xcmAssetInfo
    }

    getXcmAsset(xcmInteriorKey) {
        let xcmAssetInfo = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAssetInfo != undefined) {
            return xcmAssetInfo
        }
        return false
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
            let xcContractAddress = xcmgarTool.xcAssetIDToContractAddr(localCurrencyID)
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

    getChainAssetMap() {
        return this.chainAssetMap
    }

    getLocalAssetMap(chainkey) {
        if (this.chainAssetMap[chainkey] != undefined) {
            return this.chainAssetMap[chainkey]
        }
        return {}
    }

}
