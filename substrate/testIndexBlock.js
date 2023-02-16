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
                131016: "OK",
                // 312216: "OK",
                //  2022
                2484577: "OK"
            }
        },
        //Other decoding failures
	kintsugi: { 
	    chainID: 22092,
	    WSEndpoint: "wss://api-kusama.interlay.io/parachain",
	    blocks: {
		// 2023-02-16 23:40:41             VEC: Unable to decode on index 2 createType(ExtrinsicV4):: createType(ExtrinsicSignatureV4):: decodeU8aStruct: failed at 0xb083c6fb6f8501c3ecf1ec94b099a3f7… on signer (index 1/5): {"_enum":{"Id":"AccountId","Index":"Compact<AccountIndex>","Raw":"Bytes","Address32":"H256","Address20":"H160"}}:: Unable to create Enum via index 176, in Id, Index, Raw, Address32, Address20
		// 2023-02-16 23:40:41        RPC-CORE: getBlock(hash?: BlockHash): SignedBlock:: createType(SignedBlock):: Struct: failed on block: {"header":"Header","extrinsics":"Vec<Extrinsic>"}:: Struct: failed on extrinsics: Vec<Extrinsic>:: createType(ExtrinsicV4):: createType(ExtrinsicSignatureV4):: decodeU8aStruct: failed at 0xb083c6fb6f8501c3ecf1ec94b099a3f7… on signer (index 1/5): {"_enum":{"Id":"AccountId","Index":"Compact<AccountIndex>","Raw":"Bytes","Address32":"H256","Address20":"H160"}}:: Unable to create Enum via index 176, in Id, Index, Raw, Address32, Address20

		2496: "0x2c4cfcd4f2ace08d27fb3bc7989d3232cdedc87555101901541811ee236da16e",// ./indexBlock 22092 2496
		2502 : "0x9795656ddb04372186597470fd97fc5269874bc72513560236d4f1906a54a1bf",
		2536 : "0xd9c6cf48d5b3a8374911f7bf7c2ca43327568081ccc5c170f5fa6e262d8764e7",
		15447 : "0x51969b8aab9f11258fbb3984370d47f323c3ece35650c71863d6ae834c339ff4",
		15461: "0xcce558b9335740394d28d9fdeb563c016117e8d5d1d7aa9fd676c43aeffbb16e",		// ./indexBlock 22092 15461
		16513: "0x8860bee2251313010a72ecdfae66fd9acc18eacb67c643045f6cff7f92eafc6d",		// ./indexBlock 22092 16513
		16526: "0xc59781ce10619b58b0fc72ed753516188014cf8f132420dabe4533cfe7ac84c9"		// ./indexBlock 22092 16526
	    }
	},
	altair: {
	    chainID: 22088,
	    WSEndpoint: "wss://fullnode.altair.centrifuge.io",
	    blocks: {
		90522: "0x16bc296309ed89fbd01647ce47d3f3bd1417bdae0c5d5b414f24355952afe241",		// ./indexBlock 22088 90522
		90523: "0x1f09ee546ad46c41c07267e3b8d9675bcea1ad59f360124d6f48642b851af1b3"		// ./indexBlock 22088 90523
	    }
	},
	basilisk: {
            chainID: 22090,
	    WSEndpoint: "ws://basilisk-internal.polkaholic.io:9944",
	    blocks: {
		129442: "0xd2f7d49b5c822d2efbce33bc1499c477a715241cb6cc38bdae90eb32b25560b2",	// ./indexBlock 22090 129442
		395401: "0xa61e5c775ea335206c50d6b6ce0617c08352eab2750cb890fffbacca66b07435"	// ./indexBlock 22090 395401
	    }
	},
	statemine: {
	    chainID: 21000,
	    WSEndpoint: "ws://statemine-internal.polkaholic.io:9944",
	    blocks: {
		// TODO: 6 blocks
	    }
	}
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
        let header = await api.rpc.chain.getBlockHash(parseInt(bn, 10));
        let blockHash = header.toHex();
        // get the block
        try {
            const signedBlock = await api.rpc.chain.getBlock(blockHash);
            console.log("SUCCESS on rpc.chain.getBlock", chainID, bn, blockHash);
        } catch (err) {
            console.log("FAILURE", bn, `: "${blockHash}",`);
	    //console.log(api.rpc.chain);
	    //const hdr = await api.rpc.chain.getHeader(blockHash);
            //console.log("BACKUP: ", hdr);
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
