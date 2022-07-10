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

const bs58 = require("bs58");
const {
    Keyring,
    decodeAddress,
    encodeAddress
} = require("@polkadot/keyring");
const {
    bnToBn,
    bnToHex,
    hexToBn,
    hexToU8a,
    isHex,
    stringToU8a,
    u8aToHex,
    u8aConcat,
    hexToString
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

const assetChainSeparator = "~"

function q(inp) {
    return ("'" + inp + "'");
}

function dechexToInt(number) {
    if ((number.length > 2) && number.substring(0, 2) == "0x") {
        return parseInt(number)
    } else {
        return parseInt(number);
    }
}

function isInt(n) {
    return Number(n) === n && n % 1 === 0;
}

function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
}

function dechexAssetID(number) {
    if ((number.length > 2) && number.substring(0, 2) == "0x") {
        let n = hexToBn(number)
        return n.toString()
    } else {
        return `${parseInt(number)}`;
    }
}

function parseBool(string) {
    if (string === 1 || string === 0) {
        return string === 1
    }
    try {
        switch (string.toLowerCase().trim()) {
            case "true":
            case "yes":
            case "1":
            case "t":
                return true;
            case "false":
            case "no":
            case "0":
            case "f":
            case null:
                return false;
            default:
                return false
        }
    } catch (e) {
        return false
    }

}

function toHex(bytes) {
    return (
        "0x" +
        bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")
    );
}

function computeMultisig(caller, addresses, threshold) {

    let allAddrs = []
    allAddrs.push(get_pubkey(caller))

    for (const a of addresses) {
        allAddrs.push(get_pubkey(a))
    }
    allAddrs.sort();
    let multiAddress = createKeyMulti(allAddrs, threshold);
    let m = {
        threshold: threshold,
        multisigAddress: toHex(multiAddress),
        signatories: allAddrs,
        signatorycnt: allAddrs.length
    }
    return m
}

function pubKey_hex2ascii(str) {
    if (typeof str != "string") return (null);
    let inp = (str.substring(0, 2) == "0x") ? str.substring(2) : str.substring(0);
    if (inp.length < 8) return (null);
    // 70617261 - para
    // 7369626c - sibl
    // 6d6f646c - modl
    let prefix = inp.substr(0, 8);
    if (prefix == "70617261" || prefix == "7369626c" || prefix == "6d6f646c") {} else return (null);
    let done = false;
    let out = "";
    let remaining = "";
    let j = inp.length;
    for (let i = j; i > 2; i -= 2) {
        let h = inp.substring(j - 2, j);
        let charCode = parseInt(h, 16);
        if (charCode == 0) {
            j = j - 2;
        } else {
            i = 0; // terminate
        }
    }
    for (let i = 0; i < j && (!done); i += 2) {
        let h = inp.substring(i, i + 2);
        let charCode = parseInt(h, 16);
        if ((charCode == 47) || (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122)) {
            out += String.fromCharCode(charCode);
        } else {
            remaining = h + remaining;
        }
    }
    if (remaining.length > 0 && remaining.length <= 4) {
        out += ":" + parseInt(remaining, 16);
    }
    return (out);
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

function getAvg(arr) {
    if (arr.length == 0) {
        return 0
    } else {
        return arr.reduce((p, c) => p + c) / arr.length
    }
}

function dtToTS(dt) {
    let dt2 = new Date(dt)
    return dt2.valueOf() / 1000
}

function getSum(arr) {
    if (arr.length == 0) {
        return 0
    } else {
        return arr.reduce((p, c) => p + c)
    }
}

//https://blockscout.moonbeam.network/blocks/221001/transactions
//eth frontier header {"parentHash":"0x64547fb5b03d218d8510c328b11d7ee4639f5cf6e1504aa2a6fbe1772af6161e","ommersHash":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347","beneficiary":"0xb3e64ef8fc9df438c9a54f4b189eddc1807b55a5","stateRoot":"0xa39ce439c1e3df9d548d975ffe4dde01d20f88c589d312e0ba735480671304b5","transactionsRoot":"0x82dc0ce6a21d855276668568ab2d98ab83dddfb7b978c47bff483823a3af89b8","receiptsRoot":"0x5bea5f91118ac331208e518a00cfb06f253d091aea82cff10aa53e6dbcf10b58","logsBloom":"0x043000000000020008000400800000402000020004000000020000020088000000010020900000020002000022000200080000000084000000000200002000000000008000000000000000080000002000000000000080000000001040000040028000000300000000008000000018000011000000000001000000102000020000000204000400000000000000000100040000000001000840400040000000000202004000000101000001000000102020020100000000001000000c000000c000018002800000400000000000001000020000000000001000000000040020000110200010000000000000000000000040000000408000122004020000000009","difficulty":0,"number":221001,"gasLimit":15000000,"gasUsed":532067,"timestamp":1642513176312,"extraData":"0x","mixHash":"0x0000000000000000000000000000000000000000000000000000000000000000","nonce":"0x0000000000000000"}
//expectedHash: 0x70a75c7e0fcf0fb9c658fa08457546e08adb032d859841cbf784c9558906180e
function compute_EVM_BlockHash(h) {
    let difficulty = (h.difficulty == 0) ? '0x' : web3.utils.toHex(h.gasUsed)
    let gasUsed = (h.gasUsed == 0) ? '0x' : web3.utils.toHex(h.gasUsed)

    let headerArr = [h.parentHash, h.ommersHash, h.beneficiary,
        h.stateRoot, h.transactionsRoot, h.receiptsRoot, h.logsBloom,
        difficulty, web3.utils.toHex(h.number), web3.utils.toHex(h.gasLimit), gasUsed, web3.utils.toHex(h.timestamp),
        h.extraData, h.mixHash, h.nonce
    ]
    //console.log(headerArr)
    //console.log(rlp.encode(headerArr).toString('hex'))
    let blockHash = web3.utils.keccak256(rlp.encode(headerArr))
    return blockHash
}

function parseSectionMethod(e) {
    if (e.module_name != undefined && e.module_function != undefined) {
        return [e.module_name, e.module_function]
    } else if (e.method != undefined && e.method.pallet != undefined) {
        return [e.method.pallet, e.method.method]
    } else {
        return [e.section, e.method]
    }
}

/*
{
  "method": {
    "pallet": "balances",
    "method": "Transfer"
  },
  "data": [
    "1qnJN7FViy3HZaxZK9tGAA71zxHSBeUweirKqCaox4t8GT7",
    "1b8tb8N1Nu3CQzF6fctE3p2es7KoMoiWSABe7e4jw22hngm",
    504494000000
  ]
}
*/
function is_transfer_event(pallet, method, data) {
    let pallet_method = `${pallet}:${method}`
    if (pallet_method == "balances:Transfer") return (true);
    return (false);
}

function get_address(pubKeyOrAddr, networkID = 0) {
    if (
        web3.utils.isHex(pubKeyOrAddr) &&
        pubKeyOrAddr.substr(0, 2).toLowerCase() != "0x"
    ) {
        return keyring.encodeAddress("0x" + pubKeyOrAddr, networkID);
    } else {
        return keyring.encodeAddress(pubKeyOrAddr, networkID);
    }
}

function get_pubkey(ss58Addr) {
    try {
        if (
            web3.utils.isHex(ss58Addr) &&
            ss58Addr.substr(0, 2).toLowerCase() != "0x"
        ) {
            var paddedPubkey = "0x" + ss58Addr;
            return toHex(keyring.decodeAddress(paddedPubkey));
        } else {
            return toHex(keyring.decodeAddress(ss58Addr));
        }
    } catch (e) {
        return (false);
    }
}

//derive H160 address from given pubKey
function pubkey_to_h160(pubkey) {
    return toHex(addressToEvm(pubkey))
}

//derive corresponding pubkey from H160 (correct)
function h160_to_pubkey(h160) {
    var ss58Addr = evmToAddress(h160)
    return get_pubkey(ss58Addr)
}

function h160_to_chain_address(h160, chainID = 5) {
    //var ss58Addr = evmToAddress(h160, dechexToInt(chainID), 'blake2')
    var ss58Addr = evmToAddress(h160)
    var addr = get_address(ss58Addr, dechexToInt(chainID))
    return addr
}

function pubkey_to_evm_ss58(pubkey, chainID = 5) {
    //var ss58Addr = evmToAddress(h160, dechexToInt(chainID), 'blake2')
    var ss58Addr = evmToAddress(pubkey_to_h160(pubkey))
    return get_address(ss58Addr, dechexToInt(chainID))
}


function blake2_256_from_hex(s) {
    let res = blake2AsHex(hexToU8a(s), 256)
    return res.slice(2)
}

function getBirth(current, r) {
    return Math.floor(
        (
            Math.max(bnToBn(current).toNumber(), r.phase.toNumber()) - r.phase.toNumber()
        ) / r.period.toNumber()
    ) * r.period.toNumber() + r.phase.toNumber();
}

function getDeath(current, r) {
    return getBirth(current) + r.period.toNumber();
}

function get_lifetime(current, r) {
    let birth = Math.floor(
        (
            Math.max(bnToBn(current).toNumber(), r.phase.toNumber()) - r.phase.toNumber()
        ) / r.period.toNumber()
    ) * r.period.toNumber() + r.phase.toNumber();
    let death = birth + r.period.toNumber();
    return [birth, death]
}

//TODO: the computation is off by one?
function lifetime(currentBN, periodBN, phaseBN) {
    let current = bnToBn(currentBN).toNumber()
    let period = bnToBn(periodBN).toNumber()
    let phase = bnToBn(phaseBN).toNumber()
    let birth = Math.floor(
        (
            Math.max(current, phase) - phase
        ) / period
    ) * period + phase;
    let death = birth + period;
    return [birth, death]
}

function decode_invertedTS(invertedTS) {
    let secondsToFuture = parseInt(invertedTS.substring(2), 16);
    let futureTS = 2 * 2145916800;
    let ts = futureTS - secondsToFuture
    return ts;
}

function inverted_ts_key(ts) {
    let futureTS = 2 * 2145916800;
    let secondsToFuture = Math.round((futureTS - ts));
    let out = "0x" + secondsToFuture.toString(16).padStart(8, "0");
    return out;
}

function audit_hashes_tx(tx) {
    // (0) determine whether it's substrateTx or Evm Tx
    if (tx.transactionHash != undefined) {
        return audit_evm_tx(tx)
    } else if (tx.extrinsicID != undefined) {
        return audit_substrate_tx(tx)
    } else {
        console.log(`unknown tx format`, tx)
        return (false);
    }
}

function audit_evm_tx(evmTx) {
    //todo: validate evmTX
    return true
}

function audit_substrate_tx(tx) {
    // (1) make sure section:method are present
    if (tx.section == undefined || tx.method == undefined) {
        console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] missing func section:method`)
        return false
    }
    // (2) check error decoration
    if (tx.err != undefined) {
        if (tx.err.module != undefined) {
            console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] undecorated error`, tx.err)
            return false
        }
        let errorStr = JSON.stringify(tx.err)
        if (errorStr.includes("errorID")) {
            console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] unknown error found`, tx.err)
        }
    }

    // (3) event check
    for (const evt of tx.events) {
        if (!audit_event_tx(evt)) {
            console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] event missing section:method`, evt)
            return false
        }
    }
    // (4) recursive args check
    let args = tx.params
    let res = audit_args_tx(tx, args)
    if (!res) {
        console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] audit failed`, tx.params)
        return false
    }
    return true
}

function audit_event_tx(e) {
    if (e.section == undefined || e.method == undefined) {
        console.log('missing section:method', e)
        return false
    }
    return true
}

function audit_args_tx(tx, args) {
    // there are call (proxy) and calls (utility)
    if (args !== undefined) {
        if (args.call !== undefined) {
            // the proxy route
            let c = args.call;
            if (c.callIndex !== undefined && (c.section == undefined || c.method == undefined)) {
                // missing section:method
                console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] call missing section:method`, c)
                return false
            } else {
                if (c.args != undefined) {
                    //recursive found..
                    //console.log("recursive args found from the call", c)
                    if (!audit_args_tx(tx, c.args)) {
                        console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] recursive args missing section:method`, c.args)
                        return false
                    }
                }
            }
        } else if (args.calls !== undefined) {
            // utility route
            let calls = args.calls;
            for (let i = 0; i < calls.length; i++) {
                let c = calls[i];
                if (c.callIndex !== undefined && (c.section == undefined || c.method == undefined)) {
                    console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] call missing section:method`, c)
                    return false
                } else {
                    if (c.args != undefined) {
                        //recursive found..
                        //console.log(`recursive args found from the calls[${i}]`, c)
                        if (!audit_args_tx(tx, c.args)) {
                            console.log(`[${tx.extrinsicID}][${tx.extrinsicHash}] calls[${i}] recursive args missing section:method`, c.args)
                            return false
                        }
                    }
                }
            }
        }
    } else {
        // missing args?
        console.log("missing args?", args);
        return false
    }
    return true
}

class NotFoundError extends Error {
    constructor(message) {
        // Needs to pass both `message` and `options` to install the "cause" property.
        super(message);
    }
}

class InvalidError extends Error {
    constructor(message) {
        // Needs to pass both `message` and `options` to install the "cause" property.
        super(message);
    }
}

module.exports = {
    NotFoundError,
    InvalidError,

    // DebugLevel
    debugNoLog: 0,
    debugErrorOnly: 1,
    debugInfo: 2,
    debugVerbose: 3,
    debugTracing: 4,

    // Kusama parachains
    chainIDStatemine: 21000, // 1. was 3
    chainIDEncointer: 21001, // 2. was 1001
    chainIDKarura: 22000, // 3. was 8
    chainIDBifrost: 22001, // 4. was 6
    chainIDKhala: 22004, // 5. was 2004 [CAREFUL cf Moonbeam]

    chainIDShiden: 22007, // done [was 2007]
    chainIDSora: 22011, // also 69,
    chainIDCrust: 22012, // 6. 2012 was 66,
    chainIDIntegritee: 22015,
    chainIDSakura: 22016, // 7. was 2016
    chainIDMoonriver: 22023, // 8. was 1285
    chainIDGenshiro: 22024, // 9. was 67
    chainIDRobonomics: 22048, // 10. was 32

    chainIDCalamari: 22084, // 11. was 78
    chainIDHeiko: 22085, // 12. was 110
    chainIDKilt: 22086, // 13. was 38
    chainIDPicasso: 22087, // 14. was 49
    chainIDAltair: 22088, // 15. was 136

    chainIDBasilisk: 22090, // 16. was 2090
    chainIDKintsugi: 22092, // 17. was 2092
    chainIDQuartz: 22095, // 18. was 255
    chainIDBitcountry: 22096, // 19. was 2096
    chainIDSubsocial: 22100, // 20. was 2100

    chainIDZeitgeist: 22101, // 21. was 2101
    chainIDDarwinia: 22105, // 22. was 2105
    chainIDLitmus: 22106, // 23. was 2106
    chainIDKico: 22107, // 24. was 2107
    chainIDMangata: 22110,
    chainIDTuring: 22114,

    // Polkadot parachains
    chainIDStatemint: 1000, // 1. was 1
    chainIDAcala: 2000, // 2. was 10
    chainIDClover: 2002, // 3. was 128
    chainIDMoonbeam: 2004, // 4. was 1284, [CAREFUL -- cf Khala]
    chainIDAstar: 2006, // 5. was 5

    chainIDEquilibrium: 2011,
    chainIDParallel: 2012, // 6. was 172
    chainIDComposable: 2019,
    chainIDEfinity: 2021,
    chainIDNodle: 2026,
    chainIDCentrifuge: 2031,

    chainIDInterlay: 2032,
    chainIDHydraDX: 2034,
    chainIDPhala: 2035,

    // other
    chainIDUnique: 255,
    chainIDPontem: 105,
    chainIDLaminar: 11,

    // polkadot/kusama
    chainIDPolkadot: 0,
    chainIDKusama: 2,

    // assetSource
    assetSourceCoingecko: 'coingecko',
    assetSourceOracle: 'oracle',
    assetSourceOnChain: 'onchain',

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



    toHex: function(bytes) {
        return toHex(bytes);
    },
    fromHex: function(hexStr) {
        var s = hexStr;
        if (hexStr.substr(0, 2).toLowerCase() == "0x") s = hexStr.substr(2);
        if (s == "") return new Uint8Array();
        return new Uint8Array(s.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    },
    getPubKey: function(ss58Addr) {
        return get_pubkey(ss58Addr)
    },
    getAddress: function(pubKeyAddr, networkID = 0) {
        return get_address(pubKeyAddr, networkID)
    },
    getNetwork: function(filePath = "summary/ss58-registry.json") {
        return readJSON(filePath);
    },
    getAllAddress: function(
        pubKeyAddr,
        filePath = "summary/ss58-registry.json"
    ) {
        return getAllAddress(pubKeyAddr, filePath);
    },
    isValidAddressPolkadotAddress: function(address) {
        return isValidAddressPolkadotAddress(address);
    },
    isValidSubstratePublicKey: function(address) {
        if (typeof address == "string" && address.length == 66) {
            return (true);
        }
        return (false);
    },
    isValidEVMAddress: function(address) {
        if (typeof address == "string" && address.length == 42) {
            return (true);
        }
        return (false);
    },
    validAmount: function(v) {
        if (typeof v == "number" && (v > 0)) return (true);
        if (typeof v == "string") {
            if (v.includes("0x")) return (false);
            let x = parseInt(v, 10);
            if (x > 0) return (true);
        }
        return (false);
    },
    decode58: function(ss58Addr) {
        return decode58(ss58Addr);
    },
    getChainID: function(ss58Addr) {
        //address <chainID(1bytes)><pubkey(32bytes)><checksum(2bytes)> = 35 bytes
        //see: https://github.com/tetcoin/tetcore/wiki/External-Address-Format-(SS58)
        return web3.utils.hexToNumber(decode58(ss58Addr).substring(0, 4));
    },
    getAddressType: function(id) {
        let idType = "invalid";
        let prefix = id.substring(0, 2);
        if (id.length == 66) {
            switch (prefix) {
                case "0x":
                    idType = "address";
                    break;
                case "1x":
                    idType = "account";
                    break;
                case "2x":
                    idType = "groupedAccounts";
                    break;
                case "3x":
                    idType = "parachain";
                    break;
                case "4x":
                    idType = "relayChain";
                    break;
                default:
                    idType = "invalid";
            }
        } else if (id.length == 64) {
            // ambiguous type
            idType = "ambiguous";
        } else if (isValidAddressPolkadotAddress(id)) {
            //the address doesn't follow 0x/1x/2x/3x/4x length68 convention...check if it's valid SS58. i.e (16DWzViTodXg48SJzRRcqTQbSvFBxJEQ9Y2F4pNsrXueH4Nz)
            var addrHex = decode58(id);
            var chainID = getChainID(id);
            console.log(`${addrHex} (chainID:${chainID})`);
            idType = "rawAddress";
        }
        return idType;

    },
    isValidSignature: function(signedMessage, signature, address) {
        var res = signatureVerify(signedMessage, signature, address)
        return res.isValid;

    },
    dechexToInt: function(number) {
        return dechexToInt(number);
    },
    dechexAssetID: function(number) {
        return dechexAssetID(number);
    },
    isValidAddressPolkadotAddress: function(address) {
        try {
            encodeAddress(isHex(address) ? hexToU8a(address) : decodeAddress(address));
            return true;
        } catch (error) {
            return false;
        }
    },
    buf2hex: function(buffer) {
        return [...new Uint8Array(buffer)]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('');
    },
    //by definition here: https://github.com/polkascan/py-substrate-interface/blob/5df61fc84a6fa185dcc17e761c412a499aad1609/substrateinterface/utils/hasher.py#L70
    twox_128: function(s) {
        var hasher64_0 = new XXHash64(0);
        var hasher64_1 = new XXHash64(1);
        let b = Buffer.from(s);
        let part1 = hasher64_0.hash(b).reverse()
        let part2 = hasher64_1.hash(b).reverse()
        let res = buf2hex(part1) + buf2hex(part2)
        return res
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
    blockNumberToHex: function(blockNumber) {
        return "0x" + blockNumber.toString(16).padStart(8, '0');
    },
    decode58: function(base58Str) {
        return u8aToHex(bs58.decode(base58Str));
    },
    readJSON: function(filePath) {
        var data = JSON.parse(fs.readFileSync(filePath));
        return data;
    },
    getAllAddress: function(pubKeyAddr, filePath) {
        var networks = readJSON(filePath);
        var pKeyAddr = pubKeyAddr;
        var pubKey = getPubKey(pKeyAddr);
        var output = {};
        output.pubKey = pubKey;
        output.networks = [];
        //console.log(`Publey=${pubKey} - derived from ss58 ${pubKeyAddr}`)
        networks.registry.forEach((n) => {
            if (n.standardAccount == "*25519") {
                var addr = getAddress(pubKey, n.prefix);
                //console.log(`Addr [${addr}]\t\tNetwork: ${n.network}(${n.symbols}), netowrkID=${n.prefix}, `)
                output.networks.push({
                    //symbols: n.symbols,
                    network: n.network,
                    networkID: n.prefix,
                    address: addr,
                });
            }
        });
        return output;
    },
    buf2hex: function(buffer) {
        return [...new Uint8Array(buffer)]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('');
    },
    padwith0x: function(s) {
        return u8aToHex(hexToU8a(s))
    },
    twox_128: function(s) {
        let res = xxhashAsHex(s, 128)
        return res.slice(2)
    },
    getAsset: function(a) {
        let typ = [];
        let content = [];
        if (Array.isArray(a)) {
            for (let i = 0; i < a.length; i++) {
                for (const k of Object.keys(a[i])) {
                    typ.push(k);
                    content.push(a[i][k]);
                }
            }
        } else {
            for (const k of Object.keys(a)) {
                typ.push(k);
                content.push(a[k]);
            }
        }
        // types of the keys of the objects in the array, or the keys of the object
        let typHash = xxhashAsHex(typ.join(","), 64).slice(2, 10);
        // values of the objects in the array, or the values of the object
        let contentHash = xxhashAsHex(content.join(","), 128).slice(2);
        return "0x" + typHash + contentHash;

    },
    twox_64: function(s) {
        let res = xxhashAsHex(s, 64)
        return res.slice(2)
    },
    twox_128_from_hex: function(s) {
        let res = xxhashAsHex(hexToU8a(s), 128)
        return res.slice(2)
    },
    twox_64_from_hex: function(s) {
        let res = xxhashAsHex(hexToU8a(s), 64)
        return res.slice(2)
    },
    blake2_256_from_hex: function(s) {
        let res = blake2AsHex(hexToU8a(s), 256)
        return res.slice(2)
    },
    blake2_128_from_hex: function(s) {
        let res = blake2AsHex(hexToU8a(s), 128)
        return res.slice(2)
    },
    blake2_64_from_hex: function(s) {
        let res = blake2AsHex(hexToU8a(s), 64)
        return res.slice(2)
    },
    verifyprefix: function(currencyStr = "45bc486788b29b5a0100810082") {
        // pairs
        //45bc486788b29b5a0100810082  =XXHash(0x0100810082)
        let prefix = currencyStr.substr(0, 16)
        let rawInput = currencyStr.substr(16)
        let expectedPrefix = twox_64_from_hex(rawInput)
        if (prefix == expectedPrefix) {
            return true
        } else {
            console.log(`prefix=${prefix}, expectedPrefix=${expectedPrefix}`)
            return false
        }
    },
    assetpairkey: function(token0, token1, chainID) {
        return JSON.stringify([{
            Token: token0
        }, {
            Token: token1
        }]) + assetChainSeparator + chainID.toString();
    },
    parseAssetChain: function(assetChain) {
        let pieces = assetChain.split(assetChainSeparator);
        let assetUnparsed = pieces[0];
        let chainID = (pieces.length > 1) ? parseInt(pieces[1], 10) : undefined;
        return [assetUnparsed, chainID];
    },
    parseAssetChainAsStruct: function(assetChain) {
        let pieces = assetChain.split(assetChainSeparator);
        let assetUnparsed = pieces[0];
        let chainID = parseInt(pieces[1], 10);
        return [JSON.parse(assetUnparsed), chainID];
    },
    parseHourlyChain: function(hourKeyChain) {
        let pieces = hourKeyChain.split("#");
        let hourKey = pieces[0];
        let chainID = parseInt(pieces[1], 10);
        return [hourKey, chainID];
    },
    makeAssetChain: function(asset, chainID = 99) {
        return (asset + assetChainSeparator + chainID);
    },
    inverted_ts_key: function(ts) {
        return inverted_ts_key(ts);
    },
    make_addressHistory_rowKey: function(accKey, ts) {
        return accKey + "#" + inverted_ts_key(ts);
    },
    make_addressExtrinsic_rowKey: function(address, extrinsicHash, ts) {
        let invertedTS = inverted_ts_key(ts)
        return `${address.toLowerCase()}#${invertedTS}#${extrinsicHash}`
    },
    decode_invertedTS: function(invertedTS) {
        return decode_invertedTS(invertedTS)
    },
    parse_addressExtrinsic_rowKey: function(rowKey) {
        let [addressPiece, invertedTS, extrinsicHashPiece] = rowKey.split('#')
        let ts = decode_invertedTS(invertedTS)
        return [addressPiece, ts, extrinsicHashPiece];
    },
    parse_addressHistory_rowKey: function(rowKey) {
        let [addressPiece, invertedTS] = rowKey.split('#')
        let ts = decode_invertedTS(invertedTS)
        return [addressPiece, ts];
    },
    getCurrentTS: function() {
        return Math.floor(+new Date() / 1000);
    },
    parseStorageKey: function(chainID, palletName, storageName, key, decoratedKey) {
        return parse_storage_key(chainID, palletName, storageName, key, decoratedKey);
    },
    computeEVMBlockHash: function(block) {
        return compute_EVM_BlockHash(block)
    },
    getShortHash: function(hash) {
        let shortHash = (hash >= 66) ? `${hash.substr(0,8)}...${hash.substr(-6)}` : "-"
        return shortHash
    },
    pubkeyToH160: function(pubkey) {
        return pubkey_to_h160(pubkey)
    },
    h160ToPubkey: function(h160) {
        return h160_to_pubkey(h160)
    },
    h160ToChainAddress: function(h160, chainID = 5) {
        return h160_to_chain_address(h160, chainID)
    },
    pubkeyToEVMSS58: function(pubkey, chainID = 5) {
        return pubkey_to_evm_ss58(pubkey, chainID)
    },
    round: function(value, decimals) {
        return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
    },
    encodeAssetChain: function(assetChain) {
        return assetChain.replace(":", "~~")
    },
    decodeAssetChain: function(assetChainEncoded) {
        return assetChainEncoded.replace("~~", ":")
    },
    //1645135200 -> [ '2022-02-17', 22 ]
    ts_to_logDT_hr: function ts_to_logDT_hr(ts) {
        var a = new Date(ts * 1000);
        let dd = a.getUTCDate().toString().padStart(2, '0');
        let mm = String(a.getUTCMonth() + 1).padStart(2, '0'); //January is 0!
        let yyyy = a.getUTCFullYear();
        let logDT = `${yyyy}-${mm}-${dd}`;
        var hr = a.getUTCHours();
        return [logDT, hr];
    },
    // '2022-02-17', 22 -> 1645135200
    logDT_hr_to_ts: function logDT_hr_to_ts(logDT, hr) {
        let logDTS = logDT.replaceAll('-', '')
        var y = logDTS.substr(0, 4),
            m = logDTS.substr(4, 2),
            d = logDTS.substr(6, 2)
        let a = new Date(`${y}-${m}-${d}`)
        let logDTTS = a.getTime() / 1000 + hr * 3600;
        return logDTTS
    },
    hexAsU8: function(hexStr) {
        return hexToU8a(hexStr)
    },
    getLifetime: function(currentBN, mortalEra) {
        return get_lifetime(currentBN, mortalEra)
    },
    sha1: function(s) {
        return sha1(s)
    },
    parseSectionMethod: function(e) {
        return parseSectionMethod(e)
    },
    auditHashesTx: function(tx) {
        return audit_hashes_tx(tx)
    },
    toNumWithComma: function(tx) {
        return toNumWithComma(tx)
    },
    toNumWithoutComma: function(tx) {
        return toNumWithoutComma(tx)
    },
    sameAddress: function(rawx, rawy) {
        let x = get_pubkey(rawx);
        let y = get_pubkey(rawy);
        return (x == y);
    },
    isObject: function(x) {
        return (typeof val === 'object');
    },
    hexToString: function(x) {
        return hexToString(x)
    },
    isInt: function(x) {
        return isInt(x)
    },
    isFloat: function(x) {
        return isFloat(x)
    },
    computeMultisig: function(caller, addresses, threshold) {
        return computeMultisig(caller, addresses, threshold)
    },
    parseBool: function(input) {
        return parseBool(input);
    },
    pubKeyHex2ASCII: function(str) {
        return pubKey_hex2ascii(str)
    }
};