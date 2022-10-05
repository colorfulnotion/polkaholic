#!/usr/bin/env node
 // Usage:  testPriceUSD
const Query = require("../query");
const paraTool = require("../paraTool");

async function main() {
    var query = new Query();

    await query.init();

    // get all the routers of a chain, eg Moonbeam
    let chainID = 2004;
    let routers = await query.getRouters({
        chainfilters: [chainID]
    })
    //console.log("routers", routers);

    // get a specific router eg Stellaswap router
    let routerAssetChain = "0x70085a09d30d6f8c4ecf6ee10120d1847383bb57~2004";
    let router = await query.getRouter(routerAssetChain);
    //console.log("router", router);

    // get all the pools of the above router 
    let pools = await query.getPools({
        routerAssetChain: routerAssetChain
    })
    //let pools = await query.getPools({routerAssetChain: routerAssetChain, symbol: "xcDOT"})
    //console.log("pools", pools);

    // get a specific pool eg WGLMR-xcDOT
    let assetChain = "0xa927e1e1e044ca1d9fe1854585003477331fe2af~2004";
    let pool = await query.getPool(assetChain);
    //console.log("pool", pool);

    // get the history
    let history = await query.getPoolHistory(assetChain);
    console.log("pool history", history);

}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });