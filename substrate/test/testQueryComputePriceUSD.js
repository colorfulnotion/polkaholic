#!/usr/bin/env node
 // Usage:  testPriceUSD
const Query = require("../query");
const paraTool = require("../paraTool");

async function main() {
    var query = new Query();

    await query.init();
    let assets = {
	//ERC20 returned assetChain=0x14a0243c333a5b238143068dc3a7323ba4c30ecb~22023, priceUSD=0, priceUSDCurrent=0
	//ERC20 returned assetChain=0x639a647fbe20b6c8ac19e48e2de44ea792c62c5c~22023, priceUSD=0, priceUSDCurrent=0
	//ERC20 returned assetChain=0x682f81e57eaa716504090c3ecba8595fb54561d8~22023, priceUSD=0, priceUSDCurrent=0
	//ERC20 returned assetChain=0x6ab6d61428fde76768d7b45d8bfeec19c6ef91a8~22023, priceUSD=0, priceUSDCurrent=0
	//ERC20 returned assetChain=0xb44a9b6905af7c801311e8f4e76932ee959c663c~22023, priceUSD=0, priceUSDCurrent=0
	//ERC20 returned assetChain=0xe3f5a90f9cb311505cd691a46596599aa1a0ad7d~22023, priceUSD=0, priceUSDCurrent=0
	
	
	"USDC": '0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b~2004',
	"USDC2": '0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b~2004',
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
        'KSM/ARIS': '[{"Token":"KSM"},{"ForeignAsset":"1"}]~22000',
        'xcDOT-moonbeam': '{"Token":"42259045809535163221576417993425387648"}~2004',
        'KUSD': '{"Token":"103"}~22085',
        'xcDOT-moonbeamxc': '0xffffffff1fcacbd218edc0eba20fc2308c778080~2004',
        'xcKSM-moonriverxc': '0xffffffff1fcacbd218edc0eba20fc2308c778080~22023',
        'xcKSM-moonriver': '{"Token":"42259045809535163221576417993425387648"}~22023',
        'xcDOT-astarxc': '0xffffffffffffffffffffffffffffffffffffffff~2006',
        'xcDOT-astar': '{"Token":"340282366920938463463374607431768211455"}~2006'
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
