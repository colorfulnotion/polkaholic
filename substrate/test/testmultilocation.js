const util = require('util');
const abiDecoder = require('abi-decoder');
const ethTool = require("../ethTool");
const paraTool = require("../paraTool");
const Crawler = require("../crawler");
const fs = require('fs');
var crawler = new Crawler()

async function main() {
    let xcmInteriorKeys = ['[{"parachain":1000},{"palletInstance":36},{"generalIndex":"0xfd9d0bf45a2947a519a741c4b9e99eb6"}]', 'here', '[{"parachain":888},{"palletInstance":3}]', ' [{"parachain":2000},{"generalKey":"0x0081"}]', '{"parachain":2048}']
    await paraTool.initPolkadotAPI() //using polkadotjs api for decoding here. I would like to remove this call such that the first query would cache a simple 'api' without provider
    for (const k of xcmInteriorKeys) {
        var v1 = paraTool.convertXcmInteriorKeyToXcmV1MultiLocation(k)
        var b1 = paraTool.convertXcmV1MultiLocationToByte(v1)
        var m1 = paraTool.convertXcmV1MultiLocationToMoonbeamEvmMultiLocation(v1)
        var b1a = paraTool.convertMoonbeamEvmMultiLocationToXcmV1MultiLocation(m1)
        let r = {
            xcmInteriorKeys: k,
            xcmV1MultiLocation: JSON.stringify(v1, null, 4),
            moonbeamEvmMultiLocation: JSON.stringify(m1),
            recoveredMoonbeamEvmMultiLocation: JSON.stringify(v1, null, 4),
        }
        //console.log(`xcmInteriorKeys=${k}, XcmV1MultiLocation=${JSON.stringify(v1)}, moonbeamEvm multilocaiton=${JSON.stringify(m1)}, recovered XCMV1MultiLocation==${JSON.stringify(m1)}`)
        console.log(r)
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