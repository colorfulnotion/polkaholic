// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic.

// Polkaholic is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Polkaholic is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Polkaholic.  If not, see <http://www.gnu.org/licenses/>.

const Query = require("./query");
const paraTool = require("./paraTool");
const ethTool = require("./ethTool");
const mysql = require("mysql2");
const {
    ethers
} = require('ethers');
const {
    Address
} = require('cluster');
const fs = require('fs');
const {
    Keyring,
    ApiPromise
} = require("@polkadot/api");
const {
    bnToHex,
    hexToBn,
} = require("@polkadot/util");


module.exports = class PriceManager extends Query {
    debugLevel = 0;
    explored = {};
    queue = {};
    queueHead = 0;
    queueTail = 0;
    resultPaths = {};

    constructor(debugLevel = false) {
        super()

        if (debugLevel) {
            this.debugLevel = debugLevel;
        }
    }

    queueEmpty() {
        return (this.queueHead == this.queueTail);
    }

    clearQueue() {
        this.queue = {};
        this.queueHead = 0;
        this.queueTail = 0;
        this.resultPaths = {};
    }

    enqueue(p) {
        this.queue[this.queueTail] = p;
        this.queueTail++;
    }

    dequeue() {
        if (this.queueHead < this.queueTail) {
            let p = this.queue[this.queueHead];
            this.queueHead++;
            return (p);
        }
        return (false);
    }

    isXCAsset(asset, chainID) {
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        if (this.assetInfo[assetChain]) {
            let assetInfo = this.assetInfo[assetChain];
            return [assetInfo.isXCAsset, assetInfo.symbol, assetInfo.relayChain];
        } else {
            console.log("missing", assetChain);
        }
        return [null, null, null];
    }

    getPathExtensions(path, router = null, maxDepth = 2, isEVM = true) {
        let extensions = [];
        let tailAssetChain = path[path.length - 1].dest; // the last element, which is an assetChain
        if (tailAssetChain == undefined) {
            console.log("UNFEIN", path);
            return (extensions);
        }
        let [tailAsset, tailAssetChainID] = paraTool.parseAssetChain(tailAssetChain);
        for (const assetChain of Object.keys(this.assetInfo)) {
            let [asset, cID] = paraTool.parseAssetChain(assetChain);
            let assetInfo = this.assetInfo[assetChain];
            if ((assetInfo.assetType == paraTool.assetTypeERC20LiquidityPair || assetInfo.assetType == paraTool.assetTypeLiquidityPair) && (assetInfo.token0 && assetInfo.token1)) {
                let token0chain = paraTool.makeAssetChain(assetInfo.token0, assetInfo.chainID);
                let token1chain = paraTool.makeAssetChain(assetInfo.token1, assetInfo.chainID);
                if (router && assetInfo.assetName != router.routerName && isEVM) {


                } else if (assetInfo.token0 == tailAsset && (cID == tailAssetChainID) && this.path_not_explored(path, assetInfo, maxDepth)) {
                    // extend with a.token1
                    let newpath = [...path];
                    newpath.push({
                        route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                        dest: token1chain,
                        symbol: assetInfo.symbol,
                        token0Symbol: assetInfo.token0Symbol,
                        token1Symbol: assetInfo.token1Symbol,
                        createTS: assetInfo.createTS,
                        s: 1
                    });
                    extensions.push(newpath);

                } else if (assetInfo.token1 == tailAsset && (cID == tailAssetChainID) && this.path_not_explored(path, assetInfo, maxDepth)) {
                    // extend with a.token0
                    let newpath = [...path];
                    newpath.push({
                        route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                        dest: token0chain,
                        symbol: assetInfo.symbol,
                        token0Symbol: assetInfo.token0Symbol,
                        token1Symbol: assetInfo.token1Symbol,
                        createTS: assetInfo.createTS,
                        s: 0
                    });
                    extensions.push(newpath);
                }
            }
        }
        return (extensions);
    }

    path_not_explored(p, assetInfo, maxDepth = 2) {
        if (p.length >= maxDepth) return (false);
        for (let i = 0; i < p.length; i++) {
            if (p[i].route == assetInfo.assetChain) {
                return (false);
            }
        }
        return (true);
    }

    async getChainRouters(chainID = -1) {
        let sql = `select assetRouter.chainID, assetRouter.assetName as routerName, assetRouter.router as address, convert(asset.abiRaw using utf8) as ABI, numLPs
from assetRouter join asset on assetRouter.chainID = asset.chainID and assetRouter.router = asset.asset where assetRouter.chainID = asset.chainID and asset.isRouter = 1 and assetRouter.chainID = '${chainID}'`;
        console.log(sql);
        let recs = await this.poolREADONLY.query(sql);
        let routers = {};
        if (recs.length > 0) {
            for (const r of recs) {
                routers[r.routerName] = r;
            }
        }
        return routers;
    }

    // TODO use createTS to return not just path but the max createTS observed
    async getRouterPaths(paths, routers, allowMultipleRouters = false) {
        let filtered = [];
        for (let b = 0; b < paths.length; b++) {

            let succ = true;
            let out = [];
            let p0 = null;
            let last = null;
            for (let p = 0; p < paths[b].length; p++) {
                let s = paths[b][p];
                let [d, cID] = paraTool.parseAssetChain(s.dest);
                if (p == 0) {
                    p0 = d;
                } else {
                    let route = s.route;
                    let routeAsset = this.assetInfo[s.route];
                    let assetName = this.assetInfo[s.route].assetName;
                    if (this.assetInfo[s.route] && routers[this.assetInfo[s.route].assetName]) { // check that we know the router
                        if (out.length > 0 && out[out.length - 1][0] == assetName) {
                            out[out.length - 1].push(d)
                            last = d
                        } else {
                            if (p0) {
                                out.push([assetName, p0, d]);
                                p0 = null;
                                last = d
                            } else if (last) {
                                out.push([assetName, last, d]);
                                last = d
                            } else {
                                out.push([assetName, d]);
                                last = d
                            }
                        }
                    } else {
                        succ = false;
                        p = 9999;
                    }
                }
            }
            if (succ) { // ok, we found a full path using routers that we know
                if ((allowMultipleRouters == false) && (out.length > 1)) {} else {
                    filtered.push(out);
                }
            }
        }
        return (filtered);
    }
    async getBlockHashByBlockNumber(chainID, bn) {
        let blockHashes = await this.poolREADONLY.query(`select blockHash from block${chainID} where blockNumber = '${bn}'`);
        if (blockHashes.length == 0) {
            return null;
        }
        return blockHashes[0].blockHash;
    }

    // Asset Model Generation: For parachain DEX (Acala/Karura, Parallel/Heiko), use parachain SDK to get data
    async assetpricelogGenerationParachain(chainID = -1, interval = "5min", startDate = "2022-09-29", endDate = null) {
        await this.init();
        // a Parachain with a DEX behaves like a single centralized EVM router with router
        let chain = await this.getChain(chainID);
        let router = {
            chainID: chain.chainID,
            routerName: chain.id
        }
        let routerAssets = await this.getChainRouterAssets(router, false);
        let routerPaths = await this.getRouterAssetPaths(router, routerAssets, 2, false);
        //console.log(JSON.stringify(routerPaths, null, 4));
        await this.setupAPI(chain);
        let xcmassetpricelog = [];
        let assetpricelog = [];
        let vals = ["priceUSD", "priceUSD10", "priceUSD100", "priceUSD1000", "liquid", "verificationPath"];
        let routerAssetChain = `parachain~${chainID}`
        const indexTS = Math.floor(this.getCurrentTS() / 3600) * 3600;
        let blocks = await this.get_blocks_by_interval(chainID, startDate, endDate, interval);

        const {
            FixedPointNumber,
            Token,
            TokenPair
        } = require("@acala-network/sdk-core");
        const {
            WalletPromise
        } = require("@acala-network/sdk-wallet");
        const {
            SwapPromise
        } = require("@acala-network/sdk-swap");
        for (const assetChain of Object.keys(routerPaths)) {
            // console.log(assetChain, routerPaths[assetChain]); // routerPaths, JSON.stringify(routerPaths, null, 4));
            let [asset, chain] = paraTool.parseAssetChain(assetChain);
            let [isXCAsset, symbol, relayChain] = this.isXCAsset(asset, chainID);
            let paths = routerPaths[assetChain];
            for (const path of paths) {
                let hop = path[1] // only one path is handled by acala SDK, check parallel
                try {
                    for (let z = 0; z < blocks.length; z++) {
                        let b = blocks[z];
                        let blockHash = await this.getBlockHashByBlockNumber(chainID, b.bn0)
                        if (blockHash == null) continue;
                        let api = this.api // TODO: await this.api.at(blockHash)
                        let indexTS = b.indexTS;
                        let priceUSD = [];
                        let verificationPath = null;
                        if (chainID == paraTool.chainIDAcala || chainID == paraTool.chainIDKarura) {
                            const swapPromise = new SwapPromise(api);
                            const wallet = new WalletPromise(api);
                            let token0 = hop.token0Symbol;
                            let token1 = hop.token1Symbol;
                            if (token0 == "lcDOT") token0 = "lc://13";
                            if (token1 == "lcDOT") token1 = "lc://13";
                            let tokenPath = [wallet.getToken(token0), wallet.getToken(token1)];
                            //console.log("TOKEN PATH", tokenPath, wallet);
                            // CHECK directionality of pair usage
                            for (let d = 0; d < 4; d++) {
                                let amountIn = (10 ** (d));
                                if (hop.s == 0) tokenPath = tokenPath.reverse();
                                let amountInFP = new FixedPointNumber(amountIn, tokenPath[0].decimals);
                                let parameters = await swapPromise.swap(tokenPath, amountInFP, "EXACT_INPUT");
                                let amountOut = parameters.output.balance;
                                let rate = amountIn.toString() / amountOut.toString();
                                priceUSD.push(rate);
                                verificationPath = (chainID == paraTool.chainIDAcala) ? {
                                    acala: {
                                        path: [token0, token1],
                                        blockHash
                                    }
                                } : {
                                    karura: {
                                        path: [token0, token1],
                                        blockHash
                                    }
                                }
                            }
                        } else if (chainID == paraTool.chainIDParallel || chainID == paraTool.chainIDParallelHeiko) {
                            // TODO:
                        }
                        let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
                        let liquid = this.priceUSDArrayLiquid(priceUSD);
                        //console.log(logDT, hr, assetChain, liquid, priceUSD);
                        if (isXCAsset) {
                            xcmassetpricelog.push(`('${symbol}', '${relayChain}', '${routerAssetChain}', '${indexTS}', '${priceUSD[0]}', '${priceUSD[1]}', '${priceUSD[2]}', '${priceUSD[3]}', '${liquid}', ${mysql.escape(JSON.stringify(verificationPath))})`);
                            if (xcmassetpricelog.length > 100) {
                                await this.upsertSQL({
                                    "table": "xcmassetpricelog",
                                    "keys": ["symbol", "relayChain", "routerAssetChain", "indexTS"],
                                    "vals": vals,
                                    "data": xcmassetpricelog,
                                    "replace": vals
                                })
                                console.log("xcmassetpricelog", xcmassetpricelog.length);
                                xcmassetpricelog = []
                            }
                        } else {
                            assetpricelog.push(`('${asset}', '${chainID}', '${routerAssetChain}', '${indexTS}', '${priceUSD[0]}', '${priceUSD[1]}', '${priceUSD[2]}', '${priceUSD[3]}', '${liquid}', ${mysql.escape(JSON.stringify(path))})`);
                            if (assetpricelog.length > 100) {
                                await this.upsertSQL({
                                    "table": "assetpricelog",
                                    "keys": ["asset", "chainID", "routerAssetChain", "indexTS"],
                                    "vals": vals,
                                    "data": assetpricelog,
                                    "replace": vals
                                })
                                console.log("assetpricelog", assetpricelog.length);
                                assetpricelog = [];
                            }
                        }
                        if (interval == "5min" && (z == blocks.length - 1)) {
                            // priceUSDPercentChange
                            let priceUSD24hr = isXCAsset ? await this.get_xcasset_priceUSD(symbol, relayChain, indexTS - 86400) : await this.get_asset_priceUSD(asset, chainID, indexTS - 86400);
                            let priceUSDPercentChange = (priceUSD24hr > 0) ? 100 * (priceUSD[0] - priceUSD24hr) / priceUSD24hr : 0
                            let sql = isXCAsset ? `update xcmasset set priceUSD = '${priceUSD[0]}', lastPriceUpdateDT = from_unixtime(${indexTS}), verificationPath = ${mysql.escape(JSON.stringify(verificationPath))}, liquid = '${liquid}' where symbol = '${symbol}' and relayChain = '${relayChain}' and ( liquid > '${liquid}' or ( liquid > 0 and lastPriceUpdateDT < date_sub(Now(), interval 1 hour) ) ) ` : `update xcmasset set priceUSD = '${priceUSD[0]}', lastPriceUpdateDT = from_unixtime(${indexTS}) where symbol = '${symbol}' and relayChain = '${relayChain}' and ( liquid > '${liquid}' or ( liquid > 0 and lastPriceUpdateDT < date_sub(Now(), interval 1 hour) ) )`
                            console.log(sql);
                            this.batchedSQL.push(sql);
                            await this.update_batchedSQL(true);
                        }
                    }
                } catch (err) {
                    console.log(hop, err)
                }
            }
        }
        console.log("xcmassetpricelog", xcmassetpricelog);
        console.log("assetpricelog", assetpricelog);
        await this.upsertSQL({
            "table": "xcmassetpricelog",
            "keys": ["symbol", "relayChain", "routerAssetChain", "indexTS"],
            "vals": vals,
            "data": xcmassetpricelog,
            "replace": vals
        })
        await this.upsertSQL({
            "table": "assetpricelog",
            "keys": ["asset", "chainID", "routerAssetChain", "indexTS"],
            "vals": vals,
            "data": assetpricelog,
            "replace": vals
        })
        console.log("routerAssetChain", routerAssetChain);
    }

    async get_xcasset_priceUSD(symbol, relayChain, indexTS) {
        let sql = `select priceUSD from xcmassetpricelog where  symbol = '${symbol}' and relayChain = '${relayChain}' and indexTS <= ${indexTS} order by indexTS desc, liquid limit 1`
        try {
            let recs = await this.poolREADONLY.query(sql);
            if (recs.length > 0) {
                return recs[0].priceUSD;
            }
        } catch (e) {
            console.log(e);
        }
        return 0;
    }
    async get_asset_priceUSD(asset, chainID, indexTS) {
        let sql = `select priceUSD from assetpricelog where  asset = '${asset}' and chainID = '${chainID}' and indexTS <= ${indexTS} order by indexTS desc, liquid limit 1`
        try {
            let recs = await this.poolREADONLY.query(sql);
            if (recs.length > 0) {
                return recs[0].priceUSD;
            }
        } catch (e) {
            console.log(e);
        }
        return 0;
    }


    async getChainRouterAssets(router, isEVM = true) {
        let sql = `select token0, token1, token0symbol, token1symbol, FROM_UNIXTIME(createDT) as createTS from asset where assetType =  'ERC20LP'   and chainID = '${router.chainID}' and assetName = '${router.routerName}'`
        if (isEVM == false) {
            sql = `select token0, token1, token0symbol, token1symbol, FROM_UNIXTIME(createDT) as createTS from asset where assetType = 'LiquidityPair' and chainID = '${router.chainID}'`
        }
        let assets = await this.poolREADONLY.query(sql)
        let routerAssets = {};
        for (const a of assets) {
            routerAssets[a.token0] = a.token0symbol;
            routerAssets[a.token1] = a.token1symbol;
        }
        return (routerAssets);
    }

    async getRouterAssetPaths(router, routerAssets, maxDepth, isEVM) {
        // add the roots:
        this.explored = {};
        this.resultPaths = {};

        for (const asset of Object.keys(routerAssets)) {
            let assetChain = paraTool.makeAssetChain(asset, router.chainID);
            let assetInfo = this.assetInfo[assetChain];

            if (assetInfo && assetInfo.isUSD) {
                //console.log("getRouterAssetPaths: isUSD start", assetChain, assetInfo);
                this.enqueue([{
                    dest: assetChain,
                    symbol: assetInfo.symbol
                }]);
                this.explored[assetChain] = true;
            }
        }
        let path = false;
        while (path = this.dequeue()) {
            let extensions = this.getPathExtensions(path, router, maxDepth, isEVM);
            for (let e = 0; e < extensions.length; e++) {
                let p = extensions[e];
                let tailAssetChain = p[p.length - 1].dest;
                if (tailAssetChain == undefined) {
                    console.log("FAIL xxx", p);
                }
                if (this.resultPaths[tailAssetChain] == undefined) {
                    this.resultPaths[tailAssetChain] = [];
                }
                this.resultPaths[tailAssetChain].push(extensions[e]);
                this.enqueue(extensions[e]);
            }
        }
        return this.resultPaths;
    }

    // Maps router path like
    // [ { dest: '0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b~2004', symbol: 'USDC' },
    //  { route: '0x0557949ea1f39e08233246d15af6c24cf8b92b82~2004',    dest: '0xffffffff5ac1f9a51a93f5c527385edf7fe98a52~2004',    symbol: 'BEAM-LP',    token0Symbol: 'USDC',    token1Symbol: 'xcIBTC',    s: 1  } ]
    // into ['0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b' '0xffffffff5ac1f9a51a93f5c527385edf7fe98a52'] that a router contract can accept as an argument */
    getRouterPathFromAnnotatedPath(annotatedPath) {
        let path = [];
        let pathStartTS = 0; // this will be maximum of all LPs
        for (let p = 0; p < annotatedPath.length; p++) {
            let assetChain = annotatedPath[p].dest;
            if (assetChain) {
                if (annotatedPath[p].createTS && annotatedPath[p].createTS > pathStartTS) {
                    pathStartTS = annotatedPath[p].createTS;
                }
                let [asset, _] = paraTool.parseAssetChain(assetChain);
                path.push(asset);
            } else {
                // TODO: throw error
            }
        }
        return [path, pathStartTS];
    }

    async get_blocks_by_interval(chainID, startDate, endDate, interval = "daily") {
        let w = endDate ? ` and blockDT <= ${endDate}` : "and blockDT <= Now()"
        // SETUP: pull hourly blockNumber starts beginning at startDate
        let sql = `select floor(unix_timestamp(blockDT)/3600)*3600 as indexTS, min(blockNumber) bn0, max(blockNumber) bn1 from block${chainID} where blockDT >= '${startDate}' ${w} and blockDT is not null group by indexTS order by indexTS desc limit 300`;
        if (interval == "daily") {
            sql = `select floor(unix_timestamp(blockDT)/86400)*86400 as indexTS, min(blockNumber) bn0, max(blockNumber) bn1 from block${chainID} where blockDT >= '${startDate}' ${w} and blockDT is not null group by indexTS order by indexTS desc limit 300`;
        }
        if (interval == "5min") {
            sql = `select floor(unix_timestamp(blockDT)/300)*300 as indexTS, min(blockNumber) bn0, max(blockNumber) bn1 from block${chainID} where blockDT >= date_sub(Now(), interval 10 minute) and blockDT is not null group by indexTS order by indexTS desc limit 10`;
        }
        return await this.poolREADONLY.query(sql);
    }

    priceUSDArrayLiquid(priceUSD) {
        return Math.log(priceUSD[priceUSD.length - 1]) - Math.log(priceUSD[0]);
    }

    async updateAssetPriceLog(chainID = -1, interval = "5min", startDate = "2022-09-01", endDate = null) {
        switch (chainID) {
            case 2004:
            case 22023:
            case 2006:
            case 22007:
                await this.assetpricelogGenerationEVM(chainID, interval);
                break;
            default:
                await this.assetpricelogGenerationParachain(chainID, interval);
                break;
        }
    }

    // AssetModel Generation: For routers with (chain.isEVM = 1)
    // (1) generate a single-router analysis extending BFS from USD known to the router
    // (2) use ethers blockTag and block table for chain to genrate priceUSD for every hour, storing in assetpricelog or xcmassetpricelog based on whether its an xcasset
    async assetpricelogGenerationEVM(chainID = -1, interval = "daily", startDate = "2022-05-01", endDate = null) {
        await this.init(); /// sets up this.assetInfo
        let chain = await this.getChain(chainID)

        // get chain routers, and for each router, get assets covered by the router, and compute paths for the router extending from USD to all those assets
        const routers = await this.getChainRouters(chainID);
        for (const routerName of Object.keys(routers)) {
            let router = routers[routerName];
            // compute paths out of USD
            let assets = await this.getChainRouterAssets(router);
            router.paths = await this.getRouterAssetPaths(router, assets, 2);
        }

        // SETUP: ethers provider/wallet for chain
        let pk = await fs.readFileSync("/root/.walletevm2")
        pk = pk.toString().trim();
        let execute = false
        let id = chain.id;
        const provider = new ethers.providers.JsonRpcProvider(
            chain.RPCBackfill, {
                chainId: chain.evmChainID,
                name: id
            }
        );
        let wallet = new ethers.Wallet(pk.toString(), provider);

        let liquidBest = {}
        let blocks = await this.get_blocks_by_interval(chainID, startDate, endDate, interval);
        console.log(chain.RPCBackfill, chain, blocks);
        // for each path in router paths, use the hourly blockNumber from "blocks" to compute how much $1 gets you for the token
        const liquidMax = 3 // do not update price if exceeding this
        for (const routerName of Object.keys(routers)) {
            // take a router and its paths, use the Contract to call getAmountsOut and figure out how much of the end asset exists after the path
            let router = routers[routerName];
            if (!router.paths) continue;
            let abiRaw = JSON.parse(router.ABI);
            let abi = abiRaw.result;
            let assetpricelog = [];
            let routerAssetChain = paraTool.makeAssetChain(router.address, chainID)
            let xcmassetpricelog = [];
            try {
                const contract = new ethers.Contract(router.address, abi, wallet);
                let vals = ["priceUSD", "priceUSD10", "priceUSD100", "priceUSD1000", "liquid", "verificationPath"];
                //console.log("ROUTER PATHS for", routerName, JSON.stringify(router.paths, null, 4));
                for (const assetChain of Object.keys(router.paths)) {
                    let [asset, cID] = paraTool.parseAssetChain(assetChain);
                    let dec = this.getAssetDecimal(asset, chainID)
                    let [isXCAsset, symbol, relayChain] = this.isXCAsset(asset, chainID);
                    for (const annotatedPath of router.paths[assetChain]) {
                        let [path, pathStartTS] = this.getRouterPathFromAnnotatedPath(annotatedPath); // eg. path = ["0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b", "0xffffffff1fcacbd218edc0eba20fc2308c778080"];

                        let usdAsset = path[0]
                        let decUSD = this.getAssetDecimal(usdAsset, chainID) // 6
                        // perform historical analysis of the asset using the path, varying "blockTag" and recording results
                        for (let z = 0; z < blocks.length; z++) {
                            let b = blocks[z];
                            let indexTS = b.indexTS;
                            if (indexTS < pathStartTS) continue;
                            let blockTag = paraTool.bnToHex(b.bn0);
                            try {
                                let priceUSD = [];
                                let verificationPath = {}
                                verificationPath[router.address] = {
                                    path,
                                    blockNumber: b.bn0
                                };
                                for (let d = 0; d < 4; d++) {
                                    let s = (10 ** (d + decUSD)).toString() // $.001 (d=0), $10 (d=1), $100 (d=2), $1000 (d=3)
                                    if (d == 0) s = "1000";
                                    let start = ethers.BigNumber.from(s);
                                    const rawResult = await contract.getAmountsOut(start, path, {
                                        blockTag
                                    });
                                    let outarr = rawResult.toString().split(",");
                                    let p = outarr[outarr.length - 1] / 10 ** dec; // its the LAST amount that matters
                                    if (p > 0) {
                                        if (d == 0) {
                                            priceUSD.push(.001 / p);
                                        } else {
                                            priceUSD.push((10 ** (d)) / p);
                                        }
                                    }
                                }
                                if (priceUSD.length == 4 && priceUSD[0] < priceUSD[1]) {
                                    let liquid = this.priceUSDArrayLiquid(priceUSD);
                                    console.log("router", routerName, router.address, "Valuing:", symbol, asset, "starting with", usdAsset, "priceUSD=", priceUSD, annotatedPath);
                                    if (isXCAsset) {
                                        xcmassetpricelog.push(`('${symbol}', '${relayChain}', '${routerAssetChain}', '${indexTS}', '${priceUSD[0]}', '${priceUSD[1]}', '${priceUSD[2]}', '${priceUSD[3]}', '${liquid}', ${mysql.escape(JSON.stringify(verificationPath))})`);
                                        if (xcmassetpricelog.length > 100) {
                                            await this.upsertSQL({
                                                "table": "xcmassetpricelog",
                                                "keys": ["symbol", "relayChain", "routerAssetChain", "indexTS"],
                                                "vals": vals,
                                                "data": xcmassetpricelog,
                                                "replace": vals
                                            })
                                            console.log("xcmassetpricelog", xcmassetpricelog.length);
                                            xcmassetpricelog = []
                                        }
                                    } else {
                                        assetpricelog.push(`('${asset}', '${chainID}', '${routerAssetChain}', '${indexTS}', '${priceUSD[0]}', '${priceUSD[1]}', '${priceUSD[2]}', '${priceUSD[3]}', '${liquid}', ${mysql.escape(JSON.stringify(verificationPath))})`);
                                        if (assetpricelog.length > 100) {
                                            await this.upsertSQL({
                                                "table": "assetpricelog",
                                                "keys": ["asset", "chainID", "routerAssetChain", "indexTS"],
                                                "vals": vals,
                                                "data": assetpricelog,
                                                "replace": vals
                                            })
                                            console.log("assetpricelog", assetpricelog.length);
                                            assetpricelog = [];
                                        }
                                    }
                                    if (interval == "5min" && (z == blocks.length - 1) && liquid < liquidMax && liquid > 0) {
                                        if (liquidBest[asset] == undefined || liquidBest[asset] > liquid) {
                                            let priceUSD24hr = isXCAsset ? await this.get_xcasset_priceUSD(symbol, relayChain, indexTS - 86400) : await this.get_asset_priceUSD(asset, chainID, indexTS - 86400);
                                            let priceUSDPercentChange = (priceUSD24hr > 0) ? 100 * (priceUSD[0] - priceUSD24hr) / priceUSD24hr : 0
                                            let sql = isXCAsset ? `update xcmasset set priceUSD = '${priceUSD[0]}', lastPriceUpdateDT = from_unixtime(${indexTS}), liquid = ${liquid}, priceUSDPercentChange = '${priceUSDPercentChange}', verificationPath = ${mysql.escape(JSON.stringify(verificationPath))} where symbol = '${symbol}' and relayChain = '${relayChain}'` : `update asset set priceUSD = '${priceUSD[0]}', lastPriceUpdateDT = from_unixtime(${indexTS}), liquid = ${liquid}, priceUSDPercentChange = '${priceUSDPercentChange}', verificationPath = ${mysql.escape(JSON.stringify(verificationPath))} where asset = '${asset}' and chainID = '${chainID}'`
                                            console.log(sql);
                                            this.batchedSQL.push(sql);
                                            await this.update_batchedSQL();
                                            liquidBest[asset] = liquid
                                        }
                                    }
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        }
                    }
                }
                await this.upsertSQL({
                    "table": "assetpricelog",
                    "keys": ["asset", "chainID", "routerAssetChain", "indexTS"],
                    "vals": vals,
                    "data": assetpricelog,
                    "replace": vals
                })

                await this.upsertSQL({
                    "table": "xcmassetpricelog",
                    "keys": ["symbol", "relayChain", "routerAssetChain", "indexTS"],
                    "vals": vals,
                    "data": xcmassetpricelog,
                    "replace": vals
                })
            } catch (error) {
                console.log(error)
            }
        }
    }

    async update_coingecko_backfill(startDate = '2022-01-01', endDate = '2022-04-01') {
        let coingeckoRecs = await this.poolREADONLY.query(`select coingeckoID, symbol, relayChain from xcmasset where coingeckoID is not null`);
        let coingeckoids = {};
        for (let r = 0; r < coingeckoRecs.length; r++) {
            let rec = coingeckoRecs[r];
            let symbolRelayChain = paraTool.makeAssetChain(rec.symbol, rec.relayChain);
            coingeckoids[symbolRelayChain] = rec.coingeckoID;
        }

        let sql = `select symbol, relayChain, logDT, min(unix_timestamp(logDT)) as startTS, count(*) cnt from indexlog left join xcmassetpricelog on indexlog.indexTS = xcmassetpricelog.indexTS where indexlog.chainID = 0 and indexlog.logDT >= '${startDate}' and logDT <= '${endDate}' and symbol in ( select symbol from xcmasset where coingeckoid is not null ) and relayChain in ( 'polkadot', 'kusama' ) and routerAssetChain like '%coingecko%' group by symbol, relayChain, logDT having count(*) != 24 order by logDT`;
        var fixes = await this.poolREADONLY.query(sql);
        for (let f = 0; f < fixes.length; f++) {
            let fix = fixes[f];
            let symbolRelayChain = paraTool.makeAssetChain(fix.symbol, fix.relayChain);
            let id = coingeckoids[symbolRelayChain];
            if (id) {
                let startTS = fix.startTS;
                let endTS = fix.startTS + 86400;
                await this.update_coingecko_market_chart(id, fix.symbol, fix.relayChain, startTS, endTS);
                await this.sleep(5000);
            }
        }
    }

    // update assetlog with prices/market_caps/volumes from coingecko API
    async update_coingecko_market_chart(id, symbol, relayChain, startTS, endTS) {
        const axios = require("axios");
        var url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=USD&from=${startTS}&to=${endTS}`;
        try {
            console.log("update_coingecko_market_chart URL", url)
            var headers = {
                "accept": "application/json"
            };
            const resp = await axios.get(url, {
                headers: headers
            });

            const prices_arr = resp.data.prices;
            const market_caps_arr = resp.data.market_caps;
            const total_volumes_arr = resp.data.total_volumes;
            var a = [];
            var market_caps = {};
            for (const mc of market_caps_arr) {
                let hourlyKey = this.hourly_key_from_ts(mc[0] / 1000);
                market_caps[hourlyKey] = mc[1];
            }
            var total_volumes = {};
            for (const tv of total_volumes_arr) {
                let hourlyKey = this.hourly_key_from_ts(tv[0] / 1000);
                total_volumes[hourlyKey] = tv[1];
            }
            let asset = JSON.stringify({
                Token: symbol
            });
            let out = [];
            let vals = ["priceUSD", "total_volumes", "market_caps", "liquid", "verificationPath"];
            for (const t of prices_arr) {
                var tm = Math.round(t[0] / 1000);
                let hourlyKey = this.hourly_key_from_ts(tm);
                let verificationPath = {
                    "coingecko": id
                }
                out.push(`('${symbol}', '${relayChain}', '${hourlyKey}','website~${paraTool.assetSourceCoingecko}','${t[1]}', '${total_volumes[hourlyKey]}', '${market_caps[hourlyKey]}', '0', ${mysql.escape(JSON.stringify(verificationPath))})`);
            }
            if (out.length > 0) {
                await this.upsertSQL({
                    "table": "xcmassetpricelog",
                    "keys": ["symbol", "relayChain", "indexTS", "routerAssetChain"],
                    "vals": vals,
                    "data": out,
                    "replace": vals,
                })
                let sql = `update xcmasset set coingeckoLastUpdateDT = Now() where symbol = '${symbol}' and relayChain = '${relayChain}'`
                this.batchedSQL.push(sql);
                await this.update_batchedSQL(true);
            }
        } catch (err) {
            this.logger.error({
                op: "update_coingecko_market_chart",
                url: url,
                err
            });
        }
        return false;
    }

    async fetch_coin_prices_percentages(coingeckoIDList) {
        const axios = require("axios");
        let coingeckoIDs = encodeURIComponent(coingeckoIDList.join(','))

        try {
            let url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIDs}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
            console.log("fetch_coin_prices_percentages URL", url)
            const resp = await axios.get(url, {
                headers: {
                    "accept": "application/json"
                }
            });
            let priceData = resp.data
            for (const coingeckoID of Object.keys(priceData)) {
                let data = priceData[coingeckoID]
                /* data will be like:
                {
                "polkadot": {
                "usd": 20.98,
                "usd_market_cap": 22698288092.099922,
                "usd_24h_vol": 1050989653.3115339,
                "usd_24h_change": -5.3150672466158575,
                "last_updated_at": 1644528830
                }
                }
                */
                if (Object.keys(data).length !== 0) {
                    // found in map, prepare sql update statement
                    let priceUSD = (data.usd != undefined) ? data.usd : 0
                    let priceUSDPercentChange = (data.usd_24h_change != undefined) ? data.usd_24h_change : 0
                    let lastPriceUpdateTS = (data.last_updated_at != undefined) ? data.last_updated_at : 0
                    let verificationPath = {
                        "coingecko": coingeckoID,
                        ts: lastPriceUpdateTS
                    }
                    if (priceUSD > 0) {
                        let sql = `update xcmasset set priceUSD=${priceUSD}, priceUSDPercentChange=${priceUSDPercentChange}, lastPriceUpdateDT=FROM_UNIXTIME(${lastPriceUpdateTS}), liquid = 0, verificationPath = ${mysql.escape(JSON.stringify(verificationPath))} where coingeckoID = '${coingeckoID}';`
                        this.batchedSQL.push(sql);
                        console.log(sql);
                        await this.update_batchedSQL();
                    }
                }
            }
        } catch (err) {
            console.log(err);
            this.logger.error({
                op: "fetch_coin_prices_percentages",
                err
            });
        }
        return false;
    }

    async getCoinPricesRange(startTS, endTS) {
        var coingeckoIDs = await this.poolREADONLY.query(`select coingeckoID, symbol, relayChain from xcmasset where coingeckoID is not null and coingeckoLastUpdateDT < date_sub(Now(), interval 5 minute) order by coingeckoLastUpdateDT limit 1000`);
        console.log(`getCoinPricesRange ${coingeckoIDs.length}`)
        let batchSize = 86400 * 30
        for (let currDailyTS = startTS; currDailyTS < endTS; currDailyTS += batchSize) {
            let currDailyEndTS = currDailyTS + batchSize
            for (const ids of coingeckoIDs) {
                await this.update_coingecko_market_chart(ids.coingeckoID, ids.symbol, ids.relayChain, currDailyTS, currDailyEndTS);
                console.log(`got ${ids.symbol}`);
                await this.sleep(5000);
            }
        }
    }

    async getCoinPrices(lookback = 7) {
        let startTS = (lookback > 0) ? Math.floor(Date.now() / 1000) - 86400 * lookback : Math.floor(Date.now() / 1000) - 3600 * 24;
        let endTS = startTS + 86401
        var coingeckoIDs = await this.poolREADONLY.query(`select coingeckoID, symbol, relayChain from xcmasset where coingeckoID is not null and coingeckoLastUpdateDT < date_sub(Now(), interval 5 minute) limit 20`);
        let assetMap = {}
        let coingeckoIDList = []
        for (const ids of coingeckoIDs) {
            try {
                console.log(ids);
                await this.update_coingecko_market_chart(ids.coingeckoID, ids.symbol, ids.relayChain, startTS, endTS, "chain");
                coingeckoIDList.push(ids.coingeckoID)
                await this.sleep(5000);
            } catch (e) {
                console.log(e)
            }
        }
        await this.fetch_coin_prices_percentages(coingeckoIDList);
    }

    async updateFeesAPY(chainID, test = false) {
        let lookbackDaysRanges = [1, 7, 30];
        for (const lookbackDays of lookbackDaysRanges) {
            await this.update_fees_apy(chainID, lookbackDays, test);
        }
    }

    async update_fees_apy(chainID, lookbackDays = 7, test = true) {
        try {
            let wstr = (test) ? " and asset.asset = '0xa927e1e1e044ca1d9fe1854585003477331fe2af'" : ""
            let sql = `select asset.asset, asset.chainID, indexTS, token0, token1, token0Symbol, token1Symbol, symbol, lp0, lp1, totalFree, totalReserved, convert(state using utf8) state from assetlog, asset where assetlog.asset = asset.asset and assetlog.chainID = asset.chainID and indexTS >= unix_timestamp(date_sub(Now(), interval 24 * ${lookbackDays} hour)) and assetType = 'ERC20LP' and asset.chainID = ${chainID} and indexTS % 3600 = 0 ${wstr}`
            var recs = await this.poolREADONLY.query(sql);
            let assetrecs = {};
            for (const r of recs) {
                if (assetrecs[r.asset] == undefined) {
                    assetrecs[r.asset] = [];
                }
                r.state = JSON.parse(r.state);
                assetrecs[r.asset].push(r);
            }
            let out = [];
            let vals = [`apy${lookbackDays}d`, `feesUSD${lookbackDays}d`, `tvlUSD`, `priceUSD`];
            for (const asset of Object.keys(assetrecs)) {
                let lp = assetrecs[asset][0]
                let summary = await this.compute_apy_fees(assetrecs[asset], lp);
                if (summary && summary.average_tvlUSD > 100) {
                    console.log("lp", lp.token0Symbol, lp.token1Symbol, "summary", summary);
                    out.push(`(${mysql.escape(asset)}, '${chainID}', '${summary.apy}', '${summary.daily_feesUSD*lookbackDays}', '${summary.tvlUSD}', '${summary.priceUSD}')`);
                    if (out.length > 0) {
                        await this.upsertSQL({
                            "table": "asset",
                            "keys": ["asset", "chainID"],
                            "vals": vals,
                            "data": out,
                            "replace": vals
                        });
                        out = [];
                    }
                }
            }
            console.log(lookbackDays, out);
            await this.upsertSQL({
                "table": "asset",
                "keys": ["asset", "chainID"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
        } catch (err) {
            console.log(err);
            process.exit(0);
        }
    }
    async compute_apy_fees(hourlydata, lpRecord) {
        let sum = {
            token0Price: 0,
            token1Price: 0,
            token0Fee: 0,
            token1Fee: 0,
            issuance: 0,
            tvlUSDLast: 0,
            tvlUSD: 0,
            tvlUSDTS: 0,
            numHours: 0,
            token0FeeUSD: 0,
            token1FeeUSD: 0
        }

        let totalFree = null;
        for (const x of hourlydata) {
            // this gets the price of each token in the pair for each hour
            let p0 = await this.getTokenPriceUSD(x.token0, x.chainID, x.indexTS + 1800)
            let p1 = await this.getTokenPriceUSD(x.token1, x.chainID, x.indexTS + 1800)
            if (p0 && p1) {
                let s = x.state;
                let tvlUSD = x.lp0 * p0.priceUSD + x.lp1 * p1.priceUSD;
                sum.currToken0Price = p0.priceUSD
                sum.currToken1Price = p1.priceUSD
                sum.currToken0FeeUSD = (s.token0Volume) * 0.0025 * p0.priceUSD;
                sum.currToken1FeeUSD = (s.token1Volume) * 0.0025 * p1.priceUSD;
                if (x.indexTS > sum.tvlUSDTS) {
                    sum.tvlUSDTS = x.indexTS;
                    sum.tvlUSDLast = tvlUSD;
                }
                sum.tvlUSD += tvlUSD;
                sum.token0Fee += (s.token0Volume) * 0.0025; // not used
                sum.token1Fee += (s.token1Volume) * 0.0025; // not used
                sum.token0FeeUSD += (s.token0Volume) * 0.0025 * p0.priceUSD;
                sum.token1FeeUSD += (s.token1Volume) * 0.0025 * p1.priceUSD;
                sum.issuance += s.issuance; // not used
                sum.numHours++;
                totalFree = x.totalFree;
            }

        }
        if (sum.numHours > 0) {
            let hourly_feesUSD = (sum.token0FeeUSD + sum.token1FeeUSD) / sum.numHours; // this works even if we have < 24 hours
            let daily_feesUSD = 24 * hourly_feesUSD;
            let average_tvlUSD = sum.tvlUSD / sum.numHours;
            let average_issuance = sum.issuance / sum.numHours; // not used
            let apy = (daily_feesUSD / average_tvlUSD) * 365;
            let tvlUSD = sum.tvlUSDLast;
            let priceUSD = (totalFree > 0) ? tvlUSD / totalFree : 0;
            return {
                apy,
                daily_feesUSD,
                tvlUSD,
                average_tvlUSD,
                average_issuance,
                priceUSD
            }
        } else {
            return null;
        }

        let sql = `update router, (select routerAssetChain, round(sum(asset.tvlUSD), 2) as tvlUSD from asset join router on asset.assetName=router.assetName group by routerAssetChain) as t set router.tvl = t.tvlUSD where router.routerAssetChain = t.routerAssetChain;`
        this.batchedSQL.push(sql);
        await this.update_batchedSQL();
    }


}
