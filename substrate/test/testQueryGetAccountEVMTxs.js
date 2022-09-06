#!/usr/bin/env node
 // Usage:  getAccountBalances account
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let account = "0xcf1107a96747cdec84489f07111cceeb30e2d881";
    account = "0xaa30ef758139ae4a7f798112902bf6d65612045f";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            account = val;
        }
    });
    // async getAccount(rawAddress, accountGroup = "realtime", chainList = [], maxRows = 1000, TSStart = null, lookback = 180, decorate = true, decorateExtra = ["data", "address", "usd", "related"], pageIndex = 0) {
    var a = await query.getAccount(account, "evmtxs", [22023]);
    console.log(JSON.stringify(a));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });