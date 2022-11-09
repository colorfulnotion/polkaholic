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

    setDebugLevel(debugLevel = paraTool.debugInfo) {
        this.debugLevel = debugLevel
    }

    assetReady = false
    relayCrawler = false
    allCrawlers = {}

    relayChainIDs = [paraTool.chainIDPolkadot, paraTool.chainIDKusama, paraTool.chainIDMoonbaseRelay]

    //init_chainInfos: {chainInfos, chainNames, specVersions}
    //init_asset_info: {assetInfo, alternativeAssetInfo, symbolRelayChainAsset, xcContractAddress, currencyIDInfo}
    //init_xcm_asset:  {routers, xcmAssetInfo, xcmInteriorInfo, xcmSymbolInfo, xcmConceptInfo}
    //init_paras: {paras}
    //init_storage_keys: {storageKeys}
    //init_accounts: {accounts}
    async initManagerState(){
        this.assetManagerInit()
        this.assetReady = true
        console.log(`initManagerState Done`)
    }

    getCrawler(chainID){

    }

    getRelayCrawler(){
        if (!this.relayCrawler){
            console.log(`relayCrawler not ready`)
            process.exit(0)
            return
        }
        return this.relayCrawler
    }

    getCrawler(parachainID){
        let paraCrawler = this.allCrawlers[parachainID]
        if (paraCrawler == undefined && paraCrawler) {
            console.log(`crawler [${parachainID}] not ready`)
            //process.exit(0)
            return false
        }
        return paraCrawler
    }

    async initRelayCrawler(relayChainID){
        let chain = await this.getChain(relayChainID);

        if (!this.relayChainIDs.includes(relayChainID)){
            console.log(`Expecting relaychain/ Got chain [${chain.chainName}] instead`)
            process.exit(0)
        }
        let relayCrawler = new Crawler();
        await relayCrawler.setupAPI(chain);
        await this.cloneAssetManager(relayCrawler)
        //await relayCrawler.assetManagerInit();
        await relayCrawler.setupChainAndAPI(relayChainID);
        relayCrawler.chain = chain
        this.relayCrawler = relayCrawler
        this.allCrawlers[relayChainID] = relayCrawler
        console.log(`setup relayCrawler [${chain.chainName}]`)
    }

    async initCrawler(parachainID){
        if (this.allCrawlers[parachainID] != undefined) {
            console.log(` v parachainID already initiated`)
            return
        }
        let chain = await this.getChain(parachainID);
        if (this.relayChainIDs.includes(parachainID)){
            console.log(`Expecting parachain. Got chain [${chain.chainName}] instead`)
            process.exit(0)
        }

        let paraCrawler = new Crawler();
        await paraCrawler.setupAPI(chain);
        await this.cloneAssetManager(paraCrawler)
        //await paraCrawler.assetManagerInit();
        await paraCrawler.setupChainAndAPI(parachainID);
        paraCrawler.chain = chain
        if (this.allCrawlers[parachainID] == undefined) this.allCrawlers[parachainID] = {}
        this.allCrawlers[parachainID] = paraCrawler
        console.log(`setup relayChainID [${chain.chainName}] Done`)
    }

    /*
    {
      '0': { blockTSMin: 1668045234, blockTSMax: 1668045258 },
      '2000': { blockTSMin: 1668045201, blockTSMax: 1668045258 },
      '2004': { blockTSMin: 1668045210, blockTSMax: 1668045234 },
      '2012': { blockTSMin: 1668045225, blockTSMax: 1668045243 }
    }
    */
    async processIndexRangeMap(indexRangeMap){
        for (const chainID of Object.keys(indexRangeMap)){
            let crawler = this.getCrawler(chainID)
            if (!crawler) await this.initCrawler(chainID)
            //let xcmMap = await crawlermanager.indexBlockRanges(crawler, blocks)
        }
    }


    async cloneAssetManager(crawler){
        if (!this.assetReady){
            console.log(`AssetInit not ready!`)
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
        console.log(`cloneAssetManager [${crawler.chainID}] Done`)
    }

    async indexBlockRanges(crawler, blocks){
        let xcmMap = {}
        let blockRangeLen = blocks.length
        for (let i = 0; i < blockRangeLen; i++){
            let b = blocks[i]
            let bn = b.blockNumber
            let blkHash = b.blockHash
            console.log(`indexBlockRanges [${i+1}/${blockRangeLen}] chainID=${crawler.chainID} bn=${bn} blkHash=${blkHash}`)
            let xcmList = await crawler.index_block(crawler.chain, bn, blkHash);
            if (Array.isArray(xcmList) && xcmList.length > 0){
                xcmMap[bn] = xcmList
            }
        }
        return xcmMap
    }

    analyzeXcmMap(xcmMap){
        let indexMap = {}
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
                if (indexMap[chainID] == undefined) indexMap[chainID] = {
                    //hrmpBN: [],
                    blockTSMin: blockTS,
                    blockTSMax: blockTS,
                }
                if (indexMap[chainIDDest] == undefined) indexMap[chainIDDest] = {
                    //hrmpBN: [],
                    blockTSMin: blockTS,
                    blockTSMax: blockTS,
                }
                if (msgType == 'ump'){
                    //indexMap[chainID].hrmpBN.push(sentAt)
                    //indexMap[chainIDDest].hrmpBN.push(includedAt)
                    let originationTSMin = blockTS - blockFreq*1.5
                    let originationTSMax = blockTS + blockFreq*1.5
                    let destinationTSMin = blockTS
                    let destinationTSMax = blockTS + blockFreq*3
                    //console.log(`ump [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                    if (indexMap[chainID].blockTSMin > originationTSMin) indexMap[chainID].blockTSMin = originationTSMin
                    if (originationTSMax > indexMap[chainID].blockTSMax) indexMap[chainID].blockTSMax = originationTSMax
                    if (indexMap[chainIDDest].blockTSMin > destinationTSMin) indexMap[chainIDDest].blockTSMin = destinationTSMin
                    if (destinationTSMax > indexMap[chainIDDest].blockTSMax) indexMap[chainIDDest].blockTSMax = destinationTSMax
                }else if (msgType == 'dmp'){
                    //indexMap[chainID].hrmpBN.push(sentAt)
                    //indexMap[chainIDDest].hrmpBN.push(includedAt)
                    let originationTSMin = blockTS
                    let originationTSMax = blockTS + blockFreq*3
                    let destinationTSMin = blockTS
                    let destinationTSMax = blockTS + blockFreq*3
                    //console.log(`dmp [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                    if (indexMap[chainID].blockTSMin > originationTSMin) indexMap[chainID].blockTSMin = originationTSMin
                    if (originationTSMax > indexMap[chainID].blockTSMax) indexMap[chainID].blockTSMax = originationTSMax
                    if (indexMap[chainIDDest].blockTSMin > destinationTSMin) indexMap[chainIDDest].blockTSMin = destinationTSMin
                    if (destinationTSMax > indexMap[chainIDDest].blockTSMax) indexMap[chainIDDest].blockTSMax = destinationTSMax
                }else if (msgType == 'hrmp'){
                    //indexMap[chainID].hrmpBN.push(sentAt)
                    //indexMap[chainIDDest].hrmpBN.push(includedAt)
                    let originationTSMin = blockTS - blockFreq*1.5
                    let originationTSMax = blockTS + blockFreq*1.5
                    let destinationTSMin = blockTS
                    let destinationTSMax = blockTS + blockFreq*4
                    //console.log(`hrmp [${chainID}->${chainIDDest}] (source:${chainID})=[${originationTSMin}-${originationTSMax}], (dest:${chainIDDest})=[${destinationTSMin}-${destinationTSMax}]`)
                    if (indexMap[chainID].blockTSMin > originationTSMin) indexMap[chainID].blockTSMin = originationTSMin
                    if (originationTSMax > indexMap[chainID].blockTSMax) indexMap[chainID].blockTSMax = originationTSMax
                    if (indexMap[chainIDDest].blockTSMin > destinationTSMin) indexMap[chainIDDest].blockTSMin = destinationTSMin
                    if (destinationTSMax > indexMap[chainIDDest].blockTSMax) indexMap[chainIDDest].blockTSMax = destinationTSMax
                }
            }
        }
        return indexMap
    }
}
