var initassetsrelated = false;
var tableAssetsRelated = null;

function showassetsrelated(asset, chainID) {
    if (initassetsrelated) return;
    else initassetsrelated = true;
    let pathParams = `asset/related/${chainID}/${encodeURIComponent(asset)}`
    let tableName = '#tableassetsrelated'
    tableAssetsRelated = $(tableName).DataTable({
        order: [
            [1, "desc"],
            [5, "desc"],
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [4, 5]
        }, {
            "className": "dt-center",
            "targets": [1, 2, 3]
        }],
        columns: [{
            data: 'symbol',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.assetType == "ERC20LP") {
                        return presentAssetPair(row);
                    } else {
                        return presentAsset(row);
                    }
                }
                return data;
            }
        }, {
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
                    return currencyFormat(data)
                }
                return 0;
            }
        }, {
            data: 'totalSupply',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'tvl',
            render: function(data, type, row, meta) {
                let tvl = row.totalSupply * row.priceUSD
                if (type == 'display') {
                    return currencyFormat(tvl)
                }
                return tvl;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}

var initaccountassets = false;
var tableAccountAssets = null;

function showaccountassets(asset, chainID) {
    if (initaccountassets) return (false);
    initaccountassets = true;
    let recs = []
    for (let i = 0; i < accounts.length; i++) {
        let a = accounts[i];
        let address = a.address;
        if (a.chains) {
            for (let j = 0; j < a.chains.length; j++) {
                let c = a.chains[j];
                if (c.chainID == chainID) {
                    for (let k = 0; k < c.assets.length; k++) {
                        console.log(asset, c.assets[k]);
                        if (asset.toLowerCase() == c.assets[k].asset.toLowerCase()) {
                            c.assets[k].state.symbol = c.assets[k].symbol;
                            c.assets[k].state.address = address;
                            recs.push(c.assets[k].state);
                        }
                    }
                }
            }
        }
    }
    let tableName = '#tableaccountassets'
    tableAccountAssets = $(tableName).DataTable({
        order: [
            [1, "desc"]
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 2]
        }],
        columns: [{
            data: 'address',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentFullAddress(row.address);
                }
                return data;
            }
        }, {
            data: 'free',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.free !== undefined) {
                        return presentTokenCount(row.free);
                    }
                } else {
                    if (row.free !== undefined) {
                        return row.free;
                    }
                }
                return 0;
            }
        }, {
            data: 'freeUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.freeUSD !== undefined) {
                        return currencyFormat(row.freeUSD);
                    }
                } else {
                    if (row.freeUSD !== undefined) {
                        return row.freeUSD;
                    }
                }
                return 0;
            }
        }]
    });

    let table = tableAccountAssets;
    table.clear();
    table.rows.add(recs);
    table.draw();

}

var initassetholders = false;
var tableAssetHolders = null;

function showassetholders(asset, chainID) {
    if (initassetholders) return;
    initassetholders = true;
    console.log("showassetholders");
    let pathParams = `asset/holders/${chainID}/${encodeURIComponent2(asset)}`

    let tableName = '#tableassetholders'
    tableAssetHolders = $(tableName).DataTable({
        order: [
            [1, "desc"]
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 2]
        }],
        columns: [{
            data: 'holder',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentFullAddress(row.holder);
                }
                return data;
            }
        }, {
            data: 'free',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.free !== undefined) {
                        return presentTokenCount(row.free);
                    }
                } else {
                    if (row.free !== undefined) {
                        return row.free;
                    }
                }
                return 0;
            }
        }, {
            data: 'balanceUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.balanceUSD !== undefined) {
                        return currencyFormat(row.balanceUSD);
                    }
                } else {
                    if (row.balanceUSD !== undefined) {
                        return row.balanceUSD;
                    }
                }
                return 0;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}