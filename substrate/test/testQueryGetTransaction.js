#!/usr/bin/env node
 // Usage:  getAccount chainID
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();

    let txHash = "0xc2924e90e9be2ea8bbd7433c36380836f4909463cb680f3f5056c9981ed8caf8"; // 0xcd9df9b8f45bd83602e4bcdd5d62cb8f455bfc70198a8e18ac1f2dbeb09d1ec2";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            txHash = val;
        }
    });
    var a = await query.getTransaction(txHash);
    console.log(JSON.stringify(a));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });