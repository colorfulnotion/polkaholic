const garTool = require("../garTool");
const ChainParser = require("./chainparser");

module.exports = class HydraParser extends ChainParser {

    garPallet = 'currencies'
    garStorage = 'listenAssetsInfo'

    xcGarPallet = null
    xcGarStorage = null

    //step 1: parse gar pallet, storage
    async fetchGar(chainkey){
        await fetchAssetPallet(chainkey)
    }

    //step 2: parse xcGar pallet, storage
    async fetchXcGar(chainkey){
        console.log(`[${chainkey}] NOT IMPLEMENTED`)
    }

    async fetchAssetPallet(chainkey) {
        console.log(`Listen custom fetchAssetPallet`)
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        if (a){
            let assetList = this.processGarAsset(chainkey, a)
            for (const assetChainkey of Object.keys(assetList)){
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(assetChainkey, assetInfo)
            }
        }
    }
}
