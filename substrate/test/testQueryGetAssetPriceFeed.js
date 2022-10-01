#!/usr/bin/env node
 // Usage:  getAssetPriceFeed
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let testcases = [{
            symbol: "DOT",
            relayChain: "polkadot"
        },
        {
            symbol: "INTR",
            relayChain: "polkadot"
        },
        {
            symbol: "IBTC",
            relayChain: "polkadot"
        },
        {
            symbol: "KAR",
            relayChain: "kusama"
        }
        // add asset/chainID combinations: WGLMR, WASTR, axlATOM, STELLA, ...
    ]
    let interval = "hourly";
    for (const q of testcases) {
        var a = await query.getAssetPriceFeed(q, interval);
        console.log(JSON.stringify(a));
        process.exit(0);
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });