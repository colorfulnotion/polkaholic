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
                //console.log(`[${extrinsic.extrinsicID}] call`, i, call_section, call_method, c);
                i++;
                this.processOutgoingXCM(indexer, extrinsic, feed, fromAddress, call_section, call_method, c.args)
            }
        } else if (args.call != undefined) { // this is an object
            let call = args.call
            let call_section = call.section;
            let call_method = call.method;
            //console.log(`[${extrinsic.extrinsicID}] descend into call`, call)
            this.processOutgoingXCM(indexer, extrinsic, feed, fromAddress, call_section, call_method, call.args)
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
            default:
                //console.log(`unknown`)
                //return outgoingXcmList
                break;
        }
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

    //shiden/astar
    //xcAssetConfig.assetIdToLocation
    async fetchXcAssetConfigAssetIdToLocation(indexer) {
        let isAcala = true;
        if (!indexer.api) {
            console.log(`[fetchXcAssetConfigAssetIdToLocation] Fatal indexer.api not initiated`)
            return
        }
        let relayChain = indexer.relayChain
        let relayChainID = (relayChain == 'polkadot') ? 0 : 2
        let paraIDExtra = (relayChain == 'polkadot') ? 0 : 20000

        var a = await indexer.api.query.xcAssetConfig.assetIdToLocation.entries()
        if (!a) return
        let assetList = {}

        a.forEach(async ([key, val]) => {
            let assetID = this.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let parsedAsset = {
                Token: assetID
            }
            let paraID = 0
            let chainID = -1

            var asset = JSON.stringify(parsedAsset);
            let assetChain = paraTool.makeAssetChain(asset, indexer.chainID);
            let cachedAssetInfo = indexer.assetInfo[assetChain]
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol : ''
                let nativeSymbol = symbol

                let xcmAssetType = val.toJSON()
                // type V0/V1/...
                let xcmAssetTypeV = Object.keys(xcmAssetType)[0]
                let xcmAsset = xcmAssetType[xcmAssetTypeV]
                let parents = xcmAsset.parents
                let interior = xcmAsset.interior
                //x1/x2/x3 refers to the number to params

                let interiorK = Object.keys(interior)[0]
                let interiork = paraTool.firstCharLowerCase(interiorK)
                let interiorVRaw = interior[interiorK]

                //console.log(`${interiork} interiorVRawV`, interiorVRawV)
                let interiorVStr0 = JSON.stringify(interiorVRaw)
                interiorVStr0.replace('Parachain', 'parachain').replace('Parachain', 'parachain').replace('PalletInstance', 'palletInstance').replace('GeneralIndex', 'generalIndex').replace('GeneralKey', 'generalKey')
                //hack: lower first char
                let interiorV = JSON.parse(interiorVStr0)

                if (interiork == 'here' || interiork == 'Here') {
                    //relaychain case
                    chainID = relayChainID
                } else if (interiork == 'x1') {
                    paraID = interiorV['parachain']
                    chainID = paraID + paraIDExtra
                } else {
                    let generalIndex = -1
                    for (let i = 0; i < interiorV.length; i++) {
                        let v = interiorV[i]
                        if (v.parachain != undefined) {
                            paraID = v.parachain
                            chainID = paraID + paraIDExtra
                        } else if (v.generalIndex != undefined) {
                            generalIndex = v.generalIndex
                        } else if (v.generalKey != undefined) {
                            let generalKey = v.generalKey
                            if (generalKey.substr(0, 2) != '0x') {
                                generalKey = paraTool.stringToHex(generalKey)
                                v.generalKey = generalKey
                            }
                        }
                    }
                    //over-write statemine asset with assetID
                    if (paraID == 1000) {
                        nativeSymbol = `${generalIndex}`
                    }
                }
                if (symbol == 'AUSD') {
                    nativeSymbol = 'KUSD'
                } else if (symbol == 'aUSD') {
                    nativeSymbol = 'AUSD'
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);
                let interiorVStr = JSON.stringify(interiorV)

                if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                    interiorVStr = 'here'
                }

                let xcmInteriorKey = paraTool.makeXcmInteriorKey(interiorVStr, relayChain)
                let cachedXcmAssetInfo = indexer.getXcmAssetInfoByInteriorkey(xcmInteriorKey)
                if (cachedXcmAssetInfo != undefined && cachedXcmAssetInfo.nativeAssetChain != undefined) {
                    if (this.debugLevel >= paraTool.debugVerbose) console.log(`known asset ${xcmInteriorKey} (assetChain) - skip update`, cachedXcmAssetInfo)
                    return
                }

                //if (this.debugLevel >= paraTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)

                let nativeAssetChain = paraTool.makeAssetChain(nativeAsset, chainID);
                let xcmAssetInfo = {
                    chainID: chainID,
                    xcmConcept: interiorVStr, //interior
                    asset: nativeAsset,
                    paraID: paraID,
                    relayChain: relayChain,
                    parents: parents,
                    interiorType: interiorK,
                    xcmInteriorKey: xcmInteriorKey,
                    nativeAssetChain: nativeAssetChain,
                    source: indexer.chainID,
                }
                //console.log(`xcmAssetInfo`, xcmAssetInfo)
                await indexer.addXcmAssetInfo(xcmAssetInfo, 'fetchXcAssetConfigAssetIdToLocation');
            } else {
                if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`AssetInfo unknown -- skip`, assetChain)
            }
        });
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
