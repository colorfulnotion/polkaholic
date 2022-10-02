#!/usr/bin/env node
 // Usage:  getChainAssets
const Query = require("../query");
var ParaTool = require("../paraTool");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let chainID = ParaTool.chainIDMoonbeam;
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            chainID = parseInt(val, 10);
        }
    });
    let assetType = "ERC20"; // "Token"
    var chainassets = await query.getChainAssets(chainID, assetType);
    console.log(JSON.stringify(chainassets));
    
//    var symbolassets = await query.getSymbolAssets("DOT");
  //  console.log(JSON.stringify(symbolassets));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
