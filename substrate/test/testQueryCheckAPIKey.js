#!/usr/bin/env node
 // Usage:  createAPIKey [APIKEY] 
const Query = require("../query");

async function main() {
    var query = new Query();
    var apikey = "";
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            apikey = val;
        }
    });
    var a = await query.checkAPIKey(apikey);
    console.log(a);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });