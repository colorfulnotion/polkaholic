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
        // Transfer 
        {
            "extrinsicHash": "0x8a46c728d9d6993a70a08619b2f508d2345e1c686f1e9603d2fc39d4d645591a",
            "address_ss58": "a3kMGnw16gZLbjtKSWrsPJz8BQ2vV5bGfYEVKxowHjiVvbC",
            "data": "0x0001d2473025c560e31b005151ebadbc3e1f14a2af8fa60ed87e2b35fa930523cd3c01b5dc1f4c2d5fb2fb14ea92d824f7d440dd1114df1391fff67f1a7f7803c97fc376b20100000000000000000000000000",
            "codeHash": "0xa498fd3d0073459ddbed3446dea975f001a3a9669814fae694a2201452952ab4"
        }
    ];


    for (const t of testcases) {
        let address = t.address_ss58;
        let data = t.data;
        let wasmContract = await query.getWASMContract(address, chainID);
        let metadata = wasmContract.metadata;
        try {
            const contract = new ContractPromise(api, metadata, address);
            const bytes = hexToU8a(data);
            let result = contract.abi.decodeEvent(bytes); // compactAddLength(bytes));
            let args = result.args;
            let names = result.event.args;
            console.log(names);
            let out = {};
            args.forEach((a, idx) => {
                out[names[idx].name] = a.toHuman();
            })
            let method = result.event.identifier;
            console.log(method, out);
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