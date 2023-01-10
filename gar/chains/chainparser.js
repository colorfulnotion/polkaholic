const garTool = require("../garTool");
const {
    decodeAddress,
} = require("@polkadot/keyring");
const {
    u8aToHex,
} = require("@polkadot/util");

module.exports = class ChainParser {

    api;
    manager;
    isGenericParser = true;
    nativeAsset = false;

    constructor(api, manager, isGenericParser = true) {
        this.api = api
        this.manager = manager
        this.isGenericParser = isGenericParser
    }

    setDebugLevel(debugLevel = garTool.debugNoLog) {
        this.debugLevel = debugLevel
    }

    isMatched(chainkey, chainFilters = ['kusama-1000|statemine', 'kusama-2023|moonriver']) {
        let i = chainFilters.findIndex(e => e.includes(chainkey))
        return chainFilters.findIndex(e => e.includes(chainkey)) != -1
    }

    isObject(val) {
        return (typeof val === 'object');
    }

    async getSystemProperties(chainkey) {
        //let chainID = chain.chainID;
        let api = this.api
        if (!api) {
            console.log(`[getSystemProperties] Fatal: ${chainkey} api not initiated`)
            return
        }
        let propsNative = await api.rpc.system.properties();
        let props = JSON.parse(propsNative.toString());
        // {"ss58Format":10,"tokenDecimals":[12,12,10,10],"tokenSymbol":["ACA","AUSD","DOT","LDOT"]}
        // NOT MAINTAINED let ss58Format = props.ss58Format;
        //console.log(propsNative)
        // assume the first asset is the native token
        if (props.tokenSymbol) {
            for (let i = 0; i < props.tokenSymbol.length; i++) {
                let symbol = props.tokenSymbol[i];
                let decimals = props.tokenDecimals[i];
                let asset = JSON.stringify({
                    Token: symbol
                })
                let assetInfo = {
                    assetType: "Token",
                    name: symbol,
                    symbol: symbol,
                    decimals: decimals
                };
                let assetChainkey = garTool.makeAssetChain(asset, chainkey);
                console.log(`[${chainkey}] assetChainkey=${assetChainkey}`, assetInfo)
                this.manager.setChainAsset(assetChainkey, assetInfo)
                if (i == 0){
                    this.nativeAsset = assetInfo
                    this.nativeAsset.assetChainkey = assetChainkey
                }
            }
        }
    }

    async fetchQuery(chainkey, pallet, storage, queryType = 'GAR') {
        let api = this.api
        if (!api) {
            console.log(`[fetchAsset] Fatal: ${chainkey} api not initiated`)
            return false
        }
        console.log(`[${chainkey}] selected ${queryType} - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) {
            console.log(`[${chainkey}] onchain ${queryType} not found - returned`)
            return false
        }
        return a
    }

    processGarAsset(chainkey, a) {
        let assetList = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let assetMetadata = val.toHuman()
            let parsedAsset = {
                Token: assetID
            }
            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            if (this.isMatched(chainkey, ['kusama-2118|listen'])) assetMetadata = assetMetadata.metadata
            if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                let name = (assetMetadata.name != undefined) ? assetMetadata.name : `${assetMetadata.symbol}` //kusama-2090|basilisk doens't have assetName, use symbol in this case
                let assetInfo = {
                    name: name,
                    symbol: assetMetadata.symbol,
                    decimals: assetMetadata.decimals,
                    assetType: garTool.assetTypeToken,
                    currencyID: assetID
                };
                if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2085|heiko'])) {
                    if (assetInfo.symbol.includes('LP-')) assetInfo.assetType = garTool.assetTypeLiquidityPair
                    //console.log('im here fetchAssetPallet assetInfo', assetInfo)
                }
                assetList[assetChainkey] = assetInfo
                //this.manager.setChainAsset(assetChainkey, assetInfo)
            } else {
                //if (this.debugLevel >= garTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
            }
        }
        console.log(`[${chainkey}] onchain GAR:`, assetList);
        return assetList
    }

    /*
    Fetch asset registry for parachain that use generic asset pallet, currently
    covering the following chains:
    [
    'polkadot-2006|astar', 'kusama-2007|shiden',
    'polkadot-2004|moonbeam', 'kusama-2023|moonriver',
    'polkadot-2012|parallel', 'kusama-2085|heiko',
    'polkadot-1000|statemint', 'kusama-1000|statemine',
    'polkadot-2035|phala', 'kusama-2004|khala',
    'polkadot-2034|hydra', 'kusama-2090|basilisk',
    'kusama-2084|calamari',
    'kusama-2048|robonomics',
    'kusama-2118|listen',
    'kusama-2012|shadow'
    ]
    */
    /*
    [hydra]assetRegistry:assetMetadataMap
    [listen]currencies:listenAssetsInfo
    [generic] asset:metadata
    */
    async fetchAssetPallet(chainkey) {
        let api = this.api
        if (!api) {
            console.log(`[fetchAssetPallet] Fatal: ${chainkey} api not initiated`)
            return
        }
        /* each parachain team may have slightly different pallet:storage name
        that uses the same/similar logic. The parser should redirect itself to
        the proper section
        */
        var pallet, storage; // where GAR is stored (i.e asset:metadata for statemine's GAR)
        if (this.isMatched(chainkey, ['kusama-2118|listen'])) {
            pallet = 'currencies'
            storage = 'listenAssetsInfo'
        } else if (this.isMatched(chainkey, ['polkadot-2034|hydra', 'kusama-2090|basilisk'])) {
            pallet = 'assetRegistry'
            storage = 'assetMetadataMap'
        } else {
            pallet = 'assets'
            storage = 'metadata'
        }
        console.log(`[${chainkey}] selected GAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) {
            console.log(`[${chainkey}] onchain GAR not found - returned`)
            return
        }
        let assetList = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let assetMetadata = val.toHuman()
            let parsedAsset = {
                Token: assetID
            }
            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            if (this.isMatched(chainkey, ['kusama-2118|listen'])) assetMetadata = assetMetadata.metadata
            if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                let name = (assetMetadata.name != undefined) ? assetMetadata.name : `${assetMetadata.symbol}` //kusama-2090|basilisk doens't have assetName, use symbol in this case
                let assetInfo = {
                    name: name,
                    symbol: assetMetadata.symbol,
                    decimals: assetMetadata.decimals,
                    assetType: garTool.assetTypeToken,
                    currencyID: assetID
                };
                if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2085|heiko'])) {
                    if (assetInfo.symbol.includes('LP-')) assetInfo.assetType = garTool.assetTypeLiquidityPair
                    //console.log('im here fetchAssetPallet assetInfo', assetInfo)
                }
                assetList[assetChainkey] = assetInfo
                this.manager.setChainAsset(assetChainkey, assetInfo)
            } else {
                //if (this.debugLevel >= garTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
            }
        }
        console.log(`[${chainkey}] onchain GAR:`, assetList);
    }

    /* Token Pallet Parsing
    Fetch asset registry for parachain that use generic token pallet, currently
    covering the following chains:
    [
    'polkadot-2000|acala', 'kusama-2000|karura',
    'polkadot-2030|bifrost', 'kusama-2001|bifrost'
    ]
    */
    /*
    [bifrost] assetRegistry:currencyMetadatas - TODO
    [acala] assetRegistry:assetMetadatas
    */
    async fetchTokenPallet(chainkey) {
        let api = this.api
        if (!api) {
            console.log(`[fetchTokenPallet] Fatal: ${chainkey} api not initiated`)
            return
        }
        /* each parachain team may have slightly different pallet:storage name
        that uses the same/similar logic. The parser should redirect itself to
        the proper section
        */
        var pallet, storage; // where GAR is stored (i.e assetRegistry:assetMetadatas for acala GAR)
        if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
            pallet = 'assetRegistry'
            storage = 'currencyMetadatas'
        } else if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
            pallet = 'assetRegistry'
            storage = 'assetMetadatas'
        }
        console.log(`[${chainkey}] selected GAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) return
        let assetList = {}
        // ForeignAssetId/{"NativeAssetId":{"Token":"XXX"}}/{"Erc20":"0x1f3a10587a20114ea25ba1b388ee2dd4a337ce27"}/{"StableAssetId":"0"}
        // remove the Id prefix here
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetMetadata = val.toHuman()
            let parsedAsset = {}
            let assetKeyWithID = key.args.map((k) => k.toHuman())[0] //{"ForeignAssetId":"0"}
            let assetKey = Object.keys(assetKeyWithID)[0] // ForeignAssetId
            let assetKeyVal = garTool.cleanedAssetID(assetKeyWithID[assetKey]) // "123,456" or {"Token":"XXX"}
            if (assetKey == 'NativeAssetId') {
                //this is the bifrost case
                parsedAsset = assetKeyVal
            } else {
                // this is the acala/karura case
                let assetKeyWithoutID = assetKey.replace('Id', '') //ForeignAssetId -> ForeignAsset
                parsedAsset[assetKeyWithoutID] = assetKeyVal
            }
            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                let symbol = assetMetadata.symbol
                let name = assetMetadata.name
                if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
                    //biforst VSToken has ambiguous symbol representation
                    if (parsedAsset.VSToken != undefined) {
                        symbol = 'VS' + symbol
                        name = `Bifrost Voucher Slot ` + name
                    }
                }
                let assetInfo = {
                    name: name,
                    symbol: symbol,
                    decimals: assetMetadata.decimals,
                    assetType: garTool.assetTypeToken
                };
                assetList[assetChainkey] = assetInfo
                console.log(`addAssetInfo [${asset}]`, assetInfo)
                this.manager.setChainAsset(assetChainkey, assetInfo)
            } else {
                //if (this.debugLevel >= garTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
            }
        }
        console.log(`[${chainkey}] onchain GAR:`, assetList);
    }


    /* Asset Pallet Parsing
    Fetch xcm asset registry for parachain that uses similar assetRegistry pallet, currently
    covering the following chains:
    [
    'polkadot-2004|moonbeam', 'kusama-2023|moonriver',
    'polkadot-2012|parallel', 'kusama-2085|heiko'
    'polkadot-2034|hydra', 'kusama-2090|basilisk'
    'kusama-2012|shadow'
    ]
    */
    /*
    [Moonbeam/Shadow] assetManager:assetIdType
    [Parallel] assetRegistry:assetIdType
    [Hydra] assetRegistry.assetLocations
    */
    async fetchXCMAssetIdType(chainkey) {
        let api = this.api
        if (!api) {
            console.log(`[fetchXCMAssetIdType] Fatal: ${chainkey} api not initiated`)
            return
        }
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        //let relayChainID = garTool.getRelayChainID(relayChain)
        //let paraIDExtra = garTool.getParaIDExtra(relayChain)

        var pallet, storage; // where xcGAR is stored (i.e xcAssetConfig:assetIdToLocation)
        if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver', 'kusama-2012|shadow'])) {
            pallet = 'assetManager'
            storage = 'assetIdType'
        } else if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2085|heiko'])) {
            pallet = 'assetRegistry'
            storage = 'assetIdType'
        } else if (this.isMatched(chainkey, ['polkadot-2034|hydra', 'kusama-2090|basilisk'])) {
            pallet = 'assetRegistry'
            storage = 'assetLocations'
        }
        console.log(`[${chainkey}] selected xcGAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) return
        let assetList = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let parsedAsset = {
                Token: assetID
            }
            let paraID = 0
            let chainID = -1
            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol.replace('xc', '') : ''
                let nativeSymbol = symbol
                let xcmAssetJSON = val.toJSON()
                let xcmAsset = (xcmAssetJSON.xcm != undefined) ? xcmAssetJSON.xcm : xcmAssetJSON
                let parents = xcmAsset.parents
                let interior = xcmAsset.interior
                //x1/x2/x3 refers to the number to params
                let interiorK = Object.keys(interior)[0]
                let interiork = garTool.firstCharLowerCase(interiorK)
                let interiorV = interior[interiorK]
                let interiorVStr = JSON.stringify(interiorV)
                /*
                //old xcmInteriorKey format
                if (((interiorK == 'here') || (interiork == "here")) && interior[interiorK] == null) {
                    interiorVStr = 'here'
                    //chainID = relayChainID
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, relayChain)
                */
                let network = {}
                if (relayChain == 'kusama' || relayChain == 'polkadot') {
                    network = {
                        network: relayChain
                    }
                } else {
                    network = {
                        named: garTool.stringToHex(relayChain)
                    }
                }
                if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultilocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null
                if ((typeof interiorK == "string") && (interiorK.toLowerCase() == 'here')) {
                    //relaychain case
                    //chainID = relayChainID
                } else if (interiorK == 'x1') {
                    paraID = interiorV['parachain']
                    //chainID = paraID + paraIDExtra
                } else {
                    let generalIndex = -1
                    for (const v of interiorV) {
                        if (v.parachain != undefined) {
                            paraID = v.parachain
                            //chainID = paraID + paraIDExtra
                        } else if (v.generalIndex != undefined) {
                            generalIndex = v.generalIndex
                        }
                    }
                    //over-write statemine asset with assetID
                    if (paraID == 1000) {
                        nativeSymbol = `${generalIndex}`
                    }
                }

                // standarizing ausd -> to kusd on kusama;
                if (symbol == 'AUSD') {
                    nativeSymbol = 'KUSD'
                } else if (symbol == 'aUSD') {
                    nativeSymbol = 'AUSD'
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);

                console.log(`'${interiorVStr}' ${nativeAsset} [${paraID}] | [${symbol}] [${interiorK}]`)
                //if (this.debugLevel >= garTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)
                let nativechainKey = `${relayChain}-${paraID}`
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, nativechainKey);

                let xcmAssetInfo = {
                    //chainID: chainID,
                    xcmConcept: interiorVStr, //interior
                    asset: nativeAsset,
                    paraID: paraID,
                    relayChain: relayChain,
                    parents: parents,
                    interiorType: interiorK,
                    xcmInteriorKey: xcmInteriorKey,
                    xcmV1multilocationByte: xcmV1MultilocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    nativeAssetChainkey: nativeAssetChainkey,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    source: chainkey,
                }

                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                this.manager.setChainAsset(assetChainkey, cachedAssetInfo, true)

                console.log(`xcmAssetInfo ${xcmInteriorKey}`, xcmAssetInfo)
                this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])) {
                    //For isEVMChain, compute the extra xcContractAddress
                    this.manager.addXcmAssetLocalxcContractAddress(xcmInteriorKey, paraIDSoure, assetID)
                }
            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
            }
        }
    }

    async processXCMAssetIdToLocation(chainkey, a) {
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]

        let api = this.api
        let xcAssetList = {}
        let assetIDList = {}
        let updatedAssetList = {}
        let unknownAsset = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let parsedAsset = {
                Token: assetID
            }
            let paraID = 0
            let chainID = -1

            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);

            let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
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
                let interiork = garTool.firstCharLowerCase(interiorK)
                let interiorVRaw = interior[interiorK]

                //console.log(`${interiork} interiorVRawV`, interiorVRawV)
                let interiorVStr0 = JSON.stringify(interiorVRaw)
                interiorVStr0.replace('Parachain', 'parachain').replace('PalletInstance', 'palletInstance').replace('GeneralIndex', 'generalIndex').replace('GeneralKey', 'generalKey')
                //hack: lower first char
                let interiorV = JSON.parse(interiorVStr0)

                if (interiork == 'here' || interiork == 'Here') {
                    //relaychain case
                    //chainID = relayChainID
                } else if (interiork == 'x1') {
                    paraID = interiorV['parachain']
                    //chainID = paraID + paraIDExtra
                } else {
                    let generalIndex = -1
                    for (let i = 0; i < interiorV.length; i++) {
                        let v = interiorV[i]
                        if (v.parachain != undefined) {
                            paraID = v.parachain
                            //chainID = paraID + paraIDExtra
                        } else if (v.generalIndex != undefined) {
                            generalIndex = v.generalIndex
                        } else if (v.generalKey != undefined) {
                            let generalKey = v.generalKey
                            if (generalKey.substr(0, 2) != '0x') {
                                generalKey = garTool.stringToHex(generalKey)
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
                let network = {}
                if (relayChain == 'kusama' || relayChain == 'polkadot') {
                    network = {
                        network: relayChain
                    }
                } else {
                    network = {
                        named: garTool.stringToHex(relayChain)
                    }
                }
                if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultilocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, chainkey);

                let xcmAssetInfo = {
                    //chainID: chainID,
                    xcmConcept: interiorVStr, //interior
                    asset: nativeAsset,
                    paraID: paraID,
                    relayChain: relayChain,
                    parents: parents,
                    interiorType: interiorK,
                    xcmInteriorKey: xcmInteriorKey,
                    xcmV1multilocationByte: xcmV1MultilocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    nativeAssetChainkey: nativeAssetChainkey,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    source: chainkey,
                }
                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                xcAssetList[xcmInteriorKey] = xcmAssetInfo
                assetIDList[xcmInteriorKey] = assetID
                updatedAssetList[assetChainkey] = cachedAssetInfo
                /*
                this.manager.setChainAsset(assetChainkey, cachedAssetInfo, true)
                console.log(`xcmAssetInfo`, xcmAssetInfo)
                this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                if (this.isMatched(chainkey, ['polkadot-2006|astar', 'kusama-2007|shiden'])) {
                    //For isEVMChain, compute the extra xcContractAddress
                    this.manager.addXcmAssetLocalxcContractAddress(xcmInteriorKey, paraIDSoure, assetID)
                }
                */
            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
                unknownAsset[assetChainkey] = 1
            }
        }
        return [xcAssetList, assetIDList, updatedAssetList, unknownAsset]
    }

    async processXCMAssetIdType(chainkey, a) {
        let api = this.api
        let xcAssetList = {}
        let assetIDList = {}
        let updatedAssetList = {}
        let unknownAsset = {}
        //console.log(`processXCMAssetIdType [${chainkey}]`, a)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]

        try {
            //return [xcAssetList, xcAssetList, xcAssetList, xcAssetList]
            //let relayChainID = garTool.getRelayChainID(relayChain)
            //let paraIDExtra = garTool.getParaIDExtra(relayChain)

            for (let i = 0; i < a.length; i++) {
                let key = a[i][0];
                let val = a[i][1];
                //console.log(`processXCMAssetIdType key`, key)
                //console.log(`processXCMAssetIdType val`, val)
                let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
                let parsedAsset = {
                    Token: assetID
                }
                let chainID = -1
                let paraID = 0
                var asset = JSON.stringify(parsedAsset);
                let assetChainkey = garTool.makeAssetChain(asset, chainkey);
                let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
                if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                    console.log(`cached AssetInfo found`, cachedAssetInfo)
                    let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol.replace('xc', '') : ''
                    let nativeSymbol = symbol
                    let xcmAssetJSON = val.toJSON()
                    let xcmAsset = (xcmAssetJSON.xcm != undefined) ? xcmAssetJSON.xcm : xcmAssetJSON
                    let parents = xcmAsset.parents
                    let interior = xcmAsset.interior
                    //x1/x2/x3 refers to the number to params
                    let interiorK = Object.keys(interior)[0]
                    let interiork = garTool.firstCharLowerCase(interiorK)
                    let interiorV = interior[interiorK]
                    let interiorVStr = JSON.stringify(interiorV)
                    let network = {}
                    if (relayChain == 'kusama' || relayChain == 'polkadot') {
                        network = {
                            network: relayChain
                        }
                    } else {
                        network = {
                            named: garTool.stringToHex(relayChain)
                        }
                    }
                    if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                        interiorVStr = '"here"'
                    }
                    let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                    let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                    let xcmV1MultilocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null
                    if ((typeof interiorK == "string") && (interiorK.toLowerCase() == 'here')) {
                        //relaychain case
                        //chainID = relayChainID
                    } else if (interiorK == 'x1') {
                        paraID = interiorV['parachain']
                        //chainID = paraID + paraIDExtra
                    } else {
                        let generalIndex = -1
                        for (const v of interiorV) {
                            if (v.parachain != undefined) {
                                paraID = v.parachain
                                //chainID = paraID + paraIDExtra
                            } else if (v.generalIndex != undefined) {
                                generalIndex = v.generalIndex
                            }
                        }
                        //over-write statemine asset with assetID
                        if (paraID == 1000) {
                            nativeSymbol = `${generalIndex}`
                        }
                    }

                    // standarizing ausd -> to kusd on kusama;
                    if (symbol == 'AUSD') {
                        nativeSymbol = 'KUSD'
                    } else if (symbol == 'aUSD') {
                        nativeSymbol = 'AUSD'
                    }
                    let nativeParsedAsset = {
                        Token: nativeSymbol
                    }
                    var nativeAsset = JSON.stringify(nativeParsedAsset);

                    console.log(`'${interiorVStr}' ${nativeAsset} [${paraID}] | [${symbol}] [${interiorK}]`)
                    //if (this.debugLevel >= garTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)
                    let nativechainKey = `${relayChain}-${paraID}`
                    let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, nativechainKey);

                    let xcmAssetInfo = {
                        //chainID: chainID,
                        xcmConcept: interiorVStr, //interior
                        asset: nativeAsset,
                        paraID: paraID,
                        relayChain: relayChain,
                        parents: parents,
                        interiorType: interiorK,
                        xcmInteriorKey: xcmInteriorKey,
                        xcmV1multilocationByte: xcmV1MultilocationByte,
                        xcmV1MultiLocation: xcmV1MultiLocation,
                        nativeAssetChainkey: nativeAssetChainkey,
                        xcContractAddress: {},
                        xcCurrencyID: {},
                        source: chainkey,
                    }

                    //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                    cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                    console.log(`xcmAssetInfo ${xcmInteriorKey}`, xcmAssetInfo)
                    xcAssetList[xcmInteriorKey] = xcmAssetInfo
                    assetIDList[xcmInteriorKey] = assetID
                    updatedAssetList[assetChainkey] = cachedAssetInfo

                } else {
                    console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
                    unknownAsset[assetChainkey] = 1
                }
            }
        } catch (e) {
            console.log(`processXCMAssetIdType error`, e)
        }

        return [xcAssetList, assetIDList, updatedAssetList, unknownAsset]
    }

    /*
    Fetch xcm asset registry for parachain that uses similar foreignAssetLocations pallet, currently
    covering the following chains:
    [
    'polkadot-2000|acala', 'kusama-2000|karura'
    polkadot-2030|bifrost, 'kusama-2001|bifrost'
    ]
    */
    /*
    [acala] assetRegistry:foreignAssetLocations
    [bifrost] assetRegistry:currencyIdToLocations
    */
    async fetchXCMAssetRegistryLocations(chainkey) {
        let api = this.api
        if (!api) {
            console.log(`[fetchXCMAssetRegistryLocations] Fatal: ${chainkey} api not initiated`)
            return
        }

        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]

        var pallet, storage; // where xcGAR is stored (i.e xcAssetConfig:assetIdToLocation for astar)
        var useForeignAssetPrefix = false // acala uses foreignAsset to specify the external xcm asset
        if (this.isMatched(chainkey, ['polkadot-2000|acala', 'kusama-2000|karura'])) {
            pallet = 'assetRegistry'
            storage = 'foreignAssetLocations'
            useForeignAssetPrefix = true
        } else if (this.isMatched(chainkey, ['polkadot-2030|bifrost', 'kusama-2001|bifrost'])) {
            pallet = 'assetRegistry'
            storage = 'currencyIdToLocations'
        }

        console.log(`[${chainkey}] selected xcGAR - ${pallet}:${storage}`)
        var a = await api.query[pallet][storage].entries()
        if (!a) return
        let assetList = {}
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let parsedAsset = {};
            if (useForeignAssetPrefix) {
                parsedAsset.ForeignAsset = assetID
            } else {
                parsedAsset = assetID
            }
            let paraID = 0
            let chainID = -1

            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol : ''
                let nativeSymbol = symbol

                let xcmAsset = val.toJSON()
                let parents = xcmAsset.parents
                let interior = xcmAsset.interior
                //x1/x2/x3 refers to the number to params

                let interiorK = Object.keys(interior)[0]
                let interiork = garTool.firstCharLowerCase(interiorK)
                let interiorVRaw = interior[interiorK]

                //console.log(`${interiork} interiorVRaw`, interiorVRaw)
                let interiorVStr0 = JSON.stringify(interiorVRaw)
                interiorVStr0.replace('Parachain', 'parachain').replace('Parachain', 'parachain').replace('PalletInstance', 'palletInstance').replace('GeneralIndex', 'generalIndex').replace('GeneralKey', 'generalKey')
                //hack: lower first char
                let interiorV = JSON.parse(interiorVStr0)

                if (interiork == 'here') {
                    //relaychain case
                    //chainID = relayChainID
                } else if (interiork == 'x1') {
                    paraID = interiorV['parachain']
                    //chainID = paraID + paraIDExtra
                } else {
                    let generalIndex = -1
                    for (let i = 0; i < interiorV.length; i++) {
                        let v = interiorV[i]
                        if (v.parachain != undefined) {
                            paraID = v.parachain
                            //chainID = paraID + paraIDExtra
                        } else if (v.generalIndex != undefined) {
                            generalIndex = v.generalIndex
                        } else if (v.generalKey != undefined) {
                            let generalKey = v.generalKey
                            if (generalKey.substr(0, 2) != '0x') {
                                generalKey = garTool.stringToHex(generalKey)
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

                let network = {}
                if (relayChain == 'kusama' || relayChain == 'polkadot') {
                    network = {
                        network: relayChain
                    }
                } else {
                    network = {
                        named: garTool.stringToHex(relayChain)
                    }
                }
                if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultilocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null

                //console.log(`${chainID} '${interiorVStr}' ${nativeAsset} [${paraID}] | [${symbol}] [${interiorK}]`)
                //if (this.debugLevel >= garTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, chainID);
                let xcmAssetInfo = {
                    //chainID: chainID,
                    xcmConcept: interiorVStr, //interior
                    asset: nativeAsset,
                    paraID: paraID,
                    relayChain: relayChain,
                    parents: parents,
                    interiorType: interiorK,
                    xcmInteriorKey: xcmInteriorKey,
                    xcmV1multilocationByte: xcmV1MultilocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    nativeAssetChainkey: nativeAssetChainkey,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    source: chainkey,
                }

                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                this.manager.setChainAsset(assetChainkey, cachedAssetInfo, true)

                console.log(`xcmAssetInfo ${xcmInteriorKey}`, xcmAssetInfo)
                this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                //this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)

            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
            }
        }
    }

    decode_extrinsic(extrinsic, blockNumber, idx, apiAt) {
        let exos = JSON.parse(extrinsic.toString());
        let extrinsicHash = extrinsic.hash.toHex()
        let extrinsicID = blockNumber + "-" + idx

        let exoh = false;
        try {
            exoh = JSON.parse(JSON.stringify(extrinsic.toHuman()));
            //merge pallet+method from args
            if (exoh && exoh.method.args.calls != undefined) {
                for (let i = 0; i < exoh.method.args.calls.length; i++) {
                    let f = {
                        callIndex: exos.method.args.calls[i].callIndex,
                        method: exoh.method.args.calls[i].method,
                        section: exoh.method.args.calls[i].section,
                        args: exos.method.args.calls[i].args
                    }
                    exos.method.args.calls[i] = f
                }
            }
        } catch (err1) {
            /// TODO: ....
        }
        if (exos.method.args.call != undefined) {
            let opaqueCall = exos.method.args.call
            let extrinsicCall = false;
            try {
                // cater for an extrinsic input...
                extrinsicCall = apiAt.registry.createType('Call', opaqueCall);
                console.log("decoded opaqueCall", extrinsicCall.toString())
                var {
                    method,
                    section
                } = apiAt.registry.findMetaCall(extrinsicCall.callIndex); // needs change

                let innerexs = JSON.parse(extrinsicCall.toString());
                let innerexh = false
                let innerOutput = {}
                try {
                    innerexh = JSON.parse(JSON.stringify(extrinsicCall.toHuman()));;
                    //merge pallet+method from args
                    if (innerexh && innerexh.args.calls != undefined) {
                        for (let i = 0; i < innerexh.args.calls.length; i++) {
                            let f = {
                                callIndex: innerexs.args.calls[i].callIndex,
                                method: innerexh.args.calls[i].method,
                                section: innerexh.args.calls[i].section,
                                args: innerexs.args.calls[i].args
                            }
                            innerexs.args.calls[i] = f
                        }
                    }

                    innerOutput = {
                        callIndex: innerexs.callIndex,
                        method: innerexh.method,
                        section: innerexh.section,
                        args: innerexs
                    }
                } catch (err1) {
                    /// TODO: ....
                }
                exos.method.args.call = innerOutput
            } catch (e) {
                console.log('try errored')
            }
        }
        let sig = exos.signature
        let isSigned = sig.isSigned
        if (exoh) {
            sig.isSigned = exoh.isSigned
        }
        let signer = false
        if (sig.signer.id != undefined) {
            signer = sig.signer.id
        } else if (sig.signer != undefined) {
            signer = sig.signer
        }
        let rExtrinsic = {
            extrinsicHash: extrinsicHash,
            extrinsicID: extrinsicID,
            signer: signer ? signer : null,
            signature: signer ? sig.signature : null,
            section: exoh.method.section,
            method: exoh.method.method,
            params: exos.method.args,
        }
        return (rExtrinsic)
    }

    parseEvent(evt, eventID, api = false) {
        if (!api) return (false);
        if (!api.events) return (false);
        var section = evt.method.pallet;
        var method = evt.method.method;
        if (!api.events[section]) return (false);

        var e = api.events[section][method];
        if (!e) return (false);
        var data = evt.data;
        var fields = e.meta.fields;

        var dType = [];
        let dEvent = {}
        dEvent.eventID = eventID
        dEvent.docs = e.meta.docs.toString()
        //dEvent.method = evt.method
        dEvent.section = section
        dEvent.method = method
        //dEvent.data = evt.data
        let dData = evt.data
        for (var i = 0; i < dData.length; i++) {
            let dData_i = dData[i]
            try {
                if (dData_i != undefined) {
                    if (dEvent.section == "system" && dEvent.method == "ExtrinsicFailed" && dData_i.module != undefined) {
                        //dData_i.module.msg = this.getErrorDoc(dData_i.module, api)
                        dData[i] = dData_i
                    } else if (dData_i.err != undefined && dData_i.err.module != undefined) {
                        //dData_i.err.module.msg = this.getErrorDoc(dData_i.err.module, api)
                        dData[i] = dData_i
                    }
                }
            } catch (e) {
                console.log(`parseEvent error`, e, `dData`, dData)
            }
        }
        dEvent.data = dData
        for (var i = 0; i < fields.length; i++) {
            var fld = fields[i]
            var valueType = fld.type.toJSON();
            var typeDef = api.registry.metadata.lookup.getTypeDef(valueType).type
            //var parsedEvent = this.api.createType(typeDef, data[i]);
            var name = fld.name.toString();
            var typeName = fld.typeName.toString();
            dType.push({
                typeDef: typeDef,
                name: name
            })
        }
        dEvent.dataType = dType
        return dEvent
    }

    // processEvents organizes events by its corresponding index
    processEvents(chainkey, apiAt, eventsRaw, numExtrinsics, blockNumber) {
        var events = [];
        for (let i = 0; i < numExtrinsics; i++) {
            events[i] = [];
        }

        for (let j = 0; j < eventsRaw.length; j++) {
            let e = eventsRaw[j]
            let index = -1;
            if (e.phase.applyExtrinsic != undefined) {
                index = e.phase.applyExtrinsic;
            }
            if (e.phase.initialization !== undefined || e.phase.finalization !== undefined) {
                // index 0 holds { moonbeam/moonriver reward events in e.phase.initialization.
                index = 0;
            }
            if (index >= 0) {
                let eventID = `${chainkey}-${blockNumber}-${index}-${j}`
                let event = this.parseEvent(e.event, eventID, apiAt); // this is the apiAt
                if (event) {
                    events[index].push(event)
                }
            }
        }
        return events;
    }

    async fetchExtrinsic(chainkey, extrinsicID = '118722-2') {
        let api = this.api
        let dEx;
        try {
            let pieces = extrinsicID.split('-')
            let blockNumber = pieces[0]
            let idx = pieces[1]
            let blockHash = await api.rpc.chain.getBlockHash(blockNumber)
            let eventsRaw = await api.query.system.events.at(blockHash);
            let events = eventsRaw.map((e) => {
                let eh = e.event.toHuman();
                let ej = e.event.toJSON();
                let out = JSON.parse(JSON.stringify(e));
                let data = out.event.data;
                out.event = {};
                out.event.data = data;
                out.event.method = {};
                out.event.method['pallet'] = eh.section;
                out.event.method['method'] = eh.method;
                return out
            });
            console.log(`#${blockNumber},  ${blockHash.toString()}`)
            var block = await api.rpc.chain.getBlock(blockHash);
            var sn = JSON.parse(JSON.stringify(block.toJSON()));
            var apiAt = await api.at(blockHash)
            var signedBlock = apiAt.registry.createType('SignedBlock', sn);
            let eventsIndexed = this.processEvents(chainkey, apiAt, events, signedBlock.block.extrinsics.length, blockNumber);
            let targetedExt = signedBlock.block.extrinsics[idx]
            dEx = this.decode_extrinsic(targetedExt, blockNumber, idx, apiAt)
            dEx.events = eventsIndexed[idx]
        } catch (e) {
            console.log(`fetchExtrinsic error`, e)
        }
        return dEx
    }

    async fetchAugments(chainkey) {
        console.log(`[${chainkey}] [Default Skip]`)
    }

    xTokensFilter(palletMethod) {
        if (palletMethod == "xTokens(TransferredMultiAssets)") {
            return true
        } else {
            return false;
        }
    }

    processOutgoingXTokens(chainkey, extrinsic) {
        //xTokens:TransferredMultiAssets
        /*
        [
            {
                "typeDef": "AccountId20",
                "name": "sender"
            },
            {
                "typeDef": "Vec<XcmV1MultiAsset>",
                "name": "assets"
            },
            {
                "typeDef": "{\"id\":\"XcmV1MultiassetAssetId\",\"fun\":\"XcmV1MultiassetFungibility\"}",
                "name": "fee"
            },
            {
                "typeDef": "{\"parents\":\"u8\",\"interior\":\"XcmV1MultilocationJunctions\"}",
                "name": "dest"
            }
        ]
        */
        let section_method = `${extrinsic.section}:${extrinsic.method}`
        let xTokensEvents = extrinsic.events.filter((ev) => {
            return this.xTokensFilter(`${ev.section}(${ev.method})`);
        })
        if (xTokensEvents.length != 1){
            console.log(`Skip xTokensEvents > 1 (cnt=${xTokensEvents.length})`)
            return
        }
        let eventData = xTokensEvents[0].data

        // can only establish linkage for xTokens:transfer xTokens:transferMulticurrencies
        let a = extrinsic.params
        let localXcAssetArr = []
        if (section_method == "xTokens:transfer" || section_method == "xTokens:transferMulticurrencies" || section_method == "xTokens:transferMultiasset") {
            switch (section_method) {
                //single transfer
                case "xTokens:transfer":
                    let [assetID, assetChainkey] = this.processXcmGenericCurrencyID(chainkey, a.currency_id) //inferred approach
                    if (assetID){
                        localXcAssetArr.push({assetID: assetID, assetChainkey: assetChainkey})
                    }
                    break;
                case "xTokens:transfer":
                    let currencies = a.currencies
                    for (const c of currencies) {
                        let [assetID, assetChainkey] = this.processXcmGenericCurrencyID(indexer, c[0]) //inferred approach
                        let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", `processOutgoingXTokensTransfer ${section_method}`, c[0])
                        if (assetID){
                            localXcAssetArr.push({assetID: assetID, assetChainkey: assetChainkey})
                        }else{
                            localXcAssetArr.push({assetID: false, assetChainkey: false})
                        }
                    }
                    break;
                default:
                    break;
            }
        }
        let aAsset = eventData[1] //Vec<XcmV1MultiAsset>
        let xcmInteriorKeyArr = []
        if (aAsset != undefined && Array.isArray(aAsset)) {
            // todo: extract this
            //if (this.debugLevel >= paraTool.debugInfo) console.log(`[${extrinsic.extrinsicHash}] processOutgoingXTokensEvent xTokens:transferMultiasset`)
            let assetArr = []
            assetArr = aAsset
            //no fee items
            for (const asset of assetArr) {
                // 0xc003ebdaaa4ef4d8ed2d89ca419cf79cefc883859ab9d74349d882dacf6bb811
                // {"id":{"concrete":{"parents":0,"interior":{"here":null}}},"fun":{"fungible":10324356190528}}
                if (asset.fun !== undefined && asset.fun.fungible !== undefined) {
                    let [targetSymbol, relayChain, targetXcmInteriorKey] = this.processV1ConcreteFungible(chainkey, asset)
                    if (targetXcmInteriorKey != undefined){
                        xcmInteriorKeyArr.push(targetXcmInteriorKey)
                    }else{
                        xcmInteriorKeyArr.push(false)
                    }
                } else {
                    console.log("asset v1 unknown", asset);
                    xcmInteriorKeyArr.push(false)
                }
            }
        } else {
            console.log(`[${extrinsic.extrinsicHash}] processOutgoingXTokens ${section_method} asset unknown`)
        }
        //console.log(`xcmInteriorKeyArr`, xcmInteriorKeyArr)
        //console.log(`localXcAssets`, localXcAssetArr)
        let augmentedMap = {}
        for (let i = 0; i < xcmInteriorKeyArr.length; i++){
            let xcmInteriorKey = xcmInteriorKeyArr[i]
            let localXcAsset =  localXcAssetArr[i]
            if (xcmInteriorKey && localXcAsset.assetID && localXcAsset.assetChainkey){
                augmentedMap[xcmInteriorKey] = {
                    xcmInteriorKey: localXcAsset.assetID,
                    assetID: localXcAsset.assetID,
                    assetChainkey: localXcAsset.assetChainkey,
                }
            }
        }
        console.log(`augmentedMap`, augmentedMap)
        return augmentedMap
    }


    getNativeSymbol(){
        if (this.nativeAsset != undefined && this.nativeAsset.assetChainkey != undefined){
            let assetChainkey = this.nativeAsset.assetChainkey
            return this.nativeAsset.assetChainkey
        }else{
            return false
        }
    }

    getRelayChainXcmInteriorKey(relayChain='polkadot'){
        //assume it's parachain asset has "here"
        let network = {}
        if (relayChain == 'kusama' || relayChain == 'polkadot') {
            network = {
                network: relayChain
            }
        } else {
            network = {
                named: garTool.stringToHex(relayChain)
            }
        }
        let interiorVStr = '"here"'
        let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
        return xcmInteriorKey
    }

    processXcmGenericCurrencyID(chainkey, currency_id) {
        //only handle assetpallet for now
        return this.processXcmDecHexCurrencyID(chainkey, currency_id)
    }

    processXcmDecHexCurrencyID(chainkey, currency_id) {
        let assetString = false
        let assetID = false
        let rawAssetID = null
        if (currency_id != undefined) {
            if (this.isObject(currency_id)) {
                if (currency_id.foreignAsset != undefined) {
                    rawAssetID = currency_id.foreignAsset
                } else if (currency_id.localAssetReserve != undefined) {
                    rawAssetID = currency_id.localAssetReserve
                } else if (currency_id.token2 != undefined) {
                    rawAssetID = currency_id.token2
                } else if (currency_id.selfReserve === null) {
                    // return native asset
                    let nativeSymbol = indexer.getNativeSymbol()
                    return nativeSymbol
                } else {
                    //if (this.debugLevel >= paraTool.debugInfo) console.log(`processDecHexCurrencyID currency_id unknown struct`, currency_id)
                    //TODO..
                }
            } else {
                // numbers
                rawAssetID = currency_id
            }
        }
        //if (this.debugLevel >= paraTool.debugTracing) console.log(`rawAssetID=${rawAssetID}, currency_id`, currency_id)
        if (rawAssetID != undefined) {
            let assetIDWithComma = garTool.toNumWithComma(garTool.dechexAssetID(rawAssetID))
            assetID = garTool.cleanedAssetID(assetIDWithComma)
            let parsedAsset = {
                Token: assetID
            }
            assetString = JSON.stringify(parsedAsset);
        }
        if (assetString) assetString = garTool.makeAssetChain(assetString, chainkey)
        return [assetID, assetString]
    }


    processV1ConcreteFungible(chainkey, fungibleAsset) {
        //v1
        // only parse the currency_id here
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
        /*
        "assets": {
          "v1": [
            {
              "id": {
                "concrete": {
                  "parents": 0,
                  "interior": {
                    "x2": [
                      {
                        "palletInstance": 50
                      },
                      {
                        "generalIndex": 8
                      }
                    ]
                  }
                }
              },
              "fun": {
                "fungible": 300000000000
              }
            }
          ]
        }
        "asset": {
          "v1": {
            "id": {
              "concrete": {
                "parents": 1,
                "interior": {
                  "here": null
                }
              }
            },
            "fun": {
              "fungible": 20469417452
            }
          }
        },
        */
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]

        //let relayChain = indexer.relayChain
        //let paraIDExtra = paraTool.getParaIDExtra(relayChain)
        let targetedAsset = false;
        let rawTargetedAsset = false;
        let targetSymbol = false;
        let targetXcmInteriorKey = false;
        //if (this.debugLevel >= paraTool.debugVerbose) console.log(`processV1ConcreteFungible asset`, fungibleAsset)
        if (fungibleAsset.id != undefined && fungibleAsset.id.null !== undefined) {
            targetSymbol = this.getNativeSymbol()
            //targetedAsset = indexer.getNativeAsset()
            //rawTargetedAsset = indexer.getNativeAsset()
            //WARNING: this case is not actionable
        } else if (fungibleAsset.id != undefined && fungibleAsset.id.concrete !== undefined) {
            //v1_id_concrete
            let v1_id_concrete = fungibleAsset.id.concrete
            if (v1_id_concrete.interior != undefined) {

                let v1_id_concrete_interior = v1_id_concrete.interior
                let v1_id_concrete_parents = v1_id_concrete.parents
                if (v1_id_concrete_interior != undefined && v1_id_concrete_interior.here !== undefined) {
                    if (v1_id_concrete_parents != undefined && v1_id_concrete_parents == 0) {
                        //normal case?
                        targetSymbol = this.getNativeSymbol()
                        //targetedAsset = indexer.getNativeAsset()
                        //rawTargetedAsset = indexer.getNativeAsset()
                        //if (this.debugLevel >= paraTool.debugInfo) console.log(`processV1ConcreteFungible targetedAsset parents:0, here`, targetSymbol)
                    } else if (v1_id_concrete_parents != undefined && v1_id_concrete_parents == 1) {
                        //ump
                        targetXcmInteriorKey = this.getRelayChainXcmInteriorKey()
                        //targetedAsset = indexer.getRelayChainAsset()
                        //rawTargetedAsset = indexer.getRelayChainAsset()
                        //if (this.debugLevel >= paraTool.debugInfo) console.log(`processV1ConcreteFungible targetedAsset parents:1, here`, targetSymbol)
                    }
                    //} else if (v1_id_concrete_interior != undefined && v1_id_concrete_interior.x2 !== undefined && Array.isArray(v1_id_concrete_interior.x2)) {
                } else {
                    //v1_id_concrete_interior case [x1/x2/x3]
                    //TODO: this is outcoming - relaychain's perspective
                    let xType = Object.keys(v1_id_concrete_interior)[0]
                    let v1_id_concrete_interiorVal = v1_id_concrete_interior[xType]
                    if (v1_id_concrete_parents == 1) {
                        // easy case: no expansion
                    } else {
                        // expand the key
                        let new_v1_id_concrete_interiorVal = []
                        let paraChainID = indexer.chainID - paraIDExtra
                        let expandedParachainPiece = {
                            parachain: paraChainID
                        }
                        new_v1_id_concrete_interiorVal.push(expandedParachainPiece)
                        if (xType == 'x1') {
                            new_v1_id_concrete_interiorVal.push(v1_id_concrete_interiorVal)

                        } else if (Array.isArray(v1_id_concrete_interiorVal)) {
                            //x2/x3...
                            for (const v of v1_id_concrete_interiorVal) {
                                new_v1_id_concrete_interiorVal.push(v)
                                //if (this.debugLevel >= paraTool.debugInfo) console.log(`${indexer.chainID}, [parents=${v1_id_concrete_parents}] expandedkey ${JSON.stringify(v1_id_concrete_interiorVal)} ->  ${JSON.stringify(new_v1_id_concrete_interiorVal)}`)
                            }
                            //new_v1_id_concrete_interiorVal.concat(v1_id_concrete_interiorVal)
                        } else {
                            //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`processV1ConcreteFungible error. expecting array`, JSON.stringify(v1_id_concrete_interiorVal))
                        }
                        v1_id_concrete_interiorVal = new_v1_id_concrete_interiorVal
                    }

                    let interiorVStr = JSON.stringify(v1_id_concrete_interiorVal)
                    let network = {}
                    if (relayChain == 'kusama' || relayChain == 'polkadot') {
                        network = {
                            network: relayChain
                        }
                    } else {
                        network = {
                            named: garTool.stringToHex(relayChain)
                        }
                    }
                    if ((interiork == 'here' || interiork == 'Here') && interior[interiorK] == null) {
                        interiorVStr = '"here"'
                    }
                    targetXcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                    let cachedXcmAssetInfo = this.manager.getXcmAsset(xcmInteriorKey)
                    if (cachedXcmAssetInfo != undefined && cachedXcmAssetInfo.nativeAssetChain != undefined) {
                        console.log(`processV1ConcreteFungible cachedXcmAssetInfo lookup failed! parents=[${v1_id_concrete_parents}] [${xType}]`, xcmInteriorKey)
                    } else {
                        console.log(`processV1ConcreteFungible cachedXcmAssetInfo lookup failed! parents=[${v1_id_concrete_parents}] [${xType}]`, xcmInteriorKey)
                        //lookup failed... should store the interiorVStr some where else for further debugging
                        //targetedAsset = interiorVStr
                        //rawTargetedAsset = interiorVStr
                    }
                }

            } else {
                //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`processV1ConcreteFungible unknown v1.id.concrete unknown!`, JSON.stringify(v1_id_concrete, null, 2))
            }
        } else {
            //if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`processV1ConcreteFungible fungibleAsset unknown id not found?`, fungibleAsset)
        }
        return [targetSymbol, relayChain, targetXcmInteriorKey]
        //return [targetedAsset, rawTargetedAsset]
    }

}
