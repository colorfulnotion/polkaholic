#!/usr/bin/env node
 // Usage:  testCustomRPC

async function main() {
    var PolkaholicDB = require("./polkaholicDB");
    var db = new PolkaholicDB();
    var chains = await db.getChains();
    for (let i = 0; i < chains.length; i++) {
        let c = chains[i];
        let chainID = c.chainID;
        let chainName = c.name;
        var chain = await db.getChain(chainID);
        await db.setupAPI(chain);
        var res = await this.api.isReady;
        console.log("-----");
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });