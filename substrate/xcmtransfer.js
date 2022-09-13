const {
    Keyring
} = require("@polkadot/api");
const fs = require('fs');
const AssetManager = require('./assetManager');
const paraTool = require('./paraTool');
const ethTool = require('./ethTool');
const {
    stringToU8a,
    u8aToHex
} = require('@polkadot/util');
const mysql = require("mysql2");

module.exports = class XCMTransfer extends AssetManager {
    pair = null;
    evmpair = null

    setupPair(FN = "/root/.wallet", name = "polkadot") {
        const privateSeed = fs.readFileSync(FN, 'utf8');
        var keyring = new Keyring({
            type: 'sr25519'
        });
        this.pair = keyring.addFromUri(privateSeed, {
            name: name
        })
    }

    setupEvmPair(FN = "/root/.walletevm2", name = "evm") {
        var pk = fs.readFileSync(FN, 'utf8');
        pk = pk.replace(/\r|\n/g, '');
        this.evmpair = ethTool.loadWallet(pk)
    }

    parse_xcmInteriorKey(xcmInteriorKeyRelayChain, symbol) {
        let [xcmInteriorKey, relayChain] = paraTool.parseAssetChain(xcmInteriorKeyRelayChain);
        let xcm = {
            relayChain,
            symbol
        };
        console.log("parse_xcmInteriorKey", xcmInteriorKeyRelayChain, "XCM", xcm)

        if (xcmInteriorKey == "here") {
            xcm.here = true;
            return (xcm);
        }
        let x = JSON.parse(xcmInteriorKey);
        if (Array.isArray(x)) {
            for (let i = 0; i < x.length; i++) {
                let p = x[i];
                this.parse_xcm_piece(xcm, x[i]);
            }
        } else {
            this.parse_xcm_piece(xcm, x);
        }
        return (xcm);
    }

    parse_xcm_piece(xcm, x) {
        let features = ["parachain", "generalKey", "palletInstance", "generalIndex"]
        for (let i = 0; i < features.length; i++) {
            if (x[features[i]] != undefined) {
                xcm[features[i]] = x[features[i]];
            }
        }
    }

    async lookupSymbolXCMInteriorKey(symbol, relayChain) {
        let sql = `select xcmInteriorKey from xcmasset where symbol = '${symbol}' and relayChain = '${relayChain}' limit 1`
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) {
            console.log("could not find", symbol, relayChain);
            // throw error
            return null;
        }
        return recs[0].xcmInteriorKey;
    }

    async lookupChainAsset(chainID, xcmInteriorKey) {
        let sql = `select asset, currencyID, chainID, decimals from asset where xcmInteriorKey = ${mysql.escape(xcmInteriorKey)} and chainID = '${chainID}' limit 1`
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) {
            // throw error
            console.log("lookupChainAsset FAILURE", sql);
            return null;
        }
        let r = recs[0];
        r.paraID = paraTool.getParaIDfromChainID(chainID);
        return r;
    }

    async lookup_sectionMethod(chainID, chainIDDest, xcmInteriorKey) {
        let sql = `select sectionMethod, count(*) cnt from xcmtransfer where chainID = '${chainID}' and chainIDDest = '${chainIDDest}' and xcmInteriorKey = '${xcmInteriorKey}' and sourceTS > unix_timestamp(date_sub(Now(), interval 30 day)) group by sectionMethod order by count(*) desc limit 1`
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) {
            // throw error
            console.log(sql, "BLANK");
            return [null, null];
        }
        let r = recs[0];
        // TEMPORARY
        if (r.sectionMethod == "xTokens:TransferredMultiAssets") {
            r.sectionMethod = "xTokens:transfer";
        }
        return [r.sectionMethod, "v2"];
    }

    async assets_withdraw(version, asset, assetDest, xcm, amount, beneficiary) {
        return [null, null];
    }

    get_beneficiary(beneficiary) {
        if (beneficiary.length == 42) {
            return {
                "accountKey20": {
                    "network": {
                        "any": null
                    },
                    "key": beneficiary
                }
            }
        } else {
            return {
                "accountId32": {
                    "network": {
                        "any": null
                    },
                    "id": beneficiary
                }
            }
        }
    }

    transform_asset(assetRec, assetDestRec, xcm) {
        let asset = assetRec.asset;
        let parsedAsset = JSON.parse(asset);
        let chainID = assetRec.chainID;
        if (assetRec.currencyID !== undefined && assetRec.currencyID != xcm.symbol) {
            return assetRec.currencyID;
        } else {
            if (parsedAsset.Token) {
                parsedAsset.token = parsedAsset.Token
                delete parsedAsset.Token
            }
            if (parsedAsset.ForeignAsset) {
                parsedAsset.foreignAsset = parsedAsset.ForeignAsset
                delete parsedAsset.ForeignAsset
            }
            // "native" HACKS
            if (assetRec.chainID == 22001 && parsedAsset.token == "BNC") {
                return {
                    "native": parsedAsset.token
                }
            }
            if (assetRec.chainID == 22088 && parsedAsset.token == "AIR") {
                return {
                    "native": null
                }
            }
            return parsedAsset;
        }
    }

    async xTokens_transfer(version, asset, assetDest, xcm, amount, beneficiary, dest_weight = 5000000000) {
        console.log("asset", asset);
        console.log("xcm", xcm);
        let currency_id = this.transform_asset(asset, assetDest, xcm); // transform "Token" to "token"
        console.log("currency_id", currency_id);
        let amountRaw = amount * 10 ** assetDest.decimals;
        if (assetDest.paraID == undefined) {
            console.log("xTokens_transfer TERMINATED", assetDest);
            process.exit(1);
        }

        let dest = (assetDest.paraID > 2) ? {
            "v1": {
                "parents": 1,
                "interior": {
                    "x2": [{
                            "parachain": assetDest.paraID
                        },
                        this.get_beneficiary(beneficiary)
                    ]
                }
            }
        } : {
            "v1": {
                "parents": 1,
                "interior": {
                    "x1": [
                        this.get_beneficiary(beneficiary)
                    ]
                }
            }
        };
        if (this.api.tx.xTokens) {
            return [this.api.tx.xTokens.transfer, [currency_id, amountRaw, dest, dest_weight]];
        }
        return [null, null]
    }

    get_asset_concrete(xcm, asset, assetDest, version) {
        if (xcm.here) {
            return {
                "parents": 0,
                "interior": {
                    "here": null
                }
            }
        } else if (xcm.parachain) {
            /*
    //KSM  here~kusama
    //DOT  here~polkadot
    //ASTR {"parachain":2006}~polkadot
    //ACA  [{"parachain":2000},{"generalKey":"0x0000"}]~polkadot
    //AUSD [{"parachain":2000},{"generalKey":"0x0001"}]~polkadot
    //BNC  [{"parachain":2001},{"generalKey":"0x0001"}]~kusama
    //BSX  [{"parachain":2090},{"generalIndex":0}]~kusama
    //GLMR [{"parachain":2004},{"palletInstance":10}]~polkadot
    //HKO  [{"parachain":2085},{"generalKey":"0x484b4f"}]~kusama
    */
            if (xcm.generalIndex) {
                return {
                    "parents": 0,
                    "interior": {
                        "x2": [{
                                palletInstance: xcm.palletInstance
                            },
                            {
                                generalIndex: xcm.generalIndex
                            }
                        ]
                    }
                }
            }
            return {
                "parents": 1,
                "interior": {
                    "parachain": xcm.parachain
                }
            }
        } else {
            console.log("get_asset_concrete MISSING", xcm);
        }
    }

    async xTransfer_transfer(version, asset, assetDest, xcm, amount, beneficiary, dest_weight = 5000000000) {
        let amountRaw = amount * 10 ** assetDest.decimals;
        let assets = {
            id: {
                "concrete": this.get_asset_concrete(xcm, asset, assetDest)
            },
            fun: {
                fungible: amountRaw
            }
        }

        let dest = {
            "parents": 1,
            "interior": {
                "x2": [{
                        parachain: assetDest.paraID
                    },
                    this.get_beneficiary(beneficiary)
                ]
            }
        }

        if (this.api.tx.xTransfer) {
            return [this.api.tx.xTransfer.transfer, [assets, dest, dest_weight]];
        }
        return [null, null];
    }

    async polkadotXcm_reserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiaryAccount, dest_weight = 5000000000) {
        let amountRaw = amount * 10 ** assetDest.decimals;
        if (assetDest.paraID == undefined) {
            console.log("polkadotXcm_reserveTransferAssets TERMINATED", assetDest);
            process.exit(1);
        }

        let dest = {
            "parents": 1,
            "interior": {
                "x2": [{
                        parachain: assetDest.paraID
                    },
                    this.get_beneficiary(beneficiaryAccount)
                ]
            }
        }
        let assets = {
            id: {
                "concrete": this.get_asset_concrete(xcm, asset, assetDest, version)
            },
            fun: {
                fungible: amountRaw
            }
        }

        return [this.api.tx.polkadotXcm.reserveTransferAssets, [amountRaw, assets, beneficiaryAccount, dest_weight]];
    }

    async polkadotXcm_limitedTeleportAssets(version, asset, assetDest, xcm, amount, beneficiary) {
        return [null, null];
    }
    async polkadotXcm_reserveWithdrawAssets(version, asset, assetDest, xcm, amount, beneficiary) {
        // TODO
        return [null, null];
    }
    async polkadotXcm_teleportAssets(version, asset, assetDest, xcm, amount, beneficiary) {
        // TODO
        return [null, null];
    }

    async polkadotXcm_limitedReserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiary, fee_asset_item = 0, weightLimit = 0) {
        let amountRaw = amount * 10 ** assetDest.decimals;
        if (assetDest.paraID == undefined) {
            console.log("polkadotXcm_limitedReserveTransferAssets TERMINATED", assetDest);
            process.exit(1);
        }
        if (version == "v0") {
            let dest = {
                "v0": {
                    "x2": [{
                            parent: null
                        },
                        {
                            "parachain": assetDest.paraID
                        }
                    ]
                }
            }
            let beneficiaries = {
                v0: {
                    x1: this.get_beneficiary(beneficiary)
                }
            }
            let assets = {
                v0: [{
                    concreteFungible: {
                        amount: amountRaw
                    }
                }]
            };
            let weight_limit = {
                unlimited: null
            }
            if (weightLimit == 0) {
                weight_limit = {
                    limited: weightLimit
                }
            }
            return [this.api.tx.polkadotXcm.limitedReserveTransferAssets, [dest, beneficiaries, assets, fee_asset_item, weight_limit]];
        } else {
            let dest = {
                "v1": {
                    "parents": 1,
                    "interior": {
                        "x1": {
                            parachain: assetDest.paraID
                        }
                    }
                }
            }
            let beneficiaries = {
                "v1": {
                    "parents": 0,
                    "interior": {
                        "x1": this.get_beneficiary(beneficiary, version)
                    }
                }
            }
            let assets = {
                v1: [{
                    "id": {
                        "concrete": this.get_asset_concrete(xcm, asset, assetDest, version)
                    },
                    "fun": {
                        "fungible": amountRaw
                    }
                }]
            };
            return [this.api.tx.polkadotXcm.limitedReserveTransferAssets, [dest, beneficiaries, assets, fee_asset_item]];
        }
    }

    async xcmPallet_limitedTeleportAssets(version, asset, assetDest, xcm, amount, beneficiary) {
        // rare
        return [null, null];
    }
    async xcmPallet_reserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiary, fee_asset_item = 0) {
        if (assetDest.paraID == undefined) {
            console.log("xcmPallet_reserveTransferAssets TERMINATED", assetDest);
        }
        if (version == "v0") {
            let dest = {
                "v0": {
                    "x1": [{
                        "parachain": assetDest.paraID
                    }]
                }
            }
            let beneficiaries = {
                v0: {
                    x1: this.get_beneficiary(beneficiary)
                }
            }
            let amountRaw = amount * 10 ** assetDest.decimals;
            let assets = {
                v0: [{
                    concreteFungible: {
                        id: {
                            "null": null
                        },
                        amount: amountRaw
                    }
                }]
            };
            return [this.api.tx.xcmPallet.reserveTransferAssets, [dest, beneficiaries, assets, fee_asset_item]];
        } else {
            let dest = {
                "v1": {
                    "parents": 0,
                    "interior": {
                        "x1": {
                            "parachain": assetDest.paraID
                        }
                    }
                }
            }
            let beneficiaries = {
                "v1": {
                    "parents": 0,
                    "interior": {
                        "x1": this.get_beneficiary(beneficiary, version)
                    }
                }
            }
            let amountRaw = amount * 10 ** assetDest.decimals;
            let assets = {
                "v1": [{
                    "id": {
                        "concrete": this.get_asset_concrete(xcm, asset, assetDest, version)
                    },
                    "fun": {
                        "fungible": amountRaw
                    }
                }]
            };
            return [this.api.tx.xcmPallet.reserveTransferAssets, [dest, beneficiaries, assets, fee_asset_item]];
        }
    }

    async xcmPallet_teleportAssets(version, asset, assetDest, xcm, amount, beneficiary) {
        return [null, null];
    }

    async xcmPallet_limitedReserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiaryAccount, fee_asset_item = 0, weightLimit = 1000000000) {
        // TODO: paraID vs here
        let dest = {
            "v1": {
                "parents": 0,
                "interior": {
                    "x1": {
                        "parachain": assetDest.paraID
                    }
                }
            }
        };
        let beneficiary = {
            v1: {
                parents: 0,
                interior: {
                    x1: this.get_beneficiary(beneficiaryAccount)
                }
            }
        };
        let amountRaw = amount * 10 ** assetDest.decimals;
        let assets = {
            v0: [{
                concreteFungible: {
                    amount: amountRaw
                }
            }]
        };
        let weight_limit = {
            limited: weightLimit
        }
        return [this.api.tx.xcmPallet.limitedReserveTransferAssets, [dest, beneficiary, assets, fee_asset_item, weight_limit]];
    }

    async getTestcasesAutomated(limit = 10) {
        let sql = `select xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM as isBeneficiaryEVM, 0 as isSenderEVM, count(*) cnt from xcmtransfer join xcmasset on
        xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey, chain where
        sourceTS > unix_timestamp(date_sub(Now(), interval 30 day)) and
        chain.chainID = xcmtransfer.chainIDDest and xcmtransfer.chainID >= 0 and
        xcmtransfer.chainIDDest >= 0 and incomplete = 0 and length(xcmtransfer.xcmInteriorKey) > 4 and
        xcmtransfer.sectionMethod not in ( 'xTokens:TransferredMultiAssets', 'xTransfer:transfer' )
        group by xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM
        having count(*) > 10 order by count(*) desc limit ${limit}`
        let testcases = await this.poolREADONLY.query(sql);
        let autoTestcases = []
        for (const testcase of testcases) {
            if (testcase.chainID == paraTool.chainIDMoonriver || testcase.chainID == paraTool.chainIDMoonbeam) {
                testcase.isSenderEVM = 1
            }
            autoTestcases.push(testcase)
        }
        console.log("TESTCASES", autoTestcases.length);
        return autoTestcases;
    }

    async getTestcasesAutomatedEVM(limit = 10) {
        let sql = `select xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM as isBeneficiaryEVM, 0 as isSenderEVM, count(*) cnt from xcmtransfer join xcmasset on
        xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey, chain where
        xcmtransfer.chainID in (${paraTool.chainIDMoonriver}, ${paraTool.chainIDMoonbeam}) and
        sourceTS > unix_timestamp(date_sub(Now(), interval 30 day)) and
        chain.chainID = xcmtransfer.chainIDDest and xcmtransfer.chainID >= 0 and
        xcmtransfer.chainIDDest >= 0 and incomplete = 0 and length(xcmtransfer.xcmInteriorKey) > 4 and
        xcmtransfer.sectionMethod not in ('xTransfer:transfer' )
        group by xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM
        having count(*) > 10 order by count(*) desc limit ${limit}`
        let testcases = await this.poolREADONLY.query(sql);
        let autoTestcases = []
        for (const testcase of testcases) {
            if (testcase.chainID == paraTool.chainIDMoonriver || testcase.chainID == paraTool.chainIDMoonbeam) {
                testcase.isSenderEVM = 1
            }
            autoTestcases.push(testcase)
        }
        console.log("TESTCASES", autoTestcases.length);
        return autoTestcases;
    }

    async getTestcasesManualEVM() {
        return [
            /*
            {
                chainID: 22023,
                chainIDDest: 2,
                symbol: 'KSM',
                isBeneficiaryEVM: 0,
                isSenderEVM: 1,
                cnt: 100
            },
            */
            {
                chainID: 22023, //0xb9f813ff
                chainIDDest: 22007,
                symbol: 'MOVR',
                isBeneficiaryEVM: 0,
                isSenderEVM: 1,
                cnt: 64
            },
            {
                chainID: 2004,
                chainIDDest: 2000,
                symbol: 'ACA',
                isBeneficiaryEVM: 0,
                isSenderEVM: 1,
                cnt: 64
            }
        ]
    }

    async getTestcasesManual() {
        return [{
                chainID: 2,
                chainIDDest: 21000,
                symbol: 'KSM',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 100
            },
            {
                chainID: 2006,
                chainIDDest: 2000,
                symbol: 'ACA',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 64
            },
            {
                chainID: 2006,
                chainIDDest: 2000,
                symbol: 'AUSD',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 47
            },
            {
                chainID: 2000,
                chainIDDest: 2006,
                symbol: 'AUSD',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 45
            },
            {
                chainID: 2,
                chainIDDest: 22024,
                symbol: 'KSM',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 20
            },
            {
                chainID: 0,
                chainIDDest: 1000,
                symbol: 'DOT',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 16
            },
            {
                chainID: 21000,
                chainIDDest: 22000,
                symbol: 'USDT',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 12
            },
            {
                chainID: 21000,
                chainIDDest: 22001,
                symbol: 'RMRK',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 12
            }
        ]
    }


    async xcmtransfer(chainID, chainIDDest, symbol, amount, beneficiary) {
        let chain = await this.getChain(chainID)
        await this.setupAPI(chain)
        this.setupPair();
        this.setupEvmPair();
        let relayChain = (chainID != 2 && chainID < 20000) ? "polkadot" : "kusama";
        let isEVMTx = 0
        try {
            let xcmInteriorKey = await this.lookupSymbolXCMInteriorKey(symbol, relayChain);
            let asset = await this.lookupChainAsset(chainID, xcmInteriorKey);
            let assetDest = await this.lookupChainAsset(chainIDDest, xcmInteriorKey);
            let [sectionMethod, version] = await this.lookup_sectionMethod(chainID, chainIDDest, xcmInteriorKey);
            let xcm = this.parse_xcmInteriorKey(xcmInteriorKey, symbol);
            let func = null,
                args = null;
            if (assetDest == undefined || assetDest.decimals == undefined) {
                console.log("no decimals for assetDest", assetDest, "xcmInteriorKey", xcmInteriorKey, "chainIDDest", chainIDDest);
                return ([null, null, null]);
            }
            console.log("sectionMethod DISPATCH", sectionMethod);
            if ((chainID == 2 || chainID == 21000) && chainIDDest == 22000) version = "v0";

            if (chainID == paraTool.chainIDMoonbeam || chainID == paraTool.chainIDMoonriver || chainID == paraTool.chainIDMoonbase) {
                // mark isEVMTx as true
                isEVMTx = 1
            }

            switch (sectionMethod) {
                case "assets_withdraw:0x019054d0":
                    [func, args] = await this.assets_withdraw(version, asset, assetDest, xcm, amount, beneficiary);
                    isEVMTx = 1
                    break;
                case "polkadotXcm:limitedReserveTransferAssets":
                    [func, args] = await this.polkadotXcm_limitedReserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "polkadotXcm:limitedTeleportAssets":
                    [func, args] = await this.polkadotXcm_limitedTeleportAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "polkadotXcm:reserveTransferAssets":
                    [func, args] = await this.polkadotXcm_reserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "polkadotXcm:reserveWithdrawAssets":
                    [func, args] = await this.polkadotXcm_reserveWithdrawAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "polkadotXcm:teleportAssets":
                    [func, args] = await this.polkadotXcm_teleportAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "xcmPallet:limitedReserveTransferAssets":
                    [func, args] = await this.xcmPallet_limitedReserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "xcmPallet:limitedTeleportAssets":
                    [func, args] = await this.xcmPallet_limitedTeleportAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "xcmPallet:reserveTransferAssets":
                    [func, args] = await this.xcmPallet_reserveTransferAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "xcmPallet:teleportAssets":
                    [func, args] = await this.xcmPallet_teleportAssets(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "xTokens:transfer":
                    [func, args] = await this.xTokens_transfer(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "xTokens:transferMulticurrencies":
                    [func, args] = await this.xTokens_transferMulticurrencies(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
                case "xTransfer:transfer":
                    [func, args] = await this.xTransfer_transfer(version, asset, assetDest, xcm, amount, beneficiary);
                    break;
            }
            return [sectionMethod, func, JSON.stringify(args, null, 4), isEVMTx];
        } catch (err) {
            console.log(err);
            return [null, null, null, null];
        }
    }
}