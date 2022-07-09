#!/usr/bin/env node
 // Usage:  getExtrinsics
const Query = require("../query");
var ParaTool = require("../paraTool");

async function main() {
    var query = new Query();
    let chainID = ParaTool.chainIDKarura;
    let filters = {
        chainID: 2000,
        endDate: "2022-06-15",
        section: "multisig",
        startDate: "2022-06-12"
    };

    await query.assetManagerInit();
    let rows = await query.getExtrinsics(filters);
    console.log(JSON.stringify(rows));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });