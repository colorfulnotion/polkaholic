var initassetholders = false;
var initassetsrelated = false;
var initaccountassets = false;
var tableAccountAssets = null;
var tableAssetHolders = null;

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
                        if (asset == c.assets[k].asset) {
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
    console.log(recs);
    let table = tableAccountAssets;
    table.clear();
    table.rows.add(recs);
    table.draw();

}

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

function showassetsrelated(asset, chainID) {
    if (initassetsrelated) return;
    else initassetsrelated = true;
    let pathParams = `asset/related/${chainID}/${encodeURIComponent(asset)}`
    let tableName = '#tableassetsrelated'
    var table = $(tableName).DataTable({
        order: [
            [3, "desc"]
        ],
        columnDefs: [{
            "className": "dt-left",
            "targets": [0]
        }, {
            "className": "dt-center",
            "targets": [1, 2, 3, 4]
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
        }, {
            data: 'assetType',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
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
        }]
    });
    loadData2(pathParams, tableName, true)
}

function showassettab(hash) {
    switch (hash) {
        case "#accountassets":
            showaccountassets(asset, chainID);
            break;
        case "#assetsrelated":
            setupapidocs("asset", "assetsrelated");
            showassetsrelated(asset, chainID);
            break;
        case "#assetholders":
            setupapidocs("asset", "assetholders");
            showassetholders(asset, chainID);
            break;
    }
}

function setuptabs(tabs, asset, chainID) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/asset/" + chainID + "/" + currencyID + hash;
            //console.log("shown.mdb.tab", hash, newUrl);
            setTimeout(() => {
                showassettab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#accountassets";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#assetTab a[href="' + hash + '"]');
    //console.log("CAUSE shownmdb.tab for", triggerEl, hash);
    mdb.Tab.getInstance(triggerEl).show();
}

setuptabs(tabs, asset, chainID);