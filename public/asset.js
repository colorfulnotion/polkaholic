var initassetholders = false;
var initassetsrelated = false;

function showassetholders(asset, chainID) {
    if (initassetholders) return;
    else initassetholders = true;
    
    let pathParams = `asset/holders/${chainID}/${encodeURIComponent2(asset)}`

    let tableName = '#tableassetholders'
    var table = $(tableName).DataTable({
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
                        return presentAssetPair(row.assetChain, row.symbol, row.token0, row.token1, row.token0Symbol, row.token1Symbol, row.chainID);
                    } else {
                        return presentAsset(row.assetChain, row.symbol);
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
    let hash = "#assetholders";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#assetTab a[href="' + hash + '"]');
    //console.log("CAUSE shownmdb.tab for", triggerEl, hash);
    mdb.Tab.getInstance(triggerEl).show();
}

setuptabs(tabs, asset, chainID);
