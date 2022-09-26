// https://github.com/parallel-finance/parallel-js
const {
    ApiPromise,
    options,
    WsProvider,
    Keyring
} = require("@parallel-finance/api")

async function main() {
    var chainID = 2012;
    const api = await ApiPromise.create(options({
        provider: new WsProvider()
    }))
    const [route, amount] = await api.rpc.router.getBestRoute("10000000", 101, 1, true);

    console.log(route, amount);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });