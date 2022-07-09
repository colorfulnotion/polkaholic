var showtxstatusIntervalId = 0;

function showtxstatus(extrinsicHash) {
    showtxstatusIntervalId = setInterval(function() {
        let url = `${baseURL}/hash/${extrinsicHash}`
        setupapidocs("tx", "", extrinsicHash);
        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(info) {
                //console.log("txstatus", info);
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