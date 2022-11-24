
function showxcminfo(xcmInfo) {
    console.log("xcminfo", xcmInfo);
    try {
	document.getElementById("origination").innerHTML = showOrigination(xcmInfo.origination, xcmInfo.symbol)
    } catch (err) {
	console.log("orig ERR", err);
    }
    try {
	document.getElementById("relayed").innerHTML = showRelayed(xcmInfo.relayChain)
    } catch (err) {
	console.log("rc ERR", err);
    }
    try {
	document.getElementById("destination").innerHTML = showDestination(xcmInfo.destination, xcmInfo.symbol)
    } catch (err) {
	console.log("dest ERR", err);
    }
}

function show_remoteEVMTx_origination(tx) {
    return `
<B>Derived Remote Address:</B> ${presentAddress(tx.from)}<br/>
`
//<b>Details:</b><br/>
//<button type="button" class="btn btn-outline-secondary text-capitalize">${tx.transact.section}:${tx.transact.method}</button><br/>
//<div style="overflow-y: scroll; max-width: 80%; max-height: 300px">${JSONToHTMLTable(tx.transact.args.xcm_transaction)}</div>
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


function showOrigination(origination, symbol) {

    let out = `<h6 class="fw-bold">Origination: ${origination.id}`
    if ( origination.paraID > 0 ) out += `[Para ID: ${origination.paraID}]`;
    out += `</h6>`;
    let finalized = origination.finalized ? true : false;
    let id = origination.id;
    let fin = finalized ? `<b>Finalized:</b> ${presentFinalized(finalized)}` : `<i>Unfinalized</i>  ${presentFinalized(finalized)}`
    let cls = finalized ? 'finalized' : 'unfinalized';
    let txHash = origination.transactionHash ? "<b>Transaction Hash:</b> ${presentTxHash(origination.transactionHash)}<br/>": ""
    out += `<div class='${cls}'>
<i>${timeConverter(origination.ts)}</i><br/>
${fin}<br/>
<b>Extrinsic ID:</b> ${presentExtrinsicIDHash(origination.extrinsicID, origination.extrinsicHash)}<br/> 
<b>Block:</b> ${presentBlockNumber(id, id, origination.blockNumber)} <br/>
<button type="button" class="btn btn-outline-primary text-capitalize">${origination.section}:${origination.method}</button><br>
`
    if ( origination.amountSent ) {
	let usd = origination.amountSentUSD ? currency_format(origination.amountSentUSD) : ""
	out += `<div><b>Amount Sent:</b> ${origination.amountSent} ${symbol} ${usd}</div>`
    }
    if ( origination.sender ) {
	out += `<div><b>Sender:</b> ${presentAddress(origination.sender)}</div>`
    }
    if ( origination.success ) {
	out += show_success(origination.success) 
    }
    if ( origination.txFee ) {
	out += `<div><b>Transaction Fee Paid:</b> ${origination.txFee} ${origination.txFeeSymbol}</div>`
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

function showRelayed(relayChain) {
    if ( relayed == undefined ) {
	return "<h6>Relay Chain: Unknown</h6>"
    }
    let out = `<h6 class="fw-bold">Relay Chain: ${relayChain.relayChain}</h6>`;
    let finalized = ( relayChain.finalized ) ? true : false;
    let fin = finalized ? `<b>Finalized:</b> ${presentFinalized(finalized)}` : `<i>Unfinalized</i> ${presentFinalized(finalized)}`
    let cls = finalized ? 'finalized' : 'unfinalized';
    out += `<B>Sent At:</B> ` + presentBlockNumber(relayChain.relayChain, relayChain.relayChain, relayChain.relayAt);
    return out;
}

function showDestination(destination, symbol)
{
    if ( destination == undefined ) {
	return "unknown";
    }
    let finalized = destination.finalized || destination.unfinalized ? true : false;
    let out = `<h6 class="fw-bold">Destination: ${destination.id}`;
    if ( destination.paraID > 0 ) out += `[Para ID: ${destination.paraID}]`;
    out += `</h6>`
    
    let fin = finalized ? `<b>Finalized:</b> ${presentFinalized(finalized)} Block ` + presentBlockNumber(destination.id, destination.id, destination.blockNumber) : `<i>Unfinalized</i>`
    let cls = finalized ? 'finalized' : 'unfinalized';
    out += `<div class='${cls}'>`
    if ( destination.ts ) {
	out += `<i>${timeConverter(destination.ts)}</i><br/>`
    }
    out += `${fin}<br/>`
    if ( destination.beneficiary ) {
	out += `<div><b>Beneficiary:</b> ${presentAddress(destination.beneficiary)}</div>`
	out += presentAddress();
    }
    if ( destination.amountReceived ) {
	let usd = ( destination.amountReceivedUSD ) ? currency_format(destination.amountReceivedUSD) : "";
	out += `<div>Amount Received:<br/>${destination.amountReceived} ${symbol} ${usd}</div>`
    }
    if ( destination.remoteEVMTx ) {
	out += show_remoteEVMTx_destination(destination.remoteEVMTx, id);
    }
    out += `</div>`;
    return  out
}
