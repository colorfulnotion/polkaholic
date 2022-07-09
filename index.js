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
var session = require('express-session')
const paraTool = require('./substrate/paraTool');
const util = require("util");
const identicon = require('./substrate/identicon');
const uiTool = require('./substrate/uiTool');
const prodConfig = require('./substrate/config');
const port = 3000;
const Query = require("./substrate/query");
const cookieParser = require("cookie-parser");

var debugLevel = paraTool.debugTracing
var query = new Query(debugLevel);
app.locals.paraTool = paraTool;
app.locals.uiTool = uiTool;
app.locals.config = prodConfig;

// For local web/API development, add this to your ~/.bashrc:
// export NODE_ENV=development
// export POLKAHOLIC_API_URL=http://{moonriver,composable,...}.polkaholic.io:3001
if (process.env.POLKAHOLIC_API_URL != undefined) {
    app.locals.config.baseURL = process.env.POLKAHOLIC_API_URL;
}

if (process.env.NODE_ENV == "development") {
    app.use(express.static('public', {
        maxAge: '5s'
    }))
} else {
    app.use(express.static('public', {
        maxAge: '5m'
    }))
}
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use(express.urlencoded({
    extended: true
}))
app.use(session({
    secret: 'polkaholic colorful notion',
    resave: false,
    saveUninitialized: true
}))

app.use(function(req, res, next) {
    res.locals.req = req;
    res.locals.res = res;
    next()
})

function getHostChain(req) {
    try {
        let fullhost = req.get('host');
        let chainID = 0;
        let host = "polkadot"
        let sa = fullhost.split(".");
        if (sa.length > 2) {
            host = sa[0];
            //console.log(`host=${host}`, host)
        }
        if (host.includes('internal')) {
            // use polkadot for internal test
            return [chainID, 'polkadot']
        }
        [chainID, id] = query.convertChainID(host)
        if (id) {
            return [chainID, id]
        } else {
            return [false, false]
        }
    } catch (err) {
        console.log(`getHostChain err`, err.toString())
        return [false, false]
    }
}


function decorateOptUI(req) {
    // default decorate is true
    let decorate = (req.query.decorate != undefined) ? paraTool.parseBool(req.query.decorate) : true
    let decorateExtra = []
    if (!decorate) {
        return [decorate, decorateExtra]
    }

    /*
      by default, UI will request all field, unless specified
      data: show docs/decodedData/dataType in event
      usd: xxxUSD/priceUSD/priceUSDCurrent/ decoration
      address: identity decoration
      related: proxy/related decoration
    */

    let predefinedExtra = ["data", "usd", "address", "related"]
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
            //default option: [true] usd, addr [false] related
            decorateExtra = ["data", "usd", "address", "related"]
        }
    } catch (e) {
        console.log(`decorateOpt`, e.toString())
    }
    return [decorate, decorateExtra]
}

function getLoginEmail(req) {
    if (!req.session.email) return (false);
    if (uiTool.validEmail(req.session.email)) {
        return (req.session.email);
    }
    return (false);
}

// Usage: https://polkaholic.io/login
app.get('/login', async (req, res) => {
    try {
        var chains = await query.getChains();
        res.render('login', {
            chains: chains,
            chainInfo: query.getChainInfo(),
            skipSearch: true,
            error: ""
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://polkaholic.io/login
app.post('/login/', async (req, res) => {
    try {
        let email = req.body.email.trim();
        let password1 = req.body.pw1;
        var chains = await query.getChains();
        let result = await query.validateUser(email, password1)
        if (result.success) {
            req.session.email = email;
            res.redirect("/apikeys");
        } else if (result.error) {
            res.render('login', {
                chains: chains,
                chainInfo: query.getChainInfo(),
                error: result.error
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/logout', async (req, res) => {
    req.session.destroy();
    res.redirect("/");
})

app.get('/apikeys', async (req, res) => {
    const loggedInEmail = getLoginEmail(req);
    if (loggedInEmail) {
        const apikeys = await query.getAPIKeys(loggedInEmail);
        res.render('apikeys', {
            chainInfo: query.getChainInfo(),
            plans: query.getPlans(),
            apikeys: apikeys
        });
    } else {
        res.redirect("/login");
    }
})

app.get('/apikeys/create', async (req, res) => {
    const loggedInEmail = getLoginEmail(req);
    if (loggedInEmail) {
        var result = await query.createAPIKey(loggedInEmail);
        res.redirect("/apikeys");
    } else {
        res.redirect("/login");
    }
})

app.get('/apikeys/delete/:apikey', async (req, res) => {
    const loggedInEmail = getLoginEmail(req);
    if (loggedInEmail) {
        var apikey = req.params['apikey']
        var result = await query.deleteAPIKey(loggedInEmail, apikey)
        if (result.success) {
            res.redirect("/apikeys");
        } else {}
    } else {
        res.redirect("/login");
    }
})

app.get('/apikeys/changeplan/:apikey', async (req, res) => {
    const loggedInEmail = getLoginEmail(req);
    if (loggedInEmail) {
        var apikey = req.params['apikey']
        var plan = await query.getAPIKeyPlan(loggedInEmail, apikey)
        var plans = await query.getAPIKeyPlans();
        res.render('changeplan', {
            plan: plan,
            plans: plans,
            apikey: apikey
        });
    } else {
        res.redirect("/login");
    }
})

app.get('/apikeys/changeplan/:apikey/:planID', async (req, res) => {
    const loggedInEmail = getLoginEmail(req);
    if (loggedInEmail) {
        var apikey = req.params['apikey']
        var planID = req.params['planID']
        var result = await query.updateAPIKeyPlan(loggedInEmail, apikey, planID)
        res.redirect('/apikeys');
    } else {
        res.redirect("/login");
    }
})


app.get('/register', async (req, res) => {
    res.render('register', {
        chainInfo: query.getChainInfo(),
        skipSearch: true,
        error: ""
    });
})

app.get('/forgot', async (req, res) => {
    res.render('forgot', {
        chainInfo: query.getChainInfo(),
        skipSearch: true,
        info: ""
    });
})

app.post('/forgot', async (req, res) => {
    let email = req.body.email;
    if (query.sendResetPasswordLink(email)) {
        res.render('forgot', {
            chainInfo: query.getChainInfo(),
            skipSearch: true,
            info: email
        });
    } else {
        res.redirect("/forgot");
    }
})

app.get('/resetpassword/:email/:ts/:sig', async (req, res) => {
    let email = req.params.email;
    let ts = req.params.ts;
    let sig = req.params.sig;

    res.render('resetpassword', {
        chainInfo: query.getChainInfo(),
        skipSearch: true,
        email: email,
        ts: ts,
        sig: sig
    });
})

app.post('/resetpassword/:email/:ts/:sig', async (req, res) => {
    let email = req.params.email;
    let ts = req.params.ts;
    let sig = req.params.sig;
    let pwd = req.body.pw1;
    let result = await query.resetPassword(email, pwd, ts, sig);

    if (result.success) {
        req.session.email = email;
        res.redirect("/apikeys");
    } else {
        res.redirect("/login");
    }
})


app.post('/register', async (req, res) => {
    let email = req.body.email;
    let password1 = req.body.pw1;
    if (uiTool.validEmail(email)) {
        var result = await query.registerUser(email, password1)
        if (result.success) {
            res.redirect("/apikeys");
        } else if (result.error) {
            res.render('register', {
                chainInfo: query.getChainInfo(),
                error: result.error,
                skipSearch: true
            });

        }
    } else {
        return res.status(400).json({
            error: "Invalid email"
        });
    }
})

const downtime = false;
// Usage: https://polkaholic.io/
app.get('/', async (req, res) => {
    if (downtime) {
        res.render('downtime');
        return;
    }

    try {
        let [chainID, id] = getHostChain(req)
        if (id) {
            let chain = await query.getChain(chainID);
            if (chain) {
                var blocks = await query.getChainRecentBlocks(chainID);
                var homePubkey = getHomePubkey(req);
                res.render('chain', {
                    blocks: blocks,
                    chainID: chainID,
                    address: homePubkey,
                    id: id,
                    chainInfo: query.getChainInfo(chainID),
                    chain: chain,
                    apiUrl: req.path,
                    docsSection: "get-chain-recent-blocks"
                });
            } else {
                res.render('notfound', {
                    recordtype: "chain"
                });
            }
        } else {
            await handleChains(req, res);
        }
    } catch (err) {
        res.render('error', {
            chainInfo: query.getChainInfo(),
            err: err
        });
    }
})

async function handleChains(req, res) {
    try {
        var relaychain = req.params.relaychain ? req.params.relaychain : "";
        var chains = await query.getChains();
        let topNfilters = query.getAddressTopNFilters();
        res.render('chains', {
            chains: chains,
            chainInfo: query.getChainInfo(),
            relaychain: relaychain,
            topNfilters: topNfilters,
            topN: "balanceUSD",
            apiUrl: '/chains',
            docsSection: "get-all-chains"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
}

app.get('/chains/:relaychain?', handleChains)

app.get('/admin/chains/:crawling?', async (req, res) => {
    if (!uiTool.validAdmin(req.session.email)) {
        res.redirect("/login");
        return (false);
    }
    try {
        res.render('chainsadmin', {
            chainInfo: query.getChainInfo(),
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


app.get('/admin/chain/:chainID', async (req, res) => {
    if (!uiTool.validAdmin(req.session.email)) {
        res.redirect("/login");
        return (false);
    }

    try {
        var chainID = req.params.chainID;
        var chain = await query.getChainForAdmin(chainID);
        res.render('chainadmin', {
            chain: chain,
            chainInfo: query.getChainInfo(),
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.post('/admin/chain', async (req, res) => {
    if (!uiTool.validAdmin(req.session.email)) {
        res.redirect("/login");
        return (false);
    }

    let chainID = req.body.chainID;
    let chainName = req.body.chainName;
    let id = req.body.id;
    let prefix = req.body.prefix; //aka. ss58Format. prefix is directly pulled from talisman via updateRegistry2, which we don't gurantee correctness
    let asset = req.body.asset;
    let symbol = req.body.symbol;
    let WSEndpoint = req.body.WSEndpoint;
    let WSEndpoint2 = req.body.WSEndpoint2;
    let WSEndpoint3 = req.body.WSEndpoint3;
    var result = await query.updateChainAdmin(chainID, chainName, id, prefix, asset, symbol, WSEndpoint, WSEndpoint2, WSEndpoint3);
    if (result.success) {
        res.redirect("/admin/chains/0");
    } else if (result.error) {
        var chain = await query.getChainForAdmin(chainID);
        res.render(`/admin/chain/${chainID}`, {
            chain: chain,
            chainInfo: query.getChainInfo(),
            error: result.error,
            skipSearch: true
        });
    }
})

function getConsent(req) {
    if (req.cookies && req.cookies.consent) {
        return (req.cookies.consent);
    }
    return (false);
}

function getHomePubkey(req) {
    if (req.cookies && req.cookies.homePub) {
        let res = req.cookies.homePub;
        return paraTool.getPubKey(res);
    }
    return (false);
}

function getHomeAccount(req) {
    if (req.cookies && req.cookies.homeAcct) {
        return (req.cookies.homeAcct);
    }
    return (false);
}

function getCookieOptions() {
    return {
        maxAge: 1000 * 86400 * 365, // would expire after 1 year
        domain: 'polkaholic.io', // Indicates if the cookie should be signed
        path: '/'
    };
}

// http://karura.polkaholic.io:3000/qrcode/5D58imQFuMXDTknQS2D14gDU2duiUC18MGxDnTKajjJS9F3g
app.get('/qrcode/:address', async (req, res) => {
    try {
        let address = req.params["address"];
        res.render('qrcode', {
            address: address,
            chainInfo: query.getChainInfo(),
            apiUrl: '/account',
            docsSection: "get-account"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/identicon/:address', async (req, res) => {
    try {
        res.set({
            'Content-Type': 'image/svg+xml',
            'Access-Control-Allow-Origin': '*'
        })
        let address = req.params["address"];
        let out = identicon.generateIdenticon(address, false);
        res.write(out);
        res.end();
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://polkaholic.io/chain/22000
app.get('/chain/:chainID_or_chainName', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    try {
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);

        if (chain) {
            var blocks = await query.getChainRecentBlocks(chainID);
            var homePubkey = getHomePubkey(req);
            res.render('chain', {
                blocks: blocks,
                chainID: chainID,
                address: homePubkey,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-chain-recent-blocks"
            });
        } else {
            res.render('notfound', {
                recordtype: "chain"
            });
        }
    } catch (err) {
        res.render('error', {
            chainInfo: query.getChainInfo(),
            err: err
        });
    }
})

app.get('/chart/:asset?', async (req, res) => {
    try {
        let asset = (req.params.asset) ? req.params.asset : '[{"Token":"KUSD"},{"Token":"KSM"}]#8';
        let data = await query.getAssetPairOHLCV(asset);
        res.render('ohlcv', {
            data: data
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/extrinsicdocs/:chainID_or_chainName/:p/:m', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    try {
        //let chainID = (req.params.chainID);
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let p = (req.params.p);
        let m = (req.params.m);
        p = p.toLowerCase().replace("_", "").trim()
        m = m.toLowerCase().replace("_", "").trim()
        let doc = await query.getExtrinsicDocs(chainID, p, m);
        if (doc) {
            res.write(JSON.stringify(doc));
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

// Usage: https://polkaholic.io/extrinsics/polkadot
app.get('/extrinsics/:chainID_or_chainName/:s?/:m?', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    try {
        //let chainID = parseInt(req.params["chainID"], 10);
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);
        if (chain) {
            let sectionMethods = await query.getRuntimeExtrinsics(chain);
            res.render('query', {
                tbl: "extrinsics",
                sectionMethods: sectionMethods,
                chainID: chainID,
                id: id,
                section: req.params.s,
                method: req.params.m,
                fromAddress: "",
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                title: `Extrinsic Query`,
                apiUrl: req.path,
                docsSection: "get-extrinsics"
            });
        } else {
            res.render('notfound', {
                recordtype: "chain"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/events/:chainID_or_chainName/:s?/:m?', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"] ? req.params["chainID_or_chainName"] : "polkadot";
    try {
        //let chainID = parseInt(req.params["chainID"], 10);
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);
        if (chain) {
            let sectionMethods = await query.getRuntimeEvents(chain);
            res.render('query', {
                tbl: "events",
                sectionMethods: sectionMethods,
                chainID: chainID,
                id: id,
                section: req.params.s,
                method: req.params.m,
                fromAddress: "",
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                title: `Events Query`,
                apiUrl: req.path,
                docsSection: "get-events"
            });
        } else {
            res.render('notfound', {
                recordtype: "chain"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/transfers/:chainID_or_chainName/:s?/:m?', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"] ? req.params["chainID_or_chainName"] : "polkadot";
    try {
        //let chainID = parseInt(req.params["chainID"], 10);
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);
        let chains = await query.getChains(1, "chainName");
        if (chain) {
            let symbols = await query.getChainSymbols(chain);
            res.render('query', {
                tbl: "transfers",
                symbols: symbols,
                chainID: chainID,
                id: id,
                chains: chains,
                fromAddress: "",
                toAddress: "",
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                title: `Transfers Query`,
                apiUrl: req.path,
                docsSection: "get-events"
            });
        } else {
            res.render('notfound', {
                recordtype: "chain"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})
// Usage: https://polkaholic.io/evmtxs/moonbeam
app.get('/evmtxs/:chainID_or_chainName/:s?/:m?', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    try {
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);
        let section = req.params.s ? req.params.s : "";
        let methodID = req.params.m ? req.params.m : "";
        if (section == "unknown") {
            section = "";
        }
        if (methodID == "unknown") {
            methodID = "";
        }
        if (chain) {
            res.render('query', {
                tbl: "evmtxs",
                chainID: chainID,
                id: id,
                section: section,
                methodID: methodID,
                fromAddress: "",
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                title: `EVM TXs Query`,
                apiUrl: req.path,
                docsSection: "get-evmtxs"
            });
        } else {
            res.render('notfound', {
                recordtype: "chain"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/xcmtransfers/:chainID_or_chainName?/:chainID_or_chainName2?', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    let chainID_or_chainName2 = req.params["chainID_or_chainName2"]
    try {
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let [chainIDDest, id2] = query.convertChainID(chainID_or_chainName2)
        let chain = null;
        let chains = await query.getChains(1, "chainName");
        if (chainID_or_chainName == "all") {
            chainID = "all";
            chain = await query.getChain(0);
        } else {
            chain = await query.getChain(chainID);
        }
        if (chainID_or_chainName2 == "all") chainIDDest = "all";
        res.render('query', {
            tbl: "xcmtransfers",
            chainID: chainID,
            chainIDDest: chainIDDest,
            chains: chains,
            id: id,
            iddest: id2,
            fromAddress: "",
            chainInfo: query.getChainInfo(0),
            chain: chain,
            title: `XCM Transfers Query`,
            apiUrl: req.path,
            docsSection: "get-xcmtransfers"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/xcmmessages/:chainID_or_chainName?/:chainID_or_chainName2?', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"] ? req.params["chainID_or_chainName"] : "all";
    let chainID_or_chainName2 = req.params["chainID_or_chainName2"] ? req.params["chainID_or_chainName2"] : "all"
    try {
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let [chainIDDest, id2] = query.convertChainID(chainID_or_chainName2)
        let chain = null;
        let chains = await query.getChains(1, "chainName");

        if (chainID_or_chainName == "all") {
            chainID = "all";
            chain = await query.getChain(0);
        } else {
            chain = await query.getChain(chainID);
        }
        if (chainID_or_chainName2 == "all") chainIDDest = "all";
        res.render('query', {
            tbl: "xcmmessages",
            chainID: chainID,
            chainIDDest: chainIDDest,
            chains: chains,
            id: id,
            iddest: id2,
            fromAddress: "",
            chainInfo: query.getChainInfo(0),
            chain: chain,
            title: `XCM Messages Query`,
            apiUrl: req.path,
            docsSection: "get-xcmmessages"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


// Usage: https://polkaholic.io/extrinsics/10
app.get('/specversion/:chainID_or_chainName/:specVersion', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    try {
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let specVersion = parseInt(req.params["specVersion"], 10);
        let chain = await query.getChain(chainID);
        if (chain) {
            var filters = [];
            var specVersionData = await query.getSpecVersionMetadata(chainID, specVersion);
            var runtimeExtrinsics = await query.getRuntimeExtrinsics(chain);
            var runtimeEvents = await query.getRuntimeEvents(chain);
            var metadata = JSON.parse(specVersionData.metadata);
            res.render('specversion', {
                specVersion: specVersion,
                runtime: metadata,
                extrinsics: runtimeExtrinsics,
                events: runtimeEvents,
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-specversion"
            });
        } else {
            res.render('notfound', {
                recordtype: "chain"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/trace/:chainID_or_chainName/:blockNumber/:blockHash?', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainID_or_chainName"]
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);
        let blockNumber = parseInt(req.params["blockNumber"], 10);
        let blockHash = (req.params.blockhash != undefined) ? req.params.blockhash : false
        var traces = await query.getTrace(chainID_or_chainName, blockNumber, blockHash);
        if (traces) {
            res.render('trace', {
                traces: traces,
                blockNumber: blockNumber,
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-trace"
            });
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

// Usage: https://polkaholic.io/block/karura/1000000?blockhash=xxx&decorate=true&extra=address,usd
app.get('/block/:chainID_or_chainName/:blockNumber', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    try {
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);
        let blockNumber = parseInt(req.params["blockNumber"], 10);
        let blockHash = (req.query.blockhash != undefined) ? req.query.blockhash : '';
        let [decorate, decorateExtra] = decorateOptUI(req)
        var b = await query.getBlock(chainID, blockNumber, blockHash, decorate, decorateExtra);
        if (b) {
            res.render('block', {
                b: b,
                blockNumber: blockNumber,
                blockHash: blockHash,
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-block"
            });
        } else {
            res.render('notfound', {
                recordtype: "block"
            });
        }
    } catch (err) {
        res.render('error', {
            chainInfo: query.getChainInfo(),
            err: err
        });
    }
})

// Usage: https://polkaholic.io/blockhash/0x2d893816b0d7c1ab476dc64c8febe98f4b78db16af809dab302386e6c919f017
app.get('/blockhash/:blockhash', async (req, res) => {
    try {
        let blockHash = (req.params["blockhash"])
        var b = await query.getBlockByHash(blockHash);
        if (b && (b.chainID != undefined) && (b.number != undefined)) {
            let blockNumber = b.number;
            let chain = await query.getChain(b.chainID);
            let [chainID, id] = query.convertChainID(b.chainID);
            res.render('block', {
                b: b,
                blockNumber: blockNumber,
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-block"
            });
        } else {
            res.render('notfound', {
                recordtype: "block"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://polkaholic.io/blockhash/0x2d893816b0d7c1ab476dc64c8febe98f4b78db16af809dab302386e6c919f017
app.get('/blockhash/:blockhash', async (req, res) => {
    try {
        let blockHash = (req.params["blockhash"])
        let [decorate, decorateExtra] = decorateOptUI(req)
        var b = await query.getBlockByHash(blockHash, decorate, decorateExtra);
        if (b && (b.chainID != undefined) && (b.number != undefined)) {
            let blockNumber = b.number;
            let chain = await query.getChain(b.chainID);
            let [chainID, id] = query.convertChainID(b.chainID);
            res.render('block', {
                b: b,
                blockNumber: blockNumber,
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-block"
            });
        } else {
            res.render('notfound', {
                recordtype: "block"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/claimaddress/:address/:message/:signature', async (req, res) => {
    try {
        let address = req.params["address"];
        let message = req.params["message"];
        let signature = req.params["signature"];
        let verified = await query.verifyClaimAddress(address, message, signature);
        res.redirect(`/account/${address}`);
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/follow/:toAddress', async (req, res) => {
    try {
        let toAddress = req.params["toAddress"];
        let fromAddress = getHomePubkey(req);
        if (fromAddress) {
            await query.followUser(fromAddress, toAddress);
        }
        res.redirect(`/account/${toAddress}`);
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/unfollow/:toAddress', async (req, res) => {
    try {
        let toAddress = req.params["toAddress"];
        let fromAddress = getHomePubkey(req);
        if (fromAddress) {
            await query.unfollowUser(fromAddress, toAddress);
        }
        res.redirect(`/account/${toAddress}`);
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/followers/:address', async (req, res) => {
    try {
        let address = req.params["address"];
        let fromAddress = getHomePubkey(req);
        let [decorate, decorateExtra] = decorateOptUI(req)
        let followers = await query.getFollowers(address, fromAddress, decorate, decorateExtra);
        res.render('followers', {
            chainInfo: query.getChainInfo(),
            address: address,
            apiUrl: req.path,
            fromAddress: fromAddress,
            followers: followers,
            docsSection: "get-account"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/following/:address', async (req, res) => {
    try {
        let address = req.params["address"];
        let fromAddress = getHomePubkey(req);
        let [decorate, decorateExtra] = decorateOptUI(req)
        let following = await query.getFollowing(address, fromAddress, decorate, decorateExtra);
        res.render('following', {
            chainInfo: query.getChainInfo(),
            address: address,
            apiUrl: req.path,
            fromAddress: fromAddress,
            following: following,
            docsSection: "get-account"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/account/:address', async (req, res) => {
    try {
        let fromAddress = getHomePubkey(req);
        let address = req.params["address"];
        let [decorate, decorateExtra] = decorateOptUI(req)
        let [requestedChainID, id] = getHostChain(req);
        console.log(`getHostChain chainID=${requestedChainID}, id=${id}`)
        let account = await query.getAccountAssetsRealtimeByChain(requestedChainID, address, fromAddress, decorate, decorateExtra);
        res.render('account', {
            account: account,
            chainInfo: query.getChainInfo(),
            address: address,
            claimed: false,
            apiUrl: req.path,
            fromAddress: fromAddress,
            requestedChainID: requestedChainID,
            docsSection: "get-account"
        });
    } catch (err) {
        res.render('error', {
            chainInfo: query.getChainInfo(),
            err: err
        });
    }
})

app.get('/asset/:assetChain', async (req, res) => {
    try {
        let homePubkey = getHomePubkey(req);
        let assetChain0 = req.params["assetChain"];
        let assetChain = decodeURIComponent(assetChain0);
        let asset = await query.getAsset(assetChain, homePubkey);

        res.render('asset', {
            asset: asset,
            chainInfo: query.getChainInfo(),
            address: homePubkey,
            assetChain: assetChain,
            apiUrl: req.path,
            docsSection: "get-asset"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.post('/search/', async (req, res) => {
    try {
        let search = req.body.search.trim();
        let searchresults = await query.getSearchResults(req.body.search);
        if (searchresults.length == 1) {
            // redirect
            res.redirect(searchresults[0].link);
        } else {
            res.render('searchresults', {
                search: search,
                searchresults: searchresults,
                chainInfo: query.getChainInfo()
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

/*
1. Claim Rewards
https://moonscan.io/tx/0x50db76d1dbfaabd60674c8bacaaf023834c8f5624401b5dbfd057c7dd076adc6
https://polkaholic.io/tx/0x50db76d1dbfaabd60674c8bacaaf023834c8f5624401b5dbfd057c7dd076adc6

2. StellaSwap operation of 100 GLMR => 100 WGLMR [deposit]
https://moonscan.io/tx/0x9c677e67856357feaa08e5301702cd8c54c06547257169e2494e10318aba2613
https://polkaholic.io/tx/0x9c677e67856357feaa08e5301702cd8c54c06547257169e2494e10318aba2613

3A. APPROVE 50 WGLMR => 138 USD
https://moonscan.io/tx/0x141f00ed19ee6df7e85ea85cb440074f0f05c0141e5c85fe0cd801d578cc3bbc
https://polkaholic.io/tx/0x141f00ed19ee6df7e85ea85cb440074f0f05c0141e5c85fe0cd801d578cc3bbc

3B. swapExactTokensForToken
https://moonscan.io/tx/0xa64ba1bb62d967c40792a4cfc6c38a2d0ba5859b896fd16af2834b6662a1ff1b
https://polkaholic.io/tx/0xa64ba1bb62d967c40792a4cfc6c38a2d0ba5859b896fd16af2834b6662a1ff1b

4A. APPROVE LP Token
https://moonscan.io/tx/0x29230f2be08e23571648629fd3e73286263d689ca575d6c8151c4836f6b18bfc
https://polkaholic.io/tx/0x29230f2be08e23571648629fd3e73286263d689ca575d6c8151c4836f6b18bfc

4B. get LP Token
https://moonscan.io/tx/0x3e1781e64ed29eb8ce460365d6a7a7b22140805997e3ea6f675876d1a35f6550
https://polkaholic.io/tx/0x3e1781e64ed29eb8ce460365d6a7a7b22140805997e3ea6f675876d1a35f6550
*/
app.get('/tx/:txhash', async (req, res) => {
    try {
        let txHash = req.params['txhash'];
        let [decorate, decorateExtra] = decorateOptUI(req)
        let tx = await query.getTransaction(txHash, decorate, decorateExtra);
        if (tx) {
            let txview = 'tx';
            if (tx.to) txview = 'evmtx';
            res.render(txview, {
                txHash: txHash,
                tx: tx,
                chainInfo: query.getChainInfo(tx.chainID),
                apiUrl: req.path,
                docsSection: "get-transaction"
            });
        } else {
            res.render('notfound', {
                recordtype: "transaction"
            });
        }
    } catch (err) {
        res.render('error', {
            chainInfo: query.getChainInfo(),
            err: err
        });
    }
})

app.get('/sponsoroffers', async (req, res) => {
    try {
        let homePubkey = getHomePubkey(req);
        let sponsoroffers = await query.getSponsorOffers(homePubkey);
        if (sponsoroffers) {
            res.render('sponsoroffers', {
                sponsoroffers: sponsoroffers,
                chainInfo: query.getChainInfo(),
                apiUrl: req.path,
                docsSection: "get-sponsoroffers"
            });
        } else {
            res.render('notfound', {
                recordtype: "transaction"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/reindex', async (req, res) => {
    try {
        let chains = await query.getChainsReindex();
        if (chains) {
            res.render('reindex', {
                chains: chains,
                chainInfo: query.getChainInfo(),
                apiUrl: req.path,
                docsSection: "get-reindex"
            });
        } else {
            res.render('notfound', {
                recordtype: "transaction"
            });
        }
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})




app.get('/about', async (req, res) => {
    res.render('about', {
        chainInfo: query.getChainInfo()
    });
})

app.get('/privacy', async (req, res) => {
    res.render('privacy', {
        chainInfo: query.getChainInfo()
    });
})

app.get('/error', async (req, res) => {
    res.render('error', {
        chainInfo: query.getChainInfo()
    });
})

app.get('/features', async (req, res) => {
    res.render('features', {
        chainInfo: query.getChainInfo()
    });
})

app.get('/playground', async (req, res) => {
    res.render('playground', {
        apiUrl: "/",
        chainInfo: query.getChainInfo()
    });
})

app.use(function(err, req, res, next) {
    res.status(500);
    if (process.env.NODE_ENV == "development") {
        res.render("error", {
            chainInfo: query.getChainInfo(),
            err: err
        });
    } else {
        query.logger.error({
            "op": "WEBSITE",
            err,
            url: req.originalUrl
        });
        res.render("error", {
            chainInfo: query.getChainInfo(),
            err: null
        });
    }
})

const hostname = "::";
let x = query.init(); // lower in dev, higher in production
Promise.all([x]).then(() => {
    // delayed listening of your app
    app.listen(port, hostname, () => {
        let uiHostName = `${query.hostname}.polkaholic.io`
        console.log(`Polkaholic listening on ${uiHostName}:${port} API URL:`, app.locals.config.baseURL);
    })
    // reload chains/assets/specVersions regularly
    query.autoUpdate()
}).catch(err => {
    // handle error here
});