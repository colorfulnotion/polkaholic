// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic.

// Polkaholic is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Polkaholic is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Polkaholic.  If not, see <http://www.gnu.org/licenses/>.


const Web3 = require("web3");
const web3 = new Web3();

const assetChainSeparator = "~"

const {
    bnToBn,
    bnToHex,
    bnToU8a,
    hexToBn,
    hexToU8a,
    isHex,
    stringToU8a,
    u8aToHex,
    u8aConcat,
    hexToString,
    stringToHex
} = require("@polkadot/util");

function dechexToInt(number) {
    if (number && typeof number == "string" && (number.length > 2) && number.substring(0, 2) == "0x") {
        return parseInt(number);
    }
    return parseInt(number)
}

function dechexAssetID(number) {
    if ((number.length > 2) && number.substring(0, 2) == "0x") {
        let n = hexToBn(number)
        return n.toString()
    } else {
        return `${parseInt(number)}`;
    }
}

//100150022 -> 100,150,022
function toNumWithComma(numb) {
    var str = numb.toString().split(".");
    str[0] = str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return str.join(".");
}

//100,150,022 -> 100150022
function toNumWithoutComma(numb) {
    var str = numb.toString().split(".");
    str[0] = str[0].replace(/,/g, '')
    let res = str.join(".");
    if (isNaN(res)) {
        return numb
    } else {
        return res
    }
}


//(xcAsset address = "0xFFFFFFFF" + DecimalToHexWith32Digits(AssetId)
// 340282366920938463463374607431768211455 -> 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF
// 42259045809535163221576417993425387648  -> 0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080
function xcAssetIDToContractAddr(xcAssetID) {
    let xcAssetAddress = '0x'
    try {
        let h = bnToHex(`${xcAssetID}`)
        let assetAddress = "0xFFFFFFFF" + h.substr(2).padStart(32, '0')
        xcAssetAddress = web3.utils.toChecksumAddress(assetAddress)
    } catch (err) {
        console.log(`xcAssetIDToContractAddr error=${err.toString()}`)
    }
    return xcAssetAddress
}

// 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF -> 340282366920938463463374607431768211455
// 0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080 -> 42259045809535163221576417993425387648
function contractAddrToXcAssetID(xcAssetAddress) {
    let xcAssetID = false
    try {
        let rawAssetID = '0x' + xcAssetAddress.substr(10)
        xcAssetID = dechexAssetID(rawAssetID)
    } catch (err) {
        console.log(`contractAddrToXcAssetID error=${err.toString()}`)
    }
    return xcAssetID
}

// (0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF, polkadot-2004) -> {"Token":"42259045809535163221576417993425387648"}~polkadot-2004
function makeAssetChainFromXcContractAddress(xcAssetAddress, chainkey = 'polkadot-2004') {
    let xcAssetID = false
    let asset = {
        Token: null,
    }
    if (xcAssetAddress != undefined) {
        if (xcAssetAddress.length = 42 && xcAssetAddress.substr(0, 2) == "0x") {
            xcAssetID = contractAddrToXcAssetID(xcAssetAddress)
            asset.Token = xcAssetID
            return (JSON.stringify(asset) + assetChainSeparator + chainkey);
        }
    }
    return false
}

//'[{"network":"kusama"},{"parachain":2000},{"generalKey":"0x0080"}]'
//'[{"network":"kusama"},"here"]'
//'[{"network":"kusama"},{"parachain":2016}]'
function convert_xcmInteriorKey_to_xcmV1MultiLocation(xcmInteriorKey = 'polkadot~[{"parachain":1000},{"palletInstance":50},{"generalIndex":1984}]', isUppercase = false) {
    try {
        /*
        let pieces = xcmInteriorKey.split(assetChainSeparator);
        let relayChain = pieces[1];
        let assetUnparsed = (pieces.length > 1) ? pieces[1] : undefined;
        */
        let pieces = JSON.parse(xcmInteriorKey)
        //console.log(`xcmInteriorKey=${xcmInteriorKey}`, pieces)
        let network = pieces.shift()
        let assetUnparsed = {}
        if (pieces.length == 1) {
            assetUnparsed = JSON.stringify(pieces[0])
        } else {
            assetUnparsed = JSON.stringify(pieces)
        }
        // always use parent as reference
        let xcmVersionedMultiLocation = {}
        let xcmV1MultiLocation = {
            parents: 1,
            interior: {}
        }
        if (assetUnparsed == '"here"') {
            xcmV1MultiLocation.interior = {
                here: null
            }
        } else {
            let interior = JSON.parse(assetUnparsed)
            let interiorN = interior.length
            if (interiorN == undefined) {
                interiorN = 1
                interior = [interior]
            }
            //console.log(`assetUnparsed ${assetUnparsed} interiorN=${interiorN},interior`, interior)
            let interiorType = (isUppercase) ? `X${interiorN}` : `x${interiorN}`
            if (interiorN == 1) {
                xcmV1MultiLocation.interior[interiorType] = interior[0]
            } else {
                let interiorValArr = []
                for (const inter of interior) {
                    interiorValArr.push(inter)
                }
                xcmV1MultiLocation.interior[interiorType] = interiorValArr
            }
        }
        let versionType = (isUppercase) ? `V1` : `v1`
        xcmVersionedMultiLocation[versionType] = xcmV1MultiLocation
        return xcmVersionedMultiLocation
    } catch (e) {
        console.log(`convert_xcmInteriorKey_to_xcmV1MultiLocation err`, e)
        return false
    }
}

function convert_xcmV1MultiLocation_to_byte(xcmV1MultiLocation, api = false) {
    if (!api) return null;
    let multilocationStruct = {}
    if (xcmV1MultiLocation.v1 != undefined) multilocationStruct = xcmV1MultiLocation.v1
    if (xcmV1MultiLocation.V1 != undefined) multilocationStruct = xcmV1MultiLocation.V1
    let multiLocationHex = false
    try {
        let multilocation = api.createType('XcmV1MultiLocation', multilocationStruct)
        multiLocationHex = u8aToHex(multilocation.toU8a())
    } catch (e) {
        console.log(`xcmV1MultiLocation_to_byte error`, JSON.stringify(xcmV1MultiLocation, null, 4), e)
    }
    return multiLocationHex
}

function decodeNetwork(network) {
    let relayChain = 'null';
    if (network.network != undefined) relayChain = network.network
    if (network.named != undefined) relayChain = hexToString(network.named)
    return relayChain
}

function encodeNetwork(relayChain = 'kusama') {
    let network = {}
    if (relayChain == 'kusama' || relayChain == 'polkadot') {
        network = {
            network: relayChain
        }
    } else {
        network = {
            named: stringToHex(relayChain)
        }
    }
    return network
}

//'[{"parachain":2000},{"generalKey":"0x02f4c723e61709d90f89939c1852f516e373d418a8"}]~polkadot' -> [{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x02f4c723e61709d90f89939c1852f516e373d418a8"}]
// polkadot-here -> [{"network":"polkadot"},"here"]
function convertXcmInteriorKeyV1toV2(xcmInteriorKeyV1 = '[{"parachain":2000},{"generalKey":"0x02f4c723e61709d90f89939c1852f516e373d418a8"}]~polkadot') {
    var [xcmInteriorKey, relayChain] = parseXcmInteriorKeyV1(xcmInteriorKeyV1)
    let network = encodeNetwork(relayChain)
    if (xcmInteriorKey == 'here') {
        xcmInteriorKey = '"here"'
    }
    return makeXcmInteriorKeyV2(xcmInteriorKey, network)
}

//[{"network":"polkadot"},"here"] -> polkadot-here
function convertXcmInteriorKeyV2toV1(xcmInteriorKeyV2 = '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x02f4c723e61709d90f89939c1852f516e373d418a8"}]') {
    var [network, xcmInteriorKey] = parseXcmInteriorKeyV2(xcmInteriorKeyV2)
    let relayChain = decodeNetwork(network)
    if (xcmInteriorKey == '"here"') {
        xcmInteriorKey = 'here'
    }
    return makeXcmInteriorKeyV1(xcmInteriorKey, relayChain)
}

function parseXcmInteriorKeyV2(xcmInteriorKey = '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x02f4c723e61709d90f89939c1852f516e373d418a8"}]') {
    /*
    let pieces = xcmInteriorKey.split(assetChainSeparator);
    let relayChain = pieces[1];
    let assetUnparsed = (pieces.length > 1) ? pieces[1] : undefined;
    */
    try {
        let pieces = JSON.parse(xcmInteriorKey)
        console.log(`xcmInteriorKey=${xcmInteriorKey}`, pieces)
        let network = pieces.shift()
        let assetUnparsed = {}
        if (pieces.length == 1) {
            assetUnparsed = JSON.stringify(pieces[0])
        } else {
            assetUnparsed = JSON.stringify(pieces)
        }
        return [network, assetUnparsed];
    } catch (e) {
        return [false, false]
    }
}

function makeXcmInteriorKeyV2(interiorStr, network = {
    network: 'kusama'
}) {
    let interior = JSON.parse(interiorStr)
    let globalInterior = [network]
    if (Array.isArray(interior)) {
        globalInterior = globalInterior.concat(interior);
    } else {
        globalInterior.push(interior)
    }
    //return (relayChain + assetChainSeparator + interior);
    return JSON.stringify(globalInterior)
}

function makeXcmInteriorKeyV1(interior, relayChain = 'kusama') {
    return (interior + assetChainSeparator + relayChain);
}

function parseXcmInteriorKeyV1(xcmInteriorKey = '[{"parachain":2023},{"palletInstance":10}]~kusama') {
    let pieces = xcmInteriorKey.split(assetChainSeparator);
    let assetUnparsed = pieces[0];
    let relayChain = (pieces.length > 1) ? pieces[1] : undefined;
    return [assetUnparsed, relayChain];
}

module.exports = {

    // DebugLevel
    debugNoLog: 0,
    debugErrorOnly: 1,
    debugInfo: 2,
    debugVerbose: 3,
    debugTracing: 4,

    /*
    mysql> select chainID, id, chainName, crawling from chain where relaychain = 'polkadot' and crawling = 1;
    +---------+------------------+--------------------+----------+
    | chainID | id               | chainName          | crawling |
    +---------+------------------+--------------------+----------+
    |       0 | polkadot         | Polkadot           |        1 |
    |    1000 | statemint        | Statemint          |        1 |
    |    2000 | acala            | Acala              |        1 |
    |    2002 | clover           | Clover             |        1 |
    |    2004 | moonbeam         | Moonbeam           |        1 |
    |    2006 | astar            | Astar              |        1 |
    |    2011 | equilibrium      | Equilibrium        |        1 |
    |    2012 | parallel         | Parallel           |        1 |
    |    2013 | litentry         | Litentry           |        1 |
    |    2019 | composable       | Composable Finance |        1 |
    |    2021 | efinity          | Efinity            |        1 |
    |    2026 | nodle            | Nodle              |        1 |
    |    2030 | bifrost-dot      | Bifrost-Polkadot   |        1 |
    |    2031 | centrifuge       | Centrifuge         |        1 |
    |    2032 | interlay         | Interlay           |        1 |
    |    2034 | hydradx          | HydraDX            |        1 |
    |    2035 | phala            | Phala              |        1 |
    |    2037 | unique           | Unique             |        1 |
    |    2039 | integritee-shell | Integritee Shell   |        1 |
    |    2043 | origintrail      | Origin Trail       |        1 |
    |    2046 | darwinia         | Darwinia           |        1 |
    |    2052 | kylin            | Kylin              |        1 |
    +---------+------------------+--------------------+----------+

    mysql> select chainID, id, chainName, crawling from chain where relaychain = 'kusama' and crawling = 1;
    +---------+-------------------+---------------------+----------+
    | chainID | id                | chainName           | crawling |
    +---------+-------------------+---------------------+----------+
    |       2 | kusama            | Kusama              |        1 |
    |   21000 | statemine         | Statemine           |        1 |
    |   22000 | karura            | Karura              |        1 |
    |   22001 | bifrost-ksm       | Bifrost-Kusama      |        1 |
    |   22004 | khala             | Khala               |        1 |
    |   22007 | shiden            | Shiden              |        1 |
    |   22011 | sora              | Sora Kusama         |        1 |
    |   22012 | shadow            | Crust Shadow        |        1 |
    |   22015 | integritee        | Integritee          |        1 |
    |   22023 | moonriver         | Moonriver           |        1 |
    |   22024 | genshiro          | Genshiro            |        1 |
    |   22048 | robonomics        | Robonomics          |        1 |
    |   22084 | calamari          | Calamari            |        1 |
    |   22085 | parallel-heiko    | Parallel Heiko      |        1 |
    |   22086 | spiritnet         | KILT Spiritnet      |        1 |
    |   22087 | picasso           | Picasso             |        1 |
    |   22088 | altair            | Altair              |        1 |
    |   22090 | basilisk          | Basilisk            |        1 |
    |   22092 | kintsugi          | Kintsugi            |        1 |
    |   22095 | quartz            | Quartz              |        1 |
    |   22096 | bitcountrypioneer | Bit.Country Pioneer |        1 |
    |   22100 | subsocialx        | SubsocialX          |        1 |
    |   22101 | zeitgeist         | Zeitgeist           |        1 |
    |   22102 | pichiu            | Pichiu              |        1 |
    |   22105 | crab              | Darwinia Crab       |        1 |
    |   22106 | litmus            | Litmus              |        1 |
    |   22110 | mangatax          | Mangata             |        1 |
    |   22113 | kabocha           | Kabocha             |        1 |
    |   22114 | turing            | Turing              |        1 |
    |   22115 | dorafactory       | Dora Factory        |        1 |
    |   22118 | listen            | Listen              |        1 |
    |   22119 | bajun             | Bajun Network       |        1 |
    |   22121 | imbue             | Imbue Network       |        1 |
    |   22222 | daoipci           | DAO IPCI            |        1 |
    +---------+-------------------+---------------------+----------+

    */
    // Kusama parachains
    chainIDStatemine: 21000,
    chainIDEncointer: 21001,
    chainIDKarura: 22000,
    chainIDBifrostKSM: 22001,
    chainIDKhala: 22004,
    chainIDShiden: 22007,
    //chainIDMars: 22008,
    chainIDSora: 22011,
    chainIDCrustShadow: 22012,
    chainIDIntegritee: 22015,
    //chainIDSakura: 22016,
    //chainIDSubgameGamma: 22018,
    //chainIDKpron: 22019,
    //chainIDAltairDev: 22021,
    chainIDMoonriver: 22023,
    chainIDGenshiro: 22024,
    chainIDRobonomics: 22048,
    //chainIDRobonomicsDev: 22077,
    //chainIDTrustbase: 22078,
    //chainIDLoom: 22080,
    chainIDCalamari: 22084,
    chainIDHeiko: 22085,
    chainIDKilt: 22086,
    chainIDPicasso: 22087,
    chainIDAltair: 22088,
    chainIDBasilisk: 22090,
    chainIDKintsugi: 22092,
    //chainIDUnorthodox: 22094,
    chainIDQuartz: 22095,
    chainIDBitcountry: 22096,
    chainIDSubsocial: 22100,

    chainIDZeitgeist: 22101,
    chainIDPichiu: 22102,
    chainIDDarwiniaCrab: 22105,
    chainIDLitmus: 22106,
    chainIDKico: 22107,
    chainIDMangataX: 22110,
    chainIDKabocha: 22113,
    chainIDTuring: 22114,
    chainIDDoraFactory: 22115,
    chainIDTanganika: 22116,
    chainIDListen: 22118,
    chainIDBajun: 22119,
    chainIDImbue: 22121,
    //chainIDGM: 22123,
    chainIDAmplitude: 22124,
    chainIDTinkernet: 22125,

    // Polkadot parachains
    chainIDStatemint: 1000,
    chainIDAcala: 2000,
    chainIDClover: 2002,
    //chainIDdarwiniaBackup: 2003,
    chainIDMoonbeam: 2004,
    chainIDAstar: 2006,
    chainIDKapex: 2007,
    //chainIDCrust: 2008,
    chainIDEquilibrium: 2011,
    chainIDParallel: 2012,
    chainIDLitentry: 2013,
    //chainIDManta: 2015,
    //chainIDSubgame: 2017,
    //chainIDSubdao: 2018,
    chainIDComposable: 2019,
    chainIDEfinity: 2021,
    chainIDNodle: 2026,
    chainIDCoinversation: 2027,
    //chainIDAres: 2028,
    chainIDBifrostDOT: 2030,
    chainIDCentrifuge: 2031,
    chainIDInterlay: 2032,
    chainIDHydraDX: 2034,
    chainIDPhala: 2035,
    chainIDUnique: 2037,
    //chainIDGeminis: 2038,
    chainIDIntegriteeShell: 2039,
    chainIDPolkadex: 2040,
    chainIDOrigintrail: 2043,
    //chainIDDarwinia: 2046,
    //chainIDKylin: 2052,
    //chainIDOmnibtc: 2055,

    // other
    chainIDUniqueOther: 255,
    chainIDPontem: 105,
    chainIDLaminar: 11,
    chainIDMoonbaseAlpha: 61000,
    chainIDMoonbaseBeta: 60888,
    chainIDMoonbaseRelay: 60000,

    chainIDShibuya: 81000, //TODO: (Q:where is shibuya relay?)
    chainIDShibuyaRelay: 80000,

    // polkadot/kusama
    chainIDPolkadot: 0,
    chainIDKusama: 2,


    // assetType
    assetTypeLoan: "Loan",
    assetTypeCDP: "CDP",
    assetTypeCDPSupply: "CDP_Supply",
    assetTypeCDPBorrow: "CDP_Borrow",
    assetTypeToken: "Token",
    assetTypeNFT: "NFT",
    assetTypeNFTToken: "NFTToken",
    assetTypeLiquidityPair: "LiquidityPair",
    assetTypeERC20LiquidityPair: "ERC20LP",
    assetTypeERC20: "ERC20",
    assetTypeERC721: "ERC721",
    assetTypeERC721Token: "ERC721Token",
    assetTypeERC1155: "ERC1155",
    assetTypeERC1155Token: "ERC1155Token",
    assetTypeContract: "Contract",
    assetTypeXCAsset: "XCAsset",
    assetTypeXCMTransfer: "XCMTransfer",

    stringToHex: function(x) {
        return stringToHex(x)
    },

    dechexToInt: function(number) {
        return dechexToInt(number);
    },
    dechexAssetID: function(number) {
        return dechexAssetID(number);
    },

    makeAssetChain: function(asset, chainkey = 'relaychain-paraID') {
        return (asset + assetChainSeparator + chainkey);
    },

    parseAssetChain: function(assetChainkey) {
        let pieces = assetChain.split(assetChainSeparator);
        let assetUnparsed = pieces[0];
        let chainkey = (pieces.length > 1) ? pieces[1] : undefined;
        return [assetUnparsed, chainkey];
    },

    /*
    makeXcmInteriorKeyV1: function(interior, relayChain = 'kusama') {
        return makeXcmInteriorKeyV1(interior, relayChain)
    },
    parseXcmInteriorKeyV1: function (xcmInteriorKey = '[{"parachain":2023},{"palletInstance":10}]~kusama') {
        return parseXcmInteriorKeyV1(xcmInteriorKey);
    },
    makeXcmInteriorKeyV2: function(interior, relayChain = 'kusama') {
        return makeXcmInteriorKeyV2(interior, relayChain)
    },
    parseXcmInteriorKeyV2: function (xcmInteriorKey = '[{"parachain":2023},{"palletInstance":10}]~kusama') {
        return parseXcmInteriorKeyV2(xcmInteriorKey);
    },
    */
    /*
    paraTool uses older XcmInteriorKeyV1 format, whereas garTool uses XcmInteriorKeyV2 format
    */
    makeXcmInteriorKey: function(interiorStr, network = {
        network: 'kusama'
    }) {
        return makeXcmInteriorKeyV2(interiorStr, network)
    },
    parseXcmInteriorKey: function(xcmInteriorKey = '[{"network":"polkadot"},{"parachain":2000},{"generalKey":"0x02f4c723e61709d90f89939c1852f516e373d418a8"}]') {
        return parseXcmInteriorKeyV2(xcmInteriorKey)
    },
    convertXcmInteriorKeyV1toV2: function(xcmInteriorKeyV1) {
        return convertXcmInteriorKeyV1toV2(xcmInteriorKeyV1)
    },
    convertXcmInteriorKeyV2toV1: function(xcmInteriorKeyV2) {
        return convertXcmInteriorKeyV2toV1(xcmInteriorKeyV2)
    },
    cleanedAssetID: function(assetID) {
        return toNumWithoutComma(assetID);
    },
    toNumWithComma: function(tx) {
        return toNumWithComma(tx)
    },
    firstCharLowerCase: function(inp) {
        if (inp.toUpperCase() == inp) { // if the whole thing is uppercase, then return all lowercase
            return inp.toLowerCase();
        }
        return inp.substr(0, 1).toLowerCase() + inp.substr(1)
    },
    firstCharUpperCase: function(inp) {
        return inp.substr(0, 1).toUpperCase() + inp.substr(1)
    },
    xcAssetIDToContractAddr: function(xcAssetID) {
        return xcAssetIDToContractAddr(xcAssetID)
    },
    contractAddrToXcAssetID: function(xcAssetAddress) {
        return contractAddrToXcAssetID(xcAssetAddress)
    },
    makeAssetChainFromXcContractAddress: function(xcContractAddress, chainkey) {
        return makeAssetChainFromXcContractAddress(xcContractAddress, chainkey);
    },
    convertXcmInteriorKeyToXcmV1MultiLocation: function(xcmInteriorKey, isUppercase = false) {
        return convert_xcmInteriorKey_to_xcmV1MultiLocation(xcmInteriorKey, isUppercase)
    },
    convertXcmV1MultiLocationToByte: function(xcmV1MultiLocation, api = false) {
        //return false
        return convert_xcmV1MultiLocation_to_byte(xcmV1MultiLocation, api)
    },
};
