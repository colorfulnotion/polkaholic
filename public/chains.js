var initchains = false;
var initaddresstopn = false;
var chainsTable = null;
var addresstopnTable = null
var refreshIntervalMS = 6100;
var chainsUpdateIntervalId = false;


function filterchains(relaychain = "all") {

    if (relaychain == "kusama" || relaychain == "polkadot") {
        if (chainsTable) chainsTable.column(7).search(relaychain).draw();
        //if (xcmTable) xcmTable.column(8).search(relaychain).draw();
        //if (xcmmessagesTable) xcmmessagesTable.column(1).search(relaychain).draw();
    } else {
        // empty search effectively removes the filter
        if (chainsTable) chainsTable.search('').columns().search('').draw();
        // if (xcmTable) xcmTable.search('').columns().search('').draw();
        // if (xcmmessagesTable) xcmmessagesTable.search('').columns().search('').draw();
    }
}

function stopchains() {
    if (chainsUpdateIntervalId) {
        clearInterval(chainsUpdateIntervalId);
        chainsUpdateIntervalId = false
    }
}

function showchains() {
    if (!chainsUpdateIntervalId) {
        show_chains();
    }
    chainsUpdateIntervalId = setInterval(function() {
        show_chains()
    }, refreshIntervalMS);
}

async function show_chains() {
    let pathParams = 'chains'
    let tableName = '#tablechains'
    if (initchains) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initchains = true;
        chainsTable = $(tableName).DataTable({
            /*
            [0] id
            [1] blocksCovered
            [2] blocksFinalized
            [3] numSignedExtrinsics
            [4] numTransfers
            [5] numEvents
            [6] relayChain
            */
            pageLength: -1,
            lengthMenu: [
                [10, 25, 50, -1],
                [10, 25, 50, "All"]
            ],
            columnDefs: [{
                    "className": "dt-right",
                    "targets": [1, 2, 3, 4, 5, 6]
                },
                {
                    "targets": [7],
                    "visible": false
                }
            ],
            order: [
                [6, "desc"]
            ],
            columns: [{
                    data: 'id',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let subexplorerURL = `https://${row.id}.polkaholic.io`;
                            let links = [`<a href='${subexplorerURL}'>explorer</a>`];
                            if (row.dappURL) {
                                links.push(`<a href='${row.dappURL}' target='_new'>app</a>`);
                            }
                            return presentChain(row.id, row.chainName, row.iconUrl, row.crawlingStatus) + `<div class="explorer">` + links.join(" | ") + `</div>`
                        }
                        return row.chainName;
                    }
                },
                {
                    data: 'blocksCovered',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                let s = "<BR>" + presentTS(row.lastCrawlTS);
                                return presentBlockNumber(row.id, "", row.blocksCovered) + s;
                            } catch {
                                return "-"
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'blocksFinalized',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                let s = "<BR>" + presentTS(row.lastFinalizedTS);
                                return presentBlockNumber(row.id, "", row.blocksFinalized) + s;
                            } catch {
                                return "-"
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'numSignedExtrinsics7d',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentNumber(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'numEvents7d',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentNumber(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'numTransfers7d',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentNumber(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'valueTransfersUSD7d',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return currencyFormat(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'relayChain', //this is the 'hidden' column that we use to supprt filter
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return data;
                        }
                        return data;
                    }
                }
            ]
        });
    }

    $(tableName).on('page.dt', function() {
        stopchains();
    });

    //load data here: warning this function is technically async
    //load data here: warning this function is technically async
    await loadData2(pathParams, tableName, false)
    const selectElement = document.querySelector('#relaychain');
    if (selectElement) {
        setchainfilter(selectElement.value);
    }
}

async function showaddresstopn() {
    let tableName = '#tableaddresstopn'
    if (initaddresstopn) {} else {
        initaddresstopn = true;
        addresstopnTable = $(tableName).DataTable({
            /*
            [0] N
            [1] address
            [2] balanceUSD
            [3] val
            */
            pageLength: 100,
            lengthMenu: [
                [10, 25, 50, 100, -1],
                [10, 25, 50, 100, "All"]
            ],
            columnDefs: [{
                "className": "dt-right",
                "targets": [1, 2, 3]
            }],
            order: [
                [0, "asc"]
            ],
            columns: [{
                    data: 'N',
                    render: function(data, type, row, meta) {
                        let sectionMethod = `${data}:${row.method}`
                        if (type == 'display') {
                            return data;
                        }
                        return data;
                    }
                },
                {
                    data: 'address',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                return presentIDRow(row, "address");
                            } catch (err) {
                                console.log("row.asset", row.asset, err);
                            }
                        } else {
                            try {
                                return data;
                            } catch (err) {
                                return ""
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'balanceUSD',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.balanceUSD !== undefined) {
                                return currencyFormat(data);
                            } else {
                                console.log("missing balanceUSD", row);
                                return "--";
                            }
                        } else {
                            if (row.balanceUSD !== undefined) {
                                return data
                            } else {
                                return 0;
                            }
                        }
                        return;
                    }
                },
                {
                    data: 'val',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (filtertype == "currency") {
                                return currencyFormat(data);
                            } else {
                                return presentNumber(data);
                            }
                        }
                        return data;
                    }
                }
            ]
        });
    }

    //load data here: warning this function is technically async
    const topNElement = document.querySelector('#topN');
    let topN = "balanceUSD"
    if (topNElement) {
        topN = topNElement.value;
    }
    let pathParams = `addresstopn/${topN}`
    await loadData2(pathParams, tableName, false);

    let hdr = topNfilters.filter((f) => (f.filter == topN));

    if (hdr.length == 1) {
        document.getElementById("topnhdr").innerHTML = hdr[0].display;
        filtertype = hdr[0].type;
    }
}

let filtertype = "currency";

function showchainstab(hash) {
    switch (hash) {
        case "#chains":
            setupapidocs("chains", "list");
            showchains();
            break;
        case "#xcmtransfers":
            setupapidocs("xcmtransfers");
            showxcmtransfers();
            break;
        case "#xcmmessages":
            setupapidocs("xcmmessages");
            showxcmmessages();
            break;
        case "#addresstopn":
            setupapidocs("addresstopn");
            showaddresstopn();
            break;
    }
}

function setuptabs(tabs) {

    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = hash;
            setTimeout(() => {
                showchainstab(hash);
            }, 250);
            // TODO: let stopfunc = t.stopfunc; //pause the other tab when we switch?
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#chains";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#chainsTab a[href="' + hash + '"]');
    if (triggerEl) {
        mdb.Tab.getInstance(triggerEl).show();
    } else {
        console.log("missing tab:", hash);
    }
}


function setchainfilter(relaychain) {
    relaychainfilter = relaychain;
    filterchains(relaychainfilter);
}


const selectElement = document.querySelector('#relaychain');
if (selectElement) {
    selectElement.addEventListener('change', (event) => {
        setchainfilter(event.target.value);
    });
}
const topNElement = document.querySelector('#topN');
if (topNElement) {
    topNElement.addEventListener('change', (event) => {
        showaddresstopn();
    });
}

setuptabs(tabs);