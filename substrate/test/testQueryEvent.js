#!/usr/bin/env node
 // Usage:  testQueryEvent [eventID]
const Query = require("../query");

async function main() {
    var query = new Query();
    let eventID = "0-11448488-4-40";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            eventID = val;
        }
    });
    await query.assetManagerInit();
    let ev = await query.getEvent(eventID);
    console.log(JSON.stringify(ev, null, 4));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });