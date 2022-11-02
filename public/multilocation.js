function get_chain(chainID)
{
    for ( let x = 0; x < chains.length; x++) {
	if ( chains[x].chainID == chainID ) {
	    return chains[x];
	}
    }
    return(null);
}

async function getAPI(chainID) {
    const {
        WsProvider,
        ApiPromise,
    } = polkadotApi;
    const {
	Keyring
    } = polkadotKeyring;
    
    let wsEndpoints = {
        60000: "wss://moonbase-internal.polkaholic.io",
        60888: "wss://moonbase-beta-internal.polkaholic.io",
        61000: "wss://moonbase-internal.polkaholic.io"
    }
    let wssEndpoint = wsEndpoints[chainID];
    if (wssEndpoint == undefined) {
        console.log("No API Endpoint for chainID", chainID);
        return (null);
    }
    console.log("Connecting to chainID", chainID, wssEndpoint);
    
    var api = await ApiPromise.create({
        provider: new WsProvider(wssEndpoint)
    });
    await api.isReady;
    return api;
}

function make_multilocation(paraID = null, address = null, namedNetwork = 'Any') {
    const named = (namedNetwork != 'Any') ? {
        Named: namedNetwork
    } : namedNetwork;
    const account = address.length === 42 ? {
        AccountKey20: {
            network: named,
            key: address
        }
    } : {
        AccountId32: {
            network: named,
            id: polkadotUtil.u8aToHex(polkadotUtilCrypto.decodeAddress(address))
        }
    };
    // make a multilocation object
    let interior = {
        here: null
    }
    if (paraID && account) {
        interior = {
            X2: [{
                Parachain: paraID
            }, account]
        }
    }
    return {
        parents: 1,
        interior: interior
    }
}

// Converts a given MultiLocation into a 20/32 byte accountID by hashing with blake2_256 and taking the first 20/32 bytes
async function calculateMultilocationDerivative(paraID = null, address = null, namedNetwork = 'Any') {
    var api = await getAPI(61000);
    let multilocationStruct = make_multilocation(paraID, address, namedNetwork)
    const multilocation = api.createType('XcmV1MultiLocation', multilocationStruct)
    const toHash = new Uint8Array([
        ...new Uint8Array([32]),
        ...new TextEncoder().encode('multiloc'),
        ...multilocation.toU8a(),
    ]);
    

    const DescendOriginAddress20 = polkadotUtil.u8aToHex(api.registry.hash(toHash).slice(0, 20));
    const DescendOriginAddress32 = polkadotUtil.u8aToHex(api.registry.hash(toHash).slice(0, 32));
    //console.log("calculateMultilocationDerivative", multilocation.toString(), DescendOriginAddress20, DescendOriginAddress32);
    // multilocation {"parents":1,"interior":{"x2":[{"parachain":1000},{"accountKey20":{"network":{"any":null},"key":"0x44236223ab4291b93eed10e4b511b37a398dee55"}}]}}
    // 20 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45c
    // 32 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45cdfa7831175e442b8f14391aa
    return [DescendOriginAddress20, DescendOriginAddress32]
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



