var initchains = false;
var initaddresstopn = false;
var chainsTable = null;
var addresstopnTable = null
var refreshIntervalMS = 6100;
var chainsUpdateIntervalId = false;



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

function get_accountBalanceOnChain(chainID, assetChain) {
    try {
        let balanceUSD = 0;
        for (let a = 0; a < accounts.length; a++) {
            let account = accounts[a];
            if (account.chains) {
                for (let i = 0; i < account.chains.length; i++) {
                    let c = account.chains[i];
                    if (c.chainID == chainID) {
                        for (let j = 0; j < c.assets.length; j++) {
                            let a = c.assets[j];
                            if (a.state.balanceUSD > 0) {
                                //console.log(a);
                                balanceUSD += a.state.balanceUSD;
                            }
                        }
                    }
                }
            }
        }
        return balanceUSD;
    } catch (err) {
        console.log(err);
    }
    return 0;
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
            [4] numXCMTransfersIn
            [5] numXCMTransfersOut
            [6] relayChain
            */
            pageLength: -1,
            lengthMenu: [
                [10, 25, 50, -1],
                [10, 25, 50, "All"]
            ],
            columnDefs: [{
                "className": "dt-right",
                "targets": [2, 3, 4, 5, 6, 7]
            }, {
                "targets": [8],
                "visible": false
            }],
            order: [
                [2, "desc"],
                [5, "desc"],
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
            }, {
                data: 'priceUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            // show symbol + price (linking to /symbol/:symbol)
                            let symbol = row.symbol;
                            return `<a href='/symbol/${symbol}'>${symbol}</a> ` + currencyFormat(row.priceUSD);
                        } catch {

                            return "-"
                        }
                    }
                    return data;
                }
            }, {
                data: 'balanceUSD',
                render: function(data, type, row, meta) {
                    try {
                        // show account holdings summary on chain (linking to /chain/:chain#assets)
                        let balanceUSD = get_accountBalanceOnChain(row.chainID);
                        if (type == 'display') {
                            if (balanceUSD == null) {
                                return "-Connect Wallet-";
                            }
                            let url = `/chain/${row.chainID}#xcmassets`;
                            return `<a href="${url}">` + currencyFormat(balanceUSD) + "</a>";
                        } else {
                            if (balanceUSD == null) return 0;
                            return balanceUSD;
                        }
                    } catch {
                        return "-"
                    }
                    return 0;
                }
            }, {
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
            }, {
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
            }, {
                data: 'numAccountsActive7d',
                render: function(data, type, row, meta) {
                    try {
                        if (type == 'display') {
                            let url = `chain/${row.id}#chainlog`
                            return `<a href="${url}">` + presentNumber(data) + "</a>";
                        }
                        return data;
                    } catch {
                        return "-"
                    }
                }
            }, {
                data: 'numXCMTransferIncoming7d',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let url = `chain/${row.id}#xcmtransfers`
                        return `<a href="${url}">` + presentNumber(data) + " " + currencyFormat(row.valXCMTransferIncomingUSD7d) + "</a>";
                    } else {
                        return row.valXCMTransferIncomingUSD7d;
                    }
                }
            }, {
                data: 'numXCMTransferOutgoing7d',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let url = `chain/${row.id}#xcmtransfers`
                        return `<a href="${url}">` + presentNumber(data) + " " + currencyFormat(row.valXCMTransferOutgoingUSD7d) + "</a>";
                    }
                    return row.valXCMTransferOutgoingUSD7d;
                }
            }, {
                data: 'relayChain', //this is the 'hidden' column that we use to supprt filter
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return data;
                    }
                    return data;
                }
            }]
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
            }, {
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
            }, {
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
            }, {
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
            }]
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
        case "#xcmassets":
            setupapidocs("chains", "list");
            showxcmassets(null);
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
        console.log("SHOWING", hash);
        mdb.Tab.getInstance(triggerEl).show();
    } else {
        console.log("missing tab:", hash);
    }
}


const topNElement = document.querySelector('#topN');
if (topNElement) {
    topNElement.addEventListener('change', (event) => {
        showaddresstopn();
    });
}

setuptabs(tabs);