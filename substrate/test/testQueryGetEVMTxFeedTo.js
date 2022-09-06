#!/usr/bin/env node
 // Usage:  getAccountBalances account
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let address = "0xf3918988eb3ce66527e2a1a4d42c303915ce28ce";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            address = val;
        }
    });
    var a = await query.getEVMTxFeed(address, "feedto")
    console.log(JSON.stringify(a));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });