#!/usr/bin/env node

var Indexer = require("../indexer");

async function main() {
    /*
    var testCases = [
	{
	    chainID: 8,
	    bn: 1433334,
	    ts: undefined,
	    p: 'System',
	    s: 'Account',
	    accountID: 'qmmNufxeWaAUp4SVa1Vi1owrzP1xhR6XKdorEcck17RF498',
	    asset: '{"Token":"KAR"}',
	    k: '26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da943ce24f679759c60d1cd42f70aeae77f6d6f646c6163612f636470740000000000000000000000000000000000000000',
	    v: '41010000000000000000010000000000000000e87648170000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            blockHash: '0x747e08a45877d9e41ab800231a1073bca50a661f1e4cf897e3bb4107ced3d034',
            traceType: "subscribeStorage"
	},

	{
            bn: 428687,
            chainID: 10,
            p: 'Rewards',
            s: 'SharesAndWithdrawnRewards',
            accountID: '23NG4RVRwMGiiJsG7LFi152YM2vAJ3yrtyLz9f7gskYAAKPQ',
            asset: '{"Dex":{"DexShare":[{"Token":"ACA"},{"Token":"AUSD"}]}}',
            k: '540a4f8754aa5298a3d6e9aa09e93f97fe48109ae17c059ed50f614155e4f18927a3b35c804bbbf2010100000001bb46e5b20d1702be6e54da9277105a31e1bc06c5935e62fbe95dae61c26229c2996f168e3f75390b',
            v: '0100e006a1bb0c000000000000000000000400007693e07a080000000000000000000000',
            //v: '00e006a1bb0c000000000000000000000400007693e07a080000000000000000000000',
            blockHash: '0x04256be83379e38e4feba1e7efc58d744dbc7163756277f6aeb2ebba8e63af8e',
            traceType: "subscribeStorage"
	},
	{
	    bn: 686456,
	    chainID: 10,
	    p: 'Dex',
	    s: 'LiquidityPool',
	    k: 'f62adb4cbbb61c68b60fe8aabda1f8e364d90cadaa764fd8da11d8fb12a69a48b37ee6e2248d3b730002040d000000',
	    v: '8076ba7f0af6f609000000000000000000ff642a9df3f20e000000000000000000',
	    blockHash: '0x5ae69a7013be64d29184bc56510c0a2c4435280a4114a34a29234f3361054f3e',
	    traceType: "subscribeStorage"
	}
    ];
*/
    let indexer = new Indexer();
    let testCases = [{
        bn: 3778855,
        chainID: 2,
        p: 'System',
        s: 'Account',
        k: '26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da94103ee1ff7103008d60b9258f4e0733ea0052429226791bbf1986dd62ef3c12fd3f09cc5ba37c4f01d7d77ee63d29431',
        v: '010200000002625b099852580000000000000000000000e40b54020000000000000000000000009033beb90000000000000000000000009033beb90000000000000000000000',
        blockHash: '0xd9a3e720e33fc43e2fa2bdf4f579b3bd3f7434e3fda6e429462ff4c2d21d2c3a',
        traceType: "state_traceBlock"
    }];

    testCases = [{
            bn: 4952128,
            blockHash: '0x15f1f3345b328593ed03a2e3301e2457a7d1e2ef5da41c8d6bf9525e275c4ccf',
            p: 'Balances',
            s: 'TotalIssuance',
            totalIssuance: 3.270328286747133e+38,
            asset: '{"Token":"DOT"}',
            k: 'c2261276cc9d1f8598ea4b6a74b15c2f57c875e4cff74148e4628f264b974c80',
            v: '01f6083b543ec2b0940000000000000000',
            traceType: "subscribeStorage",
        },
        {
            bn: 4952128,
            blockHash: '0x15f1f3345b328593ed03a2e3301e2457a7d1e2ef5da41c8d6bf9525e275c4ccf',
            p: 'Balances',
            s: 'TotalIssuance',
            totalIssuance: 3.270328286747133e+38,
            asset: '{"Token":"DOT"}',
            k: 'c2261276cc9d1f8598ea4b6a74b15c2f57c875e4cff74148e4628f264b974c80',
            v: '01f6083b543ec2b0940000000000000000',
            traceType: "state_traceBlock",
        }
    ];
    for (let i = 0; i < testCases.length; i++) {
        let e = testCases[i];
        let chain = await indexer.getChain(e.chainID);
        indexer.chainID = e.chainID;
        await indexer.setupAPI(chain);
        await indexer.setup_chainParser(chain);
        await indexer.initApiAtStorageKeys(chain, e.blockHash, e.bn);
        try {
            traceType = "state_traceBlock";
            let [o, parsev] = await indexer.parse_trace(e, traceType, e.bn, e.blockHash);
            console.log(o, parsev);
        } catch (err) {
            console.log(err);
        }
    }
    await indexer.update_batchedSQL(true);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch(e => {
        console.error("ERROR", e);
        process.exit(1);
    });