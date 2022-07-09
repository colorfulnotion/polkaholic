#!/usr/bin/env node
 // Usage:  testQueryEvents
const Query = require("../query");

async function main() {
    var query = new Query();
    let filters = {
        "chainID": 2004,
        "endDate": "2022-06-24",
        "startDate": "2022-06-21",
        //        "section": "setPrice",
        //        "fromAddress": "0xbb437059584e30598b3af0154472e47e6e2a45b9"
    };
    await query.assetManagerInit();
    let rows = await query.getEVMTxs(filters);
    console.log(rows);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });