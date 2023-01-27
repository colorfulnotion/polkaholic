let endpoints = [{
        info: 'moonbase-alpha',
        paraId: 1000,
        text: 'Moonbase Alpha',
        providers: {
            MB: 'wss://wss.api.moonbase.moonbeam.network'
        }
    },
    {
        info: 'moonbase-beta',
        paraId: 888,
        text: 'Moonbase Beta',
        providers: {
            MB: 'wss://frag-moonbase-beta-rpc-ws.g.moonbase.moonbeam.network'
        }
    },
    {
        info: 'moonbase-relay',
        paraId: 0,
        text: 'Moonbase Relay',
        providers: {
            MB: 'wss://frag-moonbase-relay-rpc-ws.g.moonbase.moonbeam.network'
        }
    }
];

let result = {};
let relayChain = "moonbase";
endpoints.forEach((e) => {
    //console.log(e);
    let paraID = e.paraId;
    let name = e.text;
    let id = e.info;
    let WSEndpoints = [];
    let chainkey = `${relayChain}-${paraID}`;
    for (const p of Object.keys(e.providers)) {
        let WSEndpoint = e.providers[p];
        WSEndpoints.push(WSEndpoint);
        //console.log(paraID, name, id, WSEndpoint);
    }
    result[chainkey] = {
        chainkey,
        name,
        id,
        paraID,
        WSEndpoints
    }
});
console.log(JSON.stringify(result, null, 4));