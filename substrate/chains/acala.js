const mysql = require("mysql2");
const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class AcalaParser extends ChainParser {
    constructor() {
        super()
    }

    getTokensAccountsKey(indexer, decoratedKey) {
        //Tokens:Accounts
        // {"map":{"hashers":["Blake2_128Concat","Twox64Concat"],"key":"344","value":"348"}} (344 = (accountID, currencyID)
        /* https://github.com/open-web3-stack/open-runtime-module-library/blob/master/tokens/src/lib.rs#L282
        pub type Accounts<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::AccountId, Twox64Concat, T::CurrencyId, AccountData<T::Balance>, ValueQuery, >; */
        // ["pJhw2zYqTnW9m2ddvJCE3B2493ibxbRwJ7ksDTLzf5raEpv",{"DexShare":[{"Token":"KAR"},{"Token":"KSM"}]}]
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.accountID = k[0]; //accountID
        out.asset = k[1]; //currencyID
        return out
    }

    getLoansPositionsKey(indexer, decoratedKey) { // https://github.com/AcalaNetwork/Acala/blob/master/modules/loans/src/lib.rs
        //Loans:Positions
        /*
        [{"Token":"KSM"},"pJhw2zYqTnW9m2ddvJCE3B2493ibxbRwJ7ksDTLzf5raEpv"]
        */
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //currencyID
        out.accountID = k[1]; //accountID
        return out
    }

    getSharesAndWithdrawnRewardsKey(indexer, decoratedKey) {
        //Rewards:SharesAndWithdrawnRewards
        /* https://github.com/AcalaNetwork/Acala/blob/master/modules/incentives/src/lib.rs#L155
        pub type IncentiveRewardAmounts<T: Config> =
        StorageDoubleMap<_, Twox64Concat, PoolId, Twox64Concat, CurrencyId, Balance, ValueQuery>;
        */
        //[{"Loans":{"Token":"KSM"}},"pJhw2zYqTnW9m2ddvJCE3B2493ibxbRwJ7ksDTLzf5raEpv"]
        // 540a4f8754aa5298a3d6e9aa09e93f97fe48109ae17c059ed50f614155e4f189
        //k: 540a4f8754aa5298a3d6e9aa09e93f97fe48109ae17c059ed50f614155e4f189 c1ebbf19b8698d2a 010100800082 ceae2ff3fd9203b3 38c99b2437cca7279fb31231f3872f3fdecc5f87e0916a953fcf4e3b45658564
        //v: 01da87fc74281501000000000000000000080080129a351b042700000000000000000000008100000000000000000000000000000000

        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //currencyID
        out.accountID = k[1]; //accountID
        return out
    }

    getRewardsPoolInfoKey(indexer, decoratedKey) {
        //Rewards:PoolInfos

        //'[{"Dex":{"DexShare":[{"Token":"KUSD"},{"Token":"KSM"}]}}]'
        //'{"totalShares":"0x0000000000000000a3839510f632a1a7","rewards":{"{\\"token\\":\\"KAR\\"}":["0x000000000000000006f67009f7b12861","0x000000000000000004038edba08fe371"],"{\\"token\\":\\"KUSD\\"}":["0x000000000000000000f883e019b51bb8","0x0000000000000000008bedcdd72badca"]}}'
        // 540a4f8754aa5298a3d6e9aa09e93f97fe48109ae17c059ed50f614155e4f189
        //k: 540a4f8754aa5298a3d6e9aa09e93f97ba3cca541e15fdae81d9c9f150527367479e499d0a148444010100810082
        //v: 01a7a132f6109583a300000000000000000800806128b1f70970f606000000000000000071e38fa0db8e030400000000000000000081b81bb519e083f8000000000000000000caad2bd7cded8b000000000000000000

        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //poolID
        return out
    }

    getPendingMultiRewardsKey(indexer, decoratedKey) {
        //Incentives:PendingMultiRewards
        /* https://github.com/AcalaNetwork/Acala/blob/master/modules/incentives/src/lib.rs#L177
        pub type PendingMultiRewards<T: Config> =
        StorageDoubleMap< _, Twox64Concat, PoolId, Twox64Concat,T::AccountId,BTreeMap<CurrencyId, Balance>,ValueQuery,>;
        */
        //[{"Dex":{"DexShare":[{"Token":"KAR"},{"Token":"KSM"}]}},"tWo4S3gsxXVJbg2EgTorfXzcoPYPmGZf4THzHXHZNfYXcKR"]
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //poolID
        out.accountID = k[1]; //accountID
        return out
    }

    getTotalIssuanceKey(indexer, decoratedKey) {
        //Tokens:TotalIssuance
        /* https://github.com/open-web3-stack/open-runtime-module-library/blob/master/tokens/src/lib.rs#L258
        pub type TotalIssuance<T: Config> = StorageMap<_, Twox64Concat, T::CurrencyId, T::Balance, ValueQuery>;
        */
        //[{"DexShare":[{"Token":"KAR"},{"Token":"KSM"}]}]
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //currencyID
        return out
    }

    getDebitExchangeRateKey(indexer, decoratedKey) {
        //CdpEngine:DebitExchangeRate
        /* https://github.com/AcalaNetwork/Acala/blob/master/modules/cdp-engine/src/lib.rs#L269
        pub type DebitExchangeRate<T: Config> = StorageMap<_, Twox64Concat, CurrencyId, ExchangeRate, OptionQuery>;
        */
        //[{"Token":"KSM"}]
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //currencyID
        let assetString = JSON.stringify(k[0])
        out.decimals = this.getCachedAssetDecimal(indexer, assetString)
        //console.log(`getDebitExchangeRateKey`, out)
        return out
    }

    getLiquidityPoolKey(indexer, decoratedKey) {
        //Dex:LiquidityPool
        /*
        https://github.com/AcalaNetwork/Acala/blob/master/primitives/src/lib.rs#L124
        pub struct TradingPair(CurrencyId, CurrencyId);
        https://github.com/AcalaNetwork/Acala/blob/master/modules/dex/src/lib.rs#L205
        pub type LiquidityPool<T: Config> = StorageMap<_, Twox64Concat, TradingPair, (Balance, Balance), ValueQuery>;
        //k: f62adb4cbbb61c68b60fe8aabda1f8e3 64d90cadaa764fd8da11d8fb12a69a48 7838b2ea3ffb31cc00800082
        */
        //[[{"Token":"KAR"},{"Token":"KSM"}]]
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //tradingPair
        return out
    }

    getLiquidityPoolVal(val, decoratedVal) {
        //'["0x00000000000000000cb7cb4050a9bcc4","0x000000000000000000373a436a7443dd"]'
        let v = JSON.parse(decoratedVal)
        let token0 = paraTool.dechexToInt(v[0])
        let token1 = paraTool.dechexToInt(v[1])
        let res = {}
        let extraField = []
        extraField['lp0'] = token0
        extraField['lp1'] = token1
        res["pv"] = {
            token0: token0,
            token1: token1
        }
        res["extra"] = extraField
        return res
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
        extraField['totalIssuance'] = paraTool.dechexToInt(v)
        res["pv"] = v //keep the high precision val in pv for now
        res["extra"] = extraField
        return res
    }

    getDebitExchangeRateVal(val, decoratedVal) {
        let v = JSON.parse(decoratedVal)
        //let v = ledec(val)
        let res = {}
        let extraField = []
        extraField['debitExchangeRate'] = paraTool.dechexToInt(v)
        res["pv"] = v
        res["extra"] = extraField
        return res
    }

    getAcalaOracleKey(indexer, decoratedKey) {
        //console.log(`getAcalaOracleKey`, decoratedKey)
        //[{"Token":"KAR"}]
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0]; //tradingPair
        return out
    }


    getOrmlNFTTokensKey(indexer, decoratedKey) {
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = [k[0], k[1]];
        return out
    }

    getOrmlNFTTokensVal(val, decoratedVal) {
        let v = JSON.parse(decoratedVal)
        let extraField = {};
        let res = {};
        res["pv"] = v;
        /*
{
  metadata: '0x62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b7375',
  totalIssuance: 0,
  owner: '23M5ttkmR6KcnsARyoGv5Ymnr1YYkFMkN6rNMD8Df8BUHcQe',
  data: { deposit: 50035400000000, properties: 15, attributes: {} }
  }*/
        return res
    }

    /*
{"bn":367613,"p":"OrmlNFT","s":"Classes","k":"d9e6ccefd31ef77af06ab6328ed18d614e74d919ae81a9eee9e85acdc6cc581abfb27f1eaef06bb903000000","v":"d901ec62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b737500000000000000006d6f646c6163612f614e4654030000000000000000000000000000000000000000423ec6812d000000000000000000000f00","pk":"\"[\\\"3\\\"]\"","pv":"{\"metadata\":\"0x62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b7375\",\"totalIssuance\":0,\"owner\":\"23M5ttkmR6KcnsARyoGv5Ymnr1YYkFMkN6rNMD8Df8BUHcQe\",\"data\":{\"deposit\":50035400000000,\"properties\":15,\"attributes\":{}}}","debug":2}
*/
    getOrmlNFTClassesKey(indexer, decoratedKey) {
        let k = JSON.parse(decoratedKey)
        var out = {};
        out.asset = k[0];
        return out
    }

    getOrmlNFTClassesVal(val, decoratedVal) {
        let v = JSON.parse(decoratedVal)
        let extraField = {};
        let res = {};
        res["pv"] = v;
        /*
{
  metadata: '0x62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b7375',
  totalIssuance: 0,
  owner: '23M5ttkmR6KcnsARyoGv5Ymnr1YYkFMkN6rNMD8Df8BUHcQe',
  data: { deposit: 50035400000000, properties: 15, attributes: {} }
  }*/
        return res
    }

    getAcalaOracleVal(val, decoratedVal) {
        //console.log(`getAcalaOracleVal`, decoratedVal)
        let v = JSON.parse(decoratedVal)
        //let v = ledec(val)
        /*
        {value: 281,000,000,000,000,000,000
        timestamp: 1,639,518,810,420
        }
        */
        let res = {}
        let extraField = []
        extraField['timestamp'] = Math.floor(v.timestamp / 1000)
        extraField['rawPrice'] = paraTool.dechexToInt(v.value)
        res["pv"] = ''
        res["extra"] = extraField
        return res
    }

    async processAcalaOracles(indexer, e2) {
        let assetString = e2.asset
        let oracleDecimals = 18
        let price = e2.rawPrice / 10 ** oracleDecimals
        e2.price = price
        //console.log(`processAcalaOracles asset=${assetString}, price=${price}`, e2)
        indexer.updateAssetPrice(assetString, price, paraTool.assetTypeToken, paraTool.assetSourceOracle)
    }


    processIncentivesPendingMultiRewards(indexer, e2, rAssetkey, fromAddress) {
        // TODO PendingMultiRewards gives pending rewards (which can be more than 1)
        let aa = {};
        // pv: '{"{\\"token\\":\\"KAR\\"}":41329820,"{\\"token\\":\\"BNC\\"}":330640658}'
        if (!e2.pv) return;
        let pv = JSON.parse(e2.pv)
        let claimable = []
        let rewardsFound = false
        for (const rewardAsset of Object.keys(pv)) {
            //{ '{"token":"KAR"}': 41329820, '{"token":"BNC"}': 330640658 }
            //potentially emtpy
            let claimableAmount = paraTool.dechexToInt(pv[rewardAsset]) / 10 ** indexer.getChainDecimal(indexer.chainID)
            if (claimableAmount >= 0) {
                rewardsFound = true
                claimable.push({
                    asset: rewardAsset,
                    claimable: claimableAmount
                })
            }
        }
        if (claimable.length > 0) {
            aa["rewards"] = claimable
        }
        // TODO: need new strategy here
    }

    async updateLiquidityInfo(indexer) {
        let a = await indexer.api.query.dex.tradingPairStatuses.entries();
        let assetList = {}
        a.forEach(async ([key, val]) => {
            let assetMetadata = val.toHuman() //enabled
            let lp = key.args.map((k) => k.toHuman())[0]
            let lpAsset = JSON.stringify(lp)
            let lpAssetChain = paraTool.makeAssetChain(lpAsset, indexer.chainID);
            if (Array.isArray(lp) && lp.length == 2) {
                let lp0 = lp[0]
                let lp1 = lp[1]
                if (this.debugLevel >= paraTool.debugInfo) console.log(`updateLiquidityInfo LP0`, lp0, `LP1`, lp1)
                var asset0 = JSON.stringify(lp0);
                let assetChain0 = paraTool.makeAssetChain(asset0, indexer.chainID);
                var asset1 = JSON.stringify(lp1);
                let assetChain1 = paraTool.makeAssetChain(asset1, indexer.chainID);
                let cachedLPAssetInfo = indexer.assetInfo[lpAssetChain]
                if (cachedLPAssetInfo != undefined && cachedLPAssetInfo.token1Decimals != undefined && cachedLPAssetInfo.token0Decimals != undefined && cachedLPAssetInfo.assetName != undefined) {
                    //cached found
                    if (this.debugLevel >= paraTool.debugVerbose) console.log(`cached AssetInfo found`, cachedLPAssetInfo)
                    //assetList[asset] = cachedAssetInfo
                } else {
                    let token0 = indexer.assetInfo[assetChain0]
                    let token1 = indexer.assetInfo[assetChain1]
                    if (token0 && token1) {
                        //build lp here
                        let lpAssetInfo = {
                            assetType: paraTool.assetTypeLiquidityPair,
                            name: `${token0.assetName}/${token1.assetName}`,
                            symbol: `${token0.symbol}/${token1.symbol}`,
                            decimals: token0.decimals,
                            token0: token0.asset,
                            token0decimals: token0.decimals,
                            token0symbol: token0.symbol,
                            token1: token1.asset,
                            token1decimals: token1.decimals,
                            token1symbol: token1.symbol,
                        }
                        assetList[lpAssetChain] = lpAssetInfo
                        if (this.debugLevel >= paraTool.debugInfo) console.log(`lpAssetInfo [${lpAsset}]`, lpAssetInfo)
                        await indexer.addLpAssetInfo(lpAsset, indexer.chainID, lpAssetInfo, 'updateLiquidityInfo');
                    } else {
                        if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`COULD NOT ADD asset -- no assetType ${assetChain0}, ${assetChain1}`);
                    }
                }
            }
        });
        console.log(assetList);
    }

    async processLoansPositions(indexer, e2, rAssetkey, fromAddress) {
        //currently, loans is supplying either KSM or LKSM and burrowing KUSD
        let flds = ["collateral", "debit"];
        let cdpAssetKey = this.elevatedAssetKey(paraTool.assetTypeLoan, rAssetkey)
        let cdpAssetInfo = indexer.get_asset(cdpAssetKey)
        let usdExchangeRate = cdpAssetInfo ? cdpAssetInfo.debitExchangeRate : 0
        //console.log(`processLoansPositions ${cdpAssetKey}`, cdpAssetInfo, usdExchangeRate)
        let aa = {};

        for (let i = 0; i < flds.length; i++) {
            let fld = flds[i];
            if (fld == "collateral") {
                if (e2[fld] > 0) {
                    let sAsset = JSON.parse(e2.asset);
                    if (sAsset) {
                        aa["suppliedAsset"] = sAsset
                    }
                    let decimals = await this.getAssetDecimal(indexer, e2.asset, "processLoansPositions");
                    if (decimals) {
                        aa[fld] = e2[fld] / 10 ** decimals
                    } else {
                        indexer.logger.debug({
                            "op": "acala-processLoansPositions",
                            "msg": "getAssetDecimal FAIL"
                        });
                    }
                } else {
                    //TODO: must keep the zero here as this is saying that the cdp has been closed
                    //aa[fld] = 0;
                    //aa[fld + 'USD'] = 0;
                }
            } else if (fld == "debit") {
                // hard-coded debit decimals as 12 for {KUSD and AUSD}
                aa[fld] = e2[fld] / (10 ** 12)
                let borrowedAsset = (indexer.chainID == paraTool.chainIDKarura) ? '{"Token":"KUSD"}' : '{"Token":"AUSD"}' // hard-coded ausd for now..
                aa["borrowedAsset"] = JSON.parse(borrowedAsset);
                //aa["exchangeRate"] = usdExchangeRate
            }
        }

        /*
        {"Loan":{"Token":"ACA"}} {
          assetType: 'Loan',
          issuance: 0,
          debitExchangeRate: 0.10057305987187035
        }
        {
          suppliedAsset: { Token: 'ACA' },
          collateral: 476,
          debit: 497.151032094938,
          exchangeRate: 0.10057305987187035,
          borrowedAsset: { Token: 'AUSD' }
        }
        borrowed = debit*exchangeRate
        */
        let assetChain = paraTool.makeAssetChain(cdpAssetKey, indexer.chainID);
        //console.log(`processLoansPositions ${assetChain} ${fromAddress}`, e2, aa)
        indexer.updateAddressStorage(fromAddress, assetChain, "acala:processLoansPositions-loans", aa, this.parserTS, this.parserBlockNumber, paraTool.assetTypeLoan);
    }

    processRewardsSharesAndWithdrawnRecords(indexer, e2, rAssetkey, fromAddress) {
        // TODO SharesAndWithdrawnRewards allows us to compute "staked" liquidity and already claimed rewards
        let aa = {};
        // for ALL the evaluatable attributes in e2, copy them in
        //pv: '[154667012264469,{"{\\"token\\":\\"KAR\\"}":28055998804,"{\\"token\\":\\"BNC\\"}":224449256098}]'
        //pv: '[2071247612977,{"{\\"token\\":\\"KAR\\"}":15112898369}]'
        //pv: [liquidityshares, claimedTokens]
        //asset: '{"Dex":{"DexShare":[{"Token":"KAR"},{"Token":"KSM"}]}}',
        //asset: '{"Loans":{"Token":"LKSM"}}',
        // console.log(`${rAssetkey}`, e2)
        if (e2.pv == undefined) {
            return;
        }
        let pv = JSON.parse(e2.pv)
        let poolID = JSON.parse(e2.asset)
        let poolType;
        let asset;

        for (const r in Object.keys(poolID)) {
            poolType = r
            asset = poolID[r]
        }

        if (pv.length == 2) {
            let stakedLiquidity = pv[0]
            if (stakedLiquidity >= 0) {
                aa["staked"] = stakedLiquidity / 10 ** indexer.getChainDecimal(indexer.chainID)
            }
            let claimed = []
            let claimedTokens = pv[1]
            for (const claimedAsset of Object.keys(claimedTokens)) {
                //{ '{"token":"KAR"}': 28055998804, '{"token":"BNC"}': 224449256098 }
                let claimedAmount = paraTool.dechexToInt(claimedTokens[claimedAsset]) / 10 ** indexer.getChainDecimal(indexer.chainID)
                if (claimedAmount > 0) {
                    claimed.push({
                        asset: claimedAsset,
                        claimed: claimedAmount
                    })
                }
            }
            if (claimed.length > 0) {
                aa["claimed"] = claimed
            }
        }
        // TODO: need different strategy to manage BT cells here
    }

    async processDexLiquidityPool(indexer, e2) {
        // we get lp0, lp1 here
        //console.log("processDexLiquidityPool", e2)
        if (!e2.pv) return;
        let pair = JSON.parse(e2.asset)
        let pairKey = JSON.stringify(pair)
        let lp = JSON.parse(e2.pv) //{ token0: 1574285796532836600, token1: 377143654323922050 }

        let decimals0 = await this.getAssetDecimal(indexer, JSON.stringify(pair[0]), "processDexLiquidityPool")
        let decimals1 = await this.getAssetDecimal(indexer, JSON.stringify(pair[1]), "processDexLiquidityPool")

        if (decimals0 && decimals1) {
            let lp0 = lp['token0'] / 10 ** decimals0;
            let lp1 = lp['token1'] / 10 ** decimals1;
            let rat = lp0 / lp1
            ///console.log("--- processDexLiquidityPool", JSON.stringify(pair[0]), JSON.stringify(pair[1]), "decimals0", decimals0, "decimals1", decimals1, "lp0", lp0, "lp1", lp1, "rat", rat, "lp", lp, "e2", e2);
            indexer.updateAssetLiquidityPairPool(pairKey, lp0, lp1, rat);
        } else {
            indexer.logger.debug({
                "op": "acala-processDexLiquidityPool",
                "msg": "getAssetDecimal FAIL"
            });
        }
    }

    /* {
      bn: 961989,
      ts: 1637264305,
      p: 'CdpEngine',
      s: 'DebitExchangeRate',
      asset: '{"Token":"KSM"}',
      debitExchangeRate: 100851505018408540,
      k: '5301bf5ff0298f5c7b93a446709f8e8812d36c1058eccc97dcabba867eab6dc77f9938b78bd5ff520082',
      v: '01608eafd3e84b66010000000000000000',
      pv: '100851505018408540'
    }*/
    async processCdpEngineDebitExchangeRate(indexer, e2) {
        //console.log(`processCdpEngineDebitExchangeRate`, e2)
        let parsedAsset = JSON.parse(e2.asset)
        let pairKey = JSON.stringify(parsedAsset);
        let decimals = await this.getAssetDecimal(indexer, e2.asset, "processCdpEngineDebitExchangeRate")
        let asset = this.elevatedAssetKey(paraTool.assetTypeLoan, e2.asset);
        if (decimals) {
            let debitExchangeRate = e2.debitExchangeRate / 10 ** 18 // this should be decimals 18 (always)
            //console.log(`processCdpEngineDebitExchangeRate ${asset}`, `exchangeRate=${debitExchangeRate}`)
            indexer.updateAssetLoanDebitExchangeRate(asset, debitExchangeRate);
        } else {
            //console.log(`processCdpEngineDebitExchangeRate getDecimals`, parsedAsset);
            // Ex: processCdpEngineDebitExchangeRate pair={"Token":"LKSM"}#8, debitExchangeRate=100566.5567369397, ts=1637269578
        }
    }

    async processTokensTotalIssuance(indexer, e2) {
        //get issuance here (if changed)
        let parsedAsset = JSON.parse(e2.asset)
        if (Array.isArray(parsedAsset) && parsedAsset.length == 2) { // parsedAsset['DexShare'] != undefined)
            //let pair = parsedAsset['DexShare']
            let decimals0 = await this.getAssetDecimal(indexer, JSON.stringify(parsedAsset[0]), "processTokensTotalIssuance");
            if (decimals0) {
                let issuance = e2.totalIssuance / 10 ** decimals0
                indexer.updateAssetIssuance(e2.asset, issuance, paraTool.assetTypeLiquidityPair, paraTool.assetSourceOnChain);
            } else {
                indexer.logger.debug({
                    "op": "acala-processTokensTotalIssuance",
                    "msg": "getAssetDecimal"
                });
            }
        } else {
            let asset = e2.asset
            let decimals = await this.getAssetDecimal(indexer, e2.asset, "processTokensTotalIssuance2");
            if (decimals) {
                let issuance = e2.totalIssuance / 10 ** decimals
                indexer.updateAssetIssuance(e2.asset, issuance, paraTool.assetTypeToken, paraTool.assetSourceOnChain);
            } else {
                indexer.logger.debug({
                    "op": "acala-processTokensTotalIssuance",
                    "msg": "getAssetDecimal"
                });
            }
        }
        //example: asset['{\"Token\":\"LKSM\"}'][Tokens-TotalIssuance] = pv
    }

    // Because we need to canonizalie token + foreignAsset and further 0 => strings "0", this helper function is needed
    token_to_string(i) {
        if (Array.isArray(i)) {
            return this.tokens_to_string(i);
        }

        let o = {};

        if (i.token !== undefined) o['Token'] = i.token
        if (i.Token !== undefined) o['Token'] = i.Token

        if (i.foreignAsset !== undefined) o.ForeignAsset = i.foreignAsset.toString();
        if (i.ForeignAsset !== undefined) o.ForeignAsset = i.ForeignAsset.toString();

        if (i.stableAssetPoolToken !== undefined) o.StableAssetPoolToken = i.stableAssetPoolToken.toString();
        if (i.StableAssetPoolToken !== undefined) o.StableAssetPoolToken = i.StableAssetPoolToken.toString();

        if (i.liquidCrowdloan !== undefined) o.LiquidCrowdloan = i.liquidCrowdloan.toString();
        if (i.LiquidCrowdloan !== undefined) o.LiquidCrowdloan = i.LiquidCrowdloan.toString();

        let out = JSON.stringify(o);
        return (out);
    }
    /* note token0/token1 ordering is not guranteed: (KAR/LKSM) -> (KUSD/LKSM)* -> (KUSD/KSM)
      process_dex_swap [
        'pJjgdtbGih7qfQkrUTKitPDuxtv3Fm9tUBJKcgENxmwkTHt',
        [
          { token: 'KAR' },
          { token: 'LKSM' },
          { token: 'KUSD' },
          { token: 'KSM' }
        ],
        [ 20000000000000, 2380605498687, 69302095397431, 255704650632 ]
      ]
      dex:swap  [
      'r9uUeMykzE7wfbWv7f72p4KRyY8vAukxzGufFo7do91YeRj',
      [ { token: 'KSM' }, { token: 'KAR' } ],
      [ 4008340986435, 314847518102826 ]
    ]
      */

    async process_dex_swap_event(indexer, e) {
        if (e.length < 3) return;
        try {
            let chainID = indexer.chainID
            let tokens = e[1];
            let vols = e[2];
            for (let i = 0; i < tokens.length - 1; i++) {
                let tok0 = this.token_to_string(tokens[i]);
                let tok1 = this.token_to_string(tokens[i + 1]);
                let decimals0 = await this.getAssetDecimal(indexer, tok0, "process_dex_swap_event0");
                let decimals1 = await this.getAssetDecimal(indexer, tok1, "process_dex_swap_event1");
                if (!decimals0) {
                    indexer.logger.debug({
                        "op": "acala-process_dex_swap_event",
                        "msg": "getAssetDecimal"
                    });
                } else if (!decimals1) {
                    indexer.logger.debug({
                        "op": "acala-process_dex_swap_event",
                        "msg": "getAssetDecimal"
                    });
                } else {
                    let vol0 = vols[i] / 10 ** decimals0;
                    let vol1 = vols[i + 1] / 10 ** decimals1;
                    let token0In = 0
                    let token1In = 0
                    let token0Out = 0
                    let token1Out = 0
                    let pairKey = `[${tok0},${tok1}]`
                    let reversePairKey = `[${tok1},${tok0}]`
                    let assetChain = paraTool.makeAssetChain(pairKey, indexer.chainID);
                    let reverseAssetChain = paraTool.makeAssetChain(reversePairKey, indexer.chainID);
                    if (indexer.isValidLiquidityPair(assetChain)) {
                        token0In = vol0
                        token1Out = vol1
                        //console.log(`process_dex_swap_event ${pairKey} Found +${token0In}(${tok0}) -${token1Out}(${tok1})`)
                        indexer.updateAssetLiquidityPairTradingVolume(pairKey, token0In, token1In, token0Out, token1Out)
                    } else if (indexer.isValidLiquidityPair(reverseAssetChain)) {
                        token1In = vol0
                        token0Out = vol1
                        //console.log(`process_dex_swap_event ${reversePairKey} Found (reversed) +${token1In}(${tok1}) -${token0Out}(${tok0})`)
                        indexer.updateAssetLiquidityPairTradingVolume(reversePairKey, token0In, token1In, token0Out, token1Out)
                    } else {
                        console.log(`process_dex_swap_event - assetChain ${assetChain} NOT Found [${vol0},${vol1}]`)
                        indexer.logger.debug({
                            "op": "acala-process_dex_swap_event",
                            "msg": "LiquidityPair"
                        });
                    }
                }
            }
        } catch (err) {
            return;
        }
    }



    /*
    AddLiquidity event: [
      'sUCB3WqwuNsYkZsZDsdSE3hE17BK7W7MNrSY7saGcKuWd7v',
      { token: 'KUSD' },
      '0x000000000000000000153abed59605f5',
      { token: 'LKSM' },
      187305060390000,
      '0x0000000000000000002cc1f5148ff75e'
    ]
    RemoveLiquidity event: [
      'sUCB3WqwuNsYkZsZDsdSE3hE17BK7W7MNrSY7saGcKuWd7v',
      { token: 'KUSD' },
      '0x000000000000000000153abed5961e1a',
      { token: 'LKSM' },
      187305060390193,
      '0x0000000000000000002cc1f514902a4b'
    ]
    */
    process_dex_liquidity_issuance(indexer, e, method) {
        if (e.length < 6) return;
        let tok0 = e[1].token;
        let tok1 = e[3].token;
        let issuance = paraTool.dechexToInt(e[5]);
        let pair = [{
            "Token": tok0
        }, {
            "Token": tok1
        }];
        let pairKey = JSON.stringify(pair);
        indexer.updateAssetLiquidityPairIssuance(JSON.stringify(pair), issuance);
    }

    parseStorageKey(indexer, p, s, key, decoratedKey) {
        let pallet_section = `${p}:${s}`
        //console.log(`acala parseStorageKey ${pallet_section}`)
        if (pallet_section == "tokens:accounts") {
            //include accountID, asset
            return this.getTokensAccountsKey(indexer, decoratedKey);
        } else if (pallet_section == "tokens:totalIssuance") {
            //include asset
            return this.getTotalIssuanceKey(indexer, decoratedKey);
        } else if (pallet_section == "loans:positions") {
            //include accountID, asset
            return this.getLoansPositionsKey(indexer, decoratedKey);
        } else if (pallet_section == "rewards:sharesAndWithdrawnRewards") {
            //include accountID, asset
            return this.getSharesAndWithdrawnRewardsKey(indexer, decoratedKey);
        } else if (pallet_section == "rewards:poolInfos") {
            //include asset
            return this.getRewardsPoolInfoKey(indexer, decoratedKey);
        } else if (pallet_section == "incentives:pendingMultiRewards") {
            //include accountID, asset
            return this.getPendingMultiRewardsKey(indexer, decoratedKey);
        } else if (pallet_section == "cdpEngine:debitExchangeRate") {
            //include asset
            return this.getDebitExchangeRateKey(indexer, decoratedKey);
        } else if (pallet_section == "dex:liquidityPool") {
            //include asset
            return this.getLiquidityPoolKey(indexer, decoratedKey);
        } else if (pallet_section == "acalaOracle:values") {
            return this.getAcalaOracleKey(indexer, decoratedKey);
        } else if (pallet_section == "ormlNFT:classes") {
            return this.getOrmlNFTClassesKey(indexer, decoratedKey);
        } else if (pallet_section == "ormlNFT:tokens") {
            return this.getOrmlNFTTokensKey(indexer, decoratedKey);
        } else if (p == "ormlNFT") {
            console.log("other ormlNFT", p, s);
        } else {
            return super.parseStorageKey(indexer, p, s, key, decoratedKey)
        }
    }

    parseStorageVal(indexer, p, s, val, decoratedVal, o = false) {
        let pallet_section = `${p}:${s}`
        //console.log(`acala parseStorageVal ${pallet_section}`)
        if (pallet_section == "dex:liquidityPool") {
            return this.getLiquidityPoolVal(val, decoratedVal)
        } else if ((pallet_section == "tokens:accounts") || (pallet_section == "loans:positions")) {
            return this.getBalanceVal(p, s, val, decoratedVal)
        } else if (pallet_section == "tokens:totalIssuance") {
            //include asset
            return this.getTotalIssuanceVal(val, decoratedVal);
        } else if (pallet_section == "cdpEngine:debitExchangeRate") {
            //include asset
            return this.getDebitExchangeRateVal(val, decoratedVal);
        } else if (pallet_section == "acalaOracle:values") {
            //include asset
            return this.getAcalaOracleVal(val, decoratedVal);
        } else if (pallet_section == "ormlNFT:classes") {
            return this.getOrmlNFTClassesVal(val, decoratedVal);
        } else if (pallet_section == "ormlNFT:tokens") {
            return this.getOrmlNFTTokensVal(val, decoratedVal);
        } else if (p == "ormlNFT") {
            console.log("other ormlNFT", p, s, decoratedVal);
        } else {
            return super.parseStorageVal(indexer, p, s, val, decoratedVal, o);
        }
    }

    processExtrinsicEvents(indexer, module_section, module_method, events) {
        let chainID = indexer.chainID
        if (module_section == "dex") {
            events.forEach((e) => {
                if (e.section == "dex" && e.method == "Swap") {
                    // console.log(`dex:swap `, e.data)
                    this.process_dex_swap_event(indexer, e.data);
                } else if (e.section == "dex" && (e.method == "AddLiquidity" || e.method == "RemoveLiquidity")) {
                    //process_dex_liquidity_issuance(e.data, e.method.method);
                }
            })
        } else {
            super.processExtrinsicEvents(indexer, module_section, module_method, events);
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

    getCachedAssetDecimal(indexer, asset, ctx) {
        //console.log(`getCachedAssetDecimal ${asset}`)
        let res = indexer.getAssetDecimal(asset, indexer.chainID, ctx);
        if (res) {
            return (res);
        } else {
            console.log(`getCachedAssetDecimal ${asset} not found`)
            return (12);
        }
    }

    async getAssetInfo(indexer, parsedAsset) {
        var asset = JSON.stringify(parsedAsset);
        let assetChain = paraTool.makeAssetChain(asset, indexer.chainID);
        if (indexer.assetInfo[assetChain] !== undefined) {
            if (asset == '{"LiquidCrowdloan":"13"}') {
                indexer.assetInfo[assetChain].name = 'lcDOT';
                indexer.assetInfo[assetChain].symbol = 'lcDOT';
            }
            console.log(`getAssetInfo found`)
            return (indexer.assetInfo[assetChain]);
        } else {
            console.log(`getAssetInfo not found ${asset}`)
        }

        let name = false;
        let symbol = false;
        let decimals = false;
        let assetType = false;
        const convert = (from, to) => str => Buffer.from(str, from).toString(to)
        const hexToUtf8 = convert('hex', 'utf8')

        if (asset.substring(0, 2) == "0x") return (false);
        if (Array.isArray(parsedAsset)) {
            // decimals is the FIRST element decimals
            let assetRec0 = await this.getAssetInfo(indexer, parsedAsset[0]) // RECURSIVE call
            let assetRec1 = await this.getAssetInfo(indexer, parsedAsset[1]) // RECURSIVE call
            if (assetRec0 && assetRec1) {
                name = `${assetRec0.symbol}/${assetRec1.symbol}`;
                //console.log(`assetRec0/assetRec1`, `${name}`)
                symbol = name;
                decimals = assetRec0.decimals;
                assetType = paraTool.assetTypeLiquidityPair;
                let sql2 = `('${asset}', ${indexer.chainID}, '${assetRec0.asset}', '${assetRec1.asset}', '${assetRec0.symbol}', '${assetRec1.symbol}', '${assetRec0.decimals}', '${assetRec1.decimals}')`
                indexer.upsertSQL({
                    "table": "asset",
                    "keys": ["asset", "chainID"],
                    "vals": ["token0", "token1", "token0Symbol", "token1Symbol", "token0Decimals", "token1Decimals"],
                    "data": sql2,
                    "vals": ["token0", "token1", "token0Symbol", "token1Symbol", "token0Decimals", "token1Decimals"],
                });
            } else {
                console.log("MISS", parsedAsset, "assetRec0", assetRec0, "assetRec1", assetRec1);
            }
        } else if (parsedAsset.NFT) {
            name = "NA";
            symbol = "NA";
            decimals = 1;
            assetType = paraTool.assetTypeNFT;
        } else if (parsedAsset.Loan) {
            let assetRec = await this.getAssetInfo(indexer, parsedAsset.Loan); // RECURSIVE call
            name = `Loan:${assetRec.symbol}`
            symbol = name;
            decimals = assetRec.decimals;
            assetType = paraTool.assetTypeLoan;
        } else if (parsedAsset.StableAssetPoolToken) {
            try {
                let StableAssetId = parseInt(parsedAsset.StableAssetPoolToken, 10);
                let md = await indexer.api.query.assetRegistry.assetMetadatas({
                    StableAssetId
                });
                let assetMetadata = md.toJSON();
                if (md && assetMetadata) {
                    name = hexToUtf8(assetMetadata.name.substring(2));
                    symbol = hexToUtf8(assetMetadata.symbol.substring(2));
                    decimals = assetMetadata.decimals;
                    assetType = paraTool.assetTypeLiquidityPair; // TODO: check
                }
            } catch (err) {
                console.log("indexer.api.query.assetRegistry.assetMetadatas ERR", err);
                this.parserErrors++;
            }
        } else if (parsedAsset.LiquidCrowdloan && ((parsedAsset.LiquidCrowdloan == "13") || (parsedAsset.LiquidCrowdloan == 13))) {
            try {
                let LiquidCrowdloan = parseInt(parsedAsset.LiquidCrowdloan, 10);
                name = "lcDOT";
                symbol = "lcDOT";
                decimals = 10;
                assetType = paraTool.assetTypeToken;
            } catch (err) {
                console.log("indexer.api.query.assetRegistry.assetMetadatas ERR", err);
                this.parserErrors++;
            }
        } else if (parsedAsset.ForeignAsset) {
            try {
                let ForeignAssetId = parseInt(parsedAsset.ForeignAsset, 10);
                let md = await indexer.api.query.assetRegistry.assetMetadatas({
                    ForeignAssetId
                });
                if (md) {
                    let assetMetadata = md.toJSON();
                    if (assetMetadata) {
                        if (assetMetadata.name !== undefined && assetMetadata.name.length > 2) {
                            name = hexToUtf8(assetMetadata.name.substring(2));
                        }
                        if (assetMetadata.symbol && assetMetadata.length > 2) {
                            symbol = hexToUtf8(assetMetadata.symbol.substring(2));
                        }
                        decimals = assetMetadata.decimals;
                        assetType = paraTool.assetTypeToken; // ???
                    }
                }
            } catch (err) {
                console.log("indexer.api.query.assetRegistry.assetMetadatas ERR", err);
                this.parserErrors++;
            }
        }
        if (decimals && assetType) {
            let assetInfo = {
                name,
                symbol,
                decimals,
                assetType
            };
            await indexer.addAssetInfo(asset, indexer.chainID, assetInfo, 'getAssetInfo');
            return (assetInfo);
        } else {
            console.log("COULD NOT ADD asset -- no assetType", decimals, assetType, parsedAsset, asset);
        }
        return (false);
    }


    async processTokensAccounts(indexer, e2, rAssetkey, fromAddress) {
        let aa = {};
        let flds = ["free", "reserved", "miscFrozen", "feeFrozen", "frozen"];
        let success = false;
        let [asset, _] = paraTool.parseAssetChain(rAssetkey)
        let decimals = await this.getAssetDecimal(indexer, asset, "processTokensAccounts");
        // for ALL the evaluatable attributes in e2, copy them in
        if (decimals) {
            flds.forEach((fld) => {
                aa[fld] = e2[fld] / 10 ** decimals;
                success = true;
            });
            if (success) {
                let parsedAsset = JSON.parse(asset);
                let assetType = (Array.isArray(parsedAsset)) ? paraTool.assetTypeLiquidityPair : paraTool.assetTypeToken;
                let assetChain = paraTool.makeAssetChain(rAssetkey, indexer.chainID);
                if (this.debugLevel >= paraTool.debugVerbose) console.log(`processTokensAccounts  ${fromAddress}`, assetChain, aa);
                indexer.updateAddressStorage(fromAddress, assetChain, "acala:processTokensAccounts-tokens", aa, this.parserTS, this.parserBlockNumber, assetType);
            }
        } else {
            indexer.logger.debug({
                "op": "acala-processTokensAccounts",
                "msg": "getAssetDecimal",
                "asset": asset
            });
        }
    }

    processOrmlNFTTokens(indexer, e2) {
        /*
        	     {
          bn: 367779,
          ts: undefined,
          p: 'OrmlNFT',
          s: 'Tokens',
          k: 'd9e6ccefd31ef77af06ab6328ed18d6199971b5749ac43e0235e41b0d3786918bfb27f1eaef06bb903000000bb1bdbcacd6ac9340000000000000000',
          v: 'b501ec62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b73752c8feeab5bd9a317375e01adb6cb959f1fea78c751936d556fa2e36ede425a4700f2eece36000000000000000000000000',
          pk: '"[\\"3\\",\\"0\\"]"',
          pv: '{"metadata":"0x62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b7375","owner":"21t2T25Mc3XxTsqZSz4EyqhsM7LJiKrUKBE26ajwvNGq94w1","data":{"deposit":235400000000,"attributes":{}}}',
          debug: 2
          } */
        const convert = (from, to) => str => Buffer.from(str, from).toString(to)
        const hexToUtf8 = convert('hex', 'utf8')
        if (e2.pv == undefined) return;
        let v = JSON.parse(e2.pv);
        let nftAsset = JSON.parse(e2.asset);
        let metadata = hexToUtf8(v.metadata.substring(2));
        let data = v.data;
        let holder = paraTool.getPubKey(v.owner);
        let free = (data.deposit !== undefined) ? data.deposit : 0;

        let nftClass = parseInt(nftAsset[0].replaceAll(",", ""), 10);
        let nftToken = parseInt(nftAsset[1].replaceAll(",", ""), 10);
        // this has to be unique for each token
        let rAssetkey = JSON.stringify({
            "NFTClass": nftClass,
            "NFTToken": nftToken
        });
        let nftClassAsset = JSON.stringify({
            "NFTClass": nftClass
        });
        let tokenIDAsset = JSON.stringify({
            "NFTToken": nftToken
        });
        indexer.updateAssetNFTTokenMetadata(rAssetkey, nftClassAsset, tokenIDAsset, holder, free, metadata);
    }

    processOrmlNFTClasses(indexer, e2) {
        /*
processOrmlNFTClasses {
  bn: 367613,
  ts: undefined,
  p: 'OrmlNFT',
  s: 'Classes',
  asset: '"3"',
  k: 'd9e6ccefd31ef77af06ab6328ed18d614e74d919ae81a9eee9e85acdc6cc581abfb27f1eaef06bb903000000',
  v: 'd901ec62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b737500000000000000006d6f646c6163612f614e4654030000000000000000000000000000000000000000423ec6812d000000000000000000000f00',
  pv: '{"metadata":"0x62616679626569646a6e737675366b62776c6f6b646b636b7670626d6c32696369736f793778776e6d6a346d717062776268676d677635336b7375","totalIssuance":0,"owner":"23M5ttkmR6KcnsARyoGv5Ymnr1YYkFMkN6rNMD8Df8BUHcQe","data":{"deposit":50035400000000,"properties":15,"attributes":{}}}'
}
	*/
        if (e2.pv == undefined) return;
        let v = JSON.parse(e2.pv);
        let nftClass = JSON.parse(e2.asset);
        let owner = v.owner;
        let metadata = v.metadata;
        let data = v.data;
        let decimals = indexer.getChainDecimal(indexer.chainID);
        let free = (data.deposit !== undefined) ? data.deposit / 10 ** decimals : 0;
        let rAssetkey = this.elevatedAssetKey(paraTool.assetTypeNFT, e2.asset);
        indexer.updateAssetNFTClassMetadata(rAssetkey, metadata, owner, free);
        // TODO: ensure this appears in the "asset" table (individual tokens appear in the "token" table)
    }

    async processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress) {
        let pallet_section = `${p}:${s}`
        //console.log(`acala processAccountAsset ${pallet_section}`)
        if (pallet_section == "Loans:Positions") {
            await this.processLoansPositions(indexer, e2, rAssetkey, fromAddress);
        } else if (pallet_section == "Tokens:Accounts") {
            await this.processTokensAccounts(indexer, e2, rAssetkey, fromAddress);
        } else if (pallet_section == "Rewards:SharesAndWithdrawnRewards") {
            await this.processRewardsSharesAndWithdrawnRecords(indexer, e2, rAssetkey, fromAddress);
        } else if (pallet_section == "Incentives:PendingMultiRewards") {
            await this.processIncentivesPendingMultiRewards(indexer, e2, rAssetkey, fromAddress);
        } else {
            super.processAccountAsset(indexer, p, s, e2, rAssetkey, fromAddress);
        }
        return;
    }

    async processAsset(indexer, p, s, e2) {
        let pallet_section = `${p}:${s}`
        //console.log(`acala processAsset ${pallet_section}`)
        if (pallet_section == "Tokens:TotalIssuance") {
            await this.processTokensTotalIssuance(indexer, e2);
        } else if (pallet_section == "CdpEngine:DebitExchangeRate") {
            await this.processCdpEngineDebitExchangeRate(indexer, e2);
        } else if (pallet_section == "Dex:LiquidityPool") {
            await this.processDexLiquidityPool(indexer, e2);
        } else if (pallet_section == "OrmlNFT:Classes") {
            await this.processOrmlNFTClasses(indexer, e2);
        } else if (pallet_section == "OrmlNFT:Tokens") {
            await this.processOrmlNFTTokens(indexer, e2);
        } else if (pallet_section == "Rewards:PoolInfos") {
            // TODO
        } else if (pallet_section == "AcalaOracle:Values") {
            await this.processAcalaOracles(indexer, e2);
        } else {
            super.processAsset(indexer, p, s, e2);
        }
        return;
    }
    // -----
    // Query
    async decorate_query_params(query, pallet_method, args, chainID, ts) {
        switch (pallet_method) {
            case "xTokens:transfer":
                await query.decorateArgsCurrency(args, "currency_id")
                await query.decorateArgsChainAsset(args, "amount", chainID, ts)
                break;
            case "dex:addProvision":
                await query.decorateArgsAsset(args, "amount_a", "currency_id_a", chainID, ts)
                await query.decorateArgsAsset(args, "amount_b", "currency_id_b", chainID, ts)
                break;
            case "dex:addLiquidity":
                await query.decorateArgsAsset(args, "max_amount_a", "currency_id_a", chainID, ts)
                await query.decorateArgsAsset(args, "max_amount_b", "currency_id_b", chainID, ts)
                break;
            case "dex:removeLiquidity":
                await query.decorateArgsAsset(args, "min_withdrawn_a", "currency_id_a", chainID, ts)
                await query.decorateArgsAsset(args, "min_withdrawn_b", "currency_id_b", chainID, ts)
                break;
            case "dex:swapWithExactSupply":
                await query.decorateArgsChainAsset(args, "supply_amount", chainID, ts)
                await query.decorateArgsChainAsset(args, "min_target_amount", chainID, ts)
                await query.decorateArgsPath(args, "path");
                break;
            case "dex:swapWithExactTarget":
                await query.decorateArgsPath(args, "path");
                await query.decorateArgsChainAsset(args, "target_amount", chainID, ts)
                await query.decorateArgsChainAsset(args, "max_supply_amount", chainID, ts)
                break;
            case "homaLite:requestRedeem":
                await query.decorateArgsChainAsset(args, "liquid_amount", chainID, ts)
                await query.decorateArgsChainAsset(args, "additional_fee", chainID, ts)
                break;
            case "homaLite:mint":
                await query.decorateArgsChainAsset(args, "amount", chainID, ts)
                break;
            case "homa:requestRedeem":
            case "homa:mint":
                await query.decorateArgsChainAsset(args, "value", chainID, ts)
                break;
            case "homaLite:mintForRequests":
                await query.decorateArgsChainAsset(args, "amount", chainID, ts)
                break;
            case "incentives:claimRewards":
                await query.decorateArgsAssets(args, "pool_id")
                break;
            case "incentives:depositDexShare":
                await query.decorateArgsAssets(args, "lp_currency_id")
                await query.decorateArgsChainAsset(args, "amount", chainID, ts)
                break;
            case "incentives:withdrawDexShare":
                await query.decorateArgsAssets(args, "lp_currency_id")
                await query.decorateArgsChainAsset(args, "amount", chainID, ts)
                break;
            case "honzon:adjustLoan":
                await query.decorateArgsChainAsset(args, "collateral_adjustment", chainID, ts)
                await query.decorateArgsChainAsset(args, "debit_adjustment", chainID, ts)
                break;
            case "honzon:closeLoanHasDebitByDex":
                await query.decorateArgsCurrency(args, "currency_id")
                await query.decorateArgsPath(args, "path")
                await query.decorateArgsChainAsset(args, "max_collateral_amount", chainID, ts)
                break;
            default:
                await super.decorate_query_params(query, pallet_method, args, chainID, ts)
        }
    }
}