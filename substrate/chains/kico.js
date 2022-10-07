const mysql = require("mysql2");
const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class KicoParser extends ChainParser {
    constructor() {
        super()
    }

    parseStorageKey(indexer, p, s, key, decoratedKey) {
        let pallet_section = `${p}:${s}`
        console.log(`kico parseStorageKey ps=${pallet_section}`)
        if (pallet_section == "dicoOracle:lockedPrice") {
            return this.getDicoOracleLockedPriceKey(indexer, decoratedKey);
        } else if (pallet_section == "stub_pallet:stub_section_a") {
            //console.log(`[] kico parseStorageKey ps=${pallet_section}`, `decoratedVal=${decoratedKey}`)
            return
        } else {
            return super.parseStorageKey(indexer, p, s, key, decoratedKey)
        }
    }

    parseStorageVal(indexer, p, s, val, decoratedVal, o = false) {
        let pallet_section = `${p}:${s}`
        console.log(`kico parseStorageVal ps=${pallet_section}`)
        if (pallet_section == "dicoOracle:lockedPrice") {
            //skip oracle:rawvalues
            //console.log(`kico parseStorageVal ps=${pallet_section} Im here`, `decoratedVal=${decoratedVal}`)
            return this.getDicoOracleLockedPriceVal(indexer, decoratedVal);
        } else if (pallet_section == "stub_pallet:stub_section_a") {
            //console.log(`[] kico parseStorageVal ps=${pallet_section}`, `decoratedVal=${decoratedVal}`)
            return
        } else {
            return super.parseStorageVal(indexer, p, s, val, decoratedVal, o);
        }
    }

    getDicoOracleLockedPriceKey(indexer, decoratedKey) {
        let k = JSON.parse(decoratedKey)
        console.log(`getDicoOracleLockedPriceKey`, k)
        var out = {};
        // oracle is in k[0]
        let assetID = this.cleanedAssetID(k[0]); //currencyID
        this.setAssetSymbolAndDecimals(indexer, assetID, out)
        return out
    }

    /*
    //{"0x000000000000000000899742ab13db2a"}
    */
    getDicoOracleLockedPriceVal(indexer, decoratedVal) {
        let k = JSON.parse(decoratedVal)
        console.log(`getDicoOracleLockedPriceVal in `, k)
        let res = {}
        let extraField = []
        //extraField['timestamp'] = Math.floor(k.timestamp / 1000)
        extraField['rawPrice'] = paraTool.dechexToInt(k)
        res["pv"] = ''
        res["extra"] = extraField
        console.log(`getDicoOracleLockedPriceVal`, res)
        return res
    }

    async processAssetsDicoOracles(indexer, p, s, e2) {
        let oracleDecimals = 12 // looks like 12??
        let price = e2.rawPrice / 10 ** oracleDecimals
        e2.price = price
        let assetID = JSON.parse(e2.asset)
        let parsedAsset = {
            Token: assetID
        }
        if (false) {
            // manually write native token price
            let nativeAssetString = indexer.getNativeAsset();
            indexer.updateAssetPrice(nativeAssetString, price, paraTool.assetTypeToken, paraTool.assetSourceOracle)
        }
        let assetString = JSON.stringify(parsedAsset);
        console.log(`processAssetsDicoOracles asset=${assetString}, price=${price}`, e2)
        //indexer.updateAssetPrice(assetString, price, paraTool.assetTypeToken, paraTool.assetSourceOracle)
    }

    async processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress) {
        let pallet_section = `${p}:${s}`
        console.log(`kico processAccountAsset ${pallet_section}`)
        switch (pallet_section) {
            case "Stub_pallet:Stub_section_a":
                //await this.processAssetsAccount_XYZ(indexer, p, s, e2, rAssetkey, fromAddress);
                break;
            default:
                super.processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress);
                break;
        }
        return;
    }

    async processAsset(indexer, p, s, e2) {
        let pallet_section = `${p}:${s}`
        console.log(`kico processAsset ${pallet_section}`)
        switch (pallet_section) {
            case "DicoOracle:LockedPrice":
                //console.log(`parallel here ${p}:${s} `, e2)
                await this.processAssetsDicoOracles(indexer, p, s, e2);
                break
            case "Stub_pallet:Stub_section_a":
                break;
            default:
                super.processAsset(indexer, p, s, e2);
                break;
        }
        return;
    }

    //kico
    async fetchCurrenciesDicoAssetInfos(indexer) {
        var a = await indexer.api.query.currencies.dicoAssetsInfo.entries()
        let assetList = {}
        /*
        {
          owner: 5EYCAe5gKYJ4BXfskBNYnUTPQ2A8wYeboUr8hn56xree2UA9
          metadata: {
            name: Amm KAR-aUSD
            symbol: KAR-aUSD
            decimals: 10
         }
       }
        */
        for (let i = 0; i < a.length; i++) {
            let key = a[i][0];
            let val = a[i][1];
            let assetID = this.cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
            let assetMeta = val.toHuman()
            let assetMetadata = assetMeta.metadata
            assetMetadata.owner = assetMeta.owner
            let parsedAsset = {
                Token: assetID
            }
            var asset = JSON.stringify(parsedAsset);
            let assetChain = paraTool.makeAssetChain(asset, indexer.chainID);
            let cachedAssetInfo = indexer.assetInfo[assetChain]
            if (cachedAssetInfo != undefined && cachedAssetInfo.assetName != undefined && cachedAssetInfo.decimals != undefined && cachedAssetInfo.assetType != undefined && cachedAssetInfo.symbol != undefined) {
                //cached found
                //console.log(`cached AssetInfo found`, cachedAssetInfo)
                assetList[asset] = cachedAssetInfo
            } else {
                if (assetMetadata.decimals && assetMetadata.symbol) {
                    let assetName = assetMetadata.name
                    let assetSymbol = assetMetadata.symbol
                    let assetType = assetSymbol.includes('Amm') ? paraTool.assetTypeLiquidityPair : paraTool.assetTypeToken
                    let assetInfo = {
                        name: assetName,
                        symbol: assetMetadata.symbol,
                        decimals: assetMetadata.decimals,
                        assetType: assetType,
                        currencyID: assetID
                    };
                    assetList[asset] = assetInfo
                    console.log(`addAssetInfo [${asset}]`, assetInfo)
                    await indexer.addAssetInfo(asset, indexer.chainID, assetInfo, 'fetchAsset');
                } else {
                    console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
                }
            }
        }
        console.log(assetList);
    }
}