const ethers = require('ethers');
const {
    hexToU8a
} = require("@polkadot/util");
const {
    blake2AsHex
} = require('@polkadot/util-crypto');


async function main() {
    // generate codeHash from wasm
    const codeHash = "0xd4a0c8a362e413063fcd16b613c1bc646470eb64984d30976e85b185c9c75c22";
    const signature = "0x0c75bdf527cdde6bc93088904f95ac810159a50bea65c7e2a4a3a8e4820074027a03b866286b79380d82afe027bcce02198e60818740c520f95510ddf1cbbf941b";
    const signerAddr = await ethers.utils.verifyMessage(codeHash, signature);
    const validAddr = "0xE4aEa4bEf4c033DC5E881eb863b25C1644Ff2D61";
    console.log("Signer Address:", signerAddr);
    if (signerAddr == validAddr) {
        console.log("PASS");
    } else {
        console.log("FAIL", signerAddr, "should be", validAddr);
    }
    process.exit(0);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });