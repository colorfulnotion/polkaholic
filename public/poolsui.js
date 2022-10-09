var initpools = false;
let poolsTable = null;

function showpools(asset, assetType = "router", chainID = null) {
    if (initpools) return;
    else initpools = true;
    let assetstr = (asset == undefined) ? "all" : asset.toString();
    let pathParams = `pools/${assetType}/${assetstr}`
    if ( assetType == "assetChain" && chainID ) {
	pathParams = `pools/${assetType}/${asset}~${chainID}`
    }
    console.log(pathParams);
    let tableName = '#tablepools'
    poolsTable = $(tableName).DataTable({
        order: [
            [1, "desc"],
            [5, "desc"],
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 2, 3, 4, 5, 6, 7, 8, 9]
        }, {
            "className": "dt-left",
            "targets": [0]
        }],
        columns: [{
            data: 'assetName',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentAssetPair(row);
                } else {
                    return row.token0Symbol + " " + row.token1Symbol
                }
                return data;
            }
        }, {
            data: 'asset',
            render: function(data, type, row, meta) {
                if (row.asset != undefined) {
                    try {
                        let str = (row.localSymbol != undefined && row.localSymbol) ? row.localSymbol : "";
                        let [accountState, balanceUSD] = get_accountState(row.asset, row.chainID, row.assetChain);
                        if (!accountState) {
                            if (type == 'display') {
                                if (balanceUSD == null) {
                                    return `-Connect Wallet [${str}]-`
                                } else {
                                    return "-";
                                }
                            } else {
                                return 0;
                            }
                        } else if (accountState && accountState.free !== undefined) {
                            if (type == 'display') {

                                return presentTokenCount(accountState.free) + " " + str + " (" + currencyFormat(balanceUSD) + ")";
                            } else {
                                return balanceUSD + .000000001 * accountState.free;
                            }
                            return 0;
                        } else {
                            if (type == 'display') {
                                return str;
                            }
                        }
                        return 0;
                    } catch (err) {
                        console.log(err);
                        return "-"
                    }
                }
            }
        }, {
            data: 'numHolders',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'priceUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }, {
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
        }, {
            data: 'tvlUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.tvlUSD != undefined) {
                        return currencyFormat(data);
                    }
                } else {
                    if (row.tvlUSD != undefined) {
                        return data;
                    }
                }
                return 0;
            }
        }, {
            data: 'feesUSD1d',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                } else {
                    return data;
                }
                return 0;
            }
        }, {
            data: 'apy1d',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentPercentage(data);
                } else {
                    return data;
                }
                return 0;
            }
        }, {
            data: 'apy7d',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentPercentage(data);
                } else {
                    return data;
                }
                return 0;
            }
        }, {
            data: 'apy30d',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentPercentage(data);
                } else {
                    return data;
                }
                return 0;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}
