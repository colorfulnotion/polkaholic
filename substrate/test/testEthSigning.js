const util = require('util');
const abiDecoder = require('abi-decoder');
const ethTool = require("../ethTool");
const paraTool = require("../paraTool");
const Crawler = require("../crawler");
const fs = require('fs');
var crawler = new Crawler()

const moonbeamRPC = 'https://rpc.api.moonbeam.network'
const moonriverRPC = 'https://rpc.api.moonriver.moonbeam.network'
const moonbaseRPC = 'https://rpc.api.moonbase.moonbeam.network'

const astarRPC = 'https://rpc.astar.network:8545'
const shidenRPC = 'https://rpc.shiden.astar.network:8545'
const shibuyaRPC = 'https://evm.shibuya.astar.network'

function loadTestKey(FN = "/root/.walletevm2", name = "evm") {
    var pk = fs.readFileSync(FN, 'utf8');
    pk = pk.replace(/\r|\n/g, '');
    console.log(`p=${pk}`)
    return ethTool.loadWallet(pk)
}

async function testSimpleEvmTx(apiEndpoint = moonbeamRPC, isBroadcast = false) {
    var crawler = new Crawler();
    var contractABIs = await crawler.getContractABI()
    var web3Api = await ethTool.createWeb3Api(apiEndpoint)
    var recipient = '0x9e254014f7eeba3f11fc4903c15763a7ae02269f'
    var w = loadTestKey()
    /*
    var web3SamplePV = '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709' //https://web3js.readthedocs.io/en/v1.2.11/web3-eth-accounts.html [DO NOT send real fund]
    var w = ethTool.loadWallet(web3SamplePV)
    */
    var txStruct = {
        to: recipient,
        value: '1234',
        gas: 2000000
    }
    var signedTx = await ethTool.signEvmTx(web3Api, txStruct, w)
    var decodedTx = ethTool.decodeRLPTransaction(signedTx.rawTransaction)
    console.log(`signedTx`, signedTx)
    console.log(`decodedTx`, decodedTx)
    if (isBroadcast) {
        var result = await ethTool.sendSignedTx(web3Api, signedTx)
        console.log(`signedTX result`, result)
    }
}

async function testXTokenBuilder(apiEndpoint = moonbeamRPC, isbeneficiaryEVM = false, isBroadcast = false) {
    var crawler = new Crawler();
    var contractABIs = await crawler.getContractABI()

    var web3Api = await ethTool.createWeb3Api(apiEndpoint)
    var recipient = '0x9e254014f7eeba3f11fc4903c15763a7ae02269f'
    var w = loadTestKey()

    //xTokenBuilder(web3Api, currencyAddress, amount, decimal, beneficiary)
    let currencyAddress = '0x0000000000000000000000000000000000000802'
    let amount = 0.26
    let decimals = 18
    let beneficiarySubtrate = '0xd2473025c560e31b005151ebadbc3e1f14a2af8fa60ed87e2b35fa930523cd3c'
    let beneficiaryEVM = '0xeaf3223589ed19bcd171875ac1d0f99d31a5969c'
    let beneficiary = (isbeneficiaryEVM) ? beneficiaryEVM : beneficiarySubtrate
    let chainIDDest = paraTool.chainIDAstar
    var txStruct = ethTool.xTokenBuilder(web3Api, currencyAddress, amount, decimals, beneficiary, chainIDDest)
    var signedTx = await ethTool.signEvmTx(web3Api, txStruct, w)
    var decodedTx = ethTool.decodeRLPTransaction(signedTx.rawTransaction)
    console.log(`signedTx`, signedTx)
    console.log(`decodedTx`, decodedTx)
    if (isBroadcast) {
        var result = await ethTool.sendSignedTx(web3Api, signedTx)
        console.log(`signedTX result`, result)
    }
}

async function testXC20Builder(apiEndpoint = astarRPC, isbeneficiaryEVM = false, isBroadcast = false) {
    var crawler = new Crawler();
    var contractABIs = await crawler.getContractABI()

    var web3Api = await ethTool.createWeb3Api(apiEndpoint)
    var recipient = '0x9e254014f7eeba3f11fc4903c15763a7ae02269f'
    var w = loadTestKey()

    //xc20AssetWithdrawBuilder(web3Api, currencyAddress, amount, decimal, beneficiary)
    let currencyAddress = '0xFFFFFFFF00000000000000010000000000000003' //GLMR
    let amount = 0.26
    let decimals = 18
    let beneficiarySubtrate = '0xd2473025c560e31b005151ebadbc3e1f14a2af8fa60ed87e2b35fa930523cd3c'
    let beneficiaryEVM = '0xeaf3223589ed19bcd171875ac1d0f99d31a5969c'
    let beneficiary = (isbeneficiaryEVM) ? beneficiaryEVM : beneficiarySubtrate
    let chainIDDest = paraTool.chainIDMoonbeam
    var txStruct = ethTool.xc20AssetWithdrawBuilder(web3Api, currencyAddress, amount, decimals, beneficiary, chainIDDest)
    var signedTx = await ethTool.signEvmTx(web3Api, txStruct, w)
    var decodedTx = ethTool.decodeRLPTransaction(signedTx.rawTransaction)
    console.log(`signedTx`, signedTx)
    console.log(`decodedTx`, decodedTx)
    if (isBroadcast) {
        var result = await ethTool.sendSignedTx(web3Api, signedTx)
        console.log(`signedTX result`, result)
    }
}

async function main() {
    let isbeneficiaryEVM = 1
    let isBroadcast = 0
    //await testSimpleEvmTx(moonbaseRPC, isBroadcast)
    await testXC20Builder(astarRPC, isbeneficiaryEVM, isBroadcast)
    //await testXTokenBuilder(moonbeamRPC, isbeneficiaryEVM, isBroadcast)
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });