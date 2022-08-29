var initrecentblocks = false;
var initchainlog = false;
var initspecversions = false;
var refreshIntervalMS = 5000;
var recentBlocksIntervalId = false;

function stoprecentblocks(chainID) {
    if (recentBlocksIntervalId) {
        clearInterval(recentBlocksIntervalId);
        recentBlocksIntervalId = false
    }
}

function showrecentblocks(chainID) {
    if (!recentBlocksIntervalId) {
        show_recentblocks(chainID)
    }
    recentBlocksIntervalId = setInterval(function() {
        show_recentblocks(chainID)
    }, refreshIntervalMS);
}

function show_recentblocks(chainID) {

    let pathParams = `chain/${chainID}`

    let tableName = '#tablerecentblocks'
    if (initrecentblocks) {

    } else {
        initrecentblocks = true;
        var table = $(tableName).DataTable({
            order: [
                [0, "desc"]
            ],
            columnDefs: [{
                "className": "dt-center",
                "targets": "_all"
            }],
            columns: [{
                data: 'blockNumber',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentBlockNumber(chainID, false, data)
                    }
                    return data;
                }
            }, {
                data: 'blockHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let f = (row.finalized == 0) ? presentFinalized(false) : "";
                        return f + " " + presentBlockHash(chainID, false, row.blockNumber, data);
                    }
                    return data;
                }
            }, {
                data: 'blockTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTS(data);
                    }
                    return data;
                }
            }, {
                data: 'numExtrinsics',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        // in the evm case, we show numTransactions
                        if (row.numTransactionsEVM != undefined) {
                            return `<a href='/txs/${chainID}/${row.blockNumber}'>` + presentNumber(row.numTransactionsEVM) + "</a>";
                        } else {
                            return presentNumber(data);
                        }
                    } else {
                        if (row.numTransactionsEVM != undefined) {
                            return row.numTransactionsEVM;
                        } else {
                            return data;
                        }
                    }
                    return data;
                }
            }, {
                data: 'numSignedExtrinsics',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.gasUsed != undefined) {
                            return presentNumber(row.gasUsed);
                        } else {
                            return presentNumber(data);
                        }
                    } else {
                        if (row.gasUsed != undefined) {
                            return row.gasUsed;
                        } else {
                            return data;
                        }
                    }
                    return data;
                }
            }, {
                data: 'numXCMTransfersOut',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let out = [];
                        let xcmtransfers = `/xcmtransfers?chainfilters=${chainID}&blockNumber=${row.blockNumber}`
                        let xcmlink = `/xcmmessages?chainfilters=${chainID}&blockNumber=${row.blockNumber}`
                        if (data > 0) {
                            out.push(`<a href='${xcmtransfers}'>${data} XCM transfers</a>`);
                            if (row.numXCMMessagesOut > 0 && row.numXCMMessagesOut > row.numXCMTransfers) {
                                out.push(`<a href='${xcmlink}'>${numXCMMessagesOut} additional outgoing XCMs</a>`);
                            }
                        } else {
                            if (row.numXCMMessagesOut > 0) {
                                out.push(`<a href='${xcmlink}'>${row.numXCMMessagesOut} outgoing</a>`);
                            }
                        }
                        if (row.numXCMMessagesIn > 0) {
                            out.push(`<a href='${xcmlink}'>${row.numXCMMessagesIn} incoming XCM</a>`);
                        }
                        return out.join(", ");
                    } else {
                        return data + row.numXCMMessagesIn;
                    }
                }
            }, {
                data: 'numEvents',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentNumber(data);
                    }
                    return data;
                }
            }, {
                data: 'numTransfers',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentNumber(data);
                    }
                    return data;
                }
            }, {
                data: 'valueTransfersUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return currencyFormat(data);
                    }
                    return data;
                }
            }, ]
        });
    }

    $(tableName).on('page.dt', function() {
        stoprecentblocks();
    });
    loadData2(pathParams, tableName, false, 'blocks')
}

function showspecversions(chainID) {
    if (initspecversions) return;
    else initspecversions = true;
    let pathParams = `specversions/${chainID}`
    let tableName = '#tablespecversions'
    var table = $(tableName).DataTable({
        order: [
            [0, "desc"]
        ],
        columnDefs: [{
            "className": "dt-center",
            "targets": "_all"
        }],
        columns: [{
            data: 'specVersion',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentSpecVersion(chainID, data)
                }
                return data;
            }
        }, {
            data: 'blockNumber',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentBlockNumber(chainID, false, data)
                }
                return data;
            }
        }, {
            data: 'blockHash',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentBlockHash(chainID, false, row.blockNumber, data);
                }
                return data;
            }
        }, {
            data: 'firstSeenTS',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentTS(data);
                }
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, false)
}

function presentLoan(assetChain, assetString) {
    let asset = JSON.parse(assetString)
    let symbol = "UNK";

    try {
        if (asset.Loan != undefined && asset.Loan.Token != undefined) {
            symbol = asset.Loan.Token;
        }
        return '<a href="/asset/' + encodeURIComponent2(assetChain) + '"> Loan: ' + symbol + '</a>';
    } catch (e) {
        return "Loan: UNK"
    }
}

function showchaininfo(chainID) {
    // no datatable
}

function showchainlog(chainID, address) {
    if (initchainlog) return;
    else initchainlog = true;
    let pathParams = `chainlog/${chainID}`

    let tableName = '#tablechainlog'
    var table = $(tableName).DataTable({
        order: [
            [0, "desc"]
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [6, 7, 10, 11]
        }, {
            "className": "dt-center",
            "targets": [1, 2, 3, 4, 5, 8, 9, 12, 13]
        }],
        columns: [{
            data: 'logDT',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data
                }
                return data;
            }
        }, {
            data: 'numAccountsActive',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'numAddresses',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'numSignedExtrinsics',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'numTransactionsEVM',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'numTransfers',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'valueTransfersUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }, {
            data: 'fees',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentTokenCount(data);
                } else {
                    return data;
                }
            }
        }, {
            data: 'numXCMTransfersIn',
            render: function(data, type, row, meta) {
                if (type == 'display') {
		    return data;
                } else {
		    return data;
                }
            }
        }, {
            data: 'numXCMTransfersOut',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'valXCMTransferIncomingUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
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
        }, {
            data: 'numXCMMessagesIn',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'numXCMMessagesOut',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}

function showchaintab(hash) {
    switch (hash) {
        case "#xcmassets":
            showxcmassets(id, address);
            setupapidocs("chain", "assets", `${id}`);
            break;
        case "#xcmtransfers":
            showxcmtransfers({
                chainID: id
            });
            break;
        case "#xcmmessages":
            showxcmmessages({
                chainID: id
            });
            break;
        case "#chainlog":
            showchainlog(id);
            setupapidocs("chain", "chainlog", `${id}`);
            break;
        case "#specversions":
            showspecversions(id);
            setupapidocs("chain", "specversions", `${id}`);
            break;
        case "#recentblocks":
            showrecentblocks(id);
            setupapidocs("chain", "recentblocks", `${id}`);
            break;
        case "#chaininfo":
            showchaininfo(id);
            setupapidocs("chain", "", `${id}`);
            break;
    }
}

function setuptabs(tabs, chain_id) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/chain/" + chain_id + hash;
            setTimeout(() => {
                showchaintab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#recentblocks";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#chainTab a[href="' + hash + '"]');
    mdb.Tab.getInstance(triggerEl).show();
}

setuptabs(tabs, id);
