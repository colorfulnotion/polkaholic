#!/usr/bin/env node
 // Usage:  tallyAPIKey [APIKEY] [ratelimit]
const Query = require("../query");

async function main() {
    var query = new Query();
    var apikey = "";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            apikey = val;
        }
        if (index == 3 && val.length > 0) {
            rateLimit = parseInt(val, 10);
        }
    });
    var a = await query.tallyAPIKey(apikey);
    console.log(a);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });