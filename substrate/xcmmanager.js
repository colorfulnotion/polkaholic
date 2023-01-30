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

module.exports = class XCMManager extends Query {
    constructor() {
        super("manager")
    }

    xcmErrorMap = {}
    lastupdateTS = 0
    irregularFeeUSDThreshold = 5 //consider feeUSD above this threshold "Irregular" -  historically feeUSD should be lower than the ED

    init_xcm_error_map() {
        this.loadXCMErrorDescription()
    }

    setDebugLevel(debugLevel = paraTool.debugInfo) {
        this.debugLevel = debugLevel
    }

    async setupChainAndAPI(chainID, withSpecVersions = true, backfill = false) {
        let chain = await this.getChainWithVersion(chainID, withSpecVersions);
        await this.setupAPI(chain, backfill);
        this.relayChain = chain.relayChain;
        return (chain);
    }

    async auditMsgHash(limit = 1000) {
        let sql = `select msgHash, msgHex from xcmmessages where msgHashAudited = -1 order by blockTS desc limit ${limit}`;
        let msgs = await this.poolREADONLY.query(sql)
        let hashMap = {}
        let validHashes = []
        let invalidHashes = []
        let unknownErrHashes = []
        for (const m of msgs) {
            try {
                let rawMsgHash = `${m.msgHash}`
                if (hashMap[rawMsgHash] != undefined) continue
                hashMap[rawMsgHash] = 1
                let rawHex = `${m.msgHex}`
                let instructions = this.api.registry.createType('XcmVersionedXcm', rawHex);
                let derivedInstructionHex = instructions.toHex()
                if (derivedInstructionHex != rawHex) {
                    let remaining = '0x' + rawHex.replace(derivedInstructionHex, '')
                    console.log(`mismatch!! [msgHash=${rawMsgHash}] rawHexLen=${rawHex.length-2}, derivedHexLen${derivedInstructionHex.length-2}), remainingLen=${remaining.length-2}`)
                    invalidHashes.push(rawMsgHash)
                } else {
                    //console.log(`valid [msgHash=${rawMsgHash}] rawHex=${rawHex}, derivedHex=${derivedInstructionHex}`)
                    validHashes.push(rawMsgHash)
                }
            } catch (e) {
                console.log(`auditMsgHash error`, e, m)
                if (m.msgHash != undefined) unknownErrHashes.push(m.msgHash)
            }
        }
        if (validHashes.length > 0) {
            let validHashList = "'" + validHashes.join("','") + "'"
            let validSQL = `update xcmmessages set msgHashAudited = 1 where msgHash in (${validHashList})`
            console.log(`mark valid sz=${validHashes.length}`)
            this.batchedSQL.push(validSQL);
        }
        if (invalidHashes.length > 0) {
            let invalidHashList = "'" + invalidHashes.join("','") + "'"
            let invalidSQL = `update xcmmessages set msgHashAudited = 0 where msgHash in (${invalidHashList})`
            console.log(`mark invalid sz=${invalidHashes.length}`, invalidSQL)
            this.batchedSQL.push(invalidSQL);
        }
        if (unknownErrHashes.length > 0) {
            let unknownErrHashesList = "'" + unknownErrHashes.join("','") + "'"
            let unknownSQL = `update xcmmessages set msgHashAudited = -2 where msgHash in (${unknownErrHashesList})`
            console.log(`mark unknown sz=${unknownErrHashes.length}`, unknownSQL)
            this.batchedSQL.push(unknownSQL);
        }
        await this.update_batchedSQL();
        if (msgs.length == 0) {
            //DONE
            return false
        }
        return true
    }

    // generates xcmmessagelog, xcmassetlog, and tallies activity in last 24h/7d/30 in channel, xcmasset
    async update_xcmlogs(lookbackDays = 1) {
        // tally all the symbols
        let sql = `select chainID, chainIDDest, symbol, relayChain, sum(numXCMTransfersOutgoingUSD) numXCMTransfersOutgoingUSD, sum(valXCMTransferOutgoingUSD) valXCMTransferOutgoingUSD from xcmassetlog where logDT >= date_sub(Now(), interval 90 day) group by chainID, chainIDDest, symbol, relayChain order by numXCMTransfersOutgoingUSD desc, valXCMTransferOutgoingUSD desc`;
        let channel_symbols = await this.poolREADONLY.query(sql)
        let channel = {}
        for (const c of channel_symbols) {
            let k = `${c.chainID}:${c.chainIDDest}`
            let symbolChain = paraTool.makeAssetChain(c.symbol, c.relayChain);
            if (channel[k] == undefined) {
                channel[k] = {};
            }
            channel[k][symbolChain] = {
                numXCMTransfersOutgoingUSD: c.numXCMTransfersOutgoingUSD,
                valXCMTransferOutgoingUSD: c.valXCMTransferOutgoingUSD
            };
        }
        let out = [];
        for (const k of Object.keys(channel)) {
            let symbols = JSON.stringify(Object.keys(channel[k]))
            let [chainID, chainIDDest] = k.split(":");
            out.push(`('${chainID}', '${chainIDDest}', ${mysql.escape(symbols)})`)
        }
        await this.upsertSQL({
            "table": `channel`,
            "keys": ["chainID", "chainIDDest"],
            "vals": ["symbols"],
            "data": out,
            "replace": ["symbols"],
        });

        // tally recent xcmmessages into xcmmessagelog (up to lookbackDays)  -- which has a daily log of chainID/chainIDDest/logDT
        let sql_xcmmessagelog = `insert into xcmmessagelog
      (select chainID, chainIDDest,
        date(from_unixtime(destTS)) as logDT,
        count(*) as numXCMMessagesOutgoingUSD,
        sum(amountReceivedUSD) as valXCMMessagesOutgoingUSD
      from xcmmessages where matched = 1 and incoming = 1 and sourceTS >= unix_timestamp(date(date_sub(Now(), interval ${lookbackDays} day)))
      group by chainID, chainIDdest, logDT)
      on duplicate key update numXCMMessagesOutgoingUSD = values(numXCMMessagesOutgoingUSD), valXCMMessagesOutgoingUSD = values(valXCMMessagesOutgoingUSD);`
        this.batchedSQL.push(sql_xcmmessagelog);
        await this.update_batchedSQL();

        // tally recent xcmtransfer into xcmassetlog (up to lookbackDays) -- which has a daily log of symbol/relayChain/logDT
        let sql_xcmassetlog = `insert into xcmassetlog
      (select xcmasset.symbol, xcmasset.relayChain,
        date(from_unixtime(destTS)) as logDT,
        xcmtransfer.chainID,
        xcmtransfer.chainIDDest,
        count(*) as numXCMTransfersOutgoingUSD,
        sum(amountReceivedUSD) as valXCMTransferOutgoingUSD
      from asset, xcmtransfer join xcmasset on xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey
        where incomplete = 0 and
        sourceTS >= unix_timestamp(date(date_sub(Now(), interval ${lookbackDays} day))) and
        destTS is not null and
        asset.xcmInteriorKey = xcmasset.xcmInteriorKey and
        asset.chainID = xcmtransfer.chainID
      group by xcmasset.symbol, xcmasset.relayChain, logDT, chainID, chainIDdest)
      on duplicate key update numXCMTransfersOutgoingUSD = values(numXCMTransfersOutgoingUSD), valXCMTransferOutgoingUSD = values(valXCMTransferOutgoingUSD);`
        this.batchedSQL.push(sql_xcmassetlog);
        await this.update_batchedSQL();

        let daysAgoIntervals = [1, 7, 30]
        for (const daysAgo of daysAgoIntervals) {
            // tally recent xcmmessages into channel (1/7/30d)
            let sql_channel = `update channel, (select chainID, chainIDDest, count(*) as numXCMMessagesOutgoing, sum(amountReceivedUSD) as valXCMMessagesOutgoingUSD from xcmmessages where blockTS >= unix_timestamp(date_sub(Now(), interval ${daysAgo} day)) and matched = 1 and incoming = 1
             group by chainID, chainIDdest)  as t
              set channel.numXCMMessagesOutgoing${daysAgo}d = t.numXCMMessagesOutgoing,
              channel.valXCMMessagesOutgoingUSD${daysAgo}d = t.valXCMMessagesOutgoingUSD
             where  channel.chainID = t.chainID and
                    channel.chainIDDest = t.chainIDDest`;
            //console.log(daysAgo, sql_channel);
            this.batchedSQL.push(sql_channel);
            await this.update_batchedSQL();
            // tally recent xcmtransfer into xcmasset (1/7/30d)
            let sql_xcmasset = `update xcmasset, (    select xcmasset.symbol, xcmasset.relayChain, count(*) as numXCMTransfer,  sum(amountReceivedUSD) as valXCMTransferUSD
                  from asset, xcmtransfer join xcmasset on xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey
                    where incomplete = 0 and
                    sourceTS >= unix_timestamp(date(date_sub(Now(), interval 1 day))) and
                    destTS is not null and
                    asset.xcmInteriorKey = xcmasset.xcmInteriorKey and
                    asset.chainID = xcmtransfer.chainID
                  group by xcmasset.symbol, xcmasset.relayChain )  as t
                set xcmasset.numXCMTransfer${daysAgo}d = t.numXCMTransfer,
                xcmasset.valXCMTransferUSD${daysAgo}d = t.valXCMTransferUSD
               where  xcmasset.symbol = t.symbol and
                      xcmasset.symbol = t.symbol`;
            //console.log(daysAgo, sql_xcmasset);
            this.batchedSQL.push(sql_xcmasset);
            await this.update_batchedSQL();
        }
    }

    async patchXcmAsset() {
        let alphaAssets = await this.poolREADONLY.query(`select assetType, asset.assetName, asset.numHolders, asset.totalSupply, asset.asset, asset.symbol, asset.xcmInteriorKey, xcmasset.symbol as xcmasset_symbol, xcmasset.relayChain as xcmasset_relayChain, asset.decimals, asset.token0, asset.token0Symbol, asset.token0Decimals, asset.token1, asset.token1Symbol, asset.token1Decimals, asset.chainID, chain.id, chain.chainName, asset.isUSD, asset.priceUSD, asset.priceUSDPercentChange,  asset.nativeAssetChain, currencyID, xcContractAddress, from_unixtime(createDT) as createTS from asset left join xcmasset on asset.xcmInteriorKey = xcmasset.xcmInteriorKey, chain where asset.chainID = chain.chainID and assetType in ('Token') and asset.chainID = ${paraTool.chainIDMoonbaseAlpha}`);
        let alphaMap = {}
        for (const a of alphaAssets) {
            //console.log(a)
            let alphaSymbol = a.symbol.replace('xc', '')
            let relayChain = paraTool.getRelayChainByChainID(a.chainID)
            let alphaSymbolRelayChain = paraTool.makeAssetChain(alphaSymbol, relayChain)
            alphaMap[alphaSymbolRelayChain] = a
        }
        //console.log(`alphaMap`, alphaMap)
        let relayChain = paraTool.getRelayChainByChainID(paraTool.chainIDMoonbaseAlpha)
        let xcmAssets = await this.poolREADONLY.query(`select * from xcmasset where relayChain = '${relayChain}'`);
        let xcmAssetsOut = []
        let assetsOut = []
        for (const x of xcmAssets) {
            //console.log(x)
            let symbol = x.symbol
            let relayChain = x.relayChain
            let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain)
            let alphaAsset = alphaMap[symbolRelayChain]
            if (alphaAsset != undefined) {
                //console.log(`${symbolRelayChain} found, decimals`, alphaAsset.decimals)
                let t = "(" + [`'${x.xcmInteriorKey}'`, `'${symbol}'`, `'${relayChain}'`, `'${x.parent}'`, `'${x.nativeAssetChain}'`, `'${alphaAsset.decimals}'`, `Now()`].join(",") + ")";
                xcmAssetsOut.push(t)
                let xcContractAddress = paraTool.xcAssetIDToContractAddr(alphaAsset.currencyID).toLowerCase()
                let t1 = "(" + [`'${alphaAsset.asset}'`, `'${alphaAsset.chainID}'`, `'${x.xcmInteriorKey}'`, `'${xcContractAddress}'`].join(",") + ")";
                assetsOut.push(t1)
            } else {
                console.log(`${symbolRelayChain} not found`)
            }
        }
        //symbol, relayChain, xcmInteriorKey, xcmChainID, parent, nativeAssetChain, decimals
        let sqlDebug = true
        let xcmAssetsVals = ["parent", "nativeAssetChain", "decimals", "addDT"]
        await this.upsertSQL({
            "table": `xcmasset`,
            "keys": ["xcmInteriorKey", "symbol", "relayChain"],
            "vals": xcmAssetsVals,
            "data": xcmAssetsOut,
            "replace": xcmAssetsVals
        }, sqlDebug);

        let assetsVals = ["xcmInteriorKey", "xcContractAddress"]
        await this.upsertSQL({
            "table": `asset`,
            "keys": ["asset", "chainID"],
            "vals": ["xcmInteriorKey", "xcContractAddress"],
            "data": assetsOut,
            "replace": assetsVals
        }, sqlDebug);
    }

    async updateHrmpChannelEvents() {
        let msgs = await this.poolREADONLY.query("select msgHash, sentAt, sourceTS, from_unixtime(sourceTS) as messageDT, chainID, chainIDDest, msgStr from xcmmessages where ((incoming = 0 and matched = 0) or ( incoming = 1 and matched = 1 )) and msgStr like '%hrmp%' limit 200000;");
        let openRequests = [];
        let accepts = [];
        let closings = [];
        for (const m of msgs) {
            let msg = JSON.parse(m.msgStr)
            let chainID = m.chainID;
            let relayChain = paraTool.getRelayChainByChainID(m.chainID);
            let chainIDDest = m.chainIDDest;
            for (const ver of Object.keys(msg)) {
                let instructions = msg[ver];
                for (const inst of instructions) {
                    if (inst.hrmpNewChannelOpenRequest) { // Ex: { hrmpNewChannelOpenRequest: { sender: 2035, maxMessageSize: 102400, maxCapacity: 1000 }}
                        let i = inst.hrmpNewChannelOpenRequest;
                        let fromChainID = paraTool.getChainIDFromParaIDAndRelayChain(i.sender, relayChain);
                        openRequests.push(`('${fromChainID}', '${chainIDDest}', '${relayChain}', '${m.msgHash}', '${m.sentAt}', ${mysql.escape(m.sourceTS)}, '${i.maxMessageSize}', '${i.maxCapacity}', Now(), '${m.sentAt}', 'Requested')`);
                        console.log("hrmpMsg OPEN REQUEST", m.messageDT, relayChain, fromChainID, chainIDDest, i.maxMessageSize, i.maxCapacity);
                    } else if (inst.hrmpChannelAccepted) { // Ex: { hrmpChannelAccepted: { recipient: 2035 } }
                        let i = inst.hrmpChannelAccepted;
                        let toChainID = paraTool.getChainIDFromParaIDAndRelayChain(i.recipient, relayChain);
                        accepts.push(`( '${chainIDDest}', '${toChainID}', '${relayChain}', '${m.msgHash}', '${m.sentAt}', ${mysql.escape(m.sourceTS)}, Now(), '${m.sentAt}', 'Accepted')`);
                        console.log("hrmpMsg CHANNEL ACCEPTED", m.messageDT, relayChain, chainIDDest, toChainID);
                    } else if (inst.hrmpChannelClosing) { // Ex: hrmpChannelClosing: { initiator: 2001, sender: 2000, recipient: 2001 }
                        let i = inst.hrmpChannelClosing;
                        let closingInitiatorChainID = paraTool.getChainIDFromParaIDAndRelayChain(i.initiator, relayChain);
                        let senderChainID = paraTool.getChainIDFromParaIDAndRelayChain(i.sender, relayChain);
                        let recipientChainID = paraTool.getChainIDFromParaIDAndRelayChain(i.recipient, relayChain);
                        let sql2 = `select chainID, chainIDDest, lastUpdateBN from hrmpchannel where ( chainID = '${senderChainID}' and chainIDDest = '${recipientChainID}' ) or ( chainIDDest = '${recipientChainID}' and chainID = '${senderChainID}' )`
                        let hrmpchannels = await this.poolREADONLY.query(sql2);
                        for (const n of hrmpchannels) {
                            closings.push(`('${n.chainID}', '${n.chainIDDest}', '${relayChain}', '${m.msgHash}', '${m.sentAt}', '${m.sourceTS}', '${closingInitiatorChainID}', Now(),  '${m.sentAt}', 'Closed')`)
                            console.log("hrmpMsg CHANNEL CLOSED", m.messageDT, relayChain, n.chainID, n.chainIDDest);
                        }
                    } else {
                        console.log("TODO", inst);
                    }
                }
            }
        }
        let valsOpenRequests = ["msgHashOpenRequest", "sentAtOpenRequest", "openRequestTS", "maxMessageSize", "maxCapacity", "addDT", "lastUpdateBN", "status"]
        let valsAccepts = ["msgHashAccepted", "sentAtAccepted", "acceptTS", "addDT", "lastUpdateBN", "status"]
        let valsClosing = ["msgHashClosing", "sentAtClosing", "closingTS", "closingInitiatorChainID", "addDT", "lastUpdateBN", "status"]
        await this.upsertSQL({
            "table": `channel`,
            "keys": ["chainID", "chainIDDest", "relayChain"],
            "vals": valsOpenRequests,
            "data": openRequests,
            "replace": ["msgHashOpenRequest", "sentAtOpenRequest", "openRequestTS", "maxMessageSize", "maxCapacity"],
            "lastUpdateBN": ["lastUpdateBN", "status", "addDT"]
        });
        await this.upsertSQL({
            "table": `channel`,
            "keys": ["chainID", "chainIDDest", "relayChain"],
            "vals": valsAccepts,
            "data": accepts,
            "replace": ["msgHashAccepted", "sentAtAccepted", "acceptTS"],
            "lastUpdateBN": ["lastUpdateBN", "status", "addDT"]
        });
        await this.upsertSQL({
            "table": `channel`,
            "keys": ["chainID", "chainIDDest", "relayChain"],
            "vals": valsClosing,
            "data": closings,
            "replace": ["msgHashAccepted", "sentAtAccepted", "closingTS"],
            "lastUpdateBN": ["lastUpdateBN", "status", "addDT"]
        });
    }

    async updateXcmTransferRoute() {
        // add new xcmasset records that have recently appeared in the asset table
        let sql = `select chainID, xcmInteriorKey, nativeAssetChain, symbol, numholders from asset where xcminteriorkey is not null and xcminteriorkey not in (select xcminteriorkey from xcmasset) and chainID < 50000 and xcminteriorkey != 'null'`;
        let xcAssetRecs = await this.poolREADONLY.query(sql);
        let vals = ["xcmInteriorKey", "nativeAssetChain", "addDT"];
        let out = [];
        let covered = {};
        for (const xc of xcAssetRecs) {
            try {
                let relayChain = paraTool.getRelayChainByChainID(xc.chainID)
                let k = paraTool.makeAssetChain(xc.symbol, relayChain);
                if (covered[k] == undefined) {
                    out.push(`('${xc.symbol}', '${relayChain}', ${mysql.escape(xc.xcmInteriorKey)}, ${mysql.escape(xc.nativeAssetChain)}, Now())`)
                    covered[k] = true;
                }
            } catch (err) {
                console.log(`updateXcAssetContractAddr error:${err.toString()}`)
            }
        }
        await this.upsertSQL({
            "table": `xcmasset`,
            "keys": ["symbol", "relayChain"],
            "vals": vals,
            "data": out,
            "replace": vals
        });
        let sqlroute = `insert into xcmtransferroute ( asset, assetDest, symbol, chainID, chainIDDest, cnt) (select asset.asset, assetDest.asset, xcmasset.symbol, xcmtransfer.chainID, xcmtransfer.chainIDDest, count(*) as cnt from xcmtransfer, xcmasset, asset, asset as assetDest where xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey and xcmasset.xcmInteriorKey = asset.xcmInteriorKey and asset.chainID = xcmtransfer.chainID and xcmasset.xcmInteriorKey = assetDest.xcmInteriorKey and assetDest.chainID = xcmtransfer.chainIDDest and sourceTS > UNIX_TIMESTAMP(date_sub(Now(), interval 30 day)) and assetDest.assetType = "Token" and asset.assetType = "Token" group by asset.asset, assetDest.asset, xcmasset.symbol, xcmtransfer.chainID, xcmtransfer.chainIDDest) on duplicate key update asset = values(asset), assetDest = values(assetDest), cnt = values(cnt);`
        this.batchedSQL.push(sqlroute);
        await this.update_batchedSQL();
    }

    async updateXcAssetContractAddr() {
        let xcAssetRecs = await this.poolREADONLY.query(`select chainID, asset, assetname, symbol, decimals, xcmInteriorKey from asset where assetType = "Token" and chainID in (${paraTool.chainIDMoonbeam},${paraTool.chainIDMoonriver},${paraTool.chainIDAstar},${paraTool.chainIDShiden},${paraTool.chainIDShibuya},${paraTool.chainIDMoonbaseAlpha},${paraTool.chainIDMoonbaseBeta}) order by chainID`);
        let xcAssetList = [];
        let xcContractAddrUpdates = []
        let xcInteriorKeyUpdates = []

        for (const xc of xcAssetRecs) {
            try {
                let asset = JSON.parse(xc.asset)
                if (asset.Token == xc.symbol) continue //GLMR/MOVR/DEV/SDN/ASTR/SBY etc..
                let xcAssetID = asset.Token
                let xcContractAddress = paraTool.xcAssetIDToContractAddr(xcAssetID).toLowerCase()
                let xcAsset = {
                    chainID: xc.chainID,
                    asset: xc.asset,
                    xcContractAddress: xcContractAddress,
                    xcmInteriorKey: xc.xcmInteriorKey,
                }
                xcAssetList.push(xcAsset)
            } catch (err) {
                console.log(`updateXcAssetContractAddr error:${err.toString()}`)
            }
        }
        for (const xcAsset of xcAssetList) {
            //["asset", "chainID"] + ["xcContractAddress"]
            let xcmInteriorKey = (xcAsset.xcmInteriorKey != undefined && xcAsset.xcmInteriorKey != 'null' && xcAsset.xcmInteriorKey != 'NULL') ? `'${xcAsset.xcmInteriorKey}'` : 'NULL'
            let c = `('${xcAsset.asset}', '${xcAsset.chainID}', '${xcAsset.xcContractAddress}', ${xcmInteriorKey})`
            xcContractAddrUpdates.push(c)

            //["asset", "chainID"] + ["xcContractAddress", "xcmInteriorKey"]
            //let xcmInteriorKey = (xcAsset.xcmInteriorKey != undefined) ? `'${xcAsset.xcmInteriorKey}'` : `NULL`
            //let x = `('${xcAsset.xcContractAddress}', '${xcAsset.chainID}', '${xcAsset.xcContractAddress}', ${xcmInteriorKey})`
            //xcInteriorKeyUpdates.push(x)
        }

        //console.log(xcContractAddrUpdates)
        //console.log(xcInteriorKeyUpdates)

        let sqlDebug = true
        let xcContractAddressVal = ["xcContractAddress", "xcmInteriorKey"]
        await this.upsertSQL({
            "table": `asset`,
            "keys": ["asset", "chainID"],
            "vals": xcContractAddressVal,
            "data": xcContractAddrUpdates,
            "replace": xcContractAddressVal,
        }, sqlDebug);

        /*let xcInteriorKeyVal = ["xcContractAddress", "xcmInteriorKey"]
        await this.upsertSQL({
            "table": `asset`,
            "keys": ["asset", "chainID"],
            "vals": xcInteriorKeyVal,
            "data": xcInteriorKeyUpdates,
            "replace": xcInteriorKeyVal,
        }, sqlDebug); */
    }

    async buildSuccessXcmTransactInfo(substrateTx, remoteEvmTx, matchRec, xcmIndex = 0, transferIndex = 0) {
        let decorate = true
        let decorateExtra = ["usd", "address", "related", "data"]
        let d = substrateTx
        let devm = remoteEvmTx
        let xcm = matchRec
        let sourceTxFee = d.fee
        let sourceTxFeeUSD = d.feeUSD
        let sourceChainSymbol = d.chainSymbol
        let evmTransactionHash = null
        let remoteEVMTxResult = 'Unknown'
        if (remoteEvmTx) {
            remoteEVMTxResult = remoteEvmTx.result
        }
        if (d.evm != undefined && d.evm.transactionHash != undefined) {
            evmTransactionHash = d.evm.transactionHash
            let evmtx = await this.getTransaction(evmTransactionHash, decorate, decorateExtra, false);
            if (!evmtx) return [false, false]
            sourceTxFee = evmtx.fee
            sourceTxFeeUSD = evmtx.feeUSD
            sourceChainSymbol = evmtx.symbol
        }
        if (sourceTxFeeUSD == undefined) sourceTxFeeUSD = 0
        //console.log(`sourceTxFee=${sourceTxFee}, sourceTxFeeUSD=${sourceTxFeeUSD}, sourceChainSymbol=${sourceChainSymbol}`)
        //console.log(`rawXCM`, xcm)
        xcm.chainName = this.getChainName(xcm.chainID);
        xcm.chainDestName = this.getChainName(xcm.chainIDDest);
        xcm.id = this.getIDByChainID(xcm.chainID)
        xcm.idDest = this.getIDByChainID(xcm.chainIDDest)
        xcm.paraID = paraTool.getParaIDfromChainID(xcm.chainID)
        xcm.paraIDDest = paraTool.getParaIDfromChainID(xcm.chainIDDest)
        let chainIDDestInfo = this.chainInfos[xcm.chainIDDest]
        if (xcm.chainIDDest != undefined && chainIDDestInfo != undefined && chainIDDestInfo.ss58Format != undefined) {
            if (xcm.destAddress != undefined) {
                if (xcm.destAddress.length == 42) xcm.destAddress = xcm.destAddress
                if (xcm.destAddress.length == 66) xcm.destAddress = paraTool.getAddress(xcm.destAddress, chainIDDestInfo.ss58Format)
            } else if (xcm.fromAddress != undefined) {
                if (xcm.fromAddress.length == 42) xcm.destAddress = xcm.fromAddress
                if (xcm.fromAddress.length == 66) xcm.destAddress = paraTool.getAddress(xcm.fromAddress, chainIDDestInfo.ss58Format)
            }
        }
        if (d.signer != undefined) {
            xcm.fromAddress = d.signer
        }

        let decimals = false
        let isNewFormat = true
        if (xcm.asset != undefined) {
            isNewFormat = false
        }

        let symbolRelayChain = paraTool.makeAssetChain(xcm.symbol, xcm.relayChain);
        let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
        if (xcmAssetInfo != undefined && xcmAssetInfo.decimals) {
            decimals = xcmAssetInfo.decimals
        }

        //fee -> initiation + teleport fee
        xcm.sourceTxFee = 0;
        xcm.sourceTxFeeUSD = 0;
        xcm.sourceChainSymbol = null;
        if (decimals !== false && (xcmIndex == 0 && transferIndex == 0)) {
            xcm.fee = xcm.amountSent - xcm.amountReceived
            xcm.feeUSD = 0
            xcm.sourceTxFee = sourceTxFee
            xcm.sourceTxFeeUSD = sourceTxFeeUSD
            xcm.sourceChainSymbol = sourceChainSymbol

            let p = await this.computePriceUSD({
                val: xcm.amountSent,
                asset: xcm.asset,
                chainID: xcm.chainID,
                ts: xcm.destTS
            });
            if (p) {
                //console.log(`p found`, p)
                xcm.amountSentUSD = p.valUSD;
                xcm.amountReceivedUSD = p.priceUSD * xcm.amountReceived;
                xcm.feeUSD = p.priceUSD * xcm.fee
                xcm.priceUSD = p.priceUSD;
                xcm.priceUSDCurrent = p.priceUSDCurrent;
            }
        }
        let xcmInfo = {
            symbol: xcm.symbol,
            priceUSD: xcm.priceUSD,
            relayChain: null,
            origination: null,
            destination: null,
            //xcmFinalized: true,
            version: 'V4'
        }
        xcmInfo.relayChain = {
            relayChain: xcm.relayChain,
            relayAt: xcm.sentAt, //?
        }

        xcmInfo.origination = {
            chainName: xcm.chainName,
            id: xcm.id,
            chainID: xcm.chainID,
            paraID: xcm.paraID,
            sender: xcm.fromAddress,
            amountSent: xcm.amountSent,
            amountSentUSD: xcm.amountSentUSD,
            txFee: xcm.sourceTxFee,
            txFeeUSD: xcm.sourceTxFeeUSD,
            txFeeSymbol: xcm.sourceChainSymbol,
            blockNumber: xcm.blockNumber,
            section: xcm.xcmSection,
            method: xcm.xcmMethod,
            extrinsicID: xcm.extrinsicID,
            extrinsicHash: xcm.extrinsicHash,
            //transactionHash: evmTransactionHash,
            msgHash: xcm.msgHash,
            sentAt: xcm.sentAt,
            ts: xcm.sourceTS,
            isMsgSent: true,
            finalized: true,
        }
        //if (evmTransactionHash == undefined) delete xcmInfo.origination.transactionHash;
        xcmInfo.destination = {
            chainName: xcm.chainDestName,
            id: xcm.idDest,
            chainID: xcm.chainIDDest,
            paraID: xcm.paraIDDest,
            beneficiary: xcm.destAddress,
            remoteEVMTxHash: xcm.remoteEVMTxHash,
            remoteEVMResult: remoteEVMTxResult,
            amountReceived: 0,
            amountReceivedUSD: 0,
            teleportFee: xcm.fee, // HOW IS THIS Computed
            teleportFeeUSD: xcm.feeUSD,
            teleportFeeChainSymbol: xcm.symbol,
            blockNumber: xcm.blockNumberDest,
            extrinsicID: xcm.destExtrinsicID,
            eventID: xcm.destEventID,
            finalized: true,
            ts: xcm.destTS,
            executionStatus: "success",
        }
        return [xcmInfo, xcm] //TODO: drop xcm format
    }


    async buildSuccessXcmInfo(substrateTx, matchRec, xcmIndex = 0, transferIndex = 0) {
        let decorate = true
        let decorateExtra = ["usd", "address", "related", "data"]
        let d = substrateTx
        let xcm = matchRec
        let sourceTxFee = d.fee
        let sourceTxFeeUSD = d.feeUSD
        let sourceChainSymbol = d.chainSymbol
        let evmTransactionHash = null
        if (d.evm != undefined && d.evm.transactionHash != undefined) {
            evmTransactionHash = d.evm.transactionHash
            let evmtx = await this.getTransaction(evmTransactionHash, decorate, decorateExtra, false);
            if (!evmtx) return [false, false]
            sourceTxFee = evmtx.fee
            sourceTxFeeUSD = evmtx.feeUSD
            sourceChainSymbol = evmtx.symbol
        }
        if (sourceTxFeeUSD == undefined) sourceTxFeeUSD = 0
        //console.log(`sourceTxFee=${sourceTxFee}, sourceTxFeeUSD=${sourceTxFeeUSD}, sourceChainSymbol=${sourceChainSymbol}`)
        //console.log(`rawXCM`, xcm)
        xcm.chainName = this.getChainName(xcm.chainID);
        xcm.chainDestName = this.getChainName(xcm.chainIDDest);
        xcm.id = this.getIDByChainID(xcm.chainID)
        xcm.idDest = this.getIDByChainID(xcm.chainIDDest)
        xcm.paraID = paraTool.getParaIDfromChainID(xcm.chainID)
        xcm.paraIDDest = paraTool.getParaIDfromChainID(xcm.chainIDDest)
        let chainIDDestInfo = this.chainInfos[xcm.chainIDDest]
        if (xcm.chainIDDest != undefined && chainIDDestInfo != undefined && chainIDDestInfo.ss58Format != undefined) {
            if (xcm.destAddress != undefined) {
                if (xcm.destAddress.length == 42) xcm.destAddress = xcm.destAddress
                if (xcm.destAddress.length == 66) xcm.destAddress = paraTool.getAddress(xcm.destAddress, chainIDDestInfo.ss58Format)
            } else if (xcm.fromAddress != undefined) {
                if (xcm.fromAddress.length == 42) xcm.destAddress = xcm.fromAddress
                if (xcm.fromAddress.length == 66) xcm.destAddress = paraTool.getAddress(xcm.fromAddress, chainIDDestInfo.ss58Format)
            }
        }
        if (d.signer != undefined) {
            xcm.fromAddress = d.signer
        }

        let decimals = false
        let isNewFormat = true
        if (xcm.asset != undefined) {
            isNewFormat = false
        }

        let symbolRelayChain = paraTool.makeAssetChain(xcm.symbol, xcm.relayChain);
        let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
        if (xcmAssetInfo != undefined && xcmAssetInfo.decimals) {
            decimals = xcmAssetInfo.decimals
        }
        if (!isNewFormat) {
            if (decimals === false) {
                decimals = this.getAssetDecimal(xcm.asset, xcm.chainID)
            } else if (decimals === false) {
                decimals = this.getAssetDecimal(xcm.asset, xcm.chainIDDest)
            }
            if (decimals !== false) {
                xcm.amountSent = xcm.amountSent / 10 ** decimals;
                xcm.amountReceived = xcm.amountReceived / 10 ** decimals;
            }
            xcm.symbol = this.getAssetSymbol(xcm.asset);
        }

        //txfees
        // 100% of txfees are assigned to the first xcmIndex/transferIndex
        if (xcmIndex == 0 && transferIndex == 0) {
            xcm.sourceTxFee = sourceTxFee
            xcm.sourceTxFeeUSD = sourceTxFeeUSD
            xcm.sourceChainSymbol = sourceChainSymbol
        } else {
            xcm.sourceTxFee = 0;
            xcm.sourceTxFeeUSD = 0;
            xcm.sourceChainSymbol = null;
        }
        // teleport fee
        xcm.fee = xcm.amountSent - xcm.amountReceived
        let p = await this.computePriceUSD({
            val: xcm.amountSent,
            asset: xcm.asset,
            chainID: xcm.chainID,
            ts: xcm.destTS
        });
        if (p) {
            //console.log(`p found`, p)
            xcm.amountSentUSD = p.valUSD;
            xcm.amountReceivedUSD = p.priceUSD * xcm.amountReceived;
            xcm.feeUSD = p.priceUSD * xcm.fee
            if (xcm.feeUSD > this.irregularFeeUSDThreshold) {
                console.log(`Irregular FeeUSD  feeUSD extrinsicHash=${xcm.extrinsicHash}, amountSentUSD=${xcm.amountSentUSD}, amountReceived=${xcm.amountReceivedUSD}, feeUSD=${estFeeUSD}`)
                xcm.feeUSD = 0
            }
            xcm.priceUSD = p.priceUSD;
            xcm.priceUSDCurrent = p.priceUSDCurrent;
        }

        let xcmInfo = {
            symbol: xcm.symbol,
            priceUSD: xcm.priceUSD,
            relayChain: null,
            origination: null,
            destination: null,
            //xcmFinalized: true,
            version: 'V4'
        }
        xcmInfo.relayChain = {
            relayChain: xcm.relayChain,
            relayAt: xcm.sentAt, //?
        }

        xcmInfo.origination = {
            chainName: xcm.chainName,
            id: xcm.id,
            chainID: xcm.chainID,
            paraID: xcm.paraID,
            sender: xcm.fromAddress,
            amountSent: xcm.amountSent,
            amountSentUSD: xcm.amountSentUSD,
            txFee: xcm.sourceTxFee,
            txFeeUSD: xcm.sourceTxFeeUSD,
            txFeeSymbol: xcm.sourceChainSymbol,
            blockNumber: xcm.blockNumber,
            section: xcm.xcmSection,
            method: xcm.xcmMethod,
            extrinsicID: xcm.extrinsicID,
            extrinsicHash: xcm.extrinsicHash,
            transactionHash: evmTransactionHash,
            msgHash: xcm.msgHash,
            sentAt: xcm.sentAt,
            ts: xcm.sourceTS,
            //complete: true,
            isMsgSent: true,
            finalized: true,
        }
        if (evmTransactionHash == undefined) delete xcmInfo.origination.transactionHash;
        xcmInfo.destination = {
            chainName: xcm.chainDestName,
            id: xcm.idDest,
            chainID: xcm.chainIDDest,
            paraID: xcm.paraIDDest,
            beneficiary: xcm.destAddress,
            amountReceived: xcm.amountReceived,
            amountReceivedUSD: xcm.amountReceivedUSD,
            teleportFee: xcm.fee, // how is this computed!!!
            teleportFeeUSD: xcm.feeUSD,
            teleportFeeChainSymbol: xcm.symbol,
            blockNumber: xcm.blockNumberDest,
            extrinsicID: xcm.destExtrinsicID,
            eventID: xcm.destEventID,
            ts: xcm.destTS,
            finalized: true,
            executionStatus: "success",
        }
        if (xcm.xcmMethod == 'transferMulticurrencies') console.log(`*** xcmInfo`, xcmInfo)
        return [xcmInfo, xcm] //TODO: drop xcm format
    }



    async buildFailedXcmInfo(substrateTx, failedRecord, xcmIndex = 0, transferIndex = 0) {
        let decorate = true
        let decorateExtra = ["usd", "address", "related", "data"]
        let d = substrateTx
        let xcm = failedRecord
        let sourceTxFee = d.fee
        let sourceTxFeeUSD = d.feeUSD
        let sourceChainSymbol = d.chainSymbol
        let evmTransactionHash = null
        if (d.evm != undefined && d.evm.transactionHash != undefined) {
            evmTransactionHash = d.evm.transactionHash
            let evmtx = await this.getTransaction(evmTransactionHash, decorate, decorateExtra, false);
            if (!evmtx) {
                return [false, false]
            }
            sourceTxFee = evmtx.fee
            sourceTxFeeUSD = evmtx.feeUSD
            sourceChainSymbol = evmtx.symbol
        }

        //console.log(`sourceTxFee=${sourceTxFee}, sourceTxFeeUSD=${sourceTxFeeUSD}, sourceChainSymbol=${sourceChainSymbol}`)
        //console.log(`rawXCM`, xcm)
        xcm.chainName = this.getChainName(xcm.chainID);
        xcm.chainDestName = this.getChainName(xcm.chainIDDest);
        xcm.id = this.getIDByChainID(xcm.chainID)
        xcm.idDest = this.getIDByChainID(xcm.chainIDDest)
        xcm.paraID = paraTool.getParaIDfromChainID(xcm.chainID)
        xcm.paraIDDest = paraTool.getParaIDfromChainID(xcm.chainIDDest)
        let chainIDDestInfo = this.chainInfos[xcm.chainIDDest]
        if (xcm.chainIDDest != undefined && chainIDDestInfo != undefined && chainIDDestInfo.ss58Format != undefined) {
            if (xcm.destAddress != undefined) {
                if (xcm.destAddress.length == 42) xcm.destAddress = xcm.destAddress
                if (xcm.destAddress.length == 66) xcm.destAddress = paraTool.getAddress(xcm.destAddress, chainIDDestInfo.ss58Format)
            } else if (xcm.fromAddress != undefined) {
                if (xcm.fromAddress.length == 42) xcm.destAddress = xcm.fromAddress
                if (xcm.fromAddress.length == 66) xcm.destAddress = paraTool.getAddress(xcm.fromAddress, chainIDDestInfo.ss58Format)
            }
        }
        if (d.signer != undefined) {
            xcm.fromAddress = d.signer
        }

        let decimals = false
        let isNewFormat = true
        if (xcm.asset != undefined) {
            isNewFormat = false
        }

        let symbolRelayChain = paraTool.makeAssetChain(xcm.symbol, xcm.relayChain);
        let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
        if (xcmAssetInfo != undefined && xcmAssetInfo.decimals) {
            decimals = xcmAssetInfo.decimals
        }

        //fee -> initiation only; teleport fee are irrelevant
        xcm.sourceTxFee = 0;
        xcm.sourceTxFeeUSD = 0;
        xcm.sourceChainSymbol = null;
        if (decimals !== false && (xcmIndex == 0 && transferIndex == 0)) {
            xcm.sourceTxFee = sourceTxFee
            xcm.sourceTxFeeUSD = sourceTxFeeUSD
            xcm.sourceChainSymbol = sourceChainSymbol
        }
        let xcmInfo = {
            symbol: xcm.symbol,
            priceUSD: xcm.priceUSD,
            relayChain: null,
            origination: null,
            destination: null,
            //xcmFinalized: true,
            version: 'V4'
        }
        xcmInfo.relayChain = {
            relayChain: xcm.relayChain,
            relayAt: (xcm.failureType == 'failedOrigination') ? null : xcm.sentAt, // failedOrigination are not relayed
        }

        let isMsgSent = (xcm.failureType == 'failedOrigination') ? true : false

        xcmInfo.origination = {
            chainName: xcm.chainName,
            id: xcm.id,
            chainID: xcm.chainID,
            paraID: xcm.paraID,
            sender: xcm.fromAddress,
            amountSent: (xcm.failureType == 'failedOrigination') ? 0 : xcm.amountSent, //failedOrigination deosn't send anything
            amountSentUSD: (xcm.failureType == 'failedOrigination') ? 0 : xcm.amountSentUSD, //failedOrigination deosn't send anything
            txFee: xcm.sourceTxFee,
            txFeeUSD: xcm.sourceTxFeeUSD,
            txFeeSymbol: xcm.sourceChainSymbol,
            blockNumber: xcm.blockNumber,
            section: xcm.xcmSection,
            method: xcm.xcmMethod,
            extrinsicID: xcm.extrinsicID,
            extrinsicHash: xcm.extrinsicHash,
            transactionHash: evmTransactionHash,
            msgHash: xcm.msgHash,
            sentAt: xcm.sentAt,
            ts: xcm.sourceTS,
            //complete: (xcm.failureType == 'failedOrigination') ? false : true,
            isMsgSent: isMsgSent,
            finalized: true,
        }
        if (evmTransactionHash == undefined) delete xcmInfo.origination.transactionHash;
        xcmInfo.destination = {
            chainName: xcm.chainDestName,
            id: xcm.idDest,
            chainID: xcm.chainIDDest,
            paraID: xcm.paraIDDest,
            beneficiary: xcm.destAddress,
            amountReceived: 0,
            amountReceivedUSD: 0,
            teleportFee: 0,
            teleportFeeUSD: 0,
            teleportFeeChainSymbol: xcm.symbol,
            blockNumber: xcm.blockNumberDest,
            extrinsicID: null,
            eventID: xcm.executedEventID,
            ts: xcm.destTS,
            finalized: true,
            executionStatus: "failed",
            error: {},
        }
        if (xcm.failureType == 'failedDestination') {
            xcmInfo.destination.error = this.getXcmErrorDescription(xcm.errorDesc)
        } else {
            xcmInfo.destination.finalizedDesc = 'Xcm is terminated at origination. Msg is not relayed to nor received by destination chain'
            xcmInfo.destination.extrinsicID = null
            xcmInfo.destination.error = {
                errorCode: `NA`,
                errorType: `FailedAtOriginationChain`,
                errorDesc: `XCM Failed at origination Chain.`,
            }
        }
        return [xcmInfo, xcm] //TODO: drop xcm format
    }

    getXcmErrorDescription(errorDesc = 'complete:AssetsTrapped') {
        /*
        complete:AssetsTrapped
        error:barrier
        */
        let errPieces = errorDesc.split(':')
        let status = errPieces[0]
        let errorType = (errPieces.length == 2) ? errPieces[1] : 'NA'
        if (this.xcmErrorMap[errorType.toLowerCase()] != undefined) {
            return this.xcmErrorMap[errorType.toLowerCase()]
        } else {
            return {
                errorCode: `NA`,
                errorType: errorType,
                errorDesc: `NA`,
            }
        }
    }

    loadXCMErrorDescription() {
        let errorMap = {}
        let officialErrors = [
            'Overflow|0|An arithmetic overflow happened.',
            'Unimplemented|1|The instruction is intentionally unsupported.',
            'UntrustedReserveLocation|2|Origin Register does not contain a value value for a reserve transfer notification.',
            'UntrustedTeleportLocation|3|Origin Register does not contain a value value for a teleport notification.',
            'MultiLocationFull|4|`MultiLocation` value too large to descend further.',
            'MultiLocationNotInvertible|5|`MultiLocation` value ascend more parents than known ancestors of local location.',
            'BadOrigin|6|The Origin Register does not contain a valid value for instruction.',
            'InvalidLocation|7|The location parameter is not a valid value for the instruction.',
            'AssetNotFound|8|The given asset is not handled.',
            'FailedToTransactAsset|9|An asset transaction (like withdraw or deposit) failed (typically due to type conversions).',
            'NotWithdrawable|10|An asset cannot be withdrawn, potentially due to lack of ownership, availability or rights.',
            'LocationCannotHold|11|An asset cannot be deposited under the ownership of a particular location.',
            'ExceedsMaxMessageSize|12|Attempt to send a message greater than the maximum supported by the transport protocol.',
            'DestinationUnsupported|13|The given message cannot be translated into a format supported by the destination.',
            'Transport|14|Destination is routable, but there is some issue with the transport mechanism.',
            'Unroutable|15|Destination is known to be unroutable.',
            'UnknownClaim|16|Used by `ClaimAsset` when the given claim could not be recognized/found.',
            'FailedToDecode|17|Used by `Transact` when the functor cannot be decoded.',
            'TooMuchWeightRequired|18|Used by `Transact` to indicate that the given weight limit could be breached by the functor.',
            'NotHoldingFees|19|Used by `BuyExecution` when the Holding Register does not contain payable fees.',
            'TooExpensive|20|Used by `BuyExecution` when the fees declared to purchase weight are insufficient.',
            'Trap(u64)|21|Used by the `Trap` instruction to force an error intentionally. Its code is included.',
            'ExpectationFalse|22|Used by `ExpectAsset`, `ExpectError` and `ExpectOrigin` when the expectation was not true.'
        ]
        for (const officialErr of officialErrors) {
            let e = officialErr.split('|')
            let errDetail = {
                errorCode: parseInt(e[1]),
                errorType: e[0],
                errorDesc: e[2],
            }
            errorMap[errDetail.errorType.toLowerCase()] = errDetail
        }
        //console.log(errorMap)
        this.xcmErrorMap = errorMap
    }
    // xcmtransfer_match matches cross transfers between SENDING events held in "xcmtransfer"  and CANDIDATE destination events (from various xcm received messages on a destination chain)
    // this will be phased out soon
    async xcmtransfer_match(startTS, endTS = null, ratMin = .99, lookbackSeconds = 7200, forceRematch = false, targetChainID = 'all') {
        let endWhere = endTS ? `and xcmtransfer.sourceTS < ${endTS} and d.destTS < ${endTS+lookbackSeconds}` : ""
        // match xcmtransferdestcandidate of the last 2 hours
        //   (a) > 95% amountReceived / amountSent
        //   (b) asset match
        //   (c) time difference matching has to be less than 7200 (and greater than 0)
        //   (d) TODO: require xcmtransferdestcandidate.paraIDs to match xcmtransfer.chainIDDest (this is NOT guarateed to be present)
        // In case of ties, the FIRST one ( "order by diffTS" ) covers this
        let rematchClause = forceRematch ? ` ` : `((xcmtransfer.matched = 0 and d.matched = 0) or xcmtransfer.xcmInfo is null) and `
        let targetChainClause = (targetChainID == 'all') ? ` ` : `(xcmtransfer.chainID = ${targetChainID} or xcmtransfer.chainIDDest = ${targetChainID}) and `
        let sqlA = `select
          chainID, extrinsicHash, d.chainIDDest, d.fromAddress, d.symbol, d.relayChain,
          (d.destts - xcmtransfer.sourceTS) as diffTS,
          (d.sentAt - xcmtransfer.sentAt) as diffAT,
          xcmtransfer.extrinsicID,
          xcmtransfer.amountSent,
          xcmtransfer.transferIndex,
          xcmtransfer.sourceTS,
          xcmtransfer.fromAddress as senderAddress,
          xcmtransfer.destAddress,
          xcmtransfer.msgHash,
          xcmtransfer.sentAt,
          xcmtransfer.blockNumber,
          xcmtransfer.sectionMethod,
          xcmtransfer.xcmIndex,
          xcmtransfer.transferIndex,
          xcmtransfer.xcmType,
          d.eventID,
          d.extrinsicID as destExtrinsicID,
          d.sentAt as destSentAt,
          d.blockNumberDest,
          d.amountReceived,
          d.destTS,
          d.amountReceived / xcmtransfer.amountSent as rat
        from xcmtransfer, xcmtransferdestcandidate as d
 where  d.fromAddress = xcmtransfer.destAddress and
        d.chainIDDest = xcmtransfer.chainIDDest and
        xcmtransfer.xcmType = 'xcmtransfer' and
        ((d.symbol = xcmtransfer.symbol) and (d.relayChain = xcmtransfer.relayChain)) and
        xcmtransfer.sourceTS >= ${startTS} and
        xcmtransfer.xcmInteriorKey = d.xcmInteriorKey and
        d.destTS >= ${startTS} ${endWhere} and ${rematchClause} ${targetChainClause}
        xcmtransfer.incomplete = 0 and
        d.destTS - xcmtransfer.sourceTS >= 0 and
        d.destTS - xcmtransfer.sourceTS < ${lookbackSeconds} and
        length(xcmtransfer.extrinsicID) > 0 and
        xcmtransfer.amountSent >= d.amountReceived and
          ((d.amountReceived / xcmtransfer.amountSent > ${ratMin}) or (d.msgHash = xcmtransfer.msgHash and length(d.msgHash) = 66 and d.sentAt - xcmtransfer.sentAt >=0 and d.sentAt - xcmtransfer.sentAt <= 5) ) and
          d.amountReceived / xcmtransfer.amountSent <= 1.0
          order by chainID, extrinsicHash, diffTS`
        let [logDTS, hr] = paraTool.ts_to_logDT_hr(startTS)
        let windowTS = (endTS != undefined) ? endTS - startTS : 'NA'
        //console.log(`match_xcm [${logDTS} ${hr}] windowTS=${windowTS},lookbackSeconds=${lookbackSeconds}, ratMin=${ratMin} chain=${targetChainID}`)
        //console.log(`match_xcm (A)`)
        //console.log(paraTool.removeNewLine(sqlA))
        try {
            let xcmmatches = await this.poolREADONLY.query(sqlA);
            let addressextrinsic = []
            let hashes = []
            let matched = {}
            let matches = 0;
            if (xcmmatches.length > 0) {
                //console.log(`[Found] match_xcm (A) len=${xcmmatches.length}`)
            } else {
                //enable this for debugging
                //console.log("[Empty] match_xcm", sqlA)
            }
            for (let i = 0; i < xcmmatches.length; i++) {
                //console.log("i", i);
                let d = xcmmatches[i];
                if (matched[d.extrinsicHash] == undefined && matched[d.eventID] == undefined) {
                    let priceUSD = 0;
                    let amountSent = 0;
                    let amountReceived = 0;
                    let amountSentUSD = 0;
                    let amountReceivedUSD = 0;
                    let chainID = d.chainID
                    let decimals = false
                    let symbol = d.symbol;
                    let relayChain = d.relayChain;
                    let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
                    let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
                    if (xcmAssetInfo != undefined && xcmAssetInfo.decimals != undefined) {
                        decimals = xcmAssetInfo.decimals
                    }
                    if (decimals !== false) {
                        amountSent = parseFloat(d.amountSent) / 10 ** decimals;
                        amountReceived = parseFloat(d.amountReceived) / 10 ** decimals;
                    }
                    let priceSource = await this.computePriceUSD({
                        symbol: d.symbol,
                        relayChain: d.relayChain,
                        ts: d.sourceTS
                    });

                    if (priceSource) {
                        priceUSD = priceSource.priceUSD;
                        amountSentUSD = (amountSent > 0) ? priceUSD * amountSent : 0;
                        amountReceivedUSD = (amountReceived > 0) ? priceUSD * amountReceived : 0;
                    } else {
                        console.log(`XCM Asset not found [${d.extrinsicHash}], symbol=${d.symbol}, relayChain=${d.relayChain}`)
                    }
                    // (a) with extrinsicID, we get both the fee (rat << 1) ANDthe transferred item for when one is isFeeItem=0 and another is isFeeItem=1; ... otherwise we get (b) with just the eventID
                    let w = d.destExtrinsicID && (d.destExtrinsicID.length > 0) ? `extrinsicID = '${d.destExtrinsicID}'` : `eventID = '${d.eventID}'`;
                    let sqlC = `update xcmtransferdestcandidate set matched = 1, matchedExtrinsicHash = '${d.extrinsicHash}' where ${w}`
                    //console.log(`match_xcm (C)`)
                    //console.log(paraTool.removeNewLine(sqlC))
                    this.batchedSQL.push(sqlC);
                    // never match more than once, by marking both the sending record and the receiving record
                    matched[d.extrinsicHash] = true;
                    matched[d.eventID] = true;

                    let xcmSection = (d.sectionMethod != undefined) ? d.sectionMethod : null
                    let xcmMethod = null
                    let sectionMethodPieces = d.sectionMethod.split(':')
                    if (sectionMethodPieces.length == 2) {
                        xcmSection = sectionMethodPieces[0]
                        xcmMethod = sectionMethodPieces[1]
                    }

                    // problem: this does not store the "dust" fee (which has rat << 1) in bigtable

                    // we use matchRec to build xcmInfo
                    let match = {
                        chainID: d.chainID,
                        blockNumber: paraTool.dechexToInt(d.blockNumber),
                        chainIDDest: d.chainIDDest,
                        blockNumberDest: d.blockNumberDest,
                        symbol: d.symbol,
                        relayChain: d.relayChain,
                        priceUSD: priceUSD,
                        amountSent: amountSent,
                        amountReceived: amountReceived,
                        amountSentUSD: amountSentUSD,
                        amountReceivedUSD: amountReceivedUSD,
                        fromAddress: d.senderAddress, //from xcmtransfer.fromAddress
                        destAddress: d.fromAddress, //from xcmtransferdestcandidate.fromAddress
                        msgHash: (d.msgHash != undefined) ? d.msgHash : '0x',
                        sentAt: (d.sentAt != undefined) ? d.sentAt : null,
                        xcmSection: xcmSection,
                        xcmMethod: xcmMethod,
                        extrinsicHash: d.extrinsicHash,
                        extrinsicID: d.extrinsicID,
                        destExtrinsicID: d.destExtrinsicID,
                        destEventID: d.eventID,
                        sourceTS: d.sourceTS,
                        destTS: d.destTS
                    }
                    let substrateTxHash = d.extrinsicHash
                    let substratetx;
                    try {
                        substratetx = await this.getTransaction(substrateTxHash);
                    } catch (err) {
                        console.log("looking for", substrateTxHash, err);
                    }
                    let xcmInfo, xcmOld;
                    if (substratetx != undefined) {
                        try {
                            [xcmInfo, xcmOld] = await this.buildSuccessXcmInfo(substratetx, match, d.xcmIndex, d.transferIndex)
                            if (this.debugLevel > paraTool.debugTracing) console.log(`buildSuccessXcmInfo sendExternalWSProvider`, xcmInfo)
                            //this.sendExternalWSProvider("xcminfo", xcmInfo);
                        } catch (e) {
                            console.log(`!!!!buildSuccessXcmInfo extrinsicHash=${substrateTxHash} ERROR!!!!, xcmInfo`, xcmInfo, 'e', e)
                            continue
                        }
                    }
                    //console.log(`extrinsicHash=${substrateTxHash}, xcmInfo`, xcmInfo)

                    let xcmInfoStr = (xcmInfo != undefined) ? JSON.stringify(xcmInfo) : false
                    let xcmInfoBlob = (xcmInfoStr != false) ? mysql.escape(xcmInfoStr) : 'NULL'
                    if (isNaN(amountSentUSD) || isNaN(amountReceivedUSD) || priceUSD == undefined) {
                        //console.log(`extrinsicHash ${substrateTxHash} priceInfo missing!!`, xcmInfo)
                        continue
                    }
                    let sqlB = `update xcmtransfer
            set blockNumberDest = ${d.blockNumberDest},
                destTS = ${d.destTS},
                amountSentUSD = '${amountSentUSD}',
                amountReceivedUSD = '${amountReceivedUSD}',
                priceUSD = '${priceUSD}',
                matched = 1,
                matchedExtrinsicID = '${d.destExtrinsicID}',
                matchedEventID = '${d.eventID}',
                xcmInfo = ${xcmInfoBlob},
                xcmInfolastUpdateDT = Now()
             where extrinsicHash = '${d.extrinsicHash}' and transferIndex = '${d.transferIndex}'`
                    //console.log(`match_xcm (B)`)
                    //console.log(paraTool.removeNewLine(sqlB))
                    this.batchedSQL.push(sqlB);
                    matches++;

                    // 1. write "addressExtrinsic" feedxcmdest with row key address-extrinsicHash and column extrinsicHash#chainID-extrinsicID-transferIndex
                    //    * we use the SENDING chainID + the sender extrinsicID as the column for the "feedxcmdest" column family
                    let rowKey = `${d.fromAddress.toLowerCase()}#${d.extrinsicHash}` // NOTE: this matches "feed"
                    let cres = {
                        key: rowKey,
                        data: {
                            feedxcminfo: {}
                        }
                    };
                    let extrinsicHashEventID = `${d.extrinsicHash}#${d.chainID}-${d.extrinsicID}-${d.transferIndex}`
                    let extrinsicID = `${d.extrinsicID}`
                    cres['data']['feedxcminfo'][extrinsicHashEventID] = {
                        value: JSON.stringify(xcmInfo),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };
                    addressextrinsic.push(cres);

                    // 2. write "hashes" feedxcmdest with row key extrinsicHash and column extrinsicHash#chainID-extrinsicID (same as 1)
                    let hres = {
                        key: d.extrinsicHash,
                        data: {
                            xcminfofinalized: {}
                        }
                    }
                    hres['data']['xcminfofinalized'][extrinsicID] = {
                        value: JSON.stringify(xcmInfo),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };
                    hashes.push(hres)
                } else {
                    //console.log("SKIP", matched[d.extrinsicHash], matched[d.eventID]);
                }
            }
            if (addressextrinsic.length > 0) {
                await this.insertBTRows(this.btAddressExtrinsic, addressextrinsic, "addressextrinsic")
            }
            if (hashes.length > 0) {
                await this.insertBTRows(this.btHashes, hashes, "addressextrinsic")
            }
            if (addressextrinsic.length > 0 || hashes.length > 0) {
                await this.update_batchedSQL();
            }
        } catch (err) {
            console.log("WRITE_FEEDXCMDEST", err)
        }
        let logDT = new Date(startTS * 1000)
        //console.log(`match_xcm ${startTS} covered ${logDT}`)
    }

    async xcmtransact_match(startTS, endTS = null, lookbackSeconds = 7200, forceRematch = false, targetChainID = 'all') {
        let endWhere = endTS ? `and xcmtransfer.sourceTS < ${endTS} and d.destTS < ${endTS+lookbackSeconds}` : ""
        // match xcmtransferdestcandidate of the last 2 hours
        //   (a) > 95% amountReceived / amountSent
        //   (b) asset match
        //   (c) time difference matching has to be less than 7200 (and greater than 0)
        //   (d) TODO: require xcmtransferdestcandidate.paraIDs to match xcmtransfer.chainIDDest (this is NOT guarateed to be present)
        // In case of ties, the FIRST one ( "order by diffTS" ) covers this
        let rematchClause = forceRematch ? ` ` : `((xcmtransfer.matched = 0 and d.matched = 0) or xcmtransfer.xcmInfo is null) and `
        let targetChainClause = (targetChainID == 'all') ? ` ` : `(xcmtransfer.chainID = ${targetChainID} or xcmtransfer.chainIDDest = ${targetChainID}) and `
        let sqlA = `select
          chainID, extrinsicHash, d.chainIDDest, d.fromAddress, d.symbol, d.relayChain,
          (d.destts - xcmtransfer.sourceTS) as diffTS,
          (d.sentAt - xcmtransfer.sentAt) as diffAT,
          xcmtransfer.extrinsicID,
          xcmtransfer.amountSent,
          xcmtransfer.transferIndex,
          xcmtransfer.sourceTS,
          xcmtransfer.fromAddress as senderAddress,
          xcmtransfer.destAddress,
          xcmtransfer.msgHash,
          xcmtransfer.sentAt,
          xcmtransfer.blockNumber,
          xcmtransfer.sectionMethod,
          xcmtransfer.xcmType,
          xcmtransfer.xcmIndex,
          xcmtransfer.transferIndex,
          xcmtransfer.connectedTxHash as remoteEVMTxHash,
          d.eventID,
          d.extrinsicID as destExtrinsicID,
          d.sentAt as destSentAt,
          d.blockNumberDest,
          d.amountReceived,
          d.destTS
        from xcmtransfer, xcmtransferdestcandidate as d
 where  xcmtransfer.xcmType = 'xcmtransact' and
        d.chainIDDest = xcmtransfer.chainIDDest and
        d.msgHash = xcmtransfer.msgHash and length(d.msgHash) = 66 and
        d.sentAt - xcmtransfer.sentAt >=0 and d.sentAt - xcmtransfer.sentAt <= 6 and
        d.relayChain = xcmtransfer.relayChain and
        xcmtransfer.sourceTS >= ${startTS} and
        d.destTS >= ${startTS} ${endWhere} and ${rematchClause} ${targetChainClause}
        xcmtransfer.incomplete = 0 and
        d.destTS - xcmtransfer.sourceTS >= 0 and
        d.destTS - xcmtransfer.sourceTS < ${lookbackSeconds} and
        length(xcmtransfer.extrinsicID) > 0
          order by chainID, extrinsicHash, diffTS`
        let [logDTS, hr] = paraTool.ts_to_logDT_hr(startTS)
        let windowTS = (endTS != undefined) ? endTS - startTS : 'NA'
        //console.log(`match_xcmtransact [${logDTS} ${hr}] windowTS=${windowTS},lookbackSeconds=${lookbackSeconds}, chain=${targetChainID}`)
        //console.log(`match_xcmtransact (A)`)
        console.log(paraTool.removeNewLine(sqlA))
        try {
            let xcmmatches = await this.poolREADONLY.query(sqlA);
            let addressextrinsic = []
            let hashes = []
            let matched = {}
            let matches = 0;
            if (xcmmatches.length > 0) {
                //console.log(`[Found] match_xcmtransact (A) len=${xcmmatches.length}`)
            } else {
                //enable this for debugging
                //console.log("[Empty] match_xcm", sqlA)
            }
            for (let i = 0; i < xcmmatches.length; i++) {
                let d = xcmmatches[i];
                if (matched[d.extrinsicHash] == undefined && matched[d.eventID] == undefined) {
                    let priceUSD = 0;
                    let amountSent = 0;
                    let amountReceived = 0;
                    let amountSentUSD = 0;
                    let amountReceivedUSD = 0;
                    let chainID = d.chainID
                    let decimals = false
                    let symbol = d.symbol;
                    let relayChain = d.relayChain;
                    let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
                    let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
                    if (xcmAssetInfo != undefined && xcmAssetInfo.decimals != undefined) {
                        decimals = xcmAssetInfo.decimals
                    }
                    if (decimals !== false) {
                        amountSent = parseFloat(d.amountSent) / 10 ** decimals;
                        amountReceived = parseFloat(d.amountReceived) / 10 ** decimals;
                    }
                    let priceSource = await this.computePriceUSD({
                        symbol: d.symbol,
                        relayChain: d.relayChain,
                        ts: d.sourceTS
                    });

                    if (priceSource) {
                        priceUSD = priceSource.priceUSD;
                        amountSentUSD = (amountSent > 0) ? priceUSD * amountSent : 0;
                        amountReceivedUSD = (amountReceived > 0) ? priceUSD * amountReceived : 0;
                    } else {
                        //console.log(`XCM Asset not found [${d.extrinsicHash}], symbol=${d.symbol}, relayChain=${d.relayChain}`)
                    }
                    // (a) with extrinsicID, we get both the fee (rat << 1) ANDthe transferred item for when one is isFeeItem=0 and another is isFeeItem=1; ... otherwise we get (b) with just the eventID
                    let w = d.destExtrinsicID && (d.destExtrinsicID.length > 0) ? `extrinsicID = '${d.destExtrinsicID}'` : `eventID = '${d.eventID}'`;
                    let sqlC = `update xcmtransferdestcandidate set matched = 1, matchedExtrinsicHash = '${d.extrinsicHash}' where ${w}`
                    //console.log(`match_xcmtransact (C)`, paraTool.removeNewLine(sqlC))
                    this.batchedSQL.push(sqlC);
                    // never match more than once, by marking both the sending record and the receiving record
                    matched[d.extrinsicHash] = true;
                    matched[d.eventID] = true;

                    let xcmSection = (d.sectionMethod != undefined) ? d.sectionMethod : null
                    let xcmMethod = null
                    let sectionMethodPieces = d.sectionMethod.split(':')
                    if (sectionMethodPieces.length == 2) {
                        xcmSection = sectionMethodPieces[0]
                        xcmMethod = sectionMethodPieces[1]
                    }

                    // problem: this does not store the "dust" fee (which has rat << 1) in bigtable

                    // we use matchRec to build xcmInfo
                    let match = {
                        chainID: d.chainID,
                        blockNumber: paraTool.dechexToInt(d.blockNumber),
                        chainIDDest: d.chainIDDest,
                        blockNumberDest: d.blockNumberDest,
                        symbol: d.symbol,
                        relayChain: d.relayChain,
                        priceUSD: priceUSD,
                        amountSent: amountSent,
                        amountReceived: amountReceived,
                        amountSentUSD: amountSentUSD,
                        amountReceivedUSD: amountReceivedUSD,
                        fromAddress: d.senderAddress, //from xcmtransfer.fromAddress
                        destAddress: d.fromAddress, //from xcmtransferdestcandidate.fromAddress
                        msgHash: (d.msgHash != undefined) ? d.msgHash : '0x',
                        sentAt: (d.sentAt != undefined) ? d.sentAt : null,
                        xcmSection: xcmSection,
                        xcmMethod: xcmMethod,
                        remoteEVMTxHash: d.remoteEVMTxHash,
                        extrinsicHash: d.extrinsicHash,
                        extrinsicID: d.extrinsicID,
                        destExtrinsicID: d.destExtrinsicID,
                        destEventID: d.eventID,
                        sourceTS: d.sourceTS,
                        destTS: d.destTS
                    }
                    let substrateTxHash = d.extrinsicHash
                    let remoteEVMTxHash = d.remoteEVMTxHash
                    let substratetx;
                    let remoteEvmTx;
                    try {
                        substratetx = await this.getTransaction(substrateTxHash);
                    } catch (err) {
                        console.log("looking for", substrateTxHash, err);
                    }
                    try {
                        remoteEvmTx = await this.getTransaction(remoteEVMTxHash);
                    } catch (err) {
                        console.log("looking for", remoteEVMTxHash, err);
                    }
                    let xcmInfo, xcmOld;
                    if (substratetx != undefined) {
                        try {
                            [xcmInfo, xcmOld] = await this.buildSuccessXcmTransactInfo(substratetx, remoteEvmTx, match, d.xcmIndex, d.transferIndex)
                            //if (this.debugLevel > paraTool.debugTracing) console.log(`TODO: buildSuccessXcmTransactInfo sendExternalWSProvider`, xcmInfo)
                        } catch (e) {
                            console.log(`!!!!buildSuccessXcmTransactInfo extrinsicHash=${substrateTxHash} ERROR!!!!, xcmInfo`, xcmInfo)
                            continue
                        }
                    }
                    //console.log(`extrinsicHash=${substrateTxHash}, xcmInfo`, xcmInfo)

                    let xcmInfoStr = (xcmInfo != undefined) ? JSON.stringify(xcmInfo) : false
                    let xcmInfoBlob = (xcmInfoStr != false) ? mysql.escape(xcmInfoStr) : 'NULL'
                    let sqlB = `update xcmtransfer
            set blockNumberDest = ${d.blockNumberDest},
                destTS = ${d.destTS},
                amountSentUSD = '${amountSentUSD}',
                amountReceivedUSD = '${amountReceivedUSD}',
                priceUSD = '${priceUSD}',
                matched = 1,
                matchedExtrinsicID = '${d.destExtrinsicID}',
                matchedEventID = '${d.eventID}',
                xcmInfo = ${xcmInfoBlob},
                xcmInfolastUpdateDT = Now()
             where extrinsicHash = '${d.extrinsicHash}' and transferIndex = '${d.transferIndex}'`
                    //console.log(`match_xcmtransact (B)`, paraTool.removeNewLine(sqlB))
                    this.batchedSQL.push(sqlB);
                    matches++;

                    // 1. write "addressExtrinsic" feedxcmdest with row key address-extrinsicHash and column extrinsicHash#chainID-extrinsicID-transferIndex
                    //    * we use the SENDING chainID + the sender extrinsicID as the column for the "feedxcmdest" column family
                    let rowKey = `${d.fromAddress.toLowerCase()}#${d.extrinsicHash}` // NOTE: this matches "feed"
                    let cres = {
                        key: rowKey,
                        data: {
                            feedxcminfo: {}
                        }
                    };
                    let extrinsicHashEventID = `${d.extrinsicHash}#${d.chainID}-${d.extrinsicID}-${d.transferIndex}`
                    cres['data']['feedxcminfo'][extrinsicHashEventID] = {
                        value: JSON.stringify(xcmInfo),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };

                    addressextrinsic.push(cres);

                    // 2. write "hashes" feedxcmdest with row key extrinsicHash and column extrinsicHash#chainID-extrinsicID (same as 1)
                    let hres = {
                        key: d.extrinsicHash,
                        data: {
                            xcminfofinalized: {}
                        }
                    }
                    hres['data']['xcminfofinalized'][d.extrinsicID] = {
                        value: JSON.stringify(xcmInfo),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };

                    //console.log("MATCH#", matches, "hashes rowkey", d.extrinsicHash, "col", "addressExtrinsic rowkey=", rowKey, "col", extrinsicHashEventID);
                    hashes.push(hres)
                    if (d.remoteEVMTxHash) {
                        let remoteRec = {
                            key: d.remoteEVMTxHash,
                            data: {
                                xcminfofinalized: {}
                            }
                        }
                        // note: we are using origination extrinsicHashEventID here
                        remoteRec['data']['xcminfofinalized'][d.extrinsicID] = {
                            value: JSON.stringify(xcmInfo),
                            timestamp: d.sourceTS * 1000000
                        };
                        hashes.push(remoteRec)
                        //console.log("REMOTE MATCH#", matches, "hashes rowkey", d.remoteEVMTxHash, "col", "addressExtrinsic rowkey=", rowKey, "col", extrinsicHashEventID);
                    }

                } else {
                    //console.log("SKIP", matched[d.extrinsicHash], matched[d.eventID]);
                }
            }
            if (addressextrinsic.length > 0) {
                await this.insertBTRows(this.btAddressExtrinsic, addressextrinsic, "addressextrinsic")
            }
            if (hashes.length > 0) {
                await this.insertBTRows(this.btHashes, hashes, "addressextrinsic")
            }
            if (addressextrinsic.length > 0 || hashes.length > 0) {
                await this.update_batchedSQL();
            }
        } catch (err) {
            console.log("WRITE_FEEDXCMDEST", err)
        }
        let logDT = new Date(startTS * 1000)
        //console.log(`match_xcm ${startTS} covered ${logDT}`)
    }

    //write xcmInfo for failure case
    async xcmtransfer_match_failure(startTS, endTS = null, ratMin = .99, lookbackSeconds = 7200, forceRematch = false, targetChainID = 'all') {
        let [logDTS, hr] = paraTool.ts_to_logDT_hr(startTS)
        let windowTS = (endTS != undefined) ? endTS - startTS : 'NA'
        //console.log(`match_xcm_failure [${logDTS} ${hr}] windowTS=${windowTS},lookbackSeconds=${lookbackSeconds}, ratMin=${ratMin} chain=${targetChainID}`)
        //console.log(`match_xcm_failure (A)`)

        let endWhere = endTS ? `and xcmtransfer.sourceTS < ${endTS} ` : ""
        // match xcmtransferdestcandidate of the last 2 hours
        //   (a) > 95% amountReceived / amountSent
        //   (b) asset match
        //   (c) time difference matching has to be less than 7200 (and greater than 0)
        //   (d) TODO: require xcmtransferdestcandidate.paraIDs to match xcmtransfer.chainIDDest (this is NOT guarateed to be present)
        // In case of ties, the FIRST one ( "order by diffTS" ) covers this
        let rematchClause = forceRematch ? `xcmtransfer.matched >= 0 and ` : `xcmtransfer.matched = 0 and `
        let targetChainClause = (targetChainID == 'all') ? ` ` : `(xcmtransfer.chainID = ${targetChainID} or xcmtransfer.chainIDDest = ${targetChainID}) and `
        let sqlA = `select
          chainID, extrinsicHash, chainIDDest, fromAddress, symbol, relayChain,
          xcmtransfer.extrinsicID,
          xcmtransfer.amountSent,
          xcmtransfer.transferIndex,
          xcmtransfer.sourceTS,
          xcmtransfer.destTS,
          xcmtransfer.fromAddress as senderAddress,
          xcmtransfer.destAddress,
          xcmtransfer.msgHash,
          xcmtransfer.sentAt,
          xcmtransfer.blockNumber,
          xcmtransfer.sectionMethod,
          xcmtransfer.executedEventID,
          xcmtransfer.destStatus,
          xcmtransfer.errorDesc,
          xcmtransfer.incomplete,
          xcmtransfer.xcmIndex,
          xcmtransfer.transferIndex,
          xcmtransfer.blockNumberDest
        from xcmtransfer
 where  ((xcmtransfer.destStatus = 0 and xcmtransfer.incomplete = 0) or xcmtransfer.incomplete = 1) and
        xcmtransfer.sourceTS >= ${startTS} ${endWhere}
        and ${rematchClause} ${targetChainClause}
        length(xcmtransfer.extrinsicID) > 0
  order by chainID, extrinsicHash`
        //console.log("EXEC", paraTool.removeNewLine(sqlA))
        try {
            let xcmmatches = await this.poolREADONLY.query(sqlA);
            //console.log("FIN", xcmmatches.length);
            let addressextrinsic = []
            let hashes = []
            let matched = {}
            let matches = 0;
            if (xcmmatches.length > 0) {
                //console.log(`[Found] match_xcm_failure (A) len=${xcmmatches.length}`)
            } else {
                //enable this for debugging
                //console.log("[Empty] match_xcm_failure")
            }
            let incompleteTransfers = []
            let destErrorTransfers = []

            //TODO: how to handle multiAsset case?
            for (let i = 0; i < xcmmatches.length; i++) {
                let d = xcmmatches[i];
                let failureType = (d.incomplete == 1) ? 'failedOrigination' : 'failedDestination'
                //console.log(`failureType = ${failureType}`, d)
                if (matched[d.extrinsicHash] == undefined) {
                    let priceUSD = 0;
                    let amountSent = 0;
                    let amountSentUSD = 0;
                    let amountReceived = 0;
                    let amountReceivedUSD = 0;
                    let chainID = d.chainID
                    let decimals = false
                    let symbol = d.symbol;
                    let relayChain = d.relayChain;
                    let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
                    let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
                    if (xcmAssetInfo != undefined && xcmAssetInfo.decimals != undefined) {
                        decimals = xcmAssetInfo.decimals
                    }
                    if (decimals !== false) {
                        amountSent = parseFloat(d.amountSent) / 10 ** decimals;
                        amountReceived = parseFloat(d.amountReceived) / 10 ** decimals;
                    }

                    let priceSource = await this.computePriceUSD({
                        symbol: d.symbol,
                        relayChain: d.relayChain,
                        ts: d.sourceTS
                    });
                    if (priceSource) {
                        priceUSD = priceSource.priceUSD;
                        amountSentUSD = (amountSent > 0) ? priceUSD * amountSent : 0;
                    } else {
                        //console.log(`XCM Asset not found [${d.extrinsicHash}], symbol=${d.symbol}, relayChain=${d.relayChain}`)
                    }
                    // (a) with extrinsicID, we get both the fee (rat << 1) AND the transferred item for when one is isFeeItem=0 and another is isFeeItem=1; ... otherwise we get (b) with just the eventID
                    /*
                    let w = d.destExtrinsicID && (d.destExtrinsicID.length > 0) ? `extrinsicID = '${d.destExtrinsicID}'` : `eventID = '${d.eventID}'`;
                    let sqlC = `update xcmtransferdestcandidate set matched = 1, matchedExtrinsicHash = '${d.extrinsicHash}' where ${w}`
                    console.log(`match_xcm_failure (C)`)
                    console.log(paraTool.removeNewLine(sqlC))
                    this.batchedSQL.push(sqlC);
                    */
                    // never match more than once, by marking both the sending record and the receiving record
                    matched[d.extrinsicHash] = true;

                    let xcmSection = (d.sectionMethod != undefined) ? d.sectionMethod : null
                    let xcmMethod = null
                    let sectionMethodPieces = d.sectionMethod.split(':')
                    if (sectionMethodPieces.length == 2) {
                        xcmSection = sectionMethodPieces[0]
                        xcmMethod = sectionMethodPieces[1]
                    }

                    // problem: this does not store the "dust" fee (which has rat << 1) in bigtable

                    // we use matchRec to build xcmInfo
                    let failedRecord = {
                        failureType: failureType,
                        chainID: d.chainID,
                        blockNumber: paraTool.dechexToInt(d.blockNumber),
                        chainIDDest: d.chainIDDest,
                        blockNumberDest: d.blockNumberDest,
                        symbol: d.symbol,
                        relayChain: d.relayChain,
                        priceUSD: priceUSD,
                        amountSent: amountSent,
                        amountReceived: amountReceived,
                        amountSentUSD: amountSentUSD,
                        amountReceivedUSD: amountReceivedUSD,
                        fromAddress: d.senderAddress, //from xcmtransfer.fromAddress
                        destAddress: d.fromAddress, //from xcmtransfer.destAddress
                        msgHash: (d.msgHash != undefined) ? d.msgHash : '0x', // 'failedOrigination' has no msgHash
                        sentAt: (d.sentAt != undefined) ? d.sentAt : null,
                        xcmSection: xcmSection,
                        xcmMethod: xcmMethod,
                        extrinsicHash: d.extrinsicHash,
                        extrinsicID: d.extrinsicID,
                        destExtrinsicID: d.destExtrinsicID,
                        destEventID: d.eventID,
                        sourceTS: d.sourceTS,
                        destTS: d.destTS,
                        success: d.destStatus,
                        errorDesc: d.errorDesc,
                        executedEventID: d.executedEventID,
                    }
                    let substrateTxHash = d.extrinsicHash
                    let substratetx = await this.getTransaction(substrateTxHash);
                    let xcmInfo, xcmOld;
                    if (substratetx != undefined) {
                        try {
                            [xcmInfo, xcmOld] = await this.buildFailedXcmInfo(substratetx, failedRecord, d.xcmIndex, d.transferIndex)
                            if (this.debugLevel > paraTool.debugTracing) console.log(`buildFailedXcmInfo sendExternalWSProvider`, xcmInfo)
                            //this.sendExternalWSProvider("xcminfo", xcmInfo);
                        } catch (e) {
                            console.log(`!!!!buildFailedXcmInfo extrinsicHash=${substrateTxHash} ERROR!!!!, xcmInfo`, xcmInfo)
                            continue
                        }
                    }
                    //console.log(`extrinsicHash=${substrateTxHash}, xcmInfo`, xcmInfo)

                    let xcmInfoStr = (xcmInfo != undefined) ? JSON.stringify(xcmInfo) : false
                    let xcmInfoBlob = (xcmInfoStr != false) ? mysql.escape(xcmInfoStr) : 'NULL'
                    let matchedExtrinsicID = (d.destExtrinsicID != undefined) ? `${d.destExtrinsicID}` : 'NULL'
                    let matchedEventID = (d.eventID != undefined) ? `${d.eventID}` : 'NULL'
                    if (isNaN(amountSentUSD) || priceUSD == undefined) {
                        amountSentUSD = 0;
                        priceUSD = 0;
                    }

                    let sqlB = `update xcmtransfer
            set blockNumberDest = ${d.blockNumberDest},
                destTS = ${d.destTS},
                amountSentUSD = '${amountSentUSD}',
                priceUSD = '${priceUSD}',
                matched = 1,
                matchedExtrinsicID = ${matchedExtrinsicID},
                matchedEventID = ${matchedEventID},
                xcmInfo = ${xcmInfoBlob},
                xcmInfolastUpdateDT = Now()
             where extrinsicHash = '${d.extrinsicHash}' and transferIndex = '${d.transferIndex}'`
                    //console.log(`match_xcm_failure (B)`, paraTool.removeNewLine(sqlB))
                    this.batchedSQL.push(sqlB);
                    matches++;

                    // 1. write "addressExtrinsic" feedxcmdest with row key address-extrinsicHash and column extrinsicHash#chainID-extrinsicID-transferIndex
                    //    * we use the SENDING chainID + the sender extrinsicID as the column for the "feedxcmdest" column family
                    let rowKey = `${d.fromAddress.toLowerCase()}#${d.extrinsicHash}` // NOTE: this matches "feed"
                    let cres = {
                        key: rowKey,
                        data: {
                            feedxcmfinalized: {}
                        }
                    };
                    let extrinsicHashEventID = `${d.extrinsicHash}#${d.chainID}-${d.extrinsicID}-${d.transferIndex}`
                    let extrinsicID = `${d.extrinsicID}`
                    cres['data']['feedxcminfo'][extrinsicHashEventID] = {
                        value: JSON.stringify(xcmInfo),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };
                    addressextrinsic.push(cres);

                    // 2. write "hashes" feedxcmdest with row key extrinsicHash and column extrinsicHash#chainID-extrinsicID (same as 1)
                    let hres = {
                        key: d.extrinsicHash,
                        data: {
                            xcminfofinalized: {}
                        }
                    }
                    hres['data']['xcminfofinalized'][extrinsicID] = {
                        value: JSON.stringify(xcmInfo),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };
                    hashes.push(hres)
                } else {
                    //console.log("SKIP", matched[d.extrinsicHash], matched[d.eventID]);
                }
            }
            if (addressextrinsic.length > 0) {
                await this.insertBTRows(this.btAddressExtrinsic, addressextrinsic, "addressextrinsic")
            }
            if (hashes.length > 0) {
                await this.insertBTRows(this.btHashes, hashes, "addressextrinsic")
            }
            if (addressextrinsic.length > 0 || hashes.length > 0) {
                await this.update_batchedSQL();
            }
        } catch (err) {
            console.log("WRITE_FEEDXCMDEST", err)
        }
        let logDT = new Date(startTS * 1000)
        //console.log(`match_xcm_failure ${startTS} covered ${logDT}`)
    }

    // This is the key workhorse that matches xcmmessages with
    // match xcmmessages incoming = 0 (s) with incoming = 1 (d)
    //   (a) msgHash + chainID + chainIDDest matching between s and d
    //   (b) time difference between sentAt to be less than 4
    //   (c) with s and d blockTS being within lookbackSeconds (default 120) of each other
    // In case of ties, the FIRST one ( "order by diffTS" ) covers this
    async xcmmessages_match(startTS, endTS = null, lookbackSeconds = 120, targetChainID = 'all', forceRematch = false) {
        let rematchClause = forceRematch ? `` : `s.matched = 0 and d.matched = 0 `
        let endWhere = endTS ? `and s.blockTS < ${endTS} and d.blockTS < ${endTS+lookbackSeconds}` : " "
        let targetChainClause = (targetChainID == 'all') ? ` ` : `(s.chainID = ${targetChainID} or s.chainIDDest = ${targetChainID}) and `
        let sqlA = `select
          s.msgHash, s.msgType, s.relayChain, s.blockNumber as s_blockNumber, d.blockNumber as d_blockNumber, s.sentAt as s_sentAt, d.sentAt as d_sentAt, s.chainID, s.chainIDDest, d.blockTS as destTS, s.blockTS as sourceTS, abs(d.blockTS - s.blockTS) as diffTS, (d.sentAt - s.sentAt) as diffSentAt, d.errorDesc as d_errorDesc, d.destStatus as d_destStatus, d.executedEventID as d_executedEventID, d.connectedTxHash
        from xcmmessages as s, xcmmessages as d
 where  d.msgHash = s.msgHash and
        d.chainID = s.chainID and
        d.chainIDDest = s.chainIDDest and ${targetChainClause}
        s.incoming = 0 and
        d.incoming = 1 and
        s.blockTS >= ${startTS} and
        d.blockTS >= ${startTS} and
        ${rematchClause}
        ${endWhere}
 having (diffSentAt >= 0 and diffSentAt <= 4)
 order by msgHash, diffSentAt, diffTS`
        sqlA = paraTool.removeNewLine(sqlA).replaceAll("and and", "and ")
        //console.log(`xcmmessages_match (A)`, sqlA)
        try {
            let xcmmatches = await this.pool.query(sqlA);
            let matched = {}
            let numRecs = 0;
            if (xcmmatches.length > 0) {
                //console.log(`[Found] xcmmessages_match ${xcmmatches.length}`)
                //console.log(paraTool.removeNewLine(sqlA))
            } else {
                //enable this for debugging
                //console.log("[Empty] xcmmessages_match")
                //console.log(paraTool.removeNewLine(sqlA))
            }
            let vals = ["chainID", "chainIDDest", "sourceTS", "destTS", "matched", "sourceSentAt", "destSentAt", "sourceBlocknumber", "destBlocknumber", "matchDT", "errorDesc", "destStatus", "executedEventID"];
            let out = [];
            let rows = [];
            for (let i = 0; i < xcmmatches.length; i++) {
                let s = xcmmatches[i];
                // to protect against the same dest message matched more than once we keep in the "matched" map a set of msgHash-sentAt (for xcmmessages dest candidates)
                // Note in case of multiple matches, the "order by diffTS" in the SQL statment picks the FIRST one in time closest with the smallest diffTS
                let k = `${s.msgHash}:${s.d_sentAt}`
                if (matched[k] == undefined) {
                    out.push(`( '${s.msgHash}', ${s.s_blockNumber}, 0, '${s.chainID}', '${s.chainIDDest}', ${s.sourceTS}, ${s.destTS}, 1, '${s.s_sentAt}', '${s.d_sentAt}', '${s.s_blockNumber}', '${s.d_blockNumber}', Now(), ${mysql.escape(s.d_errorDesc)}, ${mysql.escape(s.d_destStatus)}, ${mysql.escape(s.d_executedEventID)} )`)
                    out.push(`( '${s.msgHash}', ${s.d_blockNumber}, 1, '${s.chainID}', '${s.chainIDDest}', ${s.sourceTS}, ${s.destTS}, 1, '${s.s_sentAt}', '${s.d_sentAt}', '${s.s_blockNumber}', '${s.d_blockNumber}', Now(), ${mysql.escape(s.d_errorDesc)}, ${mysql.escape(s.d_destStatus)}, ${mysql.escape(s.d_executedEventID)} )`)
                    // write { msgHash, sentAt, chainID, chainIDDest, msgType, blockTS, blockNumber, relayChain } to hashes xcmmessage:${sentAt}
                    this.push_rows_related_keys("xcmmessage", s.s_sentAt.toString(), rows, s.msgHash, {
                        msgHash: s.msgHash,
                        sentAt: s.s_sentAt,
                        chainID: s.chainID,
                        chainIDDest: s.chainIDDest,
                        msgType: s.msgType,
                        blockTS: s.sourceTS,
                        blockNumber: s.s_blockNumber,
                        relayChain: s.relayChain,
                    })
                    matched[k] = true;
                } else {
                    numRecs++;
                }
            }
            let logDT = new Date(startTS * 1000)
            //console.log(`xcmmessages_match ${startTS} covered ${logDT} MATCHES: `, out.length);
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
            await this.btHashes.insert(rows);
            //console.log("xcmmessages_match wrote btHashes rows=", rows.length);
            return (numRecs);
        } catch (err) {
            console.log("xcmmessages_match", err)
        }
    }

    // update lpasset.{token0xcmchainID, token1xcmchainID} with the chainID of the asset using the xcmasset table
    async xcmLiquidityPairsUpdate() {
        for (let i = 0; i < 2; i++) {
            let sql_lp = `update asset as lpasset, asset, xcmasset set lpasset.token0xcmchainID = xcmasset.xcmchainID where lpasset.token0 = asset.asset and lpasset.chainID = asset.chainID and xcmasset.xcmInteriorKey = asset.xcmInteriorKey and lpasset.assetType = 'LiquidityPair'`;
            this.batchedSQL.push(sql_lp);
            // on evm chains they have precompiles in xcContractAddress
            let sql_evm = `update asset as lpasset, asset, xcmasset set lpasset.token0xcmchainID = xcmasset.xcmchainID where lpasset.token0 = asset.xcContractAddress and lpasset.chainID = asset.chainID and xcmasset.xcmInteriorKey = asset.xcmInteriorKey and lpasset.assetType = 'ERC20LP';`;
            this.batchedSQL.push(sql_evm);
        }
        await this.update_batchedSQL()
    }

    async xcm_init() {
        await this.init_chain_asset_and_nativeAsset() // this will init assetInfo and assetLog
        //console.log(`this.xcmAssetInfo`, this.xcmAssetInfo)
    }

    get_concrete_assetChain(analysis, c, chainID, chainIDDest) {
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let relayChainID = paraTool.getRelayChainID(relayChain)

        if (c.parents !== undefined && c.interior !== undefined) {
            let parents = c.parents;
            let interior = c.interior;
            let interiorType = Object.keys(interior)[0]

            if (interiorType == 'here') {
                /*
                ??? NOT sure which one is correct
                  parents: 0 -> referring to itself
                  parents: 1 -> referring to parents (relaychain)
                */
                try {
                    let targetAssetChain = (parents == 0) ? this.getNativeChainAsset(chainIDDest) : this.getNativeChainAsset(relayChainID)
                    if (targetAssetChain == undefined) {
                        //console.log(`get_concrete_assetChain missing!!! parents=${parents}, chainID=${chainID}, chainIDDest=${chainIDDest}, relayChain=${relayChain}, relayChainID=${relayChainID}, targetAssetChain=${targetAssetChain}`)
                        return [false, false]
                    }
                    let [targetAsset, targetChainID] = paraTool.parseAssetChain(targetAssetChain)
                    let targetSymbol = this.getAssetSymbol(targetAsset, targetChainID)
                    let symbolRelayChain = paraTool.makeAssetChain(targetSymbol, relayChain);
                    let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
                    let xcmInteriorKey = (xcmAssetInfo == false || xcmAssetInfo == undefined || xcmAssetInfo.xcmInteriorKey == undefined) ? false : xcmAssetInfo.xcmInteriorKey
                    //console.log(`[paranets=${parents}] ${chainID} ${chainIDDest} ${JSON.stringify(interior)} -> ${targetAssetChain}, symbolRelayChain=${symbolRelayChain}, xcmInteriorKey=${xcmInteriorKey}, xcmAssetInfo`, xcmAssetInfo)
                    return [targetAssetChain, xcmInteriorKey]
                } catch (err) {
                    //console.log(`get_concrete_assetChain parents=${parents}, chainID=${chainID}, chainIDDest=${chainIDDest}, relayChain=${relayChain}, relayChainID=${relayChainID}, error`, err)
                    return [false, false]
                }

            } else {
                let interiorVal = interior[interiorType]
                if (parents == 1 || (chainIDDest == relayChainID)) {
                    // easy case: no expansion if it's from relaychain's perspective
                } else {
                    // expand the key
                    let new_interiorVal = []
                    let expandedParachainPiece = {
                        parachain: paraIDDest
                    }
                    new_interiorVal.push(expandedParachainPiece)
                    if (interiorType == 'x1') {
                        new_interiorVal.push(interiorVal)

                    } else if (Array.isArray(interiorVal)) {
                        //x2/x3/x4/..
                        for (const v of interiorVal) {
                            new_interiorVal.push(v)
                        }
                        //new_interiorVal.concat(interiorVal)
                    } else {
                        //console.log(`expansion error. expecting array`, JSON.stringify(interior))
                        return [false, false]
                    }
                    //console.log(`${chainID}, ${chainIDDest} [parents=${parents}] expandedkey ${JSON.stringify(interiorVal)} ->  ${JSON.stringify(new_interiorVal)}`)
                    interiorVal = new_interiorVal
                }
                let interiorVStr = JSON.stringify(interiorVal)
                let res = this.getXCMAsset(interiorVStr, relayChain)
                let xcmInteriorKey = paraTool.makeXcmInteriorKey(interiorVStr, relayChain);
                if (res) {
                    //console.log(`get_concrete_assetChain FOUND ${chainID}, ${chainIDDest} [parents=${parents}] [${interiorType}] ${JSON.stringify(interior)} -> ${res}, ${xcmInteriorKey}`)
                    return [res, xcmInteriorKey];
                } else {
                    //console.log(`get_concrete_assetChain error ${chainID}, ${chainIDDest} [parents=${parents}] [${interiorType}] ${JSON.stringify(interior)}`)
                    return [false, false]
                }
            }
        } else {
            //console.log("get_concrete_assetChain FAILED2 - parents/interior not set", c);
            return [null, false];
        }
    }

    // All instructions with "MultiAsset" type should be decorated with assetChain / symbols / decimals + USD value at the time of message
    analyzeXCM_MultiAsset(analysis, c, chainID, chainIDDest, ctx) {
        if (c.id != undefined) {
            if (c.id.concrete != undefined) {
                if (ctx == "buyExecution") {} else {
                    let [assetChain, xcmInteriorKey] = this.get_concrete_assetChain(analysis, c.id.concrete, chainID, chainIDDest);
                    if (assetChain && (analysis.assetChains[assetChain] == undefined)) {
                        analysis.assetChains[assetChain] = 1;
                        analysis.xcmInteriorKeys[xcmInteriorKey] = 1;
                        //console.log("PUSHING", assetChain, xcmInteriorKey,  c.id.concrete);
                        return [assetChain, xcmInteriorKey];
                    } else {
                        //console.log("analyzeXCM_MultiAsset MISS PROBLEM", ctx, chainID, chainIDDest, JSON.stringify(c.id.concrete));
                    }
                }
            } else {
                //console.log("analyzeXCM_MultiAsset NOT CONCRETE PROBLEM", chainID, chainIDDest, JSON.stringify(c))
            }
        } else if (c.concreteFungible != undefined) {
            let [assetChain, xcmInteriorKey] = this.get_concrete_assetChain(analysis, c.concreteFungible.id, chainID, chainIDDest);
            if (assetChain && (analysis.assetChains[assetChain] == undefined)) {
                analysis.assetChains[assetChain] = 1;
                analysis.xcmInteriorKeys[xcmInteriorKey] = 1;
                //console.log("PUSHING", assetChain, xcmInteriorKey, c.id.concrete);
                return [assetChain, xcmInteriorKey];
            } else {
                //console.log("analyzeXCM_MultiAsset V0 MISS PROBLEM", ctx, chainID, chainIDDest, JSON.stringify(c.concreteFungible.id));
            }
        } else {
            //console.log("analyzeXCM_MultiAsset NO ID PROBLEM", chainID, chainIDDest, JSON.stringify(c))
        }
        return [false, false];
    }

    analyzeXCM_MultiAssetFilter(analysis, c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        if (c[fld].wild) {} else if (c[fld].definite) {
            //console.log("analyzeXCM_MultiAssetFilter", chainID, chainIDDest, JSON.stringify(c[fld].definite));
        } else {
            // analyzeXCM_MultiAssetFilter 22085 2 {"definite":[{"id":{"concrete":{"parents":0,"interior":{"here":null}}},"fun":{"fungible":10000000000}}]}
            if (Array.isArray(c[fld])) {
                for (let i = 0; i < c[fld].length; i++) {
                    let [ac, xcmKey] = this.analyzeXCM_MultiAsset(analysis, c[fld][i], chainID, chainIDDest, "multiassetfilter")
                    if (ac) {
                        //console.log("analyzeXCM_MultiAssetFilter", ctx, chainID, chainIDDest, JSON.stringify(c[fld][i]), ac, xcmKey);
                    }
                }
            }
        }
    }

    // All instructions with "MultiLocation" (parachain, accountID32/ accountID20, here) should be decorated with chain.id, chain.chainName or the "identity" using lookup_account
    analyzeXCM_MultiLocation(analysis, c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let destAddress = this.chainParser.processBeneficiary(false, c[fld], relayChain);
        if (destAddress) {
            analysis.xcmAddresses.push(destAddress)
            //console.log(`${msg.msgHash} analyzeXCM_MultiLocation destFound:${destAddress}`)
        }
    }

    analyzeXCM_Call(analysis, c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        if (c[fld].encoded != undefined) {
            // analyzeXCM_Call 22000 2 0x1801010006010f23ada31bd3bb06
            //console.log("analyzeXCM_Call", ctx, chainID, chainIDDest, c[fld].encoded)
            // extrinsicCall = apiAt.registry.createType('Call', opaqueCall);
            // ISSUE: How do we get the right api since the indexer needs the "receiving chain" api? -- can we do a mini-API call for this?
        }
    }

    getInstructionSet() {
        let instructionSet = {
            'withdrawAsset': { // Remove the on-chain asset(s) (assets) and accrue them into Holding
                MultiAssets: ['assets'],
                MultiAssetFilter: ['assets'], //v0
                Effects: ['effects'] //v0
            },
            'reserveAssetDeposited': { // Accrue into Holding derivative assets to represent the asset(s) (assets) on Origin.
                MultiAssets: ['assets']
            },
            'receiveTeleportedAsset': {
                MultiAssets: ['assets']
            },
            'queryResponse': {},
            'transferAsset': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary'],
            },
            'transferReserveAsset': {
                MultiAsset: ['assets'],
                MultiLocation: ['destination'],
                XCM: ['xcm']
            },
            'transact': {
                Call: ['call']
            },
            'hrmpNewChannelOpenRequest': {},
            'hrmpChannelAccepted': {},
            'hrmpChannelClosing': {},
            'clearOrigin': {},
            'descendOrigin': {},
            'reportError': {},
            'depositAsset': { // Subtract the asset(s) (assets) from Holding and deposit on-chain equivalent assets under the ownership of beneficiary.
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary']
            },
            'depositReserveAsset': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary'],
                XCM: ['xcm']
            },
            'exchangeAsset': {
                MultiAssetFilter: ['give'],
                MultiAssets: ['receive']
            },
            'initiateReserveWithdraw': {
                MultiAssetFilter: ['assets'],
                XCM: ['xcm']
            },
            'initiateTeleport': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['destination'],
                XCM: ['xcm']
            },
            'queryHolding': {
                MultiLocation: ['destination'],
                MultiAssetFilter: ['assets']
            },
            'buyExecution': { //Pay for the execution of the current message from Holding.
                MultiAsset: ['fees']
            },
            'refundSurplus': {},
            'setErrorHandler': {},
            'setAppendix': {},
            'clearError': {},
            'claimAsset': {
                MultiAsset: ['assets'],
                MultiLocation: ['ticket']
            },
            'trap': {},
            'subscribeVersion': {},
            'unsubscribeVersion': {},
            'burnAsset': {
                MultiAsset: ['assets']
            },
            'expectAsset': {
                MultiAsset: ['assets']
            },
            'expectOrigin': {
                MultiLocation: ['origin']
            },
            'expectError': {},
            //V1
            'reserveAssetDeposited': {
                MultiAssetFilter: ['assets'],
                Effects: ['effects'],
            },
            //V0
            'teleportAsset': {
                MultiAsset: ['assets'],
                Effects: ['effects'],
            },
            'reserveAssetDeposit': {
                MultiAsset: ['assets'],
                Effects: ['effects'],
            }

        }
        return instructionSet
    }

    getXCMParentFingerprintsOfChild(o) {
        let fps = [];
        let xcmInstructions = [
            ["isTransferReserveAsset", "asTransferReserveAsset"],
            ["isDepositReserveAsset", "asDepositReserveAsset"],
            ["isInitiateReserveWithdraw", "asInitiateReserveWithdraw"],
            ["isInitiateTeleport", "asInitiateTeleport"],
            ["isExchangeAsset", "asExchangeAsset"]
        ];

        for (let i = 0; i < o.asV2.length; i++) {
            let instruction = o.asV2[i];
            for (let j = 0; j < xcmInstructions.length; j++) {
                let is = xcmInstructions[j][0];
                let as = xcmInstructions[j][1];
                if (instruction[is]) {
                    let o2 = instruction[as];
                    if (o2.xcm != undefined) {
                        for (let k = 0; k < o2.xcm.length; k++) {
                            let fp = o2.xcm[k].toHex();
                            //console.log("CHILD", as, k, o2.xcm[k].toHex(), JSON.stringify(o2.xcm[k].toJSON()));
                            fps.push(fp);
                        }
                    }
                }
            }
        }

        return fps;
    }

    getXCMChildFingerprints(o) {
        let fps = [];
        for (let i = 0; i < o.asV2.length; i++) {
            let instruction = o.asV2[i];
            let fp = instruction.toHex();
            //console.log(instruction.toJSON(), instruction.toHex());
            fps.push(fp);
        }
        return fps;
    }

    compute_fingerprints_inclusion(fp0, fp1) {
        // cnt0 = # of elements of fp0 in fp1
        let cnt0 = 0;
        for (let i = 0; i < fp0.length; i++) {
            if (fp1.includes(fp0[i])) {
                cnt0++;
            }
        }
        // cnt1 = # of elements of fp1 in fp0
        let cnt1 = 0;
        for (let i = 0; i < fp1.length; i++) {
            if (fp0.includes(fp0[i])) {
                cnt1++;
            }
        }
        if (cnt0 == fp0.length) return (true);
        if (cnt1 == fp1.length) return (true);
        return (false);
    }

    async decodeXCM(hex) {
        var obj = this.api.registry.createType('XcmVersionedXcm', hex);
        return obj.toJSON();
    }

    analyzeXCMInstruction(analysis, instruction, chainID, chainIDDest, ctx = "") {
        let instructionSet = this.getInstructionSet();

        for (const i of Object.keys(instructionSet)) {
            if (instruction[i] != undefined) {
                let features = instructionSet[i];
                if (features.MultiAssets != undefined) {
                    for (let j = 0; j < instruction[i].length; j++) {
                        this.analyzeXCM_MultiAsset(analysis, instruction[i][j], chainID, chainIDDest, i);
                    }
                }
                if (features.MultiAsset != undefined) {
                    for (const fld of features.MultiAsset) {
                        if (instruction[i][fld] != undefined) {
                            this.analyzeXCM_MultiAsset(analysis, instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }
                if (features.MultiAssetFilter != undefined) {
                    for (const fld of features.MultiAssetFilter) {
                        this.analyzeXCM_MultiAssetFilter(analysis, instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
                if (features.MultiLocation != undefined) {
                    for (const fld of features.MultiLocation) {
                        this.analyzeXCM_MultiLocation(analysis, instruction[i], fld, chainID, chainIDDest, i);
                    }
                }

                if (features.XCM != undefined) {
                    for (const fld of features.XCM) {
                        if (instruction[i][fld] != undefined) {
                            //console.log("analyzing instruction containing XCM ", instruction);
                            // recursive call
                            let xcmChild = instruction[i][fld];
                            // console.log( "  ... xcmChild:", xcmChild);
                            this.analyzeXCMInstructions(analysis, instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }

                if (features.Effects != undefined) {
                    for (const fld of features.Effects) {
                        if (instruction[i][fld] != undefined) {
                            //console.log("analyzing instruction containing effects ", instruction);
                            // recursive call
                            let xcmChild = instruction[i][fld];

                            this.analyzeXCMInstructions(analysis, instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }

                if (features.Call != undefined) {
                    for (const fld of features.Call) {
                        this.analyzeXCM_Call(analysis, instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
            }
        }
    }

    analyzeXCMInstructionsV1(analysis, xcmMsgV1, chainID, chainIDDest, ctx) {
        this.analyzeXCMInstruction(analysis, xcmMsgV1, chainID, chainIDDest, ctx)
    }

    analyzeXCMInstructionsV0(analysis, xcmMsgV0, chainID, chainIDDest, ctx) {
        this.analyzeXCMInstruction(analysis, xcmMsgV0, chainID, chainIDDest, ctx)
    }

    analyzeXCMInstructions(analysis, instructions, chainID, chainIDDest, ctx) {
        for (const instruction of instructions) {
            this.analyzeXCMInstruction(analysis, instruction, chainID, chainIDDest, ctx)
        }
    }

    async match_parentInclusionFingerprints(parentInclusionFingerprints, rec) {
        if (parentInclusionFingerprints == "[]") return (false);
        let sqlchild = `select incoming, msgHash, blockNumber, sentAt, instructionFingerprints, blockTS, msgHex, chainID, chainIDDest from xcmmessages where blockTS >= ${rec.blockTS} and blockTS <= ${rec.blockTS+60} and instructionFingerprints is not null and incoming = 0 order by blockTS limit 20`
        let childRecs = await this.pool.query(sqlchild);
        for (let c = 0; c < childRecs.length; c++) {
            let childRec = childRecs[c];
            if (this.compute_fingerprints_inclusion(parentInclusionFingerprints, childRec.instructionFingerprints)) {
                let updsql = `update xcmmessages set parentMsgHash = '${rec.msgHash}', parentBlocknumber='${rec.blockNumber}', parentSentAt='${rec.sentAt}' where msgHash = '${childRec.msgHash}' and blockNumber = '${childRec.blockNumber}' and incoming = '${childRec.incoming}'`;
                this.batchedSQL.push(updsql);
                // assume chain of messages, not doing tree yet
                let updsql2 = `update xcmmessages set childMsgHash = '${childRec.msgHash}', childBlockNumber='${childRec.blockNumber}', childSentAt='${childRec.sentAt}' where msgHash = '${rec.msgHash}' and blockNumber = '${rec.blockNumber}' and incoming = '${rec.incoming}'`;
                this.batchedSQL.push(updsql2);
                await this.update_batchedSQL();
                return (true);
            }
        }
        return (false);
    }

    performAnalysisInstructions(msg, chainID, chainIDDest) {
        let analysis = {
            xcmAddresses: [],
            assetChains: {},
            xcmInteriorKeys: {}
        }
        this.chainParserInit(chainID, this.debugLevel);
        let version = Object.keys(msg)[0]
        switch (version) {
            case 'v2':
                this.analyzeXCMInstructions(analysis, msg.v2, chainID, chainIDDest, "computeAssetChains")
                break;
            case 'v1':
                this.analyzeXCMInstructionsV1(analysis, msg.v1, chainID, chainIDDest, "computeAssetChains")
                break;
            case 'v0':
                this.analyzeXCMInstructionsV0(analysis, msg.v0, chainID, chainIDDest, "computeAssetChains")
                break;
            default:
                //console.log("unknown version", version);
        }
        return analysis;
    }


    // for any xcmmessages in a period:
    //  (a) update instructionFingerprints + parentInclusionFingerprints using getXCMParentFingerprintsOfChild + getXCMChildFingerprints
    //  (b) if there are parentfingerprints detected, look for childfingerprints in the next step
    //  (c) compute assetChains and beneficiaries
    async computeXCMFingerprints(startTS, endTS = null, targetChainID = 'all') {
        let lastTS = endTS;
        let targetChainClause = (targetChainID == 'all') ? ` ` : `and (chainID = ${targetChainID} or chainIDDest = ${targetChainID}) `
        let endWhere = (endTS) ? ` and blockTS <= ${endTS} ` : "";
        let sql = `select msgHash, msgHex, blockNumber, sentAt, incoming, chainID, chainIDDest, msgStr, blockTS, assetChains, instructionFingerprints from xcmmessages where blockTS >= ${startTS} ${targetChainClause} ${endWhere}  order by blockTS desc`;
        //console.log(`computeXCMFingerprints`)
        //console.log(paraTool.removeNewLine(sql))
        let xcmRecs = await this.pool.query(sql);
        let out = [];
        let vals = ["chainID", "chainIDDest", "parentInclusionFingerprints", "instructionFingerprints", "assetChains", "xcmInteriorKeys"];
        let parentIncFingerprints = [];
        //console.log("computeXCMFingerprints:", xcmRecs.length, sql)
        for (let r = 0; r < xcmRecs.length; r++) {
            let rec = xcmRecs[r];
            let msg = JSON.parse(rec.msgStr);
            try {
                if (r == 0) lastTS = rec.blockTS;
                let analysis = this.performAnalysisInstructions(msg, rec.chainID, rec.chainIDDest)
                let assetChains = Object.keys(analysis.assetChains);
                let xcmInteriorKeysRaw = Object.keys(analysis.xcmInteriorKeys);

                let xcmInteriorKeys = (xcmInteriorKeysRaw.length > 0) ? `'${xcmInteriorKeysRaw.join('|')}'` : `'Null'`
                var xcmObj = this.api.registry.createType('XcmVersionedXcm', rec.msgHex.toString());
                let parentInclusionFingerprints = [];
                let instructionFingerprints = []
                if (xcmObj.isV2) {
                    parentInclusionFingerprints = this.getXCMParentFingerprintsOfChild(xcmObj);
                    instructionFingerprints = this.getXCMChildFingerprints(xcmObj);
                    if (parentInclusionFingerprints.length > 0) {
                        parentIncFingerprints.push({
                            parentInclusionFingerprints,
                            rec
                        });
                    }
                }
                let res = `('${rec.msgHash}', '${rec.blockNumber}', '${rec.incoming}', '${rec.chainID}', '${rec.chainIDDest}', '${JSON.stringify(parentInclusionFingerprints)}', '${JSON.stringify(instructionFingerprints)}', ${mysql.escape(JSON.stringify(assetChains))}, ${xcmInteriorKeys})`
                //console.log(`computeXCMFingerprint`, res)
                out.push(res);
            } catch (err) {
                console.log(err);
            }
        }

        for (let i = 0; i < parentIncFingerprints.length; i++) {
            let p = parentIncFingerprints[i];
            await this.match_parentInclusionFingerprints(p.parentInclusionFingerprints, p.rec);
        }

        if (out.length > 0) {
            //console.log(`computeXCMFingerprints len=${out.length}`);
            let sqlDebug = false
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            }, sqlDebug);
            out = [];
        }
        return lastTS;
    }

    async xcmmatch2_matcher(startTS, endTS = null, forceRematch = false, lookbackSeconds = 120, targetChainID = 'all') {
        let [logDTS, hr] = paraTool.ts_to_logDT_hr(startTS)
        let windowTS = (endTS != undefined) ? endTS - startTS : 'NA'
        //console.log(`[${logDTS} ${hr}] windowTS=${windowTS},lookbackSeconds=${lookbackSeconds} chain=${targetChainID}`)

        let targetChainClause = (targetChainID == 'all') ? ` ` : `(xcmtransfer.chainID = ${targetChainID} or xcmtransfer.chainIDDest = ${targetChainID}) and `
        let endWhere = endTS ? `and xcmmessages.blockTS <= ${endTS} and xcmtransfer.sourceTS <= ${endTS}` : "";
        // set xcmmessages.{extrinsicID,extrinsicHash} based on xcmtransfer.msgHash / sentAt <= 4 difference
        let sqlA = `update xcmtransfer, xcmmessages set xcmmessages.extrinsicID = xcmtransfer.extrinsicID, xcmmessages.extrinsicHash = xcmtransfer.extrinsicHash, xcmmessages.sectionMethod = xcmtransfer.sectionMethod, xcmmessages.amountSentUSD = xcmtransfer.amountSentUSD
               where xcmtransfer.msgHash = xcmmessages.msgHash and
                 xcmtransfer.chainIDDest = xcmmessages.chainIDDest and xcmtransfer.chainID = xcmmessages.chainID and ${targetChainClause}
                 xcmtransfer.msgHash is not null and
                 xcmmessages.blockTS >= ${startTS} and
                 xcmtransfer.sourceTS >= ${startTS} and
                 abs(xcmmessages.sentAt - xcmtransfer.sentAt) <= 4 ${endWhere}`;
        this.batchedSQL.push(sqlA);
        //console.log(`xcmmatch2_matcher (A)`)
        //console.log(paraTool.removeNewLine(sqlA))
        await this.update_batchedSQL();

        // update xcmtransfer's (update executedEventID, errorDesc, destStatus, connectedTxHash) using incoming xcmMsg
        let sqlA1 = `update xcmtransfer, xcmmessages set xcmtransfer.executedEventID = xcmmessages.executedEventID, xcmtransfer.errorDesc = xcmmessages.errorDesc, xcmtransfer.destStatus = xcmmessages.destStatus,  xcmtransfer.destTS = xcmmessages.destTS, xcmtransfer.blockNumberDest = xcmmessages.destBlocknumber, xcmtransfer.connectedTxHash = xcmmessages.connectedTxHash
               where xcmmessages.incoming = 1 and xcmtransfer.msgHash = xcmmessages.msgHash and
                 xcmtransfer.chainIDDest = xcmmessages.chainIDDest and xcmtransfer.chainID = xcmmessages.chainID and
                 xcmtransfer.msgHash is not null and
                 xcmmessages.blockTS >= ${startTS} and
                 xcmtransfer.sourceTS >= ${startTS} and
                 abs(xcmmessages.sentAt - xcmtransfer.sentAt) <= 4 ${endWhere}`
        this.batchedSQL.push(sqlA1);
        if (this.debugLevel >= paraTool.debugTracing) console.log(`xcmmatch2_matcher (A1)`)
        if (this.debugLevel >= paraTool.debugTracing) console.log(paraTool.removeNewLine(sqlA1))
        await this.update_batchedSQL();

        // update xcmmessages of children
        endWhere = endTS ? `and p.blockTS <= ${endTS} and c.blockTS <= ${endTS}` : "";
        let sqlB = `update xcmmessages as c, xcmmessages as p  set c.extrinsicID = p.extrinsicID, c.extrinsicHash = p.extrinsicHash where
            p.childMsgHash is not null and p.extrinsicID is not null and c.msgHash = p.childMsgHash and
             c.chainID = p.chainIDDest and
             abs(c.sentAt - p.childSentAt) <= 4 and
             c.extrinsicID is null and
             p.blockTS >= ${startTS} and
             c.blockTS >= ${startTS} ${endWhere}`
        this.batchedSQL.push(sqlB);
        //console.log(`xcmmatch2_matcher (B)`)
        //console.log(paraTool.removeNewLine(sqlB))
        await this.update_batchedSQL();

        // update
        // ((d.asset = xcmmessages.asset) or (d.nativeAssetChain = xcmmessages.nativeAssetChain and d.nativeAssetChain is not null)) and
        // No way to get "sentAt" in xcmtransferdestcandidate to tighten this?

        endWhere = endTS ? `and xcmmessages.blockTS < ${endTS} and d.destTS < ${endTS+lookbackSeconds} ` : "";
        let rematchClause = forceRematch ? `` : `xcmmessages.assetsReceived is Null and`
        let sqlC = `select  xcmmessages.chainID, xcmmessages.chainIDDest,
          (d.destts - xcmmessages.blockTS) as diffTS,
          (d.sentAt - xcmmessages.sentAt) as diffSentAt,
          xcmmessages.msgHash,
          xcmmessages.blockNumber,
          xcmmessages.incoming,
          xcmmessages.extrinsicHash,
          xcmmessages.extrinsicID,
          xcmmessages.blockTS,
          xcmmessages.beneficiaries,
          xcmmessages.executedEventID,
          xcmmessages.destStatus,
          xcmmessages.errorDesc,
          xcmmessages.xcmInteriorKeys as xcmInteriorKeys0,
          d.eventID, d.symbol, d.relayChain, d.amountReceived, d.blockNumberDest, d.destTS, d.msgHash as candidateMsgHash
        from xcmmessages, xcmtransferdestcandidate as d
 where  d.fromAddress = xcmmessages.beneficiaries and
        d.chainIDDest = xcmmessages.chainIDDest and
        d.msgHash = xcmmessages.msgHash and
        d.sentAt - xcmmessages.sentAt >= 0 and d.sentAt - xcmmessages.sentAt <= 4 and
        xcmmessages.blockTS >= ${startTS} and
        d.addDT is not null and
        d.destTS >= ${startTS} and
        d.destTS - xcmmessages.blockTS >= 0 and
        d.destTS - xcmmessages.blockTS < ${lookbackSeconds} and ${rematchClause}
        length(xcmmessages.extrinsicID) > 0  ${endWhere}`;
        //console.log(`xcmmatch2_matcher (C)`, paraTool.removeNewLine(sqlC))
        try {
            let matches = await this.pool.query(sqlC);
            let assetsReceived = {};
            let assetsReceivedXCMTransfer = {};
            let statusXCMTransfer = {};
            let prevEventK = false
            let prevDestMatch = false
            let incoming = {};
            let outgoing = {};
            for (const m of matches) {
                let k = `${m.msgHash}-${m.blockNumber}-${m.chainID}-${m.chainIDDest}`; //asset received is direction less
                if (m.incoming == 1) {
                    incoming[`${m.msgHash}-${m.blockNumber}`] = 1
                } else {
                    outgoing[`${m.msgHash}-${m.blockNumber}`] = 1
                }
                if (assetsReceived[k] == undefined) {
                    assetsReceived[k] = [];
                }
                let priceUSD = 0;
                let amountReceivedUSD = 0;
                let amountReceived = m.amountReceived;
                let targetChainID = m.chainIDDest
                let symbol = m.symbol
                let relayChain = m.relayChain
                let decimals = null;
                let isIncompleteRec = true
                let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
                let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain)
                let xcmInteriorKey = (xcmAssetInfo == false || xcmAssetInfo == undefined || xcmAssetInfo.xcmInteriorKey == undefined) ? false : xcmAssetInfo.xcmInteriorKey
                let xcmInteriorKey0 = m.xcmInteriorKeys0 // from computeXCMFingerprints
                //if (xcmInteriorKey != xcmInteriorKey0) console.log(`mismatch xcmInteriorKey0=${xcmInteriorKey0}, xcmInteriorKey=${xcmInteriorKey}`)
                let p = await this.computePriceUSD({
                    symbol: m.symbol,
                    relayChain: m.relayChain,
                    ts: m.blockTS
                });
                //console.log(`getting price targetAsset=${targetAsset}, targetChainID=${targetChainID}, ts=${m.blockTS}, priceUSDblockTS=${priceUSDblockTS}`)
                if (p) {
                    priceUSD = p.priceUSD;
                    decimals = p.assetInfo ? p.assetInfo.decimals : null;
                    if (decimals) {
                        amountReceived = parseFloat(m.amountReceived) / 10 ** decimals;
                        amountReceivedUSD = (amountReceived > 0) ? priceUSD * amountReceived : 0;
                        isIncompleteRec = false
                    }
                } else {
                    //not found..
                }
                let destMatch = {
                    chainID: m.chainIDDest,
                    xcmInteriorKey: xcmInteriorKey,
                    symbol: symbol,
                    amountReceived: amountReceived,
                    amountReceivedUSD: amountReceivedUSD,
                    blockNumber: m.blockNumber,
                    ts: m.destTS
                };
                if (isIncompleteRec) {
                    //console.log(`Incomplete destMatch`, destMatch)
                } else {
                    destMatch.decimals = decimals;
                    //console.log(`OK destMatch`, destMatch)
                }

                let isNewEventK = false; //let currEventID = m.eventID
                let currEventK = `${m.candidateMsgHash}-${m.amountReceived}`
                if (prevEventK != currEventK) isNewEventK = true
                if (isNewEventK) {
                    assetsReceived[k].push(destMatch);
                }

                if (m.extrinsicHash && m.extrinsicHash.length > 0) {
                    let k2 = `${m.extrinsicHash}:${m.extrinsicID}:${m.msgHash}`
                    if (assetsReceivedXCMTransfer[k2] == undefined) {
                        assetsReceivedXCMTransfer[k2] = [];
                    }
                    if (isNewEventK) {
                        assetsReceivedXCMTransfer[k2].push(destMatch);
                    }
                    statusXCMTransfer[k2] = {
                        destStatus: m.destStatus,
                        errorDesc: m.errorDesc,
                        executedEventID: m.executedEventID,
                    }
                }
                prevEventK = currEventK
                prevDestMatch = destMatch
            }

            let out = [];
            let localKeyMap = {};
            //assumption: given k(`${m.msgHash}-${m.blockNumber}-${m.chainID}-${m.chainIDDest}`) and same k[0]
            //both incoming and outgoing records should have the same xcmInteriorKeys, thus bypassing the "assetsReceived"

            for (const k of Object.keys(assetsReceived)) {
                let xcmInteriorKeys = []
                let xcmInteriorKeysStr = 'NULL'
                let [msgHash, blockNumber, chainID, chainIDDest] = k.split("-");
                let r = assetsReceived[k]; //assetsReceived array
                for (const a of r) {
                    if (a.xcmInteriorKey != undefined) {
                        xcmInteriorKeys.push(a.xcmInteriorKey)
                    }
                }
                if (xcmInteriorKeys.length > 0) {
                    //console.log(`${k}`, r)
                    xcmInteriorKeysStr = `'${xcmInteriorKeys.join('|')}'`
                    localKeyMap[msgHash] = xcmInteriorKeysStr
                } else if (localKeyMap[msgHash] != undefined) {
                    xcmInteriorKeysStr = localKeyMap[msgHash]
                }
                //console.log(`${k}, xcmInteriorKeys=${xcmInteriorKeysStr}`)
                let ar = JSON.stringify(r);
                if (ar.length < 1024) {
                    let valueUSD = this.sum_assetsReceived(r);
                    // console.log("*****", valueUSD, r);
                    //["msgHash", "blockNumber", "incoming"] +  ["assetsReceived", "amountReceivedUSD", "chainID", "chainIDDest", "xcmInteriorKeys"]
                    if (outgoing[`${msgHash}-${blockNumber}`] != undefined) out.push(`('${msgHash}', '${blockNumber}', '0', ${mysql.escape(ar)}, '${valueUSD}', '${chainID}', '${chainIDDest}', ${xcmInteriorKeysStr})`);
                    if (incoming[`${msgHash}-${blockNumber}`] != undefined) out.push(`('${msgHash}', '${blockNumber}', '1', ${mysql.escape(ar)}, '${valueUSD}', '${chainID}', '${chainIDDest}', ${xcmInteriorKeysStr})`);
                } else {
                    //console.log("LONG VAL", k, "RECS", ar.length, "assetsreceived=", ar);
                }
            }
            let sqlDebug = true
            let vals = ["assetsReceived", "amountReceivedUSD", "chainID", "chainIDDest", "xcmInteriorKeys"];
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            }, sqlDebug);

            out = [];
            for (const k of Object.keys(assetsReceivedXCMTransfer)) {
                let [extrinsicHash, extrinsicID, msgHash] = k.split(":");
                let r = assetsReceivedXCMTransfer[k];
                let ar = JSON.stringify(r);
                if (ar.length < 1024) {
                    let valueUSD = this.sum_assetsReceived(r);
                    const {
                        destStatus,
                        errorDesc,
                        executedEventID
                    } = statusXCMTransfer[k];
                    //Important only update xcmtransfer.assetsReceived, {destStatus, errorDesc, executedEventID} will be updated via sqlA1
                    let sqlD = `update xcmtransfer set assetsReceived = ${mysql.escape(ar)} where extrinsicHash = '${extrinsicHash}' and extrinsicID = '${extrinsicID}' and msgHash = '${msgHash}'`;
                    //console.log(`xcmmatch2_matcher (d)`, paraTool.removeNewLine(sqlD))
                    this.batchedSQL.push(sqlD);
                    await this.update_batchedSQL();
                } else {
                    //console.log("LONG VAL", k, "RECS", ar.length, "assetsreceived=", ar);
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    sum_assetsReceived(r) {
        let valueUSD = 0;
        let events = {};
        if (r && Array.isArray(r)) {
            for (let i = 0; i < r.length; i++) {
                if (events[r[i].eventID] == undefined) {
                    if (r[i].amountReceivedUSD > 0) {
                        valueUSD += r[i].amountReceivedUSD;
                        events[r[i].eventID] = true;
                    }
                }
            }
        }
        if (isNaN(valueUSD)) return (0);
        return (valueUSD);
    }
    /* because the indexer may insert multiple xcmmessages record when a partcular xcmmessage sits in the chains message queue for 1 or more blocks, this xcmmessages_dedup process cleans out any records that exist after the above matching process */
    async xcmmessages_dedup(startTS, endTS = null, lookbackSeconds = 120, targetChainID = 'all') {
        let endWhere = endTS ? `and s.blockTS < ${endTS} and d.blockTS < ${endTS+lookbackSeconds}` : "";
        let targetChainClause = (targetChainID == 'all') ? ` ` : `(s.chainID = ${targetChainID} or s.chainIDDest = ${targetChainID}) and `
        let sql = `select
          s.msgHash, s.blockNumber as s_blockNumber, s.incoming, (d.sentAt - s.sentAt) as diffSentAt
        from xcmmessages as s, xcmmessages as d
 where  d.msgHash = s.msgHash and
        d.chainID = s.chainID and
        d.chainIDDest = s.chainIDDest and ${targetChainClause}
        ( ( s.incoming = 0 and  d.incoming = 1 ) or ( s.incoming = 1 and d.incoming = 0 ) ) and
        s.blockTS >= ${startTS} and
        d.blockTS >= ${startTS} and
        s.matched = 0 and
        d.matched = 1 ${endWhere}
having (diffSentAt >= 0 and diffSentAt <= 4)
order by msgHash`
        //console.log("xcmmessages_dedup", paraTool.removeNewLine(sql))
        try {
            let xcmsingles = await this.pool.query(sql);
            let vals = ["matched"];
            let out = [];
            for (let i = 0; i < xcmsingles.length; i++) {
                let s = xcmsingles[i];
                out.push(`('${s.msgHash}', ${s.s_blockNumber}, ${s.incoming}, '-1')`)
            }
            //console.log(`xcmmessages_singles_dedup`, out);
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
        } catch (err) {
            console.log("xcmmessages_match", err)
        }
    }

    async waitForNewXCMMessage(minTS, waitMS = 2000, maxIterations = 10) {
        let iterations = 0;
        do {
            let sql = `select msgHash, blockTS from xcmmessages where blockTS > ${minTS} order by blockTS`
            //console.log(sql);
            let x = await this.poolREADONLY.query(sql);
            if (x.length > 0) {
                return x[0].blockTS;
            } else {
                await this.sleep(waitMS);
            }
            iterations++;
        } while (iterations < maxIterations);
    }

    async xcmanalytics_period(chain, t0, t1 = null, forceRematch = false, targetChainID = 'all') {
        let rat = 0.97
        let transferLookbackwindow = 7200
        let msgLookbackwindow = 120

        if (forceRematch) {
            let numRecs_ = await this.xcmmessages_match(t0, t1, msgLookbackwindow, targetChainID, forceRematch);
            //console.log(`[FORCED] FAILURE CASES ${t0} ${t1} (chain:${targetChainID})`);
            await this.xcmtransfer_match_failure(t0, t1, rat, transferLookbackwindow, forceRematch, targetChainID);

            //console.log(`[FORCED] NORMAL CASES ${t0} ${t1} (chain:${targetChainID})`);
            let numRecs = 0,
                lastTS = 0;

            await this.xcmtransfer_match(t0, t1, rat, transferLookbackwindow, forceRematch, targetChainID);
            await this.xcmtransact_match(t0, t1, transferLookbackwindow, forceRematch, targetChainID);
            return [0, 0];
        } else {
            //console.log(`[NONFORCED] match ${t0} ${t1} (chain:${targetChainID}, msgLookbackwindow:${msgLookbackwindow})`);
            // xcmmessages_match matches incoming=0 and incoming=1 records
            let numRecs = await this.xcmmessages_match(t0, t1, msgLookbackwindow, targetChainID, forceRematch);
            // computeXCMFingerprints updates any xcmmessages which have not been fingerprinted, fill in xcmmessages.{parentInclusionFingerprints, instructionFingerprints}
            let lastTS = await this.computeXCMFingerprints(t0, t1, targetChainID);
            // xcmmatch2_matcher computes assetsReceived by matching xcmmessages.beneficiaries(2) to xcmtransferdestcandidate
            await this.xcmmatch2_matcher(t0, t1, forceRematch, msgLookbackwindow, targetChainID)

            // marks duplicates in xcmmessages
            await this.xcmmessages_dedup(t0, t1, msgLookbackwindow, targetChainID);

            //console.log(`FAILURE CASES ${t0} ${t1} (chain:${targetChainID})`);
            await this.xcmtransfer_match_failure(t0, t1, rat, transferLookbackwindow, forceRematch, targetChainID);

            //console.log(`NORMAL CASES ${t0} ${t1} (chain:${targetChainID})`);
            await this.xcmtransfer_match(t0, t1, rat, transferLookbackwindow, forceRematch, targetChainID);
            await this.xcmtransact_match(t0, t1, transferLookbackwindow, forceRematch, targetChainID);

            numRecs = await this.xcmmessages_match(t0, t1, msgLookbackwindow, targetChainID, forceRematch);

            await this.writeBTHashes_feedxcmmessages(t0, t1);
            return [numRecs, lastTS];
        }
    }

    async xcmanalytics(chain, lookbackDays, forceRematch = false) {
        let endTS = this.currentTS();
        let startTS = endTS - lookbackDays * 86400;
        for (let ts = startTS; ts < endTS; ts += 86400) {
            let t0 = ts;
            let t1 = ts + 86400;
            await this.xcmanalytics_period(chain, t0, t1, forceRematch);
        }
    }

    async writeBTHashes_feedxcmmessages(startTS, endTS = null) {
        // write to hashes bigtable
        let sql = `select msgHash, chainID, chainIDDest, msgType, msgStr, relayChain, version, path, executedEventID, destStatus, errorDesc, extrinsicHash, extrinsicID, sectionMethod, assetChains,
      parentMsgHash, parentSentAt, parentBlockNumber, childMsgHash, childSentAt, childBlocknumber, sourceTS, destTS, sourceSentAt, destSentAt, sourceBlocknumber, destBlocknumber, beneficiaries, assetsReceived, amountReceivedUSD
      from xcmmessages where blockTS >= ${startTS} and blockTS <= ${endTS} and matched = 1 limit 1`
        let hashesRowsToInsert = [];
        let messages = await this.poolREADONLY.query(sql)
        for (let i = 0; i < messages.length; i++) {
            let s = messages[i]
            let hashrec = {};
            let col = `${s.chainID}:${s.chainIDDest}:${s.sourceBlocknumber}:${s.destBlocknumber}`
            hashrec[col] = {
                value: JSON.stringify(s),
                timestamp: s.sourceTS * 1000
            };
            let msgHashRec = {
                key: s.msgHash,
                data: {},
            }
            msgHashRec.data["feedxcmmessages"] = hashrec
            hashesRowsToInsert.push(msgHashRec)
        }
        if (hashesRowsToInsert.length > 0) {
            await this.insertBTRows(this.btHashes, hashesRowsToInsert, "hashes");
        }
    }

    async matchPeriod(forceRematch = true, chainID, logDT, hr) {
        let targetChainID = chainID
        if (chainID == 'all') chainID = '0'
        let indexTSPeriod = paraTool.logDT_hr_to_ts(logDT, hr);
        var sql = `select floor(UNIX_TIMESTAMP(blockDT)/3600)*3600 as indexTS, min(blockNumber) startBN, max(blockNumber) endBN from block${chainID} where blockDT >= FROM_UNIXTIME(${indexTSPeriod}) and blockDT < FROM_UNIXTIME(${indexTSPeriod+3600}) group by indexTS order by indexTS;`
        var periods = await this.poolREADONLY.query(sql);
        //console.log(sql)
        //console.log(`periods`, periods)
        console.log(`matchPeriod chain=${targetChainID} [${logDT} ${hr}]`)

        let chain = await this.setupChainAndAPI(chainID);
        //console.log(chain);

        let indexPeriodProcessedCnt = 0
        for (let i = 0; i < periods.length; i++) {
            let period = periods[i]
            let t0 = period.indexTS - 1
            let t1 = period.indexTS + 3599
            //let forceRematch = true //MK why is forceRematch being added here??
            await this.xcmanalytics_period(chain, t0, t1, forceRematch, targetChainID);
        }
    }

    // when we need to do some reanalytics on demand, xcmReanalytics writes hashes table with "xcminfofinalized" column records with "v4" column
    //  either an array or object based on the number of xcmInfo objects -- to cover xcmIndex > 0 and transferIndex > 0 situations
    async xcm_reanalytics() {
        let sql = `select extrinsicHash, extrinsicID, xcmIndex, transferIndex, destStatus, sourceTS, convert(xcmInfo using utf8) as xcmInfo from xcmtransfer where xcmInfo is not null order by extrinsicHash, xcmIndex, transferIndex limit 1000`
        try {
            console.log(sql);
            let xcmmatches = await this.pool.query(sql);
            console.log("...done");
            let out = [];
            let vals = ["extrinsicID", "confidence", "amountReceived", "amountReceivedUSD"];
            let hashesRowsToInsert = [];
            let xcmInfo = [];
            let pieces = [];
            let prevExtrinsicID = null;
            let prevExtrinsicHash = null;
            let prevsourceTS = null;
            console.log(xcmmatches.length, " recs");
            for (let i = 0; i < xcmmatches.length; i++) {
                let extrinsicHash = xcmmatches[i].extrinsicHash;

                if (prevExtrinsicHash && (extrinsicHash != prevExtrinsicHash)) {
                    let hashrec = {};
                    let col = prevExtrinsicID
                    // write xcmInfo[0] object or xcmInfo to BigTable "hashes"
                    if (xcmInfo.length > 1) {
                        console.log("MULTIPLE", prevExtrinsicHash, JSON.stringify(xcmInfo, null, 4), pieces);
                    }
                    hashrec[col] = {
                        value: (xcmInfo.length == 1) ? JSON.stringify(xcmInfo[0]) : JSON.stringify(xcmInfo),
                        timestamp: prevsourceTS * 1000000
                    };
                    let extrinsicHashRec = {
                        key: prevExtrinsicHash,
                        data: {},
                    };
                    extrinsicHashRec.data["xcminfofinalized"] = hashrec;
                    hashesRowsToInsert.push(extrinsicHashRec);
                    for (const p of pieces) {
                        out.push(p);
                    }
                    xcmInfo = [];
                    pieces = [];
                }
                let extrinsicID = xcmmatches[i].extrinsicID;
                let xcmIndex = xcmmatches[i].xcmIndex;
                let transferIndex = xcmmatches[i].transferIndex;
                let destStatus = xcmmatches[i].destStatus;
                let x = JSON.parse(xcmmatches[i].xcmInfo);
                let amountSent = 0;
                let amountSentUSD = 0;
                let amountReceivedUSD = 0;
                let amountReceived = 0;
                let confidence = .01;
                if (x.origination && x.destination) {
                    if (x.origination.amountSent > 0) {
                        amountSent = x.origination.amountSent;
                        amountSentUSD = x.origination.amountSentUSD;
                    }
                    if (x.destination.amountReceived > 0) {
                        amountReceived = x.destination.amountReceived;
                        amountReceivedUSD = x.destination.amountReceivedUSD;
                    }

                    if (amountReceived > 0 && amountSent > 0 && amountSent >= amountReceived) {
                        // TODO: in the array of xcmInfo cases, use isFeeItem=1 to improve this:
                        //    one xcminfo has isFeeItem=1 (fee paying item) and
                        //    one xcminfo has isFeeItem=0 (the asset being transferred)
                        confidence = amountReceived / amountSent;
                        destStatus = 1;
                    } else {
                        confidence = 0;
                        destStatus = -1;
                    }
                } else {
                    destStatus = -1;
                }
                xcmInfo.push(x);
                let sql0 = `update xcmtransfer set destStatus = '${destStatus}', confidence = ${confidence}, amountReceived = ${amountReceived}, amountReceivedUSD = ${amountReceivedUSD} where extrinsicHash = '${extrinsicHash}' and xcmIndex = '${xcmIndex}' and transferIndex = '${transferIndex}'`
                if (confidence < .1) {
                    console.log(sql0);
                }
                this.batchedSQL.push(sql0);

                prevsourceTS = xcmmatches[i].sourceTS;
                prevExtrinsicHash = extrinsicHash;
                prevExtrinsicID = extrinsicID;
            }
            if (hashesRowsToInsert.length > 0) {
                console.log("writing", hashesRowsToInsert.length);
                await this.insertBTRows(this.btHashes, hashesRowsToInsert, "hashes");
                await this.update_batchedSQL();
                return hashesRowsToInsert.length
            }
        } catch (err) {
            console.log("xcmtransfer_reanalytics", err)
        }
        return 0
    }

    async xcmReanalytics() {
        while (true) {
            let x = await this.xcm_reanalytics();
            if (x == 0) {
                return (true);
            } else {
                await this.sleep(10000);
            }

        }
    }
    async fetch_indexToAccount(chainID = 61000, relayChain = 'moonbase-relay', index = null) {
        // TODO: when "index" is supplied (if this map gets too big, or to cover on demand situation)
        let derivedAccounts = (index) ? [] : await this.api.query.xcmTransactor.indexToAccount.entries()

        // take result of xcmTransactor.indexToAccount (all of them if index is null, or a specific one) and store in Mysql
        let out = [];
        let vals = ["relayChain", "address", "addDT"];
        for (const t of derivedAccounts) {
            let k = t[0].toHuman();
            let address = t[1].toJSON();
            let index = paraTool.toNumWithoutComma(k[0]);
            //console.log(index, k[0], address);
            out.push(`( '${chainID}', '${index}', '${relayChain}', '${address}', Now() )`);
            // TODO: store in BigTable addressrealtime new column family "derivedAccounts" ?
        }
        await this.upsertSQL({
            "table": `xcmtransactor_indexToAccount`,
            "keys": ["chainID", "indexToAccount"],
            "vals": vals,
            "data": out,
            "replace": ["address", "relayChain"]
        }, true);

    }

    computeSovereignAccount(paraID) {
        return paraTool.compute_sovereign_account(paraID)
    }
    // { "parents": 1, "interior": { "X1": [{ "Parachain": 1000 }]}}
    make_multilocation(paraID = null, address = null, namedNetwork = 'Any') {
        const ethAddress = address.length === 42;
        const named = (namedNetwork != 'Any') ? {
            Named: namedNetwork
        } : namedNetwork;
        const account = ethAddress ? {
            AccountKey20: {
                network: named,
                key: address
            }
        } : {
            AccountId32: {
                network: named,
                id: u8aToHex(decodeAddress(address))
            }
        };
        // make a multilocation object
        let interior = {
            here: null
        }
        if (paraID && account) {
            interior = {
                X2: [{
                    Parachain: paraID
                }, account]
            }
        } else if (paraID) {
            interior = {
                X1: {
                    Parachain: paraID
                }
            }
        } else if (account) {
            interior = {
                X1: account
            }
        }
        return {
            parents: 1,
            interior: interior
        }
    }

    // Converts a given MultiLocation into a 20/32 byte accountID by hashing with blake2_256 and taking the first 20/32 bytes
    //  https://github.com/albertov19/xcmTools/blob/main/calculateMultilocationDerivative.ts
    //  https://github.com/PureStake/moonbeam/blob/master/primitives/xcm/src/location_conversion.rs#L31-L37
    // Test case: Alice (origin parachain) 0x44236223aB4291b93EEd10E4B511B37a398DEE55 => is 0x5c27c4bb7047083420eddff9cddac4a0a120b45c on paraID 1000

    calculateMultilocationDerivative(paraID = null, address = null, namedNetwork = 'Any') {
        let multilocationStruct = this.make_multilocation(paraID, address, namedNetwork)
        const multilocation = this.api.createType('XcmV1MultiLocation', multilocationStruct)
        const toHash = new Uint8Array([
            ...new Uint8Array([32]),
            ...new TextEncoder().encode('multiloc'),
            ...multilocation.toU8a(),
        ]);

        const DescendOriginAddress20 = u8aToHex(this.api.registry.hash(toHash).slice(0, 20));
        const DescendOriginAddress32 = u8aToHex(this.api.registry.hash(toHash).slice(0, 32));
        let multiLocationHex = u8aToHex(multilocation.toU8a())
        console.log(`calculateMultilocationDerivative multiLocationHex=${multiLocationHex}`, multilocation.toString(), DescendOriginAddress20, DescendOriginAddress32);
        // multilocation {"parents":1,"interior":{"x2":[{"parachain":1000},{"accountKey20":{"network":{"any":null},"key":"0x44236223ab4291b93eed10e4b511b37a398dee55"}}]}}
        // 20 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45c
        // 32 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45cdfa7831175e442b8f14391aa
        return [DescendOriginAddress20, DescendOriginAddress32]
    }
}