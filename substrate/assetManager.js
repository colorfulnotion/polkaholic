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

const MAX_PRICEUSD = 100000.00;

module.exports = class AssetManager extends PolkaholicDB {

    assetInfo = {};
    xcmAssetInfo = {}; // xcmInteriorKey   ->
    xcmInteriorInfo = {}; // nativeAssetChain ->
    // TODO:fuse these together
    xcmSymbolInfo = {}; // symbolRelayChain ->
    symbolRelayChainAsset = {}; // symbolRelayChain -> { ${chainID}: assetInfo }
    assetlog = {};
    ratelog = {};
    routers = {};
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

    async autoRefresh(intervalSeconds = 900) {
        while (1) {
            await this.sleep(intervalSeconds * 1000);
            console.log("autoRefresh assets...")
            await this.assetManagerInit();
            if (this.web3Api) {
                console.log("autoRefresh contractABI...")
                this.contractABIs = await this.getContractABI();
            }
        }
    }

    async chainParserInit(chainID, debugLevel = 0) {
        if (this.chainParser && (this.chainParserChainID == chainID)) return;
        if (chainID == paraTool.chainIDKarura || chainID == paraTool.chainIDAcala) {
            this.chainParser = new AcalaParser();
            /*
            } else if (chainID == paraTool.chainIDBifrostDOT || chainID == paraTool.chainIDBifrostKSM) {
                this.chainParser = new BifrostParser();
            */
        } else if (chainID == paraTool.chainIDAstar || chainID == paraTool.chainIDShiden || chainID == paraTool.chainIDShibuya) {
            this.chainParser = new AstarParser();
        } else if (chainID == paraTool.chainIDParallel || chainID == paraTool.chainIDHeiko) {
            this.chainParser = new ParallelParser();
            await this.chainParser.addCustomAsset(this); // ????
        } else if (chainID == paraTool.chainIDMoonbeam || chainID == paraTool.chainIDMoonriver || chainID == paraTool.chainIDMoonbase) {
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
        var chains = await this.poolREADONLY.query(`select id, chain.chainID, chain.chainName, relayChain, paraID, ss58Format, isEVM, chain.iconUrl,
asset.asset, asset.symbol, asset.decimals, asset.priceUSD, asset.priceUSDPercentChange,
githubURL, subscanURL, parachainsURL, dappURL, WSEndpoint
from chain left join asset on chain.chainID = asset.chainID and chain.asset = asset.asset where ( crawling = 1 or paraID > 0 and id is not null);`);
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
                //subscanURL: chain.subscanURL,
                subscanURL: null,
                parachainsURL: chain.parachainsURL,
                dappURL: chain.dappURL,
                WSEndpoint: chain.WSEndpoint
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
        if (Object.keys(this.skipStorageKeys).length > 0) return;
        this.skipStorageKeys = {};
        var storageKeysList = await this.poolREADONLY.query(`select palletName, storageName, storageKey from chainPalletStorage where skip = 1`);
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

        // reload xcmAsset
        await this.init_xcm_asset();

        // reload paras
        await this.init_paras();

        return true
    }

    //    |    2012 | [{"parachain":2012},{"generalKey":"0x50415241"}]                 | {"Token":"PARA"} |   2012 | polkadot   |      1 |
    //    |   21000 | [{"parachain":1000},{"palletInstance":50},{"generalIndex":1984}] | {"Token":"1984"} |   1000 | kusama     |      1 |
    /*
    xcmAssetInfo {
      chainID: 22085,
      xcmConcept: '[{"parachain":2085},{"generalKey":"0x484b4f"}]',
      asset: '{"Token":"HKO"}',
      paraID: 2085,
      relayChain: 'kusama',
      parents: 1,
      interiorType: 'x2',
      xcmInteriorKey: '[{"parachain":2085},{"generalKey":"0x484b4f"}]~kusama'
    }
    */
    async init_xcm_asset() {
        let xcmAssetRecs = await this.poolREADONLY.query("select chainID, xcmConcept, asset, paraID, relayChain, parent as parents from xcmConcept;");
        let xcmAssetInfo = {};
        let xcmInteriorInfo = {};
        let xcmSymbolInfo = {};
        for (let i = 0; i < xcmAssetRecs.length; i++) {
            let v = xcmAssetRecs[i];
            let a = {}
            // add assetChain (string)
            let nativeAssetChain = paraTool.makeAssetChain(v.asset, v.chainID)
            if (this.assetInfo[nativeAssetChain] && this.assetInfo[nativeAssetChain].decimals != undefined && this.assetInfo[nativeAssetChain].symbol != undefined) {
                let xcmInteriorKey = paraTool.makeXcmInteriorKey(v.xcmConcept, v.relayChain);
                let decimals = this.assetInfo[nativeAssetChain].decimals;
                let symbol = this.assetInfo[nativeAssetChain].symbol;
                let isUSD = this.assetInfo[nativeAssetChain].isUSD;
                a = {
                    chainID: v.chainID,
                    isUSD: isUSD,
                    xcmConcept: v.xcmConcept,
                    asset: v.asset,
                    decimals: decimals,
                    symbol: symbol,
                    paraID: v.paraID,
                    relayChain: v.relayChain,
                    parents: v.parents,
                    xcmInteriorKey: xcmInteriorKey,
                    nativeAssetChain: nativeAssetChain,
                    assetType: "Token"
                }
                if (symbol) {
                    let symbolRelayChain = paraTool.makeXcmInteriorKey(symbol.toUpperCase(), v.relayChain);
                    xcmSymbolInfo[symbolRelayChain] = a
                }
                xcmAssetInfo[xcmInteriorKey] = a; //the key has no chainID
                xcmInteriorInfo[nativeAssetChain] = a
            } else {
                //console.log(`nativeAssetChain=${nativeAssetChain} not found`)
            }
            //does not have assetPair, token0, token1, token0Symbol, token1Symbol, token0Decimals, token1Decimals
        }

        let xcmAssets = await this.poolREADONLY.query("select xcmInteriorKey, symbol, relayChain, nativeAssetChain, isUSD, decimals, parent as parents from xcmasset");
        for (let i = 0; i < xcmAssets.length; i++) {
            let v = xcmAssets[i];
            if (xcmAssetInfo[v.xcmInteriorKey] == undefined) {
                xcmAssetInfo[v.xcmInteriorKey] = v;
            }
        }
        let routerRecs = await this.poolREADONLY.query("select routerAssetChain, routerName from router");
        let routers = {};
        for (let i = 0; i < routerRecs.length; i++) {
            let v = routerRecs[i];
            if (routers[v.routerAssetChain] == undefined) {
                routers[v.routerAssetChain] = v;
            }
        }
        this.routers = routers;
        this.xcmAssetInfo = xcmAssetInfo; // key: xcmInteriorKey => a (1, ignore asset/chain)
        this.xcmInteriorInfo = xcmInteriorInfo; // key: asset~chainID  => a (N)
        this.xcmSymbolInfo = xcmSymbolInfo; // key: symbol~relayChain => a (1, ignore asset/chain)
    }

    getXcmAssetInfoDecimals(xcmInteriorKey) {
        let xcmAssetInfo = this.xcmAssetInfo[xcmInteriorKey]
        if (xcmAssetInfo != undefined) {
            return xcmAssetInfo.decimals
        }
        return null
    }
    getXcmAssetInfoSymbol(xcmInteriorKey) {
        let xcmAssetInfo = this.xcmAssetInfo[xcmInteriorKey]
        if (xcmAssetInfo != undefined) {
            return xcmAssetInfo.symbol
        }
        return false
    }

    getXcmAssetInfoByInteriorkey(xcmInteriorKey) {
        let xcmAssetInfo = this.xcmAssetInfo[xcmInteriorKey]
        //console.log(`getXcmAssetInfoByInteriorkey k=${xcmInteriorKey}`, xcmAssetInfo)
        if (xcmAssetInfo != undefined) {
            return xcmAssetInfo
        }
        return false
    }

    getXcmAssetInfoByNativeAssetChain(nativeAssetChain) {
        let xcmAssetInfo = this.xcmInteriorInfo[nativeAssetChain]
        if (xcmAssetInfo != undefined) {
            return xcmAssetInfo
        }
        return false
    }

    getXcmAssetInfoBySymbolKey(symbolRelayChain) {
        let xcmAssetInfo = this.xcmSymbolInfo[symbolRelayChain]
        if (xcmAssetInfo != undefined) {
            return xcmAssetInfo
        }
        return false
    }

    getXCMAsset(interiorStr, relayChain) {
        let xcmInteriorKey = paraTool.makeXcmInteriorKey(interiorStr, relayChain);
        let xcmAsset = this.getXcmAssetInfoByInteriorkey(xcmInteriorKey)
        if (xcmAsset && xcmAsset.nativeAssetChain != undefined) {
            //console.log(`Found ${xcmInteriorKey} -> ${xcmAsset.nativeAssetChain}`)
            return xcmAsset.nativeAssetChain
        } else {
            console.log(`getXCMAsset NOT Found/Missing ${xcmInteriorKey}`)
            return false
        }
    }

    getNativeChainAsset(chainID) {
        // TODO check
        let asset = this.getChainAsset(chainID)
        let nativeAssetChain = paraTool.makeAssetChain(asset, chainID);
        //console.log(`Convert to nativeAssetChain ${chainID} -> ${nativeAssetChain}`)
        return nativeAssetChain
    }

    async init_asset_info() {
        let assetRecs = await this.poolREADONLY.query("select assetType, asset.assetName, asset.numHolders, asset.totalSupply, asset.asset, asset.symbol, asset.xcmInteriorKey, xcmasset.symbol as xcmasset_symbol, xcmasset.relayChain as xcmasset_relayChain, asset.decimals, asset.token0, asset.token0Symbol, asset.token0Decimals, asset.token1, asset.token1Symbol, asset.token1Decimals, asset.chainID, chain.id, chain.chainName, asset.isUSD, asset.priceUSD, asset.priceUSDPercentChange,  asset.nativeAssetChain, currencyID, xcContractAddress, from_unixtime(createDT) as createTS from asset left join xcmasset on asset.xcmInteriorKey = xcmasset.xcmInteriorKey, chain where asset.chainID = chain.chainID and assetType in ('ERC20','ERC20LP','ERC721','ERC1155','Token','LiquidityPair','NFT','Loan','Special', 'CDP_Supply', 'CDP_Borrow') order by chainID, assetType, asset");

        let nassets = 0;
        let assetInfo = {};
        let currencyIDInfo = {};
        let symbolRelayChainAsset = {};
        for (let i = 0; i < assetRecs.length; i++) {
            let v = assetRecs[i];
            let a = {}
            // add assetChain (string) + parseUSDpaths (JSON array)
            let vAsset = paraTool.VSTokenToToken(v.asset)
            let assetChain = paraTool.makeAssetChain(vAsset, v.chainID);
            let priceUSDpaths = (v.priceUSDpaths) ? JSON.parse(v.priceUSDpaths.toString()) : false;
            if (v.assetType == 'LiquidityPair' || v.assetType == 'ERC20LP') { //'ERC20','ERC20LP','ERC721','ERC1155','Token','LiquidityPair','NFT','Loan','Special'
                a = {
                    assetType: v.assetType,
                    assetName: v.assetName,
                    numHolders: v.numHolders,
                    totalSupply: v.totalSupply,
                    asset: vAsset,
                    symbol: v.symbol,
                    decimals: v.decimals,
                    token0: v.token0,
                    token0Symbol: v.token0Symbol,
                    token0Decimals: v.token0Decimals,
                    token1: v.token1,
                    token1Symbol: v.token1Symbol,
                    token1Decimals: v.token1Decimals,
                    createTS: v.createTS,
                    chainID: v.chainID,
                    id: v.id,
                    chainName: v.chainName,
                    assetChain: assetChain,
                    isUSD: v.isUSD,
                    priceUSD: v.priceUSD,
                    priceUSDPercentChange: v.priceUSDPercentChange,
                    //priceUSDpaths: priceUSDpaths,
                    nativeAssetChain: v.nativeAssetChain // removable?
                }
            } else {
                //does not have assetPair, token0, token1, token0Symbol, token1Symbol, token0Decimals, token1Decimals
                a = {
                    assetType: v.assetType,
                    assetName: v.assetName,
                    numHolders: v.numHolders,
                    totalSupply: v.totalSupply,
                    asset: vAsset,
                    symbol: v.symbol,
                    decimals: v.decimals,
                    chainID: v.chainID,
                    createTS: v.createTS,
                    id: v.id,
                    chainName: v.chainName,
                    assetChain: assetChain,
                    isUSD: v.isUSD,
                    priceUSD: v.priceUSD,
                    priceUSDPercentChange: v.priceUSDPercentChange,
                    priceUSDpaths: priceUSDpaths,
                    nativeAssetChain: v.nativeAssetChain, // removable
                    isXCAsset: false
                }
                if (v.xcmInteriorKey && v.xcmInteriorKey.length > 0) {
                    a.isXCAsset = true;
                    a.xcmInteriorKey = v.xcmInteriorKey;
                    if (v.xcmasset_symbol && a.symbol != v.xcmasset_symbol) {
                        a.localSymbol = a.symbol; // when present, this could override the symbol in a UI (e.g. xcDOT)
                    }
                    a.symbol = v.xcmasset_symbol;
                    a.relayChain = v.xcmasset_relayChain
                    let symbolRelayChain = paraTool.makeAssetChain(a.symbol, a.relayChain)
                    if (symbolRelayChainAsset[symbolRelayChain] == undefined) {
                        symbolRelayChainAsset[symbolRelayChain] = {};
                    }
                    symbolRelayChainAsset[symbolRelayChain][v.chainID] = a
                } else {
                    a.relayChain = paraTool.getRelayChainByChainID(a.chainID)
                }
            }
            assetInfo[assetChain] = a;
            if (v.currencyID != null && v.currencyID.length > 0) {
                let currencyChain = paraTool.makeAssetChain(v.currencyID, v.chainID)
                currencyIDInfo[currencyChain] = a;
            }
            if (v.xcContractAddress) {
                let xcassetChain = paraTool.makeAssetChain(v.xcContractAddress, v.chainID);
                assetInfo[xcassetChain] = a;
            }
            nassets++;
        }
        this.assetInfo = assetInfo;
        this.symbolRelayChainAsset = symbolRelayChainAsset;
        //console.log(`this.assetInfo`, assetInfo)
        this.currencyIDInfo = currencyIDInfo;
    }
    validXCMSymbol(symbol, chainID, ctx, o) {
        let relayChain = paraTool.getRelayChainByChainID(chainID);
        let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
        if (this.symbolRelayChainAsset[symbolRelayChain]) {
            return true;
        }
        return false;
    }

    getChainXCMAssetBySymbol(symbol, relayChain, chainID) {
        let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
        if (this.symbolRelayChainAsset[symbolRelayChain] == undefined || this.symbolRelayChainAsset[symbolRelayChain][chainID] == undefined) {
            return (null);
        }
        return this.symbolRelayChainAsset[symbolRelayChain][chainID]
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
        let isNativeChain = (assetInfo.isNativeChain != undefined) ? assetInfo.isNativeChain : 0 // DISCUSS
        let currencyID = (assetInfo.currencyID != undefined) ? `${assetInfo.currencyID}` : 'NULL'
        let decimals = (assetInfo.decimals != undefined) ? `${assetInfo.decimals}` : 'NULL'
        await this.upsertSQL({
            "table": "asset",
            "keys": ["asset", "chainID"],
            "vals": ["assetName", "symbol", "decimals", "assetType", "isNativeChain", "currencyID"],
            "data": [`( '${asset}', '${chainID}', '${assetInfo.name}', '${assetInfo.symbol}', ${decimals}, '${assetInfo.assetType}', '${isNativeChain}', ${currencyID} )`],
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

    /*
    2000	'[{"parachain":2000},{"generalKey":"0x0001"}]'	      {"Token":"AUSD"}[2000] |	[aUSD]	[x2]
    2012	'[{"parachain":2012},{"generalKey":"0x50415241"}]'	  {"Token":"PARA"}[2012] |	[PARA]	[x2]
    */

    async addXcmAssetInfo(xcmAssetInfo, caller = false) {
        let out = [`('${xcmAssetInfo.chainID}', '${xcmAssetInfo.xcmConcept}', '${xcmAssetInfo.asset}', '${xcmAssetInfo.paraID}', '${xcmAssetInfo.relayChain}', '${xcmAssetInfo.nativeAssetChain}', '${xcmAssetInfo.source}', Now())`]
        let vals = [`paraID`, `relayChain`, `nativeAssetChain`, `source`, `lastUpdateDT`]
        await this.upsertSQL({
            "table": "xcmConcept",
            "keys": ["chainID", "xcmConcept", "asset"],
            "vals": vals,
            "data": out,
            "replace": vals
        });
        let xcmInteriorKey = xcmAssetInfo.xcmInteriorKey
        this.xcmAssetInfo[xcmInteriorKey] = xcmAssetInfo;
        if (caller) {
            console.log(`[${caller}] adding this.xcmAssetInfo[${xcmInteriorKey}]`, this.xcmAssetInfo[xcmInteriorKey])
        } else {
            console.log(`adding this.xcmAssetInfo[${xcmInteriorKey}]`, this.xcmAssetInfo[xcmInteriorKey])
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

    getAssetSymbol(asset, chainID, ctx = "false") {
        let assetChain = paraTool.makeAssetChain(asset, chainID);
        if (this.assetInfo[assetChain] != undefined) {
            return this.assetInfo[assetChain].symbol
        } else {
            //console.log("getAssetDecimal MISS", "CONTEXT", ctx, "assetString", assetString);
            return (false);
        }
    }

    getCurrencyIDDecimal(currencyID, chainID) {
        let currencyChain = paraTool.makeAssetChain(currencyID, chainID);
        if (this.currencyIDInfo[currencyChain] !== undefined) {
            let assetInfo = this.currencyIDInfo[currencyChain];
            if (assetInfo.decimals != undefined) {
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

    async get_assetlog(asset, chainID, q = null) {
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
        if (q && q.isXCAsset) {
            assetlog.assetType = "Token";
            assetlog.symbol = q.symbol;
            assetlog.isXCAsset = q.isXCAsset;
        } else {
            let assets = await this.poolREADONLY.query(`select assetName, symbol, assetType, xcmInteriorKey from asset where asset = '${asset}' and chainID = '${chainID}' limit 1`)
            if (assets.length == 0) {
                assetlog.expireTS = currentTS + 15; // short for now
                this.assetlog[assetChain] = assetlog;
                return (this.assetlog[assetChain]);
            }
            let a = assets[0];
            assetlog.assetType = a.assetType;
            assetlog.symbol = a.symbol;
            assetlog.isXCAsset = (a.xcmInteriorKey && a.xcmInteriorKey.length > 0)
        }
        let lookbackDays = 3650
        let liquidMax = 0.5 // e^.5 = 1.65
        if (assetlog.assetType == paraTool.assetTypeToken || assetlog.assetType == paraTool.assetTypeERC20) {
            let sql = assetlog.isXCAsset ? `select indexTS, routerAssetChain, priceUSD, priceUSD10, priceUSD100, priceUSD1000, liquid, CONVERT(verificationPath using utf8) as path from xcmassetpricelog where symbol = '${q.symbol}' and relayChain = '${q.relayChain}' and liquid < '${liquidMax}' order by indexTS;` : `select indexTS, routerAssetChain, priceUSD, priceUSD10, priceUSD100, priceUSD1000, liquid, CONVERT(verificationPath using utf8) as path from assetpricelog where asset = '${q.asset}' and chainID = '${q.chainID}' and liquid < '${liquidMax}' order by indexTS;`
            let recs = await this.poolREADONLY.query(sql);

            assetlog.prices = [];

            // organize them by indexTS =>
            let indexTS = {};
            for (let i = 0; i < recs.length; i++) {
                let a = recs[i];
                if (indexTS[a.indexTS] == undefined) {
                    indexTS[a.indexTS] = []
                }
                let liquid = (a.priceUSD1000 && a.priceUSD1000 > a.priceUSD) ? Math.log(a.priceUSD1000) - Math.log(a.priceUSD) : 0
                // p10: parseFloat(a.priceUSD10), p100: parseFloat(a.priceUSD100), p1000: parseFloat(a.price1000),
                indexTS[a.indexTS].push({
                    p: parseFloat(a.priceUSD),
                    s: a.routerAssetChain,
                    path: a.path,
                    liquid
                })
            }
            for (const t of Object.keys(indexTS)) {
                assetlog.prices.push({
                    ts: t,
                    r: indexTS[t]
                });
            }
            assetlog.prices.sort(function(a, b) {
                return a.ts - b.ts;
            })
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

        if (assetlog.assetType == "LiquidityPair" || assetlog.assetType == "ERC20LP") {
            let sql = `select assetlog.indexTS, assetlog.issuance, assetlog.lp0, assetlog.lp1, assetlog.close, asset.numHolders
          from assetlog, asset
          where assetlog.asset = asset.asset and assetlog.chainID = asset.chainID and
            indexTS > UNIX_TIMESTAMP(DATE_SUB(Now(), interval 180 DAY)) and
            asset.assetType in ('LiquidityPair', 'ERC20LP') and
            asset.asset = '${assetlog.asset}' and asset.chainID = '${assetlog.chainID}'
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
            let p = await this.computePriceUSD({
                val,
                asset: chainAsset,
                chainID,
                ts: cTimestamp
            });
            if (p) {
                c[`${fld}USD`] = p.valUSD;
                c.priceUSD = p.priceUSD;
                c.priceUSDCurrent = p.priceUSDCurrent;
            }
        }
        return c
    }

    async getTokenPriceUSD(asset, chainID, ts = null) {
        return await this.computePriceUSD({
            asset,
            chainID,
            ts
        })
    }
    // given multiple source, choose that with the highest liquidity
    map_result_priceusd_path(result) {
        if (result.length == 0) return null;
        if (result.length == 1) return result[0];
        result.sort(function(a, b) {
            return a.liquid - b.liquid
        })
        return result[0];
    }

    /*
    computePriceUSD (refactor in progress) is a key workhorse used in the indexer / query classes to support historical analysis
    (with binary search from routers/dexs/oracles/coingecko) but also fast look up of the latest prices using assetInfo loaded up

    Input: `query` can be a string but will generally be an object
    * asset, chainID OR symbol, relayChain OR assetChain OR xcmInteriorKey
    * val [optional, default : 1.0]
    * ts [optional, default : current unix timestamp] -- can also take an array (e.g. 90 days), which will support much faster price charting in the future
    * raw -- if true, the val should be divided by the known decimals (returned)

    Output: null if the asset is not , or an object with:
    * valUSD, if val is supplied
    * priceUSD as single value or array, if ts supplied
    * assetInfo from this.assetInfo OR this.xcm{...} which will have
      - priceUSDCurrent, priceUSDPercentChange ALWAYS kept up to date
        - if the chainID context is known, always pick the DEX router with the highest liquidity from that specific chain IF it is liquid and one exists, then pick the coingecko data if available
        - if the chainID context is not known, pick the CEX if available
      - the chainID context will be : (a) the chainID if in the actual input, otherwise (b) specified in query  as requestingChainID -- so astarscan.io would have 2006, moonbeam.polkaholic.io 2004 etc.
      - priceUSDCurrentRouterAssetChain, priceUSDCurrentPath -- to support verifiability, whatever data is provided in priceUSDCurrent will always have these fields
      - NEW: priceRouters array showing the precise verifiable path for EVM and non-EVM chains ( parachain~2000, 0x700. ~ 2004 , website~coingecko )
         routerAssetChain, priceUSD1, priceUSD10, ... priceUSD1000, path and some liquidity measure (is there a standard for this?)
      - LATER: priceOracles array showing the precise verifiable call for EVM and non-EVM chains
      - isXCAsset
      - isUSD
      - xcContractAddress
      - assetType
      - asset, chainID, if xcAsset=false OR symbol, relayChain, xcmInteriorKey, if xcAsset=true
      ... token0, token1, isRouter etc.
      - decimals
    */
    async computePriceUSD(queryRaw) {
        let val = queryRaw.val ? queryRaw.val : 1.0;
        let ts = queryRaw.ts ? queryRaw.ts : null;
        let tsInt = parseInt(ts, 10);
        var compare = function(a, b) {
            return (a - b.ts);
        }
        let q = queryRaw;

        let assetInfo = null;
        if (typeof queryRaw == "string") {
            if (q.substring(0, 2) == "0x") q = q.toLowerCase();
            let [asset, chainID] = paraTool.parseAssetChain(q)
            q = {
                assetChain: queryRaw,
                asset,
                chainID
            }
            assetInfo = this.assetInfo[queryRaw];
        } else if (q.assetChain != undefined) {
            let [asset, chainID] = paraTool.parseAssetChain(q.assetChain);
            q.asset = asset;
            q.chainID = chainID;
            if (q.asset.substring(0, 2) == "0x") q.asset = q.asset.toLowerCase();
            assetInfo = this.assetInfo[q.assetChain];
        } else if (q.asset != undefined && q.chainID != undefined) {
            if (q.asset.substring(0, 2) == "0x") q.asset = q.asset.toLowerCase();
            q.assetChain = paraTool.makeAssetChain(q.asset, q.chainID);
            assetInfo = this.assetInfo[q.assetChain];
        } else if (q.xcmInteriorKey != undefined) {
            assetInfo = this.xcmAssetInfo[q.xcmInteriorKey]
            if (assetInfo) q.isXCAsset = true;
        } else if (q.symbol != undefined && q.relayChain != undefined) {
            let symbolRelayChain = paraTool.makeAssetChain(q.symbol, q.relayChain);
            assetInfo = this.xcmSymbolInfo[symbolRelayChain];
            if (assetInfo) q.isXCAsset = true;
        }
        let res = {}
        if (assetInfo) {
            q.symbol = assetInfo.symbol
            if (assetInfo.relayChain) {
                q.relayChain = assetInfo.relayChain
            }
            q.decimals = assetInfo.decimals
            q.currentPriceUSD = assetInfo.priceUSD
            if (assetInfo.xcmInteriorKey) {
                q.xcmInteriorKey = assetInfo.xcmInteriorKey
            }
            if (assetInfo.isXCAsset) q.isXCAsset = true;
            if (ts == null) {
                ts = this.getCurrentTS();
            }
            res.assetInfo = assetInfo
            res.priceUSDCurrent = assetInfo.priceUSD;
        } else {
            return null;
        }
        // see if we can find price via direct lookup
        if (assetInfo.isUSD > 0) {
            res.priceUSD = 1;
            res.priceUSDCurrent = 1;
            if (q.val) res.valUSD = q.val;
            return res;
        }

        // console.log("computePriceUSD", q, "assetInfo", assetInfo);
        let priceUSDCurrent = assetInfo.priceUSD;
        let currentTS = this.getCurrentTS();
        switch (assetInfo.assetType) {
            case paraTool.assetTypeERC20:
            case paraTool.assetTypeToken:
                let assetlog = q.isXCAsset ? await this.get_assetlog(q.symbol, q.relayChain, q) : await this.get_assetlog(q.asset, q.chainID, q);
                if ((assetlog !== undefined) && (assetlog.prices !== undefined)) {
                    let result = this.binarySearch(assetlog.prices, ts, compare);
                    if (result) {
                        res.r = result.r; // too much info ... only set if requested?
                        let bestRouterAssetChainResult = this.map_result_priceusd_path(result.r);
                        //console.log("RESULT", result, "best", bestRouterAssetChainResult);
                        res.priceUSD = bestRouterAssetChainResult.p;
                        if (q.val) res.valUSD = q.val * res.priceUSD;
                        return res;
                    }
                } else {
                    console.log("FAILURE ASSETTYPE TOKEN", q);
                }
                return null;
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
                let dexRec = await this.getDexRec(q.asset, q.chainID, ts);
                if (dexRec == undefined) {
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`${assetInfo.assetType} no assetpair info returned assetChain=${assetChain}`);
                    return [false, false, false];
                }
                let priceUSD0 = await this.getTokenPriceUSD(assetInfo.token0, q.chainID, ts);
                let priceUSD1 = await this.getTokenPriceUSD(assetInfo.token1, q.chainID, ts);
                let priceUSD0Current = await this.getTokenPriceUSD(assetInfo.token0, q.chainID);
                let priceUSD1Current = await this.getTokenPriceUSD(assetInfo.token1, q.chainID);
                let issuance = dexRec.issuance;
                let x0 = dexRec.lp0 / issuance;
                let x1 = dexRec.lp1 / issuance;
                res.priceUSD = x0 * priceUSD0 + x1 * priceUSD1;
                res.priceUSDCurrent = x0 * priceUSD0Current + x1 * priceUSD1Current;
                if (q.val) res.valUSD = q.val * res.priceUSD
                return res
            }
            break;
            case paraTool.assetTypeLiquidityPair: {
                let dexRec = await this.getDexRec(q.asset, q.chainID, ts);
                if (!dexRec) {
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`${assetInfo.assetType} no assetpair info returned`, q);
                    return null
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

                let priceUSD0Current = await this.getTokenPriceUSD(assetInfo.token0, chainID);
                let priceUSD1Current = await this.getTokenPriceUSD(assetInfo.token1, chainID);
                let issuance = dexRec.issuance;
                let x0 = dexRec.lp0 / issuance;
                let x1 = dexRec.lp1 / issuance;
                let priceUSD = x0 * priceUSD0 + x1 * priceUSD1;
                let priceUSDCurrent = x0 * priceUSD0Current + x1 * priceUSD1Current;
                if (q.val) res.valUSD = q.val * priceUSD
                return res
            }
            break;
            case paraTool.assetTypeLoan: {
                let parsedAsset = JSON.parse(q.asset);
                if (parsedAsset.Loan !== undefined) {
                    let loanedAsset = JSON.stringify(parsedAsset.Loan);
                    res.priceUSD = await this.getTokenPriceUSD(loanedAsset, q.chainID, ts); //this is actually collateral..
                    res.priceUSDCurrent = await this.getTokenPriceUSD(loanedAsset, q.chainID); //this is actually collateral..
                    if (q.val) res.valUSD = q.val * res.priceUSD
                    return res
                }
            }
            break;
            case paraTool.assetTypeCDPSupply: {
                let parsedAsset = JSON.parse(q.asset);
                if (parsedAsset.CDP_Supply !== undefined) {
                    let suppliedAsset = JSON.stringify(parsedAsset.CDP_Supply);
                    return await this.computePriceUSD({
                        val,
                        asset: suppliedAsset,
                        chainID: q.chainID,
                        ts
                    });
                }
            }
            break;
            case paraTool.assetTypeCDPBorrow: {
                let parsedAsset = JSON.parse(q.asset);
                if (parsedAsset.CDP_Borrow !== undefined) {
                    let borrowedAsset = JSON.stringify(parsedAsset.CDP_Borrow);
                    return await this.computePriceUSD({
                        val,
                        asset: borrowedAsset,
                        chainID: q.chainID,
                        ts
                    });
                }
            }
            break;
            default: {
                if (this.debugLevel >= paraTool.debugInfo) console.log("not implemented:", assetInfo.assetType);
            }
            break;
        }
        return null;
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

    getStandardizedXCMAssetInfo(chainID, asset, rawAsset) {
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let targetChainID = chainID // the chainIDDest to use for price lookup
        let targetAsset = rawAsset // the asset to use for price lookup
        let defaultAsset = asset // the "default" asset (human readable?)
        let standardizedXCMInfo = false
        let isXcmAssetFound = false
        let decimals = false
        let symbol = null
        let xcmInteriorKey = false

        let rawassetChain = paraTool.makeAssetChain(targetAsset, targetChainID);
        //console.log(`getStandardizedXCMAssetInfo targetChainID=${targetChainID}, asset=${asset}, rawAsset=${rawAsset} rawassetChain=${rawassetChain} start`)
        if (this.assetInfo[rawassetChain] && this.assetInfo[rawassetChain].decimals != undefined && this.assetInfo[rawassetChain].symbol != undefined) {
            //console.log(`rawassetChain=${rawassetChain} here 1`)
            decimals = this.assetInfo[rawassetChain].decimals;
            symbol = this.assetInfo[rawassetChain].symbol;
            if (symbol) {
                let symbolRelayChain = paraTool.makeAssetChain(symbol, relayChain);
                let xcmAssetInfo = this.getXcmAssetInfoBySymbolKey(symbolRelayChain);
                if (xcmAssetInfo) {
                    return [true, xcmAssetInfo];
                } else {
                    console.log(`xcmSymbolKey ${symbolRelayChain} not found`)
                }
            } else {
                console.log(`symbol not found targetChainID=${targetChainID}, asset=${asset}, rawAsset=${rawAsset}`)
            }
        }
        return [false, null];
    }

    async updateXCMTransfer(lookback = 720) {

        let xcmtransfers = await this.poolREADONLY.query(`select extrinsicHash, transferIndex, extrinsicID, sourceTS, asset, rawAsset, nativeAssetChain, chainID, chainIDDest, amountSent, amountReceived from xcmtransfer where sourceTS > UNIX_TIMESTAMP(date_sub(Now(), interval ${lookback} day)) and ( amountSentUSD = 0 or amountReceived = 0 ) and incomplete = 0 order by sourceTS desc limit 1000000`);
        //console.log(`xcm sql`, xcmtransfers)
        let out = [];
        for (const xcm of xcmtransfers) {
            let p = await this.computePriceUSD({
                xcmInteriorKey: xcm.xcmInteriorKey,
                ts: xcm.sourceTS
            });
            if (p) {
                let priceUSD = p.priceUSD;
                xcm.amountSent = parseFloat(xcm.amountSent) / 10 ** decimals;
                xcm.amountReceived = parseFloat(xcm.amountReceived) / 10 ** decimals;
                let amountSentUSD = (xcm.amountSent > 0) ? priceUSD * xcm.amountSent : 0;
                let amountReceivedUSD = (xcm.amountReceived > 0) ? priceUSD * xcm.amountReceived : 0;
                console.log(xcm.asset, xcm.rawAsset, xcm.chainID, xcm.chainIDDest, decimals, priceUSD, xcm.amountSent, amountSentUSD, xcm.amountReceived, amountReceivedUSD);
                let sql = `update xcmtransfer set amountSentUSD = '${amountSentUSD}', amountReceivedUSD = '${amountReceivedUSD}', priceUSD='${priceUSD}' where extrinsicHash = '${xcm.extrinsicHash}' and transferIndex = '${xcm.transferIndex}'`
                this.batchedSQL.push(sql);
                await this.update_batchedSQL();
            }
            console.log(`XCM Asset Not found chainID=${chainID}, asset=${asset}, rawAsset=${rawAsset}`)
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

                let p = await this.computePriceUSD({
                    val,
                    asset: targetAsset,
                    chainID: chainID,
                    ts
                });
                if (p) {
                    let rate = p.priceUSD;
                    state[fld + "USD"] = p.valUSD;
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
                            totalUSDVal += p.valUSD
                        }
                    } else {
                        totalUSDVal += p.valUSD
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
            args[fld + "_symbol"] = symbol
            if (decorateUSD) {
                let p = await this.computePriceUSD({
                    val,
                    asset: targetAsset,
                    chainID: chainID,
                    ts
                });
                if (p) {
                    args[fld + "_USD"] = p.valUSD
                    args[fld + "_priceUSD"] = p.priceUSD
                    args[fld + "_priceUSDCurrent"] = p.priceUSDCurrent
                }
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

        args[fld + "_symbol"] = symbol
        if (decorateUSD) {
            let p = await this.computePriceUSD({
                val,
                asset: targetAsset,
                chainID,
                ts
            });
            if (p) {
                args[fld + "_USD"] = p.valUSD
                args[fld + "_priceUSD"] = p.priceUSD
                args[fld + "_priceUSDCurrent"] = p.priceUSDCurrent
            }
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