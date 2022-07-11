// node testDecodeBlock.js
const paraTool = require("../paraTool");
const {
    extractAuthor
} = require('@polkadot/api-derive/type/util')

async function main() {
    const {
        ApiPromise,
        WsProvider
    } = require('@polkadot/api');
    var [chainID, blockNumber, blockHash] = [0, 11079169, "0x519355d1b39462d011c4f72bf7d808db5f040d47d8a4021ba8431ef96cf272ed"];
    var api = await ApiPromise.create({
        provider: new WsProvider('wss://rpc.polkadot.io')
    });
    await api.isReady;

    var signedBlk = await api.rpc.chain.getBlock(blockHash);
    var signedBlock = await api.rpc.chain.getBlock(blockHash);
    var sessionValidators = await api.query.session.validators.at(blockHash);
    var digest = signedBlk.block.header.digest


    var author1 = extractAuthor(digest, sessionValidators)
    var [author, authorPubkey] = paraTool.getAuthor(digest, sessionValidators)
    console.log(`author1=${author1}, author=${author}, authorPubkey=${authorPubkey}`)

    var digestJSON = signedBlk.block.header.digest.toJSON()
    var digest1 = api.registry.createType('Digest', digestJSON);
    var author2 = extractAuthor(digest1, sessionValidators)
    var [author3, authorPubkey4] = paraTool.getAuthor(digest1, sessionValidators)
    console.log(`author3=${author3}, author2=${author2}, authorPubkey4=${authorPubkey4}`)

}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
