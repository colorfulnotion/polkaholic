#!/usr/bin/env node
 // Usage:  node testQueryGetAddress.js [address]
const Query = require("../query");

async function main() {
    var query = new Query();
    let address = '0x99588867e817023162f4d4829995299054a5fc57'; // WGLMR
    address = '0xcd3b51d98478d53f4515a306be565c6eebef1d58'; // BEAM
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            address = val;
        }
    });

    await query.assetManagerInit();
    let [realtime, contract] = await query.getAddress(address);
    console.log("realtime", JSON.stringify(realtime));
    console.log("contract", JSON.stringify(contract));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });