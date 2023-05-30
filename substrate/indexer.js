const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require("path");
const AssetManager = require("./assetManager");
const ethTool = require("./ethTool");
const paraTool = require("./paraTool");
const btTool = require("./btTool");
const mysql = require("mysql2");
const stream = require('stream');

const {
    WebSocket
} = require('ws');
const {
    hexToU8a,
    compactStripLength,
    hexToBn
} = require("@polkadot/util");
const {
    StorageKey
} = require('@polkadot/types');
const fs = require('fs');

const extrinsic_args_conversion_list = ['Compact<u128>', 'u128', 'i128']
const event_conversion_list = ['Compact<u128>', 'u128']

//TODO:
const {
    BigQuery
} = require('@google-cloud/bigquery');

module.exports = class Indexer extends AssetManager {
    debugLevel = paraTool.debugNoLog;
    writeData = true; // true = production level write, false = debug SKIPs

    readyForIndexing = {};
    readyToCrawlParachains = false;

    hashesRowsToInsert = [];
    evmTxRowsToInsert = [];
    blockRowsToInsert = [];
    addressStorage = {};

    addressExtrinsicMap = {};
    pendingExtrinsic = {};

    nonCompliantLP = {};
    unhandledTraceMap = {};

    relatedMap = {};
    extrinsicEvmMap = {};

    currentPeriodKey = false;

    initTS = false;
    crawlTS = false;

    numUpdated = 0
    tallyAsset = {};
    xcmtransfer = {};
    xcmtransferdestcandidate = {};
    xcmViolation = {};
    incomingXcmState = {}

    currentSessionValidators = [];
    currentSessionIndex = -1;

    activeParachains = []; //track active parachains
    trailingBlockHashs = {};
    multisigMap = {};
    proxyMap = {};
    crowdloan = {};
    assetholder = {};
    api = false;
    web3Api = false;
    evmRPC = false; //
    evmRPCBlockReceipts = false; // api endpoint that supports eth_getBlockReceipts
    evmRPCInternal = false; // api endpoint that supports eth_getBlockReceipts
    contractABIs = false;
    contractABISignatures = {};
    chainID = false;
    chainName = false;
    relayChain = "";
    authorErrorSpecVersion = 0; //query.session.currentIndex is not available for certain v. cache the errorV and do not ask author until specV changed again
    specVersion = -1;
    xcmeventsMap = {};
    xcmmsgMap = {};
    xcmmsgSentAtUnknownMap = {};
    xcmTrailingKeyMap = {}; //keep the firstSeen BN. TODO: remove
    evmcontractMap = {};
    evmSchemaMap = {}; //by tableId
    evmFingerprintMap = {}; //by fingerprintID
    evmUnknownFingerprintMap = {};
    labels = {}

    addressLabelCandidates = {};
    crawlErcToken = {}; // by tokenAddress
    ercTokenList = {}; // by tokenAddress

    recentXcmMsgs = []; //will flush from here.
    numXCMMessagesIn = {};
    numXCMMessagesOut = {};

    evmDatasetID = "evm_dev"; /*** FOR DEVELOPMENT: change to evm_test ***/
    evmBQLocation = 'us';

    xcmMeta = []; //this should be removed after every block

    xcmMetaMap = {};
    isRelayChain = false;
    isMarkedForExit = false;

    wasmContractMap = {};
    ably_client = null;
    ably_channel_xcmindexer = null;
    ably_channel_xcminfo = null;

    addressBalanceRequest = {}
    xcmtransfers_beneficiary = {};

    context = {};
    stat = {
        hashesRows: {
            substrateBlk: 0,
            evmBlk: 0,
            substrateTx: 0,
            evmTx: 0,
            evmTxPerBlk: [],
            substrateTxPerBlk: [],
        },
        addressRows: {
            uniqueAddr: 0,
            uniqueEVMAddr: 0,
            uniqueSubstrateAddr: 0,
            realtime: 0,
            history: 0,
            feed: 0,
            feedunfinalized: 0,
            feedtransfer: 0,
            feedreward: 0,
            feedcrowdloan: 0,
            xcmsend: 0,
            xcmreceive: 0
        },
        addressStorage: {
            uniqueAddr: 0
        },
        assetholder: {
            unique: 0,
            read: 0,
            write: 0,
            update: 0,
        }
    }

    timeStat = {}
    /*
    timeStat = {
        getRows: 0,
        getRuntimeVersion: 0,
        immediateFlush: 0,
        indexJmp: 0,
        getRowsTS: 0,
        processExtrinsic: 0,
        buildBlockFromRow: 0,
        indexChainBlockRow: 0,
        decodeRawBlock: 0,
        processBlockEvents: 0,
        processTrace: 0,
        getRuntimeVersionTS: 0,
        processExtrinsicTS: 0,
        buildBlockFromRowTS: 0,
        decodeRawBlockTS: 0,
        processBlockEventsTS: 0,
        processTraceTS: 0,
        indexChainBlockRowTS: 0,
        immediateFlushTS: 0,
        indexJmpTS: 0,
        flush_a_TS: 0,
        flush_b_TS: 0,
        flush_c_TS: 0,
        flush_d_TS: 0,
        flush_e_TS: 0,
        flush_f_TS: 0,
        processERC20LPTS: 0,
        processERC20TS: 0,
    }
    */

    assetStat = {}
    assetChainMap = {}
    /*
      assetTypeERC20: [],
      assetTypeToken: [],
      assetTypeLoan: [],
      assetTypeLiquidityPair: [],
      assetTypeERC20LiquidityPair: [],
      assetTypeNFTToken: [],
      assetTypeNFT: [],
      assetTypeERC721: [],
      assetTypeERC721Token: [],
      assetTypeERC1155: [],
      assetTypeERC1155Token: [],
      assetTypeContract: [],
    */

    debugParseTraces = {}
    failedParseTraces = []

    /* DebugLevel
    debugNoLog: 0,
    debugErrorOnly: 1,
    debugInfo: 2,
    debugVerbose: 3,
    debugTracing: 4,
    */

    parentRelayCrawler = false;
    parentManager = false;

    setDebugLevel(debugLevel = paraTool.debugNoLog) {
        this.debugLevel = debugLevel
    }

    constructor(serviceName = "indexer") {
        super(serviceName)
    }

    setLoggingContext(ctx) {
        this.context = ctx;
    }

    setMarkForExit() {
        this.isMarkedForExit = 'errored'
    }

    log_indexing_error(err, op, obj = {}, showOnConsole = true) {
        this.numIndexingErrors++;
        if (showOnConsole) {
            console.log("** numIndexingErrors ERROR", "op", op, obj, this.context, err);
        }
        obj.chainID = this.chainID;
        obj.context = this.context;
        obj.op = op;
        obj.err = err;
        this.logger.error(obj);
    }

    log_indexing_warn(err, op, obj = {}, showOnConsole = true) {
        this.numIndexingWarns++;
        if (showOnConsole) {
            console.log("WARNING", "op", op, obj, this.context, err);
        }
        obj.chainID = this.chainID;
        obj.context = this.context;
        obj.op = op;
        obj.err = err;
        this.logger.warn(obj);
    }

    resetErrorWarnings() {
        this.numIndexingErrors = 0
        this.numIndexingWarns = 0
    }
    setParentRelayAndManager(relayCrawler, manager) {
        if (this.debugLevel >= paraTool.debugTracing) console.log(`[${this.chainID}:${this.chainName}] setParentRelayAndManager`)
        this.parentRelayCrawler = relayCrawler
        this.parentManager = manager
    }

    validAddress(addr) {
        if (!addr) return (false);
        if (!((addr.length == 66) || (addr.length == 42))) return (false);
        if (addr.substr(0, 2) != "0x") return (false);
        if (addr == "0x0000000000000000000000000000000000000000000000000000000000000000") return (false);
        if (addr == "0x0000000000000000000000000000000000000000") return (false);
        return (true);
    }

    updateAssetLoanDebitExchangeRate(asset, debitExchangeRate) {
        if (this.init_asset(asset, paraTool.assetTypeLoan, paraTool.assetSourceOnChain, "updateAssetLoanDebitExchangeRate")) {
            this.tallyAsset[asset].debitExchangeRate = debitExchangeRate;
        }
    }

    updateAssetLoanExchangeRate(asset, exchangeRate, rateType = 'supply') {
        if (rateType == 'borrow') {
            if (this.init_asset(asset, paraTool.assetTypeCDP, paraTool.assetSourceOnChain, "updateAssetLoanExchangeRate")) {
                this.tallyAsset[asset].borrowExchangeRate = exchangeRate;
            }
        } else if (rateType == 'supply') {
            if (this.init_asset(asset, paraTool.assetTypeCDP, paraTool.assetSourceOnChain, "updateAssetLoanExchangeRate")) {
                this.tallyAsset[asset].supplyExchangeRate = exchangeRate;
            }
        }
    }

    updateAssetPrice(asset, price, assetType = paraTool.assetTypeToken, assetSource = paraTool.assetSourceOracle) {
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${this.chainParser.parserBlockNumber}] updateAssetPrice asset=${asset}, assetType=${assetType}, source=${assetSource}`)
        if (this.init_asset(asset, assetType, assetSource, "updateAssetPrice")) {
            //console.log(`updateAssetPrice`, asset, assetType, issuance)
            this.tallyAsset[asset].price = price;
            this.tallyAsset[asset].assetSourceMap[assetSource] = 1 // mark as used
            if (assetType == paraTool.assetTypeLiquidityPair) {
                this.tallyAsset[asset].isDualAssetTypeToken = 1
            }
        }
    }

    getAssetSyntheticRate(asset, assetType = paraTool.assetTypeToken, assetSource = paraTool.assetSourceOracle) {
        if (this.init_asset(asset, assetType, assetSource, "assetSyntheticRate")) {
            //console.log(`getAssetSyntheticRate`, asset, assetType, issuance)
            return this.tallyAsset[asset].syntheticRate
        }
    }

    // update liquidStaking exhcange between dot / sDOT
    updateAssetSyntheticRate(asset, price, rate, assetType = paraTool.assetTypeToken, assetSource = paraTool.assetSourceOracle) {
        if (this.init_asset(asset, assetType, assetSource, "assetSyntheticRate")) {
            this.tallyAsset[asset].price = price;
            this.tallyAsset[asset].syntheticRate = rate;
            this.tallyAsset[asset].assetSourceMap[assetSource] = 1 // mark as used
        }
    }

    isValidLiquidityPair(asset) {
        // return if acala LP is found `[{"Token":"KAR"},{"Token":"KSM"}]#8`
        if (this.assetInfo[asset] != undefined) {
            return true
        }
        return false
    }

    isCachedNonCompliantLP(tokenAddr) {
        let addr = tokenAddr.toLowerCase()
        if (this.nonCompliantLP[addr] != undefined) {
            return true
        }
        return false
    }

    cacheNonCompliantLP(tokenAddr) {
        let addr = tokenAddr.toLowerCase()
        console.log(`cached NonCompliantLP ${addr}`)
        this.nonCompliantLP[addr] = true
    }


    updateAssetLiquidityPairPool(asset, lp0, lp1, rat) {
        if (this.init_asset(asset, paraTool.assetTypeLiquidityPair, paraTool.assetSourceOnChain, "updateAssetLiquidityPairPool")) {
            //console.log(`*** updateAssetLiquidityPairPool`, asset, lp0, lp1)
            this.tallyAsset[asset].lp0.push(lp0)
            this.tallyAsset[asset].lp1.push(lp1)
            this.tallyAsset[asset].rat.push(rat)
        }
    }

    updateAssetLiquidityPairTradingVolume(asset, token0In, token1In, token0Out, token1Out) {
        if (this.init_asset(asset, paraTool.assetTypeLiquidityPair, paraTool.assetSourceOnChain, "updateAssetLiquidityPairTradingVolume")) {
            //console.log(`updateAssetLiquidityPairTradingVolume`, asset)
            this.tallyAsset[asset].token0In += !isNaN(token0In) ? token0In : 0
            this.tallyAsset[asset].token1In += !isNaN(token1In) ? token1In : 0
            this.tallyAsset[asset].token0Out += !isNaN(token0Out) ? token0Out : 0
            this.tallyAsset[asset].token1Out += !isNaN(token1Out) ? token1Out : 0
            //this.tallyAsset[asset].assetSourceMap[assetSource] = 1
        }
    }

    getAssetIssuance(asset, assetType = paraTool.assetTypeLiquidityPair, assetSource = paraTool.assetSourceOnChain) {
        if (this.init_asset(asset, assetType, assetSource, "assetIssuance")) {
            //console.log(`getAssetIssuance`, asset, assetType)
            return this.tallyAsset[asset].issuance
        }
    }

    updateAssetIssuance(asset, issuance, assetType = paraTool.assetTypeLiquidityPair, assetSource = paraTool.assetSourceOnChain) {
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${this.chainParser.parserBlockNumber}] updateAssetIssuance asset=${asset}, assetType=${assetType}, source=${assetSource}`)
        if (this.init_asset(asset, assetType, assetSource, "updateAssetIssuance")) {
            //console.log(`updateAssetIssuance`, asset, assetType, issuance)
            this.tallyAsset[asset].issuance = issuance;
            this.tallyAsset[asset].assetSourceMap[assetSource] = 1
        }
    }

    updateAssetERC20LiquidityPair(asset, lp0, lp1, rat, pair = false) {
        if (this.init_asset(asset, paraTool.assetTypeERC20LiquidityPair, paraTool.assetSourceOnChain, "updateAssetERC20LiquidityPair")) {
            this.tallyAsset[asset].lp0.push(lp0)
            this.tallyAsset[asset].lp1.push(lp1)
            this.tallyAsset[asset].rat.push(rat)
        }
    }

    updateAssetERC20SwapTradingVolume(asset, token0In, token1In, token0Out, token1Out, pair = false) {
        if (this.init_asset(asset, paraTool.assetTypeERC20LiquidityPair, paraTool.assetSourceOnChain, "updateAssetERC20SwapTradingVolume")) {
            this.tallyAsset[asset].token0In += !isNaN(token0In) ? token0In : 0
            this.tallyAsset[asset].token1In += !isNaN(token1In) ? token1In : 0
            this.tallyAsset[asset].token0Out += !isNaN(token0Out) ? token0Out : 0
            this.tallyAsset[asset].token1Out += !isNaN(token1Out) ? token1Out : 0
        }
    }

    updateAssetERC20LiquidityPairIssuance(asset, issuance) {
        if (this.init_asset(asset, paraTool.assetTypeERC20LiquidityPair, paraTool.assetSourceOnChain, "updateAssetERC20LiquidityPairIssuance")) {
            this.tallyAsset[asset].issuance = issuance;
        }
    }

    updateAssetMetadata(asset, metadata, assetType = paraTool.assetTypeToken, assetSource = paraTool.assetSourceOnChain) {
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${this.chainParser.parserBlockNumber}] updateAssetMetadata asset=${asset}, assetType=${assetType}`)
        if (this.init_asset(asset, assetType, paraTool.assetSourceOnChain, "updateAssetMetadata")) { // add currencyID ? // not sure about the source type..
            this.tallyAsset[asset].metadata = metadata;
        }
    }

    updateAssetNFTTokenMetadata(asset, nftClass, tokenID, holder, free, metadata, tokenURI = "") {
        if (this.init_asset(asset, paraTool.assetTypeNFTToken, paraTool.assetSourceOnChain, "updateAssetNFTTokenMetadata")) {
            this.tallyAsset[asset].nftClass = nftClass;
            this.tallyAsset[asset].tokenID = tokenID;
            this.tallyAsset[asset].holder = holder;
            this.tallyAsset[asset].free = free;
            this.tallyAsset[asset].tokenURI = tokenURI;
            this.tallyAsset[asset].metadata = metadata;
        }
    }

    updateAssetNFTClassMetadata(asset, metadata, creator, deposit) {
        if (this.init_asset(asset, paraTool.assetTypeNFT, paraTool.assetSourceOnChain, "updateAssetNFTClassMetadata")) {
            this.tallyAsset[asset].metadata = metadata;
            this.tallyAsset[asset].creator = creator;
            this.tallyAsset[asset].deposit = deposit;
        }
    }

    updateAssetLiquidityPairIssuance(asset, issuance) {
        if (this.init_asset(asset, paraTool.assetTypeLiquidityPair, paraTool.assetSourceOnChain, "updateAssetLiquidityPairIssuance")) {
            this.tallyAsset[asset].issuance = issuance;
        }
    }

    updateAddressLabelCandidates(address, label, recBT) {
        if (this.addressLabelCandidates[address] == undefined) this.addressLabelCandidates[address] = {}
        let labelID = (label.labelID_full) ? label.labelID_full : label.labelID_generic
        if (labelID && this.addressLabelCandidates[address][labelID] == undefined) {
            this.addressLabelCandidates[address][labelID] = recBT
        }
    }

    updateAddressExtrinsicStorage(address, extrinsicID, extrinsicHash, family, rec, ts, finalized) {
        if (address == undefined || typeof address != "string") {
            console.log("updateAddressExtrinsicStorage FAIL", address, extrinsicID, extrinsicHash, family, rec, ts, finalized);
        }
        //feed:extrinsicHash#chainID-extrinsicID
        //feedxcm:extrinsicHash#chainID-extrinsicID-transferIndex
        //feedtransfer:extrinsicHash#eventID
        //feedreward:extrinsicHash#eventID
        //feedcrowdloan:extrinsicHash#eventID
        if (extrinsicID == undefined) return //safety check
        let k = `${address}#${extrinsicHash}`;
        let x = JSON.stringify(rec);
        //MK: let's process long msgs anyway
        if (x.length > 65535) {
            let prevLen = x.length
            if (rec.events) {
                let eventLen = JSON.stringify(rec.events).length
                //rec.events = []
                console.log(`Warning: [${extrinsicID}] ${k}, ${family} too long!(length=${prevLen}, eventLen=${eventLen}, withoutEventlen=${prevLen-eventLen}, finalized=${finalized})`)
            }
            //x = JSON.stringify(rec);
            //if (x.length > 65535) return;
        }
        let eventID = (rec.eventID != undefined) ? rec.eventID : `${this.chainID}-${extrinsicID}`
        let columnfamily = family;
        switch (family) {
            case "feed":
            case "feedtransfer":
                if (!finalized) {
                    columnfamily = family + "unfinalized";
                }
                break;
            case "feedxcm":
                let transferIndex = (rec.transferIndex != undefined) ? rec.transferIndex : 0
                eventID = `${this.chainID}-${extrinsicID}-${transferIndex}` // to support multi-transfer case
                break;
            case "feedcrowdloan":
            case "feedreward":
                if (!finalized) {
                    return;
                }
                break;
        }
        if (this.addressExtrinsicMap[k] == undefined) {
            this.addressExtrinsicMap[k] = {
                address,
                ts,
                extrinsicID,
                extrinsicHash,
                data: {}
            }
        }
        if (this.addressExtrinsicMap[k].data[columnfamily] == undefined) {
            this.addressExtrinsicMap[k].data[columnfamily] = {}
        }
        this.addressExtrinsicMap[k].data[columnfamily][eventID] = x
        //console.log(`this.addressExtrinsicMap[${k}] dataLen=${Object.keys(this.addressExtrinsicMap[k].data).length}`, `[${columnfamily}]`,this.addressExtrinsicMap[k].data[columnfamily]);
    }

    validAssetState(s, max = 1000000000) {
        if (s == undefined) {
            return (false);
        }
        if (!s) {
            return (false);
        }
        if (s.free !== undefined && (s.free > max)) {
            return (false);
        }
        if (s.miscFrozen !== undefined && (s.miscFrozen > max)) {
            return (false);
        }
        if (s.frozen !== undefined && (s.frozen > max)) {
            return (false);
        }
        if (s.reserved !== undefined && (s.reserved > max)) {
            return (false);
        }
        return (true);
    }

    updateAddressStorage(account, assetChain, section, newState, ts = false, bn = false) {
        if (!ts) {
            console.log("WARNING: updateAddressStorage-MISSING TS", account, assetChain, section);
            return;
        }
        if (!typeof assetChain == 'string') {
            console.log("WARNING: updateAddressStorage-assetChain is not string", account, assetChain, section);
            return;
        }

        let [asset, chainID] = paraTool.parseAssetChain(assetChain);
        if (chainID == undefined) {
            console.log("WARNING: updateAddressStorage-MISSING chainID", account, assetChain, section);
            return;
        }
        if (!this.validAddress(account)) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log("invalid acct!!!", asset, account, section, newState, `update=${this.numUpdated}`)
            return (false);
        }

        if (!this.validAssetState(newState)) {
            return (false);
        }
        // add blocktime (presumed correct) + bn for debugging (chainID is in assetChain)
        if (ts && newState.ts == undefined) {
            newState.ts = ts;
        }
        if (bn && newState.bn == undefined) {
            newState.bn = bn;
        }
        // add index source for debugging
        newState.id = this.getIDByChainID(this.chainID);
        newState.para_id = paraTool.getParaIDfromChainID(this.chainID)
        newState.relay_chain = paraTool.getRelayChainByChainID(this.chainID)
        newState.source = this.hostname;
        newState.genTS = this.getCurrentTS();
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`updateAddressStorage Generated addr=${account}, section=${section}\nnewState:`, newState)
        let accKey = account.toLowerCase();
        if (!this.addressStorage[accKey]) {
            this.addressStorage[accKey] = {}
            this.stat.addressStorage.uniqueAddr++
        }
        this.numUpdated++;

        // record the assetholder
        this.updateAssetHolder(assetChain, accKey, bn, newState);
        let rec = {
            value: JSON.stringify(newState),
            timestamp: ts * 1000000
        }
        // encodeAssetChain turns : into ~~
        let assetChainEncoded = paraTool.encodeAssetChain(assetChain)
        this.addressStorage[accKey][assetChainEncoded] = rec

        // ex: {"Token":"KSM"}#2#0x000b3563
        // let historyKey = paraTool.make_addressHistory_rowKey(accKey, ts)
        // The above enables access to an account history for all assets like this:
        // 1. For all assetChains, get "realtime" columns -- each column will have the LATEST state of the account's holding of assetChain, eg {"Token":"KSM"}#2
        // 2. For each assetChain, HISTORICAL info can be obtained with a prefix read  ${address}#{"Token":"KSM"}#2#0x12344321 ...
        //  where each cell will be specific time and it is in reverse chronilogical order
        return (true);
    }


    resetTimeUsage() {
        let newTimeStat = {
            getRows: 0,
            getRuntimeVersion: 0,
            immediateFlush: 0,
            indexJmp: 0,
            getRowsTS: 0,
            buildBlockFromRow: 0,
            indexChainBlockRow: 0,
            decodeRawBlockApiAt: 0,
            decodeRawBlockSignedBlock: 0,
            decodeRawBlock: 0,
            processBlockEvents: 0,
            processExtrinsic: 0,
            processBlockAndReceipt: 0,
            processEVMFullBlock: 0,
            processTrace: 0,
            getRuntimeVersionTS: 0,
            decodeRawBlockApiAtTS: 0,
            decodeRawBlockSignedBlockTS: 0,
            placeholder0c: '---- ---- ---- ---- ---- ---',
            processTransasctionTS: 0,
            processReceiptTS: 0,
            decorateTxnTS: 0,
            placeholder0a: '---- processBlockEvents- ---',
            processExtrinsicTS: 0,
            processBlockAndReceiptTS: 0,
            processEVMFullBlockTS: 0,
            placeholder0b: '---- ---- ---- ---- ---- ---',
            placeholder1a: '---- indexChainBlockRow ----',
            buildBlockFromRowTS: 0,
            decodeRawBlockTS: 0,
            processBlockEventsTS: 0,
            processTraceTS: 0,
            indexChainBlockRowTS: 0,
            placeholder1b: '---- ---- ---- ---- ---- ---',
            immediateFlushTS: 0,
            indexJmpTS: 0,
            flush_a_TS: 0,
            flush_b_TS: 0,
            flush_c_TS: 0,
            flush_d_TS: 0,
            flush_e_TS: 0,
            flush_f_TS: 0,
            processERC20LPTS: 0,
            processERC20TS: 0,
        }
        this.timeStat = newTimeStat
    }

    showTimeUsage() {
        if (this.debugLevel >= paraTool.debugTracing) console.log(this.timeStat)
    }

    showCurrentMemoryUsage() {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (this.debugLevel >= paraTool.debugVerbose) {
            console.log(`USED: [${used}MB]`, "hashesRowsToInsert.length", this.hashesRowsToInsert.length, "blockRowsToInsert.length", this.blockRowsToInsert.length);
            console.log(this.stat);
        }
    }

    // also send xcmtransfer ws msg
    async immediateFlushBlockAndAddressExtrinsics(isTip = false) {
        //flush table that are not dependent on each other and can be promised immediately ()
        var statusesPromise = Promise.allSettled([
            this.flushHashesRows(),
            this.flushBlockRows(),
            this.flush_addressExtrinsicMap(),
            this.flushProxy(),
            this.flushWasmContracts(),
            this.flush_evmcontractMap(),
            await this.flushXCM(isTip)
        ])
        await statusesPromise
        this.resetHashRowStat()
    }

    updateActiveParachains(activeChains, isTip = false, finalized = false) {
        this.activeParachains = activeChains
    }

    async flush_active_chains() {
        let activeChainIDs = this.activeParachains
        // `update chain set active = 1 where chainID in ('${activeParachains.join("','")}')`
        let recs = []
        for (const activeChainID of activeChainIDs) {
            let c = `('${activeChainID}', '1')`
            recs.push(c)
        }
        let sqlDebug = true
        await this.upsertSQL({
            "table": `chain`,
            "keys": ["chainID"],
            "vals": ["active"],
            "data": recs,
            "replace": ["active"]
        }, sqlDebug);
        this.activeParachains = []
        await this.update_batchedSQL()
    }

    async flush(ts = false, lastBlockNumber = 1, isFullPeriod = false, isTip = false) {
        if (ts == false) {
            console.log("FLUSHSHORT FAILURE: MISSING ts")
        }
        this.showCurrentMemoryUsage()
        let paraID = paraTool.getParaIDfromChainID(this.chainID)
        let bn = this.chainParser.parserBlockNumber
        let updateFrequency = 100 // every 10min
        if (paraID == 0 && (isTip && bn % updateFrequency == 0)) {
            // updating every 10 mins
            await this.flush_active_chains()
        }
        await this.flushWSProviderQueue();
        let immediateFlushStartTS = new Date().getTime();
        await this.immediateFlushBlockAndAddressExtrinsics(isTip)
        let immediateFlushTS = (new Date().getTime() - immediateFlushStartTS) / 1000
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(f): immediate Flush Block&AddressExtrinsics", immediateFlushTS);
        this.timeStat.flush_f_TS += immediateFlushTS
        this.timeStat.immediateFlushTS += immediateFlushTS

        let addressStorageStartTS = new Date().getTime();
        try {
            await Promise.all([this.flush_addressStorage(), this.flushCrowdloans()]);
        } catch (err) {
            this.log_indexing_error(err, "flush");
        }
        let addressStorageTS = (new Date().getTime() - addressStorageStartTS) / 1000
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(a): AddressStorage", addressStorageTS);
        this.timeStat.flush_a_TS += addressStorageTS

        let assetStartTS = new Date().getTime();
        await this.flush_assets(ts, lastBlockNumber, isFullPeriod, isTip);

        let assetTS = (new Date().getTime() - assetStartTS) / 1000
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(b): Assets", assetTS);
        this.timeStat.flush_b_TS += assetTS

        let multisigListStartTS = new Date().getTime();
        await this.flushMultisig();
        let multisigListTS = (new Date().getTime() - multisigListStartTS) / 1000
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(+): Multisig", multisigListTS);

        // writes to mysql
        let assetHolderStartTS = new Date().getTime();
        this.assetholder = {};
        let assetHolderTS = (new Date().getTime() - assetHolderStartTS) / 1000
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(c): Assets Holder", assetHolderTS);
        this.timeStat.flush_c_TS += assetHolderTS

        let batchedSQLStartTS = new Date().getTime();
        await this.update_batchedSQL()
        let batchedSQLTS = (new Date().getTime() - batchedSQLStartTS) / 1000
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(e): update_batchedSQL", batchedSQLTS);

        let xcmMetaStartTS = new Date().getTime();
        if (this.isRelayChain) await this.flushXCMMeta(isFullPeriod);

        let xcmMetaTS = (new Date().getTime() - xcmMetaStartTS) / 1000
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(g): flush_xcmMeta", xcmMetaTS);

        await this.dump_xcm_messages()

        await this.dump_failed_traces()
        if (isTip) {
            await this.dump_addressBalanceRequest();
        }

        if (isFullPeriod || lastBlockNumber % 3000 == 2998) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`unhandledTraceMap`, this.unhandledTraceMap)
            this.unhandledTraceMap = {}
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(h): done")
        //removes address state after flushing
        this.resetAddressStats()
    }

    async flushXCMMeta(isFullPeriod) {
        if (!this.isRelayChain) return
        let xcmMetaMapKeys = Object.keys(this.xcmMetaMap)
        if (xcmMetaMapKeys.length > 0) {
            let xcmMetaRecs = [];
            for (let i = 0; i < xcmMetaMapKeys.length; i++) {
                let r = this.xcmMetaMap[xcmMetaMapKeys[i]];
                if (r.blockNumber) {
                    let xcmMeta = mysql.escape(JSON.stringify(r.xcmMeta))
                    let t = "(" + [`'${r.blockNumber}'`, `'${r.blockTS}'`, `'${r.blockHash}'`, `'${r.stateRoot}'`, mysql.escape(JSON.stringify(r.xcmMeta))].join(",") + ")";
                    xcmMetaRecs.push(t)
                }
            }
            let sqlDebug = false
            this.xcmMetaMap = {};
            await this.upsertSQL({
                "table": `xcmmeta${this.chainID}`,
                "keys": ["blockNumber"],
                "vals": ["blockTS", "blockHash", "stateRoot", "xcmMeta"],
                "data": xcmMetaRecs,
                "replace": ["blockTS", "blockHash", "stateRoot", "xcmMeta"]
            }, sqlDebug);
        }
        //TODO: update indexlog when isFullPeriod?
    }

    // write this.addressStorage [filled in updateAddressStorage] to tblRealtime
    async flush_addressStorage() {
        let batchSize = 512;
        try {
            let [tblName, tblRealtime] = this.get_btTableRealtime()
            let rows = [];
            // addressStorage
            for (const address of Object.keys(this.addressStorage)) {
                let r = this.addressStorage[address];
                let rowKey = address.toLowerCase()
                rows.push({
                    key: rowKey,
                    data: {
                        realtime: r
                    }
                });
                if (rows.length > batchSize) {
                    await this.insertBTRows(tblRealtime, rows, tblName);
                    rows = [];
                }
            }
            if (rows.length > 0) {
                await this.insertBTRows(tblRealtime, rows, tblName);
                rows = [];
            }
            this.addressStorage = {}
            //console.log("writing addressStorage DONE");
        } catch (err) {
            this.log_indexing_error(err, "flush_addressStorage");
        }
    }

    async flushMultisig() {
        let multisigAccounts = []
        for (const k of Object.keys(this.multisigMap)) {
            let m = this.multisigMap[k]
            let r = `('${m.multisigAddress}','${m.threshold}', '${m.signatories.join('|')}', '${m.signatorycnt}')`
            multisigAccounts.push(r)
        }
        if (this.debugLevel >= paraTool.debugInfo) console.log(`flushMultisig recs`, multisigAccounts)
        this.multisigMap = {};
        // --- multiaccount no update
        await this.upsertSQL({
            "table": `multisigaccount`,
            "keys": ["address"],
            "vals": ["threshold", "signatories", "signatorycnt"],
            "data": multisigAccounts,
            "replace": ["threshold", "signatories", "signatorycnt"],
        });
    }

    async flushWasmContracts() {
        let wasmCodes = []
        let wasmContracts = []
        let btHashes_rows = [];
        let btRealtime_rows = [];
        for (const k of Object.keys(this.wasmContractMap)) {
            let w = this.wasmContractMap[k]
            if (w.withCode) {
                //["codeHash", "chainID"] + ["extrinsicHash", "extrinsicID", "wasm", "codeStoredBN", "codeStoredTS", "storer"]
                let c = `('${w.codeHash}', '${w.chainID}', '${w.extrinsicHash}', '${w.extrinsicID}', '${w.code}', '${w.blockNumber}', '${w.blockTS}', '${w.deployer}')`
                wasmCodes.push(c)
                let d = {
                    codeHash: w.codeHash,
                    // contractType: "TODO",
                    chainID: w.chainID,
                    extrinsicHash: w.extrinsicHash,
                    extrinsicID: w.extrinsicID,
                    codeStoredBN: w.blockNumber,
                    codeStoredTS: w.blockTS,
                    deployer: w.deployer,
                }
                this.add_index_metadata(d);
                this.push_rows_related_keys("wasmcode", w.chainID.toString(), btHashes_rows, w.codeHash, d)
            }
            //["address", "chainID"] + ["extrinsicHash", "extrinsicID", "instantiateBN", "codeHash", "constructor", "salt", "blockTS", "deployer"]
            let t = `('${w.contractAddress}', '${w.chainID}', '${w.extrinsicHash}', '${w.extrinsicID}', '${w.blockNumber}', '${w.codeHash}', '${w.constructor}', '${w.salt}', '${w.blockTS}', '${w.deployer}')`
            wasmContracts.push(t)

            // write u = { address, chainID, codeHash, blockTS, deployer, ... }  to btRealtime wasmcontract:${chainID}
            let u = {
                address: w.contractAddress,
                chainID: w.chainID,
                extrinsicHash: w.extrinsicHash,
                extrinsicID: w.extrinsicID,
                instantiateBN: w.blockNumber,
                codeHash: w.codeHash,
                constructor: w.constructor,
                salt: w.salt,
                blockTS: w.blockTS,
                deployer: w.deployer,
            }
            this.add_index_metadata(u);
            this.push_rows_related_keys("wasmcontract", w.chainID.toString(), btRealtime_rows, w.contractAddress, u)
        }
        if (this.debugLevel >= paraTool.debugInfo) console.log(`flushWasmContracts wasmCodes`, wasmCodes)
        if (this.debugLevel >= paraTool.debugInfo) console.log(`flushWasmContracts wasmContracts`, wasmContracts)
        this.wasmContractMap = {};

        // --- multiaccount no update
        let sqlDebug = true
        let wasmCodeVal = ["extrinsicHash", "extrinsicID", "wasm", "codeStoredBN", "codeStoredTS", "storer"]
        await this.upsertSQL({
            "table": `wasmCode`,
            "keys": ["codeHash", "chainID"],
            "vals": wasmCodeVal,
            "data": wasmCodes,
            "replace": wasmCodeVal,
        }, sqlDebug);

        let wasmContractVal = ["extrinsicHash", "extrinsicID", "instantiateBN", "codeHash", "constructor", "salt", "blockTS", "deployer"]
        await this.upsertSQL({
            "table": `contract`,
            "keys": ["address", "chainID"],
            "vals": wasmContractVal,
            "data": wasmContracts,
            "replace": wasmContractVal,
        }, sqlDebug);
        // write wasmcontract to tblRealtime, wasmcode to btHashes
        if (btRealtime_rows.length > 0) {
            let [tblName, tblRealtime] = this.get_btTableRealtime()
            await tblRealtime.insert(btRealtime_rows);
            console.log("flushWasmContracts btRealtime_rows=", btRealtime_rows.length, btRealtime_rows);
        }
        if (btHashes_rows.length > 0) {
            let [tblName, tblRealtime] = this.get_btTableRealtime()
            await this.btHashes.insert(btHashes_rows);
            console.log("flushWasmContracts btHashes_rows=", btHashes_rows.length, btHashes_rows);
        }
    }

    async flushProxy() {
        let proxyAccounts = []
        for (const k of Object.keys(this.proxyMap)) {
            let p = this.proxyMap[k]
            let isRemoved = (p.status == 'removed') ? 1 : 0
            let r = `('${p.chainID}', '${p.address}', '${p.delegate}', '${p.proxyType}', '${p.delay}', '${isRemoved}', '${p.blockNumber}', '${p.blockNumber}')`
            proxyAccounts.push(r)
        }
        if (this.debugLevel >= paraTool.debugInfo) console.log(`flushProxy recs`, proxyAccounts)
        this.proxyMap = {};
        // --- multiaccount no update
        await this.upsertSQL({
            "table": `proxyaccount`,
            "keys": ["chainID", "address", "delegate"],
            "vals": ["proxyType", "delay", "removed", "lastUpdateBN", "lastCrawlBN"],
            "data": proxyAccounts,
            "lastUpdateBN": ["proxyType", "delay", "removed", "lastUpdateBN", "lastCrawlBN"]
        }, true);
    }


    async insertBTRows(tbl, rows, tableName = "") {
        if (rows.length == 0) return (true);
        try {
            await tbl.insert(rows);
            return (true);
        } catch (err) {
            let succ = true;
            for (let a = 0; a < rows.length; a++) {
                try {
                    let r = rows[a];
                    if (r.key !== undefined && r.key) {
                        await tbl.insert([r]);
                    }
                } catch (err) {
                    let tries = 0;
                    while (tries < 10) {
                        try {
                            tries++;
                            await tbl.insert([rows[a]]);
                            await this.sleep(100);
                        } catch (err) {
                            //console.log(err);
                        }
                    }
                    if (tries >= 10) {
                        this.log_indexing_warn(err, tableName, rows[a]);
                        succ = false;
                    }
                }
            }
            return (succ);
        }
    }

    // write this.addressExtrinsicMap [filled in updateAddressExtrinsicStorage] to btAddressExtrinsic
    async flush_addressExtrinsicMap() {
        let batchSize = 8;
        try {
            //console.log("writing addressExtrinsicMap");
            let rows = [];
            for (const k of Object.keys(this.addressExtrinsicMap)) {
                let r = this.addressExtrinsicMap[k];
                //k = address#extrinsicHash
                // TODO: figure out how to manage contention between 2 concurrent calls to this with locks?
                if (r !== undefined && r.extrinsicHash !== undefined) {
                    let extrinsicHash = r.extrinsicHash
                    //console.log(`k=${k}`, r)
                    // prepare cells

                    let rowKey = paraTool.make_addressExtrinsic_rowKey(r.address, r.extrinsicHash, r.ts);
                    //console.log("flush_addressExtrinsicMap", rowKey);
                    let rec = {};
                    for (const feedType of Object.keys(r.data)) {
                        rec[feedType] = {}
                        for (const eventID of Object.keys(r.data[feedType])) {
                            let extrinsicHashEventID = `${extrinsicHash}#${eventID}`
                            //feed:extrinsicHash#chainID-extrinsicID
                            //feedxcm:extrinsicHash#chainID-extrinsicID-tranferIdx
                            //feedtransfer:extrinsicHash#eventID
                            //feedreward:extrinsicHash#eventID
                            //feedcrowdloan:extrinsicHash#eventID
                            //console.log(rowKey, rows.length, "feedType", feedType, "length", r.data[feedType][eventID].length);
                            rec[feedType][extrinsicHashEventID] = {
                                value: r.data[feedType][eventID], // already in string form
                                timestamp: r.ts * 1000000
                            }
                        }

                    }
                    let row = {
                        key: rowKey,
                        data: rec
                    }
                    //console.log(`rkey=${row.key}`, row.data)
                    rows.push(row);
                    if (rows.length > batchSize) {
                        await this.insertBTRows(this.btAddressExtrinsic, rows, "addressextrinsic");
                        rows = [];
                    }
                }
            }
            if (rows.length > 0) {
                await this.insertBTRows(this.btAddressExtrinsic, rows, "addressextrinsic");
                rows = [];
            }
            //console.log("writing addressExtrinsicMap DONE");
            this.addressExtrinsicMap = {}
        } catch (err) {
            this.log_indexing_error(err, "flush_addressExtrinsicMap");
        }
    }


    clip_string(inp, maxLen = 64) {
        if (inp == undefined) {
            return "";
        }
        if (inp.length < maxLen) {
            return (inp);
        }
        return (inp.substring(0, maxLen));
    }

    validXcmAssetSymbol(xcmSymbol, chainID, ctx, o) {
        if (xcmSymbol == false || (typeof xcmSymbol == "string" && xcmSymbol.includes("0x") && (chainID == paraTool.chainIDKarura || chainID == paraTool.chainIDAcala))) {
            let err = `validXcmAssetSymbol ${xcmSymbol}`
            this.log_indexing_error(err, "validXcmAssetSymbol", {
                "ctx": ctx,
                "o": o
            })
            return (false);
        } else {
            return true
        }
    }

    validAsset(assetKey, chainID, ctx, o) {
        //TODO: acala now has valid "Erc20\":\"0x0000000000000000000000000000000000000000\"?
        if (typeof assetKey == "string" && assetKey.includes("0x") && (chainID == paraTool.chainIDKarura || chainID == paraTool.chainIDAcala) && false) {
            let err = `InvalidAsset ${assetKey}`
            this.log_indexing_error(err, "validAsset", {
                "ctx": ctx,
                "o": o
            })
            return (false);
        } else {
            return true
        }
    }

    validDouble(obj, ctx, o, flds = ['low', 'high', 'open', 'close', 'lp0', 'lp1']) {
        for (const fld of flds) {
            let val = obj[fld]
            if (val != undefined && val >= 1e+308) {
                let err = `InvalidDouble ${fld}=${val}`
                this.log_indexing_warn(err, "InvalidDouble", {
                    "ctx": ctx,
                    "o": o
                })
                if (this.debugLevel >= paraTool.debugNoLog) console.log(`InvalidDecimal ${fld} ${val}`, o)
                return (false);
            }
        }
        return true
    }

    validDecimal(obj, ctx, o, flds = ['total_volumes', 'token0Volume', 'token1Volume', 'debitExchangeRate', 'supplyExchangeRate', 'borrowExchangeRate']) {
        for (const fld of flds) {
            let val = obj[fld]
            if (val != undefined && val >= 1e+18) {
                let err = `InvalidDecimal ${fld}=${val}`
                this.log_indexing_warn(err, "validDecimal", {
                    "ctx": ctx,
                    "o": o
                })
                if (this.debugLevel >= paraTool.debugNoLog) console.log(`InvalidDecimal ${fld} ${val}`, o)
                return (false);
            }
        }
        return true
    }

    updateMultisigMap(m, caller = false) {
        let multisigAddr = m.multisigAddress
        if (multisigAddr != undefined) {
            this.multisigMap[multisigAddr] = m
        }
        if (caller) {
            console.log(`${caller} add multisig`, this.multisigMap[multisigAddr]);
        }
    }

    updateProxyMap(p, caller = false) {
        let pKey = `${p.chainID}_${p.address}_${p.delegate}`
        if (p.address != undefined && p.delegate != undefined) {
            this.proxyMap[pKey] = p
        }
        if (caller) {
            console.log(`${caller} update proxyRec`, this.proxyMap[pKey]);
        }
    }

    async flushXCM(isTip = false) {
        // flush xcmtransfer
        let xcmtransferKeys = Object.keys(this.xcmtransfer)
        if (xcmtransferKeys.length > 0) {
            let xcmtransfers = [];
            let numXCMTransfersOut = {}
            for (let i = 0; i < xcmtransferKeys.length; i++) {
                let r = this.xcmtransfer[xcmtransferKeys[i]];
                if (r.innerCall == undefined && (r.xcmSymbol && !this.validXcmAssetSymbol(r.xcmSymbol, r.chainID, "xcmtransfer", r))) {
                    console.log(`invalid asset`, r.xcmSymbol, r.chainID, "xcmtransfer", r)
                } else {
                    let innerCall = (r.innerCall) ? `'${r.innerCall}'` : `NULL`

                    let msgHash = (r.msgHash && r.msgHash != "0x") ? `'${r.msgHash}'` : `NULL`
                    let xcmInteriorKey = (r.xcmInteriorKey != undefined) ? `${mysql.escape(r.xcmInteriorKey)}` : `NULL`
                    let xcmInteriorKeyUnregistered = `NULL` //TODO: modify this
                    if (r.xcmInteriorKey != undefined) {
                        xcmInteriorKeyUnregistered = (this.isXcmInteriorKeyRegistered(xcmInteriorKey)) ? 0 : 1
                    }
                    let xcmSymbol = (r.xcmSymbol) ? `${mysql.escape(r.xcmSymbol)}` : `NULL`
                    let xcmType = (r.xcmType != undefined) ? `'${r.xcmType}'` : 'xcmtransfer'
                    let pendingXcmInfoStr = (r.xcmInfo != undefined) ? JSON.stringify(r.xcmInfo) : false
                    let pendingXcmInfoBlob = (pendingXcmInfoStr != false) ? mysql.escape(pendingXcmInfoStr) : 'NULL'
                    let destAddress = (r.destAddress) ? `${mysql.escape(r.destAddress)}` : `NULL`
                    let originationTxFee = (r.xcmInfo != undefined && r.xcmInfo.origination != undefined && r.xcmInfo.origination.txFee != undefined) ? `'${r.xcmInfo.origination.txFee}'` : `NULL`
                    if (originationTxFee == 'NULL' && r.xcmInfo != undefined && r.xcmInfo.origination != undefined && r.xcmInfo.origination.transactionHash != undefined) {
                        let evmTxHash = r.xcmInfo.origination.transactionHash
                        let extRes = this.extrinsicEvmMap[evmTxHash]
                        console.log(`extRes`, extRes)
                        if (extRes && extRes.txFee != undefined) originationTxFee = extRes.txFee
                    }
                    //["extrinsicHash", "extrinsicID", "transferIndex", "xcmIndex"]
                    //["chainID", "chainIDDest", "blockNumber", "fromAddress", "symbol", "sourceTS", "amountSent", "amountSentDecimals", "relayChain", "paraID", "paraIDDest", "destAddress", "sectionMethod", "incomplete", "isFeeItem", "msgHash", "sentAt", "xcmInteriorKey"]
                    let t = "(" + [`'${r.extrinsicHash}'`, `'${r.extrinsicID}'`,
                        `'${r.transferIndex}'`, `'${r.xcmIndex}'`,
                        `'${r.chainID}'`,
                        `'${r.chainIDDest}'`,
                        `'${r.blockNumber}'`,
                        `'${r.fromAddress}'`,
                        xcmSymbol,
                        `'${r.sourceTS}'`,
                        `'${r.amountSent}'`,
                        `'${r.amountSent}'`, // TODO: divide by decimals and make this float, add USD
                        `'${r.relayChain}'`,
                        `'${r.paraID}'`,
                        `'${r.paraIDDest}'`,
                        destAddress,
                        `'${r.sectionMethod}'`,
                        `'${r.incomplete}'`,
                        `'${r.isFeeItem}'`,
                        msgHash,
                        `'${r.sentAt}'`,
                        xcmInteriorKey,
                        innerCall,
                        xcmType,
                        pendingXcmInfoBlob,
                        `Now()`,
                        originationTxFee,
                        xcmInteriorKeyUnregistered
                    ].join(",") + ")";
                    // CHECK: do we need isXcmTipSafe = (isSigned || finalized) ? true : false concept here to ensure that xcmtransfer records are inserted only when "safe"
                    if (r.msgHash == "0x" && !r.finalized) {
                        //msgHash is missing... we will
                        console.log(`[${r.extrinsicHash} [${r.extrinsicID}] [finzlied=${r.finalized}] msgHash missing!`)
                    } else {
                        xcmtransfers.push(t);
                    }
                    if (numXCMTransfersOut[r.blockNumber] == undefined) {
                        numXCMTransfersOut[r.blockNumber] = 1;
                    } else {
                        numXCMTransfersOut[r.blockNumber]++;
                    }
                }
            }
            let sqlDebug = false
            this.xcmtransfer = {};
            await this.upsertSQL({
                "table": "xcmtransfer",
                "keys": ["extrinsicHash", "extrinsicID", "transferIndex", "xcmIndex"],
                "vals": ["chainID", "chainIDDest", "blockNumber", "fromAddress", "symbol", "sourceTS", "amountSentDecimals", "amountSent", "relayChain", "paraID", "paraIDDest", "destAddress", "sectionMethod", "incomplete", "isFeeItem", "msgHash", "sentAt", "xcmInteriorKey", "innerCall", "xcmType", "xcmInfo", "xcmInfolastUpdateDT", "txFee", "xcmInteriorKeyUnregistered"],
                "data": xcmtransfers,
                "replace": ["chainID", "chainIDDest", "blockNumber", "fromAddress", "symbol", "sourceTS", "relayChain", "paraID", "paraIDDest", "destAddress", "sectionMethod", "incomplete", "isFeeItem", "sentAt", "xcmInteriorKey", "innerCall", "xcmType", "txFee", "xcmInteriorKeyUnregistered"],
                "replaceIfNull": ["xcmInfo", "msgHash", "xcmInfolastUpdateDT", "amountSentDecimals", "amountSent"] // TODO: "replaceIfMatchedZero": ["xcmInfo"] AND if finalized
            }, sqlDebug);

            let out = [];
            for (const blockNumber of Object.keys(numXCMTransfersOut)) {
                out.push(`('${blockNumber}', '${numXCMTransfersOut[blockNumber]}')`);
            }
            if (out.length > 0) {
                let vals = ["numXCMTransfersOut"];
                await this.upsertSQL({
                    "table": `block${this.chainID}`,
                    "keys": ["blockNumber"],
                    "vals": vals,
                    "data": out,
                    "replace": vals
                });
            }
        }

        let xcmtransferdestcandidateKeys = Object.keys(this.xcmtransferdestcandidate)
        //console.log(`xcmtransferdestcandidateKeys`, xcmtransferdestcandidateKeys)
        if (xcmtransferdestcandidateKeys.length > 0) {
            let xcmtransferdestcandidates = [];
            for (let i = 0; i < xcmtransferdestcandidateKeys.length; i++) {
                let r = this.xcmtransferdestcandidate[xcmtransferdestcandidateKeys[i]];
                // ["chainIDDest", "eventID"] + ["fromAddress", "extrinsicID", "blockNumberDest", "asset", "destTS", "amountReceived", "rawAsset", "sentAt", "msgHash", "addDT", "nativeAssetChain", "xcmInteriorKey"
                //let nativeAssetChain = (r.nativeAssetChain != undefined) ? `'${r.nativeAssetChain}'` : `NULL`
                let xcmInteriorKey = (r.xcmInteriorKey != undefined) ? `'${r.xcmInteriorKey}'` : `NULL`
                let xcmTeleportFees = (r.xcmTeleportFees != undefined) ? `'${r.xcmTeleportFees}'` : `NULL`
                let feeEventID = (r.feeEventID != undefined) ? `'${r.feeEventID}'` : `NULL`
                let feeReceivingAddress = (r.feeReceivingAddress != undefined) ? `'${r.feeReceivingAddress}'` : `NULL`
                let amountReaped = (r.amountReaped != undefined) ? `'${r.amountReaped}'` : `NULL`
                let reaped = (r.reaped != undefined) ? `'${r.reaped}'` : `NULL`
                let isFeeItem = (r.isFeeItem != undefined) ? `'${r.isFeeItem}'` : `NULL`
                //["chainIDDest", "eventID"]
                //["fromAddress", "extrinsicID", "blockNumberDest", "symbol", "destTS", "amountReceived", "relayChain", "sentAt", "msgHash", "addDT", "xcmInteriorKey"]
                let t = "(" + [`'${r.chainIDDest}'`, `'${r.eventID}'`, `'${r.fromAddress}'`, `'${r.extrinsicID}'`, `'${r.blockNumberDest}'`, `'${r.xcmSymbol}'`, `'${r.destTS}'`, `'${r.amountReceived}'`, `'${r.relayChain}'`, `'${r.sentAt}'`, `'${r.msgHash}'`, `Now()`, xcmInteriorKey, xcmTeleportFees, feeEventID, feeReceivingAddress, amountReaped, reaped, isFeeItem].join(",") + ")";

                if (r.finalized && (r.xcmSymbol) && this.validXCMSymbol(r.xcmSymbol, r.chainIDDest, "xcmtransfer", r)) {
                    xcmtransferdestcandidates.push(t);
                } else {
                    console.log(`--INVALID dest candidate xcmSymbol=${r.xcmSymbol}, chainIDDest=${r.chainIDDest}`, r);
                }
            }
            this.xcmtransferdestcandidate = {};
            try {
                // these events we can't say for sure without matching to recent sends
                if (xcmtransferdestcandidates.length > 0) {
                    await this.upsertSQL({
                        "table": "xcmtransferdestcandidate",
                        "keys": ["chainIDDest", "eventID"],
                        "vals": ["fromAddress", "extrinsicID", "blockNumberDest", "symbol", "destTS", "amountReceived", "relayChain", "sentAt", "msgHash", "addDT", "xcmInteriorKey", "xcmTeleportFees", "feeEventID", "feeReceivingAddress", "amountReaped", "reaped", "isFeeItem"],
                        "data": xcmtransferdestcandidates,
                        "replace": ["fromAddress", "extrinsicID", "blockNumberDest", "symbol", "destTS", "amountReceived", "relayChain", "sentAt", "msgHash", "addDT", "xcmInteriorKey", "xcmTeleportFees", "feeEventID", "feeReceivingAddress", "amountReaped", "reaped", "isFeeItem"]
                    });
                }
            } catch (err0) {
                console.log(err0);
            }
        }

    }

    fixOutgoingUnknownSentAt(sentAt, finalized = false) {
        let xcmKeys = Object.keys(this.xcmmsgSentAtUnknownMap)
        let overwrite = true
        for (const xcmKey of xcmKeys) {
            let xcmMsg = this.xcmmsgSentAtUnknownMap[xcmKey]
            xcmMsg.sentAt = sentAt
            //if (this.debugLevel >= paraTool.debugInfo) console.log(`Adding sentAt ${sentAt} [${xcmKey}]`)
            this.updateXCMMsg(xcmMsg, finalized, overwrite)
        }
        this.xcmmsgSentAtUnknownMap = {}
    }

    sendManagerStat(numIndexingErrors, numIndexingWarns, elapsedSeconds) {
        //if (this.debugLevel >= paraTool.debugTracing) console.log(`sendManagerStat numIndexingErrors=${numIndexingErrors}, numIndexingWarns=${numIndexingWarns}, elapsedSeconds=${elapsedSeconds}`)
        if (!this.parentManager) return
        if (numIndexingErrors >= 0 && numIndexingWarns >= 0) {
            let m = {
                blockHash: this.chainParser.parserBlockHash,
                blockTS: this.chainParser.parserTS,
                blockBN: this.chainParser.parserBlockNumber,
                numIndexingErrors: numIndexingErrors,
                numIndexingWarns: numIndexingWarns,
                elapsedTS: elapsedSeconds,
            }
            let wrapper = {
                type: "stat",
                msg: m,
                chainID: this.chainID,
                source: this.hostname,
                commit: this.indexerInfo,
            }
            if (this.debugLevel >= paraTool.debugTracing) console.log(`[${this.chainID}:${this.chainName}] sendManagerStat`, wrapper)
            this.parentManager.sendManagerStat(this.chainID, wrapper)
        }
    }

    sendManagerMessage(m, msgType = null, finalized = false) {
        if (!this.parentManager) {
            //if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${this.chainID}:${this.chainName}] parentManager not set`)
            return
        }
        if (msgType == undefined) msgType = 'Unknown'
        let wrapper = {
            type: msgType,
            msg: m,
            blockHash: this.chainParser.parserBlockHash,
            blockTS: this.chainParser.parserTS,
            blockBN: this.chainParser.parserBlockNumber,
            relayBN: this.chainParser.parserWatermark,
            relayStateRoot: this.chainParser.relayParentStateRoot,
            relayChain: this.relayChain,
            finalized: finalized,
            source: this.hostname,
            commit: this.indexerInfo,
        }
        if (this.debugLevel >= paraTool.debugTracing) console.log(`[${this.chainID}:${this.chainName}] sendManagerMessage`, wrapper)
        this.parentManager.sendManagerMessage(this.chainID, wrapper)
    }

    sendWSMessage(m, msgType = null, finalized = false) {
        if (msgType == undefined) msgType = 'Unknown'
        let wrapper = {
            type: msgType,
            msg: m,
            blockHash: this.chainParser.parserBlockHash,
            blockTS: this.chainParser.parserTS,
            blockBN: this.chainParser.parserBlockNumber,
            relayBN: this.chainParser.parserWatermark,
            relayStateRoot: this.chainParser.relayParentStateRoot,
            relayChain: this.relayChain,
            finalized: finalized,
            source: this.hostname,
            commit: this.indexerInfo,
        }

        const endpoint = "ws://kusama-internal.polkaholic.io:9101"
        try {
            const ws = new WebSocket(endpoint);
            ws.on('error', function error() {})
            ws.on('open', function open() {
                ws.send(JSON.stringify(wrapper));
            });
            if (msgType == "xcmtransfer" && m.xcmInfo) {
                this.sendExternalWSProvider("xcminfo", m.xcmInfo);
            }
        } catch (err) {

        }

    }

    //this is the xcmmessages table
    updateXCMMsg(xcmMsg, finalized = false, overwrite = false) {
        //for out going msg wait till we have all available info
        let direction = (xcmMsg.isIncoming) ? 'incoming' : 'outgoing'
        if (direction == 'outgoing' && xcmMsg.msgType != 'dmp' && !overwrite) {
            //sentAt is theoretically unknown for ump/hrmp..
            let xcmKey = `${xcmMsg.msgHash}-${xcmMsg.msgType}-${direction}`
            if (this.debugLevel >= paraTool.debugVerbose) console.log(`xcmmsg SentAt Unknown [${xcmKey}]`)
            this.xcmmsgSentAtUnknownMap[xcmKey] = xcmMsg
        } else {
            let xcmKey = `${xcmMsg.msgHash}-${xcmMsg.msgType}-${xcmMsg.sentAt}-${direction}`
            console.log(`[${xcmKey}], finalized=${false}, overwrite=${overwrite}`)
            if (this.xcmTrailingKeyMap[xcmKey] == undefined) {
                this.xcmTrailingKeyMap[xcmKey] = {
                    chainID: xcmMsg.chainID,
                    chainIDDest: xcmMsg.chainIDDest,
                    blockNumber: xcmMsg.blockNumber,
                    msgHex: xcmMsg.msgHex,
                    msgHash: xcmMsg.msgHash,
                    msgStr: xcmMsg.msgStr,
                    isFresh: true,
                    isPreemptive: true,
                    matchable: true,
                    canUpdate: true,
                }
                //console.log(`updateXCMMsg ${Object.keys(this.xcmTrailingKeyMap)}`)
                this.xcmmsgMap[xcmKey] = xcmMsg //TODO: MK review

                //if (this.debugLevel >= paraTool.debugInfo) console.log(`updateXCMMsg adding ${xcmKey}`)
                //if (this.debugLevel >= paraTool.debugTracing) console.log(`updateXCMMsg new xcmKey ${xcmKey}`, xcmMsg)
            } else {

                let trailingXcm = this.xcmTrailingKeyMap[xcmKey]
                if (trailingXcm.canUpdate === true) {
                    trailingXcm.blockNumber = xcmMsg.blockNumber, //we observe the same "msgHash" at new blockNum
                        trailingXcm.canUpdate = false
                    this.xcmTrailingKeyMap[xcmKey] = trailingXcm
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`updateXCMMsg valid duplicates! ${xcmKey}`, trailingXcm)
                }

                //if (this.debugLevel >= paraTool.debugInfo) console.log(`updateXCMMsg duplicates! ${xcmKey}`)
            }
        }
    }

    addWasmContract(wasmContract, withCode = false) {
        //if (this.debugLevel >= paraTool.debugInfo) console.log(`addWasmContract withCode=${withCode}`)
        this.wasmContractMap[wasmContract.extrinsicHash] = wasmContract
    }

    // this is used for destination candidate beneficiary lookup
    updateXCMChannelMsg(xcmChannelMsg, blockNumber, blockTS) {
        let xcmID = xcmChannelMsg.msgIndex
        if (this.xcmeventsMap[xcmID] == undefined) {
            xcmChannelMsg.blockNumber = blockNumber
            xcmChannelMsg.blockTS = blockTS
            this.xcmeventsMap[xcmID] = xcmChannelMsg
            if (this.debugLevel >= paraTool.debugInfo) console.log(`updateXCMChannelMsg add ${xcmID}`, xcmChannelMsg)
        } else {
            if (this.debugLevel >= paraTool.debugTracing) console.log(`updateXCMChannelMsg skip ${xcmID}`, xcmChannelMsg)
        }
    }

    check_refintegrity_xcm_signal(symbol, parser = "NA", ctx = "", obj = null) {
        if (!symbol) return (null)
        let errorcase = []
        let errorMsg = []
        let chainIDDest = this.chainID //because we are looking from receiver's perspective
        let relayChain = this.relayChain
        let sourceBlocknumber = this.chainParser.parserBlockNumber
        let sourceTS = this.chainParser.parserTS
        let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
        let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
        let targetedXcmInteriorKey = (xcmAssetInfo == false || xcmAssetInfo == undefined || xcmAssetInfo.xcmInteriorKey == undefined) ? false : xcmAssetInfo.xcmInteriorKey
        if (this.debugLevel >= paraTool.debugInfo) console.log(`*** check_refintegrity_xcm_signal symbol=${symbol}, relayChain=${relayChain}, chainIDDest=${chainIDDest}, symbolRelayChain=${symbolRelayChain}, targetedXcmInteriorKey=${targetedXcmInteriorKey}, obj=${JSON.stringify(obj)}`)
        if (targetedXcmInteriorKey == false) {
            errorcase.push('xcmkey')
            errorMsg.push(`xcmkey ERR ${targetedXcmInteriorKey} not found(symbolRelayChain=${symbolRelayChain})`)
        }
        let destinationAsset = this.getChainXCMAssetBySymbol(symbol, relayChain, chainIDDest)
        if (destinationAsset == undefined) {
            errorcase.push('dest')
            errorMsg.push(`destination ERR symbol=${symbol}, relayChain=${relayChain}, chainIDDest=${chainIDDest})`)
        }
        let errorDetected = (errorcase.length > 0) ? true : false
        if (errorDetected) {
            try {
                let objStr = JSON.stringify(obj)
                let violation = {
                    violationType: 'signal',
                    chainID: chainIDDest,
                    chainIDDest: null,
                    parser: parser,
                    caller: ctx,
                    errorcase: errorcase.join('|'),
                    instruction: objStr,
                    instructionHash: paraTool.Blake256FromStr(objStr),
                    sourceBlocknumber: sourceBlocknumber,
                    sourceTS: sourceTS,
                }
                if (errorDetected > 0) {
                    this.logger.error({
                        "op": "check_refintegrity_xcm_signal ERR",
                        "bn": sourceBlocknumber,
                        "ts": sourceTS,
                        "chainID": chainIDDest,
                        symbolRelayChain,
                        parser,
                        ctx,
                        "msg": errorMsg,
                        obj: JSON.stringify(obj),
                        violation: JSON.stringify(violation)
                    })
                }
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`check_refintegrity_xcm_signal violation`, violation)
                this.updateXCMViolation(violation, ctx)
            } catch (e) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`check_refintegrity_xcm_signal error=${e.toString()}`)
            }
        }
        return (targetedXcmInteriorKey);
    }

    check_refintegrity_xcm_symbol(symbol, relayChain, chainID, chainIDDest, parser = "NA", ctx = "", obj = null) {
        if (!symbol) return;
        let errorcase = []
        let errorMsg = []
        let sourceBlocknumber = this.chainParser.parserBlockNumber
        let sourceTS = this.chainParser.parserTS
        let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
        let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
        let targetedXcmInteriorKey = (xcmAssetInfo == false || xcmAssetInfo == undefined || xcmAssetInfo.xcmInteriorKey == undefined) ? false : xcmAssetInfo.xcmInteriorKey
        if (this.debugLevel >= paraTool.debugInfo) console.log(`**check_refintegrity_xcm_symbol symbol=${symbol}, relayChain=${relayChain}, chainID=${chainID}, chainIDDest=${chainIDDest}, symbolRelayChain=${symbolRelayChain}, targetedXcmInteriorKey=${targetedXcmInteriorKey}, obj=${JSON.stringify(obj)}`)
        if (targetedXcmInteriorKey == false) {
            errorcase.push('xcmkey')
            errorMsg.push(`xcmkey ERR ${targetedXcmInteriorKey} not found(symbolRelayChain=${symbolRelayChain})`)
        }
        let originationAsset = this.getChainXCMAssetBySymbol(symbol, relayChain, chainID)
        let destinationAsset = this.getChainXCMAssetBySymbol(symbol, relayChain, chainIDDest)
        if (originationAsset == undefined) {
            errorcase.push('source')
            errorMsg.push(`source ERR symbol=${symbol}, relayChain=${relayChain}, chainID=${chainID}`)
        }
        if (destinationAsset == undefined) {
            errorcase.push('dest')
            errorMsg.push(`destination ERR symbol=${symbol}, relayChain=${relayChain}, chainIDDest=${chainIDDest}`)
        }
        let errorDetected = (errorcase.length > 0) ? true : false
        if (errorDetected) {
            try {
                let objStr = JSON.stringify(obj)
                let violation = {
                    violationType: 'symbol',
                    chainID: chainID,
                    chainIDDest: chainIDDest,
                    parser: parser,
                    caller: ctx,
                    errorcase: errorcase.join('|'),
                    instruction: objStr,
                    instructionHash: paraTool.Blake256FromStr(objStr),
                    sourceBlocknumber: sourceBlocknumber,
                    sourceTS: sourceTS,
                }
                if (errorDetected) {
                    this.logger.error({
                        "op": "check_refintegrity_xcm_symbol ERR",
                        "bn": sourceBlocknumber,
                        "ts": sourceTS,
                        "chainID": chainID,
                        "chainIDDest": chainIDDest,
                        symbolRelayChain,
                        parser,
                        ctx,
                        "msg": errorMsg,
                        obj: JSON.stringify(obj),
                        violation: JSON.stringify(violation)
                    })
                }
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`check_refintegrity_xcm_symbol violation`, violation)
                this.updateXCMViolation(violation, ctx)
            } catch (e) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`check_refintegrity_xcm_symbol error=${e.toString()}`)
            }
        }
        return (targetedXcmInteriorKey);
    }

    check_refintegrity_asset(asset, ctx = "", obj = null) {
        let assetChain = paraTool.makeAssetChain(asset, this.chainID);
        if (this.assetInfo[assetChain] == undefined) {
            let parsedAsset = JSON.parse(asset);
            if (parsedAsset.Token) {
                let symbol = parsedAsset.Token;
                let relayChain = paraTool.getRelayChainByChainID(this.chainID);
                let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
                let chain_assetInfo_symbol = this.getChainXCMAssetBySymbol(symbol, relayChain, this.chainID);
                if (chain_assetInfo_symbol && chain_assetInfo_symbol.asset) {
                    this.logger.warn({
                        "op": "check_refintegrity_asset CORRECTED",
                        "chainID": this.chainID,
                        asset,
                        corrected: chain_assetInfo_symbol.asset,
                        ctx,
                        obj: JSON.stringify(obj)
                    })
                    return (chain_assetInfo_symbol.asset);
                }
            }
            this.logger.error({
                "op": "check_refintegrity_asset",
                "chainID": this.chainID,
                asset,
                ctx,
                obj: JSON.stringify(obj)
            })
        }
        return (asset);
    }

    async updateXCMTransferStorage(xcmtransfer, isTip, finalized, isXcmTipSafe, isSigned, section, method) {
        //console.log(`adding xcmtransfer`, xcmtransfer)
        try {
            let errs = []
            if (xcmtransfer.xcmInteriorKey) {
                // check that xcmInteriorKey exists and matches
                let xcmInteriorKey = xcmtransfer.xcmInteriorKey;
                if (this.xcmAssetInfo[xcmInteriorKey] == undefined) {
                    errs.push(`Invalid xcmInteriorKey (${xcmInteriorKey})`);
                } else {
                    let xcmsymbol = this.xcmAssetInfo[xcmInteriorKey].symbol;
                    if (xcmtransfer.xcmSymbol == undefined && xcmsymbol !== undefined) {
                        // NOTE: we are filling in the blanks using xcmInteriorKey here
                        xcmtransfer.xcmSymbol = xcmsymbol
                    }
                    if (xcmsymbol != xcmtransfer.xcmSymbol) {
                        errs.push(`Invalid xcmSymbol (${xcmtransfer.xcmSymbol}, Expected: ${xcmsymbol} from ${xcmInteriorKey}) not found in assetManager.xcmAssetInfo [${Object.keys(this.xcmAssetInfo.length)}]`);
                    }
                }
            }

            if (xcmtransfer.xcmSymbol) {
                // check that symbol~relayChain exists
                let symbolRelayChain = paraTool.makeAssetChain(xcmtransfer.xcmSymbol, xcmtransfer.relayChain);
                let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
                if (xcmAssetInfo == undefined) {
                    errs.push(`Invalid symbol relaychain (${symbolRelayChain}) not found in assetManager.xcmSymbolInfo`);
                } else {}
            }

            if (errs.length > 0) {
                console.log(errs);
                this.logger.error({
                    "op": "updateXCMTransferStorage referential integrity checkviolation",
                    "chainID": this.chainID,
                    "errs": errs,
                    "xcmtransfer": xcmtransfer

                })
            }
        } catch (err) {
            console.log(err);
            this.logger.error({
                "op": "updateXCMTransferStorage ERROR",
                "err": err
            })
        }
        // **** add xcmtransfer to map here -- it is essential to only do it when xcmtip is safe, otherwise we have an unstable map key by virtue of changing extrinsicHashes
        if (isXcmTipSafe) {
            this.xcmtransfer[`${xcmtransfer.extrinsicHash}-${xcmtransfer.transferIndex}-${xcmtransfer.xcmIndex}`] = xcmtransfer;
        }
        if (isTip) {
            //console.log(`[Delay=${this.chainParser.parserBlockNumber - xcmtransfer.blockNumber}] send xcmtransfer ${xcmtransfer.extrinsicHash} (msgHash:${xcmtransfer.msgHash}), isTip=${isTip}`)
            try {
                let xcmTransferHash = xcmtransfer.xcmtransferHash
                let extrinsicHash = xcmtransfer.extrinsicHash
                let msgHash = xcmtransfer.msgHash
                // publish to "xcminfo" channel, record in  xcmtransferslog
                await this.publish_xcminfo(xcmtransfer.xcmInfo);
                let _isSigned = isSigned ? 1 : 0;
                let stage = finalized ? 'OriginationFinalized' : 'OriginationUnfinalized';
                let vals = ["extrinsicHash", "transferIndex", "xcmIndex", "msgHash", "transactionHash", "symbol", "sourceTS", "chainID", "chainIDDest", "xcmInfo", "isSigned", "section", "method", "addTS", "lastUpdateTS"];
                let transactionHash = xcmtransfer.xcmInfo && xcmtransfer.xcmInfo.origination && xcmtransfer.xcmInfo.origination.transactionHash ? xcmtransfer.xcmInfo.origination.transactionHash : null;
                let currTS = this.getCurrentTS();
                let out = `('${xcmtransfer.xcmtransferHash}', '${stage}', '${xcmtransfer.extrinsicHash}', '${xcmtransfer.transferIndex}', '${xcmtransfer.xcmIndex}', ${mysql.escape(xcmtransfer.msgHash)}, ${mysql.escape(transactionHash)}, '${xcmtransfer.xcmSymbol}', '${xcmtransfer.sourceTS}', '${xcmtransfer.chainID}', '${xcmtransfer.chainIDDest}', ${mysql.escape(JSON.stringify(xcmtransfer.xcmInfo))}, '${_isSigned}', ${mysql.escape(section)}, ${mysql.escape(method)}, '${currTS}', '${currTS}')`;
                await this.upsertSQL({
                    "table": "xcmtransferslog",
                    "keys": ["xcmtransferhash", "stage"],
                    "vals": vals,
                    "data": [out],
                    "replace": ["lastUpdateTS", "symbol"]
                });

                // we only publish xcmtransfer to kick off destination matching; if it is incomplete we don't publish it to the network
                if (xcmtransfer.incomplete == 1) {} else { // send it both on finalized and unfinalized, since many chains have "subscribeStorage" off
                    this.publish_xcmtransfer(xcmtransfer);
                }
                if (isXcmTipSafe) {
                    this.store_xcminfo_finalized(xcmtransfer.extrinsicHash, xcmtransfer.extrinsicID, xcmtransfer.xcmInfo, xcmtransfer.sourceTS);
                }
                this.sendWSMessage(xcmtransfer, "xcmtransfer", finalized);
                this.sendManagerMessage(xcmtransfer, "xcmtransfer", finalized);
            } catch (err) {
                this.logger.error({
                    "op": "xcmtransferslog updateXCMTransferStorage ERROR",
                    "err": err
                })
            }
        }
    }

    store_xcminfo_finalized(extrinsicHash, extrinsicID, xcmInfo, sourceTS) {
        if (!xcmInfo) return;
        let hres = btTool.encode_xcminfofinalized(extrinsicHash, extrinsicID, xcmInfo, sourceTS)
        if (hres) {
            this.hashesRowsToInsert.push(hres)
        }
    }

    store_xcminfo_finalized_old(extrinsicHash, extrinsicID, xcmInfo, sourceTS) {
        if (!xcmInfo) return;
        try {
            // write "hashes" xcminfofinalized with row key extrinsicHash and column extrinsicID
            let hres = {
                key: extrinsicHash,
                data: {
                    xcminfofinalized: {}
                }
            }
            hres['data']['xcminfofinalized'][extrinsicID] = {
                value: JSON.stringify(xcmInfo),
                timestamp: sourceTS * 1000000
            };
            this.hashesRowsToInsert.push(hres)
            /*this.logger.error({
                "op": "xcmtransferslog store_xcminfo_finalized SUCCESS",
                extrinsicHash,
                extrinsicID,
                sourceTS,
                xcmInfo
            })*/

        } catch (e) {
            this.logger.error({
                "op": "xcmtransferslog store_xcminfo_finalized ERROR",
                "err": err
            })
        }
    }

    // search_xcmtransferdestcandidate searches:
    // 1. among all the xcmtransferdestcandidate records that appeared in this block find the one that matches the fromAddress/amountSent
    // 2. or among all the xcmmessages to find the one that the matches the, looking for any errors
    search_xcmtransferdestcandidate(api, beneficiary, xcmtransfer, amountSent, msgHash, expectedXCMTeleportFees) {
        try {
            let msgHashProvided = msgHash && msgHash.length > 2 ? true : false;
            let xcmtransferdestcandidateKeys = Object.keys(this.xcmtransferdestcandidate)
            if (xcmtransferdestcandidateKeys.length > 0) {
                let xcmtransferdestcandidates = [];
                for (let i = 0; i < xcmtransferdestcandidateKeys.length; i++) {
                    try {
                        let r = this.xcmtransferdestcandidate[xcmtransferdestcandidateKeys[i]];
                        let matchingMsgHash = (msgHashProvided && (r.msgHash == msgHash)) ? true : false;
                        if (matchingMsgHash && r.reaped) {
                            return {
                                amountReceived: 0,
                                eventID: r.eventID,
                                extrinsicID: r.extrinsicID,
                                errorDesc: "reaped:AccountReaped"
                            }
                        } else if ((beneficiary == r.fromAddress) && (amountSent >= r.amountReceived)) {
                            let rat = r.amountReceived / amountSent; // old default
                            let ratRequirement = (r.isFeeItem) ? .9 : .97;
                            if (r.xcmTeleportFees) { // new approach
                                if ((r.xcmTeleportFees + r.amountReceived) <= amountSent) {
                                    rat = (r.xcmTeleportFees + r.amountReceived) / amountSent;
                                    ratRequirement = 0.999;
                                }
                            }
                            if (msgHashProvided && !matchingMsgHash) {} else if (rat >= ratRequirement && rat < 1.0001) {
                                r.confidence = rat;
                                xcmtransferdestcandidates.push(r);
                            }
                        }
                    } catch (err) {
                        this.logger.error({
                            op: "search_xcmtransferdestcandidate:ERR",
                            err
                        });

                    }
                }
                if (xcmtransferdestcandidates.length > 0) {
                    xcmtransferdestcandidates.sort(function compareFn(a, b) {
                        return b.confidence - a.confidence
                    });
                    return xcmtransferdestcandidates[0];
                } else if (msgHashProvided) {
                    // Treat error with map to get at errorDesc and directly populate using msgHash from xcmtransfer
                    for (const k of Object.keys(this.incomingXcmState)) {
                        let r = this.incomingXcmState[k];
                        if (r.msgHash == msgHash) {
                            if (r.success == false) {
                                let errorDesc = (r.errorDesc != undefined && r.description != undefined) ? `'${r.errorDesc}:${r.description}'` : null
                                this.logger.error({
                                    op: "search_xcmtransferdestcandidate:xcmFAIL",
                                    cand: r,
                                    errorDesc,
                                    beneficiary,
                                    xcmtransfer,
                                    amountSent,
                                    msgHash
                                });
                                return {
                                    amountReceived: 0,
                                    eventID: r.eventID,
                                    extrinsicID: r.extrinsicID,
                                    errorDesc
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.error({
                op: "search_xcmtransferdestcandidate:ERR",
                err
            });
        }
        return null;
    }

    async get_accountbalance_xcmtransfer(apiAt, address, xcmtransfer) {
        let balance = 0
        let multilocation = xcmtransfer.xcmInteriorKey;
        let symbol = xcmtransfer.xcmSymbol;
        let method = "unk";
        let chainID = this.chainID;
        let paraID = paraTool.getParaIDfromChainID(chainID);
        let symbolRelaychain = paraTool.makeXcmInteriorKey(symbol, xcmtransfer.relayChain);
        let currencyIDmap = this.xcmSymbolInfo[symbolRelaychain] != undefined ? this.xcmSymbolInfo[symbolRelaychain]["xcCurrencyID"] : null;
        let currencyID = currencyIDmap && currencyIDmap[paraID] != undefined ? currencyIDmap[paraID] : null;
        let assetMap = this.xcmSymbolInfo[symbolRelaychain] != undefined ? this.xcmSymbolInfo[symbolRelaychain]["assets"] : null;
        let asset = assetMap && assetMap[paraID] != undefined ? assetMap[paraID] : null;

        let isNative = (this.chainInfos[chainID] != undefined && this.chainInfos[chainID].symbol != undefined) ? symbol == this.chainInfos[chainID].symbol : false;

        try {
            // exception so far: Kintsugi and Interlay represent native token in tokens.accounts pallet storage instead of system.account storage
            if (chainID == 22092 && symbol == "KINT" || chainID == 2032 && symbol == "INTR") isNative = false;
            // statemine/t + collectives have DOT + KSM
            if (chainID == 21000 && symbol == "KSM") isNative = true;
            if ((chainID == 1000 || chainID == 1001) && symbol == "DOT") isNative = true;
            if (isNative) {
                method = "system.account";
                let query = await apiAt.query.system.account(address);
                let qR = query.toJSON();
                if (qR && qR.data && qR.data.free) {
                    balance = qR.data.free;
                }
            } else if (apiAt.query.tokens != undefined && apiAt.query.tokens.accounts != undefined) {
                method = "tokens.accounts";
                if (chainID == 22000 || chainID == 2000 || chainID == 2032 || chainID == 22092) {
                    let currencyID = null;
                    if (asset) {
                        try {
                            let asset0 = JSON.parse(asset);
                            let flds = ["Token", "ForeignAsset", "Erc20", "LiquidCrowdloan", "StableAsset"];
                            for (const fld of flds) {
                                if (asset0[fld]) {
                                    currencyID = {}
                                    currencyID[fld.toLowerCase()] = asset0[fld];
                                }
                            }
                        } catch (err) {
                            this.logger.error({
                                "op": "get_account_balance_xcmtransfer: tokens.accounts ERROR",
                                asset,
                                assetMap,
                                chainID,
                                symbolRelaychain,
                                paraID,
                                err
                            });
                        }
                    } else {
                        this.logger.error({
                            "op": "get_account_balance_xcmtransfer: tokens.accounts missing asset",
                            asset,
                            assetMap,
                            chainID,
                            symbolRelaychain,
                            paraID
                        });
                    }
                }
                if (currencyID) {
                    let query = await apiAt.query.tokens.accounts(address, currencyID);
                    let qR = query.toJSON();
                    if (qR && qR.free != undefined) {
                        let free = paraTool.dechexToInt(qR.free.toString());
                        balance = free;
                    }
                } else {
                    this.logger.warn({
                        "op": "get_accountbalance_xcmtransfer:tokens.account missing currencyID",
                        chainID,
                        address,
                        symbolRelaychain,
                        currencyIDmap
                    });
                }
            } else if (apiAt.query.assets != undefined && apiAt.query.assets.account != undefined) {
                if (currencyID) {
                    let query = await apiAt.query.assets.account(currencyID, address);
                    let qR = query.toJSON();
                    if (qR && qR.balance != undefined) {
                        method = "assets.account";
                        balance = paraTool.dechexToInt(qR.balance.toString());
                    }
                } else {
                    this.logger.warn({
                        "op": "get_accountbalance_xcmtransfer:assets.account missing currencyID",
                        chainID,
                        address,
                        symbolRelaychain,
                        currencyIDmap
                    });
                }
            }
        } catch (err) {
            this.logger.error({
                "op": "get_accountbalance_xcmtransfer ERR",
                err
            });
            return (0);
        }
        return (balance);
    }

    // for any messages concerning xcmtransfers indexed by beneficiary in the last 3m, does a balance check
    //  if the balance increased by approximately the amountsent, fill in the xcmInfo and broadcast it
    async check_xcmtransfers_beneficiary(api, bn, blockTS, finalized = false) {
        try {
            for (const beneficiary of Object.keys(this.xcmtransfers_beneficiary)) {
                let xcmtransfers = this.xcmtransfers_beneficiary[beneficiary];
                for (const xcmtransferkey of Object.keys(xcmtransfers)) {
                    let xcmtransfer = xcmtransfers[xcmtransferkey];
                    if (xcmtransfer && (this.getCurrentTS() - xcmtransfer.sourceTS < 180)) {
                        let amountSent = xcmtransfer.amountSent ? xcmtransfer.amountSent : 0;
                        let amountReceived = null;
                        let extrinsicID = null;
                        let eventID = null;
                        let section = "";
                        let method = "";
                        let errorDesc = null;
                        let teleportFeeChainSymbol = xcmtransfer.symbol;
                        let expectedXCMTeleportFees = this.getXCMTeleportFees(xcmtransfer.chainIDDest, teleportFeeChainSymbol);
                        let res = await this.search_xcmtransferdestcandidate(api, beneficiary, xcmtransfer, amountSent, xcmtransfer.msgHash, expectedXCMTeleportFees);
                        if (res) {
                            eventID = res.eventID;
                            amountReceived = res.amountReceived;
                            if (res.errorDesc != undefined) {
                                errorDesc = res.errorDesc;
                            } else {
                                extrinsicID = res.extrinsicID;
                            }
                        } else {
                            let balance = await this.get_accountbalance_xcmtransfer(api, beneficiary, xcmtransfer);
                            if (xcmtransfer.balances == undefined) {
                                xcmtransfer.balances = {};
                            }
                            xcmtransfer.balances[bn] = balance;
                            if (xcmtransfer.balances[bn - 1] !== undefined && (xcmtransfer.balances[bn - 1] != xcmtransfer.balances[bn])) {
                                let diff = (xcmtransfer.balances[bn] - xcmtransfer.balances[bn - 1]);
                                let rat = amountSent ? diff / amountSent : 0;
                                if (rat > .9 && (rat <= 1.000001)) {
                                    amountReceived = diff;
                                }
                            }
                        }
                        if (amountReceived != null) {
                            let stage = finalized ? 'DestinationFinalized' : 'DestinationUnfinalized';
                            let xcmInfo = xcmtransfer.xcmInfo ? xcmtransfer.xcmInfo : null;
                            let o = xcmInfo && xcmInfo.origination ? xcmInfo.origination : null;
                            if (o) {
                                if (o.section) section = o.section;
                                if (o.method) method = o.method;
                            }
                            // fill in destination.{ amountReceived, amountReceivedUSD, teleportFee, teleportFee, teleportFeeUSD, blockNumber, ts, finalized, executionStatus }
                            let decimals = o && o.decimals ? o.decimals : null;
                            let priceUSD = xcmInfo.priceUSD;
                            if (decimals && xcmInfo && xcmInfo.destination) {
                                let destination = xcmInfo.destination;
                                destination.blockNumber = bn;
                                destination.ts = blockTS;
                                destination.finalized = finalized;
                                if (eventID) {
                                    destination.eventID = eventID;
                                }
                                if (extrinsicID) {
                                    destination.extrinsicID = extrinsicID;
                                }
                                let destStatus = errorDesc ? 0 : 1;
                                if (errorDesc) {
                                    destination.error = paraTool.getXCMErrorDescription(errorDesc);
                                    destination.executionStatus = "failed";
                                } else {
                                    destination.teleportFee = (amountSent - amountReceived) / 10 ** decimals;
                                    destination.teleportFeeUSD = (destination.teleportFee * priceUSD);
                                    destination.teleportFeeChainSymbol = teleportFeeChainSymbol;
                                    destination.amountReceived = amountReceived / 10 ** decimals;
                                    destination.amountReceivedUSD = destination.amountReceived * priceUSD;
                                    destination.executionStatus = "success";
                                }
                                let vals = ["extrinsicHash", "transferIndex", "xcmIndex", "msgHash", "transactionHash", "symbol", "sourceTS", "chainID", "chainIDDest", "xcmInfo", "section", "method", "addTS", "lastUpdateTS"];
                                let currTS = this.getCurrentTS();
                                let transactionHash = xcmtransfer.xcmInfo && xcmtransfer.xcmInfo.origination && xcmtransfer.xcmInfo.origination.transactionHash ? xcmtransfer.xcmInfo.origination.transactionHash : null;
                                let out = `('${xcmtransfer.xcmtransferHash}', '${stage}', '${xcmtransfer.extrinsicHash}', '${xcmtransfer.transferIndex}', '${xcmtransfer.xcmIndex}', ${mysql.escape(xcmtransfer.msgHash)}, ${mysql.escape(transactionHash)}, '${xcmtransfer.xcmSymbol}', '${xcmtransfer.sourceTS}', '${xcmtransfer.chainID}', '${xcmtransfer.chainIDDest}', ${mysql.escape(JSON.stringify(xcmtransfer.xcmInfo))}, '${section}', '${method}', '${currTS}', '${currTS}')`;
                                await this.upsertSQL({
                                    "table": "xcmtransferslog",
                                    "keys": ["xcmtransferHash", "stage"],
                                    "vals": vals,
                                    "data": [out],
                                    "replace": ["lastUpdateTS", "symbol", "section", "method"]
                                });
                                let extra = ""
                                if (o.finalized && finalized && o.initiateTS) {
                                    xcmInfo.flightTime = this.getCurrentTS() - o.initiateTS;
                                    extra = `, flightTime = '${xcmInfo.flightTime}'`
                                }
                                let matched = finalized ? 4 : 3;
                                // update matched and xcmInfo
                                let sql = `update xcmtransfer set matched = ${matched}, destStatus = ${destStatus}, xcmInfolastUpdateDT = Now(), teleportFee = ${mysql.escape(destination.teleportFee)}, teleportFeeUSD = ${mysql.escape(destination.teleportFeeUSD)}, amountReceived = ${mysql.escape(destination.amountReceived)}, amountReceivedUSD = ${mysql.escape(destination.amountReceivedUSD)}, executedEventID = ${mysql.escape(destination.eventID)}, xcmInfo = ${mysql.escape(JSON.stringify(xcmtransfer.xcmInfo))} ${extra} where extrinsicHash = '${xcmtransfer.extrinsicHash}' and transferIndex = '${xcmtransfer.transferIndex}' and xcmIndex='${xcmtransfer.xcmIndex}'`
                                this.batchedSQL.push(sql);
                                await this.update_batchedSQL();
                                let xcmTransferHash = xcmtransfer.xcmtransferHash
                                let extrinsicHash = xcmtransfer.extrinsicHash
                                let msgHash = xcmtransfer.msgHash
                                await this.publish_xcminfo(xcmtransfer.xcmInfo);
                                await this.store_xcminfo_finalized(xcmtransfer.extrinsicHash, xcmtransfer.chainID, xcmtransfer.extrinsicID, xcmInfo, this.getCurrentTS());
                            }
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.error({
                "op": "check_xcmtransfers_beneficiary ERROR",
                err
            });
        }
    }

    async process_indexer_xcmtransfer(chain, xcmtransfer) {
        try {
            if (xcmtransfer.beneficiary == undefined || xcmtransfer.xcmInfo == undefined) return (false);
            if (xcmtransfer.chainIDDest != this.chainID) return (false);
            let beneficiary = xcmtransfer.destAddress;
            let xcmInfo = xcmtransfer.xcmInfo;
            if (this.xcmtransfers_beneficiary[beneficiary] == undefined) {
                this.xcmtransfers_beneficiary[beneficiary] = {};
            }
            let xcmtransferHash = xcmtransfer.xcmtransferHash;
            if (this.xcmtransfers_beneficiary[beneficiary][xcmtransferHash] == undefined) {
                if (xcmtransfer.balances == undefined) {
                    xcmtransfer.balances = {}
                }
                this.xcmtransfers_beneficiary[beneficiary][xcmtransferHash] = xcmtransfer;
            }
            // if the origination chain has been finalized, we should mark it as such locally so that when we write destination info

            if (xcmInfo && xcmInfo.origination && xcmInfo.origination.finalized) {
                let existing_xcmtransfer = this.xcmtransfers_beneficiary[beneficiary][xcmtransferHash];
                let existing_xcmInfo = existing_xcmtransfer.xcmInfo;
                if (existing_xcmInfo && existing_xcmInfo.origination) {
                    if (xcmInfo.origination.msgHash && xcmInfo.origination.msgHash.length > 60) {
                        existing_xcmInfo.origination.msgHash = xcmInfo.origination.msgHash;
                    }
                    if (!existing_xcmInfo.origination.finalized) {
                        existing_xcmInfo.origination.finalized = true;
                        if (existing_xcmInfo.destination && existing_xcmInfo.destination.finalized) {
                            // destination chain was finalized BEFORE origination chain
                            if (existing_xcmInfo.origination.initiateTS) {
                                existing_xcmInfo.flightTime = this.getCurrentTS() - existing_xcmInfo.origination.initiateTS;
                            }
                            await this.store_xcminfo_finalized(xcmtransfer.extrinsicHash, xcmtransfer.extrinsicID, existing_xcmInfo, this.getCurrentTS());
                            let xcmTransferHash = xcmtransfer.xcmtransferHash
                            let extrinsicHash = xcmtransfer.extrinsicHash
                            let msgHash = xcmtransfer.msgHash
                            await this.publish_xcminfo(existing_xcmInfo);
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.error({
                "op": "process_indexer_xcmtransfer ERROR",
                err,
                xcmtransfer
            });
        }
    }

    publish_xcmtransfer(msg) {
        try {
            if (this.ably_client && this.ably_channel_xcmindexer) {
                this.ably_channel_xcmindexer.publish("xcm-indexer", msg);
            }
        } catch (err) {
            this.logger.error({
                "op": "publish_xcmtransfer ERROR",
                err
            });
        }
    }

    publish_xcminfo(msg) {
        try {
            if (this.ably_client && this.ably_channel_xcminfo) {
                this.ably_channel_xcminfo.publish("xcminfo", msg);
            }
        } catch (err) {
            this.logger.error({
                "op": "publish_xcminfo ERROR",
                err
            });
        }
    }


    // sets up xcmtransferdestcandidate inserts, which are matched to those in xcmtransfer when we writeFeedXCMDest
    // this is send in real time (both unfinalized/finalized)
    updateXCMTransferDestCandidate(candidate, caller = false, isTip = false, finalized = false) {
        //potentially add sentAt here, but it's 2-4

        if (candidate.reaped) {
            // validate reap status..
            let beneficiary = this.getBeneficiaryFromMsgHash(candidate.msgHash)
        }

        let eventID = candidate.eventID
        let k = `${candidate.msgHash}-${candidate.amountReceived}` // it's nearly impossible to have collision even dropping the asset
        if (this.xcmtransferdestcandidate[k] == undefined || finalized) {
            this.xcmtransferdestcandidate[k] = candidate
            candidate.finalized = finalized;
            if (caller) {
                if (this.debugLevel >= paraTool.debugInfo) console.log(`${caller} candidate`, this.xcmtransferdestcandidate[k]);
            }
        } else {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`${caller} skip duplicate candidate ${eventID}`, );
        }

        //MK: send xcmtransfer here
        this.sendManagerMessage(candidate, "xcmtransferdestcandidate", finalized);
        if (this.debugLevel >= paraTool.debugTracing) console.log(`[Delay=${this.chainParser.parserBlockNumber - candidate.blockNumberDest}] send xcmtransferdestcandidate [${candidate.eventID}] (msgHash:${candidate.msgHash}), isTip=${isTip}, finalized=${finalized}`)
        if (isTip) {
            this.sendWSMessage(candidate, "xcmtransferdestcandidate", finalized);
        }
    }

    // update xcmViolation
    updateXCMViolation(v, caller = false) {
        //potentially add sentAt here, but it's 2-4
        let k = `${v.chainID}-${v.instructionHash}` // instructionHash is meaningless here other than preventing duplication
        if (this.xcmViolation[k] == undefined) {
            this.xcmViolation[k] = v
            if (this.debugLevel >= paraTool.debugInfo) console.log(`add ${caller} xcm violation`, this.xcmViolation[k]);
        }
    }

    // update mpState
    updateMPState(mpState) {
        //potentially add sentAt here, but it's 2-4
        let k = `${mpState.msgHash}-${mpState.bn}` // it's nearly impossible to have collision even dropping the asset
        let [xcmBN, chainID, chainIDDest] = this.getTrailingXcmInfo(mpState.msgHash, mpState.bn)
        mpState.xcmBN = xcmBN
        mpState.chainID = chainID
        mpState.chainIDDest = chainIDDest
        if (this.incomingXcmState[k] == undefined) {
            this.incomingXcmState[k] = mpState
            if (this.debugLevel >= paraTool.debugInfo) console.log(`mpState`, this.incomingXcmState[k]);
        } else {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`skip duplicate ${mpState.eventID}`);
        }
    }

    knownParaID(paraID) {
        return this.paraIDs.includes(paraID);
    }
    /*
    CREATE TABLE `crowdloan` (
    `extrinsicHash` varchar(67) NOT NULL,
    `extrinsicID` varchar(32) NOT NULL,
    `chainID` int(11) NOT NULL,
    `blockNumber` varchar(67) NOT NULL,
    `ts` int,
    `action` varchar(80),
    `fromAddress` varchar(67),
    `amount` float,
    `memo` varchar(4096),
    `remark` varchar(4096),
    PRIMARY KEY (`extrinsicHash`)
    );
    */
    async flushCrowdloans() {
        // flush this.crowdloan into "crowdloan"
        let crowdloanKeys = Object.keys(this.crowdloan)
        if (crowdloanKeys.length == 0) return;
        let crowdloans = [];

        for (let i = 0; i < crowdloanKeys.length; i++) {
            let r = this.crowdloan[crowdloanKeys[i]];
            let fromAddress = paraTool.getPubKey(r.account);
            let t = "(" + [`'${r.extrinsicHash}'`, `'${r.extrinsicID}'`, `'${r.chainID}'`,
                `'${r.blockNumber}'`, `'${r.ts}'`, `'${r.section}'`, `'${r.method}'`, `'${fromAddress}'`, `'${r.paraID}'`, `'${r.amount}'`, `${mysql.escape(r.memo)}`, `${mysql.escape(r.remark)}`
            ].join(",") + ")";
            if (!this.knownParaID(r.paraID)) {
                this.readyToCrawlParachains = true;
                console.log("UNKNOWN paraID", r.paraID, "this.paraIDs", this.paraIDs);
                this.logger.warn({
                    "op": "flushCrowdloans-unknown",
                    "newParaID": r.paraID,
                    "chainID": this.chainID
                })
            }
            crowdloans.push(t);
        }
        this.crowdloan = {};
        // --- crowdloan
        let vals = ["extrinsicID", "chainID", "blockNumber", "ts", "section", "method", "fromAddress", "paraID", "amount", "memo", "remark"];
        await this.upsertSQL({
            "table": "crowdloan",
            "keys": ["extrinsicHash"],
            "vals": vals,
            "data": crowdloans,
            "replace": vals
        });
    }

    updateCrowdloanStorage(crowdloan) {
        this.crowdloan[crowdloan.extrinsicHash] = crowdloan;
    }



    async processAssetTypeERC20LiquidityPair(web3Api, chainID, assetChain, ts = false, blockNumber = false, isFullPeriod = false) {
        let [asset, _] = paraTool.parseAssetChain(assetChain);
        let assetInfo = this.tallyAsset[assetChain];
        if (isFullPeriod) {
            let r = {
                low: 0,
                high: 0,
                open: 0,
                close: 0,
                lp0: 0,
                lp1: 0,
                token0In: 0,
                token1In: 0,
                token0Out: 0,
                token1Out: 0,
                token0Volume: 0,
                token1Volume: 0,
                token0Fee: 0,
                token1Fee: 0,
                issuance: 0
            };
            let upd = false;
            let isIncomplete = false;
            if (assetInfo.lpAddress) {
                r.lpAddress = assetInfo.lpAddress // shouldn't be missing here
            }
            let lpAddress = r.lpAddress

            if (assetInfo.issuance !== undefined) {
                r.issuance = assetInfo.issuance;
            }
            if (assetInfo.rat && assetInfo.rat.length > 0) {
                let low = Math.min(...assetInfo.rat);
                let high = Math.max(...assetInfo.rat);
                let open = assetInfo.rat[0];
                let close = assetInfo.rat[assetInfo.rat.length - 1];
                if (!isNaN(low) && !isNaN(high) && !isNaN(open) && !isNaN(close)) {
                    r.low = low
                    r.high = high
                    r.open = open
                    r.close = close
                } else {
                    isIncomplete = true
                    console.log(`${lpAddress} low/high/open/close NOT OK`)
                }
                upd = true;
            }
            if (assetInfo.lp0 && assetInfo.lp0.length > 0) {
                let lp0 = assetInfo.lp0[assetInfo.lp0.length - 1];
                let lp1 = assetInfo.lp1[assetInfo.lp1.length - 1];
                if (!isNaN(lp0) && !isNaN(lp1)) {
                    r.lp0 = lp0
                    r.lp1 = lp1
                } else {
                    isIncomplete = true
                    console.log(`${lpAddress} LP0/LP1 NOT OK`)
                }
                upd = true;
            }
            if (assetInfo.token0In > 0 || assetInfo.token1In > 0) {
                r.token0In = assetInfo.token0In
                r.token1In = assetInfo.token1In
                r.token0Out = assetInfo.token0Out
                r.token1Out = assetInfo.token1Out
                r.token0Volume = assetInfo.token0In
                r.token1Volume = assetInfo.token1In
                r.token0Fee = assetInfo.token0In - assetInfo.token0Out
                r.token1Fee = assetInfo.token1In - assetInfo.token1Out
                upd = true;
            }
            //do a lookup here to fetch total supply of lp issuance
            if (upd && !isIncomplete) {
                let queryBN = (blockNumber) ? blockNumber : 'latest'
                // ethTool rpccall (3)
                var [tokenTotalSupply, lastUpdateBN] = await ethTool.getTokenTotalSupply(web3Api, r.lpAddress, queryBN)
                if (tokenTotalSupply) {
                    r.issuance = tokenTotalSupply
                    r.lastUpdateBN = lastUpdateBN
                }
                this.tallyAsset[assetChain].lp0 = [];
                this.tallyAsset[assetChain].lp1 = [];
                this.tallyAsset[assetChain].rat = [];

                // clear volume tally
                this.tallyAsset[assetChain].token0In = 0;
                this.tallyAsset[assetChain].token1In = 0;
                this.tallyAsset[assetChain].token0Out = 0;
                this.tallyAsset[assetChain].token1Out = 0;
                let state = JSON.stringify(r)
                //(asset, chainID, indexTS, source, open, close, low, high, lp0, lp1, issuance, token0Volume, token1Volume, state )
                let s = `('${r.lpAddress.toLowerCase()}', '${this.chainID}', '${ts}', '${paraTool.assetSourceOnChain}', '${r.open}', '${r.close}', '${r.low}', '${r.high}', '${r.lp0}', '${r.lp1}', '${r.issuance}', '${r.token0Volume}', '${r.token1Volume}', ` + mysql.escape(state) + `)`
                if (this.validAsset(r.lpAddress.toLowerCase(), this.chainID, assetInfo.assetType, s) && this.validDouble(r, assetInfo.assetType, s) && this.validDecimal(r, assetInfo.assetType, s)) {
                    //assetlogLiquidityPairs.push(s)
                    return s
                }
            }
        }
        return false
    }

    async fetchAssetHolderBalances(web3Api, chainID, tokenAddress, tokenDecimal, blockNumber, ts = false) {
        //tokenAddress is checkSumAddr
        let [isXcAsset, assetChain, rawAssetChain] = paraTool.getErcTokenAssetChain(tokenAddress, chainID) // REVIEW -- TODO: the result of this will NOT have 0xfffff... precompile because getErcTokenAssetChain maps from 0xffff.. to xcContractAddress
        let assetholderKeys = Object.keys(this.assetholder)
        let holders = []
        for (let i = 0; i < assetholderKeys.length; i++) {
            let assetChainHolder = assetholderKeys[i];
            let [asset, chainID, holder] = this.parseAssetChainHolder(assetChainHolder);
            if (tokenAddress.toLowerCase() == asset.toLowerCase()) {
                holders.push(holder)
            }
        }
        if (holders.length == 0) return;
        if (isXcAsset) console.log(`***fetchAssetHolderBalances ${tokenAddress} -> ${assetChain} (original:${rawAssetChain})`)
        //console.log(`fetchAssetHolderBalances [${tokenAddress}] [${blockNumber}] holders=${JSON.stringify(holders)}, isXcAsset=${isXcAsset}`)
        let i = 0;
        let n = 0
        let batchSize = 50; // safety check
        while (i < holders.length) {
            let currBatchHolders = holders.slice(i, i + batchSize);
            //console.log(`currBatchHolders#${n}`, currBatchHolders)
            if (currBatchHolders.length > 0) {
                let holderBalances = await ethTool.getTokenHoldersRawBalances(web3Api, tokenAddress, currBatchHolders, tokenDecimal, blockNumber)
                //console.log(`fetchAssetHolderBalances [${tokenAddress}] [${blockNumber}] holderBalances`, holderBalances)
                if (holderBalances && holderBalances.holders) {
                    for (const h of holderBalances.holders) {
                        let newState = {
                            free: h.balance
                        }
                        this.updateAddressStorage(h.holderAddress, assetChain, "fetchAssetHolderBalances", newState, ts, blockNumber)
                    }
                }
                i += batchSize;
                n++
            }
        }
    }

    async processAssetTypeERC20(web3Api, chainID, assetChain, ts = false, blockNumber = false, isFullPeriod = false, isTip = false) {
        //console.log(`processAssetTypeERC20 called [${blockNumber}], assetChain=${assetChain}, isFullPeriod=${isFullPeriod}, isTip=${isTip}`)
        //let web3Api = this.web3Api
        //let chainID = this.chainID;

        // we will update total supply once per index_period
        if (!isTip) {
            return false; // hourly update by other process
        }
        //console.log(`processAssetTypeERC20 tip update [${blockNumber}], assetChain=${assetChain}`);
        let [asset, _] = paraTool.parseAssetChain(assetChain);
        let assetInfo = this.tallyAsset[assetChain];
        var totalSupplyUpdated = false

        if (blockNumber && assetInfo && assetInfo.blockNumber !== undefined && (assetInfo.blockNumber != blockNumber)) {
            // fetch tokensupply update
            // ethTool rpccall (1)
            let [currentTokenSupply, currBN] = await ethTool.getTokenTotalSupply(web3Api, assetInfo.tokenAddress, blockNumber)
            if (currentTokenSupply && blockNumber == currBN) {
                totalSupplyUpdated = true
                assetInfo.totalSupply = currentTokenSupply
                assetInfo.blockNumber = currBN
            }
        }

        let assetKey = assetInfo.tokenAddress.toLowerCase();
        let tokenAddress = assetInfo.tokenAddress
        // if isXcAsset = true, then assetChainStr = {"Token":[currencyID]}~chainID vs rawAssetChainStr 0xffff...~chainID (tokenAddress)
        let [isXcAsset, assetChainStr, rawAssetChainStr] = paraTool.getErcTokenAssetChain(tokenAddress, chainID)
        await this.fetchAssetHolderBalances(web3Api, chainID, tokenAddress, assetInfo.decimal, blockNumber, ts)

        let totalSupply = ethTool.validate_bigint(assetInfo.totalSupply);
        let creatorSql = (assetInfo.creator != undefined) ? `'${assetInfo.creator.toLowerCase()}'` : 'NULL';
        let createdAtTxSql = (assetInfo.createdAtTx != undefined) ? `'${assetInfo.createdAtTx}'` : 'NULL';
        let createDTSql = (assetInfo.createTS != undefined) ? `FROM_UNIXTIME('${assetInfo.createTS}')` : 'NULL'
        let creator = (assetInfo.creator != undefined) ? assetInfo.creator.toLowerCase() : null;
        let createdAtTx = (assetInfo.createdAtTx != undefined) ? assetInfo.createdAtTx : null;
        let lastState = JSON.stringify(assetInfo)
        let isLPToken = (assetInfo.lpInfo != undefined && assetInfo.lpInfo.tokenType == paraTool.assetTypeERC20LiquidityPair) ? true : false

        if (isLPToken) {
            // erc20lp token
            // we update total supply once per index_period
            let lp20TokenInfo = assetInfo.lpInfo
            if (totalSupplyUpdated) {
                let token0Decimals = lp20TokenInfo.token0Decimals
                let token1Decimals = lp20TokenInfo.token1Decimals
                // ethTool rpccall (2)
                var [reserve0, reserve1, blockTimestampLast] = await ethTool.getERC20LiquidityPairRawReserve(web3Api, assetInfo.tokenAddress, blockNumber)
                //update lp0, lp1 issuance once every block
                if (reserve0 && reserve1) {
                    lp20TokenInfo.token0Supply = reserve0 / 10 ** token0Decimals
                    lp20TokenInfo.token1Supply = reserve1 / 10 ** token1Decimals
                    lp20TokenInfo.blockNumber = blockNumber
                    assetInfo.lpInfo = lp20TokenInfo
                    lastState = JSON.stringify(assetInfo)
                }
            }
            let token0 = lp20TokenInfo.token0.toLowerCase();
            let token1 = lp20TokenInfo.token1.toLowerCase();
            var o = `('${assetKey}', '${chainID}', '${paraTool.assetTypeERC20LiquidityPair}', ` + mysql.escape(this.clip_string(assetInfo.name)) + `, ` + mysql.escape(this.clip_string(assetInfo.symbol, 32)) + `, ` + mysql.escape(lastState) + `, '${assetInfo.decimal}', '${totalSupply}', FROM_UNIXTIME('${ts}'), '${blockNumber}', ${createDTSql}, ${creatorSql}, ${createdAtTxSql}, '${token0}', '${token1}', ${lp20TokenInfo.token0Decimals}, ${lp20TokenInfo.token1Decimals}, ${lp20TokenInfo.token0Supply}, ${lp20TokenInfo.token1Supply}, '${lp20TokenInfo.token0Symbol}', '${lp20TokenInfo.token1Symbol}')`;
            if (this.validAsset(assetKey, chainID, assetInfo.assetType, o)) {
                //console.log(`erc20 LP`, o)
                // write { asset, assetType, chainID, token0, token0Symbol, token1, token1Symbol, symbol } to accountrealtime evmcontract:{chainID}
                let lp = {
                    asset: assetKey,
                    assetType: paraTool.assetTypeERC20LiquidityPair,
                    chainID: chainID,
                    assetName: this.clip_string(assetInfo.name),
                    symbol: assetInfo.symbol,
                    decimals: assetInfo.decimal,
                    creator: creator,
                    createdAtTx: createdAtTx,
                    // LP specific info
                    token0: token0,
                    token1: token1,
                    token0Decimals: lp20TokenInfo.token0Decimals,
                    token1Decimals: lp20TokenInfo.token1Decimals,
                }
                this.add_index_metadata(lp);
                this.evmcontractMap[assetKey] = lp;
                return o
                //erc20s.push(o);
            }
        } else {
            // normal erc20 (non-lp token)
            // we will update total supply once per index_period
            //(asset, chainID, assetType, assetName, symbol, lastState, decimals, totalSupply, lastUpdateDT, lastUpdateBN, createDT, creator, createdAtTx, token0, token1, token0Decimals, token1Decimals, token0Supply, token1Supply, token0Symbol, token1Symbol) [token0, token1, token0Decimals, token1Decimals, token0Supply, token1Supply, token0Symbol, token1Symbol] all NULL
            var o = `('${assetKey}', '${chainID}', '${paraTool.assetTypeERC20}', ` + mysql.escape(this.clip_string(assetInfo.name)) + `, ` + mysql.escape(this.clip_string(assetInfo.symbol, 32)) + `, ` + mysql.escape(lastState) + `, '${assetInfo.decimal}', '${totalSupply}', FROM_UNIXTIME('${ts}'), '${blockNumber}', ${createDTSql}, ${creatorSql}, ${createdAtTxSql}, Null, Null, Null, Null, Null, Null, Null, Null)`;
            if (isXcAsset) {
                let [assetK, _] = paraTool.parseAssetChain(assetChainStr)
                o = `('${assetK}', '${chainID}', '${paraTool.assetTypeToken}', ` + mysql.escape(this.clip_string(assetInfo.name)) + `, ` + mysql.escape(this.clip_string(assetInfo.symbol, 32)) + `, ` + mysql.escape(lastState) + `, '${assetInfo.decimal}', '${totalSupply}', FROM_UNIXTIME('${ts}'), '${blockNumber}', ${createDTSql}, ${creatorSql}, ${createdAtTxSql}, Null, Null, Null, Null, Null, Null, Null, Null)`;
            }
            //console.log(`erc20 nonLP, isXcAsset=${isXcAsset}`, o)
            if (this.validAsset(assetKey, chainID, assetInfo.assetType, o)) {
                // write { asset, assetType, chainID, token0, token0Symbol, token1, token1Symbol, symbol }
                let nlp = {
                    asset: assetKey,
                    chainID: chainID,
                    //assetType: (isXcAsset)? paraTool.assetTypeToken: paraTool.assetTypeERC20, check here
                    assetType: paraTool.assetTypeERC20,
                    assetName: this.clip_string(assetInfo.name),
                    symbol: assetInfo.symbol,
                    decimals: assetInfo.decimal,
                    creator: creator,
                    createdAtTx: createdAtTx,
                };
                this.add_index_metadata(nlp);
                this.evmcontractMap[assetKey] = nlp;
                if (!isXcAsset) {
                    return o
                } else {
                    return false
                    //return o
                }
            }
        }
        return false
    }

    resetTipAssetTally() {
        let newTallyAsset = {}
        for (const assetChain of Object.keys(this.tallyAsset)) {
            let assetInfoType = this.tallyAsset[assetChain].assetType;
            if (assetInfoType != 'ERC20') {
                newTallyAsset[assetChain] = this.tallyAsset[assetChain]
            }
        }
        this.tallyAsset = newTallyAsset
    }

    async flush_evmcontractMap() {
        let rows = [];
        for (const k of Object.keys(this.evmcontractMap)) {
            let c = this.evmcontractMap[k];
            // console.log(`!! flush_evmcontractMap ${k}`, c)
            this.add_index_metadata(c);
            this.push_rows_related_keys("evmcontract", c.chainID.toString(), rows, c.asset, c)
        }

        if (rows.length > 0) {
            let [tblName, tblRealtime] = this.get_btTableRealtime()
            try {
                await tblRealtime.insert(rows);
                //console.log("flush_evmcontractMap rows=", rows.length);
                return [];
            } catch (err) {
                console.log(err);
            }
        }
    }

    async flush_assets(ts = false, blockNumber = false, isFullPeriod = false, isTip = false) {
        if (!ts) ts = Math.floor(Date.now() / 1000)
        let ats = ts * 1000000;

        // for all this.assetList, write to asset; mysql address table
        if (isTip) {
            //console.log(`flush_assets [${blockNumber}], ts=${ts}, isFullPeriod=${isFullPeriod}, isTip=${isTip}`)
        }
        let chainID = this.chainID;
        let web3Api = this.web3Api;

        var erc20s = [];
        var tokens = [];

        var erc721classes = [];
        var erc721tokens = [];
        var erc1155classes = [];
        var erc1155tokens = [];
        var contracts = [];
        let assetlogLiquidityPairs = [];
        let assetlogTokensIssuance = [];
        let assetlogTokensPrice = [];
        let assetlogLoans = [];
        let assetlogCDPs = [];

        for (const assetChain of Object.keys(this.tallyAsset)) {
            let assetInfoType = this.tallyAsset[assetChain].assetType;
            let lastTouchedBn = this.tallyAsset[assetChain].blockNumber
            if (this.assetChainMap[assetInfoType] == undefined) {
                this.assetChainMap[assetInfoType] = []
                this.assetStat[assetInfoType] = 0
            }
            this.assetChainMap[assetInfoType].push(assetChain)
            this.assetStat[assetInfoType]++
        }

        // console.log(`assetStat`, this.assetStat, `assetChainMap`, this.assetChainMap)

        let erc20LPPromise = false,
            erc20Promise = false

        for (const assetType of Object.keys(this.assetChainMap)) {
            //potential batch all erc call parallel
            let assetChains = this.assetChainMap[assetType]
            //console.log(`${assetType} len=${assetChains.length}`, assetChains)
            //console.log(`${assetChains}`)
            switch (assetType) {
                case paraTool.assetTypeERC20:
                    if (isTip) {
                        //console.log(`${assetType} len=${assetChains.length}`, assetChains)
                    }
                    erc20Promise = await assetChains.map(async (assetChain) => {
                        try {
                            return this.processAssetTypeERC20(web3Api, chainID, assetChain, ts, blockNumber, isFullPeriod, isTip)
                        } catch (err) {
                            console.log(`processAssetTypeERC20 ${assetChain}`, err)
                            return false
                        }
                    });
                    break;
                case paraTool.assetTypeToken:
                    break;
                case paraTool.assetTypeLoan:
                    break;
                case paraTool.assetTypeLiquidityPair:
                    break;
                case paraTool.assetTypeERC20LiquidityPair:
                    erc20LPPromise = await assetChains.map(async (assetChain) => {
                        try {
                            return this.processAssetTypeERC20LiquidityPair(web3Api, chainID, assetChain, ts, blockNumber, isFullPeriod)
                        } catch (err) {
                            console.log(`processAssetTypeERC20LiquidityPair ${assetChain}`, err)
                            return false
                        }
                    });
                    break;
                case paraTool.assetTypeNFTToken:
                    break;
                case paraTool.assetTypeNFT:
                    break;
                case paraTool.assetTypeERC721:
                    break;
                case paraTool.assetTypeERC721Token:
                    break;
                case paraTool.assetTypeERC1155:
                    break;
                case paraTool.assetTypeERC1155Token:
                    break;
                case paraTool.assetTypeContract:
                    break;
                case paraTool.assetTypeCDP:
                    break;
                default:
                    console.log("TODO: flush - unknown assetType", assetType);
                    break;
            }
        }

        if (erc20LPPromise) {
            let erc20LPPromiseStartTS = new Date().getTime();
            var erc20LPList = await Promise.allSettled(erc20LPPromise)
            let erc20LPPromisTS = (new Date().getTime() - erc20LPPromiseStartTS) / 1000
            if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(b) - erc20LP", erc20LPPromisTS);
            this.timeStat.processERC20LPTS += erc20LPPromisTS
            for (const erc20LPRes of erc20LPList) {
                if (erc20LPRes['status'] == 'fulfilled') {
                    if (erc20LPRes['value']) {
                        assetlogLiquidityPairs.push(erc20LPRes['value'])
                    }
                } else {
                    console.log(`error`, erc20LPRes)
                }
            }
        }

        if (erc20Promise) {
            let erc20PromiseStartTS = new Date().getTime();
            var erc20List = await Promise.allSettled(erc20Promise)
            let erc20PromisTS = (new Date().getTime() - erc20PromiseStartTS) / 1000
            if (this.debugLevel >= paraTool.debugVerbose) console.log("flush(b) - erc20", erc20PromisTS);
            this.timeStat.processERC20TS += erc20PromisTS

            for (const erc20Res of erc20List) {
                if (erc20Res['status'] == 'fulfilled') {
                    if (erc20Res['value']) {
                        erc20s.push(erc20Res['value'])
                    }
                } else {
                    console.log(`error`, erc20Res)
                }
            }

            if (isTip) {
                // reset tip here so we don't wastefully calling the total supply in next block
                this.resetTipAssetTally()
            }
        }

        for (const assetChain of Object.keys(this.tallyAsset)) {
            //need to generate revered pairKey in order to final volume
            let [asset, _] = paraTool.parseAssetChain(assetChain);
            let assetInfo = this.tallyAsset[assetChain];

            switch (assetInfo.assetType) {
                // process both normal erc20 (non-lp token) and erc20LP token info
                case paraTool.assetTypeERC20:
                    break;

                case paraTool.assetTypeToken: {
                    let issuance = assetInfo.issuance;
                    tokens.push(`('${asset}', '${chainID}', '${assetInfo.assetType}', '${issuance}', FROM_UNIXTIME('${ts}'), '${blockNumber}' )`); // *** REVIEW assetType here
                    if (isFullPeriod) {
                        let updIssuance = false
                        let updPrice = false
                        let r = {
                            issuance: 0,
                            price: 0,
                            source: null,
                        };
                        if (assetInfo.issuance) {
                            r.issuance = assetInfo.issuance;
                            assetInfo.issuance = 0;
                            updIssuance = true;
                        }
                        if (assetInfo.price) {
                            r.price = assetInfo.price;
                            updPrice = true;
                        }
                        if (updIssuance) {
                            let o1 = `('${asset}', '${this.chainID}', '${ts}', '${paraTool.assetSourceOnChain}','${r.issuance}')`
                            if (this.debugLevel >= paraTool.debugInfo) console.log(`paraTool.assetTypeToken[${paraTool.assetSourceOnChain}] ${assetChain}`, o1)
                            if (this.validAsset(asset, this.chainID, assetInfo.assetType, o1)) {
                                assetlogTokensIssuance.push(o1)
                            }
                        }
                        if (updPrice) {
                            let o2 = `('${asset}', '${this.chainID}', '${ts}', '${paraTool.assetSourceOracle}','${r.price}')`
                            if (this.debugLevel >= paraTool.debugInfo) console.log(`paraTool.assetTypeToken[${paraTool.assetSourceOracle}] ${assetChain}`, o2)
                            if (this.validAsset(asset, this.chainID, assetInfo.assetType, o2)) {
                                assetlogTokensPrice.push(o2)
                            }
                        }
                    }
                }
                break;

                case paraTool.assetTypeLoan:
                    if (isFullPeriod) {
                        let r = {
                            issuance: 0,
                            debitExchangeRate: 0,
                            source: assetInfo.assetSource,
                        };
                        let upd = false;
                        if (assetInfo.issuance) {
                            r.issuance = assetInfo.issuance;
                            assetInfo.issuance = 0;
                            upd = true;
                        }
                        if (assetInfo.debitExchangeRate) {
                            r.debitExchangeRate = assetInfo.debitExchangeRate;
                            assetInfo.debitExchangeRate = 0;
                            upd = true;
                        }
                        if (upd) {
                            let o = `('${asset}', '${this.chainID}', '${ts}', '${r.source}', '${r.issuance}', '${r.debitExchangeRate}')`
                            if (this.debugLevel >= paraTool.debugInfo) console.log(`Loan`, o)
                            if (this.validAsset(asset, this.chainID, assetInfo.assetType, o) && this.validDouble(r, assetInfo.assetType, o) && this.validDecimal(r, assetInfo.assetType, o)) {
                                assetlogLoans.push(o);
                            }
                        }
                    }
                    break;
                case paraTool.assetTypeCDP:
                    if (isFullPeriod) {
                        let r = {
                            //issuance: 0,
                            supplyExchangeRate: 0,
                            borrowExchangeRate: 0,
                            source: assetInfo.assetSource,
                        };
                        let upd = false;
                        /*
                        if (assetInfo.issuance) {
                            r.issuance = assetInfo.issuance;
                            upd = true;
                        }
                        */
                        if (assetInfo.supplyExchangeRate && assetInfo.borrowExchangeRate) {
                            r.supplyExchangeRate = assetInfo.supplyExchangeRate;
                            r.borrowExchangeRate = assetInfo.borrowExchangeRate;
                            assetInfo.supplyExchangeRate = 0;
                            assetInfo.borrowExchangeRate = 0;
                            upd = true;
                        }
                        if (upd) {
                            let o = `('${asset}', '${this.chainID}', '${ts}', '${r.source}', '${r.supplyExchangeRate}', '${r.borrowExchangeRate}')`
                            console.log(`CDP`, o)
                            if (this.validAsset(asset, this.chainID, assetInfo.assetType, o) && this.validDouble(r, assetInfo.assetType, o) && this.validDecimal(r, assetInfo.assetType, o)) {
                                assetlogCDPs.push(o);
                            }
                        }
                    }
                    break;
                case paraTool.assetTypeLiquidityPair:
                    if (isFullPeriod) {
                        let r = {
                            low: 0,
                            high: 0,
                            open: 0,
                            close: 0,
                            lp0: 0,
                            lp1: 0,
                            token0In: 0,
                            token1In: 0,
                            token0Out: 0,
                            token1Out: 0,
                            token0Volume: 0,
                            token1Volume: 0,
                            token0Fee: 0,
                            token1Fee: 0,
                            issuance: 0,
                            source: assetInfo.assetSource,
                        };
                        let upd = false;

                        if (assetInfo.rat !== undefined && assetInfo.rat.length > 0) {
                            r.low = Math.min(...assetInfo.rat);
                            r.high = Math.max(...assetInfo.rat);
                            r.open = assetInfo.rat[0];
                            r.close = assetInfo.rat[assetInfo.rat.length - 1];
                            upd = true;
                        }
                        if (assetInfo.lp0 !== undefined && assetInfo.lp1 !== undefined && assetInfo.lp0.length > 0 && assetInfo.lp1.length > 0) {
                            r.lp0 = assetInfo.lp0[assetInfo.lp0.length - 1];
                            r.lp1 = assetInfo.lp1[assetInfo.lp1.length - 1];
                            upd = true;
                        }
                        if (assetInfo.issuance !== undefined) {
                            r.issuance = assetInfo.issuance;
                            assetInfo.issuance = 0;
                        }
                        if (assetInfo.token0In > 0 || assetInfo.token1In > 0) {
                            r.token0In = assetInfo.token0In
                            r.token1In = assetInfo.token1In
                            r.token0Out = assetInfo.token0Out
                            r.token1Out = assetInfo.token1Out
                            r.token0Volume = assetInfo.token0In
                            r.token1Volume = assetInfo.token1In
                            r.token0Fee = assetInfo.token0In - assetInfo.token0Out
                            r.token1Fee = assetInfo.token1In - assetInfo.token1Out
                            upd = true;
                        }

                        if (upd) {
                            this.tallyAsset[assetChain].lp0 = [];
                            this.tallyAsset[assetChain].lp1 = [];
                            this.tallyAsset[assetChain].rat = [];


                            // clear volume tally
                            this.tallyAsset[assetChain].token0In = 0;
                            this.tallyAsset[assetChain].token1In = 0;
                            this.tallyAsset[assetChain].token0Out = 0;
                            this.tallyAsset[assetChain].token1Out = 0;

                            //(asset, chainID, indexTS, source, open, close, low, high, lp0, lp1, issuance, token0Volume, token1Volume, state )
                            let state = JSON.stringify(r)
                            let o = `('${asset}', '${this.chainID}', '${ts}', '${r.source}', '${r.open}', '${r.close}', '${r.low}', '${r.high}', '${r.lp0}', '${r.lp1}', '${r.issuance}', '${r.token0Volume}', '${r.token1Volume}', '${state}')`
                            if (this.debugLevel >= paraTool.debugInfo) console.log(`LP update`, o)
                            if (this.validAsset(asset, this.chainID, assetInfo.assetType, o) && this.validDouble(r, assetInfo.assetType, o) && this.validDecimal(r, assetInfo.assetType, o)) {
                                assetlogLiquidityPairs.push(o);
                            }
                        }
                        if (assetInfo.isDualAssetTypeToken) {
                            let issuance = assetInfo.issuance;
                            if (isFullPeriod) {
                                let updIssuance = false
                                let updPrice = false
                                let r = {
                                    issuance: 0,
                                    price: 0,
                                    source: null,
                                };
                                if (assetInfo.issuance) {
                                    r.issuance = assetInfo.issuance;
                                    assetInfo.issuance = 0;
                                    updIssuance = true;
                                }
                                if (assetInfo.price) {
                                    r.price = assetInfo.price;
                                    updPrice = true;
                                }
                                //TODO: add metadata
                                if (updPrice) {
                                    let o2 = `('${asset}', '${this.chainID}', '${ts}', '${paraTool.assetSourceOracle}','${r.price}')`
                                    if (this.debugLevel >= paraTool.debugInfo) console.log(`[DualAssetTypeToken] paraTool.assetTypeToken[${paraTool.assetSourceOracle}] ${assetChain}`, o2)
                                    if (this.validAsset(asset, this.chainID, assetInfo.assetType, o2)) {
                                        assetlogTokensPrice.push(o2)
                                    }
                                }
                            }
                        }
                    }
                    break;
                case paraTool.assetTypeERC20LiquidityPair:
                    /*
                        let res = await this.processAssetTypeERC20LiquidityPair(web3Api, chainID, assetChain, ts, blockNumber, isFullPeriod)
                        if (res) {
                            assetlogLiquidityPairs.push(res)
                        }
                    */
                    break;
                case paraTool.assetTypeNFTToken: {
                    let sqlAssetKey = assetInfo.nftClass; // String eg {"NFTClass":3}
                    let tokenID = assetInfo.tokenID; // String eg {"NFTToken":0}
                    let holder = assetInfo.holder;
                    let tokenURI = assetInfo.tokenURI;
                    let free = assetInfo.free;
                    let meta = (assetInfo.metadata !== undefined) ? assetInfo.metadata : "";

                    /*
                      {
                      assetType: 'NFTToken',
                      metadata: {
                      metadata: '0x62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b7375',
                      owner: '21t2T25Mc3XxTsqZSz4EyqhsM7LJiKrUKBE26ajwvNGq94w1',
                      data: { deposit: 235400000000, attributes: {} }
                      }
                      }
                    */
                    let sql1 = `('${sqlAssetKey}', '${chainID}', '${tokenID}', '${holder}', FROM_UNIXTIME('${ts}'), '${blockNumber}', ${mysql.escape(meta)}, '${tokenURI}', '${free}')`;
                    if (this.validAsset(sqlAssetKey, chainID, assetInfo.assetType, sql1)) {
                        erc721tokens.push(sql1);
                    }
                }
                break;

                case paraTool.assetTypeNFT:
                    /*
                      {
                      assetType: 'NFT',
                      metadata: {
                      metadata: '0x62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b7375',
                      totalIssuance: 1,
                      owner: '23M5ttkmR6KcnsARyoGv5Ymnr1YYkFMkN6rNMD8Df8BUHcQe',
                      data: { deposit: 50035400000000, properties: 15, attributes: {} }
                      }
                      }
                    */
                    var sql = ''; //(asset, chainID, assetType, totalSupply, lastUpdateDT, lastUpdateBN, metadata, lastState, erc721isMetadata, erc721isEnumerable, tokenBaseURI)
                    if (assetInfo.metadata != undefined) {
                        //acala nft format unified with erc721
                        let deposit = assetInfo.deposit ? assetInfo.deposit : 0;
                        let sqlAssetKey = asset;
                        let creatorSql = (assetInfo.creator != undefined) ? `'${assetInfo.creator.toLowerCase()}'` : 'NULL';
                        let createdAtTxSql = (assetInfo.createdAtTx != undefined) ? `'${assetInfo.createdAtTx}'` : 'NULL';
                        let createDTSql = (assetInfo.createTS != undefined) ? `FROM_UNIXTIME('${assetInfo.createTS}')` : 'NULL'
                        let creator = (assetInfo.creator != undefined) ? assetInfo.creator.toLowerCase() : null;
                        let createdAtTx = (assetInfo.createdAtTx != undefined) ? assetInfo.createdAtTx : null;

                        let isEnumerable = (assetInfo.isEnumerable !== undefined && assetInfo.isEnumerable) ? 1 : 0;
                        let isMetadataSupported = (assetInfo.isMetadataSupported !== undefined && assetInfo.isMetadataSupported) ? 1 : 0;
                        let metadata = assetInfo.metadata;
                        let baseURI = (assetInfo.baseURI !== undefined) ? assetInfo.baseURI : "";
                        let ipfsUrl = (assetInfo.ipfsUrl !== undefined) ? assetInfo.ipfsUrl : "";
                        let imageUrl = (assetInfo.imageUrl !== undefined) ? assetInfo.imageUrl : "";
                        let totalSupply = ethTool.validate_bigint(assetInfo.totalIssuance);
                        // sql will continue using contract address as asset key
                        let sql = `('${sqlAssetKey}', '${chainID}', '${assetInfo.assetType}', Null, Null, '${totalSupply}', FROM_UNIXTIME('${ts}'), '${blockNumber}', Null , '${isMetadataSupported}', '${isEnumerable}', ${mysql.escape(baseURI)}, ${mysql.escape(ipfsUrl)}, ${mysql.escape(imageUrl)}, ${createDTSql}, ${creatorSql}, ${createdAtTxSql})`;
                        if (this.validAsset(sqlAssetKey, chainID, assetInfo.assetType, sql)) {
                            erc721classes.push(sql);
                        }
                    }
                    break;
                case paraTool.assetTypeERC721:
                    /*
                      {
                      blockNumber: 575292,
                      tokenAddress: '...',
                      tokenType: 'ERC721',
                      isMetadataSupported: true,
                      isEnumerable: true,
                      metadata: { name: 'Moon Monkeys', symbol: 'MM', baseURI: null },
                      totalSupply: '7353',
                      numHolders: 0
                      }
                    */
                    if (assetInfo.tokenAddress != undefined) {
                        let sql = '';
                        //erc721
                        let sqlAssetKey = assetInfo.tokenAddress.toLowerCase();
                        let creatorSql = (assetInfo.creator != undefined) ? `'${assetInfo.creator.toLowerCase()}'` : 'NULL';
                        let createdAtTxSql = (assetInfo.createdAtTx != undefined) ? `'${assetInfo.createdAtTx}'` : 'NULL';
                        let createDTSql = (assetInfo.createTS != undefined) ? `FROM_UNIXTIME('${assetInfo.createTS}')` : 'NULL'
                        let creator = (assetInfo.creator != undefined) ? assetInfo.creator.toLowerCase() : null;
                        let createdAtTx = (assetInfo.createdAtTx != undefined) ? assetInfo.createdAtTx : null;

                        let isEnumerable = (assetInfo.isEnumerable) ? 1 : 0
                        let isMetadataSupported = (assetInfo.isMetadataSupported) ? 1 : 0
                        let metadata = assetInfo.metadata
                        let baseURI = 'Null'
                        let ipfsUrl = 'Null'
                        let imageUrl = 'Null'
                        let totalSupply = ethTool.validate_bigint(assetInfo.totalSupply);
                        if (isMetadataSupported) {
                            if (metadata.baseURI != undefined) baseURI = `${metadata.baseURI}`
                            if (metadata.ipfsUrl != undefined) ipfsUrl = `${metadata.ipfsUrl}`
                            if (metadata.imageUrl != undefined) imageUrl = `${metadata.imageUrl}`
                        }
                        // sql will continue using contract address as asset key
                        if (isMetadataSupported) {
                            //(asset, chainID, assetType, assetName, symbol, totalSupply, lastUpdateDT, lastUpdateBN, metadata, erc721isMetadata, erc721isEnumerable, tokenBaseURI, ipfsUrl, imageUrl, createDT, creator, createdAtTx)
                            sql = `('${sqlAssetKey}', '${chainID}', '${assetInfo.tokenType}', ${mysql.escape(this.clip_string(metadata.name))}, ${mysql.escape(this.clip_string(metadata.symbol))}, '${totalSupply}', FROM_UNIXTIME('${ts}'), '${blockNumber}', ${mysql.escape(JSON.stringify(metadata))},  '${isMetadataSupported}', '${isEnumerable}', '${baseURI}', '${ipfsUrl}', '${imageUrl}', ${createDTSql}, ${creatorSql}, ${createdAtTxSql})`;
                        } else {
                            sql = `('${sqlAssetKey}', '${chainID}', '${assetInfo.tokenType}', Null, Null, '${totalSupply}', FROM_UNIXTIME('${ts}'), '${blockNumber}', Null , '${isMetadataSupported}', '${isEnumerable}', ${mysql.escape(baseURI)}, ${mysql.escape(ipfsUrl)}, ${mysql.escape(imageUrl)}, ${createDTSql}, ${creatorSql}, ${createdAtTxSql} )`;
                        }
                        if (this.validAsset(sqlAssetKey, chainID, assetInfo.assetType, sql)) {
                            erc721classes.push(sql);
                        }
                    }
                    break;

                case paraTool.assetTypeERC721Token: {
                    /*
                      {
                      blockNumber: 576837,
                      tokenAddress: '...',
                      tokenType: 'ERC721Token',
                      isMetadataSupported: true,
                      tokenID: '14700877701539379516299095288040297463165322513409438848687442933988920671445',
                      tokenURI: 'https://app.domainchain.network/api/nftdomains/metadata/lending.moon',
                      owner: '0x53Fc1bf99217d981721a52eAbe1A2F39A049aBfb'
                      }
                    */
                    let sqlAssetKey = assetInfo.tokenAddress.toLowerCase();
                    let erc721TokenID = assetInfo.tokenID
                    let holder = assetInfo.owner
                    let tokenURI = assetInfo.tokenURI
                    let free = 0;
                    let meta = (assetInfo.metadata != undefined) ? JSON.stringify(assetInfo.metadata) : "";
                    let sql1 = `('${sqlAssetKey}', '${chainID}', '${erc721TokenID}', '${holder}', FROM_UNIXTIME('${ts}'), '${blockNumber}', ${mysql.escape(meta)}, '${tokenURI}', '${free}')`;
                    if (this.validAsset(sqlAssetKey, chainID, assetInfo.assetType, sql1)) {
                        erc721tokens.push(sql1);
                    }
                }
                break;
                case paraTool.assetTypeERC1155:
                    break;
                case paraTool.assetTypeERC1155Token:
                    break;
                case paraTool.assetTypeContract:
                //{"blockNumber":534657,"tokenAddress":"...","tokenType":"ERC20","name":"Stella LP","symbol":"STELLA LP","decimal":"18","totalSupply":142192.4834495356}
                {
                    let assetKey = assetInfo.tokenAddress.toLowerCase();
                    let creatorSql = (assetInfo.creator != undefined) ? `'${assetInfo.creator.toLowerCase()}'` : 'NULL';
                    let createdAtTxSql = (assetInfo.createdAtTx != undefined) ? `'${assetInfo.createdAtTx}'` : 'NULL';
                    let createDTSql = (assetInfo.createTS != undefined) ? `FROM_UNIXTIME('${assetInfo.createTS}')` : 'NULL'
                    let creator = (assetInfo.creator != undefined) ? assetInfo.creator.toLowerCase() : null;
                    let createdAtTx = (assetInfo.createdAtTx != undefined) ? assetInfo.createdAtTx : null;
                    let o = `('${assetKey}', '${chainID}', '${assetInfo.assetType}', FROM_UNIXTIME('${ts}'), '${blockNumber}', ${createDTSql}, ${creatorSql}, ${createdAtTxSql})`;
                    if (this.validAsset(assetKey, chainID, assetInfo.assetType, o)) {
                        contracts.push(o);
                    }
                }
                break;
                default:
                    console.log("TODO: flush - unknown assetType", assetInfo.assetType);
                    break;
            }
        }

        let sqlDebug = (this.debugLevel >= paraTool.debugVerbose) ? true : false
        // ---- asset: erc20s,
        await this.upsertSQL({
            "table": "asset",
            "keys": ["asset", "chainID"],
            "vals": ["assetType", "assetName", "symbol", "lastState", "decimals", "totalSupply", "lastUpdateDT", "lastUpdateBN", "createDT", "creator", "createdAtTx",
                "token0", "token1", "token0Decimals", "token1Decimals", "token0Supply", "token1Supply", "token0Symbol", "token1Symbol"
            ], // add currencyID
            "data": erc20s,
            "replace": ["assetType", "assetName", "symbol", "decimals", "token0", "token1", "token0Decimals", "token1Decimals", "token0Symbol", "token1Symbol"],
            "lastUpdateBN": ["lastUpdateBN", "lastUpdateDT", "totalSupply", "token0Supply", "token1Supply", "lastState"],
            "replaceIfNull": ["createDT", "creator", "createdAtTx"] // add currencyID
        }, sqlDebug);


        await this.upsertSQL({
            "table": "asset",
            "keys": ["asset", "chainID"],
            "vals": ["assetType", "totalSupply", "lastUpdateDT", "lastUpdateBN"], // add currencyID
            "data": tokens,
            "replaceIfNull": ["assetType"], // add currencyID
            "lastUpdateBN": ["lastUpdateBN", "lastUpdateDT", "totalSupply"]
        }, sqlDebug);

        await this.upsertSQL({
            "table": "asset",
            "keys": ["asset", "chainID"],
            "vals": ["assetType", "assetName", "symbol", "totalSupply", "lastUpdateDT", "lastUpdateBN", "metadata", "erc721isMetadata", "erc721isEnumerable", "tokenBaseURI", "ipfsUrl", "imageUrl", "createDT", "creator", "createdAtTx"],
            "data": erc721classes,
            "replace": ["assetType", "assetName", "symbol", "erc721isMetadata", "erc721isMetadata"],
            "lastUpdateBN": ["totalSupply", "lastUpdateBN", "lastUpdateDT", "metadata", "tokenBaseURI", "ipfsUrl", "imageUrl"],
            "replaceIfNull": ["createDT", "creator", "createdAtTx"]
        }, sqlDebug);
        await this.upsertSQL({
            "table": "asset",
            "keys": ["asset", "chainID"],
            "vals": ["assetType", "lastUpdateDT", "lastUpdateBN", "createDT", "creator", "createdAtTx"],
            "data": contracts,
            "lastUpdateBN": ["lastUpdateBN", "lastUpdateDT"],
            "replace": ["assetType"],
            "replaceIfNull": ["createDT", "creator", "createdAtTx"]
        }, sqlDebug);
        // TODO: need new case for loans here to set asset for acala/parallel ... but how are they getting into "asset" now?

        // ---- assetlog
        await this.upsertSQL({
            "table": "assetlog",
            "keys": ["asset", "chainID", "indexTS", "source"],
            "vals": ["issuance"],
            "data": assetlogTokensIssuance,
            "replace": ["issuance"]
        })

        await this.upsertSQL({
            "table": "assetlog",
            "keys": ["asset", "chainID", "indexTS", "source"],
            "vals": ["priceUSD"],
            "data": assetlogTokensPrice,
            "replace": ["priceUSD"]
        })

        await this.upsertSQL({
            "table": "assetlog",
            "keys": ["asset", "chainID", "indexTS", "source"],
            "vals": ["open", "close", "low", "high", "lp0", "lp1", "issuance", "token0Volume", "token1Volume", "state"],
            "data": assetlogLiquidityPairs,
            "replace": ["open", "close", "low", "high", "lp0", "lp1", "issuance", "token0Volume", "token1Volume", "state"]
        }, sqlDebug)

        await this.upsertSQL({
            "table": "assetlog",
            "keys": ["asset", "chainID", "indexTS", "source"],
            "vals": ["issuance", "debitExchangeRate"],
            "data": assetlogLoans,
            "replace": ["issuance", "debitExchangeRate"]
        }, sqlDebug)

        await this.upsertSQL({
            "table": "assetlog",
            "keys": ["asset", "chainID", "indexTS", "source"],
            "vals": ["supplyExchangeRate", "borrowExchangeRate"],
            "data": assetlogCDPs,
            "replace": ["supplyExchangeRate", "borrowExchangeRate"]
        })

        // --- tokenholder
        await this.upsertSQL({
            "table": "tokenholder",
            "keys": ["asset", "chainID", "tokenID"],
            "vals": ["holder", "lastUpdateDT", "lastUpdateBN", "meta", "tokenURI", "free"],
            "data": erc721tokens,
            "lastUpdateBN": ["holder", "free", "meta", "tokenURI", "lastUpdateBN", "lastUpdateDT"]
        }, sqlDebug)

        // reset assetChainMap after we have finised processing
        this.resetAssetChainMap()
    }

    parseAssetChainHolder(assetChainHolder) {
        let words = assetChainHolder.split('-');
        let holder = words[0];
        let assetChain = words[1];
        let [asset, chainID] = paraTool.parseAssetChain(assetChain);
        return [asset, chainID, holder];
    }


    computeTargetBatchSize(batchSize, total) {
        if (total <= batchSize) return batchSize;
        let numBatches = (Math.ceil(total / batchSize));
        return Math.ceil(total / numBatches);
    }

    async flushHashesRows() {
        if (this.evmTxRowsToInsert && this.evmTxRowsToInsert.length > 0) {
            if (this.writeData) {
                let i = 0;
                let batchSize = this.computeTargetBatchSize(1024, this.evmTxRowsToInsert.length);
                while (i < this.evmTxRowsToInsert.length) {
                    let currBatch = this.evmTxRowsToInsert.slice(i, i + batchSize);
                    if (currBatch.length > 0) {
                        await this.insertBTRows(this.btEVMTx, currBatch, "evmtx");
                        //if (currBatch.length > 50) console.log(`flush: flushEVMTxRows btEVMTx=${currBatch.length}`);
                        i += batchSize;
                    }
                }
            } else {
                console.log("SKIP wrote evmtx");
            }
            this.evmTxRowsToInsert = [];
        }

        if (this.hashesRowsToInsert && this.hashesRowsToInsert.length > 0) {
            if (this.writeData) {
                let i = 0;
                let batchSize = this.computeTargetBatchSize(1024, this.hashesRowsToInsert.length);
                while (i < this.hashesRowsToInsert.length) {
                    let currBatch = this.hashesRowsToInsert.slice(i, i + batchSize);
                    //console.log(`currBatch#${n}`, currBatch)
                    if (currBatch.length > 0) {
                        await this.insertBTRows(this.btHashes, currBatch, "hashes");
                        //if (currBatch.length > 50) console.log(`flush: flushHashesRows btHashes=${currBatch.length}`);
                        i += batchSize;
                    }
                }
            } else {
                console.log("SKIP wrote hashes");
            }
            this.hashesRowsToInsert = [];
            this.relatedMap = {}
            this.extrinsicEvmMap = {}
        }

    }

    async flushBlockRows() {
        const tableChain = this.getTableChain(this.chainID);
        if (this.blockRowsToInsert && this.blockRowsToInsert.length > 0) {
            if (this.writeData) {
                var i = 0,
                    batchSize = 256;
                while (i < this.blockRowsToInsert.length) {
                    let currBatch = this.blockRowsToInsert.slice(i, i + batchSize);
                    //console.log(`currBatch#${n}`, currBatch)
                    if (currBatch.length > 0) {
                        await this.insertBTRows(tableChain, currBatch, `chain${this.chainID}`);
                        i += batchSize;
                    }
                }
            } else {
                console.log("SKIP wrote block");
            }
            this.blockRowsToInsert = [];
        }
    }

    get_asset(asset) {
        let a = this.tallyAsset[asset];
        if (a) {
            return a;
        } else {
            return false
        }
    }

    async computeTraceType(chain, bn) {
        let trace = false;
        let chainID = chain.chainID;
        const filter = {
            filter: [{
                family: ["trace"],
                cellLimit: 100
            }]
        };

        const tableChain = this.getTableChain(chainID);
        const [row] = await tableChain.row(paraTool.blockNumberToHex(bn)).get(filter);
        try {
            let rowData = row.data;
            let traceData = rowData["trace"];
            if (traceData) {
                for (const hash of Object.keys(traceData)) {
                    let trace = JSON.parse(traceData[hash][0].value);
                    let traceType = this.compute_trace_type(trace);
                    return (traceType)
                }
            }
        } catch (e) {
            console.log(e)
        }
    }

    compute_trace_type(trace, defaultTraceType) {
        let pass = 0;
        let fail = 0;
        for (let i = 0; i < trace.length; i++) {
            let valRaw = trace[i].v;
            if (valRaw && valRaw.length > 10) {
                let val = valRaw.substr(2);
                let b0 = parseInt(val.substr(0, 2), 16);
                switch (b0 & 3) {
                    case 0: // single-byte mode: upper six bits are the LE encoding of the value
                        let el0 = (b0 >> 2) & 63;
                        if (el0 == (val.substr(2).length) / 2) {
                            pass++;
                        } else {
                            fail++;
                        }
                        break;
                    case 1: // two-byte mode: upper six bits and the following byte is the LE encoding of the value
                        var b1 = parseInt(val.substr(2, 2), 16);
                        var el1 = ((b0 >> 2) & 63) + (b1 << 6);
                        // console.log("twobyte", el1, "b1", b1,  "len", (val.substr(2).length-2)/2);
                        if (el1 == (val.substr(2).length - 2) / 2) {
                            pass++;
                        } else {
                            fail++;
                        }
                        break;
                }
            }
        }
        if (pass + fail < 3) return (defaultTraceType);
        if (pass / (pass + fail) > .9) {
            return "subscribeStorage"
        }
        return "state_traceBlock"
    }

    async testParseTraces(chainID) {
        let chain = await this.setupChainAndAPI(chainID);
        let traces = await this.poolREADONLY.query(`select * from testParseTraces where chainID = '${chainID}' and pass is Null limit 10000`)
        for (let i = 0; i < traces.length; i++) {
            let e = traces[i];
            await this.initApiAtStorageKeys(chain, e.blockHash, e.bn);
            let traceType = await this.computeTraceType(chain, e.bn);
            let [autotrace, _] = this.parse_trace_as_auto(e, traceType, traceIdx, e.bn, e.blockHash, chain.api);
            let [o, parsev] = this.parse_trace_from_auto(autotrace, traceType, e.bn, e.blockHash, chain.api);
            let sql = false;
            if (o && parsev) {
                sql = `update testParseTraces set pass = 1 where chainID = '${e.chainID}' and bn = '${e.bn}' and s = '${e.s}' and k = '${e.k}'`;
            } else {
                sql = `update testParseTraces set pass = 0 where chainID = '${e.chainID}' and bn = '${e.bn}' and s = '${e.s}' and k = '${e.k}'`;
            }
            console.log(sql);
            this.batchedSQL.push(sql);
        }
        await this.update_batchedSQL();
    }

    // parse trace without any handparse
    parse_trace_as_auto(e, traceType, traceIdx, bn, blockHash, api) {
        let o = {}
        //o.bn = bn;
        //o.blockHash = blockHash;
        //o.ts = e.ts; //not sure if we are still using this?
        o.traceID = `${bn}-${traceIdx}`

        let decodeFailed = false

        let key = e.k.slice()
        var query = api.query;

        if (key.substr(0, 2) == "0x") key = key.substr(2)
        let val = "0x"; // this is essential to cover "0" balance situations where e.v is null ... we cannot return otherwise we never zero out balances
        if (e.v) {
            val = e.v.slice()
            if (val.substr(0, 2) == "0x") val = val.substr(2)
        }
        let k = key.slice();
        if (k.length > 64) k = k.substr(0, 64);
        let sk = this.storageKeys[k];

        //if (!sk) decodeFailed = true;
        //if (!sk) return ([false, false]);
        if (!sk) {
            o.p = 'unknown'
            o.s = 'unknown'
            o.k = e.k
            o.v = e.v
            return [o, false]
        }

        // add the palletName + storageName to the object, if found
        o.p = sk.palletName;
        o.s = sk.storageName;
        if (!o.p || !o.s) {
            console.log(`k=${k} not found (${key},${val})`)
            decodeFailed = true
            o.p = 'unknown'
            o.s = 'unknown'
            o.k = e.k
            o.v = e.v
            return [o, false]
            //return ([false, false]);
        }


        let parsev = false;
        let p = paraTool.firstCharLowerCase(o.p);
        let s = paraTool.firstCharLowerCase(o.s);
        let kk = ''
        let vv = ''
        let pk = ''
        let pv = ''
        let debugCode = 0
        let palletSection = `${o.p}:${o.s}` //firstChar toUpperCase to match the testParseTraces tbl

        try {
            if (!query[p]) decodeFailed = true;
            if (!query[p][s]) decodeFailed = true;
            if (!query[p][s].meta) decodeFailed = true;
        } catch (e) {
            decodeFailed = true
        }

        if (decodeFailed) {
            o.p = p
            o.s = s
            o.k = e.k
            o.v = e.v
            return [o, false]
        }
        //if (!query[p]) return ([false, false]);
        //if (!query[p][s]) return ([false, false]);
        //if (!query[p][s].meta) return ([false, false]);
        let queryMeta = query[p][s].meta;
        let handParseKey = false;
        // parse key
        try {
            kk = key;

            var skey = new StorageKey(api.registry, '0x' + key); // ???
            skey.setMeta(api.query[p][s].meta); // ????
            var parsek = skey.toHuman();
            var decoratedKey = JSON.stringify(parsek)
            pk = decoratedKey
        } catch (err) {
            o.pk = "err";
            pk = "err"
            this.numIndexingWarns++;
        }

        // parse value
        try {
            let valueType = (queryMeta.type.isMap) ? queryMeta.type.asMap.value.toJSON() : queryMeta.type.asPlain.toJSON();
            let valueTypeDef = api.registry.metadata.lookup.getTypeDef(valueType).type;
            let v = (val.length >= 2) ? val.substr(2).slice() : ""; // assume 01 "Some" prefix exists
            if (valueTypeDef == "u128" || valueTypeDef == "u64" || valueTypeDef == "u32" || valueTypeDef == "u64" || valueTypeDef == "Balance") {
                parsev = hexToBn(v, {
                    isLe: true
                }).toString();
            } else {
                switch (traceType) {
                    case "state_traceBlock":
                        if (api.createType != undefined) {
                            parsev = api.createType(valueTypeDef, hexToU8a("0x" + v)).toString();
                        } else if (api.registry != undefined && this.apiAt.registry.createType != undefined) {
                            parsev = api.registry.createType(valueTypeDef, hexToU8a("0x" + v)).toString();
                        }
                        break;
                    case "subscribeStorage":
                    default: // skip over compact encoding bytes in Vec<u8>, see https://github.com/polkadot-js/api/issues/4445
                        let b0 = parseInt(val.substr(0, 2), 16);
                        switch (b0 & 3) {
                            case 0: // single-byte mode: upper six bits are the LE encoding of the value
                                let el0 = (b0 >> 2) & 63;
                                if (el0 == (val.substr(2).length) / 2) {
                                    if (api.createType != undefined) {
                                        parsev = api.createType(valueTypeDef, hexToU8a("0x" + val.substr(2))).toString(); // 1 byte
                                    } else if (api.registry != undefined && api.registry.createType != undefined) {
                                        parsev = api.registry.createType(valueTypeDef, hexToU8a("0x" + val.substr(2))).toString(); // 1 byte
                                    }
                                } else {
                                    // MYSTERY: why should this work?
                                    // console.log("0 BYTE FAIL - el0", el0, "!=", (val.substr(2).length) / 2);
                                    if (api.createType != undefined) {
                                        parsev = api.createType(valueTypeDef, hexToU8a("0x" + val.substr(2))).toString();
                                    } else if (api.registry != undefined && api.registry.createType != undefined) {
                                        parsev = api.registry.createType(valueTypeDef, hexToU8a("0x" + val.substr(2))).toString();
                                    }
                                }
                                break;
                            case 1: // two-byte mode: upper six bits and the following byte is the LE encoding of the value
                                var b1 = parseInt(val.substr(2, 2), 16);
                                var el1 = ((b0 >> 2) & 63) + (b1 << 6);
                                if (el1 == (val.substr(2).length - 2) / 2) {
                                    if (api.createType != undefined) {
                                        parsev = api.createType(valueTypeDef, hexToU8a("0x" + val.substr(4))).toString(); // 2 bytes
                                    } else if (api.registry != undefined && api.registry.createType != undefined) {
                                        parsev = api.registry.createType(valueTypeDef, hexToU8a("0x" + val.substr(4))).toString(); // 2 bytes
                                    }
                                } else {
                                    // MYSTERY: why should this work?
                                    // console.log("2 BYTE FAIL el1=", el1, "!=", (val.substr(2).length - 2) / 2, "b0", b0, "b1", b1, "len", (val.substr(2).length - 2) / 2, "val", val);
                                    if (this.apiAt.createType != undefined) {
                                        parsev = api.createType(valueTypeDef, "0x" + val.substr(2)).toString();
                                    } else if (api.registry != undefined && api.registry.createType != undefined) {
                                        parsev = api.registry.createType(valueTypeDef, "0x" + hexToU8a(val.substr(2))).toString();
                                    }
                                }
                                break;
                            case 2: // four-byte mode: upper six bits and the following three bytes are the LE encoding of the value
                                /*var b1 = parseInt(val.substr(2, 2), 16);
                                    var b2 = parseInt(val.substr(4, 2), 16);
                                    var b3 = parseInt(val.substr(6, 2), 16);
                                    var el2 = (b0 >> 2) & 63 + (b1 << 6) + (b2 << 14) + (b3 << 22);
                                    if (el2 == (val.substr(2).length - 6) / 2) {
                                        parsev = api.createType(valueTypeDef, "0x" + val.substr(8)).toString(); // 4 bytes
                                    } else {
                                        parsev = api.createType(valueTypeDef, "0x" + val.substr(2)).toString(); // assume 01 "Some" is the first byte
                                    } */
                                break;
                            case 3: // Big-integer mode: The upper six bits are the number of bytes following, plus four.
                                //let numBytes = ( b0 >> 2 ) & 63 + 4;
                                //parsev = api.createType(valueTypeDef, "0x" + val.substr(2 + numBytes*2)).toString(); // check?
                                break;
                        }
                }
            }
            vv = val;
            if (parsev) {
                pv = parsev;
            }
        } catch (err) {
            //MK: temporary silent this. will revisit again
            if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${o.traceID}] SOURCE: pv`, traceType, k, val, err);
            this.numIndexingWarns++;
        }
        let paddedK = (kk.substr(0, 2) == '0x') ? kk : '0x' + kk
        let paddedV = (vv.substr(0, 2) == '0x') ? vv : '0x' + vv
        if (JSON.stringify(paddedK) == pk) pk = ''
        if (kk != '') o.k = paddedK
        if (vv != '') o.v = paddedV
        if (pk != '') o.pkExtra = pk
        if (pv != '') o.pv = pv
        //o.pv = (pv == undefined)? pv: null
        //Need special treatments for `ParachainSystem:HrmpOutboundMessages, Dmp:DownwardMessageQueues, ParachainSystem:UpwardMessages`
        this.chainParser.decorateAutoTraceXCM(this, o)
        return [o, parsev];
    }

    parse_trace_from_auto(e, traceType, bn, blockHash, api) {
        //console.log(`e`, e)
        let o = {}
        o.bn = e.bn;
        o.blockHash = e.blockHash;
        // o.ts = e.ts; //not sure if we are still using this?

        let key = e.k.slice()
        var query = api.query;

        if (key.substr(0, 2) == "0x") key = key.substr(2)
        let val = "0x"; // this is essential to cover "0" balance situations where e.v is null ... we cannot return otherwise we never zero out balances
        if (e.v) {
            val = e.v.slice()
            if (val.substr(0, 2) == "0x") val = val.substr(2)
        }
        let k = key.slice();
        if (k.length > 64) k = k.substr(0, 64);
        let sk = this.storageKeys[k];

        if (!sk) return ([false, false]);
        if (this.skipStorageKeys[k]) {
            return ([false, false]);
        }
        // add the palletName + storageName to the object, if found
        o.p = sk.palletName;
        o.s = sk.storageName;
        if (!o.p || !o.s) {
            console.log(`k=${k} not found (${key},${val})`)
            return ([false, false]);
        }


        let parsev = false;
        let p = paraTool.firstCharLowerCase(o.p);
        let s = paraTool.firstCharLowerCase(o.s);
        let kk = ''
        let vv = ''
        let pk = ''
        let pv = ''
        let pv2 = ''
        let debugCode = 0
        let palletSection = `${o.p}:${o.s}` //firstChar toUpperCase to match the testParseTraces tbl

        if (!query[p]) return ([false, false]);
        if (!query[p][s]) return ([false, false]);
        if (!query[p][s].meta) return ([false, false]);
        let queryMeta = query[p][s].meta;
        let handParseKey = false;
        // parse key
        try {
            kk = key;
            let parsek = (e.pkExtra != undefined) ? e.pkExtra : JSON.stringify(e.k)
            var decoratedKey = parsek
            //console.log(`parseStorageKey  key=${key}, decoratedKey=${decoratedKey}`)
            if (handParseKey = this.chainParser.parseStorageKey(this, p, s, key, decoratedKey)) {
                if (handParseKey.mpType) {
                    //this is the dmp case
                    if (handParseKey.mpType == 'dmp' && handParseKey.paraIDDest != undefined && handParseKey.chainIDDest != undefined) {
                        o.paraIDDest = handParseKey.paraIDDest
                        o.chainIDDest = handParseKey.chainIDDest
                        o.mpType = handParseKey.mpType
                    }
                    if (handParseKey.mpType == 'ump') {
                        o.mpType = handParseKey.mpType
                        o.chainID = handParseKey.chainID
                        o.chainIDDest = handParseKey.chainIDDest
                    }
                    if (handParseKey.mpType == 'hrmp') {
                        o.mpType = handParseKey.mpType
                        o.chainID = handParseKey.chainID
                    }
                }

                if (handParseKey.lp0 != undefined && handParseKey.lp1 != undefined) {
                    o.lp0 = handParseKey.lp0
                    o.lp1 = handParseKey.lp1
                }
                if (handParseKey.decoratedAsset) {
                    o.decoratedAsset = handParseKey.decoratedAsset
                }
                if (handParseKey.decimals != undefined) {
                    o.decimals = handParseKey.decimals
                }
                if (handParseKey.symbol != undefined) {
                    o.symbol = handParseKey.symbol
                }
                if (handParseKey.asset && handParseKey.asset.DexShare) {
                    handParseKey.asset = handParseKey.asset.DexShare;
                }
                if (handParseKey.accountID != undefined && handParseKey.asset != undefined) {
                    // this is usually a key by acct, assetType
                    o.accountID = handParseKey.accountID
                    o.asset = JSON.stringify(handParseKey.asset)
                    //console.log("OK", o.accountID, o.asset);
                    //kk = ''
                } else if (handParseKey.accountID == undefined && handParseKey.asset != undefined) {
                    // this is usally a key by assetType
                    o.asset = JSON.stringify(handParseKey.asset)
                } else if (handParseKey.isEVM != undefined) {
                    if (handParseKey.blockNumber != undefined) {
                        o.blockNumber = handParseKey.blockNumber
                    }
                    o.isEVM = handParseKey.isEVM
                    // pk = handParseKey;
                } else {
                    // unknowny for now
                    pk = handParseKey;
                }
            } else {
                if (parsek) {
                    //kk = ''
                    pk = JSON.stringify(parsek);
                }
            }
        } catch (err) {
            console.log(`parse_trace_from_auto error [${decoratedKey}]`, err.toString())
            o.pk = "err";
            pk = "err"
            this.numIndexingWarns++;
        }

        // parse value
        try {
            vv = val;
            parsev = e.pv

            if (parsev) {
                if (parsev.substr(0, 2) == "0x") {
                    // can't do anything
                    pv = parsev;
                } else {
                    let handParseVal = false;
                    if (handParseVal = this.chainParser.parseStorageVal(this, p, s, val, parsev, o)) {
                        if (handParseVal.extra != undefined) {
                            //added any extra field here
                            for (let f in handParseVal.extra) {
                                o[f] = handParseVal.extra[f]
                            }
                        }
                        //use the remaining as pv
                        if (handParseVal.pv != "") pv = handParseVal.pv
                        if (handParseVal.pv2 != "") pv2 = handParseVal.pv2 // load raw xcm here
                    } else {
                        try {
                            //uncategorized type
                            let parsedStruct = JSON.parse(parsev)
                            pv = parsedStruct;
                            debugCode = 2
                        } catch {
                            console.log(p, s, parsev);
                        }
                    }
                }
            }
        } catch (err) {
            console.log("SOURCE: pv", err);
            this.numIndexingWarns++;
        }
        if (kk != '') o.k = kk
        if (vv != '') o.v = vv
        if (pk != '') o.pk = JSON.stringify(pk)
        if (pv != '') o.pv = JSON.stringify(pv)
        if (pv2 != '') o.pv2 = JSON.stringify(pv2)
        if (debugCode > 0) o.debug = debugCode

        return [o, parsev];
    }

    getBeneficiaryFromMsgHash(msgHash) {
        let xcmKeys = Object.keys(this.xcmmsgMap)
        for (const tk of xcmKeys) {
            let xcm = this.xcmmsgMap[tk]
            let cachedMsgHash = xcm.msgHash
            if (cachedMsgHash == msgHash && xcm.beneficiaries != undefined) {
                return xcm.beneficiaries.split('|')[0]
            }
        }
        let xcmIDs = Object.keys(this.xcmeventsMap)
        for (const xcmID of xcmIDs) {
            let xcm = this.xcmeventsMap[xcmID]
            let cachedMsgHash = xcm.msgHash
            if (cachedMsgHash == msgHash && xcm.beneficiaries != undefined) {
                return xcm.beneficiaries.split('|')[0]
            }
        }
        return false
    }

    filterXCMkeyByDirection(xcmkey, outgoing = true) {
        if (outgoing) {
            if (xcmkey.includes('outgoing')) return true
        } else {
            if (xcmkey.includes('incoming')) return true
        }
        return false
    }

    // find the msgHash given {BN, recipient} or {BN, innercall}
    getMsgHashCandidate(targetBN, finalized = false, isTip = false, matcher = false, extrinsicID = false, extrinsicHash = false, matcherType = 'address', isOutgoing = true) {
        if (!matcher) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`getMsgHashCandidate [${targetBN}], matcher MISSING`)
            return false
        }
        let rawMatcher = matcher.substr(2) // without the prefix 0x
        if (rawMatcher.length != 64 && rawMatcher.length != 40 && matcherType == 'address') {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`getMsgHashCandidate [${targetBN}, matcher=${matcher}] Invalid destAddress`)
            return false
        }
        let trailingKeys = Object.keys(this.xcmTrailingKeyMap)
        let directionalXcmKeys = []
        //trailingKeys format = `${xcmMsg.msgHash}-${xcmMsg.msgType}-${xcmMsg.sentAt}-${direction}`
        if (this.debugLevel >= paraTool.debugTracing) console.log(`getMsgHashCandidate [${targetBN}, matcher=${matcher}] trailingKeys`, trailingKeys)
        for (const tk of trailingKeys) {
            if (!this.filterXCMkeyByDirection(tk, isOutgoing)) continue
            directionalXcmKeys.push(tk)
            let trailingXcm = this.xcmTrailingKeyMap[tk]
            if (this.debugLevel >= paraTool.debugTracing) console.log(`getMsgHashCandidate [${targetBN}, matcher=${matcher}] trailingXcm`, trailingXcm)
            let firstSeenBN = trailingXcm.blockNumber
            let msgHex = trailingXcm.msgHex
            let msgHash = trailingXcm.msgHash
            if (msgHex.includes(rawMatcher)) {
                //criteria: firstSeen at the block when xcmtransfer is found + recipient match
                //this should give 99% coverage? let's return on first hit for now
                if (firstSeenBN == targetBN) {
                    console.log(`getMsgHashCandidate [${targetBN}, matcher=${matcher}] FOUND candidate=${msgHash}`)
                    if (this.xcmmsgMap[tk] != undefined && extrinsicID && extrinsicHash) {
                        this.xcmmsgMap[tk].extrinsicID = extrinsicID
                        this.xcmmsgMap[tk].extrinsicHash = extrinsicHash
                    }
                    return msgHash
                } else {
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`getMsgHashCandidate [${targetBN}, matcher=${matcher}] FOUND candidate=${msgHash} but FAILED with firstSeenBN(${firstSeenBN})=targetBN(${targetBN})`)
                    //if (firstSeenBN >= targetBN && firstSeenBN - targetBN <= 6) return msgHash
                    console.log(`getMsgHashCandidate [${targetBN}, matcher=${matcher}] FOUND candidate=${msgHash}`)
                }
            }
        }
        if (this.debugLevel >= paraTool.debugInfo) console.log(`getMsgHashCandidate [${targetBN}, matcher=${matcher}, ${matcherType}] MISS`)
    }

    getEvmMsgHashCandidate(targetBN, matcher = false, matcherType = 'evm') {
        let evmTxHash = matcher.transactionHash
        if (evmTxHash == undefined) return
        let txInput = matcher.input.substr(2)
        let txTo = (matcher.to != undefined) ? matcher.to.toLowerCase().substr(2) : ''
        let txGasLimit = (matcher.gasLimit != undefined) ? paraTool.reverseEndian(paraTool.intToHex(matcher.gasLimit).substr(2)) : '' // little endian
        //let txValue = (matcher.value != undefined)? paraTool.reverseEndian(paraTool.intToHex(matcher.value).substr(2)) : ''                  // cant match on value because we already modified by decimals...
        let txCreates = (matcher.creates != undefined) ? matcher.creates.toLowerCase().substr(2) : ''
        if (!matcher) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`getEvmMsgHashCandidate [${evmTxHash}][${targetBN}], matcher MISSING`)
            return false
        }
        let trailingKeys = Object.keys(this.xcmTrailingKeyMap)
        let outgoingTransactMsg = []
        if (this.debugLevel >= paraTool.debugTracing) console.log(`getEvmMsgHashCandidate [${evmTxHash}] [${targetBN}, matcher=[${txInput}, ${txTo}, ${txGasLimit}] trailingKeys`, trailingKeys)
        for (const tk of trailingKeys) {
            let trailingXcm = this.xcmTrailingKeyMap[tk]
            if (trailingXcm.chainID == this.chainID) {
                let msgHash = trailingXcm.msgHash
                let msgStr = trailingXcm.msgStr
                let r = paraTool.getXCMTransactList(msgHash, msgStr)
                if (r) {
                    outgoingTransactMsg.push(r)
                }
            }
        }

        for (const tk of trailingKeys) {
            let trailingXcm = this.xcmTrailingKeyMap[tk]
            //console.log(`getEvmMsgHashCandidate tk=${tk}`, trailingXcm)
            if (this.debugLevel >= paraTool.debugTracing) console.log(`getEvmMsgHashCandidate [${evmTxHash}] [${targetBN}, matcher=[${txInput}, ${txTo}, ${txGasLimit}] trailingXcm`, trailingXcm)
            let firstSeenBN = trailingXcm.blockNumber
            let msgHex = trailingXcm.msgHex
            let msgHash = trailingXcm.msgHash
            let msgStr = trailingXcm.msgStr
            let childMsgHash = false // this is the second leg, if available
            if (firstSeenBN == targetBN && msgHex.includes(txInput) && msgHex.includes(txTo) && msgHex.includes(txGasLimit)) {
                //criteria: firstSeen at the block when xcmtransfer is found + recipient match
                //this should give 99% coverage? let's return on first hit for now
                if (this.debugLevel >= paraTool.debugInfo) console.log(`getEvmMsgHashCandidate [${evmTxHash}] [${targetBN}, matcher=${txInput}, ${txTo}, ${txGasLimit}] FOUND candidate=${msgHash}`)
                if (this.xcmmsgMap[tk] != undefined) {
                    this.xcmmsgMap[tk].connectedTxHash = evmTxHash
                }
                for (const m of outgoingTransactMsg) {
                    for (const t of m.transactList) {
                        if (msgHex.includes(t)) {
                            childMsgHash = m.msgHash
                            break;
                        }
                    }
                }
                return [msgHash, childMsgHash]
            }
        }
        if (this.debugLevel >= paraTool.debugInfo) console.log(`getEvmMsgHashCandidate [${evmTxHash}] [${targetBN}, matcher=[${txInput}, ${txTo}, ${txGasLimit}], ${matcherType}] MISS`)
        return [false, false]
    }


    // clean traling xcm
    cleanTrailingXcmMap(blockNumber) {
        let trailingBlk = 10 // goal: keep xcmKey that's less than n block old so we don't write duplicate xcm from undispated queue
        let trailingBN = blockNumber - trailingBlk
        let updatedTrailingKeyMap = {}
        let trailingKeys = Object.keys(this.xcmTrailingKeyMap)
        for (const tk of trailingKeys) {
            let trailingXcm = this.xcmTrailingKeyMap[tk]
            let firstSeenBN = trailingXcm.blockNumber
            if (firstSeenBN >= trailingBN) {
                updatedTrailingKeyMap[tk] = this.xcmTrailingKeyMap[tk]
            }
        }
        this.xcmTrailingKeyMap = updatedTrailingKeyMap
    }

    // get traling bn
    // xcmKey was `${xcmMsg.msgHash}-${xcmMsg.msgType}-${xcmMsg.sentAt}-${direction}`
    getTrailingXcmInfo(msgHash, currBN) {
        let xcmBN = false
        let chainID = false
        let chainIDDest = false
        let trailingKeys = Object.keys(this.xcmTrailingKeyMap)
        //console.log(`msgHash=${msgHash},trailingKeys`, trailingKeys)
        for (const tk of trailingKeys) {
            if (tk.includes(msgHash)) {
                let trailingXcm = this.xcmTrailingKeyMap[tk]
                if (this.debugLevel >= paraTool.debugTracing) console.log(`msgHash=${msgHash} included`, tk, trailingXcm)
                let firstSeenBN = trailingXcm.blockNumber
                if (trailingXcm.matchable && currBN >= firstSeenBN) {
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`msgHash=${msgHash} [received=${firstSeenBN}, executed=${currBN}]`)
                    xcmBN = firstSeenBN
                    chainID = trailingXcm.chainID
                    chainIDDest = trailingXcm.chainIDDest
                    this.xcmTrailingKeyMap[tk].matchable = false
                    return [xcmBN, chainID, chainIDDest]
                }
            }
        }
        return [xcmBN, chainID, chainIDDest]
    }

    // this is the xcmmessages table
    async dump_xcm_messages() {
        if (this.recentXcmMsgs.length > 0) {
            let rows = this.recentXcmMsgs
            if (this.debugLevel >= paraTool.debugTracing) console.log(`dump_xcm_messages rowsLen=${rows.length}`, rows)

            let vals = ["sentAt", "chainIDDest", "chainID", "msgType", "msgHex", "msgStr", "blockTS", "relayChain", "version", "path", "extrinsicID", "extrinsicHash", "indexDT", "beneficiaries", "connectedTxHash"];
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": rows,
                "replace": vals
            }, true);
            this.recentXcmMsgs = []

            /*
            {
                sectionMethod: 'xcmpQueue(Fail)',
                eventID: '2000-1626946-1-8',
                sentAt: 11570241,
                bn: 1626946,
                msgHash: '0xd5416d6a4809dd80fc978845e5bbd8a1b64e10ddea383a158bf83195ea18aa8f',
                success: false,
                error: 'unroutable',
                description: null
            }
            */
            let incomingXcmStateKeys = Object.keys(this.incomingXcmState)
            if (incomingXcmStateKeys.length > 0) {
                let mpStates = [];
                for (let i = 0; i < incomingXcmStateKeys.length; i++) {
                    let r = this.incomingXcmState[incomingXcmStateKeys[i]];
                    if (r.xcmBN && r.chainID !== false && r.chainIDDest !== false) {
                        // ["msgHash", "blockNumber", "incoming"] + ["destStatus", "executedEventID", "errorDesc"]
                        let destStatus = (r.success === true) ? '1' : '0'
                        let errorDesc = (r.errorDesc != undefined) ? `'${r.errorDesc}'` : `NULL`
                        if (r.errorDesc != undefined && r.description != undefined) {
                            errorDesc = `'${r.errorDesc}:${r.description}'`
                        }
                        //let executedEventID = (r.eventID != undefined) ? `'${r.eventID}'` : `NULL`
                        let t = "(" + [`'${r.msgHash}'`, `'${r.xcmBN}'`, `'1'`, `'${r.chainID}'`, `'${r.chainIDDest}'`, `'${destStatus}'`, `'${r.eventID}'`, errorDesc].join(",") + ")";
                        //console.log(`mpStates`, t)
                        mpStates.push(t);
                    } else {
                        console.log(`[${r.msgHash}] xcmInfo missing! xcmBN=${r.xcmBN}, chainID=${r.chainID}, chainIDDest=${r.chainIDDest}`)
                    }
                }
                this.incomingXcmState = {};
                let sqlDebug = false
                try {
                    // these events we can't say for sure without matching to recent sends
                    if (mpStates.length > 0) {
                        let vals = ["chainID", "chainIDDest", "destStatus", "executedEventID", "errorDesc"];
                        await this.upsertSQL({
                            "table": "xcmmessages",
                            "keys": ["msgHash", "blockNumber", "incoming"],
                            "vals": vals,
                            "data": mpStates,
                            "replace": vals
                        }, sqlDebug);
                    }
                } catch (err0) {
                    console.log(err0);
                }
            }

            let out = [];
            for (const blockNumber of Object.keys(this.numXCMMessagesIn)) {
                out.push(`('${blockNumber}', '${this.numXCMMessagesIn[blockNumber]}')`);
            }
            if (out.length > 0) {
                let vals = ["numXCMMessagesIn"];
                await this.upsertSQL({
                    "table": `block${this.chainID}`,
                    "keys": ["blockNumber"],
                    "vals": vals,
                    "data": out,
                    "replace": vals
                });
                //console.log("numXCMMessagesOut", this.numXCMMessagesOut);
                this.numXCMMessagesIn = {};
            }

            out = [];
            for (const blockNumber of Object.keys(this.numXCMMessagesOut)) {
                out.push(`('${blockNumber}', '${this.numXCMMessagesOut[blockNumber]}')`);
            }
            if (out.length > 0) {
                vals = ["numXCMMessagesOut"];
                await this.upsertSQL({
                    "table": `block${this.chainID}`,
                    "keys": ["blockNumber"],
                    "vals": vals,
                    "data": out,
                    "replace": vals
                });
                //console.log("numXCMMessagesOut", this.numXCMMessagesOut);
                this.numXCMMessagesOut = {};
            }
        }
    }

    async dump_failed_traces() {
        let traceRows = this.failedParseTraces
        let i = 0;
        for (i = 0; i < traceRows.length; i += 10000) {
            let j = i + 10000;
            if (j > traceRows.length) j = traceRows.length;
            await this.upsertSQL({
                "table": `testParseTraces`,
                "keys": ["chainID", "bn", "s", "k"],
                "vals": ["blockHash", "p", "v", "traceType", "subscribeStorageParseV", "testGroup"],
                "data": traceRows.slice(i, j),
                "replace": ["blockHash", "p", "v", "traceType", "subscribeStorageParseV", "testGroup"]
            });
        }
        if (traceRows.length > 0) {
            console.log(`[chain${this.chainID}] added ${traceRows.length} recs to testParseTraces`)
            console.log(`(failed) debugParseTraces summary`, this.debugParseTraces)
            this.failedParseTraces = []
            this.debugParseTraces = {}
        }
    }

    parseEvent(evt, eventID, api = false) {
        if (!api) return (false);
        if (!api.events) return (false);
        var section = evt.method.pallet;
        var method = evt.method.method;
        if (!api.events[section]) return (false);

        var e = api.events[section][method];
        if (!e) return (false);
        var data = evt.data;
        var fields = e.meta.fields;

        var dType = [];
        let dEvent = {}
        dEvent.eventID = eventID
        dEvent.docs = e.meta.docs.toString()
        //dEvent.method = evt.method
        dEvent.section = section
        dEvent.method = method
        //dEvent.data = evt.data


        //store metaError while we decorate it
        /*
        [
            {
              "module": {
                  "index": 4,
                  "error": 1,
                  "msg": 'generate msg here'
                }
            },
            {
              "err": {
                "module": {
                  "index": 23,
                  "error": 0,
                  "msg": 'generate msg here'
                }
              }
            }
          ]
        */
        let dData = evt.data
        for (var i = 0; i < dData.length; i++) {
            let dData_i = dData[i]
            try {
                if (dData_i != undefined) {
                    if (dEvent.section == "system" && dEvent.method == "ExtrinsicFailed" && dData_i.module != undefined) {
                        dData_i.module.msg = this.getErrorDoc(dData_i.module, api)
                        dData[i] = dData_i
                    } else if (dData_i.err != undefined && dData_i.err.module != undefined) {
                        dData_i.err.module.msg = this.getErrorDoc(dData_i.err.module, api)
                        dData[i] = dData_i
                    }
                }
            } catch (e) {
                console.log(`parseEvent error`, e, `dData`, dData)
            }
        }
        dEvent.data = dData

        for (var i = 0; i < fields.length; i++) {
            var dData_i = dEvent.data[i]
            var fld = fields[i]
            var valueType = fld.type.toJSON();
            var typeDef = api.registry.metadata.lookup.getTypeDef(valueType).type
            if (event_conversion_list.includes(typeDef)) {
                dData_i = paraTool.toIntegerStr(dData_i)
                dEvent.data[i] = dData_i
            }
            //var parsedEvent = this.api.createType(typeDef, data[i]);
            var name = fld.name.toString();
            var typeName = fld.typeName.toString();
            dType.push({
                typeDef: typeDef,
                name: name
            })
        }
        dEvent.dataType = dType
        return dEvent
    }

    decode_s_internal_raw(call_s, apiAt) {
        //fetch method, section when human is not set
        let callIndex = call_s.callIndex
        let [method, section, argsDef] = this.getMethodSection(callIndex, apiAt)
        let f = {
            callIndex: callIndex,
            section: section,
            method: method,
            argsDef: argsDef,
            args: call_s.args
        }
        return f
    }

    getMethodSection(callIndex, apiAt) {
        try {
            //console.log(`getMethodSection callIndex=${callIndex}`)
            var {
                method,
                section,
                toJSON
            } = apiAt.registry.findMetaCall(paraTool.hexAsU8(callIndex))
            var methodJSON = toJSON()
            var argsDef = methodJSON.args
            return [method, section, argsDef]
        } catch (e) {
            console.log(`getMethodSection unable to decode ${callIndex}`)
        }
        return [null, null, null]
    }

    recursive_batch_all(call_s, apiAt, extrinsicHash, extrinsicID, lvl = '', remarks = {}, opaqueCalls = {}) {
        if (call_s && call_s.args.calls != undefined) {
            for (let i = 0; i < call_s.args.calls.length; i++) {
                let callIndex = call_s.args.calls[i].callIndex
                let [method, section, argsDef] = this.getMethodSection(callIndex, apiAt)
                let ff = {
                    callIndex: callIndex,
                    section: section,
                    method: method,
                    args: call_s.args.calls[i].args,
                    argsDef: argsDef
                }
                try {
                    for (let k = 0; k < argsDef.length; k++) {
                        let argsDef_k = argsDef[k]
                        let argsDef_k_type = argsDef_k.type
                        let argsDef_k_name = argsDef_k.name
                        //console.log(`recursive_batch_all argsDef_k`, argsDef_k)
                        //console.log(`recursive_batch_all argsDef_k_type`, argsDef_k_type)
                        if (extrinsic_args_conversion_list.includes(argsDef_k_type)) {
                            let arg_val = call_s.args.calls[i].args[argsDef_k_name]
                            call_s.args.calls[i].args[argsDef_k_name] = paraTool.toIntegerStr(arg_val)
                        }
                    }
                } catch (recursiveArgsDefErr) {
                    console.log(`recursive_batch_all recursiveArgsDefErr`, recursiveArgsDefErr)
                }
                let pallet_method = `${ff.section}:${ff.method}`
                if (pallet_method == 'system:remarkWithEvent' || pallet_method == 'system:remark') {
                    if (ff.args.remark != undefined) {
                        remarks[ff.args.remark] = 1
                    }
                }
                //let o = `call ${lvl}-${i}`
                //console.log(`\t${o} - ${pallet_method}`)
                if (ff.args.call != undefined) {
                    //recursively decode opaque call
                    let s = " ".repeat()
                    //console.log(`\t${" ".repeat(o.length+2)} - additional 'call' argument found`)
                    this.decode_opaque_call(ff, apiAt, extrinsicHash, extrinsicID, `${lvl}-${i}`, remarks, opaqueCalls)
                }
                this.recursive_batch_all(ff, apiAt, extrinsicHash, extrinsicID, `${lvl}-${i}`, remarks, opaqueCalls)
                call_s.args.calls[i] = ff
            }
            //console.log("recursive_batch_all done")
        } else {
            //sudo:sudoAs case
            if (call_s && call_s.args.call != undefined) {
                //console.log(`${extrinsicHash}`, 'call only', innerexs)
                this.decode_opaque_call(call_s, apiAt, extrinsicHash, extrinsicID, `${lvl}`, remarks, opaqueCalls)
            } else {
                //console.log("recursive_batch_all no more loop")
            }
        }
    }

    //this is right the level above args
    decode_opaque_call(f, apiAt, extrinsicHash, extrinsicID, lvl = '', remarks = {}, opaqueCalls = {}) {
        //console.log(`${extrinsicHash}`, 'decode_opaque_call', f)
        if (f.args.call != undefined) {
            let opaqueCall = f.args.call
            let extrinsicCall = false;
            let isHexEncoded = (typeof opaqueCall === 'object') ? false : true
            //console.log(`d opaqueCall(hexEncoded=${isHexEncoded})`, opaqueCall)
            if (isHexEncoded) {
                opaqueCalls[opaqueCall] = 1 // using opaqueCalls for fingerprint
                try {
                    // cater for an extrinsic input...
                    extrinsicCall = apiAt.registry.createType('Call', opaqueCall);
                    //console.log("d decoded opaqueCall", extrinsicCall.toString())

                    let innerexs = JSON.parse(extrinsicCall.toString());
                    let innerOutput = {}
                    try {
                        // only utility batch will have struct like this
                        if (innerexs && innerexs.args.calls != undefined) {
                            this.recursive_batch_all(innerexs, apiAt, extrinsicHash, extrinsicID, lvl, remarks, opaqueCalls)
                        }
                        if (innerexs && innerexs.args.call != undefined) {
                            //console.log(`${extrinsicHash}`, 'call only', innerexs)
                            this.decode_opaque_call(innerexs, apiAt, extrinsicHash, extrinsicID, `${lvl}`, remarks, opaqueCalls)
                        }
                        innerOutput = this.decode_s_internal_raw(innerexs, apiAt)
                        //console.log(`${extrinsicHash}`, 'innerexs', innerexs)
                        let innerOutputPV = `${innerOutput.section}:${innerOutput.method}`
                        //console.log(`${extrinsicHash}`, 'innerOutput', innerOutput)
                        if (innerOutputPV == 'system:remarkWithEvent' || innerOutputPV == 'system:remark') {
                            if (innerOutput.args.remark != undefined) {
                                remarks[innerOutput.args.remark] = 1
                            }
                        }
                    } catch (err1) {
                        console.log(`* [${extrinsicID}] ${extrinsicHash} try errored`, err1)
                    }

                    //console.log("innerexs", JSON.stringify(innerexs))

                    f.args.call = innerOutput //this line update the f
                    //console.log("innerOutput", JSON.stringify(innerOutput))

                } catch (e) {
                    console.log(`* [${extrinsicID}] ${extrinsicHash} try errored`, e, f)
                }
            } else {
                //This is the proxy:proxy case - where api has automatically decoded the "call"
                if (f.args.call.callIndex != undefined) {
                    let call_ss = f.args.call
                    let call_s = this.decode_s_internal_raw(call_ss, apiAt)
                    let call_sPV = `${call_s.section}:${call_s.method}`
                    //console.log(`call_sPV`, call_sPV)
                    if (call_sPV == 'system:remarkWithEvent' || call_sPV == 'system:remark') {
                        if (call_s.args.remark != undefined) {
                            remarks[call_s.args.remark] = 1
                        }
                    }
                    this.recursive_batch_all(call_s, apiAt, extrinsicHash, extrinsicID, lvl, remarks, opaqueCalls)
                    f.args.call = call_s
                }
                //console.log(`* [${extrinsicID}] ${extrinsicHash} already decoded opaqueCall`, extrinsicCall.toString())
            }
        }
    }

    decode_s_extrinsic(extrinsic, blockNumber, index = 'pending', apiAt) {
        let exos = JSON.parse(extrinsic.toString());

        let extrinsicHash = extrinsic.hash.toHex()
        let extrinsicID = (index == 'pending') ? `${extrinsicHash}-pending` : blockNumber + "-" + index
        let callIndex = exos.method.callIndex
        let [method, section, argsDef] = this.getMethodSection(callIndex, apiAt)
        let remarks = {} // add all remarks here
        let opaqueCalls = {}
        let pv = `${section}:${method}`
        if (pv == 'system:remarkWithEvent' || pv == 'system:remark') {
            if (exos.method.args.remark != undefined) {
                remarks[exos.method.args.remark] = 1
            }
        }


        //console.log(`[${extrinsicID}] ${extrinsicHash}   |  ${section}:${method}`)
        // console.log("exos", exos)

        try {
            // this is picking up utility batch with "calls" array
            if (exos && exos.method.args.calls != undefined && Array.isArray(exos.method.args.calls)) {
                this.recursive_batch_all(exos.method, apiAt, extrinsicHash, extrinsicID, `0`, remarks, opaqueCalls)
                let exosArgsCall = exos.method.args.calls
                for (let i = 0; i < exosArgsCall.length; i++) {
                    let f = exosArgsCall[i]
                    exosArgsCall[i] = f
                }
                exos.method.args.calls = exosArgsCall
            }
        } catch (err1) {
            /// TODO: ....
            console.log(`[${extrinsicID}] ${extrinsicHash} error at err1`, err1)
        }

        if (exos.method.args.call != undefined) {
            this.decode_opaque_call(exos.method, apiAt, extrinsicHash, extrinsicID, `0`, remarks, opaqueCalls)
        }

        let sig = exos.signature
        let sigTest = extrinsic.signature.toString()
        if (sigTest == '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' || sigTest == '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000') {
            sig.isSigned = false
        } else {
            sig.isSigned = true
        }

        let lifetime = {
            isImmortal: 0
        }
        if (sig.era != undefined) {
            // either mortal or immortal
            if (sig.era.immortalEra != undefined) {
                //usually unsined tx here
                lifetime.isImmortal = 1
            } else if (sig.era.mortalEra != undefined) {
                try {
                    var r = apiAt.registry.createType('MortalEra', paraTool.hexAsU8(sig.era.mortalEra))
                    let [birth, death] = paraTool.getLifetime(blockNumber, r)
                    lifetime.birth = birth
                    lifetime.death = death
                    sig.era = r.toHuman()
                } catch (e) {
                    console.log(`[${extrinsicID}] ${extrinsicHash} error computing lifetime + era`, e)
                }
            }
        }
        let remarkStrs = []
        for (const remark of Object.keys(remarks)) {
            remarkStrs.push(remark)
        }
        let encodedCalls = []
        for (const opaqueCall of Object.keys(opaqueCalls)) {
            encodedCalls.push(opaqueCall)
        }
        try {
            if (argsDef) {
                for (let i = 0; i < argsDef.length; i++) {
                    let argsDef_i = argsDef[i]
                    let argsDef_i_type = argsDef_i.type
                    let argsDef_i_name = argsDef_i.name
                    //console.log(`argsDef_i`, argsDef_i)
                    //console.log(`argsDef_i_type`, argsDef_i_type)
                    if (extrinsic_args_conversion_list.includes(argsDef_i_type)) {
                        let arg_val = exos.method.args[argsDef_i_name]
                        exos.method.args[argsDef_i_name] = paraTool.toIntegerStr(arg_val)
                    }
                }
            }
        } catch (argsDefErr) {
            console.log(`decode_s_extrinsic argsDefErr`, argsDefErr)
        }

        let out = {
            method: {
                //todo: figure out method section
                callIndex: callIndex,
                pallet: section,
                method: method,
            },
            args: exos.method.args,
            argsDef: argsDef,
            remarks: remarkStrs,
            encodedCalls: encodedCalls,
            signature: sig,
            lifetime: lifetime
        }
        return (out)
    }

    getErrorDoc(errModule, apiAt) {
        //console.log(`errModule`, errModule)
        let errModuleIdx = errModule.index
        let errModuleErrorEnum = errModule.error

        let errMsg = ''
        if (errModuleIdx == undefined || errModuleErrorEnum == undefined) {
            return `Failed (Generic)` //no further information available
        }
        let errModuleErrorEnum0 = errModule.error
        if (!paraTool.isInt(errModuleErrorEnum0)) {
            errModuleErrorEnum0 = hexToU8a(errModule.error)[0]
        }

        let indexLookup = new Uint8Array([errModuleIdx, errModuleErrorEnum0]);

        try {
            var decoded = apiAt.registry.findMetaError(indexLookup)
            //console.log(`decoded`, decoded)
            let errorID = `${errModule.index}-${errModule.error}`
            //console.log(`getErrorDoc`, errorID, errModule)
            errMsg = `Failed(${decoded.method}) ${decoded.docs.join('  ')}`
        } catch (e) {
            console.log(`findMetaError unable to decode`, errModuleIdx, errModuleErrorEnum, indexLookup)
            let errorID = `${errModule.index}-${errModule.errModuleErrorEnum0}`
            errMsg = `Failed(errorID:${errorID}) `
        }
        return errMsg
    }

    checkExtrinsicStatusAndFee(apiAt, extrinsic, extrinsicHash, extrinsicID, isSigned, signer = false) {
        let res = {
            fee: 0,
            success: 1,
            err: null,
            isEVM: false,
            confidence: 0,
        }
        let evmStatus = {
            from: null,
            to: null,
            transactionHash: null,
        }
        let chainID = this.chainID
        let withdrawFee = 0 // if set, transaction is paid in native currency
        let totalDepositFee = 0 // if set, should equal to withdrawTxFee, including the 20% deposit to treasury
        let depositFeeList = [];
        let treasuryFee = 0 // usaullly 20% of the withdrawTxFee
        let parsedEvents = extrinsic.events
        let errorSet = false
        let [exp, exm] = this.parseExtrinsicSectionMethod(extrinsic)
        let extrinsicSectionMethod = `${exp}:${exm}`
        //let isUnsignedHead = (extrinsicSectionMethod == 'parachainSystem:setValidationData' || extrinsicSectionMethod == 'paraInherent:enter' || extrinsicSectionMethod == 'timestamp:set')? true : false
        let isUnsignedHead = !isSigned
        let isFirstBalancesWithdraw = false
        for (const evt of parsedEvents) {
            if (!evt || !evt.data) continue;
            let data = JSON.parse(JSON.stringify(evt.data))
            let dataType = evt.dataType
            let decodedData = evt.decodedData
            //let method = evt.method
            //let [pallet, method] = this.parseSectionMethod(evt)
            let pallet_method;
            if (evt.section != undefined && evt.method != undefined) {
                pallet_method = `${evt.section}:${evt.method}`
            }

            if (dataType != undefined && Array.isArray(dataType)) {
                if (pallet_method == 'tokens:Withdrawn') {
                    //this is normal case for txfees
                    if (data != undefined && Array.isArray(data) && (chainID == paraTool.chainIDKintsugi || chainID == paraTool.chainIDInterlay)) {
                        try {
                            //this assumes that transaction is paid by nativeAsset
                            let isNativeToken = true
                            let feeToken = data[0]
                            if (feeToken.token != undefined) {
                                if (feeToken.token != this.getNativeSymbol(chainID)) {
                                    isNativeToken = false
                                    console.log(`[${extrinsicID}] ${extrinsicHash} nonNative feeToken ${feeToken.token}`)
                                }
                            }
                            let withdrawTxFee = paraTool.dechexToInt(data[2])
                            if (!isUnsignedHead && signer == data[1] && isNativeToken) {
                                withdrawFee = withdrawTxFee
                                //console.log(`[${extrinsicID}] ${extrinsicHash} [${data[0]}] withdrawFee=${withdrawTxFee}, evt=`, evt)
                                res.fee = withdrawFee
                            }
                        } catch (e) {
                            console.log('unable to compute Withdraw fees!!', data, e)
                        }
                    }
                }
                if (pallet_method == 'balances:Withdraw') {
                    //this is normal case for txfees
                    if (data != undefined && Array.isArray(data)) {
                        try {
                            let withdrawTxFee = paraTool.dechexToInt(data[1])
                            if (!isUnsignedHead && signer == data[0]) {
                                if (!isFirstBalancesWithdraw) {
                                    withdrawFee = withdrawTxFee
                                    res.fee = withdrawFee
                                    isFirstBalancesWithdraw = true
                                } else {
                                    //console.log(`pallet_method=${pallet_method} [${extrinsicID}] ${extrinsicHash} [${data[0]}] skip duplicate=${withdrawTxFee}, evt=`, evt)
                                }
                                //console.log(`pallet_method=${pallet_method} [${extrinsicID}] ${extrinsicHash} [${data[0]}] withdrawFee=${withdrawTxFee}`)
                            }
                        } catch (e) {
                            console.log('unable to compute Withdraw fees!!', data, e)
                        }
                    }
                }
                if (pallet_method == 'balances:Deposit') {
                    if (data != undefined && Array.isArray(data)) {
                        try {
                            let depositfee = paraTool.dechexToInt(data[1])
                            if (!isUnsignedHead) {
                                //console.log(`[${extrinsicID}] ${extrinsicHash} [${data[0]}] depositfee=${depositfee}`)
                                totalDepositFee += depositfee
                                depositFeeList.push(depositfee)
                            }
                        } catch (e) {
                            console.log('unable to compute Deposit fees!!', data, e)
                        }
                    }
                }
                if (pallet_method == 'treasury:Deposit') {
                    if (data != undefined && Array.isArray(data)) {
                        try {
                            let tFee = paraTool.dechexToInt(data[0])
                            //console.log(`[${extrinsicID}] ${extrinsicHash} tFee=${tFee}`)
                            treasuryFee += tFee
                        } catch (e) {
                            console.log('unable to compute treasury fees!!', data, e)
                        }
                    }
                }
                if (pallet_method == 'transactionPayment:TransactionFeePaid') {
                    if (data != undefined && Array.isArray(data) && data.length == 4) {
                        try {
                            let actualFee = paraTool.dechexToInt(data[1])
                            let actualTip = paraTool.dechexToInt(data[2])
                            let actualSurplus = paraTool.dechexToInt(data[3])
                            let fee = actualFee + actualSurplus - actualTip
                            //console.log(`pallet_method=${pallet_method} [${extrinsicID}] ${extrinsicHash} [${data[0]}] actualFee=${actualFee}, actualTip=${actualTip}, actualSurplus=${actualSurplus}, fee=${fee}`)
                            res.fee = fee
                            res.confidence = 1
                        } catch (e) {
                            console.log('unable to compute treasury fees!!', data, e)
                        }
                    } else if (data != undefined && Array.isArray(data) && data.length == 3) {
                        try {
                            let actualFee = paraTool.dechexToInt(data[1])
                            let actualTip = paraTool.dechexToInt(data[2])
                            let fee = actualFee //- actualTip
                            //console.log(`pallet_method=${pallet_method} [${extrinsicID}] ${extrinsicHash} [${data[0]}] actualFee=${actualFee}, actualTip=${actualTip}, fee=${fee}`)
                            res.fee = fee
                            res.confidence = 1
                        } catch (e) {
                            console.log('unable to compute treasury fees!!', data, e)
                        }
                    }
                }
                if (pallet_method == 'ethereum:Executed') {
                    //from, to, txhash
                    // data[3] is enum: {succeed/error/revert/fatal}
                    /*
                    { "succeed": "Returned"}
                    { "revert": "Reverted"}
                    { "error": ???}
                    { "fatal": ???}
                    */
                    if (data != undefined && Array.isArray(data)) {
                        try {
                            evmStatus.from = data[0]
                            evmStatus.to = data[1]
                            evmStatus.transactionHash = data[2]
                            let executionEnum = Object.keys(data[3])[0]
                            if (executionEnum == 'succeed') {
                                res.success = 1
                                res.err = null
                            } else {
                                // error/revert/fatal
                                res.success = 0
                                res.err = `Failed(${paraTool.firstCharUpperCase(executionEnum)})`
                            }
                            res.isEVM = evmStatus
                        } catch (e) {
                            console.log('unable to extra ethereum:Executed info!!', data, e)
                        }
                    }
                }
                for (let i = 0; i < dataType.length; i++) {
                    let dataType_i = dataType[i]
                    let data_i = data[i]
                    //if (extrinsicHash == '0xd50a05196fcc5794b44b19502dcb4aaa573fea0a510120fb1966fdd5ad76f119') console.log('dataType_i', dataType_i, 'data_i', data_i)
                    if (dataType_i.typeDef != undefined && dataType_i.typeDef == 'Result<Null, SpRuntimeDispatchError>') {
                        // SpRuntimeDispatchError can potentially return "ok" - exclude this case
                        if (!Object.keys(data_i).includes('ok')) {
                            //error detected
                            res.success = 0
                            let dataErr = data_i.err
                            if (dataErr != undefined) {
                                //console.log('error detected 1!!', res)
                                if (dataErr.module != undefined) {
                                    //error module here
                                    res.err = this.getErrorDoc(dataErr.module, apiAt)
                                } else {
                                    res.err = `Failed(Generic) ${JSON.stringify(dataErr)}`
                                }
                            }
                        }
                    }
                    //need to handle evm error..
                    if (pallet_method == 'system:ExtrinsicFailed') {
                        if (data_i.module != undefined && !errorSet) {
                            errorSet = true
                            res.success = 0
                            res.err = this.getErrorDoc(data_i.module, apiAt)
                            //console.log('error detected 2!!', res)
                        } else if (!errorSet) {
                            res.success = 0
                            res.err = `Failed(Generic) ${JSON.stringify(data_i)}`
                        }
                    }
                }
            }
        }
        /*
        if (extrinsicSectionMethod == 'ethereum:transact'){
            let surplus = (depositFeeList.length > 0)? depositFeeList[0] : 0
            res.fee = withdrawFee - surplus
            //console.log(`[${extrinsicID}] ${extrinsicHash} EVM fee=${res.fee}, depositFeeList=${depositFeeList}`)
        }
        */
        if (isUnsignedHead) {
            res.fee = 0
            //res.fee = depositFeeList[depositFeeList.length - 1]
            //console.log(`[${extrinsicID}] ${extrinsicHash} potential XCM fee=${res.fee}, depositFeeList=${depositFeeList}`)
        }
        if (res.confidence == 1) {
            //USE transactionPayment:TransactionFeePaid if available
        } else if (withdrawFee == 0 && !isUnsignedHead) {
            // unusual extrinsic - (1) not paid by native token? (2) xcmPallet (3) partially paid?
            // use the highest fee computed
            res.fee = Math.max(withdrawFee, totalDepositFee, treasuryFee)
            if (isSigned && res.fee == 0) {
                // not sure if those are paid at all...
                //console.log(`unusual signed extrinsic [${extrinsicID}] ${extrinsicHash} - fee=${res.fee}, withdraw=${withdrawFee}, deposit=${totalDepositFee}, treasury=${treasuryFee}`)
            } else if (treasuryFee > 0) {
                // not sure if this case exist but will log and see what happens
                //console.log(`unusual unsined extrinsic [${extrinsicID}] ${extrinsicHash} - fee=${res.fee}, withdraw=${withdrawFee}, deposit=${totalDepositFee}, treasury=${treasuryFee}`)
            }
        }
        return res
    }

    async processRawFeedRewards(feed, rawFeedRewards, blockTS) {
        let feedRewards = []
        let era = false

        for (const rawFeedReward of rawFeedRewards) {
            if (rawFeedReward.section == "staking" && rawFeedReward.method == "PayoutStarted") {
                era = rawFeedReward.era
                continue
            } else if (rawFeedReward.section == "dappsStaking" && rawFeedReward.method == "Reward") {
                era = rawFeedReward.era
            }
            // skip the "zero" payout here
            if (rawFeedReward != undefined && rawFeedReward.value != undefined && rawFeedReward.value > 0) {
                let feedReward = await this.decorateFeedReward(feed, rawFeedReward, blockTS, era)
                feedRewards.push(feedReward)
                // console.log(feedReward)
            }
        }
        return feedRewards
    }

    async decorateFeedReward(feed, rawFeedReward, blockTS, era) {
        let feedReward = {}
        feedReward["chainID"] = this.chainID
        feedReward["blockNumber"] = feed.blockNumber
        feedReward["blockHash"] = feed.blockHash
        feedReward["ts"] = blockTS
        feedReward["eventID"] = rawFeedReward.eventID
        feedReward["extrinsicID"] = feed.extrinsicID
        feedReward["extrinsicHash"] = feed.extrinsicHash
        feedReward["section"] = rawFeedReward.section
        feedReward["method"] = rawFeedReward.method
        feedReward["account"] = rawFeedReward.account
        let accountAddress = paraTool.getPubKey(rawFeedReward.account)
        if (accountAddress) {
            feedReward["accountAddress"] = accountAddress
        }
        feedReward["amount"] = rawFeedReward.value
        if (era) {
            feedReward['era'] = era
        }
        let symbol = this.getChainSymbol(feed.chainID)
        let asset = `{"Token":"${symbol}"}`
        let decimals = this.getChainDecimal(feed.chainID)
        if (symbol && decimals !== false) {
            feedReward["rawAmount"] = feedReward["amount"];
            feedReward["amount"] = feedReward["amount"] / 10 ** decimals;
            let p = await this.computePriceUSD({
                val: feedReward["amount"],
                asset: asset,
                chainID: this.chainID,
                ts: blockTS
            })
            if (p) {
                feedReward["amountUSD"] = p.valUSD
                feedReward["priceUSD"] = p.priceUSD
            } else {
                feedReward["amountUSD"] = 0
                feedReward["priceUSD"] = 0
            }
            feedReward["asset"] = asset
            feedReward["symbol"] = symbol
            feedReward["decimals"] = decimals
        } else if (feedReward["amount"] != undefined) {
            feedReward["rawAmount"] = feedReward["amount"]
            feedReward["amount"] = null
            feedReward["asset"] = null
            feedReward["symbol"] = null
            feedReward["decimals"] = null
        }
        feedReward["genTS"] = this.currentTS();
        feedReward["source"] = this.hostname // add index source for debugging
        return feedReward
    }

    processRawFeedCrowdLoans(feed, rawFeedCrowdloans, blockTS, remarks) {
        let feedcrowdloans = []
        let feedcrowdloansMap = {}
        let era = false

        //let's assume crowdloan events come in pairs of Contributed+MemoUpdated or Contributed+remarks
        for (const rawFeedCrowdloan of rawFeedCrowdloans) {
            if (rawFeedCrowdloan.method == "Contributed") {
                let accountParaID = `${rawFeedCrowdloan.account}${rawFeedCrowdloan.paraID}`
                let crowdloanrec = this.decorateFeedCrowdLoan(feed, rawFeedCrowdloan, blockTS)
                if (feedcrowdloansMap[accountParaID] != undefined) {
                    delete crowdloanrec.remark
                    feedcrowdloansMap[accountParaID].amount = crowdloanrec.amount
                } else {
                    feedcrowdloansMap[accountParaID] = crowdloanrec
                }
            } else if (rawFeedCrowdloan.method == "MemoUpdated") {
                let accountParaID = `${rawFeedCrowdloan.account}${rawFeedCrowdloan.paraID}`
                let crowdloanrec = this.decorateFeedCrowdLoan(feed, rawFeedCrowdloan, blockTS)
                if (feedcrowdloansMap[accountParaID] != undefined) {
                    feedcrowdloansMap[accountParaID].memo = crowdloanrec.memo
                } else {
                    feedcrowdloansMap[accountParaID] = crowdloanrec
                }
            }
        }

        let remarkIndex = 0
        for (const accountParaID of Object.keys(feedcrowdloansMap)) {
            let feedcrowdloan = feedcrowdloansMap[accountParaID]
            if (feedcrowdloan.memo == null) {
                //maybe it's a remark contribution...
                if (remarks[remarkIndex] != undefined) {
                    feedcrowdloan.remark = remarks[remarkIndex]
                    remarkIndex++
                } else {
                    delete feedcrowdloan.remark
                }
                delete feedcrowdloan.memo
            }
            //console.log(feedcrowdloan)
            feedcrowdloans.push(feedcrowdloan)
        }
        return feedcrowdloans
    }

    decorateFeedCrowdLoan(feed, rawFeedCrowdloan, blockTS) {
        let feedcrowdloan = {}
        feedcrowdloan["chainID"] = this.chainID
        feedcrowdloan["blockNumber"] = feed.blockNumber
        feedcrowdloan["blockHash"] = feed.blockHash
        feedcrowdloan["ts"] = blockTS
        feedcrowdloan["eventID"] = rawFeedCrowdloan.eventID
        feedcrowdloan["extrinsicID"] = feed.extrinsicID
        feedcrowdloan["extrinsicHash"] = feed.extrinsicHash
        feedcrowdloan["section"] = rawFeedCrowdloan.section
        feedcrowdloan["method"] = rawFeedCrowdloan.method
        feedcrowdloan["account"] = rawFeedCrowdloan.account
        feedcrowdloan["paraID"] = rawFeedCrowdloan.paraID
        if (rawFeedCrowdloan.value) {
            feedcrowdloan["amount"] = rawFeedCrowdloan.value
            feedcrowdloan["memo"] = null
            feedcrowdloan["remark"] = null
        }
        if (rawFeedCrowdloan.memo) {
            feedcrowdloan["amount"] = 0
            feedcrowdloan["memo"] = rawFeedCrowdloan.memo
        }

        //feedReward["data"] = rawFeedReward
        feedcrowdloan["genTS"] = this.currentTS();
        feedcrowdloan["source"] = this.hostname // add index source for debugging
        return feedcrowdloan
    }

    process_reverse_evmlink(evmAddr) {
        // 0xb554B9856DFdbf52B98E0e4D2b981C34E20e1dAB -> 0xe37c9c4ba2e1409aecb4dcb992b3a1fac2b2585e2c759e25ab875b0fca8a10af (possible to derive h160SS58Pubkey using h160)
        // 0xe37c9c4ba2e1409aecb4dcb992b3a1fac2b2585e2c759e25ab875b0fca8a10af -> 0xb554B9856DFdbf52B98E0e4D2b981C34E20e1dAB (impossible to covert h160SS58Pubkey into h160)
        // if we observe 0xb554B9856DFdbf52B98E0e4D2b981C34E20e1dAB
        // want to establish related links for ss58Pubkey (af) -> owned H160 (AB)
        if (this.relatedMap[evmAddr] == undefined) {
            this.relatedMap[evmAddr] = true // write link only once
            let h160SS58Pubkey = paraTool.h160ToPubkey(evmAddr)
            let related = {}
            let metadata = {
                chainID: this.chainID,
                H160SS58Pubkey: h160SS58Pubkey,
                H160: evmAddr
            }
            related[evmAddr] = {
                value: JSON.stringify({
                    url: "/account/" + h160SS58Pubkey,
                    title: `${evmAddr}`,
                    description: `Reversed H160 Address`,
                    linktype: "address",
                    metadata: metadata
                }),
                timestamp: 1 * 1000000 // DO NOT update this
            }
            let reversedH160REec = {
                key: h160SS58Pubkey,
                data: {
                    related: related
                }
            }
            //console.log(`reserved link`, JSON.stringify(reversedH160REec))
            //this.hashesRowsToInsert.push(reversedH160REec)

        }
    }

    process_pending_extrinsic(api, extrinsicRaw, lastestBlockNumber) {
        //eventsRaw, block, index, not available
        let currTS = Math.floor(Date.now() / 1000)

        // must do extrinsicHash, isSigned here. information is lost after decode_s_extrinsic
        let extrinsicHash = extrinsicRaw.hash.toHex();
        if (this.pendingExtrinsic[extrinsicHash] !== undefined) return (false);
        this.pendingExtrinsic[extrinsicHash] = 1;

        let extrinsicID = `${extrinsicHash}-pending`
        let extrinsic = this.decode_s_extrinsic(extrinsicRaw, lastestBlockNumber, 'pending', api); //lastestBlockNumber is used to compute lifetime

        if (!extrinsic.method) {
            // TODO: onInitialize, onFinalize
            return (extrinsic);
        }
        let isSigned = this.isExtrinsicSigned(extrinsic)
        //console.log('hash!!', extrinsicHash, `isSigned=${isSigned}`, `${JSON.stringify(extrinsic.signature)}`, extrinsic.signature.signer)

        let success = false;
        let chainDecimal = this.getChainDecimal(this.chainID)
        if (isSigned) {
            extrinsic.signature.tip = extrinsic.signature.tip / 10 ** chainDecimal
        }
        if (!(extrinsic.signature)) {
            return (extrinsic);
        }

        //(ed25519 and sr25519 do not have id?)
        let signer = false
        if (extrinsic.signature.signer.id != undefined) {
            signer = extrinsic.signature.signer.id
        } else if (extrinsic.signature.signer != undefined) {
            signer = extrinsic.signature.signer
        }

        // fromAddress is pubkey representation common to ALL substrate chains
        //let fromAddress = isSigned ? paraTool.getPubKey(signer) : "NONE";
        let fromAddress = "NONE"
        try {
            fromAddress = isSigned ? paraTool.getPubKey(signer) : "NONE";
        } catch (e) {
            console.log("getPubKey error", e)
        }

        let params = extrinsic.args;

        let nonce = isSigned ? extrinsic.signature.nonce : 0 //non-signed extrinsic has by default 0 nonce

        let tip = isSigned ? extrinsic.signature.tip : 0 //non-signed extrinsic has by default 0 tip

        let txLifetime = (extrinsic.lifetime != undefined) ? extrinsic.lifetime : false


        extrinsic.extrinsicHash = isSigned ? extrinsicHash : extrinsicHash; //todo: should unsigned extrinsic have extrinsicHash?
        extrinsic.extrinsicID = extrinsicID
        extrinsic.fromAddress = fromAddress; // this is the pubkey

        let sigs = extrinsic.signature
        //sigs.fee = extrinsic.fee (fee can't be computed)

        let rExtrinsic = {
            chainID: this.chainID,
            ts: currTS,
            extrinsicHash: extrinsicHash,
            extrinsicID: extrinsicID,
            //fromAddress: isSigned ? fromAddress : null,
            signer: isSigned ? signer : null,
            signature: isSigned ? extrinsic.signature.signature : null,
            lifetime: txLifetime,
            nonce: nonce,
            tip: tip,
            callIndex: extrinsic.method.callIndex,
            section: extrinsic.method.pallet,
            method: extrinsic.method.method, //replacing the original method object format
            params: extrinsic.args,
            paramsDef: extrinsic.argsDef,
        }
        //console.log(`pending rExtrinsic`, rExtrinsic)
        try {

            // feed is used for {feed, feedTransfer, feedRewards}
            var feed = {};
            feed = rExtrinsic
            feed["txstatus"] = 'pending'
            feed["genTS"] = this.currentTS();
            feed["source"] = this.hostname

            /*
            if (this.validAddress(fromAddress)) {
                // (4) txn (can be processed immediately)
                this.stat.addressRows.feed++
                this.updateAddressExtrinsicStorage(fromAddress, extrinsicID, extrinsicHash, "feed", feed, blockTS, "PENDING");
            }
            */
            // (1) hashesRowsToInsert: extrinsicHash -> tx
            let hashrec = {};
            hashrec["tx"] = {
                value: JSON.stringify(feed),
                timestamp: 0 //this is nondeterministic
            };
            this.stat.hashesRows.substrateTx++
            let extrinsicHashRec = {
                key: extrinsicHash,
                data: {}, //feed/feedunfinalized
            }
            extrinsicHashRec.data["feedpending"] = hashrec
            this.hashesRowsToInsert.push(extrinsicHashRec)

            //console.log(`processed pendingTX ${extrinsicHash} (signer:${signer}, nonce:${nonce})`)
            //console.log(feed)
        } catch (err) {
            this.log_indexing_error(err, "process_pending_extrinsic")
        }

        return (rExtrinsic);
    }

    //support both formats
    parseEventSectionMethod(e) {
        if (e.method != undefined && e.method.pallet != undefined) {
            return [e.method.pallet, e.method.method]
        } else {
            return [e.section, e.method]
        }
    }

    //support both formats
    parseExtrinsicSectionMethod(e) {
        if (e.method != undefined && e.method.pallet != undefined) {
            return [e.method.pallet, e.method.method]
        } else {
            return [e.section, e.method]
        }
    }

    map_feedTransfers_to_transfers(feedTransfers) {
        let transfers = [];
        let covered = {}
        for (const f of feedTransfers) {
            let k = `${f.extrinsicHash}-${f.fromAddress}-${f.toAddress}-${f.rawAmount}` // it's nearly impossible to have collision even dropping the asset
            //let k = `${f.fromAddress}-${f.toAddress}-${f.rawAmount}-${f.asset}`
            if (covered[k] == undefined) { // PROBLEM: no preference between redundant events
                covered[k] = 1;
                // copy key pieces of feedTransfer into transfer (skipping: chainID/extrinsicID/extrinsicHash/...)
                let t = {
                    eventID: f.eventID,
                    section: f.section,
                    method: f.method,
                    from: f.from,
                    to: f.to,
                    fromAddress: f.fromAddress,
                    toAddress: f.toAddress,
                    amount: f.amount,
                    rawAmount: f.rawAmount,
                    asset: f.asset,
                    //symbol: f.symbol,
                    //decimals: f.decimals
                }
                if (f.priceUSD > 0) t.priceUSD = f.priceUSD;
                if (f.amountUSD > 0) t.amountUSD = f.amountUSD;
                if (f.rawAsset != undefined) t.rawAsset = f.rawAsset;
                if (f.symbol != undefined) t.symbol = f.symbol;
                if (f.decimals != undefined) t.decimals = f.decimals;
                transfers.push(t);
            }
        }
        return transfers;
    }

    map_feedRewards_to_rewards(feedRewards) {
        let rewards = [];
        for (const f of feedRewards) {
            let t = {
                eventID: f.eventID,
                section: f.section,
                method: f.method,
                account: f.account,
                accountAddress: f.accountAddress,
                amount: f.amount,
                rawAmount: f.rawAmount,
                asset: f.asset
            }
            if (f.priceUSD > 0) t.priceUSD = f.priceUSD;
            if (f.amountUSD > 0) t.amountUSD = f.amountUSD;
            if (f.rawAsset != undefined) t.rawAsset = f.rawAsset;
            if (f.symbol != undefined) t.symbol = f.symbol;
            if (f.decimals != undefined) t.decimals = f.decimals;
            rewards.push(t);
        }
        return rewards;
    }

    // we wait until the end of the block to do the call -- these are only for accounts on the tip if traces are not available
    flagAddressBalanceRequest(address, reaped = false) {
        this.addressBalanceRequest[address] = {
            blockNumber: this.chainParser.parserBlockNumber,
            blockTS: this.chainParser.parserTS,
            blockHash: this.chainParser.parserBlockHash,
            reaped: reaped
        };
        // console.log("flagAddressBalanceRequest", address, this.chainParser.parserBlockNumber, this.chainParser.parserTS, this.chainParser.parserBlockHash, reaped);
    }

    async dump_addressBalanceRequest() {
        // queue requests in address${chainID} so streaming process can work through requests
        let addresses = Object.keys(this.addressBalanceRequest);
        if (addresses.length == 0) return;

        let rows = [];
        for (const address of addresses) {
            let r = this.addressBalanceRequest[address];
            if (r == undefined) continue;
            let free_balance = 0;
            let reserved_balance = 0;
            let miscFrozen_balance = 0;
            let feeFrozen_balance = 0;
            try {
                let query = await this.api.query.system.account(address);
                let balance = query.data;
                let decimals = this.getChainDecimal(this.chainID)
                if (balance.free) free_balance = parseInt(balance.free.toString(), 10) / 10 ** decimals;
                if (balance.reserved) reserved_balance = balance.reserved.toString() / 10 ** decimals;
                if (balance.miscFrozen) miscFrozen_balance = balance.miscFrozen.toString() / 10 ** decimals;
                if (balance.feeFrozen) feeFrozen_balance = balance.feeFrozen.toString() / 10 ** decimals;
            } catch (err) {
                this.logger.error({
                    "op": "dump_addressBalanceRequest",
                    "chainID": this.chainID,
                    "address": address,
                    err
                })
            }


            let asset = this.getChainAsset(this.chainID);
            let assetChain = paraTool.makeAssetChain(asset, this.chainID);
            let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
            let rec = {};
            let newState = {
                free: free_balance,
                reserved: reserved_balance,
                miscFrozen: miscFrozen_balance,
                feeFrozen: feeFrozen_balance,
                frozen: feeFrozen_balance,
                ts: r.blockTS,
                bn: r.blockNumber,
                source: this.hostname,
                genTS: this.currentTS()
            };
            rec[encodedAssetChain] = {
                value: JSON.stringify(newState),
                timestamp: r.blockTS * 1000000
            }

            /*          this.logger.info({
                            "op": "dump_addressBalanceRequest upd",
                            "chainID": this.chainID,
                            "address": address,
                            "asset": asset,
                            "assetChain": assetChain,
                            "encodedAssetChain": encodedAssetChain,
                            "newState": newState,
                            "upd": str
                        }) */
            let rowKey = address.toLowerCase()
            rows.push({
                key: rowKey,
                data: {
                    realtime: rec
                }
            });
        }

        let [tblName, tblRealtime] = this.get_btTableRealtime()
        await this.insertBTRows(tblRealtime, rows, tblName);
        rows = [];
        // TODO OPTIMIZATION: also write placeholder in "accountrealtime" (in "request" column family) which can mark the need to do work on the client (ie when traces are not available)
        this.addressBalanceRequest = {}
    }

    async process_extrinsic(api, extrinsicRaw, eventsRaw, block, index, finalized = false, isTip = false, tracesPresent = false) {
        let blockNumber = block.header.number;
        let blockHash = block.hash;
        let blockTS = block.blockTS;
        let extrinsicID = blockNumber + "-" + index;
        // must do extrinsicHash, isSigned here. information is lost after decode_s_extrinsic
        let extrinsicHash = extrinsicRaw.hash.toHex();
        if (this.pendingExtrinsic[extrinsicHash] !== undefined && finalized) {
            // console.log("deleting finalized extrinsic from pending list", extrinsicHash);
            delete this.pendingExtrinsic[extrinsicHash];
        }

        let extrinsic = this.decode_s_extrinsic(extrinsicRaw, blockNumber, index, api);
        if (!extrinsic.method) {
            // TODO: onInitialize, onFinalize
            return (extrinsic);
        }
        let isSigned = this.isExtrinsicSigned(extrinsic)


        let success = false;
        extrinsic.events = eventsRaw

        //(ed25519 and sr25519 do not have id?)
        let signer = false
        if (extrinsic.signature.signer.id != undefined) {
            signer = extrinsic.signature.signer.id
        } else if (extrinsic.signature.signer != undefined) {
            signer = extrinsic.signature.signer
        }

        let res = this.checkExtrinsicStatusAndFee(api, extrinsic, extrinsicHash, extrinsicID, isSigned, signer)
        //console.log(`***extrinsicHash=${extrinsicHash}, extrinsicID=${extrinsicID}, res`, res)
        let chainDecimal = this.getChainDecimal(this.chainID)
        if (isSigned) {
            extrinsic.signature.tip = extrinsic.signature.tip / 10 ** chainDecimal
        }
        let evmTxStatus = false
        if (res.isEVM) {
            evmTxStatus = res.isEVM
            let evmTxHash = evmTxStatus.transactionHash
            // add extrinsicEvmMap here to link evmTX <=> substrateTX
            this.extrinsicEvmMap[evmTxHash] = {
                extrinsicID: extrinsicID,
                extrinsicHash: extrinsicHash,
                evmTxFee: null,
            }
        }

        extrinsic.fee = res.fee / 10 ** chainDecimal
        extrinsic.success = res.success
        if (extrinsic.success == 0) {
            extrinsic.err = res.err
            //console.log(`failedTX [${extrinsicID}] ${extrinsicHash}`, JSON.stringify(res))
            //console.log(JSON.stringify(extrinsic))
        }
        if (!(extrinsic.signature)) {
            return (extrinsic);
        }

        // fromAddress is pubkey representation common to ALL substrate chains
        //let fromAddress = isSigned ? paraTool.getPubKey(signer) : "NONE";
        let fromAddress = "NONE"
        try {
            fromAddress = isSigned ? paraTool.getPubKey(signer) : "NONE";
        } catch (e) {
            console.log("getPubKey error", e)
        }

        let params = extrinsic.args;

        let nonce = isSigned ? extrinsic.signature.nonce : 0 //non-signed extrinsic has by default 0 nonce

        let tip = isSigned ? extrinsic.signature.tip : 0 //non-signed extrinsic has by default 0 tip
        let txFee = extrinsic.fee
        let txResult = extrinsic.success
        let txErr = (extrinsic.success == 0) ? extrinsic.err : ''

        let txLifetime = (extrinsic.lifetime != undefined) ? extrinsic.lifetime : false

        let sigs = extrinsic.signature
        sigs.fee = extrinsic.fee
        let result = {
            success: res.success,
            err: res.err
        }

        // "rExtrinsic" cleaned output - same output should be used for storing block-extrinsics + feed, and any additional processing (processExtrinsicEvents/processXCMTransfer)
        let [exSection, exMethod] = this.parseExtrinsicSectionMethod(extrinsic)
        let rExtrinsic = {
            chainID: this.chainID,
            ts: blockTS,
            blockHash: blockHash,
            blockNumber: blockNumber,
            extrinsicID: extrinsicID,
            extrinsicHash: extrinsicHash,
            evm: null,
            signer: isSigned ? signer : null,
            signature: isSigned ? extrinsic.signature.signature : null,
            lifetime: txLifetime,
            nonce: nonce,
            tip: tip,
            fee: txFee,
            result: txResult,
            err: null,
            callIndex: extrinsic.method.callIndex,
            section: exSection,
            method: exMethod,
            params: extrinsic.args,
            paramsDef: extrinsic.argsDef,
            events: extrinsic.events,
        }
        //console.log(`pending rExtrinsic`, rExtrinsic)
        if (evmTxStatus) {
            rExtrinsic.evm = evmTxStatus;
        } else {
            delete rExtrinsic.evm;
        }
        if (txResult) {
            delete rExtrinsic.err;
        } else {
            rExtrinsic.err = txErr
        }

        if (!paraTool.auditHashesTx(rExtrinsic)) {
            console.log(`Failed Audit!!`, rExtrinsic)
        }

        if (!isSigned) {
            let xcmCandidates = this.chainParser.processIncomingXCM(this, rExtrinsic, extrinsicID, eventsRaw, isTip, finalized);
            for (const c of xcmCandidates) {
                console.log(`** Indexer caller=${c.caller}, candidate`, c.candidate)
                this.updateXCMTransferDestCandidate(c.candidate, c.caller, isTip, finalized)
            }
        }
        //console.log('hash!!', extrinsicHash, `isSigned=${isSigned}`, `${JSON.stringify(extrinsic.signature)}`, extrinsic.signature.signer)

        //extrinsic.fromAddress = fromAddress; // this is the pubkey
        try {

            // feed is used for {feed, feedTransfer, feedRewards}
            var feed = {};
            feed = rExtrinsic
            //!!! MK: write encodedCalls here!!
            feed.encodedCalls = extrinsic.encodedCalls
            feed["genTS"] = this.currentTS();
            feed["source"] = this.hostname // add index source for debugging

            this.chainParser.processExtrinsicEvents(this, rExtrinsic.section, rExtrinsic.method, rExtrinsic.events);

            let isSuccess = (rExtrinsic.err == undefined) ? true : false //skip feedtransfer/feedxcm/feedreward/feedcrowdloan processing if is failure case

            //!! failure-pending are going through with isSuccess check
            if (isSuccess || true) {
                /* process feedtransfer:
                feedtransfer keeps a list of incoming transfers
                for outgoing transfer, we set isIncoming to 0 and addresss as senderAddress
                */
                let feedTransfers = await this.processFeedTransfer(feed, blockTS)
                let valueExtrinsicUSD = 0;
                for (const feedTransfer of feedTransfers) {
                    if (fromAddress != "NONE" && feedTransfer["fromAddress"] != undefined && feedTransfer["amountUSD"] != undefined) {
                        if (fromAddress == feedTransfer["fromAddress"]) {
                            let amountUSD = feedTransfer["amountUSD"];
                            if (amountUSD > valueExtrinsicUSD) {
                                valueExtrinsicUSD = amountUSD;
                            }
                        }
                    }

                    // incoming transfers (recipient)
                    let receiptAddress = paraTool.getPubKey(feedTransfer.to)
                    this.stat.addressRows.feedtransfer++
                    this.updateAddressExtrinsicStorage(receiptAddress, extrinsicID, extrinsicHash, "feedtransfer", feedTransfer, blockTS, block.finalized);

                    // outgoing transfers (sender)
                    let senderAddress = paraTool.getPubKey(feedTransfer.from)
                    let outgoingFeedTransfer = feedTransfer
                    outgoingFeedTransfer.isIncoming = 0

                    this.stat.addressRows.feedtransfer++
                    this.updateAddressExtrinsicStorage(senderAddress, extrinsicID, extrinsicHash, "feedtransfer", outgoingFeedTransfer, blockTS, block.finalized);
                }

                if (valueExtrinsicUSD > 0) {
                    feed["v"] = valueExtrinsicUSD;
                }
                if (feedTransfers.length > 0) {
                    feed["transfers"] = this.map_feedTransfers_to_transfers(feedTransfers);
                }

                //TODO: add shibuya testnet later
                if (this.chainID == paraTool.chainIDAstar || this.chainID == paraTool.chainIDShiden || this.chainID == paraTool.chainIDShibuya) {
                    this.chainParser.processWasmContracts(this, rExtrinsic, feed, fromAddress, false, false, false);
                }

                //check the "missed" xcm case - see if it contains xTokens event not triggered by pallet
                this.chainParser.processOutgoingXCMFromXTokensEvent(this, rExtrinsic, feed, fromAddress, false, false, false);
                if (rExtrinsic.xcms == undefined) {
                    // process xcmtransfer extrinsic params
                    this.chainParser.processOutgoingXCM(this, rExtrinsic, feed, fromAddress, false, false, false); // we will temporarily keep xcms at rExtrinsic.xcms and remove it afterwards
                } else if (rExtrinsic.xcms != undefined && Array.isArray(rExtrinsic.xcms)) {
                    // check if fallback is required
                    let fallbackRequired = false
                    for (const xcm of rExtrinsic.xcms) {
                        if (xcm.destAddress == undefined || xcm.destAddress == false) {
                            if (xcm.msgHash != undefined) {
                                let beneficiary = this.getBeneficiaryFromMsgHash(xcm.msgHash)
                                if (beneficiary) {
                                    xcm.destAddress = beneficiary
                                    console.log(`patch destAddress using beneficiary [${rExtrinsic.extrinsicID}] [${rExtrinsic.extrinsicHash}] B=${beneficiary}`)
                                } else {
                                    fallbackRequired = true
                                }
                            } else if (xcm.innerCall != undefined) {
                                // lookup msgHash using innerCall -- it shouldn't be empty?
                                let msgHashCandidate = this.getMsgHashCandidate(xcmtransfer.blockNumber, finalized, isTip, xcm.innerCall, rExtrinsic.extrinsicID, rExtrinsic.extrinsicHash, 'innercall', true)
                                if (msgHashCandidate) xcmtransfer.msgHash = msgHashCandidate
                                //accept the fact that this xcm doesn not have destAddress
                            } else {
                                console.log(`fallback Required [${rExtrinsic.extrinsicID}] [${rExtrinsic.extrinsicHash}] [${xcm.xcmIndex}-${xcm.transferIndex}]`)
                                fallbackRequired = true
                            }
                        }
                    }
                    //destAddress is missing from events
                    if (fallbackRequired) {
                        let cachedXcms = rExtrinsic.xcms // via events
                        delete rExtrinsic.xcms
                        delete rExtrinsic.xcmIndex
                        this.chainParser.processOutgoingXCM(this, rExtrinsic, feed, fromAddress, false, false, false); // we will temporarily keep xcms at rExtrinsic.xcms and remove it afterwards
                        let cachedXcms2 = rExtrinsic.xcms // via args
                        if (cachedXcms2 != undefined && Array.isArray(cachedXcms2) && cachedXcms2.length > 0 && cachedXcms2.length == cachedXcms.length) {
                            for (let i = 0; i < cachedXcms2.length; i++) {
                                let cachedXcm2 = cachedXcms2[i]
                                if (cachedXcm2.destAddress) {
                                    cachedXcms[i].destAddress = cachedXcm2.destAddress
                                }
                            }
                            rExtrinsic.xcms = cachedXcms
                        }
                    }
                }
                if (rExtrinsic.xcmIndex != undefined) {
                    delete rExtrinsic.xcmIndex
                }

                if (rExtrinsic.xcms != undefined && Array.isArray(rExtrinsic.xcms) && rExtrinsic.xcms.length > 0) {
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`[${rExtrinsic.extrinsicID}] [${rExtrinsic.section}:${rExtrinsic.method}] xcmCnt=${rExtrinsic.xcms.length}`, rExtrinsic.xcms)
                    if (this.debugLevel >= paraTool.debugInfo && !finalized) console.log(`safeXcmTip [${rExtrinsic.extrinsicID}] [${rExtrinsic.section}:${rExtrinsic.method}] xcmCnt=${rExtrinsic.xcms.length}`)
                    for (const xcmtransfer of rExtrinsic.xcms) {
                        xcmtransfer.isMsgSent = (xcmtransfer.incomplete == 0) ? 1 : 0
                        xcmtransfer.finalized = finalized
                        // look up msgHash
                        if (xcmtransfer.msgHash == undefined || xcmtransfer.msgHash.length != 66) {
                            let msgHashCandidate;
                            if (xcmtransfer.innerCall != undefined) {
                                msgHashCandidate = this.getMsgHashCandidate(xcmtransfer.blockNumber, finalized, isTip, xcmtransfer.innerCall, rExtrinsic.extrinsicID, rExtrinsic.extrinsicHash, 'innercall', true)
                            } else {
                                msgHashCandidate = this.getMsgHashCandidate(xcmtransfer.blockNumber, finalized, isTip, xcmtransfer.destAddress, rExtrinsic.extrinsicID, rExtrinsic.extrinsicHash, 'address', true)
                            }
                            if (msgHashCandidate) xcmtransfer.msgHash = msgHashCandidate
                            if (msgHashCandidate) rExtrinsic.msgHash = msgHashCandidate
                        }
                        // signed Extrinsic are guranteed to be consistent, regardless of proposer
                        // unsigned Extrinsic is NOT guranteed to bo consistent, therefore we shouldn't write it unless it's finalized
                        // isXcmTipSafe = true means extrinsic must be signed -- which is also made "stable" when finalized=true, which covers both EVM + Substrate
                        let isXcmTipSafe = (isSigned || finalized) ? true : false
                        if (isXcmTipSafe) {
                            // we can only write to addressextrinsic if isXcmTipSafe
                            this.stat.addressRows.xcmsend++;
                            this.updateAddressExtrinsicStorage(fromAddress, extrinsicID, extrinsicHash, "feedxcm", xcmtransfer, blockTS, block.finalized);
                        }
                        // build XCMInfo here
                        xcmtransfer.xcmInfo = await this.buildPendingXcmInfo(xcmtransfer, rExtrinsic, finalized)

                        await this.updateXCMTransferStorage(xcmtransfer, isTip, finalized, isXcmTipSafe, isSigned, exSection, exMethod); // store, flushed in flushXCM
                    }
                    delete rExtrinsic.xcms
                }

                if (block.finalized) {
                    // filter events into proxyEvents, rewardEvents, crowdloanEvents, reapingEvents, multisigEvents
                    let proxyEvents = [];
                    let rewardEvents = [];
                    let crowdloanEvents = [];
                    let reapingEvents = [];
                    extrinsic.events.forEach((ev) => {
                        let palletMethod = `${ev.section}(${ev.method})`
                        if (this.chainParser.proxyFilter(palletMethod)) {
                            proxyEvents.push(ev);
                        } else if (this.chainParser.rewardFilter(palletMethod)) {
                            rewardEvents.push(ev);
                        } else if (this.chainParser.crowdloanFilter(palletMethod)) {
                            crowdloanEvents.push(ev);
                        } else if (isTip && tracesPresent && this.chainParser.reapingFilter(palletMethod)) {
                            reapingEvents.push(ev);
                        }
                    })

                    // (a) process proxyEvents
                    if (proxyEvents.length > 0) {
                        let rawProxies = proxyEvents.map((pe) => {
                            return this.chainParser.prepareFeedProxy(this, pe.section, pe.method, pe.data, pe.eventID);
                        })
                        // step 3 - set proxyEvent if any turn up
                        for (const rawProxyRec of rawProxies) {
                            // mostly likely it's array of 1 element
                            if (rawProxyRec) {
                                this.updateProxyMap(rawProxyRec)
                            }
                        }
                    }

                    // (b) process rewardEvents into feedrewards
                    if (rewardEvents.length > 0) {
                        let rawFeedRewards = rewardEvents.map((re) => {
                            return this.chainParser.prepareFeedReward(this, re.section, re.method, re.data, re.eventID);
                        })
                        // decorate RawFeedReward using the "feed" we build
                        let feedRewards = await this.processRawFeedRewards(feed, rawFeedRewards, blockTS)
                        //console.log(`feedRewards`, feedRewards)
                        for (const feedreward of feedRewards) {
                            // TODO: can a same address get touched twice with an extrinsic?
                            // claim: it's possible but super rare
                            let toAddress = paraTool.getPubKey(feedreward.account)
                            // (3) acct:feedreward -> recFeedreward (can be processed immediately)
                            this.stat.addressRows.feedreward++
                            this.updateAddressExtrinsicStorage(toAddress, extrinsicID, extrinsicHash, "feedreward", feedreward, blockTS, block.finalized);
                        }
                        if (feedRewards.length > 0) {
                            feed["rewards"] = this.map_feedRewards_to_rewards(feedRewards);
                        }
                    }

                    // (c) process crowdloanEvents into feedcrowdloan
                    if (crowdloanEvents.length > 0) {
                        let rawFeedCrowdloans = crowdloanEvents.map((ce) => {
                            return this.chainParser.prepareFeedcrowdloan(this, ce.section, ce.method, ce.data, ce.eventID);
                        })

                        let feedCrowdLoans = this.processRawFeedCrowdLoans(feed, rawFeedCrowdloans, blockTS, extrinsic.remarks)
                        for (const feedcrowdloan of feedCrowdLoans) {
                            // TODO: can a same address get touched twice with an extrinsic?
                            // claim: it's possible but super rare
                            let toAddress = paraTool.getPubKey(feedcrowdloan.account)
                            //TODO:should the key include event index?
                            // (3) acct:feedcrowdloan -> recFeedcrowdloan (can be processed immediately)
                            this.stat.addressRows.feedcrowdloan++
                            //console.log(`${toAddress} feedcrowdloan`, feedcrowdloan)
                            this.updateAddressExtrinsicStorage(toAddress, extrinsicID, extrinsicHash, "feedcrowdloan", feedcrowdloan, blockTS, block.finalized);
                            this.updateCrowdloanStorage(feedcrowdloan);
                        }
                    }

                    // process reapingEvents
                    if (reapingEvents.length > 0) {
                        reapingEvents.forEach((ev) => {
                            // from the event, get the pubkey of the account being reaped and flag it for a balance query
                            let palletMethod = `${ev.section}(${ev.method})`
                            let accountIDIdx = 0;
                            if (palletMethod == "balances(DustLost)" || palletMethod == "system(KilledAccount)") {
                                accountIDIdx = 0
                                //} else if (palletMethod == "tokens(DustLost)") {
                                //   accountIDIdx = 1
                            }
                            let accountID = ev.data[accountIDIdx]
                            let reapedAddress = paraTool.getPubKey(accountID)
                            if (reapedAddress) {
                                this.flagAddressBalanceRequest(reapedAddress, true);
                            }
                        })
                    }

                    // if this is a multisig extrinsic, update map
                    let multisigRec = this.chainParser.processMultisig(this, rExtrinsic, feed, fromAddress);
                    if (multisigRec) {
                        this.updateMultisigMap(multisigRec)
                    }
                }
            }

            if (this.validAddress(fromAddress)) {
                // (4) txn (can be processed immediately)
                this.stat.addressRows.feed++
                this.updateAddressExtrinsicStorage(fromAddress, extrinsicID, extrinsicHash, "feed", feed, blockTS, block.finalized);
            }
            // (1) hashesRowsToInsert: extrinsicHash -> tx
            let hashrec = {};
            hashrec["tx"] = { // TODO: consider storing blockNumber-index instead of "tx" to support edge case of account reaping
                value: JSON.stringify(feed),
                timestamp: blockTS * 1000000
            };
            this.stat.hashesRows.substrateTx++
            let extrinsicHashRec = {
                key: extrinsicHash,
                data: {}, //feed/feedunfinalized
            }
            if (block.finalized) {
                extrinsicHashRec.data["feed"] = hashrec
            } else {
                extrinsicHashRec.data["feedunfinalized"] = hashrec
            }
            if (this.skip_hashes_write(isSigned, extrinsicID, exSection, exMethod)) {
                // skip writing big extrinsics to hashes table since no one searches for them
            } else {
                this.hashesRowsToInsert.push(extrinsicHashRec)
            }
        } catch (err) {
            this.log_indexing_error(err, "processBlock")
        }

        return (rExtrinsic);
    }
    skip_hashes_write(isSigned, extrinsicID, exSection, exMethod) {
        if (isSigned) return (false);
        if (!(extrinsicID.includes("-1") || extrinsicID.includes("-0"))) return (false);
        if (exSection == "paraInherent" && exMethod == "enter") return (true);
        if (exSection == "parachainSystem" && exMethod == "setValidationData") return (true);
        if (exSection == "timestamp" && exMethod == "set") return (true);
        return (false);
    }

    async buildPendingXcmInfo(xcmtransfer, extrinsic, originationFinalized) {
        let x = xcmtransfer // need deep clone?
        //build systhetic xcmInfo here when xcmInfo is not set yet
        if (this.debugLevel >= paraTool.debugTracing) console.log(`buildPendingXcmInfo xcmtransfer`, x)
        //if (this.debugLevel >= paraTool.debugTracing) console.log(`buildPendingXcmInfo extrinsic`, extrinsic)
        let xcmInteriorKey = null
        let xcmInteriorKeyV2 = null
        let xcmInteriorKeyUnregistered = null
        let xcmIndex = x.xcmIndex
        let transferIndex = x.transferIndex
        if (x.xcmInteriorKey != undefined) {
            xcmInteriorKey = x.xcmInteriorKey
            xcmInteriorKeyV2 = paraTool.convertXcmInteriorKeyV1toV2(xcmInteriorKey)
            xcmInteriorKeyUnregistered = (this.isXcmInteriorKeyRegistered(xcmInteriorKey)) ? 0 : 1
        }

        try {
            let sectionPieces = x.sectionMethod.split(':')
            let xSection = null,
                xMethod = null;
            if (sectionPieces.length == 2) {
                xSection = sectionPieces[0];
                xMethod = sectionPieces[1];
            }
            let evmTransactionHash = null
            if (extrinsic.evm != undefined && extrinsic.evm.transactionHash != undefined) {
                evmTransactionHash = extrinsic.evm.transactionHash
            }

            // looks up assetInfo
            let symbolRelayChain = paraTool.makeAssetChain(x.xcmSymbol, x.relayChain);
            let sourceTxFee = (extrinsic.fee != undefined && extrinsic.fee > 0) ? extrinsic.fee : null //can't do evm fee for now
            console.log(`evmTransactionHash`, evmTransactionHash)
            if (evmTransactionHash != undefined && sourceTxFee == undefined) {
                //TODO: need to extend indexer as query in order to support evmtx lookup
                /*
                let evmTx = await this.getTransaction(evmTransactionHash)
                if (evmTx.fee != undefined) sourceTxFee = evmTx.txFee
                */
            }
            let sourceTxFeeUSD = null
            let sourceChainSymbol = this.getChainSymbol(x.chainID)
            if (sourceTxFee != undefined) {
                let inp = {
                    val: sourceTxFee,
                    symbol: sourceChainSymbol,
                    relayChain: x.relayChain,
                    ts: x.sourceTS
                }
                let p = await this.computePriceUSD(inp);
                //if (this.debugLevel >= paraTool.debugTracing) console.log(`computePriceUSD fee`, p)
                if (p) {
                    sourceTxFeeUSD = p.valUSD;
                }
            }

            let assetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain);
            //console.log(`symbolRelayChain=${symbolRelayChain}`, assetInfo)
            let amountSent = x.amountSent
            if (assetInfo) {
                x.decimals = assetInfo.decimals;
                amountSent = x.amountSent / 10 ** x.decimals;
                x.priceUSD = null;
                x.amountSentUSD = null;
                let inp = {
                    val: amountSent,
                    symbol: x.xcmSymbol,
                    relayChain: x.relayChain,
                    ts: x.sourceTS
                }

                let p = await this.computePriceUSD(inp);
                if (p) {
                    x.amountSentUSD = p.valUSD;
                    x.priceUSD = p.priceUSD;
                }
                x.symbol = assetInfo.symbol;
            } else {
                console.log(`[${x.extrinsicHash}] [${x.extrinsicID}] ${symbolRelayChain} MISSING x.asset`, x.asset, x.chainID);
            }

            if (x.chainID != undefined) {
                let [_, id] = this.convertChainID(x.chainID)
                //[x.chainIDDest, x.idDest] = this.convertChainID(x.chainIDDest)
                x.id = (id == false) ? null : id
                x.chainName = this.getChainName(x.chainID);
                x.paraID = paraTool.getParaIDfromChainID(x.chainID)
                let chainIDOriginationInfo = this.chainInfos[x.chainID]
                if (chainIDOriginationInfo != undefined && chainIDOriginationInfo.ss58Format != undefined) {
                    if (x.fromAddress != undefined) {
                        if (x.fromAddress.length == 42) x.sender = x.fromAddress
                        if (x.fromAddress.length == 66) x.sender = paraTool.getAddress(x.fromAddress, chainIDOriginationInfo.ss58Format)
                    }
                }
            }
            if (x.chainIDDest != undefined) {
                let [_, idDest] = this.convertChainID(x.chainIDDest)
                //[x.chainIDDest, x.idDest] = this.convertChainID(x.chainIDDest)
                x.idDest = (idDest == false) ? null : idDest
                x.chainDestName = this.getChainName(x.chainIDDest);
                x.paraIDDest = paraTool.getParaIDfromChainID(x.chainIDDest)
                let chainIDDestInfo = this.chainInfos[x.chainIDDest]
                if (chainIDDestInfo != undefined && chainIDDestInfo.ss58Format != undefined) {
                    if (x.destAddress != undefined) {
                        if (x.destAddress.length == 42) x.beneficiary = x.destAddress
                        if (x.destAddress.length == 66) x.beneficiary = paraTool.getAddress(x.destAddress, chainIDDestInfo.ss58Format)
                    }
                }
            }

            //(xcmtransfer.destStatus = 0 and xcmtransfer.incomplete = 0) or xcmtransfer.incomplete = 1)
            let failureType = null
            let isMsgSent = true
            //if (x.destStatus == 0 && x.incomplete == 0) failureType = 'failedDestination'
            if (x.incomplete == 1 || x.isMsgSent == 0) {
                failureType = 'failedOrigination'
                isMsgSent = false
            }
            let timeDiff = this.currentTS() - x.sourceTS
            let isExpectedFinalized = (timeDiff > 300) ? true : false
            let xcmInfo = {
                symbol: x.symbol,
                xcmInteriorKey: xcmInteriorKeyV2,
                xcmInteriorKeyUnregistered: xcmInteriorKeyUnregistered,
                priceUSD: (x.priceUSD != undefined) ? x.priceUSD : null,
                relayChain: null,
                origination: null,
                destination: null,
                //xcmFinalized: isExpectedFinalized, //this is technically unknown by simply looking origination. we will mark old xcmInfo to finalized for now
                version: 'V4',
            }
            xcmInfo.relayChain = {
                relayChain: this.relayChain,
                relayAt: (failureType == 'failedOrigination') ? null : x.sentAt, //?
            }

            let txHash = evmTransactionHash ? evmTransactionHash : x.extrinsicHash;
            let xcmtransferkey = `${txHash}${x.xcmIndex}${x.transferIndex}`
            xcmtransfer.xcmtransferHash = paraTool.twox_128(xcmtransferkey);
            xcmInfo.origination = {
                // transferindex + xcmindex should be here?
                chainName: x.chainName,
                id: x.id,
                chainID: x.chainID,
                paraID: x.paraID,
                sender: x.sender,
                amountSent: (failureType == 'failedOrigination') ? 0 : amountSent,
                amountSentUSD: (failureType == 'failedOrigination') ? 0 : x.amountSentUSD,
                xcmtransferHash: xcmtransfer.xcmtransferHash,
                initiateTS: this.getCurrentTS(),
                txFee: sourceTxFee,
                txFeeUSD: sourceTxFeeUSD,
                txFeeSymbol: sourceChainSymbol,
                blockNumber: x.blockNumber,
                section: xSection,
                method: xMethod,
                extrinsicID: x.extrinsicID,
                extrinsicHash: x.extrinsicHash,
                transactionHash: evmTransactionHash,
                msgHash: x.msgHash,
                sentAt: x.sentAt,
                ts: x.sourceTS,
                decimals: x.decimals,
                isMsgSent: isMsgSent,
                finalized: originationFinalized,
                isFeeItem: x.isFeeItem,
                xcmIndex: xcmIndex,
                transferIndex: transferIndex,
            }
            if (evmTransactionHash == undefined) delete xcmInfo.origination.transactionHash;
            if (failureType != undefined) {
                xcmInfo.destination = {
                    chainName: x.chainDestName,
                    id: x.idDest,
                    chainID: x.chainIDDest,
                    paraID: x.paraIDDest,
                    beneficiary: (x.beneficiary != undefined) ? x.beneficiary : null,
                    amountReceived: 0,
                    amountReceivedUSD: 0,
                    teleportFee: 0,
                    teleportFeeUSD: 0,
                    teleportFeeChainSymbol: x.symbol,
                    blockNumber: null,
                    extrinsicID: null,
                    eventID: null,
                    ts: null,
                    finalized: true,
                    executionStatus: "failed",
                    error: {},
                }
                if (failureType == 'failedDestination') {
                    //xcmInfo.destination.error = this.getXcmErrorDescription(x.errorDesc) TODO..
                    xcmInfo.destination.finalized = true // msg is not emmited in this case, mark as true anyway
                    xcmInfo.destination.finalizedDesc = 'Xcm is terminated at origination. Msg is not relayed to nor received by destination chain'
                } else if (failureType == 'failedOrigination') {
                    // failedOrigination has no destination struct
                    xcmInfo.destination.extrinsicID = null
                    xcmInfo.destination.error = {
                        errorCode: `NA`,
                        errorType: `FailedAtOriginationChain`,
                        errorDesc: `XCM Failed at origination Chain.`,
                    }
                }
            } else {
                xcmInfo.destination = {
                    chainName: x.chainDestName,
                    id: x.idDest,
                    chainID: x.chainIDDest,
                    paraID: x.paraIDDest,
                    beneficiary: (x.beneficiary != undefined) ? x.beneficiary : null,
                    amountReceived: null,
                    amountReceivedUSD: null,
                    teleportFee: null,
                    teleportFeeUSD: null,
                    teleportFeeChainSymbol: x.symbol,
                    blockNumber: null,
                    //extrinsicID: x.destExtrinsicID,
                    eventID: null,
                    ts: null,
                    finalized: false,
                    executionStatus: "pending",
                }
            }
            if (xcmInfo.origination != undefined) {
                if (xcmInfo.origination.txFee != undefined && xcmInfo.origination.amountSent != undefined && xcmInfo.origination.txFee == xcmInfo.origination.amountSent) {
                    console.log(`buildPendingXcmInfo txfee error`, xcmInfo)
                    this.logger.error({
                        "op": "buildPendingXcmInfo",
                        "chainID": this.chainID,
                        "extrinsic": extrinsic,
                        "xcmInfo": xcmInfo,
                        "err": `txFee Error`
                    })
                } else {
                    //console.log(`buildPendingXcmInfo txfee ok`, xcmInfo)
                }
            }
            if (this.debugLevel > paraTool.debugInfo) console.log(`synthetic xcmInfo [${x.extrinsicHash}]`, xcmInfo)
            return xcmInfo
        } catch (e) {
            this.logger.error({
                "op": "buildingPendingXcmInfo",
                "err": e
            })
            return false
        }
    }

    get_block_timestamp(block) {
        return (block.blockTS);
    }

    getBlockStats(block, events, evmBlock = false, evmReceipts = false, autoTraces = false) {
        let blockStats = {
            numExtrinsics: block.extrinsics.length,
            numSignedExtrinsics: 0,
            numTransfers: 0,
            numEvents: events.length,
            valueTransfersUSD: 0,
            fees: 0,
        }
        if (autoTraces && Array.isArray(autoTraces)) {
            blockStats.numTraceRecords = autoTraces.length
        }
        if (evmBlock) {
            blockStats.blockHashEVM = evmBlock.hash;
            blockStats.parentHashEVM = evmBlock.parentHash;
            blockStats.numTransactionsEVM = evmBlock.transactions.length;
            blockStats.numTransactionsInternalEVM = evmBlock.transactionsInternal ? evmBlock.transactionsInternal.length : 0;
            blockStats.gasUsed = evmBlock.gasUsed;
            blockStats.gasLimit = evmBlock.gasLimit;
        }
        if (evmReceipts) {
            blockStats.numReceiptsEVM = ethTool.computeNumEvmlogs(evmReceipts);
        }
        block.extrinsics.forEach((extrinsic, index) => {
            if (this.isExtrinsicSigned(extrinsic)) blockStats.numSignedExtrinsics++;
            if (extrinsic.fee != undefined && extrinsic.fee > 0) {
                blockStats.fees += extrinsic.fee;
            }
            let numTransfers = extrinsic.transfers ? extrinsic.transfers.length : 0;
            let valueTransfersUSD = 0;
            if (numTransfers > 0) {
                for (const t of extrinsic.transfers) {
                    if (t.amountUSD != undefined) {
                        valueTransfersUSD += t.amountUSD
                    }
                }
            }
            blockStats.numTransfers += numTransfers
            blockStats.valueTransfersUSD += valueTransfersUSD
        });

        return (blockStats);
    }

    getErc20LPAssetChain(tokenAddress, chainID) {
        // Store in lower case
        let lowerAsset = `${tokenAddress.toLowerCase()}:LP`
        return paraTool.makeAssetChain(lowerAsset, chainID);
    }

    getErc721TokenAssetChain(tokenAddress, chainID) {
        // Store in lower case
        let lowerAsset = tokenAddress.toLowerCase()
        let lowerAssetKey = JSON.stringify({
            ERC721: tokenAddress
        })
        return paraTool.makeAssetChain(lowerAssetKey, chainID);
    }

    getErc721TokenIDAssetChain(tokenAddress, tokenID, chainID) {
        // Store in lower case
        let lowerAsset = tokenAddress.toLowerCase()
        let lowerAssetKey = JSON.stringify({
            ERC721: tokenAddress,
            tokenID: ethTool.computeTokenIDHex(tokenID)
        })
        return paraTool.makeAssetChain(lowerAssetKey, chainID);
    }

    getErc1155TokenAssetChain(tokenAddress, chainID) {
        // Store in lower case
        let lowerAsset = tokenAddress.toLowerCase()
        let lowerAssetKey = JSON.stringify({
            ERC1155: tokenAddress
        })
        return paraTool.makeAssetChain(lowerAssetKey, chainID);
    }


    initERCAsset(contractAddress, chainID, tokenInfo, tx, assetType) {
        tokenInfo.creator = tx.from;
        tokenInfo.createdAtTx = tx.transactionHash;
        tokenInfo.assetType = assetType;
        tokenInfo.createTS = tx.timestamp;
        contractAddress = contractAddress.toLowerCase()
        this.ercTokenList[contractAddress] = tokenInfo;
    }

    async process_evm_contract_create(tx, chainID, finalized = false, isTip = false) {
        // waterfall model: use `getERC20TokenInfo` to categorize ERC20 contract first. if doesn't work, we will try erc720 next, and then erc1155..
        let web3Api = this.web3Api
        let bn = tx.blockNumber
        let contractAddress = tx.creates
        // ethTool rpccall (4)
        // TODO: generate labels with ethTool.detect_contract_labels(web3api, address, bn)
        let erc20TokenInfo = await ethTool.getERC20TokenInfo(web3Api, contractAddress, bn)
        if (erc20TokenInfo) {
            // store in ercTokenList + tallyAsset, flushed in flushShort/flusTokens
            let ercType = paraTool.assetTypeERC20

            // ethTool rpccall (5)
            /*let lpTokenInfo = await ethTool.getERC20LiquidityPairTokenInfo(web3Api, contractAddress, bn)
            if (!lpTokenInfo) {
                this.cacheNonCompliantLP(contractAddress)
            }
            erc20TokenInfo.lpInfo = lpTokenInfo */
            this.initERCAsset(contractAddress, chainID, erc20TokenInfo, tx, ercType);
            return `${paraTool.assetTypeERC20}`
        }
        // trying erc721 next
        let erc721ContractInfo = await ethTool.getERC721ContractInfo(web3Api, contractAddress, bn)
        if (erc721ContractInfo) {
            this.initERCAsset(contractAddress, chainID, erc721ContractInfo, tx, paraTool.assetTypeERC721);
            return `${paraTool.assetTypeERC721}`
        }

        //trying erc1155
        let erc1155ContractInfo = await ethTool.getERC1155ContractInfo(web3Api, contractAddress, bn)
        if (erc1155ContractInfo) {
            this.initERCAsset(contractAddress, chainID, erc1155ContractInfo, tx, paraTool.assetTypeERC1155);
            return `${paraTool.assetTypeERC1155}`
        }

        //MK: TODO: not sure what we are doing here.
        let contractInfo;
        if (contractInfo) {
            this.initERCAsset(contractAddress, chainID, contractInfo, tx, paraTool.assetTypeContract);
            return `${paraTool.assetTypeContract}`
        }
        return (false);
    }

    async process_evmtx_native_transfer(tx, chainID, ts, blockNumber, finalized = false) {
        let nativeAsset = this.getNativeAsset(chainID)
        let nativeAssetChain = paraTool.makeAssetChain(nativeAsset, chainID);
        // mark assetholder as worthy of update
        // Note: could get internal transfer with evmtraces https://docs.moonbeam.network/builders/build/eth-api/debug-trace/ https://docs.moonbeam.network/builders/build/eth-api/debug-trace/
        if (finalized) {
            this.updateAssetHolder(nativeAssetChain, tx.from, tx.blockNumber) // CHECK: newstate missing
            this.updateAssetHolder(nativeAssetChain, tx.to, tx.blockNumber) // CHECK: netstate missing
        }
        return (false);
    }

    updateAssetHolder(asset, holder, bn, newState = false) {
        let assetholder = `${holder}-${asset}`
        this.stat.assetholder.read++
        let cachedState = this.assetholder[assetholder]

        if (cachedState == undefined) {
            this.stat.assetholder.unique++
            this.stat.assetholder.write++
            this.assetholder[assetholder] = [bn, newState];
        } else {
            var [prevBN, prevState] = cachedState
            if (prevBN < bn) { // we record newState = false cases even if they are newer
                this.stat.assetholder.write++
                this.stat.assetholder.update++
                this.assetholder[assetholder] = [bn, newState];
            }
        }
    }

    async crawl_erc_tokens(bn, blockTS, chainID) {
        let RPCBackfill = null // TODO
        let rows = [];
        for (const contractAddress of Object.keys(this.crawlErcToken)) {
            try {
                let cAddress = contractAddress.toLowerCase();
                //TODO: want to classify contractAddress
                let tokenInfo = await ethTool.getERC20TokenInfo(this.web3Api, cAddress, bn, RPCBackfill)
                if (tokenInfo && tokenInfo.symbol) {
                    this.ercTokenList[cAddress] = tokenInfo;
                    if (tokenInfo.tokenType == "ERC20LP") {
                        //console.log(cAddress, tokenInfo);
                    }
                    // add cell with tokenInfo to metadata
                    let r = {
                        key: cAddress,
                        data: {
                            metadata: {}
                        }
                    }
                    r.data.metadata[chainID.toString()] = {
                        value: JSON.stringify(tokenInfo),
                        timestamp: blockTS * 1000000
                    }
                    rows.push(r);
                }
            } catch (err) {
                console.log(`crawl_erc_tokens`, err);
            }
        }
        this.crawlErcToken = {};
        let [tblName, tblRealtime] = this.get_btTableRealtime()
        console.log("-------> CRAWL_ERC_TOKENS", rows.length);
        try {
            await this.insertBTRows(tblRealtime, rows, tblName);
        } catch (err) {
            console.log(err);
        }
    }

    async process_token_address(tokenAddress, chainID, tokenID = null) {
        try {
            // 1. if this is an unknown token, fetch tokenInfo with getERC20TokenInfo
            // 2. mark that the assetholder balances have to be fetched
            let cAddress = tokenAddress.toLowerCase();

            if (this.ercTokenList[cAddress]) {
                return this.ercTokenList[cAddress] // note: totalSupply is not accurate here
            }
            // if we have marked it for crawl already, then don't do anything
            if (this.crawlErcToken[cAddress] !== undefined) {
                return null;
            }

            // read metadata from btAccountRealtime
            let [tblName, tblRealtime] = this.get_btTableRealtime()
            try {
                let row = null;

                [row] = await tblRealtime.row(cAddress).get();
                let rowData = row.data;
                let pricefeed = rowData["pricefeed"];
                let usd = null

                if (pricefeed) {
                    for (const chainID of Object.keys(pricefeed)) {
                        let pf = JSON.parse(pricefeed["coingecko"][0].value);
                        if (pf.usd) usd = pf.usd;
                    }
                }

                let metadata = rowData["metadata"];
                if (metadata) {
                    for (const chainID of Object.keys(metadata)) {
                        let tokenInfo = JSON.parse(metadata[chainID.toString()][0].value);
                        if (tokenInfo.decimals) {
                            if (usd) {
                                tokenInfo.usd = usd;
                            }
                            this.ercTokenList[cAddress] = tokenInfo;
                            return tokenInfo;
                        }
                    }
                }

                this.crawlErcToken[cAddress] = tokenID;
                return null;
            } catch (err) {
                if (err && (err.code == 404)) {
                    console.log(" 99999 **marking", tokenAddress, chainID)
                    // we should only do this on a 404
                    this.crawlErcToken[cAddress] = tokenID;
                } else {
                    console.log(err);
                }
            }
        } catch (e2) {
            console.log("jjjjjj", e2);
        }
        return null;
    }

    async process_erc20_token_transfer(tx, t, chainID, eventID = "0", finalized = false) {
        let bn = tx.blockNumber
        let tokenInfo = await this.process_token_address(t.tokenAddress, chainID)

        if (finalized) {
            if (tokenInfo) {
                // *** TODO: add symbol, decimal, value_usd, price_usd
            }
            // This mark for lookup on isTip = true for processAssetTypeERC20/fetchAssetHolderBalances
            // this.updateAssetHolder(assetChain, t.from, bn)
            // this.updateAssetHolder(assetChain, t.to, bn)
        }

        if (t.from && t.to && t.tokenAddress) {
            let v = {
                type: "ERC20",
                chainID: chainID,
                blockNumber: tx.blockNumber,
                from: t.from.toLowerCase(),
                to: t.to.toLowerCase(),
                tokenAddress: t.tokenAddress,
                ts: tx.timestamp,
                value: t.value,
            };
            // let extrinsicID = `${tx.blockNumber}-${tx.transactionIndex}`
            if (finalized) {
                // this.updateAddressExtrinsicStorage(t.from, extrinsicID, tx.transactionHash, "feedevmtransfer", v, tx.timestamp, true);
                // this.updateAddressExtrinsicStorage(t.to, extrinsicID, tx.transactionHash, "feedevmtransfer", v, tx.timestamp, true);
                // this.updateAddressExtrinsicStorage(t.tokenAddress, extrinsicID, tx.transactionHash, "feedevmtransfer", v, tx.timestamp, true);
            }
        }
    }

    async process_erc721_token_transfer(tx, t, chainID, eventID = "0", finalized = false) {
        let web3Api = this.web3Api
        let bn = tx.blockNumber
        let tokenID = t.tokenId
        let cAddress = t.tokenAddress.toLowerCase();
        let sender = t.from
        let recipient = t.to
        //   1. if this is an unknown token, fetch tokenInfo with getERC20TokenInfo
        //   2. mark that the assetholder balancer have to be fetched
        //let assetChain = this.getErc721TokenIDAssetChain(cAddress, tokenID, chainID)
        let erc721TokenIDMeta = await this.process_token_address(cAddress, chainID, tokenID);
        if (erc721TokenIDMeta) {
            console.log("process_erc721_token_transfer -- ", erc721TokenIDMeta);
            let prevHolder = erc721TokenIDMeta.owner
            erc721TokenIDMeta.owner = recipient
            erc721TokenIDMeta.blockNumber = bn
            // TODO: write new owner
        }
        // erc721TokenIDMeta = await ethTool.getERC721NFTMeta(web3Api, contractAddress, tokenID, false, bn)
        // console.log(`**[${bn}-${tx.transactionIndex}] ERC721 tokenID Fetched ${contractAddress} [${erc721TokenIDMeta.tokenID}], currHolder:${erc721TokenIDMeta.owner}, (Miss: ${isMiss}, Mint: ${isMint}, Burn: ${isBurn})`)
        // erc721TokenIDMeta.assetType = paraTool.assetTypeERC721Token;
    }

    async process_erc1155_token_transfer(tx, t, chainID, eventID = "0", finalized = false) {
        //stub
    }

    async process_evmtx_token_transfer(tx, chainID, finalized = false) {
        let web3Api = this.web3Api
        let bn = tx.blockNumber
        let transfers = tx.transfers

        for (let e = 0; e < transfers.length; e++) {
            let eventID = e.toString();
            let t = transfers[e];
            //console.log(`Evm transfer [${bn}-${tx.transactionIndex}]`, JSON.stringify(t))
            if (t.type == "ERC20") {
                await this.process_erc20_token_transfer(tx, t, chainID, eventID, finalized)
            }
            if (t.type == "ERC721") {
                await this.process_erc721_token_transfer(tx, t, chainID, eventID, finalized)
            }
            if (t.type == "ERC1155") {
                await this.process_erc1155_token_transfer(tx, t, chainID, eventID, finalized)
            }
        }
        return (false);
    }

    // For all txs in txpool content, write the raw data to hashes feedpending -- it doesn't have a blockNumber/blockHash yet but does have "decodedInput" -- the time is the present time
    // Because multiple indexers write "feedpending" cells with slightly different TS, query MUST dedup these cells by transactionHash (which embeds nonce) should use the oldest cells timestamp
    // We do NOT write into addressextrinsic "feedunfinalized" here, and defer writing there until we have a extrinsicID/blockNumber CANDIDATE.
    async processPendingEVMTransactions(txs, chainID) {
        let ts = this.getCurrentTS();
        let rects = ts * 1000000;
        for (const tx of txs) {
            let evmTxHash = tx.hash;
            let fromAddress = tx.from.toLowerCase()
            let evmTxHashRec = {
                key: evmTxHash,
                data: {}, //feedpending
            }
            let receipt = {
                transactionHash: evmTxHash,
                gasUsed: "0x",
                status: [],
                transfers: [],
                swaps: [],
                decodedLogs: [],
            }
            let fTxn = ethTool.decorateTxn(tx, receipt, [], ts, chainID)
            evmTxHashRec.data = {
                feedpending: {
                    tx: {
                        value: JSON.stringify(fTxn),
                        timestamp: rects
                    }
                }
            }
            //console.log("processPendingEVMTransaction", evmTxHashRec, fTxn);
            this.hashesRowsToInsert.push(evmTxHashRec)
        }
    }

    async process_evmtx_swapV2(swapEvent, chainID, lpTokenInfo) {
        let token0In = paraTool.dechexToInt(swapEvent.amount0In) / 10 ** lpTokenInfo.token0Decimals
        let token1In = paraTool.dechexToInt(swapEvent.amount1In) / 10 ** lpTokenInfo.token1Decimals
        let token0Out = paraTool.dechexToInt(swapEvent.amount0Out) / 10 ** lpTokenInfo.token0Decimals
        let token1Out = paraTool.dechexToInt(swapEvent.amount1Out) / 10 ** lpTokenInfo.token1Decimals
        //trade volume: by definition, it's the inflow (token1In, token0Out)
        //trade fee: total outflow - total inflow (TODO)
        //let inFlow = (token0In != 0) ? `${token0In} ${token0Symbol}` : `${token1In} ${token1Symbol}`
        //let outFlow = (token0Out != 0) ? `${token0Out} ${token0Symbol}` : `${token1Out} ${token1Symbol}`
        let r = {
            token0Symbol: lpTokenInfo.token0Symbol,
            token1Symbol: lpTokenInfo.token1Symbol,
            token0Decimals: lpTokenInfo.token0Decimals,
            token1Decimals: lpTokenInfo.token1Decimals,
            token0In,
            token1Out,
            token1In,
            token0Out
        }
        if (lpTokenInfo.token0 && lpTokenInfo.token1) {
            let t0 = lpTokenInfo.token0.toLowerCase();
            let t1 = lpTokenInfo.token1.toLowerCase();
            let tok0 = await this.process_token_address(t0, chainID);
            if (tok0) {
                r.token0price_usd = tok0.usd;
                r.token0value_usd = tok0.usd * token0In;
            } else {
                console.log("***** SWP MISS on ", t0);
            }
            let tok1 = await this.process_token_address(t1, chainID);
            if (tok1) {
                r.token1price_usd = tok1.usd;
                r.token1value_usd = tok1.usd * token1In;
            } else {
                console.log("***** SWP MISS on ", t1);
            }
            console.log("process_evmtx_swapV2", r, lpTokenInfo);
        }
    }

    async process_evmtx_syncV2(syncEvent, chainID, lpTokenInfo) {
        let lp0 = paraTool.dechexToInt(syncEvent.reserve0) / 10 ** lpTokenInfo.token0Decimals
        let lp1 = paraTool.dechexToInt(syncEvent.reserve1) / 10 ** lpTokenInfo.token1Decimals
        let r = {
            token0Symbol: lpTokenInfo.token0Symbol,
            token1Symbol: lpTokenInfo.token1Symbol,
            token0Decimals: lpTokenInfo.token0Decimals,
            token1Decimals: lpTokenInfo.token1Decimals,
            lp0,
            lp1,
            rat: lp0 / lp1
        }
        if (lpTokenInfo.token0 && lpTokenInfo.token1) {

            let t0 = lpTokenInfo.token0.toLowerCase();
            let t1 = lpTokenInfo.token1.toLowerCase();
            let tok0 = await this.process_token_address(t0, chainID);
            if (tok0) {
                r.token0price_usd = tok0.usd;
                r.token0tvl = lp0 * tok0.usd;
            } else {
                console.log("*** process_evmtx_syncV2 MISS", t0);
            }
            let tok1 = await this.process_token_address(t1, chainID);
            if (tok1) {
                r.token1price_usd = tok1.usd;
                r.token1tvl = lp1 * tok1.usd;
            } else {
                console.log("*** process_evmtx_syncV2 MISS", t1);
            }
            console.log("process_evmtx_syncV2", r, lpTokenInfo);
        }

    }

    // For all evm txs in evmFullBlock, we wish to be able to at least:
    //  - /account/0x7aB.. --> get all the ERC20/721/... assets across chains at the tip
    //    Design: easy to value native assets with coin prices, but very challenging to value ALL assets,
    //      so how do we provide historical balances for ERC20 assets as assets suddenly acquire USD values?
    //  - /asset/0x1d3.. --> get the totalSupply, top 1000 asset holders
    async process_evm_transaction(tx, chainID, finalized = false, isTip = false, writeSubstrateBT = true) {
        if (tx == undefined) return;
        let contractType = false
        // Contract Creates
        if (ethTool.isTxContractCreate(tx)) {
            contractType = await this.process_evm_contract_create(tx, chainID, finalized, isTip);
            console.log("CONTRACT CREATE", contractType);
        }

        // Native Transfers
        if (ethTool.isTxNativeTransfer(tx)) {
            await this.process_evmtx_native_transfer(tx, chainID, finalized);
        }

        // Token Transfers (ERC20/ERC721/1155)
        if (ethTool.isTxTokenTransfer(tx)) {
            await this.process_evmtx_token_transfer(tx, chainID, finalized);
        }

        if (ethTool.isTxSwap(tx)) {
            // swap detected - aggregate trading volumes
            for (const s of tx.swaps) {
                let lpTokenInfo = await this.process_token_address(s.lpTokenAddress, chainID)
                if (lpTokenInfo) {
                    if (s.type == "swapV2") {
                        this.process_evmtx_swapV2(s, chainID, lpTokenInfo)
                    }
                    if (s.type == "swapV3") {
                        //TODO
                        //this.process_evmtx_swapV3(s, chainID, lpTokenInfo)
                    }
                }
            }
        }

        let syncEvents = ethTool.isTxLPSync(tx) // swap, add/removeLiquidity
        if (syncEvents) {
            for (const syncEvent of syncEvents) {
                let lpTokenInfo = await this.process_token_address(syncEvent.lpTokenAddress, chainID)
                if (lpTokenInfo) {
                    if (syncEvent.type == "syncV2") {
                        this.process_evmtx_syncV2(syncEvent, chainID, lpTokenInfo)
                    }
                } else {}
            }
        }

        if (writeSubstrateBT) {
            //process feedevmtx
            let evmTxHash = tx.transactionHash
            let extRes = this.extrinsicEvmMap[evmTxHash]
            let syntheticExtrinsicID = `${tx.blockNumber}-${tx.transactionIndex}`
            if (extRes !== undefined) { // && finalized // REVIEW
                tx['substrate'] = extRes
                syntheticExtrinsicID = extRes.extrinsicID
                extRes.txFee = tx.fee
                this.extrinsicEvmMap[evmTxHash] = extRes
            }
            if (tx.from != undefined) {
                let fromAddress = tx.from.toLowerCase()
                // writes into feed or feedunfinalized based on finalized
                this.updateAddressExtrinsicStorage(fromAddress, syntheticExtrinsicID, evmTxHash, "feed", tx, tx.timestamp, finalized);
            }
            // (2) hashesRowsToInsert: evmTxHash -> evmTX
            this.stat.hashesRows.evmTx++

            let rects = tx.timestamp * 1000000;
            let evmTxHashRec = {
                key: evmTxHash,
                data: {}, //feed/feedunfinalized
            }
            let family = finalized ? 'feed' : 'feedunfinalized';
            evmTxHashRec.data[family] = {
                tx: {
                    value: JSON.stringify(tx),
                    timestamp: rects
                }
            }
            this.hashesRowsToInsert.push(evmTxHashRec)

            // write evmtx to "feedto" to index txs interacting with (contract) address
            if (finalized) {
                let col = `${chainID}-${syntheticExtrinsicID}`
                if (tx.to) {
                    // writes into feedto ONLY
                    let feedto = {
                        chainID: chainID,
                        blockNumber: tx.blockNumber,
                        transactionHash: evmTxHash,
                        decodedInput: tx.decodedInput,
                        from: tx.from.toLowerCase(),
                        to: tx.to.toLowerCase(),
                        ts: tx.timestamp,
                        value: tx.value,
                        fee: tx.fee
                    }
                    //console.log(`[${tx.blockNumber}][${evmTxHash}] sent to ${tx.to}`, feedto)
                    this.updateAddressExtrinsicStorage(tx.to, syntheticExtrinsicID, evmTxHash, "feedto", feedto, tx.timestamp, true);
                }
                if (tx.creates) {
                    // this is contracts creates
                    let feedCreates = {
                        chainID: chainID,
                        blockNumber: tx.blockNumber,
                        transactionHash: evmTxHash,
                        decodedInput: tx.decodedInput,
                        from: tx.from.toLowerCase(),
                        nonce: tx.nonce,
                        to: tx.creates.toLowerCase(),
                        ts: tx.timestamp,
                        value: tx.value,
                        fee: tx.fee
                    }
                    console.log(`[${tx.blockNumber}][${evmTxHash}] created at ${ethTool.toChecksumAddress(tx.creates)}`, feedCreates)
                    this.updateAddressExtrinsicStorage(tx.creates, syntheticExtrinsicID, evmTxHash, "feedto", feedCreates, tx.timestamp, true);
                    if (contractType) {
                        let contractAddress = tx.creates.toLowerCase()
                        let contractMeta = {
                            asset: contractAddress,
                            chainID: chainID,
                            assetType: contractType,
                            creator: tx.from.toLowerCase(),
                            createdAtTx: evmTxHash,
                        };
                        console.log(`[${evmTxHash}] [${contractAddress}]`, contractMeta)
                        this.evmcontractMap[contractAddress] = contractMeta;
                    }
                }
            }
        }
    }

    async processEVMFullBlock(evmFullBlock, evmTrace, chainID, blockNumber, finalized, isTip = false) {
        if (!evmFullBlock) return (false)
        // could this be done with Promise.all?
        let evmTxnCnt = 0
        for (const tx of evmFullBlock.transactions) {
            evmTxnCnt++
            await this.process_evm_transaction(tx, chainID, finalized, isTip);
        }
        this.stat.hashesRows.evmTxPerBlk.push(evmTxnCnt)
    }

    // processEvents organizes events by index, and relays interesting events to
    processEvents(api, eventsRaw, numExtrinsics, blockNumber) {
        var events = [];
        for (let i = 0; i < numExtrinsics; i++) {
            events[i] = [];
        }

        for (let j = 0; j < eventsRaw.length; j++) {
            let e = eventsRaw[j]
            let index = -1;
            if (e.phase.applyExtrinsic != undefined) {
                index = e.phase.applyExtrinsic;
            }
            if (e.phase.initialization !== undefined || e.phase.finalization !== undefined) {
                // index 0 holds { moonbeam/moonriver reward events in e.phase.initialization.
                index = 0;
            }
            if (index >= 0) {
                let eventID = `${this.chainID}-${blockNumber}-${index}-${j}`
                let event = this.parseEvent(e.event, eventID, api); // this is the apiAt
                if (events[index] != undefined) {
                    events[index].push(event)
                }
            }
        }
        return events;
    }


    // processes RAW block and RAW events from BigTable chain into
    // (0) account - feed: processing each extrinsics, with side effect of tallying asset
    // (1) hashes: blockhash
    // (2) block - feed: stored in "feed" column family
    // (3) returning blockStats on block/events

    async processPendingTransactions(pendingExtrinsics, lastestBlockNumber) {
        if (pendingExtrinsics && pendingExtrinsics.length > 0) {
            let api = this.apiAt; // this is always bleeding edge
            let res = pendingExtrinsics.map((pendingExtrinsicRaw, index) => {
                return (this.process_pending_extrinsic(api, pendingExtrinsicRaw, lastestBlockNumber));
            })
        }
    }

    // detect new session using block event
    checkNewSession(eventsIndexed = []) {
        let isNewSession = false;
        let sessionIndex = false;
        for (const extrinsicIndexEvents of eventsIndexed) {
            for (const ev of extrinsicIndexEvents) {
                let sectionMethod = `${ev.section}:${ev.method}`
                if (sectionMethod == 'session:NewSession') {
                    isNewSession = true
                    sessionIndex = ev.data[0]
                }
            }
        }
        return [isNewSession, sessionIndex]
    }

    async getBlockAuthor(api, block, isNewSession = false, sessionIndex = false) {
        if (this.chainID == paraTool.chainIDMoonbeam || this.chainID == paraTool.chainIDMoonriver || this.chainID == paraTool.chainIDMoonbaseAlpha || this.chainID == paraTool.chainIDMoonbaseBeta ||
            this.chainID == paraTool.chainIDRobonomics ||
            this.chainID == paraTool.chainIDQuartz
        ) {
            return //moonbeam has different struct. skip for now
        }
        let currSessionValidators = this.currentSessionValidators
        let currSessionIndex = this.currentSessionIndex

        var digest = api.registry.createType('Digest', block.header.digest);
        //let digestHex = digest.toHex()

        let blockNumber = block.header.number;
        let blockHash = block.hash;
        let blockTS = block.blockTS;

        if (!isNewSession && currSessionIndex > 0 && currSessionValidators.length > 0) {
            // no need to fetch sessionValidators
        } else {
            if (this.authorErrorSpecVersion == this.specVersion) return
            try {
                if (sessionIndex) {
                    currSessionIndex = sessionIndex
                    this.currentSessionIndex = currSessionIndex
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`[${blockNumber}] update currentSession=${currSessionIndex}`)
                } else if (api.query.session != undefined && api.query.session.currentIndex != undefined) {
                    let currIndex = await api.query.session.currentIndex.at(blockHash)
                    currSessionIndex = currIndex.toNumber()
                    this.currentSessionIndex = currSessionIndex
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`*[${blockNumber}] update currentSession=${currSessionIndex}`)
                } else {
                    return;
                }
                currSessionValidators = await api.query.session.validators.at(blockHash)
                currSessionValidators = currSessionValidators.toJSON()
                this.currentSessionValidators = currSessionValidators
                if (this.debugLevel >= paraTool.debugInfo) console.log(`*[${blockNumber}] update currentSessionValidators (${currSessionIndex}, len=${currSessionValidators.length})`)
            } catch (e) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`*[${blockNumber}] [specV=${this.specVersion}] getSessionIndexAndValidators error`, e.toString())
                if (e.toString() == 'Error: query.session.currentIndex is not available in this version of the metadata') {
                    this.authorErrorSpecVersion = this.specVersion
                    if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`*[${blockNumber}] [specV=${this.specVersion}] set authorErrorSpecVersion=${this.specVersion}`)
                }
                return
            }
        }
        let [author, authorPubkey] = paraTool.getAuthor(digest, currSessionValidators)
        if (this.debugLevel >= paraTool.debugTracing) console.log(`[${blockNumber}] ${blockHash}, author:${author}, authorPubkey:${authorPubkey}`)
        if (author != undefined) {
            block.author = author
        }
    }

    combine_tx_with_receipt_status(rawTx, rawReceipt, rawTransactionStatus, idx, blockHash, blockNumber, blockTS, prevCumulativeGasUsed) {
        // TODO: reformat to match
        let tx = null;
        let gasUsed = null;
        let typ = "legacy";
        if (rawTx.eip1559) {
            tx = JSON.parse(JSON.stringify(rawTx.eip1559))
            tx.type = 2;
            typ = "eip1559";
            gasUsed = rawReceipt.eip1559.gasUsed;
        } else if (rawTx.legacy) {
            tx = JSON.parse(JSON.stringify(rawTx.legacy))
            tx.type = 1;
            gasUsed = rawReceipt.legacy.gasUsed;
        }
        if (tx) {
            tx.ts = blockTS;
            tx.timestamp = blockTS;
            tx.blockNumber = blockNumber;
            tx.transactionIndex = rawTransactionStatus.transactionIndex
            tx.hash = rawTransactionStatus.transactionHash
            tx.from = rawTransactionStatus.from
            tx.to = rawTransactionStatus.to
            tx.logs = rawTransactionStatus.logs
            //tx.gasUsed = rawReceipt[typ].usedGas
            tx.statusCode = rawReceipt[typ].statusCode
        }
        let dtx = {
            rawTx,
            rawTransactionStatus,
            rawReceipt,
            tx
        };
        let receipt = (typ == "eip1559") ? JSON.parse(JSON.stringify(rawReceipt.eip1559)) : JSON.parse(JSON.stringify(rawReceipt.legacy));
        receipt.blockHash = blockHash;
        receipt.blockNumber = blockNumber;
        receipt.contractAddress = rawTransactionStatus.contractAddress;
        receipt.cumulativeGasUsed = prevCumulativeGasUsed + receipt.usedGas
        //receipt.effectiveGasPrice = "" // check
        receipt.gasUsed = receipt.usedGas; // check
        receipt.status = receipt.statusCode; // check
        receipt.from = rawTransactionStatus.from;
        receipt.to = rawTransactionStatus.to;
        receipt.transactionHash = rawTransactionStatus.transactionHash;
        receipt.transactionIndex = rawTransactionStatus.transactionIndex
        //console.log("combine", idx, dtx, "receipt", rawReceipt);
        return [tx, receipt];
    }

    convertUnfinalizedRawTraceData(current) {
        if (current.Block && current.Receipts && current.TransactionStatuses && current.evmBlockHash) {
            try {
                let receipts = [];
                let b = JSON.parse(JSON.stringify(current.Block.header));
                b.hash = current.evmBlockHash;
                b.ts = current.blockTS;
                b.timestamp = current.blockTS;
                b.transactions = [];
                let prevCumulativeGasUsed = 0;
                for (let idx = 0; idx < current.Block.transactions.length; idx++) {
                    let rawTransaction = current.Block.transactions[idx];
                    let rawReceipt = current.Receipts[idx];
                    let rawTransactionStatus = current.TransactionStatuses[idx];
                    let [tx, receipt] = this.combine_tx_with_receipt_status(rawTransaction, rawReceipt, rawTransactionStatus, idx, current.evmBlockHash, current.blockNumber, current.blockTS, prevCumulativeGasUsed);
                    if (receipt) {
                        prevCumulativeGasUsed = receipt.cumulativeGasUsed
                    }
                    b.transactions.push(tx);
                    receipts.push(receipt);
                }
                return [b, receipts];
            } catch (err) {
                console.log(err);
            }
        }
        return [null, null];
    }

    patch_xcm(xcmMsg) {
        try {
            //let xcmObj = this.api.registry.createType("XcmVersionedXcm", xcmMsg.msgHex);
            //let msg = xcmObj.toJSON();
            let msg = xcmMsg.msg
            //console.log("patch_xcm COMPUTE", xcmMsg.msgType, xcmMsg.msgHex);
            // generate beneficiaries, version, path
            let r = {
                beneficiaries: "",
                version: "",
                path: ""
            }
            if (this.chainParser) {
                r.beneficiaries = this.chainParser.getBeneficiary(msg);
                let p = this.chainParser.getInstructionPath(msg)
                if (p) {
                    r.version = p.version;
                    r.path = p.path
                }
            }
            //xcmMsg.msg = msg
            xcmMsg.beneficiaries = r.beneficiaries
            xcmMsg.version = r.version
            xcmMsg.path = r.path
        } catch (err) {
            this.logger.error({
                "op": "patch_xcm",
                "obj": JSON.stringify(xcmMsg),
                "err": err
            })
            console.log("patch_xcm", err);
        }
        return;
    }

    generate_call_rows(c) {
        let row = {
            chain_id: c.id,
            block_time: c.block_time,
            relay_chain: c.relay_chain,
            para_id: c.para_id,
            extrinsic_id: c.extrinsic_id,
            extrinsic_hash: c.extrinsic_hash,
            call_id: c.call_id,
            signer_ss58: c.signer_ss58,
            signer_pub_key: c.signer_pub_key
        }
        let section = c.call_section;
        let method = c.call_method;
        let cap_section = paraTool.firstCharUpperCase(section);
        let snake_method = paraTool.snake_case_string(method);
        let tableName = `call_${cap_section}_${snake_method}`;
        if (this.bqTablesCallsEvents[tableName]) {
            let tbl = this.bqTablesCallsEvents[tableName];
            let args = JSON.parse(c.call_args);
            // console.log("FOUND generate_call_rows", tableName, tbl, tbl.columns, args);
            for (const a of Object.keys(args)) {
                let v = args[a];
                if (tbl.columns[`${a}_ss58`]) {
                    row[`${a}_ss58`] = v.id
                    row[`${a}_pub_key`] = paraTool.getPubKey(v.id);
                } else if (tbl.columns[`${a}_float`]) {
                    row[a] = v;
                    // TODO:
                    row[`${a}_usd`] = 0;
                    row[`${a}_float`] = 0;
                } else if (tbl.columns[`${a}_symbol`]) {
                    row[a] = (typeof v == "object") ? JSON.stringify(v) : v;
                    // TODO:
                    row[`${a}_symbol`] = "TODO";
                    row[`${a}_decimals`] = 0;
                } else if (tbl.columns[a]) {
                    if (typeof v == "object") { // tbl.columns[a].data_type
                        row[a] = JSON.stringify(v);
                    } else {
                        row[a] = v;
                    }
                }
            }
            return {
                tableName,
                rows: [{
                    insertId: `ssdev-${c.extrinsic_id}-${c.call_id}`,
                    json: row
                }]
            };
        } else {
            /*this.logger.error({
                "op": "generate_call_rows-NOT FOUND",
                "call": c,
                "err": err
            }) */
        }
        return null;
    }

    async bq_streaming_insert_finalized_block(b) {
        if (this.BQ_SUBSTRATEETL_KEY == null) return;
        const bigquery = this.get_big_query();
        let chainID = this.chainID
        let relayChain = paraTool.getRelayChainByChainID(chainID);
        let paraID = paraTool.getParaIDfromChainID(chainID);
        let id = this.getIDByChainID(chainID);

        let calls = []
        let extrinsics = [];
        let events = [];
        let transfers = [];
        let tokentransfers = [];

        // map block into the above arrays
        let block = {
            hash: b.hash,
            parent_hash: b.parentHash,
            number: b.number,
            state_root: b.stateRoot,
            extrinsics_root: b.extrinsicsRoot,
            block_time: b.blockTS,
            author_ss58: b.author,
            author_pub_key: paraTool.getPubKey(b.author),
            relay_block_number: b.relayBN,
            relay_state_root: b.relayStateRoot,
            extrinsic_count: b.extrinsics.length,
        };
        for (const ext of b.extrinsics) {
            let coveredTransfer = {}
            for (const ev of ext.events) {
                let [dEvent, isTransferType] = await this.decorateEvent(ev, chainID, block.block_time, true, ["data", "address", "usd"], false)
                if (dEvent.section == "system" && (dEvent.method == "ExtrinsicSuccess" || dEvent.method == "ExtrinsicFailure")) {
                    if (dEvent.data != undefined && dEvent.data[0].weight != undefined) {
                        if (dEvent.data[0].weight.refTime != undefined) {
                            ext.weight = dEvent.data[0].weight.refTime;
                        } else if (!isNaN(dEvent.data[0].weight)) {
                            ext.weight = dEvent.data[0].weight;
                        }
                    }
                }
                let bqEvent = {
                    event_id: ev.eventID,
                    extrinsic_hash: ext.extrinsicHash,
                    extrinsic_id: ext.extrinsicID,
                    block_number: block.number,
                    block_time: block.block_time,
                    block_hash: block.hash,
                    section: ev.section,
                    method: ev.method,
                    data: JSON.stringify(ev.data),
                    data_decoded: (dEvent && dEvent.decodedData != undefined) ? JSON.stringify(dEvent.decodedData) : null,
                }
                events.push({
                    insertId: `${relayChain}-${paraID}-${ev.eventID}`,
                    json: bqEvent
                })

                if (isTransferType) {
                    let tInfo = this.extractTransferInfo(dEvent.decodedData)
                    let bqFullTransfer = {
                        block_hash: block.hash,
                        block_number: block.number,
                        block_time: block.block_time,
                        extrinsic_signed: ext.signer ? true : false,
                        extrinsic_hash: ext.extrinsicHash,
                        extrinsic_id: ext.extrinsicID,
                        extrinsic_section: ext.section,
                        extrinsic_method: ext.method,
                        event_id: ev.eventID,
                        event_section: ev.section,
                        event_method: ev.method,
                        transfer_type: tInfo.transferType,
                        from_ss58: tInfo.from_ss58,
                        from_pub_key: tInfo.from_pub_key,
                        to_ss58: tInfo.to_ss58,
                        to_pub_key: tInfo.to_pub_key,
                        amount: tInfo.amount,
                        raw_amount: tInfo.raw_amount,
                        asset: tInfo.asset,
                        price_usd: tInfo.price_usd,
                        amount_usd: tInfo.amount_usd,
                        symbol: tInfo.symbol,
                        decimals: tInfo.decimals,
                    }
                    //Need dedup here
                    let k = `${relayChain}-${paraID}-${ext.extrinsicHash}-${tInfo.from_pub_key}-${tInfo.to_pub_key}-${tInfo.raw_amount}` // it's nearly impossible to have collision even dropping the asset
                    if (coveredTransfer[k] == undefined) { // PROBLEM: no preference between redundant events
                        coveredTransfer[k] = 1;
                        //console.log(`bqFullTransfer`, bqFullTransfer)
                        tokentransfers.push({
                            insertId: `${k}`,
                            json: bqFullTransfer
                        });
                    } else {
                        //console.log(`duplicates transfer`, bqFullTransfer)
                    }
                }
            }
            if (ext.transfers) {
                let cnt = 0;
                for (const t of ext.transfers) {
                    let bqTransfer = {
                        block_hash: block.hash,
                        block_number: block.number,
                        block_time: block.block_time,
                        extrinsic_hash: ext.extrinsicHash,
                        extrinsic_id: ext.extrinsicID,
                        event_id: t.eventID,
                        section: t.section,
                        method: t.method,
                        from_ss58: t.from,
                        to_ss58: t.to,
                        from_pub_key: t.fromAddress,
                        to_pub_key: t.toAddress,
                        amount: t.amount,
                        raw_amount: t.rawAmount,
                        asset: t.asset,
                        price_usd: t.priceUSD,
                        amount_usd: t.amountUSD,
                        symbol: t.symbol,
                        decimals: t.decimals
                    }
                    transfers.push({
                        insertId: `${relayChain}-${paraID}-${t.eventID}-${cnt}`,
                        json: bqTransfer
                    });
                    cnt++;
                }
            }
            if (ext.signer) {
                let feeUSD = await this.computeExtrinsicFeeUSD(ext)
                let bqExtrinsic = {
                    hash: ext.extrinsicHash,
                    extrinsic_id: ext.extrinsicID,
                    block_time: block.block_time,
                    block_number: block.number,
                    block_hash: block.hash,
                    lifetime: JSON.stringify(ext.lifetime),
                    section: ext.section,
                    method: ext.method,
                    params: JSON.stringify(ext.params),
                    fee: ext.fee,
                    fee_usd: feeUSD,
                    //amounts: null
                    //amount_usd: null,
                    weight: (ext.weight != undefined) ? ext.weight : null, // TODO: ext.weight,
                    signed: ext.signer ? true : false,
                    signer_ss58: ext.signer ? ext.signer : null,
                    signer_pub_key: ext.signer ? paraTool.getPubKey(ext.signer) : null
                }
                extrinsics.push({
                    insertId: `${relayChain}-${paraID}-${ext.extrinsicID}`,
                    json: bqExtrinsic
                })
                let flattenedCalls = await this.paramToCalls(ext.extrinsicID, ext.section, ext.method, ext.callIndex, ext.params, ext.paramsDef, chainID, block.block_time, '0')
                for (const call of flattenedCalls) {
                    let ext_fee = null
                    let ext_fee_usd = null
                    let ext_weight = null
                    let call_root = (call.root != undefined) ? call.root : null
                    let call_leaf = (call.leaf != undefined) ? call.leaf : null
                    if (call_root) {
                        //only store fee, fee_usd, weight at root
                        ext_fee = ext.fee
                        ext_fee_usd = feeUSD
                        ext_weight = (ext.weight != undefined) ? ext.weight : null // TODO: ext.weight
                    }
                    let bqExtrinsicCall = {
                        relay_chain: relayChain,
                        para_id: paraID,
                        id: id,
                        block_hash: block.hash,
                        block_number: block.number,
                        block_time: block.block_time,
                        extrinsic_hash: ext.extrinsicHash,
                        extrinsic_id: ext.extrinsicID,
                        lifetime: JSON.stringify(ext.lifetime),
                        extrinsic_section: ext.section,
                        extrinsic_method: ext.method,
                        call_id: call.id,
                        call_index: call.index,
                        call_section: call.section,
                        call_method: call.method,
                        call_args: JSON.stringify(call.args),
                        call_args_def: JSON.stringify(call.argsDef),
                        root: call_root,
                        leaf: call_leaf,
                        fee: ext_fee,
                        fee_usd: ext_fee_usd,
                        //amounts: null
                        //amount_usd: null,
                        weight: ext_weight,
                        signed: ext.signer ? true : false,
                        signer_ss58: ext.signer ? ext.signer : null,
                        signer_pub_key: ext.signer ? paraTool.getPubKey(ext.signer) : null
                    }
                    if (this.suppress_call(id, call.section, call.method)) {} else {
                        let t = this.generate_call_rows(bqExtrinsicCall);
                        if (t) {
                            try {
                                await bigquery
                                    .dataset("substrate")
                                    .table(t.tableName)
                                    .insert(t.rows, {
                                        raw: true
                                    });
                                this.logger.info({
                                    "op": "generate_call_rows",
                                    "tableName": t.tableName
                                })
                            } catch (err) {
                                console.log(t.tableName, JSON.stringify(err));
                                this.logger.error({
                                    "op": "generate_call_rows",
                                    "tableName": t.tableName,
                                    "rows": t.rows,
                                    "err": err
                                })
                            }
                        }

                        calls.push({
                            insertId: `${relayChain}-${paraID}-${ext.extrinsicID}-${call.id}`,
                            json: bqExtrinsicCall
                        })
                    }
                }
            }
        }
        let tables = ["extrinsics", "events", "transfers", "tokentransfers", "calls"];
        for (const t of tables) {
            let rows = null;
            switch (t) {
                case "extrinsics":
                    rows = extrinsics;
                    break;
                case "events":
                    rows = events;
                    break;
                case "transfers":
                    rows = transfers;
                    break;
                case "tokentransfers":
                    //rows = tokentransfers;
                    //console.log(`tokentransfers`, tokentransfers)
                    break;
                case "calls":
                    rows = calls;
                    //console.log(`calls`, calls)
                    break;
            }
            if (rows && rows.length > 0) {
                let dataset = `crypto_${relayChain}`
                try {
                    await bigquery
                        .dataset(dataset)
                        .table(`${t}${paraID}`)
                        .insert(rows, {
                            raw: true
                        });
                    console.log("WRITE", relayChain, t, rows.length)
                } catch (err) {
                    console.log(t, JSON.stringify(err));
                }
            }
        }
    }

    async process_rcxcm(xcmList) {
        let relayChain = null;
        if (this.chainID == 0) relayChain = "polkadot";
        if (this.chainID == 2) relayChain = "kusama";
        let out = [];
        let rows = [];
        for (const x of xcmList) {
            try {
                let isFinalized = (x.finalized) ? 1 : 0
                let xcmInteriorKeys = (x.xcmInteriorKeys != undefined) ? `${mysql.escape(JSON.stringify(x.xcmInteriorKeys))}` : `NULL`
                let xcmInteriorKeysUnregistered = (x.xcmInteriorKeysUnregistered != undefined) ? `${mysql.escape(JSON.stringify(x.xcmInteriorKeysUnregistered))}` : `NULL`
                let s = `('${x.msgHash}', '${x.chainID}', '${x.chainIDDest}', '${x.sentAt}', '${x.relayChain}', '${x.relayedBlockHash}', '${x.relayedAt}', '${x.includedAt}', '${x.msgType}', '${x.blockTS}', ${mysql.escape(JSON.stringify(x.msg))}, '${x.msgHex}', ${mysql.escape(x.path)}, '${x.version}', ${mysql.escape(x.beneficiaries)}, Now(), ${isFinalized}, ${xcmInteriorKeys}, ${xcmInteriorKeysUnregistered})`
                out.push(s)

                if (relayChain) {
                    let insertId = `${x.msgHash}-${x.includedAt}-${x.chainID}-${x.chainIDDest}`;
                    let xcm = {
                        insertId: insertId,
                        json: {
                            msg_hash: x.msgHash,
                            origination_para_id: paraTool.getParaIDfromChainID(x.chainID),
                            destination_para_id: paraTool.getParaIDfromChainID(x.chainIDDest),
                            origination_id: this.getIDByChainID(x.chainID),
                            destination_id: this.getIDByChainID(x.chainIDDest),
                            relayed_at: x.relayedAt,
                            included_at: x.includedAt,
                            msg_type: x.msgType,
                            origination_ts: x.blockTS,
                            msg: JSON.stringify(x.msg),
                            msg_hex: x.msgHex,
                            version: x.version,
                            //xcm_interior_keys: x.xcmInteriorKeys,
                            //xcm_interior_keys_unregistered: x.xcmInteriorKeysUnregistered,
                        }
                    }
                    rows.push(xcm)
                }
            } catch (err) {
                console.log("process_rcxcm", err);
            }
        }
        try {
            const bigquery = this.get_big_query();
            await bigquery
                .dataset(`crypto_${relayChain}`)
                .table("xcm")
                .insert(rows, {
                    raw: true
                });
        } catch (err) {
            console.log("process_rcxcm STREAMING INSERT", err, JSON.stringify(err));
        }
        let vals = ["relayChain", "relayedBlockHash", "relayedAt", "includedAt", "msgType", "blockTS", "msgStr", "msgHex", "path", "version", "beneficiaries", "indexDT", "finalized", "xcmInteriorKeys", "xcmInteriorKeysUnregistered"]
        let sqlDebug = true
        await this.upsertSQL({
            "table": "xcm",
            "keys": ["msgHash", "chainID", "chainIDDest", "sentAt"],
            "vals": vals,
            "data": out,
            "replace": vals
        }, sqlDebug);
    }

    ParaInclusionPendingAvailabilityFilter(traces) {
        let backedMap = {}
        for (const t of traces) {
            if (t.p == "ParaInclusion" && (t.s == "PendingAvailability")) {
                try {
                    if (t.v == '0x') continue
                    let pendingAvailability = t.pv ? JSON.parse(t.pv) : null; // pv:
                    if (pendingAvailability) {
                        let k = JSON.parse(t.pkExtra)
                        let paraID = paraTool.toNumWithoutComma(k[0])
                        backedMap[paraID] = pendingAvailability
                    }
                } catch (err) {
                    this.logger.error({
                        "op": "ParaInclusionPendingAvailabilityFilter",
                        "traceID": t.traceID,
                        "err": err
                    })
                    console.log(`ParaInclusionPendingAvailabilityFilter error`, err)
                }
            }
        }
        return backedMap
    }

    async indexRelayChainTrace(traces, bn, chainID, blockTS, relayChain = 'polkadot', isTip = false, finalized = false, chainParserStat = false) {
        let xcmList = [];
        let backedMap = this.ParaInclusionPendingAvailabilityFilter(traces)
        let mp = {}
        for (const t of traces) {
            if (t.p == "ParaInclusion" && (t.s == "PendingAvailabilityCommitments")) {
                try {
                    let commitments = t.pv ? JSON.parse(t.pv) : null;
                    if (commitments && commitments.upwardMessages && (commitments.upwardMessages.length > 0 || commitments.horizontalMessages.length > 0)) {
                        let k = JSON.parse(t.pkExtra)
                        let paraID = parseInt(paraTool.toNumWithoutComma(k[0]), 10)
                        let backed = backedMap[paraID]
                        let sourceSentAt = backed.relayParentNumber // this is the true "sentAt" at sourceChain, same as commitments.hrmpWatermark
                        let sourceSentBlockHash = backed.paraHead // this is supposedly the "sentBN"
                        let relayedAt = bn // "relayedAt" -- aka backed at this relay bn
                        let includedAt = bn + 1 // "includedAt" -- aka when it's being delivered to destChain
                        for (const data of commitments.upwardMessages) {
                            var xcmFragments = this.chainParser.decodeXcmVersionedXcms(this, data, `upwardMessages`)
                            if (xcmFragments) {
                                for (const xcm of xcmFragments) {
                                    var msgHash = xcm.msgHash
                                    var msg = xcm.msg
                                    var msgHex = xcm.hex
                                    let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain)
                                    let chainIDDest = this.chainID
                                    let analysis = this.performAnalysisInstructions(msg, chainID, chainIDDest)
                                    if (this.debugLevel >= paraTool.debugInfo) console.log(`**UMP [${msgHash}] analysis`, analysis)
                                    let xcmInteriorKeys = analysis.xcmInteriorKeysAll;
                                    let xcmInteriorKeysUnregistered = analysis.xcmInteriorKeysUnRegistered;
                                    let umpMsg = {
                                        msgType: "ump",
                                        chainID: chainID,
                                        chainIDDest: chainIDDest,
                                        paraID: paraID,
                                        paraIDDest: 0,
                                        sentAt: sourceSentAt,
                                        relayedAt: relayedAt,
                                        includedAt: includedAt,
                                        msgHex: msgHex,
                                        msgHash: msgHash,
                                        msg: xcm.msg,
                                        xcmInteriorKeys: (xcmInteriorKeys && xcmInteriorKeys.length > 0) ? xcmInteriorKeys : null,
                                        xcmInteriorKeysUnregistered: (xcmInteriorKeysUnregistered && xcmInteriorKeysUnregistered.length > 0) ? xcmInteriorKeysUnregistered : null,
                                        blockTS: blockTS,
                                        relayChain: relayChain,
                                        isTip: isTip,
                                        finalized: finalized,
                                        relayedBlockHash: chainParserStat.parserBlockHash,
                                        ctx: t.s,
                                    }
                                    this.patch_xcm(umpMsg)
                                    xcmList.push(umpMsg)
                                }
                            }
                        }
                        for (const h of commitments.horizontalMessages) {
                            /*
                            {
                                "recipient": 2004,
                                "data":"0x000210010400010200411f06080001000b3cbef64bc1240a1300010200411f06080001000b3cbef64bc124010700f2052a010d0100040001030024a304386099637e578c02ffeaf2cf3dcfbab751"
                            }
                            */
                            let paraIDDest = parseInt(paraTool.toNumWithoutComma(h.recipient), 10)
                            let data = '0x' + h.data.substring(4).toString();
                            var xcmFragments = this.chainParser.decodeXcmVersionedXcms(this, data, `horizontalMessages`)
                            if (xcmFragments) {
                                for (const xcm of xcmFragments) {
                                    var msgHash = xcm.msgHash
                                    var msg = xcm.msg
                                    var msgHex = xcm.hex
                                    let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain)
                                    let chainIDDest = paraTool.getChainIDFromParaIDAndRelayChain(paraIDDest, relayChain)
                                    let analysis = this.performAnalysisInstructions(msg, chainID, chainIDDest)
                                    if (this.debugLevel >= paraTool.debugInfo) console.log(`**HRMP [${msgHash}] analysis`, analysis)
                                    let xcmInteriorKeys = analysis.xcmInteriorKeysAll;
                                    let xcmInteriorKeysUnregistered = analysis.xcmInteriorKeysUnRegistered;
                                    let hrmpMsg = {
                                        msgType: "hrmp",
                                        chainID: chainID,
                                        chainIDDest: chainIDDest,
                                        paraID: paraID,
                                        paraIDDest: paraIDDest,
                                        sentAt: sourceSentAt,
                                        relayedAt: relayedAt,
                                        includedAt: includedAt,
                                        msgHex: msgHex,
                                        msgHash: msgHash,
                                        msg: xcm.msg,
                                        xcmInteriorKeys: (xcmInteriorKeys && xcmInteriorKeys.length > 0) ? xcmInteriorKeys : null,
                                        xcmInteriorKeysUnregistered: (xcmInteriorKeysUnregistered && xcmInteriorKeysUnregistered.length > 0) ? xcmInteriorKeysUnregistered : null,
                                        blockTS: blockTS,
                                        relayChain: relayChain,
                                        isTip: isTip,
                                        finalized: finalized,
                                        relayedBlockHash: chainParserStat.parserBlockHash,
                                        ctx: t.s,
                                    }
                                    this.patch_xcm(hrmpMsg)
                                    xcmList.push(hrmpMsg)
                                }
                            }
                        }
                    }
                } catch (err) {
                    this.logger.error({
                        "op": "indexRelayChainTrace - ParaInclusion:PendingAvailabilityCommitments",
                        "traceID": t.traceID,
                        "trace": JSON.stringify(t),
                        "err": err
                    })
                    console.log(err, t.pv);
                }
            } else if ((t.p == "Dmp") && (t.s == "DownwardMessageQueues")) {
                try {
                    let queues = JSON.parse(t.pv);
                    if (queues.length > 0) {
                        let k = JSON.parse(t.pkExtra)
                        let paraIDDest = parseInt(paraTool.toNumWithoutComma(k[0]), 10)
                        for (const q of queues) {
                            //let sentAt = q.sentAt; // NO QUESTION on dmp (this is usually always the same block where xcmtransfer is initiated), sentAt = includedAt = relayedAt
                            let data = (q.msg != undefined) ? q.msg : q.pubMsg
                            let sentAt = (q.sentAt != undefined) ? paraTool.dechexToInt(q.sentAt) : paraTool.dechexToInt(q.pubSentAt)
                            var xcmFragments = this.chainParser.decodeXcmVersionedXcms(this, data, `DownwardMessages`)
                            if (xcmFragments) {
                                for (const xcm of xcmFragments) {
                                    var msgHash = xcm.msgHash
                                    var msg = xcm.msg
                                    var msgHex = xcm.hex
                                    let chainID = this.chainID
                                    let chainIDDest = paraTool.getChainIDFromParaIDAndRelayChain(paraIDDest, relayChain)
                                    let analysis = this.performAnalysisInstructions(msg, chainID, chainIDDest)
                                    if (this.debugLevel >= paraTool.debugInfo) console.log(`**DMP [${msgHash}] analysis`, analysis)
                                    let xcmInteriorKeys = analysis.xcmInteriorKeysAll;
                                    let xcmInteriorKeysUnregistered = analysis.xcmInteriorKeysUnRegistered;
                                    let dmpMsg = {
                                        msgType: "dmp",
                                        chainID: this.chainID,
                                        chainIDDest: paraTool.getChainIDFromParaIDAndRelayChain(paraIDDest, relayChain),
                                        paraID: 0,
                                        paraIDDest: paraIDDest,
                                        sentAt: sentAt,
                                        relayedAt: sentAt,
                                        includedAt: sentAt,
                                        msgHex: msgHex,
                                        msgHash: msgHash,
                                        msg: xcm.msg,
                                        xcmInteriorKeys: (xcmInteriorKeys && xcmInteriorKeys.length > 0) ? xcmInteriorKeys : null,
                                        xcmInteriorKeysUnregistered: (xcmInteriorKeysUnregistered && xcmInteriorKeysUnregistered.length > 0) ? xcmInteriorKeysUnregistered : null,
                                        blockTS: blockTS,
                                        relayChain: relayChain,
                                        isTip: isTip,
                                        finalized: finalized,
                                        relayedBlockHash: chainParserStat.parserBlockHash,
                                        ctx: t.s,
                                    }
                                    this.patch_xcm(dmpMsg)
                                    xcmList.push(dmpMsg)
                                }
                            }
                        }
                    }
                } catch (err) {
                    this.logger.error({
                        "op": "indexRelayChainTrace - Dmp:DownwardMessageQueues",
                        "traceID": t.traceID,
                        "trace": JSON.stringify(t),
                        "err": err
                    })
                }
            }
        }
        if (xcmList.length > 0) {
            //console.log(`!!! indexRelayChainTrace [${relayChain}-${bn}] len=${xcmList.length} (finalized=${finalized}, isTip=${isTip})`, xcmList)
            await this.process_rcxcm(xcmList)
        }
        let xcmMeta = []
        for (const x of xcmList) {
            // TODO: keep minimal essential data
            // blockTS|msgType|relayChain|blockNumber|relayParentStateRoot|relayBlockHash|chainID|chainIDDest|sentAt|relayedAt|includedAt|msgHash
            // (integer) blockTS|blockNumber|chainID|chainIDDest|sentAt|relayedAt|includedAt
            //console.log(`xcmMeta!!`, x)
            // '1679350644|hrmp|kusama|false|false|false|22092|22000|17126302|17126303|17126304|0x81009ec171d725cb0265ca9e49b2db16888fa2b76b475fd14bdd0f4520d74894'
            if (chainParserStat) {
                let s = `${x.blockTS}|${x.msgType}|${this.relayChain}|${chainParserStat.parserBlockNumber}|${chainParserStat.relayParentStateRoot}|${chainParserStat.parserBlockHash}|${x.chainID}|${x.chainIDDest}|${x.sentAt}|${x.relayedAt}|${x.includedAt}|${x.msgHash}`
                if (this.debugLevel >= paraTool.debugInfo) console.log(`xcmMeta: ${s}`)
                xcmMeta.push(s)
            }
        }
        //this.xcmMeta = xcmMeta
        if (xcmMeta.length > 0) {
            this.xcmMetaMap[bn] = {
                blockNumber: chainParserStat.parserBlockNumber,
                blockTS: chainParserStat.parserTS,
                blockHash: chainParserStat.parserBlockHash,
                stateRoot: chainParserStat.relayParentStateRoot,
                xcmMeta: xcmMeta,
            }
        }
        return xcmList
    }


    async processBlockEvents(chainID, block, eventsRaw, evmBlock = false, evmReceipts = false, evmTrace = false, autoTraces = false, finalized = false, unused = false, isTip = false, tracesPresent = false) {
        //processExtrinsic + processBlockAndReceipt + processEVMFullBlock
        if (!block) return;
        if (!block.extrinsics) return;
        let blockNumber = block.header.number;
        let blockHash = block.hash;
        let blockTS = block.blockTS;
        let stateRoot = block.header.stateRoot
        let paraID = paraTool.getParaIDfromChainID(chainID)
        if (paraID == 0) {
            //this.trailingBlockHashs[blockHash] = blockNumber;
        }
        let recentXcmMsgs = []; //new xcm here
        if (finalized == true && autoTraces) {
            //console.log("STANDARD BLOCK", JSON.stringify(evmBlock, null, 4));
            //console.log("STANDARD RECEIPTS", JSON.stringify(evmReceipts, null, 4));
        }
        if (finalized == false && autoTraces) {
            // OPTIMIZATION: we only need to do this for evm chains...
            let current = {
                Block: null,
                Receipts: null,
                TransactionStatuses: null,
                blockHash,
                blockNumber,
                blockTS,
                evmBlockHash: null
            }; // note that blockHash is the Substrate block hash
            for (const t of autoTraces) {
                if ((t.p == "Ethereum" && t.s == "CurrentBlock") && t.pv) {
                    current.Block = JSON.parse(t.pv)
                }
                if ((t.p == "Ethereum" && t.s == "CurrentReceipts") && t.pv) {
                    current.Receipts = JSON.parse(t.pv)
                }
                if ((t.p == "Ethereum" && t.s == "CurrentTransactionStatuses") && t.pv) {
                    current.TransactionStatuses = JSON.parse(t.pv);
                }
                if ((t.p == "Ethereum" && t.s == "BlockHash")) {
                    let pkExtraArr = JSON.parse(t.pkExtra);
                    if (Array.isArray(pkExtraArr) && pkExtraArr.length > 0) {
                        let bnCand = paraTool.toNumWithoutComma(pkExtraArr[0]);
                        if (bnCand == blockNumber) {
                            current.evmBlockHash = t.pv;
                        }
                    }
                }
            }
            let [newEVMBlock, newReceipts] = this.convertUnfinalizedRawTraceData(current);
            if (newEVMBlock && newReceipts) {
                //console.log("NEW BLOCK", JSON.stringify(newEVMBlock, null, 4));
                //console.log("NEW RECEIPTS", JSON.stringify(newReceipts, null, 4));
                evmBlock = newEVMBlock;
                evmReceipts = newReceipts;
            }
        }
        // setParserContext
        //console.log(`**** blockHash=${blockHash}, blockNumber=${blockNumber}, stateRoot=${stateRoot}`)
        this.chainParser.setParserContext(block.blockTS, blockNumber, blockHash, chainID);
        if (this.isRelayChain) this.chainParser.setRelayParentStateRoot(stateRoot)
        //console.log(`**** chainParserStat`, this.chainParser.getChainParserStat())
        let api = this.apiAt; //processBlockEvents is sync func, so we must initialize apiAt before pass in?
        block.finalized = finalized;

        // (0.a) index events by extrinsicIndex
        let eventsIndexed = this.processEvents(api, eventsRaw, block.extrinsics.length, blockNumber);

        // (0.b) check NewSession signal
        let [isNewSession, sessionIndex] = this.checkNewSession(eventsIndexed);

        // (0.c) derive/cache session validators - called once every ~ 2400 blocks
        await this.getBlockAuthor(this.api, block, isNewSession, sessionIndex)
        if (block.author != undefined) {
            this.chainParser.setAuthor(block.author)
        } else {
            this.chainParser.setAuthor(false)
        }

        // NEW REQUIREMENT: must process extrinsics before evmTx
        // (0.d) decode block extrinsic (from the raw encoded bytes from crawlBlock)
        let processExtrinsicStartTS = new Date().getTime()
        let extrinsics = [];
        for (let index = 0; index < block.extrinsics.length; index++) {
            let extrinsicRaw = block.extrinsics[index];
            let ext = await this.process_extrinsic(api, extrinsicRaw, eventsIndexed[index], block, index, finalized, isTip, tracesPresent);
            if (ext) {
                extrinsics.push(ext);
                if ((this.currentTS() - blockTS < 86400 * 2) && finalized) { // only save in recentExtrinsic if finalized (otherwise extrinsicID would not be usable as a deduping key)
                    let [logDT, hr] = paraTool.ts_to_logDT_hr(blockTS)
                    let fromAddress = null
                    let signed = (ext.signer != undefined && ext.signer != 'NONE') ? 1 : 0;
                    if (signed) {
                        fromAddress = paraTool.getPubKey(ext.signer)
                        if (fromAddress === false) fromAddress = null;
                        if (ext.transfers && ext.transfers.length > 0) {
                            for (const t of ext.transfers) {
                                if (t.fromAddress != undefined && t.toAddress != undefined) {
                                    // potentially empty fields: amount, priceUSD, amountUSD, decimals, symbol, asset
                                    let priceUSD = t.priceUSD != undefined ? t.priceUSD : 0;
                                    let amountUSD = t.amountUSD != undefined ? t.amountUSD : 0;
                                    // MK TODO transfersrecent
                                    let tAmount = (t.amount != undefined) ? `'${t.amount}'` : 'Null';
                                    let tAsset = (t.asset != undefined) ? `'${t.asset}'` : 'Null';
                                    let tSymbol = (t.symbol != undefined) ? `'${t.symbol}'` : 'Null';
                                    let tDecimals = (t.decimals != undefined && t.decimals > 0) ? `'${t.decimals}'` : 'Null';
                                    let tRawAsset = (t.rawAsset != undefined) ? `'${t.rawAsset}'` : 'Null';
                                    let tRawAmount = (t.rawAmount != undefined && t.rawAmount >= 0) ? `'${t.rawAmount}'` : 'Null';
                                    if (isTip && (tracesPresent == false)) {
                                        // because traces are missing, we'll fill in gaps dynamically at the tip for the sender and the receiver
                                        this.flagAddressBalanceRequest(t.fromAddress);
                                        this.flagAddressBalanceRequest(t.toAddress);
                                        // TODO: check if this misses { burns, xcmtransfers, unsigned extrinsics }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        block.extrinsics = extrinsics;

        let processExtrinsicTS = (new Date().getTime() - processExtrinsicStartTS) / 1000
        this.timeStat.processExtrinsicTS += processExtrinsicTS
        this.timeStat.processExtrinsic += block.extrinsics.length

        let forceTry = true //MK: need to review this
        if ((isTip || forceTry) && this.isRelayChain) {
            let relayChain = paraTool.getRelayChainByChainID(chainID);

            if (autoTraces) {
                //console.log("this.indexRelayChainTrace SUCC", blockNumber, chainID, relayChain, autoTraces.length);
                await this.indexRelayChainTrace(autoTraces, blockNumber, chainID, blockTS, relayChain, isTip, finalized, this.chainParser.getChainParserStat());
            }
        }
        let xcmMeta = []
        if (this.isRelayChain) {
            let xcmMetaInfo = this.xcmMetaMap[blockNumber]
            if (xcmMetaInfo != undefined) {
                xcmMeta = xcmMetaInfo.xcmMeta
                if (this.debugLevel >= paraTool.debugInfo) console.log(`[${blockNumber}] [${blockHash}] xcmMeta found via xcmMetaMap!!`, xcmMeta)
            }
            block.xcmMeta = xcmMeta
        }

        let relayParentStateRoot = this.chainParser.relayParentStateRoot
        let relayBN = this.chainParser.parserWatermark
        block.relayBN = relayBN
        block.relayStateRoot = relayParentStateRoot

        // (1) record blockHash in BT hashes
        let blockfeed = {
            chainID: chainID,
            blockNumber: blockNumber,
            relayBN: relayBN,
            blockType: 'substrate'
        }

        // console.log("processBlockEvents added hashesRowsToInsert", blockHash, this.hashesRowsToInsert.length);
        // (3) hashesRowsToInsert: substrateBlockHash -> substrateBlockBN
        this.stat.hashesRows.substrateTxPerBlk.push(block.extrinsics.length)
        this.stat.hashesRows.substrateBlk++

        let substrateBlockHashRec = {
            key: blockHash,
            data: {}, //feed/feedunfinalized
        }
        if (block.finalized) {
            substrateBlockHashRec.data = {
                feed: {
                    block: {
                        value: JSON.stringify(blockfeed),
                        timestamp: blockTS * 1000000
                    }
                }
            }
        } else {
            substrateBlockHashRec.data = {
                feedunfinalized: {
                    block: {
                        value: JSON.stringify(blockfeed),
                        timestamp: blockTS * 1000000
                    }
                }
            }
        }

        this.hashesRowsToInsert.push(substrateBlockHashRec)

        // (2) record block in BT chain${chainID} feed
        let cres = {
            key: paraTool.blockNumberToHex(blockNumber),
            data: {
                feed: {},
                feedevm: {},
                autotrace: {},
            }
        };
        cres['data']['feed'][blockHash] = {
            value: JSON.stringify(block),
            timestamp: blockTS * 1000000
        };

        // (2a) record autoTrace in BT chain${chainID} feed, if available
        if (autoTraces) {
            cres['data']['autotrace'][blockHash] = {
                value: JSON.stringify(autoTraces),
                timestamp: blockTS * 1000000
            };
        }

        // (3) fuse block+receipt for evmchain, if both evmBlock and evmReceipts are available
        let web3Api = this.web3Api
        let contractABIs = this.contractABIs
        let contractABISignatures = this.contractABISignatures
        let evmFullBlock = false
        if (evmBlock && evmReceipts) {
            if (web3Api && contractABIs) {
                // processBlockEvents is async, so can put await here ...
                let processBlockAndReceiptStartTS = new Date().getTime();

                // get dTxn, dReceipt, and then do decorateTxn
                //processBlockAndReceiptTS = processTransasctionTS/processReceiptTS/decorateTxnTS

                let processTransasctionStartTS = new Date().getTime()
                let processReceiptStartTS = new Date().getTime()
                var statusesPromise = Promise.all([
                    ethTool.processTranssctions(evmBlock.transactions, contractABIs, contractABISignatures),
                    ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
                ])
                let [dTxns, dReceipts] = await statusesPromise
                //console.log(`[${blockNumber}] dReceipts`, JSON.stringify(dReceipts))

                //let dTxns = await ethTool.processTranssctions(evmBlock.transactions, contractABIs, contractABISignatures)
                let processTransasctionTS = (new Date().getTime() - processTransasctionStartTS) / 1000
                this.timeStat.processTransasctionTS += processTransasctionTS

                //let dReceipts = await ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
                let processReceiptTS = (new Date().getTime() - processReceiptStartTS) / 1000
                this.timeStat.processReceiptTS += processReceiptTS

                let decorateTxnStartTS = new Date().getTime()
                evmFullBlock = await ethTool.fuseBlockTransactionReceipt(evmBlock, dTxns, dReceipts, evmTrace, chainID)
                if (evmFullBlock.transactionsConnected.length > 0) {
                    let connectedTxns = []
                    for (const connectedTxn of evmFullBlock.transactionsConnected) {
                        try {
                            let [msgHash, childMsgHash] = this.getEvmMsgHashCandidate(blockNumber, connectedTxn, 'evm')
                            if (msgHash) connectedTxn.msgHash = msgHash
                            if (childMsgHash) connectedTxn.childMsgHash = childMsgHash
                        } catch (e) {
                            console.log(`[${blockNumber}] [${connectedTxn.transactionHash}] connectTransaction `, e, connectedTxn)
                        }
                        // remote execution here
                        if (connectedTxn.msgHash != undefined) {
                            this.sendManagerMessage(connectedTxn, "remoteExecution", finalized);
                            if (isTip) this.sendWSMessage(connectedTxn, "remoteExecution", finalized)
                        }
                        connectedTxns.push(connectedTxn)
                        evmFullBlock.transactions[connectedTxn.transactionIndex] = connectedTxn
                        evmFullBlock.transactionsConnected = connectedTxns
                    }
                    console.log(`[${blockNumber}] connectTransaction`, evmFullBlock.transactionsConnected)
                }
                let decorateTxnTS = (new Date().getTime() - decorateTxnStartTS) / 1000
                this.timeStat.decorateTxnTS += decorateTxnTS

                let processBlockAndReceiptTS = (new Date().getTime() - processBlockAndReceiptStartTS) / 1000
                this.timeStat.processBlockAndReceiptTS += processBlockAndReceiptTS
                this.timeStat.processBlockAndReceipt++

                let processEVMFullBlockStartTS = new Date().getTime()
                await this.processEVMFullBlock(evmFullBlock, evmTrace, chainID, blockNumber, block.finalized, isTip)
                let processEVMFullBlockTS = (new Date().getTime() - processEVMFullBlockStartTS) / 1000
                this.timeStat.processEVMFullBlockTS += processEVMFullBlockTS
                this.timeStat.processEVMFullBlock++

            } else {
                console.log(`chainID=${chainID} missing web3Api or contractABIs. web3Api(set? ${!web3Api == false}) contractABIs(set? ${!contractABIs == false})`)
            }
        }

        let xcmKeys = Object.keys(this.xcmmsgMap)
        if (xcmKeys.length > 0 && this.debugLevel >= paraTool.debugInfo) console.log(`[${blockNumber}] xcmKeys=${xcmKeys}`)
        for (const xcmKey of xcmKeys) {
            let mpKey = this.xcmTrailingKeyMap[xcmKey]
            if (mpKey != undefined && mpKey.isPreemptive) { //MK: TODO: bypass isFresh without breaking the current implementation.. can't gurantee the correctness of the msg content..
                let mp = this.xcmmsgMap[xcmKey]
                if (mp != undefined) {
                    this.xcmTrailingKeyMap[xcmKey].isPreemptive = false // mark the record as preemptive sent
                    if (isTip) this.sendWSMessage(mp, "xcmmessage", finalized)
                }
            }
            if (mpKey != undefined && mpKey.isFresh) {
                let mp = this.xcmmsgMap[xcmKey]
                let direction = (mp.isIncoming) ? 'incoming' : 'outgoing'
                if (xcmKeys.length > 0 && this.debugLevel >= paraTool.debugInfo) console.log(`xcmMessages ${direction}`, mp)
                if (mp != undefined) {
                    //console.log(`[Delay=${this.chainParser.parserBlockNumber-mp.blockNumber}] send ${direction} xcmmessage ${mp.msgHash}, isTip=${isTip}, finalized=${finalized}`)
                    this.sendManagerMessage(mp, "xcmmessage", finalized)
                    if (isTip) this.sendWSMessage(mp, "xcmmessage", finalized)
                }
                let extrinsicID = (mp.extrinsicID != undefined) ? `'${mp.extrinsicID}'` : 'NULL'
                let extrinsicHash = (mp.extrinsicHash != undefined) ? `'${mp.extrinsicHash}'` : 'NULL'
                let beneficiaries = (mp.beneficiaries != undefined) ? `'${mp.beneficiaries}'` : 'NULL'
                let connectedTxHash = (mp.connectedTxHash != undefined) ? `'${mp.connectedTxHash}'` : 'NULL'
                //console.log(`mp beneficiaries`, beneficiaries)
                //["msgHash", "blockNumber", "incoming"] + ["sentAt", "chainIDDest", "chainID", "msgType", "msgHex", "msgStr", "blockTS", "relayChain", "version", "path", "extrinsicID", "extrinsicHash", "indexDT", "beneficiaries"]
                let s = `('${mp.msgHash}', '${mp.blockNumber}', '${mp.isIncoming}', '${mp.sentAt}', '${mp.chainIDDest}', '${mp.chainID}', '${mp.msgType}', '${mp.msgHex}', ${mysql.escape(mp.msgStr)}, '${mp.blockTS}', '${mp.relayChain}', '${mp.version}', '${mp.path}', ${extrinsicID}, ${extrinsicHash}, Now(), ${beneficiaries}, ${connectedTxHash})`
                if (mp.isIncoming == 1) {
                    if (this.numXCMMessagesIn[mp.blockNumber] == undefined) {
                        this.numXCMMessagesIn[mp.blockNumber] = 1;
                    } else {
                        this.numXCMMessagesIn[mp.blockNumber]++;
                    }
                } else {
                    if (this.numXCMMessagesOut[mp.blockNumber] == undefined) {
                        this.numXCMMessagesOut[mp.blockNumber] = 1;
                    } else {
                        this.numXCMMessagesOut[mp.blockNumber]++;
                    }
                }
                recentXcmMsgs.push(s);
                if (xcmKeys.length > 0 && this.debugLevel >= paraTool.debugInfo) console.log(`[${blockNumber}] add ${xcmKey}`, s)
                this.xcmTrailingKeyMap[xcmKey].isFresh = false // mark the record as processed
            }
        }
        this.xcmmsgMap = {} // remove here...
        if (recentXcmMsgs.length > 0 && this.debugLevel >= paraTool.debugInfo) console.log(`[${blockNumber}] recentXcmMsgs`, recentXcmMsgs)


        if (blockNumber % 20 == 0) {
            //TODO: remove this after we are ready to write into bq
            this.cleanTrailingXcmMap(blockNumber)
        }

        if (evmFullBlock) {

            let evmBlockfeed = {
                chainID: chainID,
                blockNumber: blockNumber,
                blockType: 'evm'
            }
            // add 'feedevm'
            cres['data']['feedevm'][blockHash] = {
                value: JSON.stringify(evmFullBlock),
                timestamp: blockTS * 1000000 // CHECK: should we use evmBlockTS instead?
            };



            // add evmblockhash pointer for searchability
            let evmBlockhash = evmFullBlock.hash
            // console.log("processBlockEvents added hashesRowsToInsert", evmBlockhash, this.hashesRowsToInsert.length);
            // (4) hashesRowsToInsert: evmFullBlockHash -> evmBlockBN
            this.stat.hashesRows.evmBlk++

            let evmBlockHashRec = {
                key: evmBlockhash,
                data: {}, //feed/feedunfinalized
            }
            if (block.finalized) {
                evmBlockHashRec.data = {
                    feed: {
                        block: {
                            value: JSON.stringify(evmBlockfeed),
                            timestamp: blockTS * 1000000
                        }
                    }
                }
            } else {
                evmBlockHashRec.data = {
                    feedevmunfinalized: {
                        block: {
                            value: JSON.stringify(evmBlockfeed),
                            timestamp: blockTS * 1000000
                        }
                    }
                }
            }

            this.hashesRowsToInsert.push(evmBlockHashRec)

        }
        if (isTip) {
            // process realtime xcmInfo matches
            await this.check_xcmtransfers_beneficiary(api, blockNumber, blockTS, finalized);
        }

        let blockStats = this.getBlockStats(block, eventsRaw, evmBlock, evmReceipts, autoTraces);

        this.blockRowsToInsert.push(cres)
        if (recentXcmMsgs.length > 0) {
            this.add_recent_activity(recentXcmMsgs)
        }
        if (isTip && finalized) {
            await this.bq_streaming_insert_finalized_block(block);
        }
        if (xcmMeta.length > 0) {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`returning [${blockNumber}] [${blockHash}] xcmMeta!`, xcmMeta)
        }
        return [blockStats, xcmMeta];
    }

    add_recent_activity(recentXcmMsgs) {
        for (const r of recentXcmMsgs) {
            this.recentXcmMsgs.push(r);
        }
    }

    async processFeedIssuedAndBurned(feed, blockTS) {
        let events = feed.events
        let feedTransfers = []
        for (const e of events) {
            let eventID = e.eventID
            let [pallet, method] = this.parseEventSectionMethod(e)
            //STUB for now
        }
        return feedTransfers
    }

    async processFeedTransfer(feed, blockTS) {
        let events = feed.events
        let feedTransfers = []
        for (const e of events) {
            let eventID = e.eventID
            let [pallet, method] = this.parseEventSectionMethod(e)
            let data = e.data
            let resFeedTransferIn = await this.decorateFeedTransfer(pallet, method, data, feed, eventID, blockTS)
            if (resFeedTransferIn) {
                feedTransfers.push(resFeedTransferIn)
                //let recFeedOut = resFeedTransferIn
                // make a feedout record (setting)
                // recFeedOut.isIncoming = 0
                //feedTransfers.push(recFeedOut)

            }
        }
        return feedTransfers
    }
    /*
    {
      "section": "balances",
      "method": "Transfer",
      (from, to, value)
      "data": [
        "1qnJN7FViy3HZaxZK9tGAA71zxHSBeUweirKqCaox4t8GT7",
        "1b8tb8N1Nu3CQzF6fctE3p2es7KoMoiWSABe7e4jw22hngm",
        504494000000
      ]
    }
    */



    //TODO: no good way to catch token:Deposited / assets:Issued
    // MK
    async decorateFeedTransfer(pallet, method, data, feed, eventID, blockTS) {
        let chainID = feed.chainID
        let pallet_method = `${pallet}:${method}`
        let asset = null;
        let rawAsset = null;
        let rawAssetString = null;
        // WIP: add additional events using chainParser
        if (pallet_method == "balances:Transfer" || pallet_method == "currencies:Transferred" || pallet_method == "assets:Transferred" || pallet_method == "tokens:Transfer") {
            let feedTransfer = {}
            let fdata = {}
            let decimals = null
            let symbol = null;

            switch (pallet_method) {

                // native asset in the chainID
                case "balances:Transfer":
                    fdata = {
                        from: data[0],
                        to: data[1],
                        rawAmount: paraTool.dechexToInt(data[2]),
                        rawAsset: this.getNativeAsset(chainID)
                    }
                    symbol = this.getChainSymbol(chainID)
                    asset = `{"Token":"${symbol}"}`
                    decimals = this.getChainDecimal(chainID)
                    break;

                case "currencies:Transferred":
                case "tokens:Transfer":
                    /*
                    currencies:Transferred
                    [
                      { token: 'ACA' },
                      '23M5ttkmR6KcoUwA7NqBjLuMJFWCvobsD9Zy95MgaAECEhit',
                      '23M5ttkmR6Kco7bReRDve6bQUSAcwqebatp3fWGJYb4hDSDJ',
                      1205600000000
                    ]
                    currencies:Transferred
                    [
                      { erc20: '0x5a4d6acdc4e3e5ab15717f407afe957f7a242578' },
                      '22PHkP2GdGTQh3WEaDKpYtzfPfWccbXFdMGqineZPfukbbus',
                      '23UvQ3ZWXwinF3JfBcxFBFadwDAAw9wwjAGbUVb1Ttf88vWw',
                      1000000000000000
                    ]
                    tokens:Transfer [
                      { token: 'AUSD' },
                      '23M5ttkmR6KcnxentoqchgBdUjzMDSzFoUyf5qMs7FsmRMvV',
                      '25HAjPN9K398DPRWtw2Ad2mpwUACxmM7vyCeG36QotT7qwpt',
                      13761866984927
                    ]
                    */
                    let rAsset = data[0]
                    if (rAsset.dexShare != undefined) rAsset = rAsset.dexShare
                    if (rAsset.dEXShare != undefined) rAsset = rAsset.dEXShare

                    fdata = {
                        from: data[1],
                        to: data[2],
                        rawAmount: paraTool.dechexToInt(data[3]),
                        rawAsset: JSON.stringify(rAsset)
                    }
                    let rawAssetSymbol = null
                    let rawAssetDecimals = null
                    let rawAssetString = null
                    try {
                        [rawAssetSymbol, rawAssetDecimals, rawAssetString] = this.chainParser.getGenericSymbolAndDecimal(this, rAsset, chainID)
                    } catch (merr) {
                        console.log("this.chainParser.getGenericSymbolAndDecimal", rAsset, merr)
                    }
                    //console.log(`rawAssetSymbol=${rawAssetSymbol}, rawAssetDecimals=${rawAssetDecimals}, rawAssetString=${rawAssetString}, fdata`, fdata, )
                    if (rAsset.token != undefined || rAsset.Token != undefined) { // move to chainParser ... this is Acala specific
                        symbol = rawAssetSymbol
                        decimals = rawAssetDecimals
                        asset = `{"Token":"${symbol}"}`
                    } else if (rawAssetSymbol && rawAssetDecimals !== false) {
                        //symbol = rawAssetSymbol
                        //asset = `{"Token":"${symbol}"}`
                        symbol = rawAssetSymbol
                        decimals = rawAssetDecimals
                        asset = rawAssetString
                        fdata.rawAsset = rawAssetString
                        //asset = JSON.stringify(rAsset) // keeping liquidCrowdloan for price lookup?
                        /*
                        currencies:Transferred [
                          { liquidCrowdloan: 13 },
                          '25N6q25h2UMVES4etqQNxtMDWGBwqaKeNBPrwA4Ageyk3Wwi',
                          '23M5ttkmR6Kco2CnDJLZ9Xf15SfCVqH1EWsvTrw9PkHqUEqE',
                          2233001
                        ]
                        currencies:Transferred [
                          { stableAssetPoolToken: 0 },
                          '23zvAPSpwE3Bdr6Cw5L7hPSTjaFuU32KAKtM4VSMmh4cKVZi',
                          '23M5ttkmR6KcoCvrNZsA97DQMPxQmqktF8DHYZSDW4HLcEDw',
                          8999378691
                        ]
                        */
                    } else {
                        // NOT COVERED (dexShare)
                        /*
                        currencies:Transferred [
                          { dexShare: [ [Object], [Object] ] },
                          '23M5ttkmR6Kco7bReRDve6bQUSAcwqebatp3fWGJYb4hDSDJ',
                          '24rnopvwiRsVD75PHwLGtZgYKw5NJVQ5EtYPXcu7YCod7vuN',
                          343010445510480
                        ]
                        */
                        console.log(`decorateFeedTransfer not covered`, pallet_method, data)
                    }
                    //console.log(pallet_method, data)
                    break;

                case "assets:Transferred":
                    // console.log(pallet_method, data)
                    // TODO: use currencyID lookup
                    /* asset_id, from, to, rawAmount
                    [
                      "0x1fcacbd218edc0eba20fc2308c778080",
                      "0xa927E1e1E044CA1D9fe1854585003477331fE2Af",
                      "0x33597f544AcF67C6C450FBCe1EDD9457640Df58C",
                      97580439649
                    ]
                    */
                    let assetID = data[0]
                    //console.log(`assets:Transferred - rawAsset = ${assetID}`)
                    let [assetIDSymbol, assetIDDecimals, assetIDString] = this.chainParser.getGenericSymbolAndDecimal(this, assetID, chainID)
                    if (assetIDSymbol && assetIDDecimals !== false) {
                        symbol = assetIDSymbol
                        decimals = assetIDDecimals
                        asset = `{"Token":"${symbol}"}`
                    }
                    if (this.debugLevel >= paraTool.debugTracing) console.log(`>> symbol=${symbol},decimals=${decimals}, asset=${asset}`)
                    fdata = {
                        from: data[1],
                        to: data[2],
                        rawAmount: paraTool.dechexToInt(data[3]),
                        rawAsset: assetID,
                    }
                    break;

                default:
                    break;
            }
            if (fdata.from != undefined && fdata.to != undefined) {
                feedTransfer["chainID"] = chainID
                feedTransfer["chainName"] = this.getChainName(chainID);
                feedTransfer["blockNumber"] = feed.blockNumber
                feedTransfer["blockHash"] = feed.blockHash
                feedTransfer["ts"] = blockTS
                feedTransfer["isIncoming"] = 1 // vs outgoing
                feedTransfer["eventID"] = eventID
                feedTransfer["section"] = pallet
                feedTransfer["method"] = method
                feedTransfer["extrinsicID"] = feed.extrinsicID
                feedTransfer["extrinsicHash"] = feed.extrinsicHash
                feedTransfer["from"] = fdata.from
                feedTransfer["to"] = fdata.to
                feedTransfer["fromAddress"] = paraTool.getPubKey(fdata.from)
                feedTransfer["toAddress"] = paraTool.getPubKey(fdata.to)
                feedTransfer["rawAsset"] = fdata.rawAsset
                feedTransfer["rawAmount"] = fdata.rawAmount

                // get asset/decimals and pricing result for amountUSD
                /*
                  rawAmount: the original amount
                  Amount: rawAmount adjusted by decimals
                  symbol: asset's symbol
                  decimals: asset's decimals
                */

                if (symbol && decimals !== false) {
                    //asset = `{"Token":"${symbol}"}`
                    let amount = fdata.rawAmount / 10 ** decimals;
                    let p = await this.computePriceUSD({
                        val: amount,
                        asset: asset,
                        chainID: chainID,
                        ts: blockTS
                    })
                    feedTransfer["amount"] = amount;
                    feedTransfer["asset"] = asset
                    feedTransfer["symbol"] = symbol
                    feedTransfer["decimals"] = decimals
                    if (p) {
                        feedTransfer["amountUSD"] = p.valUSD;
                        feedTransfer["priceUSD"] = p.priceUSD;
                    }
                } else if (fdata.rawAmount != undefined) {
                    feedTransfer["amount"] = null
                    feedTransfer["asset"] = null
                    feedTransfer["symbol"] = null
                    feedTransfer["decimals"] = null
                    console.log(`[${eventID}] symbol, decimals unknown`, fdata);
                }

                feedTransfer["data"] = data
                // add index source for debugging
                feedTransfer["genTS"] = this.currentTS();
                feedTransfer["source"] = this.hostname
                //console.log(`feedTransfer`, feedTransfer)
                return feedTransfer
            }
        }
        return false
    }

    isExtrinsicSigned(extrinsic) {
        // we are calling this function with two formats (rExtrinsic(from blockStats) and extrinsic)
        //cleaned format .. usually called from blockstat
        if (extrinsic.signer !== undefined) {
            // unsgined cleaned extrinsics has signer null
            if (extrinsic.signer != undefined) {
                return true
            } else {
                return false
            }
        } else {
            // raw format ... called within process_extrinsic, process_pending_extrinsic
            let signature = extrinsic.signature ? extrinsic.signature : false
            if (signature) {
                if (signature.isSigned != undefined) {
                    return signature.isSigned
                }
            }
            return (false);
        }
    }

    init_asset(asset, assetType = paraTool.assetTypeToken, assetSource = paraTool.assetSourceOnChain, ctx = false) { // TODO: add currencyID here
        if (typeof asset !== 'string') {
            console.log("init_asset:", ctx, asset);
            return (false);
        }
        if (this.tallyAsset[asset] !== undefined) return (true);
        if (!this.validAsset(asset, this.chainID, "init_asset", asset)) {
            console.log("CREATING INVALID ASSET", ctx, asset, assetType);
        }
        switch (assetType) {
            case paraTool.assetTypeToken:
                this.tallyAsset[asset] = {
                    assetType: assetType,
                    // TODO: currencyID
                    assetSource: assetSource,
                    assetSourceMap: {},
                    issuance: 0,
                    price: 0,
                    syntheticRate: 0,
                };
                break;
            case paraTool.assetTypeLiquidityPair:
                this.tallyAsset[asset] = {
                    assetType: assetType,
                    assetSource: assetSource,
                    assetSourceMap: {},
                    lp0: [],
                    lp1: [],
                    rat: [],
                    token0In: 0,
                    token1In: 0,
                    token0Out: 0,
                    token1Out: 0,
                    issuance: 0,
                    price: 0,
                    isDualAssetTypeToken: 0,
                };
                break;
            case paraTool.assetTypeERC20LiquidityPair:
                var [assetKey, chainID] = paraTool.parseAssetChain(asset)
                let lpAddress = assetKey.split(":")[0]
                this.tallyAsset[asset] = {
                    assetType: assetType,
                    assetSource: assetSource,
                    lpAddress: ethTool.toChecksumAddress(lpAddress),
                    pair: null,
                    lp0: [],
                    lp1: [],
                    rat: [],
                    token0In: 0,
                    token1In: 0,
                    token0Out: 0,
                    token1Out: 0,
                    issuance: 0,
                };
                break;
            case paraTool.assetTypeLoan:
                // TODO: why is asset.assetType not getting set for loans?  How should parallel loans get a same/different assettype?
                this.tallyAsset[asset] = {
                    assetType: assetType,
                    assetSource: assetSource,
                    issuance: 0,
                    debitExchangeRate: 0
                }
                break;
            case paraTool.assetTypeCDP:
                this.tallyAsset[asset] = {
                    assetType: assetType,
                    //issuance: 0, //??
                    assetSource: assetSource,
                    supplyExchangeRate: 0,
                    borrowExchangeRate: 0
                }
                break;
            case paraTool.assetTypeNFT:
                this.tallyAsset[asset] = {
                    assetType: assetType,
                    assetSource: assetSource,
                    metadata: false,
                }
                break;
            case paraTool.assetTypeNFTToken:
                this.tallyAsset[asset] = {
                    assetType: assetType,
                    assetSource: assetSource,
                    metadata: false,
                }
                break;
            default:
                console.log("WARNING: init_asset: Unknown type", assetType);
                return (false);
                break;
        }
        return (true);
    }

    async processTraceAsAuto(blockTS, blockNumber, blockHash, chainID, trace, traceType, api, finalized = false) {
        // setParserContext
        this.chainParser.setParserContext(blockTS, blockNumber, blockHash, chainID)
        let rawTraces = [];
        if (!trace) return;
        if (!Array.isArray(trace)) {
            //console.log("prcessTrace", trace);
            return;
        }
        // (s) dedup the events
        let traceIdx = 0;
        for (const t of trace) {
            let [tRaw, _] = this.parse_trace_as_auto(t, traceType, traceIdx, blockNumber, blockHash, api);
            rawTraces.push(tRaw)
            traceIdx++
        }
        return rawTraces
    }

    /*
    {
      traceID: '1259126-37',
      p: 'CdpEngine',
      s: 'DebitExchangeRate',
      k: '0x5301bf5ff0298f5c7b93a446709f8e8812d36c1058eccc97dcabba867eab6dc7c483de2de1246ea70002',
      v: '0x406716b2b8070367010000000000000000',
      pkExtra: '[{"Token":"DOT"}]',
      pv: '101052848337458791'
    }
    */
    async processTraceFromAuto(blockTS, blockNumber, blockHash, chainID, autoTraces, traceType, api, finalized = false, isTip = false) {
        // setParserContext
        this.chainParser.setParserContext(blockTS, blockNumber, blockHash, chainID)

        let dedupEvents = {};
        if (!autoTraces || (!Array.isArray(autoTraces))) {
            console.log("processTraceFromAuto not ", autoTraces);
            return;
        }
        // (s) dedup the events
        for (const a of autoTraces) {
            let o = {}
            o.bn = blockNumber;
            o.blockHash = blockHash;
            o.ts = blockTS;
            o.s = a.s
            o.p = a.p
            o.k = a.k;
            o.v = a.v;
            o.pv = a.pv;
            o.pkExtra = (a.pkExtra != undefined) ? a.pkExtra : null;
            o.traceID = a.traceID
            dedupEvents[a.k] = o;
        }
        let relayChain = paraTool.getRelayChainByChainID(chainID);
        let paraID = paraTool.getParaIDfromChainID(chainID);
        let id = this.getIDByChainID(chainID);
        let chainName = this.getChainName(chainID);
        let traces = [];
        let balanceupdates = [];
        let assetupdates = [];
        let idx = 0;

        for (const dedupK of Object.keys(dedupEvents)) {
            let a = dedupEvents[dedupK];
            let [a2, _] = this.parse_trace_from_auto(a, traceType, blockNumber, blockHash, api);
            if (!a2) continue;
            let p = a2.p;
            let s = a2.s;
            let pallet_section = `${p}:${s}`
            if (finalized) {
                let c = null
                if (a2.asset) {
                    let prinfo = await this.computePriceUSD({
                        val: a2.free,
                        asset: a2.asset,
                        chainID: this.chainID,
                        ts: null
                    })
                    if (prinfo) {
                        let assetInfo = prinfo.assetInfo;
                        c = {
                            relay_chain: relayChain,
                            para_id: paraID,
                            id: assetInfo.id,
                            chain_name: assetInfo.chainName,
                            block_number: blockNumber,
                            ts: blockTS,
                            asset: a2.asset,
                            xcm_interior_key: assetInfo.xcmInteriorKey,
                            decimals: assetInfo.decimals,
                            symbol: assetInfo.symbol,
                            asset_name: assetInfo.assetName,
                            asset_type: assetInfo.assetType,
                            price_usd: assetInfo.priceUSD
                        }
                        let flds = []
                        try {
                            if (s == "TotalIssuance" && a2.totalIssuance) {
                                flds.push(["totalIssuance", "total_issuance"])
                            } else {
                                if (a2.free) {
                                    flds.push(["free", "free"])
                                }
                                if (a2.reserved) {
                                    flds.push(["reserved", "reserved"])
                                }
                                if (a2.frozen) {
                                    flds.push(["frozen", "frozen"])
                                }
                                if (a2.miscFrozen) {
                                    flds.push(["miscFrozen", "misc_frozen"])
                                }
                                if (a2.feeFrozen) {
                                    flds.push(["feeFrozen", "fee_frozen"])
                                }
                            }
                            for (const fmap of flds) {
                                let f = fmap[0] // e.g. totalIssuance
                                let f2 = fmap[1] // e.g. total_issuance
                                c[f2] = a2[f] / 10 ** c.decimals;
                                c[`${f2}_raw`] = a2[f].toString();
                                c[`${f2}_usd`] = c[f2] * c.price_usd;
                            }
                            if ((p == "Tokens" || p == "System" || p == "Balances" || p == "Assets") && (s == "Account" || s == "Accounts" || s == "TotalIssuance")) {
                                if (a2.accountID) {
                                    c.address_ss58 = a2.accountID;
                                    c.address_pubkey = paraTool.getPubKey(a2.accountID);
                                    balanceupdates.push({
                                        insertId: `${relayChain}-${paraID}-${blockNumber}-${idx}`,
                                        json: c
                                    });
                                    //console.log("BALANCEUPDATE", c);
                                } else if (a2.totalIssuance) {
                                    assetupdates.push({
                                        insertId: `${relayChain}-${paraID}-${blockNumber}-${idx}`,
                                        json: c
                                    });
                                    //console.log("CASSETUPDATE", c);
                                }
                            }
                        } catch (err) {
                            console.log(' BROKE', err);
                        }
                    }
                }
                if (this.suppress_trace(id, a2.p, a2.s)) {

                } else {
                    let t = {
                        relay_chain: relayChain,
                        para_id: paraID,
                        id: id,
                        chain_name: chainName,
                        block_number: blockNumber,
                        block_hash: blockHash,
                        ts: blockTS,
                        trace_id: `${blockNumber}-${idx}`,
                        k: a2.k,
                        v: a2.v,
                        section: a2.p,
                        storage: a2.s
                    };
                    if (a2.pk_extra) t.pk_extra = a2.pk_extra;
                    if (a2.pv) t.pv = a2.pv;
                    if (a2.accountID) {
                        t.address_ss58 = a2.accountID;
                        t.address_pubkey = paraTool.getPubKey(a2.accountID);
                    }
                    if (a2.asset) {
                        t.asset = a2.asset;
                    }
                    if (c) {
                        for (const f of Object.keys(c)) {
                            if (t[f] == undefined) {
                                t[f] = c[f];
                            }
                        }
                    }
                    traces.push({
                        insertId: `${relayChain}-${paraID}-${blockNumber}-${idx}`,
                        json: t
                    });
                }
            }
            //temp local list blacklist for easier debugging
            if (pallet_section == '...') {
                continue
            }
            //console.log(`processTrace ${pallet_section}`, a2)
            if (a2.mpType && a2.mpIsSet) {
                await this.chainParser.processMP(this, p, s, a2, finalized)
            } else if (a2.mpIsEmpty) {
                // we can safely skip the empty mp here - so that it doens't count towards not handled
            } else if (a2.accountID && a2.asset) {
                let chainID = this.chainID
                let rAssetkey = a2.asset
                let fromAddress = paraTool.getPubKey(a2.accountID)
                await this.chainParser.processAccountAsset(this, p, s, a2, rAssetkey, fromAddress)
            } else if (a2.asset) {
                await this.chainParser.processAsset(this, p, s, a2)
            } else if (a2.lptokenID) {
                // decorate here
                a2.asset = a2.lptokenID
                await this.chainParser.processAsset(this, p, s, a2)
            } else {
                if (this.unhandledTraceMap[pallet_section] == undefined) {
                    //console.log(`(not handled) ${pallet_section}`);
                    if (this.debugLevel >= paraTool.debugTracing) console.log(`(not handled) ${pallet_section}`, JSON.stringify(a2));
                    this.unhandledTraceMap[pallet_section] = 0;
                }
                this.unhandledTraceMap[pallet_section]++
            }
            idx++;
        }

        if (this.BQ_SUBSTRATEETL_KEY && ((balanceupdates.length > 0) || (assetupdates.length > 0) || (traces.length > 0)) && isTip) {
            const bigquery = this.get_big_query();
            let tables = ["traces"];
            for (const t of tables) {
                let rows = null;
                switch (t) {
                    case "balanceupdates":
                        //rows = balanceupdates;
                        break;
                    case "assetupdates":
                        //  rows = assetupdates;
                        break;
                    case "traces":
                        rows = traces;
                        break;
                    case "transfer":
                        //rows = tokentransfer;
                        break;
                }
                if (rows && rows.length > 0) {
                    try {
                        await bigquery
                            .dataset(`crypto_${relayChain}`)
                            .table(`${t}${paraID}`)
                            .insert(rows, {
                                raw: true
                            });
                        console.log("WRITE", relayChain, t, rows.length)
                    } catch (err) {
                        console.log(t, JSON.stringify(err));
                    }
                }
            }
        }
    }

    currentHour() {
        let today = new Date();
        return today.getUTCHours();
    }


    currentDateAsString() {
        let today = new Date();
        let dd = today.getUTCDate().toString().padStart(2, '0');
        let mm = String(today.getUTCMonth() + 1).padStart(2, '0'); //January is 0!
        let yyyy = today.getUTCFullYear();
        let logDT = `${yyyy}-${mm}-${dd}`;
        return (logDT);
    }

    date_key(logDT) {
        let a = logDT;
        let year = a.getUTCFullYear();
        let month = (a.getUTCMonth() + 1).toString().padStart(2, '0')
        let date = a.getUTCDate().toString().padStart(2, '0');
        let logDTKey = `${year}-${month}-${date}`
        return logDTKey
    }

    async decodeRawBlock(r) {
        let blk = {
            block: r.block,
            justifications: null
        }
        if (this.apiAt == undefined || this.apiAt.registry == undefined) {
            this.logger.error({
                "op": "decodeRawBlock",
                "msg": "no apiAt"
            })
            process.exit(1);
        }
        var signedBlock2;
        try {
            signedBlock2 = this.apiAt.registry.createType('SignedBlock', blk);
        } catch (e) {
            // try fallback here
            console.log(`failed with specV=${this.specVersion} [${r.block.number} ${r.block.hash}]`)
            //let chain = await this.setupChainAndAPI(this.chainID); //not sure
            //await this.initApiAtStorageKeys(chain, r.block.hash, r.block.number)
            //signedBlock2 = this.api.registry.createType('SignedBlock', blk);
            signedBlock2 = await this.api.rpc.chain.getBlock(r.hash);
        }
        // signedBlock2.block.extrinsics.forEach((ex, index) => {  console.log(index, ex.hash.toHex());    });
        return signedBlock2
    }

    async setup_chainParser(chain, debugLevel = paraTool.debugNoLog, isTip = false) {
        console.log(`*** chain.chainID=${chain.chainID}, this.chainID=${this.chainID}`)
        await this.chainParserInit(chain.chainID, debugLevel);
        if (chain.isEVM == 1) {
            await this.getChainERCAssets(this.chainID);
        }
        await this.get_skipStorageKeys();
        if (isTip == false) return;
        let assetRegistryMetaChain = [paraTool.chainIDKarura, paraTool.chainIDAcala, paraTool.chainIDBifrostKSM, paraTool.chainIDBifrostDOT]
        let assetMetaChain = [paraTool.chainIDAstar, paraTool.chainIDShiden, paraTool.chainIDMoonbeam, paraTool.chainIDMoonriver, paraTool.chainIDHeiko, paraTool.chainIDParallel]
        if (this.chainID == paraTool.chainIDKarura || this.chainID == paraTool.chainIDAcala ||
            this.chainID == paraTool.chainIDBifrostKSM || this.chainID == paraTool.chainIDBifrostDOT) {
            if (this.chainID == paraTool.chainIDKarura || this.chainID == paraTool.chainIDAcala) {
                console.log(`Fetch assetRegistry:assetMetadatas`)
                await this.chainParser.fetchAssetRegistry(this)
                console.log(`Fetch assetRegistry:foreignAssetLocations`)
                //await this.chainParser.fetchXCMAssetRegistryLocations(this)
                await this.chainParser.updateLiquidityInfo(this)
            }
            if (this.chainID == paraTool.chainIDBifrostKSM || this.chainID == paraTool.chainIDBifrostDOT) {
                // TODO: use clean GAR model instead of this ...
                //await this.chainParser.fetchAssetRegistryCurrencyMetadatas(this)
                //console.log(`Fetch assetRegistry:currencyIdToLocations`)
                //await this.chainParser.fetchXCMAssetRegistryLocations(this)
            }
        } else if (this.chainID == paraTool.chainIDAstar || this.chainID == paraTool.chainIDShiden || this.chainID == paraTool.chainIDShibuya ||
            this.chainID == paraTool.chainIDMoonbeam || this.chainID == paraTool.chainIDMoonriver || this.chainID == paraTool.chainIDMoonbaseAlpha || this.chainID == paraTool.chainIDMoonbaseBeta ||
            this.chainID == paraTool.chainIDHeiko || this.chainID == paraTool.chainIDParallel ||
            this.chainID == paraTool.chainIDStatemine || this.chainID == paraTool.chainIDStatemint ||
            this.chainID == paraTool.chainIDPhala || this.chainID == paraTool.chainIDKhala ||
            this.chainID == paraTool.chainIDHydraDX || this.chainID == paraTool.chainIDBasilisk ||
            this.chainID == paraTool.chainIDCalamari ||
            this.chainID == paraTool.chainIDRobonomics ||
            this.chainID == paraTool.chainIDMangataX ||
            this.chainID == paraTool.chainIDListen ||
            this.chainID == paraTool.chainIDCrustShadow) {
            await this.chainParser.fetchAsset(this)
            if (this.chainID == paraTool.chainIDHeiko || this.chainID == paraTool.chainIDParallel) {
                await this.chainParser.updateLiquidityInfo(this)
            }
            if (this.chainID == paraTool.chainIDMoonbeam || this.chainID == paraTool.chainIDMoonriver || this.chainID == paraTool.chainIDMoonbaseAlpha || this.chainID == paraTool.chainIDMoonbaseBeta) {
                await this.chainParser.fetchLocalAsset(this)
            }
            if (this.chainID == paraTool.chainIDMoonbeam || this.chainID == paraTool.chainIDMoonriver || this.chainID == paraTool.chainIDMoonbaseAlpha || this.chainID == paraTool.chainIDMoonbaseBeta ||
                this.chainID == paraTool.chainIDHeiko || this.chainID == paraTool.chainIDParallel ||
                this.chainID == paraTool.chainIDCrustShadow ||
                this.chainID == paraTool.chainIDBasilisk) {
                console.log(`fetch assetManager:assetIdType`)
                //await this.chainParser.fetchXCMAssetIdType(this)
            }
            if (this.chainID == paraTool.chainIDAstar || this.chainID == paraTool.chainIDShiden || this.chainID == paraTool.chainIDShibuya ||
                this.chainID == paraTool.chainIDCalamari) {
                console.log(`fetch xcAssetConfig:assetIdToLocation (assetRegistry:assetIdToLocation)`)
                //await this.chainParser.fetchXCMAssetIdToLocation(this)
            }
        }

        // for any new unknown assets, set them up with names, decimals

        await this.chainParser.getSystemProperties(this, chain);
    }


    // given a row r fetched with "build_evm_block_from_row", processes the block, events + trace
    async index_evm_chain_block_row(r, write_bq_log = false, mode = 'store_evm') {
        //console.log('index_evm_chain_block_row', JSON.stringify(r))

        let contractABIs = this.contractABIs;
        let contractABISignatures = this.contractABISignatures;

        let autoTraces = false
        let blkNum = false
        let blkHash = false
        let blockTS = false
        let blockAvailable = false
        let traceAvailable = false
        let receiptsAvailable = false
        let blk = r.block
        let chainID = r.chain_id
        let evmReceipts = []
        let evmTrace = false
        let stream_bq = false
        let write_bt = false

        if (r.block) {
            blockAvailable = true
            blkNum = blk.number;
            blkHash = r.blockHash;
            blockTS = r.blockTS;
        }
        if (r.trace) {
            traceAvailable = true
        }
        if (r.evmReceipts) {
            receiptsAvailable = true
            evmReceipts = r.evmReceipts
        }
        console.log(`[${blkNum}] [${blkHash}] Trace=${traceAvailable}, Receiptss=${receiptsAvailable} , currTS=${this.getCurrentTS()}, blockTS=${blockTS}`)
        var statusesPromise = Promise.all([
            ethTool.processTranssctions(blk.transactions, contractABIs, contractABISignatures),
            ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
        ])
        let [dTxns, dReceipts] = await statusesPromise
        //console.log(`[#${blkNum} ${blkHash}] dTxns`, dTxns)
        if (mode == "store_evm") {
            await this.store_evm(blk, dTxns, dReceipts, evmTrace, chainID, contractABIs, contractABISignatures)
        } else if (mode == "stream_evm") {
            await this.stream_evm(blk, dTxns, dReceipts, evmTrace, chainID, contractABIs, contractABISignatures, stream_bq, write_bt)
        }
        return r;
    }

    async deleteFilesFromPath(basePath) {
        // Check if path exists
        if (fs.existsSync(basePath)) {
            try {
                // Delete the directory and all its contents
                fs.rmSync(basePath, {
                    recursive: true,
                    force: true
                });
                console.log(`Path deleted: ${basePath}`);
            } catch (err) {
                console.error(`Error deleting path: ${basePath}`, err);
            }
        }
        try {
            // Create the directory
            fs.mkdirSync(basePath, {
                recursive: true
            });
            console.log(`Path created: ${basePath}`);
        } catch (err) {
            console.error(`Error creating path: ${basePath}`, err);
        }
    }

    async deleteFilesWithChainID(basePath, chainID) {
        // Helper function to delete a file
        console.log(`basePath: ${basePath}`)
        const deleteFile = (filePath) => {
            try {
                fs.unlinkSync(filePath);
                console.log(`Deleted file: ${filePath}`);
            } catch (error) {
                console.error(`Error deleting file: ${filePath}`, error);
            }
        };

        // Helper function to recursively search and delete files
        const searchAndDelete = (dirPath) => {
            // Check if directory exists
            if (!fs.existsSync(dirPath)) {
                try {
                    fs.mkdirSync(dirPath, {
                        recursive: true
                    });
                    console.log(`Directory created: ${dirPath}`);
                } catch (err) {
                    console.error(`Error creating directory: ${dirPath}`, err);
                }
            }

            const entries = fs.readdirSync(dirPath, {
                withFileTypes: true
            });
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);
                if (entry.isFile() && entry.name.endsWith(`${chainID}.json`)) {
                    deleteFile(entryPath);
                } else if (entry.isDirectory()) {
                    searchAndDelete(entryPath);
                }
            }
        };

        // Start the search and delete process
        searchAndDelete(basePath);
    }

    async streamWrite(fn, JSONNLArray, isReplace = false) {
        // Ensure the directory exists
        let dir = path.dirname(fn)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
            console.log(`Making Directory "${dir}"`);
        } else {
            console.log(`Directory "${dir}" already exists.`);
        }
        // Delete the existing file if isReplace is true
        if (isReplace && fs.existsSync(fn)) {
            fs.unlinkSync(fn);
        }
        console.log(`${fn} replaced=${isReplace}`, JSONNLArray)
        // Create a readable stream from the JSONNLArray
        let readableStream = new stream.Readable({
            read() {
                JSONNLArray.forEach((jsonObject) => {
                    let str = JSON.stringify(jsonObject) + '\n'
                    //console.log(`*** str`, str)
                    this.push(str);
                });
                this.push(null); // Signal the end of the stream
            },
        });
        //console.log(`readableStream`, readableStream)

        // Create a write stream to the local file in append mode
        const writeStream = fs.createWriteStream(fn, {
            flags: 'a'
        });

        // Pipe the readable stream to the write stream and return a Promise
        return new Promise((resolve, reject) => {
            console.log('Starting to consume the readableStream');
            readableStream
                .pipe(writeStream)
                .on('error', (error) => {
                    console.error('Error during streaming:', error);
                    reject(error);
                })
                .on('finish', () => {
                    //console.log('Data streamed successfully to the local file:', fn);
                    resolve();
                });
        });
    }

    async store_evm(evmlBlock, dTxns, dReceipts, evmTrace = false, chainID, contractABIs, contractABISignatures) {
        const {
            BigQuery
        } = require('@google-cloud/bigquery');
        const bigquery = new BigQuery({
            projectId: 'substrate-etl',
            keyFilename: this.BQ_SUBSTRATEETL_KEY
        })
        let chain = await this.getChain(chainID);
        let rows_blocks = [];
        let rows_transactions = [];
        let rows_logs = [];
        let auto_evm_rows_map = {} // tableID => rows
        let auto_evm_schema_map = {} // tableID => rows

        let block = JSON.parse(JSON.stringify(evmlBlock))
        let evmFullBlock = await ethTool.fuseBlockTransactionReceipt(evmlBlock, dTxns, dReceipts, evmTrace, chainID)
        //console.log(`[#${block.number}] evmFullBlock`, evmFullBlock)
        let evm_chain_id = chainID
        let evm_blk_num = block.number
        let blockTS = block.timestamp
        let [currDT, _c] = paraTool.ts_to_logDT_hr(blockTS)
        let logYYYY_MM_DD = currDT.replaceAll('-', '/')
        let rootDir = '/tmp'
        let evmDecodedBasePath = `${rootDir}/evm_decoded/${logYYYY_MM_DD}/${chainID}/`
        let evmETLLocalBasePath = `${rootDir}/evm_etl_local/${logYYYY_MM_DD}/${chainID}/`
        let gWei = 10 ** 9
        let ether = 10 ** 18
        console.log(`!!! [#${block.number}] block`, block)
        let bqEvmBlock = {
            insertId: `${block.hash}`,
            json: {
                chain_id: chainID,
                id: chain.id,
                timestamp: block.timestamp,
                number: block.number,
                hash: block.hash,
                parent_hash: block.parentHash,
                nonce: block.nonce,
                sha3_uncles: block.sha3Uncles,
                logs_bloom: block.logsBloom,
                transactions_root: block.transactionsRoot,
                state_root: block.stateRoot,
                receipts_root: block.receiptsRoot,
                miner: block.miner,
                difficulty: paraTool.dechexToInt(block.difficulty),
                total_difficulty: paraTool.dechexToInt(block.totalDifficulty),
                size: block.size,
                extra_data: block.extraData,
                gas_limit: block.gasLimit,
                gas_used: block.gasUsed,
                transaction_count: block.transactions.length
            }
        }
        //console.log(`bqEvmBlock`, bqEvmBlock)
        rows_blocks.push(bqEvmBlock);
        for (let i = 0; i < evmFullBlock.transactions.length; i++) {
            let rawTx = block.transactions[i];
            let tx = evmFullBlock.transactions[i];
            //console.log(`rawTx`, rawTx)
            //console.log(`tx`, tx)
            let receipt = dReceipts[i] != undefined ? dReceipts[i] : null;
            let logs = receipt && receipt.decodedLogs ? receipt.decodedLogs : null;
            let txhash = tx.transactionHash
            tx.raw = tx.input; // ???
            tx.decodedLogs = logs; // fuse here
            let decodedInput = dTxns[i] != undefined && dTxns[i].decodedInput ? dTxns[i].decodedInput : null;
            //let decodedInput = tx[i] != undefined && tx[i].decodedInput ? tx[i].decodedInput : null;
            let methodID = null
            if (tx.to && tx.input.length >= 10) {
                methodID = tx.input.substr(0, 10)
            }
            let txType = (tx.txType != undefined) ? tx.txType : -1
            let evmTx = {
                chain_id: chainID,
                id: chain.id,
                hash: (tx.transactionHash != undefined) ? tx.transactionHash : rawTx.hash,
                nonce: tx.nonce,
                transaction_index: tx.transactionIndex,
                from_address: tx.from.toLowerCase(),
                to_address: (tx.to != undefined) ? tx.to.toLowerCase() : null,
                value: rawTx.value,
                gas: rawTx.gas,
                gas_price: rawTx.gasPrice,
                input: tx.input,
                receipt_cumulative_gas_used: receipt && receipt.cumulativeGasUsed ? receipt.cumulativeGasUsed : null,
                receipt_gas_used: receipt && receipt.gasUsed ? receipt.gasUsed : null,
                receipt_contract_address: receipt && receipt.contractAddress ? receipt.contractAddress : null,
                receipt_root: null, // irrelevant
                receipt_status: receipt && receipt.status ? 1 : 0,
                block_timestamp: block.timestamp,
                block_number: tx.blockNumber,
                block_hash: tx.blockHash,
                max_fee_per_gas: null,
                max_priority_fee_per_gas: null,
                transaction_type: txType,
                receipt_effective_gas_price: null,

                // polkaholic new fields
                fee: tx.fee,
                txn_saving: null,
                burned_fee: tx.burnedFee,

                decoded: false,
                method_id: methodID,
                signature: null,
                params: null
            }

            if (txType == 2) {
                //1559 (as gWei)
                evmTx.max_fee_per_gas = paraTool.floatToInt(tx.maxFeePerGas * gWei)
                evmTx.max_priority_fee_per_gas = paraTool.floatToInt(tx.maxPriorityFeePerGas * gWei)
                evmTx.txn_saving = (tx.txn_saving != undefined) ? paraTool.floatToInt(tx.txn_saving * ether) : 0
            }
            // use the value directly after reindexing
            if (tx.cumulativeGasUsed) {
                evmTx.receipt_cumulative_gas_used = tx.cumulativeGasUsed
            }
            if (tx.effectiveGasPrice) {
                evmTx.receipt_effective_gas_price = paraTool.floatToInt(tx.effectiveGasPrice * gWei)
            }

            //arbitrum 0x0 values??
            if (evmTx.value == "0x0") evmTx.value = 0
            if (evmTx.gas == "0x0") evmTx.gas = 0
            if (evmTx.gas_price == "0x0") evmTx.gas_price = 0
            if (evmTx.receipt_cumulative_gas_used == "0x0") evmTx.receipt_cumulative_gas_used = 0
            if (evmTx.receipt_gas_used == "0x0") evmTx.receipt_gas_used = 0

            if (decodedInput) {
                evmTx.decoded = (decodedInput.decodeStatus == 'success');
                evmTx.method_id = methodID;
                if (evmTx.decoded) {
                    evmTx.signature = decodedInput.signature;
                    evmTx.params = JSON.stringify(decodedInput.params);
                    // write specific call_ table
                    // try to find tableID
                    if (methodID != null) { //skip nativeTransfer
                        let acctAddr = tx.from.toLowerCase() // signer of the tx

                        let [tableID, projectTableInfo] = this.getTableIDFromFingerprintID(methodID, tx.to);
                        if (tableID) {
                            let [bqCall, bqCall2] = this.generateCallBqRec(tableID, projectTableInfo, methodID, evmTx, acctAddr)
                            if (bqCall) {
                                //console.log(`Auto generated bqCall ${methodID}->${tableID}\n`, bqCall)
                                if (auto_evm_rows_map[tableID] == undefined) {
                                    auto_evm_rows_map[tableID] = []
                                }
                                auto_evm_rows_map[tableID].push(bqCall)
                            }
                            // if there is no projectTableInfo set up yet, set it up with the same schema
                            if (projectTableInfo) {
                                let subtableID = projectTableInfo.subtableId;
                                if (projectTableInfo.status == "Unknown") {
                                    let schemaInfo = await this.setupEvmCallEventSchemaInfo(evmTx.signature, methodID, contractABIs, contractABISignatures);
                                    if (schemaInfo) {
                                        auto_evm_schema_map[subtableID] = schemaInfo
                                        console.log("*******1 CREATING SUBTABLEID", subtableID, schemaInfo);
                                    }
                                } else if (bqCall2) {
                                    if (auto_evm_rows_map[subtableID] == undefined) {
                                        auto_evm_rows_map[subtableID] = []
                                    }
                                    auto_evm_rows_map[subtableID].push(bqCall2)
                                    console.log("*******2 ADDING ROW SUBTABLEID", subtableID, bqCall2);
                                }
                            }
                        } else {
                            let schemaInfo = await this.setupEvmCallEventSchemaInfo(evmTx.signature, methodID, contractABIs, contractABISignatures)
                            if (schemaInfo) {
                                tableID = schemaInfo.schema.tableId
                                let [bqCall, bqCall2] = this.generateCallBqRec(tableID, projectTableInfo, methodID, evmTx, acctAddr)
                                // TODO: bqCall's label
                                if (schemaInfo && tableID) {
                                    console.log(`New call schemaInfo ${methodID}->${schemaInfo.schema.tableId}`, schemaInfo.schema, `\n call:\n`, evmTx.params)
                                    auto_evm_schema_map[tableID] = schemaInfo
                                }
                            } else {
                                //shouldn't get here?
                                console.log(`Unknown methodID ${methodID}\n`)
                            }
                        }

                    }
                }
            }
            let bqEvmTransaction = {
                insertId: `${tx.transactionHash}`,
                json: evmTx
            }
            //console.log(`bq+`, bqEvmTransaction)
            rows_transactions.push(bqEvmTransaction);
            if (logs) {
                for (let j = 0; j < logs.length; j++) {
                    let l = logs[j]
                    let eSig = l.signature ? l.signature : null
                    let eFingerprintID = l.fingerprintID ? l.fingerprintID : null
                    let evmLog = {
                        chain_id: chainID,
                        id: chain.id,
                        log_index: l.logIndex,
                        transaction_hash: (tx.transactionHash != undefined) ? tx.transactionHash : rawTx.hash,
                        transaction_index: i,
                        address: l.address.toLowerCase(),
                        data: l.data,
                        topics: l.topics,
                        block_timestamp: block.timestamp,
                        block_number: block.number,
                        block_hash: block.hash,
                        signature: eSig,
                        events: (l.events) ? JSON.stringify(l.events) : null // TODO: check
                    }
                    let bqEvmLog = {
                        insertId: `${tx.transactionHash}_${l.logIndex}`,
                        json: evmLog
                    }
                    //console.log(`bqEvmLog`, bqEvmLog)
                    rows_logs.push(bqEvmLog);

                    // write specific evt_ table
                    if (eSig) {
                        // try to find tableID
                        let acctAddr = tx.from.toLowerCase() // signer of the tx
                        let [tableID, projectTableInfo] = this.getTableIDFromFingerprintID(eFingerprintID, l.address)

                        if (tableID) { // existing table
                            let [bqEvent, bqEvent2] = this.generateEventBqRec(tableID, projectTableInfo, eFingerprintID, evmLog, acctAddr)
                            if (bqEvent && tableID) {
                                //console.log(`Auto generated bqEvent ${eFingerprintID}->${tableID}\n`, bqEvent)
                                if (auto_evm_rows_map[tableID] == undefined) {
                                    auto_evm_rows_map[tableID] = []
                                }
                                auto_evm_rows_map[tableID].push(bqEvent)
                            }
                            if (projectTableInfo) {
                                let subtableID = projectTableInfo.subtableId;
                                if (projectTableInfo.status == "Unknown") {
                                    console.log("*******3 CREATE PROJECT EVENTS TABLE", subtableID)
                                    let schemaInfo = await this.setupEvmCallEventSchemaInfo(eSig, eFingerprintID, contractABIs, contractABISignatures)
                                    if (schemaInfo) {
                                        auto_evm_schema_map[subtableID] = schemaInfo
                                    }
                                } else if (bqEvent2) {
                                    console.log(`*******4 PROJECTS EVENTS ROW ${subtableID}\n`, bqEvent2)
                                    if (auto_evm_rows_map[subtableID] == undefined) {
                                        auto_evm_rows_map[subtableID] = []
                                    }
                                    auto_evm_rows_map[subtableID].push(bqEvent2)
                                }
                            }
                        } else { // do the abi lookup
                            let schemaInfo = await this.setupEvmCallEventSchemaInfo(eSig, eFingerprintID, contractABIs, contractABISignatures)
                            if (schemaInfo) {
                                tableID = schemaInfo.schema.tableId
                                let [bqEvent, bqEvent2] = this.generateEventBqRec(tableID, projectTableInfo, eFingerprintID, evmLog, acctAddr)
                                if (auto_evm_rows_map[tableID] == undefined) {
                                    auto_evm_rows_map[tableID] = []
                                }
                                auto_evm_rows_map[tableID].push()
                                if (schemaInfo && tableID) {
                                    console.log(`New event schemaInfo ${eFingerprintID}->${schemaInfo.schema.tableId}`, schemaInfo.schema, `\n event:\n`, evmLog.events)
                                    auto_evm_schema_map[tableID] = schemaInfo
                                }
                            } else { //shouldn't get here?
                                console.log(`Unknown eFingerprintID ${eFingerprintID}\n`, eSig)
                            }
                        }


                    }
                }
            }
            // NOTE: we do not write out hashes yet (development)
            this.process_evm_transaction(tx, chainID, true, true, false); // isTip=true, finalized=true, writeBTSubstrate = FALSE
        }

        /*
        if (blockTS) {
            // crawl any token addresses, write to btRealtime
            await this.crawl_erc_tokens(evm_blk_num, blockTS, chainID);
            await this.process_evm_flush(blockTS)
        }
        */

        // store evm_etl_local
        try {
            let dataset = "evm";
            let tables = ["blocks", "transactions", "logs"]; // [ "contracts", "tokens", "token_transfers"]
            for (const tbl of tables) {
                let rows = null
                switch (tbl) {
                    case "blocks":
                        rows = rows_blocks;
                        break;
                    case "transactions":
                        rows = rows_transactions;
                        //console.log(`transactions`, rows_transactions)
                        break;
                    case "logs":
                        rows = rows_logs;
                        //console.log(`log`, rows_logs)
                        break;
                }
                if (rows && rows.length > 0) {
                    let recs = []
                    for (const row of rows) {
                        let rec = row.json
                        console.log(`${tbl} rec`, rec)
                        recs.push(rec)
                    }
                    let replace = false
                    let fn = `${evmETLLocalBasePath}/${tbl}_000000000000`
                    await this.streamWrite(fn, recs, replace)
                    console.log(`WRITE -> ${fn} len=${recs.length}`)
                }
            }
        } catch (err) {
            console.log("err", JSON.stringify(err)); // TODO: logger
        }

        // evm _call _evt datasetId
        let evmDatasetID = this.evmDatasetID;

        // update schems
        console.log(`new schemas`, Object.keys(auto_evm_schema_map))

        for (const schemaTableId of Object.keys(auto_evm_schema_map)) {
            let schemaInfo = auto_evm_schema_map[schemaTableId]
            let schema = schemaInfo.schema
            let sch = schema.schema
            let tinySchema = ethTool.getSchemaWithoutDesc(sch)
            let timePartitioning = schema.timePartitioning
            console.log(`${evmDatasetID}:${schemaTableId} `, sch)
            console.log(`${evmDatasetID}:${schemaTableId} tinySchema`, JSON.stringify(tinySchema))
        }

        // stream into call_ ,  evt_ table
        console.log(`updated tableIds`, Object.keys(auto_evm_rows_map))

        let tableIds = Object.keys(auto_evm_rows_map)
        let autoEvmStorePromise = []
        let autoEvmStorePromiseFn = []
        if (!fs.existsSync(evmDecodedBasePath)) {
            fs.mkdirSync(evmDecodedBasePath, {
                recursive: true
            });
            console.log(`Making Directory "${evmDecodedBasePath}"`);
        }
        for (const tableId of Object.keys(auto_evm_rows_map)) {
            let rows = auto_evm_rows_map[tableId]
            //call_buyWithETHWert_0x5173ffaa/1.json
            let fn = `${evmDecodedBasePath}${tableId}/${chainID}.json`
            if (rows && rows.length > 0) {
                let recs = []
                for (const row of rows) {
                    recs.push(row.json)
                }
                let replace = false
                console.log(`${evmDatasetID}:${tableId} -> ${fn}`, recs)
                //await this.streamWrite(fn, recs, replace);
                autoEvmStorePromiseFn.push({
                    fn: fn,
                    tableId: tableId,
                    rowCnt: rows.length
                })
                autoEvmStorePromise.push(this.streamWrite(fn, recs, replace))
            }
        }

        let autoEvmStoreStates;
        try {
            autoEvmStoreStates = await Promise.allSettled(autoEvmStorePromise);
            //{ status: 'fulfilled', value: ... },
            //{ status: 'rejected', reason: Error: '.....'}
        } catch (e) {
            //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawlerInitPromise error`, e, crawlerInitStates)
            this.log_manager_error(e, "batchStreamWrite", "Promise.allSettled");
        }
        for (let i = 0; i < autoEvmStoreStates.length; i += 1) {
            let autoEvmStoreState = autoEvmStoreStates[i]
            let fnInfo = autoEvmStorePromiseFn[i]
            if (autoEvmStoreState.status != undefined && autoEvmStoreState.status == "fulfilled") {
                //console.log(`autoEvmStoreState[${i}] fulfilled`, autoEvmStoreState)
                //console.log(`Stored\tlen=${fnInfo.rowCnt}\t${fnInfo.fn} `)
            } else {
                let rejectedReason = JSON.parse(JSON.stringify(autoEvmStoreState['reason']))
                let errorStr = rejectedReason.message
                if (errorStr) {
                    console.log(`errorMsg`, errorStr)
                }
            }
        }
    }

    // given a row r fetched with "fetch_block_row", processes the block, events + trace
    async index_chain_block_row(r, signedBlock = false, write_bq_log = false, refreshAPI = false, isTip = false, isFinalized = true, traceParseTS = 1670544000) {
        /* index_chain_block_row shall process trace(if available) + block + events in orders
        xcm steps:
        (1a) processTrace: parse outgoing xcmmessages from traces
        (1b) processBlockEvents: parse xcm transfers + xcm-incoming executed signals(TODO), use result from 1a to link xcmtransfers to xcmmessages
        > This implies that we MUST do 1a, 1b in seqence UNLESS to push all the flushes to step 2
        */
        //console.log('index_chain_block_row', JSON.stringify(r))

        let autoTraces = false
        let blkNum = false
        let blkHash = false
        let blockAvailable = false
        let traceAvailable = false
        let eventAvailable = false
        let blk = r.block
        if (r.block) {
            blockAvailable = true
            blkNum = blk.header.number;
            blkHash = blk.hash;
        }
        if (r.trace) traceAvailable = true
        if (r.events) eventAvailable = true

        //console.log(`[${blkNum}] [${blkHash}] Trace?${traceAvailable}, Events?${eventAvailable} , currTS=${this.getCurrentTS()}`)
        if (blockAvailable && traceAvailable) {
            // setup ParserContext here

            let blockNumber = blk.header.number;
            let blockHash = blk.hash;
            let blockTS = blk.blockTS;
            let processTraceStartTS = new Date().getTime()
            if (r.blockHash == undefined || r.blockHash.length != 66) {
                this.logger.error({
                    "op": "index_chain_block_row",
                    "bn": `${this.chainID}-${blockNumber}`,
                    "msg": 'missing blockHash - check source',
                })
            } else {
                let forceParseTrace = false;
                let traceType = this.compute_trace_type(r.trace, r.traceType);
                let api = (refreshAPI) ? await this.api.at(blockHash) : this.apiAt;
                if (blockTS >= traceParseTS) {
                    if (r.autotrace === false || r.autotrace == undefined || (r.autotrace && Array.isArray(r.autotrace) && r.autotrace.length == 0) || forceParseTrace) {
                        if (this.debugLevel >= paraTool.debugInfo) console.log(`[${blockNumber}] [${blockHash}] autotrace generation`);
                        autoTraces = await this.processTraceAsAuto(blockTS, blockNumber, blockHash, this.chainID, r.trace, traceType, api, isFinalized);
                        console.log(`[${blockNumber}] [${blockHash}] processTraceAsAuto generation`, isFinalized);
                    } else {
                        // if (this.debugLevel >= paraTool.debugTracing) SKIP PROCESSING since we covered autotrace generation already
                        console.log(`[${blockNumber}] [${blockHash}] processTraceAsAuto already covered len=${r.autotrace.length}`, isFinalized);
                        autoTraces = r.autotrace;
                    }
                    await this.processTraceFromAuto(blockTS, blockNumber, blockHash, this.chainID, autoTraces, traceType, api, isFinalized, isTip); // use result from rawtrace to decorate
                }
                let processTraceTS = (new Date().getTime() - processTraceStartTS) / 1000
                //console.log(`index_chain_block_row: processTrace`, processTraceTS);
                this.timeStat.processTraceTS += processTraceTS
                this.timeStat.processTrace++
            }
        }

        if (blockAvailable && eventAvailable) {
            let decodeRawBlockStartTS = new Date().getTime()
            if (!signedBlock) {
                let decodeRawBlockSignedBlockStartTS = new Date().getTime()
                signedBlock = await this.decodeRawBlock(r)
                let decodeRawBlockSignedBlockTS = (new Date().getTime() - decodeRawBlockSignedBlockStartTS) / 1000
                this.timeStat.decodeRawBlockSignedBlockTS += decodeRawBlockSignedBlockTS
                this.timeStat.decodeRawBlockSignedBlock++
            }
            r.block.extrinsics = signedBlock.block.extrinsics
            let decodeRawBlockTS = (new Date().getTime() - decodeRawBlockStartTS) / 1000
            this.timeStat.decodeRawBlockTS += decodeRawBlockTS
            this.timeStat.decodeRawBlock++

            let processBlockEventsStartTS = new Date().getTime()
            //console.log(`calling processBlockEvents evmBlock=${r.evmBlock.number}`)
            let tracesPresent = (r.trace) ? true : false;
            let isFinalized = true
            //processBlockEvents(chainID, block, eventsRaw, evmBlock = false, evmReceipts, evmTrace, autoTraces, finalized = false, false, isTip = false, tracesPresent = false)
            let [blockStats, xcmMeta] = await this.processBlockEvents(this.chainID, r.block, r.events, r.evmBlock, r.evmReceipts, r.evmTrace, autoTraces, isFinalized, false, isTip, tracesPresent);
            r.blockStats = blockStats
            r.xcmMeta = xcmMeta

            let processBlockEventsTS = (new Date().getTime() - processBlockEventsStartTS) / 1000
            this.timeStat.processBlockEventsTS += processBlockEventsTS
            this.timeStat.processBlockEvents++
        }
        return r;
    }

    synthetic_blockTS(chainID, blockNumber) {
        if (chainID == paraTool.chainIDStatemine || chainID == paraTool.chainIDStatemint || chainID == paraTool.chainIDShiden) {
            return 1577836800; // placeholder
        }
        if (chainID == 2058 && blockNumber < 78173) {
            return 1677087384 + 12 * blockNumber;
        }
        if (chainID == 22110 && blockNumber == 2) {
            return 1649774298;
        }

        return (false);
    }

    isH160Native(chainID) {
        if (chainID == paraTool.chainIDMoonbeam || chainID == paraTool.chainIDMoonriver) {
            return (true);
        }
        return (false);
    }

    async indexEVMTrace(chain, blockNumber) {
        await this.setup_chainParser(chain, this.debugLevel);
        //await this.initApiAtStorageKeys(chain, null, blockNumber);
        this.chainID = chain.chainID;
        console.log("evmtrace chainID=", chain.chainID, blockNumber);
        let rRow = await this.fetch_block_row(chain, blockNumber);
        let transactionsInternal = ethTool.processEVMTrace(rRow['evmTrace'], rRow['evmBlock'].transactions);
        //console.log(evmTrace.length, JSON.stringify(evmTrace, null, 4));
        console.log(transactionsInternal);
    }

    async initLabels() {
        let sql = `select label, fingerprintID, contractAddress, evmchainID, labelType, name, labelID, signature, signatureID, signatureRaw, abi, abiType, description from label`
        var labelRecs = await this.poolREADONLY.query(sql);
        let labels = {};
        for (const l of labelRecs) {
            let lrec = {
                label: (l.label) ? l.label : null,
                fingerprintID: (l.fingerprintID) ? `${l.fingerprintID}` : null,
                contractAddress: (l.contractAddress) ? `${l.contractAddress.toLowerCase()}` : null,
                evmchainID: (l.evmchainID) ? l.evmchainID : null,
                name: (l.name) ? `${l.name}` : null,
                signature: (l.signature) ? `${l.signature}` : null,
                signatureID: (l.signatureID) ? `${l.signatureID}` : null,
                signatureRaw: (l.signatureRaw) ? `${l.signatureRaw}` : null,
                abi: (l.abi) ? `${l.abi}` : null,
                abiType: (l.abiType) ? `${l.abiType}` : null,
                description: (l.description) ? `${l.description}` : null,
                fullKey: null,
                labelID: (l.labelID) ? `${l.labelID}` : null,
                labelID_generic: null,
                labelID_full: null,
            }
            //console.log(`lrec`, lrec)
            let evmChainID = lrec.evmchainID
            let contractAddress = lrec.contractAddress
            let signatureID = lrec.signatureID
            let modifiedFingerprintID = lrec.fingerprintID
            if (modifiedFingerprintID && modifiedFingerprintID.length == 21) {
                modifiedFingerprintID = signatureID
            } else if (modifiedFingerprintID && modifiedFingerprintID.length == 79) {
                modifiedFingerprintID = modifiedFingerprintID.substr(0, 68)
            }

            // create full key (modifiedFingerprintID_evmChainID_contractAddress) if possible
            if (modifiedFingerprintID && contractAddress && evmChainID) {
                let evmChainIDContractAddressKey = `${evmChainID}_${contractAddress}`
                let fullKey = `${modifiedFingerprintID}_${evmChainIDContractAddressKey}`
                lrec.fullKey = fullKey
                lrec.labelID_full = `${paraTool.sha1_4bytes(modifiedFingerprintID)}${paraTool.sha1_4bytes(evmChainIDContractAddressKey)}`
                lrec.labelID_unique = `${paraTool.sha1_4bytes(lrec.fingerprintID)}${paraTool.sha1_4bytes(evmChainIDContractAddressKey)}`
                lrec.labelID_generic = `${paraTool.sha1_4bytes(lrec.fingerprintID)}`
                //console.log(`fullKey***`, lrec)
                labels[fullKey] = lrec
                labels[lrec.labelID_unique] = lrec
            }

            // create generic key
            if (modifiedFingerprintID) {
                labels[modifiedFingerprintID] = lrec;
                lrec.labelID_generic = `${paraTool.sha1_4bytes(lrec.fingerprintID)}`
            }
            labels[lrec.labelID_generic] = lrec
            // TODO: handle case when either evmChainID or contractAddress is missing
        }
        this.labels = labels
        //console.log(`labels`, this.labels)
    }

    getLabelCandidate(acctAddr, modifiedFingerprintID, evmChainID = '', contractAddress = '') {
        let label = false
        let evmChainIDContractAddressKey = `${evmChainID}_${contractAddress}`
        let fullKey = `${modifiedFingerprintID}_${evmChainIDContractAddressKey}`
        if (this.labels[fullKey] != undefined) {
            let fullKeyLabel = this.labels[fullKey]
            console.log(`[${acctAddr}] getLabel fullkey ${fullKey}`, fullKeyLabel)
            return fullKeyLabel
        }
        if (this.labels[modifiedFingerprintID] != undefined) {
            let genricLabel = this.labels[modifiedFingerprintID]
            //console.log(`[${acctAddr}] getLabel generic ${modifiedFingerprintID}`, genricLabel)
            return genricLabel
        }
        return false
    }

    async initEvmSchemaMap() {

        await this.initLabels();
        let projectcontractabiRecs = await this.poolREADONLY.query(`select address, fingerprintID, name, projectName, abiType from projectcontractabi`);
        let projectcontractabi = {};
        for (const r of projectcontractabiRecs) {
            let subtableId = (r.abiType == "function") ? `call_project_${r.projectName}_${r.name}_${r.address}_${r.fingerprintID}` : `evt_project_${r.projectName}_${r.name}_${r.address}_${r.fingerprintID}`;
            if (projectcontractabi[r.fingerprintID] == undefined) {
                projectcontractabi[r.fingerprintID] = {};
            }
            projectcontractabi[r.fingerprintID][r.address] = {
                project: r.projectName,
                subtableId: subtableId,
                abiType: r.abiType,
                status: "Unknown"
            };
        }

        let evmDataset = this.evmDatasetID
        let schemaQuery = `SELECT table_name, column_name, data_type, ordinal_position, if (table_name like "call_%", "call", "evt") as tbl_type FROM substrate-etl.${evmDataset}.INFORMATION_SCHEMA.COLUMNS  where table_name like 'call_%'  or table_name like 'evt_%' order by table_name, ordinal_position`
        let tablesRecs = await this.execute_bqJob(schemaQuery);

        let evmSchemaMap = {}
        let evmFingerprintMap = {}
        let callExtraCol = ["chain_id", "evm_chain_id", "contract_address", "call_success", "call_tx_hash", "call_tx_index", "call_trace_address", "call_block_time", "call_block_number"]
        let eventExtraCol = ["chain_id", "evm_chain_id", "contract_address", "evt_tx_hash", "evt_index", "evt_block_time", "evt_block_number"]
        for (const t of tablesRecs) {
            let tblType = t.tbl_type
            let tableId = t.table_name
            let colName = t.column_name
            let ordinalIdx = t.ordinal_position - 1
            let fingerprintID = ethTool.getFingerprintIDFromTableID(tableId)
            if (evmSchemaMap[tableId] == undefined) {
                evmSchemaMap[tableId] = {};
            }
            if (evmFingerprintMap[fingerprintID] == undefined) {
                //evmFingerprintMap[fingerprintID] = tableId;
                evmFingerprintMap[fingerprintID] = {}
                evmFingerprintMap[fingerprintID].flds = []
                evmFingerprintMap[fingerprintID].tableId = tableId
                if (projectcontractabi[fingerprintID]) {
                    // when a first interaction happens with an address held in this map, we create another subtable for the project
                    evmFingerprintMap[fingerprintID].projectcontractabi = projectcontractabi[fingerprintID];
                }
            }
            if (tableId.includes("call_project_") || tableId.includes("evt_project_")) {
                let sa = tableId.split("_");
                let address = sa[4];
                if (evmFingerprintMap[fingerprintID].projectcontractabi[address].status == "Unknown") {
                    evmFingerprintMap[fingerprintID].projectcontractabi[address].status = "Created";
                }
            }
            if (tblType == 'call' && ordinalIdx >= callExtraCol.length) {
                // call input ordinals starts at callExtraColLen
                evmFingerprintMap[fingerprintID].flds.push(colName)
            } else if (tblType == 'evt' && ordinalIdx >= eventExtraCol.length) {
                // evt input ordinals starts at eventExtraCol
                evmFingerprintMap[fingerprintID].flds.push(colName)
            }
            evmSchemaMap[tableId][colName] = t.data_type;
            // TODO: get description for full ABI
        }
        this.evmSchemaMap = evmSchemaMap
        this.evmFingerprintMap = evmFingerprintMap
        console.log(`evmSchemaMap ${Object.keys(evmSchemaMap).length}`)
        console.log(`evmFingerprintMap ${Object.keys(evmFingerprintMap).length}`)
        console.log(`initEvmSchemaMap DONE`)
    }

    //????? REVIEW THIS
    getTableIDFromFingerprintID(fingerprintID, to_address = null) {
        let tableID = null;
        let subTableIDInfo = null;
        let a = (to_address) ? to_address.toLowerCase() : '';
        if (this.evmFingerprintMap[fingerprintID] != undefined) {
            tableID = this.evmFingerprintMap[fingerprintID].tableId
            if (this.evmFingerprintMap[fingerprintID].addresses) {
                console.log(to_address, a);
                if (this.evmFingerprintMap[fingerprintID].addresses[a] != undefined) {
                    subTableIDInfo = this.evmFingerprintMap[fingerprintID].addresses[a];
                }
            }
        }
        return [tableID, subTableIDInfo];
    }

    getSchemaFlds(fingerprintID) {
        let flds = false
        if (this.evmFingerprintMap[fingerprintID] != undefined) {
            flds = this.evmFingerprintMap[fingerprintID].flds
        }
        return flds
    }

    async setupEvmCallEventSchemaInfo(signature, fingerprintID, contractABIs, contractABISignatures) {
        //TODO: unknown fingerprintID is just ignore and we are not bothered to decode again - need refresh strategy
        if (this.evmUnknownFingerprintMap[fingerprintID]) {
            return false
        }
        console.log(`signature=${signature}, fingerprintID=${fingerprintID}`)
        let schemaInfo = ethTool.buildSchemaInfoFromFingerprintID(signature, fingerprintID, contractABIs, contractABISignatures)
        if (schemaInfo) {
            let schema = schemaInfo.schema
            let sch = schema.schema
            let tableId = schema.tableId
            // add to known mapping
            this.evmSchemaMap[tableId] = {}
            for (const s of sch) {
                this.evmSchemaMap[tableId][s.name] = s.type
            }
            this.evmFingerprintMap[fingerprintID] = {}
            this.evmFingerprintMap[fingerprintID].flds = ethTool.getEVMFlds(sch)
            this.evmFingerprintMap[fingerprintID].tableId = tableId
        } else {
            this.evmUnknownFingerprintMap[fingerprintID] = 1
        }
        return schemaInfo
    }

    generateEventBqRec(tableId, projectTableInfo, fingerprintID, evmLog, acctAddr) {
        try {
            let decodedEvents = JSON.parse(evmLog.events)
            let rec = {
                chain_id: evmLog.id, //string
                evm_chain_id: evmLog.chain_id, //integer
                contract_address: evmLog.address,
                evt_tx_hash: evmLog.transaction_hash,
                evt_index: evmLog.log_index,
                evt_block_time: evmLog.block_timestamp,
                evt_block_number: evmLog.block_number,
            }

            // used for labels
            let recBT = {
                chain_id: evmLog.id, //string
                evm_chain_id: evmLog.chain_id, //integer
                contract_address: evmLog.address,
                tx_hash: evmLog.transaction_hash,
                block_time: evmLog.block_timestamp,
                block_number: evmLog.block_number,
            }

            let eventLabel = this.getLabelCandidate(acctAddr, fingerprintID, rec.evm_chain_id, rec.contract_address)
            if (eventLabel) {
                //console.log(`generateEventBqRec eventLabel ***`, eventLabel)
                this.updateAddressLabelCandidates(acctAddr, eventLabel, recBT)
            }

            let flds = this.getSchemaFlds(fingerprintID)
            if (flds.length != decodedEvents.length) {
                this.logger.error({
                    op: "generateEventBqRec",
                    tableId: `${tableId}`,
                    error: `flds mismatch`,
                    flds: flds,
                    params: decodedEvents,
                })
                return [null, null];
            }
            for (let i = 0; i < decodedEvents.length; i++) {
                let fldName = flds[i]
                let dEvent = decodedEvents[i]
                let bqColType = ethTool.mapABITypeToBqType(dEvent.type)
                if (bqColType == 'JSON') {
                    rec[fldName] = JSON.stringify(dEvent.value)
                } else {
                    rec[fldName] = dEvent.value
                }
            }
            /*
              for (const dEvent of decodedEvents) {
              rec[dEvent.name] = dEvent.value
              }
            */
            let bqRec = {
                insertId: `${tableId}_${evmLog.transaction_hash}_${evmLog.log_index}`,
                json: rec
            }
            let bqRec2 = null
            if (projectTableInfo) {
                let subtableId = projectTableInfo.subtableId;
                bqRec2 = {
                    insertId: `${subtableId}_${evmLog.transaction_hash}_${evmLog.log_index}`,
                    json: rec
                }
            }
            return [bqRec, bqRec2]
        } catch (err) {
            console.log("generateEventBqRec", err);
            return [null, null];
        }
    }


    generateCallBqRec(tableId, projectTableInfo, fingerprintID, evmTx, acctAddr) {
        try {
            let decodedParams = evmTx.params ? JSON.parse(evmTx.params) : [];
            let rec = {
                chain_id: evmTx.id, //string
                evm_chain_id: evmTx.chain_id, //integer
                contract_address: evmTx.to_address,
                call_success: (evmTx.receipt_status == 1) ? true : false, //TODO
                call_tx_hash: evmTx.hash,
                call_tx_index: evmTx.transaction_index,
                call_block_time: evmTx.block_timestamp,
                call_block_number: evmTx.block_number,
            }

            // used for labels
            let recBT = {
                chain_id: evmTx.id, //string
                evm_chain_id: evmTx.chain_id, //integer
                contract_address: evmTx.to_address,
                tx_hash: evmTx.hash,
                block_time: evmTx.block_timestamp,
                block_number: evmTx.block_number,
            }

            let callLabel = this.getLabelCandidate(acctAddr, fingerprintID, rec.evm_chain_id, rec.contract_address)
            if (callLabel) {
                //console.log(`generateCallBqRec callLabel ***`, callLabel)
                this.updateAddressLabelCandidates(acctAddr, callLabel, recBT)
            }

            let flds = this.getSchemaFlds(fingerprintID)
            if (flds.length != decodedParams.length) {
                this.logger.error({
                    op: "generateCallBqRec",
                    tableId: `${tableId}`,
                    error: `flds mismatch`,
                    flds: flds,
                    params: decodedParams,
                })
                return [null, null];
            }
            for (let i = 0; i < decodedParams.length; i++) {
                let fldName = flds[i]
                let dParam = decodedParams[i]
                //console.log(`dParam[${i}]`, dParam)
                //TODO: parse tuple type
                if (ethTool.mapABITypeToBqType(dParam.type) == 'JSON') {
                    rec[fldName] = JSON.stringify(dParam.value)
                } else {
                    rec[fldName] = dParam.value
                }
            }
            /*
              for (const dParam of decodedParams) {
              if (ethTool.mapABITypeToBqType(dParam.type) == 'JSON') {
              rec[dParam.name] = JSON.stringify(dParam.value)
              } else {
              rec[dParam.name] = dParam.value
              }
              }
            */
            let bqRec = {
                insertId: `${tableId}_${evmTx.hash}`,
                json: rec
            }
            let bqRec2 = null
            if (projectTableInfo) {
                let subtableId = projectTableInfo.subtableId;
                bqRec2 = {
                    insertId: `${subtableId}_${evmTx.hash}`,
                    json: rec
                }
            }
            return [bqRec, bqRec2];
        } catch (err) {
            console.log("generateCallBqRec", err);
            return [null, null];
        }

    }


    async process_evm_flush(ts) {
        await this.flush_evm_label_candidates(ts)
    }

    // TWO ways to call this in EVM: (1) when new contracts are created (2) when candidate labels are ???
    async update_account_labels(address, candidate_labels_map, ts, assetType = null) {

        // TODO: (1) get_btTableRealtime, attempt row read
        let [tblName, tblRealtime] = this.get_btTableRealtime()
        const filter = [{
            column: {
                cellLimit: 1
            },
            families: ["realtime", "label"],
        }];
        let isRowFound = true
        let isStoredLabelFlound = false
        let rowData = false
        let storedLabels = false

        try {
            const [row] = await tblRealtime.row(address).get({
                filter
            });
            rowData = row.data;
            //console.log(`**** address ${address} rowData`, rowData)
            if (rowData.label != undefined) {
                storedLabels = rowData.label
                isStoredLabelFlound = true
            }
        } catch (err) {
            if (err && err.code == 404) {
                isRowFound = false
            } else {
                console.log(`err`, err.toString())
            }
        }
        let btLabelRowsToInsert = []
        // TODO: (2) if there is a row miss, label = "create", and add a new row of the asset_type, return true
        if (!isRowFound || !isStoredLabelFlound) {
            console.log(`address [${address}] isRowFound=${isRowFound}, isStoredLabelFlound=${isStoredLabelFlound}`)
            let hres = {
                key: address.toLowerCase(),
                data: {
                    label: {}
                }
            }
            for (const candidate_label of Object.keys(candidate_labels_map)) {
                let btRec = candidate_labels_map[candidate_label]
                hres['data']['label'][candidate_label] = {
                    value: JSON.stringify(btRec),
                    timestamp: ts * 1000000
                }
            }
            //console.log(`address ${address} hres***`, hres)
            btLabelRowsToInsert.push(hres)
        } else if (Array.isArray(Object.keys(storedLabels))) {
            // TODO: (3) if there is a row hit, get account labels and for any label in candidate_labels, if any are missing, then stream new labels (including { signature, fingerprint_id, method_id }) and return false
            let hres = {
                key: address.toLowerCase(),
                data: {
                    label: {}
                }
            }
            let labelMap = []
            let knownLabels = Object.keys(storedLabels)
            let duplicateLabels = []
            let newLabelFound = false
            console.log(`address [${address}] knownLabels`, knownLabels)
            for (const candidate_label of Object.keys(candidate_labels_map)) {
                let storedLabel = storedLabels[candidate_label]
                if (storedLabel == undefined) {
                    let btRec = candidate_labels_map[candidate_label]
                    hres['data']['label'][candidate_label] = {
                        value: JSON.stringify(btRec),
                        timestamp: ts * 1000000
                    }
                    newLabelFound = true
                } else {
                    //console.log(`existing storedLabel`, storedLabel)
                    if (storedLabel.timestamp / 1000000 > ts) {
                        /*
                        TODO: we have found new candidate label with earlier timestamp.
                        This likely happens due to us indexing the evm blocks in random order,
                        Should we update the label with earliest observed ts possible?
                        */
                    }
                    duplicateLabels.push(candidate_label)
                }
            }
            if (newLabelFound) {
                console.log(`address ${address} new labels ***`, hres)
                btLabelRowsToInsert.push(hres)
            } else {
                //console.log(`address ${address} duplicateLabels`, duplicateLabels)
            }
        }
        if (btLabelRowsToInsert.length > 0) {
            await tblRealtime.insert(btLabelRowsToInsert);
        }
    }

    async flush_evm_label_candidates(ts) {
        let addressLabelCandidates = this.addressLabelCandidates
        for (const address of Object.keys(addressLabelCandidates)) {
            let candidate_labels_map = addressLabelCandidates[address]
            //console.log(`flush_evm_label_candidates [${address}] candidate_labels_map`, candidate_labels_map)
            await this.update_account_labels(address, candidate_labels_map, ts)
        }
        this.addressLabelCandidates = {}
    }

    async stream_evm(evmlBlock, dTxns, dReceipts, evmTrace = false, chainID, contractABIs, contractABISignatures, stream_bq = true, write_bt = true) {
        const {
            BigQuery
        } = require('@google-cloud/bigquery');
        const bigquery = new BigQuery({
            projectId: 'substrate-etl',
            keyFilename: this.BQ_SUBSTRATEETL_KEY
        })
        let chain = await this.getChain(chainID);
        let rows_blocks = [];
        let rows_transactions = [];
        let rows_logs = [];
        let auto_evm_rows_map = {} // tableID => rows
        let auto_evm_schema_map = {} // tableID => rows

        let block = JSON.parse(JSON.stringify(evmlBlock))
        let evmFullBlock = await ethTool.fuseBlockTransactionReceipt(evmlBlock, dTxns, dReceipts, evmTrace, chainID)
        //console.log(`[#${block.number}] evmFullBlock`, evmFullBlock)
        let evm_chain_id = chainID
        let evm_blk_num = block.number
        let blockTS = block.timestamp
        let blockMicroTS = blockTS * 1000000
        let blockHash = block.hash

        let cres = {
            key: paraTool.blockNumberToHex(evm_blk_num),
            data: {
                /*
                blocks: {},
                logs: {},
                token_transfers: {},
                traces: {},
                transactions: {},
                contracts: {},
                */
            }
        }

        let gWei = 10 ** 9
        let ether = 10 ** 18
        let bqEvmBlock = {
            insertId: `${block.hash}`,
            json: {
                chain_id: chainID,
                id: chain.id,
                timestamp: block.timestamp,
                number: block.number,
                hash: block.hash,
                parent_hash: block.parentHash,
                nonce: block.nonce,
                sha3_uncles: block.sha3Uncles,
                logs_bloom: block.logsBloom,
                transactions_root: block.transactionsRoot,
                state_root: block.stateRoot,
                receipts_root: block.receiptsRoot,
                miner: block.miner,
                difficulty: paraTool.dechexToInt(block.difficulty),
                total_difficulty: paraTool.dechexToInt(block.totalDifficulty),
                size: block.size,
                extra_data: block.extraData,
                gas_limit: block.gasLimit,
                gas_used: block.gasUsed,
                transaction_count: block.transactions.length
            }
        }

        //console.log(`bqEvmBlock`, bqEvmBlock)
        rows_blocks.push(bqEvmBlock);

        for (let i = 0; i < evmFullBlock.transactions.length; i++) {
            let rawTx = block.transactions[i];
            let tx = evmFullBlock.transactions[i];
            //console.log(`rawTx`, rawTx)
            //console.log(`tx`, tx)
            let receipt = dReceipts[i] != undefined ? dReceipts[i] : null;
            let logs = receipt && receipt.decodedLogs ? receipt.decodedLogs : null;
            let txhash = tx.transactionHash
            tx.raw = tx.input; // ???
            tx.decodedLogs = logs; // fuse here
            let decodedInput = dTxns[i] != undefined && dTxns[i].decodedInput ? dTxns[i].decodedInput : null;
            //let decodedInput = tx[i] != undefined && tx[i].decodedInput ? tx[i].decodedInput : null;
            let methodID = null
            if (tx.to && tx.input.length >= 10) {
                methodID = tx.input.substr(0, 10)
            }
            let txType = (tx.txType != undefined) ? tx.txType : -1
            let evmTx = {
                chain_id: chainID,
                id: chain.id,
                hash: (tx.transactionHash != undefined) ? tx.transactionHash : rawTx.hash,
                nonce: tx.nonce,
                transaction_index: tx.transactionIndex,
                from_address: tx.from.toLowerCase(),
                to_address: (tx.to != undefined) ? tx.to.toLowerCase() : null,
                value: rawTx.value,
                gas: rawTx.gas,
                gas_price: rawTx.gasPrice,
                input: tx.input,
                receipt_cumulative_gas_used: receipt && receipt.cumulativeGasUsed ? receipt.cumulativeGasUsed : null,
                receipt_gas_used: receipt && receipt.gasUsed ? receipt.gasUsed : null,
                receipt_contract_address: receipt && receipt.contractAddress ? receipt.contractAddress : null,
                receipt_root: null, // irrelevant
                receipt_status: receipt && receipt.status ? 1 : 0,
                block_timestamp: block.timestamp,
                block_number: tx.blockNumber,
                block_hash: tx.blockHash,
                max_fee_per_gas: null,
                max_priority_fee_per_gas: null,
                transaction_type: txType,
                receipt_effective_gas_price: null,
                // polkaholic new fields
                fee: tx.fee,
                txn_saving: null,
                burned_fee: tx.burnedFee,
                decoded: false,
                method_id: methodID,
                signature: null,
                params: null
            }

            if (txType == 2) {
                //1559 (as gWei)
                evmTx.max_fee_per_gas = paraTool.floatToInt(tx.maxFeePerGas * gWei)
                evmTx.max_priority_fee_per_gas = paraTool.floatToInt(tx.maxPriorityFeePerGas * gWei)
                evmTx.txn_saving = (tx.txn_saving != undefined) ? paraTool.floatToInt(tx.txn_saving * ether) : 0
            }
            // use the value directly after reindexing
            if (tx.cumulativeGasUsed) {
                evmTx.receipt_cumulative_gas_used = tx.cumulativeGasUsed
            }
            if (tx.effectiveGasPrice) {
                evmTx.receipt_effective_gas_price = paraTool.floatToInt(tx.effectiveGasPrice * gWei)
            }

            //arbitrum 0x0 values??
            if (evmTx.value == "0x0") evmTx.value = 0
            if (evmTx.gas == "0x0") evmTx.gas = 0
            if (evmTx.gas_price == "0x0") evmTx.gas_price = 0
            if (evmTx.receipt_cumulative_gas_used == "0x0") evmTx.receipt_cumulative_gas_used = 0
            if (evmTx.receipt_gas_used == "0x0") evmTx.receipt_gas_used = 0

            if (decodedInput) {
                evmTx.decoded = (decodedInput.decodeStatus == 'success');
                evmTx.method_id = methodID;
                if (evmTx.decoded) {
                    evmTx.signature = decodedInput.signature;
                    evmTx.params = JSON.stringify(decodedInput.params);
                    // write specific call_ table
                    // try to find tableID
                    if (methodID != null) { //skip nativeTransfer
                        let acctAddr = tx.from.toLowerCase() // signer of the tx

                        let [tableID, projectTableInfo] = this.getTableIDFromFingerprintID(methodID, tx.to);
                        if (tableID) {
                            let [bqCall, bqCall2] = this.generateCallBqRec(tableID, projectTableInfo, methodID, evmTx, acctAddr)
                            if (bqCall) {
                                //console.log(`Auto generated bqCall ${methodID}->${tableID}\n`, bqCall)
                                if (auto_evm_rows_map[tableID] == undefined) {
                                    auto_evm_rows_map[tableID] = []
                                }
                                auto_evm_rows_map[tableID].push(bqCall)
                            }
                            // if there is no projectTableInfo set up yet, set it up with the same schema
                            if (projectTableInfo) {
                                let subtableID = projectTableInfo.subtableId;
                                if (projectTableInfo.status == "Unknown") {
                                    let schemaInfo = await this.setupEvmCallEventSchemaInfo(evmTx.signature, methodID, contractABIs, contractABISignatures);
                                    if (schemaInfo) {
                                        auto_evm_schema_map[subtableID] = schemaInfo
                                        console.log("*******1 CREATING SUBTABLEID", subtableID, schemaInfo);
                                    }
                                } else if (bqCall2) {
                                    if (auto_evm_rows_map[subtableID] == undefined) {
                                        auto_evm_rows_map[subtableID] = []
                                    }
                                    auto_evm_rows_map[subtableID].push(bqCall2)
                                    console.log("*******2 ADDING ROW SUBTABLEID", subtableID, bqCall2);
                                }
                            }
                        } else {
                            let schemaInfo = await this.setupEvmCallEventSchemaInfo(evmTx.signature, methodID, contractABIs, contractABISignatures)
                            if (schemaInfo) {
                                tableID = schemaInfo.schema.tableId
                                let [bqCall, bqCall2] = this.generateCallBqRec(tableID, projectTableInfo, methodID, evmTx, acctAddr)
                                // TODO: bqCall's label
                                if (schemaInfo && tableID) {
                                    console.log(`New call schemaInfo ${methodID}->${schemaInfo.schema.tableId}`, schemaInfo.schema, `\n call:\n`, evmTx.params)
                                    auto_evm_schema_map[tableID] = schemaInfo
                                }
                            } else {
                                //shouldn't get here?
                                console.log(`Unknown methodID ${methodID}\n`)
                            }
                        }

                    }
                }
            }
            let bqEvmTransaction = {
                insertId: `${tx.transactionHash}`,
                json: evmTx
            }
            console.log(`bq+`, bqEvmTransaction.json)
            rows_transactions.push(bqEvmTransaction);
            if (logs) {
                for (let j = 0; j < logs.length; j++) {
                    let l = logs[j]
                    let eSig = l.signature ? l.signature : null
                    let eFingerprintID = l.fingerprintID ? l.fingerprintID : null
                    let evmLog = {
                        chain_id: chainID,
                        id: chain.id,
                        log_index: l.logIndex,
                        transaction_hash: (tx.transactionHash != undefined) ? tx.transactionHash : rawTx.hash,
                        transaction_index: i,
                        address: l.address.toLowerCase(),
                        data: l.data,
                        topics: l.topics,
                        block_timestamp: block.timestamp,
                        block_number: block.number,
                        block_hash: block.hash,
                        signature: eSig,
                        events: (l.events) ? JSON.stringify(l.events) : null // blockchain-etl does NOT have signature, events
                    }
                    let bqEvmLog = {
                        insertId: `${tx.transactionHash}_${l.logIndex}`,
                        json: evmLog
                    }
                    //console.log(`bqEvmLog`, bqEvmLog)
                    rows_logs.push(bqEvmLog);

                    // write specific evt_ table
                    if (eSig) {
                        // try to find tableID
                        let acctAddr = tx.from.toLowerCase() // signer of the tx
                        let [tableID, projectTableInfo] = this.getTableIDFromFingerprintID(eFingerprintID, l.address)

                        if (tableID) { // existing table
                            let [bqEvent, bqEvent2] = this.generateEventBqRec(tableID, projectTableInfo, eFingerprintID, evmLog, acctAddr)
                            if (bqEvent && tableID) {
                                //console.log(`Auto generated bqEvent ${eFingerprintID}->${tableID}\n`, bqEvent)
                                if (auto_evm_rows_map[tableID] == undefined) {
                                    auto_evm_rows_map[tableID] = []
                                }
                                auto_evm_rows_map[tableID].push(bqEvent)
                            }
                            if (projectTableInfo) {
                                let subtableID = projectTableInfo.subtableId;
                                if (projectTableInfo.status == "Unknown") {
                                    console.log("*******3 CREATE PROJECT EVENTS TABLE", subtableID)
                                    let schemaInfo = await this.setupEvmCallEventSchemaInfo(eSig, eFingerprintID, contractABIs, contractABISignatures)
                                    if (schemaInfo) {
                                        auto_evm_schema_map[subtableID] = schemaInfo
                                    }
                                } else if (bqEvent2) {
                                    console.log(`*******4 PROJECTS EVENTS ROW ${subtableID}\n`, bqEvent2)
                                    if (auto_evm_rows_map[subtableID] == undefined) {
                                        auto_evm_rows_map[subtableID] = []
                                    }
                                    auto_evm_rows_map[subtableID].push(bqEvent2)
                                }
                            }
                        } else { // do the abi lookup
                            let schemaInfo = await this.setupEvmCallEventSchemaInfo(eSig, eFingerprintID, contractABIs, contractABISignatures)
                            if (schemaInfo) {
                                tableID = schemaInfo.schema.tableId
                                let [bqEvent, bqEvent2] = this.generateEventBqRec(tableID, projectTableInfo, eFingerprintID, evmLog, acctAddr)
                                if (auto_evm_rows_map[tableID] == undefined) {
                                    auto_evm_rows_map[tableID] = []
                                }
                                auto_evm_rows_map[tableID].push()
                                if (schemaInfo && tableID) {
                                    console.log(`New event schemaInfo ${eFingerprintID}->${schemaInfo.schema.tableId}`, schemaInfo.schema, `\n event:\n`, evmLog.events)
                                    auto_evm_schema_map[tableID] = schemaInfo
                                }
                            } else { //shouldn't get here?
                                console.log(`Unknown eFingerprintID ${eFingerprintID}\n`, eSig)
                            }
                        }


                    }
                }
            }
            // NOTE: we do not write out hashes yet (development)
            this.process_evm_transaction(tx, chainID, true, true, false); // isTip=true, finalized=true, writeBTSubstrate = FALSE
        }

        if (blockTS) {
            // crawl any token addresses, write to btRealtime
            await this.crawl_erc_tokens(evm_blk_num, blockTS, chainID);
            await this.process_evm_flush(blockTS)
        }

        if (write_bt) {
            // store into bt
            try {
                let tables = ["blocks", "transactions", "logs"]; // [ "contracts", "tokens", "token_transfers", "traces"]
                let currentDayMicroTS = paraTool.getCurrentDayTS() * 1000000 //last microsecond of a day - to be garbage collected 7 days after this
                for (const tbl of tables) {
                    let rows = null
                    cres.data[tbl] = {}
                    switch (tbl) {
                        case "blocks":
                            cres.data[tbl][blockHash] = {
                                value: JSON.stringify(rows_blocks[0].json),
                                timestamp: currentDayMicroTS
                            };
                            break;
                        case "transactions":
                            let raw_transactions = [];
                            for (const transaction of rows_transactions) {
                                raw_transactions.push(transaction.json)
                            }
                            cres.data[tbl][blockHash] = {
                                value: JSON.stringify(raw_transactions),
                                timestamp: currentDayMicroTS
                            };
                            //console.log(`transactions`, rows_transactions)
                            break;
                        case "logs":
                            let raw_logs = [];
                            for (const log of rows_logs) {
                                raw_logs.push(log.json)
                            }
                            cres.data[tbl][blockHash] = {
                                value: JSON.stringify(raw_logs),
                                timestamp: currentDayMicroTS
                            };
                            //console.log(`log`, rows_logs)
                            break;
                    }
                    console.log(`cres.data[${tbl}][${blockHash}]`, cres.data[tbl][blockHash])
                }
            } catch (e) {
                console.log(`bt error`, e)
                cres = false
            }

            let tbl = this.instance.table("evmchain" + chainID);
            if (cres) {
                try {
                    console.log(`update bt evmchain${chainID}`, cres)
                    await this.insertBTRows(tbl, [cres], "evmchain");
                } catch (e) {
                    console.log(`load err`, e);
                }
            }
        }

        if (!stream_bq) {
            return
        }

        // stream into blocks, transactions
        try {
            //let dataset = "evm";
            let dataset = "crypto_evm"
            let tables = ["blocks", "transactions", "logs"]; // [ "contracts", "tokens", "token_transfers"]
            for (const tbl of tables) {
                let rows = null
                let tblID = `${tbl}${chainID}`
                switch (tbl) {
                    case "blocks":
                        rows = rows_blocks;
                        break;
                    case "transactions":
                        rows = rows_transactions;
                        //console.log(`transactions`, rows_transactions)
                        break;
                    case "logs":
                        rows = rows_logs;
                        //console.log(`log`, rows_logs)
                        break;
                }
                if (rows && rows.length > 0) {
                    await bigquery
                        .dataset(dataset)
                        .table(tblID)
                        .insert(rows, {
                            raw: true
                        });
                    console.log(`WRITE ${dataset}:${tblID} len=${rows.length}`)
                }
            }
        } catch (err) {
            console.log("err", JSON.stringify(err)); // TODO: logger
        }

        // evm _call _evt datasetId
        let evmDatasetID = this.evmDatasetID;

        // update schems
        console.log(`new schemas`, Object.keys(auto_evm_schema_map))

        for (const schemaTableId of Object.keys(auto_evm_schema_map)) {
            let schemaInfo = auto_evm_schema_map[schemaTableId]
            let schema = schemaInfo.schema
            let sch = schema.schema
            let tinySchema = ethTool.getSchemaWithoutDesc(sch)
            let timePartitioning = schema.timePartitioning
            console.log(`${evmDatasetID}:${schemaTableId} `, sch)
            console.log(`${evmDatasetID}:${schemaTableId} tinySchema`, tinySchema)
            try {
                const [table] = await bigquery
                    .dataset(evmDatasetID)
                    .createTable(schemaTableId, {
                        schema: sch,
                        location: this.evmBQLocation,
                        timePartitioning: timePartitioning,
                    });

            } catch (err) {
                let errorStr = err.toString()
                if (!errorStr.includes('Already Exists')) {
                    console.log(`${evmDatasetID}:${schemaTableId} Error`, errorStr, `\nSchema:`, sch)
                    this.logger.error({
                        op: "auto_evm_schema_create",
                        tableId: `${schemaTableId}`,
                        error: errorStr,
                        schema: sch
                    })
                    await this.log_streaming_error(schemaTableId, "auto_evm_schema_create", sch, errorStr, evm_chain_id, evm_blk_num);
                }
            }
        }

        // stream into call_ ,  evt_ table
        console.log(`updated tableIds`, Object.keys(auto_evm_rows_map))

        let tableIds = Object.keys(auto_evm_rows_map)
        let autoEvmRowPromise = []
        let autoEvmRowPromiseTableId = []
        for (const tableId of Object.keys(auto_evm_rows_map)) {
            let rows = auto_evm_rows_map[tableId]
            //console.log(`${evmDatasetID}:${tableId} row`, rows)
            if (rows && rows.length > 0) {
                autoEvmRowPromiseTableId.push(tableId)
                autoEvmRowPromise.push(bigquery.dataset(evmDatasetID).table(tableId).insert(rows, {
                    raw: true
                }))
            }
        }
        let autoEvmRowStates;
        try {
            autoEvmRowStates = await Promise.allSettled(autoEvmRowPromise);
            //{ status: 'fulfilled', value: ... },
            //{ status: 'rejected', reason: Error: '.....'}
        } catch (e) {
            //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`crawlerInitPromise error`, e, crawlerInitStates)
            this.log_manager_error(e, "batchCrawlerInit", "Promise.allSettled");
        }
        for (let i = 0; i < autoEvmRowStates.length; i += 1) {
            let autoEvmRowState = autoEvmRowStates[i]
            let tableId = autoEvmRowPromiseTableId[i]
            let rows = auto_evm_rows_map[tableId]
            if (autoEvmRowState.status != undefined && autoEvmRowState.status == "fulfilled") {
                //console.log(`autoEvmRowState[${i}] fulfilled`, autoEvmRowState)
                console.log(`WRITE ${evmDatasetID}:${tableId} len=${rows.length}`)
            } else {
                let rejectedReason = JSON.parse(JSON.stringify(autoEvmRowState['reason']))
                let errorStr = rejectedReason.message
                if (errorStr) {
                    if (!errorStr.includes('Already Exists')) {
                        console.log(`${evmDatasetID}:${tableId} Error`, errorStr, `\nRows:`, rows)
                        await this.log_streaming_error(tableId, "auto_evm_row_insert", rows, errorStr, evm_chain_id, evm_blk_num);
                        this.logger.error({
                            op: "auto_evm_row_insert",
                            tableId: `${tableId}`,
                            error: errorStr,
                            rows: rows
                        })
                    }
                }
            }
        }
    }

    // create table streamingerror (tableId varchar(128), op varchar(128), streamObject mediumblob, streamingError blob, lastErrorDT date, numErrors int default 0, primary key (tableId, op) )
    async log_streaming_error(tableId, op, json_object, streamingError, chainID, blockNumber) {
        try {
            let sql = `insert into streamingerror ( tableId, op, streamObject, streamingError, lastErrorDT, numErrors, chainID, blockNumber ) values ('${tableId}', '${op}', ${mysql.escape(JSON.stringify(json_object))}, ${mysql.escape(streamingError)}, Now(), 1, '${chainID}', '${blockNumber}' ) on duplicate key update lastErrorDT = values(lastErrorDT), streamObject = values(streamObject), numErrors = numErrors + 1, chainID = values(chainID), blockNumber = values(blockNumber)`
            console.log(sql)
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        } catch (err) {
            console.log(err);
        }
    }

    async crawlEvmBlockTraces(evmRPCInternal, blockNumber, timeoutMS = 20000) {
        if (!evmRPCInternal) {
            return (false);
        }
        console.log(`crawlEvmBlockTraces crawlEvmBlockTraces`, evmRPCInternal)
        let hexBlocknumber = paraTool.blockNumberToHex(blockNumber);
        //eth does not support hex padding: 0x01047025 -> 0x1047025
        if (hexBlocknumber.substr(0, 3) == "0x0") hexBlocknumber = hexBlocknumber.replace("0x0", "0x")
        let cmd = `curl ${evmRPCInternal}  -X POST -H "Content-Type: application/json" --data '{"method":"debug_traceBlockByNumber","params":["${hexBlocknumber}", {"tracer": "callTracer"}],"id":1,"jsonrpc":"2.0"}'`
        //console.log(`crawlEvmBlockReceipts`, cmd)
        try {
            const {
                stdout,
                stderr
            } = await exec(cmd, {
                maxBuffer: 1024 * 64000
            });
            let receiptData = JSON.parse(stdout);
            if (receiptData.result) {
                console.log(blockNumber, receiptData.result.length, cmd);
                return (receiptData.result);
            }
            if (receiptData.error) {
                console.log(`debug_traceBlockByNumber cmd`, cmd)
                console.log(`debug_traceBlockByNumber error`, receiptData.error)
                return false
            }
            //console.log(`crawlEvmBlockReceipts`, cmd)
            return false;
        } catch (error) {
            this.logger.warn({
                "op": "debug_traceBlockByNumber",
                "cmd": cmd,
                "err": error
            })
            console.log(error);
        }
        return false;
    }

    async retryWithDelay(operation, maxRetries = 10, delay = 500, ctx = "", expectedNum = 0) {
        for (let i = 0; i < maxRetries; i++) {
            const result = await operation();
            //console.log(`retryWithDelay retry#${i} result`, result)
            if (result) {
                if (ctx.includes("crawlEvmBlockReceipts")) {
                    console.log(`retryWithDelay`, result)
                    console.log(`retryWithDelay success#${i} ctx=${ctx} returned`)
                    return result;
                } else {
                    console.log(`retryWithDelay success#${i} ctx=${ctx} returned`)
                    return result;
                }
            }
            if (i < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        console.log(`retryWithDelay Failed maxRetries(${maxRetries}) reached`)
        return false;
    }

    async crawlQNEvmBlockAndReceiptsWithRetry(evmRPCInternalApi, blockNumber, timeoutMS = 20000, maxRetries = 10, delay = 500) {
        if (!evmRPCInternalApi) {
            return (false);
        }
        let hexBlocknumber = paraTool.blockNumberToHex(blockNumber);
        //eth does not support hex padding: 0x01047025 -> 0x1047025
        if (hexBlocknumber.substr(0, 3) == "0x0") hexBlocknumber = hexBlocknumber.replace("0x0", "0x")
        let cmd = `curl ${evmRPCInternalApi}  -X POST -H "Content-Type: application/json" --data '{"method":"qn_getBlockWithReceipts","params":["${hexBlocknumber}"],"id":1,"jsonrpc":"2.0"}'`

        for (let i = 0; i < maxRetries; i++) {
            console.log(`crawlQNEvmBlockAndReceiptsWithRetry [${blockNumber}] try#${i}\n${cmd}`)
            try {
                const {
                    stdout,
                    stderr
                } = await exec(cmd, {
                    maxBuffer: 1024 * 64000
                });
                let receiptData = JSON.parse(stdout);
                if (receiptData.result) {
                    console.log(`qn_getBlockWithReceipts ${blockNumber} DONE`, cmd);
                    return (receiptData.result);
                }
                if (receiptData.error) {
                    console.log(`qn_getBlockWithReceipts cmd`, cmd)
                    console.log(`qn_getBlockWithReceipts error`, receiptData.error)
                }
                //console.log(`crawlEvmBlockReceipts`, cmd)
            } catch (error) {
                this.logger.warn({
                    "op": "qn_getBlockWithReceipts",
                    "cmd": cmd,
                    "err": error
                })
                console.log(error);
            }
            if (i < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        console.log(`retryWithDelay Failed maxRetries(${maxRetries}) reached`)
        return false;
    }

    async crawlEvmBlockTracesWithRetry(evmRPCInternal, blockNumber, timeoutMS = 20000, maxRetries = 10, delay = 500) {
        if (!evmRPCInternal) {
            return (false);
        }
        let hexBlocknumber = paraTool.blockNumberToHex(blockNumber);
        //eth does not support hex padding: 0x01047025 -> 0x1047025
        if (hexBlocknumber.substr(0, 3) == "0x0") hexBlocknumber = hexBlocknumber.replace("0x0", "0x")
        let cmd = `curl ${evmRPCInternal}  -X POST -H "Content-Type: application/json" --data '{"method":"debug_traceBlockByNumber","params":["${hexBlocknumber}", {"tracer": "callTracer"}],"id":1,"jsonrpc":"2.0"}'`

        for (let i = 0; i < maxRetries; i++) {
            console.log(`crawlEvmBlockTracesWithRetry try#${i}\n${cmd}`)
            try {
                const {
                    stdout,
                    stderr
                } = await exec(cmd, {
                    maxBuffer: 1024 * 640000
                });
                //console.log(`stdout`, stdout)
                let receiptData = JSON.parse(stdout);
                if (receiptData.result) {
                    console.log(`crawlEvmBlockTracesWithRetry ${blockNumber} DONE`, cmd);
                    return (receiptData.result);
                }
                if (receiptData.error) {
                    console.log(`crawlEvmBlockTracesWithRetry cmd`, cmd)
                    console.log(`crawlEvmBlockTracesWithRetry error`, receiptData.error)
                }
                //console.log(`crawlEvmBlockReceipts`, cmd)
            } catch (error) {
                this.logger.warn({
                    "op": "crawlEvmBlockTracesWithRetry",
                    "cmd": cmd,
                    "err": error
                })
                console.log(error);
            }
            if (i < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        console.log(`crawlEvmBlockTracesWithRetry Failed maxRetries(${maxRetries}) reached`)
        return false;
    }

    async crawlEvmBlockReceiptsWithRetry(evmRPCBlockReceiptsApi, blockNumber, timeoutMS = 20000, maxRetries = 10, delay = 500) {
        if (!evmRPCBlockReceiptsApi) {
            return (false);
        }
        let hexBlocknumber = paraTool.blockNumberToHex(blockNumber);
        //eth does not support hex padding: 0x01047025 -> 0x1047025
        if (hexBlocknumber.substr(0, 3) == "0x0") hexBlocknumber = hexBlocknumber.replace("0x0", "0x")
        let cmd = `curl ${evmRPCBlockReceiptsApi}  -X POST -H "Content-Type: application/json" --data '{"method":"eth_getBlockReceipts","params":["${hexBlocknumber}"],"id":1,"jsonrpc":"2.0"}'`

        for (let i = 0; i < maxRetries; i++) {
            console.log(`crawlEvmBlockReceipts try#${i}\n${cmd}`)
            try {
                const {
                    stdout,
                    stderr
                } = await exec(cmd, {
                    maxBuffer: 1024 * 64000
                });
                let receiptData = JSON.parse(stdout);
                if (receiptData.result) {
                    console.log(`eth_getBlockReceipts ${blockNumber} DONE`, cmd);
                    return (receiptData.result);
                }
                if (receiptData.error) {
                    console.log(`crawlEvmBlockReceipts cmd`, cmd)
                    console.log(`crawlEvmBlockReceipts error`, receiptData.error)
                }
                //console.log(`crawlEvmBlockReceipts`, cmd)
            } catch (error) {
                this.logger.warn({
                    "op": "crawlEvmBlockReceipts",
                    "cmd": cmd,
                    "err": error
                })
                console.log(error);
            }
            if (i < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        console.log(`retryWithDelay Failed maxRetries(${maxRetries}) reached`)
        return false;
    }

    async crawlEvmBlockReceipts(evmRPCBlockReceipts, blockNumber, timeoutMS = 20000, maxRetries = 10, delay = 500) {
        if (!evmRPCBlockReceipts) {
            return (false);
        }
        let hexBlocknumber = paraTool.blockNumberToHex(blockNumber);
        //eth does not support hex padding: 0x01047025 -> 0x1047025
        if (hexBlocknumber.substr(0, 3) == "0x0") hexBlocknumber = hexBlocknumber.replace("0x0", "0x")
        let cmd = `curl ${evmRPCBlockReceipts}  -X POST -H "Content-Type: application/json" --data '{"method":"eth_getBlockReceipts","params":["${hexBlocknumber}"],"id":1,"jsonrpc":"2.0"}'`
        console.log(`[${cmd}] crawlEvmBlockReceipts\n${cmd}`)
        try {
            const {
                stdout,
                stderr
            } = await exec(cmd, {
                maxBuffer: 1024 * 64000
            });
            let receiptData = JSON.parse(stdout);
            if (receiptData.result) {
                console.log(`eth_getBlockReceipts ${blockNumber} DONE`, cmd);
                return (receiptData.result);
            }
            if (receiptData.error) {
                console.log(`crawlEvmBlockReceipts cmd`, cmd)
                console.log(`crawlEvmBlockReceipts error`, receiptData.error)
                return false
            }
            //console.log(`crawlEvmBlockReceipts`, cmd)
            return false;
        } catch (error) {
            this.logger.warn({
                "op": "crawlEvmBlockReceipts",
                "cmd": cmd,
                "err": error
            })
            console.log(error);
        }
        return false;
    }

    async setupEvm(chainID) {
        let chain = await this.getChain(chainID);
        const bigquery = this.get_big_query();
        await this.initEvmSchemaMap()
        if (!(chain.isEVM > 0 && chain.WSEndpoint)) {
            return (false);
        }

        // TODO: extract this
        const Web3 = require('web3')
        let provider = null
        const startConnection = () => {
            provider = new Web3.providers.WebsocketProvider(
                chain.WSEndpoint, {
                    clientConfig: {
                        keepalive: true,
                        keepaliveInterval: -1
                    },
                    reconnect: {
                        auto: true,
                        delay: 5000,
                        maxAttempts: 5,
                        onTimeout: false
                    }
                }
            );
            provider.connection.addEventListener('close', () => {
                startConnection()
            })
        }
        startConnection();
        const web3 = new Web3(provider);
        this.web3Api = web3;
        if (chain.evmRPCBlockReceipts != undefined) {
            this.evmRPCBlockReceipts = chain.evmRPCBlockReceipts
        }
        if (chain.evmRPCInternal != undefined) {
            this.evmRPCInternal = chain.evmRPCInternal
        }
        if (chain.evmRPC != undefined) {
            this.evmRPC = chain.evmRPC
        }
        this.contractABIs = await this.getContractABI();

        let contractABIs = this.contractABIs;
        let contractABISignatures = this.contractABISignatures;
        await this.assetManagerInit()

    }

    async index_block_evm_from_bt(chainID, blkNum) {
        let families = ["blocks", "logs", "traces", "transactions"]
        let startTS = new Date().getTime();
        const evmTableChain = this.getEvmTableChain(chainID);
        let blkBNHex = paraTool.blockNumberToHex(blkNum);
        let [rows] = await evmTableChain.getRows({
            start: blkBNHex,
            end: blkBNHex,
            cellLimit: 1,
            family: families
        });
        //console.log(`blkBNHex=${blkBNHex}`, `rows`, rows)
        if (rows.length == 1) {
            try {
                await this.setupEvm(chainID)
                let row = rows[0];
                //let rRow = this.build_evm_block_from_row(row) // build "rRow" here so we pass in the same struct as fetch_block_row
                let [isValid, rRow] = this.validate_evm_row(row)
                console.log(`cached rRow`, rRow)
                if (isValid){
                    let r = await this.index_evm_chain_block_row(rRow, false, "stream_evm");
                    return r
                }
            } catch (err) {
                console.log(err)
                //this.log_indexing_error(err, `index_blocks_period`);
            }
        }
        return false
    }

    // not optimized
    async crawl_block_evm(chainID, blkNum) {
        let web3 = this.web3Api
        let contractABIs = this.contractABIs;
        let contractABISignatures = this.contractABISignatures;
        let evmRPCBlockReceiptsApi = this.evmRPCBlockReceipts
        let evmRPCInternalApi = this.evmRPCInternal

        let blockNumber = blkNum;
        let block = null;
        let blockHash = null
        let block_tries = 0;
        let block_retry_max = 10
        let block_retry_ms = 200
        let log_retry_max = 10
        let log_retry_ms = 2000
        let log_timeout_ms = 5000

        let stream_bq = false
        let write_bt = true

        let qnSupportedChainIDs = [paraTool.chainIDArbitrum, paraTool.chainIDOptimism, paraTool.chainIDPolygon]
        let res = false
        if (qnSupportedChainIDs.includes(chainID)) {
            res = await this.crawlQNEvmBlockAndReceiptsWithRetry(evmRPCInternalApi, blockNumber, 3000, 10, 2000)
        }
        if (res && res.block != undefined && res.receipts != undefined) {
            console.log(`[${blockNumber}] qn_getBlockReceipts OK`)
            block = ethTool.standardizeRPCBlock(res.block)
            let evmReceipts = ethTool.standardizeRPCReceiptLogs(res.receipts)
            //let evmReceipts = res.receipts
            let evmTrace = false
            if (evmRPCInternalApi) {
                evmTrace = await this.crawlEvmBlockTracesWithRetry(evmRPCInternalApi, blockNumber, log_timeout_ms, log_retry_max, log_retry_ms)
                //console.log(`[${block.number}] evmTrace`, evmTrace)
            }
            var statusesPromise = Promise.all([
                ethTool.processTranssctions(block.transactions, contractABIs, contractABISignatures),
                ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
            ])
            let [dTxns, dReceipts] = await statusesPromise
            console.log(`dTxns`, dTxns)
            await this.stream_evm(block, dTxns, dReceipts, evmTrace, chainID, contractABIs, contractABISignatures, stream_bq, write_bt)
        } else {
            let evmBlockFunc = ethTool.crawlEvmBlock(web3, blockNumber)
            let evmBlockCtx = `ethTool.crawlEvmBlock(web3, ${blockNumber})`
            block = await this.retryWithDelay(() => evmBlockFunc, block_retry_max, block_retry_ms, evmBlockCtx)
            //console.log(`blk #${blockNumber}`, block)
            //TODO: ethereum has withdrawals flds
            let numTransactions = block && block.transactions ? block.transactions.length : 0;
            console.log(`[#${block.number}] ${block.hash} numTransactions=${numTransactions}`)
            let rows_blocks = [];
            let rows_transactions = [];
            let rows_logs = [];
            try {
                blockHash = block.hash
                if (numTransactions >= 0) {
                    let isParallel = true
                    let evmReceipts = false

                    if (evmRPCBlockReceiptsApi) {
                        evmReceipts = await this.crawlEvmBlockReceiptsWithRetry(evmRPCBlockReceiptsApi, blockNumber, log_timeout_ms, log_retry_max, log_retry_ms)
                    } else {
                        let evmReceiptsFunc = ethTool.crawlEvmReceipts(web3, block, isParallel)
                        let evmReceiptsCtx = `ethTool.crawlEvmReceipts(web3, block, ${isParallel})`
                        evmReceipts = await this.retryWithDelay(() => evmReceiptsFunc, log_retry_max, log_retry_ms, evmReceiptsCtx)
                    }

                    if (!evmReceipts) evmReceipts = [];
                    evmReceipts = ethTool.standardizeRPCReceiptLogs(evmReceipts)
                    console.log(`[#${block.number}] evmReceipts DONE (len=${evmReceipts.length})`)
                    var statusesPromise = Promise.all([
                        ethTool.processTranssctions(block.transactions, contractABIs, contractABISignatures),
                        ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
                    ])
                    let [dTxns, dReceipts] = await statusesPromise
                    //console.log(`dTxns`, dTxns)
                    let evmTrace = false
                    if (evmRPCInternalApi) {
                        evmTrace = await this.crawlEvmBlockTracesWithRetry(evmRPCInternalApi, block.number, log_timeout_ms, log_retry_max, log_retry_ms)
                        console.log(`[${block.number}] evmTrace`, evmTrace)
                    }
                    await this.stream_evm(block, dTxns, dReceipts, evmTrace, chainID, contractABIs, contractABISignatures, stream_bq, write_bt)
                }
            } catch (err) {
                console.log(err)
            }
        }
    }

    async index_block_evm(chainID, blkNum) {
        let chain = await this.getChain(chainID);
        const bigquery = this.get_big_query();
        await this.initEvmSchemaMap()
        if (!(chain.isEVM > 0 && chain.WSEndpoint)) {
            return (false);
        }

        // TODO: extract this
        const Web3 = require('web3')
        let provider = null
        const startConnection = () => {
            provider = new Web3.providers.WebsocketProvider(
                chain.WSEndpoint, {
                    clientConfig: {
                        keepalive: true,
                        keepaliveInterval: -1
                    },
                    reconnect: {
                        auto: true,
                        delay: 5000,
                        maxAttempts: 5,
                        onTimeout: false
                    }
                }
            );
            provider.connection.addEventListener('close', () => {
                startConnection()
            })
        }
        startConnection();
        const web3 = new Web3(provider);
        this.web3Api = web3;
        if (chain.evmRPCBlockReceipts != undefined) {
            this.evmRPCBlockReceipts = chain.evmRPCBlockReceipts
        }
        if (chain.evmRPCInternal != undefined) {
            this.evmRPCInternal = chain.evmRPCInternal
        }
        if (chain.evmRPC != undefined) {
            this.evmRPC = chain.evmRPC
        }
        this.contractABIs = await this.getContractABI();

        let contractABIs = this.contractABIs;
        let contractABISignatures = this.contractABISignatures;
        await this.assetManagerInit()

        let evmRPCBlockReceiptsApi = this.evmRPCBlockReceipts
        let evmRPCInternalApi = this.evmRPCInternal

        let blockNumber = blkNum;
        let block = null;
        let blockHash = null
        let block_tries = 0;
        let block_retry_max = 10
        let block_retry_ms = 200
        let log_retry_max = 10
        let log_retry_ms = 2000
        let log_timeout_ms = 5000
        let stream_bq = false
        let write_bt = true

        let qnSupportedChainIDs = [paraTool.chainIDArbitrum, paraTool.chainIDOptimism, paraTool.chainIDPolygon]
        let res = false
        if (qnSupportedChainIDs.includes(chainID)) {
            res = await this.crawlQNEvmBlockAndReceiptsWithRetry(evmRPCInternalApi, blockNumber, 3000, 10, 2000)
        }
        if (res && res.block != undefined && res.receipts != undefined) {
            console.log(`[${blockNumber}] qn_getBlockReceipts OK`)
            //block = res.block
            /*
            let evmBlockFunc = ethTool.crawlEvmBlock(web3, blockNumber)
            let evmBlockCtx = `ethTool.crawlEvmBlock(web3, ${blockNumber})`
            block = await this.retryWithDelay(() => evmBlockFunc, block_retry_max, block_retry_ms, evmBlockCtx)
            */
            block = ethTool.standardizeRPCBlock(res.block)
            let evmReceipts = ethTool.standardizeRPCReceiptLogs(res.receipts)
            //let evmReceipts = res.receipts
            let evmTrace = false
            if (evmRPCInternalApi) {
                /*
                let evmTraceFunc = this.crawlEvmBlockTraces(evmRPCInternalApi, blockNumber)
                let evmTraceCtx = `this.crawlEvmBlockTraces(evmRPCInternalApi, ${blockNumber})`
                evmTrace = await this.retryWithDelay(() => evmTraceFunc, log_retry_max, log_retry_ms, evmTraceCtx)
                */
                evmTrace = await this.crawlEvmBlockTracesWithRetry(evmRPCInternalApi, blockNumber, log_timeout_ms, log_retry_max, log_retry_ms)
                //console.log(`[${block.number}] evmTrace`, evmTrace)
            }
            var statusesPromise = Promise.all([
                ethTool.processTranssctions(block.transactions, contractABIs, contractABISignatures),
                ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
            ])
            let [dTxns, dReceipts] = await statusesPromise
            console.log(`dTxns`, dTxns)
            await this.stream_evm(block, dTxns, dReceipts, evmTrace, chainID, contractABIs, contractABISignatures, stream_bq, write_bt)
        } else {
            let evmBlockFunc = ethTool.crawlEvmBlock(web3, blockNumber)
            let evmBlockCtx = `ethTool.crawlEvmBlock(web3, ${blockNumber})`
            block = await this.retryWithDelay(() => evmBlockFunc, block_retry_max, block_retry_ms, evmBlockCtx)
            //console.log(`blk #${blockNumber}`, block)
            //TODO: ethereum has withdrawals flds
            let numTransactions = block && block.transactions ? block.transactions.length : 0;
            console.log(`[#${block.number}] ${block.hash} numTransactions=${numTransactions}`)
            let rows_blocks = [];
            let rows_transactions = [];
            let rows_logs = [];
            try {
                blockHash = block.hash
                if (numTransactions > 0) {
                    let isParallel = true
                    let evmReceipts = false

                    if (evmRPCBlockReceiptsApi) {
                        evmReceipts = await this.crawlEvmBlockReceiptsWithRetry(evmRPCBlockReceiptsApi, blockNumber, log_timeout_ms, log_retry_max, log_retry_ms)
                    } else {
                        let evmReceiptsFunc = ethTool.crawlEvmReceipts(web3, block, isParallel)
                        let evmReceiptsCtx = `ethTool.crawlEvmReceipts(web3, block, ${isParallel})`
                        evmReceipts = await this.retryWithDelay(() => evmReceiptsFunc, log_retry_max, log_retry_ms, evmReceiptsCtx)
                    }

                    if (!evmReceipts) evmReceipts = [];
                    evmReceipts = ethTool.standardizeRPCReceiptLogs(evmReceipts)
                    console.log(`[#${block.number}] evmReceipts DONE (len=${evmReceipts.length})`)
                    var statusesPromise = Promise.all([
                        ethTool.processTranssctions(block.transactions, contractABIs, contractABISignatures),
                        ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
                    ])
                    let [dTxns, dReceipts] = await statusesPromise
                    console.log(`dTxns`, dTxns)
                    let evmTrace = false
                    if (evmRPCInternalApi) {
                        /*
                        let evmTraceFunc = this.crawlEvmBlockTraces(evmRPCInternalApi, block.number)
                        let evmTraceCtx = `this.crawlEvmBlockTraces(evmRPCInternalApi, ${block.number})`
                        evmTrace = await this.retryWithDelay(() => evmTraceFunc, log_retry_max, log_retry_ms, evmTraceCtx, numTransactions)
                        */
                        evmTrace = await this.crawlEvmBlockTracesWithRetry(evmRPCInternalApi, block.number, log_timeout_ms, log_retry_max, log_retry_ms)
                        //console.log(`[${block.number}] evmTrace`, evmTrace)
                    }
                    await this.stream_evm(block, dTxns, dReceipts, evmTrace, chainID, contractABIs, contractABISignatures, stream_bq, write_bt)
                }
            } catch (err) {
                console.log(err)
            }
        }
    }

    // fetches a SINGLE row r (of block, events + trace) with fetch_block_row and indexes the row with index_chain_block_row
    async index_block(chain, blockNumber, blockHash = null) {
        this.resetErrorWarnings()
        let elapsedStartTS = new Date().getTime();
        if (blockHash == undefined) {
            //need to fetch it..
            blockHash = await this.getBlockHashFinalized(chain.chainID, blockNumber)
        }
        await this.setup_chainParser(chain, this.debugLevel);
        await this.initApiAtStorageKeys(chain, blockHash, blockNumber);
        this.chainID = chain.chainID;
        blockNumber = paraTool.dechexToInt(blockNumber)
        //await this.setupChainAndAPI(chainID);

        try {
            let statRows = [];
            let rRow = await this.fetch_block_row(chain, blockNumber);
            let r = await this.index_chain_block_row(rRow);
            let blockHash = r.blockHash
            let parentHash = r.block.header && r.block.header.parentHash ? r.block.header.parentHash : false;
            let blockTS = r.block.blockTS
            let blockStats = r.blockStats
            let numExtrinsics = blockStats && blockStats.numExtrinsics ? blockStats.numExtrinsics : 0
            let numSignedExtrinsics = blockStats && blockStats.numSignedExtrinsics ? blockStats.numSignedExtrinsics : 0
            let numTransfers = blockStats && blockStats.numTransfers ? blockStats.numTransfers : 0
            let numEvents = blockStats && blockStats.numEvents ? blockStats.numEvents : 0
            let valueTransfersUSD = blockStats && blockStats.valueTransfersUSD ? blockStats.valueTransfersUSD : 0
            let fees = blockStats && blockStats.fees ? blockStats.fees : 0
            let feedTS = Math.floor(Date.now() / 1000)
            let indexTS = Math.floor(blockTS / 3600) * 3600;
            if (typeof blockTS === "undefined" || blockTS === false) {
                blockTS = this.synthetic_blockTS(this.chainID, blockNumber);
            } else {
                console.log("***!*$!*$*!*$*@#", blockTS);
            }
            if (!parentHash) {
                console.log(`missing parentHash! bn=${blockNumber}`, r.block, r.block.header);
            } else if (blockTS) {
                let sql = `('${blockNumber}', '${blockHash}', '${parentHash}', FROM_UNIXTIME('${blockTS}'), '${numExtrinsics}', '${numSignedExtrinsics}', '${numTransfers}', '${numEvents}', '${valueTransfersUSD}', '${fees}')`
                statRows.push(sql);
            }
            this.dump_update_block_stats(chain.chainID, statRows, indexTS)
            let elapsedTS = (new Date().getTime() - elapsedStartTS) / 1000
            await this.flush(indexTS, blockNumber, false, false); //ts, bn, isFullPeriod, isTip

            // errors, warns within this block ..
            let numIndexingErrors = this.numIndexingErrors;
            let numIndexingWarns = this.numIndexingWarns;
            if (this.chainParser) {
                numIndexingWarns += this.chainParser.numParserErrors;
            }
            this.sendManagerStat(numIndexingErrors, numIndexingWarns, elapsedTS)
            return (r.xcmMeta);
        } catch (err) {
            console.log(err);
            this.logger.warn({
                "op": "index_block",
                "chainID": chain.chainID,
                blockNumber,
                err
            })
            return (false);
        }
    }

    async update_indexlog_hourly(chain, daysago = 2) {
        try {
            let chainID = chain.chainID;
            // optimization: bound this better?
            let sqltmp = `select floor(unix_timestamp(blockDT)/3600)*3600 as f from block${chainID} where blockDT >= date(date_sub(Now(), interval ${daysago} DAY)) and blockDT < date_sub(Now(), INTERVAL 1 HOUR) group by f`
            console.log(sqltmp);
            let log = await this.poolREADONLY.query(sqltmp)
            let out = [];
            for (const s of log) {
                let [logDT0, hr0] = paraTool.ts_to_logDT_hr(s.f);
                out.push(`('${chainID}', '${s.f}', '${logDT0}', '${hr0}', 1)`)
            }
            let valstmp = ["indexTS", "logDT", "hr", "readyForIndexing"]
            await this.upsertSQL({
                "table": "indexlog",
                "keys": ["chainID"],
                "vals": valstmp,
                "data": out,
                "replace": valstmp
            });
            return (true);
        } catch (err) {
            this.log_indexing_error(err, "update_chain_assets");
            console.log(err);
            return (false);
        }
    }


    getSpecVersionAtBlockNumber(chain, bn) {
        if (chain.specVersions == undefined) return (null);
        let result = null;
        for (let i = 0; i < chain.specVersions.length; i++) {
            let sv = chain.specVersions[i];
            if (bn >= sv.blockNumber) {
                result = sv; // there could be a better one, cannot return it
            }
        }
        return (result);
    }

    async initApiAtStorageKeys(chain, blockHash = false, bn = 1) {
        // this.specVersion holdsesent when we call api.rpc.state.getRuntimeVersion / getSpecVersionMetadata
        // We use chain.specVersions -- an array of [specVersion, blockNumber] ordered by blockNumber -- of when specVersions change.
        // We look for the first blocknumber in that array >= bn which is the *expected* specVersion at that bn.
        // If this specVersion is the same as the last
        if (chain.specVersions !== undefined && Array.isArray(chain.specVersions) && chain.specVersions.length > 0) {
            let sv = this.getSpecVersionAtBlockNumber(chain, bn);
            if ((sv != null) && this.specVersion == sv.specVersion) {
                return (this.specVersion);
            }
            if (sv) {
                // we have a new specVersion, thus we need new metadata!
                this.specVersion = sv.specVersion;
            }
        }
        try {
            this.apiAt = await this.api.at(blockHash)
            var runtimeVersion = await this.api.rpc.state.getRuntimeVersion(blockHash)
            this.specVersion = runtimeVersion.toJSON().specVersion;

            await this.getSpecVersionMetadata(chain, this.specVersion, blockHash, bn);
            if (this.debugLevel >= paraTool.debugInfo) console.log("--- ADJUSTED API AT ", blockHash, this.specVersion)
        } catch (err) {
            this.apiAt = await this.api;
            var runtimeVersion = await this.api.rpc.state.getRuntimeVersion();
            this.specVersion = runtimeVersion.toJSON().specVersion;
            await this.getSpecVersionMetadata(chain, this.specVersion, false, bn);
            if (this.debugLevel >= paraTool.debugInfo) console.log("!!! ADJUSTED API AT ", blockHash, this.specVersion)
        }

        return this.specVersion
    }


    async index_blocks_period(chain, currPeriod = false, jmp = 720) {
        if (currPeriod == false) return
        if (!currPeriod.startBN) return
        if (!currPeriod.endBN) return
        let chainID = this.chainID
        let indexTS = currPeriod.indexTS
        let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        let indexStartTS = new Date().getTime();
        let specVersion = false
        let traceParseTS = this.getTraceParseTS()

        if ((hr == 23) || (hr < 6)) {
            let sql = (hr == 23) ? `update blocklog set updateAddressBalanceStatus = "Ready" where updateAddressBalanceStatus = "NotReady" and chainID = '${chainID}' and logDT = '${logDT}'` : `update blocklog set updateAddressBalanceStatus = "Ready" where updateAddressBalanceStatus = "NotReady" and chainID = '${chainID}' and logDT = date(date_sub('${logDT}', interval 1 day))`;
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        }

        await this.setup_chainParser(chain, this.debugLevel);
        this.resetErrorWarnings()
        // NOTE: we do not set this.tallyAsset = {}

        this.currentPeriodKey = indexTS;
        this.invertedHourKey = paraTool.inverted_ts_key(indexTS);
        if (currPeriod.eventsperblock > 50 || currPeriod.extrinsicsperblock > 30) {
            console.log(`WARNING: high usage block [jmp=${jmp}]`, currPeriod);
        }
        let nativeAsset = this.getNativeAsset(chainID)
        const tableChain = this.instance.table("chain" + chainID);
        let batchN = 0
        let totalBlkCnt = 1 + currPeriod.endBN - currPeriod.startBN
        let totalBatch = Math.floor(totalBlkCnt / jmp)
        if (totalBlkCnt % jmp != 0) totalBatch++

        let refreshAPI = false;

        for (let bn = currPeriod.startBN; bn <= currPeriod.endBN; bn += jmp) {
            batchN++
            let jmpStartTS = new Date().getTime();
            let startBN = bn
            let endBN = bn + jmp - 1;
            if (endBN > currPeriod.endBN) endBN = currPeriod.endBN;

            let start = paraTool.blockNumberToHex(startBN);
            let end = paraTool.blockNumberToHex(endBN);

            console.log(`\nindex_blocks_period chainID=${chainID}, ${startBN}(${start}), ${endBN}(${end}), indexTS=${indexTS} [${logDT} ${hr}] [${batchN}/${totalBatch}]`)

            let families = ["finalized", "trace", "autotrace", "blockraw", "events", "n"]
            if (chain.isEVM > 0) {
                families.push("blockrawevm");
            }
            let startTS = new Date().getTime();
            let [rows] = await tableChain.getRows({
                start,
                end,
                cellLimit: 1,
                family: families
            });
            let getRowsTS = (new Date().getTime() - startTS) / 1000;
            console.log("index_blocks_period: get rows", getRowsTS);
            this.timeStat.getRowsTS += getRowsTS
            this.timeStat.getRows++

            startTS = new Date().getTime();
            let startSpecVersion, endSpecVersion, endSpecVersionStartBN = null,
                endSpecVersionStartBlockHash = null;
            if (specVersion == false) {
                for (let j = 0; j < rows.length; j++) {
                    let row = rows[j];
                    let rowData = row.data;
                    if (rowData["finalized"]) {
                        this.timeStat.getRuntimeVersion++
                        let blockHashes = Object.keys(rowData["finalized"])
                        console.log(`bn=${bn}, blockHashes=${blockHashes}`)
                        for (const blockHash of Object.keys(blockHashes)) {
                            let _specVersion = await this.initApiAtStorageKeys(chain, blockHash, bn);
                            if (_specVersion != undefined) {
                                startSpecVersion = _specVersion;
                                endSpecVersion = _specVersion;
                                j = rows.length;
                                break;
                            }
                        }
                    }
                }
                let endSV = this.getSpecVersionAtBlockNumber(chain, currPeriod.endBN);
                if (endSV != null) {
                    endSpecVersion = endSV.specVersion;
                    endSpecVersionStartBN = endSV.blockNumber;
                    endSpecVersionStartBlockHash = endSV.blockHash;
                    if (startSpecVersion != endSpecVersion) {
                        refreshAPI = true; // Note: you could also set this flag more aggressively: on runtime upgrades, not just specVersion changes
                    }
                }
                if (refreshAPI) console.log("**** REFRESHAPI", startSpecVersion, endSpecVersion, currPeriod.endBN, refreshAPI);
                if (this.apiAt == undefined) {
                    this.logger.error({
                        "op": "index_blocks_period",
                        "msg": "no apiAt",
                        chainID,
                        logDT,
                        hr
                    })
                    console.log("NO API AT");
                    this.apiAt = this.api
                }
            }
            let getRuntimeVersionTS = (new Date().getTime() - startTS) / 1000
            if (getRuntimeVersionTS > 1) console.log("index_blocks_period: getRuntimeVersion", getRuntimeVersionTS);
            this.timeStat.getRuntimeVersionTS += getRuntimeVersionTS

            startTS = new Date().getTime();

            let statRows = [];
            for (let i = 0; i < rows.length; i++) {
                try {
                    let buildBlockFromRowStartTS = new Date().getTime()
                    let row = rows[i];
                    let rRow = this.build_block_from_row(row) // build "rRow" here so we pass in the same struct as fetch_block_row
                    let buildBlockFromRowTS = (new Date().getTime() - buildBlockFromRowStartTS) / 1000
                    this.timeStat.buildBlockFromRowTS += buildBlockFromRowTS
                    this.timeStat.buildBlockFromRow++
                    let r = await this.index_chain_block_row(rRow, false, true, refreshAPI, false, true, traceParseTS);
                    let blockNumber = r.blockNumber
                    let blockHash = r.blockHash
                    let parentHash = r.block.header && r.block.header.parentHash ? r.block.header.parentHash : false;
                    let blockTS = r.block.blockTS
                    let blockStats = r.blockStats
                    let numExtrinsics = blockStats && blockStats.numExtrinsics ? blockStats.numExtrinsics : 0
                    let numSignedExtrinsics = blockStats && blockStats.numSignedExtrinsics ? blockStats.numSignedExtrinsics : 0
                    let numTransfers = blockStats && blockStats.numTransfers ? blockStats.numTransfers : 0
                    let numEvents = blockStats && blockStats.numEvents ? blockStats.numEvents : 0
                    let numTraceRecords = blockStats && blockStats.numTraceRecords ? blockStats.numTraceRecords : 0;
                    let valueTransfersUSD = blockStats && blockStats.valueTransfersUSD ? blockStats.valueTransfersUSD : 0
                    let fees = blockStats && blockStats.fees ? blockStats.fees : 0
                    this.setLoggingContext({
                        chainID: chain.chainID,
                        blockNumber
                    });
                    let feedTS = Math.floor(Date.now() / 1000)
                    if (typeof blockTS === "undefined") {
                        blockTS = this.synthetic_blockTS(this.chainID, blockNumber);
                    }
                    if (!parentHash) {
                        console.log(`missing parentHash* bn=${blockNumber}`, r.block, r.block.header);
                    } else if (blockTS) {
                        let sql = `('${blockNumber}', '${blockHash}', '${parentHash}', FROM_UNIXTIME('${blockTS}'), '${numExtrinsics}', '${numSignedExtrinsics}', '${numTransfers}', '${numEvents}', '${valueTransfersUSD}', '${fees}')`
                        statRows.push(sql);
                    }
                    if (r != undefined) r = null
                } catch (err) {
                    this.log_indexing_error(err, `index_blocks_period`);
                }
            }
            let indexChainBlockRowTS = (new Date().getTime() - startTS) / 1000
            console.log(`index_blocks_period: index_chain_block_row ${rows.length} blocks`, indexChainBlockRowTS);
            this.timeStat.indexChainBlockRowTS += indexChainBlockRowTS
            this.timeStat.indexChainBlockRow++

            this.showCurrentMemoryUsage()
            this.dump_update_block_stats(chainID, statRows, indexTS)
            if (true) {
                //flush hashesRows
                startTS = new Date().getTime();
                await this.immediateFlushBlockAndAddressExtrinsics(false)
                let immediateFlushTS = (new Date().getTime() - startTS) / 1000
                this.timeStat.immediateFlushTS += immediateFlushTS
                this.timeStat.immediateFlush++
                this.timeStat.flush_f_TS += immediateFlushTS
                console.log(`index_blocks_period(jmp=${jmp}) flush HashesRows + BlockRows`, immediateFlushTS);
            }
            if (jmp <= 50 && false) {
                //todo: no reason to store hashesRows here. should flush immediately
                startTS = new Date().getTime();
                await this.flush(indexTS, endBN, false, false); //ts, bn, isFullPeriod, isTip
                let tinyFlushTS = (new Date().getTime() - startTS) / 1000
                console.log(`index_blocks_period(jmp=${jmp}): tiny flush`, tinyFlushTS);
            }
            let indexJmpTS = (new Date().getTime() - jmpStartTS) / 1000
            this.timeStat.indexJmpTS += indexJmpTS
            this.timeStat.indexJmp++
            this.showTimeUsage()
        }

        // flush out the hour of data to BT
        let finalFlushStartTS = new Date().getTime();
        await this.flush(indexTS, currPeriod.endBN, true, false); //ts, bn, isFullPeriod, isTip
        let finalFlushTS = (new Date().getTime() - finalFlushStartTS) / 1000
        //if (this.debugLevel >= paraTool.debugVerbose) console.log("index_blocks_period: total flush(a-f)", finalFlushTS);
        this.showTimeUsage()

        // record a record in indexlog
        let numIndexingErrors = this.numIndexingErrors;
        let numIndexingWarns = this.numIndexingWarns;
        if (this.chainParser) {
            numIndexingWarns += this.chainParser.numParserErrors;
        }
        let indexed = (numIndexingErrors == 0) ? 1 : 0;
        // mark relaychain period's xcmIndexed = 0 and xcmReadyForIndexing = 1 if indexing is successful and without errors.
        // this signals that the record is reeady for indexReindexXcm
        let xcmReadyForIndexing = (this.isRelayChain && indexed) ? 1 : 0;

        let elapsedSeconds = (new Date().getTime() - indexStartTS) / 1000
        let indexlogvals = ["logDT", "hr", "indexDT", "elapsedSeconds", "indexed", "readyForIndexing", "specVersion", "bqExists", "numIndexingErrors", "numIndexingWarns", "xcmIndexed", "xcmReadyForIndexing", "lastAttemptEndDT", "lastAttemptHostname"];
        await this.upsertSQL({
            "table": "indexlog",
            "keys": ["chainID", "indexTS"],
            "vals": indexlogvals,
            "data": [`('${chainID}', '${indexTS}', '${logDT}', '${hr}', Now(), '${elapsedSeconds}', '${indexed}', 1, '${this.specVersion}', 1, '${numIndexingErrors}', '${numIndexingWarns}', 0, '${xcmReadyForIndexing}', Now(), '${this.hostname}')`],
            "replace": indexlogvals
        });

        await this.upsertSQL({
            "table": "blocklog",
            "keys": ["chainID", "logDT"],
            "vals": ["loaded", "audited"],
            "data": [`('${chainID}', '${logDT}', '0', 'Unknown')`],
            "replace": ["loaded", "audited"]
        });

        await this.update_batchedSQL();
        this.logger.info({
            op: "index_blocks_period",
            numIndexingErrors: numIndexingErrors,
            numIndexingWarns: numIndexingWarns,
            elapsedSeconds: elapsedSeconds,
            chainID,
            logDT
        });
        console.log(`index_blocks_period(jmp=${jmp}) - Final ElapsedSeconds=${elapsedSeconds}`);
        this.resetTimeUsage()
        return elapsedSeconds
    }


    resetHashRowStat() {
        let newHashesRows = {
            substrateBlk: 0,
            evmBlk: 0,
            substrateTx: 0,
            evmTx: 0,
            evmTxPerBlk: [],
            substrateTxPerBlk: [],
        }
        this.stat.hashesRows = newHashesRows
    }

    resetAddressRowStat() {
        let newAddressRows = {
            uniqueAddr: 0,
            uniqueEVMAddr: 0,
            uniqueSubstrateAddr: 0,
            realtime: 0,
            history: 0,
            feed: 0,
            feedunfinalized: 0,
            feedtransfer: 0,
            feedreward: 0,
            feedcrowdloan: 0,
            xcmsend: 0,
            xcmreceive: 0,
        }
        this.stat.addressRows = newAddressRows
    }

    resetAddressStorageStat() {
        let newAddressStorage = {
            uniqueAddr: 0
        }
        this.stat.addressStorage = newAddressStorage
    }

    resetAssetholderStat() {
        let newAssetholder = {
            unique: 0,
            read: 0,
            write: 0,
            update: 0,
        }
        this.stat.assetholder = newAssetholder
    }

    resetAssetChainMap() {
        this.assetChainMap = {}
    }

    resetAddressStats() {
        this.resetAddressRowStat()
        this.resetAddressStorageStat()
        this.resetAssetholderStat()
    }

    async dump_update_block_stats(chainID, statRows, indexTS) {
        let i = 0;
        for (i = 0; i < statRows.length; i += 10000) {
            let j = i + 10000;
            if (j > statRows.length) j = statRows.length;
            await this.upsertSQL({
                "table": `block${chainID}`,
                "keys": ["blockNumber"],
                "vals": ["blockHash", "parentHash", "blockDT", "numExtrinsics", "numSignedExtrinsics", "numTransfers", "numEvents", "valueTransfersUSD", "fees"],
                "data": statRows.slice(i, j),
                "replace": ["numExtrinsics", "numSignedExtrinsics", "numTransfers", "numEvents", "valueTransfersUSD", "blockHash", "parentHash", "fees"],
                "replaceIfNull": ["blockDT"]
            });
        }
        let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        //console.log(`dump_update_block_stats indexTS=${indexTS} [${logDT} ${hr}] len=${statRows.length}`);
    }

    // goal: lookup index m which is LESS than el and n which IS element, and return n
    async specSearch(maxBlockNumber, el, manager, compare_fn) {
        var m = 1;
        var n = maxBlockNumber;

        while (n - m > 1) {
            var k = (n + m) >> 1;
            var cmp = await compare_fn(el, k, manager);
            if (cmp == null) {
                return false;
            } else if (cmp < 0) { // if ar[k] is < el then move n down
                m = k;
            } else { // if ar[k] is >= el then move m up
                n = k;
            }
        }
        var cmp = await compare_fn(el, n, manager);
        if (cmp == 0) {
            return n;
        }
        return false;
    }

    async update_spec_version(chainID, specVersion) {
        try {
            let chain = await this.getChain(chainID);
            let api = this.api;
            let maxBlockNumber = chain.blocksFinalized;
            if (maxBlockNumber == null) {
                console.log("update_spec_version no blocksFinalized! -- skip");
                return (false);
            }

            console.log("reading blocks looking for specVersion", specVersion, maxBlockNumber)
            let r = await this.specSearch(maxBlockNumber, specVersion, this, async function(a, bn, manager) {
                let sql = `select blockHash from block${chainID} where blockNumber = '${bn}'`
                let blocks = await manager.poolREADONLY.query(sql);
                if (blocks.length > 0) {
                    let blockHash = blocks[0].blockHash;
                    if (blockHash != undefined && blockHash.length > 10) {
                        let runtimeVersion = await api.rpc.state.getRuntimeVersion(blocks[0].blockHash);
                        let specVersion = runtimeVersion.toJSON().specVersion;
                        return (specVersion - a);
                    } else {
                        console.log("MISSING blockHash", sql);
                        return null
                    }
                } else {
                    console.log("MISSING bn", sql);
                    return null;
                }
            });
            if (r) {
                let sql = `select blockNumber, blockHash, from_unixtime(blockDT) as blockTS, blockHash from block${chainID} where blockNumber = '${r}'`
                let blocks = await this.poolREADONLY.query(sql);
                if (blocks.length > 0) {
                    let b = blocks[0];
                    let blockHash = b.blockHash;
                    let metadataRaw = blockHash ? await this.api.rpc.state.getMetadata(blockHash) : await this.api.rpc.state.getMetadata();
                    let metadata = metadataRaw.asV14.toJSON();
                    await this.upsertSQL({
                        "table": "specVersions",
                        "keys": ["chainID", "specVersion"],
                        "vals": ["blockNumber", "blockHash", "firstSeenDT", "metadata"],
                        "data": [`('${chainID}', '${specVersion}', '${b.blockNumber}', '${b.blockHash}', Now(), ${mysql.escape(JSON.stringify(metadata))})`],
                        "replace": ["blockNumber", "blockHash", "firstSeenDT", "metadata"]
                    });
                }
            }
        } catch (err) {
            console.log(err)
        }
        return false
    }

    async updateSpecVersions(chain) {
        let specVersions = await this.poolREADONLY.query(`select specVersion, UNIX_TIMESTAMP(firstSeenDT) as firstSeenTS from specVersions where chainID = ${chain.chainID} and blockNumber is Null order by chainID, specVersion`);
        for (let i = 0; i < specVersions.length; i++) {
            let specVersion = specVersions[i].specVersion;
            // goal: search for the first blockNumber which is the same as specVersion
            await this.update_spec_version(chain.chainID, specVersion);
        }
    }

}
