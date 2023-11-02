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
const Crawler = require("./crawler");

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
    ContractPromise
} = require("@polkadot/api-contract");
const {
    StorageKey
} = require('@polkadot/types');
const {
    hexToU8a,
    compactStripLength,
    compactAddLength,
    hexToBn,
    bnToBn
} = require("@polkadot/util");
const fetch = require("node-fetch");

// first day when balances are available daily in modern ways from Kusama
const balanceStartDT = "2020-03-09";

module.exports = class SubstrateETL extends AssetManager {
    project = "substrate-etl";
    publish = 0;
    isProd = true
    chainID = null;

    constructor() {
        super("manager")
    }

    getAllTimeFormat(logDT) {
        //2020-12-01 -> [TS, '20221201', '2022-12-01', '2022-11-30']
        //20201201 -> [TS, '20221201', '2022-12-01', '2022-11-30']
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        let logYYYY_MM_DD = currDT.replaceAll('-', '/')
        let [prevDT, _p] = paraTool.ts_to_logDT_hr(logTS - 86400)
        return [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD]
    }

    getTimeFormat(logDT) {
        //2020-12-01 -> [TS, '20221201', '2022-12-01', '2022-11-30']
        //20201201 -> [TS, '20221201', '2022-12-01', '2022-11-30']
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        let [prevDT, _p] = paraTool.ts_to_logDT_hr(logTS - 86400)
        return [logTS, logYYYYMMDD, currDT, prevDT]
    }

    // all bigquery tables are date-partitioned except 2 for now: chains and specversions
    partitioned_table(tbl) {
        switch (tbl) {
            case "traces":
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
    async setup_chain_substrate(chainID = null, isUpdate = false, execute = true) {
        let projectID = `${this.project}`
        //setup "system" tables across all paraIDs
        let opType = (isUpdate) ? 'update' : 'mk'
        if (chainID == undefined) {
            console.log(`***** setup "system" tables across all paraIDs ******`)
            let systemtbls = ["xcmtransfers", "chains"]
            let relayChains = ["polkadot", "kusama"]
            for (const relayChain of relayChains) {
                let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd)
                for (const tbl of systemtbls) {
                    let fld = (this.partitioned_table(tbl))
                    let p = fld ? `--time_partitioning_field ${fld} --time_partitioning_type DAY` : "";
                    let cmd = `bq ${opType}  --project_id=${projectID}  --schema=schema/substrateetl/${tbl}.json ${p} --table ${bqDataset}.${tbl}`
                    try {
                        console.log(cmd);
                        //await exec(cmd);
                    } catch (e) {
                        // TODO optimization: do not create twice
                    }
                }
            }
        }
        // setup paraID specific tables, including paraID=0 for the relay chain
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs", "balances", "specversions", "calls", "traces"] // remove evmtx, evmtransfers
        let p = (chainID != undefined) ? ` and chainID = ${chainID} ` : ""
        let sql = `select chainID, isEVM from chain where relayChain in ('polkadot', 'kusama', 'shibuya', 'rococo') ${p} order by chainID`
        let recs = await this.poolREADONLY.query(sql);
        console.log(`***** setup "chain" tables:${tbls} (chainID=${chainID}) ******`)
        for (const rec of recs) {
            let chainID = parseInt(rec.chainID, 10);
            let paraID = paraTool.getParaIDfromChainID(chainID);
            let relayChain = paraTool.getRelayChainByChainID(chainID);
            let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
            //console.log(" --- ", chainID, paraID, relayChain);
            for (const tbl of tbls) {
                let fld = this.partitioned_table(tbl);
                let p = fld ? `--time_partitioning_field ${fld} --time_partitioning_type DAY` : "";
                let cmd = `bq ${opType}  --project_id=${projectID}  --schema=schema/substrateetl/${tbl}.json ${p} --table ${bqDataset}.${tbl}${paraID}`
                try {
                    if (cmd) {
                        console.log(cmd);
                        if (execute) {
                            //await exec(cmd);
                        }
                    }
                } catch (e) {
                    console.log(e);
                    // TODO optimization: do not create twice
                }
            }
        }
        process.exit(0)
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
                let bqDataset = this.get_relayChain_dataset(relayChain);
                let cmd = `bq query --destination_table '${bqDataset}.balances${paraID}$${logYYYYMMDD}' --project_id=${projectID} --time_partitioning_field ts --replace --use_legacy_sql=false 'select symbol,address_ss58,CONCAT(LEFT(address_pubkey, 2), RIGHT(address_pubkey, 40)) as address_pubkey,ts,id,chain_name,asset,para_id,free,free_usd,reserved,reserved_usd,misc_frozen,misc_frozen_usd,frozen,frozen_usd,price_usd from ${bqDataset}.balances${paraID} where DATE(ts) = "${logDT}"'`
                try {
                    console.log(cmd);
                    //await exec(cmd);
                } catch (err) {
                    console.log(err);
                }
            }
        }
    }

    async fetchCsvAndConvertToJson(url) {
        const response = await fetch(url);
        const csvContent = await response.text();
        return this.csvToJson(csvContent);
    }

    csvToJson(csv) {
        const lines = csv.split("\n");
        const headers = lines[0].split(",");
        const result = lines.slice(1).map(line => {
            const values = line.split(",");
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {});
        });
        return result;
    }


    async update_account_labels() {
        let queries = {
	    "validator0": {
		bigquery: true,
		query: "select distinct validator as account from `substrate-etl.polkadot_analytics.recent_validators0`",
	    },
	    "nominator0": {
		bigquery: true,
		query: "select distinct nominator as account from `substrate-etl.polkadot_analytics.recent_nominators0`",
	    },
	    "poolmember0": {
		bigquery: true,
		query: "select distinct address_ss58 as account from `substrate-etl.polkadot_analytics.recent_poolmembers0`"
	    },
	    "voter0": {
		queryType: "defi",
		query: "select distinct account from votes0 union all select distinct account from delegation0"
	    }
	}
	for ( const [label, queryInfo] of Object.entries(queries) ) {
	    let accounts = []
	    let query = queryInfo.query;
	    try {
		if ( queryInfo.bigquery ) {
		    const bigquery = this.get_big_query();
		    console.log("account bigquery", query);
		    let recs = await this.execute_bqJob(query);
		    for ( const r of recs ) {
			let a = r.account;
			let pubkey = paraTool.getPubKey(a);
			accounts.push(pubkey);
		    }
		} else {
		    console.log("account mysql", query);
		    const recs = await this.poolREADONLY.query(query)
		    for ( const r of recs ) {
			let a = r.account;
			let pubkey = paraTool.getPubKey(a);
			accounts.push(pubkey);
		    }
		}
		await this.write_account_labels(label, accounts);
	    } catch (err) {
		console.log(err);
	    }
	}
    }

    // write to labels column family
    async write_account_labels(label, accounts) {
	console.log("write_account_labels", label, accounts.length);
	let ts = this.getCurrentTS();
        let [tblName, tblRealtime] = this.get_btTableRealtime()
	let rows = [];
	for ( const address of accounts ) {
            if ( address.length == 66 ) {
		let rowKey = address.toLowerCase();
		let rec = {};
		rec[label] = {
		    value: "{}",
		    timestamp: ts * 1000000
		}
                rows.push({
                    key: rowKey,
                    data: {
                        label: rec
                    }
                });
	    }
	}

	if (rows.length > 0) {
	    console.log("write_account_labels", label, rows.length);
            await this.insertBTRows(tblRealtime, rows, tblName);
            rows = [];
        }
    }

    async ingestWalletAttribution() {
        /*
        //FROM Fearless-Util
        let url = 'https://gist.githubusercontent.com/mkchungs/2f99c4403b64e5d4c17d46abdd9869a3/raw/9550f0ab7294f44c8c6c981c2fbc4a3d84f17b06/Polkadot_Hot_Wallet_Attributions.csv'
        let recs = await this.fetchCsvAndConvertToJson(url)
        */
        //Merkle
        let query = `SELECT tag_name_verbose, address as addresses, tag_type_verbose, tag_subtype_verbose, unix_seconds(updated_at) updated_at, record_type FROM \`substrate-etl.substrate.merklescience\``;
        console.log(query);
        const bigquery = this.get_big_query();
        let recs = await this.execute_bqJob(query);

        let accounts = []
        let idx = 0
        for (const r of recs) {
            let isExchange = (r.tag_type_verbose == 'Exchange') ? 1 : 0
            let accountName = r.tag_name_verbose
            let verified = 1
            r.accountType = r.tag_type_verbose
            let pubkey = paraTool.getPubKey(r.addresses)
            if (pubkey) {
                r.address_pubkey = pubkey
                let t = "(" + [`'${r.address_pubkey}'`, `'${r.tag_name_verbose} ${r.accountType}'`, `'${r.accountType}'`, `'${accountName}'`, `'${isExchange}'`, `'${verified}'`, `NOW()`].join(",") + ")";
                accounts.push(t)
                idx++
                console.log(`[${idx}] ${t}`)
            }
        }
        console.log(accounts)
        let sqlDebug = true
        await this.upsertSQL({
            "table": "account",
            "keys": ["address"],
            "vals": ["nickname", "accountType", "accountName", "is_exchange", "verified", "verifyDT"],
            "data": accounts,
            "replaceIfNull": ["nickname", "accountType", "accountName", "is_exchange", "verifyDT"],
            "replace": ["verified"]
        }, sqlDebug);
    }


    async ingestSystemAddress() {
        //FROM Fearless-Util
        let url = 'https://gist.githubusercontent.com/mkchungs/2f99c4403b64e5d4c17d46abdd9869a3/raw/5ea73227ca9e303a02f00791e9a9297637fa3dec/system_accounts.csv'
        let recs = await this.fetchCsvAndConvertToJson(url)
        let systemAddresses = []
        let unknownAscii = []
        for (const r of recs) {
            let asciiName = paraTool.pubKeyHex2ASCII(r.user_pubkey);
            if (asciiName) {
                let systemAccountInfo = paraTool.decode_systemAccountType(asciiName)
                systemAccountInfo.user_pubkey = r.user_pubkey
                systemAddresses.push(systemAccountInfo)
            } else {
                unknownAscii.push(r)
            }
        }
        let accounts = []
        let idx = 0
        for (const r of systemAddresses) {
            r.accountType = "System"
            r.address_pubkey = paraTool.getPubKey(r.user_pubkey)
            let accountName = `${r.systemAccountType}${r.prefix}:${r.idx}`
            let verified = 1
            let t = "(" + [`'${r.address_pubkey}'`, `'${r.nickname}'`, `'${r.accountType}'`, `'${r.systemAccountType}'`, `'${accountName}'`, `'${verified}'`, `NOW()`].join(",") + ")";
            accounts.push(t)
            idx++
            console.log(`[${idx}] ${t}`)
        }
        console.log(accounts)
        let sqlDebug = true
        await this.upsertSQL({
            "table": "account",
            "keys": ["address"],
            "vals": ["nickname", "accountType", "systemAccountType", "accountName", "verified", "verifyDT"],
            "data": accounts,
            "replaceIfNull": ["nickname", "accountType", "systemAccountType", "verified", "verifyDT"],
            "replace": ["accountName"]
        }, sqlDebug);
        console.log(unknownAscii)
    }

    async dump_chains() {
	let projectID = "substrate-etl";
        let sql = `select id, chainID as chain_id, relayChain as relay_chain, paraID as para_id from chain where blocksCovered > 10000`;
        let recs = await this.poolREADONLY.query(sql);
        let dir = "/tmp"
        let tbl = "chain"
        let fn = path.join(dir, `${tbl}.json`)
        let f = fs.openSync(fn, 'w', 0o666);
        let NL = "\r\n";
        recs.forEach((e) => {
            fs.writeSync(f, JSON.stringify(e) + NL);
        });
        fs.closeSync(f);
        let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true 'crypto_polkadot.${tbl}' ${fn} schema/substrateetl/${tbl}.json`
        console.log(cmd);
    }

    async dump_users_tags(tagsourceTbl = 'exchanges') {
        let paraID = 0
        let relayChain = 'polkadot'
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let projectID = `${this.project}`
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
        let bqjobs = []
        let sourceBqDataset = 'substrate'
        let destinationBqDataset = 'substrate'
        let targetSQL = false;
        let tblName = `full_users${paraID}`
        switch (tagsourceTbl) {
            case 'knownpubs':
                targetSQL = `with transferoutgoing as (With transfer as (SELECT from_pub_key, to_pub_key, sum(amount) amount, count(*) transfer_cnt, min(extrinsic_id) as extrinsic_id, min(block_time) as ts FROM \`${projectID}.${bqDataset}.transfers${paraID}\` group by from_pub_key, to_pub_key)
            select to_pub_key as user_pubkey, ifNull(address_label, "other") as known_label, from_pub_key, extrinsic_id, transfer_cnt, amount, ts from transfer left join ${projectID}.${sourceBqDataset}.${tagsourceTbl} on ${tagsourceTbl}.address_pubkey = transfer.from_pub_key where ${tagsourceTbl}.account_type not in ("Scams")),
            firstAttribution as (select user_pubkey, min(concat(ts, "_", extrinsic_id, "_", from_pub_key, "_",known_label)) attribution from transferoutgoing group by user_pubkey)
            select user_pubkey, array_agg(distinct(known_label)) as known_labels, sum(amount) amount, sum(transfer_cnt) transfer_cnt,
            min(split(attribution, "_")[offset(0)]) as first_transfer_ts, min(split(attribution, "_")[offset(1)]) as first_transfer_extrinsic_id,
            min(split(attribution, "_")[offset(2)]) as first_transfer_sender_pub_key,  min(split(attribution, "_")[offset(3)]) as first_transfer
            from transferoutgoing inner join firstAttribution using (user_pubkey) group by user_pubkey order by transfer_cnt desc`
                break;
            case "exchanges":
                targetSQL = `with transferoutgoing as (With transfer as (SELECT from_pub_key, to_pub_key, sum(amount) amount, count(*) transfer_cnt, min(extrinsic_id) as extrinsic_id, min(block_time) as ts FROM \`${projectID}.${bqDataset}.transfers${paraID}\` group by from_pub_key, to_pub_key)
        select to_pub_key as user_pubkey, ifNull(address_label, "other") as known_label, from_pub_key, extrinsic_id, transfer_cnt, amount, ts from transfer left join ${projectID}.${sourceBqDataset}.${tagsourceTbl} on ${tagsourceTbl}.address_pubkey = transfer.from_pub_key where ${tagsourceTbl}.account_type not in ("Scams")),
        firstAttribution as (select user_pubkey, min(concat(ts, "_", extrinsic_id, "_", from_pub_key, "_",known_label)) attribution from transferoutgoing group by user_pubkey)
        select user_pubkey, array_agg(distinct(known_label)) as known_labels, sum(amount) amount, sum(transfer_cnt) transfer_cnt,
        min(split(attribution, "_")[offset(0)]) as first_transfer_ts, min(split(attribution, "_")[offset(1)]) as first_transfer_extrinsic_id,
        min(split(attribution, "_")[offset(2)]) as first_transfer_sender_pub_key,  min(split(attribution, "_")[offset(3)]) as first_transfer
        from transferoutgoing inner join firstAttribution using (user_pubkey) group by user_pubkey order by transfer_cnt desc`
                tblName = `full_exchange_users${paraID}`
            default:

        }
        let destinationTbl = `${destinationBqDataset}.${tblName}`
        let cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
        bqjobs.push({
            chainID: chainID,
            paraID: paraID,
            tbl: tblName,
            destinationTbl: destinationTbl,
            cmd: cmd
        })

        let errloadCnt = 0
        let isDry = false;
        for (const bqjob of bqjobs) {
            try {
                if (isDry) {
                    console.log(`\n\n [DRY] * ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                } else {
                    console.log(`\n\n* ${bqjob.destinationTbl} *\n${bqjob.cmd}`)
                    //await exec(bqjob.cmd);
                }
            } catch (e) {
                errloadCnt++
                this.logger.error({
                    "op": "dump_users_tags",
                    e
                })
            }
        }

    }

    get_relayChain_dataset(relayChain, isProd = true) {
        return (isProd) ? `crypto_${relayChain}` : `crypto_${relayChain}_dev`
    }

    async publishExchangeAddress(tbl = 'exchanges') {
        //await this.ingestSystemAddress()
        //await this.ingestWalletAttribution()
        let relayChain = 'polkadot'

        let sql = false
        switch (tbl) {
            case "exchanges":
                sql = `select nickname, accountName, address, accountType from account where is_exchange = 1`;
                break;
            case "knownpubs":
                sql = `select nickname, accountName, address, accountType from account where accountType not in ('Unknown', 'User');`
                break;
            default:
        }
        if (!sql) {
            console.log(`tbl=${tbl} not ready`)
            return
        }
        let projectID = `${this.project}`
        //let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd)
        let bqDataset = `substrate`
        let sqlRecs = await this.poolREADONLY.query(sql);
        let knownAccounts = [];
        let knownPubkeys = {}
        for (const r of sqlRecs) {
            let a = {
                address_pubkey: r.address,
                address_nickname: r.nickname,
                address_label: r.accountName,
                account_type: r.accountType
            }
            knownAccounts.push(a)
        }
        let dir = "/tmp";
        let fn = path.join(dir, `${tbl}.json`)
        let f = fs.openSync(fn, 'w', 0o666);
        let NL = "\r\n";
        knownAccounts.forEach((e) => {
            fs.writeSync(f, JSON.stringify(e) + NL);
        });
        fs.closeSync(f);
        let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}' ${fn} schema/substrateetl/${tbl}.json`;
        console.log(cmd)
        await this.dump_users_tags(tbl)
    }

    async cleanReaped(start = null, end = null) {
        if (start == null) {
            // pick a multiple of 256 between 0 and 4096
            start = Math.floor(Math.random() * 16) * 256;
        } else {
            start = parseInt(start, 10);
        }

        if (end == null) {
            // pick 256 later, so we're working on 1/16 of the dataset
            end = start + 256;
        }
        // get chains that have WSEndpointArchive = 1 only ... for now
        let sql = `select chainID from chain where crawling = 1`
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
                                await tbl.mutate({
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

    async get_random_crawl_trace_ready(relayChain, paraID, lookbackDays = 60) {
        let w = "";
        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w = ` and chainID = ${chainID}`
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from blocklog where logDT >= "${balanceStartDT}" and logDT >= date_sub(Now(), interval ${lookbackDays} day) and crawlTraceStatus not in ('Audited', 'AuditRequired', 'Ignore') ${w} order by rand() limit 1`;
        console.log("get_random_crawl_trace_ready", sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ([null, null]);
        let {
            indexTS,
            chainID
        } = recs[0];
        let [logDT, _] = paraTool.ts_to_logDT_hr(indexTS);
        paraID = paraTool.getParaIDfromChainID(chainID);
        relayChain = paraTool.getRelayChainByChainID(chainID);
        return {
            logDT,
            paraID,
            relayChain
        };
    }

    async get_random_trace_ready(relayChain, paraID, lookbackDays = 60) {
        let w = "";
        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w = ` and chainID = ${chainID}`
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from blocklog where logDT >= "${balanceStartDT}" and logDT >= date_sub(Now(), interval ${lookbackDays} day) and crawlTraceStatus = "Audited" and traceMetricsStatus not in ('Audited', 'AuditRequired') ${w} order by rand() limit 1`;
        console.log("get_random_trace_ready", sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ([null, null]);
        let {
            indexTS,
            chainID
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
            relayChain
        };
    }

    async get_random_staking_ready(relayChain, paraID, lookbackDays = 2000) {
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let supportedChains = [paraTool.chainIDPolkadot, paraTool.chainIDKusama]
        let stakingStartDT = "2020-05-01"
        if (!supportedChains.includes(chainID)){
            return {
                logDT: false,
                paraID: false,
                relayChain: false
            }
        }
        let sql = `select DATE_FORMAT(blockDT, '%Y-%m-%d') logDT from era${chainID} where  DATE_FORMAT(blockDT, '%Y-%m-%d') >= "${stakingStartDT}" and  DATE_FORMAT(blockDT, '%Y-%m-%d') >= date_sub(Now(), interval ${lookbackDays} day) and crawlNominatorStatus not in ('Audited', 'AuditRequired') order by rand() limit 1`;
        console.log("get_random_trace_ready", sql);
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return ([null, null]);
        let {
            logDT
        } = recs[0];
        paraID = paraTool.getParaIDfromChainID(chainID);
        relayChain = paraTool.getRelayChainByChainID(chainID);
        return {
            logDT,
            paraID,
            relayChain
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

    async get_random_substrateetl(logDT = null, paraID = -1, relayChain = null, lookbackDays = 470) {

        let w = "";
        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w = ` and chain.chainID = ${chainID}`
        } else {
            w = " and chain.chainID in ( select chainID from chain where crawling = 1 )"
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, blocklog.chainID, chain.isEVM from blocklog, chain where blocklog.chainID = chain.chainID and blocklog.loaded = 0 and logDT >= date_sub(Now(), interval ${lookbackDays} day) and ( loadAttemptDT is null or loadAttemptDT < DATE_SUB(Now(), INTERVAL POW(5, attempted) MINUTE) ) and ( logDT <= date(date_sub(Now(), interval 1 day)) ) ${w} order by rand() limit 1`;
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


    async detectChainIssues(chainID = null) {
        let relayChain = paraTool.getRelayChainByChainID(chainID);
        let paraID = paraTool.getParaIDfromChainID(chainID);
        let sql = `with blocks as (SELECT
 number, block_time, LAG(number) OVER (ORDER BY number) prev
FROM
  substrate-etl.crypto_${relayChain}.blocks${paraID}
  order by number
) select block_time,  number-1 as endblock, prev+1 as startblock, number - (prev+1) as diff from blocks where number != prev + 1 order by number desc, block_time limit 250`
        let recs = await this.execute_bqJob(sql);
        let sql0 = `delete from  chainissues where chainID = '${chainID}' and skip = 0`
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL()

        for (const gap of recs) {
            let startBN = gap.startblock;
            let endBN = gap.endblock;
            let sql2 = `insert into chainissues (chainID, startBlock, endBlock, addDT, lastUpdateDT, currentBlock) values ('${chainID}', '${startBN}', '${endBN}', Now(), Now(), '${startBN}' ) on duplicate key update lastUpdateDT = values(lastUpdateDT)`;
            this.batchedSQL.push(sql2);
            await this.update_batchedSQL()
        }
    }

    async audit_fix(chainID = null) {
        const Crawler = require("./crawler");
        let crawler = new Crawler();
        let chain = await this.getChain(chainID);
        const tableChain = this.getTableChain(chainID);
        await crawler.setupAPI(chain);
        await crawler.assetManagerInit();
        await crawler.setupChainAndAPI(chainID);
        let sql = `select startBlock, currentBlock, endBlock from chainissues where chainID = '${chainID}' and currentBlock <= endBlock order by endBlock asc limit 1`;
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) return;
        let r = recs[0];
        console.log(r);
        for (let blockNumber = r.currentBlock; blockNumber <= r.endBlock; blockNumber++) {
            let rowId = paraTool.blockNumberToHex(blockNumber);
            await tableChain.row(rowId).delete();
            let t2 = {
                chainID,
                blockNumber,
                crawlBlockEVM: 1,
                crawlReceiptsEVM: 1,
                crawlTraceEVM: 1
            }
            let x = await crawler.crawl_block_trace(chain, t2);
            let blockHash = x.blockHash;
            await crawler.index_block(chain, blockNumber, blockHash);
            sql = `update chainissues set currentBlock = '${blockNumber+1}' where chainID = '${chainID}' and startBlock = '${r.startBlock}' and endBlock = '${r.endBlock}'`
            console.log(sql);
            this.batchedSQL.push(sql);
            await this.update_batchedSQL()
        }

        await this.mark_chain_reload(chainID, r.startBlock)
        await this.mark_chain_reload(chainID, r.startBlock + 1)
        await this.mark_chain_reload(chainID, r.endBlock - 1)
        await this.mark_chain_reload(chainID, r.endBlock)
    }

    async mark_chain_reload(chainID, blockNumber) {
        let recs = await this.poolREADONLY.query(`select unix_timestamp(blockDT) indexTS from block${chainID} where blockNumber = '${blockNumber}'`);
        if (recs.length == 1) {
            let [logDT, _] = paraTool.ts_to_logDT_hr(recs[0].indexTS);
            let sql0 = `update blocklog set loaded = 0, attempted = 0 where chainID = '${chainID}' and logDT = '${logDT}'`
            console.log(sql0);
            this.batchedSQL.push(sql0);
            await this.update_batchedSQL()
        }
    }

    async audit_blocks(chainID = null, monthDT = null, fix = true) {
        // 1. find problematic periods with a small number of records (
        let w = chainID != null ? ` and chainID = ${chainID}` : " and (auditDT is Null or auditDT < date_sub(Now(), interval 6 hour)) "
        if (monthDT) w += ` and monthDT = '${monthDT}'`;
        let sql = `select chainID, monthDT, startBN, endBN, startDT, endDT from blocklogstats where ((( monthDT >= last_day(date_sub(Now(), interval 90 day)) and audited in ( 'Unknown', 'Failure' ) ) or monthDT = LAST_DAY(Now()) )) ${w} order by auditDT`
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
            let bqDataset = this.get_relayChain_dataset(relayChain);
            let sqlQuery = `SELECT number, \`hash\` as block_hash, parent_hash FROM \`substrate-etl.${bqDataset}.blocks${paraID}\` WHERE Date(block_time) >= '${startDT}' and Date(block_time) <= '${endDT}' and number >= ${startBN} and number <= ${endBN} order by number;`
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

            if (fix && audited == "Failure") {
                await this.audit_fix(chainID, monthDT);
            }
        }
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

    async pick_chainbalancecrawler(specific_chainID = null, specific_logDT = null, force = false) {
        if (force) {
            let ts = paraTool.logDT_hr_to_ts(specific_logDT, 0);
            let jobID = "force" + this.getCurrentTS();
            return [specific_chainID, ts, jobID];
        }
        let w = (specific_chainID) ? ` and chainID = '${specific_chainID}' ` : " and chainID in ( select chainID from chain where relayChain in ('polkadot','kusama') )";
        if (specific_logDT) {
            w += ` and logDT = '${specific_logDT}'`;
        }
        let sql = `select chainID, UNIX_TIMESTAMP(logDT) as indexTS, jobID, logDT from chainbalancecrawler as c where lastDT < date_sub(Now(), interval 2 MINUTE) ${w} order by rand() limit 1`;
        let chains = await this.pool.query(sql);
        console.log(chains.length, sql);
        if (chains.length == 0) {
            return [null, null, null];
        }
        // check that its actually in the ready state
        let chainID = chains[0].chainID;
        let logTS = chains[0].indexTS;
        let jobID = chains[0].jobID;
        let [logDT, _] = paraTool.ts_to_logDT_hr(logTS);
        console.log("pick_chainbalancecrawler chose:", chainID, logDT);
        if (await this.is_update_balance_ready(chainID, logDT)) {
            return [chainID, chains[0].indexTS, jobID];
        } else {
            let sql2 = `delete from chainbalancecrawler where logDT = '${logDT}' and chainID = '${chainID}'`
            this.batchedSQL.push(sql2);
            await this.update_batchedSQL();
        }

        console.log("pick_chainbalancecrawler ... not ready anymore", chainID, logDT)
        return [null, null, null];
    }

    // pick a random chain to load yesterday for all chains
    async updateAddressBalances(specific_chainID = null, specific_logDT = null, force = false) {
        // pick something your node started already
        let [chainID, indexTS, jobID] = await this.pick_chainbalancecrawler(specific_chainID, specific_logDT, force);
        console.log(chainID, indexTS, jobID);
        if (chainID == null) {
            let orderby = "blocklog.logDT desc, rand()";
            let w = (specific_chainID != null) ? ` and blocklog.chainID = '${specific_chainID}' ` : "";
            // pick a chain-logDT combo that has been marked Ready ( all blocks finalized )
            //
            let sql = `select blocklog.chainID, UNIX_TIMESTAMP(blocklog.logDT) as indexTS
from blocklog left join chainbalancecrawler on blocklog.logDT = chainbalancecrawler.logDT and chainbalancecrawler.chainID = blocklog.chainID
  where chainbalancecrawler.logDT is null and chainbalancecrawler.chainID is null and blocklog.chainID in (select chainID from chain where relayChain in ('polkadot','kusama'))
  and ( lastUpdateAddressBalancesStartDT < date_sub(Now(), interval 3+POW(3, lastUpdateAddressBalancesAttempts) MINUTE ) or lastUpdateAddressBalancesStartDT is Null )
  and ( blocklog.updateAddressBalanceStatus = "Ready" )
  and blocklog.logDT >= '${balanceStartDT}' ${w} order by rand()`;
            console.log(sql);
            let jobs = await this.pool.query(sql);
            if (jobs.length == 0) {
                console.log(`No updatebalances jobs available`)
                return false;
            }
            for (const c of jobs) {
                console.log("choosing job cand:", c);
                chainID = c.chainID;
                indexTS = c.indexTS;
                jobID = `${chainID}-${indexTS}-${this.getCurrentTS()}`;
                break;
            }
        }
        if (chainID == null) {
            return (false);
        }

        // read updateBalancesLookbackDays
        let updateBalancesLookbackDays = 365;
        let sql1 = `select updateBalancesLookbackDays, crawling from chain where chainID = '${chainID}'`
        let lookbackRecs = await this.poolREADONLY.query(sql1);
        if (lookbackRecs.length > 0) {
            updateBalancesLookbackDays = lookbackRecs[0].updateBalancesLookbackDays;
        }
        let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        if (indexTS < this.getCurrentTS() - updateBalancesLookbackDays * 86400) {
            sql1 = `update blocklog set updateAddressBalanceStatus = 'Ignore' where logDT = '${logDT}' and chainID = '${chainID}'`
            this.batchedSQL.push(sql1);
            await this.update_batchedSQL();
            return;
        }

        let sql = `update blocklog set accountMetricsStatus = 'NotReady', lastUpdateAddressBalancesAttempts = lastUpdateAddressBalancesAttempts + 1 where logDT = '${logDT}' and chainID = '${chainID}' and lastUpdateAddressBalancesAttempts < 30`;
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
        await this.update_address_balances_logDT(chainID, logDT, jobID);
        return (true);
    }

    async update_address_balances_logDT(chainID, logDT, jobID) {
        try {
            let res0 = await this.updateNativeBalances(chainID, logDT, jobID);
            if (res0 == false) {
                return (false);
            }
            let res1 = await this.updateNonNativeBalances(chainID, logDT, jobID);

            await this.load_bqlogfn(chainID, logDT, jobID);

            return (true);
        } catch (err) {
            console.log(err);
            // make sure we can start over
            await this.clean_chainbalancecrawler(logDT, chainID, jobID);
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
        let sql = `delete from chainbalancecrawler where (logDT = '${logDT}' and chainID = '${chainID}') or lastDT < date_sub(Now(), interval 12 hour)`;
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async load_bqlogfn(chainID, logDT, jobID) {
        let projectID = `${this.project}`
        let logDTp = logDT.replaceAll("-", "")
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let fn = this.get_bqlogfn(chainID, logDT, jobID);

        // scan all the rows and write to fn
        try {
            let tblBalances = this.instance.table("balances");
            let startRow = `${chainID}#${logDT}#${jobID}`
            let endRow = `${chainID}#${logDT}#zzzzz`
            console.log("startRow", startRow, endRow)
            let done = false;
            let cnt = 0;
            while (!done) {
                let [rows] = await tblBalances.getRows({
                    start: startRow,
                    end: endRow,
                    limit: 50000
                });
                let rawRows = [];
                for (let i = 0; i < rows.length - 1; i++) {
                    let row = rows[i];
                    let rowData = row.data;
                    if (rowData["balances"]) {
                        for (const last of Object.keys(rowData["balances"])) {
                            let cells = rowData["balances"][last]
                            let cell = cells[0];
                            rawRows.push(cell.value);
                        }
                    }
                }
                // write to disk
                if (rawRows.length > 0) {
                    rawRows.push("");
                    await fs.appendFileSync(fn, rawRows.join("\r\n"));
                    if (rows.length < 50000) {
                        done = true;
                    } else {
                        cnt += rows.length;
                        startRow = rows[rows.length - 1].id;
                        console.log("wrote ", cnt, "rows", fn);
                    }
                } else {
                    done = true;
                }
            }
        } catch (err) {
            console.log(err);
        }

        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd)
        let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.balances${paraID}$${logDTp}' ${fn} schema/substrateetl/balances.json`

        console.log(cmd);
        try {
            await exec(cmd);
            // do a confirmatory query to compute numAddresses and mark that we're done by updating lastUpdateAddressBalancesEndDT
            let sql = `select count(distinct address_pubkey) as numAddresses from substrate-etl.${bqDataset}.balances${paraID} where date(ts) = '${logDT}'`;

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
            let sql_upd = `update blocklog set lastUpdateAddressBalancesEndDT = Now(), numAddresses = '${numAddresses}', numAddressesLastUpdateDT = Now(), updateAddressBalanceStatus = 'AuditRequired', accountMetricsStatus = 'Ready' where chainID = ${chainID} and logDT = '${logDT}'`;
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

    get_bqlogfn(chainID, logDT, jobID, tbl = "balances") {
        let startTS = this.getCurrentTS();
        return `/tmp/${tbl}${chainID}-${logDT}-${jobID}-${startTS}.json`
    }

    generate_btRealtimeRow(rowKey, encodedAssetChain,
        id, relay_chain, para_id, symbol, decimals,
        free, reserved, misc_frozen, frozen,
        free_usd, reserved_usd, misc_frozen_usd, frozen_usd,
        free_raw, reserved_raw, misc_frozen_raw, frozen_raw,
        flags_raw,
        blockTS, bn) {
        let newState = {
            ts: blockTS,
            bn: bn,
            id,
            relay_chain,
            para_id,
            symbol,
            decimals,
            source: this.hostname,
            genTS: this.currentTS()
        };
        if (free) {
            newState.free = free;
            newState.free_raw = free_raw;
            if (free_usd > 0) {
                newState.free_usd = free_usd;
            }
        }
        if (reserved) {
            newState.reserved = reserved;
            newState.reserved_raw = reserved_raw;
            if (reserved_usd > 0) {
                newState.reserved_usd = reserved_usd;
            }
        }
        if (misc_frozen) {
            newState.misc_frozen = misc_frozen;
            newState.misc_frozen_raw = misc_frozen_raw;
            if (misc_frozen_usd > 0) {
                newState.misc_frozen_usd = misc_frozen_usd;
            }
        }
        if (frozen) {
            newState.frozen = frozen;
            newState.frozen_raw = frozen_raw;
            if (frozen_usd > 0) {
                newState.frozen_usd = frozen_usd;
            }
        }

        if (flags_raw) {
            newState.flags_raw = flags_raw;
        }

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

    async updateNonNativeBalances(chainID, logDT = null, jobID = null, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.pool.query(`select relayChain, chainID, paraID, id, WSEndpoint, WSEndpointArchive, assetaddressPallet, chainName from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let chain = chains[0];
        let wsEndpoint = this.get_wsendpoint(chain);
        let chainName = chain.chainName;
        let paraID = chain.paraID;
        let id = chain.id;
        let relayChain = chain.relayChain;
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

                    let free_raw = "";
                    let balance = 0;
                    if (decimals !== false && symbol) {
                        if (val.balance != undefined) {
                            free_raw = paraTool.toNumWithoutComma(val.balance); // no need to call dexhexIntToString here!
                            balance = free_raw / 10 ** decimals;
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
                                    free_usd,
                                    free_raw,
                                    price_usd: priceUSD
                                });

                                if ((logDT == yesterdayDT) || (logDT == todayDT)) {
                                    let rowKey = address.toLowerCase() // just in case
                                    rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain,
                                        id, relayChain, paraID, symbol, decimals,
                                        balance, 0, 0, 0,
                                        free_usd, 0, 0, 0,
                                        free_raw, "", "", "",
                                        "",
                                        blockTS, bn));
                                    if (rows.length > 0) {
                                        console.log("WRITING", rows.length, tblName)
                                        await this.insertBTRows(tblRealtime, rows, tblName);
                                        rows = [];
                                        console.log(symbol, currencyID, `cbt read accountrealtime prefix=${rowKey}`, balance, val.balance, "decimals", decimals);
                                    }
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
                    //chains that use token pallet by index
                    let tokenCurrencyIDList = [paraTool.chainIDMangataX,
                        paraTool.chainIDHydraDX, paraTool.chainIDBasilisk,
                        paraTool.chainIDComposable, paraTool.chainIDPicasso,
                        paraTool.chainIDTuring, paraTool.chainIDOak,
                        paraTool.chainIDDoraFactory,
                        paraTool.chainIDOrigintrail,
                    ]
                    if (tokenCurrencyIDList.includes(chainID)) {
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
                    let misc_frozen = 0;
                    let frozen = 0;
                    let free_raw = "";
                    let reserved_raw = "";
                    let misc_frozen_raw = "";
                    let frozen_raw = "";

                    if (decimals !== false && symbol) {
                        if (state.free != undefined) {
                            free_raw = paraTool.dechexToIntStr(state.free.toString());
                            free = free_raw / 10 ** decimals;
                        }
                        if (state.reserved != undefined) {
                            reserved_raw = paraTool.dechexToIntStr(state.reserved.toString());
                            reserved = reserved_raw / 10 ** decimals;
                        }
                        if (state.miscFrozen != undefined) {
                            misc_frozen_raw = paraTool.dechexToIntStr(state.miscFrozen.toString())
                            misc_frozen = misc_frozen_raw / 10 ** decimals;
                        }
                        if (state.frozen != undefined) {
                            frozen_raw = paraTool.dechexToIntStr(state.frozen.toString());
                            frozen = frozen_raw / 10 ** decimals;
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
                            let misc_frozen_usd = misc_frozen * priceUSD;
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
                                misc_frozen,
                                frozen,
                                free_usd,
                                reserved_usd,
                                misc_frozen_usd,
                                frozen_usd,
                                free_raw,
                                reserved_raw,
                                misc_frozen_raw,
                                frozen_raw,
                                price_usd: priceUSD
                            });
                            if (logDT == yesterdayDT || logDT == todayDT) {
                                rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain,
                                    id, relayChain, paraID, symbol, decimals,
                                    free, reserved, misc_frozen, frozen,
                                    free_usd, reserved_usd, misc_frozen_usd, frozen_usd,
                                    free_raw, reserved_raw, misc_frozen_raw, frozen_raw,
                                    "",
                                    blockTS, bn));
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
                // write rows to balances
                let tblBalances = this.instance.table("balances")
                let rawRows = bqRows.map((r) => {
                    let assetChain = paraTool.makeAssetChain(r.asset, chainID);
                    let encodedAssetChain = paraTool.encodeAssetChain(assetChain)
                    let key = `${chainID}#${logDT}#${jobID}#${r.address_pubkey}#${encodedAssetChain}`
                    let hres = {
                        key,
                        data: {
                            balances: {}
                        }
                    }
                    hres['data']['balances']['last'] = {
                        value: JSON.stringify(r),
                        timestamp: this.getCurrentTS() * 1000000
                    };
                    return (hres)
                });
                if (rawRows.length > 0) {
                    console.log("WRITING", rawRows.length);
                    await this.insertBTRows(tblBalances, rawRows, "balances");
                }

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
        let sql = `select lastKey from chainbalancecrawler where chainID = '${chainID}' and logDT = '${logDT}' order by tally desc`
        let chains = await this.pool.query(sql);
        console.log("getLastKey", sql, chains);
        if (chains.length == 0) {
            return "";
        } else {
            return chains[0].lastKey;
        }
    }

    async decodeWASMContractsCall(api, args, metadata) {
        console.log("ARGS", args);
        let address = args.dest.id;
        try {
            const contract = new ContractPromise(api, metadata, address);
            console.log("CONTRACT", contract);

            let decodedMessage = contract.abi.decodeMessage(compactAddLength(hexToU8a(args.data)));
            let decodedArgs = decodedMessage.args;
            let argsDefs = decodedMessage.message.args;
            let out = [];
            for (let i = 0; i < argsDefs.length; i++) {
                let argDef = argsDefs[i];
                let decoded = decodedArgs[i];
                let typ = argDef.type.type;
                let decodedData = decoded.toHuman();
                out.push({
                    argDef,
                    decoded,
                    type,
                    decodedData
                })
            }
            return out;
        } catch (err) {
            console.log("decodeWASMContractsCall ERR", err);
        }
    }

    async get_verification_status(codeHash, network = "shiden") {
        let baseUrl = `https://ink-verifier.sirato.xyz/api/info/${network}/${codeHash}`
        try {
            const resp = await axios.get(baseUrl);
            let res = resp.data;
            if (res.status == "verified") {
                return "Verified";
            }
            return "Unverified";
        } catch (err) {

        }
        return "Unknown"
    }

    async dump_democracy(chainID, logDT = null, jobID = null, perPagelimit = 1000) {
	let classIDtoName = {
	    0: "Root",
	    1: "Whitelisted Caller",
	    10: "Staking Admin",
	    11: "Treasurer",
	    12: "Lease Admin",
	    13: "Fellowship Admin",
	    14: "General Admin",
	    15: "Auction Admin",
	    20: "Referendum Canceller",
	    21: "Referendum Killer",
	    30: "Small Tipper",
	    31: "Big Tipper",
	    32: "Small Spender",
	    33: "Medium Spender",
	    34: "Big Spender"
	};

	let convictionMap = {
	    "Locked1x": 1,
	    "Locked3x": 3,
	    "Locked2x": 2,
	    "None": .1,
	    "Locked4x": 4,
	    "Locked6x": 6,
	    "Locked5x": 5
	}

        await this.assetManagerInit();
        let chains = await this.pool.query(`select relayChain, chainID, paraID, id, WSEndpoint, WSEndpointArchive, assetaddressPallet, chainName from chain where chainID = ${chainID}`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }
        let chain = chains[0];
        let wsEndpoint = this.get_wsendpoint(chain);
        let chainName = chain.chainName;
        let paraID = chain.paraID;
        let id = chain.id;
        let relayChain = chain.relayChain;
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
        let done = false;
        let page = 0;
	let numRecs = 0;

	const allEntries = await api.query.convictionVoting.votingFor.entries();
	let votesout = [];
	let out = [];
	allEntries.forEach(([{ args: [account, c] }, r]) => {
	    let v = r.toHuman();
	    let className = classIDtoName[c]
	    if ( v.Casting ) {
		let signer_ss58 = account.toString();
		//13wTn3LdVSFdXqU4bt8ACWznfoFjeeVyaGGCBGXnBN9m7gmb  33 {"casting":{"votes":[
		//[165,{"standard":{"vote":"0x82","balance":1000000000000}}]
	        //],"delegations":{"votes":0,"capital":0},"prior":[0,0]}}
		let votes = v.Casting.votes
		for ( const vote of votes ) {
		    let pollid = vote[0];
		    let p = vote[1];
		    if ( Array.isArray(vote) && vote.length == 2 ) {
			let aye = "0";
			let nay = "0";
			let abstain = "0";
			let conviction = "None"
			let votedesc = null;
			if ( p.Standard ) {
			    let balance = p.Standard.balance.replaceAll(",", "");
			    conviction = p.Standard.vote.conviction;
			    let v = p.Standard.vote.vote;
			    if ( v == "Aye" ) {
				aye = balance
				votedesc = v;
			    } else if ( v == "Nay" ) {
				nay = balance
				votedesc = v;
			    } else  {
				console.log("STANDARD WEIRD", p)
			    }
			} else if ( p.Split ) {
			    aye = p.Split.aye.replaceAll(",", "");
			    nay = p.Split.nay.replaceAll(",", "");
			    votedesc = "Split";
			} else if ( p.SplitAbstain ) {
			    aye = p.SplitAbstain.aye.replaceAll(",", "");
			    nay = p.SplitAbstain.nay.replaceAll(",", "");
			    abstain = p.SplitAbstain.abstain.replaceAll(",", "");
			    votedesc = "SplitAbstain";
			} else {
			    console.log("WEIRD", p);
			}
			let mult = convictionMap[conviction] ? convictionMap[conviction] : 1;
			aye = aye / 10**10;
			nay = nay / 10**10;
			abstain = abstain / 10**10;
			let ayec = aye * mult;
			let nayc = nay * mult;
			votesout.push(`( ${mysql.escape(signer_ss58)}, '${c}', ${mysql.escape(pollid)}, ${mysql.escape(votedesc)},${mysql.escape(aye)}, ${mysql.escape(ayec)}, ${mysql.escape(nay)}, ${mysql.escape(nayc)}, ${mysql.escape(abstain)}, ${mysql.escape(className)}, ${mysql.escape(conviction)}, Now() )`);
		    }
		}
	    }
	    if ( v.Delegating ) {
		let signer_ss58 = account.toString();
		let d = v.Delegating;
		let balance = d.balance.replaceAll(",", "") / 10**10;
		let target = d.target;
		let conviction = d.conviction;
		out.push(`(${mysql.escape(signer_ss58)}, '${c}', ${mysql.escape(conviction)}, ${mysql.escape(target)}, ${mysql.escape(balance)}, ${mysql.escape(className)}, Now() )`);
	    }
	});

	console.log("insert votes", votesout.length)
	let vals = ["vote", "aye", "ayec", "nay", "nayc", "abstain", "className", "conviction", "lastUpdateDT"];
        await this.upsertSQL({
            "table": `votes${chainID}`,
            keys: ["account", "classID", "pollID"],
            vals: vals,
            data: votesout,
            replace: vals
        });
	console.log("insert delegation", out.length)
	vals = ["conviction", "target", "balance", "className", "lastUpdateDT"],
        await this.upsertSQL({
            "table": `delegation${chainID}`,
            keys: ["account", "classID"],
            vals: vals,
            data: out,
            replace: vals
        });
	process.exit(0);
    }

    /*
    contracts pallets do not have that much activity yet, so reindexing an entire chain to find contracts events is just wasteful.
     0. Do pagedEntries { codeStorage + contractInfo }
     1. Build contractsevents{paraID} from startDT with a single bq load operation that generates an empirically small table
         SELECT * FROM `substrate-etl.kusama.events2007` WHERE DATE(block_time) >= "${startDT}" and section = "contracts";
     2. Filter contractsevents{paraID} 3 times based:
          (a) CodeStored ==> wasmCode.{extrinsicHash, extrinsicID, storer (*), codeStoredBN, codeStoredTS }
          (b) ContractInstantiated ==> contracts.{extrinsicHash, extrinsicID, instantiateBN, blockTS, deployer (*) }
          (c) Call ==> contractsCall
     3. For any codeHash without any recent verification (based on wasmCode.status), execute
     4. Dump substrate-etl tables  need from substrate-etl.{relayChain}.{events, extrinsics} table:
        (a) contractscode{paraID} (from wasmCode)
        (b) contracts{paraID} (from contracts)
        (c) contractscall{paraID} (from contractsCall)
     5. The indexer should perform the same inserts, and the polkaholic API uses the same source tables.

    wasmCode
    +---------------+-----------------------------------------+------+-----+---------+-------+
    | Field         | Type                                    | Null | Key | Default | Extra |
    +---------------+-----------------------------------------+------+-----+---------+-------+
    | codeHash      | varchar(67)                             | NO   | PRI | NULL    |       | contracts.codeStorage
    | chainID       | int(11)                                 | NO   | PRI | NULL    |       | contracts.codeStorage
    | extrinsicHash | varchar(67)                             | YES  |     | NULL    |       | contractevents{paraID}
    | extrinsicID   | varchar(32)                             | YES  |     | NULL    |       | contractevents{paraID}
    | storer        | varchar(67)                             | YES  |     | NULL    |       | contractevents{paraID} left join extrinsic_id with extrinsics{paraID} once, but then again for last N days or something
    | wasm          | mediumblob                              | YES  |     | NULL    |       | contracts.codeStorage
    | codeStoredBN  | int(11)                                 | YES  |     | NULL    |       | contractevents{paraID}
    | codeStoredTS  | int(11)                                 | YES  |     | NULL    |       | contractevents{paraID}
    | metadata      | mediumblob                              | YES  |     | NULL    |       | verifier metadata
    | status        | enum('Unknown','Unverified','Verified') | YES  |     | Unknown |       | used to check
    | code          | mediumblob                              | YES  |     | NULL    |       | TBD
    | language      | varchar(128)                            | YES  |     | NULL    |       | verifier metadata source
    | compiler      | varchar(128)                            | YES  |     | NULL    |       | fill in with ink verifier + add lastCodeCheckDT -- and check hourly
    | lastStatusCheckDT datetime                              | YES  |     | NULL    |       | polling var
    | contractName  | varchar(255)                            | YES  |     | NULL    |       | verifier metadata
    | version       | varchar(32)                             | YES  |     | NULL    |       | verifier metadata
    | authors       | blob                                    | YES  |     | NULL    |       | verifier metadata
    +---------------+-----------------------------------------+------+-----+---------+-------+

    contracts
    +---------------+-------------+------+-----+---------+-------+
    | Field         | Type        | Null | Key | Default | Extra |
    +---------------+-------------+------+-----+---------+-------+
    | address       | varchar(67) | NO   | PRI | NULL    |       | contractInfoOf
    | chainID       | int(11)     | NO   | PRI | NULL    |       | contractInfoOf
    | extrinsicHash | varchar(67) | YES  |     | NULL    |       | contractevents{paraID}
    | extrinsicID   | varchar(32) | YES  |     | NULL    |       | contractevents{paraID}
    | instantiateBN | int(11)     | YES  |     | NULL    |       | contractevents{paraID}
    | codeHash      | varchar(67) | YES  | MUL | NULL    |       | contractInfoOf
    | constructor   | blob        | YES  |     | NULL    |       | indexer only/verifier?
    | salt          | blob        | YES  |     | NULL    |       | indexer only/verifier?
    | blockTS       | int(11)     | YES  | MUL | NULL    |       | contractevents{paraID}
    | deployer      | varchar(67) | YES  | MUL | NULL    |       | contractevents{paraID} left join extrinsic_id with extrinsics{paraID}
    +---------------+-------------+------+-----+---------+-------+
    	    */
    async updateContracts(chainID, loadSourceTables = false, perPageLimit = 10, startDT = "2023-04-01") {
        await this.assetManagerInit();
        let chains = await this.poolREADONLY.query(`select chainID, id, relayChain, paraID, chainName, WSEndpoint, WSEndpointArchive, numHolders, totalIssuance, decimals from chain where chainID = '${chainID}'`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }

        let chain = chains[0];
        let relayChain = chain.relayChain;
        let paraID = chain.paraID;
        let chainName = chain.chainName;
        let id = chain.id;
        let bqDataset = this.get_relayChain_dataset(relayChain);

        let wsEndpoint = chain.WSEndpoint;
        let alts = {
            2006: [],
            22007: [],
            40000: [],
            2094: [],
            22124: []
        }
        if (alts[chainID] !== undefined && (alts[chainID].length > 0)) {
            let a = alts[chainID];
            wsEndpoint = a[Math.floor(Math.random() * a.length)];
        }

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
        let numContracts = 0;
        let [logDT, _] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
        let [finalizedBlockHash, blockTS, bn] = await this.getFinalizedBlockInfo(chainID, api, logDT)
        let page = 0;
        let last_key = '';
        // 0. (a) contracts.codeStorage => wasmCode
        let done = false;
        while (!done) {
            let query = null;
            try {
                query = await api.query.contracts.codeStorage.entriesPaged({
                    args: [],
                    pageSize: perPageLimit,
                    startKey: last_key
                })
            } catch (err) {
                console.log(err)
            }
            if (query.length == 0) {
                console.log(`Query Completed: total ${numContracts} contracts`)
                break
            } else {
                console.log(`Query Completed: total ${numContracts} contracts`)
            }
            let keys = ["codeHash", "chainID"];
            let vals = ["code"];
            let out = [];
            for (const c of query) {
                numContracts++;
                let pub = c[0].slice(-32);
                let codeHash = u8aToHex(pub);
                let codeStruct = c[1].toHuman();
                let code = codeStruct.code;
                console.log("contracts.codeStorage", chainID, codeHash, numContracts);
                out.push(`(${mysql.escape(codeHash)}, '${chainID}', ${mysql.escape(code)})`);
            }
            last_key = (query.length >= perPageLimit) ? query[query.length - 1][0] : "";
            // write out
            await this.upsertSQL({
                "table": "wasmCode",
                keys,
                vals,
                data: out,
                replace: vals
            });
            if (last_key == "") done = true;
        }
        done = false;
        last_key = "";
        while (!done) {
            let query = null;
            console.log("contract");
            try {
                query = await api.query.contracts.contractInfoOf.entriesPaged({
                    args: [],
                    pageSize: perPageLimit,
                    startKey: last_key
                })
            } catch (err) {
                console.log(err)
                done = true;
                return (false);
            }
            if (query.length == 0) {
                console.log(`Query Completed: total ${numContracts} contracts`)
                break
            } else {
                console.log(`Query Completed: total ${numContracts} contracts`)
            }

            let keys = ["address", "chainID"];
            let vals = ["codeHash", "storageBytes", "storageItems", "storageByteDeposit", "storageItemDeposit", "storageBaseDeposit"];
            let out = [];
            for (const c of query) {
                /*
Example of contractInfoOf:
0x7eeccf55e02fe5a8145620efda6ebeed3ea3e3d3011057552d187401ded7589a {
  trieId: '0xba9946f34133258fb460e1bc9beb614fcbaa48373c53406683b526fa0fe3a8b7',
  codeHash: '0xe161583d273075a0b18d1b9f2b924b9c9ee517ff865c98a31c1cd0897181a9bc',
  storageBytes: '117',
  storageItems: '2',
  storageByteDeposit: '117,000,000,000',
  storageItemDeposit: '2,000,000,000',
  storageBaseDeposit: '122,000,000,000'
}
	*/
                numContracts++;
                let pub = c[0].slice(-32);
                let address = u8aToHex(pub);
                let contractInfo = c[1].toHuman();
                let codeHash = contractInfo.codeHash;
                let storageBytes = paraTool.toNumWithoutComma(contractInfo.storageBytes);
                let storageItems = paraTool.toNumWithoutComma(contractInfo.storageItems);
                let storageByteDeposit = paraTool.toNumWithoutComma(contractInfo.storageByteDeposit);
                let storageItemDeposit = paraTool.toNumWithoutComma(contractInfo.storageItemDeposit);
                let storageBaseDeposit = paraTool.toNumWithoutComma(contractInfo.storageBaseDeposit);
                out.push(`('${address}', '${chainID}', '${codeHash}', '${storageBytes}', '${storageItems}', '${storageByteDeposit}', '${storageItemDeposit}', '${storageBaseDeposit}')`);
            }

            last_key = (query.length >= perPageLimit) ? query[query.length - 1][0] : "";
            if (last_key == "") done = true;
            // write out
            await this.upsertSQL({
                "table": "contract",
                keys,
                vals,
                data: out,
                replace: vals
            });
        }

        // 2. Filter events{paraID} 3 times based:
        let tables = ["contracts", "contractscode", "contractscall"];
        for (const tbl of tables) {
            let sql = null;
            switch (tbl) {
                case "contractscode":
                    // (a) CodeStored ==> wasmCode.{extrinsicHash, extrinsicID, storer (*), codeStoredBN, codeStoredTS }
                    sql = ` With events as (select extrinsic_id, extrinsic_hash, UNIX_SECONDS(block_time) codeStoredTS, block_number, block_hash, data from substrate-etl.contracts.events_${id}
  where section = 'contracts' and method = 'CodeStored')
  select events.*, signer_pub_key from events left join substrate-etl.${bqDataset}.extrinsics${paraID} as extrinsics on events.extrinsic_id = extrinsics.extrinsic_id`
                    let rows = await this.execute_bqJob(sql);
                    for (const r of rows) {
                        let data = JSON.parse(r.data);
                        let codeHash = data[0];
                        let extrinsicHash = r.extrinsic_hash;
                        let storer = r.signer_pub_key;
                        let codeStoredBN = r.block_number;
                        let codeStoredTS = r.codeStoredTS;
                        sql = `update wasmCode set extrinsicID = ${mysql.escape(r.extrinsic_id)}, extrinsicHash = ${mysql.escape(r.extrinsic_hash)}, storer = ${mysql.escape(storer)}, codeStoredBN = ${mysql.escape(codeStoredBN)}, codeStoredTS = ${mysql.escape(codeStoredTS)} where codeHash = '${codeHash}' and chainID = '${chainID}'`
                        //console.log("CODESTORED", sql);
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL();
                    }
                    break;
                case "contracts":
                // (b) Instantiated ==> contracts.{extrinsicHash, extrinsicID, instantiateBN, blockTS, deployer (*) }
                {
                    // TODO: ContractEmitted
                    sql = ` With events as (select extrinsic_id, extrinsic_hash, UNIX_SECONDS(block_time) blockTS, block_number, block_hash, data from substrate-etl.contracts.events${id}
  where section = 'contracts' and method = 'Instantiated')
  select events.*, signer_pub_key from events left join substrate-etl.${bqDataset}.extrinsics${paraID} as extrinsics on events.extrinsic_id = extrinsics.extrinsic_id`
                    let rows = await this.execute_bqJob(sql);
                    for (const r of rows) {
                        let data = JSON.parse(r.data);
                        let address_ss58 = data[0];
                        let deployer_ss58 = data[1];
                        if (address_ss58) {
                            let extrinsicID = r.extrinsic_id;
                            let extrinsicHash = r.extrinsic_hash;
                            let instantiateBN = r.block_number;
                            let blockTS = r.blockTS;
                            let address = paraTool.getPubKey(address_ss58);
                            let deployer = paraTool.getPubKey(deployer_ss58);
                            sql = `update contract set extrinsicID = ${mysql.escape(extrinsicID)}, extrinsicHash = ${mysql.escape(extrinsicHash)}, deployer = ${mysql.escape(deployer)}, blockTS = ${mysql.escape(blockTS)} where address = '${address}' and chainID = '${chainID}'`
                            this.batchedSQL.push(sql);
                            await this.update_batchedSQL();
                        }
                    }
                }
                break;
                case "contractscall":
                // (c) Called ==> contractscall -- TODO decode, e.g. flip call
                {
                    // NOTE that this is not complete becuase of utility batch , etc. so we should use contracts.called events, but for some reason this was not systematic, grr.
                    sql = `select extrinsic_id, \`hash\` as extrinsic_hash, UNIX_SECONDS(block_time) blockTS, block_number, block_hash, params, signer_pub_key from substrate-etl.contracts.calls${id} where section = 'contracts' and method = 'call'`
                    let rows = await this.execute_bqJob(sql);
                    let out = []
                    for (const r of rows) {
                        let extrinsic_id = r.extrinsic_id;
                        let extrinsic_hash = r.extrinsic_hash;
                        let blockTS = r.blockTS;
                        let blockNumber = r.block_number;
                        let blockHash = r.block_hash;
                        let params = JSON.parse(r.params);
                        let contract_ss58 = params.dest.id;
                        let contract = paraTool.getPubKey(contract_ss58);
                        let gas_limit = paraTool.isNumeric(params.gas_limit) ? paraTool.dechexToIntStr(params.gas_limit) : 0;
                        let storage_deposit_limit = params.storage_deposit_limit && params.storage_deposit_limit.length > 4 ? paraTool.dechexToIntStr(params.storage_deposit_limit) : 0;
                        let value = bnToBn(params.value).toString();
                        let caller = paraTool.getPubKey(r.signer_pub_key);
                        let decodedCall = null;
                        // fetch ABI for contract, interpret call data to decode contract call data in bulk, store in contractsCall table
                        //console.log("CALL", params);
                        let codeHash = null;
                        let sql = `select wasmCode.codeHash, metadata from contract join wasmCode on contract.codeHash = wasmCode.codeHash where wasmCode.chainID = '${chainID}' and contract.address = '${contract}'`
                        let wasmContracts = await this.poolREADONLY.query(sql);
                        if (wasmContracts.length > 0) {
                            let wasmContract = wasmContracts[0]
                            if (wasmContract) {
                                codeHash = wasmContract.codeHash;
                                if (wasmContract.metadata) {
                                    //interpret call data in accordance with decoratedExt.metadata = wasmContract.metadata;
                                    //decodedCall = this.decodeWASMContractsCall(api, params, wasmContract.metadata);
                                    //console.log("CALLED", caller, contract, params, r,  decodedCall);
                                }
                            }
                            out.push(`('${extrinsic_id}', '${chainID}', '${extrinsic_hash}', ${mysql.escape(blockTS)}, ${mysql.escape(blockNumber)}, ${mysql.escape(blockHash)}, ${mysql.escape(contract)}, ${mysql.escape(storage_deposit_limit)}, ${mysql.escape(value)}, ${mysql.escape(caller)}, ${mysql.escape(codeHash)}, ${mysql.escape(decodedCall)})`)
                        }
                    }
                    if (out.length > 0) {
                        let keys = ["extrinsicID", "chainID"]
                        let vals = ["extrinsicHash", "blockTS", "blockNumber", "blockHash", "address", "storageDepositLimit", "value", "caller", "codeHash", "decodedCall"];
                        await this.upsertSQL({
                            "table": "contractsCall",
                            keys,
                            vals,
                            data: out,
                            replace: vals
                        });
                    }
                }
                break;
            }
        }
        // tally stats from the above
        // let sql = `update chain set numCodeHashes = '${numCodeHashes}', numContracts = '${numContracts}', numContractCalls = '${numContractCalls}'where chainID = ${chainID}'`
        // console.log(sql);
        // this.batchedSQL.push(sql);
        // await this.update_batchedSQL();
        return (true);
    }

    lookup_contract_chain(chainID) {
        let chainInfo = this.chainInfos[chainID];
        let para_id = paraTool.getParaIDfromChainID(chainID);
        let relay_chain = paraTool.getRelayChainByChainID(chainID);
        let id = chainInfo.id;
        let prefix = chainInfo.ss58Format;
        return [id, relay_chain, para_id, prefix];
    }

    // Dump substrate-etl tables into contracts dataset:
    // (a) contractscode (from wasmCode);
    // (b) contracts (from contracts)
    // (c) contractscall (from contractsCall)
    async dumpContracts() {
        let tables = ["contracts", "contractscode", "contractscall"];
        for (const tbl of tables) {
            let startTS = this.getCurrentTS();
            let bqRows = [];
            let fulltbl = `contracts.${tbl}`;
            switch (tbl) {
                case "contractscall":
                    let sql = `select c.extrinsicID, c.chainID, c.extrinsicHash, c.blockTS, c.blockNumber, c.blockHash, c.address, c.gasLimit, c.storageDepositLimit, c.value, c.caller, c.codeHash, CONVERT(decodedCall using utf8) decodedCall,
contract.deployer, wasmCode.storer, wasmCode.language, wasmCode.contractName, wasmCode.status, wasmCode.contractName from contractsCall as c, contract, wasmCode where c.address = contract.address and c.chainID = contract.chainID and c.codeHash = wasmCode.codeHash and c.chainID = wasmCode.chainID
`;
                    let recs = await this.poolREADONLY.query(sql);
                    for (const r of recs) {
                        let [id, relay_chain, para_id, prefix] = this.lookup_contract_chain(r.chainID);
                        bqRows.push({
                            block_timestamp: r.blockTS,
                            id,
                            relay_chain,
                            para_id,
                            address_pub_key: r.address,
                            address_ss58: encodeAddress(r.address, prefix),
                            contract_name: r.contractName,
                            extrinsic_id: r.extrinsicID,
                            extrinsic_hash: r.extrinsicHash,
                            block_number: r.blockNumber,
                            block_hash: r.blockHash,
                            gas_limit: r.gasLimit,
                            storage_deposit_limit: r.storageDepositLimit,
                            value: r.value,
                            caller_pub_key: r.caller,
                            caller_ss58: r.deployer ? encodeAddress(r.caller, prefix) : null,
                            code_hash: r.codeHash,
                            decoded_call: r.decodedCall,
                            deployer_pub_key: r.deployer,
                            deployer_ss58: r.deployer ? encodeAddress(r.deployer, prefix) : null,
                            storer_pub_key: r.storer,
                            storer_ss58: r.storer ? encodeAddress(r.storer, prefix) : null,
                            status: r.status,
                            language: r.language,
                            compiler: r.compiler
                        });
                    }
                    break;
                case "contracts": {
                    let sql = `select contract.address, contract.chainID, contract.extrinsicHash, contract.extrinsicID, contract.instantiateBN, contract.codeHash,
CONVERT(contract.constructor using utf8) as constructor, CONVERT(contract.salt using utf8) as salt, contract.blockTS, contract.deployer, contract.storageBytes, contract.storageItems,
contract.storageByteDeposit, contract.storageItemDeposit, contract.storageBaseDeposit, wasmCode.codeStoredBN, wasmCode.status, wasmCode.language, wasmCode.contractName, wasmCode.storer,
CONVERT(wasmCode.metadata using utf8) metadata from contract, wasmCode where contract.codeHash = wasmCode.codeHash `
                    let recs = await this.poolREADONLY.query(sql);
                    for (const r of recs) {
                        let [id, relay_chain, para_id, prefix] = this.lookup_contract_chain(r.chainID);
                        if (r.address && r.address.length > 10 && r.blockTS) {
                            bqRows.push({
                                deployed_ts: r.blockTS,
                                id,
                                relay_chain,
                                para_id,
                                address_pub_key: r.address,
                                address_ss58: r.address ? encodeAddress(r.address, prefix) : null,
                                contract_name: r.contractName,
                                deployer_pub_key: r.deployer,
                                deployer_ss58: r.deployer ? encodeAddress(r.deployer, prefix) : null,
                                storer_pub_key: r.storer,
                                storer_ss58: r.storer ? encodeAddress(r.storer, prefix) : null,
                                extrinsic_id: r.extrinsicID,
                                extrinsic_hash: r.extrinsicHash,
                                block_number_stored: r.codeStoredBN,
                                block_number_instantiated: r.instantiateBN,
                                code_hash: r.codeHash,
                                constructor: r.constructor,
                                salt: r.salt,
                                storage_bytes: r.storage_bytes,
                                storage_items: r.storage_items,
                                storage_byte_deposit: r.storageByteDeposit,
                                storage_item_deposit: r.storageItemDeposit,
                                storage_base_deposit: r.storageBaseDeposit,
                                metadata: r.metadata,
                                status: r.status,
                                language: r.language,
                                compiler: r.compiler
                            });
                        } else {
                            console.log("contract PROBLEM", r.chainID, r.address, r.blockTS);
                        }
                    }
                }
                break;
                case "contractscode": {
                    let sql = `select codeHash, chainID, extrinsicHash, extrinsicID, storer, CONVERT(wasm using utf8) wasm, codeStoredBN, codeStoredTS, CONVERT(metadata using utf8) metadata, status, CONVERT(code using utf8) code, language, compiler, CONVERT(authors using utf8) authors from wasmCode`
                    let recs = await this.poolREADONLY.query(sql);
                    for (const r of recs) {
                        let [id, relay_chain, para_id, prefix] = this.lookup_contract_chain(r.chainID);
                        if (r.codeStoredTS) {
                            bqRows.push({
                                id,
                                relay_chain,
                                para_id,
                                code_stored_ts: r.codeStoredTS,
                                code_hash: r.codeHash,
                                extrinsic_id: r.extrinsicID,
                                extrinsic_hash: r.extrinsicHash,
                                storer_pub_key: r.storer,
                                storer_ss58: r.storer ? encodeAddress(r.storer, prefix) : null,
                                bytecode: r.wasm,
                                block_number: r.codeStoredBN,
                                metadata: r.metadata,
                                status: r.status,
                                bytecode: r.code,
                                language: r.language,
                                compiler: r.compiler
                            });
                        } else {
                            // TODO:
                            console.log("CODE", r);
                        }
                    }
                }
            }
            if (bqRows.length > 0) {
                let fn = `/tmp/${tbl}-${startTS}`
                let rawRows = bqRows.map((r) => {
                    return JSON.stringify(r);
                });
                rawRows.push("");
                await fs.appendFileSync(fn, rawRows.join("\n"));
                // TODO: make these tables date partitioned -- not enough data to make this worthwhile except for calls
                try {
                    let cmd = `bq load  --project_id=${this.project} --max_bad_records=1 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${fulltbl}' ${fn} schema/substrateetl/contracts/${tbl}.json`;
                    console.log(cmd);
                    await exec(cmd);
                    console.log("SUCCESS");
                } catch (err) {
                    console.log(err);
                }
            }
        }
        console.log("DONE");
    }

    get_wsendpoint(chain) {
        let wsEndpoint = chain.WSEndpoint;
        let alts = {
            0: ['wss://rpc.dotters.network/polkadot', 'wss://polkadot-rpc.dwellir.com', 'wss://rpc.ibp.network/polkadot', 'wss://rpc.polkadot.io'],
            2: ['wss://1rpc.io/ksm', 'wss://rpc.dotters.network/kusama', 'wss://kusama-rpc.dwellir.com', 'wss://kusama-rpc-tn.dwellir.com', 'wss://rpc.ibp.network/kusama', 'wss://kusama.api.onfinality.io/public-ws', 'wss://kusama-rpc.polkadot.io', 'wss://kusama.public.curie.radiumblock.co/ws'],
            22023: ['wss://moonriver.public.blastapi.io', 'wss://wss.api.moonriver.moonbeam.network', 'wss://moonriver.api.onfinality.io/public-ws', 'wss://moonriver.unitedbloc.com:2001'],
            2004: ['wss://1rpc.io/glmr', 'wss://moonbeam.public.blastapi.io', 'wss://wss.api.moonbeam.network', 'wss://moonbeam.api.onfinality.io/public-ws', 'wss://moonbeam.unitedbloc.com:3001'],
            2000: ['wss://acala-rpc-0.aca-api.network'],
            2094: ['wss://rpc-pendulum.prd.pendulumchain.tech'],
            2026: ['wss://eden-rpc.dwellir.com'],
            22048: ['wss://kusama.rpc.robonomics.network'],
            22114: ['wss://turing-rpc.dwellir.com'],
            2034: ['wss://hydradx-rpc.dwellir.com']

        }
        let chainID = chain.chainID;
        if (alts[chainID] !== undefined && (alts[chainID].length > 0)) {
            let a = alts[chainID];
            wsEndpoint = a[Math.floor(Math.random() * a.length)];
            console.log("choose", wsEndpoint);
        }
        return wsEndpoint;
    }

    async updateNativeBalances(chainID, logDT, jobID, perPagelimit = 1000) {
        await this.assetManagerInit();
        let chains = await this.poolREADONLY.query(`select chainID, id, relayChain, paraID, chainName, WSEndpoint, WSEndpointArchive, numHolders, totalIssuance, decimals from chain where chainID = '${chainID}'`);
        if (chains.length == 0) {
            console.log("No chain found ${chainID}")
            return false;
        }

        let chain = chains[0];
        let relayChain = chain.relayChain;
        let paraID = chain.paraID;
        let chainName = chain.chainName;
        let id = chain.id;
        let wsEndpoint = this.get_wsendpoint(chain);
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
                    console.log("totalIssuance: ", totalIssuance);
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
        let last_key = await this.getLastKey(chainID, logDT, jobID);

        if (last_key == "") {} else {
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
            console.log("finalizedBlockHash", finalizedBlockHash);
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
                let balance = user[1].data // check equil/genshiro case
                let free_raw = balance.free ? paraTool.dechexToIntStr(balance.free.toString()) : "";
                let reserved_raw = balance.reserved ? paraTool.dechexToIntStr(balance.reserved.toString()) : "";
                let misc_frozen_raw = balance.miscFrozen ? paraTool.dechexToIntStr(balance.miscFrozen.toString()) : "";
                let frozen_raw = balance.feeFrozen ? paraTool.dechexToIntStr(balance.feeFrozen.toString()) : "";
                let flags_raw = balance.flags ? balance.flags.toString() : "";
                if (chainID == 22024 || chainID == 2011) {
                    balance = balance.toJSON();
                    if (balance.v0 && balance.v0.balance) {
                        balance = balance.v0.balance;
                        console.log(balance)
                        // String {"nonce":0,"consumers":0,"providers":3,"sufficients":0,"data":{"v0":{"lock":0,"balance":[[6450786,{"positive":170000000}],[6648164,{"positive":408318303}],[6648936,{"positive":40143961}],[1651864420,{"positive":2852210857}],[1734700659,{"positive":80714784622320}],[1751412596,{"positive":22000000000}],[2019848052,{"positive":50000000000}],[517081101362,{"positive":42000000000}]]}}}
                        for (let b of balance) {
                            if (b.length == 2) {
                                let currencyID = b[0];
                                if (((currencyID == 1734700659) || (currencyID == 25969)) && b[1].positive) {
                                    free_raw = b[1].positive.toString()
                                }
                            }
                        }
                    } else {
                        console.log("CHECK genshiro", balance);
                    }
                }
                let free = (free_raw.length > 0) ? free_raw / 10 ** decimals : 0;
                let reserved = (reserved_raw.length > 0) ? reserved_raw / 10 ** decimals : 0;
                let misc_frozen = (misc_frozen_raw.length > 0) ? misc_frozen_raw / 10 ** decimals : 0;
                let frozen = (frozen_raw.length > 0) ? frozen_raw / 10 ** decimals : 0;

                let stateHash = u8aToHex(user[1].createdAtHash)
                if ((chainID == 2004 || chainID == 22023) && (pubkey.length >= 40)) {
                    pubkey = "0x" + pubkey.substr(pubkey.length - 40, 40); // evmaddress is the last 20 bytes (40 chars) of the storagekey
                    account_id = "";
                }
                let rowKey = pubkey.toLowerCase()
                if (logDT) {
                    let free_usd = (priceUSD > 0) ? free * priceUSD : 0;
                    let reserved_usd = (priceUSD > 0) ? reserved * priceUSD : 0;
                    let misc_frozen_usd = (priceUSD > 0) ? misc_frozen * priceUSD : 0;
                    let frozen_usd = (priceUSD > 0) ? frozen * priceUSD : 0;

                    if ((free > 0) || (reserved > 0) || (misc_frozen > 0) || (frozen > 0)) {
                        bqRows.push({
                            chain_name: chainName,
                            id,
                            para_id: paraID,
                            address_pubkey: pubkey,
                            address_ss58: account_id,
                            asset,
                            symbol,
                            free,
                            reserved,
                            misc_frozen,
                            frozen,
                            free_raw,
                            reserved_raw,
                            misc_frozen_raw,
                            frozen_raw,
                            free_usd,
                            reserved_usd,
                            misc_frozen_usd,
                            frozen_usd,
                            flags_raw,
                            ts: blockTS,
                            price_usd: priceUSD,
                            nonce: nonce
                        });
                        if ((logDT == yesterdayDT) || (logDT == todayDT)) {
                            rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain,
                                id, relayChain, paraID, symbol, decimals,
                                free, reserved, misc_frozen, frozen,
                                free_usd, reserved_usd, misc_frozen_usd, frozen_usd,
                                free_raw, reserved_raw, misc_frozen_raw, frozen_raw,
                                flags_raw,
                                blockTS, bn));
                        }
                    }
                }
            }
            if (rows.length > 0) {
                await this.insertBTRows(tblRealtime, rows, "balances");
                rows = []
            }

            console.log("writing", `${chainID}#${logDT}#${jobID} with PUBKEY${encodedAssetChain}`, bqRows.length);
            if (logDT) {
                // write rows to balances
                let tblBalances = this.instance.table("balances")
                let rawRows = bqRows.map((r) => {
                    let key = `${chainID}#${logDT}#${jobID}#${r.address_pubkey}#${encodedAssetChain}`
                    let hres = {
                        key,
                        data: {
                            balances: {}
                        }
                    }
                    hres['data']['balances']['last'] = {
                        value: JSON.stringify(r),
                        timestamp: this.getCurrentTS() * 1000000
                    };
                    return (hres)
                });
                if (rawRows.length > 0) {
                    console.log("WRITING", rawRows.length);
                    await this.insertBTRows(tblBalances, rawRows, "balances");
                }
            }
            last_key = (query.length > 999) ? query[query.length - 1][0] : "";

            const gbRounded = this.gb_heap_used();
            console.log(`system.account page: `, page++, last_key.toString(), "recs=", query.length, `Heap allocated ${gbRounded} GB`, query.length);
            // save last_key state in db and get out if memory is getting lost (>1GB heap) -- we will pick it up again
            let sql1 = `insert into chainbalancecrawler (chainID, logDT, jobID, lastDT, lastKey, tally) values ('${chainID}', '${logDT}', '${jobID}', Now(), '${last_key.toString()}', '${query.length}') on duplicate key update jobID = values(jobID), lastDT = values(lastDT), lastKey = values(lastKey), tally = tally + values(tally)`
            console.log(sql1);
            this.batchedSQL.push(sql1);
            await this.update_batchedSQL();
            if (last_key == "") done = true;
            if (gbRounded > 1) {
                // when we come back, we'll pick this one
                console.log(`EXITING with last key stored:`, last_key.toString());
                // update lastUpdateAddressBalancesAttempts back to 0
                let sql = `update blocklog set lastUpdateAddressBalancesAttempts = 0 where logDT = '${logDT}' and chainID = '${chainID}'`;
                this.batchedSQL.push(sql1);
                await this.update_batchedSQL();
                process.exit(1);
            }
        }
        console.log(`****** Native account: numHolders = ${numHolders}`);
        let sql = `update blocklog set numNativeHolders = '${numHolders}' where chainID = ${chainID} and logDT = '${logDT}'`;
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
                    let bsql = `SELECT distinct block_number, block_time FROM \`substrate-etl.${bqDataset}.${tbl}${paraID}\` where date(block_time) = '${logDT}' order by block_number`;
                    let fld = "block_number";
                    if (tbl == "blocks") {
                        bsql = `SELECT distinct number, block_time FROM \`substrate-etl.${bqDataset}.${tbl}${paraID}\` where date(block_time) = '${logDT}' order by number`;
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
            let bqDataset = this.get_relayChain_dataset(relayChain)
            for (const tbl of system_tables) {
                let fn = path.join(dir, `${relayChain}-${tbl}.json`)
                let f = fs.openSync(fn, 'w', 0o666);
                let fulltbl = `${projectID}:${bqDataset}.${tbl}`;
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
                "assetholderrelaychain": `select date(ts) as logDT, symbol, count(distinct para_id) numChains, count(distinct address_pubkey) numHolders, sum(free) free, sum(free_usd) freeUSD, sum(reserved) reserved, sum(reserved_usd) reservedUSD, sum(misc_frozen) miscFrozen, sum(misc_frozen_usd) miscFrozenUSD, sum(frozen) frozen, sum(frozen_usd) frozenUSD, avg(price_usd) priceUSD from \`substrate-etl.${bqDataset}.balances*\` where Date(ts) >= "${startDT}" group by logDT, symbol order by symbol, logDT`,
                // (b) group by symbol/asset in "{relaychain}.assetholder{paraID}" for a specific balances table
                "assetholderchain": `select date(ts) as logDT, symbol, asset, para_id, count(distinct address_pubkey) numHolders, sum(free) free, sum(free_usd) freeUSD, sum(reserved) reserved, sum(reserved_usd) reservedUSD, sum(misc_frozen) miscFrozen, sum(misc_frozen_usd) miscFrozenUSD, sum(frozen) frozen, sum(frozen_usd) frozenUSD, avg(price_usd) priceUSD from \`substrate-etl.${bqDataset}.balances*\` where Date(ts) >= "${startDT}"  group by logDT, symbol, asset, para_id`
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
        let sql_ignore = `update blocklog t set updateAddressBalanceStatus = "Ignore", accountMetricsStatus = "Ignore" where chainID in ( select chainID from chain where crawling = 1 and WSEndpointArchive = 0 ) and logDT >= "${balanceStartDT}"`
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
            if (chains[r.chainID]) {
                chains[r.chainID].covered = true;
            }
        }

        for (const chainID of Object.keys(chains)) {
            if (chains[chainID].covered == undefined) {
                let c = chains[chainID];
                let desc = c.crawling > 0 ? "active and onboarding" : "active but not being indexed";
                if (summary[c.relayChain] == undefined) {
                    summary[c.relayChain] = {
                        missing: []
                    }
                }
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

    async update_networklog(network, logDT, jobStartTS = 0) {}

    async dump_networkmetrics(network, logDT) {}

    validateDT(ts, logDT){
        if (ts == undefined){
            console.log(`TS missing!`)
            return false
        }
        let [targetDT, _] = paraTool.ts_to_logDT_hr(ts);
        let blockDT2 = targetDT.replaceAll("-", "")
        let blockDT = logDT.replaceAll("-", "")
        if (blockDT2 == blockDT){
            return true
        }else{
            console.log(`Mistmatch TS=${ts}->${blockDT2}, logDT=${logDT}->${blockDT}`)
            return false
        }
    }

    getLogDTRange2(startLogDT = null, endLogDT = null, isAscending = true) {
        let startLogTS = paraTool.logDT_hr_to_ts(startLogDT, 0);
        let [startDT, _] = paraTool.ts_to_logDT_hr(startLogTS);

        let endLogTS;
        if (endLogDT !== null) {
            endLogTS = paraTool.logDT_hr_to_ts(endLogDT, 0);
        }

        if (startLogDT && endLogDT && startLogDT === endLogDT) {
            return [startLogDT];
        }
        if (startLogDT !== null && endLogDT !== null && startLogTS > endLogTS) {
            return [startLogDT];
        }
        if (startLogDT == null) {
            startLogDT = "2023-02-01";
        }

        let ts = this.getCurrentTS();
        ts = ts - (ts % 86400);

        if (endLogDT !== null) {
            if (ts > endLogTS) ts = endLogTS;
        }

        let logDTRange = [];

        while (true) {
            let [logDT, _] = paraTool.ts_to_logDT_hr(ts);
            logDTRange.push(logDT);
            if (logDT === startDT) {
                break;
            }
            ts = ts - 86400;
        }

        if (isAscending) {
            return logDTRange.reverse();
        } else {
            return logDTRange;
        }
    }

    getLogDTRange(startLogDT = null, endLogDT = null, isAscending = true) {
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
        if (isAscending) {
            return logDTRange.reverse();
        } else {
            return logDTRange
        }
    }

    async is_dump_ready(logDT, dumpType = 'accountmetrics', opt = {}) {
        let chainID = false
        let status = 'NotReady'
        if (opt.paraID != undefined && opt.relayChain != undefined) {
            chainID = paraTool.getChainIDFromParaIDAndRelayChain(opt.paraID, opt.relayChain)
            opt.chainID = chainID
        }
        let sql = null
        let recs = []
        //accountMetricsStatus, updateAddressBalanceStatus, crowdloanMetricsStatus, sourceMetricsStatus, poolsMetricsStatus, identityMetricsStatus, loaded
        switch (dumpType) {
            case "substrate-etl":
                // how to check if dump substrate-etl is ready?

                sql = `select UNIX_TIMESTAMP(logDT) indexTS, blocklog.chainID, chain.isEVM from blocklog, chain where blocklog.chainID = chain.chainID and blocklog.loaded >= 0 and logDT = '${logDT}' and ( loadAttemptDT is null or loadAttemptDT < DATE_SUB(Now(), INTERVAL POW(5, attempted) MINUTE) ) and chain.chainID = ${chainID} order by rand() limit 1`;
                recs = await this.poolREADONLY.query(sql);
                console.log("get_substrate-etl ready", sql);
                if (recs.length == 1) {
                    if (recs[0].loaded) {
                        status = 'Loaded'
                    } else {
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
                if (_network) {
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
                if (opt.relayChain) {
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
            case "storage":
                sql = `select storageMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                if (recs.length == 1) {
                    status = recs[0].storageMetricsStatus
                    if (status == 'Ready') return (true);
                }
                break;
            case "trace":
                sql = `select traceMetricsStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                if (recs.length == 1) {
                    status = recs[0].traceMetricsStatus
                    if (status == 'Ready') return (true);
                }
                break;
            case "tracebackfill":
                sql = `select crawlTraceStatus from blocklog where chainID = '${chainID}' and logDT = '${logDT}'`
                recs = await this.poolREADONLY.query(sql)
                console.log("tracebackfill ready", sql);
                if (recs.length == 1) {
                    status = recs[0].crawlTraceStatus
                    if (status == 'Ready' || status == 'NotReady') return (true);
                }
                break;
            case "staking":
                sql = `select * from era0 where  DATE_FORMAT(blockDT, '%Y-%m-%d') = '${logDT}';`
                recs = await this.poolREADONLY.query(sql)
                console.log("staking ready", sql);
                if (recs.length >= 1) {
                    status = recs[0].crawlNominatorStatus
                    if (status == 'Ready' || status == 'NotReady') return (true);
                }
                break;
            case "identity":
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


    async dump_relaychain_crowdloan(relayChain, logDT) {
        let paraID = 0
        let projectID = `${this.project}`
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
        let bqjobs = []
        console.log(`dump_crowdloan logDT=${logDT}, ${relayChain}-${paraID}, projectID=${projectID}, bqDataset=${bqDataset}`)

        // load new accounts
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(logDT)
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
            let tblName = `${tbl}`
            let destinationTbl = `${bqDataset}.${tblName}$${logYYYYMMDD}`
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
        if (errloadCnt == 0) {
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
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(logDT)
        let jobTS = this.getCurrentTS();
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
            let bqDataset = this.get_relayChain_dataset(relayChain);
            let tblName = `accounts${tbl}`
            let destinationTbl = `${bqDataset}.${tblName}${paraID}$${logYYYYMMDD}`
            let isEVM = isEVMparaID[paraID];

            let targetSQL, partitionedFld, cmd;
            switch (tbl) {
                case "new":
                    /* New User (by account) */
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey),
                            currDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey)
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
                    /* Old User (by account) */
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey),
                            currDay AS (SELECT address_ss58, address_pubkey, min(ts) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey)
                            SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, ts FROM prevDay where address_pubkey in (select address_pubkey from currDay) order by address_pubkey`
                    partitionedFld = 'ts'
                    cmd = `bq query --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
                    //bqjobs.push({chainID: chainID, paraID: paraID, tbl: tblName, destinationTbl: destinationTbl, cmd: cmd})
                    break;

                case "reaped":
                    /* Reaped Account (by probably need a flag for native chainAsset) */
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey),
                     currDay AS (SELECT address_ss58, address_pubkey, max(ts) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey)
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
                    targetSQL = `WITH prevDay AS (SELECT address_ss58, address_pubkey, asset, concat(address_ss58, asset) address_asset, max(TIMESTAMP_ADD(ts, INTERVAL 1 Day) ) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${prevDT}" group by address_ss58, address_pubkey, asset),
                                currDay AS (SELECT address_ss58, address_pubkey, asset, concat(address_ss58, asset) address_asset, max(ts) as ts FROM \`substrate-etl.${bqDataset}.balances${paraID}\` WHERE DATE(ts) = "${currDT}" group by address_ss58, address_pubkey, asset)
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
                    /* Active account (user + system) */
                    targetSQL = `SELECT "${paraID}" as para_id, "${relayChain}" as relay_chain, address_ss58, address_pubkey, max(accountType) as accountType, Max(blockTime) as ts from
                        (WITH activeUserAccount AS (SELECT signer_ss58 as address_ss58, signer_pub_key as address_pubkey, "User" as accountType, Max(block_time) as block_time
                              FROM \`substrate-etl.${bqDataset}.extrinsics${paraID}\` WHERE DATE(block_time) = "${currDT}" and signed = true group by address_ss58, address_pubkey),
                            activeSystemAccount AS (SELECT author_ss58 as address_ss58 , author_pub_key as address_pubkey, "System" as accountType, Max(block_time) as block_time
                              FROM \`substrate-etl.${bqDataset}.blocks${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey)
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
                    break;

                case "passive":
                    targetSQL = ` WITH AcctiveAccount AS (SELECT address_ss58, max(accountType) as accountType from
                         (WITH activeUserAccount AS (SELECT signer_ss58 as address_ss58, signer_pub_key as address_pubkey, "User" as accountType, Max(block_time) as block_time FROM \`substrate-etl.${bqDataset}.extrinsics${paraID}\` WHERE DATE(block_time) = "${currDT}" and signed = true group by address_ss58, address_pubkey),
                          activeSystemAccount AS (SELECT author_ss58 as address_ss58, author_pub_key as address_pubkey, "System" as accountType, Max(block_time) as block_time FROM \`substrate-etl.${bqDataset}.blocks${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey) SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeSystemAccount group by address_ss58, address_pubkey UNION ALL (SELECT address_ss58, address_pubkey, max(accountType) as accountType, Max(block_time) as blockTime FROM activeUserAccount group by address_ss58, address_pubkey)) group by address_ss58, address_pubkey),

                        TransferAccount AS (SELECT address_ss58, address_pubkey, Max(block_time) as block_time FROM (SELECT to_ss58 AS address_ss58, to_pub_key as address_pubkey, Max(block_time) as block_time FROM \`substrate-etl.${bqDataset}.transfers${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey union all SELECT from_ss58 AS address_ss58, from_pub_key as address_pubkey, Max(block_time) as block_time FROM \`substrate-etl.${bqDataset}.transfers${paraID}\` WHERE DATE(block_time) = "${currDT}" group by address_ss58, address_pubkey) group by address_ss58, address_pubkey)

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
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
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
                    origination_id: this.getIDByChainID(x.chainID),
                    destination_id: this.getIDByChainID(x.chainIDDest),
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
        let bqDataset = this.get_relayChain_dataset(relayChain);
        let sqla = {
            "xcmtransfers0": `select  date(origination_ts) logDT, destination_para_id as paraID, count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from substrate-etl.${bqDataset}.xcmtransfers where DATE(origination_ts) >= "${logDT}" group by destination_para_id, logDT having logDT < "${today}" order by logDT`,
            "xcmtransfers1": `select date(origination_ts) as logDT, origination_para_id as paraID, count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from substrate-etl.${bqDataset}.xcmtransfers where DATE(origination_ts) >= "${logDT}" group by origination_para_id, logDT having logDT < "${today}" order by logDT`,
            "xcm0": `select  date(origination_ts) logDT, destination_para_id as paraID, count(*) as numXCMMessagesIn from substrate-etl.${bqDataset}.xcm where DATE(origination_ts) >= "${logDT}" group by destination_para_id, logDT having logDT < "${today}" order by logDT`,
            "xcm1": `select date(origination_ts) as logDT, origination_para_id as paraID, count(*) as numXCMMessagesOut from substrate-etl.${bqDataset}.xcm where DATE(origination_ts) >= "${logDT}" group by origination_para_id, logDT having logDT < "${today}" order by logDT`,
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

    async setUpSubstrateEtlChainparser(chainID, debugLevel = paraTool.debugInfo) {
        await this.chainParserInit(chainID, debugLevel);
        this.chainID = chainID
    }

    async mark_dump_duplicate() {
        const bigquery = this.get_big_query();
        let projectID = `${this.project}`
        let relayChains = ["polkadot", "kusama"]
        for (const relayChain of relayChains) {
            let query = `select '${relayChain}' as relayChain, paraID, FORMAT_TIMESTAMP('%Y-%m-%d', DT) as logDT, count(*) cnt from (SELECT _TABLE_SUFFIX as paraID, TIMESTAMP_TRUNC(block_time, DAY) DT, event_id, count(*) cnt FROM \`substrate-etl.crypto_${relayChain}.transfers*\` WHERE TIMESTAMP_TRUNC(block_time, DAY) >= TIMESTAMP("2023-01-01") and TIMESTAMP_TRUNC(block_time, DAY) < TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)) group by paraID, event_id, block_time having cnt >= 2) as d group by relayChain, logDT, paraID order by paraID, logDT`
            console.log(query)
            let recs = await this.execute_bqJob(query);
            console.log(recs)
            for (const rec of recs) {
                let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraTool.dechexToInt(rec.paraID), rec.relayChain);
                let cmd = `update blocklog set loaded = 0, loadDT=NULL where chainID=${chainID} and logDT='${rec.logDT}'`
                console.log(cmd)
                this.batchedSQL.push(cmd);
            }
        }
        await this.update_batchedSQL()
    }

    async dump_substrateetl(logDT = "2022-12-29", paraID = 2000, relayChain = "polkadot") {
        let projectID = `${this.project}`
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let chain = await this.getChain(chainID);
        let id = this.getIDByChainID(chainID);
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs"] // TODO: put  "specversions" back, TODO: add calls?
        let processCalls = false
        if (processCalls) {
            tbls.push("calls")
        }
        console.log(`dump_substrateetl paraID=${paraID}, relayChain=${relayChain}, chainID=${chainID}, logDT=${logDT} (projectID=${projectID}), tbls=${tbls}`)
        if (chain.isEVM) {
            tbls.push("evmtxs");
            tbls.push("evmtransfers");
        }
        // 0. include chainParser + chainID
        await this.setUpSubstrateEtlChainparser(chainID)

        // 1. get bnStart, bnEnd for logDT
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(logDT)
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
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);

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
            let [rows] = await tableChain.getRows({
                start: start,
                end: end
            });
            let problem = (bn1 - bn0 + 1 != rows.length);
            for (const row of rows) {
                let r = this.build_block_from_row(row);
                let b = r.feed;
                let bn = parseInt(row.id.substr(2), 16);
                let [logDT0, hr] = paraTool.ts_to_logDT_hr(b.blockTS);
                //console.log("processing:", bn, b.blockTS, logDT0, hr);
                let hdr = b.header;
                if (r.fork || (!hdr || hdr.number == undefined) || (logDT != logDT0)) {
                    let rowId = paraTool.blockNumberToHex(bn);
                    if (r.fork) {
                        console.log("FORK!!!! DELETE ", bn, rowId);
                        await tableChain.row(rowId).delete();
                    }
                    if ((!hdr || hdr.number == undefined)) console.log("PROBLEM - missing hdr: ", `./polkaholic indexblock ${chainID} ${bn}`);
                    if (logDT != logDT0) {
                        console.log("ERROR: mismatch ", b.blockTS, logDT0, " does not match ", logDT, " delete ", rowId);
                        await tableChain.row(rowId).delete();
                        let sql = `update  block${chainID} set crawlBlock = 1 where blockNumber = '${bn}'`;
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL();
                    }
                    continue;
                } else {
                    found[bn] = true;
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
                let evmtxs = [];
                let evmtransfers = [];

                //MK: evmtxs and evmtransfers generated here. consider to skip
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
                let calls = [];
                for (const ext of b.extrinsics) {
                    for (const ev of ext.events) {
                        let [dEvent, isTransferType] = await this.decorateEvent(ev, chainID, block.block_time, true, ["data", "address", "usd"], false)
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
                            data_decoded: (dEvent && dEvent.decodedData != undefined) ? dEvent.decodedData : null,
                        }
                        events.push(bqEvent);
                        block.event_count++;
                    }
                    if (ext.transfers) {
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
                        weight: (ext.weight != undefined) ? ext.weight : null, // TODO: ext.weight,
                        signed: ext.signer ? true : false,
                        signer_ss58: ext.signer ? ext.signer : null,
                        signer_pub_key: ext.signer ? paraTool.getPubKey(ext.signer) : null
                    }
                    //console.log(`bqExtrinsic`, bqExtrinsic)
                    extrinsics.push(bqExtrinsic);
                    if (processCalls) {
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
                            if (this.suppress_call(id, call.section, call.method)) {
                                //console.log(`${bqExtrinsicCall.extrinsic_hash} ${bqExtrinsicCall.call_id} [${call.section}:${call.method}] SUPPRESSED`)
                            } else {
                                //let t = this.generate_call_rows(bqExtrinsicCall);
                                //console.log(`${bqExtrinsicCall.extrinsic_hash} ${bqExtrinsicCall.call_id} [${call.section}:${call.method}] ADDED`)
                                calls.push(bqExtrinsicCall)
                            }
                        }
                    }
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

                // write calls
                if (calls.length > 0 && processCalls) {
                    calls.forEach((c) => {
                        if (typeof c.call_section == "string" && typeof c.call_method == "string") {
                            fs.writeSync(f["calls"], JSON.stringify(c) + NL);
                        } else {
                            console.log(`++c`, c)
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
            if (problem) {
                for (let c = bn0; c <= bn1; c++) {
                    if (found[c] == undefined) {
                        let sql = `insert into block${chainID} (blockNumber, crawlBlock) values ('${c}', 1) on duplicate key update crawlBlock = values(crawlBlock)`;
                        console.log(sql);
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL();
                    }
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
                let isSuccess = this.execute_bqLoad(cmd)
                if (!isSuccess) {
                    numSubstrateETLLoadErrors++;
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

        if (numSubstrateETLLoadErrors == 0) {
            //first polkadot crowdloan: 2021-11-05
            //first kusama crowdloan: 2021-06-08
            let w = ''
            if (paraID == 0) {
                w = `and logDT >= '2021-06-08'`
            }
            // mark crowdloanMetricsStatus as redy or ignore, depending on the result
            let crowdloanMetricsStatus = (paraID == 0) ? 'Ready' : 'Ignore' // TODO: systematize
            let sql = `update blocklog set loaded = 1 where chainID = '${chainID}' and logDT = '${logDT}' ${w}`
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        } else {
            let sql = `update blocklog set loaded = 0 where chainID = '${chainID}' and logDT = '${logDT}'`
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        }
        // load account metrics
        try {
            await this.update_blocklog(chainID, logDT);
        } catch (e) {
            console.log(e)
        }
    }

    parse_trace(e, traceType, traceIdx, bn, api) {
        let o = {}
        o.trace_id = `${bn}-${traceIdx}`
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
        if (!sk) {
            o.section = 'unknown'
            o.storage = 'unknown'
            o.k = e.k
            o.v = e.v
            return o;
        }

        // add the palletName + storageName to the object, if found
        o.section = sk.palletName;
        o.storage = sk.storageName;
        if (!o.section || !o.storage) {
            console.log(`k=${k} not found (${key},${val})`)
            decodeFailed = true
            o.section = 'unknown'
            o.storage = 'unknown'
            o.k = e.k
            o.v = e.v
            return o;
        }

        let parsev = false;
        let p = paraTool.firstCharLowerCase(o.section);
        let s = paraTool.firstCharLowerCase(o.storage);
        let kk = ''
        let vv = ''
        let pk = ''
        let pv = ''
        let debugCode = 0
        let palletSection = `${o.p}:${o.s}`

        try {
            if (!query[p]) decodeFailed = true;
            if (!query[p][s]) decodeFailed = true;
            if (!query[p][s].meta) decodeFailed = true;
        } catch (e) {
            decodeFailed = true
        }

        if (decodeFailed) {
            o.section = p
            o.storage = s
            o.k = e.k
            o.v = e.v
            return o;
        }
        let queryMeta = query[p][s].meta;

        // parse key
        try {
            kk = key;
            var skey = new StorageKey(api.registry, '0x' + key);
            skey.setMeta(api.query[p][s].meta);
            var parsek = skey.toHuman();
            var decoratedKey = JSON.stringify(parsek)
            pk = decoratedKey
        } catch (err) {
            pk = "err"
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
            console.log(`[${o.traceID}] SOURCE: pv`, traceType, k, val, err);
        }
        let paddedK = (kk.substr(0, 2) == '0x') ? kk : '0x' + kk
        let paddedV = (vv.substr(0, 2) == '0x') ? vv : '0x' + vv
        if (JSON.stringify(paddedK) == pk) pk = ''
        if (kk != '') o.k = paddedK
        if (vv != '') o.v = paddedV
        if (pk != '') o.pk_extra = pk
        if (pv != '') o.pv = pv

        return o;
    }

    async validate_trace(tableChain, bn0, bn1) {

        let start = paraTool.blockNumberToHex(bn0);
        let end = paraTool.blockNumberToHex(bn1);

        console.log("FETCHING", bn0, bn1, start, end, `len=${end-start+1}`);
        let [rows] = await tableChain.getRows({
            start: start,
            end: end
        });

        let expectedBNs = {}
        let missingBNs = [];
        for (let i = bn0; i <= bn1; i++) {
            expectedBNs[`${i}`] = 0;
        }
        let observedRows = []
        let observedTracesBN = []
        for (const row of rows) {
            let bn = parseInt(row.id.substr(2), 16);
            let r = this.build_block_from_row(row);
            observedRows[bn] = r
            if (r.trace != false) {
                expectedBNs[bn] = 1
                observedTracesBN[bn] = 1
            }
        }
        for (let i = bn0; i <= bn1; i++) {
            if (expectedBNs[i] == 0) {
                //console.log(`BN=${i} missing!`)
                missingBNs.push(i)
            }
        }

        return {
            missingBNs: missingBNs,
            verifiedRows: rows
        }
    }

    async batch_crawl_trace(crawler, chain, missingBNs) {
        let i = 0;
        let n = 0;
        let batchSize = 10;
        while (i < missingBNs.length) {
            // Create an array to hold promises for current batch
            let crawlPromises = [];
            let currBatch = missingBNs.slice(i, i + batchSize);
            if (currBatch.length > 0) {
                console.log(`currBatch#${n} len=${currBatch.length}`, currBatch)
                for (const targetBN of currBatch) {
                    let t2 = {
                        chainID: chain.chainID,
                        blockNumber: targetBN
                    };
                    crawlPromises.push(crawler.crawl_block_trace(chain, t2))
                }
                //concurrent crawl
                let crawlStates;
                try {
                    crawlStates = await Promise.allSettled(crawlPromises);
                    //{ status: 'fulfilled', value: ... },
                    //{ status: 'rejected', reason: Error: '.....'}
                } catch (e) {
                    console.log("crawlStates ERR", e);
                }
                for (let j = 0; j < crawlStates.length; j++) {
                    let crawlState = crawlStates[j]
                    if (crawlState['status'] == 'fulfilled') {
                        //
                    } else {
                        let errReason = crawlState['reason']
                        console.log(`NOT OK`, errReason)
                    }
                }
                i += batchSize;
                n++;
            }
        }
    }

    async fetchMissingTraces(isDecending, isHead, tableChain, chain, chainID, bnStart, bnEnd) {
      let NL = "\r\n";
      let jmp = 100;
      let numTraces = 0;
      let maxQueueSize = (isHead || isDecending)? 1: 50;
      let missingBNAll = [];
      let isMissing = false;
      let jmpIdx = 0;
      let jmpTotal = Math.ceil((bnEnd - bnStart) / jmp);

      // Setup Crawler
      const Crawler = require("./crawler");
      let crawler = new Crawler();
      await crawler.setupAPI(chain);
      await crawler.assetManagerInit();
      await crawler.setupChainAndAPI(chainID);

      // Loop logic that varies based on isDecending flag
      let start = isDecending ? bnEnd : bnStart;
      let end = isDecending ? bnStart : bnEnd;
      let step = isDecending ? -jmp : jmp;

      for (let bn0 = start; (isDecending ? bn0 >= end : bn0 <= end); bn0 += step) {
        jmpIdx++;
        console.log(`${jmpIdx}/${jmpTotal}`);
        let bn1 = bn0 + (isDecending ? -jmp + 1 : jmp - 1);
        if (isDecending ? bn1 < end : bn1 > end) bn1 = end;

        let res = await this.validate_trace(tableChain, Math.min(bn0, bn1), Math.max(bn0, bn1));
        let missingBNs = res.missingBNs;

        if (missingBNs.length > 0) {
          missingBNAll.push(...missingBNs);
          isMissing = true
          console.log(`[Overall:${missingBNAll.length}] missingBNs:${missingBNs.length}`, missingBNs);
          if (missingBNAll.length >= maxQueueSize) {
            await this.batch_crawl_trace(crawler, chain, missingBNAll);
            missingBNAll = [];
          }
        }
      }
      console.log(`missingBNAll:${missingBNAll.length}`, missingBNAll);
      await this.batch_crawl_trace(crawler, chain, missingBNAll);
      return isMissing
    }

    async backfill_trace_range(paraID = 2000, relayChain = "polkadot", isDecending = false, isHead = false, targetBNStart = false, targetBNEnd = false) {
        let verbose = true
        let supressedFound = {}
        let projectID = `${this.project}`
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`chainID=${chainID} NOT supported`)
            return
        }
        let chain = await this.getChain(chainID);
        const tableChain = this.getTableChain(chainID);

        await this.get_skipStorageKeys();
        console.log(`backfill_trace paraID=${paraID}, relayChain=${relayChain}, chainID=${chainID}, (projectID=${projectID})`)
        let sql1 = `select min(blockNumber) bnStart, max(blockNumber) bnEnd, DATE_FORMAT(blockDT, '%Y-%m-%d') as blkDT from block${chainID} where blockNumber >= '${targetBNStart}' and blockNumber <= '${targetBNEnd}' group by blkDT order by blkDT`
        console.log(sql1);
        let bnRanges = await this.poolREADONLY.query(sql1)
        let {
            blkDT
        } = bnRanges[0];
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(blkDT)
        let logDT = currDT // this will support both logYYYYMMDD and logYYYY-MM-DD format
        let bnStart = targetBNStart
        let bnEnd = targetBNEnd
        console.log(`${logDT} bnStart=${bnStart}, bnEnd=${bnEnd}, blkDT=${blkDT}, len=${bnEnd-bnStart+1}`)
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
            this.specVersion = specVersion.specVersion;
        }

        await this.setupAPI(chain)
        let api = this.api;
        let [finalizedBlockHash, blockTS, _bn] = logDT && chain.WSEndpointArchive ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api, logDT)
        await this.getSpecVersionMetadata(chain, this.specVersion, finalizedBlockHash, bnEnd);

        await this.fetchMissingTraces(isDecending, isHead, tableChain, chain, chainID, bnStart, bnEnd)

    }

    async backfill_trace(logDT = "2022-12-29", paraID = 2000, relayChain = "polkadot", isDecending = false, isHead = false) {

        let verbose = true
        let supressedFound = {}
        let projectID = `${this.project}`
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`chainID=${chainID} NOT supported`)
            return
        }
        let chain = await this.getChain(chainID);
        const tableChain = this.getTableChain(chainID);

        await this.get_skipStorageKeys();
        console.log(`backfill_trace paraID=${paraID}, relayChain=${relayChain}, chainID=${chainID}, logDT=${logDT} (projectID=${projectID})`)
        // 1. get bnStart, bnEnd for logDT
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(logDT)
        logDT = currDT // this will support both logYYYYMMDD and logYYYY-MM-DD format
        let [latestDT, _c] = paraTool.ts_to_logDT_hr(paraTool.getCurrentTS())
        let isCompleteDay = (currDT != latestDT)
        console.log(`currDT=${currDT}. latestDT=${latestDT}, isCompleteDay=${isCompleteDay}`)

        let minLogDT = `${logDT} 00:00:00`;
        let maxLogDT = `${logDT} 23:59:59`;
        let sql1 = `select min(blockNumber) bnStart, max(blockNumber) bnEnd,  DATE_FORMAT(blockDT, '%Y-%m-%d') as blkDT from block${chainID} where blockDT >= '${minLogDT}' and blockDT <= '${maxLogDT}' group by blkDT order by blkDT`
        console.log(sql1);
        let bnRanges = await this.poolREADONLY.query(sql1)
        let {
            bnStart,
            bnEnd,
            blkDT
        } = bnRanges[0];
        console.log(`${logDT} bnStart=${bnStart}, bnEnd=${bnEnd}, blkDT=${blkDT}, len=${bnEnd-bnStart+1}`)
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
            this.specVersion = specVersion.specVersion;
        }

        await this.setupAPI(chain)
        let api = this.api;
        let [finalizedBlockHash, blockTS, _bn] = logDT && chain.WSEndpointArchive ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api, logDT)
        await this.getSpecVersionMetadata(chain, this.specVersion, finalizedBlockHash, bnEnd);

        let isMissing = await this.fetchMissingTraces(isDecending, isHead, tableChain, chain, chainID, bnStart, bnEnd)
        if (!isMissing && isCompleteDay ){
            // mark crawlTraceStatus as audited
            let sql = `insert into blocklog (logDT, chainID, crawlTraceStatus, crawlTraceDT) values ('${logDT}', '${chainID}', 'Audited', Now() ) on duplicate key update crawlTraceStatus = values(crawlTraceStatus), crawlTraceDT = values(crawlTraceDT)`
            let sql2 = `update blocklog set traceMetricsStatus = 'Ready' where logDT = '${logDT}' and chainID = '${chainID}' and traceMetricsStatus not in ('AuditRequired', 'Audited')`
            console.log(sql);
            console.log(sql2);
            let dryRun = false
            if (!dryRun) {
                this.batchedSQL.push(sql);
                this.batchedSQL.push(sql2);
                await this.update_batchedSQL();
            }
        }
    }

    async loadFullStakingFromGS(paraID = 2000, relayChain = "polkadot", dryRun = true) {
        let projectID = `${this.project}`
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let schemaPath = `/root/go/src/github.com/colorfulnotion/polkaholic/substrate/schema/substrateetl/stakings.json`;
        let cmd = `bq load  --project_id=substrate-etl --max_bad_records=10 --time_partitioning_field ts --source_format=NEWLINE_DELIMITED_JSON --replace=true 'crypto_polkadot.stakings${paraID}' gs://crypto_substrate_stakings/${relayChain}/* ${schemaPath}`
        console.log(cmd);
        if (!dryRun) {
            let {
                stdout,
                stderr
            } = await exec(cmd);
            console.log(stdout, stderr);
        }
    }

    async loadDailyStakingFromGS(logDT, paraID = 2000, relayChain = "polkadot", dryRun = true) {
        let projectID = `${this.project}`
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(logDT)

        let dir = "/tmp";
        let tbl = "stakings";
        //let localfn = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
        let bucket = "crypto_substrate_stakings"
        let remotefn = `gs://${bucket}/${relayChain}/${paraID}/${logYYYY_MM_DD}/${relayChain}_stakings${paraID}_${logYYYYMMDD}.json`
        //bq load  --project_id=substrate-etl --max_bad_records=10 --time_partitioning_field ts --source_format=NEWLINE_DELIMITED_JSON --replace=true 'crypto_polkadot.traces0$20231001' gs://crypto_substrate_traces_etl/polkadot/0/2023/10/01/polkadot_trace0_20231001.json schema/substrateetl/traces.json

        let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --time_partitioning_field ts --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}$${logYYYYMMDD}' ${remotefn} schema/substrateetl/${tbl}.json`;
        console.log(cmd);
        if (!dryRun) {
            let {
                stdout,
                stderr
            } = await exec(cmd);
            console.log(stdout, stderr);
        }
    }

    async loadDailyTraceFromGS(logDT, paraID = 2000, relayChain = "polkadot", dryRun = true) {
        let projectID = `${this.project}`
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(logDT)

        let dir = "/tmp";
        let tbl = "traces";
        //let localfn = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
        let bucket = "crypto_substrate_traces_etl"
        let remotefn = `gs://${bucket}/${relayChain}/${paraID}/${logYYYY_MM_DD}/${relayChain}_trace${paraID}_${logYYYYMMDD}.json`
        //bq load  --project_id=substrate-etl --max_bad_records=10 --time_partitioning_field ts --source_format=NEWLINE_DELIMITED_JSON --replace=true 'crypto_polkadot.traces0$20231001' gs://crypto_substrate_traces_etl/polkadot/0/2023/10/01/polkadot_trace0_20231001.json schema/substrateetl/traces.json

        let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --time_partitioning_field ts --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}$${logYYYYMMDD}' ${remotefn} schema/substrateetl/${tbl}.json`;
        console.log(cmd);
        if (!dryRun) {
            let {
                stdout,
                stderr
            } = await exec(cmd);
            console.log(stdout, stderr);
        }
    }

    async cpDailyStakingToGS(logDT, paraID = 2000, relayChain = "polkadot", dryRun = true) {
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(logDT)

        let dir = "/tmp";
        let tbl = "stakings";
        let localfn = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
        let bucket = "crypto_substrate_stakings"
        let remoteDir = `gs://${bucket}/${relayChain}/${paraID}/${logYYYY_MM_DD}/${relayChain}_stakings${paraID}_${logYYYYMMDD}.json`
        let gsReplaceLoadCmd = `gsutil -m cp -r ${localfn} ${remoteDir}`
        console.log(gsReplaceLoadCmd)
        let errCnt = 0
        if (!dryRun) {
            try {
                let res = await exec(gsReplaceLoadCmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`cpDailyStakingToGS res`, gsReplaceLoadCmd)
            } catch (e) {
                console.log(`cpDailyStakingToGS ERROR ${e.toString()}`)
                errCnt++
            }
        }
        return true
    }

    async cpDailyTraceToGS(logDT, paraID = 2000, relayChain = "polkadot", dryRun = true) {
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(logDT)

        let dir = "/tmp";
        let tbl = "traces";
        let localfn = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
        let bucket = "crypto_substrate_traces_etl"
        let remoteDir = `gs://${bucket}/${relayChain}/${paraID}/${logYYYY_MM_DD}/${relayChain}_trace${paraID}_${logYYYYMMDD}.json`
        let gsReplaceLoadCmd = `gsutil -m cp -r ${localfn} ${remoteDir}`
        console.log(gsReplaceLoadCmd)
        let errCnt = 0
        if (!dryRun) {
            try {
                let res = await exec(gsReplaceLoadCmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`cpHourlyETLToGS res`, gsReplaceLoadCmd)
            } catch (e) {
                console.log(`cpHourlyETLToGS ERROR ${e.toString()}`)
                errCnt++
            }
        }
        return true
    }

    async dump_trace_debug(paraID = 2000, relayChain = "polkadot", targetBNStart = false, targetBNEnd = false) {

        let crawler;
        let verbose = true
        let supressedFound = {}
        let projectID = `${this.project}`
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`chainID=${chainID} NOT supported`)
            return
        }
        let chain = await this.getChain(chainID);
        const tableChain = this.getTableChain(chainID);

        await this.get_skipStorageKeys();
        console.log(`backfill_trace paraID=${paraID}, relayChain=${relayChain}, chainID=${chainID}, (projectID=${projectID})`)
        let sql1 = `select min(blockNumber) bnStart, max(blockNumber) bnEnd, DATE_FORMAT(blockDT, '%Y-%m-%d') as blkDT from block${chainID} where blockNumber >= '${targetBNStart}' and blockNumber <= '${targetBNEnd}' group by blkDT order by blkDT`
        console.log(sql1);
        let bnRanges = await this.poolREADONLY.query(sql1)
        let {
            blkDT
        } = bnRanges[0];
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(blkDT)
        let logDT = currDT // this will support both logYYYYMMDD and logYYYY-MM-DD format
        let bnStart = targetBNStart
        let bnEnd = targetBNEnd
        console.log(`${logDT} bnStart=${bnStart}, bnEnd=${bnEnd}, blkDT=${blkDT}, len=${bnEnd-bnStart+1}`)

        let chainInfo = await this.getChainFullInfo(chainID)
        let chainDecimals = chainInfo.decimals
        let asset = this.getChainAsset(chainID);
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        console.log(`chainDecimals`, chainDecimals, `assetChain`, assetChain)

        let chain_identification = this.getIDByChainID(chainID)
        let chain_name = this.getChainName(chainID)

        // 2. setup directories for tbls on date
        /*
        let dir = "/tmp";
        let tbl = "traces";
        let logDTp = logDT.replaceAll("-", "")
        let fn = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
        console.log(`writting to ${fn}`)
        let f = fs.openSync(fn, 'w', 0o666);
        */
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);

        // 3. setup specversions
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
            this.specVersion = specVersion.specVersion;
        }

        await this.setupAPI(chain)
        let api = this.api;
        let [finalizedBlockHash, blockTS, _bn] = logDT && chain.WSEndpointArchive ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api, logDT)
        await this.getSpecVersionMetadata(chain, this.specVersion, finalizedBlockHash, bnEnd);
        // 4. do table scan 50 blocks at a time
        let NL = "\r\n";
        let jmp = 50;
        let numTraces = 0;

        //TEST:
        //bnStart = 17663809
        //bnEnd = 17663810
        let jmpIdx = 0
        let jmpTotal = Math.ceil((bnEnd - bnStart) / jmp);
        for (let bn0 = bnStart; bn0 <= bnEnd; bn0 += jmp) {
            jmpIdx++
            console.log(`${jmpIdx}/${jmpTotal}`)
            let bn1 = bn0 + jmp - 1;
            if (bn1 > bnEnd) bn1 = bnEnd;

            let res = await this.validate_trace(tableChain, bn0, bn1)
            let rows = []
            let missingBNs = res.missingBNs
            let verifiedRows = res.verifiedRows
            if (missingBNs.length > 0 && isBackFill) {
                console.log(`missingBNs`, missingBNs)
                if (crawler == undefined){
                    const Crawler = require("./crawler");
                    crawler = new Crawler();
                    await crawler.setupAPI(chain);
                    await crawler.assetManagerInit();
                    await crawler.setupChainAndAPI(chainID);
                }
                for (const targetBN of missingBNs) {
                    let t2 = {
                        chainID,
                        blockNumber: targetBN
                    };
                    let x = await crawler.crawl_block_trace(chain, t2);
                }

                let newRes = await this.validate_trace(tableChain, bn0, bn1)
                missingBNs = newRes.missingBNs
                verifiedRows = newRes.verifiedRows
                if (missingBNs.length > 0) {
                    console.log(`Fetch failed missingBN=${missingBNs}`)
                    //process.exit(1, `validate_trace error`)
                }
            }

            //continue
            //TODO: fetch from gs?
            //console.log(`${bn0}, ${bn1} verifiedRows`, verifiedRows)
            for (const row of verifiedRows) {
                let bn = parseInt(row.id.substr(2), 16);
                let r = this.build_block_from_row(row);
                let b = (r.feed)? r.feed: r.block ;
                //console.log(`r`, JSON.stringify(r))
                //console.log(`block`, b)
                let hdr = b.header;
                let blockTS = b.blockTS
                let block_hash = b.hash
                if (!this.validateDT(blockTS, logDT)) {
                    //continue
                    let t2 = {
                        chainID,
                        blockNumber: bn
                    };
                    if (crawler == undefined){
                        const Crawler = require("./crawler");
                        crawler = new Crawler();
                        await crawler.setupAPI(chain);
                        await crawler.assetManagerInit();
                        await crawler.setupChainAndAPI(chainID);
                    }
                    let x = await crawler.crawl_block_trace(chain, t2);
                    continue
                }
                let [logDT0, hr] = paraTool.ts_to_logDT_hr(blockTS);
                let traces = r.trace;
                let extrinsicIndex = null;
                if (traces.length > 0) {
                    numTraces += traces.length;
                    //WANT:
                    /*
                    let t = {
                        relay_chain: relayChain,
                        para_id: paraID,
                        id: id,
                        chain_name: chainName,
                        block_number: blockNumber,
                        block_hash: blockHash,
                        ts: blockTS,
                        trace_id: traceID,
                        k: a2.k,
                        v: a2.v,
                        section: a2.p,
                        storage: a2.s,
                        pk_extra:
                        pv:
                    };
                    */
                    for (let traceIdx = 0; traceIdx < traces.length; traceIdx++) {
                        let t = traces[traceIdx];
                        let o = this.parse_trace(t, r.traceType, traceIdx, bn, api);
                        if (o.section == "Substrate" && o.storage == "ExtrinsicIndex") {
                            if (extrinsicIndex == null) {
                                extrinsicIndex = 0
                            } else if (o.pv == "0") {
                                extrinsicIndex = null
                            } else {
                                extrinsicIndex++
                            }
                        }
                        try {
                            let pk_extra = JSON.parse(o.pk_extra)
                            let pv = JSON.parse(o.pv)
                            o.pk_extra = pk_extra
                            o.pv = pv
                        } catch (e){

                        }
                        if ((o.section == "Staking" && o.storage == "ErasStakers" && o.pk_extra )) {
                            o.pk_extra[0] = paraTool.toNumWithoutComma(o.pk_extra[0])
                            o.address_ss58 = o.pk_extra[1]
                            o.address_pubkey = paraTool.getPubKey(o.address_ss58);
                            console.log(`${o.section}:${o.storage}, o`, o)
                            let pv = o.pv
                            pv.total =  paraTool.dechexToIntStr(pv.total) / 10 ** chainDecimals;
                            pv.own =  paraTool.dechexToIntStr(pv.own) / 10 ** chainDecimals;
                            let others = []
                            for (const other of pv.others){
                                other.value = other.value / 10 ** chainDecimals;
                                if (other.value > 0){
                                    others.push(other)
                                }else{
                                    console.log(`SKIP others`, other)
                                }
                            }
                            pv.others = others
                            pv.nominatorLen = others.length
                            o.pv = pv
                            console.log(`Staking:ErasStakers`, JSON.stringify(o.pv))
                            /*
                            {
                                total: '0x0000000000000000004f5173e8bb050a',
                                own: 0,
                                others: [
                                  [Object], [Object], [Object], [Object]
                                ]
                              }
                              */
                        }
                        if ((o.section == "Staking" && o.storage == "Nominators" && o.pk_extra ) || (o.section == "System" && o.storage == "Account" && o.pk_extra)) {
                            console.log(`${o.section}:${o.storage}, o`, o)
                            o.address_ss58 = o.pk_extra[0]
                            o.address_pubkey = paraTool.getPubKey(o.address_ss58);
                        }
                        if (o.section == "System" && o.storage == "Account" && o.pk_extra) {
                            try {
                                //o.pk_extra = JSON.parse(o.pk_extra)
                                //console.log(`System:Account o`, o)
                                //o.address_ss58 = o.pk_extra[0]
                                //o.address_pubkey = paraTool.getPubKey(o.address_ss58);
                                //17624544-650: '{"nonce":1,"consumers":3,"providers":1,"sufficients":0,"data":{"free":51430786398441,"reserved":200410000000,"frozen":19477059680539,"flags":"0x800000000000000000005443b495716c"}}
                                let accountStruct = o.pv
                                let a2 = accountStruct.data
                                let flds = []
                                if (a2.free != undefined) {
                                    flds.push(["free", "free"])
                                }
                                if (a2.reserved != undefined) {
                                    flds.push(["reserved", "reserved"])
                                }
                                if (a2.frozen != undefined) {
                                    flds.push(["frozen", "frozen"])
                                }
                                if (a2.flags != undefined) {
                                    o["flags"] = paraTool.dechexToIntStr(a2.flags)
                                }
                                if (a2.miscFrozen != undefined) {
                                    flds.push(["miscFrozen", "misc_frozen"])
                                }
                                if (a2.feeFrozen != undefined) {
                                    flds.push(["feeFrozen", "fee_frozen"])
                                }
                                let p = await this.computePriceUSD({
                                    assetChain: assetChain,
                                    ts: blockTS
                                })
                                let priceUSD = p && p.priceUSD ? p.priceUSD : 0;
                                if (priceUSD > 0) {
                                    o.price_usd = priceUSD
                                }
                                for (const fmap of flds) {
                                    let f = fmap[0] // e.g. totalIssuance
                                    let f2 = fmap[1] // e.g. total_issuance
                                    o[f2] = a2[f] / 10 ** chainDecimals;
                                    o[`${f2}_raw`] = paraTool.dechexToIntStr(a2[f]);
                                    if (priceUSD) {
                                        o[`${f2}_usd`] = o[f2] * priceUSD;
                                    }
                                }
                                if (o[`misc_frozen`] != undefined && o[`fee_frozen`] != undefined){
                                    o[`frozen`] = Math.max(o[`misc_frozen`], o[`fee_frozen`])
                                    o[`frozen_raw`] = Math.max(o[`misc_frozen_raw`], o[`fee_frozen_raw`])
                                    o[`frozen_usd`] = Math.max(o[`misc_frozen_usd`], o[`fee_frozen_usd`])
                                }

                            } catch (e) {
                                console.log(`error~`, e)
                            }
                        }

                        o.block_number = bn;
                        o.ts = blockTS;
                        o.block_hash = block_hash;

                        o.relay_chain = relayChain
                        o.para_id = paraID
                        o.id = chain_identification
                        o.chain_name = chain_name
                        o.extrinsic_id = `${bn}-${extrinsicIndex}`;
                        if (o.extrinsic_id.includes("null")) o.extrinsic_id = null
                        if (this.suppress_trace(o.trace_id, o.section, o.storage)) {
                            if (supressedFound[`${o.section}:${o.storage}`] == undefined) {
                                supressedFound[`${o.section}:${o.storage}`] = 1
                                //console.log(`supressed ${o.section}:${o.storage}`);
                            }
                        } else if (this.supress_skipped_trace(o.trace_id, o.section, o.storage)) {
                            if (supressedFound[`${o.section}:${o.storage}`] == undefined) {
                                supressedFound[`${o.section}:${o.storage}`] = 1
                                //console.log(`supressed skipped trace ${o.section}:${o.storage}`);
                            }
                        } else if (o.section == "unknown" || o.storage == "unknown") {
                            // Skip unknown
                        } else {
                            //if (verbose) console.log(`trace ${o.trace_id} ${o.section}:${o.storage}`);
                            if (verbose) console.log(`trace`, JSON.stringify(o));
                        }
                    }
                }
            }
        }
    }

    async dump_staking(logDT = "2022-12-29", paraID = 2000, relayChain = "polkadot") {
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(logDT)
        let verbose = true
        let isBackFill = false
        let supressedFound = {}
        let projectID = `${this.project}`
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`chainID=${chainID} NOT supported`)
            return
        }
        //await this.cpDailyStakingToGS(logDT, paraID, relayChain, false)
        //await this.loadDailyStakingFromGS(logDT, paraID, relayChain, false)
        let chain = await this.getChain(chainID);
        let chainInfo = await this.getChainFullInfo(chainID)
        let chainDecimals = chainInfo.decimals
        let asset = this.getChainAsset(chainID);
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        console.log(`chainDecimals`, chainDecimals, `assetChain`, assetChain)
        let chain_identification = this.getIDByChainID(chainID)
        let chain_name = this.getChainName(chainID)
        let eraBlocks = await this.getEraBlocks()
        let targetEras = eraBlocks[currDT]
        if (targetEras == undefined){
            console.log(`NO WORK: ${currDT}`)
            return
        }

        // 2. setup directories for tbls on date
        let NL = "\r\n";
        let dir = "/tmp";
        let tbl = "stakings";
        let logDTp = logDT.replaceAll("-", "")
        let fn = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
        console.log(`writting to ${fn}`)
        let f = fs.openSync(fn, 'w', 0o666);

        let wsEndpoint = this.get_wsendpoint(chain);
        if (chainID == paraTool.chainIDPolkadot){
            //wsEndpoint = "wss://rpc.polkadot.io"
        }
        let chainName = chain.chainName;
        let id = chain.id;

        var provider = new WsProvider(wsEndpoint);
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

        /*
        {
          era: 1240,
          block_number: 17861531,
          blockDT: '2023-10-24',
          blockTS: 1698147378,
          blockhash: '0x57d960d04c277916b5554a39995d69fb7fb633fc3f68cd5bc0cf2f3aea98aecd',
          era1Hash: '0x093598783ad0cb471e43472d46addee7d22212c2608d882934680c330b75fb22',
          era2Hash: '0xf677980b19abdbf2880c16bafe2d8545c14a55e1252076c87b3fa75defe66f80'
        }
        erasTotalStakes - no delay
        erasRewardPoints - has 2 era Delay
        erasValidatorReward - has 2 era Delay (5 session)
        */

        let perPagelimit = 1000

        let stakingStats = {}
        for (const era of targetEras){
            console.log(`era`, era)
            let validatorPrefMap = {}
            let validatorRewardMap = {}
            let era0Hash = era.blockhash
            let era1Hash = (era.era1Hash)? era.era1Hash : null
            let era2Hash = (era.era2Hash)? era.era2Hash : null
            if (era2Hash == undefined){
                let signedBlock = await api.rpc.chain.getBlock();
                let latestBlochHash = signedBlock.block.header.hash.toHex()
                era2Hash = latestBlochHash
                console.log(`using latest blockHash=${latestBlochHash} as era2Hash`)
            }

            let totalStaked = null
            let totalRewardPoints = null
            let totalStakingRewards = null
            let numPointsEarners = null;
            let numPools = null;
            let numPoolMembers = null;

            let eraBN = era.block_number
            let eraNumber = era.era
            let blockTS = era.blockTS
            let apiAt = await api.at(era0Hash)

            var erasTotalStakes = await apiAt.query.staking.erasTotalStake(eraNumber);
            totalStaked = paraTool.dechexToInt(erasTotalStakes.toString()) / 10 ** chainDecimals;

            let fetchNominationPool = (apiAt.query.nominationPools!= undefined)? true : false

            if (era2Hash){
                let api2At = await api.at(era2Hash)

                let validatorRewardQuery = await api2At.query.staking.erasValidatorReward(eraNumber); // 4 hours delay
                totalStakingRewards = paraTool.dechexToInt(validatorRewardQuery.toString()) / 10 ** chainDecimals;

                let erasRewardPointsQuery = await api2At.query.staking.erasRewardPoints(eraNumber);
                let rewardStruct = JSON.parse(JSON.stringify(erasRewardPointsQuery))
                totalRewardPoints = rewardStruct.total
                let weights = []
                let weightTotal = 0
                let rewardIndividuals = Object.keys(rewardStruct.individual)
                numPointsEarners = rewardIndividuals.length
                for (const validator of rewardIndividuals){
                    let point = rewardStruct.individual[validator]
                    let weight = point / totalRewardPoints
                    weightTotal += weight
                    let vRec = {
                        validator: validator,
                        point: point,
                        weight: weight,
                    }
                    weights.push(vRec)
                    validatorRewardMap[validator] = vRec
                }
                console.log(`weightTotal:`, weightTotal)
                let rec = {
                    section: "Staking",
                    storage: "ErasRewardPoints",
                    block_number: eraBN,
                    block_hash: era0Hash,
                    ts: blockTS,
                    era: eraNumber,
                    total_staked: totalStaked,
                    total_reward_points: totalRewardPoints,
                    total_staking_rewards: totalStakingRewards,
                    pv: weights
                }
                //console.log(rec)
                /*
                {
                  total: 22781120,
                  individual: {
                    '111B8CxcmnWbuDLyGvgUmRezDCK1brRZmvUuQ6SrFdMyc3S': 77500,
                    '114SUbKCXjmb9czpWTtS3JANSmNRwVa4mmsMrWYpRG1kDH5': 75700,
                    '11BgR7fH8Sq6CcGcXxZrhyrBM2PUpDmhnGZpxPGvVGXEiPT': 77900,
                    ...
                }
                */
            }
            var validator_pref = await apiAt.query.staking.erasValidatorPrefs.entries(eraNumber);

            stakingStats[eraNumber] = {
                block_number: eraBN,
                era: eraNumber,
                totalStaked: totalStaked,
                totalRewardPoints: totalRewardPoints,
                totalStakingRewards: totalStakingRewards,
                numPointsEarners: numPointsEarners,
            }

            console.log(`stakingStats`, stakingStats);

            if (fetchNominationPool){
                var bondedPools = await apiAt.query.nominationPools.bondedPools.entries();
                var rewardPools = await apiAt.query.nominationPools.rewardPools.entries(); //
                var reversePoolIdLookup = await apiAt.query.nominationPools.reversePoolIdLookup.entries();
                var stashMap = {}
                for (const pool of reversePoolIdLookup) {
                    let pub = pool[0].slice(-32);
                    let prefix = 0
                    let stash_pubkey = u8aToHex(pub);
                    let stash_ss58 = encodeAddress(pub, prefix);
                    var poolID = JSON.parse(JSON.stringify(pool[1]))
                    stashMap[poolID] = {
                        stash_pubkey: stash_pubkey,
                        stash_ss58: stash_ss58
                    }
                }
                /*
                {
                  lastRecordedRewardCounter: '0x000000000000000000a42e939e39e311',
                  lastRecordedTotalPayouts: 6069635685624,
                  totalRewardsClaimed: 5775202029695,
                  totalCommissionPending: 2744851094,
                  totalCommissionClaimed: 88299684189
                }
                */
                var rewardPoolsMap = {}
                stakingStats[eraNumber].numPools = Object.keys(rewardPools).length
                for (const pool of rewardPools) {
                    let poolIDHex = "0x" + paraTool.reverseEndian(u8aToHex(pool[0].slice(-4)).substr(2))
                    let poolID = paraTool.dechexToInt(poolIDHex)
                    var poolInfo = JSON.parse(JSON.stringify(pool[1]))
                    var rewardPoolInfo = JSON.parse(JSON.stringify(pool[1]))
                    rewardPoolInfo.lastRecordedRewardCounter = paraTool.dechexToInt(rewardPoolInfo.lastRecordedRewardCounter);
                    rewardPoolInfo.lastRecordedTotalPayouts = paraTool.dechexToInt(rewardPoolInfo.lastRecordedTotalPayouts) / 10 ** chainDecimals;
                    rewardPoolInfo.totalRewardsClaimed = paraTool.dechexToInt(rewardPoolInfo.totalRewardsClaimed) / 10 ** chainDecimals;
                    rewardPoolInfo.totalCommissionPending = paraTool.dechexToInt(rewardPoolInfo.totalCommissionPending) / 10 ** chainDecimals;
                    rewardPoolInfo.totalCommissionClaimed = paraTool.dechexToInt(rewardPoolInfo.totalCommissionClaimed) / 10 ** chainDecimals;
                    rewardPoolsMap[poolID] = rewardPoolInfo
                    //console.log(`poolID=${poolID}`, rewardPoolInfo)
                }
                /*
                {
                  commission: {
                    current: [ 10000000, '12nN4oChrJ317HGEo5oPTcKMyDfgK71jZmsniLQ33XnciRDS' ],
                    max: 50000000,
                    changeRate: { maxIncrease: 5000000, minDelay: 100800 },
                    throttleFrom: 17841879
                  },
                  memberCounter: 2,
                  points: 609.2629903018,
                  roles: {
                    depositor: '12nN4oChrJ317HGEo5oPTcKMyDfgK71jZmsniLQ33XnciRDS',
                    root: '12nN4oChrJ317HGEo5oPTcKMyDfgK71jZmsniLQ33XnciRDS',
                    nominator: '12nN4oChrJ317HGEo5oPTcKMyDfgK71jZmsniLQ33XnciRDS',
                    bouncer: '12nN4oChrJ317HGEo5oPTcKMyDfgK71jZmsniLQ33XnciRDS'
                  },
                  state: 'Open'
                }
                */
                for (const pool of bondedPools) {
                    let stash_ss58 = null;
                    let stash_pubkey = null;
                    let nominationpools_rewardpools = null;
                    let currentCommission = 0;
                    let poolIDHex = "0x" + paraTool.reverseEndian(u8aToHex(pool[0].slice(-4)).substr(2))
                    let poolID = paraTool.dechexToInt(poolIDHex)
                    var poolInfo = JSON.parse(JSON.stringify(pool[1]))
                    let poolTotal = 0;
                    if (poolInfo.points != undefined){
                        poolTotal = paraTool.dechexToInt(poolInfo.points) / 10 ** chainDecimals;
                        poolInfo.points = poolTotal
                    }
                    if (poolInfo.commission != undefined){
                        if (poolInfo.commission.current != undefined) {
                            poolInfo.commission.current[0] = poolInfo.commission.current[0] / 10**9
                            currentCommission = poolInfo.commission.current[0]
                        }
                        if (poolInfo.commission.max != undefined) poolInfo.commission.max = poolInfo.commission.max / 10**9
                        if (poolInfo.commission.changeRate != undefined && poolInfo.commission.changeRate.maxIncrease != undefined) poolInfo.commission.changeRate.maxIncrease = poolInfo.commission.changeRate.maxIncrease / 10**9
                    }
                    if (stashMap[poolID] != undefined){
                        stash_ss58 = stashMap[poolID].stash_ss58
                        stash_pubkey = stashMap[poolID].stash_pubkey
                        //poolInfo.stash = stashMap[poolID].stash_ss58
                    }
                    stashMap[poolID].total = poolTotal
                    poolInfo.rewardPools = null
                    if (rewardPoolsMap[poolID] != undefined){
                        nominationpools_rewardpools = rewardPoolsMap[poolID]
                        poolInfo.rewardPools = rewardPoolsMap[poolID]
                    }
                    //console.log(`poolID=${poolID}`, poolInfo)

                    let rec = {
                        address_pubkey: stash_pubkey,
                        address_ss58: stash_ss58,
                        section: "NominationPools",
                        storage: "BondedPools",
                        block_number: eraBN,
                        block_hash: era0Hash,
                        ts: blockTS,
                        era: eraNumber,
                        nominationpools_id: poolID,
                        nominationpools_total: poolTotal,
                        nominationpools_member_cnt: poolInfo.memberCounter,
                        nominationpools_commission: currentCommission,
                        nominationpools_rewardpools: nominationpools_rewardpools,
                        pv: poolInfo
                    }
                    //console.log(rec)
                    fs.writeSync(f, JSON.stringify(rec) + NL);
                }
            }

            for (const user of validator_pref) {
                let pub = user[0].slice(-32);
                let pubkey = u8aToHex(pub);
                let prefix = 0
                let address_ss58 = encodeAddress(pub, prefix);
                var pref = JSON.parse(JSON.stringify(user[1]))
                pref.commission = pref.commission / 1000000000
                validatorPrefMap[address_ss58] = {
                    commission: pref.commission,
                    blocked: pref.blocked
                }
            }

            var validator_pref = await apiAt.query.staking.erasValidatorPrefs.entries(eraNumber-1);

            //return

            let isPaged = true
            if (isPaged){

                let nominationPools_num_last_key = '';
                let nominationPools_num_page = 0;
                let nominationPools_done = false
                let nominationPools_num = 0
                while (!nominationPools_done && fetchNominationPool) {
                    let query = null
                    console.log(`nominationPools_num_page=${nominationPools_num_page}. pageSize=${perPagelimit}, startKey=${nominationPools_num_last_key}`)
                    query = await apiAt.query.nominationPools.poolMembers.entriesPaged({
                        args: [],
                        pageSize: perPagelimit,
                        startKey: nominationPools_num_last_key
                    })
                    if (query.length == 0) {
                        console.log(`Query NominationPools:poolMembers Completed: poolMembers=${nominationPools_num}`)
                        stakingStats[eraNumber].numPoolMembers = nominationPools_num
                        break
                    } else {
                        console.log(`Staking:ErasStakers page: `, nominationPools_num_page++);
                        nominationPools_num_last_key = query[query.length - 1][0];
                    }
                    /*
                    {
                      poolId: 30
                      points: 0
                      lastRecordedRewardCounter: 164,532,633,942,265,733
                      unbondingEras: {
                        1261: 1,000,000,000,000
                      }
                    }
                    */
                    for (const user of query) {
                        let pub = user[0].slice(-32);
                        let pubkey = u8aToHex(pub);
                        let prefix = 0

                        let address_ss58 = encodeAddress(pub, prefix);
                        let poolID = null

                        var pv = JSON.parse(JSON.stringify(user[1]))
                        //console.log(`address_ss58=${address_ss58}, pv`, pv)
                        if (pv.poolId != undefined) poolID = pv.poolId
                        pv.points =  paraTool.dechexToIntStr(pv.points) / 10 ** chainDecimals;
                        pv.lastRecordedRewardCounter =  paraTool.dechexToIntStr(pv.lastRecordedRewardCounter);
                        let unbondingErasKey = Object.keys(pv.unbondingEras)
                        let unbondingEras = []
                        let unbonded = 0;
                        for (const era of unbondingErasKey){
                            let unbondedAmount = paraTool.dechexToIntStr(pv.unbondingEras[era]) / 10 ** chainDecimals;
                            unbonded += unbondedAmount
                            let res = {
                                era: era,
                                amount: unbondedAmount
                            }
                            unbondingEras.push(res)
                        }
                        let member_share = null;
                        if (stashMap[poolID] != undefined && stashMap[poolID].total != undefined){
                            member_share = pv.points / stashMap[poolID].total
                        }
                        pv.unbondingEras = unbondingEras
                        if (pv.unbondingEras.length > 0){
                            //console.log(`[${address_ss58}] unbondingEras!`, pv)
                        }
                        let rec = {
                            address_pubkey: pubkey,
                            address_ss58: address_ss58,
                            section: "NominationPools",
                            storage: "PoolMembers",
                            block_number: eraBN,
                            block_hash: era0Hash,
                            ts: blockTS,
                            era: eraNumber,
                            nominationpools_id: poolID,
                            member_bonded: pv.points,
                            member_unbonded: unbonded,
                            member_share : member_share,
                            pv: pv
                        }
                        //console.log(rec)
                        fs.writeSync(f, JSON.stringify(rec) + NL);
                        nominationPools_num++
                    }
                    if (query.length > 0) {} else {
                        nominationPools_done = true;
                    }
                }

                let validator_num_last_key = '';
                let validator_num_page = 0;
                let validator_done = false
                let validator_num = 0
                while (!validator_done) {
                    let query = null
                    if (apiAt.query.staking.erasStakers != undefined) {
                        console.log(`validator_num_page=${validator_num_page}. pageSize=${perPagelimit}, startKey=${validator_num_last_key}`)
                        query = await apiAt.query.staking.erasStakers.entriesPaged({
                            args: [eraNumber],
                            pageSize: perPagelimit,
                            startKey: validator_num_last_key
                        })
                    }
                    if (query.length == 0) {
                        console.log(`Query staking:erasStakers Completed: validators=${validator_num}, rewardsEarner = ${numPointsEarners}`)
                        stakingStats[eraNumber].numValidators = validator_num
                        break
                    } else {
                        console.log(`Staking:ErasStakers page: `, validator_num_page++);
                        validator_num_last_key = query[query.length - 1][0];
                    }
                    for (const user of query) {
                        let pub = user[0].slice(-32);
                        let pubkey = u8aToHex(pub);
                        let prefix = 0

                        let address_ss58 = encodeAddress(pub, prefix);

                        var pv = JSON.parse(JSON.stringify(user[1]))
                        //console.log(`address_ss58=${address_ss58}, pv`, pv)
                        pv.total =  paraTool.dechexToIntStr(pv.total) / 10 ** chainDecimals;
                        pv.own =  paraTool.dechexToIntStr(pv.own) / 10 ** chainDecimals;
                        let others = []
                        let targets = []
                        for (const other of pv.others){
                            //other.value_raw = other.value
                            other.value = other.value / 10 ** chainDecimals;
                            if (other.value > 0){
                                others.push(other)
                                targets.push(other.who)
                            }else{
                                console.log(`SKIP others`, other)
                            }
                        }
                        pv.others = others
                        pv.nominatorLen = others.length
                        let validator_commission = null;
                        if (validatorPrefMap[address_ss58]!= undefined){
                            validator_commission = validatorPrefMap[address_ss58].commission
                        }

                        let validator_reward_points = null;
                        let validator_reward_share = null;
                        let validator_staking_rewards = null;
                        if (validatorRewardMap[address_ss58]!= undefined){
                            validator_reward_points = validatorRewardMap[address_ss58].point
                            validator_reward_share = validatorRewardMap[address_ss58].weight
                            if (totalStakingRewards && totalRewardPoints){
                                validator_staking_rewards = (validatorRewardMap[address_ss58].point / totalRewardPoints) * totalStakingRewards
                            }
                        }else{
                            console.log(`validator not found! ${address_ss58}`)
                            //process.exit(0)
                        }

                        let rec = {
                            address_pubkey: pubkey,
                            address_ss58: address_ss58,
                            section: "Staking",
                            storage: "ErasStakers",
                            block_number: eraBN,
                            block_hash: era0Hash,
                            ts: blockTS,
                            era: eraNumber,
                            validator_total: pv.total,
                            validator_own: pv.own,
                            validator_commission: validator_commission,
                            validator_reward_shares: validator_reward_share,
                            validator_reward_points: validator_reward_points,
                            validator_staking_rewards: validator_staking_rewards,
                            targets: targets,
                            pv: pv
                        }
                        //console.log(rec)
                        fs.writeSync(f, JSON.stringify(rec) + NL);
                        validator_num++
                    }
                    if (query.length > 0) {} else {
                        validator_done = true;
                    }


                }

                let nominator_num_last_key = '';
                let nominator_num_page = 0;
                let nominator_done = false
                let nominator_num = 0

                let singleBatch = false
                if (!singleBatch){
                    while (!nominator_done) {
                        let query = null
                        if (apiAt.query.staking.nominators != undefined) {
                            console.log(`nominator_num_page=${nominator_num_page}. pageSize=${perPagelimit}, startKey=${nominator_num_last_key}`)
                            query = await apiAt.query.staking.nominators.entriesPaged({
                                args: [],
                                pageSize: perPagelimit,
                                startKey: nominator_num_last_key
                            })
                        }
                        if (query.length == 0) {
                            stakingStats[eraNumber].numNominators = nominator_num
                            break
                        } else {
                            console.log(`Staking:Nominators page: `, nominator_num_page++);
                            nominator_num_last_key = query[query.length - 1][0];
                        }
                        for (const user of query) {
                            let pub = user[0].slice(-32);
                            let pubkey = u8aToHex(pub);
                            let prefix = 0
                            var pv = JSON.parse(JSON.stringify(user[1]))
                            let address_ss58 = encodeAddress(pub, prefix);
                            let rec = {
                                address_pubkey: pubkey,
                                address_ss58: address_ss58,
                                section: "Staking",
                                storage: "Nominators",
                                block_number: eraBN,
                                block_hash: era0Hash,
                                ts: blockTS,
                                era: eraNumber,
                                submitted_in: pv.submittedIn,
                                suppressed: pv.suppressed,
                                targets: pv.targets,
                                pv: pv
                            }
                            //console.log(rec)
                            fs.writeSync(f, JSON.stringify(rec) + NL);
                            nominator_num++
                        }
                        if (query.length > 0) {} else {
                            nominator_done = true;
                        }
                    }
                } else {
                    let query = await apiAt.query.staking.nominators.entries();
                    for (const user of query) {
                        let pub = user[0].slice(-32);
                        let pubkey = u8aToHex(pub);
                        let prefix = 0
                        var pv = JSON.parse(JSON.stringify(user[1]))
                        let address_ss58 = encodeAddress(pub, prefix);
                        let rec = {
                            address_pubkey: pubkey,
                            address_ss58: address_ss58,
                            section: "Staking",
                            storage: "Nominators",
                            block_number: eraBN,
                            block_hash: era0Hash,
                            ts: blockTS,
                            era: eraNumber,
                            submitted_in: pv.submittedIn,
                            suppressed: pv.suppressed,
                            targets: pv.targets,
                            pv: pv
                        }
                        //console.log(rec)
                        fs.writeSync(f, JSON.stringify(rec) + NL);
                        nominator_num++
                    }
                    console.log(`Query staking.nominators Completed:`, nominator_num)
                    stakingStats[eraNumber].numNominators = nominator_num
                }
            }
        }

        let dryRun =  false
        try {
            fs.closeSync(f);
            await this.cpDailyStakingToGS(logDT, paraID, relayChain, dryRun)
            //await this.loadDailyStakingFromGS(logDT, paraID, relayChain, dryRun)
            if (!dryRun) {
                try {
                    fs.unlinkSync(fn);
                    console.log(`Deleted file: ${fn}`);
                } catch (error) {
                    console.error(`Error deleting file: ${fn}`, error);
                }
            }
            let [todayDT, hr] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
            for (const era of Object.keys(stakingStats)){
                let eraStat = stakingStats[era]
                let loaded = (logDT == todayDT) ? 0 : 1;
                let totalStaked = (eraStat.totalStaked) ? `'${eraStat.totalStaked}'` : `NULL`
                let totalRewardPoints = (eraStat.totalRewardPoints) ? `'${eraStat.totalRewardPoints}'` : `NULL`
                let totalStakingRewards = (eraStat.totalStakingRewards) ? `'${eraStat.totalStakingRewards}'` : `NULL`
                let numPointsEarners = (eraStat.numPointsEarners) ? `'${eraStat.numPointsEarners}'` : `NULL`
                let numPoolMembers = (eraStat.numPoolMembers) ? `'${eraStat.numPoolMembers}'` : `NULL`
                let numPools = (eraStat.numPools) ? `'${eraStat.numPools}'` : `NULL`
                let sql = `insert into era${chainID} (era, block_number, numValidators, numNominators, totalStaked, totalRewardPoints, totalStakingRewards, numPointsEarners, numPoolMembers, numPools, crawlNominatorStatus, crawlNominatorDT) values ('${eraStat.era}', '${eraStat.block_number}', '${eraStat.numValidators}', '${eraStat.numNominators}', ${totalStaked}, ${totalRewardPoints}, ${totalStakingRewards}, ${numPointsEarners}, ${numPoolMembers}, ${numPools}, 'AuditRequired', Now()) on duplicate key update numNominators = values(numNominators), numValidators = values(numValidators), crawlNominatorStatus = values(crawlNominatorStatus), crawlNominatorDT = values(crawlNominatorDT), totalStaked = values(totalStaked), totalRewardPoints = values(totalRewardPoints), totalStakingRewards = values(totalStakingRewards), numPointsEarners = values(numPointsEarners), numPoolMembers = values(numPoolMembers), numPools = values(numPools)`
                console.log(sql);
                if (!dryRun) {
                    this.batchedSQL.push(sql);
                }
            }
            if (!dryRun) await this.update_batchedSQL();
        } catch (err) {
            console.log("dump_trace", err);
        }

    }

    /*
    Given a paraID, relayChain combination, dump_trace will fetch rawblocks(including traces)
    from bigtable and generate flat traces records that are required to build substrate-etl:crypto_polkadot.traces0
    */
    async dump_trace(logDT = "2022-12-29", paraID = 2000, relayChain = "polkadot") {
        /*
        await this.cpDailyTraceToGS(logDT, paraID, relayChain, false)
        await this.loadDailyTraceFromGS(logDT, paraID, relayChain, false)
        return
        */
        let verbose = true
        let isBackFill = false
        let supressedFound = {}
        let projectID = `${this.project}`
        let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
        if (chainID != paraTool.chainIDPolkadot && chainID != paraTool.chainIDKusama) {
            console.log(`chainID=${chainID} NOT supported`)
            return
        }
        let chain = await this.getChain(chainID);
        let chainInfo = await this.getChainFullInfo(chainID)
        let chainDecimals = chainInfo.decimals
        let asset = this.getChainAsset(chainID);
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        console.log(`chainDecimals`, chainDecimals, `assetChain`, assetChain)

        let chain_identification = this.getIDByChainID(chainID)
        let chain_name = this.getChainName(chainID)

        await this.get_skipStorageKeys();
        console.log(`dump_trace paraID=${paraID}, relayChain=${relayChain}, chainID=${chainID}, logDT=${logDT} (projectID=${projectID})`)
        // 1. get bnStart, bnEnd for logDT
        let [logTS, logYYYYMMDD, currDT, prevDT] = this.getTimeFormat(logDT)
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
        console.log(`${logDT} bnStart=${bnStart}, bnEnd=${bnEnd}, len=${bnEnd-bnStart+1}`)

        // 2. setup directories for tbls on date
        let dir = "/tmp";
        let tbl = "traces";
        let logDTp = logDT.replaceAll("-", "")
        let fn = path.join(dir, `${relayChain}-${tbl}-${paraID}-${logDT}.json`)
        console.log(`writting to ${fn}`)
        let f = fs.openSync(fn, 'w', 0o666);
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);

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
            this.specVersion = specVersion.specVersion;
        }

        await this.setupAPI(chain)
        let api = this.api;
        let [finalizedBlockHash, blockTS, _bn] = logDT && chain.WSEndpointArchive ? await this.getFinalizedBlockLogDT(chainID, logDT) : await this.getFinalizedBlockInfo(chainID, api, logDT)
        await this.getSpecVersionMetadata(chain, this.specVersion, finalizedBlockHash, bnEnd);
        // 4. do table scan 50 blocks at a time
        let NL = "\r\n";
        let jmp = 50;
        let numTraces = 0;

        //TEST:
        let jmpIdx = 0
        let jmpTotal = Math.ceil((bnEnd - bnStart) / jmp);
        for (let bn0 = bnStart; bn0 <= bnEnd; bn0 += jmp) {
            jmpIdx++
            console.log(`${jmpIdx}/${jmpTotal}`)
            let bn1 = bn0 + jmp - 1;
            if (bn1 > bnEnd) bn1 = bnEnd;

            let res = await this.validate_trace(tableChain, bn0, bn1)
            let rows = []
            let missingBNs = res.missingBNs
            let verifiedRows = res.verifiedRows
            if (missingBNs.length > 0 && isBackFill) {
                console.log(`missingBNs`, missingBNs)
                const Crawler = require("./crawler");
                let crawler = new Crawler();
                await crawler.setupAPI(chain);
                await crawler.assetManagerInit();
                await crawler.setupChainAndAPI(chainID);
                for (const targetBN of missingBNs) {
                    let t2 = {
                        chainID,
                        blockNumber: targetBN
                    };
                    let x = await crawler.crawl_block_trace(chain, t2);
                }

                let newRes = await this.validate_trace(tableChain, bn0, bn1)
                missingBNs = newRes.missingBNs
                verifiedRows = newRes.verifiedRows
                if (missingBNs.length > 0) {
                    console.log(`Fetch failed missingBN=${missingBNs}`)
                    //process.exit(1, `validate_trace error`)
                }
            }

            //continue
            //TODO: fetch from gs?
            //console.log(`${bn0}, ${bn1} verifiedRows`, verifiedRows)
            for (const row of verifiedRows) {
                let r = this.build_block_from_row(row);
                let b = (r.feed)? r.feed: r.block ;
                //console.log(`r`, JSON.stringify(r))
                //console.log(`block`, b)
                let hdr = b.header;
                let blockTS = b.blockTS
                let block_hash = b.hash
                if (!this.validateDT(blockTS, logDT)) continue
                let bn = parseInt(row.id.substr(2), 16);
                let [logDT0, hr] = paraTool.ts_to_logDT_hr(blockTS);
                let traces = r.trace;
                let extrinsicIndex = null;
                if (traces.length > 0) {
                    numTraces += traces.length;
                    //WANT:
                    /*
                    let t = {
                        relay_chain: relayChain,
                        para_id: paraID,
                        id: id,
                        chain_name: chainName,
                        block_number: blockNumber,
                        block_hash: blockHash,
                        ts: blockTS,
                        trace_id: traceID,
                        k: a2.k,
                        v: a2.v,
                        section: a2.p,
                        storage: a2.s,
                        pk_extra:
                        pv:
                    };
                    */
                    for (let traceIdx = 0; traceIdx < traces.length; traceIdx++) {
                        let t = traces[traceIdx];
                        let o = this.parse_trace(t, r.traceType, traceIdx, bn, api);
                        if (o.section == "Substrate" && o.storage == "ExtrinsicIndex") {
                            if (extrinsicIndex == null) {
                                extrinsicIndex = 0
                            } else if (o.pv == "0") {
                                extrinsicIndex = null
                            } else {
                                extrinsicIndex++
                            }
                        }
                        try {
                            let pk_extra = JSON.parse(o.pk_extra)
                            let pv = JSON.parse(o.pv)
                            o.pk_extra = pk_extra
                            o.pv = pv
                        } catch (e){

                        }
                        if ((o.section == "Staking" && o.storage == "Nominators" && o.pk_extra ) || (o.section == "System" && o.storage == "Account" && o.pk_extra)) {
                            //console.log(`${o.section}:${o.storage}, o`, o)
                            o.address_ss58 = o.pk_extra[0]
                            o.address_pubkey = paraTool.getPubKey(o.address_ss58);
                        }
                        if ((o.section == "Staking" && o.storage == "ErasStakers" && o.pk_extra )) {
                            o.pk_extra[0] = paraTool.toNumWithoutComma(o.pk_extra[0])
                            o.address_ss58 = o.pk_extra[1]
                            o.address_pubkey = paraTool.getPubKey(o.address_ss58);
                            console.log(`${o.section}:${o.storage}, o`, o)
                            let pv = o.pv
                            pv.total =  paraTool.dechexToIntStr(pv.total) / 10 ** chainDecimals;
                            pv.own =  paraTool.dechexToIntStr(pv.own) / 10 ** chainDecimals;
                            let others = []
                            for (const other of pv.others){
                                other.value = other.value / 10 ** chainDecimals;
                                if (other.value > 0){
                                    others.push(other)
                                }else{
                                    console.log(`SKIP others`, other)
                                }
                            }
                            pv.others = others
                            pv.nominatorLen = others.length
                            o.pv = pv
                            console.log(`Staking:ErasStakers`, JSON.stringify(o.pv))
                            /*
                            {
                                total: '0x0000000000000000004f5173e8bb050a',
                                own: 0,
                                others: [
                                  [Object], [Object], [Object], [Object]
                                ]
                              }
                              */
                        }
                        if (o.section == "System" && o.storage == "Account" && o.pk_extra) {
                            try {
                                //o.pk_extra = JSON.parse(o.pk_extra)
                                //console.log(`System:Account o`, o)
                                //o.address_ss58 = o.pk_extra[0]
                                //o.address_pubkey = paraTool.getPubKey(o.address_ss58);
                                //17624544-650: '{"nonce":1,"consumers":3,"providers":1,"sufficients":0,"data":{"free":51430786398441,"reserved":200410000000,"frozen":19477059680539,"flags":"0x800000000000000000005443b495716c"}}
                                let accountStruct = o.pv
                                let a2 = accountStruct.data
                                let flds = []
                                if (a2.free != undefined) {
                                    flds.push(["free", "free"])
                                }
                                if (a2.reserved != undefined) {
                                    flds.push(["reserved", "reserved"])
                                }
                                if (a2.frozen != undefined) {
                                    flds.push(["frozen", "frozen"])
                                }
                                if (a2.flags != undefined) {
                                    o["flags"] = paraTool.dechexToIntStr(a2.flags)
                                }
                                if (a2.miscFrozen != undefined) {
                                    flds.push(["miscFrozen", "misc_frozen"])
                                }
                                if (a2.feeFrozen != undefined) {
                                    flds.push(["feeFrozen", "fee_frozen"])
                                }
                                let p = await this.computePriceUSD({
                                    assetChain: assetChain,
                                    ts: blockTS
                                })
                                let priceUSD = p && p.priceUSD ? p.priceUSD : 0;
                                if (priceUSD > 0) {
                                    o.price_usd = priceUSD
                                }
                                for (const fmap of flds) {
                                    let f = fmap[0] // e.g. totalIssuance
                                    let f2 = fmap[1] // e.g. total_issuance
                                    o[f2] = a2[f] / 10 ** chainDecimals;
                                    o[`${f2}_raw`] = paraTool.dechexToIntStr(a2[f]);
                                    if (priceUSD) {
                                        o[`${f2}_usd`] = o[f2] * priceUSD;
                                    }
                                }
                                if (o[`misc_frozen`] != undefined && o[`fee_frozen`] != undefined){
                                    o[`frozen`] = Math.max(o[`misc_frozen`], o[`fee_frozen`])
                                    o[`frozen_raw`] = Math.max(o[`misc_frozen_raw`], o[`fee_frozen_raw`])
                                    o[`frozen_usd`] = Math.max(o[`misc_frozen_usd`], o[`fee_frozen_usd`])
                                }

                            } catch (e) {
                                console.log(`error~`, e)
                            }
                        }

                        o.block_number = bn;
                        o.ts = blockTS;
                        o.block_hash = block_hash;

                        o.relay_chain = relayChain
                        o.para_id = paraID
                        o.id = chain_identification
                        o.chain_name = chain_name
                        o.extrinsic_id = `${bn}-${extrinsicIndex}`;
                        if (o.extrinsic_id.includes("null")) o.extrinsic_id = null
                        if (this.suppress_trace(o.trace_id, o.section, o.storage)) {
                            if (supressedFound[`${o.section}:${o.storage}`] == undefined) {
                                supressedFound[`${o.section}:${o.storage}`] = 1
                                //console.log(`supressed ${o.section}:${o.storage}`);
                            }
                        } else if (this.supress_skipped_trace(o.trace_id, o.section, o.storage)) {
                            if (supressedFound[`${o.section}:${o.storage}`] == undefined) {
                                supressedFound[`${o.section}:${o.storage}`] = 1
                                //console.log(`supressed skipped trace ${o.section}:${o.storage}`);
                            }
                        } else if (o.section == "unknown" || o.storage == "unknown") {
                            // Skip unknown
                        } else {
                            if (verbose) console.log(`trace ${o.trace_id} ${o.section}:${o.storage}`);
                            //if (verbose) console.log(`trace`, o);
                            fs.writeSync(f, JSON.stringify(o) + NL);
                        }
                    }
                }
            }
        }

        let dryRun = false
        try {
            fs.closeSync(f);
            await this.cpDailyTraceToGS(logDT, paraID, relayChain, dryRun)
            await this.loadDailyTraceFromGS(logDT, paraID, relayChain, dryRun)
            /*
            let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --time_partitioning_field ts --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}$${logDTp}' ${fn} schema/substrateetl/${tbl}.json`;
            console.log(cmd);
            */
            if (!dryRun) {
                try {
                    fs.unlinkSync(fn);
                    console.log(`Deleted file: ${fn}`);
                } catch (error) {
                    console.error(`Error deleting file: ${fn}`, error);
                }
            }
            let [todayDT, hr] = paraTool.ts_to_logDT_hr(this.getCurrentTS());
            let loaded = (logDT == todayDT) ? 0 : 1;
            let sql = `insert into blocklog (logDT, chainID, numTraces, traceMetricsStatus, traceMetricsDT) values ('${logDT}', '${chainID}', '${numTraces}', 'AuditRequired', Now() ) on duplicate key update numTraces = values(numTraces), traceMetricsStatus = values(traceMetricsStatus), traceMetricsDT = values(traceMetricsDT)`
            console.log(sql);
            if (!dryRun) {
                this.batchedSQL.push(sql);
                await this.update_batchedSQL();
            }
        } catch (err) {
            console.log("dump_trace", err);
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
        let bqDataset = this.get_relayChain_dataset(relayChain, this.isProd);
        if (!this.isProd) return //TODO:MK skip query for dev
        let paraID = paraTool.getParaIDfromChainID(chainID)
        //xcmtransfers0, xcmtransfers1 are using substrate-etl.relayChain even for dev case
        let sqla = {
            "extrinsics": `select count(*) as numExtrinsics, sum(if(signed, 1, 0)) as numSignedExtrinsics, sum(fee) as fees from ${project}.${bqDataset}.extrinsics${paraID} where date(block_time) = '${logDT}'`,
            "events": `select count(*) as numEvents from ${project}.${bqDataset}.events${paraID} where date(block_time) = '${logDT}'`,
            "transfers": `select count(*) as numTransfers, count(distinct from_pub_key) numAccountsTransfersOut, count(distinct to_pub_key) numAccountsTransfersIn, sum(if(amount_usd is null, 0, amount_usd)) valueTransfersUSD from ${project}.${bqDataset}.transfers${paraID} where date(block_time) = '${logDT}'`,
            "xcmtransfers0": `select count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from ${project}.${bqDataset}.xcmtransfers where destination_para_id = ${paraID} and date(origination_ts) = '${logDT}'`,
            "xcmtransfers1": `select count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from ${project}.${bqDataset}.xcmtransfers where origination_para_id = ${paraID} and date(origination_ts) = '${logDT}'`,
        }
        // don't compute this unless accountMetricsStatus is "AuditRequired" or "Audited"
        let numAddresses_prevDT = null;
        let recs = await this.poolREADONLY.query(`select numAddresses from blocklog where chainID = '${chainID}' and logDT = date(date_sub('${logDT}', interval 1 day)) limit 1`);
        if (recs.length == 1) {
            numAddresses_prevDT = recs[0].numAddresses;
        }
        sqla["accountsnew"] = `select count(distinct address_pubkey) as numNewAccounts from ${project}.${bqDataset}.accountsnew${paraID} where date(ts) = '${logDT}'`
        sqla["accountsreaped"] = `select count(distinct address_pubkey) as numReapedAccounts from ${project}.${bqDataset}.accountsreaped${paraID} where date(ts) = '${logDT}'`
        sqla["accountsactive"] = `select count(*) as numActiveAccounts, sum(if(accountType = "System", 1, 0)) as numActiveSystemAccounts, sum(if(accountType = "User", 1, 0)) as numActiveUserAccounts from ${project}.${bqDataset}.accountsactive${paraID} where date(ts) = '${logDT}'`
        sqla["accountspassive"] = `select count(*) as numPassiveAccounts from ${project}.${bqDataset}.accountspassive${paraID} where date(ts) = '${logDT}'`

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
                    //console.log(a, r[a]);
                    if ((a == "numNewAccounts" || a == "numReapedAccounts")) {
                        let rat = r[a] / (1 + numAddresses_prevDT);
                        if ((numAddresses_prevDT == null) || (rat > .5)) {
                            console.log("NULLIFY", a);
                            row[a] = null; // don't add new or reaped if its more than half of what we saw yesterday, of if yesterday is blank
                        } else {
                            console.log("keep", a, r[a], numAddresses_prevDT, rat);
                        }
                    }
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
        let bqDataset = this.get_relayChain_dataset(relayChain);
        let sqla = {
            "balances": `select date(ts) logDT, count(distinct address_pubkey) as numAddresses from ${project}.${bqDataset}.balances${paraID} where DATE(ts) >= "${startDT}" group by logDT order by logDT`,
            "extrinsics": `select date(block_time) logDT, count(*) as numExtrinsics, sum(if(signed, 1, 0)) as numSignedExtrinsics, sum(fee) fees from ${project}.${bqDataset}.extrinsics${paraID} where DATE(block_time) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            "events": `select date(block_time) logDT, count(*) as numEvents from ${project}.${bqDataset}.events${paraID} where DATE(block_time) >= "${startDT}" group by logDT order by logDT`,
            "transfers": `select  date(block_time) logDT, count(*) as numTransfers, count(distinct from_pub_key) numAccountsTransfersOut, count(distinct to_pub_key) numAccountsTransfersIn, sum(if(amount_usd is null, 0, amount_usd)) valueTransfersUSD from ${project}.${bqDataset}.transfers${paraID} where DATE(block_time) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            "xcmtransfers0": `select  date(origination_ts) logDT, count(*) as numXCMTransfersIn, sum(if(origination_amount_sent_usd is Null, 0, origination_amount_sent_usd)) valXCMTransferIncomingUSD from ${project}.${bqDataset}.xcmtransfers where destination_para_id = ${paraID} and DATE(origination_ts) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            "xcmtransfers1": `select date(origination_ts) as logDT, count(*) as numXCMTransfersOut, sum(if(destination_amount_received_usd is Null, 0, destination_amount_received_usd))  valXCMTransferOutgoingUSD from ${project}.${bqDataset}.xcmtransfers where origination_para_id = ${paraID} and DATE(origination_ts) >= "${startDT}" group by logDT having logDT < "${today}" order by logDT`,
            // TODO: only store if accountMetricsStatus = "Audited" or "AuditRequired" for a specific day
            "accountsnew": `select date(ts) logDT, count(distinct address_pubkey) as numNewAccounts from ${project}.${bqDataset}.accountsnew${paraID} group by logDT order by logDT`,
            "accountsreaped": `select date(ts) logDT, count(distinct address_pubkey) as numReapedAccounts from ${project}.${bqDataset}.accountsreaped${paraID} group by logDT  order by logDT`,
            "accountsactive": `select date(ts) logDT, count(*) as numActiveAccounts, sum(if(accountType = "System", 1, 0)) as numActiveSystemAccounts, sum(if(accountType = "User", 1, 0)) as numActiveUserAccounts from ${project}.${bqDataset}.accountsactive${paraID} group by logDT  order by logDT`,
            "accountspassive": `select date(ts) logDT, count(*) as numPassiveAccounts from ${project}.${bqDataset}.accountspassive${paraID} group by logDT  order by logDT`
        };
        let isEVM = await this.isEVMChain(chainID);

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
    }


    async mark_pallet_storage(pallet, storage, group, groupsection) {
        //let sql = `update chainPalletStorage set substrateetl = 1, substrateetlGroup = '${group}', substrateetlGroupSection = '${groupSection}' where palletName = '${pallet}' and storageName = '${storage}'`
        //this.batchedSQL.push(sql);
        //this.update_batchSQL();
    }

    async dump_storage(chainID, logDT) {
        let sql = `select storageKey, palletName, storageName, substrateetlGroup, substrateetlGroupSection from chainPalletStorage where substrateetl = 1`
        let recs = this.poolREADONLY(sql);
        let storageKeys = {};
        for (const r of recs) {
            storageKeys[r.storageKey] = r;
        }
        console.log(storageKeys);
        // now
    }

    async getAlltables(filter = 'accounts') {
        let projectID = `${this.project}`
        let relayChains = ['kusama', 'polkadot']
        let bqCmds = []
        let fullTableIDs = []
        for (const rc of relayChains) {
            let bqCmd = `bq ls --max_results 1000 --project_id=${projectID} --dataset_id="${this.get_relayChain_dataset(rc)}" --format=json`
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


    map_substratetype_to_bq_schematypes(f, idx) {
        let out = [];
        let st = "json";
        let n = f.name ? paraTool.snake_case_string(f.name) : `unnamed_${idx}`;
        let type = f.type ? f.type : null
        let typeName = f.typeName ? f.typeName : null
        let description = typeName;
        let mode = "REQUIRED";
        if (/^Option<.*>$/.test(typeName)) {
            typeName = typeName.substring(7, typeName.length - 1);
            mode = "NULLABLE";
        }
        if (["BalanceOf<T>", "T::Balance", 'BalanceOf<T, I>', 'Balance'].includes(typeName)) {
            out.push({
                "name": n,
                "type": "string",
                description,
                mode
            });
            out.push({
                "name": `${n}_usd`,
                "type": "float",
                description,
                mode
            });
            out.push({
                "name": `${n}_float`,
                "type": "float",
                description,
                mode
            });
        } else if (["T::AccountId", "AccountIdLookupOf<T>"].includes(typeName)) {
            out.push({
                "name": `${n}_ss58`,
                "type": "string",
                description,
                mode
            });
            out.push({
                "name": `${n}_pub_key`,
                "type": "string",
                description,
                mode
            });
        } else if (["T::CurrencyId", "CurrencyId", "T::AssetId", "AssetId", "AssetId<T>", "AssetIdOf<T>", "T::PoolId", "PoolId", "PoolId<T>"].includes(typeName)) { // note: these could be big num
            out.push({
                "name": n,
                "type": "string",
                description,
                mode
            });
            out.push({
                "name": `${n}_symbol`,
                "type": "string",
                mode
            });
            out.push({
                "name": `${n}_decimals`,
                "type": "integer",
                mode
            });
        } else if (["u32", "Compact<u32>", "T::BlockNumber"].includes(typeName)) {
            out.push({
                "name": n,
                "type": "integer",
                description,
                mode
            });
        } else if (type == "bool" || f.type == "Boolean") {
            out.push({
                "name": n,
                "type": "boolean",
                description,
                mode
            });
        } else if (typeName && typeName.includes("Vec<u8>")) {
            out.push({
                "name": n,
                "type": "string",
                description,
                mode
            });
        } else if (["H160", 'T::Hash'].includes(typeName)) {
            out.push({
                "name": n,
                "type": "string",
                description,
                mode
            });
        } else if (typeName && typeName.includes("Vec")) {
            out.push({
                "name": n,
                "type": "json",
                description,
                mode
            });
        } else {
            out.push({
                "name": n,
                "type": "json",
                description,
                mode
            });
        }
        return out;
    }

    async setup_storage_item(runtime, section, item, tables, datasetId, bigquery, createTable = true) {
        try {
            let fingerprintId = "_0x"; // TODO: hash of item type signature
            let storage = item.name;
            const tableId = `storage_${section}_${storage}` // _${fingerprintId}`;
            let table_description = item.docs ? item.docs.join("") : "";
            if (tables[tableId] == undefined) {
                const sch = [];
                sch.push({
                    "name": "chain_id",
                    "type": "string"
                });
                sch.push({
                    "name": "block_time",
                    "type": "timestamp"
                });
                sch.push({
                    "name": "block_number",
                    "type": "integer"
                });
                sch.push({
                    "name": "relay_chain",
                    "type": "string"
                });
                sch.push({
                    "name": "para_id",
                    "type": "integer"
                });
                sch.push({
                    "name": "trace_id",
                    "type": "string"
                });

                if (item.type && item.type.plain != undefined) {
                    let plain = this.lookup_runtime_type(runtime, item.type.plain);
                    let [typ, docs] = this.map_substrate_storage_type_to_bq_schematype(plain.def, runtime);
                    sch.push({
                        "name": "v",
                        "type": typ,
                        "description": (typeof docs == "object") ? JSON.stringify(docs) : docs
                    });
                } else if (item.type && item.type.map != undefined) {
                    let k = this.lookup_runtime_type(runtime, item.type.map.key);
                    let v = this.lookup_runtime_type(runtime, item.type.map.value);
                    let [k_type, k_docs] = k && k.def ? this.map_substrate_storage_type_to_bq_schematype(k.def, runtime) : [null, null];
                    let [v_type, v_docs] = v && v.def ? this.map_substrate_storage_type_to_bq_schematype(v.def, runtime) : [null, null];
                    if (typeof k_type == "string") {
                        let k_desc = (typeof k_docs == "object") ? JSON.stringify(k_docs) : k_docs;
                        if (k_desc.length > 1024) k_desc = k_desc.substring(0, 1000);
                        sch.push({
                            "name": "k",
                            "type": k_type,
                            "description": k_desc
                        });
                    } else {
                        console.log("KEY TYPE FAIL", k.def);
                    }
                    if (typeof v_type == "string") {
                        let v_desc = (typeof v_docs == "object") ? JSON.stringify(v_docs) : v_docs;
                        if (v_desc.length > 1024) v_desc = v_desc.substring(0, 1000);
                        sch.push({
                            "name": "v",
                            "type": v_type,
                            "description": v_desc
                        });
                    } else {
                        console.log("VAL TYPE FAIL", v.def);
                    }
                } else {
                    console.log("******** WHAT", item);
                }
                tables[tableId] = sch
                if (createTable) {
                    try {
                        console.log("CREATE", tableId);
                        const [table] = await bigquery
                            .dataset(datasetId)
                            .createTable(tableId, {
                                schema: sch,
                                location: 'US',
                                description: table_description,
                                timePartitioning: {
                                    type: 'HOUR',
                                    expirationMS: '7776000000', // 90d
                                    field: 'block_time',
                                },
                            });
                        console.log("DONE", tableId);
                    } catch (e) {
                        console.log(e, sch);
                    }
                }
            }
        } catch (err) {
            console.log(err);
        }
    }

    map_substrate_storage_type_to_bq_schematype(t, runtime) {
        if (t.composite && t.composite.fields) {
            return ["json", t];
        } else if (t.tuple) {
            let flds = t.tuple.map((f) => {
                let comp = this.lookup_runtime_type(runtime, f);
                return {
                    type: f,
                    def: comp
                } // typeName?
            });
            return ["json", {
                tuple: flds
            }];
        } else if (t.variant && t.variant.variants) {
            return ["json", t];
        } else if (t.sequence && t.sequence.type !== undefined) {
            // this.map_substrate_storage_type_to_bq_schematype(t.sequence.type);
            let seq_type = this.lookup_runtime_type(runtime, t.sequence.type);
            let seq_type_def = seq_type && seq_type.def && seq_type.def.primitive;
            if (seq_type_def == "U8") {
                return ["string", t]; // hex bytes
            } else {
                t.sequence.def = seq_type.def;
                return ["json", t];
            }
        } else if (t.array && t.array.type !== undefined) {
            let array_type = this.lookup_runtime_type(runtime, t.array.type);
            let array_type_def = array_type && array_type.def && array_type.def.primitive;
            if (array_type_def == "U8") {
                return ["string", t]; // hex bytes
            } else {
                return ["json", t];
            }
        } else if (t.historicMetaCompat) {
            return ["json", t];
        } else if (t.primitive) {
            let res = null
            switch (t.primitive) {
                case "U8":
                case "U16":
                case "U32":
                case "I8":
                case "I16":
                case "I32":
                    res = "integer";
                    break;
                case "Bool":
                    res = "boolean";
                    break;
                case "U64":
                case "U128":
                case "I64":
                case "I128":
                    res = "string"
                    break;
                default:
                    console.log("UNKNOWN PRIMITIVE", t.primitive);
            }
            return [res, t.primitive];
        }
        console.log("map_substrate_storage_type_to_bq_schematype MISSING", t);
        return ["unk", "unk"]

    }

    async setup_pallet(runtime, group, section, section_methods, tables, datasetId, bigquery, createTable = true) {
        if (!Array.isArray(section_methods)) return (false);
        for (const sm of section_methods) {
            let method = sm.name;
            let table_description = sm.docs ? sm.docs.join("") : "";
            let fingerprintId = "_0x"; // TODO: hash of section_methods signature
            const tableId = `${group}_${section}_${method}`;
            if (tables[tableId] == undefined) {
                const sch = [];
                let protected_flds = ["chain_id", "block_time", "relay_chain", "para_id", "extrinsic_id", "extrinsic_hash"];

                sch.push({
                    "name": "chain_id",
                    "type": "string"
                });
                sch.push({
                    "name": "block_time",
                    "type": "timestamp"
                });
                sch.push({
                    "name": "relay_chain",
                    "type": "string"
                });
                sch.push({
                    "name": "para_id",
                    "type": "integer"
                });
                sch.push({
                    "name": "extrinsic_id",
                    "type": "string"
                });
                sch.push({
                    "name": "extrinsic_hash",
                    "type": "string"
                });
                if (group == "evt") {
                    sch.push({
                        "name": "event_id",
                        "type": "string"
                    })
                    protected_flds.push("event_id");
                } else {
                    sch.push({
                        "name": "call_id",
                        "type": "string"
                    });
                    sch.push({
                        "name": "signer_ss58",
                        "type": "string"
                    });
                    sch.push({
                        "name": "signer_pub_key",
                        "type": "string"
                    });
                    protected_flds.push("call_id", "signer_ss58", "signer_pub_key");
                }
                let fields = sm.fields;
                fields.forEach((f, idx) => {
                    let out = this.map_substratetype_to_bq_schematypes(f, idx);
                    for (const o of out) {
                        if (protected_flds.includes(o.name)) {
                            o.name = `renamed_${o.name}`
                            console.log("RENAME", sm);
                        }
                        sch.push(o);
                    }
                });
                tables[tableId] = sch
                if (createTable) {
                    try {
                        console.log("CREATE", tableId);
                        const [table] = await bigquery
                            .dataset(datasetId)
                            .createTable(tableId, {
                                schema: sch,
                                location: 'US',
                                description: table_description,
                                timePartitioning: {
                                    type: 'HOUR',
                                    expirationMS: '7776000000', // 90d
                                    field: 'block_time',
                                },
                            });
                        console.log("DONE", tableId);
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        }
    }

    async setupCallEvents() {
        const bigquery = this.get_big_query();
        // read the set of call + event tables
        const datasetId = `substrate`; // `${id}` could be better, but we can drop the whole dataset quickly this way
        let tables = {};
        let substrateSchemaQuery = `SELECT table_name, column_name, data_type FROM substrate-etl.${datasetId}.INFORMATION_SCHEMA.COLUMNS  where table_name like 'call_%' or table_name like 'evt_%' or table_name like 'storage_%'`
        let tablesRecs = await this.execute_bqJob(substrateSchemaQuery);
        let ntables = 0;
        for (const t of tablesRecs) {
            if (tables[t.table_name] == undefined) {
                tables[t.table_name] = {};
                ntables++;
            }
            tables[t.table_name][t.column_name] = t.data_type;
        }
        console.log("TABLES LOADED", ntables);
        // fetch metadata of latest specVersion
        let sql = `select specVersions.chainID, l.specVersion, convert(metadata using utf8) as metadata from chain, specVersions, (select chainID, max(specVersion) specVersion from specVersions group by chainID) as l where specVersions.chainID = l.chainID and specVersions.specVersion = l.specVersion and chain.chainID = specVersions.chainID and chain.crawling = 1`;
        let recs = await this.poolREADONLY.query(sql);
        let specVersions = {};
        for (const r of recs) {
            let chainID = r.chainID
            let latestRuntime = JSON.parse(r.metadata);
            if (latestRuntime.pallets) {
                for (const pallet of latestRuntime.pallets) {
                    let section = pallet.name;
                    let callsRaw = pallet.calls && pallet.calls.type ? this.lookup_runtime_type(latestRuntime, pallet.calls.type) : null;
                    let calls = callsRaw && callsRaw.def && callsRaw.def.variant && callsRaw.def.variant.variants;
                    let eventsRaw = pallet.events && pallet.events.type ? this.lookup_runtime_type(latestRuntime, pallet.events.type) : null;
                    let events = eventsRaw && eventsRaw.def && eventsRaw.def.variant && eventsRaw.def.variant.variants;
                    await this.setup_pallet(latestRuntime, "call", section, calls, tables, datasetId, bigquery);
                    await this.setup_pallet(latestRuntime, "evt", section, events, tables, datasetId, bigquery);

                    if (pallet.storage && pallet.storage.items) {
                        for (const item of pallet.storage.items) {
                            await this.setup_storage_item(latestRuntime, section, item, tables, datasetId, bigquery);
                        }
                    }
                }
            }
        }
    }

    async enrich_swaps() {
        let sql = `select * from substrate-etl.crypto_polkadot.calls where call_section in ("omnipool", "aggregatedDex", "amm", "dexGeneral", "dex", "swaps", "zenlinkProtocol", "ammRoute", "router", "pablo", "stableAsset", "xyk", "curveAmm") and ( call_method in ("buy", "sell") or call_method like 'swap%')   and block_time > date_sub(CURRENT_TIMESTAMP(), interval 1440 minute)`
        let rows = await this.execute_bqJob(sql);
        for (const r of rows) {
            let call_args = r.call_args;
            let call_args_def = r.call_args_def;
            /*
{"amountIn":"0","amountOutMin":"0","amount_in":4750000000000,"amount_out_min":606498765584157,"deadline":8888888,"path":[{"assetIndex":516,"assetType":2,"chainId":2001},{"assetIndex":0,"assetType":0,"chainId":2001}],"recipient":{"id":"h1yYHpzqqUB5bos3teCg2QRiLWSQZv1MgwywM1tW2zdjVo7"}}
	    Basic strategy: there are some fields of type "AssetId" (amountIn) and other fields of type "Balance" (amount_in)
	    Swap enrichment is:
	    For every section/method in calls, map the calls' assetIds into canonical "swap" form
              tokenIn_{symbol,decimal,name}
              tokenOut_{symbol,decimal,name}
              amountIn{_float, price_usd, value_usd}
              amountOut{_float, price_usd, value_usd}
	    */
            console.log(call_args, call_args_def);
        }
    }

    async generate_xcmgar_udfs() {
        let url = "https://raw.githubusercontent.com/colorfulnotion/xcm-global-registry/main/metadata/xcmgar.json";
        const axios = require("axios");
        try {
            const resp = await axios.get(url);
            let assets = resp.data.assets;
            let out = {}
            for (const relayChain of Object.keys(assets)) {
                out[relayChain] = {}
                let rcassets = assets[relayChain];
                for (const c of rcassets) {
                    let paraID = c.paraID;
                    let id = c.id;
                    let chain_assets = c.data;
                    for (const a of chain_assets) {
                        let currencyID = typeof a.currencyID == "string" ? a.currencyID : null;
                        if (currencyID == null && typeof a.asset == "object") {
                            currencyID = JSON.stringify(a.asset);
                        }
                        if (out[relayChain][paraID] == undefined) {
                            out[relayChain][paraID] = {}
                        }
                        out[relayChain][paraID][currencyID] = [a.symbol, a.name, a.decimals];
                    }
                }
            }
            let xcmgarlibrary = `var m = ${JSON.stringify(out)}; function xcmgarmap(relayChain, paraID, currencyID) {
if ( m[relayChain] && m[relayChain][paraID] && m[relayChain][paraID][currencyID] ) {
 let x = m[relayChain][paraID][currencyID]; return { symbol: x[0], name: x[1], decimals: x[2] }
}
return null;
}
function xcmgarsymbol(relayChain, paraID, currencyID) { let x=  xcmgarmap(relayChain, paraID, currencyID); return ( x ? x.symbol : null )};
function xcmgarname(relayChain, paraID, currencyID) { let x=  xcmgarmap(relayChain, paraID, currencyID); return ( x ? x.name : null )};
function xcmgardecimals(relayChain, paraID, currencyID) { let x=  xcmgarmap(relayChain, paraID, currencyID); return ( x ? x.decimals: null )}`;
            let fn = "xcmgarlib3.js";
            let f = fs.openSync(fn, 'w', 0o666);
            fs.writeSync(f, xcmgarlibrary);
        } catch (err) {
            console.log("ERROR", err);
        }
    }

    lookup_runtime_type(runtime, type_id) {
        let lookup = runtime.lookup;
        if (runtime.lookup && runtime.lookup.types) {
            for (const t of runtime.lookup.types) {
                if (t.id == type_id) {
                    return (t.type);
                }
            }
        }
    }

}
