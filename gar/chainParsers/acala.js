const xcmgarTool = require("../xcmgarTool");
const ChainParser = require("./common_chainparser");

/*
Fork this template to create new custom parser

Support chains
polkadot-2000|acala
kusama-2000|karura
*/

module.exports = class AcalaParser extends ChainParser {

    parserName = 'Acala';

    //change [garPallet:garPallet] to the location where the asset registry is located.  ex: [assets:metadata]
    garPallet = 'assetRegistry';
    garStorage = 'assetMetadatas';

    //change [xcGarPallet:xcGarStorage] to the location where the xc registry is located.  ex: [assetManager:assetIdType]
    xcGarPallet = 'assetRegistry'
    xcGarStorage = 'foreignAssetLocations'

    augment = {}
    manualRegistry = {
        "polkadot-2000":
        [
        {
            asset: {
                "Token": "ACA"
            },
            xcmInteriorKey: '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x0000"}]'
        },
        {
            asset: {
                "Token": "AUSD"
            },
            xcmInteriorKey: '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x0001"}]'
        },
        {
            asset: {
                "Token": "LDOT"
            },
            xcmInteriorKey: '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x0003"}]'
        },
        {
            asset: {
                "Token": "DOT"
            },
            xcmInteriorKey: '[{"network":"polkadot"},"here"]'
        },
        {
            asset: {
                "LiquidCrowdloan": "13"
            },
            xcmInteriorKey: '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x040d000000"}]'
        }
        ],
        'kusama-2000':
        [
        {
            asset: {
                "Token": "KAR"
            },
            xcmInteriorKey: '[{"network":"kusama"},{"parachain":2000},{"generalKey":"0x0080"}]'
        },
        {
            asset: {
                "Token": "KUSD"
            },
            xcmInteriorKey: '[{"network":"kusama"},{"parachain":2000},{"generalKey":"0x0081"}]'
        },
        {
            asset: {
                "Token": "LKSM"
            },
            xcmInteriorKey: '[{"network":"kusama"},{"parachain":2000},{"generalKey":"0x0083"}]'
        },
        {
            asset: {
                "Token": "KSM"
            },
            xcmInteriorKey: '[{"network":"kusama"},"here"]'
        },
        {
            asset: {
                "Token": "KINT"
            },
            xcmInteriorKey: '[{"network":"kusama"},{"parachain":2092},{"generalKey":"0x000c"}]'
        },
        {
            asset: {
                "Token": "KBTC"
            },
            xcmInteriorKey: '[{"network":"kusama"},{"parachain":2092},{"generalKey":"0x000b"}]'
        },
        ]
    }

    isXcRegistryAvailable = true

    //step 1: parse gar pallet, storage for parachain's asset registry
    async fetchGar(chainkey) {
        // implement your gar parsing function here.
        await this.processAcalaGar(chainkey)
    }

    //step 2: parse xcGar pallet, storage for parachain's xc asset registry
    async fetchXcGar(chainkey) {
        if (!this.isXcRegistryAvailable) {
            // skip if xcGar parser is unavailable
            console.log(`[${chainkey}] ${this.parserName} xcGar NOT IMPLEMENTED - SKIP`)
            return
        }
        // implement your xcGar parsing function here.
        await this.processAcalaXcGar(chainkey)
    }

    //step 3: Optional augmentation by providing (a) a list xcm extrinsicIDs or (b) known xcmInteriorKeys-assets mapping
    async fetchAugments(chainkey) {
        //[Optional A] implement your augment parsing function here.
        //await this.processAcalaAugment(chainkey)
        //[Optional B ] implement your manual registry here.
        await this.processAcalaManualRegistry(chainkey)
    }

    // add xcmInteriorKey for erc20
    isAcalaXcAsset(assetChainkey, prefixType = 'Erc20'){
      let xcmV1Standardized = false
      let [assetUnparsed, chainkey] = xcmgarTool.parseAssetChain(assetChainkey)
      try {
        let asset = JSON.parse(assetUnparsed)
        if (asset[prefixType] != undefined){
          let pieces = chainkey.split('-')
          let relayChain = pieces[0]
          let paraIDSource = xcmgarTool.dechexToInt(pieces[1])
          //Erc20: 0x54a37a01cd75b616d63e0ab665bffdb0143c52ae - >0x0254a37a01cd75b616d63e0ab665bffdb0143c52ae
          // > '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x CurrencyId encoded"}]'
          let prefixTypeIdx = '02' // erc20
          let currencyIdEncoded = '0x' + prefixTypeIdx + asset[prefixType].substr(2)
          xcmV1Standardized = [{network:relayChain},{parachain:paraIDSource},{generalKey: currencyIdEncoded}]
        }
      } catch (e){
        console.log(`isAcalaXcAsset err`, e)
      }
      return xcmV1Standardized
    }

    // Implement acala gar parsing function here
    async processAcalaGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom GAR parser`)
        //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        if (a) {
            // step 1: use common Asset pallet parser func available at generic chainparser.
            let assetList = this.processGarTokensPallet(chainkey, a)
            // step 2: load up results
            for (const assetChainkey of Object.keys(assetList)) {
                // [opinionated] publish aca erc20 with xcmInteriorKey
                let xcmV1Standardized = this.isAcalaXcAsset(assetChainkey)
                let assetInfo = assetList[assetChainkey]
                if (xcmV1Standardized){
                  assetInfo.xcmInteriorKey = JSON.stringify(xcmV1Standardized)
                }
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
            }
        }
    }

    // Implement acala xcGar parsing function here
    async processAcalaXcGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom xcGAR parser`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        //step 0: use fetchQuery to retrieve xc registry at the location [assetManager:assetIdType]
        var a = await super.fetchQuery(chainkey, this.xcGarPallet, this.xcGarStorage, 'xcGAR')
        if (!a) return
        if (a) {
            // step 1: use common XcmAssetIdType parser func available at generic chainparser.
            let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processXcmForeignAssetLocations(chainkey, a, true)
            console.log(`custom xcAssetList=[${Object.keys(xcAssetList)}], updatedAssetList=[${Object.keys(updatedAssetList)}], unknownAsset=[${Object.keys(unknownAsset)}], assetIDList=[${Object.keys(assetIDList)}]`, xcAssetList)
            // step 2: load up results
            for (const xcmInteriorKey of Object.keys(xcAssetList)) {
                let xcmAssetInfo = xcAssetList[xcmInteriorKey]
                let assetID = assetIDList[xcmInteriorKey]
                this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo, chainkey)
                // update global xcRegistry to include assetID used by this parachain
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, assetID, chainkey)
            }
            for (const assetChainkey of Object.keys(updatedAssetList)) {
                let assetInfo = updatedAssetList[assetChainkey]
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo, true)
            }
        }
    }

    async processAcalaManualRegistry(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} manual`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        let manualRecs = this.manualRegistry[chainkey]
        this.processManualRegistry(chainkey, manualRecs)
    }

    async processAcalaAugment(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom augmentation`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        let recs = this.augment[chainkey]
        // step 0: fetch specified extrinsics
        let augmentedExtrinsics = await this.fetchAugmentedExtrinsics(chainkey, recs)
        for (const augmentedExtrinsic of augmentedExtrinsics) {
            console.log(`augmentedExtrinsic`, augmentedExtrinsic)
            // step 1: use common xTokens parser func available at generic chainparser.
            let augmentedMap = this.processOutgoingXTokens(chainkey, augmentedExtrinsic)
            // step 2: load up results
            for (const xcmInteriorKey of Object.keys(augmentedMap)) {
                let augmentedInfo = augmentedMap[xcmInteriorKey]
                let assetID = augmentedInfo.assetID
                let assetChainkey = augmentedInfo.assetChainkey
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, assetID, chainkey)
                let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
                if (cachedAssetInfo) {
                    cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                    this.manager.setChainAsset(chainkey, assetChainkey, cachedAssetInfo)
                }
            }
        }
    }
}
