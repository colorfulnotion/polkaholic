var inittraces = false;

async function loadDataTrace(pathParams, tableName) {
    let endpoints = `${baseURL}/${pathParams}`
    var req = new Request(endpoints, {
        method: 'GET',
        headers: new Headers({
            "Accept": "application/json; odata=verbose",
        })
    });
    
    fetch(req)
        .then((response) => response.json())
        .then((data) => {
	    if ( data.length > 0 ) {
		let t = data[0].trace; // TODO: choose the matching blockHash, not the first one
		if (t != undefined) {
		    var table = $(tableName).DataTable();
		    table.clear();
		    table.rows.add(t);
		    table.draw();
		} else {
                    console.log(`selected fld=${fld} not found! endpoint:${endpoints}`)
		}
	    }
        });
}

function showtraces(id, blockNumber, blockHash) {
    if (inittraces) return;
    else inittraces = true;
    let pathParams = `trace/${id}/${blockNumber}/${blockHash}`
    let tableName = '#tabletraces'
    var table = $(tableName).DataTable({
        order: [
            [0, "asc"]
        ],
        columnDefs: [{
            "className": "dt-left",
            "targets": [1, 2, 3]
        }],
        columns: [{
                data: 'traceID',
                render: function(data, type, row, meta) {
                    return data.replace(`${blockNumber}-`, "");
                }
            },
            {
                data: 'section',
                render: function(data, type, row, meta) {
		    let section = ( row.section != undefined ) ? row.section : "unk";
		    let storage = ( row.storage != undefined ) ? row.storage : "unk";
                    let sectionStorage = `${section}:${storage}`;
                    if (type == 'display') {
			let str = `<button type="button" class="btn btn-outline-secondary text-capitalize">${sectionStorage}</button>`;
			return str;
                    }
                    return sectionStorage;
                }
            },
            {
                data: 'k',
                render: function(data, type, row, meta) {
		    if ( row.k != undefined ) {
			let pkExtra = row.pkExtra != undefined ? row.pkExtra : "";
			if ( type == "display" ) {
			    let out = getShortHash(row.k);
			    if ( pkExtra != "") {
				try {
				    let x = JSON.parse(pkExtra);
				    out += "<BR>" + cover_params(x, "k" + row.traceID );
				} catch {
				    out += "<BR>" + "SIMPLE" + pkExtra;
				}
			    }
			    return out;
			} else {
			    return row.k + pkExtra;
			}
		    } else {
			return "";
		    }
                }
            },
            {
                data: 'v',
                render: function(data, type, row, meta) {
		    if ( row.v != undefined ) {
			let pv = row.pv != undefined ? row.pv : "";
			if ( type == "display" ) {
			    let out = getShortHash(row.v);
			    if ( pv != "") {
				try {
				    let x = JSON.parse(pv)
				    out += "<br>" + cover_params(x, row.traceID)
				} catch {
				    out += "<br><B>" + pv + "</B>";
				}
			    } 
			    return out; 
			}  else {
			    return row.pv + pv;
			}
		    } else {
			return "";
		    }
                }
            }
        ]
    });
    loadDataTrace(pathParams, tableName);
}

function showtracestab(hash) {
    switch (hash) {
        case "#traces":
        showtraces(id, blockNumber, blockHash);
        setupapidocs("traces", "", `${id}/${blockNumber}/${blockHash}`);
        break;
    }
}

function setuptabs(tabs) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id0 = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id0);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = `/trace/${id}/${blockNumber}/${blockHash}`;
            //console.log("shown.mdb.tab", hash, newUrl);
            setTimeout(() => {
                showtracestab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#traces"
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#tracesTab a[href="' + hash + '"]');
    mdb.Tab.getInstance(triggerEl).show();
}

