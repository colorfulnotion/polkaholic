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
const mysql = require("mysql2");

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

    get_symbol(assetChain) {
        if (this.assetInfo[assetChain] != undefined) {
            return this.assetInfo[assetChain].symbol;
        }
        return null;
    }


    getPathExtensions(path) {
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
            if (assetInfo.routeDisabled) {

            } else if ((assetInfo.assetType == paraTool.assetTypeERC20LiquidityPair || assetInfo.assetType == paraTool.assetTypeLiquidityPair || assetInfo.assetType == paraTool.assetTypeXCAsset || assetInfo.assetType == paraTool.assetTypeXCMTransfer) && (assetInfo.token0 && assetInfo.token1)) {
                let chainIDDest = null;
                if (assetInfo.assetType == paraTool.assetTypeXCMTransfer) {
                    chainIDDest = assetInfo.chainIDDest;
                }
                let debug = (assetInfo.assetType == paraTool.assetTypeXCMTransfer);

                let token0chain = paraTool.makeAssetChain(assetInfo.token0, assetInfo.chainID);
                let token1chain = paraTool.makeAssetChain(assetInfo.token1, assetInfo.chainID);
                if (assetInfo.symbol == "ZLK-LP") {
                    // skip for now
                } else if (assetInfo.assetType == paraTool.assetTypeXCMTransfer) {
                    let x = JSON.parse(asset)
                    if (x.xcmtransfer) {
                        let symbol = x.xcmtransfer.symbol;
                        let chainIDDest = x.xcmtransfer.chainIDDest;
                        token0chain = paraTool.makeAssetChain(assetInfo.token0, cID);
                        token1chain = paraTool.makeAssetChain(assetInfo.token1, chainIDDest);
                        if ((cID == tailAssetChainID) && this.explored[token1chain] == undefined && (symbol == this.get_symbol(tailAssetChain))) {
                            // extend with a.token1
                            let newpath = [...path];
                            newpath.push({
                                route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                                dest: token1chain,
                                symbol: assetInfo.symbol,
                                token0Symbol: assetInfo.token0Symbol,
                                token1Symbol: assetInfo.token1Symbol,
                                s: 1
                            });
                            if (debug) {
                                console.log("extending0 xcmtransfer", assetChain, newpath);
                            }
                            extensions.push(newpath);
                            this.explored[token1chain] = true;
                        } else if ((chainIDDest == tailAssetChainID) && this.explored[token0chain] == undefined && (symbol == this.get_symbol(tailAssetChain))) {
                            // extend with a.token0
                            let newpath = [...path];
                            newpath.push({
                                route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                                dest: token0chain,
                                symbol: assetInfo.symbol,
                                token0Symbol: assetInfo.token0Symbol,
                                token1Symbol: assetInfo.token1Symbol,
                                s: 0
                            });
                            if (debug) {
                                console.log("extending1 xcmtransfer", assetChain, newpath);
                            }
                            extensions.push(newpath);
                            this.explored[token0chain] = true;
                        }
                    }
                } else if (assetInfo.token0 == tailAsset && (cID == tailAssetChainID) && this.explored[token1chain] == undefined) {

                    // extend with a.token1
                    let newpath = [...path];
                    newpath.push({
                        route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                        dest: token1chain,
                        symbol: assetInfo.symbol,
                        token0Symbol: assetInfo.token0Symbol,
                        token1Symbol: assetInfo.token1Symbol,
                        s: 1
                    });
                    extensions.push(newpath);
                    this.explored[token1chain] = true;
                } else if (assetInfo.token1 == tailAsset && (cID == tailAssetChainID) && this.explored[token0chain] == undefined) {
                    // extend with a.token0
                    let newpath = [...path];
                    newpath.push({
                        route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                        dest: token0chain,
                        symbol: assetInfo.symbol,
                        token0Symbol: assetInfo.token0Symbol,
                        token1Symbol: assetInfo.token1Symbol,
                        s: 0
                    });
                    extensions.push(newpath);
                    this.explored[token0chain] = true;
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

    recentRoutes = {};

    async compute_route_rat(p, sym) {
        //if ( p.symbol == "ZLK-LP" ) return([null, null]);
        if (this.assetInfo[p.route] == undefined) {
            return [null, null, null];
        } else if (this.assetInfo[p.route].numHolders < 5) {
            return [null, null, null];
        }
        let [asset, chainID] = paraTool.parseAssetChain(p.route);
        let sql = `select close from assetlog where asset = '${asset}' and chainID = ${chainID} order by indexTS desc limit 1` /// and indexTS > UNIX_TIMESTAMP(date_sub(Now(), interval 100 hour))
        let recents = await this.poolREADONLY.query(sql)
        if (recents.length > 0) {
            let close = recents[0].close;
            if (p.token0Symbol == sym) {
                return [1.0 / close, p.token1Symbol, this.assetInfo[p.route].numHolders];
            } else if (p.token1Symbol == sym) {
                return [close, p.token0Symbol, this.assetInfo[p.route].numHolders];
            }
        }
        return [null, null, null];
    }

    async compute_path_rat(path) {
        let rat = 1.0;
        let sym = path[0].symbol;
        for (let i = 1; i < path.length; i++) {
            let [route_rat, new_sym, numHolders] = await this.compute_route_rat(path[i], sym);
            if (route_rat && new_sym) {
                path[i].rat = route_rat;
                path[i].numHolders = numHolders;
                rat *= route_rat;
                sym = new_sym
            } else {
                return (null);
            }
        }
        return rat;
    }

    async showAssetCycles(symbol) {
        await this.init(); /// sets up this.assetInfo

        let sql = `select asset.asset, asset.chainID, paths from assetcycle join asset on asset.chainID = assetcycle.chainID and asset.asset = assetcycle.asset and asset.symbol = '${symbol}' order by numHolders desc limit 10;`
        let assetChains = await this.poolREADONLY.query(sql);
        for (let a = 0; a < assetChains.length; a++) {
            let r = assetChains[a];
            let asset = r.asset;
            let chainID = r.chainID;
            let paths = JSON.parse(r.paths);
            console.log(paths);
            for (let b = 0; b < paths.length; b++) {
                let rat = await this.compute_path_rat(paths[b]);
                //if ( rat > 1.005 ) {
                console.log(paths[b], rat);
                //}
            }
        }
    }

    getPathExtensionsBFS(path, maxDepth = 2) {
        let extensions = [];
        let tailAssetChain = path[path.length - 1].dest; // the last element, which is an assetChain
        if (tailAssetChain == undefined) {
            return (extensions);
        }
        let [tailAsset, tailAssetChainID] = paraTool.parseAssetChain(tailAssetChain);
        for (const assetChain of Object.keys(this.assetInfo)) {
            let [asset, cID] = paraTool.parseAssetChain(assetChain);
            let assetInfo = this.assetInfo[assetChain];
            if (assetInfo.routeDisabled) {
                // aUSD hack
            } else if ((assetInfo.assetType == paraTool.assetTypeERC20LiquidityPair || assetInfo.assetType == paraTool.assetTypeLiquidityPair || assetInfo.assetType == paraTool.assetTypeXCAsset || assetInfo.assetType == paraTool.assetTypeXCMTransfer) && (assetInfo.token0 && assetInfo.token1)) {
                let chainIDDest = null;
                if (assetInfo.assetType == paraTool.assetTypeXCMTransfer) {
                    chainIDDest = assetInfo.chainIDDest;
                }
                let debug = (assetInfo.assetType == paraTool.assetTypeXCMTransfer);
                let token0chain = paraTool.makeAssetChain(assetInfo.token0, assetInfo.chainID);
                let token1chain = paraTool.makeAssetChain(assetInfo.token1, assetInfo.chainID);
                if (assetInfo.assetType == paraTool.assetTypeXCMTransfer) {
                    let x = JSON.parse(asset)
                    if (x.xcmtransfer) {
                        let symbol = x.xcmtransfer.symbol;
                        let chainIDDest = x.xcmtransfer.chainIDDest;
                        if ((cID == tailAssetChainID) && (symbol == this.get_symbol(tailAssetChain)) && this.path_not_explored(path, assetInfo, maxDepth)) {
                            // extend with a.token1
                            let newpath = [...path];
                            let token1chain = paraTool.makeAssetChain(assetInfo.token1, chainIDDest);
                            newpath.push({
                                route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                                dest: token1chain,
                                symbol: assetInfo.symbol,
                                token0Symbol: assetInfo.token0Symbol,
                                token1Symbol: assetInfo.token1Symbol,
                                s: 1
                            });
                            console.log("extending0 xcmtransfer", assetChain, newpath);
                            extensions.push(newpath);

                        } else if ((chainIDDest == tailAssetChainID) && (symbol == this.get_symbol(tailAssetChain)) && this.path_not_explored(path, assetInfo, maxDepth)) {
                            // extend with a.token0
                            let newpath = [...path];
                            let token0chain = paraTool.makeAssetChain(assetInfo.token0, cID);
                            newpath.push({
                                route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                                dest: token0chain,
                                symbol: assetInfo.symbol,
                                token0Symbol: assetInfo.token0Symbol,
                                token1Symbol: assetInfo.token1Symbol,
                                s: 0
                            });
                            console.log("extending1 xcmtransfer", assetChain, newpath);
                            extensions.push(newpath);
                        }
                    }
                } else if (assetInfo.numHolders < 5) {} else if (assetInfo.token0 == tailAsset && (cID == tailAssetChainID) && this.path_not_explored(path, assetInfo, maxDepth)) {
                    // extend with a.token1
                    let newpath = [...path];
                    newpath.push({
                        route: paraTool.makeAssetChain(assetInfo.asset, assetInfo.chainID),
                        dest: token1chain,
                        symbol: assetInfo.symbol,
                        token0Symbol: assetInfo.token0Symbol,
                        token1Symbol: assetInfo.token1Symbol,
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
                        s: 0
                    });
                    extensions.push(newpath);
                }
            }
        }
        return (extensions);
    }

    async load_xc_assetInfo() {
        let sql = `select asset, chainID, xcContractAddress, symbol from asset where xcContractAddress is not null and assetType = 'Token' and routeDisabled = 0 order by chainID, asset;`
        let routes = await this.poolREADONLY.query(sql)
        for (let i = 0; i < routes.length; i++) {
            let r = routes[i];
            let asset = JSON.stringify({
                "xcAsset": r.symbol
            });
            let assetChain = paraTool.makeAssetChain(asset, r.chainID);
            let xcAsset = {
                assetType: paraTool.assetTypeXCAsset,
                asset: asset, // this is the virtual "mapper"
                chainID: r.chainID,
                token0: r.asset, // {"Token":...} which is NOT the same!
                token1: r.xcContractAddress, // 0x... which not the same as token0!
                token0Symbol: r.symbol,
                token1Symbol: r.symbol,
                symbol: r.symbol
            }
            /*
{
  assetType: 'XCAsset',
  chainID: 2004,
  token0: '{"Token":"42259045809535163221576417993425387648"}',
  token1: '0xffffffff1fcacbd218edc0eba20fc2308c778080',
  token0Symbol: 'xcDOT',
  token1Symbol: 'xcDOT',
  symbol: 'xcDOT'
}
*/
            // console.log(assetChain, xcAsset);
            this.assetInfo[assetChain] = xcAsset;
        }
        // for actually observed xcmtransfers from chainID to chainIDDest, add assetInfo
        /* insert into xcmtransferroute ( asset, assetDest, symbol, chainID, chainIDDest, cnt) (select asset.asset, assetDest.asset, xcmasset.symbol, xcmtransfer.chainID, xcmtransfer.chainIDDest, count(*) as cnt  from xcmtransfer,  xcmasset, asset, asset as assetDest  where xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey and        xcmasset.xcmInteriorKey = asset.xcmInteriorKey and asset.chainID = xcmtransfer.chainID and        xcmasset.xcmInteriorKey = assetDest.xcmInteriorKey and assetDest.chainID = xcmtransfer.chainIDDest and        sourceTS > UNIX_TIMESTAMP(date_sub(Now(), interval 30 day)) and assetDest.assetType = "Token" and asset.assetType = "Token" group by asset.asset, assetDest.asset, xcmasset.symbol, xcmtransfer.chainID, xcmtransfer.chainIDDest) on duplicate key update asset = values(asset), assetDest = values(assetDest), cnt = values(cnt); */
        let sql2 = `select asset, assetDest, symbol, chainID, chainIDDest from xcmtransferroute where cnt > 0 and routeDisabled = 0`
        let xcmroutes = await this.poolREADONLY.query(sql2)
        for (let i = 0; i < xcmroutes.length; i++) {
            let r = xcmroutes[i];
            let bridge = {
                "xcmtransfer": {
                    symbol: r.symbol,
                    chainIDDest: r.chainIDDest
                }
            };
            let asset = JSON.stringify(bridge);
            let assetChain = paraTool.makeAssetChain(asset, r.chainID);
            let xcmtransfer = {
                assetType: paraTool.assetTypeXCMTransfer,
                asset: asset, // this is the virtual "mapper"
                chainID: r.chainID,
                chainIDDest: r.chainIDDest,
                token0: r.asset,
                token1: r.assetDest,
                token0Symbol: r.symbol, // could be the symbol name on chainID     (e.g. xcDOT) instead of the "universal" one (DOT)
                token1Symbol: r.symbol, // could be the symbol name on chainIDDest
                symbol: r.symbol
            }
            this.assetInfo[assetChain] = xcmtransfer;
        }
    }

    async checkRoutes(chainID = -1) {
        await this.init(); /// sets up this.assetInfo

        let cnt = 0;
        let ts = this.getCurrentTS();
        let ts1 = this.getCurrentTS() - 86400;

        for (const assetChain of Object.keys(this.assetInfo)) {
            let [asset, cID] = paraTool.parseAssetChain(assetChain);
            let assetInfo = this.assetInfo[assetChain];
            if ((chainID >= 0 && cID != chainID) || assetInfo.routeDisabled) {

            } else if ((assetInfo.assetType == paraTool.assetTypeERC20LiquidityPair || assetInfo.assetType == paraTool.assetTypeLiquidityPair)) {
                cnt++;
                let dexrec = await this.getDexRec(asset, cID, ts);
                let routeDisabled = 0
                if (dexrec) {
                    if (dexrec.close > 1000000) {
                        routeDisabled = 1;
                        console.log("CHECK", dexrec.close, asset, dexrec, assetInfo.token0Symbol, assetInfo.token1Symbol);
                    }
                } else {
                    routeDisabled = 1;
                    console.log("FAILURE", asset, cID, assetInfo);
                }
                if (routeDisabled) {
                    let sql = `update asset set routeDisabled = ${routeDisabled}, priceUSD = 0, priceUSDPercentChange = 0 where asset = ${mysql.escape(asset)} and chainID = ${cID}`
                    this.batchedSQL.push(sql);
                    await this.update_batchedSQL();
                    console.log(sql);
                } else {
                    let [_, priceUSD, priceUSDCurrent] = await this.computeUSD(1.0, asset, cID, ts1);
                    if (priceUSD == 0) {
                        console.log("FAIL LP", asset, cID, priceUSD, priceUSDCurrent);
                    } else {
                        console.log("SUCC LP", asset, cID, priceUSD, priceUSDCurrent);
                    }
                    let priceUSDPercentChange = (priceUSD > 0) ? 100 * (priceUSDCurrent - priceUSD) / priceUSD : 0.0;
                    let sql = `update asset set priceUSD = ${priceUSDCurrent}, priceUSDPercentChange = '${priceUSDPercentChange}' where asset = ${mysql.escape(asset)} and chainID = ${cID}`
                    this.batchedSQL.push(sql);
                    await this.update_batchedSQL();
                    console.log(sql);
                }
            } else if (assetInfo.assetType == paraTool.assetTypeToken || assetInfo.assetType == paraTool.assetTypeERC20) {
                let [_, priceUSD, priceUSDCurrent] = await this.computeUSD(1.0, asset, cID, ts1);
                if (priceUSD == 0) {
                    console.log("FAIL TOK", asset, cID, priceUSD, priceUSDCurrent, assetInfo.priceUSDpaths);
                } else {
                    console.log("SUCC TOK", asset, cID, priceUSD, priceUSDCurrent);
                }
                let priceUSDPercentChange = (priceUSD > 0) ? 100 * (priceUSDCurrent - priceUSD) / priceUSD : 0.0;
                let sql = `update asset set priceUSD = ${priceUSDCurrent}, priceUSDPercentChange = '${priceUSDPercentChange}' where asset = ${mysql.escape(asset)} and chainID = ${cID}`
                this.batchedSQL.push(sql);
                await this.update_batchedSQL();
                console.log(sql);
            }
        }
    }

    async computePriceUSDPaths() {
        await this.init(); /// sets up this.assetInfo
        await this.load_xc_assetInfo();

        await this.checkRoutes();
        // add the roots:
        for (const assetChain of Object.keys(this.assetInfo)) {
            let assetInfo = this.assetInfo[assetChain];
            if (assetInfo.routeDisabled) {
                console.log("DISABLED", assetInfo);
            } else if (assetInfo.isUSD) {
                console.log("ENABLED", assetChain);
                this.enqueue([{
                    dest: assetChain,
                    symbol: assetInfo.symbol
                }]);
                this.explored[assetChain] = true;
            }
        }

        let path = false;
        while (path = this.dequeue()) {
            let extensions = this.getPathExtensions(path);
            for (let e = 0; e < extensions.length; e++) {
                let p = extensions[e];
                let tailAssetChain = p[p.length - 1].dest;
                if (tailAssetChain == undefined) {
                    console.log("FAIL xxx", p);
                    process.exit(1);
                }
                if (this.resultPaths[tailAssetChain] == undefined) {
                    this.resultPaths[tailAssetChain] = [];
                }
                this.resultPaths[tailAssetChain].push(extensions[e]);
                this.enqueue(extensions[e]);
            }
        }
        let cnt = 0;
        for (const assetChain of Object.keys(this.resultPaths)) {
            let paths = this.resultPaths[assetChain];
            let pathsString = JSON.stringify(paths);
            let [asset, chainID] = paraTool.parseAssetChain(assetChain);
            let sql = `update asset set priceUSDpaths = ` + mysql.escape(pathsString) + ` where asset = '${asset}' and chainID = '${chainID}'`
            console.log("RESULT", assetChain, paths, sql);
            this.batchedSQL.push(sql);
            cnt++;
        }
        await this.update_batchedSQL();
        console.log("updated paths: ", cnt);
    }

    async computeAssetCycles(symbol = "xcGLMR", maxDepth = 2) {
        await this.init(); /// sets up this.assetInfo
        await this.load_xc_assetInfo();
        // add the roots:

        for (const assetChain of Object.keys(this.assetInfo)) {
            let assetInfo = this.assetInfo[assetChain];
            if (assetInfo.routeDisabled) {
                console.log("DISABLED", assetInfo);
            } else if (assetInfo.symbol == symbol) {
                console.log("ENABLED", assetChain);
                this.enqueue([{
                    dest: assetChain,
                    symbol: assetInfo.symbol
                }]);
                this.resultPaths[assetChain] = [];
            }
        }
        let path = false;
        while (path = this.dequeue()) {
            let tailPath = path[path.length - 1].dest;
            console.log("DEQUEUE", this.resultPaths[path[0].dest].length, tailPath, this.queueHead, this.queueTail);
            if (tailPath == path[0].dest && path.length > 1) {
                this.resultPaths[path[0].dest].push(path);
            }
            let extensions = this.getPathExtensionsBFS(path, maxDepth);
            for (let e = 0; e < extensions.length; e++) {
                let p = extensions[e];
                if (p.length <= maxDepth) {
                    let tailAssetChain = p[p.length - 1].dest;
                    this.enqueue(extensions[e]);
                }
            }
        }

        // create table assetcycle (asset varchar(67), chainID int, paths mediumblob, lastUpdateDT datetime, primary key (asset, chainID));
        for (const assetChain of Object.keys(this.resultPaths)) {
            let paths = this.resultPaths[assetChain];
            let pathsString = JSON.stringify(paths);
            let [asset, chainID] = paraTool.parseAssetChain(assetChain);
            console.log(assetChain, paths.length);
            let sql = `insert into assetcycle (asset, chainID, paths, lastUpdateDT) values ('${asset}', '${chainID}', ` + mysql.escape(pathsString) + `, Now()) on duplicate key update paths = values(paths), lastUpdateDT = values(lastUpdateDT)`
            this.batchedSQL.push(sql);
        }
        await this.update_batchedSQL();
    }

    date_key_to_ts(datekey = "2021-12-21") {
        let logDT = datekey.replaceAll('-', "")
        var y = logDT.substr(0, 4),
            m = logDT.substr(4, 2),
            d = logDT.substr(6, 2)
        let a = new Date(`${y}-${m}-${d}`)
        let logDTTS = a.getTime() / 1000;
        return logDTTS
    }

    // update assetlog with prices/market_caps/volumes from coingecko API
    async update_coingecko_market_chart(id, symbol, chainID, startTS, endTS, asset = "chain") {
        const axios = require("axios");
        var url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=USD&from=${startTS}&to=${endTS}`;
        try {
            // {"id":"11653-nottingham","symbol":"realtoken-s-11653-nottingham-rd-detroit-mi","name":"RealT Token - 11653 Nottingham Rd, Detroit, MI 48224"}
            //var url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=USD&days=1&interval=hourly`;
            //var startTS = 1637222401
            //var endTS = 1637226001
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
            for (const t of prices_arr) {
                var tm = Math.round(t[0] / 1000);
                let hourlyKey = this.hourly_key_from_ts(tm);
                out.push(`('${asset}', '${chainID}', '${hourlyKey}','${paraTool.assetSourceCoingecko}','${t[1]}', '${total_volumes[hourlyKey]}', '${market_caps[hourlyKey]}')`);
            }
            if (out.length > 0) {
                await this.upsertSQL({
                    "table": "assetlog",
                    "keys": ["asset", "chainID", "indexTS", "source"],
                    "vals": ["priceUSD", "total_volumes", "market_caps"],
                    "data": out,
                    "replace": ["priceUSD", "total_volumes", "market_caps"]
                })
                let sql = "";
                if (asset == "chain") {
                    sql = `update chain set coingeckoLastUpdateDT = Now() where chainID = ${chainID}`
                } else {
                    sql = `update asset set coingeckoLastUpdateDT = Now() where asset = '${asset}'`
                }
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

    /*
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
    async fetch_coin_prices_percentages(assetMap, coingeckoIDList) {
        const axios = require("axios");
        let coingeckoIDs = encodeURIComponent(coingeckoIDList.join(','))

        try {
            let url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIDs}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
            console.log("fetch_coin_prices_percentages URL", url, "assetMap", assetMap)
            const resp = await axios.get(url, {
                headers: {
                    "accept": "application/json"
                }
            });
            let priceData = resp.data

            for (const k of Object.keys(priceData)) {
                let data = priceData[k]
                let asset = assetMap[k]
                if (asset != undefined && Object.keys(data).length !== 0) {
                    //found in map, prepare sql update statement
                    let priceUSD = (data.usd != undefined) ? data.usd : 0
                    let priceUSDPercentChange = (data.usd_24h_change != undefined) ? data.usd_24h_change : 0
                    let lastPriceUpdateTS = (data.last_updated_at != undefined) ? data.last_updated_at : 0
                    let sql = `update asset set priceUSD=${priceUSD}, priceUSDPercentChange=${priceUSDPercentChange}, lastPriceUpdateDT=FROM_UNIXTIME(${lastPriceUpdateTS}) where asset = '${asset}';`
                    console.log(sql)
                    this.batchedSQL.push(sql);
                }
                await this.update_batchedSQL();
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
        var coingeckoIDs = await this.poolREADONLY.query(`select coingeckoID, asset, chainID from chain where symbol is not null and coingeckoID is not null and coingeckoLastUpdateDT < date_sub(Now(), interval 5 minute) order by coingeckoLastUpdateDT limit 1000`);
        console.log(`nativeChainAsset coingeckoIDs list=${coingeckoIDs.length}`)
        let batchSize = 86400 * 30
        for (let currDailyTS = startTS; currDailyTS < endTS; currDailyTS += batchSize) {
            let currDailyEndTS = currDailyTS + batchSize
            for (const ids of coingeckoIDs) {
                let asset = JSON.parse(ids.asset);
                if (asset && asset.Token && ids.coingeckoID.length > 0) {
                    let symbol = asset.Token
                    await this.update_coingecko_market_chart(ids.coingeckoID, symbol, ids.chainID, currDailyTS, currDailyEndTS, "chain");
                    console.log(`got ${symbol}`);
                    await this.sleep(5000);
                }
            }
        }

        // to cover cases like RMRK which are not specifically attached to any chain
        coingeckoIDs = await this.poolREADONLY.query(`select coingeckoID, asset, chainID from asset where symbol is not null and coingeckoID is not null and coingeckoLastUpdateDT < date_sub(Now(), interval 5 minute) order by coingeckoLastUpdateDT limit 1000`);
        console.log(`non-nativeChainAsset coingeckoIDs list=${coingeckoIDs.length}`)
        for (let currDailyTS = startTS; currDailyTS < endTS; currDailyTS += batchSize) {
            let currDailyEndTS = currDailyTS + batchSize
            for (const ids of coingeckoIDs) {
                let asset = JSON.parse(ids.asset);
                if (asset && asset.Token && ids.coingeckoID.length > 0) {
                    let symbol = asset.Token
                    await this.update_coingecko_market_chart(ids.coingeckoID, symbol, ids.chainID, currDailyTS, currDailyEndTS, ids.asset);
                    console.log(`got ${symbol}`);
                    await this.sleep(5000);
                }
            }
        }
    }

    async getCoinPrices(lookback = 7) {
        let startTS = (lookback > 0) ? Math.floor(Date.now() / 1000) - 86400 * lookback : Math.floor(Date.now() / 1000) - 3600 * 24;
        let endTS = startTS + 86401
        var coingeckoIDs = await this.poolREADONLY.query(`select coingeckoID, asset, chainID from chain where asset is not null and coingeckoID is not null and coingeckoLastUpdateDT < date_sub(Now(), interval 5 minute) limit 20`);

        let assetMap = {}
        let coingeckoIDList = []
        for (const ids of coingeckoIDs) {
            try {
                let asset = JSON.parse(ids.asset);
                if (asset.Token && assetMap[ids.coingeckoID] == undefined) {
                    let symbol = asset.Token;
                    coingeckoIDList.push(ids.coingeckoID)
                    await this.update_coingecko_market_chart(ids.coingeckoID, symbol, ids.chainID, startTS, endTS, "chain");
                    await this.sleep(5000);
                    assetMap[ids.coingeckoID] = ids.asset
                }
            } catch (e) {}
        }
        console.log(assetMap);

        // to cover cases like RMRK which are not specifically attached to any chain
        coingeckoIDs = await this.poolREADONLY.query(`select coingeckoID, asset, chainID from asset where symbol is not null and coingeckoID is not null and coingeckoLastUpdateDT < date_sub(Now(), interval 5 minute) limit 20`);
        for (const ids of coingeckoIDs) {
            try {
                let asset = JSON.parse(ids.asset);
                if (asset.Token && assetMap[ids.coingeckoID] == undefined) {
                    let symbol = asset.Token;
                    coingeckoIDList.push(ids.coingeckoID)
                    await this.update_coingecko_market_chart(ids.coingeckoID, symbol, ids.chainID, startTS, endTS, ids.asset);
                    await this.sleep(5000);
                    assetMap[ids.coingeckoID] = ids.asset
                }
            } catch (e) {
                console.log(e)
            }
        }
        await this.fetch_coin_prices_percentages(assetMap, coingeckoIDList);
    }
}