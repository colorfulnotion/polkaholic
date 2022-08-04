var initchains = false;
var initxcmtransfers = false;
var initaddresstopn = false;
var chainsTable = null;
var xcmTable = null
var xcmmessagesTable = null
var addresstopnTable = null
var refreshIntervalMS = 6100;
var chainsUpdateIntervalId = false;
var xcmtransferUpdateIntervalId = false;



function filterchains(relaychain = "all") {

    if (relaychain == "kusama" || relaychain == "polkadot") {
        if (chainsTable) chainsTable.column(7).search(relaychain).draw();
        if (xcmTable) xcmTable.column(8).search(relaychain).draw();
        if (xcmmessagesTable) xcmmessagesTable.column(1).search(relaychain).draw();
    } else {
        // empty search effectively removes the filter
        if (chainsTable) chainsTable.search('').columns().search('').draw();
        if (xcmTable) xcmTable.search('').columns().search('').draw();
        if (xcmmessagesTable) xcmmessagesTable.search('').columns().search('').draw();
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

function stopxcmtransfers() {
    if (xcmtransferUpdateIntervalId) {
        clearInterval(xcmtransferUpdateIntervalId);
        xcmtransferUpdateIntervalId = false
    }
}

function showxcmtransfers() {
    if (!xcmtransferUpdateIntervalId) {
        show_xcmtransfers();
    }
    xcmtransferUpdateIntervalId = setInterval(function() {
        show_xcmtransfers()
    }, refreshIntervalMS);
}

async function show_xcmtransfers(relaychain) {
    let pathParams = 'xcmtransfers'
    let tableName = '#tablexcmtransfers'
    if (initxcmtransfers) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initxcmtransfers = true;
        xcmTable = $(tableName).DataTable({
            /*
            [0] section (+method)
            [1] amountSent (+symbol)
            [2] amountSentUSD
            [3] fromAddress
            [4] destAddress
            [5] id (+chainName)
            [6] chainIDDest (+chainDestName)
            [7] sourceTS
            [8] relayChain
            */
            pageLength: 100,
            lengthMenu: [
                [10, 25, 50, 100],
                [10, 25, 50, 100]
            ],
            columnDefs: [{
                    "className": "dt-right",
                    "targets": [1, 2, 3]
                },
                {
                    "targets": [8],
                    "visible": false
                }
            ],
            order: [
                [7, "desc"]
            ],
            columns: [{
                    data: 'section',
                    render: function(data, type, row, meta) {
                        let sectionMethod = `${data}:${row.method}`
                        if (type == 'display') {
                            return '<button type="button" class="btn btn-outline-primary text-capitalize">' + sectionMethod + '</button>';
                        }
                        return sectionMethod;
                    }
                },
                {
                    data: 'amountSent',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                let parsedAsset = JSON.parse(row.asset);
                                let symbol = parsedAsset.Token;
                                let assetChain = row.asset + "~" + row.chainID;
                                if (symbol !== undefined) {
                                    return presentTokenCount(data) + " " + presentAsset(assetChain, symbol);
                                } else {
                                    return row.asset;
                                }
                            } catch (err) {
                                console.log("row.asset", row.asset, err);
                            }
                        } else {
                            try {
                                let parsedAsset = JSON.parse(row.asset);
                                let symbol = parsedAsset.Token;
                                if (symbol !== undefined) {
                                    return symbol
                                } else {
                                    return row.asset;
                                }
                            } catch (err) {
                                return ""
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'amountSentUSD',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.amountSentUSD !== undefined) {
                                //
                                return currencyFormat(row.amountSentUSD, row.priceUSD, row.priceUSDCurrent);
                            } else {
                                console.log("missing amountSentUSD", row);
                                return "--";
                            }
                        } else {
                            if (row.amountSentUSD !== undefined) {
                                return data
                            } else {
                                return 0;
                            }
                        }
                        return;
                    }
                },
                {
                    data: 'fromAddress',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.fromAddress !== undefined) {
                                return presentID(data);
                            } else {
                                console.log("missing fromAddress", row);
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'destAddress',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.destAddress !== undefined) {
                                return presentID(data);
                            } else {
                                console.log("missing destAddress", row);
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'id',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                            let timelineURL = `/timeline/${row.extrinsicHash}`
                            let timelineLink = `<div class="explorer"><a href="${timelineURL}">timeline</a></div>`
                            return `${presentChain(row.id, row.chainName)} (${s}) ` + timelineLink
                        }
                        return data;
                    }
                },
                {
                    data: 'chainIDDest',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                if (row.chainIDDest != undefined && row.chainDestName) {
                                    if (row.incomplete !== undefined && row.incomplete > 0) {
                                        return "Incomplete " + presentSuccessFailure(false);
                                    } else if (row.blockNumberDest) {
                                        return presentBlockNumber(row.idDest, row.chainDestName, row.blockNumberDest) + presentSuccessFailure(true);
                                    } else {
                                        return presentChain(row.idDest, row.chainDestName);
                                    }
                                } else {
                                    return "-"
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'sourceTS',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.sourceTS !== undefined) {
                                let s = presentTS(row.sourceTS);
                                return s;
                            } else {
                                return "--";
                            }
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
        setupcurrency();
        stopxcmtransfers();
    });

    //load data here: warning this function is technically async
    await loadData2(pathParams, tableName, true)
    const selectElement = document.querySelector('#relaychain');
    if (selectElement) {
        setchainfilter(selectElement.value);
    }
}


let initxcmmessages = false;
async function showxcmmessages(relaychain) {
    let pathParams = 'xcmmessages'
    let tableName = '#tablexcmmessages'
    if (initxcmmessages) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initxcmmessages = true;
        xcmmessagesTable = $(tableName).DataTable({
            pageLength: 100,
            lengthMenu: [
                [10, 25, 50, 100],
                [10, 25, 50, 100]
            ],
            columnDefs: [{
                "className": "dt-center",
                "targets": [1]
            }, {
                "className": "dt-left",
                "targets": [2, 3]
            }],
            order: [
                [7, "desc"]
            ],
            columns: [{
                    data: 'msgHash',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let str = "";
                            if (row.extrinsicID && row.extrinsicHash) {
                                str = "<BR>Extrinsic: " + presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                            }
                            str += "<BR><small>" + presentXCMTimeline(row.msgHash, "xcm", row.sentAt) + "</small>";
                            return presentXCMMessageHash(row.msgHash, row.sentAt) + str;
                        }
                        return data;
                    }
                },
                {
                    data: 'msgType',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let str = "";
                            let relayChain = (row.relayChain != undefined) ? row.relayChain : "";
                            if (row.matched == 1) {
                                str = '<button type="button" class="btn transfer" style="background-color:rgba(0,201,167,.2); color:#02977e">' + `${relayChain} ${data} (${row.version})` + '</button>';
                                return str;
                            } else {
                                str = '<button type="button" class="btn transfer" style="background-color:rgba(219,154,4,.2); color:#b47d00">' + `${relayChain} ${data} (${row.version})` + '</button>';
                                return str;
                            }
                        } else {
                            return row.relayChain + " " + data + " " + row.version
                        }

                    }
                },
                {
                    data: 'sourceTS',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let bn = (row.blockNumberOutgoing !== undefined) ? presentBlockNumber(row.id, row.chainName, row.blockNumberOutgoing) : row.chainName;
                            bn += "<br>";
                            if (row.sourceTS != undefined && row.sourceTS > 0) {
                                return bn + shorttimeConverter(data);
                            } else {
                                return bn + shorttimeConverter(row.blockTS);
                            }
                        } else {
                            if (row.sourceTS != undefined && row.sourceTS > 0) {
                                return data;
                            } else {
                                return data;
                            }
                        }
                        return 0;
                    }
                },
                {
                    data: 'destTS',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let bn = presentBlockNumber(row.idDest, row.chainDestName, row.blockNumber) + "<br>";
                            if (row.destTS != undefined && row.destTS > 0) {
                                return bn + shorttimeConverter(data);
                            } else {
                                return bn + shorttimeConverter(row.blockTS);
                            }
                        } else {
                            if (row.destTS != undefined && row.destTS > 0) {
                                return data;
                            } else if (row.incoming == 1) {
                                return data;
                            }
                            return "unmatched";
                        }
                        return 0;
                    }
                },
                {
                    data: 'msgStr',
                    render: function(data, type, row, meta) {
                        if (row.msgStr != undefined) {
                            if (type == 'display') {
                                return presentInstructions(row.msgStr, row.msgHash + row.incoming);
                            } else {
                                return data;
                            }
                        }
                    }
                },
                {
                    data: 'beneficiaries',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (data && data.length > 0) {
                                return presentID(data);
                            } else {
                                return "";
                            }
                        } else {
                            return data;
                        }

                    }
                },
                {
                    data: 'assetsReceived',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                if (data.length > 0) {
                                    return presentInstructions(data, "AR" + row.msgHash + row.incoming, "View Assets Received");
                                }
                            } catch (err) {}
                        }
                        return "None";
                    }
                },
                {
                    data: 'blockTS',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentSuccessFailure(row.matched);
                        }
                        return data;
                    }
                }
            ]
        });
    }

    //load data here: warning this function is technically async
    await loadData2(pathParams, tableName, true)
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
            stopxcmtransfers();
            break;
        case "#xcmtransfers":
            setupapidocs("xcmtransfers");
            showxcmtransfers();
            stopchains();
            break;
        case "#xcmmessages":
            setupapidocs("xcmmessages");
            showxcmmessages();
            stopchains();
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