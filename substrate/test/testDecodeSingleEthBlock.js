const util = require('util');
const abiDecoder = require('abi-decoder');
const ethTool = require("../ethTool");
const Crawler = require("../crawler");

async function main() {
    var crawler = new Crawler();
    var contractABIs = await crawler.getContractABI()
    var apiEndpoint = 'https://rpc.api.moonbeam.network'
    var web3Api = await ethTool.createWeb3Api(apiEndpoint)

    let startBN = 506717
    let endBN = startBN + 10
    for (let bn = startBN; bn <= endBN; bn++) {
        var blk = await ethTool.crawlEvmBlock(web3Api, bn)
        var evmReceipts = await ethTool.crawlEvmReceipts(web3Api, blk)
        var decodedReceipts = ethTool.processReceipts(evmReceipts, contractABIs)
        let successEventCnt = 0;
        let unknownEventCnt = 0;
        let decodeErrEventCnt = 0
        for (const decodedReceipt of decodedReceipts) {
            for (const dLogs of decodedReceipt.decodedLogs) {
                if (dLogs.decodeStatus == 'unknown') {
                    unknownEventCnt++
                } else if (dLogs.decodeStatus == 'error') {
                    decodeErrEventCnt++
                } else {
                    successEventCnt++
                }
            }
        }
        let totalEventCnt = unknownEventCnt + successEventCnt + decodeErrEventCnt
        console.log(`[#${bn}] ${blk.hash} txnCnt=${evmReceipts.length} , Success=${successEventCnt}/ Unknown=${unknownEventCnt} / DecodeErr=${decodeErrEventCnt} / Total=${totalEventCnt}`)
        let fBlk = ethTool.processBlockAndReceipt(blk, evmReceipts, contractABIs)
        console.log(`${JSON.stringify(fBlk)}`)
        await crawler.sleep(1000);
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });