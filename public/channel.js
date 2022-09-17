var initxcmassetlog = false;
var tableXCMAssetlog = null;

async function showxcmassetlog(f) {
    if (initxcmassetlog) return;
    else initxcmassetlog = true;
    
    let chainID = f.chainID;
    let chainIDDest = f.chainIDDest;
    let symbol = f.symbol;
    let pathParams = `xcmassetlog/${chainID}/${chainIDDest}/${symbol}`;
    let tableName = '#tablexcmassetlog'
    tableXCMAssetlog = $(tableName).DataTable({
        order: [
            [1, "desc"],
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [1]
        }, {
            "className": "dt-left",
            "targets": [2]
        }],
        columns: [{
            data: 'symbol',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return `<a href='/symbol/${data}'>${data}</a>`; 
                } else {
                    return 0;
                }
            }
        }, {
            data: 'logDT',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'numXCMTransfersOutgoingUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'valXCMTransferOutgoingUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }]
    });
    await loadData2(pathParams, tableName, true)
    const selectElement = document.querySelector('#relaychain');
    if (selectElement) {
        setchainfilter(selectElement.value);
    }
}


function showchanneltab(hash) {
    switch (hash) {
    case "#xcmassetlog":
        showxcmassetlog({ chainID, chainIDDest, symbol });
	setupapidocs("channel", "");
        break;
    case "#xcmmessages":
        showxcmmessages({ chainID, chainIDDest, symbol });
	setupapidocs("xcmmessages", "");
        break;
    }
}

function setuptabs(tabs, chainID, chainIDDest, symbol) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = `/channel/${chainID}/${chainIDDest}/${symbol}`;
            setTimeout(() => {
                showchanneltab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#xcmassetlog";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }

    const triggerEl = document.querySelector('#channelTab a[href="' + hash + '"]');
    if (triggerEl) {
        mdb.Tab.getInstance(triggerEl).show();
    }
}

setuptabs(tabs, chainID, chainIDDest, symbol);
