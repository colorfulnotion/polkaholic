#!/usr/bin/env node
 // Usage:  testQueryEvents
const Query = require("../query");

async function main() {
    var query = new Query();
    let filters = {
        "chainID": 2012
    };
    await query.assetManagerInit();
    let rows = await query.searchXCMTransfers(filters);
    console.log(rows);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });