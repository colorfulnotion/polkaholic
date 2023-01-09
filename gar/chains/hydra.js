const garTool = require("../garTool");
const ChainParser = require("./chainparser");

module.exports = class HydraParser extends ChainParser {

    garPallet = 'assetRegistry'
    garStorage = 'assetMetadataMap'

    xcGarPallet = 'assetRegistry'
    xcGarStorage = 'assetLocations'

    //step 1: parse gar pallet, storage
    async fetchGar(chainkey){
        await this.fetchAssetPallet(chainkey)
    }

    //step 2: parse xcGar pallet, storage
    async fetchXcGar(chainkey){
        await this.fetchXCMAssetIdType(chainkey)
    }

    async fetchAssetPallet(chainkey) {
        console.log(`Hydra custom fetchAssetPallet`)
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        /* each parachain team may have slightly different pallet:storage name
        that uses the same/similar logic. The parser should redirect itself to
        the proper section
        */
        if (a){
            let assetList = this.processGarAsset(chainkey, a)
            for (const assetChainkey of Object.keys(assetList)){
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(assetChainkey, assetInfo)
            }
        }
    }

    async fetchXCMAssetIdType(chainkey) {
            console.log(`Hydra custom fetchXCMAssetIdType`)
            let pieces = chainkey.split('-')
            let relayChain = pieces[0]
            let paraIDSoure = pieces[1]

            var a = await super.fetchQuery(chainkey, this.xcGarPallet, this.xcGarStorage, 'xcGAR')
            if (!a) return
            if (a){
                let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processXCMAssetIdType(chainkey, a)
                console.log(`Hydra custom xcAssetList=${Object.keys(xcAssetList)},updatedAssetList=${Object.keys(updatedAssetList)},unknownAsset=${Object.keys(unknownAsset)}`, xcAssetList)
                for (const xcmInteriorKey of Object.keys(xcAssetList)){
                    let xcmAssetInfo = xcAssetList[xcmInteriorKey]
                    let assetID = assetIDList[xcmInteriorKey]
                    this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo)
                    this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSoure, assetID)
                }
                for (const assetChainkey of Object.keys(updatedAssetList)){
                    let assetInfo = updatedAssetList[assetChainkey]
                    this.manager.setChainAsset(assetChainkey, assetInfo, true)
                }
            }
    }
}
