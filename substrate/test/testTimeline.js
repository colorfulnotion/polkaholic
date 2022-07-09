#!/usr/bin/env node
 // Usage:  getAccount account dataGroup
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();

    let fromAddress = "0xb84e5e92bb92eb4e4b7b2b6c489379e8e86eba082b3c11b48cf497bfe7eecc19";
    let sourceTS = 1651931994;
    let assetFilter = '{"Token":"KSM"}'
    let chainIDFilter = 22000;
    let timeline = await query.getTimeline(sourceTS, fromAddress, assetFilter, chainIDFilter);
    console.log(timeline);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });