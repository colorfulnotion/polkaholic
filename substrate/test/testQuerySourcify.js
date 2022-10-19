#!/usr/bin/env node
// Usage:  node testQuerySourcify.js [address]
const Query = require("../query");

async function main() {
    var query = new Query();
    let address = '0x3a7798ca28cfe64c974f8196450e1464f43a0d1e';
    address = '0x70085a09d30d6f8c4ecf6ee10120d1847383bb57';
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            address = val;
        }
    });
    //async assetManagerInit();
    let contract = await query.get_sourcify_evmcontract(address);
    let contract2 = await query.getEVMContract(address)
    console.log(address, "sourcify", contract);
    console.log(address, "cached", contract2);

}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
