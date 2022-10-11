
async function getAPI(chainID) {
    // hardcoded for now...
    let WSEndpoint = null
    if (chainID == 22007 || chainID == "shiden" ) {
	WSEndpoint = "wss://shiden.api.onfinality.io/public-ws";
    }
    if (chainID == 2006 || chainID == "astar" ) {
	WSEndpoint = "wss://astar.api.onfinality.io/public-ws";
    }
    if ( WSEndpoint == null ) return(null);
    const {
        WsProvider,
        ApiPromise
    } = polkadotApi;
    const wsProvider = new WsProvider(WSEndpoint);
    const polkadot = await ApiPromise.create({
        provider: wsProvider
    });
    return polkadot;
}

async function decodeWASMContractsCall(chainID, args, metadata, divID) {
    const api = await getAPI(chainID);
    if ( api == null ) return;
    let address = args.dest.id;
    const { ContractPromise } = polkadotApiContract;
    const {
	hexToU8a,
	compactStripLength,
	compactAddLength
    } = polkadotUtil;
    const contract = new ContractPromise(api, metadata, address);

    let decodedMessage = contract.abi.decodeMessage(compactAddLength(hexToU8a(args.data)));
    let decodedArgs = decodedMessage.args;
    let argsDefs = decodedMessage.message.args;
    let out = `<b>Contract Address:</b> <a href="/wasmcontract/${address}">${address}</a><br/>`;
    out += '<table>';
    for ( let i = 0 ; i < argsDefs.length; i++) {
	let argDef = argsDefs[i];
	let decoded = decodedArgs[i];
	let typ = argDef.type.type;
	let decodedData = decoded.toHuman();
	if ( typ == "AccountId" ) {
	    decodedData = `<a href='/account/${decodedData}'>${decodedData}</a>`
	}
	out += `<tr><th>${argDef.name}</th><td>${argDef.type.displayName}</td><td><i>${typ}</i></td><td><code>${decodedData}</code></td></tr>`;
    }
    out += "</table>";
    document.getElementById(divID).innerHTML = out;
}
