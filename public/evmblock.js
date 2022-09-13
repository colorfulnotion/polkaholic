let initevmblocktransactions = false;
let initevmblockinternal = false;
let initevmblockextrinsics = false;
let initevmblockevents = false;
let tableEVMBlockTransactions = false;
let tableEVMBlockInternal = false;
let tableEVMBlockExtrinsics = false;
let tableEVMBlockEvents = false;

function showevmblockextrinsics(objects) {
    let tableName = '#tableevmblockextrinsics'
    if (!initevmblockextrinsics) {
        initevmblockextrinsics = true;
        tableEVMBlockExtrinsics = $(tableName).DataTable({
            columnDefs: [{
                    "className": "dt-center",
                    "targets": [3, 4]
                },
                {
                    "targets": [5],
                    "visible": false
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
                                    return presentInstructions(JSON.stringify(row.params), "e" + row.extrinsicHash, "Params");
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
                        if (row.evm != undefined && (row.evm.from != undefined)) {
                            return presentID(row.evm.from);
                        } else if (row.fromAddress) {
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
                            return txStatus;
                        }
                        return data;
                    }
                },
                {
                    data: 'id',
                    render: function(data, type, row, meta) {
                        if (row.id) {
                            return data;
                        } else {
                            return "";
                        }
                    }
                },
            ]
        });
    }
    let table = tableEVMBlockExtrinsics;
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}

function showevmblocktransactions(objects) {
    let tableName = '#tableevmtxs'
    if (!initevmblocktransactions) {
        initevmblocktransactions = true;
        tableEVMBlockTransactions = $(tableName).DataTable({
            columnDefs: [{
                "className": "dt-center",
                "targets": [3, 4]
            }],
            columns: [{
                    data: 'transactionHash',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                if (row.transactionHash != undefined) {
                                    let s = presentTxHash(row.transactionHash);
                                    return `${s}`
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
                    data: 'method',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.decodedInput !== undefined && row.decodedInput.methodID !== undefined) {
                                let method = row.decodedInput.methodID;
                                if (row.decodedInput.decodeStatus == "success") {
                                    let sa = row.decodedInput.signature.split("(");
                                    method = sa[0];
                                }
                                return '<button type="button" class="btn btn-outline-primary text-capitalize">' + method + '</button>';
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
                    data: 'blockNumber',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            return row.blockNumber;
                        }
                        return data;
                    }
                },
                {
                    data: 'ts',
                    render: function(data, type, row, meta) {
                        let x = 0
                        if (type == 'display') {
                            if (row.ts !== undefined) {
                                return presentTS(row.ts);
                            } else if (row.timestamp !== undefined) {
                                return presentTS(row.timestamp);
                            }
                        } else {
                            if (row.ts !== undefined) {
                                return (row.ts);
                            } else if (row.timestamp !== undefined) {
                                return (row.timestamp);
                            }
                        }

                    }
                },
                {
                    data: 'status',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.status != undefined) {
                                let txStatus = presentSuccessFailure(row.status, "");
                                return txStatus;
                            }
                        }
                        return "";
                    }
                },
                {
                    data: 'from',
                    render: function(data, type, row, meta) {
                        if (row.from != undefined) {
                            return presentID(row.from);
                        }
                        return "";
                    }
                },
                {
                    data: 'to',
                    render: function(data, type, row, meta) {
                        if (row.to) {
                            return presentID(row.to);
                        } else {
                            return "";
                        }
                    }
                },
                {
                    data: 'value',
                    render: function(data, type, row, meta) {
                        if (row.value) {
                            return data;
                        } else {
                            return "";
                        }
                    }
                },
                {
                    data: 'fee',
                    render: function(data, type, row, meta) {
                        if (row.fee) {
                            return data;
                        } else {
                            return "";
                        }
                    }
                }
            ]
        });
    }
    let table = tableEVMBlockTransactions;
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}


function showevmblockinternal(objects) {
    let tableName = '#tableinternal'
    if (!initevmblockinternal) {
        initevmblockinternal = true;
        tableEVMBlockInternal = $(tableName).DataTable({
            columnDefs: [{
                "className": "dt-center",
                "targets": [3, 4]
            }],
            columns: [{
                    data: 'transactionHash',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            try {
                                if (row.transactionHash != undefined) {
                                    let s = presentTxHash(row.transactionHash);
                                    return `${s}`
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
                    data: 'stack',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.stack != undefined) {
                                return presentStack(data);
                            }
                        }
                        return "";
                    }
                },
                {
                    data: 'from',
                    render: function(data, type, row, meta) {
                        if (row.from != undefined) {
                            return presentID(row.from);
                        }
                        return "";
                    }
                },
                {
                    data: 'to',
                    render: function(data, type, row, meta) {
                        if (row.to) {
                            return presentID(row.to);
                        } else {
                            return "";
                        }
                    }
                },
                {
                    data: 'value',
                    render: function(data, type, row, meta) {
                        if (row.value) {
                            return data;
                        } else {
                            return "";
                        }
                    }
                },
                {
                    data: 'gas',
                    render: function(data, type, row, meta) {
                        if (row.gas) {
                            return data;
                        } else {
                            return "";
                        }
                    }
                },
                {
                    data: 'gasUsed',
                    render: function(data, type, row, meta) {
                        console.log(row);
                        if (row.gasUsed) {
                            return data;
                        } else {
                            return "";
                        }
                    }
                }
            ]
        });
    }
    let table = tableEVMBlockInternal;
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}

function jumpTab(hash = "#evmtxs") {
    const triggerEl = document.querySelector('#blockTab a[href="' + hash + '"]');
    if (triggerEl) {
        mdb.Tab.getInstance(triggerEl).show();
    } else {
        console.log("jumpTabFAIL", hash)
    }
}

function showevmblockevents(objects) {
    let tableName = '#tableevmblockevents'
    if (!initevmblockevents) {
        initevmblockevents = true;
        tableEVMBlockEvents = $(tableName).DataTable({
            columnDefs: [{
                "className": "dt-center",
                "targets": [3]
            }],
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
                            let pieces = data.split("-")
                            if (pieces.length > 1) {
                                return pieces[1];
                            }
                            return "";
                        }
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
                                return presentInstructions(JSON.stringify(row), row.eventID, row.extrinsicID + " Event #" + row.extrinsicEventIndex, 900);
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
    let table = tableEVMBlockEvents;
    table.clear();
    if (objects != undefined) {
        table.rows.add(objects);
    }
    table.draw();
}


function setuptabs(tabs, chain_id, blockNumber, blockHash, hash = "#extrinsics") {
    setupapidocs("block", "", `${chain_id}/${blockNumber}`);
    for (let i = 0; i < tabs.length; i++) {
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
        if (urlhash.length > 1) hash = "#" + urlhash[1];
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
                    if ((info.chainID != undefined) && (info.blockNumber != undefined)) {
                        let chainID = info.chainID;
                        if (chainID == 2004 || chainID == 22023 || chainID == 2006 || chainID == 2002 || chainID == 22007) {
                            let url = '/block/' + chainID + '/' + info.blockNumber + '#evmtxs'
                            window.location.href = url
                        }
                    }
                } else if (info.blockHashFinalized) {
                    msg = "No - Alternate blockHash finalized " + info.blockHashFinalized
                }
                document.getElementById("status").innerHTML = presentFinalized(finalized) + " " + beautifyCamelCase(msg);
            })
        setupcurrency() // inject currency event listener
    }, 3000);
}


$.fn.dataTable.ext.search.push(
    function(settings, searchData, index, rowData, counter) {
        if (settings.nTable.id == 'tableevmblockextrinsics') {
            let checked = document.getElementById('showallextrinsics').checked;
            if (checked) {
                return (true);
            }
            // we are not showing all extrinsics
            if (rowData.signer == undefined && false) {
                return (false);
            } else if (rowData.evm) {
                return (false);
            } else {
                return (true);
            }
            return (false);
        } else if (settings.nTable.id == 'tableevmblockevents') {
            let checked = document.getElementById('showallevents').checked;
            if (checked) {
                return (true);
            }
            if ((rowData.section == 'evm') || (rowData.section == 'ethereum') || (rowData.section == 'system' && (rowData.method == 'ExtrinsicSuccess' || rowData.method == 'ExtrinsicFailed'))) {
                return (false);
            }
            return (true);
            //return( rowData.signed );
        } else {
            return true;
        }
    }
);

$("#showallextrinsics").on('click', function(e) {
    showevmblockextrinsics(extrinsics);
});
$("#showallevents").on('click', function(e) {
    showevmblockevents(events);
});

$(document).ready(function() {
    setuptabs(tabs, id, blockNumber, blockHash, defHash);
    showevmblocktransactions(evmtxs);
    showevmblockinternal(evminternal);
    showevmblockextrinsics(extrinsics);
    showevmblockevents(events);
});