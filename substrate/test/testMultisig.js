//https://polkadot.js.org/docs/util-crypto/examples/create-multisig/

const {
    createKeyMulti,
    encodeAddress,
    sortAddresses
} = require('@polkadot/util-crypto');

const paraTool = require("../paraTool");

/*

addresses: Input the addresses that will make up the multisig account.

threshold: The number of accounts that must approve. Must be greater than 0 and less than
or equal to the total number of addresses.

callerIdx: The address (as index in `addresses`) that will submit a transaction.

chainPrefix: chain prefix to use

*/

//test case: https://api.polkaholic.io/tx/0x6810f4aae923b24c57939fb98be57447bd824805cbca315d3985b6dc0515b8c0

/*
//"threshold": 3,
let addresses = [
  "D5n5UyNQtV4HQFiZqFPXW59FiMQTLbk4CPJKXd2ghvpBzxT",
  "DQKUSznmFByApBGpJ2g7knmcPujFtAgbJeiwYaDmn91YAbh",
  "FXvFrLfeowadXAHL18Vj2bnbj1EcsrbCU887ZosZ9a1XG6M",
  "GUedgN4GKFzoAQAk1rz2jDuC3dFfxd1WReqL6yvHeP1Uc8o",
  "GvBs67ZQ8QDupgseHKmrgmwKV8Qo5z75U2uJvDtou6pViSU",
]
// expected: HVhDikKS7Pi6WiRe6qhWmbArQ3Hbot9RXqsQpXJBo9Hi2r9. 0xd9a5ff2fdd0af1479d2bb66375caaacc48ca0cd736a90304fbb5a24f1522e747
*/

let addresses = [
    "0x167786d637fe9977e2a2a20730cdc3a52938252a4938a700f98c2ace33078d77",
    "0x249ba1d951e5a861be11421b51b02b7cbb6b1ca7ac77a5ba7d85d9cdd5b89c50",
    "0x82dfe80393393d3b49d8434af052b88141325ca37ebc28905a2e6438a0839264",
    "0xac9dcf4418d2e4bc92eec081a02e685250d7e82c4061b418b4897ca5a2c93074",
    "0xc018140d2c758a0afebfc62dab3cc964590a84ebb2e2ba551713ccb6114d325d",
]

function shuffle(array) {
    let currentIndex = array.length,
        randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }

    return array;
}

function toHex(bytes) {
    return (
        "0x" +
        bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")
    );
}

function computeMulti(addresses, threshold, callerIdx = 0, chainPrefix = 0) {

    // caller addr
    let caller = addresses[callerIdx]

    if (true) {
        addresses = shuffle(addresses)
    }

    let multiAddress = createKeyMulti(addresses, threshold);

    // Address as a byte array.
    console.log(`[caller:${caller}] ${addresses.length} addresses:[${addresses}], threshold=${threshold}`)

    // Convert byte array to SS58 encoding.
    let ss58MultisigAddress = encodeAddress(multiAddress, chainPrefix);

    console.log(`\nMultisig Address: ${ss58MultisigAddress}`);

    // Take addresses and remove the sender.
    let otherSignatories = addresses.filter((who) => who !== caller);

    // Sort them by public key.
    let otherSignatoriesSorted = sortAddresses(otherSignatories, chainPrefix);

    console.log(`\nOther Signatories: ${otherSignatoriesSorted}\n`);

    let m = {
        threshold: threshold,
        multiAddress: toHex(multiAddress),
        ss58Addr: ss58MultisigAddress,
        caller: caller,
        otherSignatoriesSorted: otherSignatoriesSorted,
    }
    return m
}

function removeItemFromArray(array, n) {
    const newArray = [];

    for (let i = 0; i < array.length; i++) {
        if (array[i] !== n) {
            newArray.push(array[i]);
        }
    }
    return newArray;
}

function thresholdtester(addresses, chainPrefix = 0) {
    let threshold = addresses.length
    while (threshold >= 1) {
        console.log(`**TEST threshold=${threshold}`)

        for (const a of addresses) {
            let callerIdx = addresses.indexOf(a)
            let m = computeMulti(addresses, threshold, callerIdx, chainPrefix)
            console.log(`multisig`, m)
            let addressesOther = removeItemFromArray(addresses, a);
            let m2 = paraTool.computeMultisig(a, addressesOther, threshold)
            console.log(`recover multisig`, m2)
        }
        threshold--
    }
}

function prefixtester(addresses, chainPrefix = [0, 2, 8, 10]) {
    for (const p of chainPrefix) {
        if (p == 46 || p == 47 || p >= 16383) {
            console.log(`Invalid chainPrefix=${p} - skipped`)
            continue
        }
        console.log(`* TEST chainPrefix=${p}`)
        thresholdtester(addresses, p)
    }
}

function main() {
    thresholdtester(addresses)
    thresholdtester(addresses.reverse())

    //valid prefix = [0,16383], excluding 46,47
    let chainPrefixList = Array.from(Array(100).keys())
    prefixtester(addresses, chainPrefixList)
    prefixtester(addresses.reverse(), chainPrefixList)

    process.exit();

}


main();