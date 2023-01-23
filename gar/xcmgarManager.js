const Crawler = require("./crawler");
const xcmgarTool = require("./xcmgarTool");
const endpoints = require("./endpoints");

//const SampleParser = require("./chainParsers/custom_parser_template") // fork this file to include new chain parser
const CommonChainParser = require("./chainParsers/common_chainparser");
const AcalaParser = require("./chainParsers/acala");
const MoonbeamParser = require("./chainParsers/moonbeam");
const ParallelParser = require("./chainParsers/parallel");
const AstarParser = require("./chainParsers/astar");
const HydraParser = require("./chainParsers/hydra");
const ListenParser = require("./chainParsers/listen");
const CalamariParser = require("./chainParsers/calamari");
const ShadowParser = require("./chainParsers/shadow");
const StatemintParser = require("./chainParsers/statemint")
const BifrostParser = require("./chainParsers/bifrost")
const PhalaParser = require("./chainParsers/phala")
const InterlayParser = require("./chainParsers/interlay")
const MangataxParser = require("./chainParsers/mangatax")
const OakParser = require("./chainParsers/oak")
const RobonomicsParser = require("./chainParsers/robonomics")
const CentrifugeParser = require("./chainParsers/centrifuge")
const CloverParser = require("./chainParsers/clover")
const OriginTrailParser = require("./chainParsers/origintrail")

const {
    ApiPromise,
    WsProvider
} = require("@polkadot/api");

const fs = require('fs');
const path = require("path");

module.exports = class XCMGlobalAssetRegistryManager {

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
    async writeParaJSONFn(relayChain, paraID, fExt = 'assets', jsonObj = {}) {
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
                //console.log("****open_file****", fnDirFn);
                await fs.closeSync(fs.openSync(fnDirFn, 'w'));
            } catch (err) {
                console.log(`❌ Error setting up ${fnDir}`, err);
                process.exit(0)
            }
        } catch (err0) {
            console.log(`❌ Error Opening ${fn}:`, err0);
            process.exit(0)
        }
        try {
            await fs.appendFileSync(fnDirFn, jsonStr);
        } catch (err1) {
            console.log(`❌ Error writing ${fnDirFn}:`, err1);
            process.exit(0)
        }
        switch (fExt) {
            case 'assets':
                let assetCnt = jsonObj.length
                console.log(`✅ Success: ${relayChain}-${paraID} Local Asset Registry (Found:${assetCnt}) cached @\n    ${fnDirFn}`)
                break;
            case 'xcAssets':
                let xcAssetCnt = jsonObj.length
                console.log(`✅ Success: ${relayChain}-${paraID} XCM/MultiLocation Registry (Found:${xcAssetCnt}) cached @\n    ${fnDirFn}`)
                break;
            default:
                console.log(`✅ Success: ${relayChain}-${paraID} cached @n    ${fnDirFn}`)
        }
    }

    async writeJSONFn(relayChain, fExt = 'publicEndpoints', jsonObj = {}) {
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
                //console.log("****open_file****", fnDirFn);
                await fs.closeSync(fs.openSync(fnDirFn, 'w'));
            } catch (err) {
                console.log(`❌ Error setting up ${fnDir}`, err);
                process.exit(0)
            }
        } catch (err0) {
            console.log(`❌ Error Opening ${fn}:`, err0);
            process.exit(0)
        }
        try {
            //console.log("***** write_json ***** ", fnDirFn)
            await fs.appendFileSync(fnDirFn, jsonStr);
        } catch (err1) {
            console.log(`❌ Error writing ${fnDirFn}:`, err1);
            process.exit(0)
        }

        switch (fExt) {
            case 'publicEndpoints':
                let reachableCnt = Object.keys(jsonObj).length
                console.log(`✅ Success: ${relayChain} ${reachableCnt} reachable parachain endpoints cached @\n    ${fnDirFn}`)
                break;
            case 'xcmRegistry':
                let xcmAsseCnt = Object.keys(jsonObj).length
                console.log(`✅ Success: ${relayChain} XCM Global Asset Registry (Found:${xcmAsseCnt}) cached @\n    ${fnDirFn}`)
                break;
            default:
                console.log(`✅ Success: ${relayChain} ${fExt} cached @\n    ${fnDirFn}`)
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
            let relayChainkey = relayEndpoint.chainkey
            let relayCrawler = new Crawler(relayChainkey)
            let relay_api = await relayCrawler.init_api(relayEndpoint.endpoints[0])
            relayCrawler.chainParser = this.chainParserInit(relayChainkey, relay_api, this)
            relayCrawler.api = relay_api
            relayCrawler.paraID = 0
            //let relay_api = await this.init_api(relayEndpoint.endpoints[0])
            let [validParachains, knownParathreads] = await this.crawl_valid_parachains(relayCrawler, relayEndpoint.relaychain)
            if (validParachains.length > 0) {
                validParachainList = validParachainList.concat(validParachains)
            }
        }
        return validParachainList
    }

    async crawl_valid_parachains(crawler, relaychain) {
        let api = crawler.api
        var allParaIds = (await api.query.paras.paraLifecycles.entries()).map(([key, _]) => key.args[0].toJSON());
        var allParaTypes = (await api.query.paras.paraLifecycles.entries()).map(([_, v]) => v.toString()); //Parathread/Parachain

        //let relay_chainkey = `${relaychain}-0`
        let relay_chainkey = crawler.chainkey
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

    async updatePublicEndpoints(relaychains = ['polkadot', 'kusama'], validParachainList = [], isUpdate = true) {
        for (const relayChain of relaychains) {
            let [supportedList, unverifiedList, rejectedList, missingList] = endpoints.getEndpointsByRelaychain(relayChain, validParachainList);
            console.log(`Missing ${relayChain} endpoints[${Object.keys(missingList).length}]`, Object.keys(missingList))
            console.log(`Rejected: ${relayChain} endpoints[${Object.keys(rejectedList).length}]`, Object.keys(rejectedList))
            console.log(`Supported: ${relayChain} endpoints[${Object.keys(supportedList).length}]`, Object.keys(supportedList))
            console.log(`Unverified ${relayChain} endpoints[${Object.keys(unverifiedList).length}]`, Object.keys(unverifiedList))
            if (isUpdate) {
                await this.writeJSONFn(relayChain, 'publicEndpoints', supportedList)
            }
        }
    }

    async updateXcmRegistry() {
        let relayChain = this.relaychain
        await this.writeJSONFn(relayChain, 'xcmRegistry', this.getXcmAssetMap())
    }

    async updateLocalMultilocation() {
        let relayChain = this.relaychain
        let chainXcmAssetMap = this.getChainXcmAssetMap()
        for (const chainkey of Object.keys(chainXcmAssetMap)) {
            let pieces = chainkey.split('-')
            let paraIDSource = pieces[1]
            let localXcAssetMap = chainXcmAssetMap[chainkey]
            let localXcAssetList = []
            let localXcAssetChainkeys = Object.keys(localXcAssetMap)
            localXcAssetChainkeys.sort()
            for (const localXcAssetChainkey of localXcAssetChainkeys) {
                let localXcAsset = localXcAssetMap[localXcAssetChainkey]
                //delete localAsset.xcmInteriorKeyV1;
                //let [parseAssetChain, _] = xcmgarTool.parseAssetChain(localAssetChainkey)
                let xcAsset = localXcAsset
                if (xcAsset.xcCurrencyID != undefined && xcAsset.xcCurrencyID[paraIDSource] != undefined) {
                    xcAsset.asset = xcAsset.xcCurrencyID[paraIDSource]
                }
                if (xcAsset.xcContractAddress != undefined && xcAsset.xcContractAddress[paraIDSource] != undefined) {
                    xcAsset.contractAddress = xcAsset.xcContractAddress[paraIDSource]
                }
                delete xcAsset.xcCurrencyID
                delete xcAsset.xcContractAddress
                delete xcAsset.source
                delete xcAsset.confidence
                xcAsset.source = [paraIDSource]
                localXcAssetList.push(xcAsset)
            }
            if (localXcAssetList.length > 0) {
                await this.writeParaJSONFn(relayChain, paraIDSource, 'xcAssets', localXcAssetList)
            }
        }
    }

    async updateLocalAsset() {
        let relayChain = this.relaychain
        let chainAssetMap = this.getChainAssetMap()
        for (const chainkey of Object.keys(chainAssetMap)) {
            let pieces = chainkey.split('-')
            let paraIDSource = pieces[1]
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
                await this.writeParaJSONFn(relayChain, paraIDSource, 'assets', localAssetList)
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

    //Does not work with setupAPIWithTimeout. Work around: treat serial as batch of size 1
    async serialCrawlerInit(supportedChainKeys = ['polkadot-0']) {
        let failedChainkeys = []
        for (const chainkey of supportedChainKeys) {
            console.log(`[${chainkey}] Crawler Init Start`)
            let failedChainkey = await this.batchCrawlerInit([chainkey])
            if (failedChainkey.length > 0) {
                console.log(`[${chainkey}] Crawler Init TIMEOUT!!`)
                failedChainkeys.push(chainkey)
            }
        }
        return failedChainkeys
    }

    async batchCrawlerInit(supportedChainKeys = ['polkadot-0']) {
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
                //this.crawlUsageMap[initChainkey].initStatus = `Failed`
                console.log(`api Init ${initChainkey} state`, apiInitState)
                console.log(`api Init ${initChainkey} Failed! reason=${apiInitState['reason']}`)
                failedChainkeys.push(initChainkey)
            }
        }
        let batchApiInitTS = (new Date().getTime() - batchApiInitStartTS) / 1000
        console.log(`batchApiInit Completed in ${batchApiInitTS}s`)
        return failedChainkeys
    }

    async init_api_simple(wsEndpoint) {
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
        let paraIDSource = pieces[1]
        let ep = this.getEndpointsBykey(chainkey)
        if (ep) {
            let wsEndpoint = ep.WSEndpoints[0]
            let crawler = new Crawler(chainkey)
            console.log(`[${chainkey}] setupAPIWithTimeout start`)
            //let api = await crawler.init_api(wsEndpoint)
            //crawler.api = api
            //crawler.chainParser = this.chainParserInit(chainkey, api, this)
            let status = await crawler.setupAPIWithTimeout(wsEndpoint)
            console.log(`[${chainkey}] setupAPIWithTimeout done [${status}]`)
            crawler.chainParser = this.chainParserInit(chainkey, crawler.api, this)
            crawler.paraID = ep.paraID
            this.chainAPIs[chainkey] = crawler
            if (paraIDSource == '0') {
                await this.crawl_valid_parachains(crawler, relayChain)
            }
            console.log(`[${chainkey}] endpoint:${wsEndpoint} ready`)
            return true
        } else {
            console.log(`${chainkey} not supported`)
            return false
        }
    }

    async getCrawler(chainkey = 'kusama-0') {
        if (this.chainAPIs[chainkey] != undefined) {
            return this.chainAPIs[chainkey]
        } else {
            return false
        }
    }


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
        console.log(`[${chainkey}] chainParserInit start`)
        let chainParser;
        if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
            chainParser = new AcalaParser(api, manager)
        } else if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver', 'moonbase-1000|alpha', 'moonbase-888|beta'])) {
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
        } else if (this.isMatched(chainkey, ['polkadot-2031|centrifuge', 'kusama-2088|altair'])) {
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
        console.log(`[${chainkey}] chainParserInit end`)
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

        //if (this.assetMap[assetChainkey] != undefined) console.log(`UPDATED [${chainkey}] ${assetChainkey}`, assetInfo)
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
        let paraIDSource = xcmgarTool.dechexToInt(xcmAssetInfo.source[0])
        if (this.xcmAssetMap[xcmInteriorKey] == undefined) {
            //console.log(`add new xcm Asset ${xcmInteriorKey}`)
            this.xcmAssetMap[xcmInteriorKey] = xcmAssetInfo
        } else {
            this.xcmAssetMap[xcmInteriorKey].confidence += 1
            this.xcmAssetMap[xcmInteriorKey].source.push(paraIDSource)
        }
        if (this.chainXcmAssetMap[chainkey] == undefined) {
            this.chainXcmAssetMap[chainkey] = {}
            console.log(`creating this.chainXcmAssetMap[${chainkey}]!!!`, this.chainXcmAssetMap[chainkey])
        }
        if (this.chainXcmAssetMap[chainkey][xcmInteriorKey] == undefined) {
            this.chainXcmAssetMap[chainkey][xcmInteriorKey] = xcmAssetInfo
            console.log(`setting this.chainXcmAssetMap[${chainkey}][${xcmInteriorKey}] !!!`, this.chainXcmAssetMap[chainkey][xcmInteriorKey])
        }
    }

    getXcmAsset(xcmInteriorKey) {
        let xcmAssetInfo = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAssetInfo != undefined) {
            return xcmAssetInfo
        }
        return false
    }

    addXcmAssetLocalCurrencyID(xcmInteriorKey, localParaID, localCurrencyID, chainkey) {
        let xcmAsset = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAsset != undefined) {
            //console.log(`add LocalCurrencyID ${xcmInteriorKey}`)
            this.xcmAssetMap[xcmInteriorKey]['xcCurrencyID'][localParaID] = localCurrencyID
        }
        if (this.chainXcmAssetMap[chainkey] == undefined) {
            this.chainXcmAssetMap[chainkey] = {}
            console.log(`currencyID creating this.chainXcmAssetMap[${chainkey}]!!!`, this.chainXcmAssetMap[chainkey])
        }
        try {
            if (this.chainXcmAssetMap[chainkey][xcmInteriorKey] != undefined) {
                this.chainXcmAssetMap[chainkey][xcmInteriorKey]['xcCurrencyID'][localParaID] = localCurrencyID
                console.log(`currencyID setting this.chainXcmAssetMap[${chainkey}][${xcmInteriorKey}]['xcCurrencyID'][${localParaID}] !!!`, this.chainXcmAssetMap[chainkey][xcmInteriorKey]['xcCurrencyID'][localParaID])
            } else {
                console.log(`ELSE! currencyID setting this.chainXcmAssetMap[${chainkey}][${xcmInteriorKey}]['xcCurrencyID'][${localParaID}] !!!`, this.chainXcmAssetMap[chainkey][xcmInteriorKey]['xcCurrencyID'][localParaID])
            }
        } catch (e) {
            console.log(`[${chainkey}] addXcmAssetLocalCurrencyID xcmInteriorKey=${xcmInteriorKey}, localParaID=${localParaID}, localCurrencyID`, localCurrencyID, e)
        }

    }

    addXcmAssetLocalxcContractAddress(xcmInteriorKey, localParaID, localCurrencyID) {
        let xcmAsset = this.xcmAssetMap[xcmInteriorKey]
        if (xcmAsset != undefined) {
            let xcContractAddress = xcmgarTool.xcAssetIDToContractAddr(localCurrencyID)
            //console.log(`add xcContractAddress ${xcContractAddress}`)
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

    getChainXcmAssetMap() {
        return this.chainXcmAssetMap
    }

    getLocalXcAssetMap(chainkey) {
        if (this.chainXcmAssetMap[chainkey] != undefined) {
            return this.chainXcmAssetMap[chainkey]
        } else {
            return false
        }
    }

    getLocalAssetMap(chainkey) {
        if (this.chainAssetMap[chainkey] != undefined) {
            return this.chainAssetMap[chainkey]
        }
        return {}
    }

}