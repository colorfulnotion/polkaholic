const mysql = require("mysql2");
const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class InterlayParser extends ChainParser {
    constructor() {
        super()
        this.chainParserName = 'Interlay'
    }

    getTotalIssuance(decoratedKey) {
        //Tokens:TotalIssuance
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //currencyID
        return out
    }

    getBalanceVal(p, s, val, decoratedVal) {
        //console.log(`${p}:${s}`, decoratedVal)
        let v = JSON.parse(decoratedVal)
        let res = {}
        let extraField = []
        for (let f in v) {
            extraField[f] = paraTool.dechexToInt(v[f])
        }
        res["pv"] = ''
        res["extra"] = extraField
        return res
    }

    getTotalIssuanceVal(val, decoratedVal) {
        let v = JSON.parse(decoratedVal)
        //let v = ledec(val)
        let res = {}
        let extraField = []
        extraField['totalIssuance'] = v
        res["pv"] = v //keep the high precision val in pv for now
        res["extra"] = extraField
        return res
    }

    async processTokensTotalIssuance(indexer, e2) {
        //get issuance here (if changed)
        let parsedAsset = JSON.parse(e2.asset)
        if (Array.isArray(parsedAsset) && parsedAsset.length == 2) { // parsedAsset['DexShare'] != undefined)
            //let pair = parsedAsset['DexShare']
            let decimals0 = await this.getAssetDecimal(indexer, JSON.stringify(parsedAsset[0]), "processTokensTotalIssuance");
            if (decimals0) {
                let issuance = e2.totalIssuance / 10 ** decimals0
                indexer.updateAssetIssuance(e2.asset, issuance, paraTool.assetTypeLiquidityPair);
            } else {
                indexer.logger.debug({
                    "op": "interlay-processTokensTotalIssuance",
                    "msg": "getAssetDecimal"
                });
            }
        } else {
            let asset = e2.asset
            let decimals = await this.getAssetDecimal(indexer, e2.asset, "processTokensTotalIssuance2");
            if (decimals) {
                let issuance = e2.totalIssuance / 10 ** decimals
                indexer.updateAssetIssuance(e2.asset, issuance, paraTool.assetTypeToken);
            } else {
                indexer.logger.debug({
                    "op": "interlay-processTokensTotalIssuance",
                    "msg": "getAssetDecimal"
                });
            }
        }
        //example: asset['{\"Token\":\"LKSM\"}'][Tokens-TotalIssuance] = pv
    }

    parseStorageKey(indexer, p, s, key, decoratedKey) {
        let pallet_section = `${p}:${s}`
        //console.log(`interlay parseStorageKey ${pallet_section}`)
        if (pallet_section == "tokens:totalIssuance") {
            //include asset
            return this.getTotalIssuance(decoratedKey);
        } else {
            return super.parseStorageKey(indexer, p, s, key, decoratedKey)
        }
    }

    parseStorageVal(indexer, p, s, val, decoratedVal, o = false) {
        let pallet_section = `${p}:${s}`
        //console.log(`interlay parseStorageVal ${pallet_section}`)
        if (pallet_section == "tokens:totalIssuance") {
            //include asset
            return this.getTotalIssuanceVal(val, decoratedVal);
        } else {
            return super.parseStorageVal(indexer, p, s, val, decoratedVal, o);
        }
    }

    async getAssetDecimal(indexer, asset, ctx) {
        let res = indexer.getAssetDecimal(asset, indexer.chainID, ctx);
        if (res) {
            return (res);
        }
        let parsedAsset = JSON.parse(asset);
        let assetInfo = await this.getAssetInfo(indexer, parsedAsset);
        if (assetInfo && assetInfo.decimals) {
            return assetInfo.decimals;
        }
        return (false);
    }

    async getAssetInfo(indexer, parsedAsset) {
        var asset = JSON.stringify(parsedAsset);
        let assetChain = paraTool.makeAssetChain(asset, indexer.chainID);
        if (indexer.assetInfo[assetChain] !== undefined) {
            if (asset == '{"LiquidCrowdloan":"13"}') {
                indexer.assetInfo[assetChain].name = 'lcDOT';
                indexer.assetInfo[assetChain].symbol = 'lcDOT';
            }
            //console.log(`getAssetInfo found`)
            return (indexer.assetInfo[assetChain]);
        } else {
            console.log(`getAssetInfo not found ${asset}`)
            return false
        }
        return (false);
    }

    async processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress) {
        let pallet_section = `${p}:${s}`
        //console.log(`interlay processAccountAsset ${pallet_section}`)
        super.processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress);
        return;
    }

    async processAsset(indexer, p, s, e2) {
        let pallet_section = `${p}:${s}`
        //console.log(`interlay processAsset ${pallet_section}`)
        if (pallet_section == 'Tokens:TotalIssuance') {
            await this.processTokensTotalIssuance(indexer, e2);
            // TODO
        } else {
            super.processAsset(indexer, p, s, e2);
        }
        return;
    }
}
