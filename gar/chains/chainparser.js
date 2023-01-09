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

    async getSystemProperties(chainkey) {
        //let chainID = chain.chainID;
        let api = this.api
        if (!api){
            console.log(`[getSystemProperties] Fatal: ${chainkey} api not initiated`)
            return
        }
        let propsNative = await api.rpc.system.properties();
        let props = JSON.parse(propsNative.toString());
        // {"ss58Format":10,"tokenDecimals":[12,12,10,10],"tokenSymbol":["ACA","AUSD","DOT","LDOT"]}
        // NOT MAINTAINED let ss58Format = props.ss58Format;
        //console.log(propsNative)
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
            }
        }
    }

    async fetchQuery(chainkey, pallet, storage, queryType = 'GAR'){
        let api = this.api
        if (!api){
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

    processGarAsset(chainkey, a){
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
                    /*
                    this.manager.setChainAsset(assetChainkey, cachedAssetInfo, true)
                    console.log(`xcmAssetInfo ${xcmInteriorKey}`, xcmAssetInfo)
                    this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                    this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                    if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])) {
                        //For isEVMChain, compute the extra xcContractAddress
                        this.manager.addXcmAssetLocalxcContractAddress(xcmInteriorKey, paraIDSoure, assetID)
                    }
                    */
                    xcAssetList[xcmInteriorKey] = xcmAssetInfo
                    assetIDList[xcmInteriorKey] = assetID
                    updatedAssetList[assetChainkey] = cachedAssetInfo

                } else {
                    console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
                    unknownAsset[assetChainkey] = 1
                }
            }
        } catch (e){
            console.log(`processXCMAssetIdType error` , e)
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
}
