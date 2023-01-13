const garTool = require("../garTool");
const ChainParser = require("./common_chainparser");

/*
Fork this template to create new custom parser

Support chains
[relaychain-paraID|projectName]
*/

module.exports = class MagataxParser extends ChainParser {

    parserName = 'Magatax';

    //change [garPallet:garPallet] to the location where the asset registry is located.  ex: [assets:metadata]
    garPallet = 'assetRegistry';
    garStorage = 'metadata';

    //change [xcGarPallet:xcGarStorage] to the location where the xc registry is located.  ex: [assetManager:assetIdType]
    xcGarPallet = 'assetRegistry'
    xcGarStorage = 'metadata'

    /*
    Not every parachain has published its xc Asset registry. But we
    can still augment xcAsset registry by inferring.

    To augment the xcAsset by parsing, please provide an array of xcm extrinsicIDs
    containing the xcAsset asset you try to cover:

    augment = {
        'relaychain-paraID': [{
            paraID: 'paraID',
            extrinsicIDs: ['extrinsicID']
        }]
    }
    */

    augment = {}

    isXcRegistryAvailable = true

    //step 1: parse gar pallet, storage for parachain's asset registry
    async fetchGar(chainkey) {
        // implement your gar parsing function here.
        await this.processMagataxGar(chainkey)
    }

    //step 2: parse xcGar pallet, storage for parachain's xc asset registry
    async fetchXcGar(chainkey) {
        if (!this.isXcRegistryAvailable) {
            // skip if xcGar parser is unavailable
            console.log(`[${chainkey}] ${this.parserName} xcGar NOT IMPLEMENTED - SKIP`)
            return
        }
        // implement your xcGar parsing function here.
        await this.processMagataxXcGar(chainkey)
    }

    //step 3: Optional augmentation by providing a list xcm extrinsicIDs
    async fetchAugments(chainkey) {
        // implement your augment parsing function here.
        await this.processMagataxAugment(chainkey)

    }

    //OrmlTraitsAssetRegistryAssetMetadata
    async processMagataxAssetsRegistryAssetRegistryInfo(chainkey, a) {
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]

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
                if (xcmAssetSruct.location != undefined){
                    console.log(`${assetID}`, `xcmAssetSruct.location`, xcmAssetSruct.location)
                    xcmAssetTypeV =  Object.keys(xcmAssetSruct.location)[0]
                }else{
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
                let xcmStandardized = JSON.parse(xcmInteriorKey)
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
                    xcmStandardized: xcmStandardized,
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

    // Implement gar parsing function here
    async processMagataxGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom GAR parser`)
        //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        if (a) {
            // step 1: use common Asset pallet parser func available at generic chainparser.
            let assetList = this.processGarAssetPallet(chainkey, a)
            // step 2: load up results
            for (const assetChainkey of Object.keys(assetList)) {
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(assetChainkey, assetInfo)
            }
        }
    }

    // Implement gar parsing function here
    async processMagataxXcGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom xcGAR parser`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        //step 0: use fetchQuery to retrieve xc registry at the location [assetManager:assetIdType]
        var a = await super.fetchQuery(chainkey, this.xcGarPallet, this.xcGarStorage, 'xcGAR')
        if (!a) return
        if (a) {
            // step 1: use common XcmAssetIdType parser func available at generic chainparser.
            let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processMagataxAssetsRegistryAssetRegistryInfo(chainkey, a)
            console.log(`custom xcAssetList=[${Object.keys(xcAssetList)}], updatedAssetList=[${Object.keys(updatedAssetList)}], unknownAsset=[${Object.keys(unknownAsset)}], assetIDList=[${Object.keys(assetIDList)}]`, xcAssetList)
            // step 2: load up results
            for (const xcmInteriorKey of Object.keys(xcAssetList)) {
                let xcmAssetInfo = xcAssetList[xcmInteriorKey]
                let assetID = assetIDList[xcmInteriorKey]
                this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                // update global xcRegistry to include assetID used by this parachain
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
            }
            for (const assetChainkey of Object.keys(updatedAssetList)) {
                let assetInfo = updatedAssetList[assetChainkey]
                this.manager.setChainAsset(assetChainkey, assetInfo, true)
            }
        }
    }

    async processMagataxAugment(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom augmentation`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        let recs = this.augment[chainkey]
        // step 0: fetch specified extrinsics
        let augmentedExtrinsics = await this.fetchAugmentedExtrincics(chainkey, recs)
        for (const augmentedExtrinsic of augmentedExtrinsics) {
            console.log(`augmentedExtrinsic`, augmentedExtrinsic)
            // step 1: use common xTokens parser func available at generic chainparser.
            let augmentedMap = this.processOutgoingXTokens(chainkey, augmentedExtrinsic)
            // step 2: load up results
            for (const xcmInteriorKey of Object.keys(augmentedMap)) {
                let augmentedInfo = augmentedMap[xcmInteriorKey]
                let assetID = augmentedInfo.assetID
                let assetChainkey = augmentedInfo.assetChainkey
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
                if (cachedAssetInfo) {
                    cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                    this.manager.setChainAsset(assetChainkey, cachedAssetInfo)
                }
            }
        }
    }
}
