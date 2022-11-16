// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic.

// Polkaholic is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Polkaholic is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Polkaholic.  If not, see <http://www.gnu.org/licenses/>.
const {
    ApiPromise,
    WsProvider
} = require('@polkadot/api');
const {
    u8aToHex,
    hexToU8a
} = require('@polkadot/util');
const {
    decodeAddress
} = require('@polkadot/util-crypto');
const {
    MultiLocation
} = require('@polkadot/types/interfaces');

const Query = require('./query');
const AssetManager = require("./assetManager");
const mysql = require("mysql2");
const paraTool = require("./paraTool");
const Crawler = require("./crawler");
const fs = require('fs');
const path = require("path");

module.exports = class CrawlerManager extends Crawler {
    constructor() {
        super("crawler")
    }

    setDebugLevel(debugLevel = paraTool.debugErrorOnly) {
        this.debugLevel = debugLevel
    }

    newCrawlerTimeUsage(){
        return {
                prepareParaChainBlockRangePeriod: 0,
                initRelayCrawler: 0,
                batchCrawlerInit: 0,
                batchCrawl: 0,
                indexParachains: 0,
                storeManagerMsg: 0,

                prepareParaChainBlockRangePeriodTS: 0,
                initRelayCrawlerTS: 0,
                batchCrawlerInitTS: 0,
                batchCrawlTS: 0,
                indexParachainsTS: 0,
                storeManagerMsgTS: 0,

                overallTS: 0,
        }
    }

    relayChainIDs = [paraTool.chainIDPolkadot, paraTool.chainIDKusama, paraTool.chainIDMoonbaseRelay]
    relayxcmfn = false;
    assetReady = false;
    relayCrawler = false;
    relayChainID = false;
    allCrawlers = {};
    receviedMsgs = {};
    crawlerTimeStat = this.newCrawlerTimeUsage();
    crawlUsageMap = {};

    resetCrawlerTimeUsage() {
        this.crawlerTimeStat = this.newCrawlerTimeUsage()
        this.crawlUsageMap = {}
    }

    showCrawlerTimeUsage(ctx="") {
        if (this.debugLevel >= paraTool.debugInfo) {
            console.log(`${ctx}`)
            console.log(this.crawlerTimeStat)
            console.log(this.crawlUsageMap)
        }
    }

    showCrawlerCurrentMemoryUsage(ctx="") {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (this.debugLevel >= paraTool.debugVerbose) {
            console.log(`${ctx} USED: [${used}MB]`);
            console.log(this.stat);
        }
    }

    log_manager_error(err, op, obj = {}, showOnConsole = true) {
        this.numIndexingErrors++;
        if (showOnConsole) {
            console.log("ERROR", "op", op, obj, this.context, err);
        }
        obj.relayChainID = this.relayChainID;
        obj.context = this.context;
        obj.op = op;
        obj.err = err;
        this.logger.error(obj);
    }

    log_manager_warn(err, op, obj = {}, showOnConsole = true) {
        this.numIndexingWarns++;
        if (showOnConsole) {
            console.log("WARNING", "op", op, obj, this.context, err);
        }
        obj.relayChainID = this.relayChainID;
        obj.context = this.context;
        obj.op = op;
        obj.err = err;
        this.logger.warn(obj);
    }

    sendManagerMessage(chainID, wrapper) {
        if (this.debugLevel >= paraTool.debugTracing) console.log(`Incoming msg from [${chainID}] !!!`, wrapper)
        let relayBN = wrapper.relayBN
        let relayChain = wrapper.relayChain
        let relayBNKey = `${relayChain}_${relayBN}`
        if (this.receviedMsgs[relayBNKey] == undefined) this.receviedMsgs[relayBNKey] = []
        this.receviedMsgs[relayBNKey].push(wrapper)
    }

    // sets up this.relayxcmfn(deleting old version), creating directories as needed
    async open_log(relayChainID, indexTS) {
        const logDir = "/disk1/"
        let fn = `${relayChainID}-${indexTS}.json`
        let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        try {
            // create relayxcm directory
            let relayXcmDir = path.join(logDir, "relayxcm", `${logDT}`);
            if (!fs.existsSync(relayXcmDir)) {
                await fs.mkdirSync(relayXcmDir);
            }
            // set up relayxcm log (deleting old file if exists)
            try {
                this.relayxcmfn = path.join(relayXcmDir, fn);
                console.log("****open_log****", this.relayxcmfn);
                await fs.closeSync(fs.openSync(this.relayxcmfn, 'w'));
            } catch (err) {
                console.log(err);
            }
        } catch (err) {
            this.log_indexing_error(err, "open_log");
        }
    }

    async processReceivedManagerMsg(isFullPeriod = false, xcmIndex = false) {
        let receviedMsgs = this.receviedMsgs
        if (this.debugLevel >= paraTool.debugInfo) console.log(receviedMsgs)
        let xcmList = []

        for (const relayBNKey of Object.keys(receviedMsgs)) {
            let relayBNRecs = receviedMsgs[relayBNKey]
            for (const rec of relayBNRecs) {
                xcmList.push(JSON.stringify(rec))
            }
        }
        if (isFullPeriod) {
            if (xcmIndex){
                await this.write_relayxcm_log(xcmList)
            }else{
                //if xcmIndex. delete it
                await this.write_relayxcm_log([])
            }
        }
        this.receviedMsgs = {}
        if (this.debugLevel >= paraTool.debugInfo) console.log(`processReceivedManagerMsg xcmList`, xcmList)
        return xcmList
    }

    async write_relayxcm_log(xcmList=[]) {
        if (xcmList.length > 0) {
            xcmList.push("");
            try {
                console.log("***** write_relayxcm_log ***** ", this.relayxcmfn)
                await fs.appendFileSync(this.relayxcmfn, xcmList.join("\n"));
            } catch (err) {
                console.log(err);
            }
        }
    }

    //init_chainInfos: {chainInfos, chainNames, specVersions}
    //init_asset_info: {assetInfo, alternativeAssetInfo, symbolRelayChainAsset, xcContractAddress, currencyIDInfo}
    //init_xcm_asset:  {routers, xcmAssetInfo, xcmInteriorInfo, xcmSymbolInfo, xcmConceptInfo}
    //init_paras: {paras}
    //init_storage_keys: {storageKeys}
    //init_accounts: {accounts}
    async initManagerState() {
        this.assetManagerInit()
        this.assetReady = true
        if (this.debugLevel >= paraTool.debugTracing) console.log(`initManagerState Done`)
    }

    getRelayCrawler() {
        if (!this.relayCrawler) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`relayCrawler not ready`)
            return false
        }
        return this.relayCrawler
    }

    getCrawler(parachainID) {
        let paraCrawler = this.allCrawlers[parachainID]
        if (paraCrawler == undefined && paraCrawler) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler [${parachainID}] not ready`)
            //process.exit(0)
            return false
        }
        return paraCrawler
    }

    async initRelayCrawler(relayChainID) {
        let chain = await this.getChain(relayChainID);
        if (!this.relayChainIDs.includes(relayChainID)) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`Expecting relaychain/ Got chain [${chain.chainName}] instead`)
            process.exit(0)
        }
        let initRelayCrawlerStartTS = new Date().getTime();
        let relayCrawler = new Crawler();
        relayCrawler.setDebugLevel(this.debugLevel)
        await relayCrawler.setupAPI(chain);
        await this.cloneAssetManager(relayCrawler) // clone from copy instead of initiating assetManagerInit again
        await relayCrawler.setupChainAndAPI(relayChainID);
        relayCrawler.chain = chain
        this.relayCrawler = relayCrawler
        this.relayChainID = chain.chainID
        if (this.debugLevel >= paraTool.debugInfo) console.log(`setup relayCrawler [${chain.chainID}:${chain.chainName}]`)
        let initRelayCrawlerTS = (new Date().getTime() - initRelayCrawlerStartTS) / 1000
        this.crawlerTimeStat.initRelayCrawler ++
        this.crawlerTimeStat.initRelayCrawlerTS +=  initRelayCrawlerTS

    }

    async initCrawler(parachainID) {
        if (!this.relayCrawler) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`relayCrawler not ready. must call relayCrawler before calling crawler`)
            return
        }
        if (this.allCrawlers[parachainID] != undefined) {
            //if (this.debugLevel >= paraTool.debugTracing) console.log(`${parachainID} already initiated`)
            return
        }
        let chain = await this.getChain(parachainID);
        if (this.relayChainIDs.includes(parachainID)) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`Expecting parachain. Got chain [${chain.chainID}:${chain.chainName}] instead`)
            return
            //process.exit(0)
        }
        let paraCrawler = new Crawler();
        paraCrawler.setDebugLevel(this.debugLevel)
        await paraCrawler.setupAPI(chain);
        await this.cloneAssetManager(paraCrawler) // clone from copy instead of initiating assetManagerInit again
        await paraCrawler.setupChainAndAPI(parachainID);
        await paraCrawler.setParentRelayAndManager(this.relayCrawler, this)
        paraCrawler.chain = chain
        if (this.allCrawlers[parachainID] == undefined) this.allCrawlers[parachainID] = {}
        this.allCrawlers[parachainID] = paraCrawler
        paraCrawler.initTS =  new Date().getTime();
        if (this.debugLevel >= paraTool.debugInfo) console.log(`setup ChainID [${chain.chainID}:${chain.chainName}] Done ${paraCrawler.initTS/1000}`)
    }

    /*
    {
      '0': { blockTSMin: 1668045234, blockTSMax: 1668045258 },
      '2000': { blockTSMin: 1668045201, blockTSMax: 1668045258 },
      '2004': { blockTSMin: 1668045210, blockTSMax: 1668045234 },
      '2012': { blockTSMin: 1668045225, blockTSMax: 1668045243 }
    }
    */

    async batchCrawlerInit(chainIDs) {
        let batchCrawlerInitStartTS = new Date().getTime();
        let initChainIDs = []
        for (const chainID of chainIDs) {
            let crawler = this.getCrawler(chainID)
            if (this.crawlUsageMap[chainID] == undefined) this.crawlUsageMap[chainID] = {
                initTS: 0,
                crawlTS: 0,
                crawl: 0,
            }
            if (!crawler) {
                initChainIDs.push(chainID)
            }
        }

        let crawlerInitPromise = await initChainIDs.map(async (initChainID) => {
            try {
                return this.initCrawler(initChainID)
            } catch (err) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`batch initCrawler ${initChainID}`, err)
                return false
            }
        });

        // parallel init..
        let crawlerInitStates;
        try {
            crawlerInitStates = await Promise.allSettled(crawlerInitPromise);
            //{ status: 'fulfilled', value: ... },
            //{ status: 'rejected', reason: Error: '.....'}
        } catch (e) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawlerInitPromise error`, e, crawlerInitStates)
        }
        let failedChainIDs = []
        for (let i = 0; i < crawlerInitPromise.length; i += 1) {
            let crawlerChainID = initChainIDs[i]
            let crawlerInitState = crawlerInitStates[i]
            if (crawlerInitState.status != undefined && crawlerInitState.status == "fulfilled") {
                //this.crawlUsageMap[crawlerChainID].initStatus = `OK`
                let crawler = this.getCrawler(crawlerChainID)
                let initTS = (crawler.initTS - batchCrawlerInitStartTS) / 1000
                this.crawlUsageMap[crawlerChainID].initTS +=  initTS
                if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler ${crawlerChainID} Init Completed DONE in ${initTS}s`, this.crawlUsageMap)
            } else {
                this.crawlUsageMap[crawlerChainID].initStatus = `Failed`
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawler ${crawlerChainID} state`, crawlerInitState)
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawler ${crawlerChainID} Failed! reason=${crawlerInitState['reason']}`)
                failedChainIDs.push(crawlerChainID)
            }
        }
        let batchCrawlerInitTS = (new Date().getTime() - batchCrawlerInitStartTS) / 1000
        this.crawlerTimeStat.batchCrawlerInit += initChainIDs.length
        this.crawlerTimeStat.batchCrawlerInitTS +=  batchCrawlerInitTS
        return failedChainIDs
    }

    //parallel indexing?
    async batchCrawls(blockRangeMap) {
        let batchCrawlStartTS = new Date().getTime();
        let crawlerPromise = []
        let crawlChainIDs = []
        let chainIDs = Object.keys(blockRangeMap)
        for (const chainID of chainIDs) {
            let crawler = this.getCrawler(chainID)
            if (!crawler) {
                if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler not ready ${chainID} skipped`)
            } else {
                let rangeStruct = blockRangeMap[chainID]
                if (rangeStruct != undefined && Array.isArray(rangeStruct.blocks) && rangeStruct.blocks.length > 0) {
                    let targetBlocks = rangeStruct.blocks
                    if (this.crawlUsageMap[chainID] == undefined) this.crawlUsageMap[chainID] = {
                        initTS: 0,
                        crawlTS: 0,
                        crawl: 0,
                    }
                    crawlChainIDs.push(chainID)
                    crawlerPromise.push(this.indexBlockRanges(crawler, targetBlocks))
                } else {
                    if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`batchCrawls [${chainID}:${crawler.chainName}] rejected rangeStruct`, rangeStruct)
                }
            }
        }
        //parallel crawls..
        let crawlerStates;
        try {
            crawlerStates = await Promise.allSettled(crawlerPromise);
            //{ status: 'fulfilled', value: ... },
            //{ status: 'rejected', reason: Error: '.....'}
        } catch (e) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawlerPromise error`, e, crawlerStates)
        }
        let failedChainIDs = []
        for (let i = 0; i < crawlerPromise.length; i += 1) {
            let crawlerChainID = crawlChainIDs[i]
            let crawlerState = crawlerStates[i]
            if (crawlerState['status'] == 'fulfilled') {
                //this.crawlUsageMap[crawlerChainID].crawlStatus = `OK`
                let crawler = this.getCrawler(crawlerChainID)
                let crawlTS = (crawler.crawlTS - batchCrawlStartTS) / 1000
                this.crawlUsageMap[crawlerChainID].crawlTS +=  crawlTS
                if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler ${crawlerChainID} DONE in ${crawlTS}s`)
            } else {
                this.crawlUsageMap[crawlerChainID].crawlStatus = `Failed`
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawler ${crawlerChainID} state`, crawlerState)
                if (this.debugLevel >= paraTool.debugVerbose) console.log(`crawler ${crawlerChainID} ${crawlerStates['status']}. Reason=${crawlerStates['reason']}`)
                failedChainIDs.push(crawlerChainID)
            }
        }

        let batchCrawlTS = (new Date().getTime() - batchCrawlStartTS) / 1000
        this.crawlerTimeStat.batchCrawl += crawlChainIDs.length
        this.crawlerTimeStat.batchCrawlTS +=  batchCrawlTS
        return failedChainIDs
    }

    //easy to debug...
    async serialCrawls(blockRangeMap) {
        let chainIDs = Object.keys(blockRangeMap)
        for (const chainID of chainIDs) {
            let crawler = this.getCrawler(chainID)
            if (!crawler) {
                console.log(`crawler not ready ${chainID} skipped`)
            } else {
                let rangeStruct = blockRangeMap[chainID]
                if (rangeStruct != undefined && Array.isArray(rangeStruct.blocks) && rangeStruct.blocks.length > 0) {
                    let targetBlocks = rangeStruct.blocks
                    await this.indexBlockRanges(crawler, targetBlocks)
                } else {
                    if (this.debugLevel >= paraTool.debugVerbose) console.log(`serialCrawls ${chainID} rejected rangeStruct`, rangeStruct)
                }
            }
        }
    }

    async prepareParaChainBlockRangePeriod(relayChainID, logDT, hr) {
        let indexTSPeriod = paraTool.logDT_hr_to_ts(logDT, hr);
        let targetSQL = `select floor(UNIX_TIMESTAMP(blockTS)/3600)*3600 as indexTS, blockNumber, blockTS, blockHash, stateRoot, convert(xcmMeta using utf8) as xcmMeta from xcmmeta${relayChainID} where blockTS >= ${indexTSPeriod} and blockTS < ${indexTSPeriod+3600} order by indexTS;`
        if (this.debugLevel >= paraTool.debugTracing) console.log(`targetSQL`, targetSQL)
        let recs = await this.poolREADONLY.query(targetSQL);
        let xcmMetaMap = {}
        for (const rec of recs) {
            try {
                xcmMetaMap[rec.blockNumber] = JSON.parse(rec.xcmMeta)
            } catch (e) {
                console.log(`err`, e)
            }
        }

        //console.log(`xcmMetaMap`, xcmMetaMap)
        let xcmMetaMapStr = JSON.stringify(xcmMetaMap)
        let xcmMap = this.decodeXcmMetaMap(xcmMetaMapStr)
        if (this.debugLevel >= paraTool.debugTracing) console.log(`xcmMap`, xcmMap)
        let [blockRangeMap, hrmpRangeMap] = await this.analyzeXcmMap(xcmMap)
        if (this.debugLevel >= paraTool.debugTracing) console.log(`hrmpRangeMap`, hrmpRangeMap)
        return blockRangeMap
    }

    async processIndexRangeMap(blockRangeMap) {
        let res = {
            status: "success",
            errorDesc: null,
        }
        let chainIDs = Object.keys(blockRangeMap)
        let initFailedChainIDs = await this.batchCrawlerInit(chainIDs)
        if (initFailedChainIDs.length > 0) {
            let errorMsg = `initFailedChainIDs failed for chains=${initFailedChainIDs}`;
            res.status = "failure"
            res.errorDesc = errorMsg
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(errorMsg)
        }
        let crawlFailedChainIDs = await this.batchCrawls(blockRangeMap)
        if (crawlFailedChainIDs.length > 0) {
            let errorMsg = `initFailedChainIDs failed for chains=${initFailedChainIDs}`;
            res.status = "failure"
            res.errorDesc = errorMsg
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawlFailedChainIDs failed for chains=${initFailedChainIDs}`)
        }
        return res
    }

    async blockRangeToblocks(rangeStruct) {
        let chainID = rangeStruct.chainID
        let blocks = []
        for (let i = rangeStruct.startBN; i <= rangeStruct.endBN; i++) {
            blocks.push(i)
            /*
            let blockHash = await this.getBlockHashFinalized(chainID, i)
            if (blockHash != undefined){
                let r = {
                    blockNumber: i,
                    blockHash: blockHash
                }
                //let r = `${i}|${blockHash}`
                blocks.push(r)
            }else{
                if (this.debugLevel >= paraTool.debugInfo) console.log(`blockRangeToblocks [${chainID}] block#${i} not found!!!`)
            }
            */
        }
        //console.log(`blockRangeToblocks blocks`, blocks)
        return blocks
    }

    async hrmpRangeMapToBlockRangeMap(hrmpRangeMap) {
        let blockRangeMap = {}
        let chainIDs = Object.keys(hrmpRangeMap)
        for (const chainID of chainIDs) {
            let t = hrmpRangeMap[chainID]
            let blockTSRange = t.blockTSRange
            let blockMap = {}
            let uniqueBlks = []
            let blockTSRangeLen = blockTSRange.length
            for (let i = 0; i < blockTSRangeLen; i++) {
                let rn = blockTSRange[i]
                let r = await this.getBlockRangebyTS(chainID, rn.blockTSMin, rn.blockTSMax)
                if (r) {
                    if (this.debugLevel >= paraTool.debugVerbose) console.log(`[chainID=${chainID}] [${i+1}/${blockTSRangeLen}] rangeStruct [${rn.blockTSMin}, ${rn.blockTSMax})`, r)
                    let blocks = await this.blockRangeToblocks(r)
                    if (this.debugLevel >= paraTool.debugVerbose) console.log(`[chainID=${chainID}] [${i+1}/${blockTSRangeLen}] rangeStruct blockLen=${blocks.length}`, blocks)
                    for (const b of blocks) {
                        if (blockMap[b] == undefined) {
                            blockMap[b] = 1
                            //let bStr = `${b.blockNumber}|${b.blockHash}`
                            uniqueBlks.push(paraTool.dechexToInt(b))
                        }
                    }
                }
            }
            blockRangeMap[chainID] = {}
            blockRangeMap[chainID].blocks = uniqueBlks
            blockRangeMap[chainID].blockLen = uniqueBlks.length
            if (this.debugLevel >= paraTool.debugVerbose) console.log(`${chainID} unique=${uniqueBlks.length}`, uniqueBlks)
        }
        //TODO: reduction here
        if (this.debugLevel >= paraTool.debugTracing) console.log(`blockRangeMap`, blockRangeMap)
        return blockRangeMap
    }


    async cloneAssetManager(crawler) {
        if (!this.assetReady) {
            if (this.debugLevel >= paraTool.debugVerbose) console.log(`AssetInit not ready!`)
            await this.initManagerState();
        }
        //init_chainInfos {chainInfos, chainNames, specVersions}
        crawler.chainInfos = this.chainInfos
        crawler.chainNames = this.chainNames
        crawler.specVersions = this.specVersions

        //init_asset_info {assetInfo, alternativeAssetInfo, symbolRelayChainAsset, xcContractAddress, currencyIDInfo}
        crawler.assetInfo = this.assetInfo
        crawler.alternativeAssetInfo = this.alternativeAssetInfo
        crawler.symbolRelayChainAsset = this.symbolRelayChainAsset
        crawler.xcContractAddress = this.xcContractAddress
        crawler.currencyIDInfo = this.currencyIDInfo

        //init_xcm_asset:  {routers, xcmAssetInfo, xcmInteriorInfo, xcmSymbolInfo, xcmConceptInfo}
        crawler.routers = this.routers
        crawler.xcmAssetInfo = this.xcmAssetInfo
        crawler.xcmInteriorInfo = this.xcmInteriorInfo
        crawler.xcmSymbolInfo = this.xcmSymbolInfo
        crawler.xcmConceptInfo = this.xcmConceptInfo

        //init_paras: {paras}
        crawler.paras = this.paras

        //init_storage_keys: {storageKeys}
        crawler.storageKeys = this.storageKeys

        //init_accounts: {accounts}
        crawler.accounts = this.accounts
        if (this.debugLevel >= paraTool.debugInfo) console.log(`cloneAssetManager [${crawler.chainID}:${crawler.chainName}] Done`)
    }

    async indexBlockRanges(crawler, blocks) {
        let xcmMetaMap = {}
        let blockRangeLen = blocks.length
        console.log(`blocks`, blocks)
        for (let i = 0; i < blockRangeLen; i++) {
            /*
            let b = blocks[i]
            let pieces = b.split('|')
            if (pieces.length != 2) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${crawler.chainID}:${crawler.chainName}] [${i+1}/${blockRangeLen}] malformed pieces=${pieces}`)
                continue
            }
            let bn = pieces[0]
            let blkHash = pieces[1]
            */
            let bn = blocks[i]
            console.log(`bn`, bn)
            if (this.debugLevel >= paraTool.debugInfo) console.log(`[${crawler.chainID}:${crawler.chainName}] [${i+1}/${blockRangeLen}] indexBlockRanges bn=${bn}`)
            let xcmMeta = await crawler.index_block(crawler.chain, bn);
            if (Array.isArray(xcmMeta) && xcmMeta.length > 0) {
                xcmMetaMap[bn] = xcmMeta
            }
        }
        if (this.crawlUsageMap[crawler.chainID] == undefined) this.crawlUsageMap[crawler.chainID] = {
            initTS: 0,
            crawlTS: 0,
            crawl: 0,
        }
        this.crawlUsageMap[crawler.chainID].crawl += blockRangeLen
        crawler.crawlTS = new Date().getTime();
        let xcmMetaMapStr = JSON.stringify(xcmMetaMap)
        return xcmMetaMapStr
    }

    decodeXcmMetaMap(xcmMetaMapStr) {
        let xcmMap = {}
        try {
            let xcmMetaMap = JSON.parse(xcmMetaMapStr)
            for (const relayBN of Object.keys(xcmMetaMap)) {
                let xcmMetas = xcmMetaMap[relayBN]
                let xcmList = []
                for (const xcmMeta of xcmMetas) {
                    let xcm = this.unwrapXcmMeta(xcmMeta)
                    if (xcm) {
                        xcmList.push(xcm)
                    }
                }
                if (xcmList.length > 0) xcmMap[relayBN] = xcmList
            }
        } catch (e) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`decodeXcmMetaMap err`, e)
        }
        return xcmMap
    }

    unwrapXcmMeta(xcmMeta) {
        let fieldListStr = "blockTS|msgType|relayChain|blockNumber|relayParentStateRoot|relayBlockHash|chainID|chainIDDest|sentAt|relayedAt|includedAt|msgHash"
        let intFldStr = "blockTS|blockNumber|chainID|chainIDDest|sentAt|relayedAt|includedAt"
        let fileds = fieldListStr.split('|')
        let intFileds = intFldStr.split('|')
        let xcmMetaFlds = xcmMeta.split('|')
        if (xcmMetaFlds.length != fileds.length) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`unrecognized xcmMeta! xcmMetaFlds=${xcmMetaFlds}, expectedFlds=${fileds}`)
            return false
        }
        let xcm = {}
        for (let i = 0; i < fileds.length; i++) {
            let fieldkey = fileds[i]
            let fieldVal = xcmMetaFlds[i]
            if (intFileds.includes(fieldkey)) fieldVal = paraTool.dechexToInt(fieldVal)
            xcm[fieldkey] = fieldVal
        }
        return xcm
    }

    async analyzeXcmMap(xcmMap) {
        let hrmpRangeMap = {}
        for (const relayBN of Object.keys(xcmMap)) {
            let xcmList = xcmMap[relayBN]
            //console.log(`relayBN=${relayBN}`, xcmList)
            for (const x of xcmList) {
                let msgType = x.msgType
                let chainID = x.chainID
                let chainIDDest = x.chainIDDest
                let sentAt = x.sentAt
                let blockNumber = x.blockNumber
                let relayedAt = x.relayedAt
                let includedAt = x.includedAt //potentially off by 1
                let blockFreq = 6 // 6s per block
                let diffAdjustmentTS = (relayedAt - blockNumber) * blockFreq
                let rawBlockTS = x.blockTS
                let blockTS = rawBlockTS + diffAdjustmentTS
                if (diffAdjustmentTS != 0) {
                    if (this.debugLevel >= paraTool.debugTracing) console.log(`[${x.msgHash}] [${msgType}] diffAdjustmentTS=${diffAdjustmentTS}, relayedAt=${relayedAt}, blockNumber=${blockNumber} rawBlockTS=${rawBlockTS}, adjustedTS=${blockTS}`)
                }
                if (hrmpRangeMap[chainID] == undefined) hrmpRangeMap[chainID] = {
                    //hrmpBN: [],
                    blockTSRange: [],
                }
                if (hrmpRangeMap[chainIDDest] == undefined) hrmpRangeMap[chainIDDest] = {
                    //hrmpBN: [],
                    blockTSRange: [],
                }
                if (msgType == 'ump') {
                    let originationTSMin = blockTS - blockFreq * 1.5
                    let originationTSMax = blockTS + blockFreq * 1.5
                    let destinationTSMin = blockTS - blockFreq * 0.25 // optimistically it's 0, but use higher bound to be safe
                    let destinationTSMax = blockTS + blockFreq * 3
                    hrmpRangeMap[chainID].blockTSRange.push({
                        blockTSMin: originationTSMin,
                        blockTSMax: originationTSMax,
                    })
                    hrmpRangeMap[chainIDDest].blockTSRange.push({
                        blockTSMin: destinationTSMin,
                        blockTSMax: destinationTSMax,
                    })
                    //console.log(`ump [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                } else if (msgType == 'dmp') {
                    let originationTSMin = blockTS - blockFreq * 0.25 // optimistically it's 0, but use higher bound to be safe
                    let originationTSMax = blockTS + blockFreq * 3
                    let destinationTSMin = blockTS - blockFreq * 0.25 // optimistically it's 0, but use higher bound to be safe
                    let destinationTSMax = blockTS + blockFreq * 3
                    hrmpRangeMap[chainID].blockTSRange.push({
                        blockTSMin: originationTSMin,
                        blockTSMax: originationTSMax,
                    })
                    hrmpRangeMap[chainIDDest].blockTSRange.push({
                        blockTSMin: destinationTSMin,
                        blockTSMax: destinationTSMax,
                    })
                    //console.log(`dmp [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                } else if (msgType == 'hrmp') {
                    let originationTSMin = blockTS - blockFreq * 1.5
                    let originationTSMax = blockTS + blockFreq * 1.5
                    let destinationTSMin = blockTS - blockFreq * 0.25 // optimistically it's 0, but use higher bound to be safe
                    let destinationTSMax = blockTS + blockFreq * 4
                    hrmpRangeMap[chainID].blockTSRange.push({
                        blockTSMin: originationTSMin,
                        blockTSMax: originationTSMax,
                    })
                    hrmpRangeMap[chainIDDest].blockTSRange.push({
                        blockTSMin: destinationTSMin,
                        blockTSMax: destinationTSMax,
                    })
                    //console.log(`hrmp [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                }
            }
        }
        //if (this.debugLevel >= paraTool.debugTracing) console.log(`hrmpRangeMap`, JSON.stringify(hrmpRangeMap))
        let blockRangeMap = await this.hrmpRangeMapToBlockRangeMap(hrmpRangeMap)
        //if (this.debugLevel >= paraTool.debugTracing) console.log(`blockRangeMap`, JSON.stringify(hrmpRangeMap))
        return [blockRangeMap, hrmpRangeMap]
    }

    async indexXcmBlockRangePeriod(relayChainID, lookbackBackfillDays = 60, audit = false, backfill = false, write_bq_log = true, techniqueParams = ["mod", 0, 1]) {
        /*
        this.chainID = chain.chainID;
        // (1) audit_chain the period, which marks crawlBlock=1, crawlTrace=1 for the period
        if (audit) {
            console.log("auditChain");
            await this.auditChain(chain);
        }

        // (2) get the missed blocks for the last {lookback} days (assumes 360 blocks per hour)
        if (backfill) {
            console.log("backfill");
            await this.crawlBackfill(chain, ["range", chain.blocksFinalized - lookbackBackfillDays * 360 * 24, chain.blocksFinalized])
        }
        chain = await this.setupChainAndAPI(relayChainID);
        await this.assetManagerInit()
        this.resetTimeUsage()
        */

        // adding xcmIndexed, xcmReadyForIndexing, xcmAttempted, xcmIndexDT, xcmElapsedSeconds, xcmLastAttemptStartDT
        var w = "";
        if (techniqueParams[0] == "mod") {
            let n = techniqueParams[1];
            let nmax = techniqueParams[2];
            if (nmax > 1) {
                w = ` and round(indexTS/3600) % ${nmax} = ${n}`;
            }
        }
        var sql = `select chainID, indexTS from indexlog where xcmIndexed = 0 and xcmReadyForIndexing = 1 and chainID = '${relayChainID}' and indexTS < UNIX_TIMESTAMP(Now()) - 3600 and xcmAttempted < 1 ${w} order by xcmAttempted, indexTS`;
        var indexlogs = await this.pool.query(sql);
        if (indexlogs.length == 0) {
            console.log(`indexXcmBlockRangePeriod ${relayChainID}: no work to do`, sql)
            return (false);
        }
        let indexPeriodProcessedCnt = 0
        for (let i = 0; i < indexlogs.length; i++) {
            let indexTS = indexlogs[i].indexTS
            let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
            let isSuccess = await this.processXcmBlockRangePeriod(relayChainID, logDT, hr);
            //need xcmElapsedSeconds
            if (isSuccess) {
                //success
                // increment attempted, which generally will mean some other indexer won't attempt the same thing until its the last unprocessed hour
                let sql0 = `update indexlog set xcmIndexed = 1 , xcmIndexDT = NOW() where chainID = '${relayChainID}' and indexTS = ${indexTS}`
                this.batchedSQL.push(sql0);
                await this.update_batchedSQL();
            } else {
                //failures
                let sql0 = `update indexlog set xcmAttempted = xcmAttempted + 1, xcmLastAttemptStartDT = Now() where chainID = '${relayChainID}' and indexTS = ${indexTS}`
                this.batchedSQL.push(sql0);
                await this.update_batchedSQL();
            }
        }
    }

    async processXcmBlockRangePeriod(relayChainID, logDT, hr) {
        let overallStartTS = new Date().getTime();
        let indexTS = paraTool.logDT_hr_to_ts(logDT, hr)
        let ctx = `${paraTool.getRelayChainByChainID(relayChainID)} ${logDT} ${hr} | ${indexTS}`
        //step 0: init relayCrawler if not cached
        let relayCrawler = this.getRelayCrawler()
        if (!relayCrawler) await this.initRelayCrawler(relayChainID)

        // step1: generating blockRangeMap
        this.crawlerTimeStat.prepareParaChainBlockRangePeriod++
        let prepareParaChainBlockRangePeriodStartTS = new Date().getTime();
        let blockRangeMap = await this.prepareParaChainBlockRangePeriod(relayChainID, logDT, hr);
        let prepareParaChainBlockRangePeriodTS = (new Date().getTime() - prepareParaChainBlockRangePeriodStartTS) / 1000
        this.crawlerTimeStat.prepareParaChainBlockRangePeriodTS += prepareParaChainBlockRangePeriodTS


        // step2: processIndexRangeMap for all relaychain
        if (this.debugLevel > paraTool.debugVerbose) console.log(`prepareParaChainBlockRangePeriod [${ctx}] blockRangeMap`, blockRangeMap)
        this.crawlerTimeStat.indexParachains++
        let indexParachainStartTS = new Date().getTime();
        let indexRes = await this.processIndexRangeMap(blockRangeMap)
        let indexParachainTS = (new Date().getTime() - indexParachainStartTS) / 1000
        this.crawlerTimeStat.indexParachainsTS += indexParachainTS
        let xcmIndexed = (indexRes.status == "success") ? 1 : 0;

        // step3: TODO: write xcm trace to disk1
        await this.open_log(relayChainID, indexTS)
        this.crawlerTimeStat.storeManagerMsg++
        let storeManagerMsgStartTS = new Date().getTime();
        await this.processReceivedManagerMsg(true, xcmIndexed)
        let storeManagerMsgTS = (new Date().getTime() - storeManagerMsgStartTS) / 1000
        this.crawlerTimeStat.storeManagerMsgTS +=  storeManagerMsgTS

        let xcmElapsedSeconds = (new Date().getTime() - overallStartTS) / 1000
        this.crawlerTimeStat.overallTS +=  xcmElapsedSeconds

        await this.upsertSQL({
            "table": "indexlog",
            "keys": ["chainID", "indexTS"],
            "vals": ["logDT", "hr", "xcmIndexDT", "xcmElapsedSeconds", "xcmIndexed", "xcmReadyForIndexing"],
            "data": [`('${relayChainID}', '${indexTS}', '${logDT}', '${hr}', Now(), '${xcmElapsedSeconds}', '${xcmIndexed}', 1)`],
            "replace": ["logDT", "hr", "xcmIndexDT", "xcmElapsedSeconds", "xcmIndexed", "xcmReadyForIndexing"]
        });

        await this.update_batchedSQL();
        this.logger.info({
            op: "processXcmBlockRangePeriod",
            relayChainID,
            logDT
        });
        this.showCrawlerTimeUsage(ctx)
        this.showCrawlerCurrentMemoryUsage(ctx)
        this.resetCrawlerTimeUsage(ctx)
        return xcmIndexed
    }
}
