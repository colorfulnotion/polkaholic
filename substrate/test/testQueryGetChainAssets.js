#!/usr/bin/env node
 // Usage:  getChainAssets
const Query = require("../query");
var ParaTool = require("../paraTool");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let chainID = ParaTool.chainIDPolkadot;
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            chainID = parseInt(val, 10);
        }
    });
    let address = "0x2c8feeab5bd9a317375e01adb6cb959f1fea78c751936d556fa2e36ede425a47";
    //var chainassets = await query.getChainAssets(chainID, address);
    //console.log(JSON.stringify(chainassets));

    var symbolassets = await query.getSymbolAssets("DOT", address);
    console.log(JSON.stringify(symbolassets));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
