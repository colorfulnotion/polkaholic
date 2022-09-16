var initerc20 = false;
var tableERC20 = null

function showerc20(address) {
    if (initerc20) return;
    else initerc20 = true;

    let pathParams = `account/evmtransfers/${address}`
    let tableName = '#tableerc20'
    tableERC20 = $(tableName).DataTable({
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-right",
            "targets": [5, 6]
        }, {
            "className": "dt-center",
            "targets": [2, 3]
        }],
        order: [
            [1, "desc"]
        ],
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
                return "";
            }
        }, {
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
        }, {
            data: 'from',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (data.toLowerCase() == address.toLowerCase()) {
                        return getShortHash(data);
                    } else {
                        return presentAddress(data);
                    }
                }
                return "nfrom";
            }
        }, {
            data: 'transferType',
            render: function(data, type, row, meta) {
                let transferType = (row.from !== address) ? 'incoming' : 'outgoing';
                if (type == 'display') {
                    if (transferType == 'incoming') {
                        return '<button type="button" class="btn transfer" style="background-color:rgba(0,201,167,.2); color:#02977e">' + "IN" + '</button>';
                    } else {
                        return '<button type="button" class="btn transfer" style="background-color:rgba(219,154,4,.2); color:#b47d00">' + "OUT" + '</button>';
                    }
                }
                return transferType;
            }
        }, {
            data: 'to',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (data.toLowerCase() == address.toLowerCase()) {
                        return getShortHash(data);
                    } else {
                        return presentAddress(data);
                    }
                }
                return "ndest";
            }
        }, {
            data: 'value',
            render: function(data, type, row, meta) {
                if (row.value != undefined) {
                    return row.value + " " + row.symbol;
                } else {
                    return 0;
                }
            }
        }, {
            data: 'valueUSD',
            render: function(data, type, row, meta) {
                if (row.valueUSD != undefined) {
                    return (currencyFormat(row.valueUSD));
                }
            }
        }]
    });
    loadData2(pathParams, tableName, true, "data", 'internal', 'Internal Txs')
}

var initinternal = false;
var tableInternal = null

function showinternal(address) {
    if (initinternal) return;
    else initinternal = true;

    let pathParams = `evmtx/${address}?group=internal`
    let tableName = '#tableinternal'
    tableInteranl = $(tableName).DataTable({
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-left",
            "targets": [0, 1]
        }, {
            "className": "dt-center",
            "targets": [2, 3, 4]
        }],
        order: [
            [4, "desc"]
        ],
        columns: [{
            data: 'transactionHash',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        if (row.transactionHash != undefined) {
                            let s = presentTxHash(row.transactionHash);
                            return `${s}`
                        } else if (row.extrinsicID != undefined && row.extrinsicHash != undefined) {
                            let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                            return `Substrate ${presentChain(row.id, row.chainName)} (${s})`
                        } else {
                            //console.log(row);
                        }
                    } catch (e) {
                        console.log(row);
                    }
                }
                if (row.extrinsicID != undefined) {
                    return row.extrinsicID;
                }
                return "";
            }
        }, {
            data: 'blockNumber',
            render: function(data, type, row, meta) {
                return presentBlockNumber(row.chainID, "", row.blockNumber);
            }
        }, {
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
        }, {
            data: 'from',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentAddress(data);
                }
                return "nfrom";
            }
        }, {
            data: 'to',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentAddress(data);
                }
                return "ndest";
            }
        }, {
            data: 'value',
            render: function(data, type, row, meta) {
                if (row.value != undefined) {
                    return row.value;
                } else {
                    return 0;
                }
            }
        }]
    });

    loadData2(pathParams, tableName, true, "data", 'internal', 'Internal Txs')
}