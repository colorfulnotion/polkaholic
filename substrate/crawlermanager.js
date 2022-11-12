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

module.exports = class CrawlerManager extends Crawler {
    constructor() {
        super("crawler")
    }

    setDebugLevel(debugLevel = paraTool.debugErrorOnly) {
        this.debugLevel = debugLevel
    }

    assetReady = false;
    relayCrawler = false;
    allCrawlers = {};
    receviedMsgs = {};

    relayChainIDs = [paraTool.chainIDPolkadot, paraTool.chainIDKusama, paraTool.chainIDMoonbaseRelay]

    sendMsg(chainID, wrapper){
        if (this.debugLevel >= paraTool.debugInfo) console.log(`Incoming msg from [${chainID}] !!!`, wrapper)
        let relayBN = wrapper.relayBN
        let relayChain = wrapper.relayChain
        let relayBNKey = `${relayChain}_${relayBN}`
        if (this.receviedMsgs[relayBNKey] == undefined) this.receviedMsgs[relayBNKey] = []
        this.receviedMsgs[relayBNKey].push(wrapper)
    }

    processReceivedmsg(){
        //TODO...
        let receviedMsgs = this.receviedMsgs
        if (this.debugLevel >= paraTool.debugInfo) console.log(receviedMsgs)
        let returnedMsgs = {}
        for (const relayBNKey of Object.keys(receviedMsgs)){
            let relayBNRecs = receviedMsgs[relayBNKey]
            let recStrList = []
            for (const rec of relayBNRecs){
                recStrList.push(JSON.stringify(rec))
            }
            returnedMsgs[relayBNKey] = recStrList
        }
        if (Object.keys(returnedMsgs).length = 0){
            return false
        }
        return returnedMsgs
    }

    //init_chainInfos: {chainInfos, chainNames, specVersions}
    //init_asset_info: {assetInfo, alternativeAssetInfo, symbolRelayChainAsset, xcContractAddress, currencyIDInfo}
    //init_xcm_asset:  {routers, xcmAssetInfo, xcmInteriorInfo, xcmSymbolInfo, xcmConceptInfo}
    //init_paras: {paras}
    //init_storage_keys: {storageKeys}
    //init_accounts: {accounts}
    async initManagerState(){
        this.assetManagerInit()
        this.assetReady = true
        if (this.debugLevel >= paraTool.debugTracing) console.log(`initManagerState Done`)
    }

    getRelayCrawler(){
        if (!this.relayCrawler){
            if (this.debugLevel >= paraTool.debugInfo) console.log(`relayCrawler not ready`)
            return
        }
        return this.relayCrawler
    }

    getCrawler(parachainID){
        let paraCrawler = this.allCrawlers[parachainID]
        if (paraCrawler == undefined && paraCrawler) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler [${parachainID}] not ready`)
            //process.exit(0)
            return false
        }
        return paraCrawler
    }

    async initRelayCrawler(relayChainID){
        let chain = await this.getChain(relayChainID);

        if (!this.relayChainIDs.includes(relayChainID)){
            if (this.debugLevel >= paraTool.debugInfo) console.log(`Expecting relaychain/ Got chain [${chain.chainName}] instead`)
            process.exit(0)
        }
        let relayCrawler = new Crawler();
        relayCrawler.setDebugLevel(this.debugLevel)
        await relayCrawler.setupAPI(chain);
        await this.cloneAssetManager(relayCrawler) // clone from copy instead of initiating assetManagerInit again
        await relayCrawler.setupChainAndAPI(relayChainID);
        relayCrawler.chain = chain
        this.relayCrawler = relayCrawler
        if (this.debugLevel >= paraTool.debugInfo) console.log(`setup relayCrawler [${chain.chainID}:${chain.chainName}]`)
    }

    async initCrawler(parachainID){
        if (!this.relayCrawler){
            if (this.debugLevel >= paraTool.debugInfo) console.log(`relayCrawler not ready. must call relayCrawler before calling crawler`)
            return
        }
        if (this.allCrawlers[parachainID] != undefined) {
            //if (this.debugLevel >= paraTool.debugTracing) console.log(`${parachainID} already initiated`)
            return
        }
        let chain = await this.getChain(parachainID);
        if (this.relayChainIDs.includes(parachainID)){
            if (this.debugLevel >= paraTool.debugInfo)  console.log(`Expecting parachain. Got chain [${chain.chainID}:${chain.chainName}] instead`)
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
        if (this.debugLevel >= paraTool.debugInfo) console.log(`setup ChainID [${chain.chainID}:${chain.chainName}] Done`)
    }

    /*
    {
      '0': { blockTSMin: 1668045234, blockTSMax: 1668045258 },
      '2000': { blockTSMin: 1668045201, blockTSMax: 1668045258 },
      '2004': { blockTSMin: 1668045210, blockTSMax: 1668045234 },
      '2012': { blockTSMin: 1668045225, blockTSMax: 1668045243 }
    }
    */

    async batchCrawlerInit(chainIDs){
        let initChainIDs= []
        for (const chainID of chainIDs){
            let crawler = this.getCrawler(chainID)
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

        for (let i = 0; i < crawlerInitPromise.length; i += 1){
            let crawlerChainID = initChainIDs[i]
            let crawlerInitState = crawlerInitStates[i]
            if (crawlerInitState.status != undefined && crawlerInitState.status == "fulfilled") {
                if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler ${crawlerChainID} Init Completed`)
            }else{
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawler ${crawlerChainID} state`, crawlerInitState)
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawler ${crawlerChainID} Failed! reason=${crawlerInitState['reason']}`)
            }
        }
    }

    //TODO: parallel indexing?
    async batchCrawls(blockRangeMap){
        let crawlerPromise = []
        let crawlChainIDs= []
        let chainIDs = Object.keys(blockRangeMap)
        for (const chainID of chainIDs){
            let crawler = this.getCrawler(chainID)
            if (!crawler) {
                if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler not ready ${chainID} skipped`)
            }else{
                let rangeStruct = blockRangeMap[chainID]
                if (rangeStruct != undefined && Array.isArray(rangeStruct.blocks) && rangeStruct.blocks.length > 0){
                    let targetBlocks = rangeStruct.blocks
                    crawlChainIDs.push(chainID)
                    crawlerPromise.push(this.indexBlockRanges(crawler, targetBlocks))
                }else{
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

        for (let i = 0; i < crawlerPromise.length; i += 1){
            let crawlerChainID = crawlChainIDs[i]
            let crawlerState = crawlerStates[i]
            if (crawlerState['status'] == 'fulfilled') {
                if (this.debugLevel >= paraTool.debugInfo) console.log(`crawler ${crawlerChainID} DONE`)
            }else{
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawler ${crawlerChainID} state`, crawlerState)
                if (this.debugLevel >= paraTool.debugVerbose) console.log(`crawler ${crawlerChainID} ${crawlerStates['status']}. Reason=${crawlerStates['reason']}`)
            }
        }
    }

    //easy to debug...
    async serialCrawls(blockRangeMap){
        let chainIDs = Object.keys(blockRangeMap)
        for (const chainID of chainIDs){
            let crawler = this.getCrawler(chainID)
            if (!crawler) {
                console.log(`crawler not ready ${chainID} skipped`)
            }else{
                let rangeStruct = blockRangeMap[chainID]
                if (rangeStruct != undefined && Array.isArray(rangeStruct.blocks) && rangeStruct.blocks.length > 0){
                    let targetBlocks = rangeStruct.blocks
                    await this.indexBlockRanges(crawler, targetBlocks)
                }else{
                    if (this.debugLevel >= paraTool.debugVerbose) console.log(`serialCrawls ${chainID} rejected rangeStruct`, rangeStruct)
                }
            }
        }
    }

    async processIndexRangeMap(blockRangeMap){
        let chainIDs = Object.keys(blockRangeMap)
        await this.batchCrawlerInit(chainIDs)
        await this.batchCrawls(blockRangeMap)
        //await this.serialCrawls(blockRangeMap)
    }

    async blockRangeToblocks(rangeStruct){
        let chainID = rangeStruct.chainID
        let blocks = []
        for (let i = rangeStruct.startBN; i <= rangeStruct.endBN; i++){
            let blockHash = await this.getBlockHashFinalized(chainID, i)
            let r = {
                blockNumber: i,
                blockHash: blockHash
            }
            blocks.push(r)
        }
        //console.log(`blockRangeToblocks blocks`, blocks)
        return blocks
    }

    async hrmpRangeMapToBlockRangeMap(hrmpRangeMap){
        let blockRangeMap = {}
        let chainIDs = Object.keys(hrmpRangeMap)
        for (const chainID of chainIDs){
            let t = hrmpRangeMap[chainID]
            let r = await this.getBlockRangebyTS(chainID, t.blockTSMin, t.blockTSMax)
            if (r){
                // if (this.debugLevel >= paraTool.debugTracing) console.log(`rangeStruct`, r)
                r.blocks = await this.blockRangeToblocks(r)
                blockRangeMap[chainID] = r
            }
        }
        if (this.debugLevel >= paraTool.debugTracing) console.log(`blockRangeMap`, blockRangeMap)
        return blockRangeMap
    }


    async cloneAssetManager(crawler){
        if (!this.assetReady){
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

    async indexBlockRanges(crawler, blocks){
        let xcmMetaMap = {}
        let blockRangeLen = blocks.length
        for (let i = 0; i < blockRangeLen; i++){
            let b = blocks[i]
            let bn = b.blockNumber
            let blkHash = b.blockHash
            if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${crawler.chainID}:${crawler.chainName}] [${i+1}/${blockRangeLen}] indexBlockRanges bn=${bn} blkHash=${blkHash}`)
            let xcmMeta = await crawler.index_block(crawler.chain, bn, blkHash);
            if (Array.isArray(xcmMeta) && xcmMeta.length > 0){
                xcmMetaMap[bn] = xcmMeta
            }
        }
        let xcmMetaMapStr = JSON.stringify(xcmMetaMap)
        return xcmMetaMapStr
    }

    decodeXcmMetaMap(xcmMetaMapStr){
        let xcmMap = {}
        try {
            let xcmMetaMap = JSON.parse(xcmMetaMapStr)
            for (const relayBN of Object.keys(xcmMetaMap)){
                let xcmMetas = xcmMetaMap[relayBN]
                let xcmList = []
                for (const xcmMeta of xcmMetas){
                    let xcm = this.unwrapXcmMeta(xcmMeta)
                    if (xcm){
                        xcmList.push(xcm)
                    }
                }
                if (xcmList.length > 0) xcmMap[relayBN] = xcmList
            }
        } catch (e){
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`decodeXcmMetaMap err`, e)
        }
        return xcmMap
    }

    unwrapXcmMeta(xcmMeta){
        let fieldListStr = "blockTS|msgType|relayChain|blockNumber|relayParentStateRoot|relayBlockHash|chainID|chainIDDest|sentAt|relayedAt|includedAt|msgHash"
        let intFldStr = "blockTS|blockNumber|chainID|chainIDDest|sentAt|relayedAt|includedAt"
        let fileds = fieldListStr.split('|')
        let intFileds = intFldStr.split('|')
        let xcmMetaFlds = xcmMeta.split('|')
        if (xcmMetaFlds.length != fileds.length){
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`unrecognized xcmMeta! xcmMetaFlds=${xcmMetaFlds}, expectedFlds=${fileds}`)
            return false
        }
        let xcm = {}
        for (let i = 0; i < fileds.length; i++){
            let fieldkey = fileds[i]
            let fieldVal = xcmMetaFlds[i]
            if (intFileds.includes(fieldkey)) fieldVal = paraTool.dechexToInt(fieldVal)
            xcm[fieldkey] = fieldVal
        }
        return xcm
    }

    async analyzeXcmMap(xcmMap){
        let hrmpRangeMap = {}
        for (const relayBN of Object.keys(xcmMap)){
            let xcmList = xcmMap[relayBN]
            //console.log(`relayBN=${relayBN}`, xcmList)
            for (const x of xcmList){
                let msgType = x.msgType
                let chainID = x.chainID
                let chainIDDest = x.chainIDDest
                let sentAt = x.sentAt
                let relayedAt = x.relayedAt
                let blockTS = x.blockTS
                let includedAt = x.includedAt //potentially off by 1
                let blockFreq = 6 // 6s per block
                if (hrmpRangeMap[chainID] == undefined) hrmpRangeMap[chainID] = {
                    //hrmpBN: [],
                    blockTSRange: [],
                    blockTSMin: blockTS,
                    blockTSMax: blockTS,
                }
                if (hrmpRangeMap[chainIDDest] == undefined) hrmpRangeMap[chainIDDest] = {
                    //hrmpBN: [],
                    blockTSRange: [],
                    blockTSMin: blockTS,
                    blockTSMax: blockTS,
                }
                if (msgType == 'ump'){
                    //hrmpRangeMap[chainID].hrmpBN.push(sentAt)
                    //hrmpRangeMap[chainIDDest].hrmpBN.push(includedAt)
                    let originationTSMin = blockTS - blockFreq*1.5
                    let originationTSMax = blockTS + blockFreq*1.5
                    let destinationTSMin = blockTS
                    let destinationTSMax = blockTS + blockFreq*3
                    //console.log(`ump [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                    if (hrmpRangeMap[chainID].blockTSMin > originationTSMin) hrmpRangeMap[chainID].blockTSMin = originationTSMin
                    if (originationTSMax > hrmpRangeMap[chainID].blockTSMax) hrmpRangeMap[chainID].blockTSMax = originationTSMax
                    if (hrmpRangeMap[chainIDDest].blockTSMin > destinationTSMin) hrmpRangeMap[chainIDDest].blockTSMin = destinationTSMin
                    if (destinationTSMax > hrmpRangeMap[chainIDDest].blockTSMax) hrmpRangeMap[chainIDDest].blockTSMax = destinationTSMax
                }else if (msgType == 'dmp'){
                    //hrmpRangeMap[chainID].hrmpBN.push(sentAt)
                    //hrmpRangeMap[chainIDDest].hrmpBN.push(includedAt)
                    let originationTSMin = blockTS
                    let originationTSMax = blockTS + blockFreq*3
                    let destinationTSMin = blockTS
                    let destinationTSMax = blockTS + blockFreq*3
                    //console.log(`dmp [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                    if (hrmpRangeMap[chainID].blockTSMin > originationTSMin) hrmpRangeMap[chainID].blockTSMin = originationTSMin
                    if (originationTSMax > hrmpRangeMap[chainID].blockTSMax) hrmpRangeMap[chainID].blockTSMax = originationTSMax
                    if (hrmpRangeMap[chainIDDest].blockTSMin > destinationTSMin) hrmpRangeMap[chainIDDest].blockTSMin = destinationTSMin
                    if (destinationTSMax > hrmpRangeMap[chainIDDest].blockTSMax) hrmpRangeMap[chainIDDest].blockTSMax = destinationTSMax
                }else if (msgType == 'hrmp'){
                    //hrmpRangeMap[chainID].hrmpBN.push(sentAt)
                    //hrmpRangeMap[chainIDDest].hrmpBN.push(includedAt)
                    let originationTSMin = blockTS - blockFreq*1.5
                    let originationTSMax = blockTS + blockFreq*1.5
                    let destinationTSMin = blockTS
                    let destinationTSMax = blockTS + blockFreq*4
                    //console.log(`hrmp [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                    if (hrmpRangeMap[chainID].blockTSMin > originationTSMin) hrmpRangeMap[chainID].blockTSMin = originationTSMin
                    if (originationTSMax > hrmpRangeMap[chainID].blockTSMax) hrmpRangeMap[chainID].blockTSMax = originationTSMax
                    if (hrmpRangeMap[chainIDDest].blockTSMin > destinationTSMin) hrmpRangeMap[chainIDDest].blockTSMin = destinationTSMin
                    if (destinationTSMax > hrmpRangeMap[chainIDDest].blockTSMax) hrmpRangeMap[chainIDDest].blockTSMax = destinationTSMax
                }
            }
        }
        if (this.debugLevel >= paraTool.debugInfo) console.log(`hrmpRangeMap`, hrmpRangeMap)
        let blockRangeMap = await this.hrmpRangeMapToBlockRangeMap(hrmpRangeMap)
        if (this.debugLevel >= paraTool.debugInfo) console.log(`blockRangeMap`, blockRangeMap)
        return [blockRangeMap, hrmpRangeMap]
    }
}
