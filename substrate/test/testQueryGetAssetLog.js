#!/usr/bin/env node
 // Usage:  getAssetLog asset
const Query = require("../query");

async function main() {
    var query = new Query();
    await query.init();
    let asset = '{"Token":"KSM"}';
    let chainID = false;
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            asset = val;
        }
        if (index == 3 && val.length > 0) {
            chainID = val;
        }
    });

    var a = await query.getAssetLog(asset, chainID);
    console.log(a);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });