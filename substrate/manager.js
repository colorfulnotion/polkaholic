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

    async mapChains(f) {
        let chains = await this.getChains();
        for (var i = 0; i < chains.length; i++) {
            let c = chains[i];
            f(c)
        }
    }

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

    async getFinalizedBlockLogDT(chainID, logDT) {
        let sql = `select blockNumber, unix_timestamp(blockDT) as blockTS, blockHash from block${chainID} where blockDT >= '${logDT} 00:00:00' and blockDT <= '${logDT} 23:59:59' and blockHash is not null order by blockDT desc limit 1`;
        console.log(sql);
        let lastRec = await this.poolREADONLY.query(sql)
        if (lastRec.length == 0) {
            return [null, null, null];
        }
        let bn = lastRec[0].blockNumber;
        let blockTS = lastRec[0].blockTS;
        let blockHash = lastRec[0].blockHash;
        return [blockHash, blockTS, bn];
    }

    canonicalizeAssetJSON(a) {
        if (a.DexShare != undefined) {
            return (JSON.stringify(a.DexShare));
        }
        if (typeof a == "string")
            return (a);
        return (JSON.stringify(a));
    }

    // pick a random chain to load yesterday for all chains
    async updateAddressBalances() {
        // pick a chain that has not been STARTED recently
        let sql = `select chainID from chain where crawling = 1 and ( ( lastUpdateAddressBalanceslogDT < date(date_sub(Now(), interval 24 hour)) or lastUpdateAddressBalancesEndDT is null ) and ( lastUpdateAddressBalancesStartDT < date_sub(Now(), interval 1 hour) or lastUpdateAddressBalancesStartDT is Null ) ) order by rand() limit 1`;
        let chains = await this.pool.query(sql);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            // TODO: since we loaded every chain from yesterday that we could, pick a chain where we load real time balances instead of loading yesterday
            return false;
        }
        let chainID = chains[0].chainID;
        await this.update_batchedSQL();
        await this.update_address_balances_logDT(chainID);
        return (true);
    }

    async update_address_balances_logDT(chainID) {
        let ts = this.getCurrentTS() - 86400;
        let [logDT, hr] = paraTool.ts_to_logDT_hr(ts)

        await this.clean_bqlogfn(chainID, logDT);
        let res0 = await this.updateNativeBalances(chainID, logDT);
        let res1 = await this.updateNonNativeBalances(chainID, logDT);
        if (res0 && res1) {
            await this.load_bqlogfn(chainID, logDT);
        }
    }

    async load_bqlogfn(chainID, logDT) {
        try {
            let relayChain = paraTool.getRelayChainByChainID(chainID)
            let paraID = paraTool.getParaIDfromChainID(chainID)
            let cmd = `bq load  --project_id=substrate-etl --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${relayChain}.balances${paraID}' /tmp/balances${chainID}-${logDT}.json schema/substrateetl/balances.json`
            console.log(cmd);
            await exec(cmd);

            // mark that we're done
            let sql_upd = `update chain set lastUpdateAddressBalancesEndDT = Now(), lastUpdateAddressBalanceslogDT = '${logDT}' where chainID = ${chainID}`;
            console.log("updateAddressBalances FIN", sql_upd);
            this.batchedSQL.push(sql_upd);
            await this.update_batchedSQL();
        } catch (err) {
            console.log(err);
            // TODO: log to log explorer
        }
    }
    async clean_bqlogfn(chainID, logDT) {
        let bqlogfn = logDT ? this.get_bqlogfn(chainID, logDT) : null;
        if (fs.existsSync(bqlogfn)) {
            fs.unlinkSync(bqlogfn);
        }
        let sql_upd = `update chain set lastUpdateAddressBalancesStartDT = Now() where chainID = ${chainID}`;
        console.log("updateAddressBalances START", sql_upd);
        this.batchedSQL.push(sql_upd);
        await this.update_batchedSQL();
    }

    get_bqlogfn(chainID, logDT) {
        return `/tmp/balances${chainID}-${logDT}.json`
    }

    async updateNonNativeBalances(chainID, logDT = null, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.pool.query(`select chainID, paraID, id, WSEndpoint, assetaddressPallet, chainName from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let chain = chains[0];
        let wsEndpoint = chain.WSEndpoint;
        let chainName = chain.chainName;
        let paraID = chain.paraID;
        let id = chain.id;
        const provider = new WsProvider(wsEndpoint);
        const api = await ApiPromise.create({
            provider
        });
        let bqlogfn = logDT ? this.get_bqlogfn(chainID, logDT) : null;
        const rawChainInfo = await api.registry.getChainProperties()
        var chainInfo = JSON.parse(rawChainInfo);
        const prefix = chainInfo.ss58Format
        let pallet = "none"
        let rows = [];
        let asset = this.getChainAsset(chainID);
        let [tblName, tblRealtime] = this.get_btTableRealtime()
        let [finalizedBlockHash, blockTS, bn] = logDT ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api)
        if (finalizedBlockHash == null) {
            console.log("Could not determine blockHash", chainID, logDT);
            // log.fatal
            return false;
        } else {
            console.log("FINALIZED HASH", finalizedBlockHash, blockTS, bn);
        }
        let bqRows = [];
        let apiAt = await api.at(finalizedBlockHash)
        let last_key = '';
        let numHolders = {}
        let numFailures = {};
        let priceUSDCache = {}; // this will map any assetChain asset to a priceUSD at blockTS, if possible
        let done = false;
        let page = 0;
        while (!done) {
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
            } else {
                console.log(`${pallet} page: `, page++);
                last_key = query[query.length - 1][0];
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
                    let asset = JSON.stringify({
                        "Token": currencyID
                    })
                    let assetChain = paraTool.makeAssetChain(asset, chainID);
                    if (this.assetInfo[assetChain] == undefined) {

                        if (numFailures[asset] == undefined) {
                            console.log("UNKNOWN ASSET", chainID, assetChain);
                            this.logger.error({

                                "op": "updateNonNativeBalances - unknown asset",
                                assetChain
                            })
                            numFailures[asset] = `assetChain undefined: ${assetChain}`;
                        }
                        continue;
                    }
                    let decimals = this.assetInfo[assetChain].decimals;
                    let symbol = this.assetInfo[assetChain].symbol;

                    let encodedAssetChain = paraTool.encodeAssetChain(assetChain)

                    let balance = 0;
                    if (decimals !== false && symbol) {
                        if (val.balance != undefined) {
                            balance = parseFloat(paraTool.toNumWithoutComma(val.balance), 10) / 10 ** decimals;
                        }
                        if (numHolders[currencyID] != undefined) {
                            numHolders[currencyID]++;
                        } else {
                            numHolders[currencyID] = 1;
                        }
                        if (logDT) {
                            if (priceUSDCache[assetChain] == undefined) {
                                let p = await this.computePriceUSD({
                                    assetChain,
                                    ts: blockTS
                                })
                                priceUSDCache[assetChain] = p && p.priceUSD ? p.priceUSD : 0;
                            }
                            let priceUSD = priceUSDCache[assetChain];
                            let free_usd = balance * priceUSD;
                            bqRows.push({
                                chain_name: chainName,
                                id,
                                para_id: paraID,
                                ts: blockTS,
                                address_pubkey: address,
                                address_ss58: account_id,
                                symbol,
                                asset,
                                free: balance,
                                reserved: 0,
                                misc_frozen: 0,
                                frozen: 0,
                                free_usd,
                                reserved_usd: 0,
                                misc_frozen_usd: 0,
                                frozen_usd: 0,
                                price_usd: priceUSD
                            });
                        } else {
                            out.push(`('${currencyID}', '${address}', '${account_id}', ${mysql.escape(asset)}, '${symbol}', '${balance}', 0, 0, 0, '${finalizedBlockHash}', Now(), '${bn}', '${blockTS}', ${mysql.escape(JSON.stringify(val))})`);
                            let rowKey = address.toLowerCase() // just in case
                            rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, balance, 0, 0, 0, blockTS, bn));
                            console.log(symbol, currencyID, `cbt read accountrealtime prefix=${rowKey}`, balance, val.balance, "decimals", decimals);
                        }

                    } else {
                        if (numFailures[asset] == undefined) {
                            let failure = `unknown decimals/symbol: ${assetChain}`;
                            console.log(failure);
                            numFailures[asset] = failure;
                        }
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

                    if ((chainID == paraTool.chainIDKico) || (chainID == paraTool.chainIDMangataX) || (chainID == paraTool.chainIDListen) || (chainID == paraTool.chainIDBasilisk) ||
                        (chainID == paraTool.chainIDComposable) || (chainID == paraTool.chainIDPicasso) ||
                        (chainID == paraTool.chainIDTuring) || (chainID == paraTool.chainIDDoraFactory) || (chainID == paraTool.chainIDHydraDX) || (chainID == 2043)) {
                        currencyID = paraTool.toNumWithoutComma(currencyID).toString();

                        asset = JSON.stringify({
                            "Token": currencyID
                        })
                    } else {

                    }

                    let state = userTokenAccountBal;
                    let assetChain = paraTool.makeAssetChain(asset, chainID);
                    if (this.assetInfo[assetChain] == undefined) {
                        if ((chainID == 2030 || chainID == 22001) && (assetChain.includes("LPToken"))) {
                            // skip this for now since there is no metadata
                        } else if (numFailures[asset] == undefined) {
                            console.log("UNKNOWN asset", asset, "assetChain=", assetChain);
                            this.logger.error({
                                "op": "updateNonNativeBalances - unknown tokens",
                                asset,
                                chainID
                            })
                            numFailures[asset] = `unknown assetInfo: ${assetChain}`;
                        }
                        continue;
                    }
                    let decimals = this.assetInfo[assetChain].decimals;
                    let symbol = this.assetInfo[assetChain] ? this.assetInfo[assetChain].symbol : null;
                    let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
                    let address = paraTool.getPubKey(account_id);
                    let free = 0;
                    let reserved = 0;
                    let miscFrozen = 0;
                    let frozen = 0;
                    if (decimals !== false && symbol) {
                        if (state.free != undefined) {
                            free = paraTool.dechexToInt(state.free.toString()) / 10 ** decimals;
                        }
                        if (state.reserved != undefined) {
                            reserved = paraTool.dechexToInt(state.reserved.toString()) / 10 ** decimals;
                        }
                        if (state.miscFrozen != undefined) {
                            miscFrozen = paraTool.dechexToInt(state.miscFrozen.toString()) / 10 ** decimals;
                        }
                        if (state.frozen != undefined) {
                            frozen = paraTool.dechexToInt(state.frozen.toString()) / 10 ** decimals;
                        }

                        if (numHolders[currencyID] != undefined) {
                            numHolders[currencyID]++;
                        } else {
                            numHolders[currencyID] = 1;
                        }

                        let rowKey = address.toLowerCase() // just in case
                        if (logDT) {
                            if (priceUSDCache[assetChain] == undefined) {
                                let p = await this.computePriceUSD({
                                    assetChain,
                                    ts: blockTS
                                })
                                priceUSDCache[assetChain] = (p && p.priceUSD > 0) ? p.priceUSD : 0;
                            }
                            let priceUSD = priceUSDCache[assetChain];
                            let free_usd = free * priceUSD;
                            let reserved_usd = reserved * priceUSD;
                            let miscFrozen_usd = miscFrozen * priceUSD;
                            let frozen_usd = frozen * priceUSD;
                            bqRows.push({
                                chain_name: chainName,
                                id,
                                para_id: paraID,
                                ts: blockTS,
                                address_pubkey: address,
                                address_ss58: account_id,
                                symbol,
                                asset,
                                free,
                                reserved,
                                misc_frozen: miscFrozen,
                                frozen,
                                free_usd,
                                reserved_usd,
                                misc_frozen_usd: miscFrozen_usd,
                                frozen_usd,
                                price_usd: priceUSD
                            });
                        } else {
                            out.push(`('${asset}', '${address}', '${account_id}', ${mysql.escape(asset)}, '${symbol}', '${free}', '${reserved}', '${miscFrozen}', '${frozen}', '${finalizedBlockHash}', Now(), '${bn}', '${blockTS}', ${mysql.escape(JSON.stringify(state))})`);
                            rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, free, reserved, miscFrozen, frozen, blockTS, bn));
                        }
                        //console.log(`CHECK ${assetChain} -- cbt read accountrealtime prefix=${rowKey}`);
                    } else {
                        if (numFailures[asset] == undefined) {
                            let failure = `symbol/decimals undefined: ${assetChain}`
                            console.log(failure);
                            numFailures[asset] = failure;
                        }
                    }
                    idx++
                    /*
                      idx=[0] k=["266LcLP1Mg523NBD58E2bBz4Ud3E2ZyZSNJjKz1G1nH3rPFh",{"LiquidCrowdloan":"13"}], v={"free":100000000000,"reserved":0,"frozen":0}
                      idx=[1] k=["223xsNEtCfmnnpcXgJMtyzaCFyNymu7mEUTRGhurKJ8jzw1i",{"Token":"DOT"}], v={"free":2522375571,"reserved":0,"frozen":0}
                    */
                }
            }
            if (query.length > 0) {} else {
                done = true;
            }


            if (logDT) {
                // write rows
                let rawRows = bqRows.map((r) => {
                    return JSON.stringify(r);
                });
                if (rawRows.length > 0) {
                    rawRows.push("");
                    await fs.appendFileSync(bqlogfn, rawRows.join("\n"));
                }
                bqRows = [];
            } else {
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
            }
            rows = [];
            if (cnt == 0) {
                done = true;
            }
        }

        if (logDT) {
            // close files

        } else {
            // for all the other accounts that did NOT appear, we can delete them if they were OLDER than bn, because they are reaped == but we still need to 0 out the balances
            let sql_reap = `select address, asset, lastUpdateBN from ${TABLE} where lastUpdateBN < ${bn}`
            let sql_delete = `delete from ${TABLE} where lastUpdateBN < ${bn}`
            console.log(`REAPING: `, sql_reap, ` DELETE: `, sql_delete);

            let reapedAccounts = await this.poolREADONLY.query(sql_reap)
            for (let a = 0; a < reapedAccounts.length; a++) {
                let address = reapedAccounts[a].address;
                let asset = reapedAccounts[a].asset;
                let assetChain = paraTool.makeAssetChain(asset, chainID);
                if (this.assetInfo[assetChain] == undefined) {
                    this.logger.fatal({
                        "op": "updateAddressBalances - unknown asset",
                        assetChain
                    })
                } else {
                    let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
                    rows.push(this.generate_btRealtimeRow(address, encodedAssetChain, 0, 0, 0, 0, blockTS, bn));
                    console.log("REAPED ACCOUNT-ADDRESS", address, encodedAssetChain);
                }
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

        }
        let sql_assetPallet = `update chain set assetaddressPallet = '${pallet}', assetNonNativeRegistered = '${Object.keys(numHolders).length}', assetNonNativeUnregistered = '${Object.keys(numFailures).length}' where chainID = '${chainID}'`
        this.batchedSQL.push(sql_assetPallet);
        await this.update_batchedSQL();
        console.log(sql_assetPallet);
        let sqld = `delete from assetfailures where chainID = ${chainID}`
        this.batchedSQL.push(sqld);
        for (const asset of Object.keys(numFailures)) {
            let failure = numFailures[asset];
            let sql = `insert into assetfailures ( asset, chainID, failure, lastUpdateDT ) values ( '${asset}', '${chainID}', ${mysql.escape(failure)}, Now() ) on duplicate key update failure = values(failure), lastUpdateDT = values(lastUpdateDT)`
            this.batchedSQL.push(sql);
            console.log("writing", asset, chainID, "rows numHolders=", cnt, sql)
        }
        await this.update_batchedSQL();
        return (true);
    }

    async updateNativeBalances(chainID, logDT = null, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.pool.query(`select chainID, id, relayChain, paraID, chainName, WSEndpoint, numHolders from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let bqlogfn = logDT ? this.get_bqlogfn(chainID, logDT) : null;
        let chain = chains[0];
        let relayChain = chain.relayChain;
        let paraID = chain.paraID;
        let chainName = chain.chainName;
        let id = chain.id;

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

        if (this.assetInfo[assetChain] == undefined) {
            this.logger.fatal({
                "op": "updateNativeBalances - unknown asset",
                assetChain
            })
            return (false);
        }
        let symbol = this.assetInfo[assetChain].symbol;
        let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
        let [tblName, tblRealtime] = this.get_btTableRealtime()
        let priceUSDCache = {}; // this will map any assetChain asset to a priceUSD at blockTS, if possible
        let decimals = this.getChainDecimal(chainID)
        let [finalizedBlockHash, blockTS, bn] = logDT ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api)
        let p = await this.computePriceUSD({
            assetChain,
            ts: blockTS
        })
        let priceUSD = p && p.priceUSD ? p.priceUSD : 0;
        let last_key = '';
        let page = 0;
        while (true) {
            let apiAt = await api.at(finalizedBlockHash)
            let query = await apiAt.query.system.account.entriesPaged({
                args: [],
                pageSize: perPagelimit,
                startKey: last_key
            })
            if (query.length == 0) {
                console.log(`Query Completed: total ${numHolders} accounts`)
                break
            } else {
                last_key = query[query.length - 1][0];
                const mu = process.memoryUsage();
                let field = "heapUsed";
                const gbNow = mu[field] / 1024 / 1024 / 1024;
                const gbRounded = Math.round(gbNow * 100) / 100;
                console.log(`system.account page: `, page++, last_key.toString(), "recs=", query.length, `Heap allocated ${gbRounded} GB`);
            }

            var cnt = 0
            let out = [];
            let vals = ["ss58Address", "free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN"];
            let replace = ["ss58Address"];
            let lastUpdateBN = ["free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN"];
            let bqRows = [];
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
                let rowKey = pubkey.toLowerCase()
                if (logDT) {
                    let free_usd = free_balance * priceUSD;
                    let reserved_usd = reserved_balance * priceUSD;
                    let miscFrozen_usd = miscFrozen_balance * priceUSD;
                    let frozen_usd = feeFrozen_balance * priceUSD; // CHECK difference between feeFrozen and frozen
                    bqRows.push({
                        chain_name: chainName,
                        id,
                        para_id: paraID,
                        address_pubkey: pubkey,
                        address_ss58: account_id,
                        asset,
                        symbol,
                        free: free_balance,
                        reserved: reserved_balance,
                        misc_frozen: miscFrozen_balance,
                        frozen: feeFrozen_balance,
                        free_usd,
                        reserved_usd,
                        misc_frozen_usd: miscFrozen_usd,
                        frozen_usd,
                        ts: blockTS,
                        price_usd: priceUSD
                    });
                } else {
                    console.log("updateNativeBalances", rowKey, `cbt read accountrealtime prefix=${rowKey}`, encodedAssetChain);
                    rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, free_balance, reserved_balance, miscFrozen_balance, feeFrozen_balance, blockTS, bn));
                }

            }
            if (logDT) {
                // write rows
                let rawRows = bqRows.map((r) => {
                    return JSON.stringify(r);
                });
                if (rawRows.length > 0) {
                    rawRows.push("");
                    await fs.appendFileSync(bqlogfn, rawRows.join("\n"));
                }
            } else {
                await this.insertBTRows(tblRealtime, rows, tblName);
            }
            rows = [];
        }
        console.log(`****** Native account: numHolders = ${numHolders}`);
        if (logDT) {} else {
            // TODO: for all the other accounts that did NOT appear, they got reaped, so 0 out the balances for good measure
            // Use BigQuery for this
            let sql_reap = `select address_pubkey, max(ts) as maxts from substrate-etl.${relayChain}.balance${paraID} group by address_pubkey having maxts < ${blockTS-86400}`
            /*
            for (let a = 0; a < reapedAccounts.length; a++) {
                let address = reapedAccounts[a].address;
                rows.push(this.generate_btRealtimeRow(address, encodedAssetChain, 0, 0, 0, 0, blockTS, bn));
                console.log("REAPED ACCOUNT", address);
            }
            console.log("writing ", rows.length, " REAPED accounts to bt");
            await this.insertBTRows(tblRealtime, rows, tblName);
            rows = [];
	    */
            let sql = `update chain set numHolders = '${numHolders}' where chainID = ${chainID}`
            console.log(numHolders, sql);
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        }
        return (true);
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
                console.log(user[0].toHuman(), user[1].toString());
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

    async clean_recent(tbl, minLogDT = '2022-06-12') {

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

    async updateAddressTopN() {
        let topNgroups = ["balanceUSD", "numChains", "numAssets", "numTransfersIn", "avgTransferInUSD", "sumTransferInUSD", "numTransfersOut", "avgTransferOutUSD", "sumTransferOutUSD", "numExtrinsics", "numExtrinsicsDefi", "numCrowdloans", "numSubAccounts", "numRewards", "rewardsUSD"]
        for (const topN of topNgroups) {
            // TODO: redo with substrateetl
        }
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
    async writeBTHashesRealtime(lookbackDays = 30, limit = 100) {
        /*        await this.write_btHashes_xcmmessage(lookbackDays);
                await this.write_btHashes_symbol(limit);
                await this.write_btHashes_chain(limit);
                await this.write_btHashes_currencyID(limit); */
        await this.write_btHashes_wasmcode(lookbackDays);
        await this.write_btRealtime_wasmcontract(lookbackDays);
        await this.write_btRealtime_evmcontract(lookbackDays);
    }

    async updateEVMPrecompiles(network) {
        let network_precompiles = {
            // https://docs.moonbeam.network/builders/pallets-precompiles/precompiles/
            moonbeam: {
                chainIDs: {
                    2004: '{"Token":"GLMR"}',
                    22023: '{"Token":"MOVR"}',
                    61000: '{"Token":"AlphaDev"}',
                    60888: '{"Token":"BetaDev"}'
                },
                precompiles: {
                    "0x0000000000000000000000000000000000000809": "Randomness",
                    "0x0000000000000000000000000000000000000800": "StakingInterface",
                    "0x000000000000000000000000000000000000080d": "XCMTransactorV2",
                    "0x0000000000000000000000000000000000000804": "XTokens",
                    "0x0000000000000000000000000000000000000808": "Batch",
                    "0x000000000000000000000000000000000000080a": "CallPermit",
                    "0x000000000000000000000000000000000000080e": ["Collective", "Council"],
                    "0x000000000000000000000000000000000000080f": ["Collective", "Technical commitee"],
                    "0x000000000000000000000000000000000000080f": ["Collective", "Treasury council"],
                    "0x0000000000000000000000000000000000000803": "Democracy",
                    "0x0000000000000000000000000000000000000802": "ERC20",
                    "0x000000000000000000000000000000000000080b": "Proxy"
                },

            },
            // https://docs.astar.network/docs/EVM/precompiles/
            astar: {
                chainIDs: {
                    2006: '{"Token":"ASTR"}',
                    22007: '{"Token":"SDN"}'
                },
                precompiles: {
                    "0x0000000000000000000000000000000000005001": "DappsStaking",
                    "0x0000000000000000000000000000000000005002": "SR25519",
                    //"" => "ERC20",  // https://github.com/AstarNetwork/astar-frame/blob/polkadot-v0.9.29/precompiles/assets-erc20/ERC20.sol
                    //"" => "SubstrateECDSA", // https://github.com/AstarNetwork/astar-frame/blob/polkadot-v0.9.29/precompiles/substrate-ecdsa/SubstrateEcdsa.sol
                    "0x0000000000000000000000000000000000005004": "XCM", // assets_withdraw https://github.com/AstarNetwork/astar-frame/blob/polkadot-v0.9.29/precompiles/xcm/XCM.sol

                }
            },
            // common to above networks, probably all
            generic: {
                networks: ["moonbeam", "astar"],
                precompiles: {
                    "0x0000000000000000000000000000000000000001": "ECRecover",
                    "0x0000000000000000000000000000000000000002": "Sha256",
                    "0x0000000000000000000000000000000000000003": "Ripemd160",
                    "0x0000000000000000000000000000000000000004": "Identity",
                    "0x0000000000000000000000000000000000000005": "Modexp",
                    "0x0000000000000000000000000000000000000006": "Bn128Add",
                    "0x0000000000000000000000000000000000000007": "Bn128Mul",
                    "0x0000000000000000000000000000000000000008": "Bn128Pairing"
                }
            }
        }

        let chainIDs = network_precompiles[network].chainIDs;
        let precompiles = network_precompiles[network].precompiles;
        // TODO: add generic precompiles
        let out = [];
        for (const [chainID, nativeAsset] of Object.entries(chainIDs)) {
            for (const [asset, name] of Object.entries(precompiles)) {
                let fn = null;
                let assetName = null;
                if (typeof name == "string") {
                    assetName = `${name} System Contract`;
                    fn = name;
                } else if (Array.isArray(name)) {
                    fn = name[0];
                    assetName = `${name[1]} System Contract`;
                }
                if (fn && assetName) {
                    let fullfn = path.join("precompiles", network, `${fn}.json`)
                    if (fs.existsSync(fullfn)) {
                        let abi = await fs.readFileSync(fullfn, "utf8");
                        if (name == "ERC20") {
                            let nsql = `update asset set abiRaw = ${mysql.escape(abi)} where asset = '${nativeAsset}' and chainID = '${chainID}'`
                            this.batchedSQL.push(nsql);
                        }
                        out.push(`('${asset}', '${chainID}', 'Contract', ${mysql.escape(assetName)}, ${mysql.escape(abi)})`)
                    } else {
                        console.log("not found", fullfn)
                    }
                }
            }
        }
        await this.update_batchedSQL();
        let vals = ["assetType", "assetName", "abiRaw"];
        await this.upsertSQL({
            "table": `asset`,
            "keys": ["asset", "chainID"],
            "vals": vals,
            "data": out,
            "replace": vals,
        });
    }

}
