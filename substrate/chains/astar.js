const paraTool = require("../paraTool");
const ethTool = require("../ethTool");
const wasmTool = require("../wasmTool");

const ChainParser = require("./chainparser");

module.exports = class AstarParser extends ChainParser {

    xcmTransferMethodList = ["0xecf766ff", "0x019054d0", "0x106d59fe", "0x400c0e8d"];
    xcmTransactorMethodList = ["0xf90eb212"];

    processWasmContracts(indexer, extrinsic, feed, fromAddress, section = false, method = false, args = false) {
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
                this.processWasmContracts(indexer, extrinsic, feed, fromAddress, call_section, call_method, c_args)
            }
        } else if (args.call != undefined) {
            let call = args.call
            let call_args = call.args
            let call_section = call.section;
            let call_method = call.method;
            let isHexEncoded = (typeof call === 'object') ? false : true
            //console.log(`[${extrinsic.extrinsicID}] descend into call`, call)
            if (!isHexEncoded && call_args != undefined) {
                //if (this.debugLevel >= paraTool.debugTracing) console.log(`[${extrinsic.extrinsicID}] descend into call=${call}, call_section=${call_section}, call_method=${call_method}, call_args`, call_args)
                this.processWasmContracts(indexer, extrinsic, feed, fromAddress, call_section, call_method, call_args)
            } else {
                //if (this.debugLevel >= paraTool.debugTracing) console.log(`[${extrinsic.extrinsicID}] skip call=${call}, call_section=${call_section}, call_method=${call_method}, call.args`, call_args)
            }
        }
        switch (section_method) {
            case 'contracts:call': //contract write
                //0xd4ffe56c661d718cd4ca6039c0d5519aa3d20b0f32d6b18dc4809d60dd7b3d03
                let contactWrite = this.processContractsCall(indexer, extrinsic, feed, fromAddress, section_method, args)
                //if (this.debugLevel >= paraTool.debugInfo) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] contracts:call`, contactWrite)
                break;
            case 'contracts:instantiate': //contract deploy with available codehash
                //0x7e020cd122a51d4f037f95a86761f6af33228d0a8c68f8f79fd1f27c17885914
                let wasmWithoutCode = this.processContractsInstantiate(indexer, extrinsic, feed, fromAddress, section_method, args)
                //if (this.debugLevel >= paraTool.debugInfo) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] contracts:instantiate`, wasmWithoutCode)
                indexer.addWasmContract(wasmWithoutCode, wasmWithoutCode.withCode);
                break;
            case 'contracts:instantiateWithCode': //contract deploy with wasm code
                //0x2c986a6cb47b94a9e50f5d3f660e0f37177989594eb087bf7309c2e15e2340c8
                let wasmWithCode = this.processContractsInstantiateWithCode(indexer, extrinsic, feed, fromAddress, section_method, args)
                //if (this.debugLevel >= paraTool.debugInfo) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] contracts:instantiateWithCode`, wasmWithCode)
                indexer.addWasmContract(wasmWithCode, wasmWithCode.withCode);
                break;
            default:
                if (section_method.includes('contracts:')) {
                    /* unhandled cases
                    contracts:removeCode
                    contracts:setCode
                    contracts:uploadCode
                    */
                    //console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] unhandled contracts case: ${section_method}`)
                } else {
                    //console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] ${section_method}`)
                    break
                }
                break;
        }
    }

    processWasmDest(dest) {
        let destAddress = false
        if (dest == undefined) return destAddress
        try {
            let destK = Object.keys(dest)[0]
            let destV = dest[destK]
            if (destK == 'id' || destK == 'address20' || destK == 'address32') {
                destAddress = paraTool.getPubKey(destV)
            } else {
                //index, raw ??
            }
        } catch (e) {
            //console.log(`processWasmDest error=${e.toString()}`)
        }
        return destAddress
    }

    contractsEventFilter(palletMethod) {
        //let palletMethod = `${rewardEvent.section}(${rewardEvent.method})`
        switch (palletMethod) {
            case "contracts(ContractEmitted)":
                //this contract event
                return true
            case "contracts(CodeStored)":
                //this contract event
                return true
            case "contracts(Instantiated)":
                //this contract event
                return true
            default:
                if (palletMethod.includes('contracts(')) {
                    //console.log(`Uncovered contracts case: ${palletMethod}`)
                    return true
                } else {
                    return false
                }
        }
    }

    getWasmContractsEvent(indexer, extrinsic) {
        let wasmContractsEvents = [];
        extrinsic.events.forEach((ev) => {
            let palletMethod = `${ev.section}(${ev.method})`
            if (this.contractsEventFilter(palletMethod)) {
                wasmContractsEvents.push(ev)
            }
        })
        return wasmContractsEvents
    }

    processContractsCall(indexer, extrinsic, feed, fromAddress, section_method, args) {
        /*
        Makes a call to an account, optionally transferring some balance.
        # Parameters
        * `dest`: Address of the contract to call.
        * `value`: The balance to transfer from the `origin` to `dest`.
        * `gas_limit`: The gas limit enforced when executing the constructor.
        * `storage_deposit_limit`: The maximum amount of balance that can be charged from the
          caller to pay for the storage consumed.
        * `data`: The input data to pass to the contract.

        * If the account is a smart-contract account, the associated code will be
        executed and any value will be transferred.
        * If the account is a regular account, any value will be transferred.
        * If no account exists and the call value is not less than `existential_deposit`,
        a regular account will be created and any value will be transferred.
        */

        //contract write
        //0xd4ffe56c661d718cd4ca6039c0d5519aa3d20b0f32d6b18dc4809d60dd7b3d03 //indexPeriods 22007 2022-08-25 22
        //0xa0c23aa9bbb27e18bf48d7df1b51d83fb8be73ed111bd375b40f2ab02f281554 //indexPeriods 22007 2022-08-18 23
        //0x89efa3f036dbbc545a9f748a18e7c1b07bbad459f31becbd259dfcea5e7b230c //indexPeriods 22007 2022-06-27 14
        /*
        //Sending 1.23456e-13 WLK (decimals 18) from Z4wzSczja5Va2wAsVJEoiLK9i882FUjWWdDnZDrtPzxYp8z to WwjA4NLgbAKgapEvKf86LNk7gcqSQhsNUTN2AXSc6JPjQf4
        {
          "dest": {
            "id": "Xd87RRvCB7JuF3LUYvhNRwgV9WfhkhUJApj45EP5dcDrSi1"
          },
          "value": 0,
          "gas_limit": 9375000000,
          "storage_deposit_limit": null,
          "data": "0xdb20f9f52c8feeab5bd9a317375e01adb6cb959f1fea78c751936d556fa2e36ede425a4740e2010000000000000000000000000000"
        }
        */
        //console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] [${section_method}]`, args)
        let wasmContractsEvents = this.getWasmContractsEvent(indexer, extrinsic)
        let r = {
            chainID: indexer.chainID,
            extrinsicHash: extrinsic.extrinsicHash,
            extrinsicID: extrinsic.extrinsicID,
            blockNumber: this.parserBlockNumber,
            blockTS: this.parserTS,
            contractAddress: this.processWasmDest(args.dest), //???
            value: paraTool.dechexToInt(args.value),
            gasLimit: paraTool.dechexToInt(args.gas_limit),
            storageDepositLimit: args.storage_deposit_limit,
            data: args.data,
            events: wasmContractsEvents,
            decodedInput: [], //stub
            decodedEvents: [], //stub
        }
        for (const ev of wasmContractsEvents) {
            let eventMethodSection = `${ev.section}(${ev.method})`
            //console.log(`[${ev.eventID}] ${eventMethodSection}`, ev)
            if (eventMethodSection == 'contracts(ContractEmitted)') {
                // WARNING: contract address here is not the same as called contract
                /* contractAddr, encodedEvents ["anCpiHdWuGUiQbsrqsbmYyRzdG4zP8LzmnyDy9GZxQS28Yq","0x000001d2ae8d7ab7db366b2451da59e1af3eb2398315c512d0cc400a9d70566f76e96040420f00000000000000000000000000"]*/
            }
        }
        return r
    }

    processContractsInstantiate(indexer, extrinsic, feed, fromAddress, section_method, args) {
        //contract deploy with available codehash
        //0x7e020cd122a51d4f037f95a86761f6af33228d0a8c68f8f79fd1f27c17885914 //indexPeriods 22007 2022-07-14 16
        /*
        {
          "value": 0,
          "gas_limit": 50000000000,
          "storage_deposit_limit": null,
          "code_hash": "0x2ee96717cdadbfa9e27e99e4b2c3aa4f2ca6d75332ad20803cd9022b6959f869",
          "data": "0xed4b9d1b",
          "salt": "0x"
        }
        */
        //console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] [${section_method}]`, args)
        let wasmContractsEvents = this.getWasmContractsEvent(indexer, extrinsic)
        let r = {
            chainID: indexer.chainID,
            extrinsicHash: extrinsic.extrinsicHash,
            extrinsicID: extrinsic.extrinsicID,
            blockNumber: this.parserBlockNumber,
            blockTS: this.parserTS,
            contractAddress: null,
            value: paraTool.dechexToInt(args.value),
            gasLimit: paraTool.dechexToInt(args.gas_limit),
            storageDepositLimit: args.storage_deposit_limit,
            code: null, // need to match with already deployed codeHash
            withCode: false,
            codeHash: args.code_hash,
            deployer: null,
            constructor: args.data, // The input data to pass to the contract constructor
            salt: args.salt, // Used for the address derivation. See [`Pallet::contract_address`]??
            events: wasmContractsEvents,
        }
        for (const ev of wasmContractsEvents) {
            let eventMethodSection = `${ev.section}(${ev.method})`
            //console.log(`[${ev.eventID}] ${eventMethodSection}`, ev)
            if (eventMethodSection == 'contracts(Instantiated)') {
                /* deployer, contract ["ZM24FujhBK3XaDsdkpYBf4QQAvRkoMq42aqrUQnxFo3qrAw","aCwSHJ6wyKHFrYBMFqEpNQ4xPzw7nm3jLv9u3fH7eWMPj6z"]*/
                r.deployer = paraTool.getPubKey(ev.data[0])
                r.contractAddress = paraTool.getPubKey(ev.data[1])
            }
        }
        return r
    }

    processContractsInstantiateWithCode(indexer, extrinsic, feed, fromAddress, section_method, args) {
        //contract deploy with wasm byte code
        //0x2c986a6cb47b94a9e50f5d3f660e0f37177989594eb087bf7309c2e15e2340c8 //indexPeriods 22007 2022-08-18 23
        /*
        {
          "value": 0,
          "gas_limit": 50000000000,
          "storage_deposit_limit": null,
          "code": "...",
          "data": "0x9bae9d5e0000002b9e099625de093e00000000000110574f4c4b010c574c4b12",
          "salt": "0xeb1ec10346938ca57e7c9b4932999863a384f646ea567475a5514882cbf11920"
        }
        */
        //console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] [${section_method}]`, args)
        let wasmContractsEvents = this.getWasmContractsEvent(indexer, extrinsic)
        let r = {
            chainID: indexer.chainID,
            extrinsicHash: extrinsic.extrinsicHash,
            extrinsicID: extrinsic.extrinsicID,
            blockNumber: this.parserBlockNumber,
            blockTS: this.parserTS,
            contractAddress: null,
            value: paraTool.dechexToInt(args.value),
            gasLimit: paraTool.dechexToInt(args.gas_limit),
            storageDepositLimit: args.storage_deposit_limit,
            code: args.code,
            withCode: false,
            codeHash: '0x' + paraTool.blake2_256_from_hex(args.code),
            deployer: null,
            constructor: args.data, // The input data to pass to the contract constructor
            salt: args.salt, // Used for the address derivation. See [`Pallet::contract_address`]??
            events: wasmContractsEvents,
        }
        for (const ev of wasmContractsEvents) {
            let eventMethodSection = `${ev.section}(${ev.method})`
            //console.log(`[${ev.eventID}] ${eventMethodSection}`, ev)
            if (eventMethodSection == 'contracts(CodeStored)') {
                r.codeHash = ev.data[0] //eastablish mapping between code <-> codeHash
                r.withCode = true
            }
            if (eventMethodSection == 'contracts(Instantiated)') {
                /* deployer, contract ["ZM24FujhBK3XaDsdkpYBf4QQAvRkoMq42aqrUQnxFo3qrAw","aCwSHJ6wyKHFrYBMFqEpNQ4xPzw7nm3jLv9u3fH7eWMPj6z"]*/
                r.deployer = paraTool.getPubKey(ev.data[0])
                r.contractAddress = paraTool.getPubKey(ev.data[1])
            }
        }
        return r
    }

    // default parser //998807-7 (astar)
    processIncomingXCM(indexer, extrinsic, extrinsicID, events, isTip = false, finalized = false) {
        return super.processIncomingXCM(indexer, extrinsic, extrinsicID, events, isTip, finalized)
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
                //if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXCM xTokens`, outgoingXcmList1)
                //return outgoingXcmList
                break;
            case 'xcmPallet':
                let outgoingXcmList2 = this.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
                //if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXcmPallet xcmPallet`, outgoingXcmList2)
                //return outgoingXcmList
                break;
            case 'polkadotXcm':
                let outgoingXcmList3 = this.processOutgoingPolkadotXcm(indexer, extrinsic, feed, fromAddress, section_method, args)
                //if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXCM polkadotXcm`, outgoingXcmList3)
                //return outgoingXcmList
                break;
            case 'ethereum':
                if (module_method == 'transact') {
                    let isEthereumXCM = this.etherumXCMFilter(indexer, args, feed.events)
                    if (isEthereumXCM) {
                        if (this.debugLevel >= paraTool.debugInfo) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] EthereumXCM found`, args)
                        let methodID = args.methodID
                        let outgoingXcmList4 = false
                        if (this.xcmTransferMethodList.includes(methodID)) {
                            outgoingXcmList4 = this.processOutgoingEthereumAssetWithdraw(indexer, extrinsic, feed, fromAddress, section_method, args.decodedEvmInput)
                        } else if (this.xcmTransactorMethodList.includes(methodID)) {
                            //console.log(`Astar Remote Execution [${methodID}] [${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] found!!`)
                            //outgoingXcmList4 = this.processOutgoingEthereumRemoteExecution(indexer, extrinsic, feed, fromAddress, section_method, args.decodedEvmInput)
                        }
                        if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXCM ethereum [methodID=${methodID}]`, outgoingXcmList4)
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

    /*
    name: Assets_withdraw
    fingerprintID: 0xecf766ff (account20)
    signatureID: 0xecf766ff
    signatureRaw: assets_withdraw(address[],uint256[],address,bool,uint256,uint256)

    name: Assets_withdraw (ss58)
    fingerprintID: 0x019054d0
    signatureID: 0x019054d0
    signatureRaw: assets_withdraw(address[],uint256[],bytes32,bool,uint256,uint256)

    name: Assets_reserve_transfer (account20)
    fingerprintID: 0x106d59fe
    signatureID: 0x106d59fe
    signatureRaw: assets_reserve_transfer(address[],uint256[],address,bool,uint256,uint256)

    name: Assets_reserve_transfer (ss58)
    fingerprintID: 0x400c0e8d
    signatureID: 0x400c0e8d
    signatureRaw: assets_reserve_transfer(address[],uint256[],bytes32,bool,uint256,uint256)

    name: Remote_transact
    fingerprintID: 0xf90eb212
    signatureID: 0xf90eb212
    signatureRaw: remote_transact(uint256,bool,address,uint256,bytes,uint64)

    */

    etherumXCMFilter(indexer, args, events) {
        if (args.transaction != undefined) {
            let evmTx = false;
            if (args.transaction.eip1559 != undefined) {
                evmTx = args.transaction.eip1559
            } else if (args.transaction.legacy != undefined) {
                evmTx = args.transaction.legacy
            }
            if (evmTx && evmTx.input != undefined) {
                let txInput = evmTx.input
                let txMethodID = txInput.substr(0, 10)
                if (this.xcmTransferMethodList.includes(txMethodID) || this.xcmTransactorMethodList.includes(txMethodID)) {
                    //console.log(`Precompiled evmTx!`, evmTx)
                    let output = ethTool.decodeTransactionInput(evmTx, indexer.contractABIs, indexer.contractABISignatures)
                    for (const ev of events) {
                        let eventMethodSection = `${ev.section}(${ev.method})`
                        if (eventMethodSection == 'balances(Withdraw)') {
                            //this is the fromAddress (ss58)
                            output.fromAddress = paraTool.getPubKey(ev.data[0])
                            output.msgValue = paraTool.dechexToInt(evmTx.value)
                            break;
                        }
                    }
                    let xcmInput = {}
                    for (let i = 0; i < output.params.length; i++) {
                        let input = output.params[i]
                        xcmInput[input.name] = input.value
                    }
                    output.params = xcmInput
                    //console.log(`output >>`, JSON.stringify(output, null, 2))
                    if (output != undefined) {
                        args.decodedEvmInput = output
                    }
                    return true
                }
            }
        }
        return false
    }

    processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // need additional processing for currency_id part
        //if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXTokens start`)
        let a = args
        let xcmAssetSymbol = false
        if (a.currency_id != undefined) {
            xcmAssetSymbol = this.processXcmDecHexCurrencyID(indexer, a.currency_id)
        }
        /* 0xb64a6325b5374ed3efca6628337aab00aff1febff06d6977bc6f192690126996
        currency_id": {
          "selfReserve": null
        }
        */
        if (!xcmAssetSymbol) {
            if (a.currency_id != undefined && a.currency_id.selfReserve !== undefined) {
                xcmAssetSymbol = indexer.getNativeSymbol();
            }
        }
        //let generalOutgoingXcmList = super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress)
        super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXTokens xcmPallet missing`)
            } else if (xcmAssetSymbol) {
                //xcmtransfer.asset = assetString
                let relayChain = xcmtransfer.relayChain
                let chainID = xcmtransfer.chainID
                let chainIDDest = xcmtransfer.chainIDDest
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(xcmAssetSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "astar processOutgoingXTokens", a.currency_id)
                xcmtransfer.xcmSymbol = xcmAssetSymbol
                xcmtransfer.xcmInteriorKey = targetedXcmInteriorKey
                outgoingXcmList.push(xcmtransfer)
            } else {
                //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXTokens xcmPallet assetString missing`)
                //TODO
                outgoingXcmList.push(xcmtransfer)
            }
        }
        //if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXTokens DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }

    processOutgoingEthereumAssetWithdraw(indexer, extrinsic, feed, fromAddress, section_method, a) {
        // need additional processing for currency_id part
        if (extrinsic.xcmIndex == undefined) {
            extrinsic.xcmIndex = 0
        } else {
            extrinsic.xcmIndex += 1
        }
        try {
            //if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingEthereumAssetWithdraw start`)
            let params = a.params
            let methodID = a.methodID
            /*
            See: https://docs.astar.network/docs/xcm/building-with-xcm/xc-reserve-transfer
            Precompile implemenation checks msg.value and, if positive, treats it as another asset to be sent (MultiLocation { parents: 0, interior: Here }).
            In that case, native asset is added to the tail of asset_id and asset_amount lists and can be indexed by fee_index as any other asset in the list.
            Its value would be set equal to
            {
                "decodeStatus": "success",
                "methodID": "0x019054d0",
                "signature": "assets_withdraw(address[] asset_id, uint256[] asset_amount, bytes32 recipient_account_id, bool is_relay, uint256 parachain_id, uint256 fee_index)",
                "params": {
                    "asset_id": [
                        "0xffffffffffffffffffffffffffffffffffffffff"
                    ],
                    "asset_amount": [
                        "319770000000"
                    ],
                    "recipient_account_id": "0x221ed4fa0489b3f47c6a3f51761f66f93eefb8aff7f6d035365b564579ae7135",
                    "is_relay": true,
                    "parachain_id": "0",
                    "fee_index": "0"
                }
                "fromAddress": "0xf09a89daf59b238d9698fe400880db92dc45ac36da08241be7decd27a5deaf53",
                "msgValue": 1234
            */

            //console.log(`params`, params)
            let assetAndAmountSents = [];
            let feeIdx = paraTool.dechexToInt(params.fee_index)
            let transferIndex = 0
            if (params.asset_id.length != params.asset_amount.length) {
                //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] Invalid EVM asset Input`)
                return
            }
            //if (this.debugLevel >= paraTool.debugVerbose) console.log(assetAndAmountSents)
            let outgoingEtherumXCM = []
            if (extrinsic.xcms == undefined) extrinsic.xcms = []
            let destAddress = '0x' //unknown
            let relayChain = indexer.relayChain
            let paraIDExtra = paraTool.getParaIDExtra(relayChain)
            let chainID = indexer.chainID
            let paraID = paraTool.getParaIDfromChainID(chainID)
            let chainIDDest = null;
            let paraIDDest = null;
            if (params.is_relay) {
                paraIDDest = 0
                chainIDDest = paraTool.getRelayChainID(relayChain)
            } else {
                paraIDDest = paraTool.dechexToInt(params.parachain_id)
                chainIDDest = paraIDExtra + paraIDDest
            }
            if (params.recipient_account_id != undefined) destAddress = params.recipient_account_id
            if (a.fromAddress != undefined) fromAddress = a.fromAddress
            let incomplete = this.extract_xcm_incomplete(extrinsic.events, extrinsic.extrinsicID); //?

            let evmMethod = `${a.signature.split('(')[0]}:${a.methodID}`

            if (a.msgValue > 0) {
                let nativeSymbol = indexer.getNativeSymbol()
                //console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] Adding native ${nativeSymbol} transfer!`)
                params.asset_id.push(`${native}-${nativeSymbol}`)
                params.asset_amount.push(a.msgValue)
            }
            for (let i = 0; i < params.asset_id.length; i++) {
                let rawAssetID = `${params.asset_id[i]}` //(xcAsset address = "0xFFFFFFFF" + DecimalToHexWith32Digits(AssetId)
                if (rawAssetID.substr(0, 2) == '0x') rawAssetID = '0x' + rawAssetID.substr(10)
                let targetedSymbol = (rawAssetID.includes("native")) ? indexer.getNativeSymbol() : this.processXcmGenericCurrencyID(indexer, rawAssetID)
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "astar processOutgoingEthereumAssetWithdraw", rawAssetID)
                let assetAmount = paraTool.dechexToInt(params.asset_amount[i])
                let aa = {
                    xcmInteriorKey: targetedXcmInteriorKey,
                    xcmSymbol: targetedSymbol,
                    amountSent: assetAmount,
                    transferIndex: transferIndex,
                    isFeeItem: (feeIdx == i) ? 1 : 0,
                }
                assetAndAmountSents.push(aa)
                transferIndex++
            }

            for (const assetAndAmountSent of assetAndAmountSents) {
                let targetedSymbol = assetAndAmountSent.xcmSymbol
                let targetedXcmInteriorKey = assetAndAmountSent.xcmInteriorKey
                let amountSent = assetAndAmountSent.amountSent
                let transferIndex = assetAndAmountSent.transferIndex
                let isFeeItem = assetAndAmountSent.isFeeItem
                if (assetAndAmountSent != undefined && paraTool.validAmount(amountSent)) {
                    if (extrinsic.xcms == undefined) extrinsic.xcms = []
                    let xcmIndex = extrinsic.xcmIndex
                    let r = {
                        sectionMethod: evmMethod,
                        extrinsicHash: feed.extrinsicHash,
                        extrinsicID: feed.extrinsicID,
                        transferIndex: transferIndex,
                        xcmIndex: xcmIndex,
                        relayChain: relayChain,
                        chainID: indexer.chainID,
                        chainIDDest: chainIDDest,
                        paraID: paraID,
                        paraIDDest: paraIDDest,
                        blockNumber: this.parserBlockNumber,
                        fromAddress: fromAddress,
                        destAddress: destAddress,
                        sourceTS: feed.ts,
                        amountSent: amountSent,
                        incomplete: incomplete,
                        isFeeItem: isFeeItem,
                        msgHash: '0x',
                        sentAt: this.parserWatermark,
                        xcmSymbol: targetedSymbol,
                        xcmInteriorKey: targetedXcmInteriorKey,
                        xcmType: "xcmtransfer",
                    }
                    //if (msgHashCandidate) r.msgHash = msgHashCandidate //try adding msgHashCandidate if available (may have mismatch)
                    //console.log(`processOutgoingEthereumAssetWithdraw`, r)
                    extrinsic.xcms.push(r)
                    outgoingEtherumXCM.push(r)
                } else {
                    //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicHash}] processOutgoingEthereumAssetWithdraw unknown asset/amountSent`);
                }
            }
            return outgoingEtherumXCM
        } catch (e) {
            //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] ${e.toString()}`)
            return
        }
    }


    processOutgoingEthereumRemoteExecution(indexer, extrinsic, feed, fromAddress, section_method, a) {
        // need additional processing for currency_id part
        if (extrinsic.xcmIndex == undefined) {
            extrinsic.xcmIndex = 0
        } else {
            extrinsic.xcmIndex += 1
        }
        let outgoingEtherumXCM = []
        if (extrinsic.xcms == undefined) extrinsic.xcms = []
        try {
            if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingEthereumRemoteExecution start`)
            let a = args
            let params = a.params
            let methodID = a.methodID
            let evmMethod = `${a.signature.split('(')[0]}:${a.methodID}`
            if (a.fromAddress != undefined) fromAddress = a.fromAddress
            //console.log(`a`, a)
            //console.log(`params`, params)
            let xcmIndex = extrinsic.xcmIndex
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
                sectionMethod: evmMethod,
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
            0xf90eb212: remote_transact
            */
            if (methodID == '0xf90eb212') {
                let ethereumMethod = (methodID == '0xf90eb212') ? 'remote_transact' : 'unknown'
                /*
                name: Remote_transact
                fingerprintID: 0xf90eb212
                signatureID: 0xf90eb212
                signatureRaw: remote_transact(uint256,bool,address,uint256,bytes,uint64)
                {
                    "decodeStatus": "success",
                    "methodID": "0xf90eb212",
                    "signature": "remote_transact(uint256 parachain_id, bool is_relay, address payment_asset_id, uint256 payment_amount, bytes call, uint64 transact_weight)",
                    "params": {
                        "parachain_id": "0"
                        "is_relay": true,
                        "payment_asset_id": "0xffffffffffffffffffffffffffffffffffffffff",
                        "payment_amount": "5300000000000000",
                        "call" : "0x1234...",
                        "transact_weight": "941000000"
                    }
                    "fromAddress": "0xf09a89daf59b238d9698fe400880db92dc45ac36da08241be7decd27a5deaf53"
                */

                try {
                    // process Dest
                    if (params.is_relay) {
                        paraIDDest = 0
                        chainIDDest = paraTool.getRelayChainID(relayChain)
                    } else {
                        paraIDDest = paraTool.dechexToInt(params.parachain_id)
                        chainIDDest = paraIDExtra + paraIDDest
                    }

                    //process fee
                    let rawAssetID = `${params.payment_asset_id}` //(xcAsset address = "0xFFFFFFFF" + DecimalToHexWith32Digits(AssetId)
                    if (rawAssetID.substr(0, 2) == '0x') rawAssetID = '0x' + rawAssetID.substr(10)
                    let targetedSymbol = this.processXcmGenericCurrencyID(indexer, rawAssetID) //inferred approach
                    let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", "astar processOutgoingEthereumRemoteExecution", rawAssetID)
                    let assetAmount = paraTool.dechexToInt(params.payment_amount)

                    // get msgHash, innerCall from event
                    // let [msgHash, innerCall] = this.getMsgHashAndInnerCall(indexer, extrinsic, feed)
                    // is msgHash emitted by the call?
                    let innerCall = params.call

                    // weight_info (not sure about astar formt yet)
                    let weight_info = {
                        transactRequiredWeightAtMost: paraTool.dechexToInt(params.transact_weight), //??
                        overallWeight: paraTool.dechexToInt(params.transact_weight) //??
                    }

                    // compute derivedAccount at destChain?
                    try {
                        let isEVM = indexer.getChainEVMStatus(chainIDDest)
                        let [derivedAccount20, derivedAccount32] = this.calculateMultilocationDerivative(indexer.api, paraID, fromAddress)
                        r.destAddress = (isEVM) ? derivedAccount20 : derivedAccount32
                    } catch (e) {
                        //console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=ethereum:${ethereumMethod} calculateMultilocationDerivative failed`, e)
                    }

                    r.xcmInteriorKey = targetedXcmInteriorKey
                    r.xcmSymbol = targetedSymbol
                    r.chainIDDest = chainIDDest
                    r.paraIDDest = paraIDDest
                    r.innerCall = innerCall
                    //r.msgHash = msgHash
                    //console.log(`[${feed.extrinsicID}] [${extrinsic.extrinsicHash}] section_method=ethereum:${ethereumMethod}`, r)
                    extrinsic.xcms.push(r)
                    outgoingEtherumXCM.push(r)
                } catch (e1) {
                    //console.log(`processOutgoingEthereumRemoteExecution:${ethereumMethod} err`, e1)
                }
            } else {
                //console.log(`TODO [${feed.extrinsicID}] [${extrinsic.extrinsicHash}] unknown section_method:${evmMethod}`, r)
            }
            return outgoingEtherumXCM
        } catch (e) {
            //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] ${e.toString()}`)
            return
        }
    }

    processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // TODO: have not seen case like this yet
        //if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXcmPallet start`)
        let a = args
        let xcmAssetSymbol = false
        if (a.currency_id != undefined) {
            xcmAssetSymbol = this.processXcmDecHexCurrencyID(indexer, a.currency_id)
        }
        //let generalOutgoingXcmList = super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress)
        super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXcmPallet xcmPallet missing`)
            } else if (xcmAssetSymbol) {
                let relayChain = xcmtransfer.relayChain
                let chainID = xcmtransfer.chainID
                let chainIDDest = xcmtransfer.chainIDDest
                let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(xcmAssetSymbol, relayChain, chainID, chainIDDest, "processXcmDecHexCurrencyID", "astar processOutgoingXcmPallet", a.currency_id)
                xcmtransfer.xcmSymbol = xcmAssetSymbol
                xcmtransfer.xcmInteriorKey = targetedXcmInteriorKey
                outgoingXcmList.push(xcmtransfer)
            } else {
                //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXcmPallet assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        //if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXcmPallet DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }

    getDappStakingLedgerKey(decoratedKey) {
        //DappsStaking:Ledger
        /*
        ["bTMajmNxA6KP5scZmqU6ERhKbDqxP936nbwwboh6oZzsJL3"]
        */
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = {
            Token: "ASTR"
        }
        out.accountID = k[0]; //accountID
        return out
    }


    rewardFilter(palletMethod) {
        if (palletMethod == "dappsStaking(Reward)") {
            //console.log(`processReward ${palletMethod}`)
            return true
        } else {
            return super.rewardFilter(palletMethod)
        }
    }

    prepareFeedReward(indexer, section, method, data, eventID) {
        let palletMethod = `${section}(${method})`
        //let data = rewardEvent.data
        if (palletMethod == "dappsStaking(Reward)") {
            /*
            "data": [
              "VzGGtmujh4aretwsQnD6oew491xX67n6aAZZzqY8zmJBsXg",
              {
                "evm": "0xcd120b3a7908507aa4503f7a17c30eadcbebb97f"
              },
              68,
              "0x000000000000000003a2ae9d185fa4b3"
            ]
            */

            let accountID = data[0]
            let smartcontract = data[1]
            let eraIndex = paraTool.dechexToInt(data[2])
            let bal = paraTool.dechexToInt(data[3]);
            let rewardRec = {
                eventID: eventID,
                section: section,
                method: method,
                account: accountID,
                value: bal,
                era: eraIndex,
            }
            //console.log(rewardRec)
            return rewardRec
        } else {
            return super.prepareFeedReward(indexer, section, method, data, eventID)
        }
        return false
    }

    processDappsStakingLedger(indexer, e2, rAssetkey, fromAddress) {
        let aa = {};
        aa['dappsStaking'] = e2.pv / (10 ** indexer.getChainDecimal(indexer.chainID))
        let elevatedKey = this.elevatedAssetKey("DappStaking", rAssetkey);
        let assetChain = paraTool.makeAssetChain(elevatedKey, indexer.chainID)
        indexer.updateAddressStorage(fromAddress, assetChain, "astar:processDappsStakingLedger-dapps", aa, this.parserTS, this.parserBlockNumber, paraTool.assetTypeToken);
    }

    parseStorageVal(indexer, p, s, val, decoratedVal, o = false) {
        let pallet_section = `${p}:${s}`
        //console.log(`astar parseStorageVal ${pallet_section}`)
        if (pallet_section == "dappsStaking:ledger") {
            //console.log(`astar parse_storage_val ${p}:${s} ${val} ${decoratedVal}`)
        } else {
            return super.parseStorageVal(indexer, p, s, val, decoratedVal, o)
        }
    }
    parseStorageKey(indexer, p, s, key, decoratedKey) {
        //astar specific
        let pallet_section = `${p}:${s}`
        //console.log(`astar parseStorageKey ${pallet_section}`)
        if (pallet_section == "dappsStaking:ledger") {
            // console.log(`astar parse_storage_key ${p}:${s} ${key} ${decoratedKey}`)
            return this.getDappStakingLedgerKey(decoratedKey)
        }
        return super.parseStorageKey(indexer, p, s, key, decoratedKey)

    }
    processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress) {
        let pallet_section = `${p}:${s}`
        //console.log(`astar processAccountAsset ${pallet_section}`)
        if (pallet_section == "DappsStaking:Ledger") {
            //console.log(`astar process_account_asset ${p}:${s} ${e2} ${rAssetkey} ${fromAddress}`)
            return // this.processDappsStakingLedger(indexer, e2, rAssetkey, fromAddress);
        }
        return super.processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress)
    }

    processAsset(indexer, p, s, e2) {
        let pallet_section = `${p}:${s}`
        //console.log(`astar processAsset ${pallet_section}`)
        return super.processAsset(indexer, p, s, e2)
    }
}
