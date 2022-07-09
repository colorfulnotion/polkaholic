#!/usr/bin/env node
 // Usage:  getAccount account dataGroup
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    query.usebtAccountTables = true;
    let account = "";
    let dataGroup = "extrinsics"
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            account = val;
        }
        if (index == 3 && val.length > 0) {
            dataGroup = val;
        }
    });
    var a = await query.getAccount(account, dataGroup);
    console.log(JSON.stringify(a));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });