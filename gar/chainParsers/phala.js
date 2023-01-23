const xcmgarTool = require("../xcmgarTool");
const ChainParser = require("./common_chainparser");

/*
Fork this template to create new custom parser

Support chains
polkadot-2035|phala
kusama-2004|khala
*/

module.exports = class PhalaParser extends ChainParser {

    parserName = 'Phala';

    //change [garPallet:garPallet] to the location where the asset registry is located.  ex: [assets:metadata]
    garPallet = 'assets';
    garStorage = 'metadata';

    //change [xcGarPallet:xcGarStorage] to the location where the xc registry is located.  ex: [assetManager:assetIdType]
    xcGarPallet = 'assetsRegistry'
    xcGarStorage = 'registryInfoByIds'

    augment = {}
    manualRegistry = {}

    isXcRegistryAvailable = true

    //step 1: parse gar pallet, storage for parachain's asset registry
    async fetchGar(chainkey) {
        // implement your gar parsing function here.
        await this.processPhalaGar(chainkey)
    }

    //step 2: parse xcGar pallet, storage for parachain's xc asset registry
    async fetchXcGar(chainkey) {
        if (!this.isXcRegistryAvailable) {
            // skip if xcGar parser is unavailable
            console.log(`[${chainkey}] ${this.parserName} xcGar NOT IMPLEMENTED - SKIP`)
            return
        }
        // implement your xcGar parsing function here.
        await this.processPhalaXcGar(chainkey)
    }

    //step 3: Optional augmentation by providing (a) a list xcm extrinsicIDs or (b) known xcmInteriorKeys-assets mapping
    async fetchAugments(chainkey) {
        // implement your augment parsing function here.
        await this.processPhalaAugment(chainkey)

    }

    // Implement phala gar parsing function here
    async processPhalaGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom GAR parser`)
        //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
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

    /* TODO: XC Registry Parsing: AssetsRegistryAssetRegistryInfo
    {
      location: {
        parents: 1
        interior: {
          X2: [
            {
              Parachain: 2,046
            }
            {
              PalletInstance: 5
            }
          ]
        }
      }
      reserveLocation: {
        parents: 1
        interior: {
          X1: {
            Parachain: 2,046
          }
        }
      }
      enabledBridges: [
        {
          config: Xcmp
          metadata:
        }
      ]
      properties: {
        name: Darwinia Parachain Token
        symbol: RING
        decimals: 18
      }
      executionPrice: 4,000,000,000,000,000,000,000
    }
    */
    async processXcmRegistryInfoByIds(chainkey, a) {
        // TODO: phala's AssetsRegistryAssetRegistryInfo is quite different than the common processXcmAssetIdToLocation
        // should consider implement new parser if format get changed in the future [V1-> location]
    }

    // Implement phala xcGar parsing function here
    async processPhalaXcGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom xcGAR parser`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        //step 0: use fetchQuery to retrieve xc registry at the location [assetManager:assetIdType]
        var a = await super.fetchQuery(chainkey, this.xcGarPallet, this.xcGarStorage, 'xcGAR')
        if (!a) return
        if (a) {
            // step 1: use common XcmAssetIdType parser func available at generic chainparser.
            let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processXcmAssetIdToLocation(chainkey, a)
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

    async processPhalaAugment(chainkey) {
        return
    }
}