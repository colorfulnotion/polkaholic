const paraTool = require("../paraTool");
const ethTool = require("../ethTool");

const ChainParser = require("./chainparser");

module.exports = class MoonbeamParser extends ChainParser {

    xcmTransactorMethodList = ["0xfe430475", "0x185de2ae", "0xd7ab340c", "0xb648f3fe"];

    processIncomingXCM(indexer, extrinsic, extrinsicID, events, isTip = false, finalized = false) {
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
                            indexer.updateXCMTransferDestCandidate(candidate, caller, isTip)
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


    // we are actually getting inner call from the event
    getMsgHashAndInnerCall(indexer, extrinsic, feed) {
        let msgHash = '0x'
        let innerCall = '0x'
        let events = feed.events
        for (let i = 0; i < events.length; i++) {
            let e = events[i]
            let eventMethodSection = `${e.section}(${e.method})`
            if (eventMethodSection == 'xcmTransactor(TransactedSigned)') {
                /*
                {
                    "parents": 1,
                    "interior": {
                        "x2": [
                            {
                                "parachain": 1000
                            },
                            {
                                "accountKey20": {
                                    "network": {
                                        "any": null
                                    },
                                    "key": "0x44236223ab4291b93eed10e4b511b37a398dee55"
                                }
                            }
                        ]
                    }
                }
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
                if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoing XCMTransactor`, outgoingXcmList4)
                //return outgoingXcmList
                break;
            case 'ethereum':
                if (module_method == 'transact') {
                    let isEthereumXCM = this.etherumXCMFilter(indexer, args, feed.events)
                    if (isEthereumXCM) {
                        if (this.debugLevel >= paraTool.debugInfo) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] EthereumXCM found`, args)
                        let outgoingXcmList5 = this.processOutgoingEthereum(indexer, extrinsic, feed, fromAddress, section_method, args.decodedEvmInput)
                        if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingXCM ethereum`, outgoingXcmList5)
                        //return outgoingXcmList
                    }
                }
                break;
            default:
                //console.log(`unknown`)
                //return outgoingXcmList
                break;
        }
    }

    etherumXCMFilter(indexer, args, events) {
        if (args.transaction != undefined) {
            let evmTx = false;
            if (args.transaction.eip1559 != undefined) {
                evmTx = args.transaction.eip1559
            } else if (args.transaction.legacy != undefined) {
                evmTx = args.transaction.legacy
            }
            //console.log(`evmTx`, evmTx)
            /*
            transactThroughDerivativeMultilocation: 0xfe430475
            transactThroughDerivative: 0x185de2ae
            transactThroughSignedMultilocation: 0xd7ab340c
            transactThroughSigned: 0xb648f3fe
            */
            if (evmTx && evmTx.input != undefined) {
                let txInput = evmTx.input
                let txMethodID = txInput.substr(0, 10)
                if (this.xcmTransactorMethodList.includes(txMethodID)) {
                    let output = ethTool.decodeTransactionInput(evmTx, indexer.contractABIs, indexer.contractABISignatures)
                    for (const ev of events) {
                        let eventMethodSection = `${ev.section}(${ev.method})`
                        if (eventMethodSection == 'balances(Withdraw)') {
                            //this is the fromAddress (ss58)
                            output.fromAddress = paraTool.getPubKey(ev.data[0])
                            break;
                        }
                    }
                    let xcmInput = {}
                    for (let i = 0; i < output.params.length; i++) {
                        let input = output.params[i]
                        xcmInput[input.name] = input.value
                    }
                    output.params = xcmInput
                    console.log(`output >>`, JSON.stringify(output, null, 2))
                    if (output != undefined) {
                        args.decodedEvmInput = output
                    }
                    return true
                }
            }
        }
        return false
    }

    /*
    "dest": [
      "1",
      [
        "0x0000000378"
      ]
    ],
    "dest": {
        "v1": {
            "parents": 1,
            "interior": {
                "x1": {
                    "parachain": 1000
                }
            }
        }
    }
    */
    convertMultilocationFromHex(hex = '0x0000000378', isUppercase = false) {
        let selector = hex.substr(0, 4)
        let data = '0x' + hex.substr(4)
        let selectorType = 'NA'
        let decodedType = {}
        switch (selector) {
            case "0x00": //Parachain, bytes4
                selectorType = (isUppercase) ? "Parachain" : "parachain"
                // "0x00+000007E7" -> 2023
                let paraID = paraTool.dechexToInt(data)
                decodedType[selectorType] = paraID
                break;
            case "0x01": //AccountId32, bytes32
                selectorType = (isUppercase) ? "AccountId32" : "accountId32"
                let networkType = data.substr(66)
                let networkName = 'Any'
                if (networkType.substr(0, 2) == '01') networkName = {
                    Named: networkType.substr(2)
                } // not sure?
                if (networkType.substr(0, 2) == '02') networkName = 'Polkadot'
                if (networkType.substr(0, 2) == '03') networkName = 'Kusama'
                let account32 = data.substr(0, 66)
                decodedType[selectorType] = {
                    network: networkName,
                    key: account32
                }
                break;
            case "0x02": //AccountIndex64, byte8 via u64
                selectorType = (isUppercase) ? "AccountIndex64" : "accountIndex64"
                let networkTypeA = data.substr(16)
                let networkNameA = 'Any'
                if (networkTypeA.substr(0, 2) == '01') networkNameA = {
                    Named: networkTypeA.substr(2)
                } // not sure?
                if (networkTypeA.substr(0, 2) == '02') networkNameA = 'Polkadot'
                if (networkTypeA.substr(0, 2) == '03') networkNameA = 'Kusama'
                let accountIndex64 = paraTool.dechexToInt(data.substr(0, 34))
                decodedType[selectorType] = {
                    network: networkNameA,
                    index: accountIndex64
                }
                break;
            case "0x03": //AccountKey20, bytes20
                selectorType = (isUppercase) ? "AccountKey20" : "accountKey20"
                let networkTypeB = data.substr(42)
                let networkNameB = 'Any'
                if (networkTypeB.substr(0, 2) == '01') networkNameB = {
                    Named: networkTypeB.substr(2)
                } // not sure?
                if (networkTypeB.substr(0, 2) == '02') networkNameB = 'Polkadot'
                if (networkTypeB.substr(0, 2) == '03') networkNameB = 'Kusama'
                let account20 = data.substr(0, 42)
                decodedType[selectorType] = {
                    network: networkName,
                    key: account20
                }
                break;
            case "0x04": //PalletInstance, byte
                selectorType = (isUppercase) ? "PalletInstance" : "palletInstance"
                let palletInstanceID = paraTool.dechexToInt(data)
                decodedType[selectorType] = palletInstanceID
                break;
            case "0x05": //GeneralIndex, byte16 via u128
                selectorType = (isUppercase) ? "GeneralIndex" : "generalIndex"
                let generalIndexID = paraTool.dechexToInt(data)
                decodedType[selectorType] = generalIndexID
                break;
            case "0x06": //GeneralKey, bytes[]
                selectorType = (isUppercase) ? "GeneralKey" : "generalKey"
                decodedType[selectorType] = data
                break;
            case "0x07": //OnlyChild, ???
                selectorType = (isUppercase) ? "OnlyChild" : "onlyChild"
                break;
            case "0x08": //plurality, ???
                selectorType = (isUppercase) ? "Plurality" : "plurality"
                break;
            default:
                break;
        }
        return decodedType
    }

    //see https://docs.moonbeam.network/builders/xcm/xcm-transactor/
    convertMultilocationByteToMultilocation(dest, isUppercase = false) {
        let v1 = {
            parents: 0,
            interior: {},
        }
        let cDest = {
            v1: v1
        }
        if (dest.length != 2) {
            console.log('Invalid dest')
            return false
        }
        v1.parents = paraTool.dechexToInt(dest[0])
        let interior = dest[1]
        let interiorN = interior.length
        let interiorType = (isUppercase) ? `X${interiorN}` : `x${interiorN}`
        if (interiorN == 0) {
            v1.interior = {
                here: null
            }
        } else if (interiorN == 1) {
            let decodedType = this.convertMultilocationFromHex(interior[0])
            v1.interior[interiorType] = decodedType
        } else {
            let interiorValArr = []
            for (const inter of interior) {
                let decodedType = this.convertMultilocationFromHex(inter)
                interiorValArr.push(decodedType)
            }
            v1.interior[interiorType] = interiorValArr
        }
        cDest.v1 = v1
        console.log(`dest ${JSON.stringify(dest, null, 4)} -> cDest ${JSON.stringify(cDest, null, 4)}`)
        return cDest
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

    processOutgoingEthereum(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // need additional processing for currency_id part
        let outgoingEtherumXCM = []
        if (extrinsic.xcms == undefined) extrinsic.xcms = []
        try {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`moonbeam processOutgoingEthereum start`)
            let a = args
            let params = a.params
            let methodID = a.methodID
            if (a.fromAddress != undefined) fromAddress = a.fromAddress
            //console.log(`a`, a)
            //console.log(`params`, params)
            if (extrinsic.xcms == undefined) extrinsic.xcms = []
            let xcmIndex = extrinsic.xcms.length
            let destAddress = '0x' //unknown
            let isFeeItem = 1 // irrelevant?
            let transferIndex = 0
            let relayChain = indexer.relayChain
            let chainID = indexer.chainID
            let paraID = paraTool.getParaIDfromChainID(chainID)
            let chainIDDest = null;
            let paraIDDest = null;
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
                asset: false, //unknown
                rawAsset: false, //unknown
                sourceTS: feed.ts,
                amountSent: 0, // unknown
                incomplete: incomplete,
                isFeeItem: isFeeItem,
                msgHash: '0x',
                sentAt: this.parserWatermark,
                xcmSymbol: null, // unknown
                xcmInteriorKey: null, // unknown
                innerCall: innerCall,
                xcmType: "xcmtransact",
            }
            /*
            0xfe430475: transactThroughDerivativeMultilocation
            0x185de2ae: transactThroughDerivative
            0xd7ab340c: transactThroughSignedMultilocation
            0xb648f3fe: transactThroughSigned
            */
            if (methodID == '0xb648f3fe' || methodID == '0xd7ab340c') {
                let ethereumMethod = (methodID == '0xb648f3fe') ? 'transactThroughSigned' : 'transactThroughSignedMultilocation'
                /*
                {
                    "decodeStatus": "success",
                    "methodID": "0xb648f3fe",
                    "signature": "transactThroughSigned((uint8 parents, bytes[] interior), address feeLocationAddress, uint64 transactRequiredWeightAtMost, bytes call, uint256 feeAmount, uint64 overallWeight)",
                    "params": {
                        "dest": [
                            "1",
                            [
                                "0x0000000378"
                            ]
                        ],
                        "feeLocationAddress": "0xffffffff1ab2b146c526d4154905ff12e6e57675",
                        "transactRequiredWeightAtMost": "8000000000",
                        "call": "0x260000e093040000000000000000000000000000000000000000000000000000000000010049ba58e2ef3047b1f90375c79b93578d90d24e24000000000000000000000000000000000000000000000000000000000000000010cde4efa900",
                        "feeAmount": "30000000000000000",
                        "overallWeight": "15000000000"
                    },
                    "fromAddress": "0xdcb4651b5bbd105cda8d3ba5740b6c4f02b9256d"
                }
                */

                try {
                    // process Dest
                    let syntheticDest = this.convertMultilocationByteToMultilocation(params.dest)

                    let [paraIDDest1, chainIDDest1] = this.processTransactorDest(syntheticDest, relayChain)
                    if (paraIDDest1 !== false) paraIDDest = paraIDDest1
                    if (chainIDDest1 !== false) chainIDDest = chainIDDest1

                    //process fee
                    let syntheticFee = {}
                    let feeRaw = null
                    if (ethereumMethod == 'transactThroughSigned') {
                        feeRaw = params.feeLocationAddress
                        let xcAssetID = paraTool.contractAddrToXcAssetID(feeRaw)
                        let xcAssetIDHex = paraTool.bnToHex(xcAssetID)
                        syntheticFee = {
                            currency: {
                                asCurrencyId: {
                                    foreignAsset: xcAssetIDHex
                                }
                            },
                            feeAmount: paraTool.bnToHex(params.feeAmount)
                        }
                    } else if (ethereumMethod == 'transactThroughSignedMultilocation') {
                        feeRaw = params.feeLocation
                        try {
                            let syntheticFeeLocation = this.convertMultilocationByteToMultilocation(feeRaw)
                            syntheticFee = {
                                currency: {
                                    asMultiLocation: {
                                        v1: syntheticFeeLocation
                                    }
                                },
                                feeAmount: paraTool.bnToHex(params.feeAmount)
                            }
                        } catch (e2) {
                            console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] process syntheticFeeLocation err`, e2)
                        }
                    }
                    let targetedSymbol = false
                    try {
                        let [extractedSymbol, _] = this.processFeeStruct(indexer, syntheticFee, relayChain)
                        targetedSymbol = extractedSymbol
                    } catch (e) {
                        console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] process syntheticFee err`, e)
                    }
                    let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processFeeStruct", `moonbeam ethereum:${ethereumMethod}`, feeRaw)

                    // get msgHash, innerCall from event
                    let [msgHash, innerCall] = this.getMsgHashAndInnerCall(indexer, extrinsic, feed)

                    // weight_info
                    let weight_info = {
                        transactRequiredWeightAtMost: paraTool.dechexToInt(params.transactRequiredWeightAtMost),
                        overallWeight: null
                    }

                    // compute derivedAccount at destChain
                    try {
                        let isEVM = indexer.getChainEVMStatus(chainIDDest)
                        let [derivedAccount20, derivedAccount32] = this.calculateMultilocationDerivative(indexer.api, paraID, fromAddress)
                        r.destAddress = (isEVM) ? derivedAccount20 : derivedAccount32
                    } catch (e) {
                        console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=ethereum:${ethereumMethod} calculateMultilocationDerivative failed`, e)
                    }

                    r.xcmInteriorKey = targetedXcmInteriorKey
                    r.xcmSymbol = targetedSymbol
                    r.chainIDDest = chainIDDest
                    r.paraIDDest = paraIDDest
                    r.innerCall = innerCall
                    r.msgHash = msgHash
                    console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=ethereum:${ethereumMethod}`, r)
                    extrinsic.xcms.push(r)
                    outgoingEtherumXCM.push(r)
                } catch (e1) {
                    console.log(`processOutgoingEthereum:${ethereumMethod} err`, e1)
                }
            } else if (methodID == '0x185de2ae' || methodID == '0xfe430475') {
                //transactThroughDerivative
                let ethereumMethod = (methodID == '0x185de2ae') ? 'transactThroughDerivative' : 'transactThroughDerivativeMultilocation'
                console.log(`TODO [${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method:${ethereumMethod}`, r)
            }
            return outgoingEtherumXCM
        } catch (e) {
            if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] ${e.toString()}`)
            return
        }
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
            xcmSymbol: null,
            xcmInteriorKey: null,
            innerCall: innerCall,
            xcmType: "xcmtransact",
        }
        try {
            /*
            MK:
            {transactThroughSigned, transactThroughDerivative} express fee paying via {asCurrencyId, asMultiLocation}

            */
            /* Known cases:

            xcmTransactor:transactThroughSigned         0x1c3d1f60c155d68da57c184a7e77507515140f5d6b3cc93d4d634822115fb893/0xf4673308b8bb3013a6772e3fb6e7bece136abeee098343cc325e9e710bae6478/0xc068c7f643abfd75701974eba03cfdf671a89b2ebe797671ce8e4ae7ef367185
            xcmTransactor:transactThroughDerivative     0x9f6a5ac8575ad65910972a496ab328a048a34b7ebc654cce6cfeb2295d1d4392
            xcmTransactor:transactThroughSovereign      0xfab404024caceb70685d10b8ab8fc2c27783e4a8ed4bc0598f330f5c4b877d80 [untested]

            */

            console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} args`, a)
            //console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} default`, r)
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

                // reject legacy fee_currency_id
                if (a.currency_id != undefined) {
                    console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughDerivative skip old version`)
                    return outgoingXcmPallet
                }

                // dest processing
                chainIDDest = paraTool.getRelayChainID(relayChain)
                paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)

                // fee processing
                let targetedSymbol = false
                if (a.fee != undefined && a.fee.currency != undefined && a.fee.feeAmount !== undefined) {
                    let [extractedSymbol, _] = this.processFeeStruct(indexer, a.fee, relayChain)
                    targetedSymbol = extractedSymbol
                }
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "moonbeam xcmTransactor:transactThroughSigned", a.fee)

                //inner_call processing
                innerCall = (a.inner_call != undefined) ? a.inner_call : 'notfound'
                r.xcmInteriorKey = targetedXcmInteriorKey
                r.xcmSymbol = targetedSymbol
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                console.log(`[${extrinsic.extrinsicHash}] section_method=${section_method} here 4`)
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughDerivative`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)

            } else if (section_method == "xcmTransactor:transactThroughSigned") {
                /*
                // New version components: dest, fee, call, weight_info
                {
                        "dest": {
                            "v1": {
                                "parents": 1,
                                "interior": {
                                    "x1": {
                                        "parachain": 1000
                                    }
                                }
                            }
                        },
                        "fee": {
                            "currency": {
                                "asMultiLocation": {
                                    "v1": {
                                        "parents": 1,
                                        "interior": {
                                            "x2": [
                                                {
                                                    "parachain": 1000
                                                },
                                                {
                                                    "palletInstance": 3
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            "feeAmount": "0x0000000000000000006a94d74f430001"
                        },
                        "call": {
                            "callIndex": "0x2600",
                            "section": "ethereumXcm",
                            "method": "transact",
                            "args": {
                                "xcm_transaction": {
                                    "v1": {
                                        "gasLimit": 300123,
                                        "feePayment": {
                                            "auto": null
                                        },
                                        "action": {
                                            "call": "0xffffffff1fcacbd218edc0eba20fc2308c778080"
                                        },
                                        "value": 0,
                                        "input": "0x095ea7b30000000000000000000000008a1932d6e26433f3037bd6c3a40c816222a6ccd4ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                                        "accessList": null
                                    }
                                }
                            }
                        },
                        "weight_info": {
                            "transactRequiredWeightAtMost": 8000000000,
                            "overallWeight": null
                        }
                    }

                */

                // reject legacy fee_currency_id
                if (a.fee_currency_id != undefined) {
                    console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSigned skip old version`)
                    return outgoingXcmPallet
                }

                // dest processing
                if (a.dest != undefined) {
                    let dest = a.dest
                    let [paraIDDest1, chainIDDest1] = this.processTransactorDest(dest, relayChain)
                    if (paraIDDest1 !== false) paraIDDest = paraIDDest1
                    if (chainIDDest1 !== false) chainIDDest = chainIDDest1
                }

                // fee processing
                let targetedSymbol = false
                /*
                {
                    "currency": {
                        "asCurrencyId": {
                            "foreignAsset": "0x1ab2b146c526d4154905ff12e6e57675"
                        }
                    },
                    "feeAmount": "0x0000000000000000006a94d74f430000"
                }

                */
                if (a.fee != undefined && a.fee.currency != undefined && a.fee.feeAmount !== undefined) {
                    let [extractedSymbol, _] = this.processFeeStruct(indexer, a.fee, relayChain)
                    targetedSymbol = extractedSymbol
                }
                //let targetedSymbol = this.processXcmGenericCurrencyID(indexer, a.currency_id) //inferred approach
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "moonbeam xcmTransactor:transactThroughSigned", a.fee)

                // get msgHash, innerCall from event
                let [msgHash, innerCall] = this.getMsgHashAndInnerCall(indexer, extrinsic, feed)
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSigned msgHash=${msgHash}, innerCall=${innerCall}`)

                //processing weight_info
                if (a.weight_info != undefined) {
                    //TODO
                }
                try {
                    let isEVM = indexer.getChainEVMStatus(chainIDDest)
                    let [derivedAccount20, derivedAccount32] = this.calculateMultilocationDerivative(indexer.api, paraID, fromAddress)
                    r.destAddress = (isEVM) ? derivedAccount20 : derivedAccount32
                } catch (e) {
                    console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSigned calculateMultilocationDerivative failed`, e)
                }
                r.xcmInteriorKey = targetedXcmInteriorKey
                r.xcmSymbol = targetedSymbol
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                r.msgHash = msgHash
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSigned`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)
            } else if (section_method == "xcmTransactor:transactThroughSovereign") {
                // guessing here..

                // reject legacy fee_location
                if (a.fee_location != undefined) {
                    console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSovereign skip old version`)
                    return outgoingXcmPallet
                }

                // dest processing
                if (a.dest != undefined) {
                    let dest = a.dest
                    let [paraIDDest1, chainIDDest1] = this.processTransactorDest(dest, relayChain)
                    if (paraIDDest1 !== false) paraIDDest = paraIDDest1
                    if (chainIDDest1 !== false) chainIDDest = chainIDDest1
                }
                // fee_payer processing
                let feePayer = '0x' // account20
                if (a.fee_payer != undefined) {
                    feePayer = a.fee_payer
                }

                // fee_location processing
                let targetedSymbol = false
                if (a.fee != undefined && a.fee.currency != undefined && a.fee.feeAmount !== undefined) {
                    let [extractedSymbol, _] = this.processFeeStruct(indexer, a.fee, relayChain)
                    targetedSymbol = extractedSymbol
                }
                //let targetedSymbol = this.processXcmGenericCurrencyID(indexer, a.currency_id) //inferred approach
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "moonbeam xcmTransactor:transactThroughSigned", a.fee)

                // inner_call processing
                innerCall = (a.call != undefined) ? a.call : 'notfound'

                // originKind processing
                let originKind = 'NA'
                if (a.origin_kind != undefined) {
                    originKind = Object.keys(a.origin_kind)[0]
                }
                //processing weight_info
                if (a.weight_info != undefined) {
                    //TODO
                }
                r.xcmInteriorKey = targetedXcmInteriorKey
                r.xcmSymbol = targetedSymbol
                r.chainIDDest = chainIDDest
                r.paraIDDest = paraIDDest
                r.innerCall = innerCall
                r.msgHash = msgHash
                r.originKind = originKind
                console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=xcmTransactor:transactThroughSovereign`, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)

            } else {
                console.log(`!!! NOT COVERED [${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=${section_method} `, r)
                extrinsic.xcms.push(r)
                outgoingXcmPallet.push(r)
            }
        } catch (e) {
            if (indexer.debugLevel >= paraTool.debugErrorOnly) console.log(`processOutgoingXCMTransactor error`, e)
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

    /*
    {
        "currency": {
            "asCurrencyId": {
                "foreignAsset": "0x1ab2b146c526d4154905ff12e6e57675"
            }
        },
        "feeAmount": "0x0000000000000000006a94d74f430000"
    }
    {
        "currency": {
            "asMultiLocation": {
                "v1": {
                    "parents": 1,
                    "interior": {
                        "x2": [
                            {
                                "parachain": 1000
                            },
                            {
                                "palletInstance": 3
                            }
                        ]
                    }
                }
            }
        },
        "feeAmount": "0x0000000000000000006a94d74f430001"
    }
    */
    processFeeStruct(indexer, feeStruct, relayChain) {
        //TODO: feeAmount is not accurate and potentially null
        let feeCurrency = feeStruct.currency
        let feeType = Object.keys(feeCurrency)[0]
        let feeTypeStruct = feeCurrency[feeType]
        let targetedSymbol = false
        switch (feeType) {
            case "asCurrencyId":
                //let subType = Object.keys(feeTypeStruct)[0] //selfReserve/foreignAsset/LocalAssetReserve
                //let currencyID = feeTypeStruct[subType]
                let targetedSymbol0 = this.processXcmGenericCurrencyID(indexer, feeTypeStruct) //inferred approach
                console.log(`processFeeStruct ${feeType} ${targetedSymbol0}`, JSON.stringify(feeTypeStruct, null, 4))
                return [targetedSymbol0, relayChain]
            case "asMultiLocation":
                let [targetSymbol1, _] = this.processFeeMultiLocation(indexer, feeTypeStruct, relayChain)
                console.log(`processFeeStruct ${feeType} ${targetSymbol1}`, JSON.stringify(feeTypeStruct, null, 4))
                return [targetSymbol1, relayChain]
            default:
                console.log(`processFeeStruct new feeType ${feeType}`, feeStruct)
                break;
        }
        return [false, relayChain]
    }

    processFeeMultiLocation(indexer, feelocation, relayChain) {
        /*
        {
            "asMultiLocation": {
                "v1": {
                    "parents": 1,
                    "interior": {
                        "x2": [
                            {
                                "parachain": 1000
                            },
                            {
                                "palletInstance": 3
                            }
                        ]
                    }
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
                    console.log(`processFeeMultiLocation targetedAsset parents:0, here`, targetedSymbol)
                } else if (feelocation_v1_parents != undefined && feelocation_v1_parents == 1) {
                    //ump
                    targetSymbol = indexer.getRelayChainSymbol()
                    //targetedAsset = indexer.getRelayChainAsset()
                    //rawTargetedAsset = indexer.getRelayChainAsset()
                    console.log(`processFeeMultiLocation targetedAsset parents:1, here`, targetedSymbol)
                } else {}
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
                            console.log(`${indexer.chainID}, [parents=${feelocation_v1_interiorVal}] expandedkey ${JSON.stringify(feelocation_v1_interiorVal)} ->  ${JSON.stringify(new_feelocation_v1_interiorVal)}`)
                        }
                        //new_v1_id_concrete_interiorVal.concat(v1_id_concrete_interiorVal)
                    } else {
                        console.log(`processV1ConcreteFungible error. expecting array`, JSON.stringify(feelocation_v1_interiorVal))
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
                    if (cachedXcmAssetInfo.paraID == 1000 && relayChain != 'moonbase-relay') {
                        //statemine/statemint
                        let nativeChainID = paraIDExtra + 1000
                        let t = JSON.parse(targetedAsset)
                        let currencyID = t.Token
                        let symbol = indexer.getCurrencyIDSymbol(currencyID, nativeChainID);
                        targetSymbol = symbol
                    }
                } else {
                    console.log(`processV1ConcreteFungible cachedXcmAssetInfo lookup failed! parents=[${feelocation_v1_interiorVal}] [${xType}]`, xcmInteriorKey)
                    //targetedAsset = interiorVStr
                    //rawTargetedAsset = interiorVStr
                }
            }

        } else {
            console.log(`processFeeMultiLocation unknown unknown!`, JSON.stringify(feelocation, null, 2))
        }
        return [targetSymbol, relayChain]
    }
}