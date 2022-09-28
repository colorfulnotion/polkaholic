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

const AssetManager = require("./assetManager");
const PolkaholicDB = require("./polkaholicDB");
const {
    ApiPromise,
    WsProvider
} = require("@polkadot/api");
const {
    encodeAddress
} = require("@polkadot/keyring");
const {
    u8aToHex
} = require("@polkadot/util");
const mysql = require("mysql2");
const fs = require("fs");
const axios = require("axios");
const paraTool = require("./paraTool");
const util = require('util');
const exec = util.promisify(require("child_process").exec);
const path = require('path');
const {
    BigQuery
} = require('@google-cloud/bigquery');
const bqDir = "/disk1/"
module.exports = class Manager extends AssetManager {
    constructor() {
        super("manager")
    }

    chainMap = {}
    lastupdateTS = 0

    // xcmanalytics
    xcmAddress = null;
    parachainID = null;

    async getFinalizedBlockInfo(chainID, api) {
        let done = false;
        let finalizedBlockHash = null;
        let blockTS = null;
        let bn = null;
        while (!done) {
            const finalizedHead = await api.rpc.chain.getFinalizedHead();
            finalizedBlockHash = u8aToHex(finalizedHead)
            let finalizedHeader = await api.rpc.chain.getHeader(finalizedBlockHash);
            bn = finalizedHeader.number ? paraTool.dechexToInt(finalizedHeader.number) : null
            let sql_blockTS = `select blockDT, UNIX_TIMESTAMP(blockDT) as blockTS from block${chainID} where blockNumber = '${bn}' and blockHash = '${finalizedBlockHash}' limit 1`
            let blocks = await this.poolREADONLY.query(sql_blockTS)
            if (blocks.length == 0) {
                console.log(`Blockhash not found for ${chainID} @ block ${bn} in last 24 hours: ${finalizedBlockHash}`)
                let sql_unfinalized = `select blockDT, UNIX_TIMESTAMP(blockDT) as blockTS from blockunfinalized where chainID = '${chainID}' and blockNumber = '${bn}' and blockHash = '${finalizedBlockHash}' limit 1`
                blocks = await this.poolREADONLY.query(sql_unfinalized)
                if (blocks.length == 1) {
                    blockTS = blocks[0].blockTS;
                    done = true;
                } else {
                    await this.sleep(2000);
                }
            } else if (blocks.length == 1) {
                let block = blocks[0];
                console.log(`Found finalized blockHash ${chainID} : ${finalizedBlockHash} at ${block.blockTS}: ${block.blockDT} -- READY`, block)
                blockTS = block.blockTS;
                if (!(blockTS > 0)) {
                    done = false;
                }
                done = true;
            }
        }
        return [finalizedBlockHash, blockTS, bn]
    }
    canonicalizeAssetJSON(a) {
        if (a.DexShare != undefined) {
            return (JSON.stringify(a.DexShare));
        }
        if (typeof a == "string")
            return (a);
        return (JSON.stringify(a));
    }

    async get_chain_balance_update() {
        let chains = await this.pool.query(`select chainID from chain where active = 1 and crawling = 1 and ( lastBalanceUpdateDT < date_sub(Now(), interval 12 hour) or lastBalanceUpdateDT is Null ) and chainID >= 0 order by rand() limit 1`)
        if (chains.length == 0) {
            console.log("No chain found");
            return null;
        }
        let chainID = chains[0].chainID;
        await this.update_chain_lastBalanceUpdateDT(chainID); // this is to not pick it again, if it fails we reset it
        return chainID;
    }

    async update_chain_lastBalanceUpdateDT(chainID, reset = false) {
        if (chainID >= 0) {
            let s = (reset) ? "Null" : "Now()";
            let sql = `update chain set lastBalanceUpdateDT = ${s} where chainID = ${chainID}`
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        }
    }

    async updateNonNativeBalances(chainID, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.pool.query(`select chainID, WSEndpoint, assetaddressPallet, chainName from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let chain = chains[0];
        if (chain.assetaddressPallet == "none") {
            console.log(`No valid pallet ${chainID}: ${chain.assetaddresPallet}`)
            return false;
        }
        let wsEndpoint = chain.WSEndpoint;
        let chainName = chain.chainName
        const provider = new WsProvider(wsEndpoint);
        const api = await ApiPromise.create({
            provider
        });
        const rawChainInfo = await api.registry.getChainProperties()
        var chainInfo = JSON.parse(rawChainInfo);
        const prefix = chainInfo.ss58Format
        let pallet = "none"
        let rows = [];
        let asset = this.getChainAsset(chainID);
        let [tblName, tblRealtime] = this.get_btTableRealtime()
        let [finalizedBlockHash, blockTS, bn] = await this.getFinalizedBlockInfo(chainID, api)
        let apiAt = await api.at(finalizedBlockHash)
        let last_key = '';
        let numHolders = {}
        let numFailures = {};
        // create the table if needed
        let TABLE = `assetaddress${chainID}`
        let sql_create_table = `create table if not exists ${TABLE} like assetaddress1000`;
        this.batchedSQL.push(sql_create_table);
        await this.update_batchedSQL();

        while (true) {
            let query = null
            if (apiAt.query.assets != undefined && apiAt.query.assets.account != undefined) {
                query = await apiAt.query.assets.account.entriesPaged({
                    args: [],
                    pageSize: perPagelimit,
                    startKey: last_key
                })
                pallet = "assets";
            } else if (apiAt.query.tokens != undefined && apiAt.query.tokens.accounts != undefined) {
                // karura (22000) and acala (2000)
                query = await apiAt.query.tokens.accounts.entriesPaged({
                    args: [],
                    pageSize: perPagelimit,
                    startKey: last_key
                })
                pallet = "tokens";
            } else {
                console.log(`${chainID}: No assets or tokens pallet!`);
                pallet = "none";
                break;
            }
            if (query.length == 0) {
                console.log(`Query Completed:`, numHolders)
                break
            }

            var cnt = 0
            let out = [];
            let vals = ["ss58Address", "asset", "symbol", "free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN", "blockTS", "lastState"];
            let replace = ["ss58Address", "asset", "symbol"];
            let lastUpdateBN = ["free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN", "blockTS", "lastState"];
            let idx = 0
            for (const user of query) {
                cnt++
                if (pallet == "assets") {
                    let key = user[0].toHuman();
                    let val = user[1].toHuman();

                    /*
                      Responses like: [currencyID, account_id]
                      key:  [  0, DaCSCEQBRmMaBLRQQ5y7swdtfRzjcsewVgCCmngeigwLiax ]
                      val:  // has balance
                      {
                      balance: 100,000,000
                      isFrozen: false
                      reason: Consumer
                      extra: null
                      }
                    */
                    let currencyID = paraTool.toNumWithoutComma(key[0]);
                    let account_id = key[1];
                    let address = paraTool.getPubKey(account_id);
                    let decimals = this.getCurrencyIDDecimal(currencyID, chainID)
                    let symbol = this.getCurrencyIDSymbol(currencyID, chainID)
                    let asset = JSON.stringify({
                        "Token": currencyID
                    })
                    let assetChain = paraTool.makeAssetChain(asset, chainID);
                    let encodedAssetChain = paraTool.encodeAssetChain(assetChain)

                    let balance = 0;
                    if (decimals !== false) {
                        if (val.balance != undefined) {
                            balance = parseFloat(paraTool.toNumWithoutComma(val.balance), 10) / 10 ** decimals;
                        }
                        out.push(`('${currencyID}', '${address}', '${account_id}', ${mysql.escape(asset)}, '${symbol}', '${balance}', 0, 0, 0, '${finalizedBlockHash}', Now(), '${bn}', '${blockTS}', ${mysql.escape(JSON.stringify(val))})`);
                        let rowKey = address.toLowerCase() // just in case

                        if (numHolders[currencyID] != undefined) {
                            numHolders[currencyID]++;
                        } else {
                            numHolders[currencyID] = 1;
                        }
                        rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, balance, 0, 0, 0, blockTS, bn));
                        console.log(symbol, currencyID, `cbt read accountrealtime prefix=${rowKey}`, balance, val.balance, "decimals", decimals);
                    } else {
                        if (numFailures[currencyID] != undefined) {
                            numFailures[currencyID]++;
                        } else {
                            numFailures[currencyID] = 1;
                        }
                        console.log("FAIL", val, currencyID, symbol, asset, "decimals", decimals, decimals != false);
                    }
                } else if (pallet == "tokens") { //this is by [account-asset]. not way to tally by asset
                    let userTokenAccountK = user[0].toHuman()
                    let userTokenAccountBal = user[1].toJSON()
                    let account_id = userTokenAccountK[0];
                    let rawAsset = userTokenAccountK[1];
                    if (typeof rawAsset == "string" && rawAsset.includes("{")) {
                        rawAsset = JSON.parse(rawAsset);
                    }
                    let asset = this.canonicalizeAssetJSON(rawAsset); // remove DexShare, remove commas inside if needed, etc.
                    let currencyID = asset
                    let decimals = this.getAssetDecimal(asset, chainID, "tokens")
                    if ((chainID == paraTool.chainIDKico) || (chainID == paraTool.chainIDMangataX) || (chainID == paraTool.chainIDListen) || (chainID == paraTool.chainIDBasilisk) ||
                        (chainID == paraTool.chainIDComposable) || (chainID == paraTool.chainIDPicasso)) {
                        currencyID = paraTool.toNumWithoutComma(currencyID).toString();
                        decimals = this.getCurrencyIDDecimal(currencyID, chainID)
                        asset = JSON.stringify({
                            "Token": currencyID
                        })
                        //console.log(currencyID, "asset=", asset, "decimals=", decimals);
                    } else if ((chainID == paraTool.chainIDTuring) || (chainID == paraTool.chainIDDoraFactory)) {
                        decimals = this.getCurrencyIDDecimal(currencyID, chainID)
                        asset = JSON.stringify({
                            "Token": currencyID
                        })
                        console.log(currencyID, "asset=", asset, "decimals=", decimals);
                    }
                    let state = userTokenAccountBal;
                    let assetChain = paraTool.makeAssetChain(asset, chainID);
                    let symbol = this.assetInfo[assetChain] ? this.assetInfo[assetChain].symbol : null;
                    let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
                    let address = paraTool.getPubKey(account_id);
                    let free = 0;
                    let reserved = 0;
                    let miscFrozen = 0;
                    let frozen = 0;
                    if (decimals !== false) {
                        if (state.free != undefined) {
                            free = state.free / 10 ** decimals;
                        }
                        if (state.reserved != undefined) {
                            reserved = state.reserved / 10 ** decimals;
                        }
                        if (state.miscFrozen != undefined) {
                            miscFrozen = state.miscFrozen / 10 ** decimals;
                        }
                        if (state.frozen != undefined) {
                            frozen = state.frozen / 10 ** decimals;
                        }

                        out.push(`('${asset}', '${address}', '${account_id}', ${mysql.escape(asset)}, '${symbol}', '${free}', '${reserved}', '${miscFrozen}', '${frozen}', '${finalizedBlockHash}', Now(), '${bn}', '${blockTS}', ${mysql.escape(JSON.stringify(state))})`);
                        let rowKey = address.toLowerCase() // just in case

                        if (numHolders[currencyID] != undefined) {
                            numHolders[currencyID]++;
                        } else {
                            numHolders[currencyID] = 1;
                        }
                        rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, free, reserved, miscFrozen, frozen, blockTS, bn));
                        console.log(`CHECK ${assetChain} -- cbt read accountrealtime prefix=${rowKey}`);
                    } else {
                        if (numFailures[currencyID] != undefined) {
                            numFailures[currencyID]++;
                        } else {
                            numFailures[currencyID] = 1;
                        }
                        console.log(`FAIL idx=[${idx}] k=${JSON.stringify(userTokenAccountK)}, v=${JSON.stringify(userTokenAccountBal)} currencyID=${currencyID}`)
                    }
                    idx++
                    /*
                      idx=[0] k=["266LcLP1Mg523NBD58E2bBz4Ud3E2ZyZSNJjKz1G1nH3rPFh",{"LiquidCrowdloan":"13"}], v={"free":100000000000,"reserved":0,"frozen":0}
                      idx=[1] k=["223xsNEtCfmnnpcXgJMtyzaCFyNymu7mEUTRGhurKJ8jzw1i",{"Token":"DOT"}], v={"free":2522375571,"reserved":0,"frozen":0}
                    */
                }
                last_key = user[0];
            }

            await this.upsertSQL({
                "table": TABLE,
                "keys": ["currencyID", "address"],
                "vals": vals,
                "data": out,
                "replace": vals,
                "lastUpdateBN": lastUpdateBN
            });
            console.log(`writing ${chainName}`, rows.length, "rows chainID=", chainID);
            await this.insertBTRows(tblRealtime, rows, tblName);

            rows = [];
        }

        // for all the other accounts that did NOT appear, we can delete them if they were OLDER than bn, because they are reaped == but we still need to 0 out the balances
        let sql_reap = `select address, asset, lastUpdateBN from ${TABLE} where lastUpdateBN < ${bn}`
        let sql_delete = `delete from ${TABLE} where lastUpdateBN < ${bn}`
        console.log(`REAPING: `, sql_reap, ` DELETE: `, sql_delete);

        let reapedAccounts = await this.poolREADONLY.query(sql_reap)
        for (let a = 0; a < reapedAccounts.length; a++) {
            let address = reapedAccounts[a].address;
            let asset = reapedAccounts[a].asset;
            let assetChain = paraTool.makeAssetChain(asset, chainID);
            let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
            rows.push(this.generate_btRealtimeRow(address, encodedAssetChain, 0, 0, 0, 0, blockTS, bn));
            console.log("REAPED ACCOUNT-ADDRESS", address, encodedAssetChain);
        }
        console.log("writing ", rows.length, " REAPED accounts to bt");
        await this.insertBTRows(tblRealtime, rows, tblName);
        rows = [];

        // now that we have written them out to BT, we can delete them
        this.batchedSQL.push(sql_delete);
        await this.update_batchedSQL();

        for (const asset of Object.keys(numHolders)) {
            let cnt = numHolders[asset];
            let sql = `update asset set numHolders = '${cnt}'  where asset = '${asset}' and chainID = '${chainID}'`
            this.batchedSQL.push(sql);
            console.log("writing", asset, chainID, "rows numHolders=", cnt, sql)
        }
        for (const asset of Object.keys(numFailures)) {
            let cnt = numFailures[asset];
            let sql = `insert into assetfailures ( asset, chainID, numFailures, lastUpdateDT ) values ( '${asset}', '${chainID}', '${cnt}', Now() ) on duplicate key update numFailures = values(numFailures)`
            this.batchedSQL.push(sql);
            console.log("writing", asset, chainID, "rows numHolders=", cnt, sql)
        }

        let sql_assetPallet = `update chain set assetaddressPallet = '${pallet}', assetNonNativeRegistered = '${Object.keys(numHolders).length}', assetNonNativeUnregistered = '${Object.keys(numFailures).length}'  where chainID = '${chainID}'`
        this.batchedSQL.push(sql_assetPallet);
        await this.update_batchedSQL();

    }

    async updateNativeBalances(chainID, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.pool.query(`select chainID, WSEndpoint, numHolders from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let chain = chains[0];
        let wsEndpoint = chain.WSEndpoint;
        let prev_numHolders = chain.numHolders;
        const provider = new WsProvider(wsEndpoint);
        const api = await ApiPromise.create({
            provider
        });
        const rawChainInfo = await api.registry.getChainProperties()
        var chainInfo = JSON.parse(rawChainInfo);
        const prefix = chainInfo.ss58Format

        let numHolders = 0;
        let rows = [];
        let asset = this.getChainAsset(chainID);
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
        let [tblName, tblRealtime] = this.get_btTableRealtime()

        let decimals = this.getChainDecimal(chainID)
        let [finalizedBlockHash, blockTS, bn] = await this.getFinalizedBlockInfo(chainID, api)
        let apiAt = await api.at(finalizedBlockHash)
        let last_key = '';
        while (true) {
            let query = await apiAt.query.system.account.entriesPaged({
                args: [],
                pageSize: perPagelimit,
                startKey: last_key
            })
            if (query.length == 0) {
                console.log(`Query Completed: total ${numHolders} accounts`)
                break
            }

            var cnt = 0
            let out = [];
            let vals = ["ss58Address", "free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN"];
            let replace = ["ss58Address"];
            let lastUpdateBN = ["free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN"];
            for (const user of query) {
                cnt++
                numHolders++;
                let pub = user[0].slice(-32);
                let pubkey = u8aToHex(pub);
                let account_id = encodeAddress(pub, prefix);
                let nonce = user[1].nonce.toString()
                let balance = user[1].data
                let free_balance = (balance.free) ? parseInt(balance.free.toString(), 10) / 10 ** decimals : 0;
                let reserved_balance = (balance.reserved) ? parseInt(balance.reserved.toString(), 10) / 10 ** decimals : 0;
                let miscFrozen_balance = (balance.miscFrozen) ? parseInt(balance.miscFrozen.toString(), 10) / 10 ** decimals : 0;
                let feeFrozen_balance = (balance.feeFrozen) ? parseInt(balance.feeFrozen.toString(), 10) / 10 ** decimals : 0;

                let stateHash = u8aToHex(user[1].createdAtHash)
                out.push(`('${pubkey}', '${account_id}', '${free_balance}', '${reserved_balance}', '${miscFrozen_balance}', '${feeFrozen_balance}', '${finalizedBlockHash}', Now(), '${bn}')`);
                let rowKey = pubkey.toLowerCase()
                console.log(rowKey, `cbt read accountrealtime prefix=${rowKey}`);
                rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, free_balance, reserved_balance, miscFrozen_balance, feeFrozen_balance, blockTS, bn));
                last_key = user[0];
            }
            await this.upsertSQL({
                "table": `address${chainID}`,
                "keys": ["address"],
                "vals": vals,
                "data": out,
                "replace": vals,
                "lastUpdateBN": lastUpdateBN
            });
            console.log("writing", rows.length, chainID, "rows numHolders=", numHolders, "/", prev_numHolders);
            await this.insertBTRows(tblRealtime, rows, tblName);
            rows = [];
        }
        // for all the other accounts that did NOT appear, we can delete them if they were OLDER than bn, because they are reaped == but we still need to 0 out the balances
        let sql_reap = `select address, lastUpdateBN from address${chainID} where lastUpdateBN < ${bn}`
        let sql_delete = `delete from address${chainID} where lastUpdateBN < ${bn}`
        console.log(`REAPING: `, sql_reap, ` DELETE: `, sql_delete);

        let reapedAccounts = await this.poolREADONLY.query(sql_reap)
        for (let a = 0; a < reapedAccounts.length; a++) {
            let address = reapedAccounts[a].address;
            rows.push(this.generate_btRealtimeRow(address, encodedAssetChain, 0, 0, 0, 0, blockTS, bn));
            console.log("REAPED ACCOUNT", address);
        }
        console.log("writing ", rows.length, " REAPED accounts to bt");
        await this.insertBTRows(tblRealtime, rows, tblName);
        rows = [];

        // now that we have written them out to BT, we can delete them
        this.batchedSQL.push(sql_delete);
        await this.update_batchedSQL();

        let sql = `update chain set numHolders = '${numHolders}', lastUpdateAddressNativeBalanceDT = Now() where chainID = ${chainID}`
        console.log(numHolders, sql);
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async updateChainlogNumAccountsActive(chainID = null, lookback = 7) {
        await this.assetManagerInit();
        let whereChain = (chainID >= 0) ? ` and chainID = ${chainID}` : "";
        let sql = `select UNIX_TIMESTAMP(logDT) as logTS, chainID from blocklog where logDT >= date_sub(Now(), interval ${lookback} DAY) and logDT < date_sub(Now(), interval 1 day) and  numAccountsActiveLastUpdateDT is null ${whereChain} order by rand() limit 20`;
        let chainlog = await this.poolREADONLY.query(sql)
        for (let i = 0; i < chainlog.length; i++) {
            let [logDT, hr] = paraTool.ts_to_logDT_hr(chainlog[i].logTS);
            await this.update_chainlog_numAccountsActive(chainlog[i].chainID, logDT);
        }
    }

    async scan_active_signers(chainID, startBN, endBN, address, isEVM = 0) {
        const tableChain = this.getTableChain(chainID);
        let start = paraTool.blockNumberToHex(startBN);
        let end = paraTool.blockNumberToHex(endBN);
        let families = ["feed", "trace", "finalized"]
        if (isEVM) families.push("feedevm");
        const filter = {
            start,
            end,
            family: families
        };
        let [rows] = await tableChain.getRows(filter)
        let out = [];
        rows.forEach(async (row) => {
            try {
                let bn = parseInt(row.id.substring(2), 16);
                let rowData = row.data;
                let finalizedData = rowData["finalized"];
                let feedData = rowData["feed"];
                let feedevmData = rowData["feedevm"];
                let feesCovered = false;
                let txsCovered = false;
                if (finalizedData) {
                    for (const h of Object.keys(finalizedData)) {
                        if (feedData && feedData[h] && feesCovered == false) {
                            try {
                                let cell = feedData[h][0];
                                let feed = JSON.parse(cell.value);
                                if (feed.extrinsics && feed.extrinsics.length > 0) {
                                    for (let i = 0; i < feed.extrinsics.length; i++) {
                                        let ext = feed.extrinsics[i];
                                        if (ext.signer) {
                                            address[ext.signer] = 1;
                                        }
                                    }
                                    feesCovered = true
                                }
                            } catch (e) {
                                console.log(e);
                            }
                        }
                        if (isEVM && feedevmData && feedevmData[h] && txsCovered == false) {
                            try {
                                let cell = feedevmData[h][0];
                                let feedevm = JSON.parse(cell.value);
                                if (feedevm.transactions && feedevm.transactions.length > 0) {
                                    for (let i = 0; i < feedevm.transactions.length; i++) {
                                        let tx = feedevm.transactions[i];
                                        if (tx.from) {
                                            address[tx.from] = 1;
                                        }
                                    }
                                    txsCovered = true;
                                }
                            } catch (e) {
                                console.log(e);
                            }
                        }
                        break;
                    }
                }
            } catch (err) {
                console.log(`audit_chain_raw`, err)
            }
        });
    }

    async update_chainlog_numAccountsActive(chainID, logDT) {
        console.log("update_chainlog_numAccountsActive", chainID, logDT);
        let chains = await this.poolREADONLY.query(`select chainID, WSEndpoint, numHolders isEVM from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let chain = chains[0];
        let wsEndpoint = chain.WSEndpoint;
        let isEVM = chain.isEVM;
        let prev_numHolders = chain.numHolders;
        let sql0 = `select min(blockNumber) startBN, max(blockNumber) endBN from block${chainID} where blockDT >= '${logDT} 00:00:00' and blockDT <= '${logDT} 23:59:59' limit 1`;
        console.log(sql0);
        let blocks = await this.poolREADONLY.query(sql0)
        if (blocks.length == 0) {
            console.log("No blocks found ${chainID}")
            return false;
        }
        let startBN = blocks[0].startBN;
        let endBN = blocks[0].endBN;
        let address = {};
        let jmp = 100;
        for (let i = startBN; i <= endBN; i += jmp) {
            let i0 = i;
            let i1 = i + jmp;
            if (i1 > endBN) i1 = endBN;
            await this.scan_active_signers(chainID, i0, i1, address, isEVM);
            let numAccountsActive = Object.keys(address).length;
            console.log(i, numAccountsActive);
        }
        let numAccountsActive = Object.keys(address).length;
        // create xcm directory
        let chainlogdir = path.join(bqDir, "chainlog", `${logDT}`);
        if (!fs.existsSync(chainlogdir)) {
            await fs.mkdirSync(chainlogdir);
        }
        let chainlogfn = path.join(chainlogdir, `${chainID}-active.json`)
        await fs.writeFileSync(chainlogfn, JSON.stringify(Object.keys(address)));

        let sql = `update blocklog set numAccountsActive = '${numAccountsActive}', numAccountsActiveLastUpdateDT = Now() where chainID = '${chainID}' and logDT = '${logDT}'`
        console.log(chainlogfn, sql);
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async updateChainlogNumAddresses(chainID = null, lookback = 7) {
        await this.assetManagerInit();
        let whereChain = (chainID >= 0) ? ` and chainID = ${chainID}` : "";
        let sql = `select UNIX_TIMESTAMP(logDT) as logTS, chainID from blocklog where logDT >= date_sub(Now(), interval ${lookback} DAY) and logDT < date_sub(Now(), interval 1 day) and  numAddressesLastUpdateDT is null ${whereChain} order by rand() limit 20`;
        let chainlog = await this.poolREADONLY.query(sql)
        console.log(sql, chainlog);
        for (let i = 0; i < chainlog.length; i++) {
            let [logDT, hr] = paraTool.ts_to_logDT_hr(chainlog[i].logTS);
            await this.update_chainlog_numAddresses(chainlog[i].chainID, logDT);
        }
    }

    async update_chainlog_numAddresses(chainID, logDT) {
        console.log("update_chainlog_numAddresses", chainID, logDT);
        let chains = await this.poolREADONLY.query(`select chainID, WSEndpoint, numHolders from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let chain = chains[0];
        let wsEndpoint = chain.WSEndpoint;
        let prev_numHolders = chain.numHolders;
        let sql0 = `select blockHash from block${chainID} where blockDT >= '${logDT} 00:00:00' and blockDT <= '${logDT} 23:59:59' order by blockDT desc limit 1`;
        console.log(sql0);
        let blocks = await this.poolREADONLY.query(sql0)
        if (blocks.length == 0) {
            console.log("No blocks found ${chainID}")
            return false;
        }

        const finalizedBlockHash = blocks[0].blockHash;
        console.log(chainID, "blockHash", finalizedBlockHash);
        const provider = new WsProvider(wsEndpoint);
        const api = await ApiPromise.create({
            provider
        });
        const rawChainInfo = await api.registry.getChainProperties()
        var chainInfo = JSON.parse(rawChainInfo);
        const prefix = chainInfo.ss58Format

        let apiAt = await api.at(finalizedBlockHash)
        let last_key = '';
        let perPagelimit = 1000;
        let numAddresses = 0;
        while (true) {
            let query = await apiAt.query.system.account.entriesPaged({
                args: [],
                pageSize: perPagelimit,
                startKey: last_key
            })
            if (query.length == 0) {
                console.log(`Query Completed: total ${numAddresses} accounts`)
                break
            }
            for (const user of query) {
                numAddresses++;
                last_key = user[0];
            }
            console.log("numAddresses", chainID, logDT, numAddresses);
        }
        let sql = `update blocklog set numAddresses = '${numAddresses}', numAddressesLastUpdateDT = Now() where chainID = '${chainID}' and logDT = '${logDT}'`
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();

    }

    generate_btRealtimeRow(rowKey, encodedAssetChain, free_balance, reserved_balance, miscFrozen_balance, feeFrozen_balance, blockTS, bn) {
        let newState = {
            free: free_balance,
            reserved: reserved_balance,
            miscFrozen: miscFrozen_balance,
            feeFrozen: feeFrozen_balance,
            frozen: feeFrozen_balance,
            ts: blockTS,
            bn: bn,
            source: this.hostname,
            genTS: this.currentTS()
        };
        let rec = {};
        rec[encodedAssetChain] = {
            value: JSON.stringify(newState),
            timestamp: blockTS * 1000000
        }
        let row = {
            key: rowKey,
            data: {
                realtime: rec
            }
        }
        return (row);
    }

    // fetch session.NewSession from bq events table and store in indexlog.blockNumberNewSession
    async updateIndexlogBlocknumberNewSession(minLogDT = "2019-01-01", maxLogDT = "2022-07-22") {
        let fullTable = this.getBQTable("events");
        const bigqueryClient = new BigQuery();
        let sqlQuery = `SELECT c, bn as blockNumber, UNIX_SECONDS(ts) as ts FROM ${fullTable} where date(ts) >= '${minLogDT}' and date(ts) <= '${maxLogDT}' and p = 'session' and m = 'NewSession' ORDER BY c, blockNumber`;
        console.log(sqlQuery);
        const options = {
            query: sqlQuery,
            // Location must match that of the dataset(s) referenced in the query.
            location: 'US',
        };

        // Run BigQuery on events
        const [rows] = await bigqueryClient.query(options);
        var out = [];
        let vals = ["blockNumberNewSession"];
        for (let i = 0; i < rows.length; i++) {
            let r = rows[i];
            let ts = r.ts;
            let indexTS = Math.floor(ts / 3600) * 3600;
            let [logDT, hr] = paraTool.ts_to_logDT_hr(ts);

            // prep SQL piece for insertion into indexlog
            let sqlpiece = `('${r.c}', '${indexTS}', '${logDT}', '${hr}', '${r.blockNumber}')`;
            out.push(sqlpiece);
            if (out.length > 100) {
                console.log(out.length, sqlpiece);
                await this.upsertSQL({
                    "table": "indexlog",
                    "keys": ["chainID", "indexTS", "logDT", "hr"],
                    "vals": vals,
                    "data": out,
                    "replace": vals
                });
                out = [];
            }
        }
        if (out.length > 0) {
            console.log(out.length);
            await this.upsertSQL({
                "table": "indexlog",
                "keys": ["chainID", "indexTS", "logDT", "hr"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
            out = [];
        }
    }

    // move table data (6) from local data into (a) GS buckets (gsBucketName) with gsutil and (b) BQ dataset with "bq load"  -- and record bqlog.loaded = 1
    // This is done only if indexlog.indexed = 1
    async updateBQLog(minLogDT = '2022-05-01', maxLogDT = '2022-12-31') {
        let tbls = ["extrinsics", "events", "xcm", "evmtxs", "transfers", "rewards"]
        let gsBucketName = this.GC_STORAGE_BUCKET
        let bqDataset = this.GC_BIGQUERY_DATASET

        let logDTs = await this.poolREADONLY.query(`select logDT, unix_timestamp(logDT) as indexTS, count(*) from indexlog where logDT >= '${minLogDT}' and logDT <= '${maxLogDT}' and readyForIndexing = 1 and indexed = 1 and logDT not in (select logDT from bqlog where loaded = 1 and logDT >= '${minLogDT}' and logDT < date(${maxLogDT}) ) group by logDT order by logDT limit 365`);

        for (let i = 0; i < logDTs.length; i++) {
            try {
                let indexTS = logDTs[i].indexTS;
                let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
                let logDT0 = logDT.replaceAll("-", "");
                for (const tbl of tbls) {
                    let dir = path.join("/disk1", tbl)
                    if (fs.existsSync(`${dir}/${logDT}`)) {
                        let cmd0 = `gsutil -q -m rsync ${dir}/${logDT} gs://${gsBucketName}/${tbl}/${logDT}`
                        console.log(cmd0);
                        await exec(cmd0);

                        let cmd1 = `bq load --max_bad_records=10000  --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}$${logDT0}' gs://${gsBucketName}/${tbl}/${logDT}/*.json schema/bq/${tbl}.json`;
                        console.log(cmd1);
                        await exec(cmd1);
                    }
                }
                let sql = `insert into bqlog (logDT, indexTS, loaded, loadDT) values ('${logDT}', '${indexTS}', '1', Now()) on duplicate key update indexTS = values(indexTS), loaded = values(loaded), loadDT = values(loadDT)`
                this.batchedSQL.push(sql);
                await this.update_batchedSQL();
                console.log(sql);
            } catch (e) {
                console.log(e);
            }
        }

        for (const tbl of tbls) {
            if (tbl == "xcm") {
                console.log(tbl)
                await this.update_xcm_log(720);
            } else { // extrinsics, events, evmtxs, transfers, rewards
                console.log("update_bq_log", tbl)
                await this.update_bq_log(tbl, minLogDT, maxLogDT);
                console.log("clean_recent", tbl)
            }
            await this.clean_recent(tbl, minLogDT);

        }

        await this.update_batchedSQL();
    }

    async clean_recent(tbl, minLogDT = '2022-06-12') {
        if (tbl == "transfers" || tbl == "extrinsics") {
            let fullTable = `\`paraholic.${tbl}\``;
            const bigqueryClient = new BigQuery();
            let sqlQuery = `SELECT c, UNIX_SECONDS(MAX(ts)) as ts FROM ${fullTable}  GROUP BY c`; // where DATE(ts) >= ${minLogDT}
            const options = {
                query: sqlQuery,
                // Location must match that of the dataset(s) referenced in the query.
                location: 'US',
            };
            console.log(sqlQuery);
            // Run BigQuery to get raw data
            const [rows] = await bigqueryClient.query(options);
            var out = [];
            for (let i = 0; i < rows.length; i++) {
                let r = rows[i];
                let c = r.c;
                let ts = r.ts;
                let sql = `delete from ${tbl}recent where ts < ${ts} and chainID = '${c}'`
                console.log(c, ts, sql);
                this.batchedSQL.push(sql)
                await this.update_batchedSQL();
            }
        }
    }

    async update_bq_log(tbl, minLogDT, maxLogDT, limit = 20000) {
        let fullTable = this.getBQTable(tbl);
        const bigqueryClient = new BigQuery();
        let hasValueUSD = (tbl == "extrinsics" || tbl == "rewards" || tbl == "transfers")
        let flds = hasValueUSD ? ", sum(v) as valueUSD" : ""
        let sqlQuery = `SELECT c, p, m, EXTRACT(DATE from ts) as logDT, COUNT(*) AS cnt ${flds} FROM ${fullTable} where date(ts) >= '${minLogDT}' and date(ts) <= '${maxLogDT}' GROUP BY c, p, m, logDT ORDER BY count(*) desc LIMIT ${limit}`;
        if (tbl == "evmtxs") {
            sqlQuery = `SELECT c, s as p, m, EXTRACT(DATE from ts) as logDT, COUNT(*) AS cnt ${flds} FROM ${fullTable} where date(ts) >= '${minLogDT}' and date(ts) <= '${maxLogDT}' GROUP BY c, p, m, logDT ORDER BY count(*) desc LIMIT ${limit}`;
        }
        console.log(sqlQuery);

        const options = {
            query: sqlQuery,
            // Location must match that of the dataset(s) referenced in the query.
            location: 'US',
        };

        // Run BigQuery to get raw data
        const [rows] = await bigqueryClient.query(options);
        var out = [];
        for (let i = 0; i < rows.length; i++) {
            let r = rows[i];
            let logDT = r.logDT.value;
            let vals = (hasValueUSD) ? `, ${r.valueUSD}` : ""
            out.push(`('${r.c}', '${r.p}', '${r.m}', '${logDT}', '${r.cnt}' ${vals})`);
        }

        // accumulate into "extrinsicslog" and "eventslog"
        let fldName = (tbl == "evmtxs") ? 'numTransactionsEVM' : `num${tbl}`;
        flds = hasValueUSD ? ', valueUSD' : '';
        let upds = hasValueUSD ? ', valueUSD = values(valueUSD)' : '';
        let logTable = `${tbl}log`
        if (out.length > 0) {
            let sql = `insert into ${logTable} ( chainID, section, method, logDT, ${fldName} ${flds} ) values ` + out.join(",") + ` on duplicate key update ${fldName} = values(${fldName}) ${upds}`;
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
            // accmulate into "extrinsics" and "events"
            let ranges = [7, 30, 10000];
            for (let r = 0; r < ranges.length; r++) {
                let range = ranges[r];
                let fld = (range > 9999) ? `${fldName}` : `${fldName}${range}d`
                let valueFldName = (range > 9999) ? `valueUSD` : `valueUSD${range}d`
                let flds = hasValueUSD ? `, ${valueFldName}` : "";
                let vals = hasValueUSD ? ", sum(valueUSD)" : "";
                let upds = hasValueUSD ? `, ${valueFldName} = values(${valueFldName})` : "";
                let sql = `insert into ${tbl} (chainID, section, method, ${fld} ${flds}) (select chainID, section, method, sum(${fldName}) as ${fldName} ${vals} from ${logTable} where logDT >= date_sub(Now(),interval ${range} day) group by chainID, section, method) on duplicate key update ${fld} = values(${fld}) ${upds}`;
                this.batchedSQL.push(sql);
                await this.update_batchedSQL();
            }
        }
    }

    async update_xcm_log(lookback = 30) {
        // summarize last N days (lookback) of "xcmtransfer" table into "xcmlog" table by chainID/chainIDDest/logDT
        let sql = `insert into xcmlog ( chainID, chainIDDest, logDT, numXCMTransfer, amountSentUSD, amountReceivedUSD ) ( select chainID, chainIDDest, DATE(FROM_UNIXTIME(sourceTS)) as logDT, count(*), sum(amountSentUSD), sum(amountReceivedUSD) from xcmtransfer where sourceTS > UNIX_TIMESTAMP(date_sub(NOW(), INTERVAL ${lookback} DAY)) and incomplete = 0 group by chainID, chainIDDest, logDT ) on duplicate key update amountSentUSD = values(amountSentUSD), amountReceivedUSD = values(amountReceivedUSD)`;
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    // create table coingecko ( id varchar(64), symbol varchar(64), name varchar(256), primary key (id) )
    async update_coingecko_list() {
        try {
            // {"id":"11653-nottingham","symbol":"realtoken-s-11653-nottingham-rd-detroit-mi","name":"RealT Token - 11653 Nottingham Rd, Detroit, MI 48224"}
            const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/list`);
            var a = [];
            for (const t of resp.data) {
                console.log(t);
                a.push(`(` + mysql.escape(t.id) + `, ` + mysql.escape(t.symbol) + `, ` + mysql.escape(t.name) + `)`);
            }
            this.batchedSQL.push(`insert into coingecko (id, symbol, name) values ` + a.join(",") + ` on duplicate key update symbol = values(symbol), name = values(name)`);
            await this.update_batchedSQL();
        } catch (err) {
            this.logger.error({
                op: "update_coingecko_list",
                err
            });
        }
        return false;
    }

    async update_endpoints(relayChain, endpoints) {
        let out = [];
        console.log("update_endpoints", relayChain, endpoints.length);
        for (var i = 0; i < endpoints.length; i++) {
            let e = endpoints[i];
            console.log(e);
            let providers = [];
            for (const p of Object.keys(e.providers)) {
                providers.push(e.providers[p]);
            }
            let WSEndpoint = providers.length > 0 ? providers[0] : "";
            let WSEndpoint2 = providers.length > 1 ? providers[1] : "";
            let WSEndpoint3 = providers.length > 2 ? providers[2] : "";
            let isUnreachable = (e.isUnreachable) ? 1 : 0;
            out.push(`( ` + mysql.escape(e.info) + `, '${relayChain}', ` + mysql.escape(e.homepage) + `, '${e.paraId}', ` + mysql.escape(e.text) + `, ` +
                mysql.escape(WSEndpoint) + `, ` + mysql.escape(WSEndpoint2) + ` , ` + mysql.escape(WSEndpoint3) + `, ${isUnreachable} )`);
        }

        let sql = `insert into chainEndpoint (chainName, relayChain, homepage, paraID, RPCEndpoint, WSEndpoint, WSEndpoint2, WSEndpoint3, isUnreachable) values ` + out.join(",") + ` on duplicate key update RPCEndpoint = values(RPCEndpoint)`;
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }



    async updateEndpoints(kusamaEndpoints, polkadotEndpoints) {
        await this.update_endpoints('kusama', kusamaEndpoints);
        await this.update_endpoints('polkadot', polkadotEndpoints);
    }

    async updateRegistry2() {
        try {
            const resp = await axios.get(`https://raw.githubusercontent.com/talismanSociety/chaindata/main/chaindata.json`);
            var respData = resp.data;
            for (const r of respData) {
                /*
              {
                "id": "moonbeam",
                "prefix": 1284,
                "name": "Moonbeam",
                "token": "GLMR",
                "decimals": 18,
                "account": "secp256k1",
                "subscanUrl": "https://moonbeam.subscan.io/",
                "rpcs": Array[2][
                  "wss://wss.api.moonbeam.network",
                  "wss://moonbeam.api.onfinality.io/public-ws"
                ],
                "paraId": 2004,
                "relay": {
                  "id": "polkadot"
                }
              }
	             */
                console.log(r)
                let symbol = (r.token != undefined) ? `'${r.token}'` : 'Null'
                let prefix = (r.prefix != undefined) ? `'${r.prefix}'` : 'Null'
                if (r.relay == undefined) {
                    var sql = `update chain set id = '${r.id}', chainName = '${r.name}', standardAccount = '${r.account}', symbol = '${r.token}', prefix = ${prefix} where chainName = '${r.name}'`
                    console.log(sql)
                    this.batchedSQL.push(sql);
                } else {
                    let relayChain = r.relay.id
                    //var sql = `update chain set id = '${r.id}', chainName = '${r.name}', paraID = '${r.paraId}', relayChain = '${relayChain}' where chainName = '${r.name}'`
                    var sql = `update chain set id = '${r.id}', chainName = '${r.name}', paraID = '${r.paraId}', relayChain = '${relayChain}', standardAccount = '${r.account}', symbol = '${r.token}', prefix = ${prefix} where paraID = '${r.paraId}' and relayChain = '${relayChain}'`
                    console.log(sql)
                    this.batchedSQL.push(sql);
                }
            }
            await this.update_batchedSQL();
        } catch (err) {
            this.logger.error({
                op: "updateRegistry",
                err
            });
        }
        return false;
    }

    async updateRegistry() {
        try {
            const resp = await axios.get(`https://raw.githubusercontent.com/paritytech/ss58-registry/main/ss58-registry.json`);
            var respData = resp.data;
            var registry = respData.registry;
            for (const r of registry) {
                /*{
                prefix: 1285,
                network: 'moonriver',
                displayName: 'Moonriver',
                symbols: [ 'MOVR' ],
                decimals: [ 18 ],
                standardAccount: 'secp256k1',
                website: 'https://moonbeam.network'
              }
	             */
                if (r.network.includes("testnet")) {} else {
                    console.log(r)
                    let symbols = JSON.stringify(r.symbols)
                    let decimals = JSON.stringify(r.decimals)
                    let symbol = (r.symbols.length > 0) ? `'${r.symbols[0]}'` : 'NULL'
                    var sql = `update chain set prefix = '${r.prefix}', symbols= '${symbols}', decimals='${decimals}',standardAccount='${r.standardAccount}' where symbols = '[]' and symbol = ${symbol};`

                    var sql = `update chain set prefix = '${r.prefix}', symbols= '${symbols}', decimals='${decimals}',standardAccount='${r.standardAccount}' where symbols = '[]' and symbol = ${symbol};`

                    let standardAccount = r.standardAccount
                }
            }
            await this.update_batchedSQL();
        } catch (err) {
            this.logger.error({
                op: "updateRegistry",
                err
            });
        }
        return false;
    }

    async get_block_mysql(chainID, blockNumber) {
        let sql = `select blockHash, UNIX_TIMESTAMP(blockDT) as blockTS from block${chainID} where blockNumber = ${blockNumber}`
        let blocks = await this.poolREADONLY.query(sql);

        return (blocks[0]);
    }

    async validateBlockOrdering(chainID = 8) {
        this.chainID = chainID;
        var sql = `select date(blockDT) as logDT, hour(blockDT) as hr, minute(blockDT) as m, min(blockNumber) startBN, max(blockNumber) endBN from block${chainID} where blockDT is not null group by hr, m, logDT order by logDT, hr, m;`

        var periods = await this.poolREADONLY.query(sql);
        let chain = await this.getChain(this.chainID);
        await this.setupAPI(chain);

        for (let i = 0; i < periods.length - 1; i++) {
            let currPeriod = periods[i];
            let nextPeriod = periods[i + 1];
            let diff = nextPeriod.startBN - currPeriod.endBN;
            if (diff < 1) {
                console.log(`${i} : ${diff} --- MISMATCH on chain#${chainID}`, `currPeriod`, currPeriod, `nextPeriod`, nextPeriod);
            }
        }
    }

    async refreshChainMap() {
        let currTS = new Date().getTime() / 1000
        if (currTS - this.lastUpdateTS < 6) {
            return
        }
        let chains = await this.getChains();
        let chainMap = {}
        for (let c = 0; c < chains.length; c++) {
            let chain = chains[c];
            chainMap[chain.chainID] = chain;
        }
        this.chainMap = chainMap
        this.lastUpdateTS = currTS
        console.log(`update last finalized TS`, currTS)
    }

    async cleanAddressExtrinsic(max = 256) {
        for (let i = 0; i < max; i++) {
            let hs = "0x" + i.toString(16).padStart(2, '0');
            let he = "0x" + (i + 1).toString(16).padStart(2, '0');
            if (i == max - 1) he = "0xffff";
            let ndeletions = 0
            do {
                ndeletions = await this.clean_addressExtrinsic(hs, he);
            } while (ndeletions > 0);
        }
    }

    // deletes all feedtransfer cells that are chainID 2000, 22000, 22001 or so
    async clean_addressExtrinsic(start, end, limit = 50000) {
        const filter = {
            start,
            end,
            filter: [{
                family: ["feedtransfer"]
            }],
            limit: 50000
        };
        console.log(filter)
        let ndeletions = 0;
        let [rows] = await this.btAddressExtrinsic.getRows(filter)
        for (const row of rows) {
            try {
                let rowData = row.data;
                if (rowData["feedtransfer"] != undefined) {
                    let columnData = rowData["feedtransfer"];
                    let deletions = [];
                    for (const h of Object.keys(columnData)) {
                        for (const cell of columnData[h]) {
                            let x = JSON.parse(cell.value);
                            if (x.chainID == 2000 || (x.chainID == 22000) || x.chainID == 22001) {
                                let col = `feedtransfer:${h}`;
                                deletions.push(col)
                            }

                        }
                        if (deletions.length > 0) {
                            console.log(start, deletions)
                            await row.deleteCells(deletions);
                            ndeletions += deletions.length;
                        }
                    }
                }
            } catch (err) {
                console.log(`clean_addressExtrinsic`, err)
                this.logger.error({
                    "op": "clean_addressExtrinsic",
                    err
                })
            }
        }
        return (ndeletions);
    }


    canonicalize_string(inp) {
        return inp.toLowerCase().replaceAll("_", "").trim()
    }

    lookup_specversion_type(lookup, id) {
        try {
            for (let i = 0; i < lookup.length; i++) {
                if (lookup[i].id == id) {
                    return (lookup[i].type.def.variant.variants);
                }
            }
        } catch (err) {

        }
        return (false);
    }

    async updateDocs() {
        let sql = `select chainID, specVersion, metadata from specVersions order by chainID, specVersion desc`
        var specVersions = await this.poolREADONLY.query(sql)
        let extrinsicdocs = {};
        let eventdocs = {};

        for (let s = 0; s < specVersions.length; s++) {
            let chainID = specVersions[s].chainID;
            let runtime = JSON.parse(specVersions[s].metadata);
            if (runtime && (runtime.lookup !== undefined) && runtime.lookup && (runtime.lookup.types !== undefined)) {
                var lookup = runtime.lookup.types;
                var pallets = runtime.pallets;
                for (let i = 0; i < pallets.length; i++) {
                    let p = pallets[i];
                    let section = p.name;
                    if (p.calls && (p.calls.type != undefined)) {
                        let t = this.lookup_specversion_type(lookup, p.calls.type);
                        if (t) {
                            for (let k = 0; k < t.length; k++) {
                                let name = t[k].name;
                                let docs = t[k].docs.join(" ")
                                let key = `${chainID}:${section}:${name}`
                                if (extrinsicdocs[key] == undefined) {
                                    extrinsicdocs[key] = docs;
                                    console.log(key, docs);
                                }
                            }
                        }
                    }
                    if (p.events) {
                        let t = this.lookup_specversion_type(lookup, p.events.type);
                        if (t) {
                            for (let k = 0; k < t.length; k++) {
                                let docs = t[k].docs.join(" ")
                                let name = t[k].name;
                                let key = `${chainID}:${section}:${name}`
                                if (eventdocs[key] == undefined) {
                                    eventdocs[key] = docs;
                                }
                            }
                        }
                    }
                }
            }
        }
        for (const k of Object.keys(extrinsicdocs)) {
            let [chainID, section, method] = k.split(":");
            let docs = extrinsicdocs[k];
            let p = this.canonicalize_string(section);
            let m = this.canonicalize_string(method);
            let sql = `insert into extrinsicdocs (chainID, section, method, docs) values ('${chainID}', '${p}', '${m}', ${mysql.escape(docs)}) on duplicate key update docs = values(docs)`;
            this.batchedSQL.push(sql);
        }
        await this.update_batchedSQL();
    }

    // for any 0x .... 0000 in addresslist without an existing nickname
    async testNicknames() {
        // 0x706172 - para:
        // 0x7369626 - sibl:
        // 0x6d6f646c - modl
        // 0x65766d3a - evm:
        let sql = `select address from address where ((address like '0x706172%000000') or ( address like '0x7369626%0000000') or (address like '0x6d6f646c%000000') ) and address not in ( select address from account where nickname is not null ) and length(address) = 66;`
        let addressList = await this.poolREADONLY.query(sql)
        for (let i = 0; i < addressList.length; i++) {
            let a = addressList[i]
            let address = a.address;
            console.log(address, paraTool.pubKeyHex2ASCII(address));
        }
    }

    async computeAddressColumnsBQ(query = "transfersout", limit = 5000000) {
        let transfersTable = this.getBQTable("transfers");
        let extrinsicsTable = this.getBQTable("extrinsics");
        let rewardsTable = this.getBQTable("rewards");
        const bigqueryClient = new BigQuery();
        let sqlQuery = null
        let vals = [];
        if (query == "transfersIn") {
            sqlQuery = `SELECT f as address, avg(v) as avgTransferInUSD, sum(v) as sumTransferInUSD, count(*) as numTransfersIn, UNIX_SECONDS(min(ts)) as transferInFirstTS, UNIX_SECONDS(max(ts)) transferInLastTS FROM ${transfersTable} GROUP BY f HAVING numTransfersIn > 0 ORDER BY count(*) desc LIMIT ${limit}`;
            vals = ["avgTransferInUSD", "sumTransferInUSD", "numTransfersIn", "transferInFirstTS", "transferInLastTS"]
        } else if (query == "transfersOut") {
            sqlQuery = `SELECT t as address, avg(v) as avgTransferOutUSD, sum(v) as sumTransferOutUSD, count(*) as numTransfersOut, UNIX_SECONDS(min(ts)) as transferOutFirstTS, UNIX_SECONDS(max(ts)) transferOutLastTS FROM ${transfersTable} GROUP BY t HAVING numTransfersOut > 0 ORDER BY count(*) desc LIMIT ${limit}`;
            vals = ["avgTransferOutUSD", "sumTransferOutUSD", "numTransfersOut", "transferOutFirstTS", "transferOutLastTS"]
        } else if (query == "extrinsics") {
            sqlQuery = `SELECT f as address, count(*) as numExtrinsics, sum(if(v>0, 1, 0)) as numExtrinsicsDefi, UNIX_SECONDS(min(ts)) as extrinsicFirstTS, UNIX_SECONDS(max(ts)) extrinsicLastTS FROM ${extrinsicsTable} GROUP BY f HAVING numExtrinsics > 0 ORDER BY count(*) desc LIMIT ${limit}`;
            vals = ["numExtrinsics", "numExtrinsicsDefi", "extrinsicFirstTS", "extrinsicLastTS"]
        } else if (query == "crowdloans") {
            sqlQuery = `SELECT f as address, count(*) as numCrowdloans, sum(v) crowdloansUSD FROM ${extrinsicsTable} where p = 'crowdloan' and m = 'contribute' GROUP BY f HAVING numCrowdloans > 0 ORDER BY count(*) desc LIMIT ${limit}`;
            vals = ["numCrowdloans", "crowdloansUSD"]
        } else if (query == "rewards") {
            sqlQuery = `SELECT t as address, count(*) as numRewards, sum(v) rewardsUSD FROM ${rewardsTable} GROUP BY t HAVING numRewards > 0 ORDER BY count(*) desc LIMIT ${limit}`;
            vals = ["numRewards", "rewardsUSD"]
        }
        const options = {
            query: sqlQuery,
            // Location must match that of the dataset(s) referenced in the query.
            location: 'US',
        };

        // Run BigQuery to get raw data
        const [rows] = await bigqueryClient.query(options);
        let out = [];
        let nrecs = 0;
        for (let i = 0; i < rows.length; i++) {
            let r = rows[i];
            switch (query) {
                case "transfersIn":
                    out.push(`('${r.address}', ${r.avgTransferInUSD}, ${r.sumTransferInUSD}, '${r.numTransfersIn}', '${r.transferInFirstTS}', '${r.transferInLastTS}')`);
                    break;
                case "transfersOut":
                    out.push(`('${r.address}', ${r.avgTransferOutUSD}, ${r.sumTransferOutUSD}, '${r.numTransfersOut}', '${r.transferOutFirstTS}', '${r.transferOutLastTS}')`);
                    break;
                case "extrinsics":
                    out.push(`('${r.address}', '${r.numExtrinsics}', '${r.numExtrinsicsDefi}', '${r.extrinsicFirstTS}', '${r.extrinsicLastTS}')`);
                    break;
                case "crowdloans":
                    out.push(`('${r.address}', '${r.numCrowdloans}', ${r.crowdloansUSD})`);
                    break;
                case "rewards":
                    out.push(`('${r.address}', '${r.numRewards}', ${r.rewardsUSD})`);
                    break;
            }
            if (out.length > 10000) {
                await this.upsertSQL({
                    "table": "address",
                    "keys": ["address"],
                    "vals": vals,
                    "data": out,
                    "replace": vals
                });
                nrecs += out.length;
                console.log(query, nrecs, " rows updated (in progress)")
                out = [];
            }
        }

        if (out.length > 0) {
            nrecs += out.length;
            await this.upsertSQL({
                "table": "address",
                "keys": ["address"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
            console.log(query, nrecs, " rows updated total")
        }
    }


    async updateAddressBalances() {
        await this.assetManagerInit();

        for (let i = 0; i < 256; i++) {
            let hs = "0x" + i.toString(16).padStart(2, '0');
            let he = "0x" + (i + 1).toString(16).padStart(2, '0');
            if (i == 255) he = "0xgg";
            await this.update_address_balances(hs, he);
        }
    }

    async updateAddressTopN() {
        let topNgroups = ["balanceUSD", "numChains", "numAssets", "numTransfersIn", "avgTransferInUSD", "sumTransferInUSD", "numTransfersOut", "avgTransferOutUSD", "sumTransferOutUSD", "numExtrinsics", "numExtrinsicsDefi", "numCrowdloans", "numSubAccounts", "numRewards", "rewardsUSD"]
        for (const topN of topNgroups) {
            await this.update_address_topN(topN);
        }
    }

    async update_address_topN(topN, minBalanceUSD = 1000, maxBalanceUSD = 500000000, limit = 1000) {
        let sql = `select address, balanceUSD, ${topN} from address where balanceUSD > ${minBalanceUSD} order by ${topN} desc limit 2000`
        console.log(topN, sql);
        let recs = await this.poolREADONLY.query(sql);
        let out = [];
        let N = 1;
        let vals = [`balanceUSD`, `val`]
        for (const r of recs) {
            if (r.balanceUSD < maxBalanceUSD && N <= limit) {
                out.push(`('${r.address}', '${topN}', '${N}', ${r.balanceUSD}, '${r[topN]}')`)
                N++;
            }
        }
        await this.upsertSQL({
            "table": "addressTopN",
            "keys": ["address", "topN", "N"],
            "vals": vals,
            "data": out,
            "replace": vals
        });
    }

    async update_address_balances(start = "0x2c", end = "0x2d") {
        let addressData = [];
        console.log(start, end)

        let [_, tblRealtime] = this.get_btTableRealtime()

        // with 2 digit prefixes, there are 30K rows (7MM rows total)
        let [rows] = await tblRealtime.getRows({
            start: start,
            end: end
        });
        let vals = ["balanceUSD", "balanceUSDupdateDT", "symbols", "numChains", "numAssets"];

        for (const row of rows) {
            try {
                let rowData = row.data;
                let realtimeData = rowData["realtime"];
                let realtime = {};
                if (realtimeData) {
                    for (const assetChainEncoded of Object.keys(realtimeData)) {
                        let cell = realtimeData[assetChainEncoded];
                        let assetChain = paraTool.decodeAssetChain(assetChainEncoded);
                        let [asset, chainID] = paraTool.parseAssetChain(assetChain);
                        if (chainID !== undefined) {
                            try {
                                let assetInfo = this.assetInfo[assetChain];
                                if (assetInfo == undefined) {
                                    //console.log("NO ASSETINFO", assetChain, "asset", asset, "chainID", chainID, cell[0].value);
                                } else {
                                    let assetType = assetInfo.assetType;
                                    if (realtime[assetType] == undefined) {
                                        realtime[assetType] = [];
                                    }
                                    let state = JSON.parse(cell[0].value)
                                    if (state.genTS && state.source) {
                                        realtime[assetType].push({
                                            assetInfo,
                                            state: state
                                        });
                                    }
                                }
                            } catch (err) {
                                console.log("REALTIME ERR", err);
                            }
                        }
                    }
                }
                let totalUSDVal = 0;
                let numChains = 0;
                let numAssets = 0;
                let chains = {};
                let symbols = [];
                let ts = this.getCurrentTS();
                for (const assetType of Object.keys(realtime)) {
                    let assets = realtime[assetType];
                    if (assets == undefined) {
                        continue;
                    }
                    let flds = this.get_assetType_flds(assetType);
                    for (let i = 0; i < assets.length; i++) {
                        let holding = realtime[assetType][i];
                        let usdVal = await this.decorate_assetState(holding.assetInfo, holding.state, flds, ts);
                        if (usdVal > 0) {
                            let chainID = holding.assetInfo.chainID;
                            if (chains[chainID] == undefined) {
                                chains[chainID] = 1;
                                numChains++;
                            }
                            if (assetType == "Token") {
                                let symbol = assets[i].assetInfo.symbol
                                if (symbol != undefined && !symbols.includes(symbol)) {
                                    symbols.push(symbol);
                                }
                            }
                            numAssets++;
                        }
                        totalUSDVal += usdVal;
                    }
                }
                let address = row.id
                addressData.push(`('${address}', ${totalUSDVal}, FROM_UNIXTIME(${ts}), '${symbols}', '${numChains}', '${numAssets}')`)

            } catch (err) {
                console.log(err);
                process.exit(0);
                this.logger.warn({
                    "op": "updateAddressBalances",
                    err
                })
            }
        }
        await this.upsertSQL({
            "table": "address",
            "keys": ["address"],
            "vals": vals,
            "data": addressData,
            "replace": vals
        }, false, 5);
        return addressData.length;
    }

    async write_btRealtime_rows(rows, min, ctx = "") {
        if (rows.length > min) {
            let [tblName, tblRealtime] = this.get_btTableRealtime()
            try {
                await tblRealtime.insert(rows);
                console.log(ctx, "rows=", rows.length);
                return [];
            } catch (err) {
                console.log(err);
            }
        }
        return rows;
    }

    async write_btHashes_rows(rows, min, ctx = "") {
        if (rows.length > min) {
            try {
                await this.btHashes.insert(rows);
                console.log(ctx, "rows=", rows.length);
                return [];
            } catch (err) {
                console.log(err);
            }
        }
        return rows;
    }

    // write wasmCode.codeHash to btHashes wasmcode:${chainID}
    async write_btHashes_wasmcode(lookbackDays = 1) {
        let sql = `select codeHash, chainID, storer, codeStoredTS from wasmCode where codeStoredTS > UNIX_TIMESTAMP(DATE_SUB(Now(), interval ${lookbackDays} DAY)) order by codeStoredTS desc`
        let recs = await this.poolREADONLY.query(sql);
        let rows = [];
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.add_index_metadata(c);
            this.push_rows_related_keys("wasmcode", c.chainID.toString(), rows, c.codeHash, c)
            rows = await this.write_btHashes_rows(rows, 500, "write_hashes_wasmcode");
        }
        rows = await this.write_btHashes_rows(rows, 0, "write_hashes_wasmcode");
    }

    // write xcmmessages.msgHash to hashes xcmmessage:${sentAt}
    async write_btHashes_xcmmessage(lookbackDays = 1) {
        let ctx = "write_btHashes_xcmmessage";
        let sql = `select msgHash, sentAt, chainID, chainIDDest, msgType, blockTS, blockNumber, relayChain from xcmmessages where incoming = 1 and matched = 1 and blockTS > UNIX_TIMESTAMP(DATE_SUB(Now(), interval ${lookbackDays} DAY)) order by blockTS desc`
        let recs = await this.poolREADONLY.query(sql);
        let rows = [];
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.add_index_metadata(c);
            this.push_rows_related_keys("xcmmessage", c.sentAt.toString(), rows, c.msgHash, c)
            rows = await this.write_btHashes_rows(rows, 500, ctx);
        }
        await this.write_btHashes_rows(rows, 0, ctx);
    }

    // write xcmasset.symbol to hashes symbol:${relayChain}
    async write_btHashes_symbol(limit = 1) {
        let ctx = "write_btHashes_symbol";
        let sql = `select xcmasset.symbol, xcmasset.relayChain, xcmasset.nativeAssetChain, sum(numHolders) as numHolders from xcmasset join asset on xcmasset.xcmInteriorKey = asset.xcmInteriorKey group by symbol, relayChain, nativeAssetChain order by numHolders desc limit ${limit}`
        let recs = await this.poolREADONLY.query(sql);
        let rows = [];
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.add_index_metadata(c);
            this.push_rows_related_keys("symbol", c.relayChain, rows, c.symbol, c)
            rows = await this.write_btHashes_rows(rows, 500, ctx);
        }
        rows = await this.write_btHashes_rows(rows, 0, ctx);
    }

    // write asset.currencyID to hashes symbol:{chainID}
    async write_btHashes_currencyID(limit = 1) {
        let ctx = "write_btHashes_currencyID"
        let sql = `select asset.currencyID, asset.chainID, xcmasset.symbol, xcmasset.relayChain, asset.numHolders from asset join xcmasset on asset.xcmInteriorKey = xcmasset.xcmInteriorKey and asset.currencyID != xcmasset.symbol order by numHolders desc limit ${limit}`
        let recs = await this.poolREADONLY.query(sql);
        let rows = [];
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.add_index_metadata(c);
            this.push_rows_related_keys("symbol", c.relayChain, rows, c.currencyID, c)
            rows = await this.write_btHashes_rows(rows, 500, ctx);
        }
        rows = await this.write_btHashes_rows(rows, 0, ctx);

        let sql2 = `select asset.currencyID, asset.chainID, xcmasset.symbol, asset.symbol as localSymbol, xcmasset.relayChain, asset.numHolders from xcmasset, asset where xcmasset.xcmInteriorKey = asset.xcmInteriorKey and asset.symbol != xcmasset.symbol and assetType = 'Token' and asset.symbol like 'xc%' order by numHolders desc;`
        recs = await this.poolREADONLY.query(sql2);
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.add_index_metadata(c);
            this.push_rows_related_keys("symbol", c.relayChain, rows, c.localSymbol, c)
            rows = await this.write_btHashes_rows(rows, 500, ctx);
        }
        rows = await this.write_btHashes_rows(rows, 0, ctx);
    }

    // write chain.{chainID, paraID, id} to hashes chain:${relayChain}
    async write_btHashes_chain(limit = 1000) {
        let ctx = "write_btHashes_chain";
        let sql = `select chainID, id, chainName, paraID, relayChain, numHolders from chain where crawling = 1 order by numHolders desc limit ${limit}`
        let recs = await this.poolREADONLY.query(sql);
        let rows = [];
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.add_index_metadata(c);
            this.push_rows_related_keys("chain", c.relayChain, rows, c.chainID.toString(), c)
            if (c.paraID != c.chainID) {
                this.push_rows_related_keys("chain", c.relayChain, rows, c.paraID.toString(), c)
            }
            this.push_rows_related_keys("chain", c.relayChain, rows, c.id, c)
            rows = await this.write_btHashes_rows(rows, 500, ctx);
        }
        rows = await this.write_btHashes_rows(rows, 0, ctx);
    }

    // write contract.address to btRealtime wasmcontract:${chainID}    TODO: contractType (PSP22, PSP37, ...)
    async write_btRealtime_wasmcontract(lookbackDays = 1) {
        let ctx = "write_btRealtime_wasmcontract";
        let sql = `select address, chainID, codeHash, blockTS, deployer from contract where blockTS > UNIX_TIMESTAMP(date_sub(Now(), interval ${lookbackDays} DAY)) order by blockTS desc`
        let recs = await this.poolREADONLY.query(sql);
        let rows = [];
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.push_rows_related_keys("wasmcontract", c.chainID.toString(), rows, c.address, c)
            rows = await this.write_btRealtime_rows(rows, 500, ctx);
        }
        await this.write_btRealtime_rows(rows, 0, ctx);
    }

    // write asset.asset to accountrealtime evmcontract:{chainID} for assetType = 'ERC20', 'ERC20LP' (TODO: 'ERC721', 'ERC1155')
    async write_btRealtime_evmcontract(lookbackDays = 1) {
        let ctx = "write_btRealtime_evmcontract";
        let sql = `select asset, assetType, chainID, token0, token0Symbol, token1, token1Symbol, symbol, creator, createdAtTx, token0Decimals, token1Decimals from asset where assetType in ('Contract', 'ERC20', 'ERC20LP') and lastUpdateDT > date_sub(Now(), interval ${lookbackDays} DAY) order by lastUpdateDT desc`
        let recs = await this.poolREADONLY.query(sql);
        let rows = [];
        for (let i = 0; i < recs.length; i++) {
            let c = recs[i];
            this.push_rows_related_keys("evmcontract", c.chainID.toString(), rows, c.asset, c)
            rows = await this.write_btRealtime_rows(rows, 500, ctx);
        }
        await this.write_btRealtime_rows(rows, 0, ctx);
    }

    // writeBTHashesRealtime: writes all hashes/strings from { asset, xcmAsset, contract, chain } (other than extrinsicHashes, blockHashes)
    // to the { btHashes, btRealtime } BigTables
    async writeBTHashesRealtime(lookbackDays = 1, limit = 100) {
        /*        await this.write_btHashes_xcmmessage(lookbackDays);
                await this.write_btHashes_symbol(limit);
                await this.write_btHashes_chain(limit);
                await this.write_btHashes_currencyID(limit);
                await this.write_btHashes_wasmcode(lookbackDays);
                await this.write_btRealtime_wasmcontract(lookbackDays); */
        await this.write_btRealtime_evmcontract(lookbackDays);
    }

    /*
    For each crowdloan, write 2 cells into "hashes.related"
    (a) forward direction (fromAddress => memo)
    (b) reverse direction (memo => fromAddress)
    mysql> select ts, paraID, fromAddress, memo from crowdloan where memo in ( select holder from assetholder ) limit 10;
    +------------+--------+--------------------------------------------------------------------+--------------------------------------------------------------------+
    | ts         | paraID | fromAddress                                                        | memo                                                               |
    +------------+--------+--------------------------------------------------------------------+--------------------------------------------------------------------+
    | 1636706034 |   2004 | 0x9433e03eb43fb7f086f150a56b229e38150ab5411934438252520486e9fc047d | 0xcaadf7c0f8f58b8b468d201bfac676c135eb75d4                         |
    | 1637695278 |   2006 | 0x768e9b1c7df028c6f9c8cd702bc938a51a455d7babbd2434f751fe47c1007437 | 0x4ab52bb8245e545fc6b7861df6cf6a2db175f95c99f6b4b27e8f3bb3e9d10c4b |
    */
    async write_hashes_crowdloan(chainID, limit = 1000000) {
        // TODO: 0 vs 2
        let sql = `select chainID, amount, blockNumber, ts, paraID, fromAddress, memo from crowdloan where memo in ( select holder from assetholder${chainID} ) order by ts limit ${limit}`
        let crowdloans = await this.poolREADONLY.query(sql);
        let rows = [];

        for (let c = 0; c < crowdloans.length; c++) {
            let crowdloan = crowdloans[c];
            let replayChain = paraTool.getRelayChainByChainID(parseInt(crowdloan.chainID, 10))
            let paraChainID = paraTool.getChainIDFromParaIDAndRelayChain(crowdloan.paraID, replayChain)
            let paraChainName = this.getChainName(paraChainID);
            let relayChainName = this.getChainName(crowdloan.chainID);
            let relayChainAsset = this.getChainAsset(crowdloan.chainID);
            let p = await this.computePriceUSD({
                val: crowdloan.amount,
                assetChain: relayChainAsset,
                ts: crowdloan.ts
            })
            let description = `${paraChainName} Crowdloan Address/Referral (${relayChainName}) ${uiTool.presentCurrency(amountUSD)}`
            let metadata = {
                datasource: "crowdloan",
                relayChainID: crowdloan.chainID,
                relayChainName,
                paraChainName,
                paraChainID,
                amount: crowdloan.amount,
                amountUSD,
                paraID: crowdloan.paraID,
                blockNumber: crowdloan.blockNumber,
                ts: crowdloan.ts
            }
            if (p) {
                metadata.priceUSD = p.priceUSD
            }
            if (paraChainID && paraChainName && relayChainName) {
                // forward direction (fromAddress => memo)
                let related = {}
                related[crowdloan.memo] = {
                    value: JSON.stringify({
                        url: "/account/" + crowdloan.memo,
                        title: crowdloan.memo,
                        description,
                        linktype: "address",
                        metadata: metadata
                    }),
                    timestamp: crowdloan.ts * 1000000
                };
                rows.push({
                    key: crowdloan.fromAddress,
                    data: {
                        related: related
                    }
                });

                // reverse direction (memo => fromAddress)
                let related1 = {}
                related1[crowdloan.fromAddress] = {
                    value: JSON.stringify({
                        url: "/account/" + crowdloan.fromAddress,
                        title: crowdloan.fromAddress,
                        description,
                        linktype: "address",
                        metadata: metadata
                    }),
                    timestamp: crowdloan.ts * 1000000
                }
                rows.push({
                    key: crowdloan.memo,
                    data: {
                        related: related1
                    }
                })
                //console.log(`${crowdloan.fromAddress}`, related)
                if (rows.length > 500) {
                    await this.btHashes.insert(rows);
                    console.log("writeCrowdloanRelated rows=", rows.length);
                    rows = [];
                }
            }
        }
        if (rows.length > 0) {
            await this.btHashes.insert(rows);
            console.log("writeCrowdloanRelated rows=", rows.length);
            rows = [];
        }

    }


}
