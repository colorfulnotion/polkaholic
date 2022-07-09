#!/usr/bin/env node
 // Usage:  getExtrinsics
const Query = require("../query");
var ParaTool = require("../paraTool");

async function main() {
    var query = new Query();
    let chainID = ParaTool.chainIDKarura;
    let filters = {
        endDate: "2022-07-04",
        startDate: "2022-07-03"
    };

    await query.assetManagerInit();
    let rows = await query.getXCMMessages(filters);
    console.log(JSON.stringify(rows));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });