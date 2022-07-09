
function setuptabs(tabs, chain_id, blockNumber, blockHash) {
    setupapidocs("block", "", `${chain_id}/${blockNumber}`);
    for (let i=0; i<tabs.length; i++) {
    	let t = tabs[i];
    	let id = "#" + t.target + "-tab";
    	let tabEl = document.querySelector(id);
    	tabEl.addEventListener('shown.mdb.tab', function(event) {
    	    const hash = $(this).attr("href");
	    let t = blockHash.length > 0 ? '?blockhash=' + blockHash : '';
    	    let newUrl = "/block/" + chain_id + "/" + blockNumber + t + hash;
    	    history.replaceState(null, null, newUrl);
    	})
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#extrinsics";
    if (location.hash) {
    	const urlhash = url.split("#");
    	if ( urlhash.length > 1 ) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#blockTab a[href="' + hash + '"]');
    mdb.Tab.getInstance(triggerEl).show();
}

var showblockstatusIntervalId = 0;

function showblockstatus(blockHash) {
    showblockstatusIntervalId = setInterval(function() {
        let url = `${baseURL}/hash/${blockHash}`
        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(info) {
                console.log("blockstatus", info);
		let msg = "No";
		let finalized = false;
                if (info.status == "finalized") {
		    msg = "Yes"
		    finalized = true;
                    clearInterval(showblockstatusIntervalId);
		    console.log(info.chainID, info.blockNumber);
		    if ( ( info.chainID != undefined ) && ( info.blockNumber != undefined ) ) {
			let chainID =  info.chainID;
			if ( chainID == 2004 || chainID == 22023 || chainID == 2006 || chainID == 2002 || chainID == 22007 ) {
			    let url = '/block/' + chainID + '/' + info.blockNumber + '#evmtxs'
			    console.log(url);
			    window.location.href = url
			}
		    }
                } else if ( info.blockHashFinalized ) {
		    msg = "No - Alternate blockHash finalized " + info.blockHashFinalized
		}
                document.getElementById("status").innerHTML = presentFinalized(finalized) + " " + beautifyCamelCase(msg);
            })
        setupcurrency() // inject currency event listener
    }, 3000);
}

$(document).ready(function() {
    setuptabs(tabs, id, blockNumber, blockHash);
});
