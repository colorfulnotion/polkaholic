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
    var a = await query.getMultiAccount(["0xEaf3223589Ed19bcd171875AC1D0F99D31A5969c"]) // "0xdcb4651b5bbd105cda8d3ba5740b6c4f02b9256d", "0x2c8feeab5bd9a317375e01adb6cb959f1fea78c751936d556fa2e36ede425a47"]);
    console.log(JSON.stringify(a));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });