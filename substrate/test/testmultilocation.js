const util = require('util');
const abiDecoder = require('abi-decoder');
const ethTool = require("../ethTool");
const paraTool = require("../paraTool");
const Crawler = require("../crawler");
const fs = require('fs');
var crawler = new Crawler()

async function main() {
    let xcmInteriorKeys = ['[{"parachain":1000},{"palletInstance":36},{"generalIndex":"0xfd9d0bf45a2947a519a741c4b9e99eb6"}]', 'here']
    await paraTool.initPolkadotAPI() //using polkadotjs api for decoding here. I would like to remove this call such that the first query would cache a simple 'api' without provider
    for (const k of xcmInteriorKeys){
        var v1 = paraTool.convertXCMInteriorKeyToXcmV1MultiLocation(k)
        var b1 = paraTool.convertXCMV1MultiLocationToByte(v1)
        console.log(`k=${k}, XCMV1MultiLocation=${JSON.stringify(v1)}, XCMV1MultiLocationByte=${b1}`)
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
