#!/usr/bin/env node
 // Usage:  node testQueryGetAddress.js [address]
const Query = require("../query");

async function main() {
    var query = new Query();
    let address = '0xf3a5454496e26ac57da879bf3285fa85debf0388';
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            address = val;
        }
    });

    await query.assetManagerInit();
    let code = await query.getEVMContract(address)
    console.log(address, "code", code);

}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });