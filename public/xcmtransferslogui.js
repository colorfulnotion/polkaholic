
let xcmtransferslogTable = null;
let initxcmtransferslog = false;

async function showxcmtransferslog(chainID_or_chainName, chainIDDest_or_chainName) {
    let pathParams = `xcmtransferslog`
    if ( chainID_or_chainName ) {
      pathParams += "/" + chainID_or_chainName;
      if ( chainIDDest_or_chainName ) {
        pathParams += "/" + chainIDDest_or_chainName;
      }
    }
    let tableName = '#tablexcmtransferslog'
    if (initxcmtransferslog) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initxcmtransferslog = true;
        xcmtransferslogTable = $(tableName).DataTable({
            dom: 'lfrtipB',
            buttons: [{
                extend: 'csv',
                text: 'Download CSV',
                filename: `xcmtransfers`,
                exportOptions: {
                    orthogonal: 'export'
                }
            }],
            pageLength: 50,
            lengthMenu: [
                [10, 25, 50, 100],
                [10, 25, 50, 100]
            ],
            columnDefs: [{
                "className": "dt-right",
                "targets": [1, 2, 3]
            }],
            order: [
                [0, "desc"]
            ],

            columns: [{
                data: 'addTS',
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
                data: 'extrinsicHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let s = presentExtrinsicIDHash(row.xcmInfo.origination.extrinsicID, row.extrinsicHash, false);
                        return `${presentChain(row.xcmInfo.origination.id, row.xcmInfo.origination.id)} (${s}) `
                    } else {
                        try {
                            return data + " " + row.xcmInfo.origination.extrinsicID + " " + row.extrinsicHash;
                        } catch (e) {
                            return ""
                        }
                    }
                }
            }, {
                data: 'chainIDDest',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            let pendingStr = `<button type="button" class="btn btn-info text-capitalize">Pending</button>`
                            let str = `<button type="button" class="btn btn-warning text-capitalize">Unknown</button>`
                            let unk = true;
                            let blockNumberDest = null;
                            if (row.xcmInfo && ((row.xcmInfo.status == undefined) || row.xcmInfo.destination && row.xcmInfo.destination.executionStatus != undefined)) {
                                if (row.xcmInfo.destination.blockNumber) {
                                    blockNumberDest = row.xcmInfo.destination.blockNumber
                                }
                                if (row.xcmInfo.status == true || row.xcmInfo.destination.executionStatus == 'success') {
                                    str = `<button type="button" class="btn btn-success text-capitalize">Success</button>`
                                    unk = false;
                                } else if (row.xcmInfo.destination.error && row.xcmInfo.destination.error.errorType) {
                                    str = `<button type="button" class="btn btn-danger text-capitalize">${row.xcmInfo.destination.error.errorType}</button>`
                                    unk = false;
                                }
                            }
                            if (unk) {
                                let secondsago = Math.floor(Date.now() / 1000) - row.sourceTS;
                                if (secondsago <= 90) {
                                    str = pendingStr
                                }
                                //console.log(row.xcmInfo);
                            }
                            if (row.chainIDDest != undefined && row.chainDestName && blockNumberDest) {
                                return presentBlockNumber(row.idDest, row.chainDestName, blockNumberDest) + "<BR>" + str;
                            } else if (row.chainIDDest != undefined && row.chainDestName && row.blockNumberDest == undefined) {
                                return `${row.chainDestName}` + "<BR>" + str;
                            } else {
                                return "-"
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    } else {

                            return ""
                    }
                }
            }, {
                data: 'stage',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.stage !== undefined) {
                            return row.stage;
                        } else {
                            return "--";
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
                data: 'symbol',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.symbol !== undefined) {
                            return row.symbol;
                        } else {
                            return "--";
                        }
                    }
                    return data;
                }
            }, {
                data: 'xcmInfo',
                render: function(data, type, row, meta) {
                    if (type == 'display') {

                    }
                    return "-todo-";
                }
            }]
        });
    }
    if (filter) {
        await loadData2(pathParams, tableName, true)
    } else {
        console.log("MANUAL SETUP");
    }
}
