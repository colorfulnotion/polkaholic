const Crawler = require("../crawler");
const {
    ApiPromise,
    WsProvider
} = require('@polkadot/api');
const paraTool = require("../paraTool");

let testCases = [
    // https://polkaholic.io/block/10/335707
    [10, 335707, "0x07b74e80e1f1635a04aaa2447041a00fdfb1d3293ad7c6f7a2e812b1282107a4", ["0x8d06840090c492f38270b5512370886c392ff6ec7624b14185b4b610b30248a28c94c9530118ae54aba3c1a2b2594f26c1e0850c02731b1f6558d2642bfe97be9be69c486d2b8f85d515aca3bad8c574e2de8e9d4395b7382c15aa343172f588b35f20d18f7401180004010300147095491dc941e21b9269fe67b322311df5daafd75f0bf8868afd8fa828b06329bc517c01c4b663efdfea3dd9ab71bdc3ea607e8a35ba3d1872e5b0942821cd2fe498b8bed2069371dc5ece389d7d60fe34a91fe4936f7f8eb8a84cd3e8dae34cf63fe694d0c8a0703fc45362efc2852c8b8c9c4061b5f0cf9bd0329a984fc95df87525a8a29cc3a1c56fb231a165d5fd38c42459f38c638c3a1d0f29061c101a01071f0500020000000d020302087900ec626166796265696477656c766779777a776d6e7676343678647a6c646c3270773667617072713761616c656c7532707033373278336162746837340f007900ec6261667962656966776f3462786a34736235707532346c33626f706b357473706f347765616e376e6a6879626a77686a7132796c376f746436366d0f0000a837cd5c00000000"]],

    // https://polkaholic.io/block/10/367613
    [10, 367613, "0x249df5933685dc9211672daeb4d36c6d539c1d684e3722d287b48464cfea1fda", ["0x9d0284002c8feeab5bd9a317375e01adb6cb959f1fea78c751936d556fa2e36ede425a470178f0c1db33588195bcdee271d53c7f9a9735c4a046d3d2cdc3be6202794e2c1d9ce029ca7a7ecef2fd1eb6e12d3e308c7b8347040c8a4945ea352edd3fdb7f8e640100007900ec62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b73750f00"]],

    // https://polkaholic.io/block/10/343291
    [10, 343291, "0x6c8d5af2bd8c96ea770e5d4dd00c938263e49ede411b963a58b649471967b7fc", ["0xd5028400f63fe694d0c8a0703fc45362efc2852c8b8c9c4061b5f0cf9bd0329a984fc95d011e26ec8a118635d31ca10fc01a321567211383627a6132f05e6dc1fa0aad680b6011e57e3a1e4d2a70fb83c595598e0e43edc15416c7c0f7fa66c570377fd88e7401500005006d6f646c6163612f614e4654000000000000000000000000000000000000000000790100c0f6b199272db4159f6fcd4ac5bc8b5a4cca7e035be3555df1b8283a1076dd2c000000000000a10f"]],

    // https://polkaholic.io/block/10/387174
    [10, 387174, "0x7321f71d74f14362a8e5210328f3ed4ec988b4ff523e94659001ff8cba43fff9", ["0x49028400761837f9af59a263385ef7bb18f07295758cba4881a4599198a6ca499db0803b01bcd8fd06e629554c77814bcebbb858f7e5cbfcfde59d2428ed624c37d89a8c017a5835b71ddc79fea4a877c1598ac871e94754d3db6d86ab5a61ccf6e58a408334007905000a000030f1cb1f89bb273ce5b26a429e7b0d686826da74bbf182621d78e86fb60b54230b00409452a303"]],

    // https://polkaholic.io/block/0/9000425
    [0, 9000425, "0x281e7844bbe8bedd5e1f4fcd0e1f8d5c7d02106ac684b949437b6e53f6112d53",
        ["0x3d02840045894d59a04848304c82562da60fa6499e7662bb1a1178a2f9a9901bd4e94c8a000e1e4aa9cf50a0284519627ecd45643f76160abde560dca410f1d398ab2b195289e3a4570004caa243e221f53c50a8efc6b8c8dbbce3ce2272584bf2cfd4c902000000050000243b4e9113fe1b3970dcf4ce6098a13a9d94aaa645facc9cc4c7e22af4a93b5407f2d88a6b08", "0x3d028400e6794b001f80ea064f85ad1b96ca8f09d27f8d1ef77d74d03106ce4abcc1a37b0091c0c84b2281cd074de622dcd43a3045a67c4866144fec1c2e693e1f0efc40a9571dc7cf60a24382d5ac91419d9cb4ccb6b20300ad30fb39b7f2269629e29501000000050000243b4e9113fe1b3970dcf4ce6098a13a9d94aaa645facc9cc4c7e22af4a93b5407b2fbb1a91f"]
    ],

    // https://polkaholic.io/block/0/1325210
    [0, 1325210, "0xa70a75c54a457a823f1a5492a39049869de880ad64486eae5bdf60f5403f6354", ["0xe90e8444b950f440709a5ea45db212b3ccd97ded1b133fd3dbdde34d9268ccef1e1667015e30aea508628fafe159149456b8029dda804079a1755fe083c85197589d0a557bbdf826e815a8f21d2e4af0ceb3b6da355fcdd2a8a9b5e378ed1d4793302d82f50004001e0103001400f01f8efd9ef342837ef239098c5c49d240fba6ec62e8ce51a7827baac53b475a54fc51b0688a5e769f347af968ce9ef10af6c13b8f410271efbca0c6adab7d6a6fb7f65181dbdf83fae694cf1677628e2d16ebdefd9d45631b4fd4f662d0246c35f8bc62f7c91b4ff188949c4f2c7b3003582ab617dde4d8f7d65ed3b0ad1ddae67c75627ce625246132595634c859084de2c3e6030541e79ae361f17c19350185381400030000006d0a1a00101d00a876e0f33a5c4ccf9aab796852f5787d47c8603e27db431cf0a05335b4df602c0007051080d57608c732427386079d29d65035cfc02b3221ff32cfe73b540d849aa0046288072cc906cf4513caf8aeb6ae323c8b7e57bf5581da1aaaa8d1363dac664266f0cab0c194935f449b3baef742e992ebb801fe38ab5c345d7a6195740399cb500af17b8dab92e7ab018e1189cf597b4e2ca38e0d00716172adb26073867ab92d1d0006f2407953446b90a6344f2b88d87d29c1b588e55d8943edbdb843deb23aef7e0007051080d57608c732427386079d29d65035cfc02b3221ff32cfe73b540d849aa0046288072cc906cf4513caf8aeb6ae323c8b7e57bf5581da1aaaa8d1363dac664266f0cab0c194935f449b3baef742e992ebb801fe38ab5c345d7a6195740399cb500af17b8dab92e7ab018e1189cf597b4e2ca38e0d00716172adb26073867ab92d1d007ca685c7b96ca06e7b2db4893b3402e5343e26459a8561211f2bb73f5a8e58290007051080d57608c732427386079d29d65035cfc02b3221ff32cfe73b540d849aa0046288072cc906cf4513caf8aeb6ae323c8b7e57bf5581da1aaaa8d1363dac664266f0cab0c194935f449b3baef742e992ebb801fe38ab5c345d7a6195740399cb500af17b8dab92e7ab018e1189cf597b4e2ca38e0d00716172adb26073867ab92d1d00a07bb321afc711f7bb56424aa1101c8c99029348f172237a4d5e371dbffc156f0007051080d57608c732427386079d29d65035cfc02b3221ff32cfe73b540d849aa0046288072cc906cf4513caf8aeb6ae323c8b7e57bf5581da1aaaa8d1363dac664266f0cab0c194935f449b3baef742e992ebb801fe38ab5c345d7a6195740399cb500af17b8dab92e7ab018e1189cf597b4e2ca38e0d00716172adb26073867ab92d00c044155400000000"]]
];

async function testDecodeCases(crawler) {
    for (var testCaseIdx = 5; testCaseIdx < testCases.length; testCaseIdx++) {
        var [chainID, blockNumber, blockHash, extrinsicsRawCases] = testCases[testCaseIdx];
        var wssEndpoint = 'wss://rpc.polkadot.io'
        switch (chainID) {
            case 10:
                wssEndpoint = "wss://acala-polkadot.api.onfinality.io/public-ws"
            case 136:
                wssEndpoint = "wss://altair.api.onfinality.io/public-ws"
            case 1285:
                wssEndpoint = "wss://moonriver.api.onfinality.io/public-ws"
                break;
            default:
        }

        wssEndpoint = "wss://wss.moonriver.moonbeam.network"
        var api = await ApiPromise.create({
            provider: new WsProvider(wssEndpoint)
        });
        await api.isReady;
        var signedBlock = await api.rpc.chain.getBlock('0x18fb08d903bc3771686e35cddd1fc22d369cbdadc812248bdf71a10eb682c37d') //block 429700
        //const signedBlock = await api.rpc.chain.getBlock(blockHash);
        //console.log(JSON.stringify(signedBlock.block));
        var apiAt = await api.at(blockHash)
        for (const z of extrinsicsRawCases) {
            console.log(`testcase${testCaseIdx}`, chainID, blockNumber, blockHash, z.substr(0, 20) + "...");
            console.log(apiAt);
            var d = crawler.decode_extrinsic(z, apiAt)
            console.log(d, JSON.stringify(d));
        }
    }
}

async function main() {
    var crawler = new Crawler();
    await crawler.init();
    //    await testDecodeCases(crawler);
    for (testCaseIndex = 0; testCaseIndex < testCases.length; testCaseIndex++) {
        let [chainID, blockNumber, blockHash, extrinsicsRawCases] = testCases[testCaseIndex];
        crawler.chainID = chainID;
        let chain = await crawler.getChain(chainID);
        await crawler.setupAPI(chain);
        await crawler.crawl_block_trace(chain, {
            blockNumber,
            attempted: 0,
            crawlTrace: 0
        });
        let r = await crawler.index_block(chain, blockNumber);
        console.log(JSON.stringify(r.block));
        console.log(r.blockStats);
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
