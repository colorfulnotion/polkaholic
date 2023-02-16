async function main() {

    let testcases = {
        shiden: {
            chainID: 22007,
            WSEndpoint: "ws://shiden-internal.polkaholic.io:9944",
            blocks: {
                // Sept 2021:
                // getBlockFailure VEC: Unable to decode on index 2 createType(ExtrinsicV4):: createType(Call):: Call: failed decoding session.setKeys:: Struct: failed on args: {"keys":"Lookup112","proof":"Bytes"}:: decodeU8aStruct: failed at 0x3281b6ff97964bef57518e5d185bb840… on keys (index 1/2): (AccountId,AccountId,AccountId,AccountId):: decodeU8a: failed at 0x0400… (index 2/4): AccountId:: Invalid AccountId provided, expected 32 bytes, found 2
                258135: "0x6622e4ec448659409a325a59a95f4a878483a411b4d5e94e7c8a368715632b67",

                // getBlock Failure VEC: Unable to decode on index 3 createType(ExtrinsicV4):: createType(Call):: Call: failed decoding session.setKeys:: Struct: failed on args: {"keys":"Lookup109","proof":"Bytes"}:: decodeU8aStruct: failed at 0x6e56f19eb21fc13a40ebfe8873504d60… on keys (index 1/2): (AccountId,AccountId,AccountId,AccountId):: decodeU8a: failed at 0x081234… (index 2/4): AccountId:: Invalid AccountId provided, expected 32 bytes, found 3
                429452: "0x5cd3396ca70e9ec361984df7ec34d6cfc06fcfda8e74b0dd73361390b76d6e1d",

                // Dec 2022:
                //2903463: "fixed",
                //2904141: "fixed"
            }
        },
        khala: {
            chainID: 22004,
            WSEndpoint: "wss://khala.api.onfinality.io/public-ws",
            blocks: {
                // July 2021: [[5486,6978],...,[101786,101793]]
                //5486: "fixed",
                //101793: "fixed",
                // Dec 2021: [[905401,906293],...,[980701,980972],[981255,983967]]
                // getBlock Failure VEC: Unable to decode on index 2 createType(ExtrinsicV4):: createType(Call):: Call: failed decoding phalaMq.syncOffchainMessage:: Struct: failed on args: _class:: decodeU8aStruct: failed at 0x05505e7068616c612f6d696e696e672f… on signed_message (index 1/1):: DoNotConstruct: Cannot construct unknown type SignedMessage
                905401: "0xf7c143be2a06343910a03e6bd8a59a13768882cfb9545b64affc4959e62c3560",
                // 983967: "OK"
            }
        },
        encointer: {

            chainID: 21001,
            WSEndpoint: "wss://encointer.api.onfinality.io/public-ws",
            blocks: {
                // May 2022
                // getBlock Failure VEC: Unable to decode on index 2 createType(ExtrinsicV4):: createType(Call):: findMetaCall: Unable to find Call with index [57, 54]/[57,54]
                539627: "0xf51df4b79eb0d3723135c51813bd17078ea5b62d664d240679e48e6fcb97a259",

                // getBlock Failure: same as above
                681760: "0xfc3e2fe7d96f07b62e033af0d00a3e640d179ae188b00c3a6f684a258e01c00d",

                // getBlock Failure VEC: Unable to decode on index 2 createType(ExtrinsicV4):: createType(Call):: findMetaCall: Unable to find Call with index [57, 119]/[57,119]
                1973591: "0x7d23fc4bf680c32d2ff2d1ca5883892d72ff20ed4dd87a62cebbc50120963848",

                // getBlock Failure : same as above
                2190093: "0x4b2679bada611f17600dfafb08ec8206f3fbad0f1a9189100bfc7fe08235dd76",
            }
        },
        kilt: {
            chainID: 22086,
            WSEndpoint: "wss://spiritnet.kilt.io/",
            blocks: {
                // Oct 2021
                //131016: "OK",
                312216: "OK",
                //  2022
                //2484577: "OK"
            }
        },

        //Minor cases: 
        // 22092-kintsugi - 8 blocks
        // 22088-altair: 2 blocks
        // 22090-basilisk: 2 blocks
        // 21000-statemine: 6 blocks
    }

    let testcase = testcases.kilt;

    let chainID = testcase.chainID;
    let WSEndpoint = testcase.WSEndpoint;
    let blocks = testcase.blocks;

    const {
        ApiPromise,
        WsProvider
    } = require("@polkadot/api");
    const {
        Metadata,
        TypeRegistry,
        StorageKey,
        decorateStorage
    } = require('@polkadot/types');
    const provider = new WsProvider(WSEndpoint);

    let api = await ApiPromise.create({
        provider: provider
    });
    console.log(`You are connected to chain ${chainID} endpoint=${WSEndpoint} Test cases: `, JSON.stringify(blocks));
    for (const bn of Object.keys(blocks)) {
        //let blockHash = blocks[bn];
        let header = await api.rpc.chain.getBlockHash(bn);
        let blockHash = header.toHex();

        // get the block
        try {
            const signedBlock = await api.rpc.chain.getBlock(blockHash);
            console.log("SUCCESS on rpc.chain.getBlock", chainID, bn, blockHash);
        } catch (err) {
            console.log("// getBlock Failure");
            console.log(bn, `: "${blockHash}",`);
        }
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
