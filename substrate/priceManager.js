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

    getPathExtensions(path, chainID = paraTool.chainIDMoonbeam) {
        let extensions = [];
        let tailAsset = path[path.length - 1].dest; // the last element
        if (tailAsset == undefined) {
            return (extensions);
        }

        for (const assetChain of Object.keys(this.assetInfo)) {
            let [asset, cID] = paraTool.parseAssetChain(assetChain);
            if (cID == chainID) {
                let assetInfo = this.assetInfo[assetChain];
                if ((assetInfo.assetType == paraTool.assetTypeERC20LiquidityPair || assetInfo.assetType == paraTool.assetTypeLiquidityPair) && (assetInfo.token0 && assetInfo.token1)) {
                    if (assetInfo.token0 == tailAsset && this.explored[assetInfo.token1] == undefined) {
                        // extend with a.token1
                        let newpath = [...path];
                        newpath.push({
                            route: assetInfo.asset,
                            dest: assetInfo.token1,
                            symbol: assetInfo.symbol,
                            token0Symbol: assetInfo.token0Symbol,
                            token1Symbol: assetInfo.token1Symbol,
                            s: 1
                        });
                        extensions.push(newpath);
                        this.explored[assetInfo.token1] = true;
                    } else if (assetInfo.token1 == tailAsset && this.explored[assetInfo.token0] == undefined) {
                        // extend with a.token0
                        let newpath = [...path];
                        newpath.push({
                            route: assetInfo.asset,
                            dest: assetInfo.token0,
                            symbol: assetInfo.symbol,
                            token0Symbol: assetInfo.token0Symbol,
                            token1Symbol: assetInfo.token1Symbol,
                            s: 0
                        });
                        extensions.push(newpath);
                        this.explored[assetInfo.token0] = true;
                    }
                }
            }
        }
        return (extensions);
    }

    async computePriceUSDPaths(chainID = -1) {
        let chains = await this.getChains();
        if (chainID == -1) {
            for (var i = 0; i < chains.length; i++) {
                await this.compute_priceUSDPaths(chains[i].chainID);
            }
        } else {
            await this.compute_priceUSDPaths(chainID);
        }
    }

    async compute_priceUSDPaths(chainID = paraTool.chainIDMoonbeam) {
        await this.init(); /// sets up this.assetInfo

        // add the roots:
        for (const assetChain of Object.keys(this.assetInfo)) {
            let [asset, cID] = paraTool.parseAssetChain(assetChain);
            if (cID == chainID) {
                let assetInfo = this.assetInfo[assetChain];
                if (assetInfo.isUSD && (cID == chainID)) {
                    this.enqueue([{
                        dest: assetInfo.asset,
                        symbol: assetInfo.symbol
                    }]);
                    this.explored[assetInfo.asset] = true;
                }
            }
        }
        let path = false;
        while (path = this.dequeue()) {
            let extensions = this.getPathExtensions(path, chainID);

            for (let e = 0; e < extensions.length; e++) {
                let p = extensions[e];
                let tailAsset = p[p.length - 1].dest;
                if (tailAsset == undefined) {
                    console.log("FAIL xxx", p);
                    process.exit(1);
                }
                if (this.resultPaths[tailAsset] == undefined) {
                    this.resultPaths[tailAsset] = [];
                }
                this.resultPaths[tailAsset].push(extensions[e]);
                this.enqueue(extensions[e]);
            }
        }
        let cnt = 0;
        for (const asset of Object.keys(this.resultPaths)) {
            let paths = this.resultPaths[asset];
            let pathsString = JSON.stringify(paths);
            console.log("RESULT", asset, paths);
            let sql = `update asset set priceUSDpaths = ` + mysql.escape(pathsString) + ` where asset = '${asset}' and chainID = '${chainID}'`
            this.batchedSQL.push(sql);
            cnt++;
        }
        await this.update_batchedSQL();
        console.log("updated paths: ", cnt);
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
