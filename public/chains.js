var initchains = false;
var chainsTable = null;
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
                        let links = [];
                        if (row.dappURL) {
                            links.push(`<a href='${row.dappURL}' target='_new'>app</a>`);
                        }
                        links.push(`<a href='/xcminfows/${row.id}' target='_new'>xcminfo</a>`);
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
                        // show account holdings summary on chain (linking to /xcmassets/${chainID})
                        let balanceUSD = get_accountBalanceOnChain(row.chainID);
                        if (type == 'display') {
                            if (balanceUSD == null) {
                                return "-Connect Wallet-";
                            }
                            let url = `/xcmassets/${row.chainID}`;
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
                            let url = `/chainlog/${row.id}`
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
                        let url = `/xcmtransfers/${row.id}`
                        return `<a href="${url}">` + presentNumber(data) + " " + currencyFormat(row.valXCMTransferIncomingUSD7d) + "</a>";
                    } else {
                        return row.valXCMTransferIncomingUSD7d;
                    }
                }
            }, {
                data: 'numXCMTransferOutgoing7d',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let url = `/xcmtransfers/${row.id}`
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
}