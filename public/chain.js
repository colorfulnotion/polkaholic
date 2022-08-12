var initrecentblocks = false;
var initassets = false;
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
                },
                {
                    data: 'blockHash',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let f = (row.finalized == 0) ? presentFinalized(false) : "";
                            return f + " " + presentBlockHash(chainID, false, row.blockNumber, data);
                        }
                        return data;
                    }
                },
                {
                    data: 'blockTS',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentTS(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'numExtrinsics',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentNumber(data); // TODO: right justify all the numbers
                        }
                        return data;
                    }
                },
                {
                    data: 'numSignedExtrinsics',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentNumber(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'numEvents',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentNumber(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'numTransfers',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return presentNumber(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'valueTransfersUSD',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return currencyFormat(data);
                        }
                        return data;
                    }
                },
                {
                    data: 'numXCMTransfersOut',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let out = "-";
                            if (data > 0) {
                                out = presentNumber(data) + " XCM transfer";
                            }
                            if (row.numXCMMessagesOut > 0 && row.numXCMMessagesOut > row.numXCMTransfers) {
                                out += ` + ${row.numXCMMessagesOut} additional outgoing`;
                            }
                            if (row.numXCMMessagesIn > 0) {
                                out += ` (${row.numXCMMessagesIn} incoming)`;
                            }
                            return out;
                        }
                        return data;
                    }
                }
            ]
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
            },
            {
                data: 'blockNumber',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentBlockNumber(chainID, false, data)
                    }
                    return data;
                }
            },
            {
                data: 'blockHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentBlockHash(chainID, false, row.blockNumber, data);
                    }
                    return data;
                }
            },
            {
                data: 'firstSeenTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTS(data);
                    }
                    return data;
                }
            }
        ]
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

function showassets(chainID, address) {
    if (initassets) return;
    else initassets = true;
    let pathParams = `chain/assets/${chainID}/${address}`

    let tableName = '#tableassets'
    var table = $(tableName).DataTable({
        order: [
            [3, "desc"]
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [4, 5, 6, 7, 8]
        }, {
            "className": "dt-center",
            "targets": [1, 2, 3]
        }],
        columns: [{
                data: 'symbol',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.assetType == "ERC20LP") {
                            return presentAssetPair(row.assetChain, row.symbol, row.token0, row.token1, row.token0Symbol, row.token1Symbol, chainID);
                        } else if (row.assetType == "Loan") {
                            return presentLoan(row.assetChain, row.asset);
                        } else {
                            return presentAsset(row.assetChain, row.symbol);
                        }
                    }
                    return data;
                }
            },
            {
                data: 'decimals',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.assetType == "ERC20LP") {
                            return row.token0Decimals + "/" + row.token1Decimals;
                        } else {
                            return data;
                        }
                    }
                    return data;
                }
            },
            {
                data: 'assetType',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return data;
                    }
                    return data;
                }
            },
            {
                data: 'numHolders',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentNumber(data);
                    }
                    return data;
                }
            },
            {
                data: 'priceUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return currencyFormat(data);
                    }
                    return data;
                }
            },
            {
                data: 'totalFree',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.totalFree !== undefined) {
                            return presentTokenCount(data);
                        }
                    }
                    if (row.totalFree !== undefined) {
                        return data;
                    } else {
                        return 0;
                    }
                }
            },
            {
                data: 'tvl',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.tvl != undefined) {
                            return currencyFormat(data);
                        }
                    } else {
                        if (row.tvl != undefined) {
                            return data;
                        }
                    }
                    return 0;
                }
            },
            {
                data: 'accountState',
                render: function(data, type, row, meta) {
                    if (type == 'display') {

                        if (row.accountState !== undefined && row.accountState.free !== undefined) {
                            return presentTokenCount(row.accountState.free);
                        }
                        return 0
                    }
                    return 0;
                }
            },
            {
                data: 'balanceUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {

                        if (row.accountState !== undefined && row.accountState.freeUSD !== undefined) {
                            return currencyFormat(row.accountState.freeUSD);
                        }
                        return 0
                    }
                    return 0;
                }
            }
        ]
    });
    loadData2(pathParams, tableName, true)
}

function showchaininfo(chainID) {
    // no datatable
}


function showchaintab(hash) {
    switch (hash) {
        case "#assets":
            showassets(id, address);
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