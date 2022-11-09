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

const dotenv = require('dotenv').config();
const express = require('express')
const app = express()
const paraTool = require('./substrate/paraTool');
const uiTool = require('./substrate/uiTool');
const port = 3001
const Query = require("./substrate/query");

const cookieParser = require("cookie-parser");

var debugLevel = paraTool.debugTracing
var query = new Query(debugLevel);

app.locals.paraTool = paraTool;
app.locals.uiTool = uiTool;
app.use(express.static('public'))
app.use(cookieParser());
app.use(express.json());

app.set('view engine', 'ejs');
app.use(express.urlencoded({
    extended: true
}))

let isDevelopment = (process.env.NODE_ENV == "development") ? true : false

const disableAuthorizationCheck = false;

function setCrossOrigin(res) {
    res.set({
        'Content-Type': 'application/json',
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST,PUT",
        'Access-Control-Allow-Origin': '*',
        "Access-Control-Allow-Headers": "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers"
    })
}

function getapikey(req) {
    let apikey = req.header('Authorization')
    if (!apikey) {
        let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        try {
            ip = ip.substring(7)
            let ipPrefix = ip.split('.').slice(0, -1).join('.')
            //::ffff:103.163.220.17 -> use sha1(103.163.220) = c88cbdf6f85088bb9df9529d7823c5a3c736bfc5 as key
            apikey = paraTool.sha1(ipPrefix)
            if (apikey.length > 32) {
                apikey = apikey.substring(0, 32);
            }
        } catch (err) {
            query.logger.error({
                "op": "getapikey",
                err,
                ip
            });

        }
    }
    return (apikey);
}

function chainFilterOpt(req) {
    // default: return all chains
    let chainList = []
    try {
        if (req.query.chainfilters != undefined) {
            let chainIdentifierList = []
            let chainIdentifiers = req.query.chainfilters
            if (!Array.isArray(chainIdentifiers)) {
                chainIdentifiers = chainIdentifiers.split(',')
            }
            for (const chainIdentifier of chainIdentifiers) {
                if (chainIdentifier == 'all') return []
                //handle both chainID, id
                let [chainID, _] = query.convertChainID(chainIdentifier.toLowerCase())
                if (chainID !== false) {
                    chainIdentifierList.push(chainID)
                }
            }
            chainList = paraTool.unique(chainIdentifierList)
        } else {
            chainList = []
        }
    } catch (e) {
        console.log(`chainFilterOpt`, e.toString())
    }
    //console.log(`chainFilterOpt chainList=${chainList}`)
    return chainList
}

function decorateOpt(req, section = null) {
    // default decorate is true
    let decorate = (req.query.decorate != undefined) ? paraTool.parseBool(req.query.decorate) : true
    let decorateExtra = []
    if (!decorate) {
        return [decorate, decorateExtra]
    }

    /*
      data: show docs/decodedData/dataType in event
      usd: xxxUSD/priceUSD/priceUSDCurrent/ decoration
      address: identity decoration
      related: proxy/related decoration
    */
    let predefinedExtra = ["data", "usd", "address", "related", "events"]

    try {
        if (req.query.extra != undefined) {
            let extraList = []
            let extra = req.query.extra
            if (!Array.isArray(extra)) {
                extra = extra.split(',')
            }
            for (const ex of extra) {
                let extFld = ex.toLowerCase()
                if (predefinedExtra.includes(extFld)) extraList.push(extFld)
            }
            decorateExtra = extraList
        } else {
            if (section == "account") {
                decorateExtra = ["data", "usd", "address"]
            } else {
                //default option: [true] usd, addr [false] related
                decorateExtra = ["data", "usd", "address", "events"]
            }
        }
    } catch (e) {
        console.log(`decorateOpt`, e.toString())
    }
    return [decorate, decorateExtra]
}

const downtime = false;
app.use(async (req, res, next) => {
    setCrossOrigin(res)
    let apikey = getapikey(req);
    let result = await query.checkAPIKey(apikey);
    if (downtime) {
        var err = new Error("API is down for maintainance");
        err.http_code = 503;
        next(err);
        return;
    } else if (result.success) {
        next();
        return;
    } else if (result.error) {
        var err = new Error(result.error);
        err.http_code = result.code;
        next(err);
        return;
    } else {
        next(Error("Unknown Error"));
        return;
    }
})

// Usage: http://api.polkaholic.io/
app.get('/', async (req, res) => {
    try {
        let chains = await query.get_chains_external();
        if (chains) {
            res.write(JSON.stringify(chains));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: http://api.polkaholic.io/chains
app.get('/chains', async (req, res) => {
    try {
        let chains = await query.get_chains_external();
        if (chains) {
            res.write(JSON.stringify(chains));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: http://api.polkaholic.io/xcmtransfers
app.get('/xcmtransfers', async (req, res) => {
    try {
        let hardLimit = 10000; // 100x [above this it takes too long] -- users should use date ranges to filter
        let limit = (req.query.limit != undefined) ? parseInt(req.query.limit, 10) : 1000;
        if (limit > hardLimit) {
            return res.status(400).json({
                error: `Search: 'limit' parameter must be less or equal to than ${hardLimit}`
            });
        }

        let [decorate, decorateExtra] = decorateOpt(req)
        let filters = {
            chainList: chainFilterOpt(req),
            blockNumber: req.params["blockNumber"] ? req.params["blockNumber"] : null,
        };
        if (req.query.symbol){
            filters.symbol = req.query.symbol;
        }
        if (req.query.xcmType) {
            filters.xcmType = req.query.xcmType;
        }
        if (req.query.startTS){
            filters.startTS = req.query.startTS;
        }
        if (req.query.endTS){
            filters.endTS = req.query.endTS;
        }
        let xcmtransfers = await query.getXCMTransfers(filters, limit, decorate, decorateExtra);
        if (xcmtransfers) {
            res.write(JSON.stringify(xcmtransfers));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: http://api.polkaholic.io/xcmmessages
app.get('/xcmmessages', async (req, res) => {
    try {
        let hardLimit = 10000;
        let limit = (req.query.limit != undefined) ? parseInt(req.query.limit, 10) : 1000;
        if (limit > hardLimit) {
            return res.status(400).json({
                error: `Search: 'limit' parameter must be less or equal to than ${hardLimit}`
            });
        }
        let [decorate, decorateExtra] = decorateOpt(req)
        let filters = {
            chainList: chainFilterOpt(req),
            blockNumber: req.params["blockNumber"] ? req.params["blockNumber"] : null,
        };
        try {
            if (req.query.chainID != undefined) {
                filters.chainID = req.query.chainID;
            }
            if (req.query.chainIDDest != undefined) {
                filters.chainIDDest = req.query.chainIDDest;
            }
        } catch (e) {
            console.log(e)
        }
        let xcmmessages = await query.getRecentXCMMessages(filters, limit, decorate, decorateExtra);
        if (xcmmessages) {
            res.write(JSON.stringify(xcmmessages));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: http://api.polkaholic.io/addresstopn
app.get('/addresstopn/:topN', async (req, res) => {
    try {
        let topN = req.params["topN"]
        let [decorate, decorateExtra] = decorateOpt(req)
        let addresstopn = await query.getAddressTopN(topN, decorate, decorateExtra);
        if (addresstopn) {
            res.write(JSON.stringify(addresstopn));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/contract/:asset/:chainID
app.get('/contract/:asset/:chainID_or_chainName?', async (req, res) => {
    try {
        let asset = req.params["asset"]
        let chainID_or_chainName = req.params["chainID_or_chainName"] ? req.params["chainID_or_chainName"] : null;
        let contract = await query.getEVMContract(asset, chainID_or_chainName);
        if (contract) {
            res.write(JSON.stringify(contract));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/code/shiden
app.get('/wasmcode/:chainID_or_chainName', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let code = await query.getChainWASMCode(chainID_or_chainName);
        if (code) {
            res.write(JSON.stringify(code));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


// Usage: https://api.polkaholic.io/contracts/shiden
app.get('/wasmcontracts/:chainID_or_chainName', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let contracts = await query.getChainWASMContracts(chainID_or_chainName);
        if (contracts) {
            res.write(JSON.stringify(contracts));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/specversions/polkadot
app.get('/specversions/:chainID_or_chainName', async (req, res) => {
    try {

        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let specVersions = await query.getSpecVersions(chainID_or_chainName);
        if (specVersions) {
            res.write(JSON.stringify(specVersions));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


// Usage: https://api.polkaholic.io/chainlog/acala
app.get('/chainlog/:chainID_or_chainName', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let chainlog = await query.getChainLog(chainID_or_chainName);
        if (chainlog) {
            res.write(JSON.stringify(chainlog));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/specversion/polkadot/100
app.get('/specversion/:chainID_or_chainName/:specVersion', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let specVersion = req.params["specVersion"]
        let specVersionMetadata = await query.getSpecVersionMetadata(chainID_or_chainName, specVersion);
        if (specVersionMetadata) {
            res.write(JSON.stringify(specVersionMetadata));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: http://api.polkaholic.io/chain/22000
app.get('/chain/:chainID_or_chainName', async (req, res) => {
    try {
        //let chainID = parseInt(req.params["chainID"], 10);
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        //let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let isExternal = true
        let chain = await query.getChain(chainID_or_chainName, isExternal);
        if (chain) {
            let blocks = await query.getChainRecentBlocks(chainID_or_chainName);
            let r = {
                chain: chain,
                blocks: blocks
            };
            res.write(JSON.stringify(r));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/chain/tokens/2004
// Usage: https://api.polkaholic.io/chain/routers/2004
// Usage: https://api.polkaholic.io/chain/pools/2004
app.get('/chain/:assetType/:chainID_or_chainName?', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainID_or_chainName"] ? req.params["chainID_or_chainName"] : null
        let assetType = req.params["assetType"];
        let assets = null;
        if (assetType == "pools") {
            assets = await query.getPools({
                chainfilters: [chainID_or_chainName]
            });
        } else if (assetType == "routers") {
            assets = await query.getRouters({
                chainfilters: [chainID_or_chainName]
            });
        } else if (assetType == "channels") {
            assets = await query.getChainChannels(chainID_or_chainName);
        } else if (assetType == "System" || assetType == "ERC20" || assetType == "ERC721" || assetType == "ERC1155" || assetType == "PSP22" || assetType == "PSP34") {
            assets = await query.getChainAssets(chainID_or_chainName, assetType);
        } else {
            assets = await query.getChainAssets(chainID_or_chainName, "Token");
        }

        if (assets) {
            res.write(JSON.stringify(assets));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/pools/router/0x70085a09d30d6f8c4ecf6ee10120d1847383bb57~2004
app.get('/pools/:assetType/:routerAssetChain', async (req, res) => {
    try {
        let routerAssetChain = req.params["routerAssetChain"] ? req.params["routerAssetChain"] : null
        let assetType = req.params["assetType"];
        let pools = null;
        if (assetType == "router") {
            pools = await query.getPools({
                routerAssetChain
            });
        } else if (assetType == "chain" && routerAssetChain) {
            pools = await query.getPools({
                chainfilters: routerAssetChain
            });
        } else if (assetType == "symbol" && routerAssetChain) {
            pools = await query.getPools({
                symbol: routerAssetChain
            });
        } else if (assetType == "assetChain" && routerAssetChain) {
            pools = await query.getPools({
                assetChain: routerAssetChain
            });
        } else {
            pools = await query.getPools({});
        }
        if (pools) {
            res.write(JSON.stringify(pools));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/xcmassetlog/:chainID/:chainIDDest/:symbol?', async (req, res) => {
    try {
        let chainID = req.params["chainID"];
        let chainIDDest = req.params["chainIDDest"];
        let symbol = req.params["symbol"] ? req.params["symbol"] : "";
        let xcmassetlog = await query.getChannelXCMAssetlog(chainID, chainIDDest, symbol);
        if (xcmassetlog) {
            res.write(JSON.stringify(xcmassetlog));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/asset/pricefeed/DOT/polkadot
app.get('/asset/pricelog/:asset/:chainID/:routerAssetChain?', async (req, res) => {
    try {
        let asset = req.params["asset"];
        let chainID = req.params["chainID"];
        let q = {
            asset,
            chainID
        };
        if (req.params["routerAssetChain"]) {
            q.routerAssetChain = req.params["routerAssetChain"];
        }
        let balances = await query.getAssetPriceFeed(q);
        res.write(JSON.stringify(balances));
        await query.tallyAPIKey(getapikey(req));
        res.end();
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/asset/pricefeed/DOT/polkadot
app.get('/asset/pricefeed/:symbol/:relayChain/:routerAssetChain?', async (req, res) => {
    try {
        let symbol = req.params["symbol"];
        let relayChain = req.params["relayChain"];
        let q = {
            symbol,
            relayChain
        };
        if (req.params["routerAssetChain"]) {
            q.routerAssetChain = req.params["routerAssetChain"];
        }
        let balances = await query.getAssetPriceFeed(q);
        res.write(JSON.stringify(balances));
        await query.tallyAPIKey(getapikey(req));
        res.end();
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/asset/holders/0x89f52002e544585b42f8c7cf557609ca4c8ce12a%231285
app.get('/asset/holders/:chainID/:asset', async (req, res) => {
    try {
        let asset = req.params["asset"];
        let chainID = req.params["chainID"];
        let holders = await query.getAssetHolders(chainID, asset);
        if (holders) {
            res.write(JSON.stringify(holders));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404).json();
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://api.polkaholic.io/asset/related
app.get('/asset/related/:chainID/:asset', async (req, res) => {
    try {
        let chainID = req.params["chainID"];
        let asset = req.params["asset"];
        let assetsRelated = await query.getAssetsRelated(chainID, asset);
        if (assetsRelated) {
            res.write(JSON.stringify(assetsRelated));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404).json();
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/hash/:hash', async (req, res) => {
    try {
        let h = req.params['hash'];
        let hashrec = await query.lookupHash(h);
        if (hashrec) {
            if ((hashrec.status != undefined) && (hashrec.status == "unfinalized") && (hashrec.blockNumber != undefined) && (hashrec.chainID != undefined)) {
                let chainID = hashrec.chainID;
                let chain = await query.getChain(chainID);
                if (chain.blocksFinalized >= hashrec.blockNumber) {
                    let blockHashFinalized = await query.getBlockHashFinalized(chainID, hashrec.blockNumber);
                    if (blockHashFinalized) {
                        hashrec.blockHashFinalized = blockHashFinalized;
                    }
                }
            }
            res.write(JSON.stringify(hashrec));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.post('/suggest/:address', async (req, res) => {
    let address = req.params["address"];
    let nickname = req.body.nickname;
    let addressType = req.body.addressType;
    let submitter = req.body.submitter;
    let result = query.submitAddressSuggestion(address, nickname, submitter, addressType);
    res.write(JSON.stringify(result));
})

// curl -X POST -H "Content-Type: application/json" -d '{"chainID":"acala", "startDate": "2022-06-21", "endDate": "2022-06-24"}'  http://api.polkaholic.io/search/events?limit=10000
app.post('/search/:table', async (req, res) => {
    try {
        let table = req.params["table"];
        let q = req.body;
        let chainID_or_chainName = (q.chainID != undefined) ? q.chainID : "all";
        let maxLimit = 1000;
        let hardLimit = 100000; // 100x [above this it takes too long] -- users should use date ranges to filter
        let queryLimit = (req.query.limit != undefined) ? req.query.limit : maxLimit;
        if (queryLimit > hardLimit) {
            return res.status(400).json({
                error: "Search: 'limit' parameter must be less or equal to than 100K"
            });
        }
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let [decorate, decorateExtra] = decorateOpt(req)
        if (chainID !== undefined || chainID_or_chainName == "all") {
            var results = [];
            if (table == "extrinsics") {
                results = await query.getExtrinsics(q, queryLimit, decorate, decorateExtra);
            } else if (table == "events") {
                results = await query.getEvents(q, queryLimit, decorate, decorateExtra);
            } else if (table == "evmtxs") {
                results = await query.getEVMTxs(q, queryLimit, decorate, decorateExtra);
            } else if (table == "transfers") {
                results = await query.getTransfers(q, queryLimit, decorate, decorateExtra);
            } else if (table == "xcmmessages") {
                results = await query.getXCMMessages(q, queryLimit, decorate, decorateExtra);
            } else if (table == "xcmtransfers") {
                results = await query.searchXCMTransfers(q, queryLimit, decorate, decorateExtra);
            } else {
                // TODO: say the table is unknown
                return res.sendStatus(404).json();
            }
            if (results) {
                let cnt = 1;
                if (results.length > maxLimit) {
                    cnt += results.length / (10 * maxLimit);
                }
                // since BigQuery has high "scanning" costs, if the user wastefully asks for a high maxLimit (100K), even we didn't get many rows, tally 1 per 2500
                let cnt2 = maxLimit / 2500;
                if (cnt2 > cnt) {
                    cnt = cnt2;
                }
                res.write(JSON.stringify(results));
                await query.tallyAPIKey(getapikey(req), cnt);
                return res.end();
            } else {
                return res.sendStatus(404).json();
            }
        } else {
            return res.sendStatus(404).json();
        }
    } catch (err) {
        console.log(`error:`, err.toString())
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/xcm/multilocation/:chainID_or_chainName', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let mRes = await query.getMultilocation(chainID_or_chainName);
        if (mRes) {
            res.write(JSON.stringify(mRes));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


// Usage: http://api.polkaholic.io/block/8/1000000
// Usage: http://api.polkaholic.io/block/8/1000000?blockhash=0x1234
app.get('/block/:chainID_or_chainName/:blockNumber', async (req, res) => {
    try {
        //let chain = await query.getChain(chainID);
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let blockNumber = parseInt(req.params["blockNumber"], 10);
        let blockHash = (req.query.blockhash != undefined) ? req.query.blockhash : false
        let [decorate, decorateExtra] = decorateOpt(req)
        console.log(`getBlock (${chainID_or_chainName}, ${blockNumber}, ${blockHash}, decorate=${decorate}, decorateExtra=${decorateExtra})`)
        var blk = await query.getBlock(chainID_or_chainName, blockNumber, blockHash, decorate, decorateExtra);
        if (blk) {
            res.write(JSON.stringify(blk));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404).json();
        }
    } catch (err) {
        console.log(`error:`, err.toString())
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/trace/:chainID_or_chainName/:blockNumber/:blockHash?', async (req, res) => {
    try {
        //let chain = await query.getChain(chainID);
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let blockNumber = parseInt(req.params["blockNumber"], 10);
        let blockHash = (req.query.blockhash != undefined) ? req.query.blockhash : false
        var trace = await query.getTrace(chainID_or_chainName, blockNumber, blockHash);
        if (trace) {
            res.write(JSON.stringify(trace));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404).json();
        }
    } catch (err) {
        console.log(`error:`, err.toString())
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/hash/blockhash/:blockHash', async (req, res) => {
    try {
        let blockHash = req.params["blockHash"];
        let [decorate, decorateExtra] = decorateOpt(req)
        var blk = await query.getBlockByHash(blockHash, decorate, decorateExtra);
        if (blk) {
            res.write(JSON.stringify(blk));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404).json();
        }
    } catch (err) {
        console.log(`error:`, err.toString())
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/account/:address', async (req, res) => {
    try {
        let address = paraTool.getPubKey(req.params["address"]);
        let targetGroup = (req.query["group"] != undefined) ? req.query["group"].toLowerCase() : "realtime"
        let lookback = (req.query["lookback"] != undefined) ? req.query["lookback"] : 180
        let predefinedGroups = ["extrinsics", "transfers", "crowdloans", "rewards", "realtime", "history", "related", "xcmtransfers", "nfts", "balances", "feed", "unfinalized", "offers", "ss58h160", "evmtxs"]
        if (!predefinedGroups.includes(targetGroup)) {
            return res.status(400).json({
                error: `group=${req.query["group"]} is not supprted`
            });
        }
        let ts = (req.query["ts"] != undefined) ? req.query["ts"] : null;
        let pageIndex = (req.query["p"] != undefined) ? req.query["p"] : 0;
        //console.log(`${targetGroup} requested`)
        let [decorate, decorateExtra] = decorateOpt(req, "account")
        let chainList = chainFilterOpt(req)
        let maxLimit = 1000;
        let hardLimit = 10000;
        let maxRows = (req.query.limit != undefined) ? req.query.limit : maxLimit;
        if (maxRows > hardLimit) {
            return res.status(400).json({
                error: `Search: 'limit' parameter must be less or equal to than ${hardLimit}`
            });
        }

        //console.log(`/account/ chainList`, chainList)
        let account = await query.getAccount(address, targetGroup, chainList, maxRows, ts, lookback, decorate, decorateExtra, pageIndex);
        if (account) {
            res.write(JSON.stringify(account));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/account/:accountGroup/:address', async (req, res) => {
    try {
        let address = req.params["address"];
        let accountGroup = req.params["accountGroup"];
        let lookback = (req.query["lookback"] != undefined) ? req.query["lookback"] : 180
        let [decorate, decorateExtra] = decorateOpt(req)
        let chainList = chainFilterOpt(req)
        //console.log(`/account/ chainList`, chainList)

        let maxLimit = 1000;
        let hardLimit = 10000;
        let maxRows = (req.query.limit != undefined) ? req.query.limit : maxLimit;
        if (maxRows > hardLimit) {
            return res.status(400).json({
                error: `Search: 'limit' parameter must be less or equal to than ${hardLimit}`
            });
        }

        let ts = (req.query["ts"] != undefined) ? req.query["ts"] : null;
        let pageIndex = (req.query["p"] != undefined) ? req.query["p"] : 0;
        if (accountGroup == "feed") {
            account = await query.getAccountFeed(address, chainList, maxRows, decorate, decorateExtra, pageIndex);
        } else {
            account = await query.getAccount(address, accountGroup, chainList, maxRows, ts, lookback, decorate, decorateExtra, pageIndex);
        }
        if (account) {
            res.write(JSON.stringify(account));
            await query.tallyAPIKey(getapikey(req));
            return res.end();
        } else {
            return res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

async function txAPIRedirect(req, res) {
    try {
        let txHash = req.params['txhash'];
        let [decorate, decorateExtra] = decorateOpt(req)
        console.log(`api query.getTransaction (${txHash}, decorate=${decorate}, extra=${decorateExtra}`)
        let tx = await query.getTransaction(txHash, decorate, decorateExtra);
        if (tx) {
            res.write(JSON.stringify(tx));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
}

app.get('/extrinsic/:txhash', async (req, res) => txAPIRedirect(req, res))
app.get('/tx/:txhash', async (req, res) => txAPIRedirect(req, res))

app.get('/xcmmessage/:msgHash/:sentAt?', async (req, res) => {
    try {
        let msgHash = req.params['msgHash'];
        let sentAt = req.params['sentAt'] ? req.params['sentAt'] : null;
        console.log(`api query.getXCMMessage (${msgHash}, ${sentAt})`)
        let xcm = await query.getXCMMessage(msgHash, sentAt);
        if (xcm) {
            res.write(JSON.stringify(xcm));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/event/:eventID', async (req, res) => {
    try {
        let eventID = req.params['eventID'];
        let ev = await query.getEvent(eventID);
        if (ev) {
            res.write(JSON.stringify(ev));
            await query.tallyAPIKey(getapikey(req));
            res.end();
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.use(function(err, req, res, next) {
    var http_code = err.http_code ? err.http_code : 500;
    var errString = err.toString();
    if (!errString) errString = "Bad Request";
    var e = {
        code: http_code
    };
    if (isDevelopment) {
        e.error = errString
    }
    res.status(http_code);
    query.logger.error({
        "op": "API",
        err,
        url: req.originalUrl
    });
    res.send(JSON.stringify(e));
});


const hostname = "::";
if (isDevelopment) {
    app.listen(port, hostname, () => {
        console.log(`Polkaholic listening on port ${hostname}:${port} preemptively`)
    })
}
let x = query.init();
console.log(`[${new Date().toLocaleString()}] Initiating query`)
Promise.all([x]).then(() => {
    // delayed listening of your app
    console.log(`[${new Date().toLocaleString()}] query ready`)
    if (!isDevelopment) {
        app.listen(port, hostname, () => {
            console.log(`Polkaholic listening on port ${hostname}:${port}`)
        })
    }
    // reload chains/assets/specVersions regularly
    query.autoUpdate()
}).catch(err => {
    // handle error here
});
