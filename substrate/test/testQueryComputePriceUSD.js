#!/usr/bin/env node
 // Usage:  testPriceUSD
const Query = require("../query");
const paraTool = require("../paraTool");

async function main() {
    var query = new Query();

    await query.init();
    let assets = {
        "USDC": {
            asset: "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b",
            "chainID": 2004
        },
        "USDC2": {
            asset: "0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b",
            "chainID": "2004"
        },
        "DOT": {
            asset: '{"Token":"DOT"}',
            chainID: '2000'
        },
        "KAR": {
            assetChain: '{"Token":"KAR"}~22000'
        },
        "100 KSM": {
            assetChain: '{"Token":"KSM"}~22000',
            val: 100.0
        },
        '1000 DOT-statemint': {
            assetChain: '{"Token":"DOT"}~1000',
            val: 1000
        },
        '200 KSM-statemine': {
            asset: '{"Token":"KSM"}',
            chainID: 21000,
            val: 200
        },
        '123 KUSD-karura': {
            assetChain: '{"Token":"KUSD"}~22000',
            val: 123
        },
        '456 KUSD-heiko': {
            assetChain: '{"Token":"103"}~22085',
            val: 456
        },
        'xcDOT-moonbeamxc': {
            assetChain: '0xffffffff1fcacbd218edc0eba20fc2308c778080~2004'
        },
        'xcKSM-moonriverxc': {
            assetChain: '0xffffffff1fcacbd218edc0eba20fc2308c778080~22023'
        },
        'xcDOT-astarxc': {
            assetChain: '0xffffffffffffffffffffffffffffffffffffffff~2006'
        },
        'DOT-parallel': {
            assetChain: '{"Token":"101"}~2012'
        },
        'QTZ-karura': {
            assetChain: '{"ForeignAsset":"2"}~22000'
        },
        '2 BNC-bifrost': {
            asset: '{"Token":"BNC"}',
            chainID: 22001,
            val: 2.0
        },
        '2 BNC-karura': {
            assetChain: '{"Token":"BNC"}~22000',
            val: 2.0
        },
        '100000 xcDOT-moonbeam': {
            asset: '{"Token":"42259045809535163221576417993425387648"}',
            chainID: 2004,
            val: 100000.0
        },
        '100 xcKSM-moonriver': {
            asset: '{"Token":"42259045809535163221576417993425387648"}',
            chainID: 22023,
            val: 100
        },
        '10 xcDOT-astar': {
            assetChain: '{"Token":"340282366920938463463374607431768211455"}~2006',
            val: 10
        },
        '222 GLMR-parallel': {
            asset: '{"Token":"114"}',
            chainID: 2012,
            val: 222
        },
        '100 PHA-parallel': {
            asset: '{"Token":"115"}',
            chainID: 2012,
            val: 100.0
        },
        "2 LKSM-karura": {
            asset: '{"Token":"LKSM"}',
            chainID: 22000,
            val: 2
        },
        '1000 KAR-parallel': {
            asset: '{"Token":"107"}',
            chainID: 22085,
            val: 1000.0
        },
        "1 lcDOT-acala": {
            assetChain: '{"LiquidCrowdloan":"13"}~2000'
        },
        /*
        	// assets only on acala / karura: Token + LP
                "DOT-lcDOT LP-acala": {assetChain:'[{"Token":"DOT"},{"LiquidCrowdloan":"13"}]~2000'},
                "KAR-KSM LP-karura": '[{"Token":"KAR"},{"Token":"KSM"}]~22000',
                "KAR-LKSM LP-karura": '[{"Token":"KAR"},{"Token":"LKSM"}]~22000',
                "KUSD-BNC LP-karura": '[{"Token":"KUSD"},{"Token":"BNC"}]~22000',
                'KUSD/CSM LP-karura': '[{"Token":"KUSD"},{"ForeignAsset":"5"}]~22000',
        	'KSM/ARIS LP-karura': '[{"Token":"KSM"},{"ForeignAsset":"1"}]~22000',

        	// assets only on parallel / parallel-heiko : Token
        	'sDOT-parallel' : '{"Token":"1001"}~2012',
        	'sKSM-parallel' : '{"Token":"1000"}~2012',
        	'HKO-parallel' : '{"Token":"HKO"}~22085', */
    }
    assets = {
        "KUSD": {
            asset: '{"Token":"KUSD"}',
            chainID: '22000'
        }
    }

    let ts = query.currentTS();
    for (const testcaseName of Object.keys(assets)) {
        let q = assets[testcaseName];
        console.log("INPUT", q, `(testcaseName=${testcaseName})`);
        let res = await query.computePriceUSD(q);
        console.log("OUTPUT", res, "\n");
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });