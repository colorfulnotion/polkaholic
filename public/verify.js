function getWSEndpoint(chainID_or_id, wsEndpoints) {
    for ( let i = 0; i < wsEndpoints.length; i++) {
	let ws = wsEndpoints[i];
	if ( ws.chainID == chainID_or_id || ws.id == chainID_or_id ) {
	    console.log(`getWSEndpoint(${chainID_or_id})=`, ws.WSEndpoint);
	    return ws.WSEndpoint;
	}
    }
    return null;
}

async function getAPI(chainID_or_id) {
    // global var wsEndpoints
    let WSEndpoint = getWSEndpoint(chainID_or_id, wsEndpoints)
    if ( ! WSEndpoint ) return(null);
    
    const wsProvider = await new window.api.WsProvider(WSEndpoint);
    await wsProvider.isReady;
    
    // connect API
    let myapi = await window.api.ApiPromise.create({
        provider: wsProvider
    });
    await myapi.isReady;
    return [myapi, WSEndpoint];
}

async function verifyXCMMessage(xcm) {
    let chainID = xcm.chainID;
    let blockNumberOutgoing = xcm.blockNumberOutgoing;
    let msgHash = xcm.msgHash;
    
    let chainIDDest = xcm.chainIDDest;
    let executedEventID = xcm.executedEventID;

    console.log("verifyXCMMessage", chainID, blockNumberOutgoing, msgHash, chainIDDest, executedEventID, xcm)
    let [chainIDapi, WSEndpoint] = await getAPI(chainID);
    if ( ! chainIDapi ) {
	console.log("could not getAPI of sending chain", chainID);
	return(false);
    }
    // TODO: fetch blockNumberOutgoing, find msgHash, decode XCM message
    let [chainIDDestapi, WSEndpoint2] = await getAPI(chainIDDest);
    if ( ! chainIDDestapi ) {
	console.log("could not getAPI of dest chain", chainIDDest);
	return(false);
    }
    // TODO: get block out of executedEventID to find block, check for event
}


async function verifyBlock(id, blockNumber, params) {
    updateStatus("connecting to Polkadot API Endpoint...");
    let [myapi, WSEndpoint] = await getAPI(id);
    if ( ! myapi ) {
	updateStatus("failed to connect");
	return(null); 
    }
    updateStatus("connected to Polkadot API Endpoint: " + WSEndpoint)
    try {
        let header = await myapi.rpc.chain.getBlockHash(blockNumber);
        let blockHash = header.toHex();
        const signedBlock = await myapi.rpc.chain.getBlock(blockHash);
        let block = signedBlock.block;
	let hdrj = block.header.toJSON();
	let hdrh = block.header.toHuman();
	console.log("json", hdrj);
	console.log("human", hdrh);
	console.log("params", params);
	document.getElementById("live").value = JSON.stringify(hdrj);

	//  check that the event parameters match
	let success = true;
	let str = "<table><tr><th>Match?</th><th>On chain Result</th><th>Indexed Result</th></tr>";
	for ( const k of Object.keys(hdrj) ) {
	    let actual = hdrj[k];
	    let indexed = params[k];
	    let actual_k = JSON.stringify(actual);
	    let indexed_k = JSON.stringify(indexed);
	    let matched = ( actual_k == indexed_k )
	    let matchedIcon = presentSuccessFailure(matched);
	    str += `<tr><th>${matchedIcon} ${k}</th><td>${actual_k}</td><td>${indexed_k}</td></tr>`;
	    if ( ! matched ) success = false;
	}
	str += "</table>";
	if ( success ) {
	    str += `<div class="alert" role="alert" data-mdb-color="success">` + presentSuccessFailure(success) + ` Verified!  Indexed result and On chain result are the same</div>`;
	} else {
	    str += `<div class="alert" role="alert" data-mdb-color="danger">` + presentSuccessFailure(success) + ` Failure!   Indexed result and On chain result are <u>NOT</u> the same!</div>`;
	}
	document.getElementById("comparison").innerHTML = str;

	/*
        try {
	    let bh0 = myapi.createType("BlockHash", blockHash);
	    let proof = await myapi.rpc.grandpa.proveFinality(bh0, bh0);
	} catch (err ) {
	    console.log(err)
	}
	*/
    } catch (err) {
	console.log(err)
    }
}

async function verifyEvent(id, blockNumber, eventID, params) {
    let ida = eventID.split("-");
    let chainID, eventNo, myapi = null, WSEndpoint;
    updateStatus("connecting to Polkadot API...")
    console.log("verifyEvent", eventID);
    if ( ida.length == 4 ) {
	chainID = parseInt(ida[0], 10);
	blockNumber = parseInt(ida[1], 10);
	eventNo = parseInt(ida[3], 10);
	[myapi, WSEndpoint] = await getAPI(chainID);
    } else if ( ida.length == 2 ) {
	eventNo = parseInt(ida[1], 10);
	[myapi, WSEndpoint] = await getAPI(id);
    }
    
    if ( ! myapi ) {
	updateStatus("failed to connect");
	return(null);
    }
    updateStatus("connected to Polkadot API Endpoint: " + WSEndpoint)
    try {
        let header = await myapi.rpc.chain.getBlockHash(blockNumber);
        let blockHash = header.toHex();
        const signedBlock = await myapi.rpc.chain.getBlock(blockHash);
        let block = signedBlock.block;
        let eventsRaw = await myapi.query.system.events.at(blockHash);
        let e = eventsRaw[eventNo];
	let event = e.event;
	let exh = event.toHuman();
	let exj = event.toJSON();
	console.log("event.toJSON():", exj);
	console.log("event.toHuman():", exh);
	document.getElementById("live").value = JSON.stringify(exj);
	//  check that the event parameters match
	let success = true;
	let actualArray = exj.data;
	let str = "<table><tr><th>Match?</th><th>On chain Result</th><th>Indexed Result</th></tr>";
	for ( let k = 0 ; k < actualArray.length; k++ ) {
	    let actual = actualArray[k];
	    let indexed = params[k].data;
	    let actual_k = JSON.stringify(actual);
	    let indexed_k = JSON.stringify(indexed);
	    let matched = ( actual_k == indexed_k )
	    let matchedIcon = presentSuccessFailure(matched);
	    str += `<tr><th>${matchedIcon}${k}</th><td>${actual_k}</td><td>${indexed_k}</td></tr>`;
	    if ( ! matched ) success = false;
	}
	str += "</table>";
	if ( success ) {
	    str += `<div class="alert" role="alert" data-mdb-color="success">` + presentSuccessFailure(success) + ` Verified!  Indexed result and On chain result are the same</div>`;
	} else {
	    str += `<div class="alert" role="alert" data-mdb-color="danger">` + presentSuccessFailure(success) + ` Failure!   Indexed result and On chain result are <u>NOT</u> the same!</div>`;
	}
	document.getElementById("comparison").innerHTML = str;
    } catch (err) {
	console.log(err)
    }
}

function updateStatus(str) {
    let element = document.getElementById("status");
    if ( element ) {
	element.innerHTML = str;
    } else {
	console.log("could not find status", str);
    }
}

async function verifyExtrinsic(id, extrinsicID, extrinsicHash, params, live = "live") {
    updateStatus("connecting to Polkadot API...")
    let [myapi, WSEndpoint] = await getAPI(id);
    if ( ! myapi ) {
	updateStatus("failed to connect");
	return(null);
    }
    updateStatus(`connected to ${WSEndpoint}`)
    try {
	let ida = extrinsicID.split("-");
	let blockNumber = parseInt(ida[0], 10);
	let extrinsicNo = parseInt(ida[1], 10);
	
        let header = await myapi.rpc.chain.getBlockHash(blockNumber);
        let blockHash = header.toHex();
        const signedBlock = await myapi.rpc.chain.getBlock(blockHash);
        let block = signedBlock.block;
        let ex = block.extrinsics[extrinsicNo];
        let exj = ex.method.toJSON();
        let exh = ex.method.toHuman()
	console.log("extrinsic toJSON", exj);
	console.log("extrinsic toHuman", exh);
	document.getElementById(live).value = JSON.stringify(exj.args);
	// check that the extrinsic params match
	let success = true;
	let str = "<table><tr><th>Match?</th><th>On chain Result</th><th>Indexed Result</th></tr>";
	for ( const k of Object.keys(exj.args) ) {
	    let actual = exj.args[k];
	    let indexed = params[k];
	    let actual_k = JSON.stringify(actual);
	    let indexed_k = JSON.stringify(indexed);
	    let matched = ( actual_k == indexed_k )
	    if ( ! matched && ( typeof actual == "object" ) && typeof indexed == "object" && actual != null && indexed != null ) {
		// check that all the attributes of actual_k are inside indexed_k
		let matches1 = 0, matches0 = 0;
		for ( const k0 of Object.keys(actual) ) {
		    if ( JSON.stringify(indexed[k0]) == JSON.stringify(actual[k0]) ) {
			console.log("matched 1:", k0);
			matches1++;
		    } else {
			console.log("matched 0:", k0);
			matches0++;
		    }
		}
		if ( matches1 > 0 && matches0 == 0 ) {
		    matched = true;
		}
	    }
	    let matchedIcon = presentSuccessFailure(matched)
	    str += `<tr><td>${matchedIcon}${k}</th><td>${actual_k}</td><td>${indexed_k}</td></tr>`;
	    if ( ! matched ) success = false;
	}
	str += "</table>";

	if ( success ) {
	    str += `<div class="alert" role="alert" data-mdb-color="success">` + presentSuccessFailure(true) + ` Verified!  Indexed result and On chain result are the same</div>`;
	    ;
	} else {
	    str += `<div class="alert" role="alert" data-mdb-color="danger">` + presentSuccessFailure(false) + ` Failure!   Indexed result and On chain result are <u>NOT</u> the same!</div>`;
	}
	document.getElementById("comparison").innerHTML = str;
    } catch (err) {
	console.log(err)
    }
}

function matchnumbers(n0, n1float) {
    let n0str = n0.toString();
    let n1str = n1float.toString().replace(".", "");
    return n0str == n1str;
}

async function verifyAccount(id, address = "121Rs6fKm8nguHnvPfG1Cq3ctFuNAVZGRmghwkJwHpKxKjbx", params = null) {
    updateStatus("connecting to Polkadot API...")
    let [myapi, WSEndpoint] = await getAPI(id);
    if ( ! myapi ) {
	// TODO: provide notification
	console.log("unable to get API for", id);
	return(null);
    }
    updateStatus(`connected to ${WSEndpoint}`)
    try {
	let result = await myapi.query.system.account(address);
	let data = result.data;
	let datajson = data.toJSON();
	let datahuman = data.toHuman();
	console.log("data.toJSON()", datajson);
	console.log("params", params);
	// check that the account params match
	let success = true;
	let str = "<table><tr><th>Match?</th><th>On chain Result</th><th>Indexed Result</th></tr>";
	for ( const k of Object.keys(datajson) ) {
	    let actual = datajson[k];
	    let indexed = params[k];
	    let actual_k = JSON.stringify(actual);
	    let indexed_k = JSON.stringify(indexed);
	    let matched = matchnumbers( actual_k,indexed_k );  // because the API doesn't return things divided by 10**decimals
	    let matchedIcon = presentSuccessFailure(matched)
	    str += `<tr><td>${matchedIcon}${k}</th><td>${actual_k}</td><td>${indexed_k}</td></tr>`;
	    if ( ! matched ) success = false;
	}
	str += "</table>";

	if ( success ) {
	    str += `<div class="alert" role="alert" data-mdb-color="success">` + presentSuccessFailure(true) + ` Verified!  Indexed result and On chain result are the same</div>`;
	} else {
	    str += `<div class="alert" role="alert" data-mdb-color="danger">` + presentSuccessFailure(false) + ` Failure!   Indexed result and On chain result are <u>NOT</u> the same!</div>`;
	}
	document.getElementById("comparison").innerHTML = str;
    } catch (err) {
	console.log(err)
    }
}
