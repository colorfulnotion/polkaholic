const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class MoonbeamParser extends ChainParser {

    processIncomingXCM(indexer, extrinsic, extrinsicID, events, finalized = false) {
        //IMPORTANT: reset mpReceived at the start of every unsigned extrinsic
        this.mpReceived = false;
        this.mpReceivedHashes = {};
        //console.log(`[${extrinsicID}] processIncomingXCM start`, `mpReceived=${this.mpReceived}`)

        //step0. parse incoming messages (raw)
        super.processIncomingXCMMessages(indexer, extrinsic, extrinsicID, events, finalized)

        //step1. parse incoming transfer heuristically
        for (let i = 0; i < events.length; i++) {
            let e = events[i]
            super.processIncomingXCMSignal(indexer, extrinsicID, e, i, finalized)
        }
        if (this.mpReceived) {
            let idxKeys = Object.keys(this.mpReceivedHashes)
            let prevIdx = 0;

            for (const idxKey of idxKeys) {
                this.mpReceivedHashes[idxKey].startIdx = parseInt(prevIdx)
                this.mpReceivedHashes[idxKey].endIdx = parseInt(idxKey)
                let mpState = this.mpReceivedHashes[idxKey]
                console.log(`mpReceived [${this.parserBlockNumber}] [${this.parserBlockHash}] [${mpState.msgHash}] range=[${mpState.startIdx},${mpState.endIdx})`, mpState)
                let eventRange = events.slice(mpState.startIdx, mpState.endIdx)
                let eventRangeLengthWithoutFee = eventRange.length - 1 // remove the fee event here
                for (let i = 0; i < eventRangeLengthWithoutFee; i++) {
                    let e = eventRange[i]
                    let [candidate, caller] = this.processIncomingAssetSignal(indexer, extrinsicID, e, mpState, finalized)
                    if (candidate) {
                        indexer.updateXCMTransferDestCandidate(candidate, caller)
                    }
                }
                prevIdx = parseInt(idxKey) + 1
            }
        }
    }

    processIncomingAssetSignal(indexer, extrinsicID, e, mpState, finalized = false) {
        let [candidate, caller] = super.processIncomingAssetSignal(indexer, extrinsicID, e, mpState, finalized)
        caller = `generic processIncomingAssetSignal assets:Issued`
        if (candidate && candidate.asset != undefined) {
            //remove xc
            candidate.asset = candidate.asset.replace('xc', '') //temporary hack to remove the xc in asset..
        }
        return [candidate, caller]
    }

    processOutgoingXCM(indexer, extrinsic, feed, fromAddress, section = false, method = false, args = false) {
        let module_section = section;
        let module_method = method
        if (section == false && section == false) {
            module_section = extrinsic.section;
            module_method = extrinsic.method;
            args = extrinsic.params
        }
        let section_method = `${module_section}:${module_method}`
        //let outgoingXcmList = [];
        if (args.calls != undefined) { // this is an array
            //console.log(`[${extrinsic.extrinsicID}] descend into calls`, args.calls.length)
            let i = 0;
            for (const c of args.calls) {
                let call_section = c.section;
                let call_method = c.method;
                let c_args = c.args
                //console.log(`[${extrinsic.extrinsicID}] call`, i, call_section, call_method, c);
                i++;
                this.processOutgoingXCM(indexer, extrinsic, feed, fromAddress, call_section, call_method, c_args)
            }
        } else if (args.call != undefined) { // this is an object
            let call = args.call
            let call_args = call.args
            let call_section = call.section;
            let call_method = call.method;
            let isHexEncoded = (typeof call === 'object') ? false : true
            //console.log(`[${extrinsic.extrinsicID}] descend into call`, call)
            if (!isHexEncoded && call_args != undefined) {
                this.processOutgoingXCM(indexer, extrinsic, feed, fromAddress, call_section, call_method, call_args)
            }
        }
        switch (module_section) {
            case 'xTokens':
                let outgoingXcmList1 = this.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingXCM xTokens`, outgoingXcmList1)
                //return outgoingXcmList
                break;
            case 'xcmPallet':
                let outgoingXcmList2 = this.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingXcmPallet xcmPallet`, outgoingXcmList2)
                //return outgoingXcmList
                break;
            case 'polkadotXcm':
                let outgoingXcmList3 = this.processOutgoingPolkadotXcm(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingXCM polkadotXcm`, outgoingXcmList3)
                //return outgoingXcmList
                break;
            case 'xcmTransactor':
                let outgoingXcmList4 = this.processOutgoingXCMTransactor(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoing XCMTransactor`, outgoingXcmList3)
                //return outgoingXcmList
                break;
            default:
                //console.log(`unknown`)
                //return outgoingXcmList
                break;
        }
    }

    processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // need additional processing for currency_id part
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`moonbeam processOutgoingXTokens start`)
        let assetString = false
        let a = args
        if (a.currency_id != undefined) {
            assetString = this.processDecHexCurrencyID(indexer, a.currency_id)
            if (assetString) {
                assetString = assetString.replace('xc', '') //temporary hack to remove the xc in asset..
            }
        }
        //let generalOutgoingXcmList = super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicHash}] moonbeam processOutgoingXTokens xcmPallet missing`)
            } else if (assetString) {
                xcmtransfer.asset = assetString
                outgoingXcmList.push(xcmtransfer)
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicHash}] moonbeam processOutgoingXTokens xcmPallet assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`[${extrinsic.extrinsicHash}] moonbeam processOutgoingXTokens DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }

    processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // TODO: have not seen case like this yet
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`moonbeam processOutgoingXcmPallet start`)
        let assetString = false
        let a = args
        if (a.currency_id != undefined) {
            assetString = this.processDecHexCurrencyID(indexer, a.currency_id)
            if (assetString) {
                assetString = assetString.replace('xc', '') //temporary hack to remove the xc in asset..
            }
        }
        //let generalOutgoingXcmList = super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`moonbeam processOutgoingXcmPallet xcmPallet missing`)
            } else if (assetString) {
                xcmtransfer.asset = assetString
                outgoingXcmList.push(xcmtransfer)
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`moonbeam processOutgoingXcmPallet assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`moonbeam processOutgoingXcmPallet DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }

    processOutgoingXCMTransactor(indexer, extrinsic, feed, fromAddress, section_method, args) {
        let outgoingXcmPallet = []
        let a = args
        try {
            /* Known cases:
            xcmTransactor:transactThroughSignedMultilocation 0x9861c936ab2a0fbe8ff3ce50075a87a6e89b3db3bf9e8b593fd365743c8a954b
            xcmTransactor:transactThroughDerivative  0x5f2231642a9b07b8835e1bdf26548e0ec4e31ca6b823a9255235dda65d8e1b9f
            xcmTransactor:transactThroughSigned 0xdc6d066d87f77c36566862599110ae38b493ede9004ffbad5e80377742e02ab8 [ethereumXcm:transact]
            xcmTransactor:transactThroughSovereign 0xfab404024caceb70685d10b8ab8fc2c27783e4a8ed4bc0598f330f5c4b877d80
            xcmTransactor:transactThroughDerivativeMultilocation 0xe3c265369654f67b232939ac4b041cae6fed144b3336a12becb2d937b241b1f3
            */

            console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} args`, a)
            if (section_method == "xcmTransactor:transactThroughDerivative"){
                /*
                //dest currently has fixed input "Relay"
                // can match on inner call
                {
                    "dest": "Relay",
                    "index": 1107,
                    "currency_id": {
                        "foreignAsset": "0x1fcacbd218edc0eba20fc2308c778080"
                    },
                    "dest_weight": 2000000001,
                    "inner_call": "0x040000e6b912626c9dfa3cd9e65b4412b19eb9d123edb1aa22d492a58a88091c483a7a0b00f81b1d0001"
                }
                */
                console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} here 1`)
                let asset = this.processGenericCurrencyID(indexer, a.currency_id) //inferred approach
                let rawAsset = this.processRawGenericCurrencyID(indexer, a.currency_id)
                console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} here 2`)
                let chainID = indexer.chainID
                let relayChain = indexer.relayChain
                let chainIDDest = paraTool.getRelayChainID(relayChain)
                let paraID = paraTool.getParaIDfromChainID(chainID)
                let paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)
                console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} here 3`)
                let innerCall = (a.inner_call != undefined)? a.inner_call : 'notfound'
                let incomplete = this.extract_xcm_incomplete(extrinsic.events, extrinsic.extrinsicID);
                console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} here 4`)

                if (extrinsic.xcms == undefined) extrinsic.xcms = []
                let xcmIndex = extrinsic.xcms.length
                let destAddress = '0x' //unknown
                let isFeeItem = 0 // irrelevant?
                let transferIndex = 0
                let r = {
                    sectionMethod: section_method,
                    extrinsicHash: feed.extrinsicHash,
                    extrinsicID: feed.extrinsicID,
                    transferIndex: transferIndex,
                    xcmIndex: xcmIndex,
                    relayChain: relayChain,
                    chainID: chainID,
                    chainIDDest: chainIDDest,
                    paraID: paraID,
                    paraIDDest: paraIDDest,
                    blockNumber: this.parserBlockNumber,
                    fromAddress: fromAddress,
                    destAddress: destAddress,
                    asset: asset,
                    rawAsset: rawAsset,
                    sourceTS: feed.ts,
                    amountSent: 0,
                    incomplete: incomplete,
                    isFeeItem: isFeeItem,
                    msgHash: '0x',
                    sentAt: this.parserWatermark,
                    innerCall: innerCall,
                }
                let [isXCMAssetFound, standardizedXCMInfo] = indexer.getStandardizedXCMAssetInfo(indexer.chainID, asset, rawAsset)
                if (isXCMAssetFound) {
                    if (standardizedXCMInfo.nativeAssetChain != undefined) r.nativeAssetChain = standardizedXCMInfo.nativeAssetChain
                    if (standardizedXCMInfo.xcmInteriorKey != undefined) r.xcmInteriorKey = standardizedXCMInfo.xcmInteriorKey
                }
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughDerivative`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)
            }else if (section_method == "xcmTransactor:transactThroughSignedMultilocation" && false) {
                let paraID = paraTool.getParaIDfromChainID(indexer.chainID)
                let paraIDDest = -1;
                let chainIDDest = -1;
                //let amountSent = 0;
                let destAddress = null;
                let relayChain = indexer.relayChain;
                //let a = extrinsic.params;
                let a = args;
                let assetAndAmountSents = [];

                // asset processing
                //console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method}`, JSON.stringify(a, null, 2))
                if (a !== undefined && a.assets !== undefined) {
                    let assets = a.assets;
                    let feeAssetIndex = a.fee_asset_item
                    if (assets.v0 !== undefined && Array.isArray(assets.v0) && assets.v0.length > 0) {
                        console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} v0 case`, JSON.stringify(a, null, 2))
                        let assetsv0 = assets.v0
                        let transferIndex = 0
                        for (const asset of assetsv0) {
                            if (asset.concreteFungible !== undefined) {
                                // extract this
                                /*
                                {
                                  "concreteFungible": {
                                    "id": {
                                      "null": null
                                    },
                                    "amount": 6800000000000
                                  }
                                }
                                */
                                let fungibleAsset = asset.concreteFungible;
                                //let targetedAsset = false;
                                //let rawTargetedAsset = false;
                                //let amountSent = 0;
                                let [targetedAsset, rawTargetedAsset, amountSent] = this.processV0ConcreteFungible(indexer, fungibleAsset)
                                let aa = {
                                    asset: targetedAsset,
                                    rawAsset: rawTargetedAsset,
                                    amountSent: amountSent,
                                    transferIndex: transferIndex,
                                    isFeeItem: (transferIndex == feeAssetIndex) ? 1 : 0,
                                }
                                assetAndAmountSents.push(aa)
                            }
                            transferIndex++
                        }
                    } else if (assets.v1 !== undefined && Array.isArray(assets.v1) && assets.v1.length > 0) {
                        // todo: extract this
                        console.log(`[${extrinsic.extrinsicHash}] xcmPallet assets.v1 case`)
                        let assetsv1 = assets.v1
                        let transferIndex = 0
                        for (const asset of assetsv1) {
                            // 0x2374aae493ae96e44954bcb4f242a049f2578d490bc382eae113fd5893dfd297
                            // {"id":{"concrete":{"parents":0,"interior":{"here":null}}},"fun":{"fungible":10324356190528}}
                            /*
                            "assets": {
                                "v1": [
                                {
                                  "id": {
                                    "concrete": {
                                      "parents": 0,
                                      "interior": {
                                      "here": null
                                    }
                                  }
                                },
                                "fun": {
                                    "fungible": 102000000000
                                  }
                                }
                              ]
                            },
                            "fee_asset_item": 0
                            */
                            if (asset.fun !== undefined && asset.fun.fungible !== undefined) {
                                let [targetedAsset, rawTargetedAsset] = this.processV1ConcreteFungible(indexer, asset)
                                let aa = {
                                    asset: targetedAsset,
                                    rawAsset: rawTargetedAsset,
                                    amountSent: paraTool.dechexToInt(asset.fun.fungible),
                                    transferIndex: transferIndex,
                                    isFeeItem: (transferIndex == feeAssetIndex) ? 1 : 0,
                                }
                                assetAndAmountSents.push(aa)
                            } else {
                                if (this.debugLevel >= paraTool.debugErrorOnly) console.log("asset v1 unknown", asset);
                                asset = false;
                            }
                            transferIndex++
                        }
                    }

                    // beneficiary processing -- TODO: check that fromAddress is in beneficiary
                    if (a.beneficiary !== undefined) {
                        let beneficiary = a.beneficiary
                        if (beneficiary.v0 !== undefined) {
                            let beneficiary_v0 = beneficiary.v0
                            //console.log("beneficiary v0=", JSON.stringify(a.beneficiary.v0));
                            if (beneficiary_v0.x1 != undefined) {
                                //0x0db891b6d6af60401a21f72761ed04a6024bf37b6cdeaab62d0bc3963c5c9357
                                [paraIDDest, chainIDDest, destAddress] = this.processX1(beneficiary_v0.x1, relayChain)
                            } else if (beneficiary_v0.x2 !== undefined) {
                                // I think this this can happen when xcmPallet to para?
                                [paraIDDest, chainIDDest, destAddress] = this.processX2(beneficiary_v0.x2, relayChain)
                            }

                        } else if (beneficiary.v1 !== undefined) {
                            //console.log(`beneficiary.v1 case`, JSON.stringify(beneficiary.v1, null, 2))
                            //console.log("beneficiary v1=", JSON.stringify(a.beneficiary.v1));
                            //0xfda47f26aa64e7824f6791162bfa87de83bfaa67c57f614299b5e1b687eb13b2
                            //0x3a47436114ee38a5d93cb3f248127464dd1be797cdf174f8759bfcbf6503952c
                            if (beneficiary.v1.interior !== undefined) {
                                let beneficiaryV1Interior = beneficiary.v1.interior;
                                // dest for relaychain
                                if (beneficiaryV1Interior.x1 !== undefined) {
                                    [paraIDDest, chainIDDest, destAddress] = this.processX1(beneficiaryV1Interior.x1, relayChain)
                                } else if (beneficiaryV1Interior.x2 !== undefined) {
                                    [paraIDDest, chainIDDest, destAddress] = this.processX2(beneficiaryV1Interior.x2, relayChain)
                                } else {
                                    if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`beneficiary.v1.interior unknown case`, beneficiaryV1Interior)
                                }
                            } else {
                                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`beneficiary.v1 unknown case`, beneficiary.v1)
                            }
                        } else if (beneficiary.x1 !== undefined) {
                            //0x2cfbeb75fe9a1e13a3a6cf700c27d1afd53c7f164c127e60763c2e27b959e195
                            [paraIDDest, chainIDDest, destAddress] = this.processX1(beneficiary.x1, relayChain)
                        } else if (beneficiary.x2 !== undefined) {
                            //0x0f51db2f3f23091aa1c0108358160c958db46f62e08fcdda13d0d864841821ad
                            [paraIDDest, chainIDDest, destAddress] = this.processX2(beneficiary.x2, relayChain)
                        } else {
                            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} Unknown beneficiary`, beneficiary)
                        }
                    }
                    // dest processing
                    let dest = a.dest;
                    let destAddress2 = false; // not used
                    if (dest.v0 !== undefined) {
                        //todo: extract
                        let dest_v0 = dest.v0
                        if (dest_v0.x1 !== undefined) {
                            [paraIDDest, chainIDDest] = this.processDestV0X1(dest_v0.x1, relayChain)
                        } else if (dest_v0.x2 !== undefined) {
                            /*
                            {"x2":[{"parent":null},{"parachain":2000}]}
                            */
                            [paraIDDest, chainIDDest] = this.processDestV0X2(dest_v0.x2, relayChain)

                        } else {
                            if (this.debugLevel >= paraTool.debugErrorOnly) console.log("dest v0 unk = ", JSON.stringify(dest.v0));
                            chainIDDest = false
                        }
                    } else if ((dest.v1 !== undefined) && (dest.v1.interior !== undefined)) {
                        // xcmPallet dest.v1.interior does not have id?
                        let destV1Interior = dest.v1.interior
                        if (destV1Interior.x1 !== undefined) {
                            // {"v1":{"parents":0,"interior":{"x1":{"parachain":2012}}}}
                            //[paraIDDest, chainIDDest, destAddress] = this.processX1(destV1Interior.x1, relayChain)
                            [paraIDDest, chainIDDest] = this.processDestV0X1(destV1Interior.x1, relayChain)
                        } else if (destV1Interior.x2 !== undefined) {
                            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`potental error case destV1Interior.x2`, destV1Interior.x2)
                            // dest for parachain, add 20000 for kusama-relay
                            [paraIDDest, chainIDDest, _d] = this.processX2(destV1Interior.x2, relayChain)
                        } else {
                            if (this.debugLevel >= paraTool.debugErrorOnly) console.log("dest v1 int unk = ", JSON.stringify(dest.v1.interior));
                            chainIDDest = false
                        }
                    }

                    for (const assetAndAmountSent of assetAndAmountSents) {
                        let asset = assetAndAmountSent.asset
                        let rawAsset = assetAndAmountSent.rawAsset
                        let amountSent = assetAndAmountSent.amountSent
                        let transferIndex = assetAndAmountSent.transferIndex
                        let isFeeItem = assetAndAmountSent.isFeeItem
                        if (assetAndAmountSent != undefined && asset && paraTool.validAmount(amountSent) && chainIDDest) {
                            let incomplete = this.extract_xcm_incomplete(extrinsic.events, extrinsic.extrinsicID);
                            if (extrinsic.xcms == undefined) extrinsic.xcms = []
                            let xcmIndex = extrinsic.xcms.length
                            let r = {
                                sectionMethod: section_method,
                                extrinsicHash: feed.extrinsicHash,
                                extrinsicID: feed.extrinsicID,
                                transferIndex: transferIndex,
                                xcmIndex: xcmIndex,
                                relayChain: indexer.relayChain,
                                chainID: indexer.chainID,
                                chainIDDest: chainIDDest,
                                paraID: paraID,
                                paraIDDest: paraIDDest,
                                blockNumber: this.parserBlockNumber,
                                fromAddress: fromAddress,
                                destAddress: destAddress,
                                asset: asset,
                                rawAsset: rawAsset,
                                sourceTS: feed.ts,
                                amountSent: amountSent,
                                incomplete: incomplete,
                                isFeeItem: isFeeItem,
                                msgHash: '0x',
                                sentAt: this.parserWatermark,
                            }
                            let [isXCMAssetFound, standardizedXCMInfo] = indexer.getStandardizedXCMAssetInfo(indexer.chainID, asset, rawAsset)
                            if (isXCMAssetFound) {
                                if (standardizedXCMInfo.nativeAssetChain != undefined) r.nativeAssetChain = standardizedXCMInfo.nativeAssetChain
                                if (standardizedXCMInfo.xcmInteriorKey != undefined) r.xcmInteriorKey = standardizedXCMInfo.xcmInteriorKey
                            }
                            //if (this.debugLevel >= paraTool.debugVerbose) console.log("processOutgoingXcmPallet xcmPallet", r);
                            extrinsic.xcms.push(r)
                            outgoingXcmPallet.push(r)
                            //outgoingXcmList.push(r)
                        } else {
                            if (this.debugLevel >= paraTool.debugErrorOnly) console.log("chainparser-processOutgoingXCMTransactor unknown", `module:${section_method}`, a);
                            // TODO: tally error
                        }
                    }
                }
            }else{
                console.log(`!!! NOT COVERED [${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} args`, a)
            }
        } catch (e) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`processOutgoingXCMTransactor error`, e)
            return outgoingXcmPallet
        }
        return outgoingXcmPallet
    }


    rewardFilter(palletMethod) {
        if (palletMethod == "parachainStaking(Rewarded)") {
            //console.log(`processReward ${palletMethod}`)
            return true
            //return this.prepareFeedReward(rewardEvent)
        } else {
            return super.rewardFilter(palletMethod)
        }
    }

    prepareFeedReward(indexer, section, method, data, eventID) {
        let palletMethod = `${section}(${method})`
        //let data = rewardEvent.data
        if (palletMethod == "parachainStaking(Rewarded)") {
            /*
            "data": [
              "0x22bA795AA1223F0C8fAE2932F16F4b1F8B573163",
              "0x0000000000000000150101a8f3988e38"
            ]
            */

            let accountID = data[0]
            let bal = paraTool.dechexToInt(data[1]);
            let rewardRec = {
                eventID: eventID,
                section: section,
                method: method,
                account: accountID,
                value: bal
            }
            return rewardRec
        } else {
            return super.prepareFeedReward(indexer, section, method, data, eventID)
        }
        return false
    }
}
