const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require("path");
const AssetManager = require("./assetManager");
const ethTool = require("./ethTool");
const paraTool = require("./paraTool");
const garTool = require("./../gar/garTool");

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

module.exports = class GarManager extends AssetManager {

    readJSONFn(relayChain = 'polkadot', fExt = 'xcmConcept') {
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

    transformXcGarRegistry(xcGarMap){
        let polkaholicXcGar = {}
        for (const xcmInteriorKeyV2 of Object.keys(xcGarMap)){
            let xcmAsset = xcGarMap[xcmInteriorKeyV2]
            let xcmInteriorKeyV1 = paraTool.convertXcmInteriorKeyV2toV1(xcmInteriorKeyV2)

            //console.log(`xcmInteriorKeyV1=${xcmInteriorKeyV1}, xcmInteriorKeyV2=${xcmInteriorKeyV2}`)
            let decimals = xcmAsset.decimals
            let symbol = xcmAsset.symbol
            let relayChain = xcmAsset.relayChain
            let paraID = xcmAsset.paraID
            let chainID = paraTool.getChainIDFromParaIDAndRelayChain(paraID, xcmAsset.relayChain)
            //nativeAssetChain are different for statemine asset (i.e USDt)
            let parsedAsset = {
                Token: symbol
            }
            var assetString = JSON.stringify(parsedAsset);
            let nativeAssetChain = paraTool.makeAssetChain(assetString, chainID)

            let transformedXcmAsset = {
                xcmchainID: chainID,
                xcmInteriorKey: xcmInteriorKeyV1,
                symbol: symbol,
                relayChain: relayChain,
                nativeAssetChain: nativeAssetChain,
                isUSD: 0,
                decimals: decimals,
                priceUSD: null,
                parents: 1
            }
            polkaholicXcGar[xcmInteriorKeyV1] = transformedXcmAsset
            //polkaholicXcGar[xcmInteriorKeyV1] = xcmAsset
        }
        return polkaholicXcGar
    }

    compareXcRegistry(newXcRegistry, oldXcRegistry){
        let xcRegistryNewOnly = {}
        let xcRegistryOldOnly = {}
        let identicalXcRegsitry = {}
        let diffXcRefistry = {}

        let xcmInteriorNewKeys = Object.keys(newXcRegistry)
        let xcmInteriorOldKeys = Object.keys(oldXcRegistry)
        //console.log( a2.filter(x => !a1.includes(x)) );

        console.log(`xcmInteriorNewKeys`, xcmInteriorNewKeys)
        console.log(`xcmInteriorOldKeys`, xcmInteriorOldKeys)
        let xcmInteriorKeyCommon  = xcmInteriorNewKeys.filter(value => xcmInteriorNewKeys.includes(value));
        console.log(`xcmInteriorKeyCommon`, xcmInteriorKeyCommon)
        let xcmInteriorKeyNewOnly  = xcmInteriorNewKeys.filter(x => !xcmInteriorOldKeys.includes(x)) // new only
        console.log(`xcmInteriorKeyNewOnly`, xcmInteriorKeyNewOnly)
        let xcmInteriorKeyOldOnly  = xcmInteriorOldKeys.filter(x => !xcmInteriorNewKeys.includes(x)) // old only
        console.log(`xcmInteriorKeyOldOnly`, xcmInteriorKeyOldOnly)

        for (const xcmInteriorKey of xcmInteriorKeyCommon){
            let xcmAssetOld = oldXcRegistry[xcmInteriorKey]
            let xcmAssetNew = newXcRegistry[xcmInteriorKey]
            // present in both registry -- matched on xcmInteriorKey
            // check xcmchainID, xcmInteriorKey, symbol, relayChain, nativeAssetChain, decimals, parents are all the same
            let checkList = ['xcmchainID', 'xcmInteriorKey', 'symbol', 'relayChain', 'nativeAssetChain', 'decimals', 'parents']
            let mismatchedFlds = []
            let matchedFlds = []
            let isMismatch = false
            for (const k of checkList){
                console.log(`[${xcmInteriorKey}] xcmAssetOld`, xcmAssetOld)
                console.log(`[${xcmInteriorKey}] xcmAssetNew`, xcmAssetNew)
                if (xcmAssetOld[k] == xcmAssetNew[k]){
                    matchedFlds.push(k)
                }else{
                    isMismatch = true
                    mismatchedFlds.push(k)
                }
                if (isMismatch){
                    for (const mismatchedFld of mismatchedFlds){
                        let mistMatched = {}
                        mistMatched[mismatchedFld] = {
                            new: xcmAssetNew[mismatchedFld],
                            old: xcmAssetOld[mismatchedFld]
                        }
                        diffXcRefistry[xcmInteriorKey] = mistMatched
                    }
                }else{
                    identicalXcRegsitry[xcmInteriorKey] = xcmAssetNew
                }
            }
        }

        for (const xcmInteriorKey of xcmInteriorKeyNewOnly){
            xcRegistryNewOnly[xcmInteriorKey] = newXcRegistry[xcmInteriorKey]
        }

        for (const xcmInteriorKey of xcmInteriorKeyOldOnly){
            let xcmAssetNew = oldXcRegistry[xcmInteriorKey]
            xcRegistryOldOnly[xcmInteriorKey] = oldXcRegistry[xcmInteriorKey]
        }
        console.log(`New [${Object.keys(xcRegistryNewOnly).length}]`, xcRegistryNewOnly)
        console.log(`Old [${Object.keys(xcRegistryOldOnly).length}]`, xcRegistryOldOnly)
        console.log(`Identical [${Object.keys(identicalXcRegsitry).length}]`, identicalXcRegsitry)
        console.log(`Diff [${Object.keys(diffXcRefistry).length}]`, diffXcRefistry)
        return [xcRegistryNewOnly, xcRegistryOldOnly, identicalXcRegsitry, diffXcRefistry]
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
    mysql> select xcmchainID, xcmInteriorKey, symbol, relayChain, nativeAssetChain, isUSD, decimals, priceUSD, parent as parents from xcmasset where xcmInteriorKey is not null
    -> ;
+------------+-----------------------------------------------------------------------------------------------------------------+------------------------------------+----------------+------------------------------------------------------+-------+----------+------------------------+---------+
| xcmchainID | xcmInteriorKey                                                                                                  | symbol                             | relayChain     | nativeAssetChain                                     | isUSD | decimals | priceUSD               | parents |
+------------+-----------------------------------------------------------------------------------------------------------------+------------------------------------+----------------+------------------------------------------------------+-------+----------+------------------------+---------+
|      61000 | [{"parachain":1000},{"palletInstance":36},{"generalIndex":"0xfd9d0bf45a2947a519a741c4b9e99eb6"}]~moonbase-relay | 0xfd9d0bf45a2947a519a741c4b9e99eb6 | moonbase-relay | {"Token":"0xfd9d0bf45a2947a519a741c4b9e99eb6"}~61000 |     0 |     NULL |                      0 |       1 |
|       2000 | [{"parachain":2000},{"generalKey":"0x0000"}]~polkadot                                                           | ACA                                | polkadot       | {"Token":"ACA"}~2000                                 |     0 |       12 |    0.12060155351658557 |       1 |
|      22088 | [{"parachain":2088},{"generalKey":"0x0001"}]~kusama                                                             | AIR                                | kusama         | {"Token":"AIR"}~22088                                |     0 |       18 |   0.012279745503820385 |       1 |
|      61000 | [{"parachain":1000},{"palletInstance":3}]~moonbase-relay                                                        | AlphaDev                           | moonbase-relay | {"Token":"AlphaDev"}~61000                           |     0 |       18 |                      0 |       1 |
|       NULL | [{"parachain":1000},{"palletInstance":50},{"generalIndex":16}]~kusama                                           | ARIS                               | kusama         | {"Token":"16"}~21000                                 |     0 |        8 |                      0 |       1 |
|      62007 | {"parachain":2007}~moonbase-relay                                                                               | ASTR                               | moonbase-relay | {"Token":"ASTR"}~62007                               |     0 |       18 |                      0 |       1 |
|       2006 | {"parachain":2006}~polkadot                                                                                     | ASTR                               | polkadot       | {"Token":"ASTR"}~2006                                |     0 |       18 |   0.042955204003763736 |       1 |
|       2000 | [{"parachain":2000},{"generalKey":"0x0001"}]~polkadot                                                           | AUSD                               | polkadot       | {"Token":"AUSD"}~2000                                |     0 |       12 |     0.8090478540900946 |       1 |
|      60888 | [{"parachain":888},{"palletInstance":3}]~moonbase-relay                                                         | BetaDev                            | moonbase-relay | {"Token":"BetaDev"}~60888                            |     0 |       18 |                      0 |       1 |
|      62096 | [{"parachain":2096},{"generalKey":"0x020000000000000000"}]~moonbase-relay                                       | BIT                                | moonbase-relay | {"Token":"BIT"}~62096                                |     0 |       18 |                      0 |       1 |
|      22001 | [{"parachain":2001},{"generalKey":"0x0001"}]~kusama                                                             | BNC                                | kusama         | {"Token":"BNC"}~22001                                |     0 |       12 |    0.13626308014132404 |       1 |
|      62001 | [{"parachain":2001},{"generalKey":"0x0001"}]~moonbase-relay                                                     | BNC                                | moonbase-relay | {"Token":"BNC"}~62001                                |     0 |       12 |                      0 |       1 |
|       2030 | [{"parachain":2030},{"generalKey":"0x0001"}]~polkadot                                                           | BNC                                | polkadot       | {"Token":"BNC"}~2030                                 |     0 |       12 |                      0 |       1 |
|      22090 | [{"parachain":2090},{"generalIndex":0}]~kusama                                                                  | BSX                                | kusama         | {"Token":"BSX"}~22090                                |     0 |       12 | 0.00017263708395323448 |       1 |
|      62090 | [{"parachain":2090},{"generalKey":"0x00000000"}]~moonbase-relay                                                 | BSX                                | moonbase-relay | {"Token":"BSX"}~62090                                |     0 |       12 |                      0 |       1 |
|      62002 | {"parachain":2002}~moonbase-relay                                                                               | CLV                                | moonbase-relay | {"Token":"CLV"}~62002                                |     0 |       18 |                      0 |       1 |
|       2002 | {"parachain":2002}~polkadot                                                                                     | CLV                                | polkadot       | NULL                                                 |     0 |       18 |               0.379878 |       1 |

    */
}
