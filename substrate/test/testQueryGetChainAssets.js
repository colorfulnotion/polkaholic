#!/usr/bin/env node
 // Usage:  getChainAssets
const Query = require("../query");
var ParaTool = require("../paraTool");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let chainID = ParaTool.chainIDKarura;
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            chainID = parseInt(val, 10);
        }
    });
    var a = await query.getChainAssets(chainID);
    console.log(JSON.stringify(a));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });