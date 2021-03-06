#!/usr/bin/env node
 // Usage:  testPriceUSD
const Query = require("../query");
const paraTool = require("../paraTool");

async function main() {
    var query = new Query();

    await query.init();
    let assets = {
        "lcDOT": '{"LiquidCrowdloan":"13"}~2000',
        "DOT": '{"Token":"DOT"}~2000',
        "DOT-lcDOT LP": '[{"Token":"DOT"},{"LiquidCrowdloan":"13"}]~2000',
        "KAR": '{"Token":"KAR"}~22000',
        "KSM": '{"Token":"KSM"}~22000',
        "KAR-KSM LP": '[{"Token":"KAR"},{"Token":"KSM"}]~22000',
        "LKSM": '{"Token":"LKSM"}~22000',
        "KAR-LKSM LP": '[{"Token":"KAR"},{"Token":"LKSM"}]~22000',
        "BNC": '{"Token":"BNC"}~22000',
        "KUSD-BNC LP": '[{"Token":"KUSD"},{"Token":"BNC"}]~22000',
        'DOT-statemint': '{"Token":"DOT"}~1000',
        'DOT-parallel': '{"Token":"101"}~2012',
        'QTZ-karura': '{"ForeignAsset":"2"}~22000',
        'KSM-statemine': '{"Token":"KSM"}~21000',
        'BNC-karura': '{"Token":"BNC"}~22000',
        'KUSD': '{"Token":"KUSD"}~22000',
        'KUSD/CSM': '[{"Token":"KUSD"},{"ForeignAsset":"5"}]~22000',
        'KSM/ARIS': '[{"Token":"KSM"},{"ForeignAsset":"1"}]~22000'
    }

    let ts = query.currentTS();
    for (const assetNickName of Object.keys(assets)) {
        let assetChain = assets[assetNickName];
        let [asset, chainID] = paraTool.parseAssetChain(assetChain);
        if (chainID == undefined) continue;
        let priceUSD = await query.computeUSD(1.0, asset, chainID, ts);
        console.log(assetNickName, asset, chainID, "priceUSD=", priceUSD);
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });