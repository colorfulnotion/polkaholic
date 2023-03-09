const paraTool = require("./paraTool");
const bs58 = require("bs58");
const {
    Keyring,
    decodeAddress,
    encodeAddress
} = require("@polkadot/keyring");
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
const {
    signatureVerify,
    evmToAddress,
    addressToEvm,
    createKeyMulti,
    sortAddresses
} = require('@polkadot/util-crypto');

const keyring = new Keyring({
    type: "sr25519",
    ss58Format: 2
});
const sha1 = require('sha1');
const Web3 = require("web3");
const web3 = new Web3();
const rlp = require('rlp')
const fs = require("fs");
const {
    XXHash32,
    XXHash64,
    XXHash3,
    XXHash128
} = require('xxhash-addon');
const {
    blake2AsHex,
    xxhashAsHex
} = require('@polkadot/util-crypto');

const {
    extractAuthor
} = require('@polkadot/api-derive/type/util')

const {
    ApiPromise,
} = require('@polkadot/api');

const assetChainSeparator = "~"

function encode_column_bt_hashes_xcminfofinalized(extrinsicID, xcmIndex, transferIndex){
    /* Definition
    xcmIndex: The nth xcm msg sent by this the extrinsic. Usually there's only one msg per extrinsic unless its utility-batch
    transferIndex: Rhe nth asset transfer within the xcmMsg(xcmIndex). Majority of the transfers have only one asset unless they are the >2 assets case by Multicurrencies or MultiAssets

    Example:
    A: 0xec2ba8eed23039c79fa313faac4fd70dd2d702a1756fb63da6a864d3235d8774 utility batch -> 10 single xTokens:transfer -> xcmIndex increase as expected [xcmIndex={0,9}, transferIndex= 0] (karura 471555)
    B: 0xfd9b172e9b18462a317de60d7661705c40e182b9ab498f3088c8d787bf4c6d76 utility batch -> only one args sending multiasset; transferIndex increases as expected [xcmIndex=0, transferIndex={0,1}] (Parallel-heiko 2637217)
    C: 0x8d3b83fdefde0cfd1b3eae343644d9ebfb77ba724bc6b841383392b4fc6da07c xcmPallet:limitedReserveTransferAssets  -> sedning multiasset [xcmIndex=0, transferIndex={0,1}] (kusama 15124933)
    D: 0xb0c89f90284960ed8b29b0e29a76c2590bf6b2f02817ac8e32c91a9c3d354c9c xTokens:TransferMulticurrencies -> one xcm sedning 2 assets [xcmIndex=0, transferIndex={0,1}] (karura 1630356)
    */
    let rowKey = `${extrinsicID}-${xcmIndex}-${transferIndex}`
    return rowKey
}

function decode_column_bt_hashes_xcminfofinalized(rowKey){
    //key blockNum-extrinsicIdx-xcmIndex:transferIndex
    let extrinsicID, xcmIndex, transferIndex = false
    try {
        let pieces = rowKey.split('-')
        if (pieces.length == 4){
            extrinsicID = `${pieces[0]}-${pieces[1]}`
            xcmIndex = pieces[2]
            transferIndex = pieces[3]
        }
    } catch (e){
        console.log(`invalid rowKey ${rowKey}`)
    }
    return [extrinsicID, xcmIndex, transferIndex]
}

function decode_xcminfo_finalized(XCMInfoData){
    if (XCMInfoData) {
        let xcmInfos = []
        for (const rowKey of Object.keys(XCMInfoData)) {
            let [extrinsicID, xcmIndex, transferIndex] = decode_column_bt_hashes_xcminfofinalized(rowKey)
            const cell = XCMInfoData[rowKey][0]; // latest cell
            let xcmInfo = JSON.parse(cell.value);
            xcmInfos.push(xcmInfo)
        }
        return xcmInfos;
    }
}

function encode_xcminfo_finalized(extrinsicHash, extrinsicID, xcmInfo, sourceTS) {
    if (!xcmInfo) return false;
    let hres = {
        key: extrinsicHash,
        data : {}
    }
    if (xcmInfo != undefined && xcmInfo.origination != undefined && xcmInfo.origination.xcmIndex != undefined && xcmInfo.origination.transferIndex != undefined){
    }else{
        console.log(`!!! invalid xcmInfo`, xcmInfo)
        return false
    }
    try {
        // write "hashes" xcminfofinalized with row key extrinsicHash and column extrinsicID
        let columnfamily = 'xcminfofinalized'
        hres.data[columnfamily] = {}
        let rowKey = encode_column_bt_hashes_xcminfofinalized(extrinsicID, xcmInfo.origination.xcmIndex, xcmInfo.origination.transferIndex)
        //console.log(`!!! create_xcminfo_finalized rowKey`, rowKey)
        //console.log(`!!! decode_column_bt_hashes_xcminfofinalized rowKey`, decode_column_bt_hashes_xcminfofinalized(rowKey))
        hres['data'][columnfamily][rowKey] = {
            value: JSON.stringify(xcmInfo),
            timestamp: sourceTS * 1000000
        };
    } catch (err) {
        if (this.debugLevel >=paraTool.debugErrorOnly) console.log(`create_xcminfo_finalized`, err)
        return false
    }
    console.log(`hres!!`, JSON.stringify(hres))
    return (hres);
}

module.exports = {
    encode_xcminfo_finalized: encode_xcminfo_finalized,
    decode_xcminfo_finalized: decode_xcminfo_finalized,
    encode_column_bt_hashes_xcminfofinalized: encode_column_bt_hashes_xcminfofinalized,
    decode_column_bt_hashes_xcminfofinalized: decode_column_bt_hashes_xcminfofinalized,
}
