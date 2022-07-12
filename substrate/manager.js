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

module.exports = class Manager extends AssetManager {
    constructor() {
        super("manager")
    }

    chainMap = {}
    lastupdateTS = 0

    // xcmanalytics
    xcmAddress = null;
    potentialAssetChains = null;
    parachainID = null;
    concept = null;

    async auditBQLog(logDT) {

        let sql = `select unix_timestamp('${logDT}') as minTS`;
        let recs = await this.poolREADONLY.query(sql);
        let minTS = recs[0].minTS;
        let maxTS = minTS + 86400;
        let tbls = ["extrinsics", "events"];
        for (const tbl of tbls) {
            let dir = path.join("/disk1", tbl, logDT)
            let files = await fs.readdirSync(dir);
            for (const f of files) {
                let fn = path.join(dir, f);
                let content = await fs.readFileSync(fn, {
                    encoding: 'utf8',
                    flag: 'r'
                });
                let lines = content.split("\n");
                let flag = false;
                for (const l of lines) {
                    try {
                        let j = JSON.parse(l);
                        if (j.ts !== undefined) {
                            if (j.ts < minTS || j.ts >= maxTS) {
                                console.log(l);
                                flag = true;
                            }
                        }
                    } catch (e) {

                    }
                }
                if (flag) {
                    console.log(fn);
                }
            }
        }
    }

    async auditBQLogFull() {
        let sql = `select chainID, indexTS from indexlog where indexed = 1 and ( bqlogExtrinsics = 0 or bqlogEvents = 0 ) order by chainID, indexTS`;
        let recs = await this.poolREADONLY.query(sql);
        console.log(sql, recs.length);
        let out = [];
        for (const r of recs) {
            let indexTS = r.indexTS;
            let chainID = r.chainID;
            let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
            let tbls = ["extrinsics", "events"];
            let passExtrinsics = 0;
            let passEvents = 0;
            for (const tbl of tbls) {
                let dir = path.join("/disk1", tbl, logDT)
                let fn = path.join(dir, `${chainID}-${indexTS}.json`);
                let exists = await fs.existsSync(fn)
                let pass = 1;
                if (exists) {
                    let content = await fs.readFileSync(fn, {
                        encoding: 'utf8',
                        flag: 'r'
                    });
                    let lines = content.split("\n");
                    for (const l of lines) {
                        try {
                            let j = JSON.parse(l);
                            if (j.ts !== undefined) {
                                if (j.ts < minTS || j.ts >= maxTS) {
                                    console.log("TIME OUT", fn, j.ts);
                                    pass = 0;
                                }
                            }
                        } catch (e) {

                        }
                    }
                } else {
                    console.log("MISSED", fn, logDT, hr);
                    pass = 0;
                }
                if (tbl == "extrinsics") {
                    passExtrinsics = pass;
                } else {
                    passEvents = pass;
                }
            }
            out.push(`('${chainID}', '${indexTS}', '${logDT}', '${hr}', '${passExtrinsics}', '${passEvents}')`);
            if (out.length > 100) {
                await this.upsertSQL({
                    "table": "indexlog",
                    "keys": ["chainID", "indexTS", "logDT", "hr"],
                    "vals": ["bqlogExtrinsics", "bqlogEvents"],
                    "data": out,
                    "replace": ["bqlogExtrinsics", "bqlogEvents"]
                });
                out = [];
            }
        }
        if (out.length > 0) {
            await this.upsertSQL({
                "table": "indexlog",
                "keys": ["chainID", "indexTS", "logDT", "hr"],
                "vals": ["bqlogExtrinsics", "bqlogEvents"],
                "data": out,
                "replace": ["bqlogExtrinsics", "bqlogEvents"]
            });
            out = []
        }
    }


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
        } else if (tbl == "xcm") {
            let ts = this.getCurrentTS() - 86400;
            let sql = `delete from xcmmessagesrecent where ts < ${ts}`
            this.batchedSQL.push(sql)
            await this.update_batchedSQL();
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

    async auditChains(lookback = 60) {
        let chains = await this.getChains();
        for (var i = 0; i < chains.length; i++) {
            let c = chains[i];
            let chainID = c.chainID;
            let flds = (c.isEVM) ? ", sum(crawlBlockEVM) as numCrawlBlockEVM, sum(crawlReceiptsEVM) as numCrawlReceiptsEVM" : "";
            var sums = await this.poolREADONLY.query(`select sum(crawlBlock) as numCrawlBlock, sum(IF(crawlTrace>0 and numSignedExtrinsics > 0, 1,0)) as numCrawlTrace, sum(crawlFeed) as numCrawlFeed ${flds} from block${c.chainID} where blockNumber < ${c.blocksFinalized} and not blockDT < '2021-12-18'`);

            let numCrawlBlock = sums[0].numCrawlBlock;
            let numCrawlBlockEVM = sums[0].numCrawlBlockEVM;
            let numCrawlReceiptsEVM = sums[0].numCrawlReceiptsEVM;
            let vals = [];
            if (numCrawlBlock > 0) vals.push(`${numCrawlBlock} blocks/events`);
            if (numCrawlBlockEVM > 0) vals.push(`${numCrawlBlockEVM} evmblocks`);
            if (numCrawlReceiptsEVM > 0) vals.push(`${numCrawlReceiptsEVM} evmReceipts`);
            if (vals.length > 0) {
                console.log(`# [${c.chainName}: ${vals.join("; ")}]\tscreen -S crawlBackfill${chainID} 'while true; do ./crawlBackfill ${chainID}; done'`);
            }
            let numCrawlTrace = sums[0].numCrawlTrace;
            if (numCrawlTrace > 10) {
                console.log(`# [${c.chainName}: ${numCrawlTrace} traces]\tscreen -S crawlTrace${chainID} 'while true; do ./crawlTraces ${chainID}; done'`);
            }

            let sql = `update chain set numCrawlBlock = ${numCrawlBlock}, numCrawlTrace = ${numCrawlTrace} where chainID = ${chainID}`
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        }
        await this.update_batchedSQL();
    }

    async mapChains(f) {
        let chains = await this.getChains();
        for (var i = 0; i < chains.length; i++) {
            let c = chains[i];
            f(c)
        }
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

    async backupChain(chainID, logDT, instance, cluster) {
        let cmd = `gcloud  bigtable backups create chain${chainID}-${logDT} --instance=${instance} --cluster=${cluster} --table=chain${chainID} --async --retention-period=3d`;
        console.log(cmd);
        console.log(`gcloud bigtable backups list --instance=${instance} --cluster=${cluster}`);
        // TODO: execute the cmd
    }

    async backupChains() {
        let chains = await this.poolREADONLY.query(`select chainID from chain where crawling = 1 limit 50`);

        var today = new Date();
        var dd = today.getUTCDate().toString().padStart(2, '0');
        var mm = (today.getUTCMonth() + 1).toString().padStart(2, '0'); //January is 0!
        let logDT = today.getUTCFullYear() + mm + dd;
        for (let i = 0; i < chains.length; i++) {
            await this.backupChain(chains[i].chainID, logDT);
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

    async generateCrawlerYAML(assign = false) {
        let crawlerNodes = ["acala", "polkadot", "moonbeam", "astar", "parallel", "shiden", "kusama", "karura"];
        let N = crawlerNodes.length;
        let chains = await this.getChains();
        let servicesstart = {};
        let servicesstop = {};
        if (assign) {
            for (let c = 0; c < chains.length; c++) {
                let chain = chains[c];
                if (chain.active > 0) {
                    let out = [crawlerNodes[(c + 0) % N], crawlerNodes[(c + 1) % N]]
                    let nEndpoints = 1;
                    if (chain.WSEndpoint2 != undefined && chain.WSEndpoint2.length > 0) {
                        nEndpoints = 2;
                    }
                    let i = 0;
                    for (const o of out) {
                        let endpoint = i % nEndpoints;
                        i++;
                        let sql = `insert into chainhostnameendpoint (chainID, hostname, endpoint, createDT, updateDT) values ('${chain.chainID}', '${o}', '${endpoint}', Now(), Now()) on duplicate key update endpoint = values(endpoint), updateDT = values(updateDT)`
                        this.batchedSQL.push(sql);
                    }
                }
            }
            await this.update_batchedSQL()
        }
        let sql = `select chainID, hostname, endpoint from chainhostnameendpoint where chainID in ( select chainID from chain where active = 1 )`
        let endpointlist = await this.pool.query(sql)
        for (let c = 0; c < endpointlist.length; c++) {
            let r = endpointlist[c];
            let o = r.hostname;
            let chainID = r.chainID;
            if (servicesstart[o] == undefined) {
                servicesstart[o] = [];
            }
            if (servicesstop[o] == undefined) {
                servicesstop[o] = [];
            }
            servicesstart[o].push(`      - systemctl start crawler${chainID}.service`);
            servicesstop[o].push(`      - systemctl stop crawler${chainID}.service`);
        }
        // also add tracer services
        for (let i = 0; i < chains.length; i++) {
            let c = chains[i];
            let chainID = c.chainID;
            if (crawlerNodes.includes(c.id)) {
                servicesstart[c.id].push(`      - systemctl start tracer${chainID}.service`);
                servicesstop[c.id].push(`      - systemctl stop tracer${chainID}.service`);
            }
        }
        servicesstart["moonbeam"].push(`      - systemctl start xcmmatch.service`);
        servicesstop["moonbeam"].push(`      - systemctl stop xcmmatch.service`);

        let dir = "/root/go/src/github.com/colorfulnotion/polkaholic/yaml";
        // polkaholic_crawler_start.yaml has SERVICES macro that is replaced with a list of crawler services to be started/stopped
        let macro = "${SERVICES}"
        let starttemplate = await fs.readFileSync(path.join(dir, "polkaholic_crawler_start.yaml"), {
            encoding: 'utf8',
            flag: 'r'
        })
        let stoptemplate = await fs.readFileSync(path.join(dir, "polkaholic_crawler_stop.yaml"), {
            encoding: 'utf8',
            flag: 'r'
        })
        for (const o of crawlerNodes) {
            let fn0 = path.join(dir, `${o}start.yaml`)
            let fn1 = path.join(dir, `${o}stop.yaml`)
            let startstr = servicesstart[o].join("\n");
            let stopstr = servicesstop[o].join("\n");
            console.log(fn0);
            await fs.writeFileSync(fn0, starttemplate.replace(macro, startstr));
            console.log(fn1);
            await fs.writeFileSync(fn1, stoptemplate.replace(macro, stopstr));
        }
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

    // All instructions with "MultiAsset" type should be decorated with assetChain / symbols / decimals + USD value at the time of message
    decorateXCM_MultiAsset(c, chainID, chainIDDest, ctx) {
        if (c.id != undefined) {
            if (c.id.concrete != undefined) {
                this.concept[JSON.stringify(c.id.concrete)] = 1;
                console.log("decorateXCM_MultiAsset", ctx, chainID, chainIDDest, this.concept);
            } else {
                // console.log("decorateXCM_MultiAsset NOT CONCRETE:", chainID, chainIDDest, JSON.stringify(c))
            }
        } else {
            //console.log("decorateXCM_MultiAsset!", chainID, chainIDDest, JSON.stringify(c))
        }
    }

    decorateXCM_MultiAssetFilter(c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        if (c[fld].wild) {} else if (c[fld].definite) {
            console.log("decorateXCM_MultiAssetFilter", chainID, chainIDDest, JSON.stringify(c[fld]))
        } else {
            // decorateXCM_MultiAssetFilter 22085 2 {"definite":[{"id":{"concrete":{"parents":0,"interior":{"here":null}}},"fun":{"fungible":10000000000}}]}
            console.log("decorateXCM_MultiAssetFilter", ctx, chainID, chainIDDest, JSON.stringify(c[fld]))
        }
    }

    // All instructions with "MultiLocation" (parachain, accountID32/ accountID20, here) should be decorated with chain.id, chain.chainName or the "identity" using lookup_account
    decorateXCM_MultiLocation(c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;

        let interior = c[fld].interior;
        if (interior == undefined) return;
        let x1 = interior.x1;
        if (x1 == undefined) return;
        if (x1.accountId32) {
            this.xcmAddress = x1.accountId32.id;
        } else if (x1.accountKey20) {
            this.xcmAddress = x1.accountKey20.key;
        } else {
            console.log("decorateXCM_MultiLocation MISS ", ctx, chainID, chainIDDest, interior);
            return;
        }
        console.log("decorateXCM_MultiLocation ", ctx, chainID, chainIDDest, this.xcmAddress);
    }

    decorateXCM_Call(c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        if (c[fld].encoded != undefined) {
            // decorateXCM_Call 22000 2 0x1801010006010f23ada31bd3bb06
            //console.log("decorateXCM_Call", ctx, chainID, chainIDDest, c[fld].encoded)
            // extrinsicCall = apiAt.registry.createType('Call', opaqueCall);
            // ISSUE: How do we get the right api since the indexer needs the "receiving chain" api? -- can we do a mini-API call for this?
        }
    }

    decorateXCMInstruction(instruction, chainID, chainIDDest, ctx = "") {
        let instructionSet = {
            'withdrawAsset': { // Remove the on-chain asset(s) (assets) and accrue them into Holding
                MultiAssets: ['assets']
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
        }

        for (const i of Object.keys(instructionSet)) {
            if (instruction[i] != undefined) {
                let features = instructionSet[i];
                if (features.MultiAssets != undefined) {
                    for (let j = 0; j < instruction[i].length; j++) {
                        this.decorateXCM_MultiAsset(instruction[i][j], chainID, chainIDDest, i);
                    }
                }
                if (features.MultiAsset != undefined) {
                    for (const fld of features.MultiAsset) {
                        if (instruction[i][fld] != undefined) {
                            this.decorateXCM_MultiAsset(instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }

                if (features.MultiAssetFilter != undefined) {
                    for (const fld of features.MultiAssetFilter) {
                        this.decorateXCM_MultiAssetFilter(instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
                if (features.MultiLocation != undefined) {
                    for (const fld of features.MultiLocation) {
                        this.decorateXCM_MultiLocation(instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
                if (features.XCM != undefined) {
                    for (const fld of features.XCM) {
                        if (instruction[i][fld] != undefined) {
                            // recursive call
                            //console.log("RECURSION", instruction, fld, i, instruction[i][fld]);
                            this.decorateXCMInstructions(instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }
                if (features.Call != undefined) {
                    for (const fld of features.Call) {
                        this.decorateXCM_Call(instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
            }
        }

    }

    decorateXCMInstructions(instructions, chainID, chainIDDest, ctx) {
        for (const instruction of instructions) {
            this.decorateXCMInstruction(instruction, chainID, chainIDDest, ctx)
        }
    }

    async getPotentialAssetChains(blockTS, rawAddress = "0xb84e5e92bb92eb4e4b7b2b6c489379e8e86eba082b3c11b48cf497bfe7eecc19", assetFilter = false, chainIDFilter = false) {
        let maxRows = 1000;
        let address = paraTool.getPubKey(rawAddress)
        var hrstart = process.hrtime()
        let startRow = paraTool.make_addressHistory_rowKey(address, blockTS + 120);
        let endRow = paraTool.make_addressHistory_rowKey(address, blockTS - 120);
        let families = ["history"];
        let assetChainsMap = {};

        try {
            let [rows] = await this.btAccountHistory.getRows({
                start: startRow,
                end: endRow
            });

            if (rows && rows.length > 0) {
                for (const row of rows) {
                    let rowData = row.data
                    if (rowData["history"]) {
                        let historyData = rowData["history"];
                        let [accKey, ts] = paraTool.parse_addressHistory_rowKey(row.id)
                        for (const assetChainEncoded of Object.keys(historyData)) {
                            let assetChain = paraTool.decodeAssetChain(assetChainEncoded)
                            let [asset, chainID] = paraTool.parseAssetChain(assetChain);
                            for (const cell of historyData[assetChainEncoded]) {
                                var state = JSON.parse(cell.value);
                                let indexTS = cell.timestamp / 1000000;
                                let diff = indexTS - blockTS;
                                if (diff > -120 && diff < 120) {
                                    console.log("FOUND", assetChain, JSON.stringify(state));
                                    assetChainsMap[assetChain] = 1;
                                }
                                break;
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.log(`getPotentialAssetChains ERROR`, err)
        }
        return Object.keys(assetChainsMap);
    }

    async learnXCMConcept(chainID, chainIDDest, concepts) {
        let sql = `select potentialAssetChains from xcmmessages where concept = ${mysql.escape(concepts)} and chainID = '${chainID}' and chainIDDest = '${chainIDDest}'`
        let data = await this.pool.query(sql);
        let assetChainsMap = {};
        for (const d of data) {
            let potentialAssetChains = JSON.parse(d.potentialAssetChains.toString('utf8'));
            for (const ac of potentialAssetChains) {
                if (assetChainsMap[ac] == undefined) {
                    assetChainsMap[ac] = 1;
                } else {
                    assetChainsMap[ac]++;
                }
            }
        }
        let assetChains = [];
        for (const assetChain of Object.keys(assetChainsMap)) {
            let cnt = assetChainsMap[assetChain];
            assetChains.push({
                assetChain,
                cnt
            });
        }
        assetChains.sort(function(a, b) {
            return (b.cnt - a.cnt);
        });
        if (assetChains.length > 3) {
            assetChains = assetChains.slice(0, 3);
        }
        let parsedConcepts = JSON.parse(concepts);
        let parsedConcept = parsedConcepts[0];
        let out = [];
        for (const assetChainCnt of assetChains) {
            let assetChain = assetChainCnt.assetChain;
            let cnt = assetChainCnt.cnt;
            out.push(`('${chainID}', '${chainIDDest}', '${parsedConcept}', '${assetChain}', '${cnt}', Now())`);
        }
        let vals = ["cnt", "lastUpdateDT"];
        await this.upsertSQL({
            "table": "xcmmap",
            "keys": ["chainID", "chainIDDest", "concept", "assetChain"],
            "vals": vals,
            "data": out,
            "replace": vals
        });
        console.log("learnXCMCConcept", chainID, chainIDDest, parsedConcept, out);

    }

    async xcmMap() {
        let chainconcepts = await this.pool.query(`select chainID, chainIDDest, concept, count(*) cnt from xcmmessages where concept is not null and concept like '%gen%' group by chainID, chainIDDest, concept having count(*) > 5 order by count(*) desc`);
        for (const c of chainconcepts) {
            let concepts = JSON.parse(c.concept);
            if (concepts.length == 1) {
                await this.learnXCMConcept(c.chainID, c.chainIDDest, c.concept);
            }
        }

    }
    async xcmAnalytics() {
        await this.xcmMap();
        return;

        let ts = this.getCurrentTS() - 86400 * 180;
        let msgs = await this.pool.query(`select msgHash, incoming, chainID, chainIDDest, msgStr, blockTS from xcmmessages where blockTS > ${ts} order by blockTS desc`);
        let vals = ["potentialAssetChains", "concept"]
        let out = [];
        for (const msg of msgs) {
            let m = JSON.parse(msg.msgStr);
            if (m.v2) {
                this.xcmAddress = null;
                this.concept = {};
                this.decorateXCMInstructions(m.v2, msg.chainID, msg.chainIDDest, "TOP")
                if (this.xcmAddress) {
                    let potentialAssetChains = await this.getPotentialAssetChains(msg.blockTS, this.xcmAddress);
                    let p = JSON.stringify(potentialAssetChains);
                    let concepts = JSON.stringify(Object.keys(this.concept));
                    console.log("XCMINSTRUCTION", this.xcmAddress, concepts, p);
                    out.push(`('${msg.msgHash}', '${msg.incoming}', ${mysql.escape(p)}, ${mysql.escape(concepts)})`)
                    if (out.length > 0) {
                        await this.upsertSQL({
                            "table": "xcmmessages",
                            "keys": ["msgHash", "incoming"],
                            "vals": vals,
                            "data": out,
                            "replace": vals
                        });
                        out = [];
                    }
                } else {
                    console.log("XCMINSTRUCTION ADDRESS MISSING", JSON.stringify(m.v2));
                }
                console.log("----");
            }
        }
        if (out.length > 10) {
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["xcmHash", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
            out = [];
        }
    }

}
