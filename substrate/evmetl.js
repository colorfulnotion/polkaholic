const PolkaholicDB = require("./polkaholicDB");
const ethTool = require("./ethTool");
const mysql = require("mysql2");
var SqlString = require('sqlstring');
const util = require('util');
// Uses Ankr API to crawl blocks for ETH style chains to store blocks and txs in the BASEDIR
const exec = util.promisify(require('child_process').exec);

const ethTool = require("./ethTool");

// Function: mint(address poolToken,uint256 amount,address to,uint256 deadline)
// MethodID: 0x3c173a4f
// [0]:  000000000000000000000000e69c2c761931c4bf719cf5931af37c6a09889d06
// [1]:  0000000000000000000000000000000000000000000000022b1c311f1725b308
// [2]:  000000000000000000000000b554b9856dfdbf52b98e0e4d2b981c34e20e1dab
// [3]:  00000000000000000000000000000000000000000000000000000000617c5b7d
const Web3 = require('web3')
const web3 = new Web3();

function generateMethodOutput(methodString) {
    var methodInputs = [];
    var arr = methodString.split(",");
    arr.forEach(function(item) {
        var arr = item.trim().split(" ");
        methodInputs.push({
            type: arr[0],
            name: arr[1]
        });
    });
    return methodInputs
}

function parseTxnByFuncInput(rawMethodString, rawTxHex) {
    var methodString = rawMethodString.match(/\((.*)\)/).pop();
    var methodInputs = generateMethodOutput(methodString);
    var txHex = rawTxHex.substring(10);
    var res = web3.eth.abi.decodeParameters(methodInputs, txHex);
    var jsonStr = JSON.stringify(res);
    return jsonStr
}

function parseTxnByAbi(abiStr, rawTxHex) {
    var contractABI = JSON.parse(abiStr)
    const abiDecoder = require('abi-decoder');
    abiDecoder.addABI(contractABI);
    const decodedData = abiDecoder.decodeMethod(rawTxHex);
    return decodedData
}

//mint(address poolToken, uint256 amount, address to, uint256 deadline)
function parseMethodSigniture(abiStr) {
    var contractABI = JSON.parse(abiStr)
    //console.log(`${contractABI}`);

    // Concatenate function name with its param types
    const prepareData = e => `${e.name}(${e.inputs.map(e => e.type)})`

    // Concatenate function name with its param types + inputName
    const prepareData2 = e => `${e.name}(${e.inputs.map(e =>(e.type + " "+ e.name))})`


    // Encode function selector (assume web3 is globally available)
    const encodeSelector = f => web3.utils.sha3(f).slice(0, 10)

    // Parse ABI and encode its functions
    //var output = contractABI.filter(e => e.type === "function").flatMap(e => `${encodeSelector(prepareData(e))}|${prepareData2(e)}`)
    var output = contractABI.filter(e => e.type === "function")
    var output2 = []
    output.forEach(function(e) {
        var methodID = encodeSelector(prepareData(e))
        var sigature = prepareData2(e)
        output2.push({
            methodID: methodID,
            signature: sigature,
            abi: [e]
        })
    });
    //var jsonStr = JSON.stringify(output2);
    //console.log(`${jsonStr}`);
    return output2
}

function shexdec(inp) {
    return parseInt(inp.replace("0x", ""), 16);
}

function dechex(number) {
    return parseInt(number, 10).toString(16)
}

module.exports = class EVMETL extends PolkaholicDB {
    methodMap = {};

    async getStorageAt(storageSlot, address, chainID = 1) {
        console.log("getStorageAt", storageSlot, address, chainID);
        const ethers = require('ethers');
        let chain = await this.getChain(chainID);
        const contract = new ethers.Contract(address, [], new ethers.providers.JsonRpcProvider(chain.RPCBackfill));
        let storageValue = await contract.provider.getStorageAt(address, storageSlot);
        return {
            address,
            storageSlot,
            storageValue
        }
    }

    async crawlABI(address, chainID = 1, project = null, contractName = null) {
        let chain = await this.getChain(chainID);
        let cmd = `curl -k -s -X GET '${chain.etherscanAPIURL}/api?module=contract&action=getabi&address=${address}&apikey=${this.EXTERNAL_APIKEYS[chain.id]}'`;
        if (cmd == null) {
            console.log("No api available for chainID", chainID);
            return (false);
        }
        const {
            stdout,
            stderr
        } = await exec(cmd, {
            maxBuffer: 1024 * 64000
        });
        var j = JSON.parse(stdout);
        console.log(j);
        let assetType = 'Contract';
        let abiRaw = j.result;
        if (abiRaw.length > 3 && abiRaw.substr(0, 3) == "Con") {
            abiRaw = null;
        } else {
            var contractABI = JSON.parse(abiRaw);
            const prepareData = (e) => `${e.name}(${e.inputs.map((e) => e.type)})`;
            const prepareData2 = (e) => `${e.name}(${e.inputs.map((e) => e.type + " " + e.name)})`;
            const encodeSelector = (f) => web3.utils.sha3(f).slice(0, 10);
            let methodsig = contractABI
                .filter((e) => e.type === "function")
                .flatMap(
                    (e) => `${encodeSelector(prepareData(e))}|${prepareData2(e)}`
                );
            // TODO: use the methodsig to categorize the assetType (ERC20/721/.. vs Router/ERC20LP)
        }
        let flds = [];
        let vals = ["assetType"];
        let replace = ["assetType"];
        let fldstr = "";
        if (project) {
            vals.push('project');
            flds.push(`${mysql.escape(project)}`);
            replace.push("project");
        }
        if (contractName) {
            vals.push('contractName');
            flds.push(`${mysql.escape(contractName)}`);
            replace.push("contractName");
        }
        if (abiRaw) {
            let abi = JSON.parse(j.result);
            let proxyAddress = null;
            if (proxyAddress = await this.get_proxy_address(address, chainID)) {
                let proxyABI = await this.crawlABI(proxyAddress, chainID, project, contractName);
                if (proxyABI) {
                    console.log("proxyABI", proxyABI);
                    j = proxyABI;
                    vals.push('proxyAddress');
                    flds.push(`${mysql.escape(proxyAddress)}`);
                    replace.push("proxyAddress");

                    vals.push('proxyAddressLastUpdateDT');
                    flds.push(`Now()`);
                    replace.push("proxyAddressLastUpdateDT");
                }
            }

            vals.push('abiRaw');
            flds.push(`${mysql.escape(JSON.stringify(j))}`);
            replace.push("abiRaw");

            await this.loadABI(j.result)
        }
        if (flds.length > 0) {
            fldstr = "," + flds.join(",");
        }
        let data = `('${chainID}', '${address.toLowerCase()}', '${assetType}' ${fldstr})`
        await this.upsertSQL({
            "table": "asset",
            "keys": ["chainID", "asset"],
            "vals": vals,
            "data": [data],
            "replace": replace
        }, true);
        return j;
    }

    get_address_from_storage_value(storageVal) {
        return storageVal.length < 40 ? storageVal : "0x" + storageVal.slice(-40);
    }

    async get_proxy_address(address, chainID) {
        // https://eips.ethereum.org/EIPS/eip-1967
        let logic = await this.getStorageAt("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", address, chainID);
        let beacon = await this.getStorageAt("0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50", address, chainID);
        if (logic.storageValue != "0x0000000000000000000000000000000000000000000000000000000000000000") {
            return this.get_address_from_storage_value(logic.storageValue);
        }
        if (beacon.storageValue != "0x0000000000000000000000000000000000000000000000000000000000000000") {
            return this.get_address_from_storage_value(logic.storageValue);
        }
        return (false);
    }

    async getTokenInfo(address = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", chainID = 1) {
        const util = require("util");
        const exec = util.promisify(require("child_process").exec);
        let cmd = `curl -k -s -X GET '${chain.etherscanAPIURL}/api?module=token&action=tokeninfo&contractaddress=${address}&apikey=${this.EXTERNAL_APIKEYS[chain.id]}'`;
        const {
            stdout,
            stderr
        } = await exec(cmd);
        if (stderr) {
            console.log("ERR!!" + stderr);
        }
        var j = JSON.parse(stdout);
        if (j.status == 0) {
            console.log(j.result);
            if (j.result == "Token info not found") {
                return true;
            } else if (j.result == "Maximum rate limit reached") {
                return false;
            }
        } else if (j.result && j.result.length > 0) {
            try {
                var [r] = j.result;
                var sql = `insert into asset ( asset, chainID, assetType, assetName )`;
                // TODO:
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    //mint(address poolToken, uint256 amount, address to, uint256 deadline)
    async computeMethods() {
        var [contracts, _] = await this.poolREADONLY.query("SELECT abiRaw from address where abiRaw is Not Null and abiRaw != 'Contract source code not verified' and length(abiRaw) > 20 limit 5000");
        var sigs = {};
        var numContractsTally = {};
        for (const c of contracts) {
            var contractABIStr = c.abiRaw
            var output = ethTool.parseAbiSignature(contractABIStr)
            output.forEach(function(e) {
                var fingerprintID = e.fingerprintID
                if (!sigs[fingerprintID]) {
                    sigs[fingerprintID] = e;
                    numContractsTally[fingerprintID] = 1;
                } else {
                    numContractsTally[fingerprintID]++;
                }
            });
        }
        let abiRows = [];
        for (const fingerprintID of Object.keys(sigs)) {
            let data = sigs[fingerprintID];
            let numContracts = numContractsTally[fingerprintID];
            //fingerprintID, signatureID, signatureRaw, signature, name, abi ,abiType, numContracts, topicLength
            let row = `('${data.fingerprintID}', '${data.signatureID}', '${data.signatureRaw}', '${data.signature}', '${data.name}', '${data.abi}', '${data.abiType}', '${numContracts}', '${data.topicLength}', '1')`
            abiRows.push(row);
        }
        console.log(abiRows.length + " records");
        await this.dump_contract_abis(abiRows)
        await this.update_batchedSQL(true);
    }

    async abiAnalytics() {
        let sql = `select CONVERT(abi using utf8) as abi from contractabi`
        var res = await this.poolREADONLY.query(sql);
        let e_typeCnt = {};
        let f_typeCnt = {};
        for (const r of res) {
            let abi = JSON.parse(r.abi);
            for (const a of abi) {
                if (a.type == "event") {
                    for (const i of a.inputs) {
                        if (e_typeCnt[i.type] == undefined) {
                            e_typeCnt[i.type] = 0;
                        }
                        e_typeCnt[i.type]++;
                    }
                } else if (a.type == "function") {
                    for (const i of a.inputs) {
                        if (f_typeCnt[i.type] == undefined) {
                            f_typeCnt[i.type] = 0;
                        }
                        f_typeCnt[i.type]++;
                    }
                }
            }
        }
        console.log("events - signature types", e_typeCnt);
        console.log("function - signature types", f_typeCnt);
    }

    async abiAnalytics() {
        let sql = `select CONVERT(abi using utf8) as abi from contractabi`
        var res = await this.poolREADONLY.query(sql);
        let e_typeCnt = {};
        let f_typeCnt = {};
        for (const r of res) {
            let abi = JSON.parse(r.abi);
            for (const a of abi) {
                if (a.type == "event") {
                    for (const i of a.inputs) {
                        if (e_typeCnt[i.type] == undefined) {
                            e_typeCnt[i.type] = 0;
                        }
                        e_typeCnt[i.type]++;
                    }
                } else if (a.type == "function") {
                    for (const i of a.inputs) {
                        if (f_typeCnt[i.type] == undefined) {
                            f_typeCnt[i.type] = 0;
                        }
                        f_typeCnt[i.type]++;
                    }
                }
            }
        }
        console.log("events - signature types", e_typeCnt);
        console.log("function - signature types", f_typeCnt);
    }

    /*{
      fingerprint: 'transfer(address,uint256)',
      fingerprintID: '0xa9059cbb',
      signatureID: '0xa9059cbb',
      topicLength: 0,
      signatureRaw: 'transfer(address,uint256)',
      signature: 'transfer(address dst, uint256 wad)',
      name: 'Transfer',
      abi: '[{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]',
      abiType: 'function'
    }
    ...
    {
      fingerprint: 'Transfer(index_topic_1 address,index_topic_2 address,uint256)',
      fingerprintID: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef-3-0xc3a8eb6d',
      signatureID: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      topicLength: 3,
      signatureRaw: 'Transfer(address,address,uint256)',
      signature: 'Transfer(index_topic_1 address src, index_topic_2 address dst, uint256 wad)',
      name: 'Transfer',
      abi: '[{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"}]',
      abiType: 'event'
    }
    */
    async loadABI(contractABIStr) {
        var sigs = {};
        var numContractsTally = {};
        var output = ethTool.parseAbiSignature(contractABIStr)
        output.forEach(function(e) {
            var fingerprintID = e.fingerprintID
            if (!sigs[fingerprintID]) {
                sigs[fingerprintID] = e;
                numContractsTally[fingerprintID] = 1;
            } else {
                numContractsTally[fingerprintID]++;
            }
        });
        let abiRows = [];
        for (const fingerprintID of Object.keys(sigs)) {
            let data = sigs[fingerprintID];
            let numContracts = numContractsTally[fingerprintID];
            //fingerprintID, signatureID, signatureRaw, signature, name, abi ,abiType, numContracts, topicLength
            let row = `('${data.fingerprintID}', '${data.signatureID}', '${data.signatureRaw}', '${data.signature}', '${data.name}', '${data.abi}', '${data.abiType}', '${numContracts}', '${data.topicLength}', '1')`
            abiRows.push(row);
            console.log(`[${data.name}] ${row}`)
        }
        console.log(abiRows.length + " records");
        for (let i = 0; i < abiRows.length; i += 2000) {
            let j = i + 10000;
            if (j > abiRows.length) j = abiRows.length;
            let sql = "insert into contractabi (fingerprintID, signatureID, signatureRaw, signature, name, abi ,abiType, numContracts, topicLength, audited) values " + abiRows.slice(i, j).join(",") + " on duplicate key update name = values(name), signature = values(signature), signatureRaw = values(signatureRaw),signatureID = values(signatureID), abi = values(abi), abiType = values(abiType), numContracts = values(numContracts), topicLength = values(topicLength), audited = values(audited)";
            console.log(`sql`, sql)
            this.batchedSQL.push(sql)
        }
        console.log(`dump_contract_abi len=${abiRows.length}`);
        await this.update_batchedSQL(true);
    }

    // sets up evm chain tables
    async setup_chain_evm(chainID = null, isUpdate = false, execute = false) {
        let projectID = `${this.project}`
        let opType = (isUpdate) ? 'update' : 'mk'
        let relayChain = "evm"

        // setup paraID specific tables, including paraID=0 for the relay chain
        let tbls = ["blocks", "contracts", "logs", "token_transfers", "tokens", "traces", "transactions"]
        let p = (chainID != undefined) ? ` and chainID = ${chainID} ` : ""
        let sql = `select chainID, isEVM from chain where ( isEVM =1 or relayChain in ('ethereum', 'evm') ) ${p} order by chainID`
        let recs = await this.poolREADONLY.query(sql);
        console.log(`***** setup "chain" tables:${tbls} (chainID=${chainID}) ******`)
        for (const rec of recs) {
            let chainID = parseInt(rec.chainID, 10);
            let evmChainID = chainID;
            if (chainID == 2004 || chainID == 2002 || chainD == 2006 || chainID == 22023 || chainID == 22007) {
                switch (chainID) {
                    case 2000:
                        evmChainID = 787;
                        break;
                    case 2002:
                        evmChainID = 1024;
                        break;
                    case 2004:
                        evmChainID = 1284;
                        break;
                    case 2006:
                        evmChainID = 592;
                        break;
                    case 22000:
                        evmChainID = 686;
                        break;
                    case 22023:
                        evmChainID = 1285
                        break;
                    case 22007:
                        evmChainID = 336;
                }
            }
            let bqDataset = (this.isProd) ? `${relayChain}` : `${relayChain}_dev` //MK write to evm_dev for dev
            for (const tbl of tbls) {
                let fld = null;
                switch (tbl) {
                    case "blocks":
                        fld = "timestamp";
                        break;
                    case "token_transfers":
                    case "transactions":
                    case "traces":
                    case "contracts":
                    case "logs":
                    case "tokens":
                        fld = "block_timestamp";
                        break;
                }
                let p = fld ? `--time_partitioning_field ${fld} --time_partitioning_type DAY` : "";
                let cmd = `bq ${opType} --project_id=${projectID}  --schema=schema/substrateetl/evm/${tbl}.json ${p} --table ${bqDataset}.${tbl}${evmChainID}`
                try {
                    if (cmd) {
                        console.log(cmd);
                        if (execute) {
                            // await exec(cmd);
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
            throw new Error(`An error has occurred.`, sqlQuery);
        }
        return [];
    }

    async setupCallEvents() {
        const bigquery = new BigQuery({
            projectId: 'substrate-etl',
            keyFilename: this.BQ_SUBSTRATEETL_KEY
        });
        // read the set of call + event tables

        const datasetId = `evm_dev`; // `${id}` could be better, but we can drop the whole dataset quickly this way
        let tables = {};
        let tablesRecs = await this.execute_bqJob(`SELECT table_name, column_name, data_type FROM substrate-etl.${datasetId}.INFORMATION_SCHEMA.COLUMNS  where table_name like 'call_%'  or table_name like 'event%'`);
        for (const t of tablesRecs) {
            if (tables[t.table_name] == undefined) {
                tables[t.table_name] = {};
            }
            tables[t.table_name][t.column_name] = t.data_type;
            // TODO: get description for full ABI
        }

        let createTable = true;
        let sql = `select name, fingerprintID, CONVERT(signature using utf8) as signature, CONVERT(signatureRaw using utf8) as signatureRaw, CONVERT(abi using utf8) as abi from contractabi limit 100000;`
        var res = await this.poolREADONLY.query(sql);
        for (const r of res) {
            let abi = JSON.parse(r.abi);
            let fingerprintID = (a.type == "function") ? r.fingerprintID.substring(0, 10) : r.fingerprintID.substring(0, r.fingerprintID.length - 10).replaceAll("-", "_")
            let schema = ethTool.createEvmSchema(methodABIStr, fingerprintID)
            let sch = schema.schema
            let tableId = schema.tableId
            let timePartitioning = schema.timePartitioning
            /*
            let schema = {
                tableId: tableId,
                schema: sch,
                timePartitioning: {
                    type: 'HOUR',
                    field: timePartitionField
                },
            }
            */

            tables[tableId] = sch;
            if (createTable) {
                const [table] = await bigquery
                    .dataset(datasetId)
                    .createTable(tableId, {
                        schema: sch,
                        location: 'us-central1',
                        timePartitioning: timePartitioning,
                    });
            }

/*
            if (abi.length > 0) {
                let a = abi[0];
                const methodID = (a.type == "function") ? r.fingerprintID.substring(0, 10) : r.fingerprintID.substring(0, r.fingerprintID.length - 10).replaceAll("-", "_");
                const tablePrefix = (a.type == "function") ? "call" : "evt";
                if (tablePrefix == "call" && (a.stateMutability == "view" || a.stateMutability == "pure")) continue;

                const tableId = `${tablePrefix}_${a.name}_${methodID}`
                const inputs = a.inputs;
                //console.log(tableId, inputs); // .length, r.signature, r.signatureRaw, abi);
                if (tables[tableId] == undefined) {
                    const sch = [];
                    try {
                        let timePartitionField = null
                        sch.push({
                            "name": "chain_id",
                            "type": "string",
                            "mode": "REQUIRED"
                        });
                        sch.push({
                            "name": "evm_chain_id",
                            "type": "integer",
                            "mode": "REQUIRED"
                        });
                        sch.push({
                            "name": "contract_address",
                            "type": "string",
                            "mode": "REQUIRED"
                        });
                        let protected_flds = ["chain_id", "evm_chain_id", "contract_address", "_partition", "_table_", "_file_", "_row_timestamp_", "__root__", "_colidentifier"];
                        if (tablePrefix == "call") {
                            sch.push({
                                "name": "call_success",
                                "type": "boolean",
                                "mode": "REQUIRED"
                            });
                            sch.push({
                                "name": "call_tx_hash",
                                "type": "string",
                                "mode": "REQUIRED"
                            });
                            sch.push({
                                "name": "call_trace_address",
                                "type": "JSON",
                                "mode": "NULLABLE"
                            });
                            sch.push({
                                "name": "call_block_time",
                                "type": "timestamp",
                                "mode": "REQUIRED"
                            });
                            sch.push({
                                "name": "call_block_number",
                                "type": "integer",
                                "mode": "REQUIRED"
                            });
                            timePartitionField = "call_block_time";
                            protected_flds.push("call_success", "call_tx_hash", "call_trace_address", "call_block_time", "call_block_number")
                        } else {
                            sch.push({
                                "name": "evt_tx_hash",
                                "type": "string",
                                "mode": "REQUIRED"
                            });
                            sch.push({
                                "name": "evt_index",
                                "type": "INTEGER",
                                "mode": "NULLABLE"
                            });
                            sch.push({
                                "name": "evt_block_time",
                                "type": "timestamp",
                                "mode": "REQUIRED"
                            });
                            sch.push({
                                "name": "evt_block_number",
                                "type": "integer",
                                "mode": "REQUIRED"
                            });
                            timePartitionField = "evt_block_time";
                            protected_flds.push("evt_tx_hash", "evt_index", "evt_block_time", "evt_block_number");
                        }
                        let idx = 0;
                        for (const inp of inputs) {
                            switch (inp.internalType) {
                                case "IERC20":
                                case "ERC20":
                                case "IERC20Ext":
                                    // TODO: _symbol, _decimals, _price_usd, _float
                                    break;
                                case "IERC721":
                                case "IERC1155":
                                    // TODO: add
                                    break;
                            }
                            let description = JSON.stringify(inp);
                            // cap description
                            if (description.length >= 1024) description = description.substr(0, 1024);
                            // rename protected
                            let nm = inp.name && inp.name.length > 0 ? inp.name : `_unnamed${idx}`
                            if (protected_flds.includes(nm.toLowerCase())) {
                                console.log
                                nm = `renamed${nm}`;
                            }
                            sch.push({
                                "name": nm,
                                "type": ethTool.mapABITypeToBqType(inp.type),
                                "description": description,
                                "mode": "NULLABLE"
                            });
                            idx++;
                        }
                        tables[tableId] = sch;
                        if (createTable) {
                            const [table] = await bigquery
                                .dataset(datasetId)
                                .createTable(tableId, {
                                    schema: sch,
                                    location: 'us-central1',
                                    timePartitioning: {
                                        type: 'HOUR',
                                        field: timePartitionField
                                    },
                                });
                        }
                    } catch (err) {
                        console.log(err, sch);
                    }
                }
            }
*/
        }
    }
}
