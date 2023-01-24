const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require("path");
const AssetManager = require("./assetManager");
const ethTool = require("./ethTool");
const paraTool = require("./paraTool");
const xcmgarTool = require("./../gar/xcmgarTool");

const Endpoints = require("./summary/endpoints");
const mysql = require("mysql2");
const {
    WebSocket
} = require('ws');
const {
    hexToU8a,
    compactStripLength,
    hexToBn
} = require("@polkadot/util");
const {
    StorageKey
} = require('@polkadot/types');

module.exports = class XCMGARLoadManager extends AssetManager {

    readJSONFn(relayChain = 'polkadot', fExt = 'xcmRegistry') {
        const logDir = "../gar"
        let fnDir = path.join(logDir, fExt);
        let fn = `${relayChain}_${fExt}.json`
        let fnDirFn = false
        let jsonObj = false
        try {
            fnDirFn = path.join(fnDir, fn)
            const fnContent = fs.readFileSync(fnDirFn, 'utf8');
            jsonObj = JSON.parse(fnContent)
        } catch (err) {
            console.log(err, "readJSONFn", fnDirFn);
            return false
        }
        return jsonObj
    }


    /*
    '[{"parachain":2000},{"generalKey":"0x0003"}]~polkadot': {
      xcmchainID: 2000,
      xcmInteriorKey: '[{"parachain":2000},{"generalKey":"0x0003"}]~polkadot',
      symbol: 'LDOT',
      relayChain: 'polkadot',
      nativeAssetChain: '{"Token":"LDOT"}~2000',
      isUSD: 0,
      decimals: 10,
      priceUSD: 0.8819562464913995,
      parents: 1
    },

    '[{"parachain":2000},{"generalKey":"0x0003"}]~polkadot': {
      paraID: 2000,
      relayChain: 'polkadot',
      symbol: 'LDOT',
      decimals: 10,
      interiorType: 'x2',
      xcmV1Standardized: [ [Object], [Object], [Object] ],
      xcmV1MultiLocationByte: '0x010200411f06080003',
      xcmV1MultiLocation: { v1: [Object] },
      xcContractAddress: { '2006': '0xffffffff00000000000000010000000000000002' },
      xcCurrencyID: {
        '2006': '18446744073709551618',
        '2012': '110',
        '2032': '1',
        '2035': '4'
      },
      confidence: 4,
      source: [ 2006, 2012, 2032, 2035 ]
    */

    isObject(val) {
        return (typeof val === 'object');
    }

    transformXcGarRegistry(xcGarMap) {
        let polkaholicXcGar = {}
        let assetGar = []
        for (const xcmInteriorKeyV2 of Object.keys(xcGarMap)) {
            let xcmAsset = xcGarMap[xcmInteriorKeyV2]
            let xcmInteriorKeyV1 = paraTool.convertXcmInteriorKeyV2toV1(xcmInteriorKeyV2)
            let xcmV1Standardized = JSON.parse(xcmInteriorKeyV2)

            //console.log(`xcmInteriorKeyV1=${xcmInteriorKeyV1}, xcmInteriorKeyV2=${xcmInteriorKeyV2}`)
            let decimals = xcmAsset.decimals
            let symbol = xcmAsset.symbol
            let relayChain = xcmAsset.relayChain
            let paraID = xcmAsset.paraID
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain)
            //nativeAssetChain are different for statemine asset (i.e USDt)
            let parsedAsset = {
                Token: symbol
            }
            if (chainID == paraTool.chainIDStatemine || chainID == paraTool.chainIDStatemint ){
                try {
                    console.log(`xcmV1Standardized`, xcmV1Standardized)
                    let assetID = xcmV1Standardized[3]['generalIndex']
                    parsedAsset = {
                        Token: `${assetID}`
                    }
                } catch(e){
                    console.log(`statemine/t e`, e)
                }
            }
            var assetString = JSON.stringify(parsedAsset);
            let nativeAssetChain = paraTool.makeAssetChain(assetString, chainID)
            let xcCurrencyIDMap = {}
            for (const paraIDSource of Object.keys(xcmAsset.xcCurrencyID)) {
                let chainIDsource = paraTool.getChainIDFromParaIDAndRelayChain(xcmgarTool.dechexToInt(paraIDSource), xcmAsset.relayChain)
                let currencyID = xcmAsset.xcCurrencyID[paraIDSource]
                let assetString = '';
                if (this.isObject(currencyID)) {
                    assetString = JSON.stringify(currencyID)
                } else {
                    let parsedAsset = {
                        Token: currencyID
                    }
                    assetString = JSON.stringify(parsedAsset)
                }
                xcCurrencyIDMap[chainIDsource] = assetString
                console.log(`*** ${xcmInteriorKeyV1} [${chainIDsource}] asset=${assetString}, paraIDSource=${paraIDSource}, relayChain=${xcmAsset.relayChain}`)
            }

            let transformedXcmAsset = {
                xcmchainID: chainID,
                paraID: paraID,
                xcmInteriorKey: xcmInteriorKeyV1,
                xcmInteriorKeyV2: xcmInteriorKeyV2,
                symbol: symbol,
                relayChain: relayChain,
                nativeAssetChain: nativeAssetChain,
                isUSD: 0,
                decimals: decimals,
                priceUSD: null,
                parents: 1,
                xcCurrencyID: xcCurrencyIDMap,
            }
            polkaholicXcGar[xcmInteriorKeyV1] = transformedXcmAsset
            //polkaholicXcGar[xcmInteriorKeyV1] = xcmAsset
        }
        return polkaholicXcGar
    }

    compareXcRegistry(newXcRegistry, oldXcRegistry) {
        let xcRegistryNewOnly = {}
        let xcRegistryOldOnly = {}
        let identicalXcRegsitry = {}
        let diffXcRefistry = {}

        let xcmInteriorNewKeys = Object.keys(newXcRegistry)
        let xcmInteriorOldKeys = Object.keys(oldXcRegistry)
        //console.log( a2.filter(x => !a1.includes(x)) );
        console.log(`xcmInteriorNewKeys`, xcmInteriorNewKeys)
        console.log(`xcmInteriorOldKeys`, xcmInteriorOldKeys)
        let xcmInteriorKeyCommon = xcmInteriorNewKeys.filter(value => xcmInteriorOldKeys.includes(value));
        console.log(`xcmInteriorKeyCommon`, xcmInteriorKeyCommon)
        let xcmInteriorKeyNewOnly = xcmInteriorNewKeys.filter(x => !xcmInteriorOldKeys.includes(x))
        console.log(`xcmInteriorKeyNewOnly`, xcmInteriorKeyNewOnly)
        let xcmInteriorKeyOldOnly = xcmInteriorOldKeys.filter(x => !xcmInteriorNewKeys.includes(x))
        console.log(`xcmInteriorKeyOldOnly`, xcmInteriorKeyOldOnly)

        for (const xcmInteriorKey of xcmInteriorKeyCommon) {
            let xcmAssetOld = oldXcRegistry[xcmInteriorKey]
            let xcmAssetNew = newXcRegistry[xcmInteriorKey]
            // check if xcmchainID, xcmInteriorKey, symbol, relayChain, nativeAssetChain, decimals, parents are all the same
            let checkList = ['xcmchainID', 'xcmInteriorKey', 'symbol', 'relayChain', 'nativeAssetChain', 'decimals', 'parents']
            let mismatchedFlds = []
            let matchedFlds = []
            let isMismatch = false
            for (const k of checkList) {
                if (xcmAssetOld[k] == xcmAssetNew[k]) {
                    matchedFlds.push(k)
                } else {
                    isMismatch = true
                    mismatchedFlds.push(k)
                }
                if (isMismatch) {
                    for (const mismatchedFld of mismatchedFlds) {
                        let mistMatched = {}
                        mistMatched[mismatchedFld] = {
                            new: xcmAssetNew[mismatchedFld],
                            old: xcmAssetOld[mismatchedFld]
                        }
                        diffXcRefistry[xcmInteriorKey] = mistMatched
                    }
                } else {
                    identicalXcRegsitry[xcmInteriorKey] = xcmAssetNew
                }
            }
        }

        for (const xcmInteriorKey of xcmInteriorKeyNewOnly) {
            xcRegistryNewOnly[xcmInteriorKey] = newXcRegistry[xcmInteriorKey]
        }

        for (const xcmInteriorKey of xcmInteriorKeyOldOnly) {
            let xcmAssetNew = oldXcRegistry[xcmInteriorKey]
            xcRegistryOldOnly[xcmInteriorKey] = oldXcRegistry[xcmInteriorKey]
        }
        console.log(`New Only [${Object.keys(xcRegistryNewOnly).length}]`, xcRegistryNewOnly)
        console.log(`Old Only [${Object.keys(xcRegistryOldOnly).length}]`, xcRegistryOldOnly)
        //console.log(`Identical [${Object.keys(identicalXcRegsitry).length}]`, Object.keys(identicalXcRegsitry))
        console.log(`Diff [${Object.keys(diffXcRefistry).length}]`, diffXcRefistry)
        console.log(`New=[${Object.keys(xcRegistryNewOnly).length}], Old=${Object.keys(xcRegistryOldOnly).length}, Identical=${Object.keys(identicalXcRegsitry).length}, Diff=${Object.keys(diffXcRefistry).length}`)
        return [xcRegistryNewOnly, xcRegistryOldOnly, identicalXcRegsitry, diffXcRefistry]
    }

    async init_xcm_asset_old(relayChain = 'polkadot') {
        let xcmAssets = await this.poolREADONLY.query(`select xcmchainID, xcmInteriorKey, symbol, relayChain, nativeAssetChain, isUSD, decimals, priceUSD, parent as parents from xcmasset where xcmInteriorKey is not null and relaychain in ('${relayChain}')`);
        let xcmAssetMap = {}
        for (let i = 0; i < xcmAssets.length; i++) {
            let xcmAsset = xcmAssets[i]
            let xcmInteriorKey = xcmAsset.xcmInteriorKey
            xcmAssetMap[xcmInteriorKey] = xcmAsset
        }
        return xcmAssetMap
    }

    /*
    mysql> desc xcmasset;
    +-----------------------+--------------+------+-----+---------+-------+
    | Field                 | Type         | Null | Key | Default | Extra |
    +-----------------------+--------------+------+-----+---------+-------+
    | xcmInteriorKey        | varchar(128) | YES  | MUL | NULL    |       |
    | nativeAssetChain      | varchar(64)  | YES  |     | NULL    |       |
    | symbol                | varchar(34)  | NO   | PRI | NULL    |       |
    | relayChain            | varchar(32)  | NO   | PRI | NULL    |       |
    | xcmchainID            | int(11)      | YES  |     | NULL    |       |
    | addDT                 | datetime     | YES  |     | NULL    |       |
    | audited               | tinyint(4)   | YES  |     | 0       |       |
    | decimals              | int(11)      | YES  |     | NULL    |       |
    | isUSD                 | tinyint(4)   | YES  |     | 0       |       |
    | numXCMTransfer1d      | int(11)      | YES  |     | 0       |       |
    | numXCMTransfer7d      | int(11)      | YES  |     | 0       |       |
    | numXCMTransfer30d     | int(11)      | YES  |     | 0       |       |
    | valXCMTransferUSD1d   | double       | YES  |     | 0       |       |
    | valXCMTransferUSD7d   | double       | YES  |     | 0       |       |
    | valXCMTransferUSD30d  | double       | YES  |     | 0       |       |
    | coingeckoID           | varchar(40)  | YES  |     | NULL    |       |
    | coingeckoLastUpdateDT | datetime     | YES  |     | NULL    |       |
    | priceUSD              | double       | YES  |     | 0       |       |
    | priceUSDPercentChange | double       | YES  |     | 0       |       |
    | verificationPath      | blob         | YES  |     | NULL    |       |
    | liquid                | float        | YES  |     | NULL    |       |
    | lastPriceUpdateDT     | datetime     | YES  |     | NULL    |       |
    | parent                | tinyint(4)   | YES  |     | 1       |       |
    +-----------------------+--------------+------+-----+---------+-------+
    */

    async flushXcmAssetGar(xcRegistryNew) {
        // flush new xc Registry into
        let xcmtransferKeys = Object.keys(xcRegistryNew)
        if (xcmtransferKeys.length > 0) {
            let xcmAssets = [];
            for (let i = 0; i < xcmtransferKeys.length; i++) {
                let r = xcRegistryNew[xcmtransferKeys[i]];
                //["xcmInteriorKey", "symbol", "relayChain"]
                // ["xcmchainID", "nativeAssetChain", "isUSD", "decimals", "parents"]
                let t = "(" + [`'${r.xcmInteriorKey}'`, `'${r.symbol}'`, `'${r.relayChain}'`,
                    `'${r.xcmchainID}'`, `'${r.nativeAssetChain}'`, `'${r.isUSD}'`, `'${r.decimals}'`, `'${r.parents}'`, `'${r.xcmInteriorKeyV2}'`, `'${r.paraID}'`
                ].join(",") + ")";
                if (r.msgHash == "0x" && !r.finalized) {
                    //msgHash is missing... we will
                    console.log(`[${r.extrinsicHash} [${r.extrinsicID}] [finzlied=${r.finalized}] msgHash missing!`)
                } else {
                    xcmAssets.push(t);
                }
            }
            let sqlDebug = true
            await this.upsertSQL({
                "table": "xcmassetgar",
                "keys": ["xcmInteriorKey", "symbol", "relayChain"],
                "vals": ["xcmchainID", "nativeAssetChain", "isUSD", "decimals", "parent", "xcmInteriorKeyV2", "paraID"],
                "data": xcmAssets,
                "replace": ["xcmchainID", "nativeAssetChain", "isUSD", "decimals", "parent", "xcmInteriorKeyV2", "paraID"]
            }, sqlDebug);
        }
    }

    async flushAssetGar(xcRegistryNew) {
        // flush new xc Registry into
        let xcmtransferKeys = Object.keys(xcRegistryNew)
        if (xcmtransferKeys.length > 0) {
            let assets = []
            for (let i = 0; i < xcmtransferKeys.length; i++) {
                let r = xcRegistryNew[xcmtransferKeys[i]];
                //["asset", "chainID",]
                //[ "assetType", "xcmInteriorKey", "decimals", "symbol"]
                for (const chainID of Object.keys(r.xcCurrencyID)) {
                    let assetString = r.xcCurrencyID[chainID]
                    let a = "(" + [`'${assetString}'`, `'${chainID}'`,
                        `'${paraTool.assetTypeToken}'`, `'${r.xcmInteriorKey}'`, `'${r.decimals}'`, `'${r.symbol}'`
                    ].join(",") + ")";
                    assets.push(a)
                }
            }
            console.log(`sql`, assets)
            let sqlDebug = true
            await this.upsertSQL({
                "table": "assetgar",
                "keys": ["asset", "chainID", ],
                "vals": ["assetType", "xcmInteriorKey", "decimals", "symbol"],
                "data": assets,
                "replace": ["assetType", "xcmInteriorKey", "decimals", "symbol"]
            }, sqlDebug);
            //await this.update_batchedSQL()
        }
    }
}
