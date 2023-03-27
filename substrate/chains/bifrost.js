const mysql = require("mysql2");
const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class BifrostParser extends ChainParser {
    constructor() {
        super()
        this.chainParserName = 'Bifrost'
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
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetMetadata = val.toHuman()

            let parsedAsset = {}
            let assetKeyWithID = key.args.map((k) => k.toHuman())[0] //{"Token2":"2"} | LPToken | VSBOND2
            let assetRawKey = Object.keys(assetKeyWithID)[0]
            let assetKey = assetRawKey
            if (assetKey.slice(-1) == 2) {
                assetKey = assetKey.slice(0, -1)
            }
            console.log(`assetKey=${assetKey},assetRawKey=${assetRawKey} , assetMetadata=`, assetMetadata)
            let assetKeyVal = "";
            if (assetKey == "Token" || assetKey == "VSBond" || assetKey == "VToken" || assetKey == "VSToken") {
                let assetKey2 = `${assetKey}2`
                if (assetKeyWithID[assetRawKey] != undefined) {
                    //assetKeyVal = this.cleanedAssetID(assetKeyWithID[assetKey2]) // "123,456" or {"Token":"XXX"}
                    assetKeyVal = assetKeyWithID[assetRawKey]
                } else if (assetKeyWithID[assetRawKey] != undefined) {
                    //assetKeyVal = this.cleanedAssetID(assetKeyWithID[assetRawKey]) // "123,456" or {"Token":"XXX"}
                    assetKeyVal = assetKeyWithID[assetRawKey]
                }
            }
            console.log(`assetKey=${assetKey}, assetKeyVal=${assetKeyVal}`)
            if (assetKey == 'NativeAssetId') {
                //this is the bifrost case
                parsedAsset = assetKeyVal
            } else if (assetKey == "Stable" || assetKey == "Native") {
                parsedAsset[assetRawKey] = assetKeyWithID[assetRawKey]
            } else {
                // this is the acala/karura case
                //let assetKeyWithoutID = assetKey.replace('Id', '') //ForeignAsset
                let assetKeyWithoutID = assetRawKey.replace('Id', '') //ForeignAsset
                parsedAsset[assetKeyWithoutID] = assetKeyVal
            }
            var asset = JSON.stringify(parsedAsset);
            let isToken = asset.includes('"Token"')
            let assetChain = paraTool.makeAssetChain(asset, indexer.chainID);
            console.log(`assetChain=${assetChain}`, asset)
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
                            //symbol = 'VS' + symbol
                            //name = `Bifrost Voucher Slot ` + name
                        }
                    }
                    let assetInfo = {
                        name: name,
                        symbol: symbol,
                        decimals: assetMetadata.decimals,
                        assetType: paraTool.assetTypeToken
                    };
                    console.log(`assetInfo=${assetChain}`, assetInfo)
                    assetList[assetChain] = assetInfo
                    if (this.debugLevel >= paraTool.debugInfo) console.log(`addAssetInfo [${asset}]`, assetInfo)
                    await indexer.addAssetInfo(asset, indexer.chainID, assetInfo, 'fetchAssetRegistryCurrencyMetadatas');
                } else {
                    if (this.debugLevel >= paraTool.debugErrorOnly) console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
                }
            }

        }
        if (this.debugLevel >= paraTool.debugVerbose) console.log(assetList);
    }

}