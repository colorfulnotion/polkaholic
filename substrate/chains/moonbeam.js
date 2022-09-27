const paraTool = require("../paraTool");
const ethTool = require("../ethTool");

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

            //TODO: blacklist: author, 0x6d6f646c70792f74727372790000000000000000 (modlpy/trsry)
            //conjecture: the last event prior to msgHash is typically the "fee" event either going to blockproducer or trsry
            for (const idxKey of idxKeys) {
                this.mpReceivedHashes[idxKey].startIdx = parseInt(prevIdx)
                this.mpReceivedHashes[idxKey].endIdx = parseInt(idxKey)
                let mpState = this.mpReceivedHashes[idxKey]
                let eventRange = events.slice(mpState.startIdx, mpState.endIdx)
                let eventRangeLengthWithoutFee = eventRange.length - 1 // remove the fee event here
                //let lastEvent = eventRange[-1]
                for (let i = 0; i < eventRange.length; i++) {
                    let ev = eventRange[i]
                    //filter on xcmpallet(AssetsTrapped) - need to mark mpState as fail
                    if (this.xcmAssetTrapFilter(`${ev.section}(${ev.method})`)) {
                        //not sure what does the hash mean ...
                        mpState.success = false
                        mpState.errorDesc = `complete`
                        mpState.description = `${ev.method}`
                        mpState.defaultEventID = `${mpState.eventID}` // original eventID
                        //mpState.description = `Executed ${mpState.eventID}`
                        mpState.eventID = ev.eventID // update eventID with AssetsTrapped
                        this.mpReceivedHashes[idxKey] = mpState
                        console.log(`[${this.parserBlockNumber}] [${this.parserBlockHash}] [${mpState.msgHash}] [${ev.eventID}] asset trapped!`)
                    }
                }
                console.log(`MoonbeamParser mpReceived [${this.parserBlockNumber}] [${this.parserBlockHash}] [${mpState.msgHash}] range=[${mpState.startIdx},${mpState.endIdx})`, mpState)
                //update xcmMessages
                indexer.updateMPState(mpState)
                //only compute candiate mpState is successful
                if (mpState.success === true) {
                    for (let i = 0; i < eventRangeLengthWithoutFee; i++) {
                        let e = eventRange[i]
                        let [candidate, caller] = this.processIncomingAssetSignal(indexer, extrinsicID, e, mpState, finalized)
                        if (candidate) {
                            indexer.updateXCMTransferDestCandidate(candidate, caller)
                        }
                    }
                } else {
                    console.log(`[${this.parserBlockNumber}] [${this.parserBlockHash}] [${mpState.msgHash}] skipped. (${mpState.errorDesc})`)
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

    getMsgHashAndInnerCall(indexer, extrinsic, feed) {
        let msgHash = '0x'
        let innerCall = '0x'
        let events = feed.events
        for (let i = 0; i < events.length; i++) {
            let e = events[i]
            let eventMethodSection = `${e.section}(${e.method})`
            if (eventMethodSection == 'xcmTransactor(TransactedSigned)') {
                /*
                [
                    "0xD720165D294224A7d16F22ffc6320eb31f3006e1", //fee payer?
                    {
                        "parents": 1,
                        "interior": {
                            "x1": {
                                "parachain": 888
                            }
                        }
                    },
                    "0x260000e093040000000000000000000000000000000000000000000000000000000000010011246ff6b1900bd864d1b603e6d8f093b87828e3000000000000000000000000000000000000000000000000000000000000000091015d3a1f9d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000e476f726b6120426574612058434d00000000000000000000000000000000000000"
                ]
                */
                innerCall = e.data[2]
            }
            if (eventMethodSection == 'xcmpQueue(XcmpMessageSent)') {
                msgHash = e.data[0]
            }
        }
        return [msgHash, innerCall]
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
        let a = args
        let xcmAssetSymbol = false
        if (a.currency_id != undefined) {
            xcmAssetSymbol = this.processXcmDecHexCurrencyID(indexer, a.currency_id)
        }
        //let generalOutgoingXcmList = super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicHash}] moonbeam processOutgoingXTokens xcmPallet missing`)
            } else if (xcmAssetSymbol) {
                let relayChain = xcmtransfer.relayChain
                let chainID = xcmtransfer.chainID
                let chainIDDest = xcmtransfer.chainIDDest
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(xcmAssetSymbol, relayChain, chainID, chainIDDest, "processXcmDecHexCurrencyID", "moonbeam processOutgoingXTokens")
                xcmtransfer.xcmSymbol = xcmAssetSymbol
                xcmtransfer.xcmInteriorKey = targetedXcmInteriorKey
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
        let a = args
        let xcmAssetSymbol = false
        if (a.currency_id != undefined) {
            xcmAssetSymbol = this.processXcmDecHexCurrencyID(indexer, a.currency_id)
        }

        //let generalOutgoingXcmList = super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`moonbeam processOutgoingXcmPallet xcmPallet missing`)
            } else if (xcmAssetSymbol) {
                let relayChain = xcmtransfer.relayChain
                let chainID = xcmtransfer.chainID
                let chainIDDest = xcmtransfer.chainIDDest
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(xcmAssetSymbol, relayChain, chainID, chainIDDest, "processXcmDecHexCurrencyID", "moonbeam processOutgoingXcmPallet")
                xcmtransfer.xcmSymbol = xcmAssetSymbol
                xcmtransfer.xcmInteriorKey = targetedXcmInteriorKey
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
        if (extrinsic.xcms == undefined) extrinsic.xcms = []
        let xcmIndex = extrinsic.xcms.length
        let destAddress = '0x' //unknown
        let isFeeItem = 0 // irrelevant?
        let transferIndex = 0
        let a = args
        let relayChain = indexer.relayChain
        let chainID = indexer.chainID
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let chainIDDest = null;
        let paraIDDest = null;
        let asset = false
        let rawAsset = false
        let incomplete = this.extract_xcm_incomplete(extrinsic.events, extrinsic.extrinsicID);
        let innerCall = null
        let r = {
            sectionMethod: section_method,
            extrinsicHash: feed.extrinsicHash,
            extrinsicID: feed.extrinsicID,
            transferIndex: 0,
            xcmIndex: xcmIndex,
            relayChain: relayChain,
            chainID: chainID,
            chainIDDest: chainIDDest, // unknown
            paraID: paraID,
            paraIDDest: paraIDDest, // unknown
            blockNumber: this.parserBlockNumber,
            fromAddress: fromAddress,
            destAddress: destAddress, //unknown
            asset: asset, //unknown
            rawAsset: rawAsset, //unknown
            sourceTS: feed.ts,
            amountSent: 0, // unknown
            incomplete: incomplete,
            isFeeItem: isFeeItem,
            msgHash: '0x',
            sentAt: this.parserWatermark,
            xcmSymbol: targetedSymbol,
            xcmInteriorKey: targetedXcmInteriorKey,
            innerCall: innerCall,
        }
        try {
            /* Known cases:
            xcmTransactor:transactThroughSignedMultilocation 0x9861c936ab2a0fbe8ff3ce50075a87a6e89b3db3bf9e8b593fd365743c8a954b [OK]
            xcmTransactor:transactThroughSigned 0xdc6d066d87f77c36566862599110ae38b493ede9004ffbad5e80377742e02ab8 [OK]
            xcmTransactor:transactThroughDerivative  0x5f2231642a9b07b8835e1bdf26548e0ec4e31ca6b823a9255235dda65d8e1b9f [OK]
            xcmTransactor:transactThroughDerivativeMultilocation 0xe3c265369654f67b232939ac4b041cae6fed144b3336a12becb2d937b241b1f3 [untested]
            xcmTransactor:transactThroughSovereign 0xfab404024caceb70685d10b8ab8fc2c27783e4a8ed4bc0598f330f5c4b877d80 [untested]

            */

            console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} args`, a)
            console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} default`, r)
            if (section_method == "xcmTransactor:transactThroughDerivative") {
                /*
                // dest currently has fixed input "Relay"
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

                // dest processing
                chainIDDest = paraTool.getRelayChainID(relayChain)
                paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)

                // index: skipped for now

                // currency_id processing
                //asset = this.processGenericCurrencyID(indexer, a.currency_id) //inferred approach
                //rawAsset = this.processRawGenericCurrencyID(indexer, a.currency_id)

                let targetedSymbol = this.processXcmGenericCurrencyID(indexer, a.currency_id) //inferred approach
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "moonbeam xcmTransactor:transactThroughDerivative", a.currency_id)

                //inner_call processing
                innerCall = (a.inner_call != undefined) ? a.inner_call : 'notfound'
                //r.asset = asset
                //r.rawAsset = rawAsset
                r.xcmInteriorKey = targetedXcmInteriorKey,
                r.xcmSymbol = targetedSymbol,
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} here 4`)
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughDerivative`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)
            } else if (section_method == "xcmTransactor:transactThroughDerivativeMultilocation") {

                //dest currently has fixed input "Relay"
                chainIDDest = paraTool.getRelayChainID(relayChain)
                paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)

                // index: skipped for now

                // fee_location processing
                let targetedSymbol = false
                let targetedXcmInteriorKey = false
                if (a !== undefined && a.fee_location !== undefined) {
                    let feelocation = a.fee_location
                    let [feeSymbol, feeRelayChain] = this.processFeeLocation(indexer, feelocation, relayChain)
                    if (feeSymbol) {
                        targetedSymbol = feeSymbol
                        let [feeXcmInteriorKey] = indexer.check_refintegrity_xcm_symbol(targetedSymbol, feeRelayChain, chainID, chainIDDest, "processFeeLocation", "moonbeam xcmTransactor:transactThroughDerivativeMultilocation", feelocation)
                        if (feeXcmInteriorKey) targetedXcmInteriorKey = feeXcmInteriorKey
                    }
                }

                // inner_call processing
                innerCall = (a.inner_call != undefined) ? a.inner_call : 'notfound'
                //r.asset = asset
                //r.rawAsset = rawAsset
                r.xcmInteriorKey = targetedXcmInteriorKey,
                r.xcmSymbol = targetedSymbol
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughDerivativeMultilocation`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)

            } else if (section_method == "xcmTransactor:transactThroughSignedMultilocation") {
                /*
                msgHash: 0x0002100b010300d720165d294224a7d16f22ffc6320eb31f3006e100040000010403000f00005d4d5e0830130000010403000f00005d4d5e083001070068e36b0206010700e40b54020103260000e093040000000000000000000000000000000000000000000000000000000000010011246ff6b1900bd864d1b603e6d8f093b87828e3000000000000000000000000000000000000000000000000000000000000000091015d3a1f9d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000e476f726b6120426574612058434d00000000000000000000000000000000000000
                {
                    "dest": {
                        "v1": {
                            "parents": 1,
                            "interior": {
                                "x1": {
                                    "parachain": 888
                                }
                            }
                        }
                    },
                    "fee_location": {
                        "v1": {
                            "parents": 1,
                            "interior": {
                                "x2": [
                                    {
                                        "parachain": 888
                                    },
                                    {
                                        "palletInstance": 3
                                    }
                                ]
                            }
                        }
                    },
                    "dest_weight": 10000000000,
                    "call": {
                        "callIndex": "0x2600",
                        "section": "ethereumXcm",
                        "method": "transact",
                        "args": {
                            "xcm_transaction": {
                                "v1": {
                                    "gasLimit": 300000,
                                    "feePayment": {
                                        "auto": null
                                    },
                                    "action": {
                                        "call": "0x11246ff6b1900bd864d1b603e6d8f093b87828e3"
                                    },
                                    "value": 0,
                                    "input": "0x5d3a1f9d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000e476f726b6120426574612058434d000000000000000000000000000000000000",
                                    "accessList": null
                                }
                            }
                        }
                    }
                }
                //xcmtransactor (TransactedSigned)
                TODO: how do we encode call back to its raw form? 260000e093040000000000000000000000000000000000000000000000000000000000010011246ff6b1900bd864d1b603e6d8f093b87828e3000000000000000000000000000000000000000000000000000000000000000091015d3a1f9d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000e476f726b6120426574612058434d00000000000000000000000000000000000000
                */

                // dest processing
                if (a.dest != undefined) {
                    let dest = a.dest
                    let [paraIDDest1, chainIDDest1] = this.processTransactorDest(dest, relayChain)
                    if (paraIDDest1 !== false) paraIDDest = paraIDDest1
                    if (chainIDDest1 !== false) chainIDDest = chainIDDest1
                }

                // fee_location processing
                let targetedSymbol = false
                let targetedXcmInteriorKey = false
                if (a !== undefined && a.fee_location !== undefined) {
                    let feelocation = a.fee_location
                    let [feeSymbol, feeRelayChain] = this.processFeeLocation(indexer, feelocation, relayChain)
                    if (feeSymbol) {
                        targetedSymbol = feeSymbol
                        let [feeXcmInteriorKey] = indexer.check_refintegrity_xcm_symbol(targetedSymbol, feeRelayChain, chainID, chainIDDest, "processFeeLocation", "moonbeam xcmTransactor:transactThroughSignedMultilocation", feelocation)
                        if (feeXcmInteriorKey) targetedXcmInteriorKey = feeXcmInteriorKey
                    }
                }

                // get msgHash, innerCall from event
                let [msgHash, innerCall] = this.getMsgHashAndInnerCall(indexer, extrinsic, feed)
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSignedMultilocation msgHash=${msgHash}, innerCall=${innerCall}`)
                //r.asset = asset
                //r.rawAsset = rawAsset
                r.xcmInteriorKey = targetedXcmInteriorKey,
                r.xcmSymbol = targetedSymbol
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                r.msgHash = msgHash
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSignedMultilocation`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)
            } else if (section_method == "xcmTransactor:transactThroughSigned") {
                /*
                {
                    "dest": {
                        "v1": {
                            "parents": 1,
                            "interior": {
                                "x1": {
                                    "parachain": 888
                                }
                            }
                        }
                    },
                    "fee_currency_id": {
                        "foreignAsset": "0x1ab2b146c526d4154905ff12e6e57675"
                    },
                    "dest_weight": 5000000000,
                    "call": {
                        "callIndex": "0x2600",
                        "section": "ethereumXcm",
                        "method": "transact",
                        "args": {
                            "xcm_transaction": {
                                "v1": {
                                    "gasLimit": 3000000000,
                                    "feePayment": {
                                        "auto": null
                                    },
                                    "action": {
                                        "call": "0x11246ff6b1900bd864d1b603e6d8f093b87828e3"
                                    },
                                    "value": 0,
                                    "input": "0x5d3a1f9d000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000074265746158434d00000000000000000000000000000000000000000000000000",
                                    "accessList": null
                                }
                            }
                        }
                    }
                }
                */
                // dest processing
                if (a.dest != undefined) {
                    let dest = a.dest
                    let [paraIDDest1, chainIDDest1] = this.processTransactorDest(dest, relayChain)
                    if (paraIDDest1 !== false) paraIDDest = paraIDDest1
                    if (chainIDDest1 !== false) chainIDDest = chainIDDest1
                }

                // fee_current_id processing
                //asset = this.processGenericCurrencyID(indexer, a.fee_currency_id) //inferred approach
                //rawAsset = this.processRawGenericCurrencyID(indexer, a.fee_currency_id)
                let targetedSymbol = this.processXcmGenericCurrencyID(indexer, a.currency_id) //inferred approach
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "moonbeam xcmTransactor:transactThroughSigned", a.currency_id)


                // get msgHash, innerCall from event
                let [msgHash, innerCall] = this.getMsgHashAndInnerCall(indexer, extrinsic, feed)
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSigned msgHash=${msgHash}, innerCall=${innerCall}`)
                r.xcmInteriorKey = targetedXcmInteriorKey,
                r.xcmSymbol = targetedSymbol,
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                r.msgHash = msgHash
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSigned`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)
            } else if (section_method == "xcmTransactor:transactThroughSovereign") {
                // dest processing
                if (a.dest != undefined) {
                    let dest = a.dest
                    let [paraIDDest1, chainIDDest1] = this.processTransactorDest(dest, relayChain)
                    if (paraIDDest1 !== false) paraIDDest = paraIDDest1
                    if (chainIDDest1 !== false) chainIDDest = chainIDDest1
                }
                // fee_payer processing -- skip

                // fee_location processing
                let targetedSymbol = false
                let targetedXcmInteriorKey = false
                if (a !== undefined && a.fee_location !== undefined) {
                    let feelocation = a.fee_location
                    let [feeSymbol, feeRelayChain] = this.processFeeLocation(indexer, feelocation, relayChain)
                    if (feeSymbol) {
                        targetedSymbol = feeSymbol
                        let [feeXcmInteriorKey] = indexer.check_refintegrity_xcm_symbol(targetedSymbol, feeRelayChain, chainID, chainIDDest, "processFeeLocation", "moonbeam xcmTransactor:transactThroughSovereign", feelocation)
                        if (feeXcmInteriorKey) targetedXcmInteriorKey = feeXcmInteriorKey
                    }
                }

                // inner_call processing
                innerCall = (a.inner_call != undefined) ? a.inner_call : 'notfound'
                r.xcmInteriorKey = targetedXcmInteriorKey,
                r.xcmSymbol = targetedSymbol,
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                r.msgHash = msgHash
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSovereign`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)

            } else {
                console.log(`!!! NOT COVERED [${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} `, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)
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

    processTransactorDest(dest, relayChain) {
        // dest processing
        let paraIDDest = false;
        let chainIDDest = false;

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
        return [paraIDDest, chainIDDest]
    }

    processFeeLocation(indexer, feelocation, relayChain) {
        /*
        "fee_location": {
            "v1": {
                "parents": 1,
                "interior": {
                    "x2": [
                        {
                            "parachain": 888
                        },
                        {
                            "palletInstance": 3
                        }
                    ]
                }
            }
        }
        */
        let paraIDExtra = paraTool.getParaIDExtra(relayChain)
        let targetedAsset = false;
        let rawTargetedAsset = false;
        let targetSymbol = false;
        if (feelocation.v1 != undefined) {
            let feelocation_v1 = feelocation.v1
            let feelocation_v1_interior = feelocation_v1.interior
            let feelocation_v1_parents = feelocation_v1.parents
            if (feelocation_v1_interior != undefined && feelocation_v1_parents.here !== undefined) {
                if (feelocation_v1_parents != undefined && feelocation_v1_parents == 0) {
                    //normal case?
                    targetSymbol = indexer.getNativeSymbol()
                    //targetedAsset = indexer.getNativeSymbol()
                    //rawTargetedAsset = indexer.getNativeSymbol()
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`processFeeLocation targetedAsset parents:0, here`, targetedSymbol)
                } else if (feelocation_v1_parents != undefined && feelocation_v1_parents == 1) {
                    //ump
                    targetSymbol = indexer.getRelayChainSymbol()
                    //targetedAsset = indexer.getRelayChainAsset()
                    //rawTargetedAsset = indexer.getRelayChainAsset()
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`processFeeLocation targetedAsset parents:1, here`, targetedSymbol)
                }
                //} else if (v1_id_concrete_interior != undefined && v1_id_concrete_interior.x2 !== undefined && Array.isArray(v1_id_concrete_interior.x2)) {
            } else {
                //v1_id_concrete_interior case [x1/x2/x3]
                //TODO: this is outcoming - relaychain's perspective
                let xType = Object.keys(feelocation_v1_interior)[0]
                let feelocation_v1_interiorVal = feelocation_v1_interior[xType]
                if (feelocation_v1_parents == 1) {
                    // easy case: no expansion
                } else {
                    // expand the key
                    let new_feelocation_v1_interiorVal = []
                    let paraChainID = indexer.chainID - paraIDExtra
                    let expandedParachainPiece = {
                        parachain: paraChainID
                    }
                    new_feelocation_v1_interiorVal.push(expandedParachainPiece)
                    if (xType == 'x1') {
                        new_feelocation_v1_interiorVal.push(feelocation_v1_interiorVal)

                    } else if (Array.isArray(feelocation_v1_interiorVal)) {
                        //x2/x3...
                        for (const v of feelocation_v1_interiorVal) {
                            new_feelocation_v1_interiorVal.push(v)
                            if (this.debugLevel >= paraTool.debugInfo) console.log(`${indexer.chainID}, [parents=${feelocation_v1_interiorVal}] expandedkey ${JSON.stringify(feelocation_v1_interiorVal)} ->  ${JSON.stringify(new_feelocation_v1_interiorVal)}`)
                        }
                        //new_v1_id_concrete_interiorVal.concat(v1_id_concrete_interiorVal)
                    } else {
                        if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`processV1ConcreteFungible error. expecting array`, JSON.stringify(feelocation_v1_interiorVal))
                    }
                    feelocation_v1_interiorVal = new_feelocation_v1_interiorVal
                }

                let interiorVStr = JSON.stringify(feelocation_v1_interiorVal)
                let xcmInteriorKey = paraTool.makeXcmInteriorKey(interiorVStr, relayChain)
                let cachedXcmAssetInfo = indexer.getXcmAssetInfoByInteriorkey(xcmInteriorKey)
                if (cachedXcmAssetInfo != undefined && cachedXcmAssetInfo.nativeAssetChain != undefined) {
                    targetSymbol = cachedXcmAssetInfo.symbol
                    targetedAsset = cachedXcmAssetInfo.asset
                    //rawTargetedAsset = cachedXcmAssetInfo.asset
                    if (cachedXcmAssetInfo.paraID == 1000) {
                        //statemine/statemint
                        let nativeChainID = paraIDExtra + 1000
                        let t = JSON.parse(targetedAsset)
                        let currencyID = t.Token
                        let symbol = indexer.getCurrencyIDSymbol(currencyID, nativeChainID);
                        targetSymbol = symbol
                    }
                } else {
                    if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`processV1ConcreteFungible cachedXcmAssetInfo lookup failed! parents=[${feelocation_v1_interiorVal}] [${xType}]`, xcmInteriorKey)
                    //targetedAsset = interiorVStr
                    //rawTargetedAsset = interiorVStr
                }
            }

        } else {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`processFeeLocation unknown unknown!`, JSON.stringify(feelocation, null, 2))
        }
        return [targetSymbol, relayChain]
    }
}
