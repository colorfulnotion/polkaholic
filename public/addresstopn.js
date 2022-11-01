var initaddresstopn = false;
var addresstopnTable = null

async function showaddresstopn() {
    let tableName = '#tableaddresstopn'
    if (initaddresstopn) {} else {
        initaddresstopn = true;
        addresstopnTable = $(tableName).DataTable({
            /*
            [0] N
            [1] address
            [2] balanceUSD
            [3] val
            */
            pageLength: 100,
            lengthMenu: [
                [10, 25, 50, 100, -1],
                [10, 25, 50, 100, "All"]
            ],
            columnDefs: [{
                "className": "dt-right",
                "targets": [1, 2, 3]
            }],
            order: [
                [0, "asc"]
            ],
            columns: [{
                data: 'N',
                render: function(data, type, row, meta) {
                    let sectionMethod = `${data}:${row.method}`
                    if (type == 'display') {
                        return data;
                    }
                    return data;
                }
            }, {
                data: 'address',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            return presentIDRow(row, "address");
                        } catch (err) {
                            console.log("row.asset", row.asset, err);
                        }
                    } else {
                        try {
                            return data;
                        } catch (err) {
                            return ""
                        }
                    }
                    return data;
                }
            }, {
                data: 'balanceUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.balanceUSD !== undefined) {
                            return currencyFormat(data);
                        } else {
                            console.log("missing balanceUSD", row);
                            return "--";
                        }
                    } else {
                        if (row.balanceUSD !== undefined) {
                            return data
                        } else {
                            return 0;
                        }
                    }
                    return;
                }
            }, {
                data: 'val',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (filtertype == "currency") {
                            return currencyFormat(data);
                        } else {
                            return presentNumber(data);
                        }
                    }
                    return data;
                }
            }]
        });
    }

    //load data here: warning this function is technically async
    const topNElement = document.querySelector('#topN');
    let topN = "balanceUSD"
    if (topNElement) {
        topN = topNElement.value;
    }
    let pathParams = `addresstopn/${topN}`
    await loadData2(pathParams, tableName, false);

    let hdr = topNfilters.filter((f) => (f.filter == topN));

    if (hdr.length == 1) {
        document.getElementById("topnhdr").innerHTML = hdr[0].display;
        filtertype = hdr[0].type;
    }
}

let filtertype = "currency";

const topNElement = document.querySelector('#topN');
if (topNElement) {
    topNElement.addEventListener('change', (event) => {
        showaddresstopn();
    });
}
