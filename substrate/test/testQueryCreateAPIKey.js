#!/usr/bin/env node
 // Usage:  createAPIKey [APIKey] [ratelimit]
const Query = require("../query");

async function main() {
    var query = new Query();
    var apikey = "";
    var rateLimit = 600;
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            apikey = val;
        }
        if (index == 3 && val.length > 0) {
            rateLimit = parseInt(val, 10);
        }
    });
    var a = await query.createAPIKey(apikey, rateLimit);
    console.log(a);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });