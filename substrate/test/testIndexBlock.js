const Crawler = require("../crawler");
const {
    ApiPromise,
    WsProvider
} = require('@polkadot/api');
const paraTool = require("../paraTool");
const {
    hexToU8a,
    compactStripLength,
    hexToBn
} = require("@polkadot/util");

async function main() {
    var crawler = new Crawler();
    await crawler.assetManagerInit();
    let chainID = 22007;
    let blockNumber = 2253533;
    chainID = 22023;
    blockNumber = 2499781;
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            chainID = parseInt(val, 10);
        }
        if (index == 3 && val.length > 0) {
            blockNumber = parseInt(val, 10);
        }
    });
    crawler.chainID = chainID;
    let chain = await crawler.getChain(chainID);
    await crawler.setupAPI(chain);
    let r = await crawler.index_block(chain, blockNumber);
    console.log(JSON.stringify(r.block));
    console.log(r.blockStats);

}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });