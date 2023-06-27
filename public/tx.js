var showtxstatusIntervalId = 0;

function showtxinputdata(inp) {
    let possibleinps = ["txinputdata_default", "txinputdata_utf8", "txinputdata_original"];
    for (const el of possibleinps) {
        let elem = document.getElementById(el);
        if (el == inp) { // show one of txinputdata blocks
            elem.style.display = "block";
        } else { // hide the others
            elem.style.display = "none";
        }
    }
}


function setuptabs(tabs, chain_id, txHash, hash = "#overview") {
    setupapidocs("tx", "", `${chain_id}/${txHash}`);
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = `/tx/${chain_id}/${txHash}`
            console.log("newUrl", newUrl, "chain_id", chain_id, "txHash", txHash);
            //history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#txTab a[href="' + hash + '"]');
    if (triggerEl) mdb.Tab.getInstance(triggerEl).show();
}


function showtxstatus(extrinsicHash) {
    showtxstatusIntervalId = setInterval(function() {
        let url = `${baseURL}/hash/${extrinsicHash}`
        setupapidocs("tx", "", extrinsicHash);
        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(info) {
                console.log("txstatus", url, info);
                let finalized = false;
                let msg = "No";
                if (info.status == "finalized" || info.status == "finalizeddest") {
                    //console.log("DONE");
                    msg = "Yes";
                    if (info.status == "finalizeddest") msg = "Yes, confirmed at Destination chain"
                    finalized = true;
                    clearInterval(showtxstatusIntervalId);
                }
                document.getElementById("status").innerHTML = presentFinalized(finalized) + " " + beautifyCamelCase(msg);
            })
        setupcurrency() // inject currency event listener
    }, 2500);
}

$(document).ready(function() {
    setuptabs(tabs, chainID, txHash, defHash);
});