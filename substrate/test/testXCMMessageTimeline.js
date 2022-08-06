#!/usr/bin/env node
 // Usage:  testXCMMessageTimeline.js [msgHash] [sentAt]
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let msgHash = "0x19ef330db863f9b50b54c7424b1335b9c0bfe80f3230e7a5761b67d830bf46e4";
    let blockNumber = 13882755

    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            msgHash = val;
        }
        if (index == 3 && val.length > 0) {
            blockNumber = parseInt(val, 10);
        }
    });

    let [timeline, xcmMessages] = await query.getXCMTimeline(msgHash, "xcm", blockNumber);
    for (const t of timeline) {
        if (debugLevel > 0) {
            console.log(JSON.stringify(t, null, 4));
        } else {
            console.log("timeline for ", msgHash, " includes ", t.chainID, t.blockNumber);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
