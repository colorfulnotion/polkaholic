//const Crawler = require("./crawler");
//    var crawler = new Crawler();

const {
    ApiPromise,
    WsProvider
} = require('@polkadot/api');
let api = await ApiPromise.create({
    provider: new WsProvider('wss://rpc.polkadot.io')
});
await api.isReady;

var apiAt = await api.at('0xa70a75c54a457a823f1a5492a39049869de880ad64486eae5bdf60f5403f6354');

// registry decorated at this point
console.log(apiAt.registry);

// api will also decode any blocks or storage, etc. at that index with the registry retrieved via at, e.g.
// this uses apiAt internally to retrieve an instance and uses it for decoding
var block = await apiAt.rpc.chain.getBlock(blockHash)

// registry decorated for the blockHash (exposed on the value)
console.log(block.registry);