var initchains = false;
var tableChains = null;
function showchains() {
    if (initchains) return;
    else initchains = true;

    let tableName = '#tablechains'
    tableChains = $(tableName).DataTable({
        order: [
            [1, "desc"],
            [6, "desc"],
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 4, 5, 6]
        }, {
            "className": "dt-left",
            "targets": [2, 3]
        }],
        columns: [{
            data: 'chainID',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return `<A href="/chain/${row.chainID}#xcmassets">${row.chainName}</A>`;
                }
                return data;
            }
        }, {
            data: 'localSymbol',
            render: function(data, type, row, meta) {
		let str = ( row.localSymbol != undefined ) ? row.localSymbol : "";
		let [accountState, balanceUSD] = get_accountState(row.asset, row.chainID, row.assetChain);
		if (accountState && accountState.free !== undefined) {
		    if (type == 'display') {
                        return presentTokenCount(accountState.free) + " " + str + " (" + currencyFormat(balanceUSD) + ")";
		    } else {
			if ( balanceUSD ) {
			    return balanceUSD;
			} else {
			    return 0;
			}
		    }
                } else {
                    if ( type == 'display' ) {
			return str;
		    } else {
			return 0;
		    }
		}
            }
        }, {
            data: 'currencyID',
            render: function(data, type, row, meta) {
                if (type == 'display') {
		    if ( row.currencyID ) {
			return `<a href='/asset/${row.chainID}/${row.currencyID}'>${row.currencyID}</a>`
		    } else {
			return row.symbol; // TODO `<a href='/asset/${row.chainID}/${row.assetChain}'>${row.symbol}</a>`
		    }
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
        }]
    });
    
    let table = tableChains;
    table.clear();
    table.rows.add(chains);
    table.draw();
}

function get_accountState(asset, chainID, assetChain) {
    if ( ! account ) return [null, null];
    if ( account.chains == undefined ) return [null, null];
    try {
    for ( let i = 0; i < account.chains.length; i++ ) {
	let c = account.chains[i];
	if ( c.chainID == chainID ) {
	    for (let j= 0; j < c.assets.length; j++) {
		let a = c.assets[j];
		if ( a.asset == asset ) {
		    let state = a.state;
		    let balanceUSD = state.balanceUSD;

		    return [state, balanceUSD];
		}
	    }
	}
    }
    } catch (err) {
	console.log(err);
    }
    return [null, null];
}


function showsymboltab(hash) {
    switch (hash) {
        case "#chains":
            setupapidocs("symbol", "chains");
            showchains(symbol);
            break;
    }
}

function setuptabs(tabs, symbol) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/symbol/" + symbol + hash;
            setTimeout(() => {
                showsymboltab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#chains";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#symbolTab a[href="' + hash + '"]');
    if ( triggerEl ) {
	console.log(hash, triggerEl);
	mdb.Tab.getInstance(triggerEl).show();
    }
}

setuptabs(tabs, symbol);
