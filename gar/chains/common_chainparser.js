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
    isCustomParser = false;
    nativeAsset = false;

    constructor(api, manager, isCustomParser = true) {
        this.api = api
        this.manager = manager
        this.isCustomParser = isCustomParser
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

    async detectPalletStorage(chainkey, pallet, storage) {
        try {
            let api = this.api
            if (!api) {
                console.log(`[fetchAsset] Fatal: ${chainkey} api not initiated`)
                return false
            }
            var a = await api.query[pallet][storage].entries()
            if (!a) {
                console.log(`[${chainkey}] detectPalletStorage [${pallet}:${storage}] detected!`)
                return true
            }
        } catch (e) {
            console.log(`err [${chainkey}] detectPalletStorage [${pallet}:${storage}] not detected!`)
            return false
        }
        console.log(`[${chainkey}] detectPalletStorage [${pallet}:${storage}] not detected!`)
        return false
    }

    async getSystemProperties(chainkey) {
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
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
                if (i == 0) {
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

    processGarAssetPallet(chainkey, a) {
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

            if (assetMetadata.metadata != undefined) assetMetadata = assetMetadata.metadata //kusama-2118|listen has extra metadata
            if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                let name = (assetMetadata.name != undefined) ? assetMetadata.name : `${assetMetadata.symbol}` //kusama-2090|basilisk doens't have assetName, use symbol in this case
                let assetInfo = {
                    name: name,
                    symbol: assetMetadata.symbol,
                    decimals: garTool.dechexToInt(assetMetadata.decimals),
                    assetType: garTool.assetTypeToken,
                    currencyID: assetID
                };
                if (this.isMatched(chainkey, ['polkadot-2012|parallel', 'kusama-2085|heiko'])) {
                    if (assetInfo.symbol.includes('LP-')) assetInfo.assetType = garTool.assetTypeLiquidityPair
                    //console.log('im here fetchAssetPallet assetInfo', assetInfo)
                }
                assetList[assetChainkey] = assetInfo
                //this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
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
    async processCommonAssetPalletGar(chainkey, garPallet = 'assets', garStorage = 'metadata') {
        console.log(`[${chainkey}] Generic GAR parser`)
        //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
        let a = await this.fetchQuery(chainkey, garPallet, garStorage, 'GAR')
        if (a) {
            // step 1: use common Asset pallet parser func available at generic chainparser.
            let assetList = this.processGarAssetPallet(chainkey, a)
            // step 2: load up results
            for (const assetChainkey of Object.keys(assetList)) {
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
            }
        }
    }

    /* Token Pallet Parsing
    Fetch asset registry for parachain that use generic token pallet, currently
    covering the following chains:
    [
    'polkadot-2000|acala', 'kusama-2000|karura',
    'polkadot-2030|bifrost', 'kusama-2001|bifrost'
    ]
    */
    async processCommonTokensPalletGar(chainkey, garPallet = 'assetRegistry', garStorage = 'assetMetadatas') {
        console.log(`[${chainkey}] Generic GAR parser`)
        //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
        let a = await super.fetchQuery(chainkey, garPallet, garStorage, 'GAR')
        if (a) {
            // step 1: use common Asset pallet parser func available at generic chainparser.
            let assetList = this.processGarTokensPallet(chainkey, a)
            // step 2: load up results
            for (const assetChainkey of Object.keys(assetList)) {
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
            }
        }
    }

    processGarTokensPallet(chainkey, a) {
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
                    decimals: garTool.dechexToInt(assetMetadata.decimals),
                    assetType: garTool.assetTypeToken
                };
                assetList[assetChainkey] = assetInfo
                console.log(`addAssetInfo [${asset}]`, assetInfo)
                //this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
            } else {
                //if (this.debugLevel >= garTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
            }
        }
        console.log(`[${chainkey}] onchain GAR:`, assetList);
        return assetList
    }

    /* XC Registry Parsing
    Format Key - AssetID Val - {assetIdType}
    Fetch xcm asset registry for parachain that uses similar assetRegistry pallet,
    currently covering the following chains:
    [
    'polkadot-2006|astar', 'kusama-2007|shiden', 'kusama-2012|shadow', 'kusama-2084|calamari'
    ]
    */
    async processXcmAssetIdToLocation(chainkey, a) {
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = garTool.dechexToInt(pieces[1])

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
            //let paraID = 0
            let chainID = -1

            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);

            let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol : ''
                let nativeSymbol = symbol
                let decimals = cachedAssetInfo.decimals

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

                let [paraID, standardizedInteriorK, standardizedInteriorV] = this.standardizeXcmMultilocation(parents, interiork, interiorV, paraIDSource)

                // standardizing Acala's stablecoin to AUSD on polkadot; karura's stablecoin to KUSD on kusama
                if (symbol.toUpperCase == 'AUSD' || symbol.toUpperCase == 'KUSD') {
                    if (relayChain == 'polkadot') {
                        nativeSymbol = 'AUSD'
                    } else if (relayChain == 'kusama') {
                        nativeSymbol = 'KUSD'
                    }
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);
                let interiorVStr = JSON.stringify(standardizedInteriorV)
                let network = garTool.encodeNetwork(relayChain)
                if ((standardizedInteriorK == 'here' || standardizedInteriorK == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1Standardized = JSON.parse(xcmInteriorKey)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultiLocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, chainkey);

                let xcmAssetInfo = {
                    //interior: interiorVStr, //interior
                    paraID: paraID,
                    relayChain: relayChain,
                    symbol: nativeSymbol,
                    decimals: decimals,
                    interiorType: standardizedInteriorK,
                    //xcmInteriorKey: xcmInteriorKey,
                    xcmV1Standardized: xcmV1Standardized,
                    xcmV1MultiLocationByte: xcmV1MultiLocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    confidence: 1,
                    source: [paraIDSource],
                }
                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                xcAssetList[xcmInteriorKey] = xcmAssetInfo
                assetIDList[xcmInteriorKey] = assetID
                updatedAssetList[assetChainkey] = cachedAssetInfo
            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
                unknownAsset[assetChainkey] = 1
            }
        }
        return [xcAssetList, assetIDList, updatedAssetList, unknownAsset]
    }

    /* XC Registry Parsing
    Format Key - AssetID Val - {AssetsRegistryAssetMetadata}
    Fetch xcm asset registry for parachain that uses similar assetRegistry pallet,
    currently covering the following chains:
    [
    'polkadot-2032|interlay', 'kusama-2092|kintsugi', 'kusama-2110|mangatax',
    ]
    */
    //OrmlTraitsAssetRegistryAssetMetadata, AssetsRegistryAssetRegistryInfo
    async processXcmAssetsRegistryAssetMetadata(chainkey, a) {
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = garTool.dechexToInt(pieces[1])

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
            //let paraID = 0
            let chainID = -1

            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);

            let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol : ''
                let nativeSymbol = symbol
                let decimals = cachedAssetInfo.decimals

                let xcmAssetSruct = val.toJSON()
                // type V0/V1/...
                let xcmAssetTypeV;
                if (xcmAssetSruct.location != undefined) {
                    console.log(`${assetID}`, `xcmAssetSruct.location`, xcmAssetSruct.location)
                    xcmAssetTypeV = Object.keys(xcmAssetSruct.location)[0]
                } else {
                    console.log(`${chainkey} NOT xcmAsset`, `xcmAssetSruct`, xcmAssetSruct)
                    continue
                }
                let xcmAsset = xcmAssetSruct.location[xcmAssetTypeV]
                if (xcmAsset == undefined) {
                    console.log(`${chainkey} xcmAsset parsing failed!, xcmAssetTypeV=${xcmAssetTypeV}`, `xcmAssetSruct`, xcmAssetSruct)
                    continue
                }
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

                let [paraID, standardizedInteriorK, standardizedInteriorV] = this.standardizeXcmMultilocation(parents, interiork, interiorV, paraIDSource)

                // standardizing Acala's stablecoin to AUSD on polkadot; karura's stablecoin to KUSD on kusama
                if (symbol.toUpperCase == 'AUSD' || symbol.toUpperCase == 'KUSD') {
                    if (relayChain == 'polkadot') {
                        nativeSymbol = 'AUSD'
                    } else if (relayChain == 'kusama') {
                        nativeSymbol = 'KUSD'
                    }
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);
                let interiorVStr = JSON.stringify(standardizedInteriorV)
                let network = garTool.encodeNetwork(relayChain)
                if ((standardizedInteriorK == 'here' || standardizedInteriorK == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1Standardized = JSON.parse(xcmInteriorKey)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultiLocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, chainkey);

                let xcmAssetInfo = {
                    //interior: interiorVStr, //interior
                    paraID: paraID,
                    relayChain: relayChain,
                    symbol: nativeSymbol,
                    decimals: decimals,
                    interiorType: standardizedInteriorK,
                    //xcmInteriorKey: xcmInteriorKey,
                    xcmV1Standardized: xcmV1Standardized,
                    xcmV1MultiLocationByte: xcmV1MultiLocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    confidence: 1,
                    source: [paraIDSource],
                }
                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                xcAssetList[xcmInteriorKey] = xcmAssetInfo
                assetIDList[xcmInteriorKey] = assetID
                updatedAssetList[assetChainkey] = cachedAssetInfo
            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
                unknownAsset[assetChainkey] = 1
            }
        }
        return [xcAssetList, assetIDList, updatedAssetList, unknownAsset]
    }

    //standardizing parachain multilocation to relaychain multilocation
    standardizeXcmMultilocation(parents, interiork, interiorV, paraIDSource) {
        let paraID = 0
        if (parents == 1) {
            // easy case: no expansion
        } else if (parents == 0) {
            // standardizing to relaychain's perspective
            let new_interiorV = []
            let expandedParachainPiece = {
                parachain: paraIDSource
            }
            let new_interiork = interiork
            new_interiorV.push(expandedParachainPiece)
            if (interiork == 'here') {
                //check here?
                new_interiork = 'x1'
            } else if (interiork == 'x1') {
                new_interiorV.push(interiorV)
                new_interiork = 'x2'
            } else if (Array.isArray(interiorV)) {
                let xTypeInt = garTool.dechexToInt(z.substr(1)) + 1
                new_interiork = `x${xTypeInt}`
                //x2/x3...
                for (const v of interiorV) {
                    new_interiorV.push(v)
                }
            }
            interiorV = new_interiorV
            interiork = new_interiork
        }

        if ((typeof interiork == "string") && (interiork.toLowerCase() == 'here')) {
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
        }
        console.log(`** interiork=${interiork}, interiorV`, interiorV, `paraID: ${paraID}`)
        return [paraID, interiork, interiorV]
    }

    /* XC Registry Parsing
    Format Key - AssetID Val - {assetIdType}
    Fetch xcm asset registry for parachain that uses similar assetRegistry pallet,
    currently covering the following chains:
    [
    'polkadot-2004|moonbeam', 'kusama-2023|moonriver',
    'polkadot-2012|parallel', 'kusama-2085|heiko'
    'polkadot-2034|hydra', 'kusama-2090|basilisk'
    'kusama-2012|shadow'
    ]
    */
    async processXcmAssetIdType(chainkey, a) {

        //console.log(`processXcmAssetIdType [${chainkey}]`, a)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = garTool.dechexToInt(pieces[1])

        let api = this.api
        let xcAssetList = {}
        let assetIDList = {}
        let updatedAssetList = {}
        let unknownAsset = {}

        try {
            //return [xcAssetList, xcAssetList, xcAssetList, xcAssetList]
            //let relayChainID = garTool.getRelayChainID(relayChain)
            //let paraIDExtra = garTool.getParaIDExtra(relayChain)

            for (let i = 0; i < a.length; i++) {
                let key = a[i][0];
                let val = a[i][1];
                let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
                let parsedAsset = {
                    Token: assetID
                }
                let chainID = -1
                //let paraID = 0
                var asset = JSON.stringify(parsedAsset);
                let assetChainkey = garTool.makeAssetChain(asset, chainkey);
                let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
                if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                    console.log(`cached AssetInfo found`, cachedAssetInfo)
                    let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol.replace('xc', '') : ''
                    let nativeSymbol = symbol
                    let decimals = cachedAssetInfo.decimals
                    let xcmAssetJSON = val.toJSON()
                    let xcmAsset = (xcmAssetJSON.xcm != undefined) ? xcmAssetJSON.xcm : xcmAssetJSON
                    let parents = xcmAsset.parents
                    let interior = xcmAsset.interior
                    //x1/x2/x3 refers to the number to params
                    let interiorK = Object.keys(interior)[0]
                    let interiork = garTool.firstCharLowerCase(interiorK)
                    let interiorV = interior[interiorK]

                    let [paraID, standardizedInteriorK, standardizedInteriorV] = this.standardizeXcmMultilocation(parents, interiork, interiorV, paraIDSource)
                    let interiorVStr = JSON.stringify(standardizedInteriorV)
                    let network = garTool.encodeNetwork(relayChain)

                    if ((standardizedInteriorK == 'here' || standardizedInteriorK == 'Here') && interior[interiorK] == null) {
                        interiorVStr = '"here"'
                    }
                    let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                    let xcmV1Standardized = JSON.parse(xcmInteriorKey)
                    let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                    let xcmV1MultiLocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null

                    // standardizing Acala's stablecoin to AUSD on polkadot; karura's stablecoin to KUSD on kusama
                    if (symbol.toUpperCase == 'AUSD' || symbol.toUpperCase == 'KUSD') {
                        if (relayChain == 'polkadot') {
                            nativeSymbol = 'AUSD'
                        } else if (relayChain == 'kusama') {
                            nativeSymbol = 'KUSD'
                        }
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
                        //interior: interiorVStr, //interior
                        paraID: paraID,
                        relayChain: relayChain,
                        symbol: nativeSymbol,
                        decimals: decimals,
                        interiorType: standardizedInteriorK,
                        //xcmInteriorKey: xcmInteriorKey,
                        xcmV1Standardized: xcmV1Standardized,
                        xcmV1MultiLocationByte: xcmV1MultiLocationByte,
                        xcmV1MultiLocation: xcmV1MultiLocation,
                        xcContractAddress: {},
                        xcCurrencyID: {},
                        confidence: 1,
                        source: [paraIDSource],
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
            console.log(`processXcmAssetIdType error`, e)
        }

        return [xcAssetList, assetIDList, updatedAssetList, unknownAsset]
    }

    /* XC Registry Parsing
    Format Key - [KeyStruct] Val - {assetIdType}
    Fetch xcm asset registry for parachain that uses similar assetRegistry pallet,
    currently covering the following chains:
    [
    'polkadot-2000|acala', 'kusama-2000|karura'
    polkadot-2030|bifrost, 'kusama-2001|bifrost'
    ]
    */
    async processXcmForeignAssetLocations(chainkey, a, useForeignAssetPrefix = false) {

        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = garTool.dechexToInt(pieces[1])

        //let assetList = {}
        let api = this.api
        let xcAssetList = {}
        let assetIDList = {}
        let updatedAssetList = {}
        let unknownAsset = {}

        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = garTool.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let parsedAsset = {};
            if (useForeignAssetPrefix) {
                parsedAsset.ForeignAsset = assetID
                assetID = {
                    ForeignAsset: assetID
                }
            } else {
                parsedAsset = assetID
            }
            //let paraID = 0
            let chainID = -1

            var asset = JSON.stringify(parsedAsset);
            let assetChainkey = garTool.makeAssetChain(asset, chainkey);
            let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
            if (cachedAssetInfo != undefined && cachedAssetInfo.symbol != undefined) {
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                let symbol = (cachedAssetInfo.symbol) ? cachedAssetInfo.symbol : ''
                let nativeSymbol = symbol
                let decimals = cachedAssetInfo.decimals
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
                let [paraID, standardizedInteriorK, standardizedInteriorV] = this.standardizeXcmMultilocation(parents, interiork, interiorV, paraIDSource)

                // standardizing Acala's stablecoin to AUSD on polkadot; karura's stablecoin to KUSD on kusama
                if (symbol.toUpperCase == 'AUSD' || symbol.toUpperCase == 'KUSD') {
                    if (relayChain == 'polkadot') {
                        nativeSymbol = 'AUSD'
                    } else if (relayChain == 'kusama') {
                        nativeSymbol = 'KUSD'
                    }
                }
                let nativeParsedAsset = {
                    Token: nativeSymbol
                }
                var nativeAsset = JSON.stringify(nativeParsedAsset);
                let interiorVStr = JSON.stringify(standardizedInteriorV)

                let network = garTool.encodeNetwork(relayChain)
                if ((standardizedInteriorK == 'here' || standardizedInteriorK == 'Here') && interior[interiorK] == null) {
                    interiorVStr = '"here"'
                }
                let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
                let xcmV1Standardized = JSON.parse(xcmInteriorKey)
                let xcmV1MultiLocation = garTool.convertXcmInteriorKeyToXcmV1MultiLocation(xcmInteriorKey)
                let xcmV1MultiLocationByte = (xcmV1MultiLocation) ? garTool.convertXcmV1MultiLocationToByte(xcmV1MultiLocation, api) : null

                //console.log(`${chainID} '${interiorVStr}' ${nativeAsset} [${paraID}] | [${symbol}] [${interiorK}]`)
                //if (this.debugLevel >= garTool.debugInfo) console.log(`addXcmAssetInfo [${asset}]`, assetInfo)
                let nativeAssetChainkey = garTool.makeAssetChain(nativeAsset, chainkey);
                let xcmAssetInfo = {
                    //interior: interiorVStr, //interior
                    paraID: paraID,
                    relayChain: relayChain,
                    symbol: nativeSymbol,
                    decimals: decimals,
                    interiorType: standardizedInteriorK,
                    //xcmInteriorKey: xcmInteriorKey,
                    xcmV1Standardized: xcmV1Standardized,
                    xcmV1MultiLocationByte: xcmV1MultiLocationByte,
                    xcmV1MultiLocation: xcmV1MultiLocation,
                    xcContractAddress: {},
                    xcCurrencyID: {},
                    confidence: 1,
                    source: [paraIDSource],
                }

                //For cached found case: let's write xcmInteriorKey back to the cachedAssetInfo
                cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                xcAssetList[xcmInteriorKey] = xcmAssetInfo
                assetIDList[xcmInteriorKey] = assetID
                updatedAssetList[assetChainkey] = cachedAssetInfo

            } else {
                console.log(`[${chainkey}] AssetInfo unknown -- skip`, assetChainkey)
                unknownAsset[assetChainkey] = 1
            }
        }
        return [xcAssetList, assetIDList, updatedAssetList, unknownAsset]
    }

    //decode extrinsic to the format used by polkaholic
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

    //tranform evnet to the format used by polkaholic
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

    //processEvents organizes events by its corresponding index
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

    //fetch extrinsic in the format used by polkaholic, including events
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
            //console.log(`#${blockNumber} blkHash=${blockHash.toString()}`)
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

    //fetch a list of extrinsic in the format used by polkaholic, including the events
    async fetchAugmentedExtrincics(chainkey, recs) {
        //let recs = this.augment[chainkey]
        let augmentedExtrinsics = []
        console.log(`[${chainkey}] fetchAugmentedExtrincics`, 'recs', recs)
        if (recs != undefined && Array.isArray(recs)) {
            for (const r of recs) {
                for (const extrinsicID of r.extrinsicIDs) {
                    console.log(`fetchAugmentedExtrincics [${extrinsicID}]`)
                    let dEx = await this.fetchExtrinsic(chainkey, extrinsicID)
                    console.log(`[${extrinsicID}]`, JSON.stringify(dEx))
                    augmentedExtrinsics.push(dEx)
                }
            }
        } else {
            console.log(`No augmentation found`)
        }
        return augmentedExtrinsics
    }

    async fetchAugments(chainkey) {
        console.log(`[${chainkey}] [fetchAugments Default Skip]`)
    }

    processManualRegistry(chainkey, manualRecs) {
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        if (manualRecs != undefined && Array.isArray(manualRecs)) {
            // step 0: fetch local asset registry
            let localAssetMap = this.manager.getLocalAssetMap(chainkey)
            for (const r of manualRecs) {
                try {
                    let assetString = JSON.stringify(r.asset)
                    let xcmInteriorKey = r.xcmInteriorKey
                    //let xcmInteriorKey = JSON.stringify(r.xcmV1Standardized)
                    let assetChainkey = garTool.makeAssetChain(assetString, chainkey)
                    let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
                    if (cachedAssetInfo != undefined) {
                        cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                        this.manager.setChainAsset(chainkey, assetChainkey, cachedAssetInfo, true)
                    } else {
                        console.log(`[${chainkey}] Asset=${assetString} NOT FOUND Skip`)
                    }
                } catch (e) {
                    console.log(`processManualRegistry error`, e)
                    continue
                }
            }
        }
    }

    xTokensFilter(palletMethod) {
        if (palletMethod == "xTokens(TransferredMultiAssets)") {
            return true
        } else {
            return false;
        }
    }

    // Auto Inferring xcmInteriorKey <=> AssetID linkage given XTokens extrinsic. only support: [xTokens:transfer, xTokens:transferMulticurrencies]
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
        if (xTokensEvents.length != 1) {
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
                    if (assetID) {
                        localXcAssetArr.push({
                            assetID: assetID,
                            assetChainkey: assetChainkey
                        })
                    }
                    break;
                case "xTokens:transfer":
                    let currencies = a.currencies
                    for (const c of currencies) {
                        let [assetID, assetChainkey] = this.processXcmGenericCurrencyID(indexer, c[0]) //inferred approach
                        let targetedXcmInteriorKey = indexer.check_refintegrity_xcm_symbol(targetedSymbol, relayChain, chainID, chainIDDest, "processXcmGenericCurrencyID", `processOutgoingXTokensTransfer ${section_method}`, c[0])
                        if (assetID) {
                            localXcAssetArr.push({
                                assetID: assetID,
                                assetChainkey: assetChainkey
                            })
                        } else {
                            localXcAssetArr.push({
                                assetID: false,
                                assetChainkey: false
                            })
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
                    if (targetXcmInteriorKey != undefined) {
                        xcmInteriorKeyArr.push(targetXcmInteriorKey)
                    } else {
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
        let augmentedXcMap = {}
        for (let i = 0; i < xcmInteriorKeyArr.length; i++) {
            let xcmInteriorKey = xcmInteriorKeyArr[i]
            let localXcAsset = localXcAssetArr[i]
            if (xcmInteriorKey && localXcAsset.assetID && localXcAsset.assetChainkey) {
                augmentedXcMap[xcmInteriorKey] = {
                    xcmInteriorKey: xcmInteriorKey,
                    assetID: localXcAsset.assetID,
                    assetChainkey: localXcAsset.assetChainkey,
                }
            }
        }
        console.log(`augmentedXcMap`, augmentedXcMap)
        return augmentedXcMap
    }

    // Auto Inferring xcmInteriorKey convert XcmmultiAsset to polkaholic format
    processV1ConcreteFungible(chainkey, fungibleAsset) {
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = garTool.dechexToInt(pieces[1])

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
                        targetXcmInteriorKey = this.getRelayChainXcmInteriorKey(relayChain)
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
                    let network = garTool.encodeNetwork(relayChain)

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

    // Auto Inferring xcmInteriorKey - Unhandled case, skip
    getNativeSymbol() {
        if (this.nativeAsset != undefined && this.nativeAsset.assetChainkey != undefined) {
            let assetChainkey = this.nativeAsset.assetChainkey
            return this.nativeAsset.assetChainkey
        } else {
            return false
        }
    }

    // Auto Inferring xcmInteriorKey - hardcoded for Relaychain xcAsset
    getRelayChainXcmInteriorKey(relayChain = 'polkadot') {
        //assume it's parachain asset has "here"
        let network = garTool.encodeNetwork(relayChain)
        let interiorVStr = '"here"'
        let xcmInteriorKey = garTool.makeXcmInteriorKey(interiorVStr, network)
        return xcmInteriorKey
    }

    // Auto Inferring xcmInteriorKey - only support assetID conversion for now
    processXcmGenericCurrencyID(chainkey, currency_id) {
        //only handle assetpallet for now
        return this.processXcmDecHexCurrencyID(chainkey, currency_id)
    }

    // extract assetID form extrinsic args
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

}