const xcmgarTool = require("../xcmgarTool");
const ChainParser = require("./common_chainparser");

/*
Fork this template to create new custom parser

Support chains
polkadot-2032|interlay
kusama-2092|kintsugi
*/

module.exports = class InterlayParser extends ChainParser {

    parserName = 'Interlay';

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
    manualRegistry = {
        "polkadot-2032": [{
            asset: {
                "Token": "INTR"
            },
            xcmInteriorKey: '[{"network":"polkadot"},{"parachain":2032},{"generalKey":"0x0002"}]'
        },
        {
            asset: {
                "Token": "IBTC"
            },
            xcmInteriorKey: '[{"network":"polkadot"},{"parachain":2032},{"generalKey":"0x0001"}]'
        }],
        'kusama-2092': [{
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
        }]
    }

    isXcRegistryAvailable = true

    //step 1: parse gar pallet, storage for parachain's asset registry
    async fetchGar(chainkey) {
        // implement your gar parsing function here.
        await this.processInterlayGar(chainkey)
    }

    //step 2: parse xcGar pallet, storage for parachain's xc asset registry
    async fetchXcGar(chainkey) {
        if (!this.isXcRegistryAvailable) {
            // skip if xcGar parser is unavailable
            console.log(`[${chainkey}] ${this.parserName} xcGar NOT IMPLEMENTED - SKIP`)
            return
        }
        // implement your xcGar parsing function here.
        await this.processInterlayXcGar(chainkey)
    }

    //step 3: Optional augmentation by providing (a) a list xcm extrinsicIDs or (b) known xcmInteriorKeys-assets mapping
    async fetchAugments(chainkey) {
        // implement your augment parsing function here.
        await this.processInterlayAugment(chainkey)
        await this.processInterlayManualRegistry(chainkey)

    }

    // Implement interlay gar parsing function here.
    async processInterlayGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom GAR parser`)
        //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        if (a) {
            // step 1: use common Asset pallet parser func available at generic chainparser.
            let assetList = this.processGarAssetPallet(chainkey, a)
            // step 2: load up results
            for (const assetChainkey of Object.keys(assetList)) {
                let assetInfo = assetList[assetChainkey]
                // [opinionated] Interlay's token:account is using 'ForeignAsset' prefix - we will manually generate this to match
                let standardizedAssetChainkey = this.padCurrencyID(assetChainkey)
                this.manager.setChainAsset(chainkey, standardizedAssetChainkey, assetInfo)
            }
        }
    }

    padCurrencyID(assetChainkey, prefixType = 'ForeignAsset'){
      let updatedAssetChainkey = assetChainkey
      let [assetUnparsed, chainkey] = xcmgarTool.parseAssetChain(assetChainkey)
      try {
        let asset = JSON.parse(assetUnparsed)
        let assetID = asset.Token
        if (assetID != undefined && xcmgarTool.isNumeric(assetID)){
          let updatedAssetID = {}
          updatedAssetID[prefixType] = `${assetID}`
          let assetString = xcmgarTool
          updatedAssetChainkey = xcmgarTool.makeAssetChain(JSON.stringify(updatedAssetID), chainkey)
        }
      } catch (e){
        console.log(`padCurrencyID err`, e)
      }
      return updatedAssetChainkey
    }

    // Implement interlay xcGar parsing function here
    async processInterlayXcGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom xcGAR parser`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        //step 0: use fetchQuery to retrieve xc registry at the location [assetManager:assetIdType]
        var a = await super.fetchQuery(chainkey, this.xcGarPallet, this.xcGarStorage, 'xcGAR')
        if (!a) return
        if (a) {
            // step 1: use common XcmAssetIdType parser func available at generic chainparser.
            let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processXcmAssetsRegistryAssetMetadata(chainkey, a)
            console.log(`custom xcAssetList=[${Object.keys(xcAssetList)}], updatedAssetList=[${Object.keys(updatedAssetList)}], unknownAsset=[${Object.keys(unknownAsset)}], assetIDList=[${Object.keys(assetIDList)}]`, xcAssetList)
            // step 2: load up results
            for (const xcmInteriorKey of Object.keys(xcAssetList)) {
                let xcmAssetInfo = xcAssetList[xcmInteriorKey]
                let assetID = assetIDList[xcmInteriorKey]
                this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo, chainkey)
                // update global xcRegistry to include assetID used by this parachain
                if (xcmgarTool.isNumeric(assetID)){
                  // [opinionated] Interlay's token:account is using 'ForeignAsset' prefix - we will manually generate this to match
                  let foreignAssetID = {
                    ForeignAsset: `${assetID}`
                  }
                  this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, foreignAssetID, chainkey)
                }else{
                  //system properties tokens like INTR, IBTC, ... etc
                  this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, assetID, chainkey)
                }
            }
            for (const assetChainkey of Object.keys(updatedAssetList)) {
                let assetInfo = updatedAssetList[assetChainkey]
                let standardizedAssetChainkey = this.padCurrencyID(assetChainkey)
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo, true)
            }
        }
    }

    async processInterlayManualRegistry(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} manual`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        let manualRecs = this.manualRegistry[chainkey]
        this.processManualRegistry(chainkey, manualRecs)
    }

    async processInterlayAugment(chainkey) {
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
