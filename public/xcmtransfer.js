const {
    ApiPromise,
    WsProvider,
    Keyring
} = require("@polkadot/api");
const {
    u8aToHex,
    hexToBn,
    hexToU8a,
} = require('@polkadot/util');
const {
    StorageKey
} = require('@polkadot/types');
const {
    cryptoWaitReady,
    decodeAddress,
    mnemonicToLegacySeed,
    hdEthereum
} = require('@polkadot/util-crypto');
const {
    MultiLocation
} = require('@polkadot/types/interfaces');
const fs = require('fs');
const XCMTransact = require('./xcmtransact');
const paraTool = require('./paraTool');
const ethTool = require('./ethTool');
const mysql = require("mysql2");

module.exports = class XCMTransfer extends XCMTransact {
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
        let sql = `select asset, currencyID, chainID, decimals, xcContractAddress from asset where xcmInteriorKey = ${mysql.escape(xcmInteriorKey)} and chainID = '${chainID}' limit 1`
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

    async lookup_sectionMethod(chainID, chainIDDest, xcmInteriorKey, evmPreferred = true) {
        let sectionMethodBlacklist = `'utility:batchAll', 'utility:batch', 'timestamp:set'`
        let sql = `select sectionMethod, count(*) cnt from xcmtransfer where
        chainID = '${chainID}' and
        chainIDDest = '${chainIDDest}' and
        xcmInteriorKey = '${xcmInteriorKey}' and
        sectionMethod not in (${sectionMethodBlacklist}) and
        matched = 1 and sourceTS > unix_timestamp(date_sub(Now(), interval 30 day))
        group by sectionMethod order by count(*) desc limit 5`
        console.log(paraTool.removeNewLine(sql))
        let recs = await this.poolREADONLY.query(sql);
        if (recs.length == 0) {
            // throw error
            console.log(sql, "BLANK");
            return [null, null];
        }
        let r = recs[0];
        if (evmPreferred) {
            for (const rec of recs) {
                if (rec.sectionMethod == 'ethereum:transact' || rec.sectionMethod == 'assets_withdraw:0xecf766ff' || rec.sectionMethod == 'assets_withdraw:0x019054d0') {
                    r = rec
                    break;
                }
            }
        }
        /*
        // TEMPORARY
        if (r.sectionMethod == "xTokens:TransferredMultiAssets") {
            r.sectionMethod = "xTokens:transfer";
        }
        */
        return [r.sectionMethod, "v2"];
    }

    async evm_xTokens_transfer(web3Api, currencyAddress, amount, decimals, beneficiary, chainIDDest) {
        let args = ethTool.xTokenBuilder(web3Api, currencyAddress, amount, decimals, beneficiary, chainIDDest)
        console.log("evm_xTokens_transfer", args);

        return [web3Api, args];
    }


    async evm_assets_withdraw(web3Api, currencyAddress, amount, decimals, beneficiary, chainIDDest) {
        let args = ethTool.xc20AssetWithdrawBuilder(web3Api, currencyAddress, amount, decimals, beneficiary, chainIDDest)
        return [web3Api, args];
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
        let amountRaw = paraTool.floatToBigIntDecimals(amount, assetDest.decimals);
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
        let amountRaw = paraTool.floatToBigIntDecimals(amount, assetDest.decimals);
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
        //let amountRaw = amount * 10 ** assetDest.decimals;
        let amountRaw = paraTool.floatToBigIntDecimals(amount, assetDest.decimals);
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
        let amountRaw = paraTool.floatToBigIntDecimals(amount, assetDest.decimals);
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
            let amountRaw = paraTool.floatToBigIntDecimals(amount, assetDest.decimals);
            console.log(`xcmPallet_reserveTransferAssets amountRaw`, amountRaw)
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
            let amountRaw = paraTool.floatToBigIntDecimals(amount, assetDest.decimals);
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
        let amountRaw = paraTool.floatToBigIntDecimals(amount, assetDest.decimals);
        //console.log("*****", JSON.stringify(amountRaw, null, 4))
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

    validateBeneficiaryAddress(chainIDDest, beneficiary) {
        let isValid = true
        let desc = "ok"
        let accountKey20Len = 42
        let accountID32Len = 66

        switch (chainIDDest) {
            case paraTool.chainIDMoonbeam:
            case paraTool.chainIDMoonriver:
            case paraTool.chainIDMoonbase:
            case 60888:
                //accountKey20 only
                if (beneficiary.length != accountKey20Len) {
                    isValid = false
                    desc = `Invalid beneficiary ${beneficiary} for chainIDDest=${chainIDDest}`
                }
                break;
            case paraTool.chainIDAstar:
            case paraTool.chainIDShiden:
            case paraTool.chainIDShibuya:
                //accountKey20, accountID32
                if (beneficiary.length != accountID32Len && beneficiary.length != accountKey20Len) {
                    isValid = false
                    desc = `Invalid beneficiary ${beneficiary} for chainIDDest=${chainIDDest}`
                }
                break;
            default:
                // accountID32 only
                if (beneficiary.length != accountID32Len) {
                    isValid = false
                    desc = `Invalid beneficiary ${beneficiary} for chainIDDest=${chainIDDest}`
                }
                break;
        }
        return [isValid, desc]
    }

    get_encoded_xcmTransaction(contract, input, gasLimit = 300000) {
        let api = this.apis["origination"].api;
        // ***** TODO: get ethereum call from ethers contract ABI, estimate gasLimit
        const xcmTransaction = {
            V1: {
                gasLimit,
                feePayment: "Auto",
                action: {
                    Call: contract
                },
                value: 0,
                input,
                accessList: null
            }
        }

        // map internaltx to encodedCall
        const internaltx = api.tx.ethereumXcm.transact(xcmTransaction)
        let encodedCall = internaltx.toHex();
        encodedCall = encodedCall.replace("0x810104", "0x"); // why?
        console.log("GENERATED ethereumXcm.transact", encodedCall);
        return encodedCall;
    }
    // https://docs.moonbeam.network/builders/xcm/xcm-transactor/#xcmtransactor-precompile
    evm_xcmTransactor_transactThroughSigned(account, paraID, paraIDDest, feeLocationAddress, contract, input, chainIDRelay = 60000) {
        // transactThroughSigned(Multilocation memory dest, address feeLocationAddress, uint64 transactRequiredWeightAtMost, bytes memory call, uint256 feeAmount, uint64 overallWeight)
        var xcmTransactorContractAbi = [{
            "inputs": [{
                    "components": [{
                            "internalType": "uint8",
                            "name": "parents",
                            "type": "uint8"
                        },
                        {
                            "internalType": "bytes[]",
                            "name": "interior",
                            "type": "bytes[]"
                        }
                    ],
                    "internalType": "struct XcmTransactorV2.Multilocation",
                    "name": "dest",
                    "type": "tuple"
                },
                {
                    "internalType": "address",
                    "name": "feeLocationAddress",
                    "type": "address"
                },
                {
                    "internalType": "uint64",
                    "name": "transactRequiredWeightAtMost",
                    "type": "uint64"
                },
                {
                    "internalType": "bytes",
                    "name": "call",
                    "type": "bytes"
                },
                {
                    "internalType": "uint256",
                    "name": "feeAmount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint64",
                    "name": "overallWeight",
                    "type": "uint64"
                }
            ],
            "name": "transactThroughSigned",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }]
        var xcmTransactorContractAddress = '0x000000000000000000000000000000000000080d' //this is the precompiled interface
        var xcmTransactorContract = new this.web3Api.eth.Contract(xcmTransactorContractAbi, xcmTransactorContractAddress);
        let weight = 6000000000
        let relayChain = paraTool.getRelayChainByChainID(chainIDRelay)
        let dest = []
        dest.push(1) // parents: 1
        if (paraIDDest != 0) {
            let parachainHex = paraTool.bnToHex(paraIDDest).substr(2)
            parachainHex = ['0x' + parachainHex.padStart(10, '0')]
            dest.push(parachainHex)
        }

        let encodedCall = this.get_encoded_xcmTransaction(contract, input)
        let transactRequiredWeightAtMost = "8000000000"; // uint64
        let feeAmount = "30000000000000000"; // uint256
        let overallWeight = "15000000000"; // uint64

        var data = xcmTransactorContract.methods.transactThroughSigned(dest, feeLocationAddress, transactRequiredWeightAtMost, encodedCall, feeAmount, overallWeight).encodeABI()
        let txStruct = {
            to: xcmTransactorContractAddress,
            value: '0',
            gas: 2000000,
            data: data
        }
        console.log(`evm_xcmTransactor_transactThroughSigned txStruct=`, txStruct)

        //let sectionMethod = "xcmTransactor:transactThroughSigned";
        //let func = api.tx.xcmTransactor.transactThroughSigned;
        //return [sectionMethod, func, args, isEVMTx];
        let isEVMTx = true;
        return [this.web3Api, txStruct]
    }



    // execute xcmTransactor.transactThroughSigned and observe blocks
    // assumes setupAPIs has been set up
    async xcmTransactor_transactThroughSigned(account, paraID, paraIDDest, currencyID, contract, input, chainIDRelay = 60000) {
        let encodedCall = this.get_encoded_xcmTransaction(contract, input)
        // ***** TODO: compute this more precisely using paraID / paraIDDest fee model from on chain data + check balances on derivedaccount are sufficient
        // 30000000000000000 => 0x0000000000000000006a94d74f430000
        const feeAmount = "30000000000000000" // check if really optional wrt AssetsTrapped
        const transactRequiredWeightAtMost = "8000000000" // required
        const overallWeight = null // check if really optional wrt AssetsTrapped

        //console.log(api.tx.ethereumXcm.transact.toJSON());
        //console.log(api.tx.xcmTransactor.transactThroughSigned.toJSON());
        // VersionedMultiLocation
        let dest = {
            V1: {
                parents: 1,
                interior: {
                    X1: {
                        Parachain: paraIDDest
                    }
                }
            }
        };
        // CurrencyPayment<CurrencyIdOf<T>>
        let fee = {
            currency: {
                AsCurrencyId: {
                    ForeignAsset: currencyID,
                }
            },
            feeAmount
        }
        // TransactWeights
        let weightInfo = {
            transactRequiredWeightAtMost,
            overallWeight
        }

        let sectionMethod = "xcmTransactor:transactThroughSigned";
        let func = api.tx.xcmTransactor.transactThroughSigned;
        let args = [dest, fee, encodedCall, weightInfo];
        let isEVMTx = false;
        return [sectionMethod, func, args, isEVMTx];
    }

    async xcmtransfer(chainID, chainIDDest, symbol, amount, beneficiary, evmPreferred = true) {
        let [isValidBeneficiary, desc] = this.validateBeneficiaryAddress(chainIDDest, beneficiary)
        if (!isValidBeneficiary) {
            console.log(`xcmtransfer warning: ${desc}`);
            return [null, null, null, null];
        }

        let chain = await this.getChain(chainID)
        await this.setupAPI(chain)
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let isEVMTx = 0
        try {
            let xcmInteriorKey = await this.lookupSymbolXCMInteriorKey(symbol, relayChain);
            let asset = await this.lookupChainAsset(chainID, xcmInteriorKey);
            let assetDest = await this.lookupChainAsset(chainIDDest, xcmInteriorKey);
            let [sectionMethod, version] = await this.lookup_sectionMethod(chainID, chainIDDest, xcmInteriorKey, evmPreferred);
            let xcm = this.parse_xcmInteriorKey(xcmInteriorKey, symbol);
            let func = null,
                args = null;
            if (assetDest == undefined || assetDest.decimals == undefined) {
                console.log("no decimals for assetDest", assetDest, "xcmInteriorKey", xcmInteriorKey, "chainIDDest", chainIDDest);
                return ([null, null, null]);
            }

            if ((chainID == 2 || chainID == 21000) && chainIDDest == 22000) version = "v0";
            if (chainID == paraTool.chainIDMoonbeam || chainID == paraTool.chainIDMoonriver || chainID == paraTool.chainIDMoonbaseAlpha || chainID == paraTool.chainIDMoonbaseBeta) {
                sectionMethod = 'evm_xTokens_transfer'
            }

            switch (sectionMethod) {
                case "assets_withdraw:0xecf766ff":
                case "assets_withdraw:0x019054d0":
                    if (asset.xcContractAddress) {
                        [func, args] = await this.evm_assets_withdraw(this.web3Api, asset.xcContractAddress, amount, asset.decimals, beneficiary, chainIDDest);
                        isEVMTx = 1
                    }
                    break;
                case "evm_xTokens_transfer":
                    if (asset.xcContractAddress) {
                        [func, args] = await this.evm_xTokens_transfer(this.web3Api, asset.xcContractAddress, amount, asset.decimals, beneficiary, chainIDDest);
                        isEVMTx = 1;
                    } else {
                        isEVMTx = 0;
                        [func, args] = await this.xTokens_transfer(version, asset, assetDest, xcm, amount, beneficiary);
                    }
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
            return [sectionMethod, func, args, isEVMTx];
        } catch (err) {
            console.log(err);
            return [null, null, null, null];
        }
    }

}


const XCMTransfer = require("./xcmtransfer");
const ethTool = require("./ethTool");
const paraTool = require("./paraTool");

async function main_xcmtransact() {
    let xcmtransact = new XCMTransfer();

    // only on moonbase right now
    let chainIDRelay = 60000;

    // case (1) is the default
    let address = "0xdcb4651b5bbd105cda8d3ba5740b6c4f02b9256d";
    let paraID = 1000; // moonbase-alpha
    let paraIDDest = 888; // moonbase-beta
    let currencyID = "35487752324713722007834302681851459189";  // BetaDev on 1000
    let feePaymentAddress = "0xffffffff1ab2b146c526d4154905ff12e6e57675"; // BetaDev on 1000
    let contract = "0x49ba58e2ef3047b1f90375c79b93578d90d24e24"; // flip contract
    let input = "0xcde4efa9" // flip

    await xcmtransact.init();
    await xcmtransact.setupAPIs(paraID, paraIDDest, chainIDRelay);
    xcmtransact.setupPair();
    xcmtransact.setupEvmPair();
    xcmtransact.setupEvmPairFromMnemonic()
    let execute = true;
    let isEVMTx = true;
    if (isEVMTx){
	let [web3Api, txStruct] = await xcmtransact.evm_xcmTransactor_transactThroughSigned(address, paraID, paraIDDest, feePaymentAddress, contract, input, chainIDRelay);
        var signedTx = await ethTool.signEvmTx(web3Api, txStruct, xcmtransact.evmpair)
        var decodedTx = ethTool.decodeRLPTransaction(signedTx.rawTransaction)
        console.log(`signedTx`, signedTx, `decodedTx`, decodedTx)
        if (execute) {
            console.log(`broadcasting signed evmTx`)
            //if execute true, brocast the tx
            let txHash = signedTx.transactionHash
            console.log("EVM Transfer sent with hash", txHash);
            console.log(`View Transaction: https://polkaholic.io/tx/${txHash}`);
            var result = await ethTool.sendSignedTx(web3Api, signedTx)
            console.log(`signedTX result=`, result)
        }
    } else {
	let argsStr = JSON.stringify(args, null, 4)
	console.log(`${sectionMethod} args`, argsStr);
	let [sectionMethod, func, args, isEVMTx] = await xcmtransact.xcmTransactor_transactThroughSigned(address, paraID, paraIDDest, currencyID, contract, input, chainIDRelay);
        let xcmTxn = func.apply(null, args)
	console.log("transactThroughSigned", xcmTxn.toHex());
        const { partialFee, weight } = await xcmTxn.paymentInfo(xcmtransact.pair);
        console.log(`Est. extrinsics weight=${weight}, weight fees=${partialFee.toHuman()}`);

	if (execute) {
            console.log(`broadcasting signed extrinsic`)
            let hash = await xcmTxn.signAndSend(xcmtransact.pair);
            let extrinsicHash = hash.toHex()
	    //xcmtransact.init_extrinsic(extrinsicHash, xcmTxn);
            console.log("Transfer sent with hash", hash.toHex());
            console.log(`View extrinsic: https://polkaholic.io/tx/${extrinsicHash}`);
        }
    }
}


async function main_xcmtransfer() {
    let chainID = 61000;
    let chainIDDest = 60888;
    let amount = .02;
    let symbol = "AlphaDev";
    let beneficiary = "0xdcb4651b5bbd105cda8d3ba5740b6c4f02b9256d"
    let beneficiarySubstrate = "0xd2473025c560e31b005151ebadbc3e1f14a2af8fa60ed87e2b35fa930523cd3c"
    let beneficiaryEVM = "0xdcb4651b5bbd105cda8d3ba5740b6c4f02b9256d"; //0xeaf3223589ed19bcd171875ac1d0f99d31a5969c";
    let isNonDefaultBeneficiary = false
    //xcmTransfer chainID chainIDDest amount symbol beneficiary

    const xcmtransfer = new XCMTransfer();
    await xcmtransfer.init() //wait for cryptoReady here
    xcmtransfer.setupPair();
    xcmtransfer.setupEvmPair();
    xcmtransfer.setupEvmPairFromMnemonic()

    if (chainIDDest == paraTool.chainIDMoonbeam || chainIDDest == paraTool.chainIDMoonriver || chainIDDest == paraTool.chainIDAstar || chainIDDest == paraTool.chainIDShiden) {
        if (!isNonDefaultBeneficiary){
            beneficiary = beneficiaryEVM;
        }
    }
    //validate cli inputs
    let [isValidBeneficiary, desc] = xcmtransfer.validateBeneficiaryAddress(chainIDDest, beneficiary)
    if (!isValidBeneficiary){
        console.error('ERROR', desc);
        process.exit(1);
    }
    let execute = true;
    let executionInput = {
        execute: execute,
        origination: chainID,
        destination: chainIDDest,
        symbol: symbol,
        amount: amount,
        beneficiary: beneficiary,
    }
    let [sectionMethod, func, args, isEVMTx] = await xcmtransfer.xcmtransfer(chainID, chainIDDest, symbol, amount, beneficiary);
    console.log(`xcmtransfer cli executionInput`, executionInput)
    let argsStr = JSON.stringify(args, null, 4)
    console.log(`xcmtransfer cli transcribed ${sectionMethod} args`, argsStr);

    // temp
    let chainIDRelay = 60000;
    let paraID = ( chainID - chainIDRelay ) ;
    let paraIDDest = ( chainIDDest - chainIDRelay );
    await xcmtransfer.setupAPIs(paraID, paraIDDest, chainIDRelay);

    if ( isEVMTx ) {
        var txStruct = args
        var web3Api = func
        var signedTx = await ethTool.signEvmTx(web3Api, args, xcmtransfer.evmpair)
        var decodedTx = ethTool.decodeRLPTransaction(signedTx.rawTransaction)
        console.log(`signedTx`, signedTx)
        console.log(`decodedTx`, decodedTx)
        if ( execute ) {
            console.log(`***** broadcasting signed evmTx`)
            //if execute true, brocast the tx
            let txHash = signedTx.transactionHash
            console.log("EVM Transfer sent with hash", txHash);
            console.log(`View Transaction: https://polkaholic.io/tx/${txHash}`);
            var result = await ethTool.sendSignedTx(web3Api, signedTx)
            console.log(`signedTX result=`, result)
        }
    } else {
        console.log(args);

	let xcmTxn = func.apply(null, args)
        const { partialFee, weight } = await xcmTxn.paymentInfo(xcmtransfer.pair);
        console.log(`Est. extrinsics weight=${weight}, weight fees=${partialFee.toHuman()}`);
	console.log("encoded", xcmTxn.toHex());
        if (execute) {
            console.log(`broadcasting signed extrinsics`)
            let hash = await xcmTxn.signAndSend(xcmtransfer.pair);
            let extrinsicHash = hash.toHex()
            console.log("Transfer sent with hash", hash.toHex());
            console.log(`View extrinsics: https://polkaholic.io/tx/${extrinsicHash}`);
        }
    }
}
