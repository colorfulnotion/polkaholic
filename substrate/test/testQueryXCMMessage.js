#!/usr/bin/env node
 // Usage:  testQueryXCMMessage [msgHash] [sentAt]
const Query = require("../query");
var ParaTool = require("../paraTool");

async function main() {
    var query = new Query();
    let msgHash = "0xfceb9302980adffc65c1888f2962ed9b2b837f79cca28f5daf2babd2243f5f7c";
    let sentAt = null
    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            msgHash = val;
        }
        if (index == 3 && val.length > 0) {
            sentAt = parseInt(val, 10);
        }
    });
    await query.assetManagerInit();
    let xcm = await query.getXCMMessage(msgHash, sentAt);
    console.log(JSON.stringify(xcm, null, 4));
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });