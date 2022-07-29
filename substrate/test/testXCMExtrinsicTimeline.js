#!/usr/bin/env node
 // Usage: testXCMExtrinsicTimeline.js [extrinsicHash]
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();

    let extrinsicHash = "0x00068acbbecec355f0c495389a29d7829f265553e258ad44d37bd52130bc44be";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            extrinsicHash = val;
        }
    });
    let [timeline, xcmMessages] = await query.getXCMTimeline(extrinsicHash, "extrinsic");
    for (const t of timeline) {
        console.log("timeline:", JSON.stringify(t, null, 4));
    }
    console.log("xcmMessages:", JSON.stringify(xcmMessages, null, 4));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });