const mysql = require("mysql2");
const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class BifrostParser extends ChainParser {
    constructor() {
        super()
    }

    //WIP assetRegistry.currencyMetadatas
    async fetchAssetRegistryCurrencyMetadatas(indexer) {
        if (!indexer.api) {
            console.log(`[fetchAssetRegistryCurrencyMetadatas] Fatal indexer.api not initiated`)
            return
        }
        var a;
        switch (indexer.chainID) {
            case paraTool.chainIDBifrostDOT:
            case paraTool.chainIDBifrostKSM:
                console.log(`fetch assetRegistry:currencyMetadatas`)
                a = await indexer.api.query.assetRegistry.currencyMetadatas.entries()
                break;
            default:
                break;
        }
        if (!a) return
        let assetList = {}
        // remove the Id prefix here
        a.forEach(async ([key, val]) => {
            let assetMetadata = val.toHuman()
            let parsedAsset = {}
            let assetKeyWithID = key.args.map((k) => k.toHuman())[0] //{"ForeignAssetId":"0"}
            let assetKey = Object.keys(assetKeyWithID)[0] // ForeignAssetId
            let assetKeyVal = this.cleanedAssetID(assetKeyWithID[assetKey]) // "123,456" or {"Token":"XXX"}
            if (assetKey == 'NativeAssetId') {
                //this is the bifrost case
                parsedAsset = assetKeyVal
            } else {
                // this is the acala/karura case
                let assetKeyWithoutID = assetKey.replace('Id', '') //ForeignAsset
                parsedAsset[assetKeyWithoutID] = assetKeyVal
            }
            var asset = JSON.stringify(parsedAsset);
            let assetChain = paraTool.makeAssetChain(asset, indexer.chainID);
            let cachedAssetInfo = indexer.assetInfo[assetChain]
            if (cachedAssetInfo != undefined && cachedAssetInfo.assetName != undefined && cachedAssetInfo.decimals != undefined && cachedAssetInfo.assetType != undefined && cachedAssetInfo.symbol != undefined && cachedAssetInfo.symbol != 'false') {
                //cached found
                if (this.debugLevel >= paraTool.debugVerbose) console.log(`cached AssetInfo found`, cachedAssetInfo)
                assetList[assetChain] = cachedAssetInfo
            } else {
                if (assetMetadata.decimals !== false && assetMetadata.symbol) {
                    let symbol = assetMetadata.symbol
                    let name = assetMetadata.name
                    if (indexer.chainID == paraTool.chainIDBifrostKSM || indexer.chainID == paraTool.chainIDBifrostDOT) {
                        //biforst VSToken has erroneous/ambiguous symbol representation
                        if (parsedAsset.VSToken != undefined) {
                            symbol = 'VS' + symbol
                            name = `Bifrost Voucher Slot ` + name
                        }
                    }
                    let assetInfo = {
                        name: name,
                        symbol: symbol,
                        decimals: assetMetadata.decimals,
                        assetType: paraTool.assetTypeToken
                    };
                    assetList[assetChain] = assetInfo
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`addAssetInfo [${asset}]`, assetInfo)
                    //await indexer.addAssetInfo(asset, indexer.chainID, assetInfo, 'fetchAssetRegistry');
                } else {
                    if (this.debugLevel >= paraTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
                }
            }
        });
        if (this.debugLevel >= paraTool.debugVerbose) console.log(assetList);
    }

}