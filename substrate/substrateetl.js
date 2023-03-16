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
const uiTool = require("./uiTool");
const util = require('util');
const exec = util.promisify(require("child_process").exec);
const path = require('path');
const {
    BigQuery
} = require('@google-cloud/bigquery');

// first day when balances are available daily in modern ways from Kusama
const balanceStartDT = "2020-03-09";

module.exports = class SubstrateETL extends AssetManager {
    project = "substrate-etl";
    publish = 0;
    isProd = false

    constructor() {
        super("manager")
    }

    // all bigquery tables are date-partitioned except 2 for now: chains and specversions
    partitioned_table(tbl) {
        switch (tbl) {
            case "balances":
                return "ts";
            case "evmtxs":
            case "evmtransfers":
                return "block_timestamp";
            case "chains":
            case "specversions":
                return (null);
                break;
            case "xcmtransfers":
                return "origination_ts"
        }
        return "block_time";
    }

    // sets up system tables (independent of paraID) and paraID specific tables
    async setup_tables(chainID = null, execute = false) {
        let projectID = `${this.project}`
        //setup "system" tables across all paraIDs
        if (chainID == undefined) {
            console.log(`setup "system" tables across all paraIDs`)
            let systemtbls = ["xcmtransfers", "chains"]
            let relayChains = ["polkadot", "kusama"]
            for (const relayChain of relayChains){
                let bqDataset = (this.isProd)? `${relayChain}`: `${relayChain}_dev` //MK write to relay_dev for dev
                for (const tbl of systemtbls) {
                    let fld = (this.partitioned_table(tbl))
                    let p = fld ? `--time_partitioning_field ${fld} --time_partitioning_type DAY` : "";
                    let cmd = `bq mk  --project_id=${projectID}  --schema=schema/substrateetl/${tbl}.json ${p} --table ${bqDataset}.${tbl}`
                    try {
                        console.log(cmd);
                        //await exec(cmd);
                    } catch (e) {
                        // TODO optimization: do not create twice
                    }
                }
            }
            process.exit(0)
        }
        // setup paraID specific tables, including paraID=0 for the relay chain
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs", "balances", "specversions", "evmtxs", "evmtransfers"]
        let p = (chainID != undefined) ? ` and chainID = ${chainID} ` : ""
        let sql = `select chainID, isEVM from chain where relayChain in ('polkadot', 'kusama') ${p} order by chainID`

        let recs = await this.poolREADONLY.query(sql);
        for (const rec of recs) {
            let chainID = parseInt(rec.chainID, 10);
            let paraID = paraTool.getParaIDfromChainID(chainID);
            let relayChain = paraTool.getRelayChainByChainID(chainID);
            let bqDataset = (this.isProd)? `${relayChain}`: `${relayChain}_dev` //MK write to relay_dev for dev
            //console.log(" --- ", chainID, paraID, relayChain);
            for (const tbl of tbls) {
                let fld = this.partitioned_table(tbl);
                let p = fld ? `--time_partitioning_field ${fld} --time_partitioning_type DAY` : "";
                let cmd = `bq mk  --project_id=${projectID}  --schema=schema/substrateetl/${tbl}.json ${p} --table ${bqDataset}.${tbl}${paraID}`
                if ((tbl == "evmtxs" || tbl == "evmtransfers") && rec.isEVM == 0) {
                    cmd = null;
                }
                try {
                    if (cmd) {
                        console.log(cmd);
                        if (execute) {
                            await exec(cmd);
                        }
                    }
                } catch (e) {
                    console.log(e);
                    // TODO optimization: do not create twice
                }
            }
        }
    }

    async cleanReapedExcess(chainID) {
        let projectID = `${this.project}`
        if (chainID == 2004 || chainID == 22023) {
            let paraID = paraTool.getParaIDfromChainID(chainID);
            let relayChain = paraTool.getRelayChainByChainID(chainID);
            let sql = `select UNIX_TIMESTAMP(logDT) as logTS from blocklog where chainID = ${chainID} and logDT in ("2022-02-11") order by logDT desc`
            let recs = await this.poolREADONLY.query(sql);
            for (const r of recs) {
                let [logDT, hr] = paraTool.ts_to_logDT_hr(r.logTS);
                let logYYYYMMDD = logDT.replaceAll('-', '')
                let cmd = `bq query --destination_table '${relayChain}.balances${paraID}$${logYYYYMMDD}' --project_id=${projectID} --time_partitioning_field ts --replace --use_legacy_sql=false 'select symbol,address_ss58,CONCAT(LEFT(address_pubkey, 2), RIGHT(address_pubkey, 40)) as address_pubkey,ts,id,chain_name,asset,para_id,free,free_usd,reserved,reserved_usd,misc_frozen,misc_frozen_usd,frozen,frozen_usd,price_usd from ${relayChain}.balances${paraID} where DATE(ts) = "${logDT}"'`
                try {
                    console.log(cmd);
                    //await exec(cmd);
                } catch (err) {
                    console.log(err);
                }
            }
        }
    }

    async cleanReaped(start = null, end = null) {
        if (start == null) {
            // pick a multiple of 256 between 0 and 4096
            start = Math.floor(Math.random() * 16) * 256;
        }
        if (end == null) {
            // pick 256 later, so we're working on 1/16 of the dataset
            end = start + 256;
        }
        // get chains that have WSEndpointArchive = 1 only ... for now
        let sql = `select chainID from chain where crawling = 1 and WSEndpointArchive = 1`
        let recs = await this.poolREADONLY.query(sql);
        let chainIDs = {};
        for (const r of recs) {
            chainIDs[r.chainID] = true;
        }

        for (let i = start; i <= end; i++) {
            let hs = "0x" + i.toString(16).padStart(3, '0');
            let he = (i < 4096) ? "0x" + (i + 1).toString(16).padStart(3, '0') : "0xfffZ";
            if (hs == "0x6df") {
                for (let j = 0; j <= 256; j++) {
                    let hs2 = hs + i.toString(16).padStart(2, '0');
                    let he2 = he + ((j < 256) ? (j + 1).toString(16).padStart(2, '0') : "ffF");
                    await this.clean_reaped(hs2, he2, chainIDs);
                }
            } else {
                await this.clean_reaped(hs, he, chainIDs);
            }
        }
    }

    async clean_reaped(start = "0x2c", end = "0x2d", chainIDs) {
        console.log("clean_balances", start, end)
        let [t, tbl] = this.get_btTableRealtime()
        // with 2 digit prefixes, there are 30K rows (7MM rows total)
        let [rows] = await tbl.getRows({
            start: start,
            end: end
        });
        let family = "realtime";
        let currentTS = this.getCurrentTS();
        for (const row of rows) {
            try {
                let rowKey = row.id;
                let rowData = row.data;
                let data = rowData[family];
                if (data) {
                    for (const column of Object.keys(data)) {
                        let cells = data[column];
                        let cell = cells[0];
                        let ts = cell.timestamp / 1000000;
                        let secondsago = currentTS - ts;
                        let column_with_family = `${family}:${column}`
                        let assetChain = paraTool.decodeAssetChain(column);
                        let [asset, chainID] = paraTool.parseAssetChain(assetChain);
                        if (chainIDs[chainID]) {
                            if (asset.includes("0x")) {
                                //console.log("SKIP CONTRACTS", rowKey, column, ts, secondsago, asset, chainID, column_with_family);
                            } else if (secondsago > 86400 * 2) {
                                console.log("deleting", rowKey, column, ts, secondsago, asset, chainID, column_with_family);
                                tbl.mutate({
                                    key: rowKey,
                                    method: 'delete',
                                    data: {
                                        column: column_with_family
                                    },
                                });
                            } else {
                                //console.log("RECENT", rowKey, column, ts, secondsago, asset, chainID, column_with_family);
                            }
                            // important: only consider FIRST cell -
                        }
                    }
                }
            } catch (err) {
                console.log(err);
                /*this.logger.warn({
                    "op": "deleteCells",
                    err
                })*/
            }
        }
    }

    async get_random_crowdloan_ready(_network, lookbackDays = 3000) {
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, crowdloanMetricsStatus from blocklog where crowdloanMetricsStatus not in ('AuditRequired', 'Audited') and chainID in (${paraTool.chainIDKusama},${paraTool.chainIDPolkadot}) and logDT >= "2021-06-08" order by rand() limit 1`;
        let recs = await this.poolREADONLY.query(sql);
        let rec = {
            logDT: null
        }
        if (recs.length == 0) return rec
        let {
            indexTS,
            crowdloanMetricsStatus
        } = recs[0];
        let [logDT, _] = paraTool.ts_to_logDT_hr(indexTS);
        rec.logDT = logDT
        return rec
    }

    async get_random_networkmetrics_ready(_network, lookbackDays = 3000) {
        let w = "";
        if (_network) {
            w = ` and network.network = '${_network}'`
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, logDT, networklog.network, network.isEVM from networklog, network where network.network = networklog.network and logDT >= "${balanceStartDT}" and logDT >= date_sub(Now(), interval ${lookbackDays} day) and networkMetricsStatus = "Ready" ${w} order by rand() limit 1`;
        console.log("get_random_networkmetrics_ready", sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ({
            logDT: null,
            network: null,
            isEVM: false
        });
        let {
            indexTS,
            network,
            isEVM
        } = recs[0];
        let [logDT, _] = paraTool.ts_to_logDT_hr(indexTS);
        let sql0 = `update networklog set attempted = attempted + 1 where network = '${network}' and logDT = '${logDT}'`
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL();
        return {
            logDT,
            network,
            isEVM
        };
    }

    async get_random_accountmetrics_ready(relayChain, paraID, lookbackDays = 3000) {
        let w = "";
        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w = ` and chain.chainID = ${chainID}`
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, blocklog.chainID, chain.isEVM from blocklog, chain where blocklog.chainID = chain.chainID and logDT >= "${balanceStartDT}" and logDT >= date_sub(Now(), interval ${lookbackDays} day) and accountMetricsStatus = "Ready" ${w} order by rand() limit 1`;
        console.log("get_random_accountmetrics_ready", sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ([null, null]);
        let {
            indexTS,
            chainID,
            isEVM
        } = recs[0];
        let [logDT, _] = paraTool.ts_to_logDT_hr(indexTS);
        paraID = paraTool.getParaIDfromChainID(chainID);
        relayChain = paraTool.getRelayChainByChainID(chainID);
        let sql0 = `update blocklog set attempted = attempted + 1 where chainID = '${chainID}' and logDT = '${logDT}'`
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL();
        return {
            logDT,
            paraID,
            relayChain,
            isEVM
        };
    }

    async get_random_substrateetl(logDT = null, paraID = -1, relayChain = null, lookbackDays = 365) {

        let w = "";
        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w = ` and chain.chainID = ${chainID}`
        } else {
            w = " and chain.chainID in ( select chainID from chain where crawling = 1 )"
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, blocklog.chainID, chain.isEVM from blocklog, chain where blocklog.chainID = chain.chainID and blocklog.loaded = 0 and logDT >= date_sub(Now(), interval ${lookbackDays} day) and ( loadAttemptDT is null or loadAttemptDT < DATE_SUB(Now(), INTERVAL POW(5, attempted) MINUTE) ) and ( logDT <= date(date_sub(Now(), interval 1 day)) or logDT = date(Now()) ) ${w} order by rand() limit 1`;
        let recs = await this.poolREADONLY.query(sql);
        console.log("get_random_substrateetl", sql);
        if (recs.length == 0) return ([null, null]);
        let {
            indexTS,
            chainID,
            isEVM
        } = recs[0];
        let hr = 0;
        [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        paraID = paraTool.getParaIDfromChainID(chainID);
        relayChain = paraTool.getRelayChainByChainID(chainID);
        let sql0 = `update blocklog set attempted = attempted + 1, loadAttemptDT = Now() where chainID = '${chainID}' and logDT = '${logDT}'`
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL();
        return {
            logDT,
            paraID,
            relayChain,
            isEVM
        };
    }

    async audit_fix(chainID = null, monthDT = null) {
        let w = [];
        if (chainID >= 0) {
            w.push(`chainID = '${chainID}'`);
        }
        if (monthDT) {
            w.push(`monthDT = '${monthDT}'`);
        }
        let wstr = (w.length > 0) ? ` and ${w.join(" and ")}` : "";
        // 1. find problematic periods with a small number of records (
        let sql = `select CONVERT(auditFailures using utf8) as failures, chainID, monthDT from blocklogstats where audited in ( 'Failure' ) ${wstr} order by chainID, monthDT`
        console.log(sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return (false);
        for (const f of recs) {
            let failures = JSON.parse(f.failures)
            if (failures.gaps && failures.gaps.length > 0) {
                for (const gap of failures.gaps) {
                    let startBN = gap[0];
                    let endBN = gap[1];
                    // attempted > 100 == don't try again, its been audited (missing timestamps, has decoding errors etc.)
                    let sql = `update block${f.chainID} set crawlBlock = 1, attempted = 0 where blockNumber >= ${startBN} and blockNumber <= ${endBN} and attempted < 100;`
                    if (endBN - startBN < 5000) { // 50 blocks * 6-12bps = 5-10mins
                        console.log("EXECUTING: ", sql);
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL()
                    } else {
                        console.log("RECOMMENDING: ", sql);
                    }
                }
            }

            if (failures.errors && failures.errors.length > 0) {
                const tableChain = this.getTableChain(chainID);
                for (const bn of failures.errors) {
                    let paraID = paraTool.getParaIDfromChainID(f.chainID);
                    let relayChain = paraTool.getRelayChainByChainID(f.chainID);
                    // redo in runs of 3
                    for (let n = bn - 1; n <= bn + 1; n++) {
                        let rowId = paraTool.blockNumberToHex(n);
                        tableChain.row(rowId).delete();
                        let sql = `update block${f.chainID} set crawlBlock=1, attempted = 0 where blockNumber = '${n}' and attempted < 100;`;
                        console.log("DELETED:", rowId, " recrawling", sql, `./polkaholic indexblock ${f.chainID} ${n}`);
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL()
                    }
                    console.log("");
                }
            }
        }

    }

    async audit_blocks(chainID = null, fix = true) {
        // 1. find problematic periods with a small number of records (
        let w = chainID != null ? ` and chainID = ${chainID}` : " and (auditDT is Null or auditDT < date_sub(Now(), interval 10 hour))  "
        let sql = `select chainID, monthDT, startBN, endBN, startDT, endDT from blocklogstats where monthDT >= last_day(date_sub(Now(), interval 90 day)) and audited in ( 'Unknown', 'Failure' )   ${w}  order by auditDT`
        console.log(sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return (false);

        // 2. within each, find anything missing in substrate-etl
        let cnt = 0;
        for (const r of recs) {
            console.log(r);
            let chainID = r.chainID;
            let startBN = r.startBN;
            let endBN = r.endBN;
            let startDT = r.startDT ? r.startDT.toISOString().split('T')[0] : "2020-01-01";
            let endDT = r.endDT ? r.endDT.toISOString().split('T')[0] : "2029-01-01";
            let paraID = paraTool.getParaIDfromChainID(chainID);
            let relayChain = paraTool.getRelayChainByChainID(chainID);
            let monthDT = r.monthDT ? r.monthDT.toISOString().split('T')[0] : "";
            let sqlQuery = `SELECT number, \`hash\` as block_hash, parent_hash FROM \`substrate-etl.${relayChain}.blocks${paraID}\` WHERE Date(block_time) >= '${startDT}' and Date(block_time) <= '${endDT}' and number >= ${startBN} and number <= ${endBN} order by number;`
            console.log(sqlQuery);
            let rows = await this.execute_bqJob(sqlQuery);
            let blocks = {};
            let prevHash = null;
            let prevBN = null
            let gaps = [];
            let errors = [];
            for (const row of rows) {
                if (prevBN && row.number != prevBN + 1) {
                    gaps.push([prevBN + 1, row.number - 1]);
                } else if (prevHash && row.parent_hash != prevHash) {
                    errors.push(row.number);
                }
                blocks[row.number] = 1;
                prevBN = row.number;
                prevHash = row.block_hash;
            }
            let audited = 'Unknown'
            let failures = "";
            if (gaps.length > 0 || errors.length > 0) {
                audited = "Failure";
                failures = JSON.stringify({
                    gaps,
                    errors
                })
                if (failures.length > 65000) {
                    failures = JSON.stringify({
                        gaps_length: gaps.length,
                        errors_length: errors.length
                    })
                }
            } else {
                audited = "Success"
            }
            let sql = `update blocklogstats set audited = '${audited}', auditDT = Now(), auditFailures = ${mysql.escape(failures)} where chainID = ${chainID} and monthDT = "${monthDT}"`;
            console.log(sql);
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
            cnt++;

            if (fix) {
                await this.audit_fix(chainID, monthDT);
            }
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
    async getFinalizedBlockInfo(chainID, api, logDT) {
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
        if (logDT != null) {
            blockTS = paraTool.logDT_hr_to_ts(logDT, 0) + 86400 - 1;
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

    async is_update_balance_ready(chainID, logDT) {
        let sql_check = `select lastUpdateAddressBalancesAttempts from blocklog where chainID = '${chainID}' and logDT = '${logDT}' and updateAddressBalanceStatus = 'Ready'`;
        let checks = await this.pool.query(sql_check);
        if (checks.length == 1) {
            return true;
        }
        return false;
    }

    async pick_chainbalancecrawler(specific_chainID = null) {
        let w = (specific_chainID) ? ` and chainID = '${specific_chainID}' ` : "";
        let sql = `select chainID, UNIX_TIMESTAMP(logDT) as indexTS, startTS, logDT from chainbalancecrawler as c where hostname = '${this.hostname}' and lastDT > date_sub(Now(), interval 5 MINUTE) ${w} order by lastDT DESC limit 1`;
        console.log("pick_chainbalancecrawler", sql);
        let chains = await this.pool.query(sql);
        if (chains.length == 0) {
            return [null, null, null];
        }
        // check that its actually in the ready state
        let chainID = chains[0].chainID;
        let logTS = chains[0].indexTS;
        let startTS = chains[0].startTS;
        let [logDT, _] = paraTool.ts_to_logDT_hr(logTS);
        if (await this.is_update_balance_ready(chainID, logDT)) {
            return [chainID, chains[0].indexTS, startTS];
        }
        console.log("pick_chainbalancecrawler ... not ready anymore", chainID, logDT)
        return [null, null, null];
    }

    // pick a random chain to load yesterday for all chains
    async updateAddressBalances(specific_chainID = null) {
        // pick something your node started already
        let [chainID, indexTS, startTS] = await this.pick_chainbalancecrawler(specific_chainID);
        if (chainID == null) {
            let orderby = "blocklog.logDT desc, rand()";
            let w = (specific_chainID != null) ? ` and blocklog.chainID = '${specific_chainID}' ` : "";
            // pick a chain-logDT combo that has been marked Ready ( all blocks finalized ), and no other node is working on
            let othersRecs = await this.pool.query(`select chainID, UNIX_TIMESTAMP(logDT) as logTS from chainbalancecrawler where hostname != '${this.hostname}' and lastDT > date_sub(Now(), interval 3 minute)`);
            let others = {};
            for (const o of othersRecs) {
                others[`${o.chainID}-${o.logTS}`] = true;
            }
            // now out of candidate jobs choose the first one that hasn't been picked
            let sql = `select chainID, UNIX_TIMESTAMP(logDT) as indexTS from blocklog where updateAddressBalanceStatus = "Ready" and
 ( lastUpdateAddressBalancesStartDT < date_sub(Now(), interval 3+POW(3, lastUpdateAddressBalancesAttempts) MINUTE )
 or lastUpdateAddressBalancesStartDT is Null  ) and blocklog.logDT >= '${balanceStartDT}' ${w} order by ${orderby}`;
            let jobs = await this.pool.query(sql);
            console.log(sql);
            if (jobs.length == 0) {
                console.log(`No updatebalances jobs available`)
                return false;
            }

            for (const c of jobs) {
                if (others[`${c.chainID}-${c.indexTS}`]) {
                    console.log("skipping job cand:", c);
                } else {
                    console.log("choosing job cand:", c);
                    chainID = c.chainID;
                    indexTS = c.indexTS;
                    startTS = this.getCurrentTS();
                    break;
                }
            }
        }
        if (chainID == null) {
            return (false);
        }
        console.log("SELECTED", chainID);
        let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        let sql = `update blocklog set lastUpdateAddressBalancesAttempts = lastUpdateAddressBalancesAttempts + 1 where logDT = '${logDT}' and chainID = '${chainID}' and lastUpdateAddressBalancesAttempts < 30`;
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
        await this.update_address_balances_logDT(chainID, logDT, startTS);
        return (true);
    }

    async update_address_balances_logDT(chainID, logDT, startTS) {
        try {
            let res0 = await this.updateNativeBalances(chainID, logDT, startTS);
            if (res0 == false) {
                return (false);
            }
            let res1 = await this.updateNonNativeBalances(chainID, logDT, startTS);
            if (res1) {
                await this.load_bqlogfn(chainID, logDT, startTS);
            }
            return (true);
        } catch (err) {
            console.log(err);
            // make sure we can start over
            await this.clean_chainbalancecrawler(logDT, chainID, startTS);
            this.logger.error({
                "op": "update_address_balances_logDT",
                err
            })
            return false;
        }
    }

    async getMinMaxNumAddresses(chainID, logDT) {
        const defaultMinNumAddresses = 1
        const defaultMaxNumAddresses = 30000;
        const stdTolerance = 2;
        const fractionTolerance = .25;
        let sql = `select round(numAddresses_avg - numAddresses_std*${stdTolerance}) as min_numAddresses, round(numAddresses_avg + numAddresses_std*${stdTolerance}+numAddresses_avg*${fractionTolerance}) max_numAddresses from blocklogstats where chainID = ${chainID} and (monthDT = last_day("${logDT}") or monthDT = last_day(date_sub(Now(), interval 28 day))) order by min_numAddresses asc limit 1`;
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) {
            return [defaultMinNumAddresses, defaultMaxNumAddresses];
        }
        let min_numAddresses = recs[0].min_numAddresses ? recs[0].min_numAddresses : defaultMinNumAddresses;
        let max_numAddresses = recs[0].max_numAddresses ? recs[0].max_numAddresses : defaultMaxNumAddresses;
        if (max_numAddresses < defaultMaxNumAddresses) {
            max_numAddresses = defaultMaxNumAddresses;
        }
        return [min_numAddresses, max_numAddresses];
    }


    async clean_chainbalancecrawler(logDT, chainID) {
        let sql = `delete from chainbalancecrawler where logDT = '${logDT}' and chainID = '${chainID}'`;
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async load_bqlogfn(chainID, logDT, startTS) {
        let projectID = `${this.project}`
        let logDTp = logDT.replaceAll("-", "")
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let fn = this.get_bqlogfn(chainID, logDT, startTS)
        let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${relayChain}.balances${paraID}$${logDTp}' ${fn} schema/substrateetl/balances.json`

        console.log(cmd);
        try {
            await exec(cmd);
            // do a confirmatory query to compute numAddresses and mark that we're done by updating lastUpdateAddressBalancesEndDT
            let sql = `select count(distinct address_pubkey) as numAddresses from substrate-etl.${relayChain}.balances${paraID} where date(ts) = '${logDT}'`;

            let rows = await this.execute_bqJob(sql);
            let row = rows.length > 0 ? rows[0] : null;
            let [min_numAddresses, max_numAddresses] = await this.getMinMaxNumAddresses(chainID, logDT);
            if (!(row && (row["numAddresses"] >= min_numAddresses) && (row["numAddresses"] <= max_numAddresses))) {
                this.logger.error({
                    "op": "load_bqlogfn - sanity check",
                    min_numAddresses,
                    max_numAddresses,
                    numAddresses: row["numAddresses"],
                    chainID,
                    logDT,
                    cmd
                })
            }
            let numAddresses = parseInt(row["numAddresses"], 10);
            // update numAddresses and mark "AuditRequired"
            let sql_upd = `update blocklog set lastUpdateAddressBalancesEndDT = Now(), numAddresses = '${numAddresses}', numAddressesLastUpdateDT = Now(), updateAddressBalanceStatus = 'AuditRequired' where chainID = ${chainID} and logDT = '${logDT}'`;
            console.log("updateAddressBalances", "min", min_numAddresses, "max", max_numAddresses, sql_upd);
            this.batchedSQL.push(sql_upd);

            let [todayDT, _] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
            let [yesterdayDT, __] = paraTool.ts_to_logDT_hr(this.getCurrentTS() - 86400);
            if ((logDT == yesterdayDT) || (logDT == todayDT)) {
                let sql_numHolders = `update chain set numHolders = '${numAddresses}' where chainID = '${chainID}'`
                this.batchedSQL.push(sql_numHolders);
            }
            await this.update_batchedSQL();
            await this.clean_chainbalancecrawler(logDT, chainID);
        } catch (err) {
            console.log(err);
            this.logger.error({
                "op": "load_bqlogfn",
                err,
                cmd,
                chainID,
                logDT
            })
        }
    }
    async clean_bqlogfn(chainID, logDT, startTS) {
        let bqlogfn = logDT ? this.get_bqlogfn(chainID, logDT, startTS) : null;
        if (fs.existsSync(bqlogfn)) {
            fs.unlinkSync(bqlogfn);
        }
        // place an empty file ala "touch"
        try {
            const time = new Date();
            fs.utimesSync(bqlogfn, time, time);
        } catch (e) {
            let fd = fs.openSync(bqlogfn, 'a');
            fs.closeSync(fd);
        }
        let sql_upd = `update blocklog set lastUpdateAddressBalancesStartDT = Now() where chainID = ${chainID} and logDT = '${logDT}'`;
        console.log("updateAddressBalances START", sql_upd);
        this.batchedSQL.push(sql_upd);
        await this.update_batchedSQL();
    }

    get_bqlogfn(chainID, logDT, startTS) {
        return `/tmp/balances${chainID}-${logDT}-${startTS}.json`
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

    async updateNonNativeBalances(chainID, logDT = null, startTS = null, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.pool.query(`select chainID, paraID, id, WSEndpoint, WSEndpointArchive, assetaddressPallet, chainName from chain where chainID = ${chainID}`);
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
        let disconnectedCnt = 0;
        provider.on('disconnected', () => {
            disconnectedCnt++;
            console.log(`*CHAIN API DISCONNECTED [DISCONNECTIONS=${disconnectedCnt}]`, chainID);
            if (disconnectedCnt > 5) {
                console.log(`*CHAIN API DISCONNECTION max reached!`, chainID);
                process.exit(1);
            }
        });
        let bqlogfn = logDT ? this.get_bqlogfn(chainID, logDT, startTS) : null;
        const rawChainInfo = await api.registry.getChainProperties()
        var chainInfo = JSON.parse(rawChainInfo);
        const prefix = chainInfo.ss58Format
        let pallet = "none"
        let rows = [];
        let asset = this.getChainAsset(chainID);
        let [tblName, tblRealtime] = this.get_btTableRealtime()
        let [finalizedBlockHash, blockTS, bn] = logDT && chain.WSEndpointArchive ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api, logDT)
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
        let [todayDT, _] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
        let [yesterdayDT, __] = paraTool.ts_to_logDT_hr(this.getCurrentTS() - 86400);
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
            } else if (apiAt.query.ormlTokens != undefined && apiAt.query.ormlTokens.accounts != undefined) {
                query = await apiAt.query.ormlTokens.accounts.entriesPaged({
                    args: [],
                    pageSize: perPagelimit,
                    startKey: last_key
                })
                pallet = "ormltokens";
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
                        if (balance > 0) {
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
                                if ((logDT == yesterdayDT) || (logDT == todayDT)) {
                                    let rowKey = address.toLowerCase() // just in case
                                    rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, balance, 0, 0, 0, blockTS, bn));
                                    console.log(symbol, currencyID, `cbt read accountrealtime prefix=${rowKey}`, balance, val.balance, "decimals", decimals);
                                }
                            }
                        }

                    } else {
                        if (numFailures[asset] == undefined) {
                            let failure = `unknown decimals/symbol: ${assetChain}`;
                            console.log(failure);
                            numFailures[asset] = failure;
                        }
                    }
                } else if (pallet == "tokens" || pallet == "ormltokens") { //this is by [account-asset]. not way to tally by asset
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
                            if (logDT == yesterdayDT || logDT == todayDT) {
                                rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, free, reserved, miscFrozen, frozen, blockTS, bn));
                            }
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
                rawRows.push("");
                await fs.appendFileSync(bqlogfn, rawRows.join("\n"));
                bqRows = [];
                if (rows.length > 0) {
                    console.log(`writing ${chainName}`, rows.length, "rows chainID=", chainID);
                    await this.insertBTRows(tblRealtime, rows, tblName);
                }
            }
            rows = [];
            if (cnt == 0) {
                done = true;
            }
        }

        if (logDT) {
            // close files
            let [yesterdayDT, __] = paraTool.ts_to_logDT_hr(this.getCurrentTS() - 86400);
            if (logDT == yesterdayDT && false) {
                // TODO: for all the other accounts that did NOT appear, we can delete them if they were OLDER than bn, because they are reaped == but we still need to 0 out the balances
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
            }
        }
        let sql_assetPallet = `update blocklog set assetNonNativeRegistered = '${Object.keys(numHolders).length}', assetNonNativeUnregistered = '${Object.keys(numFailures).length}' where chainID = '${chainID}' and logDT = '${logDT}'`
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

    async getLastKey(chainID, logDT) {
        let chains = await this.pool.query(`select lastKey from chainbalancecrawler where chainID = '${chainID}' and logDT = '${logDT}' and hostname = '${this.hostname}' and lastDT > date_sub(Now(), interval 1 hour)`);
        if (chains.length == 0) {
            return "";
        } else {
            return chains[0].lastKey;
        }
    }

    async updateNativeBalances(chainID, logDT = null, startTS = 0, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.poolREADONLY.query(`select chainID, id, relayChain, paraID, chainName, WSEndpoint, WSEndpointArchive, numHolders, totalIssuance, decimals from chain where chainID = '${chainID}'`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }

        let bqlogfn = logDT ? this.get_bqlogfn(chainID, logDT, startTS) : null;
        let chain = chains[0];
        let relayChain = chain.relayChain;
        let paraID = chain.paraID;
        let chainName = chain.chainName;
        let id = chain.id;

        let wsEndpoint = chain.WSEndpoint;
	let alts = {
	    0: ['wss://1rpc.io/dot','wss://rpc.dotters.network/polkadot','wss://polkadot-rpc.dwellir.com','wss://polkadot-rpc-tn.dwellir.com','wss://rpc.ibp.network/polkadot','wss://rpc.polkadot.io','wss://polkadot.public.curie.radiumblock.co/ws'],
	    2: ['wss://1rpc.io/ksm', 'wss://rpc.dotters.network/kusama', 'wss://kusama-rpc.dwellir.com', 'wss://kusama-rpc-tn.dwellir.com', 'wss://rpc.ibp.network/kusama', 'wss://kusama.api.onfinality.io/public-ws', 'wss://kusama-rpc.polkadot.io', 'wss://kusama.public.curie.radiumblock.co/ws'],
	    22023: ['wss://moonriver.public.blastapi.io','wss://wss.api.moonriver.moonbeam.network','wss://moonriver.api.onfinality.io/public-ws','wss://moonriver.unitedbloc.com:2001'],
	    2004: ['wss://1rpc.io/glmr','wss://moonbeam.public.blastapi.io','wss://wss.api.moonbeam.network','wss://moonbeam.api.onfinality.io/public-ws','wss://moonbeam.unitedbloc.com:3001']
	}
	if ( alts[chainID] !== undefined && ( alts[chainID].length > 0 ) ) {
	    let a = alts[chainID];
	    wsEndpoint = a[Math.floor(Math.random()*a.length)];
	}
        let prev_numHolders = chain.numHolders;
        let decimals = this.getChainDecimal(chainID)
        const provider = new WsProvider(wsEndpoint);
        let disconnectedCnt = 0;
        provider.on('disconnected', () => {
            disconnectedCnt++;
            console.log(`*CHAIN API DISCONNECTED [DISCONNECTIONS=${disconnectedCnt}]`, chainID);
            if (disconnectedCnt > 5) {
                console.log(`*CHAIN API DISCONNECTION max reached!`, chainID);
                process.exit(1);
            }
        });
        const api = await ApiPromise.create({
            provider
        });

        const rawChainInfo = await api.registry.getChainProperties()
        var chainInfo = JSON.parse(rawChainInfo);
        const prefix = chainInfo.ss58Format

        // update total issuances
        try {
            let totalIssuance = 0;
            if (decimals) {
                if (api.query.balances && api.query.balances.totalIssuance) {
                    totalIssuance = await api.query.balances.totalIssuance() / 10 ** decimals;
                } else if (api.query.tokens && api.query.tokens.totalIssuance) {
                    // hard wired for now...
                    let currencyID = null;
                    if (chainID == 2032) {
                        currencyID = {
                            Token: "INTR"
                        }
                    } else if (chainID == 22092) {
                        currencyID = {
                            Token: "KINT"
                        }
                    } else if (chainID == 22110) {
                        currencyID = 0
                    }
                    if (currencyID) {
                        totalIssuance = await api.query.tokens.totalIssuance(currencyID) / 10 ** decimals;
                    }
                } else if (api.query.eqAggregates && api.query.eqAggregates.totalUserGroups) {
                    let currencyID = (chainID == 2011) ? 25969 : 1734700659; // native asset id
                    let res = await api.query.eqAggregates.totalUserGroups("Balances", currencyID);
                    totalIssuance = (res.collateral - res.debt) / 10 ** decimals;
                    console.log(res, totalIssuance);
                } else {
                    console.log("totalIssuance NOT AVAIL");
                }
                if (totalIssuance > 0) {
                    let sql_totalIssuance = `update chain set totalIssuance = '${totalIssuance}' where chainID = '${chainID}'`
                    console.log(sql_totalIssuance);
                    this.batchedSQL.push(sql_totalIssuance);
                    await this.update_batchedSQL();
                } else {
                    console.log("NO totalIssuance", totalIssuance);
                }
            }
        } catch (e) {
            console.log("totalIssuance ERR", e);
        }

        let numHolders = 0; // we can't tally like this.
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

        let [finalizedBlockHash, blockTS, bn] = logDT && chain.WSEndpointArchive ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api, logDT)
        let p = await this.computePriceUSD({
            assetChain,
            ts: blockTS
        })
        let priceUSD = p && p.priceUSD ? p.priceUSD : 0;
        let last_key = await this.getLastKey(chainID, logDT);

        if (last_key == "" || (bqlogfn && !fs.existsSync(bqlogfn))) {
            last_key = "";
            await this.clean_bqlogfn(chainID, logDT, startTS);
            console.log("STARTING CLEAN");
        } else {
            console.log("RESUMING with last_key", last_key)
        }
        let sql_reset = `update blocklog set lastUpdateAddressBalancesAttempts = 0 where logDT = '${logDT}' and chainID = '${chainID}'`
        this.batchedSQL.push(sql_reset);
        await this.update_batchedSQL();

        let page = 0;
        let done = false;
        let [todayDT, _] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
        let [yesterdayDT, __] = paraTool.ts_to_logDT_hr(this.getCurrentTS() - 86400);
        while (!done) {
            let apiAt = await api.at(finalizedBlockHash)
            let query = null;
            try {
                query = await apiAt.query.system.account.entriesPaged({
                    args: [],
                    pageSize: perPagelimit,
                    startKey: last_key
                })
            } catch (err) {
                done = true;
                return (false);
            }
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
                let nonce = parseInt(user[1].nonce.toString(), 10)
                let balance = user[1].data
                let free_balance = (balance.free) ? parseInt(balance.free.toString(), 10) / 10 ** decimals : 0;
                let reserved_balance = (balance.reserved) ? parseInt(balance.reserved.toString(), 10) / 10 ** decimals : 0;
                let miscFrozen_balance = (balance.miscFrozen) ? parseInt(balance.miscFrozen.toString(), 10) / 10 ** decimals : 0;
                let feeFrozen_balance = (balance.feeFrozen) ? parseInt(balance.feeFrozen.toString(), 10) / 10 ** decimals : 0;

                let stateHash = u8aToHex(user[1].createdAtHash)
                if ((chainID == 2004 || chainID == 22023) && (pubkey.length >= 40)) {
                    pubkey = "0x" + pubkey.substr(pubkey.length - 40, 40); // evmaddress is the last 20 bytes (40 chars) of the storagekey
                    account_id = "";
                }
                let rowKey = pubkey.toLowerCase()
                if (logDT) {
                    let free_usd = free_balance * priceUSD;
                    let reserved_usd = reserved_balance * priceUSD;
                    let miscFrozen_usd = miscFrozen_balance * priceUSD;
                    let frozen_usd = feeFrozen_balance * priceUSD;
                    if ((free_balance > 0) || (reserved_balance > 0) || (miscFrozen_balance > 0) || (feeFrozen_balance > 0)) {
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
                            price_usd: priceUSD,
                            nonce: nonce
                        });
                        if ((logDT == yesterdayDT) || (logDT == todayDT)) {
                            //console.log("updateNativeBalances", rowKey, `cbt read accountrealtime prefix=${rowKey}`, encodedAssetChain);
                            rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain, free_balance, reserved_balance, miscFrozen_balance, feeFrozen_balance, blockTS, bn));
                        }
                    }
                }
            }
            if (logDT) {
                // write rows
                let rawRows = bqRows.map((r) => {
                    return JSON.stringify(r);
                });
                rawRows.push("");
                await fs.appendFileSync(bqlogfn, rawRows.join("\n"));
                if (rows.length > 0) {
                    console.log("WRITING", rows.length, tblName)
                    await this.insertBTRows(tblRealtime, rows, tblName);
                    rows = [];
                }
            }
            last_key = (query.length > 999) ? query[query.length - 1][0] : "";

            const gbRounded = this.gb_heap_used();
            console.log(`system.account page: `, page++, last_key.toString(), "recs=", query.length, `Heap allocated ${gbRounded} GB`, query.length);
            // save last_key state in db and get out if memory is getting lost (>1GB heap) -- we will pick it up again
            let sql1 = `insert into chainbalancecrawler (chainID, logDT, hostname, lastDT, lastKey, startTS) values ('${chainID}', '${logDT}', '${this.hostname}', Now(), '${last_key.toString()}', '${startTS}') on duplicate key update lastDT = values(lastDT), lastKey = values(lastKey), startTS = values(startTS)`
            console.log(sql1);
            this.batchedSQL.push(sql1);
            await this.update_batchedSQL();
            if (last_key == "") done = true;
            if (gbRounded > 1) {
                // when we come back, we'll pick this one
                console.log(`EXITING with last key stored:`, last_key.toString());
                // update lastUpdateAddressBalancesAttempts back to 0
                let sql = `update blocklog set lastUpdateAddressBalancesAttempts = 1 where logDT = '${logDT}' and chainID = '${chainID}'`;
                this.batchedSQL.push(sql1);
                await this.update_batchedSQL();
                process.exit(1);
            }
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
        let sql = `update blocklog set numNativeHolders = '${numHolders}' where chainID = ${chainID} and logDT = '${logDT}'`
        console.log(numHolders, sql);
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
        return (true);
    }

    gb_heap_used() {
        const mu = process.memoryUsage();
        let field = "heapUsed";
        const gbNow = mu[field] / 1024 / 1024 / 1024;
        const gbRounded = Math.round(gbNow * 100) / 100;
        return gbRounded;
    }

    async compute_teleportfees(relayChain, logDT = '2021-12-01') {
        let sql = `insert into teleportfees ( symbol, chainIDDest, teleportFeeDecimals_avg, teleportFeeDecimals_std, teleportFeeDecimals_avg_imperfect, teleportFeeDecimals_std_imperfect) (select symbol, chainIDDest, avg(teleportFeeDecimals) teleportFeeDecimals_avg, if(std(teleportFeeDecimals)=0, avg(teleportFeeDecimals)*.2, std(teleportFeeDecimals)) as teleportFeeDecimals_std, avg(amountSentDecimals - amountReceivedDecimals), std(amountSentDecimals - amountReceivedDecimals) from xcmtransfer where amountSentDecimals > amountReceivedDecimals and teleportFeeDecimals is not null and teleportFeeDecimals > 0 and confidence = 1 and  isFeeItem and sourceTS > unix_timestamp("${logDT}") group by symbol, chainIDDest) on duplicate key update teleportFeeDecimals_avg = values(teleportFeeDecimals_avg), teleportFeeDecimals_std = values(teleportFeeDecimals_std), teleportFeeDecimals_avg_imperfect = values(teleportFeeDecimals_avg_imperfect), teleportFeeDecimals_std_imperfect = values(teleportFeeDecimals_std_imperfect)`
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
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

    lookup_xcmRegistry_xcmInteriorKey(xcmRegistry, relayChain, para_id, symbol) {
        for (const r of xcmRegistry) {
            if (r.relayChain == relayChain) {
                for (const xcmInteriorKey of Object.keys(r.data)) {
                    let c = r.data[xcmInteriorKey];
                    if ((c.paraID == para_id || c.source.includes(para_id)) && c.symbol == symbol) {
                        return xcmInteriorKey;
                    }
                }
            }
        }
        return null;
    }

    xcmgar_assets(chains, relayChain, xcmRegistry) {
        let out = [];
        for (const c of chains) {
            let para_id = c.paraID;
            let chain_name = c.id;
            for (const a of c.data) {
                let o = {
                    para_id,
                    chain_name,
                    asset: JSON.stringify(a.asset),
                    name: a.name,
                    symbol: a.symbol,
                    decimals: a.decimals
                }
                // add xcm_interior_key using para_id / symbol combination
                let xcmInteriorKey = this.lookup_xcmRegistry_xcmInteriorKey(xcmRegistry, relayChain, para_id, a.symbol)
                if (xcmInteriorKey) {
                    o.xcm_interior_key = paraTool.convertXcmInteriorKeyV1toV2(xcmInteriorKey)
                }
                out.push(o)
            }
        }
        return (out);
    }

    xcmgar_xcmassets(xcmRegistry, relayChain) {
        let out = [];
        for (const registry of xcmRegistry) {
            if (registry.relayChain == relayChain) {
                for (const xcmInteriorKey of Object.keys(registry.data)) {
                    let a = registry.data[xcmInteriorKey];
                    let o = {
                        xcm_interior_key: paraTool.convertXcmInteriorKeyV1toV2(xcmInteriorKey),
                        para_id: a.paraID,
                        chain_name: a.nativeChainID,
                        symbol: a.symbol,
                        decimals: a.decimals,
                        interior_type: a.interiorType,
                        xcm_v1_multilocation_byte: a.xcmV1MultiLocationByte,
                        xcm_v1_multilocation: JSON.stringify(a.xcmV1MultiLocation),
                        xc_currency_id: JSON.stringify(a.xcCurrencyID),
                        confidence: a.confidence,
                        source: JSON.stringify(a.source)
                    }
                    if (Object.keys(a.xcContractAddress).length) {
                        o.xc_contract_address = JSON.stringify(a.xcContractAddress);
                    }
                    out.push(o);
                }
            }
        }
        return (out);
    }

    async dump_substrateetl_xcmgar(startDT = "2023-02-28") {
        const relayChains = ["polkadot", "kusama"];
        let projectID = `${this.project}`

        // fetch xcmgar data
        const axios = require("axios");
        let url = "https://cdn.jsdelivr.net/gh/colorfulnotion/xcm-global-registry@main/metadata/xcmgar.json";
        let assets = null;
        let xcmRegistry = null;

        let dir = "/tmp";
        try {
            const resp = await axios.get(url);
            assets = resp.data.assets;
            xcmRegistry = resp.data.xcmRegistry;

            if (assets && xcmRegistry) {
                // copy to  gs://cdn.polkaholic.io/substrate-etl/xcmgar.json
                let fn = path.join(dir, `xcmgar.json`)
                let f = fs.openSync(fn, 'w', 0o666);
                fs.writeSync(f, JSON.stringify(resp.data));
                let cmd = `gsutil -m -h "Cache-Control: public, max-age=60" cp -r ${fn} gs://cdn.polkaholic.io/substrate-etl/xcmgar.json`
                console.log(cmd);
                await exec(cmd);
            }
        } catch (err) {
            console.log(err);
        }

        for (const relayChain of relayChains) {
            // 1. Generate system tables:
            let system_tables = ["chains", "xcmassets", "assets"];
            for (const tbl of system_tables) {
                let fn = path.join(dir, `${relayChain}-${tbl}.json`)
                let f = fs.openSync(fn, 'w', 0o666);
                let fulltbl = `${projectID}:${relayChain}.${tbl}`;
                let projectID = `${projectID}`
                if (tbl == "chains") {
                    let sql = `select id, chainName as chain_name, paraID para_id, ss58Format as ss58_prefix, symbol, isEVM as is_evm, isWASM as is_wasm from chain where ( crawling = 1 or active = 1 ) and relayChain = '${relayChain}' order by para_id`;
                    let recs = await this.poolREADONLY.query(sql)
                    for (const c of recs) {
                        c.is_evm = (c.is_evm == 1) ? true : false;
                        c.is_wasm = (c.is_wasm == 1) ? true : false;
                        fs.writeSync(f, JSON.stringify(c) + "\r\n");
                    }
                } else if (tbl == "xcmassets") {
                    let xcmassets = this.xcmgar_xcmassets(xcmRegistry, relayChain);
                    for (const c of xcmassets) {
                        fs.writeSync(f, JSON.stringify(c) + "\r\n");
                    }
                } else if (tbl == "assets") {
                    let out = this.xcmgar_assets(assets[relayChain], relayChain, xcmRegistry);
                    for (const c of out) {
                        fs.writeSync(f, JSON.stringify(c) + "\r\n");
                    }
                }
                let cmd = `bq load  --project_id=${projectID} --max_bad_records=1 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${fulltbl}' ${fn} schema/substrateetl/${tbl}.json`;
                console.log(cmd);
                await exec(cmd);
            }

            // 2. Generate assetholder tables from balances
            let sqla = {
                // (a) group by symbol in "{relaychain}.assetholder" across the network
                "assetholderrelaychain": `select date(ts) as logDT, symbol, count(distinct para_id) numChains, count(distinct address_pubkey) numHolders, sum(free) free, sum(free_usd) freeUSD, sum(reserved) reserved, sum(reserved_usd) reservedUSD, sum(misc_frozen) miscFrozen, sum(misc_frozen_usd) miscFrozenUSD, sum(frozen) frozen, sum(frozen_usd) frozenUSD, avg(price_usd) priceUSD from \`substrate-etl.${relayChain}.balances*\` where Date(ts) >= "${startDT}" group by logDT, symbol order by symbol, logDT`,
                // (b) group by symbol/asset in "{relaychain}.assetholder{paraID}" for a specific balances table
                "assetholderchain": `select date(ts) as logDT, symbol, asset, para_id, count(distinct address_pubkey) numHolders, sum(free) free, sum(free_usd) freeUSD, sum(reserved) reserved, sum(reserved_usd) reservedUSD, sum(misc_frozen) miscFrozen, sum(misc_frozen_usd) miscFrozenUSD, sum(frozen) frozen, sum(frozen_usd) frozenUSD, avg(price_usd) priceUSD from \`substrate-etl.${relayChain}.balances*\` where Date(ts) >= "${startDT}"  group by logDT, symbol, asset, para_id`
            }
            let r = {}
            for (const k of Object.keys(sqla)) {
                let sql = sqla[k];
                let rows = await this.execute_bqJob(sql);
                let keys = [];
                let vals = [];
                let data = [];
                for (const row of rows) {
                    if (k == "assetholderrelaychain") {
                        let logDT = row.logDT.value;
                        let symbol = row.symbol;
                        let out = `('${logDT}', '${symbol}', '${relayChain}', ${mysql.escape(row.numChains)}, ${mysql.escape(row.numHolders)}, ${mysql.escape(row.free)}, ${mysql.escape(row.reserved)}, ${mysql.escape(row.miscFrozen)}, ${mysql.escape(row.frozen)},
				   ${mysql.escape(row.freeUSD)}, ${mysql.escape(row.reservedUSD)}, ${mysql.escape(row.miscFrozenUSD)}, ${mysql.escape(row.frozenUSD)}, ${mysql.escape(row.priceUSD)})`
                        keys = ["logDT", "symbol", "relayChain"];
                        vals = ["numChains", "numHolders", "free", "reserved", "miscFrozen", "frozen", "freeUSD", "reservedUSD", "miscFrozenUSD", "frozenUSD", "priceUSD"]
                        data.push(out);
                    } else if (k == "assetholderchain") {
                        let logDT = row.logDT.value;
                        let symbol = row.symbol;
                        let paraID = parseInt(row.para_id, 10);
                        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
                        let out = `('${logDT}', '${symbol}', '${chainID}', ${mysql.escape(row.asset)}, ${mysql.escape(row.numHolders)}, ${mysql.escape(row.free)}, ${mysql.escape(row.reserved)}, ${mysql.escape(row.miscFrozen)}, ${mysql.escape(row.frozen)},
				   ${mysql.escape(row.freeUSD)}, ${mysql.escape(row.reservedUSD)}, ${mysql.escape(row.miscFrozenUSD)}, ${mysql.escape(row.frozenUSD)}, ${mysql.escape(row.priceUSD)})`
                        keys = ["logDT", "symbol", "chainID"];
                        vals = ["asset", "numHolders", "free", "reserved", "miscFrozen", "frozen", "freeUSD", "reservedUSD", "miscFrozenUSD", "frozenUSD", "priceUSD"]
                        if (symbol.length < 32) {
                            data.push(out);
                        }
                    }
                }
                await this.upsertSQL({
                    "table": k,
                    keys,
                    vals,
                    data,
                    replace: vals
                });
            }
        }
    }

    async dump_substrateetl_polkaholic(fix = false, invalidate = false) {
        let birthDT = '2019-11-01';
        let sql_tally = `insert into blocklogstats ( chainID, monthDT, startDT, endDT, startBN, endBN, numBlocks_missing, numBlocks_total) (select chainID, LAST_DAY(logDT) monthDT, min(logDT), max(logDT), min(startBN) startBN, max(endBN) endBN, sum(( endBN - startBN + 1 ) - numBlocks) as numBlocks_missing, sum(numBlocks) numBlocks_total from blocklog where chainID in ( select chainID from chain where crawling = 1 ) and logDT >= '${birthDT}' group by chainID, monthDT having monthDT <= Last_day(Date(Now()))) on duplicate key update startDT = values(startDT), endDT = values(endDT), startBN  = values(startBN), endBN = values(endBN), numBlocks_missing = values(numBlocks_missing), numBlocks_total = values(numBlocks_total)`;
        this.batchedSQL.push(sql_tally);
        await this.update_batchedSQL();
        console.log(sql_tally);

        var blocklogstats = ["numBlocks", "numExtrinsics", "numTransfers", "numSignedExtrinsics", "numAddresses",
            "numXCMTransfersIn", "numXCMTransfersOut", "valXCMTransferIncomingUSD", "valXCMTransferOutgoingUSD", "numAccountsTransfersIn", "numAccountsTransfersOut",
            "numTransactionsEVM", "numTransactionsEVM1559", "numTransactionsEVMLegacy",
            "numNewAccounts", "numReapedAccounts", "numPassiveAccounts",
            "numEVMContractsCreated", "numEVMLegacyTransactions",
            "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "evmFee", "evmBurnedFee",
            "numEVMTransfers", "numERC20Transfers", "numERC721Transfers", "numERC1155Transfers",
            "numActiveAccounts", "numActiveSystemAccounts", "numActiveUserAccounts",
            "numActiveAccountsEVM", "numPassiveAccountsEVM"
        ];
        let keys = ["chainID", "monthDT"];
        let vals = ["days"];
        let groups = [`count(*) days`];
        for (const s of blocklogstats) {
            groups.push(`round(sum(${s}),2) ${s}_sum`);
            groups.push(`round(min(${s}),2) ${s}_min`);
            groups.push(`round(max(${s}),2) ${s}_max`);
            groups.push(`round(avg(${s}),2) ${s}_avg`);
            groups.push(`stddev(${s}) ${s}_std`);
            vals.push(`${s}_min`)
            vals.push(`${s}_max`)
            vals.push(`${s}_sum`)
            vals.push(`${s}_avg`)
            vals.push(`${s}_std`)
        }
        let groupsstr = groups.join(",");
        let sql = `select chainID, last_day(logDT) as monthDT, ${groupsstr} from blocklog where chainID in ( select chainID from chain where crawling = 1 ) and logDT <= date(Last_day(Now())) and logDT > '2019-01-01' group by chainID, monthDT having days > 0`;
        let groupsRecs = await this.poolREADONLY.query(sql)
        let data = [];

        for (const g of groupsRecs) {
            let out = [];
            let month = g.monthDT.toISOString().split('T')[0];
            out.push(`'${g['chainID']}'`);
            out.push(`'${month}'`);
            for (const v of vals) {
                out.push(`${mysql.escape(g[v])}`);
            }
            data.push(`(${out.join(",")})`);
        }
        await this.upsertSQL({
            "table": "blocklogstats",
            keys,
            vals,
            data,
            replace: vals
        });
        console.log("updated", data.length, " blocklogstats recs");

        let sqln = `select network, last_day(logDT) as monthDT, ${groupsstr} from networklog where network in ( select network from network where crawling = 1 ) and logDT <= date(Last_day(Now())) and logDT >= '${balanceStartDT}' group by network, monthDT having days > 0`;
        groupsRecs = await this.poolREADONLY.query(sqln)
        data = [];
        keys = ["network", "monthDT"];
        for (const g of groupsRecs) {
            let out = [];
            let month = g.monthDT.toISOString().split('T')[0];
            out.push(`'${g['network']}'`);
            out.push(`'${month}'`);
            for (const v of vals) {
                out.push(`${mysql.escape(g[v])}`);
            }
            data.push(`(${out.join(",")})`);
        }
        await this.upsertSQL({
            "table": "networklogstats",
            keys,
            vals,
            data,
            replace: vals
        });
        console.log("updated", data.length, " networklogstats recs");

        // if chains have no archive node, then ignore balance computation for chains that are not ready
        let sql_ignore = `update blocklog t set updateAddressBalanceStatus = "Ignore", accountMetricsStatus = "Ignore" where updateAddressBalanceStatus in ("Ignore", "NotReady") and chainID in ( select chainID from chain where crawling = 1 and WSEndpointArchive = 0 ) and logDT >= "${balanceStartDT}"`
        this.batchedSQL.push(sql_ignore);
        await this.update_batchedSQL();

        // mark anything in blocklog "Audited" if "AuditRequested" and the numAddresses data is within 30% or 2 stddevs -- the rest will need manual review
        let sql_audit = `update blocklog, blocklogstats as s set updateAddressBalanceStatus = 'Audited' where blocklog.chainID = s.chainID and LAST_DAY(blocklog.logDT) = s.monthDT and
 updateAddressBalanceStatus = "AuditRequired" and logDT < date(Now()) and logDT >= '${balanceStartDT}' and  ( numAddresses > s.numAddresses_avg - s.numAddresses_std or numAddresses > s.numAddresses_avg * .7)
 and ( numAddresses < s.numAddresses_avg + s.numAddresses_std*2 or numAddresses < s.numAddresses_avg * 1.3)`;
        console.log(sql_audit);
        this.batchedSQL.push(sql_audit);
        await this.update_batchedSQL();

        // mark anything in blocklog.accountMetricsStatus="Audited" if "AuditRequested" and the numActiveAccounts data is reasonable in the same way -- the rest will need manual review
        let sql_audit_accountmetrics = `update blocklog, blocklogstats as s set accountMetricsStatus = 'Audited' where blocklog.chainID = s.chainID and LAST_DAY(blocklog.logDT) = s.monthDT and
 accountMetricsStatus = "AuditRequired" and logDT < date(Now()) and logDT >= '${balanceStartDT}' and
 ( numActiveAccounts > s.numActiveAccounts_avg - s.numActiveAccounts_std * 2 or numActiveAccounts > s.numActiveAccounts_avg * .7) and
 ( numActiveAccounts < s.numActiveAccounts_avg + s.numActiveAccounts_std*2 or numActiveAccounts < s.numActiveAccounts_avg * 1.3)`;
        this.batchedSQL.push(sql_audit);
        await this.update_batchedSQL();

        // mark a day as being Ready for account metrics computation if (a) the previous day and the day are both "Audited" (b) its "NotReady"
        let sql_ready = `update blocklog t, blocklog as p set t.accountMetricsStatus = "Ready" where p.logDT = date_sub(t.logDT, INTERVAL 1 day) and
  p.accountMetricsStatus in ( "Audited", "AuditRequired" ) and
  t.accountMetricsStatus = "NotReady" and
  p.updateAddressBalanceStatus in ("AuditRequired", "Audited") and
  t.updateAddressBalanceStatus in ("AuditRequired", "Audited") and
  t.logDT >= "${balanceStartDT}"`;
        this.batchedSQL.push(sql_ready);
        await this.update_batchedSQL();

        sql_tally = `select relayChain, chainID, chainName, paraID, crawling, id, crawlingStatus from chain where active=1`;
        let tallyRecs = await this.poolREADONLY.query(sql_tally);
        let chains = {};
        let relayChain_chains = {
            polkadot: 0,
            kusama: 0
        };
        for (const r of tallyRecs) {
            chains[r.chainID] = r;
            relayChain_chains[r.relayChain]++;

        }

        let sql_lastmetricDT = `select max(logDT) as logDT from networklog where networkmetricsStatus in ('Audited', 'AuditRequired') limit 1`;
        let metricRecs = await this.poolREADONLY.query(sql_lastmetricDT);
        let metricsDT = metricRecs[0].logDT.toISOString().split('T')[0];

        // generate summary[relayChain] map
        let summary = {}; // going out to polkaholic.json
        let assets = {}; // going out to individual files like polkadot/assets/DOT.json, one for each symbol
        let chainassets = {}; // going out to individual files like polkadot/0-assets.json, one for each paraID
        sql_tally = `select chain.relayChain, count(distinct paraID) numChains, max(endDT) endDT, round(sum(numBlocks_total)) numBlocks_total,
round(sum(( endBN - startBN + 1) - numBlocks_total)) as numBlocks_missing
from blocklogstats join chain on blocklogstats.chainID = chain.chainID  where monthDT >= "${birthDT}" and chain.relayChain in ("polkadot", "kusama") and
monthDT <= last_day(date(date_sub(Now(), interval 10 day))) group by relayChain order by relayChain desc`;
        tallyRecs = await this.poolREADONLY.query(sql_tally);
        for (const r of tallyRecs) {
            let endDT = r.endDT ? r.endDT.toISOString().split('T')[0] : "";
            let numBlocks_total = r.numBlocks_total ? parseInt(r.numBlocks_total, 10) : 0;
            let numBlocks_missing = r.numBlocks_missing ? parseInt(r.numBlocks_missing, 10) : 0;
            let numChains = r.numChains ? r.numChains : 0;
            summary[r.relayChain] = {
                relayChain: r.relayChain,
                endDT,
                numChains,
                numBlocks_total,
                numBlocks_missing,
                missing: [],
                chains: [],
                assets: []
            }
            assets[r.relayChain] = {};
            chainassets[r.relayChain] = {};
            // add assets for each relay chain from "assetholderrelaychain" to appear in the above summary for the relayChain
            let sql_assets = `select logDT, symbol, numHolders, numChains, free, freeUSD, reserved, reservedUSD, miscFrozen, miscFrozenUSD, frozen, frozenUSD, priceUSD from assetholderrelaychain where logDT = '${metricsDT}' and relayChain = '${r.relayChain}' order by freeUSD desc, numHolders desc`
            let assetRecs = await this.poolREADONLY.query(sql_assets);
            let logDT = null;
            console.log(sql_assets);
            for (const a of assetRecs) {
                logDT = a.logDT.toISOString().split('T')[0];
                a.url = `https://cdn.polkaholic.io/substrate-etl/${r.relayChain}/assets/${encodeURIComponent(encodeURIComponent(a.symbol))}.json`;
                console.log("ASSET", a.url);
                summary[r.relayChain].assets.push(a);
            }
            // prep the data for the {polkadot,kusama}/assets/DOT.json -- which will show the holder distribution across chains for the most recent day where we have all chain data
            let sql_xcmInteriorKey = `select symbol, relayChain, xcmInteriorKey from xcmasset where isXCMAsset = 1`;
            let symbol_xcmInteriorKeys = {};
            let xcRecs = await this.poolREADONLY.query(sql_xcmInteriorKey);
            for (const xc of xcRecs) {
                let symbolRelayChain = paraTool.makeAssetChain(xc.symbol, xc.relayChain);
                if (symbol_xcmInteriorKeys[symbolRelayChain] == undefined) {
                    symbol_xcmInteriorKeys[symbolRelayChain] = [];
                }
                symbol_xcmInteriorKeys[symbolRelayChain].push(paraTool.convertXcmInteriorKeyV1toV2(xc.xcmInteriorKey));
            }

            let sql_assetschain = `select a.symbol, a.chainID, a.asset, a.numHolders, a.free, a.freeUSD, a.reserved, a.reservedUSD, a.miscFrozen, a.miscFrozenUSD, a.frozen, a.frozenUSD, a.priceUSD, chain.paraID, chain.id, chain.chainName from assetholderchain a, chain where a.chainID = chain.chainID and logDT = '${logDT}' and a.chainID in ( select chainID from chain where relayChain = '${r.relayChain}' ) order by a.freeUSD desc, a.numHolders desc`
            let assetChainRecs = await this.poolREADONLY.query(sql_assetschain);
            for (const a of assetChainRecs) {
                let symbolRelayChain = paraTool.makeAssetChain(a.symbol, r.relayChain);
                let xcmInteriorKeys = symbol_xcmInteriorKeys[symbolRelayChain] ? symbol_xcmInteriorKeys[symbolRelayChain] : [];

                let paraID = paraTool.getParaIDfromChainID(a.chainID);
                if (assets[r.relayChain][a.symbol] == undefined) {
                    assets[r.relayChain][a.symbol] = {
                        logDT,
                        xcmInteriorKeys,
                        chains: []
                    };
                }
                if (chainassets[r.relayChain][paraID] == undefined) {
                    chainassets[r.relayChain][paraID] = {
                        logDT,
                        xcmInteriorKeys,
                        assets: []
                    };
                }
                assets[r.relayChain][a.symbol].chains.push(a);
                chainassets[r.relayChain][paraID].assets.push(a);
            }
        }

        sql_tally = `select chain.chainID, chain.id, chain.paraID, chain.relayChain, chain.paraID, chain.chainName, min(startDT) startDT, max(endDT) endDT, min(startBN) startBN, max(endBN) endBN, sum(numBlocks_total) numBlocks_total,
sum(( endBN - startBN + 1) - numBlocks_total) as numBlocks_missing,
Round(sum(numExtrinsics_avg)) as numSignedExtrinsics,
Round(max(numAddresses_avg)) as numAddresses,
sum(if(issues is not null, 1, 0)) as numIssues,
chain.crawlingStatus
from blocklogstats join chain on blocklogstats.chainID = chain.chainID where monthDT >= "${birthDT}" and chain.relayChain in ("polkadot", "kusama") and
monthDT <= last_day(date(date_sub(Now(), interval 1 day))) group by chainID order by relayChain desc, paraID asc`;
        console.log(sql_tally);
        tallyRecs = await this.poolREADONLY.query(sql_tally);
        for (const r of tallyRecs) {
            let relayChain = r.relayChain;
            if (summary[relayChain] == undefined) {
                summary[relayChain] = {
                    chains: [],
                    missing: []
                };
            }
            let desc = `[${r.chainName} Para ID ${r.paraID}](/substrate-etl/${r.relayChain}/${r.paraID}-${r.id})`
            let startDT = r.startDT ? r.startDT.toISOString().split('T')[0] : "";
            let endDT = r.endDT ? r.endDT.toISOString().split('T')[0] : "";
            let startBN = r.startBN ? r.startBN : null;
            let endBN = r.endBN ? r.endBN : null;
            let numBlocks_total = r.numBlocks_total ? parseInt(r.numBlocks_total, 10) : 0;
            let numBlocks_missing = r.numBlocks_missing ? parseInt(r.numBlocks_missing, 10) : 0;
            let numAddresses = r.numAddresses ? parseInt(r.numAddresses, 10) : 0;
            let url = `https://cdn.polkaholic.io/substrate-etl/${r.relayChain}/${r.paraID}.json`
            summary[relayChain].chains.push({
                id: r.id,
                chainID: r.chainID,
                paraID: r.paraID,
                chainName: r.chainName,
                startDT,
                endDT,
                startBN,
                endBN,
                numBlocks_total,
                numBlocks_missing,
                numAddresses,
                crawlingStatus: r.crawlingStatus,
                url
            })
            chains[r.chainID].covered = true;
        }

        for (const chainID of Object.keys(chains)) {
            if (chains[chainID].covered == undefined) {
                let c = chains[chainID];
                let desc = c.crawling > 0 ? "active and onboarding" : "active but not being indexed";
                summary[c.relayChain].missing.push({
                    chainName: c.chainName,
                    paraID: c.paraID,
                    crawlingStatus: c.crawlingStatus
                });
            }
        }
        let dir = "/tmp/substrate-etl";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
        }
        let f = fs.openSync(path.join(dir, "polkaholic.json"), 'w', 0o666);
        fs.writeSync(f, JSON.stringify(summary));

        // now for each chain, generate monthly then daily summary
        sql_tally = `select chain.chainID, chain.relayChain, chain.paraID, chain.id, chain.chainName, chain.isEVM, chain.isWASM, monthDT, year(monthDT) yr, startDT, endDT, startBN, endBN, numBlocks_total,
( endBN - startBN + 1) - numBlocks_total as numBlocks_missing,
numSignedExtrinsics_sum as numSignedExtrinsics,
round(numActiveAccounts_avg) as numActiveAccounts,
round(numPassiveAccounts_avg) as numPassiveAccounts,
round(numActiveAccountsEVM_avg) as numActiveAccountsEVM,
round(numPassiveAccountsEVM_avg) as numPassiveAccountsEVM,
round(numTransactionsEVM_avg) as numTransactionsEVM,
round(numEVMTransfers_avg) as numEVMTransfers,
round(numNewAccounts_avg) as numNewAccounts,
round(numAddresses_max) as numAddresses, issues, chain.crawlingStatus
from blocklogstats join chain on blocklogstats.chainID = chain.chainID where monthDT >= "${birthDT}" and monthDT <= last_day(date(Now())) and chain.relayChain in ("polkadot", "kusama") order by relayChain desc, paraID asc, monthDT desc`;
        tallyRecs = await this.poolREADONLY.query(sql_tally);
        let prevChainID = null;
        let prevStartBN = null;
        let j = {};
        let docs = {};
        let fn_chain = {};
        for (const r of tallyRecs) {
            let chainName = r.chainName;
            let chainID = r.chainID;
            let id = r.id;
            let paraID = r.paraID;
            let relayChain = r.relayChain;
            if (j[chainID] == undefined) {
                let subdir = path.join(dir, relayChain);
                if (!fs.existsSync(subdir)) {
                    fs.mkdirSync(subdir, {
                        recursive: true
                    });
                }
                fn_chain[chainID] = path.join(subdir, `${paraID}.json`);
                j[chainID] = {
                    chain: {
                        chainName,
                        chainID,
                        id,
                        paraID,
                        relayChain,
                        isEVM: r.isEVM,
                        isWASM: r.isWASM
                    },
                    assets: chainassets[relayChain][paraID],
                    monthly: [],
                    daily: []
                };
            }
            let monthDT = r.monthDT ? r.monthDT.toISOString().split('T')[0] : "";
            let startDT = r.startDT ? r.startDT.toISOString().split('T')[0] : "";
            let endDT = r.endDT ? r.endDT.toISOString().split('T')[0] : "";
            let startBN = r.startBN ? r.startBN : null;
            let endBN = r.endBN ? r.endBN : null;
            let numBlocks_total = r.numBlocks_total ? parseInt(r.numBlocks_total, 10) : 0;
            let numBlocks_missing = r.numBlocks_missing ? parseInt(r.numBlocks_missing, 10) : 0;
            prevChainID = chainID;
            let numSignedExtrinsics = r.numSignedExtrinsics ? parseInt(r.numSignedExtrinsics, 10) : 0;
            let numActiveAccounts = r.numActiveAccounts ? parseInt(r.numActiveAccounts, 10) : 0;
            let numPassiveAccounts = r.yr >= 2023 && r.numPassiveAccounts ? parseInt(r.numPassiveAccounts, 10) : null;
            let numNewAccounts = r.yr >= 2023 && r.numNewAccounts ? parseInt(r.numNewAccounts, 10) : null;
            let numAddresses = r.numAddresses ? parseInt(r.numAddresses, 10) : 0;
            let issues = r.issues ? r.issues : "";
            let m = {
                monthDT,
                startDT,
                endDT,
                startBN,
                endBN,
                numBlocks_total,
                numBlocks_missing,
                numSignedExtrinsics,
                numActiveAccounts,
                numPassiveAccounts,
                numNewAccounts,
                numAddresses,
                issues
            }
            if (r.isEVM) {
                m.numTransactionsEVM = r.numEVMTransactionsEVM;
                m.numEVMTransfers = r.numEVMTransfers;
                m.numActiveAccountsEVM = r.numActiveAccountsEVM;
                m.numPassiveAccountsEVM = r.numPassiveAccountsEVM;
            }
            j[chainID].monthly.push(m);
        }

        for (const relayChain of Object.keys(assets)) {
            for (const symbol of Object.keys(assets[relayChain])) {
                let subdir = path.join(dir, relayChain, "assets");
                if (!fs.existsSync(subdir)) {
                    fs.mkdirSync(subdir, {
                        recursive: true
                    });
                }
                let fn = path.join(subdir, `${encodeURIComponent(symbol)}.json`);
                let f = fs.openSync(fn, 'w', 0o666);
                fs.writeSync(f, JSON.stringify(assets[relayChain][symbol]));
            }
        }

        prevChainID = null;
        prevStartBN = null;
        sql_tally = `select chain.chainID, chain.relayChain, chain.paraID, chain.id, chain.chainName, chain.isEVM, logDT, last_day(logDT) as monthDT, Year(logDT) as yr, startBN, endBN, numBlocks,
( endBN - startBN + 1) - numBlocks as numBlocks_missing,
blocklog.numSignedExtrinsics,
blocklog.numActiveAccounts,
blocklog.numPassiveAccounts,
blocklog.numNewAccounts,
blocklog.numAddresses,
blocklog.numEvents,
blocklog.numTransfers,
blocklog.valueTransfersUSD,
blocklog.numActiveAccountsEVM,
blocklog.numPassiveAccountsEVM,
blocklog.numTransactionsEVM,
blocklog.numEVMTransfers,
blocklog.numXCMTransfersIn,
blocklog.numXCMTransfersOut,
blocklog.valXCMTransferIncomingUSD,
blocklog.valXCMTransferOutgoingUSD,
blocklog.numXCMMessagesIn,
blocklog.numXCMMessagesOut,
blocklog.numAccountsTransfersIn,
blocklog.numAccountsTransfersOut,
chain.crawlingStatus
from blocklog join chain on blocklog.chainID = chain.chainID where logDT <= date(Now()) and chain.relayChain in ("polkadot", "kusama") and logDT >= "${birthDT}" order by relayChain desc, paraID asc, logDT desc`;
        tallyRecs = await this.poolREADONLY.query(sql_tally);
        for (const r of tallyRecs) {
            let chainID = r.chainID;
            let id = r.id;
            let monthDT = r.monthDT.toISOString().split('T')[0];
            let paraID = r.paraID;
            let k = paraID;
            let relayChain = r.relayChain;
            let logDT = r.logDT ? r.logDT.toISOString().split('T')[0] : "";
            let startBN = r.startBN ? r.startBN : null;
            let endBN = r.endBN ? r.endBN : null;
            let issues = r.issues ? r.issues : "-";
            let valueTransfersUSD = r.valueTransfersUSD > 0 ? r.valueTransfersUSD : 0;
            let numBlocks = r.numBlocks ? r.numBlocks : 0;
            let numBlocks_missing = r.numBlocks_missing ? r.numBlocks_missing : 0;
            let numSignedExtrinsics = r.numSignedExtrinsics ? parseInt(r.numSignedExtrinsics, 10) : 0;
            let numActiveAccounts = r.numActiveAccounts ? parseInt(r.numActiveAccounts, 10) : 0;
            let numPassiveAccounts = r.numPassiveAccounts && r.yr >= 2023 ? parseInt(r.numPassiveAccounts, 10) : null;
            let numNewAccounts = r.numNewAccounts && r.yr >= 2023 ? parseInt(r.numNewAccounts, 10) : null;
            let numAddresses = r.numAddresses ? parseInt(r.numAddresses, 10) : 0;
            let numEvents = r.numEvents ? parseInt(r.numEvents, 10) : 0;
            let numTransfers = r.numTransfers ? parseInt(r.numTransfers, 10) : 0;
            let numXCMTransfersIn = r.numXCMTransfersIn ? parseInt(r.numXCMTransfersIn, 10) : 0;
            let numXCMTransfersOut = r.numXCMTransfersOut ? parseInt(r.numXCMTransfersOut, 10) : 0;
            let valXCMTransferIncomingUSD = r.valXCMTransferIncomingUSD > 0 ? r.valXCMTransferIncomingUSD : 0
            let valXCMTransferOutgoingUSD = r.valXCMTransferOutgoingUSD > 0 ? r.valXCMTransferOutgoingUSD : 0
            let numXCMMessagesIn = r.numXCMMessagesIn ? parseInt(r.numXCMMessagesIn, 10) : 0;
            let numXCMMessagesOut = r.numXCMMessagesOut ? parseInt(r.numXCMMessagesOut, 10) : 0;
            if (prevChainID == chainID) {
                if (prevStartBN && (prevStartBN != (r.endBN + 1)) && (r.endBN < prevStartBN)) {
                    if (fix) {
                        let sql = `update blocklog set loaded = 0 where chainID = ${chainID} and (logDT = '${logDT}' or logDT = Date(date_add("${logDT}", interval 1 day))) and ( LAST_DAY(logDT) = LAST_DAY(Now()) or LAST_DAY(logDT) = LAST_DAY(Date_sub(Now(), interval 1 day)) ) `;
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL();

                        console.log(`BROKEN DAILY CHAIN @ ${chainID} ${logDT} FIX:`, sql);
                    }
                    numBlocks_missing = null;
                }
            }
            if (j[chainID]) {
                let d = {
                    logDT,
                    monthDT,
                    startBN,
                    endBN,
                    numBlocks,
                    numBlocks_missing,
                    numSignedExtrinsics,
                    numActiveAccounts,
                    numPassiveAccounts,
                    numNewAccounts,
                    numAddresses,
                    numEvents,
                    numTransfers,
                    valueTransfersUSD,
                    numXCMTransfersIn,
                    valXCMTransferIncomingUSD,
                    numXCMTransfersOut,
                    valXCMTransferOutgoingUSD,
                    numXCMMessagesIn,
                    numXCMMessagesOut
                }
                if (r.isEVM) {
                    d.numTransactionsEVM = r.numTransactionsEVM;
                    d.numEVMTransfers = r.numEVMTransfers;
                    d.numActiveAccountsEVM = r.numActiveAccountsEVM;
                    d.numPassiveAccountsEVM = r.numPassiveAccountsEVM;
                }
                j[chainID].daily.push(d);
            } else {
                //console.log("MISSING", chainID);
            }
            prevStartBN = r.startBN;
            prevChainID = chainID;
        }
        for (const chainID of Object.keys(j)) {
            console.log("writing", fn_chain[chainID]);
            let f = fs.openSync(fn_chain[chainID], 'w', 0o666);
            fs.writeSync(f, JSON.stringify(j[chainID]));
        }


        let sql_networks = `select network, logDT, numAddresses, numReapedAccounts, numActiveAccounts, numNewAccounts from networklog where networkMetricsStatus in ("Audited", "AuditRequired") order by network, logDT desc`
        let recs = await this.poolREADONLY.query(sql_networks);
        summary = {}
        for (const r of recs) {
            if (summary[r.network] == undefined) {
                summary[r.network] = {
                    network: r.network,
                    monthly: [], // TODO
                    daily: []
                }
            }
            let logDT = r.logDT.toISOString().split('T')[0];
            summary[r.network].daily.push({
                logDT: logDT,
                numAddresses: r.numAddresses,
                numActiveAccounts: r.numActiveAccounts,
                numNewAccounts: r.numNewAccounts,
                numReapedAccounts: r.numReapedAccounts
            });
        }


        f = fs.openSync(path.join(dir, "networks.json"), 'w', 0o666);
        fs.writeSync(f, JSON.stringify(summary));

        if (invalidate) {
            let cmd = `gcloud compute url-maps invalidate-cdn-cache cdn-polkaholic-io  --path "/substrate-etl/*"`;
            console.log(cmd);
            await exec(cmd);
        }


        let cmd = `gsutil -m -h "Cache-Control: public, max-age=60" cp -r /tmp/substrate-etl gs://cdn.polkaholic.io/`
        console.log(cmd);
        await exec(cmd);

    }

    async dump_xcm_range(relayChain = "polkadot", startLogDT = null) {
        let ts = this.getCurrentTS();
        let hr = 0;
        if (startLogDT == null) {
            //startLogDT = (relayChain == "kusama") ? "2021-07-01" : "2022-05-04";
            [startLogDT, hr] = paraTool.ts_to_logDT_hr(ts - 86400 * 7);
        }
        try {
            while (true) {
                ts = ts - 86400;
                let [logDT, _] = paraTool.ts_to_logDT_hr(ts);
                await this.dump_xcm(relayChain, logDT);
                if (logDT == startLogDT) {
                    return (true);
                }
            }
        } catch (err) {
            console.log(err);
            return (false);
        }
    }

    async update_networklog(network, logDT, jobStartTS = 0) {
        let project = this.project;
        let sqla = {
            "accountsall": `select count(*) as numAddresses from substrate-etl.dotsama.accountsall where date(ts) = '${logDT}'`,
            "accountsnew": `select count(distinct address_pubkey) as numNewAccounts from substrate-etl.dotsama.accountsnew where date(ts) = '${logDT}'`,
            "accountsreaped": `select count(distinct address_pubkey) as numReapedAccounts from substrate-etl.dotsama.accountsreaped where date(ts) = '${logDT}'`,
            "accountsactive": `select count(*) as numActiveAccounts  from substrate-etl.dotsama.accountsactive where date(ts) = '${logDT}'`
        }

        console.log(sqla);
        let r = {}
        let vals = [];
        for (const k of Object.keys(sqla)) {
            let sql = sqla[k];
            let rows = await this.execute_bqJob(sql);
            let row = rows.length > 0 ? rows[0] : null;
            if (row) {
                for (const a of Object.keys(row)) {
                    r[a] = row[a] > 0 ? row[a] : 0;
                    vals.push(` ${a} = ${mysql.escape(row[a])}`);
                }
            }
        }
	let elapsedSeconds = this.getCurrentTS() - jobStartTS;
        vals.push(` loadDT=Now()`);
        vals.push(` networkMetricsStatus = "AuditRequired" `);
        vals.push(` networkMetricsElapsedSeconds = "${elapsedSeconds}" `);
        let sql = `update networklog set ` + vals.join(",") + `  where network = '${network}' and logDT = '${logDT}'`
        console.log(sql)
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async dump_networkmetrics(network, logDT) {
	let jobTS = this.getCurrentTS();
        let projectID = `${this.project}`
        if (network != "dotsama") {
            // not covering other networks yet
            return (false);
        }
        console.log(`dump_networkmetrics logDT=${logDT}`)
        let datasetID = 'dotsama'
        let bqjobs = []
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        let [prevDT, _p] = paraTool.ts_to_logDT_hr(logTS - 86400)
        let accountTbls = ["new", "reaped", "active", "all"]
        for (const tbl of accountTbls) {
            let tblName = `accounts${tbl}`
            let destinationTbl = `${datasetID}.${tblName}$${logYYYYMMDD}`
            let targetSQL, partitionedFld, cmd;
            switch (tbl) {
                case "active":
                    targetSQL = `With pk as
(SELECT address_pubkey,  count(distinct(para_id)) polkadot_active_cnt, 0 as kusama_active_cnt FROM \`substrate-etl.polkadot.accountsactive*\`
 WHERE DATE(ts) = "${currDT}" group by address_pubkey
 UNION ALL
 (SELECT address_pubkey, 0 as polkadot_active_cnt, count(distinct(para_id)) kusama_active_cnt FROM \`substrate-etl.kusama.accountsactive*\`
 WHERE DATE(ts) = "${currDT}" group by address_pubkey))
 select address_pubkey, TIMESTAMP_SECONDS(${logTS}) as ts, sum(polkadot_active_cnt) polkadot_active_cnt, sum(kusama_active_cnt) kusama_active_cnt from pk
 group by address_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;
                case "new":
                    targetSQL = `WITH currDayPolkadot AS (SELECT address_pubkey, count(distinct(para_id)) polkadot_network_cnt, min(ts) as ts FROM \`substrate-etl.polkadot.balances*\` WHERE DATE(ts) = "${currDT}" group by address_pubkey),
currDayKusama AS (SELECT address_pubkey,  count(distinct(para_id)) kusama_network_cnt, min(ts) as ts FROM \`substrate-etl.kusama.balances*\` WHERE DATE(ts) = "${currDT}" group by address_pubkey),
currDayAll as (SELECT ifNUll(currDayKusama.address_pubkey,currDayPolkadot.address_pubkey) as address_pubkey, ifNUll(currDayKusama.ts,currDayPolkadot.ts) as ts, ifNULL(polkadot_network_cnt, 0) as polkadot_network_cnt, ifNULL(kusama_network_cnt, 0) as kusama_network_cnt from currDayPolkadot full outer join currDayKusama on currDayPolkadot.address_pubkey = currDayKusama.address_pubkey),
prevDayPolkadot AS (SELECT address_pubkey,  count(distinct(para_id)) polkadot_network_cnt, min(ts) as ts FROM \`substrate-etl.polkadot.balances*\` WHERE DATE(ts) = "${prevDT}" group by address_pubkey),
prevDayKusama AS (SELECT address_pubkey,  count(distinct(para_id)) kusama_network_cnt, min(ts) as ts FROM \`substrate-etl.kusama.balances*\` WHERE DATE(ts) = "${prevDT}" group by address_pubkey),
prevDayAll as (SELECT ifNUll(prevDayKusama.address_pubkey,prevDayPolkadot.address_pubkey) as address_pubkey, ifNUll(prevDayKusama.ts,prevDayPolkadot.ts) as ts, ifNULL(polkadot_network_cnt, 0) as polkadot_network_cnt, ifNULL(kusama_network_cnt, 0) as kusama_network_cnt from prevDayPolkadot full outer join prevDayKusama on prevDayPolkadot.address_pubkey = prevDayKusama.address_pubkey)
select address_pubkey, polkadot_network_cnt, kusama_network_cnt, ts from currDayAll where address_pubkey not in (select address_pubkey from prevDayAll) order by polkadot_network_cnt desc;`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;

                case "reaped":
                    targetSQL = `WITH currDayPolkadot AS (SELECT address_pubkey, count(distinct(para_id)) polkadot_network_cnt, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts  FROM \`substrate-etl.polkadot.balances*\` WHERE DATE(ts) = "${currDT}" group by address_pubkey),
                    currDayKusama AS (SELECT address_pubkey,  count(distinct(para_id)) kusama_network_cnt, max(ts) as ts FROM \`substrate-etl.kusama.balances*\` WHERE DATE(ts) = "${currDT}" group by address_pubkey),
                    currDayAll as (SELECT ifNUll(currDayKusama.address_pubkey,currDayPolkadot.address_pubkey) as address_pubkey, ifNUll(currDayKusama.ts,currDayPolkadot.ts) as ts, ifNULL(polkadot_network_cnt, 0) as polkadot_network_cnt, ifNULL(kusama_network_cnt, 0) as kusama_network_cnt from currDayPolkadot full outer join currDayKusama on currDayPolkadot.address_pubkey = currDayKusama.address_pubkey),
                    prevDayPolkadot AS (SELECT address_pubkey,  count(distinct(para_id)) polkadot_network_cnt, max(ts) as ts FROM \`substrate-etl.polkadot.balances*\` WHERE DATE(ts) = "${prevDT}" group by address_pubkey),
                    prevDayKusama AS (SELECT address_pubkey,  count(distinct(para_id)) kusama_network_cnt, max(ts) as ts FROM \`substrate-etl.kusama.balances*\` WHERE DATE(ts) = "${prevDT}" group by address_pubkey),
                    prevDayAll as (SELECT ifNUll(prevDayKusama.address_pubkey,prevDayPolkadot.address_pubkey) as address_pubkey, ifNUll(prevDayKusama.ts,prevDayPolkadot.ts) as ts, ifNULL(polkadot_network_cnt, 0) as polkadot_network_cnt, ifNULL(kusama_network_cnt, 0) as kusama_network_cnt from prevDayPolkadot full outer join prevDayKusama on prevDayPolkadot.address_pubkey = prevDayKusama.address_pubkey)
                    select address_pubkey, polkadot_network_cnt, kusama_network_cnt, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts from prevDayAll where address_pubkey not in (select address_pubkey from currDayAll) group by address_pubkey, polkadot_network_cnt, kusama_network_cnt order by polkadot_network_cnt desc`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;

                case "all":
                    targetSQL = `SELECT
  IFNULL(currDayKusama.address_pubkey,currDayPolkadot.address_pubkey) AS address_pubkey,
  IFNULL(currDayKusama.ts,currDayPolkadot.ts) AS ts,
  IFNULL(polkadot_network_cnt, 0) AS polkadot_network_cnt,
  IFNULL(kusama_network_cnt, 0) AS kusama_network_cnt
 FROM (  SELECT address_pubkey, COUNT(DISTINCT(para_id)) polkadot_network_cnt, MIN(ts) AS ts  FROM \`substrate-etl.polkadot.balances*\` WHERE DATE(ts) = "${currDT}" GROUP BY address_pubkey) AS currDayPolkadot
 FULL OUTER JOIN (  SELECT    address_pubkey,    COUNT(DISTINCT(para_id)) kusama_network_cnt,    MIN(ts) AS ts  FROM    \`substrate-etl.kusama.balances*\`  WHERE    DATE(ts) = "${currDT}"  GROUP BY    address_pubkey) AS currDayKusama
 ON currDayPolkadot.address_pubkey = currDayKusama.address_pubkey`;
		partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;

                case "active":
                    break;

                case "passive":
                    break;
                default:

            }
        }
        let errloadCnt = 0;
        let isDry = false;
        for (const bqjob of bqjobs) {
            try {
                if (isDry) {
                    console.log(`\n\n [DRY] * ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                } else {
                    console.log(`\n\n* ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                    await exec(bqjob.cmd);
                }
            } catch (e) {
                errloadCnt++
                console.log("PROBLEM", e);
                this.logger.error({
                    "op": "dump_networkmetrics",
                    e
                })
            }
        }

        if (errloadCnt == 0 && !isDry) {
            await this.update_networklog(network, logDT, jobTS);
        }
    }

    getLogDTRange(startLogDT = null, endLogDT = null, isAscending = true){
        let startLogTS = paraTool.logDT_hr_to_ts(startLogDT, 0)
        let [startDT, _] = paraTool.ts_to_logDT_hr(startLogTS);
        if (startLogDT == null) {
            //startLogDT = (relayChain == "kusama") ? "2021-07-01" : "2022-05-04";
            startLogDT = "2023-02-01"
        }
        let ts = this.getCurrentTS();
        if (endLogDT != undefined) {
            let endTS = paraTool.logDT_hr_to_ts(endLogDT, 0) + 86400
            if (ts > endTS) ts = endTS
        }
        let logDTRange = []
        while (true) {
            ts = ts - 86400;
            let [logDT, _] = paraTool.ts_to_logDT_hr(ts);
            logDTRange.push(logDT)
            if (logDT == startDT) {
                 break;
            }
        }
        if (isAscending){
            return logDTRange.reverse();
        }else{
            return logDTRange
        }
    }

    async is_dump_ready(logDT, dumpType = 'accountmetrics', opt = {}) {
        let chainID = false
        let status = 'NotReady'
        if (opt.paraID != undefined && opt.relayChain != undefined){
            chainID = paraTool.getChainIDFromParaIDAndRelayChain(opt.paraID , opt.relayChain)
            opt.chainID = chainID
        }
        let sql = null
        let recs = []
        //accountMetricsStatus, updateAddressBalanceStatus, crowdloanMetricsStatus, sourceMetricsStatus, poolsMetricsStatus, identityMetricsStatus, loaded
        switch (dumpType){

            case "substrate-etl":
                // how to check if dump substrate-etl is ready?
                sql = `select UNIX_TIMESTAMP(logDT) indexTS, blocklog.chainID, chain.isEVM from blocklog, chain where blocklog.chainID = chain.chainID and blocklog.loaded >= 0 and logDT = '${logDT}' and ( loadAttemptDT is null or loadAttemptDT < DATE_SUB(Now(), INTERVAL POW(5, attempted) MINUTE) ) and chain.chainID = ${chainID} order by rand() limit 1`;
                recs = await this.poolREADONLY.query(sql);
                console.log("get_substrate-etl ready", sql);
                if (recs.length == 1) {
                    if (recs[0].loaded){
                        status = 'Loaded'
                    }else{
                        return (true);
                    }
                }
                break;
            case "balances":
                sql = `select updateAddressBalanceStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                if (recs.length == 1) {
                    status = recs[0].updateAddressBalanceStatus
                    if (status == 'Ready') return (true);
                }
                break;
            case "networkmetrics":
                // how to check if dump substrate-etl is ready?
                let _network = opt.network
                if (_network){
                    sql = `select UNIX_TIMESTAMP(logDT) indexTS, logDT, networklog.network, network.isEVM, networkMetricsStatus from networklog, network where network.network = networklog.network and logDT = '${logDT}' and network.network = '${_network}' limit 1`
                    recs = await this.poolREADONLY.query(sql);
                    console.log("networkmetrics ready sql", sql);
                    if (recs.length == 1) {
                        status = recs[0].networkMetricsStatus
                        if (status == 'Ready') return (true);
                    }
                }
                break;
            case "accountmetrics":
                sql = `select accountMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                if (recs.length == 1) {
                    status = recs[0].accountMetricsStatus
                    if (status == 'Ready') return (true);
                }
                break;
            case "relaychain_crowdloan":
                if (opt.relayChain){
                    if (opt.relayChain == 'polkadot') chainID = 0;
                    if (opt.relayChain == 'kusama') chainID = 2;
                    sql = `select crowdloanMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                    recs = await this.poolREADONLY.query(sql)
                    //console.log("relaychain_crowdloan ready sql", sql);
                    if (recs.length == 1) {
                        status = recs[0].crowdloanMetricsStatus
                        if (status == 'Ready') return (true);
                    }
                    break;
                }
            case "dotsama_crowdloan":
                sql = `select crowdloanMetricsStatus from blocklog where chainID in (0, 2) and logDT = '${logDT}';`
                recs = await this.poolREADONLY.query(sql)
                //console.log("dotsama_crowdloan ready sql", sql);
                if (recs.length == 2) {
                    let cnt = 0
                    for (const rec of recs){
                        status = rec.crowdloanMetricsStatus
                        if (rec.crowdloanMetricsStatus == "FirstStepDone"){
                            cnt++
                        }
                    }
                    //need both relaychain have "FirstStepDone" to initiate the aggregate step
                    if (cnt == 2) return (true);
                }
                break;
            case "sources":
                sql = `select sourceMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                if (recs.length == 1) {
                    status = recs[0].sourceMetricsStatus
                    if (status == 'Ready') return (true);
                }
                break;
            case "pools":
                sql = `select poolsMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                if (recs.length == 1) {
                    status = recs[0].poolsMetricsStatus
                    if (status == 'Ready') return (true);
                }
                break;
            case "idendity":
                sql = `select identityMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                if (recs.length == 1) {
                    status = recs[0].identityMetricsStatus
                    if (status == 'Ready') return (true);
                }
                break;
        }
        console.log(`dumpType=${dumpType} [OPT=${JSON.stringify(opt)}, DT=${logDT}] Status=${status}`)
        return (false);
    }

    async is_accountmetrics_ready(relayChain, paraID, logDT) {
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain)
        let sql = `select accountMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}' and accountMetricsStatus = 'Ready'`
        let recs = await this.poolREADONLY.query(sql)
        if (recs.length == 1) {
            return (true);
        }
        return (false);

    }

    async dump_dotsama_crowdloan(logDT) {
        let paraID = 0
        let projectID = `${this.project}`
        let bqDataset = (this.isProd)? `dotsama`: `dotsama_dev`
        let bqDataset_txra = (this.isProd)? ``: `_dev` //MK write to relay_dev for dev
        let bqjobs = []
        console.log(`dump_dotsama_crowdloan logDT=${logDT}, projectID=${projectID}, bqDataset=${bqDataset}, bqDataset_txra=${bqDataset_txra}`)

        // load new accounts
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        let [prevDT, _p] = paraTool.ts_to_logDT_hr(logTS - 86400)

        let accountTbls = ["accountscrowdloan"]

        for (const tbl of accountTbls) {
            let datasetID = bqDataset
            let tblName = `${tbl}`
            let destinationTbl = `${datasetID}.${tblName}$${logYYYYMMDD}`
            let targetSQL, partitionedFld, cmd;
            switch (tbl) {
                case "accountscrowdloan":
                    /* Crowdloan
                    With CrowdloanP as (SELECT contributor_pubkey, sum(contribution) contribution_p, sum(contribution_usd) contribution_value_usd_p,  ARRAY_TO_STRING(ARRAY_AGG(distinct(concat("polkadot-",paraID)) order by concat("polkadot-",paraID) asc),',') crowdloans_chains_p, ARRAY_TO_STRING(ARRAY_AGG((concat("0-",extrinsic_id)) order by concat("0-",extrinsic_id) asc ),',') crowdloans_extrinsic_id_p, count(distinct(paraID)) crowdloans_num_chains_p, count(*) crowdloans_num_contributions_p, max(ts) as last_contibution_ts_p FROM `substrate-etl.polkadot_dev.crowdloan` WHERE DATE(ts) = "2021-11-11" group by contributor_pubkey),
                    CrowdloanK as (SELECT contributor_pubkey, sum(contribution) contribution_k, sum(contribution_usd) contribution_value_usd_k,  ARRAY_TO_STRING(ARRAY_AGG(distinct(concat("kusama-",paraID)) order by concat("kusama-",paraID) asc ),',') crowdloans_chains_k, ARRAY_TO_STRING(ARRAY_AGG((concat("2-",extrinsic_id)) order by concat("2-",extrinsic_id) asc ),',') crowdloans_extrinsic_id_k, count(distinct(paraID)) crowdloans_num_chains_k, count(*) crowdloans_num_contributions_k, max(ts) as last_contibution_ts_k FROM `substrate-etl.kusama_dev.crowdloan` WHERE DATE(ts) = "2011-11-11" group by contributor_pubkey),
                    Crowdloan as (
                    select contributor_pubkey, sum(contribution_k) contribution_KSM, sum(contribution_p) contribution_DOT, sum(ifNull(contribution_value_usd_p,0)+ ifNull(contribution_value_usd_k,0)) contribution_value_usd, sum(ifNull(crowdloans_num_chains_p,0)+ ifNull(crowdloans_num_chains_k,0)) crowdloans_num_chains, sum(ifNull(crowdloans_num_contributions_p,0)+ ifNull(crowdloans_num_contributions_k,0)) crowdloans_num_contributions,
                    max(concat(if(crowdloans_chains_p is null,"empty", crowdloans_chains_p),if(crowdloans_chains_k is not null,concat(',',crowdloans_chains_k),''))) crowdloans_chains,
                    max(concat(if(crowdloans_extrinsic_id_p is null,"empty", crowdloans_extrinsic_id_p),if(crowdloans_extrinsic_id_k is not null,concat(',',crowdloans_extrinsic_id_k),''))) crowdloans_extrinsic_id,
                    max(IFNULL(last_contibution_ts_k, last_contibution_ts_p)) ts, max(IFNULL(last_contibution_ts_p, last_contibution_ts_k)) ts2
                    from CrowdloanP FULL OUTER JOIN CrowdloanK USING (contributor_pubkey) group by contributor_pubkey order by crowdloans_num_chains desc)
                    select contributor_pubkey as address_pubkey, contribution_KSM as crowdloan_contribution_KSM, contribution_DOT as crowdloan_contribution_DOT, contribution_value_usd as crowdloan_value_usd, crowdloans_num_chains, crowdloans_num_contributions, replace(crowdloans_chains,"empty,","") crowdloans_chains, replace(crowdloans_extrinsic_id,"empty,","") crowdloans_extrinsic_id, if(ts > ts2, ts, ts2) as ts from Crowdloan order by address_pubkey
                    */
                    targetSQL = `With CrowdloanP as (SELECT contributor_pubkey, sum(contribution) contribution_p, sum(contribution_usd) contribution_value_usd_p,  ARRAY_TO_STRING(ARRAY_AGG(distinct(concat("polkadot-",paraID)) order by concat("polkadot-",paraID) asc),",") crowdloans_chains_p, ARRAY_TO_STRING(ARRAY_AGG((concat("0-",extrinsic_id)) order by concat("0-",extrinsic_id) asc ),",") crowdloans_extrinsic_id_p, count(distinct(paraID)) crowdloans_num_chains_p, count(*) crowdloans_num_contributions_p, max(ts) as last_contibution_ts_p FROM \`${projectID}.polkadot${bqDataset_txra}.crowdloan\` WHERE DATE(ts) = "${currDT}" group by contributor_pubkey),
                    CrowdloanK as (SELECT contributor_pubkey, sum(contribution) contribution_k, sum(contribution_usd) contribution_value_usd_k,  ARRAY_TO_STRING(ARRAY_AGG(distinct(concat("kusama-",paraID)) order by concat("kusama-",paraID) asc ),",") crowdloans_chains_k, ARRAY_TO_STRING(ARRAY_AGG((concat("2-",extrinsic_id)) order by concat("2-",extrinsic_id) asc ),",") crowdloans_extrinsic_id_k, count(distinct(paraID)) crowdloans_num_chains_k, count(*) crowdloans_num_contributions_k, max(ts) as last_contibution_ts_k FROM \`substrate-etl.kusama${bqDataset_txra}.crowdloan\` WHERE DATE(ts) = "${currDT}" group by contributor_pubkey),
                    Crowdloan as (
                    select contributor_pubkey, sum(contribution_k) contribution_KSM, sum(contribution_p) contribution_DOT, sum(ifNull(contribution_value_usd_p,0)+ ifNull(contribution_value_usd_k,0)) contribution_value_usd, sum(ifNull(crowdloans_num_chains_p,0)+ ifNull(crowdloans_num_chains_k,0)) crowdloans_num_chains, sum(ifNull(crowdloans_num_contributions_p,0)+ ifNull(crowdloans_num_contributions_k,0)) crowdloans_num_contributions,
                    max(concat(if(crowdloans_chains_p is null,"empty", crowdloans_chains_p),if(crowdloans_chains_k is not null,concat(",",crowdloans_chains_k),""))) crowdloans_chains,
                    max(concat(if(crowdloans_extrinsic_id_p is null,"empty", crowdloans_extrinsic_id_p),if(crowdloans_extrinsic_id_k is not null,concat(",",crowdloans_extrinsic_id_k),""))) crowdloans_extrinsic_id,
                    max(IFNULL(last_contibution_ts_k, last_contibution_ts_p)) ts, max(IFNULL(last_contibution_ts_p, last_contibution_ts_k)) ts2
                    from CrowdloanP FULL OUTER JOIN CrowdloanK USING (contributor_pubkey) group by contributor_pubkey order by crowdloans_num_chains desc)
                    select contributor_pubkey as address_pubkey, contribution_KSM as crowdloan_contribution_KSM, contribution_DOT as crowdloan_contribution_DOT, contribution_value_usd as crowdloan_value_usd, crowdloans_num_chains, crowdloans_num_contributions, SPLIT(replace(crowdloans_chains,"empty,","")) crowdloans_chains, SPLIT(replace(crowdloans_extrinsic_id,"empty,","")) crowdloans_extrinsic_id, if(ts > ts2, ts, ts2) as ts from Crowdloan order by address_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;
                default:
            }
        }
        let errloadCnt = 0
        let isDry = false;
        for (const bqjob of bqjobs) {
            try {
                if (isDry) {
                    console.log(`\n\n [DRY] * ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                } else {
                    console.log(`\n\n* ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                    await exec(bqjob.cmd);
                }
            } catch (e) {
                errloadCnt++
                this.logger.error({
                    "op": "dump_dotsama_crowdloan",
                    e
                })
            }
        }
        if (errloadCnt == 0){
            let sql = `update blocklog set crowdloanMetricsStatus = 'AuditRequired' where chainID in (${paraTool.chainIDPolkadot}, ${paraTool.chainIDKusama}) and logDT = '${logDT}'`
            this.batchedSQL.push(sql);
        }
        await this.update_batchedSQL();
        return true
    }

    async dump_relaychain_crowdloan(relayChain, logDT) {
        let paraID = 0
        let projectID = `${this.project}`
        let bqDataset = (this.isProd)? `${relayChain}`: `${relayChain}_dev` //MK write to relay_dev for dev
        let bqjobs = []
        console.log(`dump_crowdloan logDT=${logDT}, ${relayChain}-${paraID}, projectID=${projectID}, bqDataset=${bqDataset}`)

        // load new accounts
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        let [prevDT, _p] = paraTool.ts_to_logDT_hr(logTS - 86400)

        let paraIDs = []
        let w = (paraID == 'all') ? "" : ` and paraID = '${paraID}'`;
        let sql = `select id, chainName, paraID, symbol, ss58Format, isEVM from chain where crawling = 1 and relayChain = '${relayChain}' order by paraID`
        let chainsRecs = await this.poolREADONLY.query(sql)
        let isEVMparaID = {};
        for (const chainsRec of chainsRecs) {
            paraIDs.push(chainsRec.paraID)
            isEVMparaID[chainsRec.paraID] = chainsRec.isEVM;
        }
        console.log(`${paraIDs.length} active ${relayChain} chains [${paraIDs}]`)

        let accountTbls = ["crowdloan"]

        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain)
        for (const tbl of accountTbls) {
            let datasetID = bqDataset
            let tblName = `${tbl}`
            let destinationTbl = `${datasetID}.${tblName}$${logYYYYMMDD}`
            let isEVM = isEVMparaID[paraID];

            let targetSQL, partitionedFld, cmd;
            switch (tbl) {
                case "crowdloan":
                    /* Crowdloan
                    WITH Crowdloan AS (SELECT extrinsic_id, event_id, concat(section,"(", method, ")") event_section_method,
                    Float64(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(2)], "$.dataRaw")) contribution,
                    Float64(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(2)], "$.dataUSD")) contribution_usd,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(2)], "$.symbol")) contribution_symbol,
                    INT64(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(1)], "$.data")) paraID,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(1)], "$.projectName")) projectName,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(0)], "$.address")) contributor_pubkey,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(0)], "$.data")) contributor
                    FROM `substrate-etl.kusama_dev.events0` WHERE DATE(block_time) = "2021-11-27" and section = "crowdloan" and method = "Contributed"),
                    Extrinsics as (SELECT `hash` as extrinsichash, extrinsic_id, block_time, concat(section, ":",method) extrinsic_section_method FROM `substrate-etl.kusama_dev.extrinsics0` WHERE DATE(block_time) = "2021-11-27")
                    select Crowdloan.extrinsic_id, extrinsichash, extrinsic_section_method, event_section_method, contributor_pubkey, contributor, paraID, projectName, contribution, contribution_usd, contribution_symbol, block_time as ts
                    from Crowdloan left join extrinsics on Crowdloan.extrinsic_id = Extrinsics.extrinsic_id order by contributor_pubkey
                    */
                    targetSQL = ` WITH Crowdloan AS (SELECT extrinsic_id, event_id, concat(section,"(", method, ")") event_section_method,
                    Float64(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(2)], "$.dataRaw")) contribution,
                    Float64(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(2)], "$.dataUSD")) contribution_usd,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(2)], "$.symbol")) contribution_symbol,
                    INT64(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(1)], "$.data")) paraID,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(1)], "$.projectName")) projectName,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(0)], "$.address")) contributor_pubkey,
                    String(json_extract(JSON_EXTRACT_ARRAY(data_decoded)[offset(0)], "$.data")) contributor FROM \`${projectID}.${bqDataset}.events${paraID}\` WHERE DATE(block_time) = "${currDT}" and section = "crowdloan" and method = "Contributed"),
                    Extrinsics as (SELECT \`hash\` as extrinsichash, extrinsic_id, block_time, concat(section, ":",method) extrinsic_section_method FROM \`${projectID}.${bqDataset}.extrinsics${paraID}\` WHERE DATE(block_time) = "${currDT}")
                    select Crowdloan.extrinsic_id, extrinsichash, extrinsic_section_method, event_section_method, contributor_pubkey, contributor, paraID, projectName, contribution, contribution_usd, contribution_symbol, block_time as ts from Crowdloan left join extrinsics on Crowdloan.extrinsic_id = Extrinsics.extrinsic_id order by contributor_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        chainID: chainID,
                        paraID: paraID,
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;
                default:

            }
        }
        let errloadCnt = 0
        let isDry = false;
        for (const bqjob of bqjobs) {
            try {
                if (isDry) {
                    console.log(`\n\n [DRY] * ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                } else {
                    console.log(`\n\n* ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                    await exec(bqjob.cmd);
                }
            } catch (e) {
                errloadCnt++
                this.logger.error({
                    "op": "dump_crowdloan",
                    e
                })
            }
        }
        if (errloadCnt == 0){
            let sql = `update blocklog set crowdloanMetricsStatus = 'FirstStepDone' where chainID = '${chainID}' and logDT = '${logDT}'`
            this.batchedSQL.push(sql);
        }
        await this.update_batchedSQL();
        return true
    }

    async dump_accountmetrics(relayChain, paraID, logDT) {
        console.log(`dump_accountmetrics logDT=${logDT}, ${relayChain}-${paraID}`)
        let projectID = `${this.project}`
        let bqjobs = []

        // load new accounts
	let jobTS = this.getCurrentTS();
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        let [prevDT, _p] = paraTool.ts_to_logDT_hr(logTS - 86400)

        let paraIDs = []
        let w = (paraID == 'all') ? "" : ` and paraID = '${paraID}'`;
        let sql = `select id, chainName, paraID, symbol, ss58Format, isEVM from chain where crawling = 1 and relayChain = '${relayChain}' order by paraID`
        let chainsRecs = await this.poolREADONLY.query(sql)
        let isEVMparaID = {};
        for (const chainsRec of chainsRecs) {
            paraIDs.push(chainsRec.paraID)
            isEVMparaID[chainsRec.paraID] = chainsRec.isEVM;
        }
        console.log(`${paraIDs.length} active ${relayChain} chains [${paraIDs}]`)

        let accountTbls = ["new", "old", "reaped", "active", "passive"]

        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain)
        for (const tbl of accountTbls) {
            let datasetID = `${relayChain}`
            let tblName = `accounts${tbl}`
            let destinationTbl = `${datasetID}.${tblName}${paraID}$${logYYYYMMDD}`
            let isEVM = isEVMparaID[paraID];

            let targetSQL, partitionedFld, cmd;
            switch (tbl) {
                case "new":
                    /* New User (by account)
                       WITH prevDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-08" group by address_ss58, address_pubkey),
                       currDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-09" group by address_ss58, address_pubkey)
                       SELECT "2000" as para_id, "polkadot" as relay_chain, address_ss58, address_pubkey, ts FROM currDay where address_ss58 not in (select address_ss58 from prevDay);
                    */
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey),
                            currDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey)
                            SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, ts FROM currDay where address_pubkey not in (select address_pubkey from prevDay) order by address_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        chainID: chainID,
                        paraID: paraID,
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;

                case "old":
                    /* Old User (by account)
                       WITH prevDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-08" group by address_ss58, address_pubkey),
                       currDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-09" group by address_ss58, address_pubkey)
                       SELECT "2000" as para_id, "polkadot" as relay_chain, address_ss58, address_pubkey, ts FROM currDay where address_ss58 in (select address_ss58 from prevDay);
                    */
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey),
                            currDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey)
                            SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, ts FROM prevDay where address_pubkey in (select address_pubkey from currDay) order by address_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    //bqjobs.push({chainID: chainID, paraID: paraID, tbl: tblName, destinationTbl: destinationTbl, cmd: cmd})
                    break;

                case "reaped":
                    /* Reaped Account (by probably need a flag for native chainAsset)
                       WITH prevDay AS (SELECT address_ss58, address_pubkey, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-08" group by address_ss58, address_pubkey),
                       currDay AS (SELECT address_ss58, address_pubkey, max(ts) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-09" group by address_ss58, address_pubkey)
                       SELECT "2000" as para_id, "polkadot" as relay_chain, address_ss58, address_pubkey, ts FROM currDay where address_ss58 not in (select address_ss58 from prevDay);
                    */
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey),
                     currDay AS (SELECT address_ss58, address_pubkey, max(ts) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey)
                SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, ts FROM prevDay where address_pubkey not in (select address_pubkey from currDay) order by address_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        chainID: chainID,
                        paraID: paraID,
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;

                case "assetreaped":
                    /*
                      WITH prevDay AS (SELECT address_ss58, address_pubkey, asset, concat(address_ss58, asset) address_asset, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-08" group by address_ss58, address_pubkey, asset),
                      currDay AS (SELECT address_ss58, address_pubkey, asset, concat(address_ss58, asset) address_asset, max(ts) as ts FROM `substrate-etl.polkadot.balances2000` WHERE DATE(ts) = "2023-02-09" group by address_ss58, address_pubkey, asset)
                      SELECT "2000" as para_id, "polkadot" as relay_chain, address_ss58, address_pubkey, asset, ts  FROM currDay where address_asset not in (select address_asset from prevDay) order by address_asset;
                    */
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, asset, concat(address_ss58, asset) address_asset, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey, asset),
                                currDay AS (SELECT address_ss58, address_pubkey, asset, concat(address_ss58, asset) address_asset, max(ts) as ts FROM \`substrate-etl.${relayChain}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey, asset)
                                SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, asset, ts FROM prevDay where address_asset not in (select address_asset from currDay) order by address_asset`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        chainID: chainID,
                        paraID: paraID,
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    break;
                case "active":
                    /* Active account (user + system)
                       SELECT "2000" as para_id, "polkadot" as relay_chain, address_ss58, address_pubkey, max(accountType) as accountType, Max(blockTime) as ts from
                       (WITH activeUserAccount AS (SELECT signer_ss58 as address_ss58, signer_pub_key as address_pubkey, "User" as accountType, Max(block_time) as block_time FROM `substrate-etl.kusama.extrinsics2000` WHERE DATE(block_time) = "2023-02-01" and signed = true group by address_ss58, address_pubkey),
                       activeSystemAccount AS (SELECT author_ss58 as address_ss58 , author_pub_key as address_pubkey, "System" as accountType, Max(block_time) as block_time FROM `substrate-etl.kusama.blocks2000` WHERE DATE(block_time) = "2023-02-01" group by address_ss58, address_pubkey) SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeSystemAccount group by address_ss58, address_pubkey UNION ALL (SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeUserAccount group by address_ss58, address_pubkey))
                       group by address_ss58, address_pubkey, para_id, relay_chain order by address_pubkey
                    */

                    targetSQL = `SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, max(accountType) as accountType, Max(blockTime) as ts from
                        (WITH activeUserAccount AS (SELECT signer_ss58 as address_ss58, signer_pub_key as address_pubkey, "User" as accountType, Max(block_time) as block_time
                              FROM \`substrate-etl.${relayChain}.extrinsics${paraID}\` WHERE DATE(block_time) = "${currDT}" and signed = true group by address_ss58, address_pubkey),
                            activeSystemAccount AS (SELECT author_ss58 as address_ss58 , author_pub_key as address_pubkey, "System" as accountType, Max(block_time) as block_time
                              FROM \`substrate-etl.${relayChain}.blocks${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey)
                          SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime
                              FROM activeSystemAccount
                              group by address_ss58, address_pubkey
                          UNION ALL
                         (SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime
                              FROM activeUserAccount
                              group by address_ss58, address_pubkey))
                         where address_ss58 is not null
                         group by address_ss58, address_pubkey, para_id, relay_chain order by address_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        chainID: chainID,
                        paraID: paraID,
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })
                    if (isEVM) {
                        let destinationTblEVM = `${datasetID}.accountsevmactive${paraID}$${logYYYYMMDD}`
                        targetSQL = `SELECT from_address, MAX(block_timestamp) as ts, count(*) transaction_count FROM \`substrate-etl.${relayChain}.evmtxs${paraID}\` where date(block_timestamp) = "${currDT}" group by from_address order by from_address`;
                        cmd = `bq query --destination_table '${destinationTblEVM}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                        bqjobs.push({
                            chainID: chainID,
                            paraID: paraID,
                            tbl: tblName,
                            destinationTbl: destinationTblEVM,
                            cmd: cmd
                        })
                    }
                    break;

                case "passive":
                    /* Passive Account
                   WITH AcctiveAccount AS (SELECT address_ss58, max(accountType) as accountType from
                   (WITH activeUserAccount AS (SELECT signer_ss58 as address_ss58, signer_pub_key as address_pubkey, "User" as accountType, Max(block_time) as block_time FROM `substrate-etl.kusama.extrinsics2004` WHERE DATE(block_time) = "2023-02-01" and signed = true group by address_ss58, address_pubkey),
                   activeSystemAccount AS (SELECT author_ss58 as address_ss58, author_pub_key as address_pubkey, "System" as accountType, Max(block_time) as block_time FROM `substrate-etl.kusama.blocks2004` WHERE DATE(block_time) = "2023-02-01" group by address_ss58, address_pubkey) SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeSystemAccount group by address_ss58, address_pubkey UNION ALL (SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeUserAccount group by address_ss58, address_pubkey)) group by address_ss58, address_pubkey),

                   TransferAccount AS (SELECT address_ss58, address_pubkey, Max(block_time) as block_time FROM (SELECT to_ss58 AS address_ss58, to_pub_key as address_pubkey, Max(block_time) as block_time FROM `substrate-etl.kusama.transfers2004` WHERE DATE(block_time) = "2023-02-01" group by address_ss58, address_pubkey union all SELECT from_ss58 AS address_ss58, from_pub_key as address_pubkey, Max(block_time) as block_time FROM `substrate-etl.kusama.transfers2004` WHERE DATE(block_time) = "2023-02-01" group by address_ss58, address_pubkey) group by address_ss58, address_pubkey)

                   SELECT "2000" as para_id, "polkadot" as relay_chain, address_ss58, address_pubkey, Max(block_time) as ts from TransferAccount where address_ss58 not in (select address_ss58 from AcctiveAccount) and address_ss58 is not null group by address_ss58, address_pubkey, para_id, relay_chain order by address_pubkey;
                */
                    targetSQL = ` WITH AcctiveAccount AS (SELECT address_ss58, max(accountType) as accountType from
                         (WITH activeUserAccount AS (SELECT signer_ss58 as address_ss58, signer_pub_key as address_pubkey, "User" as accountType, Max(block_time) as block_time FROM \`substrate-etl.${relayChain}.extrinsics${paraID}\` WHERE DATE(block_time) = "${currDT}" and signed = true group by address_ss58, address_pubkey),
                          activeSystemAccount AS (SELECT author_ss58 as address_ss58, author_pub_key as address_pubkey, "System" as accountType, Max(block_time) as block_time FROM \`substrate-etl.${relayChain}.blocks${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey) SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeSystemAccount group by address_ss58, address_pubkey UNION ALL (SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeUserAccount group by address_ss58, address_pubkey)) group by address_ss58, address_pubkey),

                        TransferAccount AS (SELECT address_ss58, address_pubkey, Max(block_time) as block_time FROM (SELECT to_ss58 AS address_ss58, to_pub_key as address_pubkey, Max(block_time) as block_time FROM \`substrate-etl.${relayChain}.transfers${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey union all SELECT from_ss58 AS address_ss58, from_pub_key as address_pubkey, Max(block_time) as block_time FROM \`substrate-etl.${relayChain}.transfers${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey) group by address_ss58, address_pubkey)

                        SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, Max(block_time) as ts from TransferAccount where address_ss58 not in (select address_ss58 from AcctiveAccount) and address_ss58 is not null group by address_ss58, address_pubkey, para_id, relay_chain order by address_pubkey;
                        `
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    bqjobs.push({
                        chainID: chainID,
                        paraID: paraID,
                        tbl: tblName,
                        destinationTbl: destinationTbl,
                        cmd: cmd
                    })

                    if (isEVM) {
                        /* Passive Evm
                        WITH AcctiveAccount AS (SELECT from_address as address, MAX(block_timestamp) as ts, count(*) transaction_count FROM `substrate-etl.polkadot.evmtxs2004` where date(block_timestamp) = "2023-02-15" group by address), TransferAccount as (SELECT to_address as address, Max(block_timestamp) as block_time FROM `substrate-etl.polkadot.evmtransfers2004` WHERE DATE(block_timestamp) = "2023-02-15" GROUP BY address union ALL (SELECT distinct from_address as address, Max(block_timestamp) as block_time from `substrate-etl.polkadot.evmtxs2004` where date(block_timestamp) = "2023-02-15"  GROUP BY address))
                        SELECT "2004" as para_id, "polkadot" as relay_chain, address, Max(block_time) as ts from TransferAccount where address not in (select address from AcctiveAccount) and address is not null group by address, para_id, relay_chain order by address;

                        */
                        let destinationTblEVM = `${datasetID}.accountsevmpassive${paraID}$${logYYYYMMDD}`
                        targetSQL = `WITH AcctiveAccount AS (SELECT from_address as address, MAX(block_timestamp) as ts, count(*) transaction_count FROM \`substrate-etl.${relayChain}.evmtxs${paraID}\` where date(block_timestamp) = "${currDT}" group by address),
                        TransferAccount as (SELECT to_address as address, Max(block_timestamp) as block_time FROM \`substrate-etl.${relayChain}.evmtransfers${paraID}\`
                        WHERE DATE(block_timestamp) = "${currDT}" GROUP BY address union ALL (SELECT distinct from_address as address, Max(block_timestamp) as block_time from \`substrate-etl.${relayChain}.evmtransfers${paraID}\` where date(block_timestamp) = "${currDT}"  GROUP BY address))

                        SELECT "${paraID}" as para_id, "polkadot" as relay_chain, address, Max(block_time) as ts from TransferAccount where address not in (select address from AcctiveAccount) and address is not null group by address, para_id, relay_chain order by address;`;
                        cmd = `bq query --destination_table '${destinationTblEVM}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                        bqjobs.push({
                            chainID: chainID,
                            paraID: paraID,
                            tbl: destinationTblEVM,
                            destinationTbl: destinationTblEVM,
                            cmd: cmd
                        })
                    }
                    break;

                default:

            }
        }
        let errloadCnt = 0
        let isDry = false;
        for (const bqjob of bqjobs) {
            try {
                if (isDry) {
                    console.log(`\n\n [DRY] * ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                } else {
                    console.log(`\n\n* ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                    await exec(bqjob.cmd);
                }
            } catch (e) {
                errloadCnt++
                this.logger.error({
                    "op": "dump_accountmetrics",
                    e
                })
            }
        }
        if (errloadCnt == 0 && !isDry) {
            await this.update_blocklog(chainID, logDT);
            //update loadAccountMetricsDT, loadedAccountMetrics, accountMetricsStatus to "AuditRequired"
	    let elapsedSeconds = this.getCurrentTS() - jobTS;
            let sql_upd = `update blocklog set loadedAccountMetrics = 1, loadAccountMetricsDT=Now(), accountMetricsStatus = "AuditRequired", accountMetricsElapsedSeconds = '${elapsedSeconds}' where chainID = '${chainID}' and logDT = '${logDT}'`
            this.batchedSQL.push(sql_upd);

            // add new network logs -- TODO: remove AuditRequired
            let sql_networklog = `insert ignore into networklog ( network, logDT, networkMetricsStatus ) (select "dotsama", logDT, "Ready" from blocklog where logDT >= "${balanceStartDT}" group by logDT having sum(if(accountMetricsStatus in ("Audited", "AuditRequired"), 1, 0)) = sum(if(accountMetricsStatus!="Ignore", 1, 0)) )`
            this.batchedSQL.push(sql_networklog);
            await this.update_batchedSQL();

        }
        bqjobs = []
        await this.update_batchedSQL();
        return true
    }

    async dump_xcm(relayChain = "polkadot", logDT = "2022-12-29") {

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
        let fn = path.join(dir, `${tbl}-${relayChain}-${logDT}.json`)
        let f = fs.openSync(fn, 'w', 0o666);
        let bqDataset = (this.isProd)? `${relayChain}`: `${relayChain}_dev` //MK write to relay_dev for dev
        let logDTp = logDT.replaceAll("-", "")
        let xcmtransfers = [];
        let NL = "\r\n";
        // 3. map into canonical form
        xcmtransferRecs.forEach((r) => {

            try {
                let xcmInfo = JSON.parse(r.xcmInfo)
                let o = xcmInfo.origination;
                let d = xcmInfo.destination;
                if (o && d && o.sender) {
                    let destination_execution_status = (r.destStatus == 1 || (d.executionStatus == "success" || d.amountReceived > 0)) ? "success" : "unknown";

                    xcmtransfers.push({
                        symbol: r.symbol, // xcmInfo.symbol
                        //xcm_interior_key: (xcmInfo.xcmInteriorKey != undefined)? xcmInfo.xcmInteriorKey: null,
                        //xcm_interior_keys_unregistered: (xcmInfo.xcm_interior_keys_unregistered != undefined)? xcmInfo.xcm_interior_keys_unregistered: null,
                        price_usd: r.priceUSD, // xcmInfo.priceUSD
                        origination_transfer_index: r.transferIndex, // should be o.transferIndex?
                        origination_xcm_index: r.xcmIndex, // should be o.xcmIndex?
                        origination_id: o.id,
                        origination_para_id: o.paraID,
                        origination_chain_name: o.chainName,
                        origination_sender_ss58: o.sender,
                        origination_sender_pub_key: paraTool.getPubKey(o.sender),
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
                        origination_is_fee_item: r.isFeeItem ? true : false, // TODO: o.isFeeItem
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
                        // TODO: if origination_is_fee_item == false then these fields should null
                        destination_teleport_fee: d.teleportFee,
                        destination_teleport_fee_usd: d.teleportFeeUSD,
                        destination_teleport_fee_symbol: r.symbol,
                        destination_chain_name: d.chainName,
                        destination_beneficiary_ss58: d.beneficiary,
                        destination_beneficiary_pub_key: paraTool.getPubKey(d.beneficiary),
                        destination_extrinsic_id: d.extrinsicID,
                        destination_event_id: d.eventID,
                        destination_block_number: d.blockNumber,
                        destination_ts: d.ts,
                        destination_execution_status: destination_execution_status,
                        xcm_info: xcmInfo,
                        xcm_info_last_update_time: r.lastUpdateTS,
                    });
                } else {
                    console.log("BAD xcmtransfer xcmInfo", r.extrinsicHash, xcmInfo)
                }

            } catch (e) {
                console.log(e)
            }
        });
        xcmtransfers.forEach((e) => {
            fs.writeSync(f, JSON.stringify(e) + NL);
        });
        // 4. load into bq
        let projectID = `${this.project}`
        let cmd = `bq load --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}$${logDTp}' ${fn} schema/substrateetl/${tbl}.json`;
        try {
            console.log(cmd);
            await exec(cmd);
        } catch (err) {
            console.log("XCMTRANSFERS Load ERR", cmd, err);
        }

        // same as above, except for xcm dataset
        let sql_xcm = `select msgHash, chainID, chainIDDest, relayedAt, includedAt, msgType, blockTS, CONVERT(msgStr using utf8) as msg, CONVERT(msgHex using utf8) as msgHex, version, xcmInteriorKeys, xcmInteriorKeysUnregistered from xcm where blockTS >= UNIX_TIMESTAMP(DATE("${logDT}")) and blockTS < UNIX_TIMESTAMP(DATE_ADD("${logDT}", INTERVAL 1 DAY)) and relayChain = '${relayChain}' order by blockTS;`
        let xcmRecs = await this.poolREADONLY.query(sql_xcm)
        tbl = "xcm";
        fn = path.join(dir, `${tbl}-${relayChain}-${logDT}.json`)
        f = fs.openSync(fn, 'w', 0o666);
        let xcm = [];
        xcmRecs.forEach((x) => {
            try {
                let xcmInteriorKeys = x.xcmInteriorKeys ? JSON.parse(x.xcmInteriorKeys) : null;
                let xcmInteriorKeysUnregistered = x.xcmInteriorKeysUnregistered ? JSON.parse(x.xcmInteriorKeysUnregistered) : null;
                let xcm = {
                    msg_hash: x.msgHash,
                    origination_para_id: paraTool.getParaIDfromChainID(x.chainID),
                    destination_para_id: paraTool.getParaIDfromChainID(x.chainIDDest),
                    relayed_at: x.relayedAt,
                    included_at: x.includedAt,
                    msg_type: x.msgType,
                    origination_ts: x.blockTS,
                    msg: x.msg,
                    msg_hex: x.msgHex,
                    version: x.version,
                    xcm_interior_keys: xcmInteriorKeys,
                    xcm_interior_keys_unregistered: xcmInteriorKeysUnregistered
                }
                fs.writeSync(f, JSON.stringify(xcm) + NL);
            } catch (e) {
                console.log(e)
            }
        });
        cmd = `bq load --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}$${logDTp}' ${fn} schema/substrateetl/${tbl}.json`;
        try {
            console.log(cmd);
            await exec(cmd);
        } catch (err) {
            console.log("XCM Load ERR", cmd, err);
        }
    }

    async update_xcm_summary(relayChain, logDT) {
        let [today, _] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
        let project = this.project;
        let sqla = {
            "xcmtransfers0": `select  date(origination_ts) logDT, destination_para_id as paraID, count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from substrate-etl.${relayChain}.xcmtransfers where DATE(origination_ts) >= "${logDT}" group by destination_para_id, logDT having logDT < "${today}" order by logDT`,
            "xcmtransfers1": `select date(origination_ts) as logDT, origination_para_id as paraID, count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from substrate-etl.${relayChain}.xcmtransfers where DATE(origination_ts) >= "${logDT}" group by origination_para_id, logDT having logDT < "${today}" order by logDT`,
            "xcm0": `select  date(origination_ts) logDT, destination_para_id as paraID, count(*) as numXCMMessagesIn from substrate-etl.${relayChain}.xcm where DATE(origination_ts) >= "${logDT}" group by destination_para_id, logDT having logDT < "${today}" order by logDT`,
            "xcm1": `select date(origination_ts) as logDT, origination_para_id as paraID, count(*) as numXCMMessagesOut from substrate-etl.${relayChain}.xcm where DATE(origination_ts) >= "${logDT}" group by origination_para_id, logDT having logDT < "${today}" order by logDT`,
        }

        let r = {}
        for (const k of Object.keys(sqla)) {
            let sql = sqla[k];
            try {
                let rows = await this.execute_bqJob(sql);
                console.log(sql, rows.length, " rows");

                for (const row of rows) {
                    let vals = [];
                    let logDTa = row["logDT"].value;
                    let chainID = paraTool.getChainIDFromParaIDAndRelayChain(row.paraID, relayChain);
                    let sql = false;
                    if (k == "xcmtransfers0") {
                        sql = `update blocklog set numXCMTransfersIn = ${mysql.escape(row.numXCMTransfersIn)}, valXCMTransferIncomingUSD = ${mysql.escape(row.valXCMTransferIncomingUSD)} where chainID = '${chainID}' and logDT = '${logDTa}'`
                    } else if (k == "xcmtransfers1") {
                        sql = `update blocklog set numXCMTransfersOut = ${mysql.escape(row.numXCMTransfersOut)}, valXCMTransferOutgoingUSD = ${mysql.escape(row.valXCMTransferOutgoingUSD)} where chainID = '${chainID}' and logDT = '${logDTa}'`
                    } else if (k == "xcm0") {
                        sql = `update blocklog set numXCMMessagesIn = ${mysql.escape(row.numXCMMessagesIn)} where chainID = '${chainID}' and logDT = '${logDTa}'`
                    } else if (k == "xcm1") {
                        sql = `update blocklog set numXCMMessagesOut = ${mysql.escape(row.numXCMMessagesOut)} where chainID = '${chainID}' and logDT = '${logDTa}'`
                    }
                    if (sql) {
                        console.log(sql);
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL();
                    }
                }
            } catch (err) {
                console.log(err);
            }
        }

        // take the 7/30d/all time view
        var ranges = [7, 30, 99999];
        for (const range of ranges) {
            let f = (range > 9999) ? "" : `${range}d`;
            let sql0 = `select chainID, sum(numXCMTransfersIn) as numXCMTransferIncoming, sum(valXCMTransferIncomingUSD) as valXCMTransferIncomingUSD, sum(numXCMTransfersOut) as numXCMTransferOutgoing, sum(valXCMTransferOutgoingUSD) as valXCMTransferOutgoingUSD from blocklog where logDT >= DATE_SUB(Now(), interval ${range} DAY) group by chainID`
            console.log(sql0);
            let stats = await this.poolREADONLY.query(sql0)
            let out = [];
            for (const s of stats) {
                console.log(s);
                let numXCMTransferIncoming = s.numXCMTransferIncoming ? s.numXCMTransferIncoming : 0;
                let numXCMTransferOutgoing = s.numXCMTransferOutgoing ? s.numXCMTransferOutgoing : 0;
                let valIncoming = s.valXCMTransferIncomingUSD ? s.valXCMTransferIncomingUSD : 0;
                let valOutgoing = s.valXCMTransferOutgoingUSD ? s.valXCMTransferOutgoingUSD : 0;
                out.push([`('${s.chainID}', '${numXCMTransferIncoming}', '${valIncoming}', '${numXCMTransferOutgoing}', '${valOutgoing}')`])
            }
            let vals = [`numXCMTransferIncoming${f}`, `valXCMTransferIncomingUSD${f}`, `numXCMTransferOutgoing${f}`, `valXCMTransferOutgoingUSD${f}`]
            await this.upsertSQL({
                "table": "chain",
                "keys": ["chainID"],
                "vals": vals,
                "data": out,
                "replace": vals
            }, true);
        }

    }


    daysago(logDT) {
        let indexTS = paraTool.logDT_hr_to_ts(logDT, 0);
        let currentTS = this.getCurrentTS();
        let daysago = Math.floor((currentTS - indexTS) / 86400)
        return (daysago);
    }

    async mark_crawl_block(chainID, bn) {
        let sql0 = `update block${chainID} set crawlBlock = 1, attempted = 0 where blockNumber = ${bn} and attempted < 127`
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL()
    }

    async dump_substrateetl_range(paraID = 2000, relayChain = "polkadot", isEVM = 0, startLogDT = null) {
        let ts = this.getCurrentTS();
        let [currDT, _c] = paraTool.ts_to_logDT_hr(ts);
        if (startLogDT == null) {
            startLogDT = (relayChain == "kusama") ? "2021-12-18" : "2021-12-18";
        }
        console.log(`dump_substrateetl_range, paraID=${paraID}, relayChain=${relayChain}, isEVM=${isEVM}, startLogDT=${startLogDT}, currDT=${currDT}`)
        let startLogTS = paraTool.logDT_hr_to_ts(startLogDT, 0)
        let [startDT, _s] = paraTool.ts_to_logDT_hr(startLogTS);
        try {
            while (true) {
                ts = ts - 86400;
                let [logDT, _] = paraTool.ts_to_logDT_hr(ts);
                console.log(`dump_substrateetl logDT=${logDT}, paraID=${paraID}, relayChain=${relayChain}, isEVM=${isEVM}`)
                await this.dump_substrateetl(logDT, paraID, relayChain, isEVM)
                if (startDT == logDT) {
                    return (true);
                }
            }
        } catch (err) {
            console.log(err);
            return (false);
        }
    }

    async dump_substrateetl(logDT = "2022-12-29", paraID = 2000, relayChain = "polkadot") {
        let projectID = `${this.project}`
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let chain = await this.getChain(chainID);
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs"] // TODO: put  "specversions" back
        console.log(`dump_substrateetl paraID=${paraID}, relayChain=${relayChain}, chainID=${chainID}, logDT=${logDT} (projectID=${projectID}), tbls=${tbls}`)
        if (chain.isEVM) {
            tbls.push("evmtxs");
            tbls.push("evmtransfers");
        }
        // 1. get bnStart, bnEnd for logDT
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        logDT = currDT // this will support both logYYYYMMDD and logYYYY-MM-DD format

        let minLogDT = `${logDT} 00:00:00`;
        let maxLogDT = `${logDT} 23:59:59`;
        let sql1 = `select min(blockNumber) bnStart, max(blockNumber) bnEnd from block${chainID} where blockDT >= '${minLogDT}' and blockDT <= '${maxLogDT}'`
        console.log(sql1);
        let bnRanges = await this.poolREADONLY.query(sql1)
        let {
            bnStart,
            bnEnd
        } = bnRanges[0];
        let expected = {}
        // 2. setup directories for tbls on date
        let dir = "/tmp";
        let fn = {}
        let f = {}
        for (const tbl of tbls) {
            fn[tbl] = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
            console.log("openSync", fn[tbl]);
            f[tbl] = fs.openSync(fn[tbl], 'w', 0o666);
        }
        let bqDataset = (this.isProd)? `${relayChain}`: `${relayChain}_dev` //MK write to relay_dev for dev

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
        let found = {};
        this.publish = 0;
        for (let bn0 = bnStart; bn0 <= bnEnd; bn0 += jmp) {
            let bn1 = bn0 + jmp - 1;
            if (bn1 > bnEnd) bn1 = bnEnd;
            let start = paraTool.blockNumberToHex(bn0);
            let end = paraTool.blockNumberToHex(bn1);
            console.log("FETCHING", bn0, bn1);
            let [rows] = await tableChain.getRows({
                start: start,
                end: end
            });
            for (const row of rows) {
                let r = this.build_block_from_row(row);
                let b = r.feed;
                let bn = parseInt(row.id.substr(2), 16);
                let [logDT0, hr] = paraTool.ts_to_logDT_hr(b.blockTS);
                //console.log("processing:", bn, b.blockTS, logDT0, hr);
                let hdr = b.header;
                if (r.fork || (!hdr || hdr.number == undefined) || (logDT != logDT0)) {
                    let rowId = paraTool.blockNumberToHex(bn);
                    if (r.fork) console.log("FORK!!!! DELETE ", bn, rowId);
                    if ((!hdr || hdr.number == undefined)) console.log("PROBLEM - missing hdr: ", `./polkaholic indexblock ${chainID} ${bn}`);
                    if (logDT != logDT0) console.log("ERROR: mismatch ", b.blockTS, logDT0, " does not match ", logDT);
                    await tableChain.row(rowId).delete();
                    continue;
                }
                found[hdr.number] = true;

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
                let evmtxs = [];
                let evmtransfers = [];
                if (r.evmFullBlock) {
                    let gWei = 10 ** 9
                    let ether = 10 ** 18
                    let cumulative_gas_used = 0;
                    let eb = r.evmFullBlock;
                    /*
                    value: value / ether,
                    txType: dTxn.type,
                    fee: fee / ether,
                    burnedFee: burnedFee / ether,
                    txnSaving: txnSaving / ether,
                    gasLimit: gasLimit,
                    gasUsed: gasUsed,
                    cumulativeGasUsed: cumulativeGasUsed,
                    maxFeePerGas: maxFeePerGas / gWei,
                    maxPriorityFeePerGas: maxPriorityFeePerGas / gWei,
                    effectiveGasPrice: effectiveGasPrice / gWei,
                    baseFeePerGas: baseFeePerGas / gWei,
                    gasPrice: gasPrice / gWei,

                    the following values in are stored in terms of gWei: maxFeePerGas, maxPriorityFeePerGas, effectiveGasPrice, gasPrice (extra: baseFeePerGas)
                    the following values in are stored in terms of ether: value (extra: fee, burnedFee, txnSaving)
                    */
                    eb.transactions.forEach((tx) => {
                        //console.log(`tx!! ${tx.effectiveGasPrice}`, tx)
                        let i = tx.decodedInput ? tx.decodedInput : null;
                        let gasUsed = tx.gasUsed ? tx.gasUsed : 0
                        let txType = (tx.txType != undefined) ? tx.txType : -1

                        cumulative_gas_used += gasUsed
                        let evmtx = {
                            //id: id,
                            //para_id: paraID,
                            hash: tx.transactionHash,
                            nonce: tx.nonce,
                            transaction_index: tx.transactionIndex,
                            from_address: tx.from,
                            to_address: tx.to,
                            value: paraTool.floatToInt(tx.value * ether),
                            gas: tx.gasLimit,
                            gas_price: paraTool.floatToInt(tx.gasPrice * gWei),
                            input: tx.input,
                            receipt_cumulative_gas_used: cumulative_gas_used,
                            receipt_gas_used: gasUsed, // receipt_gas_used
                            receipt_contract_address: tx.creates ? tx.creates : null,
                            // receipt_root (irrelevant val from pre Byzantium)
                            receipt_status: tx.status ? 1 : 0,
                            block_timestamp: tx.timestamp,
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
                            //                            base_fee_per_gas: tx.baseFeePerGas, // this is not real value
                            extrinsic_id: tx.substrate ? tx.substrate.extrinsicID : null,
                            extrinsic_hash: tx.substrate ? tx.substrate.extrinsicHash : null,
                            access_list: (tx.accessList != undefined) ? tx.accessList : null,
                            method_id: i && i.methodID ? i.methodID : null,
                            signature: i && i.signature ? i.signature : null,
                            params: i && i.params ? i.params : null
                        }
                        if (txType == 2) {

                            //1559 (as gWei)
                            evmtx.max_fee_per_gas = paraTool.floatToInt(tx.maxFeePerGas * gWei)
                            evmtx.max_priority_fee_per_gas = paraTool.floatToInt(tx.maxPriorityFeePerGas * gWei)
                            evmtx.txn_saving = (tx.txn_saving != undefined) ? paraTool.floatToInt(tx.txn_saving * ether) : 0
                        }
                        // use the value directly after reindexing
                        if (tx.cumulativeGasUsed) {
                            evmtx.receipt_cumulative_gas_used = tx.cumulativeGasUsed
                        }
                        if (tx.effectiveGasPrice) {
                            evmtx.receipt_effective_gas_price = paraTool.floatToInt(tx.effectiveGasPrice * gWei)

                        }
                        evmtxs.push(evmtx);

                        let transfers = tx.transfers;
                        transfers.forEach((t) => {
                            let transferType = t.type
                            let tokenIDs = null
                            let tokenValues = null
                            let operator = null
                            let value = t.value
                            if (transferType == "ERC1155") {
                                tokenIDs = t.tokenIds
                                tokenValues = t.values
                                operator = t.operator
                                value = null
                            }
                            let evmtransfer = {
                                token_address: t.tokenAddress,
                                from_address: t.from,
                                to_address: t.to,
                                value: value,
                                operator: operator,
                                token_ids: tokenIDs,
                                token_values: tokenValues,
                                transaction_hash: tx.transactionHash,
                                log_index: (tx.logIndex != undefined) ? tx.logIndex : -1,
                                block_timestamp: tx.timestamp,
                                block_number: tx.blockNumber,
                                block_hash: tx.blockHash ? tx.blockHash : "",
                                transfer_type: transferType,
                            }
                            evmtransfers.push(evmtransfer);
                        });
                    });
                }

                let events = [];

                let extrinsics = [];
                for (const ext of b.extrinsics){
                    for (const ev of ext.events){
                        let dEvent = await this.decorateEvent(ev, chainID, block.block_time, true, ["data", "address", "usd"], false)
                        //console.log(`${e.eventID} decoded`, dEvent)
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
                            data: ev.data,
                            data_decoded: (dEvent && dEvent.decodedData != undefined)? dEvent.decodedData: null,
                        }
                        events.push(bqEvent);
                        block.event_count++;
                    }
                    if (ext.transfers) {
                        for (const t of ext.transfers){
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
                            transfers.push(bqTransfer);
                        }
                        ext.transfers.forEach((t) => {
                            transfers.push();
                            block.transfer_count++; //MK: review transfer definition. should it be transfer count or num extrinsic that has transfer?
                        });
                    }
                    let feeUSD = await this.computeExtrinsicFeeUSD(ext)
                    let bqExtrinsic = {
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
                        fee_usd: feeUSD,
                        //amounts: null
                        //amount_usd: null,
                        weight: (ext.weight != undefined)? ext.weight: null, // TODO: ext.weight,
                        signed: ext.signer ? true : false,
                        signer_ss58: ext.signer ? ext.signer : null,
                        signer_pub_key: ext.signer ? paraTool.getPubKey(ext.signer) : null
                    }
                    //console.log(`bqExtrinsic`, bqExtrinsic)
                    extrinsics.push(bqExtrinsic);
                }
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
                        if (typeof e.section == "string" && typeof e.method == "string") {
                            fs.writeSync(f["extrinsics"], JSON.stringify(e) + NL);
                        } else {
                            console.log(`++e`, e)
                            console.log(`update chain${chainID} set crawlBlock = 1, attempted=0  where blockNumber = ${e.block_number};`);
                        }
                    });
                }
                // write transfers
                if (transfers.length > 0) {
                    transfers.forEach((t) => {
                        fs.writeSync(f["transfers"], JSON.stringify(t) + NL);
                    });
                }

                // write evmtxs
                if (evmtxs.length > 0) {
                    evmtxs.forEach((t) => {
                        fs.writeSync(f["evmtxs"], JSON.stringify(t) + NL);
                    });
                }

                // write evmtransfers
                if (evmtransfers.length > 0) {
                    evmtransfers.forEach((t) => {
                        fs.writeSync(f["evmtransfers"], JSON.stringify(t) + NL);
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
        for (let n = bnStart; n <= bnEnd; n++) {
            if (found[n] == undefined || (found[n] == false)) {
                //await this.mark_crawl_block(chainID, n);
            }
        }
        /*
	  // Use this to not publish with any block issue
        if (this.publish > 0) {
            return (false);
        } */
        // 5. write to bq
        let numSubstrateETLLoadErrors = 0;
        try {
            for (const tbl of tbls) {
                fs.closeSync(f[tbl]);
                let logDTp = logDT.replaceAll("-", "")
                let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}$${logDTp}' ${fn[tbl]} schema/substrateetl/${tbl}.json`;
                if (tbl == "specversions") {
                    cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}' ${fn[tbl]} schema/substrateetl/${tbl}.json`;
                }
                try {
                    console.log(cmd);
                    await exec(cmd);
                } catch (err) {
                    numSubstrateETLLoadErrors++;
                    console.log(err);
                }
            }
            let [todayDT, hr] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
            let loaded = (logDT == todayDT) ? 0 : 1;
            let sql = `insert into blocklog (logDT, chainID, startBN, endBN, numBlocks, loadDT, loaded, attempted, numSubstrateETLLoadErrors) values ('${logDT}', '${chainID}', '${bnStart}', '${bnEnd}', '${block_count}', Now(), ${loaded}, '0', '${numSubstrateETLLoadErrors}') on duplicate key update loadDT = values(loadDT), startBN = values(startBN), endBN = values(endBN), numBlocks = values(numBlocks), loaded = values(loaded), attempted = values(attempted), numSubstrateETLLoadErrors = values(numSubstrateETLLoadErrors)`
            console.log(sql);
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        } catch (e) {
            console.log(e);
        }

        // mark crowdloanMetricsStatus as redy or ignore, depending on the result
        if (numSubstrateETLLoadErrors == 0){
            //first polkadot crowdloan: 2021-11-05
            //first kusama crowdloan: 2021-06-08
            let w = ''
            if (paraID == 0){
                w = `and logDT >= '2021-06-08'`
            }
            let crowdloanMetricsStatus = (paraID == 0)? 'Ready': 'Ignore'
            let sql = `update blocklog set crowdloanMetricsStatus = '${crowdloanMetricsStatus}' where chainID = '${chainID}' and logDT = '${logDT}' ${w}`
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        }
        // load evmholders changes
        if (numSubstrateETLLoadErrors == 0 && chain.isEVM) {
            try {
                /*
                With incomingTransfer as (SELECT token_address, to_address as account_address, concat(token_address, to_address) account_token, sum(CAST(value AS BIGNUMERIC)) as value, sum(CAST(value AS BIGNUMERIC)) as valuein, sum(0) as valueOut, count(*) valueCnt, min(block_timestamp) as ts from `substrate-etl.polkadot.evmtransfers2004` WHERE DATE(block_timestamp) = "2023-02-17" and transfer_type = 'ERC20' group by token_address, account_address, account_token),
                outgoingTransfers as (SELECT token_address, from_address as account_address, concat(token_address, from_address) account_token, sum(-CAST(value AS BIGNUMERIC)) as value, sum(0) as valuein, sum(-CAST(value AS BIGNUMERIC)) as valueOut, count(*) valueCnt,  min(block_timestamp) as ts from `substrate-etl.polkadot.evmtransfers2004` WHERE DATE(block_timestamp) = "2023-02-17" and transfer_type = 'ERC20' group by token_address, account_address, account_token),
                transfersCombined as (Select * from incomingTransfer union all select * from outgoingTransfers order by account_address)
                select token_address, account_address, sum(value) as value, sum(valuein) as receivedValue, sum(valueout) as sentValue, sum(valueCnt) as transferCnt,  min(ts) as ts from transfersCombined group by token_address, account_address order by token_address
                */
                let datasetID = relayChain;
                let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain)
                let tblName = `evmholders${chainID}`
                let partitionedFld = `ts`
                let destinationTbl = `${datasetID}.${tblName}$${logYYYYMMDD}`
                let targetSQL = `With incomingTransfer as (SELECT token_address, to_address as account_address, concat(token_address, to_address) account_token, sum(CAST(value AS BIGNUMERIC)) as value, sum(CAST(value AS BIGNUMERIC)) as valuein, sum(0) as valueOut, count(*) valueCnt, min(block_timestamp) as ts from \`substrate-etl.${relayChain}.evmtransfers${paraID}\` WHERE DATE(block_timestamp) = "${logDT}" and transfer_type = "ERC20" group by token_address, account_address, account_token),
outgoingTransfers as (SELECT token_address, from_address as account_address, concat(token_address, from_address) account_token, sum(-CAST(value AS BIGNUMERIC)) as value, sum(0) as valuein, sum(-CAST(value AS BIGNUMERIC)) as valueOut, count(*) valueCnt, min(block_timestamp) as ts from \`substrate-etl.${relayChain}.evmtransfers${paraID}\` WHERE DATE(block_timestamp) = "${logDT}" and transfer_type = "ERC20" group by token_address, account_address, account_token),
transfersCombined as (Select * from incomingTransfer union all select * from outgoingTransfers order by account_address)
select token_address, account_address, sum(value) as value, sum(valuein) as receivedValue, sum(valueout) as sentValue, sum(valueCnt) as transferCnt , min(ts) as ts from transfersCombined group by token_address, account_address order by token_address`
                partitionedFld = 'ts'
                let bqCmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                console.log(`${tblName}***\n\n${bqCmd}`)
                await exec(bqCmd);
            } catch (e) {
                console.log(`evmholders error`, e)
            }
        }
        // load account metrics
        try {
            await this.update_blocklog(chainID, logDT);
        } catch (e) {
            console.log(e)
        }
    }

    async isEVMChain(chainID) {
        let sql = `select isEVM from chain where chainID = ${chainID}`;
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) {
            return (false);
        }
        if (recs[0].isEVM) return (true);
    }

    async update_blocklog(chainID, logDT) {
        let project = this.project;
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let bqDataset = (this.isProd)? `${relayChain}`: `${relayChain}_dev` //TODO:MK write to relay_dev for dev
        if (!this.isProd) return //TODO:MK skip query for dev
        let paraID = paraTool.getParaIDfromChainID(chainID)
        //xcmtransfers0, xcmtransfers1 are using substrate-etl.relayChain even for dev case
        let sqla = {
            "extrinsics": `select count(*) as numExtrinsics, sum(if(signed, 1, 0)) as numSignedExtrinsics, sum(fee) as fees from ${project}.${relayChain}.extrinsics${paraID} where date(block_time) = '${logDT}'`,
            "events": `select count(*) as numEvents from substrate-etl.${relayChain}.events${paraID} where date(block_time) = '${logDT}'`,
            "transfers": `select count(*) as numTransfers, count(distinct from_pub_key) numAccountsTransfersOut, count(distinct to_pub_key) numAccountsTransfersIn, sum(if(amount_usd is null, 0, amount_usd)) valueTransfersUSD from substrate-etl.${relayChain}.transfers${paraID} where date(block_time) = '${logDT}'`,
            "xcmtransfers0": `select count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from substrate-etl.${relayChain}.xcmtransfers where destination_para_id = ${paraID} and date(origination_ts) = '${logDT}'`,
            "xcmtransfers1": `select count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from substrate-etl.${relayChain}.xcmtransfers where origination_para_id = ${paraID} and date(origination_ts) = '${logDT}'`,
        }
        // don't compute this unless accountMetricsStatus is "AuditRequired" or "Audited"
        let accountMetricsStatus = "AuditRequired" // TODO: load from blocklog
        if (accountMetricsStatus == "Audited" || accountMetricsStatus == "AuditRequired") {
            sqla["accountsnew"] = `select count(distinct address_pubkey) as numNewAccounts from substrate-etl.${relayChain}.accountsnew${paraID} where date(ts) = '${logDT}'`
            sqla["accountsreaped"] = `select count(distinct address_pubkey) as numReapedAccounts from substrate-etl.${relayChain}.accountsreaped${paraID} where date(ts) = '${logDT}'`
            sqla["accountsactive"] = `select count(*) as numActiveAccounts, sum(if(accountType = "System", 1, 0)) as numActiveSystemAccounts, sum(if(accountType = "User", 1, 0)) as numActiveUserAccounts from substrate-etl.${relayChain}.accountsactive${paraID} where date(ts) = '${logDT}'`
            sqla["accountspassive"] = `select count(*) as numPassiveAccounts from substrate-etl.${relayChain}.accountspassive${paraID} where date(ts) = '${logDT}'`
        }
        if (await this.isEVMChain(chainID)) {
            sqla["evmtxs"] = `select count(*) as numTransactionsEVM, sum(if(transaction_type = 2, 1, 0)) numTransactionsEVM1559, sum(if(transaction_type = 0, 1, 0)) numTransactionsEVMLegacy, sum(if(receipt_contract_address is not null, 1, 0)) numEVMContractsCreated, avg(gas_price / 1000000000) as gasPrice, avg(max_fee_per_gas / 1000000000) as maxFeePerGas, avg(max_priority_fee_per_gas / 1000000000) as maxPriorityFeePerGas, sum(fee) as evmFee, sum(burned_fee) as evmBurnedFee from substrate-etl.${relayChain}.evmtxs${paraID} where date(block_timestamp) = '${logDT}'`;
            sqla["evmtransfers"] = `select count(*) as numEVMTransfers, sum(if(transfer_type = 'ERC20', 1, 0)) numERC20Transfers, sum(if(transfer_type = 'ERC721', 1, 0)) numERC721Transfers, sum(if(transfer_type = 'ERC1155', 1, 0)) numERC1155Transfers from substrate-etl.${relayChain}.evmtransfers${paraID} where date(block_timestamp) = '${logDT}'`
            sqla["evmactive"] = `select count(*) as numActiveAccountsEVM from substrate-etl.${relayChain}.accountsevmactive${paraID} where date(ts) = '${logDT}'`
            sqla["evmpassive"] = `select count(*) as numPassiveAccountsEVM from substrate-etl.${relayChain}.accountsevmpassive${paraID} where date(ts) = '${logDT}'`
        }

        console.log(sqla);
        let r = {}
        let vals = [` loaded = 1 `];
        for (const k of Object.keys(sqla)) {
            let sql = sqla[k];
            let rows = await this.execute_bqJob(sql);
            let row = rows.length > 0 ? rows[0] : null;
            if (row) {
                for (const a of Object.keys(row)) {
                    r[a] = row[a] > 0 ? row[a] : 0;
                    vals.push(` ${a} = ${mysql.escape(row[a])}`);
                    if (a == "numAddresses") {
                        vals.push(` numAddressesLastUpdateDT = Now() `);
                    }
                }
            }
        }
        let sql = `update blocklog set ` + vals.join(",") + `  where chainID = '${chainID}' and logDT = '${logDT}'`
        console.log(sql)
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async updateBlocklogBulk() {
        let sql = `select chainID from chain where ( lastUpdateChainAssetsTS is null or  lastUpdateChainAssetsTS < UNIX_TIMESTAMP(date_sub(Now(), interval 24 hour))) and crawling = 1 limit 1`;
        let recs = await this.poolREADONLY.query(sql)
        if (recs.length == 1) {
            await this.update_blocklog_bulk(recs[0].chainID);
            return (true);
        }
        return (false);
    }

    async update_blocklog_bulk(chainID, startDT = "2021-12-01") {
        console.log("update_blocklog_bulk", chainID);
        let [today, _] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
        let project = this.project;
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let sqla = {
            "balances": `select date(ts) logDT, count(distinct address_pubkey) as numAddresses from substrate-etl.${relayChain}.balances${paraID} where DATE(ts) >= "${startDT}" group by logDT order by logDT`,
            "extrinsics": `select date(block_time) logDT, count(*) as numExtrinsics, sum(if(signed, 1, 0)) as numSignedExtrinsics, sum(fee) fees from ${project}.${relayChain}.extrinsics${paraID} where DATE(block_time) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            "events": `select date(block_time) logDT, count(*) as numEvents from substrate-etl.${relayChain}.events${paraID} where DATE(block_time) >= "${startDT}" group by logDT order by logDT`,
            "transfers": `select  date(block_time) logDT, count(*) as numTransfers, count(distinct from_pub_key) numAccountsTransfersOut, count(distinct to_pub_key) numAccountsTransfersIn, sum(if(amount_usd is null, 0, amount_usd)) valueTransfersUSD from substrate-etl.${relayChain}.transfers${paraID} where DATE(block_time) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            "xcmtransfers0": `select  date(origination_ts) logDT, count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from substrate-etl.${relayChain}.xcmtransfers where destination_para_id = ${paraID} and DATE(origination_ts) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            "xcmtransfers1": `select date(origination_ts) as logDT, count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from substrate-etl.${relayChain}.xcmtransfers where origination_para_id = ${paraID} and DATE(origination_ts) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            // TODO: only store if accountMetricsStatus = "Audited" or "AuditRequired" for a specific day
            "accountsnew": `select date(ts) logDT, count(distinct address_pubkey) as numNewAccounts from substrate-etl.${relayChain}.accountsnew${paraID} group by logDT order by logDT`,
            "accountsreaped": `select date(ts) logDT, count(distinct address_pubkey) as numReapedAccounts from substrate-etl.${relayChain}.accountsreaped${paraID} group by logDT  order by logDT`,
            "accountsactive": `select date(ts) logDT, count(*) as numActiveAccounts, sum(if(accountType = "System", 1, 0)) as numActiveSystemAccounts, sum(if(accountType = "User", 1, 0)) as numActiveUserAccounts from substrate-etl.${relayChain}.accountsactive${paraID} group by logDT  order by logDT`,
            "accountspassive": `select date(ts) logDT, count(*) as numPassiveAccounts from substrate-etl.${relayChain}.accountspassive${paraID} group by logDT  order by logDT`
        };
        let isEVM = await this.isEVMChain(chainID);
        if (isEVM) {
            console.log("ISEVM --- ", chainID, isEVM);
            sqla["evmtxs"] = `select date(block_timestamp) logDT, count(*) as numTransactionsEVM, sum(if(transaction_type = 2, 1, 0)) numTransactionsEVM1559, sum(if(transaction_type = 0, 1, 0)) numTransactionsEVMLegacy, sum(if(receipt_contract_address is not null, 1, 0)) numEVMContractsCreated, avg(gas_price / 1000000000) as gasPrice, avg(max_fee_per_gas / 1000000000) as maxFeePerGas, avg(max_priority_fee_per_gas / 1000000000) as maxPriorityFeePerGas, sum(fee) as evmFee, sum(burned_fee) as evmBurnedFee from substrate-etl.${relayChain}.evmtxs${paraID} group by logDT order by logDT`;
            sqla["evmtransfers"] = `select date(block_timestamp) logDT, count(*) as numEVMTransfers, sum(if(transfer_type = 'ERC20', 1, 0)) numERC20Transfers, sum(if(transfer_type = 'ERC721', 1, 0)) numERC721Transfers, sum(if(transfer_type = 'ERC1155', 1, 0)) numERC1155Transfers from substrate-etl.${relayChain}.evmtransfers${paraID} group by logDT order by logDT`
            sqla["evmactive"] = `select date(ts) logDT, count(*) as numActiveAccountsEVM from substrate-etl.${relayChain}.accountsevmactive${paraID} group by logDT`
            sqla["evmpassive"] = `select date(ts) logDT, count(*) as numPassiveAccountsEVM from substrate-etl.${relayChain}.accountsevmpassive${paraID} group by logDT`
        }

        let r = {}
        for (const k of Object.keys(sqla)) {
            let sql = sqla[k];
            try {
                let rows = await this.execute_bqJob(sql);
                console.log(sql, rows.length, " rows");

                for (const row of rows) {
                    let vals = [];
                    let logDT = null;
                    for (const a of Object.keys(row)) {
                        if (a != 'logDT') {
                            r[a] = row[a] ? row[a] : 0;
                            vals.push(` ${a} = ${mysql.escape(row[a])}`);
                        } else {
                            logDT = row[a].value;
                        }
                        if (a == "numAddresses") {
                            vals.push(` numAddressesLastUpdateDT = Now() `);
                        }
                    }
                    let sql = `update blocklog set ` + vals.join(",") + `  where chainID = '${chainID}' and logDT = '${logDT}'`
                    console.log(sql);
                    this.batchedSQL.push(sql);
                    await this.update_batchedSQL();
                }
            } catch (er) {
                console.log(er);
            }
        }

        // take the 7/30d/all time view
        var ranges = [7, 30, 99999];
        for (const range of ranges) {
            let f = (range > 9999) ? "" : `${range}d`;
            let sql0 = `select sum(numTraces) as numTraces, sum(numExtrinsics) as numExtrinsics, sum(numEvents) as numEvents, sum(numTransfers) as numTransfers, sum(numSignedExtrinsics) as numSignedExtrinsics, sum(valueTransfersUSD) as valueTransfersUSD, sum(numTransactionsEVM) as numTransactionsEVM, sum(numReceiptsEVM) as numReceiptsEVM, sum(gasUsed) as gasUsed, sum(gasLimit) as gasLimit, sum(numEVMBlocks) as numEVMBlocks, avg(numActiveAccounts) as numActiveAccounts, sum(numXCMTransfersIn) as numXCMTransferIncoming, sum(valXCMTransferIncomingUSD) as valXCMTransferIncomingUSD, sum(numXCMTransfersOut) as numXCMTransferOutgoing, sum(valXCMTransferOutgoingUSD) as valXCMTransferOutgoingUSD from blocklog where logDT >= date_sub(Now(),interval ${range} DAY) and chainID = ${chainID}`
            let stats = await this.poolREADONLY.query(sql0)
            let out = [];
            for (const s of stats) {
                let numXCMTransferIncoming = s.numXCMTransferIncoming ? s.numXCMTransferIncoming : 0;
                let numXCMTransferOutgoing = s.numXCMTransferOutgoing ? s.numXCMTransferOutgoing : 0;
                let valIncoming = s.valXCMTransferIncomingUSD ? s.valXCMTransferIncomingUSD : 0;
                let valOutgoing = s.valXCMTransferOutgoingUSD ? s.valXCMTransferOutgoingUSD : 0;
                out.push([`('${chainID}', ${s.numTraces}, ${s.numExtrinsics}, ${s.numEvents}, ${s.numTransfers}, ${s.numSignedExtrinsics}, ${s.valueTransfersUSD}, ${s.numTransactionsEVM}, ${s.numReceiptsEVM}, ${s.gasUsed}, ${s.gasLimit}, ${s.numEVMBlocks}, ${s.numActiveAccounts}, '${numXCMTransferIncoming}', '${valIncoming}', '${numXCMTransferOutgoing}', '${valOutgoing}')`])
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
        let sql0 = `update chain set lastUpdateChainAssetsTS = UNIX_TIMESTAMP(Now()) where chainID = ${chainID}`;
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL(10.0);

        /*
let topNgroups = ["balanceUSD", "numChains", "numAssets", "numTransfersIn", "avgTransferInUSD", "sumTransferInUSD", "numTransfersOut", "avgTransferOutUSD", "sumTransferOutUSD", "numExtrinsics", "numExtrinsicsDefi", "numCrowdloans", "numSubAccounts", "numRewards", "rewardsUSD"]
        for (const topN of topNgroups) {
        }
*/
    }

    async getAlltables(filter = 'accounts') {
        let projectID = `${this.project}`
        let relayChains = ['kusama', 'polkadot']
        let bqCmds = []
        let fullTableIDs = []
        for (const rc of relayChains) {
            let bqCmd = `bq ls --max_results 1000 --project_id=${projectID} --dataset_id="${rc}" --format=json`
            let res = await exec(bqCmd)
            try {
                if (res.stdout && res.stderr == '') {
                    let tbls = JSON.parse(res.stdout)
                    for (const tbl of tbls) {
                        let fullTableID = tbl.id
                        //console.log(`fullTableID`, fullTableID)
                        if (fullTableID.includes(filter)) {
                            fullTableIDs.push(fullTableID)
                        }
                    }
                    //console.log(`r`, r)
                }
            } catch (e) {
                console.log(`getAlltables err`, e)
            }
        }
        //console.log(`fullTableIDs`, fullTableIDs)
        return fullTableIDs
    }


}
