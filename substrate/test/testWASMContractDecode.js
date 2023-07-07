const {
    ApiPromise,
    WsProvider,
    Keyring
} = require("@polkadot/api");
const {
    CodePromise,
    ContractPromise
} = require('@polkadot/api-contract');
const {
    u8aToU8a,
    hexToU8a,
    u8aToHex,
    compactAddLength
} = require('@polkadot/util');

const Query = require("../query");

async function main() {
    let chainID = 30000;
    let endpoint = "wss://rpc.shibuya.astar.network";

    const provider = new WsProvider(endpoint);
    provider.on('disconnected', () => {
        console.log('CHAIN API DISCONNECTED', chainID);
    });
    provider.on('connected', () => console.log('chain API connected', chainID));
    provider.on('error', (error) => console.log('chain API error', chainID, error));
    let api = await ApiPromise.create({
        provider: provider
    });

    let debugLevel = 0
    var query = new Query(debugLevel);
    await query.init();

    console.log(`You are connected to ASTAR/SHIDEN/SHIBUYA chain ${chainID} endpoint=${endpoint} with options`);

    let testcases = [
        // Uniswap v2 call https://polkaholic.io/tx/0x6d2462cd0a9a5c1e29aff30a8eee8e3e4d9b10f88c28b208c37483ed751639d5
        {
            "extrinsicHash": "0x6d2462cd0a9a5c1e29aff30a8eee8e3e4d9b10f88c28b208c37483ed751639d5",
            "address_ss58": "ZxDyA6CMmSpCf3c4GaqTyXT9e4BZdpQXzY1NyC1KCWkXc89",
            // fee_to_setter is 0x80999559
            "data": "0x80999559d0de16fdeebddc2a8db91e4d6af79f1cc9ee4a225c417b6cb56e27226271000c",
            "codeHash": "0x86649b2d9fae6c57bf1c4aedacd4bbae324058cc5a2a0e96e9eb6c633a4d4bf6"
        },
        // PSP34
        {
            "extrinsicHash": "0x22ec25637b7307f4075541f98465288c532d474d859854e4bbf0829b807b11a5",
            // 5C7TUw177QfjuKS9BFmbkn2QRuFAvPM8dU7H85B1dqeJ2vAy
            "address_ss58": "Vz3vDyBteJr89TyfZDinSBgWwxHtc3sefcRMnNsWCeFdAMe",
            // new_owner 
            "data": "0x11f43efdd0de16fdeebddc2a8db91e4d6af79f1cc9ee4a225c417b6cb56e27226271000c",
            "codeHash": "0xb33cafa42e6a8980d60dc20a32c307c610fa9e5a9d9992c6f8b46cab4c45944d"
        }
    ];
    // https://github.com/polkadot-js/api/issues/5181
    for (const t of testcases) {
        let address = t.address_ss58;
        let data = t.data;
        let wasmContract = await query.getWASMContract(address, chainID);
        let metadata = wasmContract.metadata;
        try {
            const contract = new ContractPromise(api, metadata, address);
            const bytes = hexToU8a(data);
            let result = contract.abi.decodeMessage(compactAddLength(bytes));
            // these are the decoded params!
            let params = result.args.map((a) => {
                return a.toHuman();
            })
            let message = result.message
            let method = message.identifier;
            console.log("TESTCASE", message.identifier, params, "MESSAGE ARGS", message.args);
        } catch (err) {
            console.log(err)
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });