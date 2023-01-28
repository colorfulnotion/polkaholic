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

module.exports = class SubstrateETL extends AssetManager {
    project = "substrate-etl";
    constructor() {
        super("manager")
    }

    irregularFeeUSDThreshold = 5 //consider feeUSD above this threshold "Irregular" -  historically feeUSD should be lower than the ED

    // all bigquery tables are date-partitioned except 2 for now: chains and specversions
    partitioned_table(tbl) {
        switch (tbl) {
            case "chains":
            case "specversions":
                return (false);
                break;
        }
        return (true);
    }

    // sets up system tables (independent of paraID) and paraID specific tables
    async setup_tables(relayChain, chainID = null) {
        // setup "system" tables across all paraIDs
        let systemtbls = ["xcmtransfers", "chains"];
        for (const tbl of systemtbls) {
            let p = (this.partitioned_table(tbl)) ? "--time_partitioning_field block_time --time_partitioning_type DAY" : "";
            let cmd = `bq mk  --project_id=substrate-etl  --schema=schema/substrateetl/${tbl}.json ${p} --table ${relayChain}.${tbl}`
            try {
                console.log(cmd);
                //await exec(cmd);
            } catch (e) {
                // TODO optimization: do not create twice
            }
        }

        // setup paraID specific tables, including paraID=0 for the relay chain
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs", "balances", "specversions"]
        let p = (chainID) ? ` and chainID = ${chainID} ` : ""
        let sql = `select chainID from chain where relayChain in ('polkadot', 'kusama') ${p} order by chainID`
        let recs = await this.poolREADONLY.query(sql);
        for (const rec of recs) {
            let chainID = parseInt(rec.chainID, 10);
            let paraID = paraTool.getParaIDfromChainID(chainID);
            let relayChain = paraTool.getRelayChainByChainID(chainID);
            //console.log(" --- ", chainID, paraID, relayChain);
            for (const tbl of tbls) {
                let fld = tbl == "balances" ? "ts" : "block_time";
                let p = (this.partitioned_table(tbl)) ? `--time_partitioning_field ${fld} --time_partitioning_type DAY` : "";
                let cmd = `bq mk  --project_id=substrate-etl  --schema=schema/substrateetl/${tbl}.json ${p} --table ${relayChain}.${tbl}${paraID}`

                try {
                    console.log(cmd);
                    await exec(cmd);
                } catch (e) {
                    console.log(e);
                    // TODO optimization: do not create twice
                }
            }
        }
    }

    async get_random_substrateetl(logDT = null, paraID = -1, relayChain = null) {
        //let sql0 = `insert into blocklog ( logDT, chainID, loaded ) (select distinct logDT, chainID, 0 as loaded from indexlog where logDT >= date_sub(Now(), interval 3 day) and chainID < 40000 and chainID not in ( 22110 ) and indexed = 1 and readyForIndexing = 1) on duplicate key update chainID = values(chainID)`
        //this.batchedSQL.push(sql0);
        //await this.update_batchedSQL();

        let w = "";
        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w = ` and chainID = ${chainID}`
        } else {
            w = " and chainID in ( select chainID from chain where crawling = 1 )"
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from blocklog where chainID not in ( 22110, 22100 )  and loaded = 0 and logDT <= date(date_sub(Now(), interval 1 day)) ${w} order by attempted, logDT desc, rand() limit 1`
        console.log("get_random_substrateetl", sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ([null, null]);
        let {
            indexTS,
            chainID
        } = recs[0];
        let hr = 0;
        [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        paraID = paraTool.getParaIDfromChainID(chainID);
        relayChain = paraTool.getRelayChainByChainID(chainID);
        console.log("CHAIN", chainID, logDT, "paraID", paraID, "relayChain", relayChain);
        let sql0 = `update blocklog set attempted = attempted + 1 where chainID = '${chainID}' and logDT = '${logDT}'`
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL();
        return {
            logDT,
            paraID,
            relayChain
        };
    }

    async audit_random_substrateetl() {
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from blocklog where loaded = 1 and audited = 'Unknown' and logDT < date_sub(Now(), interval 1 day) order by rand() limit 100`
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ([null, null]);
        for (const r of recs) {
            let {
                indexTS,
                chainID
            } = r;
            let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
            let paraID = paraTool.getParaIDfromChainID(chainID);
            let relayChain = paraTool.getRelayChainByChainID(chainID);
            await this.audit_substrateetl(logDT, paraID, relayChain);
        }
    }


    async execute_bqJob(sqlQuery, fn = false) {
        // run bigquery job with suitable credentials
        const bigqueryClient = new BigQuery();
        const options = {
            query: sqlQuery,
            location: 'us-central1',
        };

        try {
            let f = fn ? await fs.openSync(fn, "w", 0o666) : false;
            const response = await bigqueryClient.createQueryJob(options);
            const job = response[0];
            const [rows] = await job.getQueryResults();
            return rows;
        } catch (err) {
            console.log(err);
            throw new Error(`An error has occurred.`);
        }
        return [];
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

        let res0 = await this.updateNativeBalances(chainID, logDT);
        if (res0 == false) {
            return (false);
        }
        let res1 = await this.updateNonNativeBalances(chainID, logDT);
        if (res1) {
            await this.load_bqlogfn(chainID, logDT);
        }
        return (true);
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
        let chains = await this.pool.query(`select chainID, id, relayChain, paraID, chainName, WSEndpoint, numHolders, lastUpdateAddressBalancesLastKey, unix_timestamp(Now()) - unix_timestamp(lastUpdateAddressBalancesStartDT) secondsago from chain where chainID = ${chainID}`);
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
        let last_key = (chain.lastUpdateAddressBalancesLastKey.length > 0 && chain.secondsago < 7200) ? chain.lastUpdateAddressBalancesLastKey : "";
        if (last_key == "") {
            await this.clean_bqlogfn(chainID, logDT);
            console.log("STARTING CLEAN");
        } else {
            console.log("RESUMING with last_key", last_key)
        }
        let page = 0;
        let done = false;
        while (!done) {
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
                console.log(`Query Completed: total ${numHolders} accounts`)
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
            last_key = (query.length > 999) ? query[query.length - 1][0] : "";
            const mu = process.memoryUsage();
            let field = "heapUsed";
            const gbNow = mu[field] / 1024 / 1024 / 1024;
            const gbRounded = Math.round(gbNow * 100) / 100;
            console.log(`system.account page: `, page++, last_key.toString(), "recs=", query.length, `Heap allocated ${gbRounded} GB`, query.length);
            // save last_key state in db and get out -- we will pick it up again

            let sql = `update chain set lastUpdateAddressBalancesLastKey = '${last_key.toString()}'  where chainID = ${chainID}`
            console.log(sql);
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
            if (last_key == "") done = true;
            if (gbRounded > 2) {
                console.log(`RETURNING with last key stored:`, last_key.toString());
                return (false);
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
        }
        let sql = `update chain set numHolders = '${numHolders}', lastUpdateAddressBalancesLastKey = '' where chainID = ${chainID}`
        console.log(numHolders, sql);
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
        return (true);
    }

    async audit_substrateetl(logDT = null, paraID = -1, relayChain = null) {
        let w = [];

        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w.push(`chainID = ${chainID}`)
            if (logDT) {
                w.push(`logDT = '${logDT}'`)
            }
        } else {
            w.push(`audited in ('Unknown')`);
        }
        let wstr = w.join(' and ');

        let audit_traces = (this.daysago(logDT) < 31);

        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from blocklog where ${wstr} order by rand() limit 1`
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ([null, null]);
        let {
            indexTS,
            chainID
        } = recs[0];
        let hr = 0;
        [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        paraID = paraTool.getParaIDfromChainID(chainID);
        relayChain = paraTool.getRelayChainByChainID(chainID);
        console.log(logDT, paraID, relayChain);
        let errors = [];
        let startDT = `${logDT} 00:00:00`
        let endDT = `${logDT} 23:59:59`
        let rangeRecs = await this.poolREADONLY.query(`select min(blockNumber) bn0, max(blockNumber) bn1, max(blockNumber)-min(blockNumber)+1 as cnt, count(*) nrecs from block${chainID} where blockDT >= '${startDT}' and blockDT <= '${endDT}'`);
        let cnt = 0,
            nrecs = 0;
        let bn0 = 0,
            bn1 = 0;
        if (rangeRecs.length == 1) {
            let r = rangeRecs[0];
            cnt = r.cnt;
            nrecs = r.nrecs;
            bn0 = r.bn0;
            bn1 = r.bn1;
            let audited = "Success";
            if (cnt != nrecs) {
                errors.push(`source record count incorrect: Expected ${cnt} (${bn1}-${bn0}+1)> ${nrecs}`);
            } else {
                let tbls = ["blocks", "extrinsics", "events"];
                for (const tbl of tbls) {
                    let bsql = `SELECT distinct block_number, block_time FROM \`substrate-etl.${relayChain}.${tbl}${paraID}\` where date(block_time) = '${logDT}' order by block_number`;
                    let fld = "block_number";
                    if (tbl == "blocks") {
                        bsql = `SELECT distinct number, block_time FROM \`substrate-etl.${relayChain}.${tbl}${paraID}\` where date(block_time) = '${logDT}' order by number`;
                        fld = "number";
                    }
                    console.log(bsql, `Expecting range ${bn0} through ${bn1} with ${nrecs}`)
                    let found = {}
                    let rows = await this.execute_bqJob(bsql);
                    for (let bn = bn0; bn <= bn1; bn++) {
                        found[bn] = false;
                    }
                    rows.forEach((r) => {
                        let bn = r[fld]
                        found[bn] = true;
                    });
                    let missing = [];
                    let nmissing = 0;
                    for (let bn = bn0; bn <= bn1; bn++) {
                        if (found[bn] == false) {
                            nmissing++;
                            missing.push(bn);
                        }
                    }
                    if (nmissing > 0) {
                        let out = {}
                        out[tbl] = nmissing;
                        if (nmissing < 30) {
                            out[tbl + "_missing"] = missing;
                        } else {
                            let s0 = missing.slice(0, 5);
                            let s1 = missing.slice(nmissing - 5, nmissing);
                            out[tbl + "_missing_sample"] = s0.concat(s1);
                        }
                        let sql_fix = `update block${chainID} set crawlBlock = 1 where blockNumber in (${missing.join(",")}) and attempted < 127`
                        console.log(sql_fix);
                        this.batchedSQL.push(sql_fix);

                        errors.push(out);
                        audited = "Failed";
                        console.log(out);
                    }
                }
            }
            if (errors.length > 0) {
                let outsql = `update blocklog set auditDT = Now(), audited = '${audited}', auditResult = '${JSON.stringify(errors)}' where chainID='${chainID}' and logDT = '${logDT}'`
                console.log(outsql);
                this.batchedSQL.push(outsql);
                await this.update_batchedSQL();
            } else {
                let outsql = `update blocklog set auditDT = Now(), audited = '${audited}', auditResult = '' where chainID='${chainID}' and logDT = '${logDT}'`
                this.batchedSQL.push(outsql);
                console.log(outsql);
                await this.update_batchedSQL();
            }
        }
    }

    async dump_xcmtransfers_range(relayChain = "polkadot", range_days_ago = 2) {
        let currTS = this.getCurrentTS();
        range_days_ago = (relayChain == "kusama") ? 577 : 270;
        //range_days_ago = 1;
        for (let daysago = 365; daysago < range_days_ago; daysago++) {
            let ts = currTS - 86400 * daysago;
            let [logDT, _] = paraTool.ts_to_logDT_hr(ts);
            await this.dump_xcmtransfers(logDT, relayChain);
        }
    }

    async dump_chains(relayChain = "polkadot") {
        let sql = `select id, chainName, paraID, symbol, ss58Format from chain where crawling = 1 and relayChain = '${relayChain}' order by paraID`
        let chainsRecs = await this.poolREADONLY.query(sql)
        let tbl = "chains";
        // 2. setup directories for tbls on date
        let dir = "/tmp";
        let fn = path.join(dir, `${tbl}.json`)
        let f = fs.openSync(fn, 'w', 0o666);
        let bqDataset = relayChain
        // 3. do tablescan for bnStart to bnEnd
        let chains = chainsRecs.map((c) => {
            return {
                para_id: c.paraID,
                id: c.id,
                chain_name: c.chainName,
                symbol: c.symbol,
                ss58_prefix: c.ss58Format
            }
        });
        let NL = "\r\n";

        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs", "specversions"];
        console.log("|chain|blocks|extrinsics|events|transfers|logs|specversions");
        console.log("|-----|------|----------|------|---------|----|------------");
        chains.forEach((c) => {
            fs.writeSync(f, JSON.stringify(c) + NL);
            let sa = [];
            sa.push(`${c.para_id} - ${c.id}|`)
            for (const tbl of tbls) {
                let fulltbl = `${project}:${relayChain}.${tbl}${c.para_id}`;
                sa.push(`${fulltbl}|`)
            }
            console.log(sa.join(""));
        });
        let cmd = `bq load  --project_id=${this.project} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}' ${fn} schema/substrateetl/${tbl}.json`;
        console.log(cmd);
        await exec(cmd);
    }

    async dump_xcmtransfers(logDT = "2022-12-29", relayChain = "polkadot") {

        // incomplete = 1: failed on origination chain
        // incomplete = 0: msgSent!
        //   destStatus = 1 : success
        //   destStatus = 0 : error
        //   destStatus = -1 : failed
        let sql = `select extrinsicHash, extrinsicID, transferIndex, xcmIndex, paraID, paraIDDest, sourceTS, CONVERT(xcmInfo using utf8) as xcmInfo, priceUSD, amountSentUSD, amountReceivedUSD, symbol, UNIX_TIMESTAMP(xcmInfolastUpdateDT) as lastUpdateTS, destStatus, isFeeItem from xcmtransfer where sourceTS >= UNIX_TIMESTAMP(DATE("${logDT}")) and sourceTS < UNIX_TIMESTAMP(DATE_ADD("${logDT}", INTERVAL 1 DAY)) and relayChain = '${relayChain}' and incomplete = 0 and destStatus in (1, -1) and xcmInfo is not null and symbol is not null order by sourceTS;`
        let xcmtransferRecs = await this.poolREADONLY.query(sql)
        let tbl = "xcmtransfers";
        // 2. setup directories for tbls on date
        let dir = "/tmp";
        let fn = path.join(dir, `${tbl}.json`)
        let f = fs.openSync(fn, 'w', 0o666);
        let bqDataset = relayChain
        let logDTp = logDT.replaceAll("-", "")
        let xcmtransfers = [];
        // 3. map into canonical form
        xcmtransferRecs.forEach((r) => {

            try {
                let xcmInfo = JSON.parse(r.xcmInfo)
                let o = xcmInfo.origination;
                let d = xcmInfo.destination;
                if (o && d) {
                    let destination_execution_status = (r.destStatus == 1 || (d.executionStatus == "success" || d.amountReceived > 0)) ? "success" : "unknown";
                    xcmtransfers.push({
                        symbol: r.symbol,
                        price_usd: r.priceUSD,
                        origination_transfer_index: r.transferIndex,
                        origination_xcm_index: r.xcmIndex,
                        origination_id: o.id,
                        origination_para_id: o.paraID,
                        origination_chain_name: o.chainName,
                        origination_sender_ss58: o.sender,
                        origination_sender_pub_key: o.sender,
                        origination_extrinsic_hash: o.extrinsicHash,
                        origination_extrinsic_id: o.extrinsicID,
                        origination_transaction_hash: o.transactionHash ? o.transactionHash : null,
                        origination_msg_hash: o.msgHash ? o.msgHash : null,
                        origination_is_msg_sent: o.isMsgSent ? true : false,
                        origination_block_number: o.blockNumber,
                        origination_section: o.section,
                        origination_method: o.method,
                        origination_tx_fee: o.txFee ? o.txFee : 0,
                        origination_tx_fee_usd: o.txFeeUSD ? o.txFeeUSD : 0,
                        origination_tx_fee_symbol: r.symbol,
                        origination_is_fee_item: r.isFeeItem ? true : false,
                        origination_sent_at: o.sentAt,
                        origination_extrinsic_hash: o.extrinsicHash,
                        origination_extrinsic_id: o.extrinsicID,
                        origination_amount_sent: o.amountSent,
                        origination_amount_sent_usd: o.amountSentUSD,
                        origination_ts: o.ts,
                        destination_id: d.id,
                        destination_para_id: d.paraID,
                        destination_amount_received: d.amountReceived,
                        destination_amount_received_usd: d.amountReceivedUSD,
                        destination_teleport_fee: d.teleportFee,
                        destination_teleport_fee_usd: d.teleportFeeUSD,
                        destination_teleport_fee_symbol: r.symbol, // TODO
                        destination_chain_name: d.chainName,
                        destination_beneficiary_ss58: d.beneficiary,
                        destination_beneficiary_pub_key: paraTool.getPubKey(d.beneficiary),
                        destination_extrinsic_id: d.extrinsicID,
                        destination_event_id: d.eventID,
                        destination_block_number: d.blockNumber,
                        destination_ts: d.ts,
                        destination_execution_status: destination_execution_status,
                        xcm_info: xcmInfo,
                        xcm_info_last_update_time: r.lastUpdateTS
                    });
                }

            } catch (e) {
                console.log(e)
            }
        });
        let NL = "\r\n";
        xcmtransfers.forEach((e) => {
            fs.writeSync(f, JSON.stringify(e) + NL);
        });
        // 4. load into bq
        let cmd = `bq load --project_id=${this.project} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}$${logDTp}' ${fn} schema/substrateetl/${tbl}.json`;
        console.log(cmd);
        await exec(cmd);
    }

    daysago(logDT) {
        let indexTS = paraTool.logDT_hr_to_ts(logDT, 0);
        let currentTS = this.getCurrentTS();
        let daysago = Math.floor((currentTS - indexTS) / 86400)
        return (daysago);
    }

    async dump_substrateetl(logDT = "2022-12-29", paraID = 2000, relayChain = "polkadot") {
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs"] // TODO: put  "specversions" back

        // 1. get bnStart, bnEnd for logDT
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let minLogDT = `${logDT} 00:00:00`;
        let maxLogDT = `${logDT} 23:59:59`;
        let sql1 = `select min(blockNumber) bnStart, max(blockNumber) bnEnd from block${chainID} where blockDT >= '${minLogDT}' and blockDT <= '${maxLogDT}'`
        let bnRanges = await this.poolREADONLY.query(sql1)
        console.log(bnRanges, sql1);
        let {
            bnStart,
            bnEnd
        } = bnRanges[0];
        // 2. setup directories for tbls on date
        let dir = "/tmp";
        let fn = {}
        let f = {}
        for (const tbl of tbls) {
            fn[tbl] = path.join(dir, `${tbl}${paraID}.json`)
            console.log("openSync", fn[tbl]);
            f[tbl] = fs.openSync(fn[tbl], 'w', 0o666);
        }
        let bqDataset = relayChain

        // 3. setup specversions
        const tableChain = this.getTableChain(chainID);
        let specversions = [];
        var specVersionRecs = await this.poolREADONLY.query(`select specVersion, blockNumber, blockHash, UNIX_TIMESTAMP(firstSeenDT) blockTS, CONVERT(metadata using utf8) as spec from specVersions where chainID = '${chainID}' and blockNumber > 0 order by blockNumber`);
        this.specVersions[chainID.toString()] = [];
        for (const specVersion of specVersionRecs) {
            this.specVersions[chainID].push(specVersion);
            specversions.push({
                spec_version: specVersion.specVersion,
                block_number: specVersion.blockNumber,
                block_hash: specVersion.blockHash,
                block_time: specVersion.blockTS,
                spec: specVersion.spec
            });
        }

        // 4. do table scan 50 blocks at a time
        let NL = "\r\n";
        let jmp = 50;
        let block_count = 0;
        for (let bn0 = bnStart; bn0 <= bnEnd; bn0 += jmp) {
            let bn1 = bn0 + jmp - 1;
            if (bn1 > bnEnd) bn1 = bnEnd;
            let start = paraTool.blockNumberToHex(bn0);
            let end = paraTool.blockNumberToHex(bn1);
            let [rows] = await tableChain.getRows({
                start: start,
                end: end
            });
            for (const row of rows) {
                let r = this.build_block_from_row(row);
                let b = r.feed;
                let hdr = b.header;
                if (!hdr || hdr.number == undefined) {
                    let bn = parseInt(row.id.substr(2), 16);
                    let sql0 = `update block${chainID} set crawlBlock = 1 where blockNumber = ${bn} and attempted < 127`
                    console.log("ERROR: MISSING hdr", row.id, sql0);
                    this.batchedSQL.push(sql0);
                    await this.update_batchedSQL()
                    continue;
                }
                let [logDT0, hr] = paraTool.ts_to_logDT_hr(b.blockTS);
                if (logDT != logDT0) {
                    console.log("ERROR: mismatch ", b.blockTS, logDT0, " does not match ", logDT);
                    continue;
                }

                let spec_version = this.getSpecVersionForBlockNumber(chainID, hdr.number);

                // map the above into the arrays below
                let block = {
                    hash: b.hash,
                    parent_hash: hdr.parentHash,
                    number: hdr.number,
                    state_root: hdr.stateRoot,
                    extrinsics_root: hdr.extrinsicsRoot,
                    block_time: b.blockTS,
                    author_ss58: b.author,
                    author_pub_key: paraTool.getPubKey(b.author),
                    spec_version: spec_version,
                    relay_block_number: b.relayBN,
                    relay_state_root: b.relayStateRoot,
                    extrinsic_count: b.extrinsics.length,
                    event_count: 0,
                    transfer_count: 0,
                    trace_count: 0
                };
                let transfers = [];
                let events = [];
                let extrinsics = b.extrinsics.map((ext) => {
                    ext.events.forEach((e) => {
                        events.push({
                            event_id: e.eventID,
                            extrinsic_hash: ext.extrinsicHash,
                            extrinsic_id: ext.extrinsicID,
                            block_number: block.number,
                            block_time: block.block_time,
                            block_hash: block.hash,
                            section: e.section,
                            method: e.method,
                            data: e.data
                        });
                        block.event_count++;
                    });
                    if (ext.transfers) {
                        ext.transfers.forEach((t) => {
                            transfers.push({
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
                            });
                        });
                        block.transfer_count++;
                    }
                    return {
                        hash: ext.extrinsicHash,
                        extrinsic_id: ext.extrinsicID,
                        block_time: block.block_time,
                        block_number: block.number,
                        block_hash: block.hash,
                        lifetime: ext.lifetime,
                        section: ext.section,
                        method: ext.method,
                        params: ext.params,
                        fee: ext.fee,
                        weight: null, // TODO: ext.weight,
                        signed: ext.signer ? true : false,
                        signer_ss58: ext.signer ? ext.signer : null,
                        signer_pub_key: ext.signer ? paraTool.getPubKey(ext.signer) : null
                    }
                });
                let log_count = 0;
                let logs = hdr.digest.logs.map((l) => {
                    let logID = `${block.number}-${log_count}`
                    log_count++;
                    return {
                        log_id: logID,
                        block_time: block.block_time,
                        block_number: block.number,
                        block_hash: block.hash,
                        log: l
                    }
                });;
                let trace = r.autotrace;
                let traces = [];
                // write block
                fs.writeSync(f["blocks"], JSON.stringify(block) + NL);
                block_count++;
                // write events
                if (block.event_count > 0) {
                    events.forEach((e) => {
                        fs.writeSync(f["events"], JSON.stringify(e) + NL);
                    });
                }
                // write extrinsics
                if (block.extrinsic_count > 0) {
                    extrinsics.forEach((e) => {
                        fs.writeSync(f["extrinsics"], JSON.stringify(e) + NL);
                    });
                }
                // write transfers
                if (block.transfer_count > 0) {
                    transfers.forEach((t) => {
                        fs.writeSync(f["transfers"], JSON.stringify(t) + NL);
                    });
                }

                if (log_count > 0) {
                    logs.forEach((t) => {
                        fs.writeSync(f["logs"], JSON.stringify(t) + NL);
                    });
                }
            }
        }
        // optimization: don't load every day, only on days where there is an actually new specversion
        if (specversions && f["specversions"]) {
            specversions.forEach((s) => {
                fs.writeSync(f["specversions"], JSON.stringify(s) + NL);
            })
        }

        // 5. write to bq
        try {
            for (const tbl of tbls) {
                fs.closeSync(f[tbl]);
                let logDTp = logDT.replaceAll("-", "")
                let cmd = `bq load  --project_id=${this.project} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}$${logDTp}' ${fn[tbl]} schema/substrateetl/${tbl}.json`;
                if (tbl == "specversions") {
                    cmd = `bq load  --project_id=${this.project} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}' ${fn[tbl]} schema/substrateetl/${tbl}.json`;
                }
                console.log(cmd);
                await exec(cmd);
            }
            let sql = `insert into blocklog (logDT, chainID, startBN, endBN, numBlocks, loadDT, loaded,  audited) values ('${logDT}', '${chainID}', '${bnStart}', '${bnEnd}', '${block_count}', Now(), 1, 'Unknown') on duplicate key update loadDT = values(loadDT), startBN = values(startBN), endBN = values(endBN), numBlocks = values(numBlocks), loaded = values(loaded), audited = values(audited)`
            console.log(sql);
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();


        } catch (e) {
            console.log(e);
        }
        try {
            await this.update_blocklog(chainID, logDT);
        } catch (e) {
            console.log(e)
        }
    }

    async update_blocklog(chainID, logDT) {
        let project = this.project;
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let sqla = {
            "extrinsics": `select count(*) as numExtrinsics, sum(if(signed, 1, 0)) as numSignedExtrinsics from ${project}.${relayChain}.extrinsics${paraID} where date(block_time) = '${logDT}'`,
            "accountsactive": `select  count(signer_pub_key) as numAccountsActive from ${project}.${relayChain}.extrinsics${paraID} where signed and date(block_time) = '${logDT}'`,
            "events": `select count(*) as numEvents from substrate-etl.${relayChain}.events${paraID} where date(block_time) = '${logDT}'`,
            "transfers": `select count(*) as numTransfers, count(distinct from_pub_key) numAccountsTransfersOut, count(distinct to_pub_key) numAccountsTransfersIn, sum(if(amount_usd is null, 0, amount_usd)) valueTransfersUSD from substrate-etl.${relayChain}.transfers${paraID} where date(block_time) = '${logDT}'`,
            //"balances":  `select count(distinct address_pubkey) as numAddresses from substrate-etl.${relayChain}.balances${paraID} where date(ts) = '${logDT}'`,
            "xcmtransfers0": `select count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from substrate-etl.${relayChain}.xcmtransfers where destination_para_id = ${paraID} and date(origination_ts) = '${logDT}'`,
            "xcmtransfers1": `select count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from substrate-etl.${relayChain}.xcmtransfers where origination_para_id = ${paraID} and date(origination_ts) = '${logDT}'`
        };
        console.log(sqla);
        let r = {}
        let vals = [];
        for (const k of Object.keys(sqla)) {
            let sql = sqla[k];
            let rows = await this.execute_bqJob(sql);
            let row = rows.length > 0 ? rows[0] : null;
            if (row) {
                for (const a of Object.keys(row)) {
                    r[a] = row[a] ? row[a] : 0;
                    vals.push(` ${a} = '${row[a]}'`);
                }
            }
        }
        let sql = `update blocklog set ` + vals.join(",") + `  where chainID = '${chainID}' and logDT = '${logDT}'`
        console.log(sql)
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async updateBlocklogBulk(chainID) {
        let project = this.project;
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let sqla = {
            "extrinsics": `select date(block_time) logDT, count(*) as numExtrinsics, sum(if(signed, 1, 0)) as numSignedExtrinsics from ${project}.${relayChain}.extrinsics${paraID} group by logDT`,
            "accountsactive": `select date(block_time) logDT, count(signer_pub_key) as numAccountsActive from ${project}.${relayChain}.extrinsics${paraID} where signed`,
            "events": `select date(block_time) logDT, count(*) as numEvents from substrate-etl.${relayChain}.events${paraID} group by logDT`,
            "transfers": `select  date(block_time) logDT, count(*) as numTransfers, count(distinct from_pub_key) numAccountsTransfersOut, count(distinct to_pub_key) numAccountsTransfersIn, sum(if(amount_usd is null, 0, amount_usd)) valueTransfersUSD from substrate-etl.${relayChain}.transfers${paraID} group by logDT`,
            "balances": `select count(distinct address_pubkey) as numAddresses from substrate-etl.${relayChain}.balances${paraID} where date(ts) = '${logDT}'`,
            "xcmtransfers0": `select  date(origination_ts) logDT, count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from substrate-etl.${relayChain}.xcmtransfers where destination_para_id = ${paraID} group by logDT`,
            "xcmtransfers1": `select date(origination_ts) as logDT, count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from substrate-etl.${relayChain}.xcmtransfers where origination_para_id = ${paraID} group by logDT`
        };
        console.log(sqla);
        let r = {}
        for (const k of Object.keys(sqla)) {
            let sql = sqla[k];
            let rows = await this.execute_bqJob(sql);
            let row = rows.length > 0 ? rows[0] : null;
            if (row) {
                let vals = [];
                let logDT = null;
                for (const a of Object.keys(row)) {
                    if (a != 'logDT') {
                        r[a] = row[a] ? row[a] : 0;
                        vals.push(` ${a} = '${row[a]}'`);
                    } else {
                        logDT = row[a];
                    }
                }
                let sql = `update blocklog set ` + vals.join(",") + `  where chainID = '${chainID}' and logDT = '${logDT}'`
                console.log(sql);
            }
        }
        console.log(sql)
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async updateChainSummary() {
        var ranges = [7, 30, 99999];
        for (const range of ranges) {
            let f = (range > 9999) ? "" : `${range}d`;
            let sql0 = `select sum(numTraces) as numTraces, sum(numExtrinsics) as numExtrinsics, sum(numEvents) as numEvents, sum(numTransfers) as numTransfers, sum(numSignedExtrinsics) as numSignedExtrinsics, sum(valueTransfersUSD) as valueTransfersUSD, sum(numTransactionsEVM) as numTransactionsEVM, sum(numReceiptsEVM) as numReceiptsEVM, sum(gasUsed) as gasUsed, sum(gasLimit) as gasLimit, sum(numEVMBlocks) as numEVMBlocks, avg(numAccountsActive) as numAccountsActive, sum(numXCMTransfersIn) as numXCMTransferIncoming, sum(valXCMTransferIncomingUSD) as valXCMTransferIncomingUSD, sum(numXCMTransfersOut) as numXCMTransferOutgoing, sum(valXCMTransferOutgoingUSD) as valXCMTransferOutgoingUSD from blocklog where logDT >= date_sub(Now(),interval ${range} DAY) and chainID = ${chain.chainID}`
            let stats = await this.poolREADONLY.query(sql0)
            let out = [];
            for (const s of stats) {
                let numXCMTransferIncoming = s.numXCMTransferIncoming ? s.numXCMTransferIncoming : 0;
                let numXCMTransferOutgoing = s.numXCMTransferOutgoing ? s.numXCMTransferOutgoing : 0;
                let valIncoming = s.valXCMTransferIncomingUSD ? s.valXCMTransferIncomingUSD : 0;
                let valOutgoing = s.valXCMTransferOutgoingUSD ? s.valXCMTransferOutgoingUSD : 0;
                out.push([`('${chain.chainID}', ${s.numTraces}, ${s.numExtrinsics}, ${s.numEvents}, ${s.numTransfers}, ${s.numSignedExtrinsics}, ${s.valueTransfersUSD}, ${s.numTransactionsEVM}, ${s.numReceiptsEVM}, ${s.gasUsed}, ${s.gasLimit}, ${s.numEVMBlocks}, ${s.numAccountsActive}, '${numXCMTransferIncoming}', '${valIncoming}', '${numXCMTransferOutgoing}', '${valOutgoing}')`])
            }
            let vals = [`numTraces${f}`, `numExtrinsics${f}`, `numEvents${f}`, `numTransfers${f}`, `numSignedExtrinsics${f}`, `valueTransfersUSD${f}`, `numTransactionsEVM${f}`, `numReceiptsEVM${f}`, `gasUsed${f}`, `gasLimit${f}`, `numEVMBlocks${f}`, `numAccountsActive${f}`, `numXCMTransferIncoming${f}`, `valXCMTransferIncomingUSD${f}`, `numXCMTransferOutgoing${f}`, `valXCMTransferOutgoingUSD${f}`]
            await this.upsertSQL({
                "table": "chain",
                "keys": ["chainID"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
        }
        let sql0 = `update chain set lastUpdateChainAssetsTS = UNIX_TIMESTAMP(Now()) where chainID = ${chain.chainID}`;
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL(10.0);

        let topNgroups = ["balanceUSD", "numChains", "numAssets", "numTransfersIn", "avgTransferInUSD", "sumTransferInUSD", "numTransfersOut", "avgTransferOutUSD", "sumTransferOutUSD", "numExtrinsics", "numExtrinsicsDefi", "numCrowdloans", "numSubAccounts", "numRewards", "rewardsUSD"]
        for (const topN of topNgroups) {
            // TODO: redo with substrateetl
        }
    }

    async updateBlocklogRange(chainID = null, lookback = 2) {
        let whereChain = (chainID >= 0) ? ` and chainID = ${chainID}` : "";
        let sql = `select UNIX_TIMESTAMP(logDT) as logTS, chainID from blocklog where logDT >= date_sub(Now(), interval ${lookback} DAY) and logDT < date_sub(Now(), interval 1 day) and  numAccountsActiveLastUpdateDT is null ${whereChain} order by rand() limit 20`;
        let chainlog = await this.poolREADONLY.query(sql)
        for (let i = 0; i < chainlog.length; i++) {
            let [logDT, hr] = paraTool.ts_to_logDT_hr(chainlog[i].logTS);
            await this.update_blocklog(chainlog[i].chainID, logDT);
        }
    }
    async updateBlocklog(chainID = null, logDT = null) {
        await this.update_blocklog(chainID, logDT);
    }
}