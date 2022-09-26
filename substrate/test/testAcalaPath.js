const paraTool = require("../paraTool");
const {
    Keyring
} = require("@polkadot/api");
const {
    ApiPromise
} = require("@polkadot/api");
const {
    WsProvider
} = require("@polkadot/rpc-provider");
//const { options } = require("@acala-network/api");
const {
    createTestPairs
} = require("@polkadot/keyring/testingPairs");
const {
    hexToU8a,
    isHex,
    stringToU8a,
    u8aToHex,
    hexToString
} = require("@polkadot/util");

const {
    FixedPointNumber,
    Token,
    TokenPair
} = require("@acala-network/sdk-core");
const {
    SwapPromise
} = require("@acala-network/sdk-swap");
const {
    WalletPromise
} = require("@acala-network/sdk-wallet");
const {
    Wallet
} = require('@acala-network/sdk')
const acalaSDK = require("@acala-network/sdk");
const acalaSDKSwap = require("@acala-network/sdk-swap")

async function main() {
    var [chainID] = [22000];
    var api = await ApiPromise.create({
        provider: new WsProvider((chainID == paraTool.chainIDAcala) ? "wss://acala-polkadot.api.onfinality.io/public-ws" : 'wss://karura.api.onfinality.io/public-ws')
    });
    const swapPromise = new SwapPromise(api);
    const wallet = new WalletPromise(api);
    var path, token0, token1;

    var karToken = wallet.getToken("KAR");
    var kusdToken = wallet.getToken("KUSD");
    var ksmToken = wallet.getToken("KSM");
    var lksmToken = wallet.getToken("LKSM");
    var bncToken = wallet.getToken("BNC");
    var vsksmToken = wallet.getToken("VSKSM");
    var phaToken = wallet.getToken("PHA");
    var kintToken = wallet.getToken("KINT");
    var kbtcToken = wallet.getToken("KBTC");
    var taiToken = wallet.getToken("TAI");
    var acaToken = wallet.getToken("ACA");
    var ausdToken = wallet.getToken("AUSD");

    if (chainID == paraTool.chainIDKarura) {
        token0 = karToken;
        token1 = kusdToken;
    } else {
        token0 = acaToken;
        token1 = ausdToken;
    }
    path = [token0, token1];
    let amountIns = [1, 10, 100, 1000]
    for (const amountIn of amountIns) {
        let res = await swapExactIn(api, amountIn, path = ['KAR', 'KUSD'], mode = 'EXACT_INPUT')
        console.log(res)
    }
}

async function swapExactIn(api, amountIn = 1.0, path = ['KAR', 'KUSD'], mode = 'EXACT_INPUT') {
    const swapPromise = new SwapPromise(api);
    const wallet = new WalletPromise(api);
    let tokenPath = []
    for (const p of path) {
        var token = wallet.getToken(p);
        tokenPath.push(token)
    }
    var amountIn = new FixedPointNumber(amountIn, tokenPath[0].decimals);
    var parameters = await swapPromise.swap(tokenPath, amountIn, "EXACT_INPUT")
    let amountOut = parameters.output.balance
    let res = {
        path: path,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        rate: amountIn.toString() / amountOut.toString()
    }
    return res
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });