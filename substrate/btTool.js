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

function encode_column_bt_hashes_xcminfofinalized(chainID, extrinsicID, xcmIndex, transferIndex) {
    /* Definition
    xcmIndex: The nth xcm msg sent by this the extrinsic. Usually there's only one msg per extrinsic unless its utility-batch
    transferIndex: Rhe nth asset transfer within the xcmMsg(xcmIndex). Majority of the transfers have only one asset unless they are the >2 assets case by Multicurrencies or MultiAssets

    Example:
    A: 0xec2ba8eed23039c79fa313faac4fd70dd2d702a1756fb63da6a864d3235d8774 utility batch -> 10 single xTokens:transfer -> xcmIndex increase as expected [xcmIndex={0,9}, transferIndex= 0] (karura 471555)
    B: 0xfd9b172e9b18462a317de60d7661705c40e182b9ab498f3088c8d787bf4c6d76 utility batch -> only one args sending multiasset; transferIndex increases as expected [xcmIndex=0, transferIndex={0,1}] (Parallel-heiko 2637217)
    C: 0x8d3b83fdefde0cfd1b3eae343644d9ebfb77ba724bc6b841383392b4fc6da07c xcmPallet:limitedReserveTransferAssets  -> sedning multiasset [xcmIndex=0, transferIndex={0,1}] (kusama 15124933)
    D: 0xb0c89f90284960ed8b29b0e29a76c2590bf6b2f02817ac8e32c91a9c3d354c9c xTokens:TransferMulticurrencies -> one xcm sedning 2 assets [xcmIndex=0, transferIndex={0,1}] (karura 1630356)
    */
    //key chainID-bn-extrinsicIdx-xcmIndex:transferIndex
    let rowKey = `${chainID}-${extrinsicID}-${xcmIndex}-${transferIndex}`
    return rowKey
}

function decode_column_bt_hashes_xcminfofinalized(rowKey = '2004-3126881-4-0-0') {
    //key chainID-bn-extrinsicIdx-xcmIndex:transferIndex
    let chainID = false,
        extrinsicID = false,
        xcmIndex = false,
        transferIndex = false,
        isValid = false
    try {
        let pieces = rowKey.split('-')
        if (pieces.length == 5) {
            chainID = parseInt(pieces[0])
            extrinsicID = `${pieces[1]}-${pieces[2]}`
            xcmIndex = parseInt(pieces[3])
            transferIndex = parseInt(pieces[4])
        }
    } catch (e) {
        console.log(`invalid rowKey ${rowKey} e`, e)
    }
    if (chainID != undefined && extrinsicID != undefined && xcmIndex != undefined && transferIndex != undefined) {
        isValid = true
    }
    return [chainID, extrinsicID, xcmIndex, transferIndex, isValid]
}

function decode_xcminfofinalized(XCMInfoData) {
    if (XCMInfoData) {
        let xcmInfos = []
        for (const rowKey of Object.keys(XCMInfoData)) {
            let [chainID, extrinsicID, xcmIndex, transferIndex, isValid] = decode_column_bt_hashes_xcminfofinalized(rowKey)
            if (isValid) {
                const cell = XCMInfoData[rowKey][0]; // latest cell
                let xcmInfo = JSON.parse(cell.value);
                xcmInfos.push(xcmInfo)
            } else {
                console.log(`invalid rowKey ${rowKey}`)
            }
        }
        return xcmInfos;
    }
}

function encode_xcminfofinalized(extrinsicHash, chainID, extrinsicID, xcmInfo, sourceTS) {
    if (!xcmInfo) return false;
    let hres = {
        key: extrinsicHash,
        data: {}
    }
    if (xcmInfo != undefined && xcmInfo.origination != undefined && xcmInfo.origination.xcmIndex != undefined && xcmInfo.origination.transferIndex != undefined) {} else {
        console.log(`!!! invalid xcmInfo`, xcmInfo)
        return false
    }
    try {
        let columnfamily = 'xcminfofinalized'
        // write "hashes" xcminfofinalized with row key extrinsicHash and column extrinsicID
        hres.data[columnfamily] = {}
        let xcmIndex = xcmInfo.origination.xcmIndex
        let transferIndex = xcmInfo.origination.transferIndex
        let rowKey = encode_column_bt_hashes_xcminfofinalized(chainID, extrinsicID, xcmIndex, transferIndex)
        //console.log(`!!! encode_column_bt_hashes_xcminfofinalized rowKey`, rowKey)
        //console.log(`!!! decode_column_bt_hashes_xcminfofinalized rowKey`, decode_column_bt_hashes_xcminfofinalized(rowKey))
        hres['data'][columnfamily][rowKey] = {
            value: JSON.stringify(xcmInfo),
            timestamp: sourceTS * 1000000
        };
    } catch (err) {
        if (this.debugLevel >= paraTool.debugErrorOnly) console.log(`create_xcminfo_finalized`, err)
        return false
    }
    return (hres);
}

module.exports = {
    encode_xcminfofinalized: encode_xcminfofinalized,
    decode_xcminfofinalized: decode_xcminfofinalized,
    encode_column_bt_hashes_xcminfofinalized: encode_column_bt_hashes_xcminfofinalized,
    decode_column_bt_hashes_xcminfofinalized: decode_column_bt_hashes_xcminfofinalized,
}