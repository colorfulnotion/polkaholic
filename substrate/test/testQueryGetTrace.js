#!/usr/bin/env node
 // Usage:  getBlock chainID blockNumber
const Query = require("../query");

async function main() {
    var query = new Query();
    await query.init();

    let [chainID, blockNumber] = [2000, 1189294];

    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            chainID = val;
        }
        if (index == 3 && val.length > 0) {
            blockNumber = parseInt(val, 10);
        }
    });
    let trace = await query.getTrace(chainID, blockNumber);
    console.log(JSON.stringify(trace));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });