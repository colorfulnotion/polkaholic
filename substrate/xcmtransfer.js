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

    get_xcmtransactor_abi() {
        return [{
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
            },
            {
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
                        "name": "feeLocation",
                        "type": "tuple"
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
                "name": "transactThroughSignedMultilocation",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
    }
    get_encoded_xcmTransaction(contract, input, gasLimit = 600000) {
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
        encodedCall = "0x" + encodedCall.substring(8) // why?
        return encodedCall;
    }

    get_encoded_transfer(dest, value, gasLimit = 80000) {
        let api = this.apis["origination"].api;
        const internaltx = api.tx.balances.transfer(dest, value)
        let encodedCall = internaltx.toHex();
        //encodedCall = encodedCall.replace("0x810104", "0x"); // why?
        console.log("GENERATED balances.transfer", encodedCall);
        return encodedCall;
    }

    // remote execution of remote execution test:  paraID: 1000 paraIDDest: 888
    //   1000 will tell 888 to tell 1000 to do a flip
    evm_xcmTransactor_transactThroughSignedECHO(account, paraID, paraIDDest, feeLocationAddress, contract, input, chainIDRelay = 60000, useMultilocation = false) {
        let transactRequiredWeightAtMost = "16000000000"; // uint64
        let feeAmount = "30000000000000000"; // uint256
        let overallWeight = "40000000000"; // uint64
        var xcmTransactorContractAbi = this.get_xcmtransactor_abi();
        var xcmTransactorContractAddress = '0x000000000000000000000000000000000000080d' //this is the precompiled interface
        var xcmTransactorContract = new this.web3Api.eth.Contract(xcmTransactorContractAbi, xcmTransactorContractAddress);
        let weight = 6000000000
        let relayChain = paraTool.getRelayChainByChainID(chainIDRelay)
        let dest = []
        dest.push(1) // parents: 1
        if (paraIDDest != 0) {
            let parachainHex = paraTool.bnToHex(paraIDDest).substr(2) // 888
            parachainHex = ['0x' + parachainHex.padStart(10, '0')]
            dest.push(parachainHex)
        }
        let dest2 = []
        dest2.push(1) // parents: 1
        if (paraID != 0) {
            let parachainHex = paraTool.bnToHex(paraID).substr(2) // 1000
            parachainHex = ['0x' + parachainHex.padStart(10, '0')]
            dest2.push(parachainHex)
        }

        // "flip" on alpha 
        let encodedCall = this.get_encoded_xcmTransaction(contract, input)
        console.log("encodedCall", contract, encodedCall);
        // let feePaymentAddress = "0xffffffff1ab2b146c526d4154905ff12e6e57675"; // BetaDev on 1000
        // let feeLocationAddress2 = "0xffffffffa7b17e706a2391f346d8c82b6788db41"; // AlphaDev on 888

        // 888 => 1000 : flip on alpha with AlphaDev (wrapped in EthereumXCM) -- dest2 = 1000; feeLocationAddress2 = BetaDev on 888
        let encodedCall1 = xcmTransactorContract.methods.transactThroughSigned(dest2, "0xffffffffa7b17e706a2391f346d8c82b6788db41", transactRequiredWeightAtMost, encodedCall, feeAmount, overallWeight).encodeABI()
        console.log("dest2", dest2, paraID);
        console.log("encodedCall1", encodedCall1);
        /*
        |   60888 | AlphaDev  | 0xffffffffa7b17e706a2391f346d8c82b6788db41 |
        |   61000 | BetaDev   | 0xffffffff1ab2b146c526d4154905ff12e6e57675 |
        |   61000 | AlphaDev  | 0x0000000000000000000000000000000000000802 |
        |   60888 | BetaDev   | 0x0000000000000000000000000000000000000802 |
        */
        // 1000 => 888 [ 888 => 1000 : flip on alpha with AlphaDev ]
        let encodedCall2 = this.get_encoded_xcmTransaction(xcmTransactorContractAddress, encodedCall1)
        console.log("encodedCall2", encodedCall2);

        // 1000 => 888 [ 888 => 1000 : flip on alpha with AlphaDev ] (wrapped in EthereumXCM) dest = 888 ; feeLocationAddress = AlphaDev on 1000 // 0xa7a22adba12af4cfbdbaff07d318681bfd0c4a9f702700f12eb136a54100cbb0
        let encodedCall3 = xcmTransactorContract.methods.transactThroughSigned(dest, "0xffffffff1ab2b146c526d4154905ff12e6e57675", transactRequiredWeightAtMost, encodedCall2, feeAmount, overallWeight).encodeABI()
        console.log("dest", dest, paraIDDest);
        console.log("encodedCall3", encodedCall3);
        let txStruct = {
            to: xcmTransactorContractAddress,
            value: '0',
            gas: 2000000,
            data: encodedCall3
        }
        return [this.web3Api, txStruct]
    }

    // https://docs.moonbeam.network/builders/xcm/xcm-transactor/#xcmtransactor-precompile
    evm_xcmTransactor_transactThroughSigned(account, paraID, paraIDDest, feeLocationAddress, contract, input, chainIDRelay = 60000, useMultilocation = false) {
        var xcmTransactorContractAbi = this.get_xcmtransactor_abi();
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
        // encodedCall = this.get_encoded_transfer(contract, input);
        let transactRequiredWeightAtMost = "8000000000"; // uint64
        let feeAmount = "30000000000000000"; // uint256
        let overallWeight = "15000000000"; // uint64

        var data = xcmTransactorContract.methods.transactThroughSigned(dest, feeLocationAddress, transactRequiredWeightAtMost, encodedCall, feeAmount, overallWeight).encodeABI()
        if (useMultilocation) {
            // TODO: compute feeLocation
            let feeLocation = []
            // transactThroughSignedMultilocation(Multilocation memory dest, tuple feeLocation, uint64 transactRequiredWeightAtMost, bytes memory call, uint256 feeAmount, uint64 overallWeight)
            var data = xcmTransactorContract.methods.transactThroughSignedMultilocation(dest, feeLocation, transactRequiredWeightAtMost, encodedCall, feeAmount, overallWeight).encodeABI()
        }
        let txStruct = {
            to: xcmTransactorContractAddress,
            value: '0',
            gas: 2000000,
            data: data
        }
        console.log(`evm_xcmTransactor_transactThroughSigned txStruct=`, txStruct)

        return [this.web3Api, txStruct]
    }

    // execute xcmTransactor.transactThroughSigned and observe blocks
    // assumes setupAPIs has been set up
    async xcmTransactor_transactThroughSigned(account, paraID, paraIDDest, currencyID, contract, input, chainIDRelay = 60000, useMultilocation = false) {
        let encodedCall = this.get_encoded_xcmTransaction(contract, input)
        // ***** TODO: compute this more precisely using paraID / paraIDDest fee model from on chain data + check balances on derivedaccount are sufficient
        // 30000000000000000 => 0x0000000000000000006a94d74f430000
        const feeAmount = "30000000000000000" // check if really optional wrt AssetsTrapped
        const transactRequiredWeightAtMost = "8000000000" // required
        const overallWeight = null // check if really optional wrt AssetsTrapped

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
        if (useMultilocation) {
            fee = {
                currency: {
                    AsMultiLocation: {
                        V1: {
                            parents: 1,
                            interior: {
                                X2: {
                                    Parachain: paraIDDest,
                                    PalletInstance: 3
                                }
                            }
                        }
                    }
                }

            }
        }

        // TransactWeights
        let weightInfo = {
            transactRequiredWeightAtMost,
            overallWeight
        }

        let sectionMethod = "xcmTransactor:transactThroughSigned";
        let api = this.apis["origination"].api;
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