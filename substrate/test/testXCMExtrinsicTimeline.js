#!/usr/bin/env node
 // Usage: testXCMExtrinsicTimeline.js
const Query = require("../query");

async function main() {
    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();

    let extrinsicHashes = [
        "0x5597d728afd0970ef1cdf6cf0b6a5e348e6a4152a2097d7b8505607c73cbd77b",
        // 2000 -> 0 UMP (DOT transfer)
        // https://polkaholic.io/tx/0xb5a24bc52710c0f142b1911ec6313385cb8fd3ce78fe5d36b538311158cd8da4
        //"0xb5a24bc52710c0f142b1911ec6313385cb8fd3ce78fe5d36b538311158cd8da4",
        // 0 -> 2000 DMP (DOT transfer)
        // https://polkaholic.io/tx/0xfae361c0d6716a1e03ea45496d492130e78d24936855ded6e9a2ccc04aabedbb
        //"0xfae361c0d6716a1e03ea45496d492130e78d24936855ded6e9a2ccc04aabedbb",
        // 2000 -> 2004 HRMP (GLMR transfer)
        // https://polkaholic.io/tx/0x77a4af790a693be027fdc1cfd671a3bd63941f8abfe0343491c0d50cb7a8171f
        //"0x77a4af790a693be027fdc1cfd671a3bd63941f8abfe0343491c0d50cb7a8171f"
    ];
    for (let i = 0; i < extrinsicHashes.length; i++) {
        let extrinsicHash = extrinsicHashes[i];
        let [timeline, xcmMessagesMap] = await query.getXCMTimeline(extrinsicHash, "extrinsic");
        for (const t of timeline) {
            if (debugLevel > 0) {
                console.log(JSON.stringify(t, null, 4));
            } else {
                console.log("timeline for ", extrinsicHash, " includes ", t.chainID, t.blockNumber);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });