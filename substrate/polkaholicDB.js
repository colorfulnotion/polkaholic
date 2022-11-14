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

const ini = require('node-ini');

const {
    Bigtable
} = require("@google-cloud/bigtable");
const stream = require("stream");
const util = require("util");
const paraTool = require("./paraTool.js");
const mysql = require("mysql2");
const bunyan = require('bunyan');
const fs = require('fs');
const os = require("os");

// Imports the Google Cloud client library for Bunyan
const {
    LoggingBunyan
} = require('@google-cloud/logging-bunyan');

module.exports = class PolkaholicDB {
    finished = util.promisify(stream.finished);
    exitOnDisconnect = false;
    // general purpose sql batches
    // Creates a Bunyan Cloud Logging client
    logger = false;
    hostname = false;
    batchedSQL = [];
    initChainInfos = false;
    commitHash = 'NA';
    specVersions = {};
    chainInfos = {};
    chainNames = {};
    paraIDs = [];
    paras = {};
    pool = false;

    numIndexingErrors = 0;
    reloadChainInfo = false; // if set to true after system properties brings in a new asset, we get one chance to do so.
    lastBatchTS = 0;
    connection = false;

    GC_PROJECT = "";
    GC_BIGTABLE_INSTANCE = "";
    GC_BIGTABLE_CLUSTER = "";
    GC_BIGQUERY_DATASET = "";
    GC_STORAGE_BUCKET = "";

    POLKAHOLIC_EMAIL_USER = "";
    POLKAHOLIC_EMAIL_PASSWORD = "";

    constructor(serviceName = "polkaholic") {

        // Creates a Bunyan Cloud Logging client
        const loggingBunyan = new LoggingBunyan();
        this.logger = bunyan.createLogger({
            // The JSON payload of the log as it appears in Cloud Logging
            // will contain "name": "my-service"
            name: serviceName,
            streams: [
                // Log to the console at 'debug' and above
                {
                    stream: process.stdout,
                    level: 'debug'
                },
                // And log to Cloud Logging, logging at 'info' and above
                loggingBunyan.stream('debug'),
            ],
        });

        this.hostname = os.hostname();
        this.commitHash = paraTool.commitHash()
        this.version = `1.0.0` // we will update this manually
        this.indexerInfo = `${this.version}-${this.commitHash.slice(0,7)}`
        console.log(`****  Initiating Polkaholic ${this.indexerInfo} ****`)

        // 1. ready db config for WRITABLE mysql pool [always in US presently] using env variable POLKAHOLIC_DB
        let dbconfigFilename = (process.env.POLKAHOLIC_DB != undefined) ? process.env.POLKAHOLIC_DB : '/root/.mysql/.db00.cnf';
        try {
            let dbconfig = ini.parseSync(dbconfigFilename);
            if (dbconfig.email != undefined) {
                this.POLKAHOLIC_EMAIL_USER = dbconfig.email.email;
                this.POLKAHOLIC_EMAIL_PASSWORD = dbconfig.email.password;
            }
            if (dbconfig.gc != undefined) {
                this.GC_PROJECT = dbconfig.gc.projectName;
                this.GC_BIGTABLE_INSTANCE = dbconfig.gc.bigtableInstance;
                this.GC_BIGTABLE_CLUSTER = dbconfig.gc.bigtableCluster;
                this.GC_STORAGE_BUCKET = dbconfig.gc.storageBucket;
                this.GC_BIGQUERY_DATASET = dbconfig.gc.bigqueryDataset;
            }
            this.pool = mysql.createPool(this.convert_dbconfig(dbconfig.client));
            // Ping WRITABLE database to check for common exception errors.
            this.pool.getConnection((err, connection) => {
                if (err) {
                    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                        console.error('Database connection was closed.')
                    }
                    if (err.code === 'ER_CON_COUNT_ERROR') {
                        console.error('Database has too many connections.')
                    }
                    if (err.code === 'ECONNREFUSED') {
                        console.error('Database connection was refused.')
                    }
                }

                if (connection) {
                    this.connection = connection;
                    connection.release()
                }
                return
            })
            // Promisify for Node.js async/await.
            this.pool.query = util.promisify(this.pool.query).bind(this.pool)
            this.pool.end = util.promisify(this.pool.end).bind(this.pool)
        } catch (err) {
            console.log(err);
            this.logger.fatal({
                "op": "dbconfig",
                err
            });
        }

        // 2. ready db config for READONLY mysql pool [default US replica but could be EU/AS replica] using env variable POLKAHOLIC_DB_REPLICA
        let dbconfigReplicaFilename = (process.env.POLKAHOLIC_DB_REPLICA != undefined) ? process.env.POLKAHOLIC_DB_REPLICA : '/root/.mysql/.db00-us-indexer.cnf';
        try {
            let dbconfigREADONLY = ini.parseSync(dbconfigReplicaFilename);
            this.poolREADONLY = mysql.createPool(this.convert_dbconfig(dbconfigREADONLY.client));
            // Ping READONLY database to check for common exception errors.
            this.poolREADONLY.getConnection((err, connection) => {
                if (err) {
                    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                        console.error('Database connection was closed.')
                    }
                    if (err.code === 'ER_CON_COUNT_ERROR') {
                        console.error('Database has too many connections.')
                    }
                    if (err.code === 'ECONNREFUSED') {
                        console.error('Database connection was refused.')
                    }
                }

                if (connection) {
                    this.connectionREADONLY = connection;
                    connection.release()
                }
                return
            })
            // Promisify for Node.js async/await.
            this.poolREADONLY.query = util.promisify(this.poolREADONLY.query).bind(this.poolREADONLY)
            this.poolREADONLY.end = util.promisify(this.poolREADONLY.end).bind(this.poolREADONLY)
        } catch (err) {
            console.log(err);
            this.logger.fatal({
                "op": "dbconfigReplica",
                err
            });
        }
        const bigtable = new Bigtable();
        const instanceName = this.GC_BIGTABLE_INSTANCE;
        const tableAddressExtrinsic = "addressextrinsic";
        const tableAccountRealtime = "accountrealtime";
        const tableAccountHistory = "accounthistory";
        const tableEVMTx = "evmtx";
        const tableHashes = "hashes";
        const tableAddress = "address";
        const tableAPIKeys = "apikeys";
        this.instance = bigtable.instance(instanceName);
        this.btAddressExtrinsic = this.instance.table(tableAddressExtrinsic);
        this.btHashes = this.instance.table(tableHashes);
        this.btEVMTx = this.instance.table(tableEVMTx);
        this.btAccountRealtime = this.instance.table(tableAccountRealtime);
        this.btAccountHistory = this.instance.table(tableAccountHistory);
        this.btAPIKeys = this.instance.table(tableAPIKeys);
    }


    getBQTable(tbl) {
        let projectName = this.GC_PROJECT
        let bigqueryDataset = this.GC_BIGQUERY_DATASET;
        return `\`${projectName}.${bigqueryDataset}.${tbl}\``;
    }

    convert_dbconfig(c) {
        return {
            host: c.host,
            user: c.user,
            password: c.password,
            database: c.database,
            charset: c['default-character-set']
        };
    }

    get_btTableRealtime() {

        return ["accountrealtime", this.btAccountRealtime];
    }
    get_btTableHistory() {
        return ["accounthistory", this.btAccountHistory];
    }

    async release(msDelay = 1000) {
        await this.pool.end();
        if (this.connection) {
            await this.connection.destroy();
            this.connection = false;
        }
        await this.sleep(msDelay);
    }

    cacheInit() {
        const Memcached = require("memcached-promise");
        this.memcached = new Memcached("127.0.0.1:11211", {
            maxExpiration: 2592000,
            namespace: "polkaholic",
            debug: false
        });
    }

    async cacheWrite(key, val) {
        if (!this.memcached) this.cacheInit();
        await this.memcached.set(key, val);
    }

    async cacheRead(key) {
        if (!this.memcached) this.cacheInit();
        return this.memcached.get(key)
    }

    async sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    async getBlockRangebyTS(chainID, startTS, endTS) {
        let sql = `select UNIX_TIMESTAMP(min(blockDT)) startTS, UNIX_TIMESTAMP(max(blockDT)) endTS, min(blockNumber) startBN, max(blockNumber) endBN from block${chainID} where blockDT > from_unixtime(${startTS}) and blockDT < from_unixtime(${endTS});`
        var res = await this.poolREADONLY.query(sql);
        if (res.length > 0) {
            let r = res[0]
            r.rangeLen = 1 + r.endBN - r.startBN
            r.chainID = chainID
            return r
        } else {
            return false
        }
    }

    async getKnownParachains() {
        let knownParaChainsMap = {}
        var knownParaChains = await this.poolREADONLY.query(`select chainID, id, chainName, relayChain, paraID from chain`);
        if (knownParaChains.length > 0) {
            for (const kp of knownParaChains) {
                let fullParaID = `${kp.relayChain}-${kp.paraID}`
                knownParaChainsMap[fullParaID] = kp
            }
        }
        return knownParaChainsMap
    }

    async getChainLiquidityPair(chainID) {
        var sql = `select asset, chainID from asset where chainID = ${chainID} and assetType = 'LiquidityPair'`
        var assets = await this.poolREADONLY.query(sql);
        return assets
    }

    getSpecVersionForBlockNumber(chainID, blockNumber) {
        if (!this.specVersions) return (0);
        if (!this.specVersions[chainID.toString()]) return (0);
        let sv = this.specVersions[chainID.toString()];
        for (let i = sv.length - 1; i >= 0; i--) {
            if (blockNumber >= sv[i].blockNumber) {
                return (sv[i].specVersion);
            }
        }
        return (0);
    }

    getChainDecimal(chainID) {
        if (chainID == undefined || chainID === null || chainID === false) {
            console.log("FAILED getChainDecimal", chainID);
            return false;
        }

        chainID = chainID.toString()
        if (this.chainInfos[chainID] != undefined) {
            return this.chainInfos[chainID].decimal
        } else {
            console.log("getChainDecimal FATAL ERROR: must call init", chainID)
        }
    }

    getChainSymbol(chainID) {
        if (typeof chainID !== "string") chainID = chainID.toString()
        if (chainID == undefined || chainID === null || chainID === false) {
            console.log("FAILED getChainSymbol", chainID);
            return false;
        }

        if (this.chainInfos[chainID] != undefined) {
            return this.chainInfos[chainID].symbol
        } else {
            console.log("getChainSymbol FATAL ERROR: must call init", chainID)
        }
    }

    getChainAsset(chainID) {
        chainID = chainID.toString()
        let assetChain = null
        if (this.chainInfos[chainID] != undefined && this.chainInfos[chainID].symbol != undefined) {
            let asset = JSON.stringify({
                "Token": this.chainInfos[chainID].symbol
            })
            assetChain = paraTool.makeAssetChain(asset, chainID);
            if (this.assetInfo[assetChain] != undefined) {
                return (asset);
            }
        }
        console.log(`[${chainID}] getChainAsset FATAL ERROR: must call init for ${assetChain}`, this.chainInfos[chainID])
        return null
    }

    getChainName(chainID) {
        chainID = chainID.toString()
        if (this.chainInfos[chainID] != undefined) {
            return this.chainInfos[chainID].name
        } else {
            console.log("getChainName FATAL ERROR: must call init", chainID)
            let relay = paraTool.getRelayChainByChainID(chainID)
            let paraID = paraTool.getParaIDfromChainID(chainID)
            let name = `${relay}[paraID:${paraID}]`
            return name
        }
    }

    getChainEVMStatus(chainID) {
        chainID = chainID.toString()
        if (this.chainInfos[chainID] != undefined) {
            return this.chainInfos[chainID].isEVM
        } else {
            console.log("getChainEVMStatus FATAL ERROR: must call init", chainID)
        }
    }

    getChainFullInfo(chainID) {
        chainID = chainID.toString()
        let chainInfo = this.chainInfos[chainID]
        if (chainInfo != undefined) {
            let r = {
                chainID: paraTool.dechexToInt(chainID),
                chainName: chainInfo.name,
                asset: chainInfo.asset,
                symbol: chainInfo.symbol,
                ss58Format: chainInfo.ss58Format,
                evmChainID: chainInfo.evmChainID,
                decimals: chainInfo.decimal,
                priceUSD: chainInfo.priceUSD,
                priceUSDPercentChange: paraTool.round(chainInfo.priceUSDPercentChange, 2),
                relayChain: chainInfo.relayChain,
            }
            //console.log("getChainFullInfo", chainInfo, r)
            return r
        } else {
            return {
                chainID: paraTool.dechexToInt(chainID),
                chainName: `chain${chainID}`,
                symbol: "NA",
                decimals: 12,
                priceUSD: 0,
                priceUSDPercentChange: 0,
                relayChain: "NA",
            }
        }
    }

    getRelayChainID(chainID) {
        if (chainID == paraTool.chainIDPolkadot || chainID == paraTool.chainIDKusama) {
            return (chainID);
        }
        if (this.chainInfos[chainID] == undefined) {
            console.log("1: could not determine relaychainID", chainID);
            return (false);
        }
        let relayChain = this.chainInfos[chainID].relayChain;
        if (relayChain == "kusama") return (paraTool.chainIDKusama);
        if (relayChain == "polkadot") return (paraTool.chainIDPolkadot);
        console.log("2: could not determine relaychainID", chainID);
        return (false);
    }

    async getParas() {
        let paras = await this.poolREADONLY.query(`select id, chainID, chainName, relayChain, paraID, concat(relayChain,'-',paraID) as fullparaID, symbol from chain order by relayChain desc, chainID;`);
        return (paras);
    }

    getParaInfo(paraID, sourceChainID) {
        sourceChainID = parseInt(sourceChainID, 10)
        let relayChainType = sourceChainID == paraTool.chainIDPolkadot ? "Polkadot" : "Kusama"
        let relayChainSymbol = sourceChainID == paraTool.chainIDPolkadot ? "DOT" : "KSM"
        let fullParaID = sourceChainID == paraTool.chainIDPolkadot ? `polkadot-${paraID}` : `kusama-${paraID}`

        let paraInfo = this.paras[fullParaID]
        if (paraInfo != undefined) {
            return {
                paraId: parseInt(paraID, 10),
                name: (paraInfo.chainName != undefined) ? paraInfo.chainName : paraInfo.id,
                relayChain: relayChainType,
                relayChainSymbol: relayChainSymbol
            }
        } else {
            return {
                paraId: parseInt(paraID, 10),
                name: null,
                relayChain: relayChainType,
                relayChainSymbol: relayChainSymbol
            }
        }
    }

    getNameByChainID(chainID) {
        if (this.chainInfos[chainID] != undefined) {
            // [chainID, id]
            let cID = parseInt(chainID, 10)
            return [cID, this.chainInfos[chainID].id]
        }
        return [false, false]
    }

    getIDByChainID(chainID) {
        if (this.chainInfos[chainID] != undefined) {
            // [chainID, id]
            let cID = parseInt(chainID, 10)
            return this.chainInfos[chainID].id
        }
        return false
    }

    getChainIDByName(id) {
        if (this.chainNames[id] != undefined) {
            // [chainID, id]
            return [this.chainNames[id].chainID, id]
        }
        return [false, false]
    }

    getTableChain(chainID) {
        return this.instance.table("chain" + chainID);
    }

    currentTS() {
        return Math.floor(new Date().getTime() / 1000);
    }

    async numConnections() {
        var sql = 'SELECT COUNT(*) nconn FROM information_schema.PROCESSLIST';
        var q = await this.pool.query(sql);
        if (q.length > 0) {
            let numConn = q[0].nconn;
            if (numConn > 1000) console.log("WARNING: numConnections: ", numConn, "SIZE", this.batchedSQL.length);
            if (numConn > 3000) {
                console.log("TERMINATING Too many connections", numConn);
                process.exit(1);
            }
            return (numConn);
        }
    }

    async update_batchedSQL(sqlMax = 1.50) {
        if (this.batchedSQL.length == 0) return;
        var currentTS = this.currentTS();

        this.lastBatchTS = currentTS;
        let retrySQL = [];
        for (var i = 0; i < this.batchedSQL.length; i++) {
            let sql = this.batchedSQL[i];
            try {
                let sqlStartTS = new Date().getTime();
                await this.pool.query(sql);
                let sqlTS = (new Date().getTime() - sqlStartTS) / 1000;
                if (sqlTS > sqlMax) {
                    this.logger.info({
                        "op": "SLOWSQL",
                        "sql": (sql.length > 4096) ? sql.substring(0, 4096) : sql,
                        "len": sql.length,
                        "sqlTS": sqlTS
                    });
                }
            } catch (err) {
                if (err.toString().includes("Deadlock found")) {
                    retrySQL.push(sql);
                } else {
                    this.logger.error({
                        "op": "update_batchedSQL",
                        "sql": (sql.length > 4096) ? sql.substring(0, 4096) : sql,
                        "len": sql.length,
                        "try": 1,
                        err
                    });
                    this.numIndexingErrors++;
                    let tsm = new Date().getTime();
                    let fn = "/var/log/update_batchedSQL/" + tsm + "-" + i + ".sql";
                    await fs.writeFileSync(fn, sql);
                }
            }
        }
        this.batchedSQL = [];
        if (retrySQL.length > 0) {
            for (var i = 0; i < retrySQL.length; i++) {
                let sql = retrySQL[i];
                try {
                    await this.pool.query(sql);
                } catch (err) {
                    if (err.toString().includes("Deadlock found")) {
                        this.batchedSQL.push(sql);
                    } else {
                        this.logger.error({
                            "op": "update_batchedSQL RETRY",
                            "sql": (sql.length > 4096) ? sql.substring(0, 4096) : sql,
                            "len": sql.length,
                            "try": 2,
                            err
                        });
                        this.numIndexingErrors++;
                        let tsm = new Date().getTime()
                        let fn = "/var/log/update_batchedSQL/" + tsm + "-" + i + ".sql";
                        await fs.writeFileSync(fn, sql);
                    }
                }
            }
        }
    }


    async upsertSQL(flds, debug = false, sqlMax = 1.50) {
        let tbl = flds.table;
        let keys = flds.keys;
        let vals = flds.vals;
        let data = flds.data;

        if (tbl == undefined || typeof tbl !== "string") return (false);
        if (keys == undefined || !Array.isArray(keys)) return (false);
        if (vals == undefined || !Array.isArray(vals)) return (false);
        if (data == undefined || !Array.isArray(data)) return (false);
        if (data.length == 0) return (false);

        let out = [];
        if (flds.replace !== undefined) {
            let farr = flds.replace;
            for (let i = 0; i < farr.length; i++) {
                let f = farr[i];
                out.push(`${f}=VALUES(${f})`);
            }
        }
        if (flds.replaceIfNull !== undefined) {
            let farr = flds.replaceIfNull;
            for (let i = 0; i < farr.length; i++) {
                let f = farr[i];
                out.push(`${f}=IF(${f} is null, VALUES(${f}), ${f})`);
            }
        }
        if (flds.lastUpdateBN !== undefined) {
            let farr = flds.lastUpdateBN;
            for (let i = 0; i < farr.length; i++) {
                let f = farr[i];
                out.push(`${f}=IF( lastUpdateBN <= values(lastUpdateBN), VALUES(${f}), ${f})`)
            }
        }
        let keysvals = keys.concat(vals);
        let fldstr = keysvals.join(",")
        let sql = `insert into ${tbl} (${fldstr}) VALUES ` + data.join(",");
        if (out.length > 0) {
            sql = sql + " on duplicate key update " + out.join(",")
        }
        this.batchedSQL.push(sql);
        if (debug) {
            console.log(sql);
        }
        await this.update_batchedSQL(sqlMax);
    }

    /*
    chainID: 0
    chainIDDest: 1000
    violationType: symbol
     parser: processV1ConcreteFungible
     caller: processOutgoingXcmPallet xcmPallet:limitedTeleportAssets
    errorcase: NULL
    instruction: {"id":{"concrete":{"parents":0,"interior":{"here":null}}},"fun":{"fungible":11000000000}}
    instructionHash: caad52bdc0938215c32c6778f2e1a1701e35ce397e72d1534cda9b09caa02c07
    sourceBlocknumber: 12224070
    sourceTS: 1664234238
    indexDT: 2022-09-27 21:50:39
    */
    async getXcmViolation(violationType = 'symbol') {
        let xcmViolations = await this.poolREADONLY.query(`select chainID, chainIDDest, violationType, parser, caller, errorcase, instruction, sourceBlocknumber, sourceTS, indexDT from xcmViolation where violationType='${violationType}' order by chainID`)
        let res = {}
        for (const v of xcmViolations) {
            let chainID = v.chainID
            if (res[chainID] == undefined) res[chainID] = []
            v.instruction = JSON.parse(`${v.instruction}`)
            res[chainID].push(v)
        }
        return res
    }


    async getChains(crawling = 1, orderBy = "valueTransfersUSD7d DESC") {
        let chains = await this.poolREADONLY.query(`select id, ss58Format as prefix, chain.chainID, chain.chainName, blocksCovered, blocksFinalized, chain.symbol, lastCrawlDT, lastFinalizedDT, unix_timestamp(lastCrawlDT) as lastCrawlTS,
unix_timestamp(lastFinalizedDT) as lastFinalizedTS,  iconUrl, numExtrinsics7d, numExtrinsics30d, numExtrinsics, numSignedExtrinsics7d, numSignedExtrinsics30d, numSignedExtrinsics, numTransfers7d, numTransfers30d, numTransfers, numEvents7d, numEvents30d, numEvents,
valueTransfersUSD7d, valueTransfersUSD30d, valueTransfersUSD, numTransactionsEVM, numTransactionsEVM7d, numTransactionsEVM30d, numAccountsActive, numAccountsActive7d, numAccountsActive30d, chain.relayChain, totalIssuance, lastUpdateChainAssetsTS,
onfinalityID, onfinalityStatus, isEVM, chain.asset, WSEndpoint, WSEndpoint2, WSEndpoint3, active, crawlingStatus, githubURL, substrateURL, parachainsURL, dappURL, xcmasset.priceUSD, xcmasset.priceUSDPercentChange, 0 as numHolders
from chain left join xcmasset on chain.symbol = xcmasset.symbol and chain.relayChain = xcmasset.relayChain where crawling = ${crawling} order by ${orderBy}`);
        return (chains);
    }

    async getChainsForAdmin(crawling = 1) {
        let chains = await this.poolREADONLY.query(`select id, ss58Format as prefix, chainID, chain.chainName, symbol, iconUrl, relayChain, onfinalityID, onfinalityStatus, isEVM, asset, WSEndpoint, WSEndpoint2, WSEndpoint3, paraID from chain where crawling = ${crawling} order by chainID`);
        return (chains);
    }

    async getChainForAdmin(chainID = 0) {
        let chains = await this.poolREADONLY.query(`select id, ss58Format as prefix, chainID, chain.chainName, symbol, iconUrl, relayChain, onfinalityID, onfinalityStatus, isEVM, asset, WSEndpoint, WSEndpoint2, WSEndpoint3, paraID from chain where chainID = ${chainID} order by chainID`);
        if (chains.length == 0) return (false);
        return (chains[0]);
    }

    async get_chains_external(crawling = 1) {
        let chains = await this.poolREADONLY.query(`select id, ss58Format as prefix, chain.chainID, CONCAT(UPPER(SUBSTRING(chain.chainName,1,1)),LOWER(SUBSTRING(chain.chainName,2))) AS chainName, chain.symbol, unix_timestamp(lastFinalizedDT) as lastFinalizedTS, iconUrl,
numExtrinsics7d, numExtrinsics30d, numExtrinsics, numSignedExtrinsics7d, numSignedExtrinsics30d, numSignedExtrinsics, numTransfers7d, numTransfers30d, numTransfers, numEvents7d, numEvents30d, numEvents, valueTransfersUSD7d, valueTransfersUSD30d, valueTransfersUSD,
numXCMTransferIncoming, numXCMTransferIncoming7d, numXCMTransferIncoming30d, numXCMTransferOutgoing, numXCMTransferOutgoing7d, numXCMTransferOutgoing30d, valXCMTransferIncomingUSD, valXCMTransferIncomingUSD7d, valXCMTransferIncomingUSD30d, valXCMTransferOutgoingUSD,
valXCMTransferOutgoingUSD7d, valXCMTransferOutgoingUSD30d, numTransactionsEVM, numTransactionsEVM7d, numTransactionsEVM30d, 0 as numHolders, numAccountsActive, numAccountsActive7d, numAccountsActive30d, chain.relayChain, totalIssuance, isEVM, blocksCovered, blocksFinalized,
crawlingStatus, githubURL, substrateURL, parachainsURL, dappURL, chain.asset, xcmasset.decimals, xcmasset.priceUSD, xcmasset.priceUSDPercentChange
from chain left join xcmasset on chain.symbol = xcmasset.symbol and chain.relayChain = xcmasset.relayChain where crawling = ${crawling} order by relayChain, id, chainID;`);
        return (chains);
    }

    async getChain(chainID, withSpecVersions = false) {
        var chains = await this.poolREADONLY.query(`select id, ss58Format as prefix, chainID, chainName, WSEndpoint, WSEndpointSelfHosted, WSEndpoint2, WSEndpoint3, WSBackfill, RPCBackfill, evmChainID, evmRPC, evmRPCInternal, blocksCovered, blocksFinalized, isEVM, backfillLookback, lastUpdateChainAssetsTS, onfinalityID, onfinalityStatus, numHolders, asset, relayChain, lastUpdateStorageKeysTS, crawlingStatus,
numExtrinsics, numExtrinsics7d, numExtrinsics30d,
numSignedExtrinsics, numSignedExtrinsics7d, numSignedExtrinsics30d,
numTransfers, numTransfers7d, numTransfers30d,
numEvents, numEvents7d, numEvents30d,
numTransactionsEVM, numTransactionsEVM7d, numTransactionsEVM30d,
numReceiptsEVM, numReceiptsEVM7d, numReceiptsEVM30d,
floor(gasUsed / (numEVMBlocks+1)) as gasUsed,
floor(gasUsed7d / (numEVMBlocks7d+1)) as gasUsed7d,
floor(gasUsed30d / (numEVMBlocks30d+1)) as gasUsed30d,
floor(gasLimit / (numEVMBlocks+1)) as gasLimit,
floor(gasLimit7d / (numEVMBlocks7d+1)) as gasLimit7d,
floor(gasLimit30d / (numEVMBlocks30d+1)) as gasLimit30d,
numXCMTransferIncoming, numXCMTransferIncoming7d, numXCMTransferIncoming30d,
numXCMTransferOutgoing, numXCMTransferOutgoing7d, numXCMTransferOutgoing30d,
valXCMTransferIncomingUSD, valXCMTransferIncomingUSD7d, valXCMTransferIncomingUSD30d,
valXCMTransferOutgoingUSD, valXCMTransferOutgoingUSD7d, valXCMTransferOutgoingUSD30d
from chain where chainID = '${chainID}' limit 1`);
        if (chains.length == 0) return (false);
        let chain = chains[0];
        if (withSpecVersions) {
            let specVersions = await this.poolREADONLY.query(`select specVersion, blockNumber, blockHash from specVersions where chainID = '${chainID}' and blockNumber > 0 order by specVersion`);
            chain.specVersions = specVersions;
        }
        // because some chains don't have subscribeStorage support (and subscribeStorage updates blocksCovered...)
        if (chain.blocksCovered == null || chain.blocksCovered < chain.blocksFinalized) {
            chain.blocksCovered = chain.blocksFinalized
        }
        if (chainID == paraTool.chainIDPolkadot || chainID == paraTool.chainIDKusama) {
            let paraIDs = await this.poolREADONLY.query(`select paraID from chainparachain where chainID = '${chainID}'`);
            for (let i = 0; i < paraIDs.length; i++) {
                let paraID = paraIDs[i].paraID;
                this.paraIDs.push(paraID);

            }
        }
        return chain;
    }
    async getChainWithVersion(chainID, withSpecVersions = false) {
        var chains = await this.poolREADONLY.query(`select id, ss58Format as prefix, chainID, chainName, WSEndpoint, WSEndpointSelfHosted, WSEndpoint2, WSEndpoint3, WSBackfill, RPCBackfill, evmChainID, evmRPC, evmRPCInternal, blocksCovered, blocksFinalized, isEVM, backfillLookback, lastUpdateChainAssetsTS, onfinalityID, onfinalityStatus, numHolders, asset, relayChain, lastUpdateStorageKeysTS, crawlingStatus,
numExtrinsics, numExtrinsics7d, numExtrinsics30d,
numSignedExtrinsics, numSignedExtrinsics7d, numSignedExtrinsics30d,
numTransfers, numTransfers7d, numTransfers30d,
numEvents, numEvents7d, numEvents30d,
numTransactionsEVM, numTransactionsEVM7d, numTransactionsEVM30d,
numReceiptsEVM, numReceiptsEVM7d, numReceiptsEVM30d,
floor(gasUsed / (numEVMBlocks+1)) as gasUsed,
floor(gasUsed7d / (numEVMBlocks7d+1)) as gasUsed7d,
floor(gasUsed30d / (numEVMBlocks30d+1)) as gasUsed30d,
floor(gasLimit / (numEVMBlocks+1)) as gasLimit,
floor(gasLimit7d / (numEVMBlocks7d+1)) as gasLimit7d,
floor(gasLimit30d / (numEVMBlocks30d+1)) as gasLimit30d,
numXCMTransferIncoming, numXCMTransferIncoming7d, numXCMTransferIncoming30d,
numXCMTransferOutgoing, numXCMTransferOutgoing7d, numXCMTransferOutgoing30d,
valXCMTransferIncomingUSD, valXCMTransferIncomingUSD7d, valXCMTransferIncomingUSD30d,
valXCMTransferOutgoingUSD, valXCMTransferOutgoingUSD7d, valXCMTransferOutgoingUSD30d
from chain where chainID = '${chainID}' limit 1`);
        if (chains.length == 0) return (false);
        let chain = chains[0];
        if (withSpecVersions) {
            let specVersions = await this.poolREADONLY.query(`select specVersion, blockNumber, blockHash from specVersions where chainID = '${chainID}' and blockNumber > 0 order by specVersion`);
            chain.specVersions = specVersions;
        }
        // because some chains don't have subscribeStorage support (and subscribeStorage updates blocksCovered...)
        if (chain.blocksCovered == null || chain.blocksCovered < chain.blocksFinalized) {
            chain.blocksCovered = chain.blocksFinalized
        }
        if (chainID == paraTool.chainIDPolkadot || chainID == paraTool.chainIDKusama) {
            let paraIDs = await this.poolREADONLY.query(`select paraID from chainparachain where chainID = '${chainID}'`);
            for (let i = 0; i < paraIDs.length; i++) {
                let paraID = paraIDs[i].paraID;
                this.paraIDs.push(paraID);

            }
        }
        return chain;
    }

    async getWeb3Api(chain, backfill = false) {
        if (this.web3Api) return (this.web3Api);

        const Web3 = require('web3')
        var rpcURL = false;
        if (chain.isEVM > 0) {
            if (chain.evmRPC) {
                rpcURL = chain.evmRPC;
                if (backfill && chain.evmRPCInternal && chain.evmRPCInternal.length > 0) {
                    rpcURL = chain.evmRPCInternal;
                    console.log("**** USING evmRPCInternal", rpcURL);
                }
            } else if (chain.RPCBackfill) {
                rpcURL = chain.RPCBackfill;
            }
            if (rpcURL) {
                var web3Api = new Web3(rpcURL)
                var bn = await web3Api.eth.getBlockNumber()
                console.log(`web3Api ${rpcURL} is ready currentBN=${bn}`)
                return web3Api
            }
        }
        return false
    }

    async getTestParseTraces(testGroup = 1) {
        let tests = await this.poolREADONLY.query(`select * from testParseTraces where testGroup = '${testGroup}' order by chainID`);
        return (tests);
    }

    async getContractABI() {
        let contractabis = await this.poolREADONLY.query(`select signatureID, signature, abi, abiType, topicLength from contractabi`);
        let abis = {}
        for (const abi of contractabis) {
            let signatureID = abi.signatureID
            let abiType = abi.abiType
            let topicLen = abi.topicLength
            let fingerprintID = (abiType == 'event') ? `${signatureID}-${topicLen}` : signatureID
            let jsonABI = JSON.parse(abi.abi.toString('utf8'))
            let r = {
                signatureID: signatureID,
                signature: abi.signature.toString('utf8'),
                abi: jsonABI,
                abiType: abiType,
                topicLength: topicLen
            }
            if (abis[fingerprintID] == undefined) {
                abis[fingerprintID] = r
            } else {
                // console.log(`fingerprint collision detected ${fingerprintID}`)
            }
        }
        return (abis);
    }

    async setupAPI(chain, backfill = false) {
        if (backfill) {
            chain.WSEndpoint = chain.WSBackfill
            console.log("API using backfill endpoint", chain.WSEndpoint);
        }
        if (!this.api) {
            this.api = await this.get_api(chain);
        }
        if (!this.web3Api) {
            this.web3Api = await this.getWeb3Api(chain, backfill);
            if (this.web3Api) {
                this.contractABIs = await this.getContractABI();
            }
        }
        this.chainID = chain.chainID;
        this.chainName = chain.chainName;
    }

    async get_chain_hostname_endpoint(chain, useWSBackfill) {
        if (useWSBackfill) {
            return chain.WSBackfill
        }
        let hostname = os.hostname();
        let endpoints = await this.poolREADONLY.query(`select endpoint from chainhostnameendpoint where chainID = '${chain.chainID}' and hostname = '${hostname}'`);
        if (endpoints.length > 0) {
            let endpoint = parseInt(endpoints[0].endpoint, 10);
            if (endpoint == 1 && (chain.WSEndpoint2 != null) && chain.WSEndpoint2.length > 0) {
                return (chain.WSEndpoint2)
            }
            if (endpoint == 2 && (chain.WSEndpoint3 != null) && chain.WSEndpoint3.length > 0) {
                return (chain.WSEndpoint3)
            }
        }
        return (chain.WSEndpoint);
    }

    async get_api(chain, useWSBackfill = false) {
        const chainID = chain.chainID;
        const {
            ApiPromise,
            WsProvider
        } = require("@polkadot/api");
        const {
            Metadata,
            TypeRegistry,
            StorageKey,
            decorateStorage
        } = require('@polkadot/types');
        let endpoint = await this.get_chain_hostname_endpoint(chain, useWSBackfill);
        const provider = new WsProvider(endpoint);
        provider.on('disconnected', () => {
            console.log('CHAIN API DISCONNECTED', chain.chainID);
            if (this.exitOnDisconnect) process.exit(1);
        });
        provider.on('connected', () => console.log('chain API connected', chain.chainID));
        provider.on('error', (error) => console.log('chain API error', chain.chainID));

        var api = false;
        // https://polkadot.js.org/docs/api/start/types.extend/
        // https://github.com/polkadot-js/apps/tree/master/packages/apps-config
        if (chainID == paraTool.chainIDSubsocial) {
            const typesDef = require("@subsocial/types");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.typesBundle.spec.subsocial.types
            });
        } else if (chainID == paraTool.chainIDSora) {
            const typesDef = require("@sora-substrate/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.types
            });
        } else if (chainID == paraTool.chainIDZeitgeist) {
            const typesDef = require("@zeitgeistpm/type-defs");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.index.types,
                rpc: typesDef.index.rpc
            });
        } else if (chainID == paraTool.chainIDCrustShadow) {
            const typesDef = require("@crustio/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typesDef.typesBundleForPolkadot,
                rpc: typesDef.typesBundleForPolkadot.spec.crust.rpc
            });
        } else if (chainID == paraTool.chainIDDarwiniaCrab) {
            const typesDef = require("@darwinia/types");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef
            });
        } else if (chainID == paraTool.chainIDPhala) {
            const typesDef = require("@phala/typedefs");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.typesChain.Khala
            });
        } else if (chainID == paraTool.chainIDLaminar) {
            const typesDef = require("@laminar/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.index.types,
                rpc: typesDef.index.rpc
            });
        } else if (chainID == paraTool.chainIDPontem) {
            const typesDef = require("pontem-types-bundle");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.pontemDefinitions.types,
                rpc: typesDef.pontemDefinitions.rpc
            });
        } else if (chainID == paraTool.chainIDUnique && false) {
            // https://github.com/UniqueNetwork/unique-types-js/tree/fe923e4112ec03f8c8c680cc043da69ef33efa27
            const typesDef = require("@unique-nft/unique-mainnet-types"); // problematic dependency
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef
            });
        } else if (chainID == paraTool.chainIDKintsugi) {
            const typesDef = require("@interlay/interbtc-types");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.default.types,
                rpc: typesDef.default.rpc
            });
            console.log(`You are connected to KINTSUGI chain ${chainID} endpoint=${endpoint} with types + rpc`);
        } else if (chainID == paraTool.chainIDKilt) {
            const typesDef = require("@kiltprotocol/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                types: typesDef.typeBundleForPolkadot.types
            });
            console.log(`You are connected to KILT chain ${chainID} endpoint=${endpoint} with types but not rpc`);
        } else if (false && (chainID == paraTool.chainIDAstar || chainID == paraTool.chainIDShiden || chainID == paraTool.chainIDShibuya)) {
            const options = require("@astar-network/astar-api");
            api = await ApiPromise.create(options({
                provider
            }));
            console.log(`You are connected to ASTAR/SHIDEN chain ${chainID} endpoint=${endpoint} with options`);
        } else if (chainID == paraTool.chainIDMoonbeam) {
            const typesBundlePre900 = require("moonbeam-types-bundle");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typesBundlePre900.typesBundlePre900,
                rpc: typesBundlePre900.typesBundlePre900.spec.moonbeam.rpc
            });
            console.log(`You are connected to MOONBEAM chain ${chainID} endpoint=${endpoint} with types + rpc`);
        } else if (chainID == paraTool.chainIDMoonriver) {
            const typesBundlePre900 = require("moonbeam-types-bundle");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typesBundlePre900.typesBundlePre900,
                rpc: typesBundlePre900.typesBundlePre900.spec.moonriver.rpc
            });
            console.log(`You are connected to MOONRIVER chain ${chainID} endpoint=${endpoint} with types + rpc`);
        } else if (chainID == paraTool.chainIDMoonbaseAlpha || chainID == paraTool.chainIDMoonbaseBeta) {
            const typesBundlePre900 = require("moonbeam-types-bundle");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typesBundlePre900.typesBundlePre900,
                rpc: typesBundlePre900.typesBundlePre900.spec.moonbase.rpc
            });
            console.log(`You are connected to MoonBase chain ${chainID} endpoint=${endpoint} with types + rpc`);
        } else if (chainID == paraTool.chainIDBifrostKSM || chainID == paraTool.chainIDBifrostDOT) {
            const typeDefs = require("@bifrost-finance/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typeDefs.typesBundleForPolkadot,
                rpc: typeDefs.typesBundleForPolkadot.spec.bifrost.rpc
            });
            console.log(`You are connected to BIFROST chain ${chainID} endpoint=${endpoint} with types + rpc`);
        } else if ((chainID == paraTool.chainIDParallel) || (chainID == paraTool.chainIDHeiko)) {
            const typeDefs = require("@parallel-finance/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typeDefs.typesBundleForPolkadot,
                rpc: typeDefs.typesBundleForPolkadot.spec.parallel.rpc
            });
            console.log(`You are connected to PARALLEL chain ${chainID} endpoint=${endpoint} with types + rpc`);
        } else if (chain.chainID == paraTool.chainIDAcala) {
            const typeDefs = require("@acala-network/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typeDefs.typesBundleForPolkadot,
                rpc: typeDefs.typesBundleForPolkadot.spec.acala.rpc,
                signedExtensions: typeDefs.signedExtensions
            });
            console.log(`You are connected to ACALA chain ${chainID} endpoint=${endpoint} with types + rpc + signedExt`);
        } else if (chain.chainID == paraTool.chainIDKarura) {
            const typeDefs = require("@acala-network/type-definitions");
            api = await ApiPromise.create({
                provider: provider,
                typesBundle: typeDefs.typesBundleForPolkadot,
                rpc: typeDefs.typesBundleForPolkadot.spec.karura.rpc,
                signedExtensions: typeDefs.signedExtensions
            });
            console.log(`You are connected to KARURA chain ${chainID} endpoint=${endpoint} with types + rpc + signedExt`);
        } else {
            api = await ApiPromise.create({
                provider: provider
            });
            console.log(`You are connected to chain ${chainID} endpoint=${endpoint}`);
        }

        api.on('disconnected', () => {
            console.log('CHAIN API DISCONNECTED', chain.chainID);
            if (this.exitOnDisconnect) process.exit(1);
        });
        api.on('connected', () => console.log('chain API connected', chain.chainID));
        api.on('error', (error) => console.log('chain API error', chain.chainID, error));
        return api;
    }

    async insertBTRows(tbl, rows, tableName = "") {
        if (rows.length == 0) return (true);
        try {
            await tbl.insert(rows);
            return (true);
        } catch (err) {
            let succ = true;
            for (let a = 0; a < rows.length; a++) {
                try {
                    let r = rows[a];
                    if (r.key !== undefined && r.key) {
                        await tbl.insert([r]);
                    }
                } catch (err) {
                    let tries = 0;
                    while (tries < 10) {
                        try {
                            tries++;
                            await tbl.insert([rows[a]]);
                            await this.sleep(100);
                        } catch (err) {
                            //console.log(err);
                        }
                    }
                    if (tries >= 10) {
                        this.log_indexing_warn(err, tableName, rows[a]);
                        succ = false;
                    }
                }
            }
            return (succ);
        }
    }
    build_block_from_row(row) {
        let rowData = row.data;
        let r = {
            block: false,
            blockHash: false,
            blockNumber: false,
            events: false,
            trace: false,
            autotrace: false,
            evmBlock: false,
            finalized: false,
            traceType: false,
            blockStats: false,
            feed: false
        }
        r.blockNumber = parseInt(row.id.substr(2), 16);
        // 0. get the finalized blockHash; however, any "raw" column is also finalized
        //console.log(`returned families`, Object.keys(rowData))
        if (rowData["finalized"]) {
            let columnFamily = rowData["finalized"];
            for (const h of Object.keys(columnFamily)) {
                r.blockHash = h;
                r.finalized = true;
                // TODO: check that its unique
            }
        }

        // 1. store extrinsics of the block in the address in feed
        if (rowData["blockraw"]) {
            let cell = (r.blockHash && rowData["blockraw"][r.blockHash]) ? rowData["blockraw"][r.blockHash][0] : false;
            let cellEvents = (r.blockHash && rowData["events"] && rowData["events"][r.blockHash]) ? rowData["events"][r.blockHash][0] : false;
            if (cell) {
                r.block = JSON.parse(cell.value);
                if (cellEvents) r.events = JSON.parse(cellEvents.value);
                r.blockHash = r.block.hash;
            } else {
                console.log("no finalized block", r.blockNumber);
            }
        }

        // 2. process deduped traceBlock
        if (rowData["trace"]) {
            let cell = (rowData["trace"]["raw"]) ? rowData["trace"]["raw"][0] : (r.blockHash && rowData["trace"][r.blockHash]) ? rowData["trace"][r.blockHash][0] : false;
            if (cell) {
                r.trace = JSON.parse(cell.value);
                let cellTS = cell.timestamp / 1000000;
                if (rowData["n"] && rowData["n"]["traceType"]) {
                    let traceTypeCell = rowData["n"]["traceType"][0];
                    switch (traceTypeCell.value) {
                        case "subscribeStorage":
                        case "state_traceBlock":
                            r.traceType = traceTypeCell.value;
                    }
                }
            }
        }
        if (rowData["autotrace"]) {
            let cell = (r.blockHash && rowData["autotrace"][r.blockHash]) ? rowData["autotrace"][r.blockHash][0] : false;
            if (cell) {
                r.autotrace = JSON.parse(cell.value);
            }
        }

        // 3. return feed
        if (rowData["feed"]) {
            let cell = (r.blockHash && rowData["feed"][r.blockHash]) ? rowData["feed"][r.blockHash][0] : false;
            if (cell) {
                r.feed = JSON.parse(cell.value);
            }
        }

        // 4. return blockrawevm
        if (rowData["blockrawevm"]) {
            let cell = (r.blockHash && rowData["blockrawevm"][r.blockHash]) ? rowData["blockrawevm"][r.blockHash][0] : false;
            if (cell) {
                r.evmBlock = JSON.parse(cell.value);
            }
        }

        // 5. return receiptsevm
        if (rowData["receiptsevm"]) {
            let cell = (r.blockHash && rowData["receiptsevm"][r.blockHash]) ? rowData["receiptsevm"][r.blockHash][0] : false;
            if (cell) {
                r.evmReceipts = JSON.parse(cell.value);
            }
        }

        // 5b. return traceevm
        if (rowData["traceevm"]) {
            let cell = (r.blockHash && rowData["traceevm"][r.blockHash]) ? rowData["traceevm"][r.blockHash][0] : false;
            if (cell) {
                r.evmTrace = JSON.parse(cell.value);
            }
        }

        // 6. return feedevm (evmFullBlock)
        if (rowData["feedevm"]) {
            let cell = (r.blockHash && rowData["feedevm"][r.blockHash]) ? rowData["feedevm"][r.blockHash][0] : false;
            if (cell) {
                r.evmFullBlock = JSON.parse(cell.value);
            }
        }

        return r;
    }

    build_feed_from_row(row, requestedBlockHash = false) {
        let rowData = row.data;
        let r = {
            blockHash: false,
            blockNumber: false,
            evmFullBlock: false,
            finalized: false,
            feed: false
        }
        r.blockNumber = parseInt(row.id.substr(2), 16);
        // 0. get the finalized blockHash; however, any "raw" column is also finalized
        //console.log(`returned families`, Object.keys(rowData))
        if (rowData["finalized"]) {
            let columnFamily = rowData["finalized"];
            for (const h of Object.keys(columnFamily)) {
                r.blockHash = h;
                r.finalized = true;
                // TODO: check that its unique
            }
        } else {
            let blockHashes = Object.keys(rowData["feed"])
            //console.log(`${r.blockNumber} hashes`, blockHashes)
            if (requestedBlockHash && rowData["feed"][requestedBlockHash]) {
                r.blockHash = requestedBlockHash;
            } else if (blockHashes.length > 0) {
                r.blockHash = blockHashes[0];
            }
        }

        // 1. return feed
        if (rowData["feed"]) {
            let cell = (r.blockHash && rowData["feed"][r.blockHash]) ? rowData["feed"][r.blockHash][0] : false;
            if (cell) {
                r.feed = JSON.parse(cell.value);
            }
        }

        // 2. return feedevm (evmFullBlock)
        if (rowData["feedevm"]) {
            let cell = (r.blockHash && rowData["feedevm"][r.blockHash]) ? rowData["feedevm"][r.blockHash][0] : false;
            if (cell) {
                r.evmFullBlock = JSON.parse(cell.value);
            }
        }
        return r;
    }

    async fetch_block(chainID, blockNumber, families = ["feed", "finalized"], feedOnly = false, blockHash = false) {
        const filter = {
            filter: [{
                family: families,
                cellLimit: 100
            }]
        };

        const tableChain = this.getTableChain(chainID);
        const [row] = await tableChain.row(paraTool.blockNumberToHex(blockNumber)).get(filter);
        return this.build_feed_from_row(row, blockHash)
    }

    async fetch_block_row(chain, blockNumber, families = ["blockraw", "trace", "events", "feed", "n", "finalized", "feed", "autotrace"], feedOnly = false, blockHash = false) {
        let chainID = chain.chainID;
        if (!feedOnly && chain.isEVM > 0) {
            // OPTIMIZATION: its wasteful to bring in all these columns if the user hasn't asked for them ... however finalized is generally required
            families.push("blockrawevm");
            families.push("receiptsevm");
            families.push("traceevm");
            families.push("feedevm");
            families.push("traceevm");
        }
        const filter = {
            filter: [{
                family: families,
                cellLimit: 100
            }]
        };


        const tableChain = this.getTableChain(chainID);
        const [row] = await tableChain.row(paraTool.blockNumberToHex(blockNumber)).get(filter);

        return this.build_block_from_row(row)
    }

    push_rows_related_keys(family, column, rows, key, c) {
        let ts = this.getCurrentTS();
        let colData = {}
        colData[`${column}`] = {
            value: JSON.stringify(c),
            timestamp: ts * 1000000
        }
        let data = {}
        data[`${family}`] = colData
        let row = {
            key: key.toLowerCase(),
            data
        }
        //console.log("PUSH", row);
        rows.push(row);
    }

    getCurrentTS() {
        return Math.round(new Date().getTime() / 1000);
    }

    add_index_metadata(c) {
        c.source = this.hostname;
        c.genTS = this.getCurrentTS();
        c.commit = this.indexerInfo;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}