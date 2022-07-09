#!/usr/bin/env node
 // Usage:  testQueryEvents
const Query = require("../query");

async function main() {
    var query = new Query();
    let filters = {
        "chainID": 2000,
        "startDate": '2022-01-09',
        "endDate": '2022-06-12',
        "fromAddress": "0x56daf75bd0f09c11d798263bc79baeb77c4b4af1dbd372bbe532b1f8702b2a7e" // Kraken
    };
    await query.assetManagerInit();
    let chain = await query.getChain(filters.c);
    let rows = await query.getTransfers(chain, filters);
    console.log(rows);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });