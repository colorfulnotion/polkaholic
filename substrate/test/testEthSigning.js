const util = require('util');
const abiDecoder = require('abi-decoder');
const ethTool = require("../ethTool");
const paraTool = require("../paraTool");
const Crawler = require("../crawler");
const fs = require('fs');

function loadTestKey(FN = "/root/.walletevm2", name = "evm") {
    var pk = fs.readFileSync(FN, 'utf8');
    pk = pk.replace(/\r|\n/g, '');
    console.log(`p=${pk}`)
    return ethTool.loadWallet(pk)
}

async function main() {
    var crawler = new Crawler();
    var contractABIs = await crawler.getContractABI()
    var apiEndpoint = 'https://rpc.api.moonbeam.network'
    //var apiEndpoint = 'https://rpc.api.moonbase.moonbeam.network'
    var web3Api = await ethTool.createWeb3Api(apiEndpoint)
    //var web3SamplePV = '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709' //https://web3js.readthedocs.io/en/v1.2.11/web3-eth-accounts.html [DO NOT send real fund]
    //var w = ethTool.loadWallet(web3SamplePV)
    var w = loadTestKey()
    var recipient = '0x9e254014f7eeba3f11fc4903c15763a7ae02269f'
    /*
    var txStruct = {
        to: recipient,
        value: '0',
        gas: 2000000
    }
    */
    //var signedTx = await web3Api.eth.accounts.signTransaction(txStruct, w.privateKey)
    //xTokenBuilder(web3Api, currencyAddress, amount, decimal, beneficiary)
    let currencyAddress = '0x0000000000000000000000000000000000000802'
    let amount = 1.0
    let decimals = 18
    let beneficiary = '0xd2473025c560e31b005151ebadbc3e1f14a2af8fa60ed87e2b35fa930523cd3c'
    let chainIDDest = paraTool.chainIDAstar
    var txStruct = ethTool.xTokenBuilder(web3Api,currencyAddress, amount, decimals, beneficiary, chainIDDest)
    var signedTx = await ethTool.signEvmTx(web3Api, txStruct, w)
    var decodedTx = ethTool.decodeRLPTransaction(signedTx.rawTransaction)
    console.log(`signedTx`, signedTx)
    console.log(`decodedTx`, decodedTx)
    //var result = await ethTool.sendSignedTx(web3Api, signedTx)
    //console.log(`signedTX result`, result)
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
