const garTool = require("../garTool");
const ChainParser = require("./chainparser");

module.exports = class CalamariParser extends ChainParser {

    garPallet = 'assets'
    garStorage = 'metadata'

    xcGarPallet = 'assetManager'
    xcGarStorage = 'assetIdLocation'


    //step 1: parse gar pallet, storage
    async fetchGar(chainkey){
        await this.fetchAssetPallet(chainkey)
    }

    //step 2: parse xcGar pallet, storage
    async fetchXcGar(chainkey){
        await this.fetchXCMAssetIdToLocation(chainkey)
    }

    async fetchAssetPallet(chainkey) {
        console.log(`Calamari custom fetchAssetPallet`)
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        if (a){
            let assetList = this.processGarAsset(chainkey, a)
            for (const assetChainkey of Object.keys(assetList)){
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(assetChainkey, assetInfo)
            }
        }
    }

    async fetchXCMAssetIdToLocation(chainkey) {
        console.log(`Calamari custom fetchXCMAssetIdType`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]
        var a = await super.fetchQuery(chainkey, this.xcGarPallet, this.xcGarStorage, 'xcGAR')
        if (!a) return
        if (a){
            let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processXCMAssetIdToLocation(chainkey, a)
            console.log(`Calamari custom xcAssetList=${Object.keys(xcAssetList)},updatedAssetList=${Object.keys(updatedAssetList)},unknownAsset=${Object.keys(unknownAsset)}`, xcAssetList)
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
