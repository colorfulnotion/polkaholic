#!/usr/bin/env node
 // Usage:  getAccount account dataGroup
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    query.usebtAccountTables = true;
    var chainID = 2012
    await query.init();
    let account = "";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            account = val;
        }
    });
    var a = await query.getAccountAssetsRealtimeByChain(chainID, account);

    console.log(JSON.stringify(a));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });