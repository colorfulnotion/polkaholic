#!/usr/bin/env node
 // Usage:  testQueryEvents
const Query = require("../query");

async function main() {
    var query = new Query();
    let filters = {
        "c": 172,
        "p": "System",
        "m": "KilledAccount"
    };
    let rows = await query.getEvents(filters);
    console.log(JSON.stringify(rows));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });