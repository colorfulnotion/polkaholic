// Usage: node testMemcache.js
var Crawler = require("../crawler");

async function main() {
    let crawler = new Crawler();

    crawler.cacheInit();

    let key = "1284-0x8123";
    crawler.cacheWrite(key, {
        "symbol": "USDC",
        "decimals": 6
    });

    let val = await crawler.cacheRead(key);
    console.log(val);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });