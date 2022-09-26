let tableExtrinsics = null;
let tableEVMTxs = null;
let tableTransfers = null;
let tableXCMTransfers = null;
let tableRewards = null;
let tableFeed = null;
let tableHistory = null;
let tableNFTs = null;
let tableCrowdloans = null;
let tableSS58H160 = null;
let tableOffers = null;
let tableRelated = null;

var initextrinsics = false;

function getLengthMenu() {
    return [
        [10, 20, 25, 50, 100, 500],
        ["max 10", "max 20", "max 500 (25/page)", "max 1K (50/page)", "max 10K (100/page)", "max 10K (500/page)"]
    ];
}

function showextrinsics(address, chainListStr = 'all') {
    if (initextrinsics) return;
    else initextrinsics = true;
    let pathParams = `account/${address}?group=extrinsics&chainfilters=${chainListStr}`
    let tableName = '#tableextrinsics'
    tableExtrinsics = $(tableName).DataTable({
        dom: 'lfrtipB',
        buttons: [{
            extend: 'csv',
            text: 'Download CSV',
            filename: `${address}-extrinsics`,
            exportOptions: {
                orthogonal: 'export'
            }
        }],
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-center",
            "targets": [3, 4]
        }, {
            "targets": [5],
            "visible": false
        }],
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
                            // console.log(row);
                        }
                    } catch (e) {
                        console.log(e);
                    }
                }
                if (row.extrinsicID != undefined) {
                    return data;
                }
                return "";
            }
        }, {
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
                        return `${row.section}:${row.method}`
                    } else {
                        return "-";
                    }
                }
                return data;
            }
        }, {
            data: 'params',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let out = "";
                    if (row.method !== undefined && row.extrinsicHash !== undefined) {
                        try {
                            return presentInstructions(JSON.stringify(row.params), "e" + row.extrinsicHash, "Params", {
                                verification: "extrinsic",
                                obj: row.params,
                                id: row.id,
                                extrinsicID: row.extrinsicID,
                                extrinsicHash: row.extrinsicHash
                            });
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
        }, {
            data: 'result',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    //let res = (row.result == 1) ? 'Success' : 'Failed'
                    let txStatus = presentSuccessFailure(row.result, row.err)
                    return txStatus;
                }
                return data;
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
            data: 'id',
            render: function(data, type, row, meta) {
                if (row.id) {
                    return data;
                } else {
                    return "";
                }
            }
        }, ]
    });

    $(tableName).on('length.dt', function(e, settings, len) {
        loadData2(pathParams, tableName, true, "data", 'feed', 'Feeds')
    });
    loadData2(pathParams, tableName, true, "data", 'feed', 'Feeds')
}


var initevmtxs = false;

function showevmtxs(address, chainListStr = 'all') {
    if (initevmtxs) return;
    else initevmtxs = true;
    let pathParams = `account/${address}?group=evmtxs&chainfilters=${chainListStr}`

    let tableName = '#tableevmtxs'
    tableEVMTxs = $(tableName).DataTable({
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-right",
            "targets": [7, 6]
        }, {
            "className": "dt-center",
            "targets": [2, 3]
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
            data: 'section',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.decodedInput !== undefined && row.transactionHash !== undefined) {
                        let methodID = row.decodedInput.methodID
                        return '<button type="button" class="btn btn-outline-primary text-capitalize">' + methodID + '</button>';
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
        }, {
            data: 'blockNumber',
            render: function(data, type, row, meta) {
                let s = (row.id != undefined) && (row.chainName != undefined) ? presentChain(row.id, row.chainName) + " " : "";
                return s + presentBlockNumber(row.chainID, "", row.blockNumber);
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
                if (address && data) {
                    if (type == 'display') {
                        if (data.toLowerCase() == address.toLowerCase()) {
                            return getShortHash(data, false);
                        } else {
                            return presentAddress(data);
                        }
                    } else {
                        return "-"
                    }
                }
                return "";
            }
        }, {
            data: 'to',
            render: function(data, type, row, meta) {
                if (row.to != undefined) {
                    if (type == 'display') {
                        if (address && (data == address)) {
                            return getShortHash(data, false);
                        } else {
                            return presentAddress(data);
                        }
                    }
                    return data;
                }
                return "";
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
        }, {
            data: 'fee',
            render: function(data, type, row, meta) {
                if (row.fee != undefined) {
                    return row.fee;
                } else {
                    return "nfee";
                }
            }
        }, ]
    });

    $(tableName).on('length.dt', function(e, settings, len) {
        loadData2(pathParams, tableName, true, "data", 'evmtxs', 'Transactions')
    });
    loadData2(pathParams, tableName, true, "data", 'evmtxs', 'Transactions')
}

var initfeed = false;

function showfeed(address, chainListStr = 'all') {
    if (initfeed) return;
    else initfeed = true;
    let pathParams = `account/${address}?group=feed&chainfilters=${chainListStr}`
    let tableName = '#tablefeed'
    tableFeed = $(tableName).DataTable({
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-center",
            "targets": [3, 4, 5]
        }, {
            "targets": [6],
            "visible": false
        }],
        order: [
            [2, "desc"]
        ],
        columns: [{
            data: 'fromAddress',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentIDwithIdenticon(data)
                }
                return data;
            }
        }, {
            data: 'blockNumber',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentBlockNumber(row.chainID, row.chainName, data)
                }
                return data;
            }
        }, {
            data: 'ts',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return timeConverter(data);
                }
                return data;
            }
        }, {
            data: 'result',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    //let res = (row.result == 1) ? 'Success' : 'Failed'
                    let txStatus = presentSuccessFailure(row.result, row.err)
                    return txStatus;
                }
                return data;
            }
        }, {
            data: 'section',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.method !== undefined && row.section !== undefined) {
                        return presentExtrinsic(row.id, row.method, row.section)
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
        }, {
            data: 'params',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentInstructions(JSON.stringify(data), row.extrinsicHash, "Params");
                } else {
                    if (row.method !== undefined) {
                        return row.method;
                    } else {
                        return "-";
                    }
                }
                return data;
            }
        }, {
            data: 'id',
            render: function(data, type, row, meta) {
                return data;
            }
        }]
    });

    $(tableName).on('length.dt', function(e, settings, len) {
        loadData2(pathParams, tableName, true, "data", 'feed', 'Feed')
    });

    loadData2(pathParams, tableName, true, "data", 'feed', 'Feed')
}

var inittransfers = false;

function showtransfers(address, chainListStr = 'all') {
    if (inittransfers) {
        return;
    } else inittransfers = true;
    let pathParams = `account/${address}?group=transfers&chainfilters=${chainListStr}`
    let tableName = '#tabletransfers'
    tableTransfers = $(tableName).DataTable({
        dom: 'lfrtipB',
        buttons: [{
            extend: 'csv',
            text: 'Download CSV',
            filename: `${address}-transfers`,
            exportOptions: {
                orthogonal: 'export'
            }
        }],
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-right",
            "targets": [4, 5]
        }, {
            "targets": [7],
            "visible": false
        }],
        order: [
            [6, "desc"]
        ],
        columns: [{
            data: 'eventID',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let eventID = false;
                    if (row.eventID != undefined) {
                        //"eventID": "2012-1185872-5-21",
                        let eventIDPieces = row.eventID.split('-')
                        if (eventIDPieces.length == 4) {
                            eventID = `${eventIDPieces[1]}-${eventIDPieces[3]}`
                        }
                    }
                    let s = presentExtrinsicIDHash(eventID, row.extrinsicHash, false);
                    return `${presentChain(row.chainID, row.chainName)} (${s})`
                }
                return data;
            }
        }, {
            data: 'from',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.from.toLowerCase() == address) {
                        return getShortHash(data, false);
                    } else {
                        return presentIDRow(row, 'from');
                    }
                }
                return data;
            }
        }, {
            data: 'to',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.to.toLowerCase() == address) {
                        return getShortHash(data, false);
                    } else {
                        return presentIDRow(row, 'to');
                    }
                }
                return data;
            }
        }, {
            data: 'transferType',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.transferType == 'incoming') {
                        return '<button type="button" class="btn transfer" style="background-color:rgba(0,201,167,.2); color:#02977e">' + "IN" + '</button>';
                    } else {
                        return '<button type="button" class="btn transfer" style="background-color:rgba(219,154,4,.2); color:#b47d00">' + "OUT" + '</button>';
                    }
                }
                return data;
            }
        }, {
            data: 'rawAmount',
            render: function(data, type, row, meta) {
                try {
                    let val = ""; //dechexToInt(data);
                    let dData = row.decodedData
                    if (dData != undefined) {
                        if (dData.symbol != undefined && dData.dataRaw != undefined) {
                            val = dData.dataRaw + " " + dData.symbol
                        } else {
                            val = `${row.rawAmount} Asset (decimal unknown)`
                        }
                    }
                    return presentInstructions(JSON.stringify(row.data), "e" + row.eventID, val, {
                        verification: "event",
                        id: row.id,
                        eventID: row.eventID
                    });
                } catch (e) {
                    return "";
                }
            }
        }, {
            data: 'amountUSD',
            render: function(data, type, row, meta) {
                let val = null;
                let priceUSD = null;
                let priceUSDCurrent = null;
                let dData = row.decodedData
                if (dData != undefined) {
                    if (dData.symbol != undefined && dData.dataRaw != undefined) {
                        if (dData.dataUSD !== undefined) {
                            val = dData.dataUSD;
                            priceUSD = dData.priceUSD;
                            priceUSDCurrent = dData.priceUSDCurrent;
                        }
                    }
                }
                if (type == 'display') {
                    if (val) {
                        return currencyFormat(val, priceUSD, priceUSDCurrent)
                    }
                } else {
                    if (val) {
                        return (val);
                    }
                }
                return 0;
            }
        }, {
            data: 'ts',
            render: function(data, type, row, meta) {
                if (type == 'export') {
                    return data;
                }
                let tinyms = 0;
                let eventID = row.eventID
                if (eventID != undefined) {
                    //"eventID": "2012-1185872-5-21",
                    let eventIDPieces = eventID.split('-')
                    if (eventIDPieces.length == 4) {
                        tinyms = 0.001 * eventIDPieces[3]
                    }

                }
                if (type == 'display') {
                    return presentTS(data);
                }
                return (data + tinyms);
            }
        }, {
            data: 'id',
            render: function(data, type, row, meta) {
                return data;
            }
        }]
    });

    $(tableName).on('length.dt', function(e, settings, len) {
        loadData2(pathParams, tableName, true, "data", 'transfers', 'Transfers')
    });
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });

    loadData2(pathParams, tableName, true, "data")
}


let initcurrent = false;


var initxcmtransfers = false;

function showxcmtransfers(address, chainListStr = 'all') {
    if (initxcmtransfers) return;
    else initxcmtransfers = true;
    let pathParams = `account/${address}?group=xcmtransfers&chainfilters=${chainListStr}`
    let tableName = '#tablexcmtransfers'
    tableXCMTransfers = $(tableName).DataTable({
        dom: 'lfrtipB',
        buttons: [{
            extend: 'csv',
            text: 'Download CSV',
            filename: `${address}-xcmtransfers`,
            exportOptions: {
                orthogonal: 'export'
            }
        }],
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 2, 3],
            "searchable": false,
        }, {
            "targets": [4, 5, 6, 7],
            "searchable": false,
        }, {
            "targets": [8, 9],
            "visible": false,
            "searchable": true,
        }],
        order: [
            [4, "desc"]
        ],
        columns: [{
            data: 'section',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentExtrinsic(row.id, row.section, row.method);
                }
                return data;
            }
        }, {
            data: 'amountSent',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        let parsedAsset = JSON.parse(row.asset);
                        let symbol = parsedAsset.Token;
                        if (symbol !== undefined) {
                            row.symbol = symbol;
                            return presentTokenCount(data) + " " + presentAsset(row);
                        } else {
                            return row.asset;
                        }
                    } catch (err) {
                        return "unk";
                    }
                } else {
                    try {
                        let parsedAsset = JSON.parse(row.asset);
                        let symbol = parsedAsset.Token;
                        return data + " " + symbol;
                    } catch (err) {
                        return "unk";
                    }
                    return data;
                }
            }
        }, {
            data: 'amountSentUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.amountSentUSD !== undefined) {
                        return currencyFormat(row.amountSentUSD, row.priceUSD, row.priceUSDCurrent);
                    } else {
                        console.log("missing amountSentUSD", row);
                        return "--";
                    }
                }
                return data;
            }
        }, {
            data: 'fromAddress',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.fromAddress !== undefined) {
                        let sender = (row.sender) ? row.sender : row.fromAddress
                        if (row.fromAddress.toLowerCase() == address) {
                            return presentRawIDwithIdenticon(sender);
                            //return getShortHash(sender, false);
                        } else {
                            return presentIDwithIdenticon(sender);
                        }
                    } else {
                        console.log("missing fromAddress", row);
                    }
                }
                return data;
            }
        }, {
            data: 'destAddress',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.destAddress !== undefined) {
                        let beneficiary = (row.beneficiary) ? row.beneficiary : row.destAddress
                        if (row.destAddress.toLowerCase() == address.toLowerCase()) {
                            return presentRawIDwithIdenticon(beneficiary);
                            //return getShortHash(beneficiary, false);
                        } else {
                            return presentIDwithIdenticon(beneficiary);
                        }
                    } else {
                        console.log("missing destAddress", row);
                    }
                }
                return data;
            }
        }, {
            data: 'id',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                    let timelineURL = `/timeline/${row.extrinsicHash}`
                    let timelineLink = `<div class="explorer"><a href="${timelineURL}">timeline</a></div>`
                    return `${presentChain(row.id, row.chainName)} (${s})` + timelineLink;
                }
                return data;
            }
        }, {
            data: 'chainIDDest',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        if (row.chainIDDest != undefined && row.chainDestName) {
                            if (row.incomplete !== undefined && row.incomplete > 0) {
                                return "INCOMPLETE";
                            } else if (row.blockNumberDest) {
                                return presentBlockNumber(row.idDest, row.chainDestName, row.blockNumberDest);
                            } else {
                                return presentChain(row.idDest, row.chainDestName);
                            }
                        } else {
                            return "-"
                        }
                    } catch (err) {
                        console.log(err);
                    }
                }
                return data;
            }
        }, {
            data: 'sourceTS',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.sourceTS !== undefined) {
                        let s = presentTS(row.sourceTS);
                        return s;
                    } else {
                        return "--";
                    }
                }
                return data;
            }
        }, {
            data: 'id',
            render: function(data, type, row, meta) {
                return data;
            }
        }, {
            data: 'idDest',
            render: function(data, type, row, meta) {
                return data;
            }
        }]
    });

    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
    $(tableName).on('length.dt', function(e, settings, len) {
        loadData2(pathParams, tableName, true, false, 'xcmtransfers', "XCM Transfers")
    });
    loadData2(pathParams, tableName, true, false, 'xcmtransfers', "XCM Transfers")
}

var initrewards = false;

function showrewards(address, chainListStr = 'all') {
    if (initrewards) return;
    else initrewards = true;
    let pathParams = `account/${address}?group=rewards&chainfilters=${chainListStr}`
    let tableName = '#tablerewards'
    tableRewards = $(tableName).DataTable({
        dom: 'lfrtipB',
        buttons: [{
            extend: 'csv',
            text: 'Download CSV',
            filename: `${address}-rewards`,
            exportOptions: {
                orthogonal: 'export'
            }
        }],
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-right",
            "targets": [2]
        }, {
            "targets": [7],
            "visible": false
        }],
        order: [
            [4, "desc"]
        ],
        columns: [{
            data: 'asset',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        let parsedAsset = JSON.parse(row.asset);
                        let symbol = parsedAsset.Token;
                        if (symbol !== undefined) {
                            row.symbol = symbol
                            return presentAsset(row);
                        } else {
                            return row.asset;
                        }
                    } catch (err) {
                        console.log("row.asset", row.asset, err);
                    }
                }
                return data;
            }
        }, {
            data: 'amount',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        return presentTokenCount(data);
                    } catch (err) {
                        console.log(err);
                    }
                }
                return data;
            }
        }, {
            data: 'amountUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.amountUSD !== undefined) {
                        return currencyFormat(row.amountUSD, row.priceUSD, row.priceUSDCurrent);
                    } else {
                        console.log("missing amountUSD", row);
                        return "--";
                    }
                }
                return data;
            }
        }, {
            data: 'extrinsicHash',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                    return `${presentChain(row.chainID, row.chainName)} (${s})`
                }
                return data;
            }
        }, {
            data: 'section',
            render: function(data, type, row, meta) {
                try {
                    if (row.section && row.method) {
                        return `${row.section}(${row.method})`
                    }
                } catch (err) {
                    console.log(err);
                }
                return "";
            }
        }, {
            data: 'ts',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.ts !== undefined) {
                        let s = presentTS(row.ts);
                        return s;
                    } else {
                        return "--";
                    }
                }
                return data;
            }
        }, {
            data: 'era',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.era !== undefined) {
                        return row.era;
                    } else {
                        return "--";
                    }
                } else {
                    if (row.era !== undefined) {
                        return row.era;
                    } else {
                        return "--";
                    }
                }
            }
        }, {
            data: 'id',
            render: function(data, type, row, meta) {
                return data;
            }
        }]
    });
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
    $(tableName).on('length.dt', function(e, settings, len) {
        loadData2(pathParams, tableName, true, "data", "rewards", "Rewards")
    });
    loadData2(pathParams, tableName, true, "data", "rewards", "Rewards")
}


var initcrowdloans = false;

function showcrowdloans(address, chainListStr = 'all') {
    if (initcrowdloans) return;
    else initcrowdloans = true;
    let pathParams = `account/${address}?group=crowdloans&chainfilters=${chainListStr}`
    let tableName = '#tablecrowdloans'
    tableCrowdloans = $(tableName).DataTable({
        dom: 'lfrtipB',
        buttons: [{
            extend: 'csv',
            text: 'Download CSV',
            filename: `${address}-crowdloans`,
            exportOptions: {
                orthogonal: 'export'
            }
        }],
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-right",
            "targets": [2, 3]
        }],
        order: [
            [5, "desc"]
        ],
        columns: [{
            data: 'chainIDDest',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.chainDestName !== undefined) {
                        let subexplorerURL = `https://${row.id}.polkaholic.io`;
                        let links = [`<a href='${subexplorerURL}'>explorer</a>`];
                        if (row.dappURL) {
                            links.push(`<a href='${row.dappURL}'>app</a>`);
                        }
                        if (row.parachainsURL) {
                            links.push(`<a href='${row.parachainsURL}'>parachains.info</a>`);
                        }
                        let links_str = "<div class='explorer'>" + links.join(" | ") + "</div>";
                        return presentChain(row.chainIDDest, row.chainDestName, row.iconUrl) + links_str;
                    } else {
                        return row.chainIDDest;
                    }
                } else {
                    if (row.chainIDDest !== undefined) {
                        return row.chainIDDest;
                    } else {
                        return "--";
                    }
                }
            }
        }, {
            data: 'asset',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        let parsedAsset = JSON.parse(row.asset);
                        let symbol = parsedAsset.Token;
                        if (symbol !== undefined) {
                            row.symbol = symbol;
                            return presentAsset(row);
                        } else {
                            return row.asset;
                        }
                    } catch (err) {
                        console.log("row.asset", row.asset, err);
                    }
                }
                return data;
            }
        }, {
            data: 'amount',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        return presentTokenCount(data);
                    } catch (err) {
                        console.log(err);
                    }
                }
                return data;
            }
        }, {
            data: 'amountUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.amountUSD !== undefined) {
                        return currencyFormat(row.amountUSD, row.priceUSD, row.priceUSDCurrent);
                    } else {
                        console.log("missing amountUSD", row);
                        return "--";
                    }
                }
                return data;
            }
        }, {
            data: 'extrinsicHash',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                    return `${presentChain(row.chainID, row.chainName)} (${s})`
                }
                return data;
            }
        }, {
            data: 'ts',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.ts !== undefined) {
                        let s = presentTS(row.ts);
                        return s;
                    } else {
                        return "--";
                    }
                }
                return data;
            }
        }]
    });
    $(tableName).on('length.dt', function(e, settings, len) {
        loadData2(pathParams, tableName, true, "data", 'crowdloans', 'Crowdloans')
    });
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
    loadData2(pathParams, tableName, true, "data", 'crowdloans', 'Crowdloans')
}

var initnfts = false;

function shownfts(address, chainListStr = 'all') {
    //setupapidocs("account", "nfts", address);
    if (initnfts) return;
    else initnfts = true;

    let pathParams = `account/${address}?group=nfts&chainfilters=${chainListStr}`
    let tableName = '#tablenfts'
    tableNFTs = $(tableName).DataTable({
        columns: [{
            data: 'metadata',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNFT(data, row.metadata);
                }
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, true, "data")
}

var initss58h160 = false;

function showss58h160(address, chainListStr = 'all') {
    if (initss58h160) return;
    else initss58h160 = true;
    let pathParams = `account/${address}?group=ss58h160`
    let tableName = '#tabless58h160'
    tableSS58H160 = $(tableName).DataTable({
        columns: [{
            data: 'title',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentSS58H160(row.url, row.linktype, row.title, row.description, row.metadata);
                } else {
                    return row.title + " " + row.description;
                }
            }
        }]
    });
    loadData2(pathParams, tableName, true, false, "ss58h160", "SS58 Address")
}

var initoffers = false;

function showoffers(address, chainListStr = 'all') {
    if (initoffers) return;
    else initoffers = true;
    let pathParams = `account/${address}?group=offers&chainfilters=${chainListStr}`
    let tableName = '#tableoffers'

    tableOffers = $(tableName).DataTable({
        columns: [{
            data: 'description',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentOffer(row);
                } else {
                    return ""
                }
            }
        }]
    });
    loadData2(pathParams, tableName, true, false, "offers", "Offers")
}

var initrelated = false;

function showrelated(address, chainListStr = 'all') {
    if (initrelated) return;
    else initrelated = true;
    let pathParams = `account/${address}?group=related`
    let tableName = '#tablerelated'
    tableRelated = $(tableName).DataTable({
        columns: [{
            data: 'related',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let id = Math.floor(Math.random() * 2000000000)
                    return presentRelated(row, id);
                } else {
                    return "";
                }
            }
        }]
    });
    loadData2(pathParams, tableName, true, false, "related", "Multisig/Proxy/Related", )
}

var inithistory = false;

function showhistory(address, chainListStr = 'all') {
    let url = `${baseURL}/account/${address}?group=balances`
    console.log("showhistory", url);
    Highcharts.getJSON(url, function(data) {
        Highcharts.stockChart('container', {
            rangeSelector: {
                selected: 1
            },
            title: {
                text: 'Account Balances (USD)'
            },
            series: [{
                name: 'Balances',
                data: data,
                tooltip: {
                    valueDecimals: 2
                }
            }]
        });
    });
}