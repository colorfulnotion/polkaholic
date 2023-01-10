const garTool = require("../garTool");
const ChainParser = require("./chainparser");

module.exports = class HydraParser extends ChainParser {

    garPallet = 'currencies'
    garStorage = 'listenAssetsInfo'

    xcGarPallet = null
    xcGarStorage = null

    //augment = { "paraID": 2118, augmentations: [ {"section": "xTokens", "method": "transfer", "extrinsicIDs": ['118722-2']}]}

    augment = {
        'kusama-2118': [{
            paraID: 2118,
            extrinsicIDs: ['118722-2']
        }]
    }


    //step 1: parse gar pallet, storage
    async fetchGar(chainkey) {
        await this.fetchAssetPallet(chainkey)
    }

    //step 2: parse xcGar pallet, storage
    async fetchXcGar(chainkey) {
        console.log(`[${chainkey}] NOT IMPLEMENTED`)
    }

    //step 3: Optional augment result
    async fetchAugments(chainkey) {

        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSoure = pieces[1]

        let augmentedExtrinsics = await this.fetchXTokensAugments(chainkey)
        for (const augmentedExtrinsic of augmentedExtrinsics){
            console.log(`augmentedExtrinsic`, augmentedExtrinsic)
            let augmentedMap = this.processOutgoingXTokens(chainkey, augmentedExtrinsic)
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


    async fetchAssetPallet(chainkey) {
        console.log(`Listen custom fetchAssetPallet`)
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        if (a) {
            let assetList = this.processGarAsset(chainkey, a)
            for (const assetChainkey of Object.keys(assetList)) {
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(assetChainkey, assetInfo)
            }
        }
    }

    async fetchXTokensAugments(chainkey) {
        let recs = this.augment[chainkey]
        let augmentedExtrinsics = []
        console.log(`[${chainkey}] fetchXTokensAugments`, this.augment, 'recs', recs)
        if (recs != undefined && Array.isArray(recs)) {
            for (const r of recs) {
                for (const extrinsicID of r.extrinsicIDs) {
                    console.log(`TODO: fetchXTokensAugments [${extrinsicID}]`)
                    let dEx = await this.fetchExtrinsic(chainkey, extrinsicID)
                    console.log(`[${extrinsicID}]`, JSON.stringify(dEx))
                    augmentedExtrinsics.push(dEx)
                }
            }
        }
        return augmentedExtrinsics
    }
}
