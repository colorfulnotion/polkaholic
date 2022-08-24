function getWSEndpoint(chainID_or_id) {
    let wsEndpoints = [
	{"chainID": 0, id: "polkadot", WSEndpoint: "wss://rpc.polkadot.io"},
	{"chainID": 2, id: "kusama", WSEndpoint: "wss://kusama-rpc.polkadot.io"},
	{"chainID": 2000, id: "acala", WSEndpoint: "wss://acala-rpc-3.aca-api.network/ws"},
	{"chainID": 2012, id: "parallel", WSEndpoint: "wss://parallel.api.onfinality.io/public-ws"},
	{"chainID": 22000, id: "karura", WSEndpoint: " wss://karura-rpc-0.aca-api.network"},
	{"chainID": 2006, id: "astar", WSEndpoint: "wss://rpc.astar.network"},
	{"chainID": 22007, id: "shiden", WSEndpoint: "wss://shiden.api.onfinality.io/public-ws"},
	{"chainID": 2004, id: "moonbeam", WSEndpoint: "wss://wss.api.moonbeam.network"},
    ]
    console.log("getWSEndpoint", chainID_or_id);
    for ( let i = 0; i < wsEndpoints.length; i++) {
	let ws = wsEndpoints[i];
	if ( ws.chainID == chainID_or_id || ws.id == chainID_or_id ) {
	    return ws.WSEndpoint;
	}
    }
    return null;
}

async function getAPI(chainID_or_id) {
    let WSEndpoint = getWSEndpoint(chainID_or_id)
    if ( ! WSEndpoint ) return(null);
    const wsProvider = await new window.api.WsProvider(WSEndpoint);
    await wsProvider.isReady;
    
    // connect API
    let myapi = await window.api.ApiPromise.create({
        provider: wsProvider
    });
    await myapi.isReady;
    return myapi;
}

async function verifyXCMMessage(xcm) {
    let chainID = xcm.chainID;
    let blockNumberOutgoing = xcm.blockNumberOutgoing;
    let msgHash = xcm.msgHash;
    
    let chainIDDest = xcm.chainIDDest;
    let executedEventID = xcm.executedEventID;

    console.log("verifyXCMMessage", chainID, blockNumberOutgoing, msgHash, chainIDDest, executedEventID, xcm)
    let chainIDapi = await getAPI(chainID);
    if ( ! chainIDapi ) {
	console.log("could not getAPI of sending chain", chainID);
	return(false);
    }
    // TODO: fetch blockNumberOutgoing, find msgHash, decode XCM message
    let chainIDDestapi = await getAPI(chainIDDest);
    if ( ! chainIDDestapi ) {
	console.log("could not getAPI of dest chain", chainIDDest);
	return(false);
    }
    // TODO: get block out of executedEventID to find block, check for event
}


async function verifyBlock(id, blockNumber, params) {
    let myapi = await getAPI(id);
    if ( ! myapi ) return(null); // TODO: provide notification
    try {
        let header = await myapi.rpc.chain.getBlockHash(blockNumber);
        let blockHash = header.toHex();
        const signedBlock = await myapi.rpc.chain.getBlock(blockHash);
        let block = signedBlock.block;
	console.log(block.toHuman());
	// TODO: check that params match
    } catch (err) {
	console.log(err)
    }
}

async function verifyEvent(id, blockNumber, eventID, params) {
    let ida = eventID.split("-");
    let chainID, eventNo, myapi = null;
    console.log("verifyEvent", eventID);
    if ( ida.length == 4 ) {
	chainID = parseInt(ida[0], 10);
	blockNumber = parseInt(ida[1], 10);
	eventNo = parseInt(ida[3], 10);
	myapi = await getAPI(chainID);
    } else if ( ida.length == 2 ) {
	eventNo = parseInt(ida[1], 10);
	myapi = await getAPI(id);
    }
    
    if ( ! myapi ) return(null); // TODO: provide notification
    try {
        let header = await myapi.rpc.chain.getBlockHash(blockNumber);
        let blockHash = header.toHex();
        const signedBlock = await myapi.rpc.chain.getBlock(blockHash);
        let block = signedBlock.block;
        let eventsRaw = await myapi.query.system.events.at(blockHash);
        let e = eventsRaw[eventNo];
	let event = e.event;
	console.log(event.toHuman());
	console.log(event.toJSON());
	// TODO: check that the event parameters match
    } catch (err) {
	console.log(err)
    }
}

async function verifyExtrinsic(id, blockNumber, extrinsicID, extrinsicHash, params) {
    let myapi = await getAPI(id);
    if ( ! myapi ) {
	// TODO: provide notification
	console.log("unable to get API for", id);
	return(null);
    }
    try {
        let header = await myapi.rpc.chain.getBlockHash(blockNumber);
        let blockHash = header.toHex();
        const signedBlock = await myapi.rpc.chain.getBlock(blockHash);
        let block = signedBlock.block;
	let ida = extrinsicID.split("-");
	let extrinsicNo = parseInt(ida[1], 10);
        let ex = block.extrinsics[extrinsicNo];
        let exj = ex.method.toJSON();
        let exh = ex.method.toHuman()
	console.log(exj, exh);
	// TODO: check that the extrinsic params match
    } catch (err) {
	console.log(err)
    }
}

async function verifyAccount(id, address = "121Rs6fKm8nguHnvPfG1Cq3ctFuNAVZGRmghwkJwHpKxKjbx") {
    let myapi = await getAPI(id);
    if ( ! myapi ) {
	// TODO: provide notification
	console.log("unable to get API for", id);
	return(null);
    }
    try {
	let result = await myapi.query.system.account(address);
	let data = result.data;
	console.log("free toString", data.free.toString());
	console.log("free toHuman", data.free.toHuman());
	console.log("free toJSON", data.free.toJSON());
	// TODO: check that the account params match
    } catch (err) {
	console.log(err)
    }
}
