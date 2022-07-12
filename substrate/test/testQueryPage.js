#!/usr/bin/env node
 // Usage:  getExtrinsics
const Query = require("../query");
var ParaTool = require("../paraTool");

async function main() {
    var query = new Query();

    let filters = {
        chainID: 2000,
        startDate: "2022-06-01",
        endDate: "2022-06-30"
    };

    await query.assetManagerInit();
    let rows = await query.getExtrinsics(filters, 100000);
    console.log(rows.length);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });