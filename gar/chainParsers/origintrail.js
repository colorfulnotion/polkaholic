const xcmgarTool = require("../xcmgarTool");
const ChainParser = require("./common_chainparser");

/*
Fork this template to create new custom parser. And replace all [OriginTrail] in this
file with para name

Support chains
polkadot-2043|origintrail
*/

module.exports = class OriginTrailParser extends ChainParser {

    parserName = 'OriginTrail';

    //change [garPallet:garPallet] to the location where the asset registry is located.  ex: [assets:metadata]
    garPallet = 'assets';
    garStorage = 'metadata';

    //change [xcGarPallet:xcGarStorage] to the location where the xc registry is located.  ex: [assetManager:assetIdType]
    xcGarPallet = 'xcAssetConfig'
    xcGarStorage = 'assetIdToLocation'

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
    manualRegistry = {}

    isXcRegistryAvailable = true

    //step 1: parse gar pallet, storage for parachain's asset registry
    async fetchGar(chainkey) {
        // implement your gar parsing function here.
        await this.processOriginTrailGar(chainkey)
    }

    //step 2: parse xcGar pallet, storage for parachain's xc asset registry
    async fetchXcGar(chainkey) {
        if (!this.isXcRegistryAvailable) {
            // skip if xcGar parser is unavailable
            console.log(`[${chainkey}] ${this.parserName} xcGar NOT IMPLEMENTED - SKIP`)
            return
        }
        // implement your xcGar parsing function here.
        await this.processOriginTrailXcGar(chainkey)
    }

    //step 3: Optional augmentation by providing (a) a list xcm extrinsicIDs or (b) known xcmInteriorKeys-assets mapping
    async fetchAugments(chainkey) {
        //[Optional A] implement your augment parsing function here.
        await this.processOriginTrailAugment(chainkey)
        //[Optional B ] implement your manual registry here.
        await this.processOriginTrailManualRegistry(chainkey)
    }

    // Implement OriginTrail gar parsing function here
    async processOriginTrailGar(chainkey) {
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

    // Implement OriginTrail xcgar parsing function here
    async processOriginTrailXcGar(chainkey) {
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
                this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                // update global xcRegistry to include assetID used by this parachain
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, assetID)
            }
            for (const assetChainkey of Object.keys(updatedAssetList)) {
                let assetInfo = updatedAssetList[assetChainkey]
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo, true)
            }
        }
    }

    // Implement OriginTrail manual registry function here
    async processOriginTrailManualRegistry(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} manual`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        let manualRecs = this.manualRegistry[chainkey]
        this.processManualRegistry(chainkey, manualRecs)
    }

    // Implement OriginTrail Augment function here
    async processOriginTrailAugment(chainkey) {
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
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, assetID)
                let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
                if (cachedAssetInfo) {
                    cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                    this.manager.setChainAsset(chainkey, assetChainkey, cachedAssetInfo)
                }
            }
        }
    }
}
