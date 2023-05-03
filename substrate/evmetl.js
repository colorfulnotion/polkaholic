const PolkaholicDB = require("./polkaholicDB");
const mysql = require("mysql2");
var SqlString = require('sqlstring');
const util = require('util');
// Uses Ankr API to crawl blocks for ETH style chains to store blocks and txs in the BASEDIR
const exec = util.promisify(require('child_process').exec);

const ethTool = require("./ethTool");
const paraTool = require("./paraTool");
const path = require('path');

const fs = require('fs');
const readline = require('readline');

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

    evmSchemaMap = {}; //by tableId
    evmFingerprintMap = {}; //by fingerprintID
    evmDatasetID = "evm_dev"; /*** FOR DEVELOPMENT: change to evm_test ***/
    evmBQLocation = "us";

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
        let evm_chain_name = (chain && chain.id && chain.isEVM)? chain.id : false
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
        if (sqlRecs.length == 1){
            projectInfo = sqlRecs[0]
        }else{
            console.log(`chainID=${chainID}, address=${address}, project=${project}, contractName=${contractName} projectInfo NOT FOUND`)
            return false
        }
        console.log(`chainID=${chainID}, address=${address}, project=${project}, contractName=${contractName} projectInfo`, projectInfo)
        let projectContractName = projectInfo.address.toLowerCase() //If projectName is unknown everywhere, use contractAddress
        if (projectInfo.etherscanContractName){
            // Contract parser by default fetch the etherscanContractName as contractName
            projectContractName = projectInfo.etherscanContractName
        }
        if (projectInfo.contractName){
            // Overwrite with our contractName if specified
            projectContractName = projectInfo.contractName
        }
        if (projectInfo.customContractName){
            // Overwrite with our customContractName if specified
            projectContractName = projectInfo.customContractName
            //TODO: need to link to other virtual table
        }

        var sigs = {};
        let contractABIStr = (projectInfo.proxyAbiRaw)?  projectInfo.proxyAbiRaw : projectInfo.abiRaw
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
        for (const e of output){
            var fingerprintID = e.fingerprintID
            let modifiedFingerprintID = ethTool.computeModifiedFingerprintID(fingerprintID)
            sigs[fingerprintID] = e;
            if (e.abiType == 'function' && e.stateMutability != 'view'){
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
                if (callMap[k] == undefined){
                    callMap[k] = e
                }else{
                    console.log(`WARNING k not unique! modifiedFingerprintID`, modifiedFingerprintID)
                    callMap[k] = e
                }

            }else if (e.abiType == 'event'){
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
                if (eventMap[k] == undefined){
                    eventMap[k] = e
                }else{
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

        let datasetID = (evm_chain_name)?  `${evm_chain_name}_${projectInfo.projectName}` : `${projectInfo.projectName}`

        //TODO: create datasetID when missing
        await this.create_dataset(datasetID)
        let isAggregate = (projectInfo.isAggregate)? true : false
        let targetContractAddress = (!isAggregate)? projectInfo.address: null

        let viewCmds = []
        for (const eventKey of Object.keys(eventMap)){
            let eventTableInfo = eventMap[eventKey]
            if (projectInfo.projectName){
                let viewCmd = await this.createProjectContractView(eventTableInfo, targetContractAddress, isAggregate, datasetID)
                if (viewCmd){
                    viewCmds.push(viewCmd)
                }
            }
        }

        for (const callKey of Object.keys(callMap)){
            let callTableInfo = callMap[callKey]
            if (projectInfo.projectName){
                let viewCmd = await this.createProjectContractView(callTableInfo, targetContractAddress, isAggregate, datasetID)
                if (viewCmd){
                    viewCmds.push(viewCmd)
                }
            }
        }

        for (const cmd of viewCmds){
            console.log(cmd);
            try {
                let res = await exec(cmd, {
                    maxBuffer: 1024 * 64000
                });
                console.log(`res`, res)
            } catch (e){
                console.log(`${e.toString()}`)
            }
        }
    }

    getTableIDFromFingerprintID(fingerprintID, to_address = null) {
        let tableID = null;
        let subTableIDInfo = null;
        let a = (to_address) ? to_address.toLowerCase(): '';
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
        let tablesRecs = await this.execute_bqJob(query, paraTool.BQUSMulti);
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

    async createProjectContractView(tableInfo, contractAddress = "0x1f98431c8ad98523631ae4a59f267346ea31f984", isAggregate = false, datasetID = 'ethereum_uniswap'){
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

        if (!tableInfo.devFlds){
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
        let timePartitionField = (tableInfo.abiType == 'function')? "call_block_time" : "evt_block_time"

        let condFilter = ''
        if (!isAggregate){
            condFilter = `and Lower(contract_address) = "${contractAddress}"`
        }
        let subTbl = `with dev as (SELECT * FROM \`${bqProjectID}.${bqDataset}.${tableInfo.devTabelId}\` WHERE DATE(${timePartitionField}) = current_date() ${condFilter})`
        //building view
        let sql =  `${subTbl} select ${fldStr} from dev`
        sql = paraTool.removeNewLine(sql)
        let sqlViewCmd = `bq mk --project_id=${bqProjectID} --use_legacy_sql=false --expiration 0  --description "${datasetID} ${tableInfo.name} -- ${tableInfo.signature}"  --view  '${sql}' ${datasetID}.${tableInfo.etlTableId} `
        console.log(sqlViewCmd)
        return sqlViewCmd
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
                if (proxyAddress != address){
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
            let recs = await this.execute_bqJob(query, paraTool.BQUSCentral1); //todo: change evm data location
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
            let recs = await this.execute_bqJob(query, paraTool.BQUSCentral1);  //todo: change evm data location
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
            let row = `('${data.fingerprintID}', '${data.secondaryID}', '${data.signatureID}', '${data.signatureRaw}', '${data.signature}', '${data.name}', '${data.abi}', '${data.abiType}', '${data.topicLength}', '1', '0', NOW())`
            abiRows.push(row);
            console.log(`[${data.name}] ${row}`)
        }
        let sqlDebug = true
        await this.upsertSQL({
            "table": "contractabi",
            "keys": ["fingerprintID"],
            "vals": ["secondaryID", "signatureID", "signatureRaw", "signature", "name", "abi", "abiType", "topicLength", "audited", "outdated", "firstSeenDT"],
            "data": abiRows,
            "replace": ["secondaryID", "signatureID", "signatureRaw", "signature", "name", "abi", "abiType", "topicLength", "audited", "outdated", ],
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

    async create_dataset(detasetID = `evm_dev`, projectID = `substrate-etl`){
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
            } catch (e2){
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
            let recs = await this.execute_bqJob(query, paraTool.BQUSCentral1);  //todo: change evm data location
            for (const r of recs) {
                let sql0 = `update contractabi set numTransactions = '${r.numTransactions}' where signature = '${r.signature}'`
                console.log(sql0);
                this.batchedSQL.push(sql0);
                await this.update_batchedSQL()
            }
            return (true);
            query = `SELECT signature, count(*) numLogs FROM \`substrate-etl.evm.logs\` as logs  where logs.chain_id = ${chainID} and block_timestamp >= date_sub(current_timestamp(), interval 24 hour)  group by signature order by count(*) desc;`;
            recs = await this.execute_bqJob(query, paraTool.BQUSCentral1);  //todo: change evm data location
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

    async crawlABIs(chainID = null, renew = false) {
        //evm table is still in us-centra1
        let w = chainID ? ` and chainID = ${chainID}` : ""
        let query = `select to_address, min(chain_id) as chainID,  count(*) numTransactions7d from substrate-etl.evm.transactions where block_timestamp > date_sub(CURRENT_TIMESTAMP(), interval 7 day) and length(input) > 2 and length(method_id) >= 10 group by to_address order by numTransactions7d desc limit 100000`;
        let recs = renew ? await this.execute_bqJob(query, paraTool.BQUSCentral1) : [];
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
        let tablesRecs = await this.execute_bqJob(schemaQuery, paraTool.BQUSMulti);
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
        let recs = await this.execute_bqJob(sql, paraTool.BQUSCentral1);
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
            /*
            const options = {
                query: query,
                location: 'US'
            };
            */
            const bigquery = this.get_big_query();
            let recs = await this.execute_bqJob(query, paraTool.BQUSMulti);
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
                let recs = await this.execute_bqJob(query, paraTool.BQUSMulti);
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

    async dryrun(query = "SELECT count(`extrinsic_id`) AS `COUNT_extrinsic_id__a7d70` FROM `contracts`.`contractscall` LIMIT 50000") {
        console.log(query);

        const options = {
            query: query,
            // Location must match that of the dataset(s) referenced in the query.
            location: this.evmBQLocation,
            dryRun: true,
        };
        const bigquery = this.get_big_query();
        const [job] = await bigquery.createQueryJob(options);
        console.log(JSON.stringify(job.metadata));
    }

}
