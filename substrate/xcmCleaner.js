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
        return null;
    }

    async searchDestinationChainBalances(chainID, sourceTS, destAddress, symbol, amountSent, N = 2) {
        let chain = await this.setupChainAndAPI(chainID)
        let destAddressPubkey = paraTool.getPubKey(destAddress);
        let sqlD = `select blockNumber, blockHash, UNIX_TIMESTAMP(blockDT) blockTS from block${chainID} where blockDT >= FROM_UNIXTIME(${sourceTS}-30) and blockDT <= FROM_UNIXTIME(${sourceTS + N*60}) order by blockNumber limit 1000`
        let blocks = await this.poolREADONLY.query(sqlD)
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
            } else if (chainID == 22000 || chainID == 2000 || chainID == 22092 || chainID == 2032) {
                // TODO: import GAR such that the above will cover these chains instead
                currencies.push(JSON.parse(asset.asset));
            } else {
                currencies.push(asset.currencyID);
            }
        }
        let isNative = (this.chainInfos[chainID] != undefined && this.chainInfos[chainID].symbol != undefined) ? symbol == this.chainInfos[chainID].symbol : false;
        // exception so far: Kintsugi and Interlay represent native token in tokens.accounts pallet storage instead of system.account storage
        if (chainID == 22092 && symbol == "KINT" || chainID == 2032 && symbol == "INTR") isNative = false;
        if (chainID == 21000 && symbol == "KSM" || chainID == 1000 && symbol == "DOT") isNative = false;

        for (const b of blocks) {
            let bn = b.blockNumber;
            let blockHash = b.blockHash
            let apiAt = await this.api.at(blockHash)
            console.log("checking ", chainID, "blockHash", blockHash, "bn", bn, "symbol", symbol, destAddress, isNative);

            if (isNative) {
                let query = await apiAt.query.system.account(destAddress);
                let qR = query.toJSON();
                if (balances[asset.currencyID] == undefined) {
                    balances[asset.currencyID] = {}
                }
                balances[asset.currencyID][bn] = qR.data.free
            } else if (apiAt.query.tokens != undefined && apiAt.query.tokens.accounts != undefined) {
                for (const currencyID of currencies) {
                    console.log("tokens CHECK", destAddress, currencyID)
                    let currencyIDString = (typeof currencyID == "string") ? currencyID : JSON.stringify(currencyID);
                    let query = await apiAt.query.tokens.accounts(destAddress, currencyID);
                    let qR = query.toJSON();
                    if (balances[currencyIDString] == undefined) {
                        balances[currencyIDString] = {}
                    }
                    if (qR && qR.free != undefined) {
                        balances[currencyIDString][bn] = qR.free
                    }
                }
            } else if (apiAt.query.assets != undefined && apiAt.query.assets.account != undefined) {
                for (const currencyID of currencies) {
                    let query = await apiAt.query.assets.account(currencyID, destAddress);
                    console.log("asset CHECK", destAddress, "currencyID:", currencyID)
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

    /*
    for any extrinsicHash / extrinsicID in xcmtransfer, pull out the assetChain/xcmInteriorKey, sourceTS, beneficiary and construct the "origination" structure
read a short window of  N minutes from block${chainIDDest} and open up an API connection for ${chainIDDest}.  Query beneficiary for all N minutes for { accounts, tokens } for the asset
if a jump in balance is found in those N minutes, mark the blockNumber in ${chainIDDest}, and see if we can find an event of any kind with 99.x% of the numeric value of the jump.  If one can be found, use that for the executed eventID
*/
    async cleanXCMInfo(extrinsicHash, transferIndex = 0, xcmIndex = 0) {
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
                xcmtransfer.blockNumberDest
              from xcmtransfer
       where  extrinsicHash = '${extrinsicHash}' and transferIndex = '${transferIndex}' and xcmIndex = '${xcmIndex}' limit 1`

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
        let isMsgSent = (xcm.failureType == 'failedOrigination') ? true : false
        let xcmInfo = {
            symbol: xcm.symbol,
            priceUSD: xcm.priceUSD,
            relayChain: {
                relayChain: xcm.relayChain,
                relayAt: (xcm.failureType == 'failedOrigination') ? null : xcm.sentAt, // failedOrigination are not relayed
            },
            origination: {
                chainName: xcm.chainName,
                id: xcm.id,
                chainID: xcm.chainID,
                paraID: xcm.paraID,
                sender: xcm.fromAddress,
                amountSent: (xcm.failureType == 'failedOrigination') ? 0 : xcm.amountSent, //failedOrigination deosn't send anything
                amountSentUSD: (xcm.failureType == 'failedOrigination') ? 0 : xcm.amountSentUSD, //failedOrigination deosn't send anything
                blockNumber: xcm.blockNumber,
                extrinsicID: xcm.extrinsicID,
                extrinsicHash: xcm.extrinsicHash,

                msgHash: xcm.msgHash,
                sentAt: xcm.sentAt,
                ts: xcm.sourceTS,
                //complete: (xcm.failureType == 'failedOrigination') ? false : true,
                //isMsgSent: isMsgSent,
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
                //teleportFee: 0,
                //teleportFeeUSD: 0,
                //teleportFeeChainSymbol: xcm.symbol,
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
        xcmInfo.origination.section = xcmSection;
        xcmInfo.origination.method = xcmMethod;
        try {
            let [balances, blocks] = await this.searchDestinationChainBalances(xcm.chainIDDest, xcm.sourceTS, xcm.destAddress, xcm.symbol);
            if (balances) {
                let best = this.match_balance_adjustment(balances, xcm.amountSent, blocks);
                if (best) {
                    let inp = {
                        symbol: xcm.symbol,
                        relayChain: xcm.relayChain,
                        ts: best.ts
                    };
                    let q = await this.computePriceUSD(inp)
                    // if symbol is known we can compute this
                    xcmInfo.destination.blockNumber = parseInt(best.bn, 10);
                    xcmInfo.origination.amountSent = xcm.amountSent / 10 ** inp.decimals;
                    xcmInfo.destination.amountReceived = best.amountReceived / 10 ** inp.decimals;
                    xcmInfo.destination.ts = best.ts;
                    if (q && q.priceUSD) {
                        xcmInfo.origination.amountSentUSD = q.priceUSD * xcmInfo.origination.amountSent;
                        xcmInfo.destination.amountReceivedUSD = q.priceUSD * xcmInfo.destination.amountReceived;
                        xcmInfo.destination.teleportFee = 0; // TODO: can we improve this?
                    }
                    xcmInfo.destination.confidence = best.confidence;
                    xcmInfo.destination.executionStatus = "success";
                    console.log("xcmInfo", JSON.stringify(xcmInfo, null, 4));

                    let sql_final = `update xcmtransfer set xcmInfoAudited = 1, xcmInfolastUpdateDT = Now(), xcmInfo = ${mysql.escape(JSON.stringify(xcmInfo))} where extrinsicHash = '${extrinsicHash}' and xcmIndex = '${xcmIndex}' and transferIndex = '${transferIndex}'`
                    console.log(sql_final);
                    this.batchedSQL.push(sql_final);
                    await this.update_batchedSQL();
                    return true;
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

    async bulk_cleanXCMInfo(chainIDDest, n = 0, m = 1) {
        let w = (m > 1) ? ` and sourceTS % ${m} = ${n} ` : "";
        let sql = `select chainIDDest, extrinsicHash, xcmIndex, transferIndex from xcmtransfer where symbol is not null and xcmInfo is null and xcmInfoAudited  <= 0 and sourceTS < UNIX_TIMESTAMP(Date_sub(Now(), interval 1 hour)) and chainIDDest = ${chainIDDest} ${w} order by sourceTS desc limit 10000`
        let extrinsics = await this.pool.query(sql);
        for (const e of extrinsics) {
            try {
                await this.cleanXCMInfo(e.extrinsicHash, e.transferIndex, e.xcmIndex)
            } catch (err) {
                console.log(err);
            }
        }
    }


}