let initblockextrinsics = false;
let initblockevents = false;
let tableBlockExtrinsics = false;
let tableBlockEvents = false;

function showblockextrinsics(objects) {
    let tableName = '#tableblockextrinsics'
    if (!initblockextrinsics) {
	initblockextrinsics = true;
        tableBlockExtrinsics = $(tableName).DataTable({
        columnDefs: [{
                "className": "dt-center",
                "targets": [3, 4]
            }
        ],
        order: [
            [4, "desc"]
        ],
        columns: [{
                data: 'extrinsicID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            if (row.extrinsicID != undefined && row.extrinsicHash != undefined) {
                                let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                                return `${presentChain(row.id, row.chainName)} (${s})`
                            } else if (row.transactionHash != undefined) {
                                let s = presentTxHash(row.transactionHash);
                                return `${presentChain(row.id, row.chainName)} (${s})`
                            } else {
                                console.log(row);
                            }
                        } catch (e) {
                            console.log(row);
                        }
                    }
                    if (row.extrinsicID != undefined) {
                        return data;
                    }
                    return "";
                }
            },
            {
                data: 'section',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.method !== undefined && row.section !== undefined && row.extrinsicHash !== undefined) {
                            return presentExtrinsic(row.id, row.section, row.method)
                        } else if (row.method !== undefined && row.section !== undefined && row.transactionHash !== undefined) {
                            return '<button type="button" class="btn btn-outline-primary text-capitalize">' + row.section + '</button>';
                        } else if (row.method !== undefined) {
                            return '<button type="button" class="btn btn-outline-primary">' + row.method + '</button>';
                        } else {
                            return "-";
                        }
                    } else {
                        if (row.method !== undefined) {
                            return data;
                        } else {
                            return "-";
                        }
                    }
                    return data;
                }
            },
            {
                data: 'params',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let out = "";
                        if (row.method !== undefined && row.extrinsicHash !== undefined) {
                            try {
                                return presentInstructions(JSON.stringify(row.params), "e" + row.extrinsicHash, "Params", {verification: "extrinsic", obj: row.params, extrinsicID: row.extrinsicID, extrinsicHash: row.extrinsicHash});
                            } catch (e) {
                                console.log(e);
                            }
                        } else if (row.decodedInput !== undefined && row.transactionHash !== undefined && row.decodedInput.params !== undefined) {
                            return presentInstructions(row.decodedInput.params, row.transactionHash, "Params");
                        }
                        return "";
                    } else {
                        if (row.method !== undefined && row.extrinsicHash !== undefined) {
                            try {
                                return JSON.stringify(row.params);
                            } catch (e) {
                                console.log(e);
                            }
                        } else if (row.decodedInput !== undefined && row.transactionHash !== undefined && row.decodedInput.params !== undefined) {
                            return JSON.stringify(row.decodedInput.params);
                        }
                    }
                    return "";
                }
            },
            {
                data: 'fromAddress',
                render: function(data, type, row, meta) {
		    if ( row.fromAddress ) {
			return presentID(row.fromAddress);
		    }
		    return "";
                }
            },
            {
                data: 'result',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        //let res = (row.result == 1) ? 'Success' : 'Failed'
                        let txStatus = presentSuccessFailure(row.result, row.err)
			// TODO: params
                        return txStatus;
                    }
                    return data;
                }
            },
        ]
	});
    }
    let table = tableBlockExtrinsics;
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}

function showblockevents(objects) {
    let tableName = '#tableblockevents'
    if (!initblockevents) {
	initblockevents = true;
        tableBlockEvents = $(tableName).DataTable({
        columnDefs: [{
                "className": "dt-left",
                "targets": [3]
            }
        ],
        order: [
            [0, "asc"]
        ],
        columns: [{
                data: 'eventID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            return row.rawEventID;
                        } catch (e) {
                            console.log(e);
                        }
                    } else {
			let ida = row.rawEventID.split("-")
			if ( ida.length > 1 ) {
			    return parseInt(ida[1], 10);
			}
			return row.rawEventID;
		    }
                    return data;
                }
            },
            {
                data: 'extrinsicID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
			return presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                    } else {
                        if (row.method !== undefined) {
                            return data;
                        } else {
                            return "-";
                        }
                    }
                    return data;
                }
            },
            {
                data: 'section',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
			    let palletMethod = `${row.section}(${row.method})`
			    return `<a href="/extrinsics/${row.chainID}/${row.section}/${row.method}" class="btn btn-outline-primary text-capitalize">${palletMethod}</a>`;
                        } catch (e) {
                            console.log(e);
                        }
                        return "";
                    } else {
                        try {
                            return row.section + " " + row.method;
                        } catch (e) {
                            console.log(e);
                        }
                    }
                    return "";
                }
            },
            {
                data: 'data',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
			    return presentInstructions(JSON.stringify(row), row.eventID, row.extrinsicID + " Event #" + row.extrinsicEventIndex, {}, 900);
                        } catch (e) {
                            console.log(e);
                        }
                        return "";
                    } else {
                        try {
                            return JSON.stringify(row.data);
                        } catch (e) {
                            console.log(e);
                        }
                    }
                    return "";
                }
            }
        ]
	});
    }
    let table = tableBlockEvents;
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}


function setuptabs(tabs, chain_id, blockNumber, blockHash, hash = "#extrinsics") {
    setupapidocs("block", "", `${chain_id}/${blockNumber}`);
    for (let i=0; i<tabs.length; i++) {
    	let t = tabs[i];
    	let id = "#" + t.target + "-tab";
    	let tabEl = document.querySelector(id);
    	tabEl.addEventListener('shown.mdb.tab', function(event) {
    	    const hash = $(this).attr("href");
	    let t = blockHash.length > 0 ? '?blockhash=' + blockHash : '';
    	    let newUrl = "/block/" + chain_id + "/" + blockNumber + t + hash;
    	    history.replaceState(null, null, newUrl);
    	})
    }
    let url = location.href.replace(/\/$/, "");
    if (location.hash) {
    	const urlhash = url.split("#");
    	if ( urlhash.length > 1 ) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#blockTab a[href="' + hash + '"]');
    mdb.Tab.getInstance(triggerEl).show();
}

var showblockstatusIntervalId = 0;

function showblockstatus(blockHash) {
    showblockstatusIntervalId = setInterval(function() {
        let url = `${baseURL}/hash/${blockHash}`
        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(info) {
		let msg = "No";
		let finalized = false;
                if (info.status == "finalized") {
		    msg = "Yes"
		    finalized = true;
                    clearInterval(showblockstatusIntervalId);
		    console.log(info.chainID, info.blockNumber);
                } else if ( info.blockHashFinalized ) {
		    msg = "No - Alternate blockHash finalized " + info.blockHashFinalized
		}
                document.getElementById("status").innerHTML = presentFinalized(finalized) + " " + beautifyCamelCase(msg);
            })
        setupcurrency() // inject currency event listener
    }, 3000);
}

$.fn.dataTable.ext.search.push(
    function( settings, searchData, index, rowData, counter ) {
        if (settings.nTable.id == 'tableblockextrinsics') {
	    let checked = document.getElementById('showallextrinsics').checked;
	    if ( checked ) {
		return(true);
	    }
	    // we are not showing all extrinsics
	    if ( rowData.signer == undefined) {
		return(false);
	    } else if ( rowData.evm ) {
		return(false);
	    } else {
		return(true);
	    }
	    return(false);
	} else if (settings.nTable.id == 'tableblockevents') {
	    let checked = document.getElementById('showallevents').checked;
	    if ( checked ) {
		return(true);
	    }
        if ((rowData.section == 'system' && (rowData.method == 'ExtrinsicSuccess' || rowData.method == 'ExtrinsicFailed')) ){
            return(false);
        }
        return(true);
	    //return( rowData.signed );
	} else {
            return true;
        }
    }
);


$("#showallextrinsics").on('click', function(e) {
    showblockextrinsics(extrinsics);
});
$("#showallevents").on('click', function(e) {
    showblockevents(events);
});

$(document).ready(function() {
    setuptabs(tabs, id, blockNumber, blockHash, defHash);
    showblockextrinsics(extrinsics);
    showblockevents(events);
});
