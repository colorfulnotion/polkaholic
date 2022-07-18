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

const PolkaholicDB = require("./polkaholicDB");
const paraTool = require("./paraTool");
const uiTool = require("./uiTool");
const mysql = require("mysql2");
const ParallelParser = require("./chains/parallel");
const AcalaParser = require("./chains/acala");
const AstarParser = require("./chains/astar");
const MoonbeamParser = require("./chains/moonbeam");
const InterlayParser = require("./chains/interlay");
const KicoParser = require("./chains/kico");
const ChainParser = require("./chains/chainparser");

module.exports = class AssetManager extends PolkaholicDB {
    nativeAssetInfo = {};
    assetInfo = {};
    assetlog = {};
    ratelog = {};
    assetlogTTL = 0;
    ercTokenList = {};
    currencyIDInfo = {};
    storageKeys = {};
    skipStorageKeys = {};
    accounts = {};
    chainParser = null; // initiated by setup_chainParser (=> chainParserInit)
    chainParserChainID = null;

    constructor(debugLevel = false) {
        super()
    }

    getChainPrefix(chainID) {
        if (this.chainInfos[chainID] != undefined) {
            let ss58Format = this.chainInfos[chainID].ss58Format;
            return ss58Format
        }
        return 42 //default substrate
    }

    CDPStringUnify(assetString) {
        let s = assetString.replace('CDP_Borrow', 'CDP');
        return s.replace('CDP_Supply', 'CDP');
    }

    async chainParserInit(chainID, debugLevel = 0) {
        if (this.chainParser && (this.chainParserChainID == chainID)) return;
        if (chainID == paraTool.chainIDKarura || chainID == paraTool.chainIDAcala) {
            this.chainParser = new AcalaParser();
        } else if (chainID == paraTool.chainIDAstar || chainID == paraTool.chainIDShiden) {
            this.chainParser = new AstarParser();
        } else if (chainID == paraTool.chainIDParallel || chainID == paraTool.chainIDHeiko) {
            this.chainParser = new ParallelParser();
            await this.chainParser.addCustomAsset(this); // ????
        } else if (chainID == paraTool.chainIDMoonbeam || chainID == paraTool.chainIDMoonriver) {
            this.chainParser = new MoonbeamParser();
        } else if (chainID == paraTool.chainIDInterlay || chainID == paraTool.chainIDKintsugi) {
            this.chainParser = new InterlayParser();
        } else if (chainID == paraTool.chainIDKico) {
            this.chainParser = new KicoParser();
        } else {
            this.chainParser = new ChainParser();
        }
        if (this.chainParser) {
            this.chainParserChainID = chainID;
        }
        if (debugLevel > 0) {
            this.chainParser.setDebugLevel(debugLevel)
        }
    }

    // reads all the decimals from the chain table and then the asset mysql table
    async init_chainInfos() {
        //TODO: adjust getSystemProperties to handle case where chain that does not have a "asset" specified (or use left join here) will get one
        var chains = await this.poolREADONLY.query(`select id, chain.chainID, chain.chainName, relayChain, paraID, ss58Format, isEVM, chain.iconUrl, asset.asset, asset.symbol, asset.decimals, asset.priceUSD, asset.priceUSDPercentChange, githubURL, subscanURL, parachainsURL, dappURL from chain left join asset on chain.chainID = asset.chainID and chain.asset = asset.asset where ( crawling = 1 or paraID > 0 and id is not null);`);
        var specVersions = await this.poolREADONLY.query(`select chainID, blockNumber, specVersion from specVersions order by chainID, blockNumber`);
        var assets = await this.poolREADONLY.query(`select asset, chainID, symbol, decimals from asset where decimals is not Null and asset not like '0x%' `);
        // +---------+-----------------------+---------------+-----------------------+----------+-------+----------+-----------------------+
        // | chainID | chainName             | symbol        | symbols               | decimals | isEVM | priceUSD | priceUSDPercentChange |
        // +---------+-----------------------+---------------+-----------------------+----------+-------+----------+-----------------------+
        // |      10 | acala                 | aca           | ["ACA"]               | [12]     |     0 |   1.8012 |                  0.07 |

        let chainInfoMap = {}
        let chainNameMap = {}
        for (const chain of chains) {
            let decimals = parseInt(chain.decimals, 10)
            let paraID = parseInt(chain.paraID, 10)
            let chainName = (chain.chainName != undefined) ? this.capitalizeFirstLetter(chain.chainName) : null
            let info = {
                id: chain.id,
                iconUrl: chain.iconUrl,
                chainID: chain.chainID,
                name: chainName,
                decimal: decimals,
                asset: chain.asset,
                symbol: chain.symbol,
                ss58Format: chain.ss58Format,
                priceUSD: (chain.priceUSD != undefined) ? chain.priceUSD : 0,
                priceUSDPercentChange: (chain.priceUSDPercentChange != undefined) ? chain.priceUSDPercentChange : 0,
                relayChain: chain.relayChain,
                paraID: paraID,
                isEVM: (chain.isEVM == 1) ? true : false,
                githubURL: chain.githubURL,
                subscanURL: chain.subscanURL,
                parachainsURL: chain.parachainsURL,
                dappURL: chain.dappURL
            } //use the first decimal until we see an "exception"
            chainInfoMap[chain.chainID] = info
            chainNameMap[chain.id] = info
        }

        // build specVersionsMap
        let specVersionsMap = {};
        for (const specVersion of specVersions) {
            let chainID = parseInt(specVersion.chainID, 10)
            if (!specVersionsMap[chainID]) {
                specVersionsMap[chainID] = [];
            }
            specVersionsMap[chainID].push(specVersion);
        }

        this.chainInfos = chainInfoMap
        this.chainNames = chainNameMap
        this.specVersions = specVersionsMap
    }

    async assetManagerInit() {
        await this.init_chainInfos()
        await this.init_chain_asset_and_nativeAsset() // this will init assetInfo and assetLog
        await this.init_storage_keys();
        await this.init_accounts();
        return (true);
    }

    async init_storage_keys() {
        let keys = await this.poolREADONLY.query(`select storageKey, palletName, storageName, docs from chainPalletStorage;`);
        for (const p of keys) {
            this.storageKeys[p.storageKey] = {
                palletName: p.palletName,
                storageName: p.storageName
            };
        }
    }

    async init_accounts() {
        let accounts = await this.poolREADONLY.query(`select address, nickname, judgements, info, judgementsKSM, infoKSM, verified, verifyDT, numFollowers, numFollowing from account;`);
        let subaccountsKSM = await this.poolREADONLY.query(`select address, parentKSM, subNameKSM from subaccount where parentKSM is not null;`);
        let subaccountsDOT = await this.poolREADONLY.query(`select address, parent, subName from subaccount where parent is not null;`);

        this.accounts = {}
        // fetch chain idendity
        for (const p of accounts) {
            if (p.info != null) p.info = JSON.parse(p.info.toString('utf8'));
            if (p.judgements != null) p.judgements = JSON.parse(p.judgements.toString('utf8'));
            p.child = []
            if (p.infoKSM != null) p.infoKSM = JSON.parse(p.infoKSM.toString('utf8'));
            if (p.judgementsKSM != null) p.judgementsKSM = JSON.parse(p.judgementsKSM.toString('utf8'));

            try {
                //try to get display name if possible
                if (p.info != null) {
                    let parsedInfo = p.info
                    p.display = parsedInfo.display
                }
                if (p.infoKSM != null) {
                    let parsedInfoKSM = p.infoKSM
                    p.displayKSM = parsedInfoKSM.display
                }
            } catch (e) {
                //
            }

            p.childKSM = []
            this.accounts[p.address] = p
        }

        for (const sd of subaccountsKSM) {
            let parentKSMAddress = sd.parentKSM
            let subAddress = sd.address
            let p = this.accounts[subAddress]
            if (p == undefined) {
                // init p here
                p = {}
            }

            p.parentKSM = sd.parentKSM
            p.subNameKSM = (sd.subNameKSM != undefined) ? sd.subNameKSM.toString('utf8') : null
            let parentIdentity = this.accounts[parentKSMAddress]
            if (parentIdentity != undefined) {
                if (parentIdentity.infoKSM != undefined) {
                    p.infoKSM = parentIdentity.infoKSM
                }
                if (parentIdentity.judgementsKSM != undefined) {
                    p.judgementsKSM = parentIdentity.judgementsKSM
                }
                if (parentIdentity.displayKSM != undefined) {
                    p.parentDisplayKSM = parentIdentity.displayKSM
                }
                /*
                if (parentIdentity.nickname != undefined){
                    p.parentNickname = parentIdentity.nickname
                }
                */
                parentIdentity.childKSM.push({
                    subAddress: subAddress,
                    subName: p.subNameKSM
                })
            }
            this.accounts[subAddress] = p
            this.accounts[parentKSMAddress] = parentIdentity
        }

        for (const sd of subaccountsDOT) {
            let parentAddress = sd.parent
            let subAddress = sd.address
            let p = this.accounts[subAddress]
            if (p == undefined) {
                // init p here
                p = {}
            }
            p.parent = sd.parent
            p.subName = (sd.subName != undefined) ? sd.subName.toString('utf8') : null
            let parentIdentity = this.accounts[parentAddress]
            if (parentIdentity != undefined) {
                if (parentIdentity.info != undefined) {
                    p.info = parentIdentity.info
                }
                if (parentIdentity.judgements != undefined) {
                    p.judgements = parentIdentity.judgements
                }

                if (parentIdentity.display != undefined) {
                    p.parentDisplay = parentIdentity.display
                }
                /*
                if (parentIdentity.nickname != undefined){
                    p.parentNickname = parentIdentity.nickname
                }
                */
                parentIdentity.child.push({
                    subAddress: subAddress,
                    subName: p.subName
                })
            }
            this.accounts[subAddress] = p
            this.accounts[parentAddress] = parentIdentity
        }


        let multisigaccounts = await this.poolREADONLY.query(`select address, threshold, signatories, signatorycnt from multisigaccount`);
        let related = []
        for (const a of multisigaccounts) {
            a.signatories = a.signatories.split("|")
            related.push({
                accountType: "multisig",
                address: a.address,
                threshold: a.threshold,
                signatories: a.signatories,
                signatorycnt: a.signatorycnt
            })
            for (const s of a.signatories) {
                related.push({
                    accountType: "multisigMember",
                    address: s,
                    multisigAddress: a.address,
                    threshold: a.threshold,
                    other_signatories: a.signatories.filter(function(value, index, arr) {
                        return value != s;
                    }),
                    signatorycnt: a.signatorycnt
                });
            }
        }
        let proxyaccounts = await this.poolREADONLY.query(`select chainID, address, delegate, proxyType, delay from proxyaccount where removed = 0`);
        for (const a of proxyaccounts) {
            related.push({
                accountType: "proxyDelegate",
                address: a.address,
                chainID: a.chainID,
                delegate: a.delegate,
                proxyType: a.proxyType,
                delay: a.delay
            })
            related.push({
                accountType: "proxyDelegateOf",
                address: a.delegate,
                chainID: a.chainID,
                delegateOf: a.address,
                proxyType: a.proxyType,
                delay: a.delay
            })
        }

        for (let i = 0; i < related.length; i++) {
            let r = related[i];
            if (this.accounts[r.address] == undefined) {
                this.accounts[r.address] = {}
            }
            if (this.accounts[r.address].related == undefined) {
                this.accounts[r.address].related = [];
            }

            this.accounts[r.address].related.push(r);
        }

        //console.log(`init_accounts`, this.accounts)
    }

    lookup_account(address) {
        if (this.accounts[address] != undefined) {
            return (this.accounts[address]);
        }
        let asciiName = paraTool.pubKeyHex2ASCII(address);
        if (asciiName != null) {
            return ({
                nickname: asciiName,
                verified: true
            });
        }
        return (null)
    }

    lookup_trace_sectionStorage(inpk, inpv) {
        let o = {}
        if (!inpk) return ([null, null]);
        let key = inpk.slice()
        if (key.substr(0, 2) == "0x") key = key.substr(2)
        let k = key.slice();
        if (k.length > 64) k = k.substr(0, 64);
        let sk = this.storageKeys[k];
        if (sk != undefined) {
            return [sk.palletName, sk.storageName];
        }
        return ([null, null]);

    }

    async get_skipStorageKeys() {
        var storageKeysList = await this.poolREADONLY.query(`select palletName, storageName, storageKey from chainPalletStorage where skip = 1`);
        this.skipStorageKeys = {};
        if (storageKeysList.length > 0) {
            for (const sk of storageKeysList) {
                this.skipStorageKeys[`${sk.storageKey}`] = sk;
            }
        }
    }

    async init_paras() {
        let paras = await this.poolREADONLY.query(`select id, chainID, chainName, relayChain, paraID, concat(relayChain,'-',paraID) as fullparaID, symbol from chain order by relayChain desc, chainID;`);
        for (const p of paras) {
            this.paras[p.fullparaID] = p
        }
    }

    async init_chain_asset_and_nativeAsset() {
        // return cached version
        let currTS = this.getCurrentTS();

        // reload assetInfo
        await this.init_asset_info()

        // reload paras
        await this.init_paras();

        // init nativeAsset
        await this.init_nativeAssetInfo();
        return true
    }

    async init_nativeAssetInfo() {
        let assetRecs = await this.poolREADONLY.query("select asset, chainID, assetName, symbol, decimals, assetType from asset where isNativeChain = 1 and assetType = 'Token' order by asset");

        let nativeAssetInfo = {};
        for (let i = 0; i < assetRecs.length; i++) {
            let v = assetRecs[i];
            let a = {}
            // add assetChain (string) + parseUSDpaths (JSON array)
            let assetChain = paraTool.makeAssetChain(v.asset, v.chainID);
            let nativeAsset = v.asset
            let priceUSDpaths = (v.priceUSDpaths) ? JSON.parse(v.priceUSDpaths.toString()) : false;
            //does not have assetPair, token0, token1, token0Symbol, token1Symbol, token0Decimals, token1Decimals
            a = {
                assetType: v.assetType,
                assetName: v.assetName,
                assetChain: assetChain, //native assetChain that should have price info
                asset: v.asset,
                symbol: v.symbol,
                decimals: v.decimals,
                chainID: v.chainID, //nativeChainID
            }
            nativeAssetInfo[nativeAsset] = a; //the key has no chainID
        }
        this.nativeAssetInfo = nativeAssetInfo;
        //console.log(`this.nativeAssetInfo`, nativeAssetInfo)
    }

    async init_asset_info() {
        let assetRecs = await this.poolREADONLY.query("select assetType, asset.assetName, asset.numHolders, asset.asset, asset.symbol, asset.decimals, asset.token0, asset.token0Symbol, asset.token0Decimals, asset.token1, asset.token1Symbol, asset.token1Decimals, asset.chainID, chain.chainName, asset.isUSD, priceUSDpaths, nativeAssetChain, currencyID from asset, chain where asset.chainID = chain.chainID and assetType in ('ERC20','ERC20LP','ERC721','ERC1155','Token','LiquidityPair','NFT','Loan','Special', 'CDP_Supply', 'CDP_Borrow') order by chainID, assetType, asset");

        let nassets = 0;
        let assetInfo = {};
        let currencyIDInfo = {};
        for (let i = 0; i < assetRecs.length; i++) {
            let v = assetRecs[i];
            let a = {}
            // add assetChain (string) + parseUSDpaths (JSON array)
            let assetChain = paraTool.makeAssetChain(v.asset, v.chainID);
            let priceUSDpaths = (v.priceUSDpaths) ? JSON.parse(v.priceUSDpaths.toString()) : false;
            if (v.assetType == 'LiquidityPair' || v.assetType == 'ERC20LP') { //'ERC20','ERC20LP','ERC721','ERC1155','Token','LiquidityPair','NFT','Loan','Special'
                a = {
                    assetType: v.assetType,
                    assetName: v.assetName,
                    numHolders: v.numHolders,
                    asset: v.asset,
                    symbol: v.symbol,
                    decimals: v.decimals,
                    token0: v.token0,
                    token0Symbol: v.token0Symbol,
                    token0Decimals: v.token0Decimals,
                    token1: v.token1,
                    token1Symbol: v.token1Symbol,
                    token1Decimals: v.token1Decimals,
                    chainID: v.chainID,
                    chainName: v.chainName,
                    assetChain: assetChain,
                    isUSD: v.isUSD,
                    priceUSDpaths: priceUSDpaths,
                    nativeAssetChain: v.nativeAssetChain
                }
            } else {
                //does not have assetPair, token0, token1, token0Symbol, token1Symbol, token0Decimals, token1Decimals
                a = {
                    assetType: v.assetType,
                    assetName: v.assetName,
                    numHolders: v.numHolders,
                    asset: v.asset,
                    symbol: v.symbol,
                    decimals: v.decimals,
                    chainID: v.chainID,
                    chainName: v.chainName,
                    assetChain: assetChain,
                    isUSD: v.isUSD,
                    priceUSDpaths: priceUSDpaths,
                    nativeAssetChain: v.nativeAssetChain
                }
            }
            assetInfo[assetChain] = a;
            if (v.currencyID != null && v.currencyID.length > 0) {
                let currencyChain = paraTool.makeAssetChain(v.currencyID, v.chainID)
                currencyIDInfo[currencyChain] = a;
            }
            nassets++;
        }
        this.assetInfo = assetInfo;
        //console.log(`this.assetInfo`, assetInfo)
        this.currencyIDInfo = currencyIDInfo;
    }

    async getChainERCAssets(chainID) {
        var sql = `select * from asset where chainID = '${chainID}' and asset like '0x%'`
        var assets = await this.poolREADONLY.query(sql);
        let loadedCnt = 0
        let loadErrCnt = 0
        for (let i = 0; i < assets.length; i++) {
            let a = assets[i];
            //load `state` from JSON string
            if (a.lastState != undefined) {
                try {
                    let lastState = `${a.lastState}`
                    let parsedState = JSON.parse(lastState)
                    a.lastState = parsedState
                    //console.log(`getChainERCAssets loaded`, parsedState)
                    this.ercTokenList[a.asset] = parsedState
                    loadedCnt++
                } catch (e) {
                    loadErrCnt++
                    a.lastState = false
                    console.log(`error`, e.toString())
                }
            }
            //this.ercTokenList[a.asset] = a;
        }
        //console.log(`getChainERCAssets loaded: ${loadedCnt}, loadErrCnt: ${loadErrCnt}, state null: ${assets.length-loadedCnt-loadedCnt}, total: ${assets.length}`);
    }

    async addAssetInfo(asset, chainID, assetInfo, caller = false) {
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        let isNativeChain = (assetInfo.isNativeChain != undefined) ? assetInfo.isNativeChain : 0
        let currencyID = (assetInfo.currencyID != undefined) ? `${assetInfo.currencyID}` : 'NULL'
        await this.upsertSQL({
            "table": "asset",
            "keys": ["asset", "chainID"],
            "vals": ["assetName", "symbol", "decimals", "assetType", "isNativeChain", "currencyID"],
            "data": [`( '${asset}', '${chainID}', '${assetInfo.name}', '${assetInfo.symbol}', '${assetInfo.decimals}', '${assetInfo.assetType}', '${isNativeChain}', ${currencyID} )`],
            "replaceIfNull": ["assetName", "symbol", "decimals", "assetType", "isNativeChain", "currencyID"]
        });
        assetInfo.assetName = assetInfo.name //TODO: cached assetInfo from mysql has assetName but not "name"
        this.assetInfo[assetChain] = assetInfo;
        if (caller) {
            console.log(`[${caller}] adding this.assetInfo[${assetChain}]`, this.assetInfo[assetChain])
        } else {
            console.log(`adding this.assetInfo[${assetChain}]`, this.assetInfo[assetChain])
        }
        this.reloadChainInfo = true;
    }

    async addLpAssetInfo(lpAsset, chainID, lpAssetInfo, caller = false) {
        let lpAssetChain = paraTool.makeAssetChain(lpAsset, chainID);
        await this.upsertSQL({
            "table": "asset",
            "keys": ["asset", "chainID"],
            "vals": ["assetName", "symbol", "decimals", "assetType", 'token0', 'token0symbol', 'token0decimals', 'token1', 'token1symbol', 'token1decimals'],
            "data": [`( '${lpAsset}', '${chainID}', '${lpAssetInfo.name}', '${lpAssetInfo.symbol}', '${lpAssetInfo.decimals}', '${lpAssetInfo.assetType}', '${lpAssetInfo.token0}', '${lpAssetInfo.token0symbol}', '${lpAssetInfo.token0decimals}', '${lpAssetInfo.token1}', '${lpAssetInfo.token1symbol}', '${lpAssetInfo.token1decimals}')`],
            "replaceIfNull": ["assetName", "symbol", "decimals", "assetType", 'token0', 'token0symbol', 'token0decimals', 'token1', 'token1symbol', 'token1decimals']
        });
        lpAssetInfo.assetName = lpAssetInfo.name //TODO: cached assetInfo from mysql has assetName but not "name"
        this.assetInfo[lpAssetChain] = lpAssetInfo;
        if (caller) {
            console.log(`[${caller}] adding this.addLpAssetInfo[${lpAssetChain}]`, this.assetInfo[lpAssetChain])
        } else {
            console.log(`adding LP this.assetInfo[${lpAssetChain}]`, this.assetInfo[lpAssetChain])
        }
        this.reloadChainInfo = true;
    }

    getNativeAssetChainID(asset) {
        let isFound = false
        let nativeChainID = false
        if (this.nativeAssetInfo[asset] != undefined) {
            isFound = true
            nativeChainID = this.nativeAssetInfo[asset].chainID
            return [nativeChainID, isFound]
        } else {
            //console.log("getAssetDecimal MISS", "CONTEXT", ctx, "assetString", assetString);
            return [false, false]
        }
    }

    //todo: should this function be async. If so, how to handle it in txparams.ejs?
    getAssetDecimal(asset, chainID, ctx = "false") {
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        if (this.assetInfo[assetChain] != undefined) {
            return this.assetInfo[assetChain].decimals
        } else {
            //console.log("getAssetDecimal MISS", "CONTEXT", ctx, "assetString", assetString);
            return (false);
        }
    }

    getCurrencyIDDecimal(currencyID, chainID) {
        let currencyChain = paraTool.makeAssetChain(currencyID, chainID);
        if (this.currencyIDInfo[currencyChain] !== undefined) {
            let assetInfo = this.currencyIDInfo[currencyChain];
            if (assetInfo.decimals != undefined && assetInfo.decimals) {
                return assetInfo.decimals
            }
        }
        return (false);
    }

    getCurrencyIDSymbol(currencyID, chainID) {
        let currencyChain = paraTool.makeAssetChain(currencyID, chainID);
        if (this.currencyIDInfo[currencyChain] !== undefined) {
            let assetInfo = this.currencyIDInfo[currencyChain];
            if (assetInfo.symbol != undefined && assetInfo.symbol) {
                return assetInfo.symbol
            }
        }
        return (false);
    }

    async get_assetlog(asset, chainID, lookbackDays = 180, depth = 0) {
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        let currentTS = this.getCurrentTS();
        if (this.assetlog[assetChain] !== undefined) {
            if (this.assetlog[assetChain].expireTS > currentTS)
                return (this.assetlog[assetChain])
        }

        // expire the assetlog record in 4-5mins, where randomness is included so we don't have many assetchain recs expire at the same time, creating db load all at once
        let assetlog = {
            expireTS: currentTS + 240 + Math.round(60 * Math.random()),
            assetType: null
        };
        let assets = await this.poolREADONLY.query(`select assetName, symbol, assetType, nativeAssetChain, isNativeChain from asset where asset = '${asset}' and chainID = '${chainID}'`)
        if (assets.length == 0) {
            assetlog.expireTS = currentTS + 15; // short for now
            this.assetlog[assetChain] = assetlog;
            return (this.assetlog[assetChain]);
        }
        let a = assets[0];
        assetlog.assetType = a.assetType;
        assetlog.symbol = a.symbol;
        if (a.nativeAssetChain != null && a.nativeAssetChain.length > 0) {
            let [nativeAsset, nativeChainID] = paraTool.parseAssetChain(a.nativeAssetChain)
            assetlog.nativeAsset = nativeAsset;
            assetlog.nativeChainID = nativeChainID;
        }

        // Loans [Acala/Karura] and CDPSupply/CDPBorrw [Parallel/Heiko]
        if (assetlog.assetType == "Loan") {
            let ratelogRecs = await this.poolREADONLY.query(`select assetlog.indexTS, asset.decimals, assetlog.debitexchangerate from assetlog, asset
               where assetlog.asset = asset.asset and assetlog.chainID = asset.chainID and
                indexTS > UNIX_TIMESTAMP(DATE_SUB(Now(), interval ${lookbackDays} DAY))
                and asset.asset = '${asset}' and asset.chainID = '${chainID}'
                and asset.assetType = 'Loan' and assetlog.debitexchangerate > 0
                order by indexTS`);
            if (ratelogRecs.length > 0) {
                assetlog.rates = []
            }
            for (let i = 0; i < ratelogRecs.length; i++) {
                let a = ratelogRecs[i];
                assetlog.rates.push({
                    ts: a.indexTS,
                    r: parseFloat(a.debitexchangerate),
                });
            }
        } else if (assetlog.assetType == paraTool.assetTypeCDPBorrow) {
            let assetKey = this.CDPStringUnify(asset);
            let ratelogRecs = await this.poolREADONLY.query(`select indexTS, borrowExchangeRate, supplyExchangeRate from assetlog
               where asset = '${assetKey}' and indexTS > UNIX_TIMESTAMP(DATE_SUB(Now(), interval ${lookbackDays} DAY))
                and chainID = '${chainID}' and ( assetlog.supplyExchangeRate > 0 or assetlog.borrowExchangeRate > 0 )
                order by indexTS`);
            if (ratelogRecs.length > 0) {
                assetlog.rates = []
            }
            for (let i = 0; i < ratelogRecs.length; i++) {
                let a = ratelogRecs[i];
                assetlog.rates.push({
                    ts: a.indexTS,
                    b: parseFloat(a.borrowExchangeRate)
                });
            }
        } else if (assetlog.assetType == paraTool.assetTypeCDPSupply) {
            let assetKey = this.CDPStringUnify(asset);
            let ratelogRecs = await this.poolREADONLY.query(`select indexTS, borrowExchangeRate, supplyExchangeRate from assetlog
               where asset = '${assetKey}' and indexTS > UNIX_TIMESTAMP(DATE_SUB(Now(), interval ${lookbackDays} DAY))
                and chainID = '${chainID}' and ( assetlog.supplyExchangeRate > 0 or assetlog.borrowExchangeRate > 0 )
                order by indexTS`);
            if (ratelogRecs.length > 0) {
                assetlog.rates = []
            }
            for (let i = 0; i < ratelogRecs.length; i++) {
                let a = ratelogRecs[i];
                assetlog.rates.push({
                    ts: a.indexTS,
                    r: parseFloat(a.supplyExchangeRate)
                });
            }
        }

        if (assetlog.nativeAsset !== undefined && depth == 0) {
            let nativeassetlog = await this.get_assetlog(assetlog.nativeAsset, assetlog.nativeChainID, lookbackDays, depth + 1)
            if (nativeassetlog.prices !== undefined) {
                assetlog.prices = nativeassetlog.prices;
            }
        } else {
            let priceUSDRecs = await this.poolREADONLY.query(`select indexTS, priceUSD from assetlog where priceUSD > 0 and asset = '${asset}' and chainID = '${chainID}' order by indexTS;`);
            if (priceUSDRecs.length > 0) {
                assetlog.prices = [];
            }
            for (let i = 0; i < priceUSDRecs.length; i++) {
                let a = priceUSDRecs[i];
                assetlog.prices.push({
                    ts: a.indexTS,
                    p: parseFloat(a.priceUSD)
                });
            }
        }

        if (assetlog.assetType == "LiquidityPair" || assetlog.assetType == "ERC20LP") {
            let sql = `select assetlog.indexTS, assetlog.issuance, assetlog.lp0, assetlog.lp1, assetlog.close, asset.numHolders
          from assetlog, asset
          where assetlog.asset = asset.asset and assetlog.chainID = asset.chainID and
            indexTS > UNIX_TIMESTAMP(DATE_SUB(Now(), interval ${lookbackDays} DAY)) and
            asset.assetType in ('LiquidityPair', 'ERC20LP') and
            asset.asset = '${asset}' and asset.chainID = '${chainID}'
          order by indexTS`;
            let dexRecs = await this.poolREADONLY.query(sql);
            let prevIssuance = 0;
            if (dexRecs.length > 0) {
                assetlog.dexRecs = [];
            }
            for (let i = 0; i < dexRecs.length; i++) {
                let a = dexRecs[i];
                let issuance = a.issuance > 0 ? a.issuance : prevIssuance;
                if (issuance > 0) {
                    assetlog.dexRecs.push({
                        ts: a.indexTS,
                        dexRec: {
                            issuance: issuance,
                            lp0: a.lp0,
                            lp1: a.lp1,
                            close: a.close
                        }
                    });
                    prevIssuance = issuance;
                }
            }
        }

        this.assetlog[assetChain] = assetlog;

        for (const ac of Object.keys(this.assetlog)) {
            if (this.assetlog[ac].expireTS < currentTS) {
                delete this.assetlog[ac]
            }
        }
        return (this.assetlog[assetChain]);
    }



    binarySearch(ar, el, compare_fn) {
        var m = 0;
        var n = ar.length - 1;
        if (m > n) return (false);

        while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compare_fn(el, ar[k]);

            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                return ar[k];
            }
        }
        let r = m - 1;

        if (r < 0) return ar[0];
        if (r > ar.length - 1) {
            return ar[ar.length - 1];
        }
        return ar[r];
    }


    async decorateUSD(c, fld = 'value', asset, chainID, ts, decorate = true) {
        console.log(`decorateUSD fld=${fld}, decorate=${decorateUSD}`, c)
        if (c[fld] == undefined) {
            return c
        }
        let val = c[fld]
        if (decorate) {
            let [valueUSD, priceUSD, priceUSDCurrent] = await this.computeUSD(c, val, chainAsset, chainID, cTimestamp);
            c[`${fld}USD`] = valueUSD;
            c.priceUSD = priceUSD;
            c.priceUSDCurrent = priceUSDCurrent;
        }
        return c
    }

    // returns priceUSD from CEX or DEX pricing at ts, using binary search on assetlog.prices (CEX) or assetlog.dexcloses (DEX) data
    async computeUSD(val, asset, chainID, ts) {
        let tsInt = parseInt(ts, 10);
        var compare = function(a, b) {
            return (a - b.ts);
        }
        // see if we can find price via direct lookup
        let assetlog = await this.get_assetlog(asset, chainID)
        if ((assetlog !== undefined) && (assetlog.prices !== undefined)) {
            let res = this.binarySearch(assetlog.prices, tsInt, compare);
            if (res) {
                //console.log("CEX model: ", res.p);
                let out = val * res.p;
                let priceUSD = res.p;
                let priceUSDCurrent = (assetlog.prices.length > 0) ? assetlog.prices[assetlog.prices.length - 1].p : 0;
                //console.log(`CEX model, val=${val}, out=${out}, priceUSD=${priceUSD}, priceUSDCurrent=${priceUSDCurrent}`)
                return [out, priceUSD, priceUSDCurrent];
            }
        }

        // see if we can find the price using assetID lookup
        if (!isNaN(asset)) {
            // must be a pure Int for assetID lookup
            let alternativeAsset = `{"Token":"${asset}"}`
            let assetlog = await this.get_assetlog(alternativeAsset, chainID)
            if ((assetlog !== undefined) && (assetlog.prices !== undefined)) {
                let res = this.binarySearch(assetlog.prices, tsInt, compare);
                if (res) {
                    //console.log(`${asset} Fall back assetID model : `, res.p);
                    let out = val * res.p;
                    let priceUSD = res.p;
                    let priceUSDCurrent = (assetlog.prices.length > 0) ? assetlog.prices[assetlog.prices.length - 1].p : 0;
                    //console.log(`AssetID model, val=${val}, out=${out}, priceUSD=${priceUSD}, priceUSDCurrent=${priceUSDCurrent}`)
                    return [out, priceUSD, priceUSDCurrent];
                }
            }
        }

        // fallback to nativeAsset
        let [nativeChainID, isFound] = await this.getNativeAssetChainID(asset)
        //console.log(`getNativeAssetChainID(${asset}), nativeChainID=${nativeChainID}, isFound=${isFound}`)
        if (isFound) {
            let nativeAssetlog = await this.get_assetlog(asset, nativeChainID)
            if ((nativeAssetlog !== undefined) && (nativeAssetlog.prices !== undefined)) {
                let res = this.binarySearch(nativeAssetlog.prices, tsInt, compare);
                if (res) {
                    // console.log(`${asset} Fall back CEX model : `, res.p);
                    let out = val * res.p;
                    let priceUSD = res.p;
                    let priceUSDCurrent = (nativeAssetlog.prices.length > 0) ? nativeAssetlog.prices[nativeAssetlog.prices.length - 1].p : 0;
                    //console.log(`Fall back CEX model, val=${val}, out=${out}, priceUSD=${priceUSD}, priceUSDCurrent=${priceUSDCurrent}`)
                    return [out, priceUSD, priceUSDCurrent];
                }
            }
        }
        return await this.computeUSD_dex(val, asset, chainID, tsInt);
    }


    async computeUSD_dex(val, asset, chainID, ts = false) {
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        let assetInfo = this.assetInfo[assetChain]
        if (assetInfo == undefined) {
            // console.log("computeUSD_dex not found", assetChain);
            return [0, 0, 0];
        }

        if (assetInfo.isUSD > 0) {
            return [val, 1, 1];
        }

        let currentTS = this.getCurrentTS();
        switch (assetInfo.assetType) {
            case paraTool.assetTypeERC20:
            case paraTool.assetTypeToken: {
                let priceUSD = await this.getTokenPriceUSD(asset, chainID, ts);
                let priceUSDCurrent = await this.getTokenPriceUSD(asset, chainID, currentTS);
                return [val * priceUSD, priceUSD, priceUSDCurrent];
            }
            break;
            case paraTool.assetTypeERC20LiquidityPair:
            /*
            	    if WGLMR is $2.13 and GLINT is $0.003049, how much is 1 WGLMR/GLINT
            total lp0(WGLMR): 267712
            total lp1(GLINT): 128949000
            total LP issuance WGLMR/GLINT: 5770310

            1 share of WGLMR/GLINT is 267712/5770310 ~ 0.04639473442 WGLMR + 128949000/5770310  ~ 22.346979625 GLINT
            ~= 2.13*0.04639473442 + 22.346979625*0.003049
            ~= 0.09882078431 + 0.06813594087
            	    ~= 0.16695672518
            */
            {
                let dexRec = await this.getDexRec(asset, chainID, ts);
                if (dexRec == undefined) {
                    console.log("no assetpair info", assetChain);
                    return [false, false, false];
                }
                let priceUSD0 = await this.getTokenPriceUSD(assetInfo.token0, chainID, ts);
                let priceUSD1 = await this.getTokenPriceUSD(assetInfo.token1, chainID, ts);
                let priceUSD0Current = await this.getTokenPriceUSD(assetInfo.token0, chainID, currentTS);
                let priceUSD1Current = await this.getTokenPriceUSD(assetInfo.token1, chainID, currentTS);
                let issuance = dexRec.issuance;
                let x0 = dexRec.lp0 / issuance;
                let x1 = dexRec.lp1 / issuance;
                let priceUSD = x0 * priceUSD0 + x1 * priceUSD1;
                let priceUSDCurrent = x0 * priceUSD0Current + x1 * priceUSD1Current;
                //console.log("priceUSD0", priceUSD0, "priceUSD1", priceUSD1, "issuance", issuance, "x0", x0, "x1", x1, "p0", p0, "p1", p1, "priceUSD", priceUSD);
                return [val * priceUSD, priceUSD, priceUSDCurrent];
            }
            break;
            case paraTool.assetTypeLiquidityPair: {
                let dexRec = await this.getDexRec(asset, chainID, ts);
                if (!dexRec) {
                    console.log("no assetpair info", assetChain);
                    return [false, false];
                }

                let priceUSD0 = await this.getTokenPriceUSD(assetInfo.token0, chainID, ts);
                let priceUSD1 = await this.getTokenPriceUSD(assetInfo.token1, chainID, ts);
                // special cases
                if (priceUSD0 == 1 && (priceUSD1 == 0)) {
                    priceUSD1 = dexRec.lp0 / dexRec.lp1;
                }
                if (priceUSD0 == 0 && (priceUSD1 == 1)) {
                    priceUSD0 = dexRec.lp1 / dexRec.lp0;
                }

                let priceUSD0Current = await this.getTokenPriceUSD(assetInfo.token0, chainID, currentTS);
                let priceUSD1Current = await this.getTokenPriceUSD(assetInfo.token1, chainID, currentTS);
                let issuance = dexRec.issuance;
                let x0 = dexRec.lp0 / issuance;
                let x1 = dexRec.lp1 / issuance;
                let priceUSD = x0 * priceUSD0 + x1 * priceUSD1;
                let priceUSDCurrent = x0 * priceUSD0Current + x1 * priceUSD1Current;
                //console.log("priceUSD0", priceUSD0, "priceUSD1", priceUSD1, "issuance", issuance, "x0", x0, "x1", x1, "priceUSD", priceUSD);
                return [val * priceUSD, priceUSD, priceUSDCurrent];
            }
            break;
            case paraTool.assetTypeLoan: {
                let parsedAsset = JSON.parse(asset);
                if (parsedAsset.Loan !== undefined) {
                    let loanedAsset = JSON.stringify(parsedAsset.Loan);
                    let priceUSD = await this.getTokenPriceUSD(loanedAsset, chainID, ts); //this is actually collateral..
                    let priceUSDCurrent = await this.getTokenPriceUSD(loanedAsset, chainID, currentTS); //this is actually collateral..
                    return [val * priceUSD, priceUSD, priceUSDCurrent];
                }
            }
            break;
            case paraTool.assetTypeCDPSupply: {
                let parsedAsset = JSON.parse(asset);
                if (parsedAsset.CDP_Supply !== undefined) {
                    let suppliedAsset = JSON.stringify(parsedAsset.CDP_Supply);
                    let x = await this.computeUSD(val, suppliedAsset, chainID, ts);
                    return x;
                }
            }
            break;
            case paraTool.assetTypeCDPBorrow: {
                let parsedAsset = JSON.parse(asset);
                if (parsedAsset.CDP_Borrow !== undefined) {
                    let borrowedAsset = JSON.stringify(parsedAsset.CDP_Borrow);
                    let x = await this.computeUSD(val, borrowedAsset, chainID, ts);
                    return x;
                }
            }
            break;
            default: {
                console.log("not implemented:", assetInfo.assetType);
            }
            break;
        }
        return [0, 0, 0];
    }


    // getTokenPriceUSD returns a priceUSD Given an asset: 0x4204cad97732282d261fbb7088e07557810a6408 for a token (e.g. SHARE) with priceUSDpaths like:
    async getTokenPriceUSD(asset, chainID, ts = false) {
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        let assetInfo = this.assetInfo[assetChain];
        if (assetInfo == undefined) {
            console.log("getTokenPriceUSD - no assetInfo", assetChain);
            return (0);
        }
        if (assetInfo.assetType == undefined) {
            console.log("undefined assetType", assetInfo, asset, chainID);
        }
        if (!(assetInfo.assetType == "ERC20" || assetInfo.assetType == "Token")) {
            console.log("getTokenPriceUSD - Wrong asset type", assetInfo.assetType);
            return (0);
        }

        let priceUSDpaths = assetInfo.priceUSDpaths;
        if (assetInfo.isUSD > 0) return (1);
        //console.log("getTokenPriceUSD", asset, chainID, priceUSDpaths, assetInfo);
        if (priceUSDpaths == undefined || !priceUSDpaths) return (0);
        if (priceUSDpaths.length == 0) return (0);
        let priceUSDpath = assetInfo.priceUSDpaths[0];
        let v = 1.0;
        //console.log("DEX model", asset, priceUSDpaths);
        for (let j = priceUSDpath.length - 1; j > 0; j--) {
            let r = priceUSDpath[j];
            let dexrec = await this.getDexRec(r.route, chainID, ts);
            if (dexrec) {
                let s = parseInt(r.s, 10);
                if (s == 1) {
                    v *= dexrec.close;
                } else {
                    v /= dexrec.close;
                }
            } else {
                //console.log("getTokenPriceUSD - MISSING route", r.route, "ts", ts, "asset", asset, "assetChain", assetChain, "assetInfo", assetInfo);
            }
        }
        return (v);
    }


    async getDexRec(asset, chainID, ts) {
        let assetlog = await this.get_assetlog(asset, chainID);
        if (assetlog.dexRecs == undefined) {
            //console.log("FAIL2", asset);
            return (false);
        }

        let res = this.binarySearch(assetlog.dexRecs, ts, function(a, b) {
            return (a - b.ts);
        });
        //console.log("getDexRec", asset, assetlog.dexRecs, ts, res);
        if (res && res.dexRec) {
            return (res.dexRec);
        }
        return (false);
    }

    async updateXCMTransfer(lookback = 720) {

        let xcmtransfers = await this.poolREADONLY.query(`select extrinsicHash, transferIndex, extrinsicID, sourceTS, asset, rawAsset, nativeAssetChain, chainID, chainIDDest, amountSent, amountReceived from xcmtransfer where sourceTS > UNIX_TIMESTAMP(date_sub(Now(), interval ${lookback} day)) and ( amountSentUSD = 0 or amountReceived = 0 ) and incomplete = 0 order by sourceTS desc limit 1000000`);
        //console.log(`xcm sql`, xcmtransfers)
        let out = [];
        for (const xcm of xcmtransfers) {
            let decimals = false;
            let targetChainID = xcm.chainID // the chainID to use for price lookup
            let targetAsset = xcm.rawAsset // the asset to use for price lookup

            if (xcm.nativeAssetChain != undefined) {
                let [nativeAsset, nativeChainID] = paraTool.parseAssetChain(xcm.nativeAssetChain)
                targetAsset = nativeAsset
                targetChainID = nativeChainID
            }

            let rawassetChain = paraTool.makeAssetChain(targetAsset, targetChainID);
            if (this.assetInfo[rawassetChain] && this.assetInfo[rawassetChain].decimals != undefined) {
                decimals = this.assetInfo[rawassetChain].decimals;
            }

            if (this.assetInfo[rawassetChain]) {
                let [_, __, priceUSD] = await this.computeUSD(1.0, targetAsset, targetChainID, xcm.sourceTS);
                if (priceUSD > 0) {
                    xcm.amountSent = parseFloat(xcm.amountSent) / 10 ** decimals;
                    xcm.amountReceived = parseFloat(xcm.amountReceived) / 10 ** decimals;
                    let amountSentUSD = (xcm.amountSent > 0) ? priceUSD * xcm.amountSent : 0;
                    let amountReceivedUSD = (xcm.amountReceived > 0) ? priceUSD * xcm.amountReceived : 0;
                    console.log(xcm.asset, xcm.rawAsset, xcm.nativeAssetChain, xcm.chainID, xcm.chainIDDest, decimals, priceUSD, xcm.amountSent, amountSentUSD, xcm.amountReceived, amountReceivedUSD);
                    let sql = `update xcmtransfer set amountSentUSD = '${amountSentUSD}', amountReceivedUSD = '${amountReceivedUSD}', priceUSD='${priceUSD}' where extrinsicHash = '${xcm.extrinsicHash}' and transferIndex = '${xcm.transferIndex}'`
                    this.batchedSQL.push(sql);
                    await this.update_batchedSQL();
                }
            } else {
                console.log(`DECIMALS NOT FOUND [${xcm.extrinsicHash}] targetAsset=${targetAsset}, targetChainID=${targetChainID}, asset=${xcm.asset}, asset=${xcm.rawAsset}, nativeAssetChain=${xcm.nativeAssetChain} `)
            }
        }

    }


    async getCDPExchangeRates(cdpBSAsset, chainID, ts) {
        let tsInt = parseInt(ts, 10);
        var compare = function(a, b) {
            return (a - b.ts);
        }
        let assetlog = await this.get_assetlog(cdpBSAsset, chainID)
        if ((assetlog !== undefined) && (assetlog.rates !== undefined)) {
            let res = this.binarySearch(assetlog.rates, tsInt, compare);
            if (res) {
                return res;
            }
        } else {
            console.log(`loanedAsset ${loanedAsset} rate not found`, assetlog)
            return [0, 0]
        }
    }




    /*
        {
        	"LiquidityPair": [{
        		"asset": "[{\"Token\":\"KAR\"},{\"Token\":\"KSM\"}]",
        		"chainID": 8,
        		"assetInfo": {
        			"asset": "[{\"Token\":\"KAR\"},{\"Token\":\"KSM\"}]",
        			"chainID": 8,
        			"assetType": "LiquidityPair",
        			"assetName": "KAR/KSM",
        			"decimals": 12,
        			"symbol": "KAR/KSM"
        		},
        		"state": {
        			"free": 9.591076851929
        		}
        	}],
        	"Loan": [{
        		"asset": "{\"Loan\":{\"Token\":\"KSM\"}}",
        		"chainID": 8,
        		"assetInfo": {
        			"asset": "{\"Loan\":{\"Token\":\"KSM\"}}",
        			"chainID": 8,
        			"assetType": "Loan",
        			"assetName": "Loan:KSM",
        			"decimals": 12,
        			"symbol": "Loan:KSM"
        		},
        		"state": {
        			"debit": 0,
        			"borrowedAsset": "KUSD",
        			"borrowed": null
        		}
        	}]
                }
        	"Token": [{
        		"asset": "{\"LiquidCrowdloan\":\"13\"}",
        		"chainID": 10,
        		"assetInfo": {
        			"asset": "{\"LiquidCrowdloan\":\"13\"}",
        			"chainID": 10,
        			"assetType": "Token",
        			"assetName": "lcDOT",
        			"decimals": 10,
        			"symbol": "lcDOT"
        		},
        		"state": {}
        		*/
    async compute_holdings_USD(holdings, ts = false) {
        if (!ts) {
            ts = this.getCurrentTS();
        }
        let totalUSDVal = 0;
        for (const assetType of Object.keys(holdings)) {
            let assets = holdings[assetType];
            if (assets == undefined) {
                //console.log("holdings assetType:", assetType, holdings[assetType]);
                continue;
            }
            let flds = this.get_assetType_flds(assetType);
            for (let i = 0; i < assets.length; i++) {
                let holding = holdings[assetType][i];
                let usdVal = await this.decorate_assetState(holding.assetInfo, holding.state, flds, ts);
                totalUSDVal += usdVal;
            }
        }
        return totalUSDVal;
    }


    get_assetType_flds(assetType) {
        // Note: "transferable" and "balance" are synthetized from free, reserved, miscFrozen
        let assetTypesFields = {
            "Token": ["free", "reserved", "miscFrozen", "feeFrozen", "frozen", "transferable", "balance"],
            "Loan": ["collateral", "debit"],
            "CDP_Supply": ["adjustedVoucher"],
            "CDP_Borrow": ["adjustedPrincipal"],
            "LiquidityPair": ['free', "balance"],
            'ERC20LP': ['free', "balance"],
            'ERC20': ['free', "balance"],
            // TODO:
            'ERC721': [],
            'ERC1155': []
        };
        let res = assetTypesFields[assetType];
        if (res !== undefined) {
            return (res);
        }
        console.log("get_assetType_flds empty", assetType);
        return ([]);
    }


    // return debitExchangeRate for the loan
    async computeLoanedAmount(debitAmount, loanedAsset, chainID, ts) {
        let tsInt = parseInt(ts, 10);
        var compare = function(a, b) {
            return (a - b.ts);
        }
        let assetlog = await this.get_assetlog(loanedAsset, chainID)
        if ((assetlog !== undefined) && (assetlog.rates !== undefined)) {
            let res = this.binarySearch(assetlog.rates, tsInt, compare);
            if (res) {
                //console.log("Loan model: ", res.r);
                let readable_rate = res.r // already adjusted at the time we record it
                let readable_rateCurrent = (assetlog.rates.length > 0) ? assetlog.rates[assetlog.rates.length - 1].r : 0;
                let out = debitAmount * readable_rate
                return [out, readable_rate, readable_rateCurrent];
            }
        } else {
            console.log(`loanedAsset ${loanedAsset} rate not found`, assetlog)
            return [0, 0, 0]
        }
    }

    async decorate_assetState(assetInfo, state, flds, ts) {
        let targetAsset = assetInfo.asset;
        let totalUSDVal = 0;
        for (const fld of flds) {
            if (fld == "balance") {
                // balance = free + reserved
                let free = state["free"] ? state["free"] : 0;
                let reserved = state["reserved"] ? state["reserved"] : 0;
                state["balance"] = free + reserved;
            } else if (fld == "transferable") {
                // transferable = free - miscFrozen
                let free = state["free"] ? state["free"] : 0;
                let miscFrozen = state["miscFrozen"] ? state["miscFrozen"] : 0;
                state["transferable"] = free - miscFrozen;
            }
            if (state[fld] || (fld == "debit")) {
                let val = state[fld];
                let assetType = assetInfo.assetType;
                let chainID = assetInfo.chainID;
                if (assetType == paraTool.assetTypeCDPSupply && fld == "adjustedVoucher") {
                    let adjustedVoucher = state["adjustedVoucher"];
                    let rates = await this.getCDPExchangeRates(targetAsset, chainID, ts);
                    val = adjustedVoucher * rates.r;
                    state["supplied"] = val
                } else if (assetType == paraTool.assetTypeCDPBorrow && fld == "adjustedPrincipal") {
                    let adjustedPrincipal = state["adjustedPrincipal"]
                    let rates = await this.getCDPExchangeRates(targetAsset, chainID, ts);
                    val = adjustedPrincipal * rates.b;
                    state["borrowed"] = val
                } else if (assetType == "Loan" && fld == "debit") {
                    let loanedAsset = assetInfo.asset;
                    let debitAmount = state["debit"]

                    let [borrowedAmount, exchangeRate, exchangeRateCurrent] = await this.computeLoanedAmount(debitAmount, loanedAsset, chainID, ts)
                    state["exchangeRate"] = exchangeRate
                    state["exchangeRateCurrent"] = exchangeRateCurrent
                    //let suppliedAsset = state["suppliedAsset"]
                    //let borrowedAsset = state["borrowedAsset"]
                    targetAsset = (chainID == paraTool.chainIDKarura) ? '{"Token":"KUSD"}' : '{"Token":"AUSD"}' // hard-coded ausd for now..
                    state['borrowedAsset'] = JSON.parse(targetAsset) //fix it here until we fixed the bt

                    if (debitAmount > 0) {
                        val = borrowedAmount
                        state["borrowed"] = val
                    } else {
                        //skip further decoration when debit is 0
                        continue
                    }
                } else if (assetType == "Loan" && fld == "collateral") {
                    //can't compute  {"Loan":{"Token":"ACA"}}. using suppliedAsset instead{"Token":"ACA"}
                    targetAsset = JSON.stringify(state['suppliedAsset'])
                }

                let [USDval, rate, priceUSDCurrent] = await this.computeUSD(val, targetAsset, chainID, ts);
                if (USDval) {
                    state[fld + "USD"] = USDval;
                    if (assetType == "Loan" && fld == "collateral") {
                        state["collateralAssetRate"] = rate;
                        state["rate"] = rate; // remove this after UI is updated
                    } else if (assetType == "Loan" && fld == "debit") {
                        state["borrowedAssetRate"] = rate;
                    } else {
                        state["rate"] = rate;
                    }
                    if (state["adjustedVoucherUSD"] !== undefined) {
                        state["balanceUSD"] = state["adjustedVoucherUSD"];
                        totalUSDVal += state["balanceUSD"];
                    } else if (state["adjustedPrincipalUSD"] !== undefined) {
                        state["adjustedPrincipalUSD"] = -state["adjustedPrincipalUSD"];
                        state["balanceUSD"] = state["adjustedPrincipalUSD"];
                        totalUSDVal += state["balanceUSD"];
                    } else if (state["borrowedUSD"] !== undefined && state["collateralUSD"] !== undefined) {
                        state["balanceUSD"] = state["collateralUSD"] - state["borrowedUSD"];
                        state["collateralRatio"] = state["collateralUSD"] / state["borrowedUSD"];
                        totalUSDVal += state["balanceUSD"];
                    } else if (assetType == "Loan") {
                        // covered by the above
                    } else if (assetType == "Token") {
                        if (fld == "balance") {
                            totalUSDVal += USDval
                        }
                    } else {
                        totalUSDVal += USDval
                    }
                } else {
                    // console.log(`MISSING ${fld}`, targetAsset);
                }
            }
        }
        return totalUSDVal;
    }

    filterRelated(related) {
        return related.filter((r) => {
            if (r.accountType == undefined) return false;
            if (r.accountType == "proxyDelegateOf") return true;
            if (r.accountType == "multisig") return true;
            return false;
        })
    }

    decorateAddresses(c, fld, decorateAddr = true, decorateRelated = true) {
        let res = [];
        let nhits = 0;
        try {
            if (!decorateAddr && !decorateRelated) return (false)
            if (c[fld] == undefined) return (false);
            if (!Array.isArray(c[fld])) return (false);

            for (const id of c[fld]) {
                // nickname, judgements, info, judgementsKSM, infoKSM, verified, verifyDT, numFollowers, numFollowing
                let address = paraTool.getPubKey(id);
                let hit = false;
                let o = {};
                if (address) {
                    let a = this.lookup_account(address);
                    if (a == null) {

                    } else {
                        if (decorateAddr) {
                            if (a.nickname != null && a.verified > 0) {
                                o['nickname'] = a.nickname;
                                hit = true;
                            }
                            if (a.info != null) {
                                o['info'] = a.info;
                                o['judgements'] = a.judgements;
                                hit = true;
                            } else if (a.infoKSM != null) {
                                o['info'] = a.infoKSM;
                                o['judgements'] = a.judgementsKSM;
                                hit = true;
                            }
                        }
                        if (a.related != undefined && decorateRelated) {
                            o['related'] = this.filterRelated(a.related);
                        }
                    }
                }
                res.push(o);
                if (hit) {
                    nhits++;
                }
            }
        } catch (e) {
            console.log(`decorateAddress err`, e.toString())
            return
        }
        if (nhits > 0) {
            c[fld + "_decorated"] = res;
        }
    }

    decorateAddress(c, fld, decorateAddr = true, decorateRelated = true) {
        let hit = false;
        try {
            if (!decorateAddr && !decorateRelated) return (false)
            if (c[fld] == undefined) return (false)
            let a = this.lookup_account(c[fld]);
            if (a == null) return (false);
            // nickname, judgements, info, judgementsKSM, infoKSM, verified, verifyDT, numFollowers, numFollowing
            if (a.related != undefined && decorateRelated) {
                c[fld + '_related'] = this.filterRelated(a.related);
            }
            if (decorateAddr) {
                if (a.nickname != null && a.verified > 0) {
                    c[fld + '_nickname'] = a.nickname;
                    hit = true;
                }
                if (a.parentDisplay != null && a.subName) {
                    c[fld + '_subIdentityName'] = `${a.parentDisplay}/${a.subName}`;
                    c[fld + '_parent'] = a.parent;
                    hit = true;
                } else if (a.parentDisplayKSM != null && a.subNameKSM) {
                    c[fld + '_subIdentityName'] = `${a.parentDisplayKSM}/${a.subNameKSM}`;
                    c[fld + '_parent'] = a.parentKSM;
                    hit = true;
                }
                if (a.info != null) {
                    if (a.display != null) c[fld + '_display'] = a.display;
                    c[fld + '_info'] = a.info;
                    c[fld + '_judgements'] = a.judgements;
                    hit = true;
                } else if (a.infoKSM != null) {
                    if (a.displayKSM != null) c[fld + '_display'] = a.displayKSM;
                    c[fld + '_info'] = a.infoKSM;
                    c[fld + '_judgements'] = a.judgementsKSM;
                    hit = true;
                }
            }
        } catch (e) {
            console.log(`decorateAddress err`, e.toString())
        }
        return (hit);
    }

    async decorateArgsAsset(args, fld, fldasset, chainID, ts, decorateUSD = true) {
        if (args[fldasset] == undefined) return;
        if (args[fld] == undefined) return;
        try {
            let val = args[fld];
            let rawAsset = args[fldasset]
            if (rawAsset.token == undefined) return;
            let symbol = rawAsset.token
            let targetAsset = JSON.stringify({
                "Token": symbol
            })
            let decimals = this.getAssetDecimal(targetAsset, chainID)
            let [valUSD, priceUSD, priceUSDCurrent] = await this.computeUSD(val, targetAsset, chainID, ts);
            args[fld + "_symbol"] = symbol
            if (decorateUSD) {
                args[fld + "_USD"] = valUSD
                args[fld + "_priceUSD"] = priceUSD
                args[fld + "_priceUSDCurrent"] = priceUSDCurrent
            }
        } catch (err) {
            console.log(err)
        }
    }

    async decorateArgsChainAsset(args, fld, chainID, ts, decorateUSD = true) {
        var decimals = this.getChainDecimal(chainID)
        if (args[fld] == undefined) return;
        let val = args[fld] / 10 ** decimals;
        let targetAsset = this.getChainAsset(chainID)
        let symbol = this.getChainSymbol(chainID)

        let [USD, priceUSD, priceUSDCurrent] = await this.computeUSD(val, targetAsset, chainID, ts);
        args[fld + "_symbol"] = symbol
        if (decorateUSD) {
            args[fld + "_USD"] = USD
            args[fld + "_priceUSD"] = priceUSD
            args[fld + "_priceUSDCurrent"] = priceUSDCurrent
        }
    }

    /* async decorateArgsPubKey(args, fld) {
        if (args[fld] == undefined) return;
        if (Array.isArray(args[fld])) {
            let ids = uiTool.presentDests(args[fld])
            let pubkeys = ids.map((id) => {
                return paraTool.getPubKey(id);
            })
            args[fld + "_pubkey"] = pubkeys;
        } else {
            let id = uiTool.presentDest(args[fld])
            if (!id) return;
            let pubkey = paraTool.getPubKey(id);
            if (pubkey) {
                args[fld + "_pubkey"] = pubkey;
            }
        }
    } */

    async decorateArgsCurrency(args, fld) {
        if (args[fld] == undefined) return;
        args[fld + "_symbol"] = uiTool.presentCurrency(args[fld])
    }

    async decorateArgsPath(args, fld) {
        if (args[fld] == undefined) return;
        args[fld + "_decorated"] = uiTool.presentPath(args[fld]);
    }

    async decorateArgsAssets(args, fld) {
        if (args[fld] == undefined) return;
        args[fld + "_symbol"] = uiTool.presentAssets(args[fld]);
    }

    async decorateArgsAssets(args, fld) {
        if (args[fld] == undefined) return;
        args[fld + "_decorated"] = uiTool.presentInfo(args[fld])
    }

    async decorateArgsTS(args, fld) {
        if (args[fld] == undefined) return;
        args[fld + "_decorated"] = uiTool.presentMS(args[fld])
    }

    async decorateArgsRemark(args, fld) {
        if (args[fld] == undefined) return;
        args[fld + "_decorated"] = uiTool.presentRemark(args[fld])
    }

    async decorateArgsParainfo(args, fld, chainID) {
        if (args[fld] == undefined) return;
        args[fld + "_parainfo"] = this.getParaInfo(args[fld], chainID)
    }
    async decorateArgsInfo(args, fld) {
        if (args[fld] == undefined) return;
        args[fld + "_info"] = uiTool.presentInfo(args[fld])
    }

    async decorateParams(pallet, method, args, chainID, ts) {
        let pallet_method = `${pallet}:${method}`
        this.chainParser.decorate_query_params(this, pallet_method, args, chainID, ts)

        return args
    }

}