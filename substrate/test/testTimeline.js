#!/usr/bin/env node
 // Usage:  getAccount account dataGroup
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();



    let ts = 1657800851; // timepoint
    let chainIDs = [0, 2000, 2004]; // CSV list of chainIDs to look around timepoint
    // list of section:method / section:storage for events/traces
    let filter = [
        // test cases to check filtering correct, not actually relevant for XCM
        ["events", "paraInclusion", 'CandidateIncluded'],
        ["extrinsics", "authorinherent", 'kickoffauthorshipvalidation'],

        //
        ["trace", 'ParachainSystem', 'LastHrmpMqcHeads'],
        // UMP
        ["events", "ump", "UpwardMessagesReceived"],
        ["extrinsics", "ParachainSystem", "UpwardMessages"],
        // HRMP
        ["events", "xcmpQueue", "Success"],
        ["events", "xcmpQueue", "Fail"],
        ["extrinsics", "ParachainSystem", "HrmpOutboundMessages"],
        // DMP
        ["events", "dmpQueue", "ExecutedDownward"],
        ["extrinsics", "dmp", "DownwardMessageQueues"],
    ];
    let timeline = await query.getTimeline(ts, chainIDs, filter)
    for (const t of timeline) {
        console.log(JSON.stringify(t, null, 4));
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });