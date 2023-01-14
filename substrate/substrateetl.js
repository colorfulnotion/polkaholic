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
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs", "traces", "specversions"]
        let p = (chainID) ? ` where chainID = ${chainID} ` : ""
        let sql = `select chainID from chain ${p} order by chainID`
        let recs = await this.poolREADONLY.query(sql);
        for (const rec of recs) {
            let chainID = parseInt(rec.chainID, 10);
            let paraID = paraTool.getParaIDfromChainID(chainID);
            let relayChain = paraTool.getRelayChainByChainID(chainID);
            //console.log(" --- ", chainID, paraID, relayChain);
            for (const tbl of tbls) {
                let p = (this.partitioned_table(tbl)) ? "--time_partitioning_field block_time --time_partitioning_type DAY" : "";
                let cmd = `bq mk  --project_id=substrate-etl  --schema=schema/substrateetl/${tbl}.json ${p} --table ${relayChain}.${tbl}${paraID}`

                try {
                    console.log(cmd);
                    await exec(cmd);
                } catch (e) {
                    // TODO optimization: do not create twice
                }
            }
        }
    }

    async get_random_substrateetl(logDT = null, paraID = -1, relayChain = null) {
        let sql0 = `insert into substrateetllog ( logDT, chainID, loaded ) (select distinct logDT, chainID, 0 as loaded from indexlog where logDT >= date_sub(Now(), interval 3 day) and chainID < 40000 and indexed = 1 and readyForIndexing = 1) on duplicate key update chainID = values(chainID)`
        this.batchedSQL.push(sql0);
        await this.update_batchedSQL();

        let w = "";
        if (paraID >= 0 && relayChain) {
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain);
            w = ` and chainID = ${chainID}`
        }
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from substrateetllog where loaded = 0 ${w} order by attempted, rand() limit 1`
        console.log(sql);
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
        return {
            logDT,
            paraID,
            relayChain
        };
    }

    async audit_random_substrateetl() {
        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from substrateetllog where loaded = 1 and audited = 'Unknown' and logDT < date_sub(Now(), interval 1 day) order by rand() limit 100`
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

    project = "substrate-etl";

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

        let sql = `select UNIX_TIMESTAMP(logDT) indexTS, chainID from substrateetllog where ${wstr} order by rand() limit 1`
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
                if (audit_traces) {
                    tbls.push("traces");
                }
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
                        if (tbl == "traces" && audit_traces) {
                            let sql_fix = `update block${chainID} set crawlTrace = 1 where blockNumber in (${missing.join(",")}) and attempted < 127`
                            console.log(sql_fix);
                            this.batchedSQL.push(sql_fix);
                        } else {
                            let sql_fix = `update block${chainID} set crawlBlock = 1 where blockNumber in (${missing.join(",")}) and attempted < 127`
                            console.log(sql_fix);
                            this.batchedSQL.push(sql_fix);
                        }

                        errors.push(out);
                        audited = "Failed";
                        console.log(out);
                    }
                }
            }
            if (errors.length > 0) {
                let outsql = `update substrateetllog set auditDT = Now(), audited = '${audited}', auditResult = '${JSON.stringify(errors)}' where chainID='${chainID}' and logDT = '${logDT}'`
                console.log(outsql);
                this.batchedSQL.push(outsql);
                await this.update_batchedSQL();
            } else {
                let outsql = `update substrateetllog set auditDT = Now(), audited = '${audited}', auditResult = '' where chainID='${chainID}' and logDT = '${logDT}'`
                this.batchedSQL.push(outsql);
                console.log(outsql);
                await this.update_batchedSQL();

            }
        }


    }

    async dump_xcmtransfers_range(relayChain = "polkadot", range_days_ago = 365) {
        let currTS = this.getCurrentTS();
        for (let daysago = 0; daysago < range_days_ago; daysago++) {
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
        let project = "substrate-etl";
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs", "traces", "specversions"];
        console.log("|chain|blocks|extrinsics|events|transfers|logs|traces|specversions");
        console.log("|-----|------|----------|------|---------|----|------|------------");
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
        let cmd = `bq load  --project_id=substrate-etl --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}' ${fn} schema/substrateetl/${tbl}.json`;
        console.log(cmd);
        await exec(cmd);
    }

    async dump_xcmtransfers(logDT = "2022-12-29", relayChain = "polkadot") {
        let sql = `select extrinsicHash, extrinsicID, transferIndex, xcmIndex, paraID, paraIDDest, sourceTS, CONVERT(xcmInfo using utf8) as xcmInfo, priceUSD, amountSentUSD, amountReceivedUSD, symbol, UNIX_TIMESTAMP(xcmInfolastUpdateDT) as lastUpdateTS from xcmtransfer where sourceTS >= UNIX_TIMESTAMP(DATE("${logDT}")) and sourceTS < UNIX_TIMESTAMP(DATE_ADD("${logDT}", INTERVAL 1 DAY)) and relayChain = '${relayChain}' and incomplete = 0 order by sourceTS;`

        let xcmtransferRecs = await this.poolREADONLY.query(sql)
        let tbl = "xcmtransfers";
        // 2. setup directories for tbls on date
        let dir = "/tmp";
        let fn = path.join(dir, `${tbl}.json`)
        let f = fs.openSync(fn, 'w', 0o666);
        let bqDataset = relayChain
        let logDTp = logDT.replaceAll("-", "")

        // 3. map into canonical form
        let xcmtransfers = xcmtransferRecs.map((r) => {
            let xcmInfo = null
            let teleportFeeUSD = null
            try {
                xcmInfo = JSON.parse(r.xcmInfo)
                if (xcmInfo.destination != undefined && xcmInfo.destination.teleportFeeUSD != undefined) {
                    if (xcmInfo.destination.teleportFeeUSD > 0 && xcmInfo.destination.teleportFeeUSD < this.irregularFeeUSDThreshold) teleportFeeUSD = xcmInfo.destination.teleportFeeUSD
                }
            } catch (e) {
                xcmInfo = null
                teleportFeeUSD = null
            }
            return {
                extrinsic_hash: r.extrinsicHash,
                extrinsic_id: r.extrinsicID,
                transfer_index: r.transferIndex,
                xcm_index: r.xcmIndex,
                block_time: r.sourceTS,
                para_id: r.paraID,
                para_id_dest: r.paraIDDest,
                symbol: r.symbol,
                price_usd: r.priceUSD,
                amount_sent_usd: r.amountSentUSD,
                amount_received_usd: r.amountReceivedUSD,
                teleport_fee_usd: teleportFeeUSD,
                xcm_info: xcmInfo,
                xcm_info_last_update_time: r.lastUpdateTS
            }
        });
        let NL = "\r\n";
        xcmtransfers.forEach((e) => {
            fs.writeSync(f, JSON.stringify(e) + NL);
        });
        // 4. load into bq
        let cmd = `bq load --project_id=substrate-etl --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}$${logDTp}' ${fn} schema/substrateetl/${tbl}.json`;
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
        let tbls = ["blocks", "extrinsics", "events", "transfers", "logs", "specversions"]
        let dump_traces = false;
        if (this.daysago(logDT) < 31) {
            tbls.push("traces");
            dump_traces = true;
            console.log("DUMP_TRACES TRUE");
        }

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
                let traces = trace ? trace.map((t) => {
                    block.trace_count++;
                    return {
                        trace_id: t.traceID,
                        block_time: block.block_time,
                        block_number: block.number,
                        block_hash: block.hash,
                        section: t.p,
                        storage: t.s,
                        k: t.k,
                        v: t.v,
                        pk_extra: t.pkExtra ? t.pkExtra : null,
                        pv: t.pv ? t.pv : null
                    }
                }) : [];
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
                //console.log("traces", traces);
                if (block.trace_count > 0 && dump_traces) {
                    traces.forEach((t) => {
                        fs.writeSync(f["traces"], JSON.stringify(t) + NL);
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
        specversions.forEach((s) => {
            fs.writeSync(f["specversions"], JSON.stringify(s) + NL);
        })

        // 5. write to bq
        try {
            for (const tbl of tbls) {
                fs.closeSync(f[tbl]);
                let logDTp = logDT.replaceAll("-", "")
                let cmd = `bq load  --project_id=substrate-etl --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}$${logDTp}' ${fn[tbl]} schema/substrateetl/${tbl}.json`;
                if (tbl == "specversions") {
                    cmd = `bq load  --project_id=substrate-etl --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}${paraID}' ${fn[tbl]} schema/substrateetl/${tbl}.json`;
                }
                console.log(cmd);
                await exec(cmd);
            }
            let sql = `insert into substrateetllog (logDT, chainID, bnStart, bnEnd, numBlocks, loadDT, loaded, attempted, audited) values ('${logDT}', '${chainID}', '${bnStart}', '${bnEnd}', '${block_count}', Now(), 1, 1, 'Unknown') on duplicate key update loadDT = values(loadDT), bnStart = values(bnStart), bnEnd = values(bnEnd), numBlocks = values(numBlocks), loaded = values(loaded), attempted = attempted + values(attempted), audited = values(audited)`
            console.log(sql);
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        } catch (e) {
            console.log(e);
        }

    }
}