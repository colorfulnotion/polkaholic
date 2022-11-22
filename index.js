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
var os = require('os')
var session = require('express-session')
const paraTool = require('./substrate/paraTool');
const util = require("util");
const identicon = require('./substrate/identicon');

const uiTool = require('./substrate/uiTool');
const prodConfig = require('./substrate/config');
const port = 3000;
const Query = require("./substrate/query");
const cookieParser = require("cookie-parser");
const ini = require('node-ini');
const fileUpload = require('express-fileupload');

var debugLevel = paraTool.debugTracing
var query = new Query(debugLevel);
app.locals.paraTool = paraTool;
app.locals.uiTool = uiTool;
app.locals.query = query;
app.locals.config = prodConfig;

// For local web/API development, add this to your ~/.bashrc:
// export NODE_ENV=development
// export POLKAHOLIC_API_URL=http://localhost:3001
if (process.env.POLKAHOLIC_API_URL != undefined) {
    app.locals.config.baseURL = process.env.POLKAHOLIC_API_URL;
}

let isDevelopment = (process.env.NODE_ENV == "development") ? true : false

if (isDevelopment) {
    app.use(express.static('public', {
        maxAge: '5s'
    }))
} else {
    app.use(express.static('public', {
        maxAge: '120m'
    }))
}
app.use(fileUpload());
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use(express.urlencoded({
    extended: true
}))

// ready db config for sessionStore
const mysqlStore = require('express-mysql-session')(session);
try {
    let dbconfigFilename = (process.env.POLKAHOLIC_DB != undefined) ? process.env.POLKAHOLIC_DB : '/root/.mysql/.db00.cnf';
    let dbconfig = ini.parseSync(dbconfigFilename);
    let c = dbconfig.client;
    const sessionStore = new mysqlStore({
        connectionLimit: 10,
        user: c.user,
        database: c.database,
        password: c.password,
        host: c.host,
        createDatabaseTable: true
    });
    app.use(session({
        secret: 'polkaholic colorful notion',
        resave: false,
        store: sessionStore,
        cookie: {
            maxAge: 1000 * 3600 * 4
        },
        saveUninitialized: false
    }))
} catch (err) {
    console.log(err);
}



app.use(function(req, res, next) {
    res.locals.req = req;
    res.locals.res = res;
    next()
})

function map_host_chain(hostname) {
    let sa = hostname.split(".");
    if (sa.length >= 2) {
        let domain = sa[sa.length - 2];
        let defaultid = null;
        let subdomains = [];
        switch (domain) {
            case "astarscan":
                defaultid = "astar"
                subdomains = ["shiden", "shibuya"];
                break;
            case "acalascan":
                defaultid = "acala"
                subdomains = ["karura", "mandala"]
                break;
            case "xcmscan":
                defaultid = "moonbeam";
                subdomains = ["moonriver", "moonbase"]
                break;
        }
        if (defaultid) {
            let subdomain = (sa.length > 2) ? sa[sa.length - 3].toLowerCase() : null;
            let [chainID, id] = query.convertChainID(subdomain && ((subdomains.length > 0 && subdomains.includes(subdomain)) || domain == "xcmscan") ? subdomain : defaultid);
            if (id) {
                return [chainID, id];
            }
        }
    }
    return [null, null];
}

// getHostChain first uses the host subdomain, then the cookie "selchain" to decide chainID/id; and returns chainID, id and a chain object
async function getHostChain(req, reqChainID = null) {
    let [chainID, id, chain] = [-1, null, {}];

    try {
        if (reqChainID) {
            let [_chainID, _id] = query.convertChainID(reqChainID)
            if (_id) {
                [chainID, id] = [_chainID, _id];
            }
        } else {
            if (id == null) {
                let selchain = req.cookies.selchain;
                if (selchain) {
                    let [_chainID, _id] = query.convertChainID(selchain)
                    if (_id) {
                        [chainID, id] = [_chainID, _id];
                    }
                } else {
                    let [_defaultchainID, _defaultid] = map_host_chain(req.get('host'));
                    if (_defaultid) {
                        [chainID, id] = [_defaultchainID, _defaultid];
                    }
                }
            }
        }
        if (id) {
            chain = await query.getChain(chainID);
        }
    } catch (err) {
        console.log(`getHostChain err`, err.toString())
    }
    return [chainID, id, chain];
}

function chainFilterOptUI(req) {
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

function decorateOptUI(req, ctx = null) {
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
            if (ctx == "account") {
                // do not include events
                decorateExtra = ["data", "usd", "address", "related"]
            } else {
                //default option: [true] usd, addr [false] related
                decorateExtra = ["data", "usd", "address", "related", "events"]
            }
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
            commit: query.commitHash,
            version: query.indexerInfo,
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

// Usage: https://polkaholic.io/verify
app.post('/verify/', async (req, res) => {
    try {
        let chains = await query.getChains();
        let wsEndpoints = [];
        for (let i = 0; i < chains.length; i++) {
            let c = chains[i];
            let endpoints = uiTool.getPublicWSEndpoints(c);
            if (endpoints.length > 0) {
                wsEndpoints.push({
                    id: c.id,
                    chainID: c.chainID,
                    WSEndpoint: endpoints[0]
                });
            }
        }
        let verify = req.body.verify ? JSON.parse(req.body.verify) : {};
        let obj = req.body.obj ? JSON.parse(req.body.obj) : {};
        res.render('verify', {
            verify,
            wsEndpoints,
            obj,
            chainInfo: query.getChainInfo()
        });
    } catch (err) {
        console.log("verify POST ERR", err);
        /*return res.status(400).json({
            error: err.toString()
        }); */
    }
})


// Usage: https://polkaholic.io/verify
/*
app.get('/verify/', async (req, res) => {
    try {
        let verify = {};
        let obj = {};
        res.render('verify', {
	    verify,
	    obj,
            chainInfo: query.getChainInfo()
        });
    } catch (err) {
	console.log("verify GET ERR", err);
        return res.status(400).json({
            error: err.toString()
        });
    }
})
*/

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

app.get('/', async (req, res) => {

    let accounts = [];
    let addresses = getHomeAddresses(req);
    try {
        if (addresses) {
            accounts = await query.getMultiAccount(addresses);
        }
    } catch (err) {
        // errors should not matter here
    }
    try {
        var relaychain = req.params.relaychain ? req.params.relaychain : "";
        var chains = await query.getChains();

        res.render('chains', {
            chains: chains,
            chainInfo: query.getChainInfo(),
            relaychain: relaychain,
            accounts: accounts,
            apiUrl: '/chains',
            docsSection: "get-all-chains"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/addresstopn', async (req, res) => {
    try {
        var chains = await query.getChains();
        let topNfilters = query.getAddressTopNFilters();
        res.render('addresstopn', {
            chains: chains,
            chainInfo: query.getChainInfo(),
            topNfilters: topNfilters,
            topN: "balanceUSD",
            apiUrl: '/addresstopn',
            docsSection: "get-all-chains"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


function getConsent(req) {
    if (req.cookies && req.cookies.consent) {
        return (req.cookies.consent);
    }
    return (false);
}

function getHomeAddresses(req) {
    if (req.cookies && req.cookies.homePub) {
        let res = req.cookies.homePub;
        let out = [];
        if (res.length > 20) {
            let sa = res.split("|");
            for (let a = 0; a < sa.length; a++) {
                let addr = paraTool.getPubKey(sa[a]);
                if (addr) {
                    out.push(addr);
                }
            }
            if (out.length > 0) {
                return out;
            }
        }
    }
    return [];
}

function getHomeDefault(req) {
    if (req.cookies && req.cookies.homePub) {
        let res = req.cookies.homePub;
        let out = [];
        if (res.length > 20) {
            let sa = res.split("|");
            for (let a = 0; a < sa.length; a++) {
                let addr = paraTool.getPubKey(sa[a]);
                if (addr) {
                    return addr;
                }
            }
        }
    }
    return (false);
}

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

// Usage: https://polkaholic.io/chaininfo
app.get('/chaininfo/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            res.render('chaininfo', {
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-chain-info"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/chainlog
app.get('/chainlog/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            res.render('chainlog', {
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-chain-info"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/channels
app.get('/channels', async (req, res) => {
    try {
        let [chainID, id, chain] = await getHostChain(req)
        console.log("getHostChain", chainID, id, chain);
        if (id) {
            res.render('channels', {
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-channels"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/projects
app.get('/projects', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            res.render('projects', {
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-channels"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/wasmcodes
app.get('/wasmcodes/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            res.render('wasmcodes', {
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-wasmcode"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/wasmcontracts
app.get('/wasmcontracts/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            res.render('wasmcontracts', {
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-wasmcode"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})


// Usage: https://polkaholic.io/specversions
app.get('/specversions/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            res.render('specversions', {
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-specversions"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/blocks/22000
app.get('/blocks/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            var blocks = await query.getChainRecentBlocks(chainID);
            res.render('blocks', {
                blocks: blocks,
                chainID: chainID,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-chain-recent-blocks"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.redirect(`/`);
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/chain/22000
app.get('/pools/:chainIDorChainName?', async (req, res) => {
    let accounts = [];
    let addresses = getHomeAddresses(req);
    try {
        if (addresses) {
            accounts = await query.getMultiAccount(addresses);
        }
    } catch (e) {
        // errors should not matter here
    }
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        if (chain) {
            res.render('pools', {
                chainID: chainID,
                addresses: addresses,
                accounts: accounts,
                id: id,
                chainInfo: query.getChainInfo(chainID),
                chain: chain,
                apiUrl: req.path,
                docsSection: "get-pools"
            });
        } else {
            res.redirect(`/`);
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
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

app.get('/extrinsicdocs/:chainIDorChainName/:p/:m', async (req, res) => {
    try {
        let chainID_or_chainName = req.params["chainIDorChainName"]
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            return res.status(400).json({
                error: err.toString()
            });
        }
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo(),
            });
        } else {
            return res.status(400).json({
                error: err.toString()
            });
        }
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo(),
            });
        } else {
            return res.status(400).json({
                error: err.toString()
            });
        }
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            return res.status(400).json({
                error: err.toString()
            });
        }
    }
})

app.get('/assets/:assetType?', async (req, res) => {
    try {
        let assetType = req.params.assetType ? req.params.assetType : "System";
        let [chainID, id, chain] = await getHostChain(req)
        res.render('assets', {
            chainInfo: query.getChainInfo(),
            chain: chain,
            chainID: chainID,
            id: id,
            assetType: assetType,
            apiUrl: '/assets',
            docsSection: "get-assets"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: https://polkaholic.io/xcmassets
app.get('/xcmassets/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let accounts = [];
        let addresses = getHomeAddresses(req);
        try {
            if (addresses) {
                accounts = await query.getMultiAccount(addresses);
            }
        } catch (e) {
            // errors should not matter here
        }
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        let filters = {}
        if (id) {
            filters.chainList = [chainID];
        }
        res.render('xcmassets', {
            chainID: chainID,
            id: id,
            accounts,
            chainInfo: query.getChainInfo(chainID),
            chain: chain,
            apiUrl: req.path,
            docsSection: "get-xcmassets"
        });
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/xcmtransfers
app.get('/xcmtransfers/:chainIDorChainName?', async (req, res) => {
    try {
        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        let filters = {}
        if (id) {
            filters.chainList = [chainID];
        }
        if (req.query.blockNumber) {
            filters.blockNumber = req.query.blockNumber;
        }
        if (req.query.xcmType) {
            filters.xcmType = req.query.xcmType;
        }
        if (req.query.symbol) {
            filters.symbol = req.query.symbol;
        }
        if (req.query.startTS) {
            filters.startTS = req.query.startTS;
        }
        if (req.query.endTS) {
            filters.endTS = req.query.endTS;
        }
        const maxRows = 1000;
        let xcmtransfers = await query.getXCMTransfers(filters, maxRows);
        res.render('xcmtransfers', {
            chainID: chainID,
            id: id,
            data: xcmtransfers,
            chainInfo: query.getChainInfo(chainID),
            chain: chain,
            apiUrl: req.path,
            docsSection: "get-xcmmessages"
        });
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/xcmmessages
app.get('/xcmmessages/:chainIDorChainName?', async (req, res) => {
    try {

        let chainIDorChainName = req.params.chainIDorChainName ? req.params.chainIDorChainName : null;
        let [chainID, id, chain] = await getHostChain(req, chainIDorChainName)
        let filters = {}
        if (id) {
            filters.chainList = [chainID];
        };
        let chainfilterList = chainFilterOptUI(req);
        if (chainfilterList && chainfilterList.length > 0) {
            filters.chainList = chainfilterList;
        }
        if (req.query.blockNumber) {
            filters.blockNumber = req.query.blockNumber;
        }

        const maxRows = 1000;
        let xcmmessages = await query.getRecentXCMMessages(filters, maxRows);
        res.render('xcmmessages', {
            chainID: chainID,
            id: id,
            data: xcmmessages,
            chainInfo: query.getChainInfo(chainID),
            chain: chain,
            apiUrl: req.path,
            docsSection: "get-xcmmessages"
        });
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

app.get('/multilocation/:relayChain?', async (req, res) => {
    try {
        let relayChains = {
            0: "Polkadot",
            2: "Kusama",
            60000: "Moonbase Relay"
        };
        let chains = await query.getChains(1, "chainName");
        res.render('multilocation', {
            chainInfo: query.getChainInfo(0),
            chain: await query.getChain(0),
            chains: chains,
            relayChains,
            apiUrl: req.path,
            docsSection: "get-multilocation"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


app.get('/remoteexecution/:address?', async (req, res) => {
    try {
        let address = req.params.address ? req.params.address : "0xDcB4651B5BbD105CDa8d3bA5740b6C4f02b9256D"; // 0x44236223aB4291b93EEd10E4B511B37a398DEE55";
        let relayChains = {
            0: "Polkadot",
            2: "Kusama",
            60000: "Moonbase Relay"
        };
        let chains = await query.getChains(1, "chainName");
        res.render('remoteexecution', {
            address: address,
            chainInfo: query.getChainInfo(0),
            chain: await query.getChain(0),
            chains: chains,
            relayChains,
            apiUrl: req.path,
            docsSection: "get-multilocation"
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "chain",
                chainInfo: query.getChainInfo()
            });
        } else {
            return res.status(400).json({
                error: err.toString()
            });
        }
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
            let view = (chain.isEVM == 1 && b.evmBlock) ? 'evmBlock' : 'block';
            res.render(view, {
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "block",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Usage: https://polkaholic.io/block/karura/1000000?blockhash=xxx&decorate=true&extra=address,usd
app.get('/txs/:chainID_or_chainName/:blockNumber', async (req, res) => {
    let chainID_or_chainName = req.params["chainID_or_chainName"]
    try {
        let [chainID, id] = query.convertChainID(chainID_or_chainName)
        let chain = await query.getChain(chainID);
        let blockNumber = parseInt(req.params["blockNumber"], 10);
        let blockHash = (req.query.blockhash != undefined) ? req.query.blockhash : '';
        let [decorate, decorateExtra] = decorateOptUI(req)
        var b = await query.getBlock(chainID, blockNumber, blockHash, decorate, decorateExtra);
        if (b) {
            let view = (chain.isEVM == 1) ? 'evmtxs' : 'txs';
            res.render(view, {
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "block",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "block",
                chainInfo: query.getChainInfo()
            });
        } else {
            return res.status(400).json({
                error: err.toString()
            });
        }
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
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "block",
                chainInfo: query.getChainInfo()
            });
        } else {
            return res.status(400).json({
                error: err.toString()
            });
        }
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
        let fromAddress = getHomeDefault(req);
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
        let fromAddress = getHomeDefault(req);
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
        let fromAddress = getHomeDefault(req);
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
        let fromAddress = getHomeDefault(req);
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

app.get('/home', async (req, res) => {
    try {
        let addresses = getHomeAddresses(req);
        let [requestedChainID, id, chainID] = await getHostChain(req);

        let chainList = chainFilterOptUI(req)
        let accounts = await query.getMultiAccount(addresses, requestedChainID, chainList);
        res.render('home', {
            accounts: accounts,
            addresses: addresses,
            chainInfo: query.getChainInfo(),
            claimed: false,
            apiUrl: req.path,
            requestedChainID: requestedChainID,
            chainListStr: chainList.join(','),
            docsSection: "get-multiaccount"
        });
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "account",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

app.get('/account/:address', async (req, res) => {
    try {
        let address = req.params["address"];
        let [requestedChainID, id, chain] = await getHostChain(req);
        let chainList = chainFilterOptUI(req)
        let addresses = getHomeAddresses(req);
        let accounts = await query.getMultiAccount([address], requestedChainID, chainList);
        if (accounts.length == 0) {
            accounts = [{
                address,
                requestedChainAddress: paraTool.getAddress(address, 0),
                requestedChainPrefix: 0
            }];
        }
        res.render('account', {
            account: accounts[0],
            chainInfo: query.getChainInfo(),
            address: address,
            addresses: addresses,
            apiUrl: req.path,
            requestedChainID: requestedChainID,
            chainListStr: chainList.join(','),
            docsSection: "get-account"
        });
        /*} else {
                res.render('notfound', {
                    recordtype: "account",
                    chainInfo: query.getChainInfo()
                });
            } */
    } catch (err) {
        res.render('error', {
            chainInfo: query.getChainInfo(),
            err: err
        });

    }
})

app.get('/address/:address/:chainID?', async (req, res) => {
    try {
        let address = req.params["address"];
        let chainID = req.params["chainID"] ? req.params["chainID"] : null;
        let [requestedChainID, id, _chain] = await getHostChain(req, chainID);
        let chainList = [];
        let [account, contract] = await query.getAddressContract(address, chainID);
        if (contract && Array.isArray(contract)) {
            res.render('searchresults', {
                search: address,
                searchresults: contract,
                chainInfo: query.getChainInfo()
            })
            return;
        }

        let chain = contract && contract.chainID ? await query.getChain(contract.chainID, true) : _chain;
        res.render('address', {
            account: account,
            contract: contract,
            chainInfo: query.getChainInfo(),
            address: address,
            chainID: chainID,
            chain: chain,
            claimed: false,
            apiUrl: req.path,
            requestedChainID: requestedChainID,
            chainListStr: chainList.join(','),
            docsSection: "get-account"
        });
    } catch (err) {
        console.log(err)
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "Address",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

app.get('/token/:address/:chainID?', async (req, res) => {
    let accounts = [];
    let addresses = getHomeAddresses(req);
    try {
        if (addresses) {
            accounts = await query.getMultiAccount(addresses);
        }
    } catch (e) {
        // errors should not matter
    }

    try {
        let address = req.params["address"];
        let chainID = req.params["chainID"] ? req.params["chainID"] : null;
        let [requestedChainID, id, chain] = await getHostChain(req, chainID);
        if (chainID == null && requestedChainID > 10) {
            chainID = requestedChainID;
        }
        let chainList = [];
        let [account, contract] = await query.getAddressContract(address, chainID);
        if (contract && contract.chainID) chainID = contract.chainID;
        res.render('token', {
            account: account,
            chainID: chainID,
            accounts: accounts,
            contract: contract,
            chainInfo: query.getChainInfo(),
            address: address,
            claimed: false,
            apiUrl: req.path,
            requestedChainID: requestedChainID,
            chainListStr: chainList.join(','),
            docsSection: "get-account"
        });
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "account",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})

// Shows a table of a specific symbol (eg KAR) with the # of holders on each chainID
// along with (a) local pricing (if available)
// (b) the users holdings on each chain [ keyed in by nativeAssetChain using accountrealtime ], and
// (c) "XCM Transfer" button on each line which enables the user to move their assets from one chain to the other.
// Any chain-specific asset links to /asset/:chainID/:assetOrCurrencyID.  Any chain mention links to /xcmassets/{chainID_or_chainName}
app.get('/symbol/:symbol', async (req, res) => {
    let accounts = [];
    let addresses = getHomeAddresses(req);
    try {
        if (addresses) {
            accounts = await query.getMultiAccount(addresses);
        }
    } catch (e) {
        // errors should not matter
    }

    try {
        let symbol = req.params["symbol"];
        let chains = await query.getSymbolAssets(symbol);
        let relayChain = (chains.length > 0 && chains[0].relayChain) ? chains[0].relayChain : 'polkadot';
        let priceUSD_routerAsset = await query.getSymbolPriceUSDCurrentRouterAsset(symbol, relayChain);
        res.render('symbol', {
            symbol: symbol,
            relayChain: relayChain,
            chainInfo: query.getChainInfo(),
            priceUSD_routerAsset,
            addresses: addresses,
            accounts: accounts,
            chains: chains,
            apiUrl: req.path,
            docsSection: "get-symbol"
        });
    } catch (err) {

        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/asset/:chainID/:currencyID', async (req, res) => {
    try {
        let addresses = getHomeAddresses(req);
        let chainID = req.params["chainID"];
        let currencyID = decodeURIComponent(req.params["currencyID"]);
        let asset = await query.getAsset(currencyID, chainID);
        let priceUSD_routerAsset = await query.getAssetPriceUSDCurrentRouterAsset(asset.asset, asset.chainID);
        let accounts = [];
        try {
            if (addresses) {
                accounts = await query.getMultiAccount(addresses);
            }
        } catch (e) {
            // errors should not matter
        }
        res.render('asset', {
            asset: asset,
            currencyID: currencyID,
            chainID: chainID,
            chainInfo: query.getChainInfo(),
            priceUSD_routerAsset,
            addresses: addresses,
            accounts: accounts,
            apiUrl: req.path,
            docsSection: "get-asset"
        });
    } catch (err) {
        console.log(err)
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/channel/:chainID/:chainIDDest/:symbol?', async (req, res) => {
    try {
        let chainID = req.params["chainID"];
        let chainIDDest = req.params["chainIDDest"];
        let symbol = req.params["symbol"] ? req.params["symbol"] : null
        res.render('channel', {
            chainID: chainID,
            chainIDDest: chainIDDest,
            chainInfo: query.getChainInfo(),
            symbol: symbol,
            apiUrl: req.path,
            docsSection: "get-channel"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: /wasmcontract/0xfa4c7e407f86e24770b9b7b5826457350df83eab1122bb398f4a5a4892ff98cb
app.get('/wasmcontract/:address/:chainID?', async (req, res) => {
    try {

        let address = req.params["address"];
        let chainID = req.params["chainID"] ? req.params["chainID"] : null;
        let contract = await query.getWASMContract(address, chainID);
        res.render('wasmcontract', {
            address: address,
            chainInfo: query.getChainInfo(),
            contract: contract,
            apiUrl: req.path,
            docsSection: "get-wasmcontract"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

// Usage: /wasmcode/0xfa4c7e407f86e24770b9b7b5826457350df83eab1122bb398f4a5a4892ff98cb
app.get('/wasmcode/:codeHash/:chainID?', async (req, res) => {
    try {
        let codeHash = req.params["codeHash"];
        let chainID = req.params["chainID"] ? req.params["chainID"] : null;
        let code = await query.getWASMCode(codeHash, chainID);
        console.log(code);
        res.render('wasmcode', {
            codeHash: codeHash,
            chainInfo: query.getChainInfo(),
            apiUrl: req.path,
            code: code,
            docsSection: "get-wasmcode"
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/router/:routerAssetChain/:symbol?', async (req, res) => {
    try {
        let q = {
            routerAssetChain: req.params['routerAssetChain']
        };
        if (req.params['symbol']) {
            q.symbol = req.params['symbol'];
        }
        let router = await query.getRouter(q.routerAssetChain);
        let pools = await query.getPools(q);
        res.render('router', {
            router: router,
            pools: pools,
            chainInfo: query.getChainInfo(),
            apiUrl: req.path,
            docsSection: "get-pools"
        });
    } catch (err) {
        console.log(err)
        return res.status(400).json({
            error: err.toString()
        });
    }
})

app.get('/pool/:asset/:chainID', async (req, res) => {
    try {
        let asset = req.params['asset'];
        let chainID = req.params['chainID'];
        let pool = await query.getPool(asset, chainID);
        let history = await query.getPoolHistory(asset, chainID);
        let accounts = {}
        res.render('pool', {
            asset,
            chainID,
            pool,
            history,
            accounts,
            chainInfo: query.getChainInfo(),
            apiUrl: req.path,
            docsSection: "get-pools"
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

async function txUIRedirect(req, res) {
    try {
        let txHash = req.params['txhash'];
        let [decorate, decorateExtra] = decorateOptUI(req)
        let tx = await query.getTransaction(txHash, decorate, decorateExtra);
        if (tx) {
            let txview = 'tx';
            if (tx.transactionHash) {
                txview = 'evmtx';
            }
            let chain = await query.getChain(tx.chainID);
            res.render(txview, {
                id: chain.id,
                txHash: txHash,
                tx: tx,
                chain: chain,
                chainInfo: query.getChainInfo(tx.chainID),
                apiUrl: req.path,
                docsSection: "get-transaction"
            });
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "transaction",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
}

app.get('/extrinsic/:txhash', async (req, res) => txUIRedirect(req, res))
app.get('/tx/:txhash', async (req, res) => txUIRedirect(req, res))

app.get('/xcmmessage/:msgHash/:blockNumber?', async (req, res) => {
    try {
        let msgHash = req.params['msgHash'];
        let blockNumber = req.params['blockNumber'];
        let [decorate, decorateExtra] = decorateOptUI(req)
        let xcm = await query.getXCMMessage(msgHash, blockNumber, decorate, decorateExtra);
        if (xcm) {
            res.render('xcmmessage', {
                msgHash: msgHash,
                blockNumber: blockNumber,
                xcm: xcm,
                chainInfo: query.getChainInfo(xcm.chainID),
                apiUrl: req.path,
                docsSection: "get-xcmmessage"
            });
        }
    } catch (err) {
        if (err instanceof paraTool.NotFoundError) {
            res.render('notfound', {
                recordtype: "XCM message",
                chainInfo: query.getChainInfo()
            });
        } else {
            res.render('error', {
                chainInfo: query.getChainInfo(),
                err: err
            });
        }
    }
})


// Sample cases:
// /xcmtransfer/0x00068acbbecec355f0c495389a29d7829f265553e258ad44d37bd52130bc44be
app.get('/xcminfo/:hash?', async (req, res) => {
    try {
        let hash = req.params['hash'] ? req.params['hash'] : null;
        let [decorate, decorateExtra] = decorateOptUI(req)
        let xcmInfo = await query.getXCMInfo(hash);
        res.render('xcminfo', {
            hash: hash,
            xcm: xcmInfo,
            apiUrl: "/",
            chainInfo: query.getChainInfo()
        });
    } catch (err) {
        return res.status(400).json({
            error: err.toString()
        });
    }
})


app.post('/uploadcontract/:address', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No contract file was uploaded.');
    }
    let address = req.params['address'];
    let contractFile = req.files.contractFile;
    console.log(contractFile.name, contractFile.size, contractFile.data.toString());

    await query.updateWASMContract(address, contractFile.data.toString());
    contractFile.mv(`/tmp/${address}.contract`, function(err) {
        if (err) {
            return res.status(500).send(err);
        }
        res.send('Contract File uploaded!');
    });

})

app.get('/xcmexecutor/:src?/:idx?', async (req, res) => {
    let src = req.params["src"] ? req.params["src"] : "moonbase-xtokens_transfer-1000-888";
    let idx = req.params["idx"] ? parseInt(req.params["idx"]) : 0;
    res.render('xcmexecutor', {
        chainInfo: query.getChainInfo(),
        src: src,
        idx: idx,
        apiUrl: req.path,
    });
})

app.post('/uploadcode/:codeHash', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No contract file was uploaded.');
    }
    let codeHash = req.params['codeHash'];
    let contractFile = req.files.contractFile;
    console.log(contractFile.name, contractFile.size, contractFile.data.toString());

    await query.updateWASMCode(codeHash, contractFile.data.toString());
    contractFile.mv(`/tmp/${codeHash}.contract`, function(err) {
        if (err) {
            return res.status(500).send(err);
        }
        res.send('Code File uploaded!');
    });
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
// MK: preemptive listening when in dev
if (isDevelopment) {
    app.listen(port, hostname, () => {
        let uiHostName = `${query.hostname}.polkaholic.io`
        console.log(`Polkaholic listening on ${uiHostName}:${port} API URL: ${app.locals.config.baseURL} preemptively`);
    })
}
// delayed listening of your app
// reload chains/assets/specVersions regularly
let x = query.init(); // lower in dev, higher in production
console.log(`[${new Date().toLocaleString()}] Initiating query`)
Promise.all([x]).then(() => {
    console.log(`[${new Date().toLocaleString()}] query ready`)
    if (!isDevelopment) {
        app.listen(port, hostname, () => {
            let uiHostName = `${query.hostname}.polkaholic.io`
            console.log(`Polkaholic listening on ${uiHostName}:${port} API URL:`, app.locals.config.baseURL);
        })
    }
    query.autoUpdate()
}).catch(err => {
    // handle error here
});