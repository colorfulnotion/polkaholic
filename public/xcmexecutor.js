
function showxcmexecutor(xcmInfo) {
  document.getElementById("origination").innerHTML = showOrigination(xcmInfo.origination)
  document.getElementById("relayed").innerHTML = showRelayed(xcmInfo.relayed)
  document.getElementById("destination").innerHTML = showDestination(xcmInfo.destination)
}

function show_remoteEVMTx_origination(tx) {
    return `
<B>Derived Remote Address:</B> ${presentAddress(tx.from)}<br/>
`
//<b>Details:</b><br/>
//<button type="button" class="btn btn-outline-secondary text-capitalize">${tx.transact.section}:${tx.transact.method}</button><br/>
//<div style="overflow-y: scroll; max-width: 80%; max-height: 300px">${JSONToHTMLTable(tx.transact.args.xcm_transaction)}</div>
}

function show_origination(o, finalized, blockHash, id) {
    let fin = finalized ? `<b>Finalized:</b> ${presentFinalized(finalized)}` : `<i>Unfinalized</i> <code>${getShortHash(blockHash)}</code> ${presentFinalized(finalized)}`
    let cls = finalized ? 'finalized' : 'unfinalized';
	return `<div class='${cls}'>
<i>${timeConverter(o.ts)}</i> ${fin}<br/>
<b>Extrinsic ID:</b> ${presentExtrinsicIDHash(o.extrinsicID, o.extrinsicHash)}<br/> 
<b>Block:</b> ${presentBlockNumber(id, id, o.blockNumber)} <br/>
<button type="button" class="btn btn-outline-primary text-capitalize">${o.method.pallet}:${o.method.method}</button><br>
<b>Args:</b> 
<div  style="overflow-y: scroll; max-width: 90%; max-height: 300px">${JSONToHTMLTable(o.args)}</div>
</div>
`

}

function show_relayed(o, finalized, blockHash) {
    let fin = finalized ? `<b>Finalized:</b> ${presentFinalized(finalized)}` : `<i>Unfinalized Block Hash</i> <code>${getShortHash(blockHash)}</code> ${presentFinalized(finalized)}`
    let out = "";
    let cls = finalized ? 'finalized' : 'unfinalized';
    for ( const msgHash of Object.keys(o) ) {
	let m = o[msgHash];
	out += `
<div class='${cls}'> 
${fin} <br/>
<b>Message Hash (${m.msgType}):</b> ${presentXCMMessageHash(msgHash, m.includedAt)}<br/>
<b>Relayed At:</b> ${presentBlockNumber(m.relayChain, m.relayChain, m.relayedAt)}<br/>
<b>Included At:</b> ${presentBlockNumber(m.relayChain, m.relayChain, m.includedAt)}</div>`
    }
    return out;
}


function showEVMStatusCode(statusCode) {
    return ( statusCode ) ? `<button type="button" class="btn btn-success">Success</button>` : `<button type="button" class="btn btn-danger">Failure</button>`
}

function show_remoteEVMTx_destination(tx, id) {
  return `<b>Remote EVM Tx Hash:</b> <a href='/tx/${tx.hash}'>${tx.hash}</a><br/>
<b>Block:</b> ${presentBlockNumber(id, id, tx.blockNumber)}<br/>
<b>From:</b> ${presentAddress(tx.from)}<br/>
<b>To:</b> ${presentAddress(tx.to)}<br/>
<b>Remote EVM Execution:</b> ${showEVMStatusCode(tx.statusCode)}<br/>`
}

function show_destination(o, finalized, blockHash, id) {

    console.log("c3pd", o);
    let fin = finalized ? `<b>Finalized:</b> ${presentFinalized(finalized)} Block ${o.blockNumber}` : `<i>Unfinalized Block Hash</i> <code>${getShortHash(blockHash)}</code> ${presentFinalized(finalized)}`
    let cls = finalized ? 'finalized' : 'unfinalized';
    let out = `<div class='${cls}'><i>${timeConverter(o.ts)}</i> ${fin}<br/>`
    if ( o.assetsIssued ) {
	out += show_assetsIssued(o.assetsIssued, id);
    }
    if ( o.remoteEVMTx ) {
	out += show_remoteEVMTx_destination(o.remoteEVMTx, id);
    }
    out += `</div>`;
    return  out
}

function showOrigination(origination) {

    let out = `<h6 class="fw-bold">Origination: moonbase-alpha [Para ID: 1000]</h6>`;


    if ( origination.finalized ) {
	if ( Object.keys(origination.finalized).length > 0 ) {
	    out += show_origination(origination.finalized, true, "finalized", origination.id);
	}
    } else if ( origination.unfinalized ) {
	if ( Object.keys(origination.unfinalized).length > 0 ) {
	    for ( const blockHash of Object.keys(origination.unfinalized) ) {
		out += show_origination(origination.unfinalized[blockHash], false, blockHash, origination.id);
	    }
	}
    } else {
	out += "not received";
    }
    if ( origination.assetsSent ) {
	out += show_assetsSent(origination.assetsSent) 
    }
    if ( origination.beneficary ) {
	out += show_beneficiary(origination.beneficiary) 
    }
    if ( origination.success ) {
	out += show_success(origination.success) 
    }
    if ( origination.transactionFeePaid ) {
	out += show_transactionFeePaid(origination.transactionFeePaid) 
    }
    if ( origination.remoteEVMTx ) {
	out += show_remoteEVMTx_origination(origination.remoteEVMTx, origination.id) 
    }
    return out
}

function show_success(s) {
    if ( s.data.dispatchInfo.weight ) {
	return `<div><B>Weight:</B> ${s.data.dispatchInfo.weight}</div>`
    } else {
	return `<div>Success:${JSONToHTMLTable(s.data)}</div>`
    }
}

function show_transactionFeePaid(s) {
    return `<div><b>Transaction Fee Paid:</b> ${s.data.actualFee}</div>`
}


function show_assetsSent(s) {
    if ( s[0].fun ) {
	return `<div><b>Assets Sent:</b> ${s[0].fun.Fungible}</div>`
    } else {
	return `<div><b>Assets Sent:</b> ${JSONToHTMLTable(s)}</div>`
    }
}

function show_assetsIssued(s) {
    if ( s.totalSupply ) {
	return `<div><b>Assets Received:</b> ${s.totalSupply}</div>`
    } else {
	return `<div>Assets Received:<br/>${JSONToHTMLTable(s)}</div>`
    }
}

function show_beneficiary(s) {
    return `<div>Beneficiary<br/>${s}</div>`
}


function showRelayed(relayed, finalized, blockHash) {
    let out = `<h6 class="fw-bold">Relay Chain: moonbase-relay</h6>`;

    if ( relayed.finalized ) {
	out += show_relayed(relayed.finalized, true, blockHash);
    } else if ( relayed.unfinalized && Object.keys(relayed.unfinalized).length > 0 ) {
	for ( const blockHash of Object.keys(relayed.unfinalized) ) {
	    out += show_relayed(relayed.unfinalized[blockHash], false, blockHash);
	}
    } else {
	out += "not received";
    }
    return out;
}

function showDestination(destination, finalized, blockHash)
{
    let out = `<h6 class="fw-bold">Destination: moonbase-beta [Para ID: 888]</h6>`;


    if ( destination.finalized ) {
	out += show_destination(destination.finalized, true, 'finalized', destination.id);
    } else if ( destination.unfinalized && Object.keys(destination.unfinalized).length > 0 ) {
	for ( const blockHash of Object.keys(destination.unfinalized) ) {
	    out += show_destination(destination.unfinalized[blockHash], false, blockHash, destination.id);
	}
    } else {
	out += "not received";
    }
    return out;
}

