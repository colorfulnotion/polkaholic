var initchains = false;

function showchains() {
    let pathParams = 'chainsadmin'
    let tableName = '#tablechains'
    if (initchains) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initchains = true;
        var table = $(tableName).DataTable({
            iDisplayLength: 25,
            columnDefs: [{
                    "className": "dt-right",
                "targets": [3, 4, 5, 6]
                }
            ],
            order: [
                [0, "asc"]
            ],
            columns: [{
                    data: 'paraID',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
			    let chainID = row.chainID;
                            return `<a href='/admin/chain/${chainID}'>` + row.relayChain + ":" + row.paraID  + "</a>";
                        }
                        return row.chainID;
                    }
                },
                {
                    data: 'chainName',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                return row.chainName;
                            } catch {
                                return "-"
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'id',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                return row.id;
                            } catch {
                                return "-"
                            }
                        }
                        return data;
                    }
                },
                {
                    data: 'prefix',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return row.prefix;
                        }
                        return data;
                    }
                },
                {
                    data: 'asset',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return row.asset;
                        }
                        return data;
                    }
                },
                {
                    data: 'symbol',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return row.symbol;
                        }
                        return data;
                    }
                },
                {
                    data: 'WSEndpoint',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            let endpoints = [];
			    if ( row.WSEndpoint && row.WSEndpoint.length > 0 ) endpoints.push(row.WSEndpoint);
			    if ( row.WSEndpoint2 && row.WSEndpoint2.length > 0 ) endpoints.push(row.WSEndpoint2);
			    if ( row.WSEndpoint3 && row.WSEndpoint3.length > 0 ) endpoints.push(row.WSEndpoint3);
			    return endpoints.join("<br>");
                        }
                        return data;
                    }
                }
            ]
        });
    }

    //load data here: warning this function is technically async
    loadData2(pathParams, tableName, false)
}

function showchainstab(hash) {
    switch (hash) {
        case "#chains":
            setupapidocs("chains", "list");
            showchains();
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
            //console.log("shown.mdb.tab", hash, newUrl);
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
    //console.log("CAUSE shownmdb.tab for", triggerEl, hash);
    mdb.Tab.getInstance(triggerEl).show();
}

setuptabs(tabs);
