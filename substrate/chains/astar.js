const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class AstarParser extends ChainParser {

    // default parser //998807-7 (astar)
    processIncomingXCM(indexer, extrinsic, extrinsicID, events, finalized = false) {
        return super.processIncomingXCM(indexer, extrinsic, extrinsicID, events, finalized)
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
                if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXCM xTokens`, outgoingXcmList1)
                //return outgoingXcmList
                break;
            case 'xcmPallet':
                let outgoingXcmList2 = this.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXcmPallet xcmPallet`, outgoingXcmList2)
                //return outgoingXcmList
                break;
            case 'polkadotXcm':
                let outgoingXcmList3 = this.processOutgoingPolkadotXcm(indexer, extrinsic, feed, fromAddress, section_method, args)
                if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXCM polkadotXcm`, outgoingXcmList3)
                //return outgoingXcmList
                break;
            case 'ethereum':
                if (module_method == 'transact'){
                    let isEthereumXCM = this.etherumXCMFilter(indexer, args)
                    if (isEthereumXCM){
                        console.log(`[${extrinsic.extrinsicID}] [${extrinsic.extrinsicHash}] EthereumXCM found`, args)
                        let outgoingXcmList3 = this.processOutgoingEthereum(indexer, extrinsic, feed, fromAddress, section_method, args)
                        if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingXCM ethereum`, outgoingXcmList3)
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
    */

    etherumXCMFilter(indexer, args){
        if (args.transaction != undefined) {
            let evmTx = false;
            if (args.transaction.eip1559 != undefined) {
                evmTx = args.transaction.eip1559
            } else if (args.transaction.legacy != undefined) {
                evmTx = args.transaction.legacy
            }
            //console.log(`evmTx`, evmTx)
            if (evmTx && evmTx.input != undefined) {
                let txInput = evmTx.input
                if (txInput.substr(0,10) == "0xecf766ff" || txInput.substr(0,10) == "0x019054d0"){
                    let output = ethTool.decodeTransactionInput(evmTx, indexer.contractABIs, indexer.contractABISignatures)
                    console.log(`output >>`, output)
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
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXTokens start`)
        let assetString = false
        let a = args
        if (a.currency_id != undefined) {
            assetString = this.processDecHexCurrencyID(indexer, a.currency_id)
        }
        /* 0xb64a6325b5374ed3efca6628337aab00aff1febff06d6977bc6f192690126996
        currency_id": {
          "selfReserve": null
        }
        */
        if (!assetString) {
            if (a.currency_id != undefined && a.currency_id.selfReserve !== undefined) {
                assetString = indexer.getNativeAsset();
            }
        }
        //let generalOutgoingXcmList = super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress)
        super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXTokens xcmPallet missing`)
            } else if (assetString) {
                xcmtransfer.asset = assetString
                outgoingXcmList.push(xcmtransfer)
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXTokens xcmPallet assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXTokens DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }



    processOutgoingEthereum(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // need additional processing for currency_id part
        if (this.debugLevel >= paraTool.debugInfo) console.log(`astar processOutgoingEthereum start`)



        return
        let assetString = false
        let a = args
        if (a.currency_id != undefined) {
            assetString = this.processDecHexCurrencyID(indexer, a.currency_id)
        }
        /* 0xb64a6325b5374ed3efca6628337aab00aff1febff06d6977bc6f192690126996
        currency_id": {
          "selfReserve": null
        }
        */
        if (!assetString) {
            if (a.currency_id != undefined && a.currency_id.selfReserve !== undefined) {
                assetString = indexer.getNativeAsset();
            }
        }
        //let generalOutgoingXcmList = super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress)
        super.processOutgoingXTokens(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingEthereum missing`)
            } else if (assetString) {
                xcmtransfer.asset = assetString
                outgoingXcmList.push(xcmtransfer)
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingEthereum assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingEthereum DONE`, outgoingXcmList)
        extrinsic.xcms = outgoingXcmList
        return outgoingXcmList
    }

    processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args) {
        // TODO: have not seen case like this yet
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXcmPallet start`)
        let assetString = false
        let a = args
        if (a.currency_id != undefined) {
            assetString = this.processDecHexCurrencyID(indexer, a.currency_id)
        }
        //let generalOutgoingXcmList = super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress)
        super.processOutgoingXcmPallet(indexer, extrinsic, feed, fromAddress, section_method, args)
        let generalOutgoingXcmList = (extrinsic.xcms != undefined) ? extrinsic.xcms : []
        let outgoingXcmList = []
        for (var xcmtransfer of generalOutgoingXcmList) {
            if (xcmtransfer == undefined) {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXcmPallet xcmPallet missing`)
            } else if (assetString) {
                xcmtransfer.asset = assetString
                outgoingXcmList.push(xcmtransfer)
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`astar processOutgoingXcmPallet assetString missing`)
                outgoingXcmList.push(xcmtransfer)
            }
        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(`astar processOutgoingXcmPallet DONE`, outgoingXcmList)
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
