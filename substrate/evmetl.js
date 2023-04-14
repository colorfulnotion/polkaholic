const PolkaholicDB = require("./polkaholicDB");
const mysql = require("mysql2");
var SqlString = require('sqlstring');
const util = require('util');
// Uses Ankr API to crawl blocks for ETH style chains to store blocks and txs in the BASEDIR
const exec = util.promisify(require('child_process').exec);

const ethTool = require("./ethTool");

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
            this.batchedSQL.push(`update abirepo set status = 'Unverified' where address = '${address}'`);
            await this.update_batchedSQL();
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
        if (abiRaw) {
            flds.push(`'${address}'`);

            vals.push('status');
            flds.push(`'Found'`);
            replace.push("status");

            vals.push('foundDT');
            flds.push(`Now()`);
            replace.push("foundDT");

            vals.push('abiRaw');
            flds.push(`${mysql.escape(JSON.stringify(j))}`);
            replace.push("abiRaw");

            let abi = JSON.parse(j.result);
            let proxyAddress = null;
            if (proxyAddress = await this.get_proxy_address(address, chainID)) {
                let proxyABI = await this.crawlABI(proxyAddress, chainID, project, contractName);
                if (proxyABI) {
                    console.log("proxyABI", proxyABI);
                    if (proxyABI && proxyABI.status == 1) {
                        j = proxyABI;
                        vals.push('proxyAddress');
                        flds.push(`${mysql.escape(proxyAddress)}`);
                        replace.push("proxyAddress");

                        vals.push('proxyAddressLastUpdateDT');
                        flds.push(`Now()`);
                        replace.push("proxyAddressLastUpdateDT");
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

            await this.loadABI(j.result)

        } else {
            this.batchedSQL.push(`update abirepo set lastAttemptDT = Now(), attempted = attempted + 1 where address = '${address}'`);
            await this.update_batchedSQL();
        }
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
        //return
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
        let cmd = `bq --location=us-central1 mk --dataset --description="DESCRIPTION" ${projectID}:${detasetID}`
        try {
            console.log(cmd);
            //await exec(cmd);
        } catch (e) {
            // TODO optimization: do not create twice
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

    async getAlltables(detasetID = `evm_dev`, projectID = `substrate-etl`) {
        let fullTableIDs = []
        let bqCmd = `bq ls --max_results 1000000 --project_id=${projectID} --dataset_id="${detasetID}" --format=json | jq -r '.[].tableReference.tableId' > schema/substrateetl/evm/callevenets.txt`
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

    async crawlABIs(chainID = null, renew = true) {
        let w = chainID ? ` and chainID = ${chainID}` : ""
        let sql = `select to_address, min(chain_id) as chainID,  count(*) numTransactions7d from substrate-etl.evm.transactions where block_timestamp > date_sub(CURRENT_TIMESTAMP(), interval 7 day) and length(input) > 2 and length(method_id) >= 10 group by to_address order by numTransactions7d desc limit 100000`;
        let recs = renew ? await this.execute_bqJob(sql) : [];
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
        sql = `select address, chainID from abirepo where status = 'Unknown' and ( lastAttemptDT is null or lastAttemptDT < DATE_SUB(Now(), INTERVAL POW(5, attempted) MINUTE) ) and numTransactions7d > 3 ${w} order by numTransactions7d desc, chainID asc limit 1000`;
        var res = await this.poolREADONLY.query(sql);
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

        let tablesRecs = await this.execute_bqJob(`SELECT table_name, column_name, data_type FROM substrate-etl.${datasetId}.INFORMATION_SCHEMA.COLUMNS  where table_name like 'call_%'  or table_name like 'evt_%'`);
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
                            location: 'us-central1',
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
}
