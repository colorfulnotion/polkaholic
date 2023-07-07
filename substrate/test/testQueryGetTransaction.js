#!/usr/bin/env node
const Query = require("../query");
const jsonld = require("../jsonld");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let txHash = "0x5046ac7118473201cf0a7baee51ad9c0f085ec8cdfeeffd6a1430197d9b21e1f";
    var a = await query.getTransaction(txHash);
    console.log(JSON.stringify(a));
    
    console.log(JSON.stringify(jsonld.txToJSONLD(a)));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
