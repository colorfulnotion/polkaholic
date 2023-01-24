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
const mysql = require("mysql2");
const paraTool = require("./paraTool");
/*
Setup xcmcleaner to do all writes to the new column family currently done by  xcmmatch work except failure
Compute teleport fee and teleport usd fee in xcmcleaner correctly
Cover failure cases in xcmcleaner
Cover xcmmessages in xcmcleaner if possible
*/
module.exports = class XCMCleaner extends Query {
    constructor() {
        super("manager")
    }

    async setupChainAndAPI(chainID, withSpecVersions = true, backfill = false) {
        let chain = await this.getChainWithVersion(chainID, withSpecVersions);
        await this.setupAPI(chain, backfill);

        this.relayChain = chain.relayChain;
        return (chain);
    }

    async getAssetChainFromSymbol(chainID, symbol) {
        // resolve symbol into asset/currencyID correctly -- note that this does not depend on xcmInteriorKey...
        let sql = `select asset, currencyID, asset.xcmInteriorKey from asset, xcmasset  where xcmasset.xcmInteriorKey = asset.xcmInteriorKey and chainID = '${chainID}' and xcmasset.symbol = '${symbol}' limit 1;`
        let recs = await this.poolREADONLY.query(sql)
        if (recs.length == 1) {
            return recs[0]
        }
        console.log("NO RECORD FOUND", sql)
        return null;
    }

    async searchDestinationChainBalances(chainID, sourceTS, destAddress, symbol, amountSent, N = 3) {
        let chain = await this.setupChainAndAPI(chainID)
        if (this.api == null) {
            return ([null, null]);
        }

        let destAddressPubkey = paraTool.getPubKey(destAddress);
        let sqlD = `select blockNumber, blockHash, UNIX_TIMESTAMP(blockDT) blockTS from block${chainID} where blockDT >= FROM_UNIXTIME(${sourceTS}-30) and blockDT <= FROM_UNIXTIME(${sourceTS + N*60}) and blockHash is not null order by blockNumber limit 1000`
        let blocks = await this.poolREADONLY.query(sqlD)
        if (blocks.length == 0) {
            return ([null, null]);
        }
        console.log("found ", blocks.length, " blocks", sqlD);
        let asset = await this.getAssetChainFromSymbol(chainID, symbol);
        let balances = {}
        let guess = null;
        let currencies = [];
        let currenciesStrings = [];
        if (asset == null) {
            // look for candidate "tokens" events that match the destAddress
            for (const b of blocks) {
                let bn = b.blockNumber;
                let blockHash = b.blockHash
                let apiAt = await this.api.at(blockHash)
                let query = null
                let eventsRaw = await apiAt.query.system.events();
                let events = [];
                eventsRaw.forEach((e) => {
                    let eh = e.event.toHuman();
                    let ej = e.event.toJSON();

                    if (eh.section == "tokens") {
                        let out = JSON.parse(JSON.stringify(e));
                        let data = out.event.data;
                        let who = paraTool.getPubKey(data[1]);
                        if (who == destAddressPubkey) {
                            let currencyString = (typeof data[0] == "string") ? data[0] : JSON.stringify(data[0]);
                            if (!currenciesStrings.includes(currencyString)) {
                                console.log(`CURRENCY ${currencyString} FOUND:`, data[0]);
                                currencies.push(data[0]);
                                currenciesStrings.push(currencyString);
                            }
                        }
                    }
                });
            }
        } else {
            if (chainID == 2030 || chainID == 22001) {
                // these chains have JSON objects in currencyID
                currencies.push(JSON.parse(asset.currencyID));
            } else if (chainID == 22000 || chainID == 2000) {
                // TODO: import GAR such that the above will cover these chains instead
                let asset0 = JSON.parse(asset.asset)
                let currencyID = null;
                let flds = ["Token", "ForeignAsset", "Erc20", "LiquidCrowdloan", "StableAsset"];
                for (const fld of flds) {
                    if (asset0[fld]) {
                        currencyID = {}
                        currencyID[fld.toLowerCase()] = asset0[fld];
                        currencies.push(currencyID);
                    }
                }
                if (currencyID) {
                    currencies.push(currencyID);
                }
            } else {
                currencies.push(asset.currencyID);
            }
        }
        let isNative = (this.chainInfos[chainID] != undefined && this.chainInfos[chainID].symbol != undefined) ? symbol == this.chainInfos[chainID].symbol : false;
        // exception so far: Kintsugi and Interlay represent native token in tokens.accounts pallet storage instead of system.account storage
        if (chainID == 22092 && symbol == "KINT" || chainID == 2032 && symbol == "INTR") isNative = false;
        if (chainID == 21000 && symbol == "KSM") isNative = true;
        if ((chainID == 1000 || chainID == 1001) && symbol == "DOT") isNative = true;

        for (const b of blocks) {
            let bn = b.blockNumber;
            let blockHash = b.blockHash
            try {
                console.log("checking apiAt ", chainID, "blockHash", blockHash, "bn", bn, "symbol", symbol, destAddress, isNative);
                let apiAt = await this.api.at(blockHash)

                if (isNative) {
                    let query = await apiAt.query.system.account(destAddress);
                    let qR = query.toJSON();
                    if (balances[asset.currencyID] == undefined) {
                        balances[asset.currencyID] = {}
                    }
                    balances[asset.currencyID][bn] = qR.data.free
                } else if (apiAt.query.tokens != undefined && apiAt.query.tokens.accounts != undefined) {
                    for (const currencyID of currencies) {
                        let currencyIDString = (typeof currencyID == "string") ? currencyID : JSON.stringify(currencyID);
                        let query = await apiAt.query.tokens.accounts(destAddress, currencyID);
                        let qR = query.toJSON();
                        if (balances[currencyIDString] == undefined) {
                            balances[currencyIDString] = {}
                        }
                        if (qR && qR.free != undefined) {
                            let free = paraTool.dechexToInt(qR.free.toString());
                            balances[currencyIDString][bn] = free
                            console.log("tokens CHECK", destAddress, currencyID, "freeraw", qR.free, "free", free)
                        }
                    }
                } else if (apiAt.query.assets != undefined && apiAt.query.assets.account != undefined) {
                    for (const currencyID of currencies) {
                        console.log("asset CHECK", destAddress, "currencyID:", currencyID)
                        let query = await apiAt.query.assets.account(currencyID, destAddress);
                        let qR = query.toJSON();
                        let currencyIDString = (typeof currencyID == "string") ? currencyID : JSON.stringify(currencyID);
                        if (balances[currencyIDString] == undefined) {
                            balances[currencyIDString] = {}
                        }
                        if (qR && qR.balance != undefined) {
                            console.log("assets SUCC", symbol, currencyID, destAddress, qR);
                            balances[currencyIDString][bn] = qR.balance
                        } else {
                            console.log("assets FAIL", symbol, currencyID, destAddress, qR);
                        }
                    }
                } else {
                    return [null, blocks];
                }
            } catch (e) {
                console.log("block ERROR", e);
            }
        }

        return [balances, blocks];
    }

    match_balance_adjustment(balances_currencies, amountSent, blocks) {
        let prevFree = 0;
        let prevBN = 1;
        let changes = [];
        for (const currencyID of Object.keys(balances_currencies)) {
            let balances = balances_currencies[currencyID];
            for (const bn of Object.keys(balances)) {
                let free = balances[bn];
                if (prevBN && prevFree != free) {
                    let amountReceived = free - prevFree;
                    if (amountReceived > 0 && (amountReceived <= amountSent)) {
                        let confidence = (amountReceived > amountSent) ? .1 : amountReceived / amountSent;
                        changes.push({
                            currencyID,
                            bn,
                            prevFree,
                            free,
                            amountReceived,
                            confidence,
                            amountSent
                        });
                    }
                }
                prevBN = bn;
                prevFree = free;
            }
        }

        // find the change in balance that matches amountSent best, along with a "confidence" level
        if (changes.length > 0) {
            changes.sort(function compareFn(a, b) {
                return b.confidence - a.confidence
            });
            let best = changes[0];
            let bn = best.bn;
            //best.ts = this.getCurrentTS();
            for (const b of blocks) {
                if (best.bn == b.blockNumber) {
                    best.ts = b.blockTS;
                }
            }
            return best;
        }
        return null;
    }

    async get_tx_fees(extrinsicHash) {
        let txFee = 0;
        let txFeeUSD = 0;
        let txFeeChainSymbol = null;
        let d = await this.getTransaction(extrinsicHash);
        txFee = d.fee
        txFeeUSD = d.feeUSD
        txFeeChainSymbol = d.chainSymbol
        if (d.evm != undefined && d.evm.transactionHash != undefined) {
            let evmTransactionHash = d.evm.transactionHash
            let evmtx = await this.getTransaction(evmTransactionHash);
            if (!evmtx) return [false, false]
            txFee = evmtx.fee
            txFeeUSD = evmtx.feeUSD
            txFeeChainSymbol = evmtx.symbol
        }
        return {
            txFee,
            txFeeUSD,
            txFeeChainSymbol
        }
    }

    async searchXCMTransferDestCandidate(msgHash, sourceTS, amountSent, fromAddress) {
        let startTS = sourceTS - 10;
        let endTS = sourceTS + 60 * 2;
        let sql = `select * from xcmtransferdestcandidate where destTS >= ${startTS} and destTS <= ${endTS}`
        if (msgHash.length > 4) {
            sql += ` and msgHash = '${msgHash}' `;
        } else if (fromAddress) {
            sql += ` and fromAddress = '${fromAddress}' `;
        } else {
            return null;
        }
        console.log(sql);
        let messages = await this.poolREADONLY.query(sql)
        let changes = [];
        for (const m of messages) {
            let amountReceived = m.amountReceived;
            if (amountReceived > 0 && (amountReceived <= amountSent)) {
                let confidence = (amountReceived > amountSent) ? .1 : amountReceived / amountSent;
                changes.push({
                    bn: m.blockNumberDest,
                    amountReceived,
                    confidence,
                    amountSent,
                    eventID: m.eventID,
                    extrinsicID: m.extrinsicID,
                    ts: m.destTS
                });
            }
        }
        if (changes.length > 0) {
            changes.sort(function compareFn(a, b) {
                return b.confidence - a.confidence
            });
            return changes[0];
        }
        return null;
    }

    /*
    for any extrinsicHash / extrinsicID in xcmtransfer, pull out the assetChain/xcmInteriorKey, sourceTS, beneficiary and construct the "origination" structure
read a short window of  N minutes from block${chainIDDest} and open up an API connection for ${chainIDDest}.  Query beneficiary for all N minutes for { accounts, tokens } for the asset
if a jump in balance is found in those N minutes, mark the blockNumber in ${chainIDDest}, and see if we can find an event of any kind with 99.x% of the numeric value of the jump.  If one can be found, use that for the executed eventID
*/
    async generate_extrinsic_XCMInfo(extrinsicHash, transferIndex = 0, xcmIndex = 0) {
        let sqlA = `select
                chainID, extrinsicHash, chainIDDest, fromAddress, symbol, relayChain,
                xcmtransfer.isFeeItem,
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
                xcmtransfer.blockNumberDest,
                xcmtransfer.xcmInfoAudited
              from xcmtransfer
       where  extrinsicHash = '${extrinsicHash}' and transferIndex = '${transferIndex}' and xcmIndex = '${xcmIndex}' limit 1`
        console.log(sqlA);
        let xcmRecs = await this.poolREADONLY.query(sqlA)
        let xcm = null
        if (xcmRecs.length == 1) {
            xcm = xcmRecs[0]
            console.log(xcm);
        } else {
            return (false);
        }
        let xcmSection = "",
            xcmMethod = "";
        let sectionMethodPieces = xcm.sectionMethod.split(':')
        if (sectionMethodPieces.length == 2) {
            xcmSection = sectionMethodPieces[0]
            xcmMethod = sectionMethodPieces[1]
        }
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
        let isMsgSent = (xcm.incomplete == 0) ? true : false;
        // note that we assign 100% of the tx fees to the FIRST xcmIndex (message) and FIRST asset
        let fees = (transferIndex == 0 && xcmIndex == 0) ? await this.get_tx_fees(extrinsicHash) : null;

        let xcmInfo = {
            symbol: xcm.symbol,
            priceUSD: xcm.priceUSD,
            relayChain: {
                relayChain: xcm.relayChain,
                relayAt: isMsgSent ? xcm.sentAt : null,
            },
            origination: {
                chainName: xcm.chainName,
                id: xcm.id,
                chainID: xcm.chainID,
                paraID: xcm.paraID,
                sender: xcm.fromAddress,
                amountSent: isMsgSent ? xcm.amountSent : 0,
                amountSentUSD: isMsgSent ? xcm.amountSentUSD : 0,
                blockNumber: xcm.blockNumber,
                extrinsicID: xcm.extrinsicID,
                extrinsicHash: xcm.extrinsicHash,
                txFee: fees ? fees.txFee : 0,
                txFeeUSD: fees ? fees.txFeeUSD : 0,
                txFeeChainSymbol: fees ? fees.txFeeChainSymbol : "",
                msgHash: xcm.msgHash,
                sentAt: xcm.sentAt,
                ts: xcm.sourceTS,
                isMsgSent: isMsgSent,
                finalized: true,
            },
            destination: {
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
                //extrinsicID: null,
                //eventID: xcm.executedEventID,
                ts: xcm.destTS,
                finalized: true,
                executionStatus: "failed",
                error: {},
            },
            version: 'V4'
        }
        let invalid_dest_address = false;
        if (!xcm.destAddress) invalid_dest_address = true;
        xcmInfo.origination.section = xcmSection;
        xcmInfo.origination.method = xcmMethod;
        try {
            console.log("xcm.amountSent", xcm.amountSent, "Dest", xcm.destAddress, invalid_dest_address);
            if ((xcmInfo.destination.chainID == 2011 || xcmInfo.destination.chainID == 22024 || xcmInfo.destination.chainID == -1 || invalid_dest_address || xcmInfo.symbol == null)) {
                xcmInfo.destination.executionStatus = "unknown";
                let sql_final = `update xcmtransfer set xcmInfoAudited = 2, destStatus = -1, xcmInfolastUpdateDT = Now(), xcmInfo = ${mysql.escape(JSON.stringify(xcmInfo))} where extrinsicHash = '${extrinsicHash}' and xcmIndex = '${xcmIndex}' and transferIndex = '${transferIndex}'`
                console.log("ABANDON", sql_final);
                this.batchedSQL.push(sql_final);
                await this.update_batchedSQL();
                return xcmInfo;
            }
            let best = null;
            let destAddress = paraTool.getPubKey(xcm.destAddress);
            best = await this.searchXCMTransferDestCandidate(xcm.msgHash, xcm.sourceTS, xcm.amountSent, destAddress);
            if (best == null) {
                let [balances, blocks] = await this.searchDestinationChainBalances(xcm.chainIDDest, xcm.sourceTS, xcm.destAddress, xcm.symbol);
                if (balances) {
                    best = this.match_balance_adjustment(balances, xcm.amountSent, blocks);
                }
            }
            if (best) {
                let inp = {
                    symbol: xcm.symbol,
                    relayChain: xcm.relayChain,
                    ts: best.ts
                };
                let q = await this.computePriceUSD(inp)
                if (inp.decimals) {
                    // if symbol is known we can compute this
                    xcmInfo.destination.blockNumber = parseInt(best.bn, 10);
                    xcmInfo.origination.amountSent = xcm.amountSent / 10 ** inp.decimals;
                    xcmInfo.destination.amountReceived = best.amountReceived / 10 ** inp.decimals;
                    xcmInfo.destination.teleportFee = xcmInfo.origination.amountSent - xcmInfo.destination.amountReceived;
                    xcmInfo.destination.ts = best.ts;
                    if (q && q.priceUSD) {
                        xcmInfo.origination.amountSentUSD = q.priceUSD * xcmInfo.origination.amountSent;
                        xcmInfo.destination.amountReceivedUSD = q.priceUSD * xcmInfo.destination.amountReceived;
                        xcmInfo.destination.teleportFeeUSD = q.priceUSD * xcmInfo.destination.teleportFee;
                    }
                    xcmInfo.destination.confidence = best.confidence;
                    xcmInfo.destination.executionStatus = "success";
                    if (best.extrinsicID) {
                        xcmInfo.destination.extrinsicID = best.extrinsicID;
                    }
                    if (best.eventID) {
                        xcmInfo.destination.eventID = best.eventID;
                    }
                    console.log("xcmInfo", JSON.stringify(xcmInfo, null, 4));

                    let sql_final = `update xcmtransfer set xcmInfoAudited = 2, destStatus = 1, amountReceived = '${xcmInfo.destination.amountReceived}', amountReceivedUSD = '${xcmInfo.destination.amountReceivedUSD}', xcmInfolastUpdateDT = Now(), xcmInfo = ${mysql.escape(JSON.stringify(xcmInfo))} where extrinsicHash = '${extrinsicHash}' and xcmIndex = '${xcmIndex}' and transferIndex = '${transferIndex}'`
                    console.log(sql_final);
                    this.batchedSQL.push(sql_final);
                    await this.update_batchedSQL();
                    return xcmInfo;
                }
            }
        } catch (e) {
            console.log(e);
        }
        let sql_final = `update xcmtransfer set xcmInfoAudited = -2 where extrinsicHash = '${extrinsicHash}' and xcmIndex = '${xcmIndex}' and transferIndex = '${transferIndex}'`
        this.batchedSQL.push(sql_final);
        await this.update_batchedSQL();
        return (false);
    }

    get_confidence(xcmInfo) {
        if (xcmInfo.destination && xcmInfo.destination.confidence) {
            return xcmInfo.destination.confidence
        }
        return 0;
    }

    async bulk_generate_XCMInfo(chainIDDest = null, limit = 1000) {
        let w = chainIDDest ? `and chainIDDest = ${chainIDDest} ` : "";
        let sql = `select extrinsicHash, xcmIndex, transferIndex, sourceTS, extrinsicID from xcmtransfer where chainIDDest < 40000 and xcmInfoAudited in ( 0 ) and sourceTS > UNIX_TIMESTAMP("2023-01-01") and sourceTS < UNIX_TIMESTAMP(Date_sub(Now(), interval 4 MINUTE)) ${w} order by sourceTS desc limit ${limit}`;
        console.log(sql);
        let extrinsics = await this.pool.query(sql);
        let extrinsic = {};
        let extrinsicconfidence = {};
        let results = {};
        if (extrinsics.length == 0) {
            return (false);
        }
        for (const e of extrinsics) {
            try {
                let xcmInfo = await this.generate_extrinsic_XCMInfo(e.extrinsicHash, e.transferIndex, e.xcmIndex);
                if (results[e.extrinsicHash] == undefined) {
                    results[e.extrinsicHash] = [xcmInfo];
                    extrinsic[e.extrinsicHash] = e;
                    extrinsicconfidence[e.extrinsicHash] = this.get_confidence(xcmInfo);
                } else {
                    let confidence = this.get_confidence(xcmInfo)
                    if (confidence > extrinsicconfidence[e.extrinsicHash]) {
                        extrinsicconfidence[e.extrinsicHash] = confidence;
                    }
                }
            } catch (err) {
                console.log(err);
            }
        }

        let hashesRowsToInsert = [];
        for (const extrinsicHash of Object.keys(extrinsicconfidence)) {
            let confidence = extrinsicconfidence[extrinsicHash]; // store confidence in xcmtransfer
            let e = extrinsic[extrinsicHash];
            let extrinsicID = e.extrinsicID;
            let sourceTS = e.sourceTS;
            let hashrec = {};
            let col = extrinsicID
            let xcmInfo = results[extrinsicHash];
            hashrec[col] = {
                value: (xcmInfo.length == 1) ? JSON.stringify(xcmInfo[0]) : JSON.stringify(xcmInfo),
                timestamp: sourceTS * 1000000
            };
            let extrinsicHashRec = {
                key: extrinsicHash,
                data: {},
            };
            extrinsicHashRec.data["xcminfofinalized"] = hashrec;
            hashesRowsToInsert.push(extrinsicHashRec);
        }

        if (hashesRowsToInsert.length > 0) {
            await this.insertBTRows(this.btHashes, hashesRowsToInsert, "hashes");
        }
        return (true);
    }


}