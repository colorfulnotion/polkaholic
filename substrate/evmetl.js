const PolkaholicDB = require("./polkaholicDB");
const mysql = require("mysql2");
var SqlString = require('sqlstring');
const util = require('util');
// Uses Ankr API to crawl blocks for ETH style chains to store blocks and txs in the BASEDIR
const exec = util.promisify(require('child_process').exec);

const ethTool = require("./ethTool");
const paraTool = require("./paraTool");
const path = require('path');
const Crawler = require("./crawler");

const fs = require('fs');
const fsPromises = require('fs').promises;
const readline = require('readline');
const glob = require('glob');

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

const STEP0_createRec = 0
const STEP1_cpblk = 1
const STEP2_backfill = 2
const STEP3_indexEvmChainFull = 3
const STEP4_loadGSEvmDecoded = 5

module.exports = class EVMETL extends PolkaholicDB {

    methodMap = {};
    evmLocalSchemaMap = {};
    evmSchemaMap = {}; //by tableId
    evmFingerprintMap = {}; //by fingerprintID
    evmDatasetID = "evm_dev"; /*** FOR DEVELOPMENT: change to evm_test ***/
    evmBQLocation = "us";
    evmProjectID = "substrate-etl"

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

    async loadLabels(chainID = 1, filePath = null) {
        var labelsData = JSON.parse(fs.readFileSync(filePath));
        let cnt = 0;
        let vals = ["contractName", "labels", "chainID", "createDT"];
        let out = [];
        for (var address of Object.keys(labelsData)) {
            if (address && address.length > 0) {
                let name_labels = labelsData[address];
                let name = name_labels.name ? name_labels.name : null;
                let labels = name_labels.labels ? name_labels.labels : null;
                address = address.toLowerCase();
                cnt++;
                if (name && name.length > 128) name = name.substring(0, 128);
                if (labels && JSON.stringify(labels) > 1024) labels = [labels[0]];
                out.push(`('${address}', ${mysql.escape(name)}, ${mysql.escape(JSON.stringify(labels))}, ${chainID}, Now() )`);
            }
        }
        await this.upsertSQL({
            "table": "abirepo",
            "keys": ["address"],
            "vals": vals,
            "data": out,
            "replace": vals
        }, true);
        process.exit(0);
    }

    /*
    rec {
      address: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
      chainID: 1,
      abiRaw: '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":true,"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"FeeAmountEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"}],"name":"createPool","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"enableFeeAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"feeAmountTickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"address","name":"factory","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}]',
      proxyAbiRaw: null,
      status: 'Found',
      etherscanContractName: 'UniswapV3Factory',
      contractName: 'UniswapV3Factory',
      projectName: 'uniswap',
      proxyAddress: null
    }
    */


    /*
    {
      "block_timestamp": "2023-04-26 04:50:11.000000 UTC",
      "block_number": "17128132",
      "transaction_hash": "0x7cd1db53cef1106a00fe33680b4e4be2eaef023feff0fd266bb65916cca77889",
      "log_index": "322",
      "contract_address": "0x1f98431c8ad98523631ae4a59f267346ea31f984",
      "token0": "0x66a0f676479cee1d7373f3dc2e2952778bff5bd6",
      "token1": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      "fee": "100",
      "tickSpacing": "1",
      "pool": "0xf9f912186861147dd00ec74720db648502bc1ccf"
    }
    */

    async generateProject(address, chainID = 1, project, contractName) {

        let chain = await this.getChain(chainID);
        //console.log(`chain`, chain)
        let evm_chain_name = (chain && chain.id && chain.isEVM) ? chain.id : false
        console.log(`evm_chain_name`, evm_chain_name)

        console.log(`generateProject chainID=${chainID}, address=${address}, project=${project}, contractName=${contractName}`)
        //TODO: abirepo should be chain specific?
        /*
        address -> table mapping aren't necessarily 1 to 1
        For example: we want to use 0xc36442b4a4522e871399cd717abdd847ab11fe88 -> to aggregate ALL uniswapV3 swap events. In this case we set the customContractName = 'UniswapV3Pool'

        */
        let sql = `select address, chainID, CONVERT(abiRaw USING utf8) abiRaw, CONVERT(proxyAbiRaw USING utf8) proxyAbiRaw, status, etherscanContractName, customContractName, contractName, projectName, proxyAddress, isAggregate, isAggregate, aggregateAddress from abirepo where address = '${address}' and chainID ='${chainID}' limit 1`
        console.log(`generateProject sql`, sql)
        let sqlRecs = await this.poolREADONLY.query(sql);
        let projectInfo = false
        if (sqlRecs.length == 1) {
            projectInfo = sqlRecs[0]
        } else {
            console.log(`chainID=${chainID}, address=${address}, project=${project}, contractName=${contractName} projectInfo NOT FOUND`)
            return false
        }
        console.log(`chainID=${chainID}, address=${address}, project=${project}, contractName=${contractName} projectInfo`, projectInfo)
        let projectContractName = projectInfo.address.toLowerCase() //If projectName is unknown everywhere, use contractAddress
        if (projectInfo.etherscanContractName) {
            // Contract parser by default fetch the etherscanContractName as contractName
            projectContractName = projectInfo.etherscanContractName
        }
        if (projectInfo.contractName) {
            // Overwrite with our contractName if specified
            projectContractName = projectInfo.contractName
        }
        if (projectInfo.customContractName) {
            // Overwrite with our customContractName if specified
            projectContractName = projectInfo.customContractName
            //TODO: need to link to other virtual table
        }

        var sigs = {};
        let contractABIStr = (projectInfo.proxyAbiRaw) ? projectInfo.proxyAbiRaw : projectInfo.abiRaw
        var output = ethTool.parseAbiSignature(contractABIStr)
        console.log(`output`, output)

        /* want two lists:
        Events: [] - list of events given the address
        Calls: [] - list of func given the address, excluding pure/view only func
        key: contractName_Type_name
        key2: type_modifiedFingerPrintID

        etl_ : external format
        dev_ : internal format


        */
        let eventMap = {}
        let callMap = {}
        for (const e of output) {
            var fingerprintID = e.fingerprintID
            let modifiedFingerprintID = ethTool.computeModifiedFingerprintID(fingerprintID)
            sigs[fingerprintID] = e;
            if (e.abiType == 'function' && e.stateMutability != 'view') {
                let k = `${projectContractName}_call_${e.name}`
                let devTabelId = ethTool.computeTableId(JSON.parse(e.abi), modifiedFingerprintID)
                //let devTabelId = ethTool.computeTableIDFromFingerprintIDAndName(fingerprintID, e.name)
                //let modifiedFingerprintID = ethTool.getFingerprintIDFromTableID(devTabelId)
                console.log(`devTabelId=${devTabelId}, modifiedFingerprintID=${modifiedFingerprintID}`)
                let devFlds = this.getSchemaFlds(modifiedFingerprintID)
                console.log(`${modifiedFingerprintID}, devFlds`, devFlds)
                e.etlTableId = k
                e.devTabelId = devTabelId
                e.modifiedFingerprintID = modifiedFingerprintID
                e.etlMeta = ["block_timestamp", "block_number", "transaction_hash", "transaction_index", "trace_address", "to_address", "status"]
                e.devMeta = ["call_block_time", "call_block_number", "call_tx_hash", "call_tx_index", "contract_address", "call_success"]
                e.etlExtra = ["error"]
                e.devExtra = ["chain_id", "evm_chain_id"]
                e.devFlds = devFlds
                e.etlFlds = e.flds
                delete e.flds
                if (callMap[k] == undefined) {
                    callMap[k] = e
                } else {
                    console.log(`WARNING k not unique! modifiedFingerprintID`, modifiedFingerprintID)
                    callMap[k] = e
                }

            } else if (e.abiType == 'event') {
                let k = `${projectContractName}_event_${e.name}`
                let devTabelId = ethTool.computeTableId(JSON.parse(e.abi), modifiedFingerprintID)
                //let devTabelId = ethTool.computeTableIDFromFingerprintIDAndName(fingerprintID, e.name)
                //let modifiedFingerprintID = ethTool.getFingerprintIDFromTableID(devTabelId)
                console.log(`devTabelId=${devTabelId}, modifiedFingerprintID=${modifiedFingerprintID}`)
                let devFlds = this.getSchemaFlds(modifiedFingerprintID)
                console.log(`${modifiedFingerprintID}, devFlds`, devFlds)
                e.etlTableId = k
                e.devTabelId = devTabelId
                e.modifiedFingerprintID = modifiedFingerprintID
                e.etlMeta = ["block_timestamp", "block_number", "transaction_hash", "log_index", "contract_address"]
                e.devMeta = ["evt_block_time", "evt_block_number", "evt_tx_hash", "evt_index", "contract_address"]
                e.etlExtra = []
                e.devExtra = ["chain_id", "evm_chain_id"]
                e.devFlds = devFlds
                e.etlFlds = e.flds
                delete e.flds
                if (eventMap[k] == undefined) {
                    eventMap[k] = e
                } else {
                    console.log(`WARNING k not unique! modifiedFingerprintID`, modifiedFingerprintID)
                    eventMap[k] = e
                }
            }
        }
        //console.log(`sigs`, sigs)
        console.log(`eventMap`, eventMap)
        console.log(`callMap`, callMap)
        console.log(`event table`, Object.keys(eventMap))
        console.log(`call tabel`, Object.keys(callMap))

        let datasetID = (evm_chain_name) ? `${evm_chain_name}_${projectInfo.projectName}` : `${projectInfo.projectName}`

        //TODO: create datasetID when missing
        await this.create_dataset(datasetID)
        let isAggregate = (projectInfo.isAggregate) ? true : false
        let targetContractAddress = (!isAggregate) ? projectInfo.address : null
        let viewCmds = []
        let historyTblCmds = []
        let externalViewCmds = []
        for (const eventKey of Object.keys(eventMap)) {
            let eventTableInfo = eventMap[eventKey]
            if (projectInfo.projectName) {
                let [viewCmd, externalViewCmd, historyTblCmd] = await this.createProjectContractViewAndHistory(eventTableInfo, targetContractAddress, isAggregate, datasetID)
                if (viewCmd) {
                    viewCmds.push(viewCmd)
                }
                if (externalViewCmd) {
                    externalViewCmds.push(externalViewCmd)
                }
                if (historyTblCmd) {
                    historyTblCmds.push(historyTblCmd)
                }
            }
        }

        for (const callKey of Object.keys(callMap)) {
            let callTableInfo = callMap[callKey]
            if (projectInfo.projectName) {
                let [viewCmd, externalViewCmd, historyTblCmd] = await this.createProjectContractViewAndHistory(callTableInfo, targetContractAddress, isAggregate, datasetID)
                if (viewCmd) {
                    viewCmds.push(viewCmd)
                }
                if (externalViewCmd) {
                    externalViewCmds.push(externalViewCmd)
                }
                if (historyTblCmd) {
                    historyTblCmds.push(historyTblCmd)
                }
            }
        }

        for (const cmd of viewCmds) {
            console.log(cmd);
            try {
                let res = await exec(cmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`res`, res)
            } catch (e) {
                console.log(`${e.toString()}`)
            }
        }

        for (const cmd of historyTblCmds) {
            console.log(cmd);
            try {
                let res = await exec(cmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`res`, res)
            } catch (e) {
                console.log(`${e.toString()}`)
            }
        }

        for (const cmd of externalViewCmds) {
            console.log(cmd);
            try {
                let res = await exec(cmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`res`, res)
            } catch (e) {
                console.log(`${e.toString()}`)
            }
        }
    }

    async createDatasetSchema(datasetId = 'evm_dev', projectID = 'substrate-etl') {
        let description = `Table Schema for the Dataset: ${datasetId}.\n\n'AAA' in 'AAA_tableschema' stands for 'All About Accessibility' - it is designed to appear as the first result in your search, ensuring easy access to crucial information such as {table_id, time_partitioning_field, table_cols, table_schema}. For a quick overview of the available tables/views within the ${datasetId} dataset, please query this view.`;
        let schemaTbl = `${datasetId}.AAA_tableschema`;
        let sql = `WITH schemaInfo AS (
            SELECT
              table_name AS table_id,
              MAX(IF(IS_PARTITIONING_COLUMN="YES", column_name, NULL)) AS time_partitioning_field,
              ARRAY_AGG(column_name) AS table_cols,
              "[" || STRING_AGG("{\\\"mode\\\": \\\"" || (CASE
                    WHEN is_nullable = "YES" THEN "NULLABLE"
                   ELSE
                  "REQUIRED"
                END
                  ) || "\\\", \\\"name\\\": \\\"" || column_name || "\\\", \\\"type\\\": \\\"" || data_type || "\\\"}", ",") || "]" AS table_schema
            FROM
              \`${projectID}.${datasetId}\`.INFORMATION_SCHEMA.COLUMNS
            WHERE table_name LIKE "%"
            GROUP BY
              table_id
            ORDER BY
              table_id)
            SELECT * from schemaInfo`;
        sql = paraTool.removeNewLine(sql)
        let cmd = `bq mk --quiet --project_id=${projectID} --use_legacy_sql=false --expiration 0  --description "${description}"  --view  '${sql}' ${schemaTbl}`;
        console.log(cmd);
        let {
            stdout,
            stderr
        } = await exec(cmd);
        console.log(stdout, stderr);
    }

    getTableIDFromFingerprintID(fingerprintID, to_address = null) {
        let tableID = null;
        let subTableIDInfo = null;
        let a = (to_address) ? to_address.toLowerCase() : '';
        if (this.evmFingerprintMap[fingerprintID] != undefined) {
            tableID = this.evmFingerprintMap[fingerprintID].tableId
            if (this.evmFingerprintMap[fingerprintID].addresses) {
                console.log(to_address, a);
                if (this.evmFingerprintMap[fingerprintID].addresses[a] != undefined) {
                    subTableIDInfo = this.evmFingerprintMap[fingerprintID].addresses[a];
                }
            }
        }
        return [tableID, subTableIDInfo];
    }

    getSchemaFlds(fingerprintID) {
        let flds = false
        if (this.evmFingerprintMap[fingerprintID] != undefined) {
            flds = this.evmFingerprintMap[fingerprintID].flds
        }
        return flds
    }

    async fetchSchema(tableId, evmDataset = 'evm_dev') {
        let modifiedFingerprintID = ethTool.getFingerprintIDFromTableID(tableId)
        let cmd = `bq show --project_id=substrate-etl --format=prettyjson ${evmDataset}.${tableId} | jq -c '[.schema.fields[] | {mode, name, type}]'`
        let {
            stdout,
            stderr
        } = await exec(cmd)
        let r = {
            tableId: tableId,
            modifiedFingerprintID: modifiedFingerprintID,
            tinySchema: stdout
        }
        return r
    }

    async updateEvmschema() {
        let localSQL = `select tableId, modifiedFingerprintID, CONVERT(tableSchema USING utf8) tableSchema, lastUpdateDT from evmschema where tableSchema is not null`;
        //let knownSchemas = await this.poolREADONLY.query(localSQL);
        let evmDataset = `evm_dev`
        let query = `select table_id as tableId, modified_fingerprint_id as modifiedFingerprintID, abi_type as abiType, table_schema as tableSchema FROM substrate-etl.${evmDataset}.evmschema order by tableId`
        let tablesRecs = await this.execute_bqJob(query);
        let tinySchemaMap = {}
        let newTableIds = []
        let newTableSchemas = []
        for (const r of tablesRecs) {
            newTableIds.push(r.tableId)
            newTableSchemas.push(r)
        }
        let i = 0;
        let n = 0
        let batchSize = 10; // safety check
        while (i < newTableSchemas.length) {
            let currBatchTableSchemas = newTableSchemas.slice(i, i + batchSize);
            console.log(`currBatchTableSchemas#${n}`, currBatchTableSchemas)
            if (currBatchTableSchemas.length > 0) {
                let output = []
                for (let j = 0; j < currBatchTableSchemas.length; j += 1) {
                    let v = currBatchTableSchemas[j]

                    let tableSchema = null
                    if (v.tableSchema) {
                        tableSchema = JSON.parse(v.tableSchema)
                        tableSchema = JSON.stringify(tableSchema)
                    }
                    console.log(`${v.tableId}`, tableSchema)
                    let tinySchema = `${mysql.escape(tableSchema)}`
                    let abiType = (v.abiType == "function" || v.abiType == "call") ? "function" : "event"
                    let row = `('${v.tableId}', '${v.modifiedFingerprintID}', ${tinySchema}, '${abiType}', '1', NOW())`
                    output.push(row)
                }
                if (output.length > 0) {
                    console.log(`output len=${output.length}`, output)
                    await this.upsertSQL({
                        "table": "evmschema",
                        "keys": ["tableId"],
                        "vals": ["modifiedFingerprintID", "tableSchema", "abiType", "created", "lastUpdateDT"],
                        "data": output,
                        "replaceIfNull": ["tableId", "tableSchema", "lastUpdateDT"], // once written, it should NOT get updated
                        "replace": ["created", "abiType"]
                    }, true);
                }
                i += batchSize;
                n++
            }
        }
        console.log(tinySchemaMap, tinySchemaMap)
        process.exit(0)
    }

    async initEvmSchemaMap() {
        let projectcontractabiRecs = await this.poolREADONLY.query(`select address, fingerprintID, name, projectName, abiType from projectcontractabi`);
        let projectcontractabi = {};
        for (const r of projectcontractabiRecs) {
            let subtableId = (r.abiType == "function") ? `call_project_${r.projectName}_${r.name}_${r.address}_${r.fingerprintID}` : `evt_project_${r.projectName}_${r.name}_${r.address}_${r.fingerprintID}`;
            if (projectcontractabi[r.fingerprintID] == undefined) {
                projectcontractabi[r.fingerprintID] = {};
            }
            projectcontractabi[r.fingerprintID][r.address] = {
                project: r.projectName,
                subtableId: subtableId,
                abiType: r.abiType,
                status: "Unknown"
            };
        }

        let evmDataset = this.evmDatasetID
        let query = `SELECT table_name, column_name, data_type, ordinal_position, if (table_name like "call_%", "call", "evt") as tbl_type FROM substrate-etl.${evmDataset}.INFORMATION_SCHEMA.COLUMNS  where table_name like 'call_%'  or table_name like 'evt_%' order by table_name, ordinal_position`
        let tablesRecs = await this.execute_bqJob(query);
        let callExtraCol = ["chain_id", "evm_chain_id", "contract_address", "call_success", "call_tx_hash", "call_tx_index", "call_trace_address", "call_block_time", "call_block_number"]
        let eventExtraCol = ["chain_id", "evm_chain_id", "contract_address", "evt_tx_hash", "evt_index", "evt_block_time", "evt_block_number"]

        let evmSchemaMap = {}
        let evmFingerprintMap = {}
        for (const t of tablesRecs) {
            let tblType = t.tbl_type
            let tableId = t.table_name
            let colName = t.column_name
            let ordinalIdx = t.ordinal_position - 1
            let fingerprintID = ethTool.getFingerprintIDFromTableID(tableId)
            if (evmSchemaMap[tableId] == undefined) {
                evmSchemaMap[tableId] = {};
            }
            if (evmFingerprintMap[fingerprintID] == undefined) {
                //evmFingerprintMap[fingerprintID] = tableId;
                evmFingerprintMap[fingerprintID] = {}
                evmFingerprintMap[fingerprintID].flds = []
                evmFingerprintMap[fingerprintID].tableId = tableId
                if (projectcontractabi[fingerprintID]) {
                    // when a first interaction happens with an address held in this map, we create another subtable for the project
                    evmFingerprintMap[fingerprintID].projectcontractabi = projectcontractabi[fingerprintID];
                }
            }
            if (tableId.includes("call_project_") || tableId.includes("evt_project_")) {
                let sa = tableId.split("_");
                let address = sa[4];
                if (evmFingerprintMap[fingerprintID].projectcontractabi[address].status == "Unknown") {
                    evmFingerprintMap[fingerprintID].projectcontractabi[address].status = "Created";
                }
            }
            if (tblType == 'call' && ordinalIdx >= callExtraCol.length) {
                evmFingerprintMap[fingerprintID].flds.push(colName)
            } else if (tblType == 'evt' && ordinalIdx >= eventExtraCol.length) {
                evmFingerprintMap[fingerprintID].flds.push(colName)
            }
            evmSchemaMap[tableId][colName] = t.data_type;
            // TODO: get description for full ABI
        }
        this.evmSchemaMap = evmSchemaMap
        this.evmFingerprintMap = evmFingerprintMap
        console.log(`evmSchemaMap ${Object.keys(evmSchemaMap).length}`)
        console.log(`evmFingerprintMap ${Object.keys(evmFingerprintMap).length}`)
        console.log(`initEvmSchemaMap DONE`)
    }

    /*
    {
        stateMutability: null,
        fingerprint: 'PoolCreated(index_topic_1 address,index_topic_2 address,index_topic_3 uint24,int24,address)',
        fingerprintID: '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118-4-0x4d1d4f92',
        secondaryID: '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118-4-0xe9cf7a91',
        signatureID: '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118',
        signatureRaw: 'PoolCreated(address,address,uint24,int24,address)',
        signature: 'PoolCreated(index_topic_1 address token0, index_topic_2 address token1, index_topic_3 uint24 fee, int24 tickSpacing, address pool)',
        name: 'PoolCreated',
        abi: '[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"}]',
        abiType: 'event',
        topicLength: 4,
        etlTableId: 'UniswapV3Factory_event_PoolCreated',
        devTabelId: 'evt_PoolCreated_0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118_4',
        modifiedFingerprintID: '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118-4',
        etlMeta: [
          'block_timestamp',
          'block_number',
          'transaction_hash',
          'log_index',
          'contract_address'
        ],
        devMeta: [
          'evt_block_time',
          'evt_block_number',
          'evt_tx_hash',
          'evt_index',
          'contract_address'
        ],
        etlExtra: [],
        devExtra: [ 'chain_id', 'evm_chain_id' ],
        devFlds: [ 'token0', 'token1', 'fee', 'tickSpacing', 'pool' ],
        etlFlds: [ 'token0', 'token1', 'fee', 'tickSpacing', 'pool' ]
    }
    */

    async createProjectContractViewAndHistory(tableInfo, contractAddress = "0x1f98431c8ad98523631ae4a59f267346ea31f984", isAggregate = false, datasetID = 'ethereum_uniswap') {
        const bigquery = this.get_big_query();
        let bqProjectID = `substrate-etl`
        let bqDataset = `${this.evmDatasetID}`
        //let bqDataset = `evm_dev`
        //need to create schema mapping and compute ordinal position

        let flds = []
        for (let i = 0; i < tableInfo.devExtra.length; i++) {
            flds.push(tableInfo.devExtra[i])
        }

        for (let i = 0; i < tableInfo.devMeta.length; i++) {
            let devM = tableInfo.devMeta[i]
            let etlM = tableInfo.etlMeta[i]
            let s = `${devM} as ${etlM}`
            flds.push(s)
        }

        if (!tableInfo.devFlds) {
            // we have not initiated the tableId yet use etl as schema definition
            tableInfo.devFlds = tableInfo.etlFlds

            //create dev table on miss
            let tableId = tableInfo.devTabelId
            let evmDatasetID = this.evmDatasetID
            let schema = ethTool.createEvmSchema(JSON.parse(tableInfo.abi), tableInfo.modifiedFingerprintID, tableId)
            let sch = schema.schema
            let timePartitioning = schema.timePartitioning
            console.log(`[${tableInfo.devTabelId}] sch`, sch)
            //tables[tableId] = sch;
            let isCeateTable = true
            if (isCeateTable) {
                console.log(`\n\nNew Schema for ${tableId}`)
                try {
                    const [table] = await bigquery
                        .dataset(evmDatasetID)
                        .createTable(tableId, {
                            schema: sch,
                            location: this.evmBQLocation,
                            timePartitioning: timePartitioning,
                        });
                } catch (err) {
                    let errorStr = err.toString()
                    if (!errorStr.includes('Already Exists')) {
                        console.log(`${evmDatasetID}:${tableId} Error`, errorStr)
                        this.logger.error({
                            op: "createProjectContractView:auto_evm_schema_create",
                            tableId: `${tableId}`,
                            error: errorStr,
                            schema: sch
                        })
                    }
                }
            } else {
                console.log(`*****\nNew Schema ${tableId}\n`, sch, `\n`)
            }

        }

        for (let i = 0; i < tableInfo.devFlds.length; i++) {
            let devF = tableInfo.devFlds[i]
            let etlF = tableInfo.etlFlds[i]
            let s = `${devF} as ${etlF}`
            flds.push(s)
        }

        let fldStr = flds.join(', ')
        let timePartitionField = (tableInfo.abiType == 'function') ? "call_block_time" : "evt_block_time"

        let condFilter = ''
        if (!isAggregate) {
            condFilter = `and Lower(contract_address) = "${contractAddress}"`
        }

        //let destinationTbl = `${bqDataset}.${tblName}$${logYYYYMMDD}`
        //TODO: replace only a partitioned day instead of the entire table

        //building view (past)
        let universalTimePartitionField = "block_timestamp" // project table use 'universalTimePartitionField', which is different than dune compatible style
        let destinationHistoryTbl = `${datasetID}.${tableInfo.etlTableId}_history`
        let subTblHistoryCore = `with dev as (SELECT * FROM \`${bqProjectID}.${bqDataset}.${tableInfo.devTabelId}\` WHERE DATE(${timePartitionField}) < current_date() ${condFilter})`
        let subTblHistory = `${subTblHistoryCore} select ${fldStr} from dev`
        subTblHistory = paraTool.removeNewLine(subTblHistory)
        let subTblHistoryCmd = `bq query --quiet --destination_table '${destinationHistoryTbl}' --project_id=${bqProjectID} --time_partitioning_field=${universalTimePartitionField} --replace  --use_legacy_sql=false '${paraTool.removeNewLine(subTblHistory)}'`;
        console.log(subTblHistoryCmd)

        //building view (currDay)
        let subCurrDayViewTbl = `${datasetID}.${tableInfo.etlTableId}`
        let subCurrDayViewCore = `with dev as (SELECT * FROM \`${bqProjectID}.${bqDataset}.${tableInfo.devTabelId}\` WHERE DATE(${timePartitionField}) = current_date() ${condFilter})`
        let subCurrDayView = `${subCurrDayViewCore} select ${fldStr} from dev`
        subCurrDayView = paraTool.removeNewLine(subCurrDayView)
        let subCurrDayViewCmd = `bq mk --quiet --project_id=${bqProjectID} --use_legacy_sql=false --expiration 0  --description "${datasetID} ${tableInfo.name} -- ${tableInfo.signature}"  --view  '${subCurrDayView}' ${subCurrDayViewTbl} `
        console.log(subCurrDayViewCmd)

        //build external view history + currDay
        let subExternalViewTbl = `${datasetID}.${tableInfo.etlTableId}_external`
        let subExternalView = `SELECT * FROM \`${bqProjectID}.${destinationHistoryTbl}\` WHERE DATE(block_timestamp) < current_date() UNION ALL SELECT * FROM \`${bqProjectID}.${subCurrDayViewTbl}\` WHERE DATE(block_timestamp) >= current_date()`
        let subExternalViewCmd = `bq mk --quiet --project_id=${bqProjectID} --use_legacy_sql=false --expiration 0  --description "${datasetID} ${tableInfo.name} -- ${tableInfo.signature}"  --view  '${subExternalView}' ${subExternalViewTbl} `
        console.log(subExternalViewCmd)

        return [subCurrDayViewCmd, subExternalViewCmd, subTblHistoryCmd]
    }


    async crawlABI(address, chainID = 1, project = null, contractName = null) {
        let chain = await this.getChain(chainID);
        /*
        console.log(`crawlABI cmd\n`, cmd)
        let cmd = `curl -k -s -X GET '${chain.etherscanAPIURL}/api?module=contract&action=getabi&address=${address}&apikey=${this.EXTERNAL_APIKEYS[chain.id]}'`;
        if (cmd == null) {
            console.log("No api available for chainID", chainID);
            return (false);
        }
        let res = await exec(cmd, {
            maxBuffer: 1024 * 64000
        });
        var j = JSON.parse(res.stdout);
        console.log(`getabi`, j);
        */

        //getsourcecode endpoint returns the contractName, along with with abi
        let cmd1 = `curl -k -s -X GET '${chain.etherscanAPIURL}/api?module=contract&action=getsourcecode&address=${address}&apikey=${this.EXTERNAL_APIKEYS[chain.id]}'`;
        // use getsourcecode only
        let res1 = await exec(cmd1, {
            maxBuffer: 1024 * 64000
        });
        var k = JSON.parse(res1.stdout);
        console.log(`[${address}] cmd1\n`, cmd1);
        console.log(`[${address}] getsourcecode`, k);
        /*
        {
            "status": "1",
            "message": "OK",
            "result": [
              {
                "SourceCode": "..."",
                "ABI": "[{\"constant\":false,\"inputs\":[{\"name\":\"newImplementation\",\"type\":\"address\"}],\"name\":\"upgradeTo\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"newImplementation\",\"type\":\"address\"},{\"name\":\"data\",\"type\":\"bytes\"}],\"name\":\"upgradeToAndCall\",\"outputs\":[],\"payable\":true,\"stateMutability\":\"payable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"implementation\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"newAdmin\",\"type\":\"address\"}],\"name\":\"changeAdmin\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"admin\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"name\":\"_implementation\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"payable\":true,\"stateMutability\":\"payable\",\"type\":\"fallback\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"name\":\"previousAdmin\",\"type\":\"address\"},{\"indexed\":false,\"name\":\"newAdmin\",\"type\":\"address\"}],\"name\":\"AdminChanged\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"name\":\"implementation\",\"type\":\"address\"}],\"name\":\"Upgraded\",\"type\":\"event\"}]",
                "ContractName": "FiatTokenProxy",
                "CompilerVersion": "v0.4.24+commit.e67f0147",
                "OptimizationUsed": "0",
                "Runs": "200",
                "ConstructorArguments": "0000000000000000000000000882477e7895bdc5cea7cb1552ed914ab157fe56",
                "EVMVersion": "Default",
                "Library": "",
                "LicenseType": "",
                "Proxy": "1",
                "Implementation": "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf",
                "SwarmSource": "bzzr://a4a547cfc7202c5acaaae74d428e988bc62ad5024eb0165532d3a8f91db4ed24"
              }
            ]
        }
        */
        let assetType = 'Contract';
        let abiRaw = null
        let etherscan_contractName = null
        let isProxy = false
        let proxyImplementation = false
        if (k.result && Array.isArray(k.result)) {
            let result = k.result[0]
            if (result.ContractName != "") {
                etherscan_contractName = result.ContractName
            }
            if (result.Proxy == "1") {
                isProxy = true
                proxyImplementation = result.Implementation
            }
            if (result.ABI != undefined && result.ABI.substr(0, 3) == "Contract source code not verified") {
                this.batchedSQL.push(`update abirepo set status = 'Unverified' where address = '${address}'`);
                await this.update_batchedSQL();
            } else {
                abiRaw = result.ABI
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
        }
        let flds = [];
        let vals = [];
        let replace = [];
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
        if (etherscan_contractName) {
            vals.push('etherscanContractName');
            flds.push(`${mysql.escape(etherscan_contractName)}`);
            replace.push("etherscanContractName");
        }
        if (abiRaw) {
            //must push to the front, since address is primary key
            flds = [`'${address}'`].concat(flds)

            vals.push('status');
            flds.push(`'Found'`);
            replace.push("status");

            vals.push('foundDT');
            flds.push(`Now()`);
            replace.push("foundDT");

            vals.push('chainID');
            flds.push(`'${chainID}'`);
            replace.push("chainID");

            vals.push('abiRaw');
            flds.push(`${mysql.escape(abiRaw)}`);
            replace.push("abiRaw");

            let proxyAddress = await this.get_proxy_address(address, chainID);
            if (proxyAddress || proxyImplementation) {
                console.log(`proxyAddress=${proxyAddress}, proxyImplementation=${proxyImplementation}`)
                if (!proxyAddress) proxyAddress = proxyImplementation
                if (proxyAddress != address) {
                    //0xc36442b4a4522e871399cd717abdd847ab11fe88 has implementation pointed to itself - thus creating nonstop loop..
                    let proxyABI = await this.crawlABI(proxyAddress, chainID, project, contractName);
                    if (proxyABI) {
                        console.log("proxyABI", proxyABI);
                        if (proxyABI) {
                            abiRaw = proxyABI
                            vals.push('proxyAddress');
                            flds.push(`${mysql.escape(proxyAddress)}`);
                            replace.push("proxyAddress");

                            vals.push('proxyAbiRaw');
                            flds.push(`${mysql.escape(proxyABI)}`);
                            replace.push("proxyAbiRaw");

                            vals.push('proxyAddressLastUpdateDT');
                            flds.push(`Now()`);
                            replace.push("proxyAddressLastUpdateDT");
                        }
                    }
                }
            }

            fldstr = flds.join(",");
            let data = `(${fldstr})`
            await this.upsertSQL({
                "table": "abirepo",
                "keys": ["address"],
                "vals": vals,
                "data": [data],
                "replace": replace
            }, true);

            await this.loadABI(abiRaw)
        } else {
            this.batchedSQL.push(`update abirepo set lastAttemptDT = Now(), attempted = attempted + 1 where address = '${address}'`);
            await this.update_batchedSQL();
        }
        return abiRaw
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

    async enrich_projectcontractabi(abiType = "event") {
        // load projectcontractabi by signature
        var signatureRecs = await this.poolREADONLY.query(`SELECT address, fingerprintID, CONVERT(signature using utf8) signature, projectName from projectcontractabi where abiType = '${abiType}'`);

        let signatures = {};
        for (const s of signatureRecs) {
            if (signatures[s.address] == undefined) {
                signatures[s.address] = {};
            }
            signatures[s.address][s.signature] = s;
        }
        let hits = {};
        if (abiType == "function") {
            let query = `SELECT * FROM \`substrate-etl.evm.transactions\` as transactions where block_timestamp >= date_sub(current_timestamp(), interval 30 day) and chain_id = 1 order by block_timestamp desc limit 100000`
            let recs = await this.execute_bqJob(query);
            for (const r of recs) {
                if (r.to_address) {
                    let a = r.to_address.toLowerCase();
                    if (signatures[a] && signatures[a][r.signature]) {
                        let projectName = signatures[a][r.signature].projectName
                        if (hits[projectName] == undefined) {
                            hits[projectName] = 0;
                        }
                        hits[projectName]++;
                        //console.log(abiType, projectName);
                    }
                }
            }
        } else if (abiType == "event") {
            let query = `SELECT * FROM \`substrate-etl.evm.logs\` as logs  where block_timestamp >= date_sub(current_timestamp(), interval 30 day) and chain_id = 1 order by block_timestamp desc limit 100000`;
            let recs = await this.execute_bqJob(query);
            console.log(recs.length, abiType);
            for (const r of recs) {
                if (r.address) {
                    let a = r.address.toLowerCase();
                    if (signatures[a] && signatures[a][r.signature]) {
                        let projectName = signatures[a][r.signature].projectName
                        if (hits[projectName] == undefined) {
                            hits[projectName] = 0;
                        }
                        hits[projectName]++;
                        //console.log(abiType, projectName);
                    }
                }
            }

        }
        console.log(hits);

    }

    async modelProjects() {
        let cmd = `ls ./projects/*/discovered.json`
        let {
            stdout,
            stderr
        } = await exec(cmd)
        let addresses = [];
        let signatures = {};
        let res = stdout.split("\n");
        for (const fn of res) {
            let fna = fn.split("/");
            if (fna.length == 4) {
                try {
                    let project_name = fna[2];
                    let discoveredRaw = await fs.readFileSync(fn, "utf8");
                    let discovered = JSON.parse(discoveredRaw);
                    let chainID = 1;
                    let contracts = {};
                    // newly discovered projects
                    for (const c of discovered.contracts) {
                        let chainID = 1;
                        let address = c.address.toLowerCase();
                        let sql = `insert into abirepo ( address, chainID, createDT, projectName, contractName ) values ( ${mysql.escape(address)}, '${chainID}', Now(), ${mysql.escape(project_name)}, ${mysql.escape(c.name)} ) on duplicate key update projectName = values(projectName), contractName = values(contractName) `;
                        contracts[address] = c.name;
                        //this.batchedSQL.push(sql);
                        //await this.update_batchedSQL();
                    }
                    // for all the abis
                    if (discovered.abis) {
                        for (const a of Object.keys(discovered.abis)) {
                            let address = a.toLowerCase();
                            let abis = discovered.abis[a];
                            for (const abi of abis) {
                                if (signatures[abi] == undefined) {
                                    signatures[abi] = {};
                                }
                                if (signatures[abi][project_name] == undefined) {
                                    signatures[abi][project_name] = {};
                                }
                                if (signatures[abi][project_name][address] == undefined) {
                                    signatures[abi][project_name][address] = contracts[address];
                                }
                            }

                        }
                    }

                } catch (err) {
                    console.log(err);
                }

            }
        }
        /*
mysql> desc projectcontractabi;
+---------------+-------------+------+-----+---------+-------+
| Field         | Type        | Null | Key | Default | Extra |
+---------------+-------------+------+-----+---------+-------+
| address       | varchar(67) | NO   | PRI | NULL    |       |
| fingerprintID | varchar(96) | NO   | PRI | NULL    |       |
| projectName   | varchar(32) | YES  |     | NULL    |       |
| secondaryID   | varchar(96) | YES  |     | NULL    |       |
| signatureID   | varchar(70) | NO   |     | NULL    |       |
| signatureRaw  | blob        | YES  |     | NULL    |       |
| signature     | blob        | YES  | MUL | NULL    |       |
| abi           | blob        | YES  |     | NULL    |       |
| abiType       | varchar(16) | YES  |     | NULL    |       |
| addDT         | datetime    | YES  |     | NULL    |       |
+---------------+-------------+------+-----+---------+-------+
*/
        let cnt = 0,
            skip = 0,
            fails = 0;
        for (const abi of Object.keys(signatures)) {
            for (const project_name of Object.keys(signatures[abi])) {
                for (const address of Object.keys(signatures[abi][project_name])) {
                    if (abi.includes("constructor") || abi.includes("error") || abi.includes("pure") || abi.includes("view")) {
                        skip++;
                    } else {
                        let s = this.abi_to_signature(abi)
                        let sql = `select signatureID, abiType, fingerprintID, secondaryID, CONVERT(signatureRaw using utf8) signatureRaw, CONVERT(abi using utf8) abi, abiType from contractabi where signature = ${mysql.escape(s)}`
                        let check = await this.poolREADONLY.query(sql);
                        if (check.length == 0) {
                            fails++; // do NOT add unless we have a good signature match..
                        } else {
                            let c = check[0];
                            let sql2 = `insert into projectcontractabi (address, fingerprintID, secondaryID, signatureID, signatureRaw, signature, abi, abiType, projectName, addDT) values (${mysql.escape(address)}, ${mysql.escape(c.fingerprintID)}, ${mysql.escape(c.secondaryID)}, ${mysql.escape(c.signatureID)}, ${mysql.escape(c.signatureRaw)}, ${mysql.escape(s)}, ${mysql.escape(c.abi)}, ${mysql.escape(c.abiType)}, ${mysql.escape(project_name)}, Now()) on duplicate key update projectName = values(projectName) `
                            this.batchedSQL.push(sql2);
                            await this.update_batchedSQL();
                            cnt++;
                        }
                    }
                }
            }
        }
    }

    abi_to_signature(abi) {
        let s = abi.replace("event ", "").replace("function ", "").replace(" payable", "").trim();
        if (s.includes("returns ")) {
            let sa = s.split(" returns");
            s = s[0];
        }
        return s;
    }

    async preloadEvmSchema() {
        let knownSchema = {}
        let localSQL = `select tableId, modifiedFingerprintID, CONVERT(tableSchema USING utf8) tableSchema, lastUpdateDT from evmschema where tableSchema is not null`;
        let storedEvmSchemas = await this.poolREADONLY.query(localSQL);
        for (const storedEvmSchema of storedEvmSchemas) {
            knownSchema[knownSchema.modifiedFingerprintID] = 1
        }
        let targetSQL = null
        let sql = (targetSQL != undefined) ? targetSQL : `select modifiedFingerprintID, CONVERT(abi using utf8) as abi, abiType from contractabi order by modifiedFingerprintID, firstSeenDT`
        var res = await this.poolREADONLY.query(sql);
        let modifiedFingerprintIDMaps = {}
        let tables = {}
        let output = []
        let batchSize = 100
        for (let i = 0; i < res.length; i++) {
            let r = res[i]
            let modifiedFingerprintID = r.modifiedFingerprintID
            if (knownSchema[modifiedFingerprintID] != undefined) {
                //skip
                continue
            }
            if (modifiedFingerprintIDMaps[modifiedFingerprintID] != undefined) {
                //skip
                continue
            }
            let fingerprintID = modifiedFingerprintID.replaceAll("-", "_")
            modifiedFingerprintIDMaps[modifiedFingerprintID] = 1
            let abiStruct = JSON.parse(r.abi);
            let a = abiStruct[0]
            if ((a.type == "function") && (a.stateMutability == "view" || a.stateMutability == "pure")) continue;
            //let fingerprintID = (a.type == "function") ? r.fingerprintID.substring(0, 10) : r.fingerprintID.substring(0, r.fingerprintID.length - 11).replaceAll("-", "_")
            let tableId = ethTool.computeTableId(abiStruct, fingerprintID)
            if (tables[tableId] != undefined) {
                console.log(`known tableId ${i} ${tableId}`)
                continue
            }
            let schema = ethTool.createEvmSchema(abiStruct, fingerprintID, tableId)
            let sch = schema.schema
            let tinySchema = ethTool.getSchemaWithoutDesc(sch)
            let tableSchema = `${mysql.escape(JSON.stringify(tinySchema))}`
            let abiType = r.abiType
            let row = `('${tableId}', '${modifiedFingerprintID}', ${tableSchema}, '${abiType}', '0', NOW())`
            output.push(row)

            if (output.length > batchSize) {
                console.log(`output len=${output.length}`, output)
                await this.upsertSQL({
                    "table": "evmschema",
                    "keys": ["tableId"],
                    "vals": ["modifiedFingerprintID", "tableSchema", "abiType", "created", "lastUpdateDT"],
                    "data": output,
                    "replaceIfNull": ["tableId", "tableSchema", "lastUpdateDT", "abiType", "created"], // once written, it should NOT get updated. do not mark created from 1 to 0
                }, true);
                output = []
            }
            /*
            let timePartitioning = schema.timePartitioning
            tables[tableId] = sch;
            if (isCeateTable) {
                console.log(`\n\nNew Schema #${i} for ${tableId}`)
                try {
                    const [table] = await bigquery
                        .dataset(datasetId)
                        .createTable(tableId, {
                            schema: sch,
                            location: this.evmBQLocation,
                            timePartitioning: timePartitioning,
                        });
                } catch (err) {
                    let errorStr = err.toString()
                    if (!errorStr.includes('Already Exists')) {
                        console.log(`${datasetId}:${tableId} Error`, errorStr)
                        this.logger.error({
                            op: "setupCallEvents:auto_evm_schema_create",
                            tableId: `${tableId}`,
                            error: errorStr,
                            schema: sch
                        })
                    }
                }
            } else {
                console.log(`*****\nNew Schema #${i} ${tableId}\n`, sch, `\n`)
            }
            */
        }
        if (output.length > batchSize) {
            console.log(`output len=${output.length}`, output)
            await this.upsertSQL({
                "table": "evmschema",
                "keys": ["tableId"],
                "vals": ["modifiedFingerprintID", "tableSchema", "abiType", "created", "lastUpdateDT"],
                "data": output,
                "replaceIfNull": ["tableId", "tableSchema", "lastUpdateDT", "abiType", "created"], // once written, it should NOT get updated. do not mark created from 1 to 0
            }, true);
            output = []
        }
        process.exit(1)

    }

    async reloadABI(targetSQL = null) {
        let sql = (targetSQL != undefined) ? targetSQL : `select abiType, name, signatureID, abi from contractabi where outdated = 1 order by numContracts desc;`
        var res = await this.poolREADONLY.query(sql);
        let i = 0;
        let n = 0
        let batchSize = 100; // safety check
        while (i < res.length) {
            let currBatch = res.slice(i, i + batchSize);
            console.log(`currBatch#${n}`, currBatch)
            if (currBatch.length > 0) {
                let abiABI = []
                for (const r of currBatch) {
                    let abiStr = r.abi.toString('utf8')
                    let abi = JSON.parse(abiStr)[0]
                    abiABI.push(abi)
                }
                await this.loadABI(JSON.stringify(abiABI))
                i += batchSize;
                n++
            }
        }

        /*
        if (res.length > 0) {
            let batchSize = 100
            let batchSize
            for (let i = 0; i < res.length; i++) {
                let r = res[i]
                let abiType = r.abiType
                let name = r.name
                let signatureID = r.signatureID
                let abiABIStr = r.abi.toString('utf8')
                console.log(`[#${i}] [${abiType}] [${signatureID}] ${name}`, abiABIStr)
                await this.loadABI(abiABIStr)
            }
        } else {
            return false
        }
        */
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
        console.log(`output`, output)
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
            let row = `('${data.fingerprintID}', '${data.modifiedFingerprintID}', '${data.secondaryID}', '${data.signatureID}', '${data.signatureRaw}', '${data.signature}', '${data.name}', '${data.abi}', '${data.abiType}', '${data.topicLength}', '1', '0', NOW())`
            abiRows.push(row);
            console.log(`[${data.name}] ${row}`)
        }
        let sqlDebug = true
        await this.upsertSQL({
            "table": "contractabi",
            "keys": ["fingerprintID"],
            "vals": ["modifiedFingerprintID", "secondaryID", "signatureID", "signatureRaw", "signature", "name", "abi", "abiType", "topicLength", "audited", "outdated", "firstSeenDT"],
            "data": abiRows,
            "replace": ["modifiedFingerprintID", "secondaryID", "signatureID", "signatureRaw", "signature", "name", "abi", "abiType", "topicLength", "audited", "outdated", ],
            "replaceIfNull": ["firstSeenDT"]
        }, sqlDebug);

        console.log(abiRows.length + " records");
        /*
        for (let i = 0; i < abiRows.length; i += 2000) {
            let j = i + 10000;
            if (j > abiRows.length) j = abiRows.length;
            let sql = "insert into contractabi (fingerprintID, secondaryID, signatureID, signatureRaw, signature, name, abi ,abiType, numContracts, topicLength, audited) values " + abiRows.slice(i, j).join(",") + " on duplicate key update name = values(name), signature = values(signature), signatureRaw = values(signatureRaw),signatureID = values(signatureID), abi = values(abi), abiType = values(abiType), numContracts = values(numContracts), topicLength = values(topicLength), audited = values(audited)";
            console.log(`sql`, sql)
            this.batchedSQL.push(sql)
        }
        */
        console.log(`dump_contract_abi len=${abiRows.length}`);
        await this.update_batchedSQL(true);
    }

    async setup_dataset(detasetID = `evm_dev`, projectID = `substrate-etl`) {
        let cmd = `bq --location=${this.evmBQLocation} mk --dataset --description="DESCRIPTION" ${projectID}:${detasetID}`
        try {
            console.log(cmd);
            //await exec(cmd);
        } catch (e) {
            // TODO optimization: do not create twice
        }
    }

    async create_dataset(detasetID = `evm_dev`, projectID = `substrate-etl`) {
        //check if exist
        let cmd = `bq ls --project_id=${projectID} --dataset_id=${detasetID}`
        let cmd2 = `bq --location=${this.evmBQLocation} mk --dataset ${projectID}:${detasetID}`
        try {
            console.log(cmd);
            await exec(cmd);
            console.log(`dataset=${projectID}:${detasetID} Exist`)
        } catch (e) {
            // TODO optimization: do not create twice
            try {
                console.log(`Create dataset=${projectID}:${detasetID}`)
                console.log(cmd2)
                await exec(cmd2);
            } catch (e2) {
                console.log(`e2`, e2.toString())
            }
        }
    }

    async delete_dataset(detasetID = `evm_dev`, projectID = `substrate-etl`) {
        //Dengerous!
        let cmd = `bq rm -r -d ${projectID}:${detasetID}`
        try {
            console.log(cmd);
        } catch (e) {
            // TODO optimization: do not create twice
        }
    }

    async loadABIRepo() {
        let tbl = `abirepo`
        let relayChain = 'evm'
        let projectID = `substrate-etl`
        let bqDataset = `evm`
        let sql = `select address, chainID, labels, contractType, tokenName, contractName from abirepo`
        let sqlRecs = await this.poolREADONLY.query(sql);
        let dir = "/tmp";
        let fn = path.join(dir, `${tbl}.json`)
        let f = fs.openSync(fn, 'w', 0o666);
        let NL = "\r\n";
        sqlRecs.forEach((e) => {
            fs.writeSync(f, JSON.stringify({
                address: e.address,
                chain_id: e.chainID,
                token_name: e.tokenName,
                labels: e.labels ? JSON.parse(e.labels).join(",") : null,
                contract_type: e.contractType,
                contract_name: e.contractName,
            }) + NL);
        });
        fs.closeSync(f);
        let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${bqDataset}.${tbl}' ${fn} schema/substrateetl/evm/${tbl}.json`;
        console.log(cmd)
    }

    async learnMethod(chainID = 1, address = "") {
        // sample recent evm transactions + logs
        if (true) {
            let query = `SELECT signature, count(*) numTransactions FROM \`substrate-etl.evm.transactions\` as transactions where transactions.chain_id = ${chainID} and block_timestamp >= date_sub(current_timestamp(), interval 24 hour)   group by signature order by numTransactions desc;`
            console.log(sql);
            let recs = await this.execute_bqJob(query);
            for (const r of recs) {
                let sql0 = `update contractabi set numTransactions = '${r.numTransactions}' where signature = '${r.signature}'`
                console.log(sql0);
                this.batchedSQL.push(sql0);
                await this.update_batchedSQL()
            }
            return (true);
            query = `SELECT signature, count(*) numLogs FROM \`substrate-etl.evm.logs\` as logs  where logs.chain_id = ${chainID} and block_timestamp >= date_sub(current_timestamp(), interval 24 hour)  group by signature order by count(*) desc;`;
            recs = await this.execute_bqJob(query);
            for (const r of recs) {
                let sql0 = `update contractabi set numLogs = '${r.numLogs}' where signature = '${r.signature}'`
                console.log(sql0);
                this.batchedSQL.push(sql0);
                await this.update_batchedSQL()
            }
        }
    }

    async getAlltables(detasetID = `evm_dev`, projectID = `substrate-etl`) {
        let fullTableIDs = []
        let bqCmd = `bq ls --max_results 1000000  v --dataset_id="${detasetID}" --format=json | jq -r '.[].tableReference.tableId' > schema/substrateetl/evm/callevenets.txt`
        let res = await exec(bqCmd)
        try {
            if (res.stdout && res.stderr == '') {
                console.log(res.stdout)
                /*
                let tbls = JSON.parse(res.stdout)
                for (const tbl of tbls) {
                    let fullTableID = tbl.id
                    fullTableIDs.push(fullTableID)
                }
                */
                //console.log(`r`, r)
            }
        } catch (e) {
            console.log(`getAlltables err`, e)
        }
        return fullTableIDs
    }

    async readTableIds(fn = 'schema/substrateetl/evm/callevenets.txt') {
        const fileStream = fs.createReadStream(fn);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        const lines = [];
        for await (const line of rl) {
            lines.push(line);
        }
        return lines;
    }

    // sets up evm chain tables for substrate chain
    async setup_chain_evm(chainID = null, isUpdate = false, execute = false) {
        let projectID = "substrate-etl";
        let opType = (isUpdate) ? 'update' : 'mk'
        let relayChain = "evm"
        if (chainID == undefined) {
            console.log(`ERROR: chainID not specified`)
            process.exit(1, "ERROR: chainID not specified")
        }
        // setup paraID specific tables, including paraID=0 for the relay chain
        let tbls = ["blocks", "contracts", "logs", "token_transfers", "tokens", "traces", "transactions"]
        let sql = `select chainID, isEVM, id from chain where ( isEVM =1 or relayChain in ('ethereum', 'evm') ) and chainID = ${chainID} order by chainID`
        let recs = await this.poolREADONLY.query(sql);
        console.log(`***** setup "chain" tables:${tbls} (chainID=${chainID}) ******`)
        for (const rec of recs) {
            let chainID = parseInt(rec.chainID, 10);
            let id = rec.id
            if (id == undefined) {
                console.log(`ERROR: chain's id not specified`)
                process.exit(1, "ERROR: chain's id not specified")
            }
            //let bqDataset = (this.isProd) ? `${relayChain}` : `${relayChain}_dev` //MK write to evm_dev for dev
            let bqDataset = `crypto_${id}`
            let cmds = []
            let dataSetCmd = `bq --location=${this.evmBQLocation} mk --dataset --description="Dataset for ${bqDataset}" ${projectID}:${bqDataset}`
            cmds.push(dataSetCmd)
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
                let cmd = `bq ${opType} --project_id=${projectID}  --schema=schema/substrateetl/evm/${tbl}.json ${p} --table ${bqDataset}.${tbl}`
                cmds.push(cmd)

            }
            for (const cmd of cmds) {
                console.log(cmd);
                try {
                    if (execute) {
                        // await exec(cmd);
                    }
                } catch (e) {
                    console.log(e);
                    // TODO optimization: do not create twice
                }
            }
        }
        process.exit(0)
    }

    async crawlABIs(chainID = null, renew = false) {
        let w = chainID ? ` and chainID = ${chainID}` : ""
        let query = `select to_address, min(chain_id) as chainID,  count(*) numTransactions7d from substrate-etl.evm.transactions where block_timestamp > date_sub(CURRENT_TIMESTAMP(), interval 7 day) and length(input) > 2 and length(method_id) >= 10 group by to_address order by numTransactions7d desc limit 100000`;
        let recs = renew ? await this.execute_bqJob(query) : [];
        let out = [];
        let vals = ["chainID", "numTransactions7d", "status", "createDT"];
        let replace = ["numTransactions7d", "chainID"];
        for (const r of recs) {
            let address = r.to_address;
            if (address) {
                address = address.toLowerCase();
                out.push(`('${address}', '${r.chainID}', '${r.numTransactions7d}', 'Unknown', Now())`)
            }
        }
        await this.upsertSQL({
            "table": "abirepo",
            "keys": ["address"],
            "vals": vals,
            "data": out,
            "replace": replace
        });
        query = `select address, chainID from abirepo where status = 'Unknown' and ( lastAttemptDT is null or lastAttemptDT < DATE_SUB(Now(), INTERVAL POW(5, attempted) MINUTE) ) and projectName is not null ${w} order by numTransactions7d desc, chainID asc limit 1000`;
        var res = await this.poolREADONLY.query(query);
        for (const r of res) {
            console.log(r.address, r.chainID)
            await this.crawlABI(r.address, r.chainID);
        }
        return [];
    }

    async setupCallEvents(isCeateTable = false) {
        const bigquery = new BigQuery({
            projectId: 'substrate-etl',
            keyFilename: this.BQ_SUBSTRATEETL_KEY
        });
        // read the set of call + event tables
        let tables = {};
        const datasetId = `evm_dev`; // `${id}` could be better, but we can drop the whole dataset quickly this way
        /*
        let knowntableIds = {}
        await this.getAlltables()
        let tableIdFn = 'schema/substrateetl/evm/callevenets.txt'
        let loadedTableIDs = await this.readTableIds(tableIdFn)
        for (const loadedTableID of loadedTableIDs){
            knowntableIds[loadedTableID] = 1
        }
        console.log(`loaded evm`, loadedTableIDs)
        */
        let schemaQuery = `SELECT table_name, column_name, data_type FROM substrate-etl.${datasetId}.INFORMATION_SCHEMA.COLUMNS  where table_name like 'call_%'  or table_name like 'evt_%'`
        let tablesRecs = await this.execute_bqJob(schemaQuery);
        for (const t of tablesRecs) {
            if (tables[t.table_name] == undefined) {
                tables[t.table_name] = {};
            }
            tables[t.table_name][t.column_name] = t.data_type;
            // TODO: get description for full ABI
        }

        let sql = `select name, fingerprintID, CONVERT(signature using utf8) as signature, CONVERT(signatureRaw using utf8) as signatureRaw, CONVERT(abi using utf8) as abi from contractabi limit 100000;`
        var res = await this.poolREADONLY.query(sql);
        for (let i = 0; i < res.length; i++) {
            let r = res[i]
            let abiStruct = JSON.parse(r.abi);
            let a = abiStruct[0]
            if ((a.type == "function") && (a.stateMutability == "view" || a.stateMutability == "pure")) continue;
            let fingerprintID = (a.type == "function") ? r.fingerprintID.substring(0, 10) : r.fingerprintID.substring(0, r.fingerprintID.length - 11).replaceAll("-", "_")

            let tableId = ethTool.computeTableId(abiStruct, fingerprintID)
            if (tables[tableId] != undefined) {
                console.log(`known tableId ${i} ${tableId}`)
                continue
            }
            let schema = ethTool.createEvmSchema(abiStruct, fingerprintID, tableId)
            let sch = schema.schema
            let timePartitioning = schema.timePartitioning
            tables[tableId] = sch;
            if (isCeateTable) {
                console.log(`\n\nNew Schema #${i} for ${tableId}`)
                try {
                    const [table] = await bigquery
                        .dataset(datasetId)
                        .createTable(tableId, {
                            schema: sch,
                            location: this.evmBQLocation,
                            timePartitioning: timePartitioning,
                        });
                } catch (err) {
                    let errorStr = err.toString()
                    if (!errorStr.includes('Already Exists')) {
                        console.log(`${datasetId}:${tableId} Error`, errorStr)
                        this.logger.error({
                            op: "setupCallEvents:auto_evm_schema_create",
                            tableId: `${tableId}`,
                            error: errorStr,
                            schema: sch
                        })
                    }
                }
            } else {
                console.log(`*****\nNew Schema #${i} ${tableId}\n`, sch, `\n`)
            }
        }
    }

    async addContractType(contractType, abiRaw) {
        let sql = `insert into contractType (contractType, createDT, abiRaw) values ('${contractType}', Now(), ${mysql.escape(abiRaw)}) on duplicate key update abiRaw = values(abiRaw)`
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }

    async updateContractTypes(chainID, testAddress = '0x055EA84bfAC8b95Bd7FE78Cec150e4121779d0d5') {
        testAddress = testAddress.toLowerCase()
        let contractTypeABIs = await this.poolREADONLY.query('select contractType, CONVERT(abiRaw using utf8) abiRaw from contractType');
        let viewmethods = {};
        let methods = [];
        let knownmethodIDs = [];
        for (const c of contractTypeABIs) {
            if (viewmethods[c.contractType] == undefined) {
                viewmethods[c.contractType] = [];
            }
            let a = JSON.parse(c.abiRaw);
            // get all methodIDs of abi that are perfectly predictive
            let out = ethTool.parseAbiSignature(c.abiRaw);
            let functions = []
            for (const o of out) {
                if (o.abiType == "function") {
                    if (o.stateMutability && (o.stateMutability == "view" || o.stateMutability == "pure")) {
                        // TODO: only if inputless
                        viewmethods[c.contractType].push(o);
                    } else {
                        functions.push(o);
                    }
                }
            }
            let methodIDs = functions.map((f) => {
                return `'${f.fingerprintID}'`;
            });
            //console.log(c.contractType, methodIDs);
            knownmethodIDs = knownmethodIDs.concat(methodIDs)

            let inside_set = -Math.log(methodIDs.length); // 1/N chance
            let outside_set = -Math.log(100); // 1% chance
            if (methodIDs.length > 0) {
                methods.push(`sum(if(left(input, 10) in (${methodIDs.join(",")}), ${inside_set}, ${outside_set})) as ${c.contractType}`)
            }
        }


        // get all the unknown contracts
        let unknowncontractRecs = await this.poolREADONLY.query(`select address, contractType from abirepo`);
        let unknowncontracts = {};
        for (const c of unknowncontractRecs) {
            unknowncontracts[c.address] = c.contractType;
        }

        console.log("CURRENT TESTADDRESS contractType", unknowncontracts[testAddress])

        // Now, for the last 7 days with contractaddress-methodID combinations, find the contractAddresses using those methodIDs, computing log likelihood across all contract types
        let sql = `select to_address, ${methods.join(",")} from \`substrate-etl.evm.transactions\` group by to_address  order by count(*) desc limit 100000`
        console.log("CATEGORIZER", sql);
        let recs = await this.execute_bqJob(sql);
        for (const d of recs) {
            if (d.to_address) {
                let address = d.to_address.toLowerCase();
                let arr = Object.entries(d).filter((x) => {
                    return (x[0] == "to_address") ? false : true
                });
                arr.sort((b, a) => a[1] - b[1]);
                let diff = arr[0][1] - arr[1][1];
                let contractType = "Unknown"; //
                if (address == testAddress) {
                    console.log(d);
                }
                if (diff > 3) {
                    contractType = arr[0][0];
                    if (unknowncontracts[address] == "Unknown") {
                        // if this is unknown, then for all viewmethods, check which  which are the ones we will test with (e.g symbols, decimals), store in JSON field, for now
                        let sqlout = `update abirepo set contractType = '${contractType}' where address = '${d.to_address}' and contractType = 'Unknown'`
                        this.batchedSQL.push(sqlout);
                        console.log(contractType, d.to_address);
                    }
                }
            }
        }
        await this.update_batchedSQL();


        // show the methodIDs
        let training_sql = `select method_id, signature, count(distinct to_address) numContracts, min(to_address), max(to_address), count(*) numCalls from \`substrate-etl.evm.transactions\` where length(input) > 2 and chain_id = 1 and method_id not in (${knownmethodIDs.join(",")}) group by method_id, signature having numContracts >= 4 and numCalls >= 4 order by numContracts desc;`
        console.log(training_sql);
    }

    async load_project_schema(datasetId = null, projectId = 'blockchain-etl') {
        if (datasetId) {
            let query = `SELECT table_name, column_name, ordinal_position, data_type, is_nullable, is_partitioning_column FROM ${projectId}.${datasetId}.INFORMATION_SCHEMA.COLUMNS;`
            console.log("READING0", query);
            const bigquery = this.get_big_query();
            let recs = await this.execute_bqJob(query);
            for (const r of recs) {
                let sa = r.table_name.split("_");
                let contractName = "";
                let abiType = "";
                let name = "";
                let idx = null;
                for (let i = 0; i < sa.length; i++) {
                    if ((sa[i] == "event") || sa[i] == "call" || sa[i] == "swaps") {
                        idx = i;
                        i = sa.length;
                    }
                }
                if (idx == null) {
                    console.log("FAILED to parse table name", r.table_name, "datasetId", projectId, datasetId);
                } else {
                    abiType = sa[idx];
                    contractName = sa.slice(0, idx).join("_");
                    name = sa.slice(idx + 1).join("_");
                    //console.log('contractName', contractName, "abitype", abiType, "name", name)
                }
                let sql = `insert into projectdatasetcolumns ( projectId, datasetId, table_name, column_name, ordinal_position, data_type, is_nullable, is_partitioning_column, contractName, abiType, name, addDT ) values ( '${projectId}', '${datasetId}', '${r.table_name}', '${r.column_name}', '${r.ordinal_position}', '${r.data_type}', '${r.is_nullable}', '${r.is_partitioning_column}',  ${mysql.escape(contractName)}, ${mysql.escape(abiType)}, ${mysql.escape(name)}, Now() ) on duplicate key update contractName = values(contractName), abiType = values(abiType), name = values(name)`
                this.batchedSQL.push(sql);
            }
            await this.update_batchedSQL();
        } else {
            let cmd = `bq ls --format=json -n 10000 --project_id=blockchain-etl`
            const {
                stdout,
                stderr
            } = await exec(cmd);
            if (stderr) {
                console.log("ERR!!" + stderr);
            } else {
                let res = JSON.parse(stdout);
                for (const r of res) {
                    if (r.datasetReference && r.datasetReference.datasetId) {
                        let did = r.datasetReference.datasetId
                        let sql = `insert into projectdataset ( projectId, datasetId, location, addDT ) values ( '${projectId}', '${did}', '${r.location}', Now() ) on duplicate key update location = values(location)`
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL();
                        await this.load_project_schema(did);
                    }
                }
            }
        }
    }

    extractABIFromRoutine(routine_definition) {
        // Get the first line of the code string
        const lines = routine_definition.split('\n');
        //console.log(`lines`,lines)
        const firstLine = lines[1];
        //console.log(`firstLine`, firstLine)
        // Regular expression to match the ABI object in the first line, accounting for any whitespace
        const regex = /var abi\s*=\s*({.*})/;

        // Search for the ABI object using the regular expression
        const match = firstLine.match(regex);

        if (match && match[1]) {
            // Return the matched ABI string
            return match[1];
        } else {
            return false
        }
    }

    async load_project_routines(datasetId = null, projectId = 'blockchain-etl-internal') {
        if (datasetId) {
            let query = `SELECT routine_name, data_type, routine_definition, ddl FROM ${projectId}.${datasetId}.INFORMATION_SCHEMA.ROUTINES;`
            console.log("READING1", query);
            /*
            const options = {
                query: query,
                location: 'US'
            };
            */
            const bigquery = this.get_big_query();
            try {
                let recs = await this.execute_bqJob(query);
                for (const r of recs) {
                    let sa = r.routine_name.split("_");
                    let contractName = "";
                    let abiType = "";
                    let name = "";
                    let idx = null;
                    for (let i = 0; i < sa.length; i++) {
                        if ((sa[i] == "event") || sa[i] == "call" || sa[i] == "swaps") {
                            idx = i;
                            i = sa.length;
                        }
                    }
                    if (idx == null) {
                        console.log("FAILED to parse routine name", r.routine_name, "datasetId", projectId, datasetId);
                    } else {
                        abiType = sa[idx];
                        contractName = sa.slice(0, idx).join("_");
                        name = sa.slice(idx + 1).join("_");
                    }
                    let routine_definition = (r.routine_definition)
                    //console.log(`[${r.routine_name}] routine_definition`, routine_definition)
                    let abiStr = this.extractABIFromRoutine(routine_definition)
                    let fingerprintID = 'Null'
                    if (abiStr) {
                        abiStr = `${JSON.stringify([JSON.parse(abiStr)])}`
                        var output = ethTool.parseAbiSignature(abiStr)
                        if (output && output.length == 1) {
                            fingerprintID = `'${output[0].fingerprintID}'`
                        }
                        //await this.loadABI(abiStr)
                    }
                    let abiStrSQL = (abiStr) ? `'${abiStr}'` : `NULL`
                    console.log(`[${r.routine_name}] fingerprintID=${fingerprintID}, abi`, abiStrSQL)
                    let sql = `insert into projectdatasetroutines ( projectId, datasetId, routine_name, fingerprintID, abi, data_type, routine_definition, ddl, contractName, abiType, name, addDT ) values ( ${mysql.escape(projectId)}, ${mysql.escape(datasetId)}, ${mysql.escape(r.routine_name)}, ${fingerprintID}, ${abiStrSQL}, ${mysql.escape(r.data_type)}, ${mysql.escape(r.routine_definition)}, ${mysql.escape(r.ddl)}, ${mysql.escape(contractName)}, ${mysql.escape(abiType)}, ${mysql.escape(name)}, Now() ) on duplicate key update contractName = values(contractName), abiType = values(abiType), name = values(name), fingerprintID = values(fingerprintID), abi = values(abi)`
                    this.batchedSQL.push(sql);
                }
            } catch (err) {
                console.log(`err`, err)
            }
            await this.update_batchedSQL();
        } else {
            let cmd = `bq ls --format=json -n 10000 --project_id=blockchain-etl`
            const {
                stdout,
                stderr
            } = await exec(cmd);
            if (stderr) {
                console.log("ERR!!" + stderr);
            } else {
                let res = JSON.parse(stdout);
                for (const r of res) {
                    if (r.datasetReference && r.datasetReference.datasetId) {
                        let did = r.datasetReference.datasetId
                        let sql = `insert into projectdataset ( projectId, datasetId, location, addDT ) values ( '${projectId}', '${did}', '${r.location}', Now() ) on duplicate key update location = values(location)`
                        this.batchedSQL.push(sql);
                        await this.update_batchedSQL();
                        try {
                            await this.load_project_routines(did);
                        } catch (err) {
                            console.log(err);
                        }
                    }
                }
            }
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

    getTimeFormat(logDT) {
        //2020-12-01 -> [TS, '20221201', '2022-12-01', '2022-11-30']
        //20201201 -> [TS, '20221201', '2022-12-01', '2022-11-30']
        let logTS = paraTool.logDT_hr_to_ts(logDT, 0)
        let logYYYYMMDD = logDT.replaceAll('-', '')
        let [currDT, _c] = paraTool.ts_to_logDT_hr(logTS)
        let [prevDT, _p] = paraTool.ts_to_logDT_hr(logTS - 86400)
        return [logTS, logYYYYMMDD, currDT, prevDT]
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

    async getChainStep(dt, chainID) {
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(dt)
        let sql = `select chainID, logDT, startBN, endBN, evmStep, evmStepDT from blocklog where chainID = ${chainID} and logDT='${currDT}' limit 1`
        console.log(sql)
        let recs = await this.poolREADONLY.query(sql);
        let jobInfo = {
            chainID: chainID,
            logDT: currDT,
            evmStep: 0,
            evmStepDT: null
        }
        if (recs.length > 0) {
            let rec = recs[0]
            jobInfo.evmStep = rec.evmStep
            jobInfo.evmStepDT = `${rec.evmStepDT}`
        } else {
            let completedEvmStep = STEP0_createRec
            let updateSQL = `insert into blocklog (chainID, logDT, evmStep, evmStepDT) values ('${chainID}', '${currDT}', '${completedEvmStep}', NOW()) on duplicate key update evmStep = values(evmStep), evmStepDT = values(evmStepDT)`;
            console.log(`[chainID=${chainID} logDT=${currDT}] Add new tasks\n`, updateSQL)
            this.batchedSQL.push(updateSQL);
            await this.update_batchedSQL();
        }
        return jobInfo
    }

    async processChainSteps(dt, chainID) {
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(dt)
        let jobInfo = await this.getChainStep(dt, chainID)
        if (jobInfo.evmStep >= STEP4_loadGSEvmDecoded) {
            console.log(`[chainID=${chainID} logDT=${currDT}] Already Completed`)
            process.exit(0)
        }
        console.log(`jobInfo`, jobInfo)
        let currEvmStep = jobInfo.evmStep;
        let nextEvmStep;
        let retries = new Array(6).fill(0);
        do {
            let currJobInfo = await this.processChainStep(dt, chainID, currEvmStep);
            nextEvmStep = currJobInfo.evmStep
            if (currEvmStep === nextEvmStep) {
                retries[currEvmStep]++;
                if (retries[currEvmStep] > 2) {
                    let errorMsg = `Step ${currEvmStep} failed after 2 retries, exiting.`
                    console.log(errorMsg);
                    process.exit(1, errorMsg)
                    break;
                }
            } else {
                currEvmStep = nextEvmStep;
            }
        } while (nextEvmStep < STEP4_loadGSEvmDecoded);

    }

    /* Regnerate One day worth of data

    const step0_createRec = 0
        function: cpblk(dt, chainID)

    const step1_cpblk = 1
        function: cpblk(dt, chainID)
        Source: crypto_ethereum..
        Output: gs://evm_etl/YYYY/MM/DD/chainID/

    const step2_backfill = 2
        function: backfill(dt, chainID)
        Source: gs://evm_etl/YYYY/MM/DD/chainID/
        LocalTmp: /tmp/evm_etl/YYYY/MM/DD/chainID/
        Output: cbt evmchain${chainID}

    const STEP3_indexEvmChainFull = 3
        function: index_evmchain_full(chainID, dt): (3a: index_evmchain_only -> 3b: cpEvmDecodedToGS -> 3c: cpEvmETLToGS)
        Source: cbt evmchain${chainID}
        LocalTmp: /tmp/evm_decoded/YYYY/MM/DD/chainID/tableId*

    const STEP5_loadGSEvmDecoded = 5
        function: loadGSEvmDecoded(dt, chainID)
        Input:gs://evm_decoded/YYYY/MM/DD/
        localInput: /disk1/evmschema
    */

    async processChainStep(dt, chainID, currEvmStep) {
        switch (currEvmStep) {
            case 0:
                //Next step: cpblk
                console.log(`[chainID=${chainID}, logDT=${dt}] NextStep=1, cpblk`)
                await this.cpblk(dt, chainID);
                break;
            case 1:
                //Next step: backfill
                console.log(`[chainID=${chainID}, logDT=${dt}]  NextStep=2, backfill`)
                await this.backfill(dt, chainID);
                break;
            case 2:
                //Next step: index_evmchain_full (index_evmchain_only + cpEvmDecodedToGS + cpEvmETLToGS)
                console.log(`[chainID=${chainID}, logDT=${dt}] NextStep=3, index_evmchain_only->cpEvmDecodedToGS->cpEvmETLToGS`)
                await this.index_evmchain_full(chainID, dt);
                break;
            case 3:
                //Next step: loadGSEvmDecoded
                // pause step4 for now, until we figure out a DAG plan
                console.log(`[chainID=${chainID}, logDT=${dt}] NextStep=4, TODO: awaiting loadGSEvmDecoded Step`)
                //loadGSEvmDecoded - this is not chain specific
                //await this.loadGSEvmDecoded(dt, chainID);
                break;
            case 4:
                console.log(`[chainID=${chainID}, logDT=${dt}] No nextStep, DONE`)
                break;
            default:
        }
        let jobInfo = await this.getChainStep(dt, chainID)
        return jobInfo
    }

    async cpblk(dt, chainID) {
        let srcprojectID, srcdataset, id;
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(dt)
        switch (chainID) {
            case paraTool.chainIDEthereum:
                srcprojectID = "bigquery-public-data";
                srcdataset = "crypto_ethereum";
                id = 'ethereum';
                break;
            case paraTool.chainIDPolygon:
                srcprojectID = "public-data-finance";
                srcdataset = "crypto_polygon";
                id = 'polygon';
                break;
        }
        let coveredChains = [paraTool.chainIDEthereum, paraTool.chainIDPolygon]
        if (!coveredChains.includes(chainID)) {
            console.log(`[chainID=${chainID}, currDT=${currDT}] cpblk NOT READY`)
            process.exit(1)
        }
        console.log(`chainID=${chainID}, srcprojectID=${srcprojectID}, srcdataset=${srcdataset}, uri=gs://evm_etl/${logYYYY_MM_DD}/${chainID}/`)
        let tables = {
            "blocks": {
                "ts": "timestamp",
                "sql": `select ${chainID} as chain_id, "${id}" as id, timestamp, number, \`hash\`, parent_hash, nonce, sha3_uncles, logs_bloom, transactions_root, state_root, receipts_root, miner, difficulty, total_difficulty from \`${srcprojectID}.${srcdataset}.blocks\` where date(timestamp) = "${currDT}" order by number, timestamp`,
                "flds": `chain_id, id, unix_seconds(timestamp) timestamp, number, \`hash\`, parent_hash, nonce, sha3_uncles, logs_bloom, transactions_root, state_root, receipts_root, miner,  CAST(difficulty as string) difficulty, CAST(total_difficulty as string) total_difficulty`,
                "gs": `EXPORT DATA OPTIONS( uri="gs://evm_etl/${logYYYY_MM_DD}/${chainID}/blocks_*", format="JSON", overwrite=true) AS
                SELECT chain_id, id, unix_seconds(timestamp) timestamp, number, \`hash\`, parent_hash, nonce, sha3_uncles, logs_bloom, transactions_root, state_root, receipts_root, miner,  CAST(difficulty as string) difficulty, CAST(total_difficulty as string) total_difficulty
                FROM \`substrate-etl.crypto_ethereum.blocks\` WHERE DATE(timestamp) = "${currDT}"
                ORDER BY number, timestamp`
            },
            "contracts": {
                "ts": "block_timestamp",
                "sql": `select ${chainID} as chain_id, "${id}" as id, address, bytecode, function_sighashes, is_erc20, is_erc721, block_timestamp, block_number, block_hash from \`${srcprojectID}.${srcdataset}.contracts\` where date(block_timestamp) = "${currDT}" order by block_number, block_timestamp`,
                "flds": `chain_id, id, address, bytecode, function_sighashes, is_erc20, is_erc721, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash`,
                "gs": `EXPORT DATA OPTIONS( uri="gs://evm_etl/${logYYYY_MM_DD}/${chainID}/contracts_*", format="JSON", overwrite=true) AS
                SELECT chain_id, id, address, bytecode, function_sighashes, is_erc20, is_erc721, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash
                FROM \`substrate-etl.crypto_ethereum.contracts\` WHERE DATE(block_timestamp) = "${currDT}"
                ORDER BY block_number, block_timestamp`
            },
            "logs": {
                "ts": "block_timestamp",
                "sql": `select ${chainID} as chain_id, "${id}" as id, log_index, transaction_hash, transaction_index, address, data, topics, block_timestamp, block_number, block_hash from \`${srcprojectID}.${srcdataset}.logs\` where date(block_timestamp) = "${currDT}" order by block_number, log_index, transaction_index, block_timestamp`,
                "flds": `chain_id, id, log_index, transaction_hash, transaction_index, address, data, topics, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash`,
                "gs": `EXPORT DATA OPTIONS( uri="gs://evm_etl/${logYYYY_MM_DD}/${chainID}/logs_*", format="JSON", overwrite=true) AS
                SELECT chain_id, id, log_index, transaction_hash, transaction_index, address, data, topics, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash
                FROM \`substrate-etl.crypto_ethereum.logs\` WHERE DATE(block_timestamp) = "${currDT}"
                ORDER BY block_number, log_index, transaction_index, block_timestamp`
            },
            "token_transfers": {
                "ts": "block_timestamp",
                "sql": `select ${chainID} as chain_id, "${id}" as id, token_address, from_address, to_address, value, transaction_hash, log_index, block_timestamp, block_number, block_hash from \`${srcprojectID}.${srcdataset}.token_transfers\` where date(block_timestamp) = "${currDT}" order by block_number, log_index, block_timestamp`,
                "flds": `chain_id, id, token_address, from_address, to_address, value, transaction_hash, log_index, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash`,
                "gs": `EXPORT DATA OPTIONS( uri="gs://evm_etl/${logYYYY_MM_DD}/${chainID}/token_transfers_*", format="JSON", overwrite=true) AS
                SELECT chain_id, id, token_address, from_address, to_address, value, transaction_hash, log_index, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash
                FROM \`substrate-etl.crypto_ethereum.token_transfers\` WHERE DATE(block_timestamp) = "${currDT}"
                ORDER BY block_number, log_index, block_timestamp`
            },
            "tokens": {
                "ts": "block_timestamp",
                "sql": `select ${chainID} as chain_id, "${id}" as id, address, symbol, name, decimals, total_supply, block_timestamp, block_number, block_hash from \`${srcprojectID}.${srcdataset}.tokens\` where date(block_timestamp) = "${currDT}" order by block_number, block_timestamp`,
                "flds": `chain_id, id, address, symbol, name, decimals, total_supply, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash`,
                "gs": `EXPORT DATA OPTIONS( uri="gs://evm_etl/${logYYYY_MM_DD}/${chainID}/tokens_*", format="JSON", overwrite=true) AS
                SELECT chain_id, id, address, symbol, name, decimals, total_supply, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash
                FROM \`substrate-etl.crypto_ethereum.tokens\` WHERE DATE(block_timestamp) = "${currDT}"
                ORDER BY block_number, block_timestamp

                `
            },
            "traces": {
                "ts": "block_timestamp",
                "sql": `select ${chainID} as chain_id, "${id}" as id, transaction_hash, transaction_index, from_address, to_address, value, input, output, trace_type, call_type, reward_type, gas, gas_used, subtraces, trace_address, error, status, block_timestamp, block_number, block_hash from \`${srcprojectID}.${srcdataset}.traces\` where date(block_timestamp) = "${currDT}" order by block_number, transaction_index, trace_address, subtraces`,
                "flds": `chain_id, id, transaction_hash, transaction_index, from_address, to_address, value, input, output, trace_type, call_type, reward_type, gas, gas_used, subtraces, trace_address, error, status, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash`,
                "gs": `EXPORT DATA OPTIONS( uri="gs://evm_etl/${logYYYY_MM_DD}/${chainID}/traces_*", format="JSON", overwrite=true) AS
                SELECT chain_id, id, transaction_hash, transaction_index, from_address, to_address, value, input, output, trace_type, call_type, reward_type, gas, gas_used, subtraces, trace_address, error, status, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash
                FROM \`substrate-etl.crypto_ethereum.traces\`where date(block_timestamp) = "${currDT}"
                ORDER BY block_number, transaction_index, trace_address, subtraces
                `

            },
            "transactions": {
                "ts": "block_timestamp",
                "sql": `select ${chainID} as chain_id, "${id}" as id, \`hash\`, nonce, transaction_index, from_address, to_address, value, gas, gas_price, input, receipt_cumulative_gas_used, receipt_gas_used, receipt_contract_address, receipt_root, receipt_status, block_timestamp, block_number, block_hash, max_fee_per_gas, max_priority_fee_per_gas, transaction_type, receipt_effective_gas_price from \`${srcprojectID}.${srcdataset}.transactions\` where date(block_timestamp) = "${currDT}" order by block_number, transaction_index`,
                "flds": `chain_id, id, \`hash\`, nonce, transaction_index, from_address, to_address, CAST(value as string) value, gas, gas_price, input, receipt_cumulative_gas_used, receipt_gas_used, receipt_contract_address, receipt_root, receipt_status, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash, max_fee_per_gas, max_priority_fee_per_gas, transaction_type, receipt_effective_gas_price`,
                "gs": `EXPORT DATA OPTIONS( uri="gs://evm_etl/${logYYYY_MM_DD}/${chainID}/transactions_*", format="JSON", overwrite=true) AS
                SELECT chain_id, id, \`hash\`, nonce, transaction_index, from_address, to_address, CAST(value as string) value, gas, gas_price, input, receipt_cumulative_gas_used, receipt_gas_used, receipt_contract_address, receipt_root, receipt_status, unix_seconds(block_timestamp) block_timestamp, block_number, block_hash, max_fee_per_gas, max_priority_fee_per_gas, transaction_type, receipt_effective_gas_price
                FROM \`substrate-etl.crypto_ethereum.transactions\`where date(block_timestamp) = "${currDT}"
                ORDER BY block_number, transaction_index
                `
            },
        };
        let projectID = `substrate-etl`
        let cmds = []
        let bqCmds = []
        let gsCmds = []
        let errCnt = 0
        for (const tbl of Object.keys(tables)) {
            let t = tables[tbl];
            //let [logTS, logYYYYMMDD, currDT, prevDT] = this.getAllTimeFormat(dt)
            let destinationTbl = `crypto_${id}.${tbl}$${logYYYYMMDD}`
            let partitionedFld = t.ts;
            let targetSQL = t.sql;
            let bqCmd = `bq query --quiet --format=sparse --max_rows=3 --destination_table '${destinationTbl}' --project_id=${projectID} --time_partitioning_field ${partitionedFld} --replace --location=us --use_legacy_sql=false '${paraTool.removeNewLine(targetSQL)}'`;
            //bqCmd = `bq mk --project_id=substrate-etl  --time_partitioning_field ${partitionedFld} --schema schema/substrateetl/evm/${tbl}.json ${destinationTbl}`
            let gsCmd = `bq query --quiet --format=sparse --max_rows=3 --use_legacy_sql=false '${paraTool.removeNewLine(t["gs"])}'`
            //console.log(gsCmd, '\n')
            bqCmds.push(bqCmd)
            gsCmds.push(gsCmd)
            cmds.push(bqCmd)
            cmds.push(gsCmd)
        }
        /*
        for (const cmd of cmds){
            try {
                console.log(cmd, `\n`)
                await exec(cmd, {
                    maxBuffer: 1024 * 50000
                });
            } catch (e) {
                console.log(e);
                errCnt++
                // TODO optimization: do not create twice
            }
        }
        */
        await this.batchExec(bqCmds)
        await this.batchExec(gsCmds)
        if (errCnt == 0) {
            let completedEvmStep = STEP1_cpblk
            let updateSQL = `insert into blocklog (chainID, logDT, evmStep, evmStepDT) values ('${chainID}', '${currDT}', '${completedEvmStep}', NOW()) on duplicate key update evmStep = values(evmStep), evmStepDT = values(evmStepDT)`;
            this.batchedSQL.push(updateSQL);
            await this.update_batchedSQL();
        }
    }

    async countLinesInFiles(pattern) {
        const filepaths = glob.sync(pattern).sort();
        let totalLineCount = 0;
        for (const filepath of filepaths) {
            const lineCount = await this.countLinesInFile(filepath);
            console.log(`${filepath} recCnt=${lineCount}`)
            totalLineCount += lineCount;
        }
        return totalLineCount;
    }


    async countLinesInFile(fn) {
        return new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(fn, {
                encoding: 'utf8'
            });
            let lineCount = 0;
            let buffer = '';
            let blockHashFld = (fn.includes("blocks")) ? "hash" : "block_hash"
            let blockNumberFld = (fn.includes("blocks")) ? "number" : "block_number"

            readStream.on('data', (chunk) => {
                buffer += chunk;
                let lines = buffer.split('\n');
                buffer = lines.pop();
                lineCount += lines.length;
            });

            readStream.on('end', () => {
                // Account for the last line
                if (buffer.length > 0) {
                    lineCount++;
                }
                resolve(lineCount);
            });

            readStream.on('error', (error) => {
                reject(error);
            });
        });
    }

    async parseJSONL(fn, prevIncompleteBlkRecordsMaps = false, offsetStart = 0, maxN = null) {
        const fileStream = fs.createReadStream(fn, {
            encoding: 'utf8'
        });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });
        //console.log(`rl`, rl)
        let blkRecordsMaps = {}
        let blkRecords = [];
        //let lastBlkRecords = [];
        let lineCount = 0;
        let linesRead = 0;
        let blockHashFld = (fn.includes("blocks")) ? "hash" : "block_hash"
        let blockNumberFld = (fn.includes("blocks")) ? "number" : "block_number"
        let prevKey = false; //previusly completed key
        let currKey = false;
        let prevIncompleteKey = false

        //load prevIncompleteBlkRecordsMaps
        if (prevIncompleteBlkRecordsMaps) {
            // if exist, creat key
            let key = Object.keys(prevIncompleteBlkRecordsMaps)[0]
            blkRecordsMaps[key] = prevIncompleteBlkRecordsMaps[key]
            currKey = key
            prevIncompleteKey = key
        }

        for await (const line of rl) {
            if (lineCount >= offsetStart) {
                try {
                    const jsonObject = JSON.parse(line);
                    let bn = jsonObject[blockNumberFld]
                    let bnHex = paraTool.blockNumberToHex(paraTool.dechexToInt(bn))
                    let blkHash = jsonObject[blockHashFld]
                    let key = `${bn}_${blkHash}_${bnHex}`
                    if (blkRecordsMaps[key] == undefined) {
                        //if key not found, it's a start of a new block, last block is available to push
                        // mark last key as complete
                        prevKey = currKey
                        blkRecordsMaps[key] = []
                        blkRecordsMaps[key].push(jsonObject)
                        currKey = key
                    } else {
                        //currKey in process
                        blkRecordsMaps[key].push(jsonObject)
                        currKey = key
                    }
                    linesRead++;
                } catch (error) {
                    console.error('Error parsing line:', line, error);
                }
            }
            if (maxN !== null && linesRead >= maxN) {
                break;
            }
            lineCount++;
        }

        let incompleteBlkRecordsMaps = {}
        incompleteBlkRecordsMaps[currKey] = blkRecordsMaps[currKey]
        delete blkRecordsMaps[currKey]
        let coveredBlocks = Object.keys(blkRecordsMaps).sort()
        let resp = {
            fn: fn,
            linesReads: linesRead,
            prevIncompleteKey: prevIncompleteKey,
            completeStarKey: coveredBlocks[0],
            completeEndKey: prevKey,
            remainingKey: currKey,
            blkRecordsMaps: blkRecordsMaps,
            incompleteBlkRecordsMaps: incompleteBlkRecordsMaps,
        }
        return resp;
    }

    createWorkingDir(targetPath) {
        // Create the target directory if it does not exist
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, {
                recursive: true
            });
            console.log(`Making Directory "${targetPath}"`);
        } else {
            console.log(`Directory "${targetPath}" already exists.`);
        }
    }

    async processTable(blocksMap, dirPath, tbl, fnType = "blocks") {
        let path = `${dirPath}${fnType}_*`
        let filepaths = glob.sync(path).sort();
        console.log(`processTable filepaths`, filepaths)
        let prevIncompleteBlkRecordsMaps = false
        let currIncompleteBlkRecordsMaps = false
        for (const fn of filepaths) {
            prevIncompleteBlkRecordsMaps = currIncompleteBlkRecordsMaps
            /*
            if (tblRec && tblRec.incompleteBlkRecordsMaps != undefined){
                prevIncompleteBlkRecordsMaps = tblRec.incompleteBlkRecordsMaps
            }
            */
            let tblRecs = await this.parseJSONL(fn, prevIncompleteBlkRecordsMaps)
            currIncompleteBlkRecordsMaps = tblRecs.incompleteBlkRecordsMaps
            console.log(`tblRec`, tblRecs)
            await this.loadTableRecs(blocksMap, tblRecs.blkRecordsMaps, tbl, fnType, fn)
        }
        if (currIncompleteBlkRecordsMaps) {
            await this.loadTableRecs(blocksMap, currIncompleteBlkRecordsMaps, tbl, fnType, "Remaining")
        }
    }

    async loadTableRecs(blocksMap, blkRecordsMaps, tbl, fnType = "blocks", content = "") {
        let out = [];
        let batchSize = 100
        let batchN = 0;
        let currentDayMicroTS = paraTool.getCurrentDayTS() * 1000000 //last microsecond of a day - to be garbage collected 7 days after this
        let fnTypeList = ["blocks", "logs", "token_transfers", "traces", "transactions", "contracts"]
        if (!fnTypeList.includes(fnType)) {
            console.log(`Invalid fnType=${fnType}`)
            return
        }
        for (const blkKey of Object.keys(blkRecordsMaps)) {
            if (blocksMap[blkKey] == undefined) {
                //should not get here
                console.log(`${blkKey} missing from blocksMap`)
                continue
            }
            let blockNumber = paraTool.dechexToInt(blkKey.split(`_`)[0])
            let blockHash = blkKey.split(`_`)[1]
            let rec = blkRecordsMaps[blkKey]
            let blockTS = blocksMap[blkKey] * 1000000
            if (fnType == "blocks") {
                rec = rec[0] //use array for blocks?
            }
            let cres = {
                key: paraTool.blockNumberToHex(blockNumber),
                data: {
                    /*
                    blocks: {},
                    logs: {},
                    token_transfers: {},
                    traces: {},
                    transactions: {},
                    contracts: {},
                    */
                }
            }
            // only init specific fnType
            cres.data[fnType] = {}
            cres['data'][fnType][blockHash] = {
                value: JSON.stringify(rec),
                timestamp: currentDayMicroTS
            };
            //console.log(`cres['data'][${fnType}][${blockHash}]`, cres['data'][fnType][blockHash])
            out.push(cres);
            if (out.length >= batchSize) {
                try {
                    await this.insertBTRows(tbl, out, "evmchain");
                    console.log(`${content}\n${fnType} batch#${batchN} insertBTRows ${out.length}`, out)
                    batchN++
                    out = []
                } catch (e) {
                    console.log(`load err`, e);
                }
            }
        }

        if (out.length >= 0) {
            try {
                await this.insertBTRows(tbl, out, "evmchain");
                console.log(`${content}\n ${fnType} last batch#${batchN} insertBTRows ${out.length}`, out)
                batchN++
                out = []
            } catch (e) {
                console.log(`load err`, e);
            }
        }
    }

    async loadBlocksInfo(dirPath) {
        let path = `${dirPath}blocks_*`
        let filepaths = glob.sync(path).sort();
        let blocksMap = {}
        let res = false
        let prevIncompleteBlkRecordsMaps = false
        for (const fn of filepaths) {
            if (res && res.incompleteBlkRecordsMaps != undefined) {
                prevIncompleteBlkRecordsMaps = res.incompleteBlkRecordsMaps
            }
            res = await this.parseJSONL(fn, prevIncompleteBlkRecordsMaps)
            for (const k of Object.keys(res.blkRecordsMaps)) {
                let r = res["blkRecordsMaps"][k][0]
                blocksMap[k] = r.timestamp
            }
            for (const k of Object.keys(res.incompleteBlkRecordsMaps)) {
                let r = res["incompleteBlkRecordsMaps"][k][0]
                blocksMap[k] = r.timestamp
            }
        }
        console.log(blocksMap)
        let blockKeys = Object.keys(blocksMap).sort()
        let minBlkKey = blockKeys.shift()
        let maxBlkKey = blockKeys.pop()
        let minBN = minBlkKey.split("_")[0]
        let maxBN = maxBlkKey.split("_")[0]
        let blocksInfo = {
            blocks: blocksMap,
            minBN: paraTool.dechexToInt(minBN),
            maxBN: paraTool.dechexToInt(maxBN)
        }
        return blocksInfo
    }

    async backfill(dt, chainID) {
        let projectID = "substrate-etl";
        let dataset = null;
        switch (chainID) {
            case 1:
                dataset = "crypto_ethereum";
                break;
            case 137:
                dataset = "crypto_polygon";
                break;
        }

        let rootDir = '/tmp'
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(dt)
        let dirPath = `${rootDir}/evm_etl/${logYYYY_MM_DD}/${chainID}/`
        this.createWorkingDir(dirPath)
        let errCnt = 0
        try {
            let gsCmd = `gsutil -m cp gs://evm_etl/${logYYYY_MM_DD}/${chainID}/* ${dirPath}`
            console.log(gsCmd)
            let res = await exec(gsCmd, {
                maxBuffer: 1024 * 64000
            });
            console.log(`res`, res)
        } catch (e) {
            errCnt++
            console.log(`${e.toString()}`)
        }
        let tbl = this.instance.table("evmchain" + chainID);
        console.log("HI");

        let blocksInfo = await this.loadBlocksInfo(dirPath, "blocks")
        console.log(`blocksInfo`, blocksInfo)
        let sql = `insert into blocklog (chainID, logDT, startBN, endBN) values ('${chainID}', '${currDT}', '${blocksInfo.minBN}', '${blocksInfo.maxBN}') on duplicate key update startBN = values(startBN), endBN = values(endBN)`;
        console.log(`${sql}`)
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
        //process.exit(0)

        let fnTypes = ["blocks", "logs", "traces", "transactions", "contracts", "token_transfers"]
        //let fnTypes = ["blocks"]
        for (const fnType of fnTypes) {
            await this.processTable(blocksInfo.blocks, dirPath, tbl, fnType)
        }
        if (errCnt == 0) {
            let completedEvmStep = STEP2_backfill
            let updateSQL = `insert into blocklog (chainID, logDT, evmStep, evmStepDT) values ('${chainID}', '${currDT}', '${completedEvmStep}', NOW()) on duplicate key update evmStep = values(evmStep), evmStepDT = values(evmStepDT)`;
            this.batchedSQL.push(updateSQL);
            await this.update_batchedSQL();
        }
        //TODO: delete dirPath
    }

    async fetch_gs_file_list(logYYYY_MM_DD = "2023/05/11", bucketName = "gs://evm_decoded") {
        let basePath = `${bucketName}/${logYYYY_MM_DD}/**`
        let cmd = `gsutil ls ${basePath} | jq -c -R -n '[inputs]'`
        console.log(`cmd`, cmd)
        let res = await exec(cmd, {
            maxBuffer: 1024 * 640000
        });
        let fnPathMap = {}
        try {
            if (res.stderr != '') {
                console.log(`${cmd} error`, res.stderr)
                return false
            }
            let fns = JSON.parse(res.stdout) // this may contain file from many different chains and potentially many hours when we split day into hours. need to use path instead
            for (const fn of fns) {
                let fnPieces = fn.split('/')
                let fnLast = fnPieces.pop() //{chainID_hr.json}
                let fnWild = `${fnPieces.join('/')}/*.json`
                fnPathMap[fnWild] = 1
            }
            return Object.keys(fnPathMap)
        } catch (e) {
            console.log(`error`, e)
            return false
        }
        return false
    }

    async initEvmLocalSchemaMap() {
        let sql = 'select tableId, modifiedFingerprintID, CONVERT(tableSchema USING utf8) tableSchema, abiType, created from evmschema order by tableId';
        let recs = await this.poolREADONLY.query(sql);
        let evmLocalSchemaMap = {}
        for (const rec of recs) {
            evmLocalSchemaMap[rec.tableId] = rec
            //this.writeTableSchemaJSON(rec.tableId, rec.tableSchema)
        }
        this.evmLocalSchemaMap = evmLocalSchemaMap
        console.log(`evmLocalSchemaMap`, Object.keys(evmLocalSchemaMap))
        console.log(`Found ${recs.length} tableId in local evmschema`)
    }

    async generateTableSchemaJSON() {
        let sql = 'select tableId, modifiedFingerprintID, CONVERT(tableSchema USING utf8) tableSchema, abiType, created from evmschema order by tableId';
        let recs = await this.poolREADONLY.query(sql);
        for (const rec of recs) {
            await this.writeTableSchemaJSON(rec.tableId, rec.tableSchema)
        }
    }

    // since bq load does not allow NULLABLE/REQUIRED with inline schema. write to disk1 instead
    async writeTableSchemaJSON(tableId, tableSchema, replace = false) {
        let rootDir = '/disk1'
        const filePath = path.join(rootDir, 'evmschema', `${tableId}.json`);
        let data = tableSchema
        //console.log(`filePath=${filePath} replace=${replace}, data=${data}`);
        try {
            await fsPromises.access(filePath);
            // File exists
            if (replace) {
                // Replace the file
                await fsPromises.writeFile(filePath, data);
                console.log(`Table schema replaced in ${filePath}`);
            } else {
                //console.log(`File ${filePath} already exists, skipping`);
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File does not exist, so write it
                await fsPromises.writeFile(filePath, data);
                console.log(`Table schema written to ${filePath}`);
            } else {
                // Some other error occurred
                console.error(`Error occurred: ${err}`);
            }
        }
    }

    async batchExec(batchCmds) {
        let cmdPromiseFn = []
        let cmdPromise = []
        for (const batchCmd of batchCmds) {
            cmdPromiseFn.push(batchCmd)
            cmdPromise.push(
                exec(batchCmd, {
                    maxBuffer: 1024 * 50000
                }))
        }

        let cmdStates;
        try {
            cmdStates = await Promise.allSettled(cmdPromise);
            //{ status: 'fulfilled', value: ... },
            //{ status: 'rejected', reason: Error: '.....'}
        } catch (e) {
            //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`batchExec error`, e, crawlerInitStates)
        }
        for (let i = 0; i < cmdStates.length; i += 1) {
            let cmdState = cmdStates[i]
            let cmdFn = cmdPromiseFn[i]
            if (cmdState.status != undefined && cmdState.status == "fulfilled") {
                console.log(`cmdState[${i}] fulfilled`, cmdState)
            } else {
                let rejectedReason = JSON.parse(JSON.stringify(cmdState['reason']))
                let errorStr = rejectedReason.message
                if (errorStr) {
                    console.log(`errorMsg`, errorStr)
                }
            }
        }
    }

    /*
        async bqLoadJob(jobInfo) {
            console.log(`loadBQ JOB`, jobInfo)
            const metadata = {
                sourceFormat: 'NEWLINE_DELIMITED_JSON',
                schema: {
                    fields: JSON.parse(jobInfo.tableSchema)
                },
                timePartitioning: {
                    type: 'DAY',
                    field: jobInfo.timePartitioningFld,
                },
                writeDisposition: 'WRITE_TRUNCATE',
          };
          const bigquery = this.get_big_query();
          const storage = this.get_google_storage();

          const [job] = await bigquery
            .dataset(jobInfo.evmDatasetID)
            .table(jobInfo.tableIdYYYYMMDD) // Appending $20230101 to load into the 2023-01-01 partition
            .load(storage.bucket(bucketName).file(filename), metadata);
            //.load(jobInfo.loadPath, metadata);
            console.log(`Job ${jobInfo.tableIdYYYYMMDD} ${job.id} started.`);
        }
    */

    async fetch_evmchain_rows(chainID, startBN, endBN) {
        let start = paraTool.blockNumberToHex(startBN);
        let end = paraTool.blockNumberToHex(endBN);
        let families = ["blocks", "logs", "traces", "transactions"]
        let startTS = new Date().getTime();
        const evmTableChain = this.getEvmTableChain(chainID);
        let [rows] = await evmTableChain.getRows({
            start: start,
            end: end,
            cellLimit: 1,
            family: families
        });

        let rowLen = rows.length
        let expectedLen = endBN - startBN + 1
        let missedBNs = []
        let rRows = []
        if (true) {
            let expectedRangeBNs = [];
            let observedBNs = []
            for (let i = startBN; i <= endBN; i++) {
                expectedRangeBNs.push(i);
            }
            for (let j = 0; j < rows.length; j++) {
                let blockNum = paraTool.dechexToInt(rows[j].id)
                let [isValid, rRow] = this.validate_evm_row(rows[j])
                if (isValid){
                    //console.log(`${rows[j].id} ${blockNum} is Valid`)
                    observedBNs.push(blockNum);
                    rRows.push(rRow)
                }
            }
            // await this.audit_chain(chain, startBN, endBN)
            // can we do a more robost audit_chain here?
            //console.log(`observedBNs`, observedBNs)
            missedBNs = expectedRangeBNs.filter(function(num) {
                return observedBNs.indexOf(num) === -1;
            });
        }
        console.log(`${startBN}(${start}), ${endBN}(${end}) expectedLen=${endBN - startBN+1} MISSING BNs`, missedBNs)
        return [rows, rRows, missedBNs]
    }

    async load_evm_etl(chainID, logDT) {
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(logDT)
        let rootDir = '/tmp'
        let localDir = `/tmp/evm_etl_local/${logYYYY_MM_DD}/${chainID}/`
        let remoteDir = `gs://evm_etl/${logYYYY_MM_DD}/${chainID}/`

        let projectID = "substrate-etl"
        let dataset = "crypto_evm";

        let tables = ["blocks", "transactions", "logs"]; // [ "contracts", "tokens", "token_transfers"]
        try {
            for (const tbl of tables) {
                let tblID = `${tbl}${chainID}`
                let fn = `${localDir}/${tbl}_*`
                let cmd = `bq load  --project_id=${projectID} --max_bad_records=10 --source_format=NEWLINE_DELIMITED_JSON --replace=true '${dataset}.${tbl}${chainID}$${logYYYYMMDD}' ${fn} schema/substrateetl/evm/${tbl}.json`;
                try {
                    console.log(cmd);
                    //await exec(cmd);
                } catch (err) {
                    console.log(`err`, err);
                }
            }
        } catch (e) {
            console.log(`err`, e);
        }
        return true
    }

    async index_evmchain_full(chainID, logDT) {
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(logDT)
        /*
         */
        let step3a_successful = await this.index_evmchain_only(chainID, logDT)
        if (!step3a_successful) {
            console.log(`Step3a index_evmchain_only failed`)
            process.exit(1)
        }
        let step3b_successful = await this.cpEvmDecodedToGS(logDT, chainID, false);
        if (!step3b_successful) {
            console.log(`Step3b cpEvmDecodedToGS failed`)
            process.exit(1)
        }
        let step3c_successful = await this.cpEvmETLToGS(logDT, chainID, false);
        if (!step3c_successful) {
            console.log(`Step3c cpEvmDecodedToGS failed`)
            process.exit(1)
        }

        let step3d_successful = await this.load_evm_etl(chainID, logDT);
        if (!step3d_successful) {
            console.log(`Step3d load_evm_etl failed`)
            process.exit(1)
        }
        let completedEvmStep = STEP3_indexEvmChainFull
        let updateSQL = `insert into blocklog (chainID, logDT, evmStep, evmStepDT) values ('${chainID}', '${currDT}', '${completedEvmStep}', NOW()) on duplicate key update evmStep = values(evmStep), evmStepDT = values(evmStepDT)`;
        this.batchedSQL.push(updateSQL);
        await this.update_batchedSQL();
    }


    async index_evmchain_only(chainID, logDT) {
        let crawler = new Crawler();
        crawler.setDebugLevel(paraTool.debugTracing)
        let chain = await crawler.getChain(chainID);
        let blockchainID = chain.chainID
        //let evmChainIDList = [1, 10, 56, 137, 42161, 43114]
        let evmChainIDList = [paraTool.chainIDEthereum, paraTool.chainIDOptimism, paraTool.chainIDPolygon,
            paraTool.chainIDMoonriverEVM, paraTool.chainIDMoonbeamEVM, paraTool.chainIDAstarEVM,
            paraTool.chainIDArbitrum, paraTool.chainIDAvalanche
        ]
        if (evmChainIDList.includes(blockchainID)) {
            await crawler.setupEvm(blockchainID)
        } else {
            console.log(`Invalid chainID`)
            process.exit(1)
        }
        let jmp = 50;
        let sql = `select startBN, endBN from blocklog where chainID = "${chainID}" and logDT = "${logDT}"`
        console.log(`index_evmchain sql`, sql)
        //TODO: how to make this hourly?
        let recs = await this.poolREADONLY.query(sql);
        let currPeriod = recs[0];
        if (currPeriod.startBN == undefined || currPeriod.endBN == undefined){
            console.log(`[${logDT}] chainID=${chainID} missing startBN, endBN`)
            process.exit(1)
        }
        let evmindexLogs = []
        let batches = []
        let errCnt = 0
        //delete previously generated files for chainID
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(logDT)
        let rootDir = '/tmp'
        let evmDecodedBasePath = `${rootDir}/evm_decoded/${logYYYY_MM_DD}/${chainID}/`
        let evmETLLocalBasePath = `${rootDir}/evm_etl_local/${logYYYY_MM_DD}/${chainID}/`
        //await crawler.deleteFilesWithChainID(evmDecodedBasePath, chainID)
        await crawler.deleteFilesFromPath(evmDecodedBasePath)
        await crawler.deleteFilesFromPath(evmETLLocalBasePath)

        for (let bn = currPeriod.startBN; bn <= currPeriod.endBN; bn += jmp) {
            let startBN = bn
            let endBN = bn + jmp - 1;
            if (endBN > currPeriod.endBN) endBN = currPeriod.endBN;
            let start = paraTool.blockNumberToHex(startBN);
            let end = paraTool.blockNumberToHex(endBN);
            console.log(`\nindex_blocks_period chainID=${chainID}, ${startBN}(${start}), ${endBN}(${end})`)
            let b = {
                start: start,
                end: end,
                startBN: startBN,
                endBN: endBN,
            }
            batches.push(b)
        }

        for (let i = 0; i < batches.length; i++) {
            // debug only
            if (i > 0) {
                //return
            }
            let b = batches[i]
            console.log(`batch#${i} ${b.startBN}(${b.start}), ${b.endBN}(${b.end}) expectedLen=${b.endBN - b.startBN+1}`)
            let [rows, rRows, missedBNs] = await this.fetch_evmchain_rows(chainID, b.startBN, b.endBN)

            //TODO: if missing, we need to get the missing blocks
            if (missedBNs.length > 0) {
                for (const missedBN of missedBNs) {
                    await crawler.crawl_block_evm(chainID, missedBN);
                }
                [rows, rRows, missedBNs] = await this.fetch_evmchain_rows(chainID, b.startBN, b.endBN)
            }
            //process.exit(0)
            for (let i = 0; i < rRows.length; i++) {
                try {
                    let rRow = rRows[i]
                    //console.log(`rRow`, rRow)
                    let r = await crawler.index_evm_chain_block_row(rRow, false);
                } catch (err) {
                    console.log(err)
                    //this.log_indexing_error(err, `index_blocks_period`);
                }
            }
        }

        // need somekind of flush here

        /*
        TODO: write via memory map
        let evmindexLog = `('${chainID}','${tableID}', '${logDT}', '${numRecords}', NOW())`
        let indexlogvals = ["numRecords", "lastUpdateDT"];
        if (evmindexLogs.length > 0) {
            await this.upsertSQL({
                "table": "evmlog",
                "keys": ["chainID", "tableID", "logDT"],
                "vals": indexlogvals,
                "data": evmindexLogs,
                "replace": indexlogvals
            });
        }
        */
        if (errCnt == 0) {
            return true
        } else {
            return false
        }
    }

    async cpEvmETLToGS(dt, chainID = 1, dryRun = true) {
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(dt)
        let rootDir = '/tmp'
        let localDir = `/tmp/evm_etl_local/${logYYYY_MM_DD}/${chainID}/`
        let remoteDir = `gs://evm_etl/${logYYYY_MM_DD}/${chainID}/`
        //let gsRemoveCmd = `gsutil rm -r ${remoteDir}`
        //let gsCopyCmd = `gsutil -m cp -r ${localDir}/* ${remoteDir}`
        let gsReplaceLoadCmd = `gsutil -m rsync -r -d ${localDir} ${remoteDir}`
        console.log(gsReplaceLoadCmd)
        let errCnt = 0
        if (!dryRun) {
            try {
                let res = await exec(gsReplaceLoadCmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`res`, res)
            } catch (e) {
                console.log(`${e.toString()}`)
                errCnt++
            }
        }
        return true
    }

    //load evm_decoded to gs
    async cpEvmDecodedToGS(dt, chainID = 1, dryRun = true) {
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(dt)
        let rootDir = '/tmp'
        let cmd = `gsutil -m cp -r ${rootDir}/evm_decoded/${logYYYY_MM_DD}/${chainID}/* gs://evm_decoded/${logYYYY_MM_DD}/`
        console.log(cmd)
        let errCnt = 0
        if (!dryRun) {
            try {
                let res = await exec(cmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`res`, res)
            } catch (e) {
                console.log(`${e.toString()}`)
                errCnt++
            }
        }
        return true
    }

    async loadGSEvmDecoded(dt, chainID = null) {
        let project_id = 'substrate-etl'
        let evmDatasetID = this.evmDatasetID
        await this.initEvmLocalSchemaMap()
        await this.generateTableSchemaJSON()
        let [logTS, logYYYYMMDD, currDT, prevDT, logYYYY_MM_DD] = this.getAllTimeFormat(dt)
        let fns = await this.fetch_gs_file_list(logYYYY_MM_DD)
        console.log(`fns`, fns)
        if (!fns) {
            console.log(`${logYYYY_MM_DD} evm_decoded not found`)
            return
        }
        let loadCmds = []
        let loadJobs = []
        let errCnt = 0
        for (const fn of fns) {
            //gs://evm_decoded/2023/05/11/evt_Transfer_0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef_1/1.json
            let tableId = fn.split('/')[6]
            let tableInfo = this.evmLocalSchemaMap[tableId]
            if (tableInfo != undefined) {
                //console.log(`tableId ${tableId} Schema:`, tableInfo.tableSchema)
                await this.writeTableSchemaJSON(tableId, tableInfo.tableSchema)
                let rootDir = '/disk1'
                let jsonFN = `${rootDir}/evmschema/${tableId}.json`
                let timePartitioningFld = (tableId.substr(0, 4) == 'call') ? "call_block_time" : "evt_block_time"
                //bq load --project_id=substrate-etl --replace --source_format=NEWLINE_DELIMITED_JSON 'evm_test.evt_Transfer_0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef_3$20230501' gs://evm_decoded/2023/05/01/evt_Transfer_0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef_3/*.json   '<JSON_SCHEMA>'
                let loadCmd = `bq load --nosynchronous_mode --max_bad_records=100 --project_id=${project_id} --replace --time_partitioning_type=DAY --time_partitioning_field=${timePartitioningFld} --source_format=NEWLINE_DELIMITED_JSON '${evmDatasetID}.${tableId}$${logYYYYMMDD}' ${fn} ${jsonFN}`
                loadCmds.push(loadCmd)
                let jobInfo = {
                    evmDatasetID: evmDatasetID,
                    tableIdYYYYMMDD: `${tableId}$${logYYYYMMDD}`,
                    tableSchema: tableInfo.tableSchema,
                    timePartitioningFld: timePartitioningFld,
                    loadPath: `${fn}`,
                }
                loadJobs.push(jobInfo)
            } else {
                console.log(`tableId ${tableId} missing schema`)
            }
        }
        for (const loadJob of loadJobs) {
            //await this.bqLoadJob(loadJob)
        }
        for (const loadCmd of loadCmds) {
            console.log(loadCmd)
        }
        let i = 0;
        let n = 0
        let batchSize = 20; // safety check
        let totalLen = loadCmds.length
        let processedLen = 0
        while (i < loadCmds.length) {
            let currBatchLoads = loadCmds.slice(i, i + batchSize);
            processedLen += currBatchLoads.length
            console.log(`currBatchLoads#${n} ${processedLen}/${totalLen}`, currBatchLoads)
            if (currBatchLoads.length > 0) {
                await this.batchExec(currBatchLoads)
                i += batchSize;
                n++
            }
        }

        if (errCnt == 0 && chainID != null) {
            let completedEvmStep = STEP4_loadGSEvmDecoded
            let updateSQL = `insert into blocklog (chainID, logDT, evmStep, evmStepDT) values ('${chainID}', '${currDT}', '${completedEvmStep}', NOW()) on duplicate key update evmStep = values(evmStep), evmStepDT = values(evmStepDT)`;
            this.batchedSQL.push(updateSQL);
            await this.update_batchedSQL();
        }
    }

    async loadProjectViews() {
        let sql = `select distinct datasetId from projectdatasetcolumns`
        let sqlRecs = await this.poolREADONLY.query(sql);
        for (const r of sqlRecs) {
            console.log(r.datasetId);
            try {
                await this.load_project_views(r.datasetId);
            } catch (err) {
                console.log(err);
            }
        }
    }

    binarySearch(ar, el, compare_fn) {
        var m = 0;
        var n = ar.length - 1;
        if (m > n) return (false);

        while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compare_fn(el, ar[k]);

            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                return ar[k];
            }
        }
        let r = m - 1;

        if (r < 0) return ar[0];
        if (r > ar.length - 1) {
            return ar[ar.length - 1];
        }
        return ar[r];
    }

    async get_blockTS(chain, bn) {
        let hexBlocknumber = "0x" + parseInt(bn, 10).toString(16);
        // do
        let cmd = `curl --silent -H "Content-Type: application/json" --max-time 1800 --connect-timeout 60 -d '{
    "jsonrpc": "2.0",
    "method": "eth_getBlockByNumber",
    "params": ["${hexBlocknumber}", true],
    "id": 1
  }' "${chain.RPCBackfill}"`
        const {
            stdout,
            stderr
        } = await exec(cmd, {
            maxBuffer: 1024 * 64000
        });
        let res = JSON.parse(stdout);
        if (res.result && res.result.timestamp) {
            return paraTool.dechexToInt(res.result.timestamp);
        }
        return null;
    }
    async detectBlocklogBounds(chainID, logDT, startBN = 29983413, endBN = 30508689) {
        let chain = await this.getChain(chainID);

        let m = startBN;
        let n = endBN;
        if (m > n) return (false);

        let startTS = paraTool.logDT_hr_to_ts(logDT, 0);
        let endTS = startTS + 86400 - 1;

        while (m <= n) {
            var k = (n + m) >> 1;
            let blockTS = await this.get_blockTS(chain, k);
            var cmp = startTS - blockTS;
            console.log("chain", k, blockTS, "m", m, "n", n, "cmp", cmp, "STARTTS", startTS);
            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                m = k;
                n = k;
                break;
            }
        }
        startBN = n;

        m = startBN;
        n = endBN;
        while (m <= n) {
            var k = (n + m) >> 1;
            let blockTS = await this.get_blockTS(chain, k);
            var cmp = endTS - blockTS;
            console.log("chain", k, blockTS, "m", m, "n", n, "cmp", cmp, "ENDTS", endTS);
            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                m = k;
                n = k;
                break;
            }
        }
        endBN = n;

        let sql = `insert into blocklog (chainID, logDT, startBN, endBN) values ('${chainID}', '${logDT}', '${startBN}', '${endBN}') on duplicate key update startBN = values(startBN), endBN = values(endBN)`;
        console.log(sql);
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
        process.exit(0);
    }


    async load_project_views(datasetId = null, projectId = 'blockchain-etl-internal') {
        let query = `select table_name, view_definition from  \`blockchain-etl-internal.${datasetId}.INFORMATION_SCHEMA.VIEWS\``;
        console.log(query);
        const bigquery = this.get_big_query();
        let recs = await this.execute_bqJob(query);
        for (const r of recs) {
            let sa = r.table_name.split("_");
            let abiType = "";
            let contractName = "";
            let name = "";
            let idx = null;
            for (let i = 0; i < sa.length; i++) {
                if ((sa[i] == "event") || sa[i] == "call" || sa[i] == "swaps") {
                    idx = i;
                    i = sa.length;
                }
            }
            if (idx == null) {
                console.log("FAILED to parse table name", r.table_name, "datasetId", projectId, datasetId);
            } else {
                abiType = sa[idx];
                contractName = sa.slice(0, idx).join("_");
                name = sa.slice(idx + 1).join("_");
                //console.log('contractName', contractName, "abitype", abiType, "name", name)
            }
            let view_definition = r.view_definition;
            const regex = /address in([\s\S]*?)\n/
            const match = view_definition.match(regex);
            let addressSQL = "";
            if (match && match[1]) {
                addressSQL = match[1];
            }
            let sql = `insert into projectdatasetviews ( projectId, datasetId, table_name, view_definition, contractName, abiType, name, addDT, addressSQL ) values ( '${projectId}', '${datasetId}', '${r.table_name}', ${mysql.escape(r.view_definition)},  ${mysql.escape(contractName)}, ${mysql.escape(abiType)}, ${mysql.escape(name)}, Now(), ${mysql.escape(addressSQL)} ) on duplicate key update contractName = values(contractName), abiType = values(abiType), name = values(name), addressSQL = values(addressSQL)`
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
        }
    }
}
