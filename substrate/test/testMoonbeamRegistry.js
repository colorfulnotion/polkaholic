// node testDecodeBlock.js

async function main() {
    const {
        ApiPromise,
        WsProvider
    } = require('@polkadot/api');
    const paraTool = require("./paraTool");
    var [chainID, blockNumber, blockHash] = [22023, 1325210, "0xa70a75c54a457a823f1a5492a39049869de880ad64486eae5bdf60f5403f6354"];
    var api = await ApiPromise.create({
        provider: new WsProvider((chainID == paraTool.chainIDMoonbeam) ? "wss://wss.moonriver.moonbeam.network" : 'wss://moonriver.api.onfinality.io/public-ws') //wss://kusama-rpc.polkadot.io
    });
    await api.isReady;

    var a = await api.query.assetManager.assetIdType.entries()
    var assetList = {}
    for (let i = 0; i < a.length; i++) {
        let key = a[i][0];
        let val = a[i][1];
        let assetID = cleanedAssetID(key.args.map((k) => k.toHuman())[0]) //input: assetIDWithComma
        //let assetID = key.args.map((k) => k.toHuman())[0] //input: assetIDWithComma
        let xcmAsset = val.toJSON().xcm
        let parents = xcmAsset.parents
        let interior = xcmAsset.interior
        //x1/x2/x3 refers to the number to params
        let interiorK = Object.keys(interior)[0]
        let interiorV = JSON.stringify(interior[interiorK])
        if (interiorK == 'here' && interior[interiorK] == null) {
            interiorV = 'here'
        }

        /*
        {"Token":"42259045809535163221576417993425387648"} { parents: 1, interior: { here: null } }
        {"Token":"189307976387032586987344677431204943363"} { parents: 1, interior: { x1: { parachain: 2004 } } }
        {"Token":"105075627293246237499203909093923548958"} { parents: 1, interior: { x2: [ [Object], [Object] ] } }
        {"Token":"311091173110107856861649819128533077277"} { parents: 1, interior: { x3: [ [Object], [Object], [Object] ] } }
        */
        let parsedAsset = {
            Token: assetID
        }
        var asset = JSON.stringify(parsedAsset);
        console.log(`${asset} [${interiorK}]`, interiorV)
    }

}

function cleanedAssetID(assetID) {
    let rawAssetID = paraTool.toNumWithoutComma(assetID)
    return rawAssetID
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });