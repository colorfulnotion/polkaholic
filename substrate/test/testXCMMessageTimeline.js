#!/usr/bin/env node
 // Usage:  testXCMMessageTimeline.js [msgHash] [sentAt]
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();
    let msgHash = "0x5f69a283785972097f08e568a4bc61d94912e973ba418dfd32d868339ed03c7a";
    let sentAt = "10121074";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            msgHash = val;
        }
        if (index == 3 && val.length > 0) {
            sentAt = parseInt(val, 10);
        }
    });

    let [timeline, xcmMessages] = await query.getXCMTimeline(msgHash, "xcm", sentAt);
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