function get_chain(chainID)
{
    for ( let x = 0; x < chains.length; x++) {
	if ( chains[x].chainID == chainID ) {
	    return chains[x];
	}
    }
    return(null);
}

function showmultilocationasset(a, relayChain) {
    try {
	document.getElementById('symbol').innerHTML = a.symbol ? a.symbol : "Not available";
	document.getElementById('decimals').innerHTML = a.decimals ? a.decimals : "Not available";
	document.getElementById('xcmInteriorKey').value = a.xcmInteriorKey;
	document.getElementById('xcmV1MultiLocation').value = JSON.stringify(a.xcmV1MultiLocation);
	document.getElementById('evmMultiLocation').value = JSON.stringify(a.evmMultiLocation);
	let xc20arr = []
	for (const [chainID, xc20] of Object.entries(a.xcContractAddress)) {
	    let c = get_chain(chainID);
	    let id = c && c.id ? c.id : `Chain ${chainID}`
	    let chainName = c && c.chainName ? c.chainName : id
	    let iconUrl = c && c.iconUrl ? c.iconUrl : false
	    xc20arr.push(presentChain(id, chainName, iconUrl) + ": " + presentAddress(xc20, chainID, true))
	    
	}
	document.getElementById('xc20').innerHTML = ( xc20arr.length ) ? xc20arr.join("<BR>") : "None";
	
	let xcCurrencyIDarr = []
	for (const [chainID, currencyID] of Object.entries(a.xcCurrencyID)) {
	    let c = get_chain(chainID);
	    let chainName = c && c.chainName ? c.chainName : ""
	    let id = c && c.id ? c.id : ""
	    let iconUrl = c && c.iconUrl ? c.iconUrl : false
	    xcCurrencyIDarr.push( presentChain(id, chainName, iconUrl) +  ": " + presentCurrencyID(currencyID, chainID))
	}
	document.getElementById('currencyid').innerHTML = ( xcCurrencyIDarr.length ) ? xcCurrencyIDarr.join("<BR>") : "None";
    } catch (err) {
	console.log(err);
    }
}

async function showmultilocation(chainID, relayChain) {
    let endpoint = `${baseURL}/xcm/multilocation/${chainID}`
    var req = new Request(endpoint, {
        method: 'GET',
        headers: new Headers({
            "Content-Type": "application/json"
        })
    });

    let fetchRes = await fetch(req)
        .then((response) => response.json())
        .then(async (data) => {
            try {
		let id = "symbols";
		$(`#${id}`).empty();
		let element = document.getElementById("symbols");
		$(`#${id}`).on('change', function(e) {
		    let v = $(`#${id}`).find(":selected").val();
		    for ( const x of data ) {
			if ( x.xcmInteriorKey == v ) {
			    showmultilocationasset(x, relayChain);
			    break;
			}
		    }
		})
		// pick the first one
		for ( const x of data ) {
		    showmultilocationasset(x, relayChain);
		    break;
		}
		data.map( (s) => {
		    var option = document.createElement("option");
		    if (s.symbol) {
			option.text = s.symbol;
			option.value = s.xcmInteriorKey;
		    } else {
			option.text = s.xcmInteriorKey;
			option.value = s.xcmInteriorKey;
		    }
		    if ( element && s.xcmInteriorKey ) {
			element.add(option);
		    }
		})
            } catch (err) {
                console.log(err);
            }
        })

}



