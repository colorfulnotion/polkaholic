#!/usr/bin/env node
 // Usage:  node testQueryAddressTopN.js
const Query = require("../query");

async function main() {
    var query = new Query();
    let topN = 'balanceUSD'

    await query.assetManagerInit();
    let addresstopn = await query.getAddressTopN(topN);
    console.log(JSON.stringify(addresstopn));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });