const PolkaholicDB = require("./polkaholicDB");
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

    async crawlABI(address, chainID = 1, project = null, contractName = null) {
	let cmd = null;
	console.log("CRAWLABI", address, chainID, project, contractName);
	switch ( chainID ) {
	case 1:
	    cmd = `curl -k -s -X GET 'https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${this.EXTERNAL_APIKEYS["ethereum"]}'`;
	    break;
	case 10:
	    cmd = `curl -k -s -X GET 'https://api-optimistic.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${this.EXTERNAL_APIKEYS["optimism"]}'`;
	    break;
	case 2004:
	    cmd = `curl -k -s -X GET 'https://api-moonbeam.moonscan.io/api?module=contract&action=getabi&address=${address}&apikey=${this.EXTERNAL_APIKEYS["moonbeam"]}'`;
	    break;
	case 137:
	    cmd = `curl -k -s -X GET 'https://api.polygonscan.com/api?module=contract&action=getabi&address=${address}&apikey=${this.EXTERNAL_APIKEYS["polygon"]}'`;
	    break;
	case 42161:
	    cmd = `curl -k -s -X GET 'https://api.arbiscan.io/api?module=contract&action=getabi&address=${address}&apikey=${this.EXTERNAL_APIKEYS["arbitrum"]}'`;
	    break;
	case 43114:
	    cmd = `curl -k -s -X GET 'api.avascan.info/v2/network/mainnet/evm/${chainID}/etherscan?module=contract&action=getabi&address=${address}'`;
	    break;
	}
	if ( cmd == null ) {
	    console.log("No api available for chainID", chainID);
	    return(false);
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
	if ( project ) {
	    vals.push('project');
	    flds.push(`${mysql.escape(project)}`);
	    replace.push("project");
	}
	if ( contractName ) {
	    vals.push('contractName');
	    flds.push(`${mysql.escape(contractName)}`);
	    replace.push("contractName");
	}
	if ( abiRaw ) {
	    vals.push('abiRaw');
	    flds.push(`${mysql.escape(JSON.stringify(j))}`);
	    replace.push("abiRaw");
	    await this.loadABI(j.result)
	}
	if ( flds.length > 0 ) {
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
    }

    async getTokenInfo(address = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", chainID = 1) {
	const util = require("util");
	const exec = util.promisify(require("child_process").exec);
	
	const url = "https://api.etherscan.io/api?module=token&action=tokeninfo&contractaddress=${address}&apikey=CMKYIM5MEM2IH7CTTADGFKW47P3SMKDF6D";
	const cmd = "curl -k -s -X GET '" + url + "'";
	
	const { stdout, stderr } = await exec(cmd);
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

    async reloadABI() {
        let sql = `select abiType, name, signatureID, abi from contractabi where abi like '%component%';`
        //if (this.debugLevel >= paraTool.debugTracing) console.log(`getBlockRangebyTS`, sql)
        var res = await this.poolREADONLY.query(sql);
        if (res.length > 0) {
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
}
