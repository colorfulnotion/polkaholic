var initextrinsics = false;

function showextrinsics(filter) {
    let tableName = '#tableextrinsics'
    if (initextrinsics) {} else {
        initextrinsics = true;
        var table = $(tableName).DataTable({
            dom: 'lfrtipB',
            buttons: [{
                extend: 'csv',
                text: 'Download CSV',
                filename: `extrinsics`,
                exportOptions: {
                    orthogonal: 'export'
                }
            }],
            order: [
                [5, "desc"]
            ],
            columnDefs: [{
                "className": "dt-center",
                "targets": [3, 4]
            }],
            columns: [{
                data: 'section',
                render: function(data, type, row, meta) {
                    try {
                        if (type == 'display') {
                            return presentExtrinsic(row.chainID, row.section, row.method)
                        } else {
                            return row.section + ":" + row.method;
                        }
                    } catch (e) {
                        return "";
                    }
                }
            }, {
                data: 'extrinsicID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                    }
                    return data;
                }
            }, {
                data: 'extrinsicHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTxHash(row.extrinsicHash);
                    }
                    return data;
                }
            }, {
                data: 'fromAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentIDRow(row, 'fromAddress');
                    }
                    return data;
                }
            }, {
                data: 'result',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentSuccessFailure(data > 0);
                    }
                    return data;
                }
            }, {
                data: 'blockTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTS(data);
                    }
                    return data;
                }
            }]
        });
    }
    let pathParams = `search/extrinsics`
    postData(pathParams, filter, tableName);
    setupapidocs("search", "extrinsics", filter);
}

var inittransfers = false;

function showtransfers(filter) {
    let tableName = '#tabletransfers'
    if (inittransfers) {} else {
        inittransfers = true;

        var table = $(tableName).DataTable({
            dom: 'lfrtipB',
            buttons: [{
                extend: 'csv',
                text: 'Download CSV',
                filename: `transfers`,
                exportOptions: {
                    orthogonal: 'export'
                }
            }],
            order: [
                [6, "desc"]
            ],
            columnDefs: [{
                "className": "dt-center",
                "targets": [1, 2, 3]
            }, {
                "className": "dt-right",
                "targets": [4, 5]
            }, ],
            columns: [{
                data: 'extrinsicID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let s = presentChain(row.chainID, row.chainName)
                        return s + " " + presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                    }
                    return data;
                }
            }, {
                data: 'section',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentExtrinsic(row.chainID, row.section, row.method)
                    }
                    return data;
                }
            }, {
                data: 'fromAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentIDRow(row, 'fromAddress');
                    }
                    return data;
                }
            }, {
                data: 'toAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentIDRow(row, 'toAddress');
                    }
                    return data;
                }
            }, {
                data: 'amount',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentNumber(data) + " " + row.symbol;
                    }
                    return data;
                }
            }, {
                data: 'amountUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return currencyFormat(data);
                    }
                    return data;
                }
            }, {
                data: 'blockTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTS(data);
                    }
                    return data;
                }
            }]
        });
    }
    let pathParams = `search/transfers`
    postData(pathParams, filter, tableName);
    setupapidocs("search", "transfers", filter);
}

var initevmtxs = false;

function showevmtxs(filter) {
    let tableName = '#tableevmtxs'
    if (initevmtxs) {} else {
        initevmtxs = true;
        var table = $(tableName).DataTable({
            dom: 'lfrtipB',
            buttons: [{
                extend: 'csv',
                text: 'Download CSV',
                filename: `transactions`,
                exportOptions: {
                    orthogonal: 'export'
                }
            }],
            order: [
                [5, "desc"]
            ],
            columnDefs: [{
                "className": "dt-center",
                "targets": [4, 5]
            }],
            columns: [{
                data: 'method',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentExtrinsic(row.chainID, row.method, row.methodID, true)
                    } else {
                        return row.method + " " + row.methodID
                    }
                    return data;
                }
            }, {
                data: 'transactionHash',
                render: function(data, type, row, meta) {
                    let transactionHash = "";
                    if (type == 'display') {
                        return presentTxHash(data);
                    }
                    return data;
                }
            }, {
                data: 'fromAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentIDRow(row, 'fromAddress');
                    }
                    return data;
                }
            }, {
                data: 'toAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.creates) {
                            return "CONTRACT CREATES: " + presentID(row.creates);
                        } else {
                            return presentIDRow(row, 'toAddress');
                        }
                    }
                    return data;
                }
            }, {
                data: 'result',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentSuccessFailure(data > 0);
                    }
                    return data;
                }
            }, {
                data: 'blockTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTS(data);
                    }
                    return data;
                }
            }]
        });
    }
    let pathParams = `search/evmtxs`
    postData(pathParams, filter, tableName);
    setupapidocs("search", "evmtxs", filter);
}

var initevents = false;


function showevents(filter) {
    let tableName = '#tableevents'
    if (initevents) {} else {
        initevents = true;

        var table = $(tableName).DataTable({
            dom: 'lfrtipB',
            buttons: [{
                extend: 'csv',
                text: 'Download CSV',
                filename: `events`,
                exportOptions: {
                    orthogonal: 'export'
                }
            }],
            order: [
                [4, "desc"]
            ],
            columnDefs: [{
                "className": "dt-center",
                "targets": [2, 3, 4]
            }],
            columns: [{
                data: 'section',
                render: function(data, type, row, meta) {
                    try {
                        if (type == 'display') {
                            return presentExtrinsic(row.chainID, row.section, row.method)
                        } else {
                            return row.section + ":" + row.method
                        }
                        return data;
                    } catch (e) {
                        return "";
                    }
                }
            }, {
                data: 'eventID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentEventDetails(row.eventID)
                    }
                    return data;
                }
            }, {
                data: 'extrinsicID',
                render: function(data, type, row, meta) {
                    try {
                        let [extrinsicID, _] = parseEventID(row.eventID);
                        if (type == 'display') {
                            return presentExtrinsicIDHash(extrinsicID, row.extrinsicHash);
                        }
                        return extrinsicID;
                    } catch (e) {
                        return "";
                    }
                }
            }, {
                data: 'extrinsicHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTxHash(row.extrinsicHash);
                    }
                    return data;
                }
            }, {
                data: 'blockNumber',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentBlockNumber(row.chainID, false, data);
                    }
                    return data;
                }
            }, {
                data: 'blockTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentTS(data);
                    }
                    return data;
                }
            }]
        });
    }
    let pathParams = `search/events`
    postData(pathParams, filter, tableName);
    setupapidocs("search", "events", filter);
}


// when user adjusts "Dimension" select box, one of the block/date ranges  will be visible, whereas the other will not
function changedDimension() {
    const stylesheet = document.styleSheets[0];
    let x = document.getElementById("dimension");

    for (let i = 0; i < stylesheet.cssRules.length; i++) {
        if (stylesheet.cssRules[i].selectorText === '.blockvisible') {
            if (x.value == "block") {
                stylesheet.cssRules[i].style.setProperty("display", "block");
            } else {
                stylesheet.cssRules[i].style.setProperty("display", "none");
            }
        } else if (stylesheet.cssRules[i].selectorText === '.datevisible') {
            if (x.value == "date") {
                stylesheet.cssRules[i].style.setProperty("display", "block");
            } else {
                stylesheet.cssRules[i].style.setProperty("display", "none");
            }
        }
    }
}

// on load of the page, the sections will be visible
function loadSections() {
    var sections = {};
    let dataList = document.getElementById("sectionOptions");
    for (var i = 0; i < sectionMethods.length; i++) {
        let e = sectionMethods[i];
        let section = e.section;
        if (sections[section] == undefined) {
            var option = document.createElement('option');
            option.value = section;
            option.text = section;
            dataList.appendChild(option);
            sections[section] = true;
        }
    }
}

// on changing the section, the methods will change
function changedSection() {
    var selectedSection = document.getElementById("section").value;
    console.log("changedSection", selectedSection);
    let dataList = document.getElementById("methodOptions");
    var methods = {};
    for (var i = 0; i < sectionMethods.length; i++) {
        let e = sectionMethods[i];
        let section = e.section;
        if (section == selectedSection) {
            let method = e.method;
            if (methods[method] == undefined) {
                var option = document.createElement('option');
                option.value = method;
                option.text = method;
                dataList.appendChild(option);
                methods[method] = true;
            }
        }
    }
}

// when the user clicks "Search", a POST will be initiated by calling showextrinsics or showevents depending on the table input -- the filter is assembled from the elements on the page
function submitQuery(chainID, tbl) {
    let filter = {}
    var selectedSection = document.getElementById("section");
    var selectedMethod = document.getElementById("method");
    if (selectedSection) {
        if (selectedSection.value != undefined && selectedSection.value.length > 0) filter.section = selectedSection.value;
    }
    if (selectedMethod) {
        if (selectedMethod.value != undefined && selectedMethod.value.length > 0) filter.method = selectedMethod.value;
    }

    let dimension = document.getElementById("dimension").value;
    if (dimension == "block") {
        var blockNumberStart = document.getElementById("blockNumberStart").value;
        var blockNumberEnd = document.getElementById("blockNumberEnd").value;
        if (blockNumberStart.length > 0) filter.blockNumberStart = blockNumberStart;
        if (blockNumberEnd.length > 0) filter.blockNumberEnd = blockNumberEnd;
    } else if (dimension == "date") {
        var startDate = document.getElementById("startDate").value;
        var endDate = document.getElementById("endDate").value;
        if (startDate.length > 0) filter.startDate = startDate;
        if (endDate.length > 0) filter.endDate = endDate;
    }
    if (tbl == "extrinsics" || tbl == "evmtxs" || tbl == "xcmtransfers" || tbl == "transfers") {
        var selectedFromAddress = document.getElementById("fromAddress").value;
        if (selectedFromAddress.length > 10) filter.fromAddress = selectedFromAddress;
    }
    if (tbl == "xcmtransfers" || tbl == "evmtxs" || tbl == "transfers") {
        var selectedToAddress = document.getElementById("toAddress").value;
        if (selectedToAddress.length > 10) filter.toAddress = selectedToAddress;
    }
    if (tbl == "xcmtransfers" || tbl == "xcmmessages" || tbl == "transfers") {
        var selectedChainID = document.getElementById("chainID").value;
        if (selectedChainID.length > 0 && selectedChainID != "all") filter.chainID = selectedChainID;
    } else if (chainID != undefined && (chainID != "all")) {
        filter.chainID = chainID;
    }

    if (tbl == "xcmtransfers") {
        var selectedComplete = document.getElementById("complete").value;
        if (selectedComplete.length > 0) filter.complete = selectedComplete;
    }
    if (tbl == "xcmmessages") {
        var selectedMsgType = document.getElementById("msgType").value;
        var selectedRelayChain = document.getElementById("relayChain").value;
        if (selectedMsgType && selectedMsgType.length > 0) filter.msgType = selectedMsgType;
        if (selectedRelayChain && selectedRelayChain.length > 0) filter.relayChain = selectedRelayChain;
    }
    if (tbl == "xcmtransfers" || (tbl == "xcmmessages")) {
        var selectedChainIDDest = document.getElementById("chainIDDest").value;
        if (selectedChainIDDest.length > 0 && selectedChainIDDest != "all") filter.chainIDDest = selectedChainIDDest;
    }

    if (tbl == "extrinsics") {
        var selectedResult = document.getElementById("result").value;
        if (selectedResult.length > 0) filter.result = selectedResult;

        var selectedSigned = document.getElementById("signed").value;
        if (selectedSigned.length > 0) filter.signed = selectedSigned;
    }
    if (tbl == "evmtxs") {
        var selectedMethodID = document.getElementById("methodID").value;
        if (selectedMethodID.length > 0) filter.methodID = selectedMethodID;

        var selectedResult = document.getElementById("result").value;
        if (selectedResult.length > 0) filter.result = selectedResult;

        var selectedCreates = document.getElementById("creates").value;
        if (selectedCreates.length > 0) filter.creates = selectedCreates;
    }
    if (tbl == "transfers") {
        var selectedSymbol = document.getElementById("symbol").value;
        if (selectedSymbol.length > 0) filter.symbol = selectedSymbol;
    }
    console.log(filter);
    if (tbl == "extrinsics") {
        showextrinsics(filter);
    } else if (tbl == "events") {
        showevents(filter);
    } else if (tbl == "evmtxs") {
        showevmtxs(filter);
    } else if (tbl == "transfers") {
        showtransfers(filter);
    } else if (tbl == "xcmtransfers") {
        showxcmtransfers(filter);
    } else if (tbl == "xcmmessages") {
        showxcmmessages(filter);
    }
}