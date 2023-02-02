
let xcmtransferslogTable = null;
let initxcmtransferslog = false;

async function showxcmtransferslog(chainID_or_chainName, chainIDDest_or_chainName) {
    let pathParams = `xcmtransferslog`
    if ( chainID_or_chainName ) {
	pathParams += "/" + chainID_or_chainName;
    } else {
	pathParams += "/all";
    }
    if ( chainIDDest_or_chainName ) {
        pathParams += "/" + chainIDDest_or_chainName;
    } else {
	pathParams += "/all";
    }
    let tableName = '#tablexcmtransferslog'
    if (initxcmtransferslog) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initxcmtransferslog = true;
        xcmtransferslogTable = $(tableName).DataTable({
            dom: 'lfrtipB',
	    "createdRow": function( row, data, dataIndex){
		let extrinsicHash = data.extrinsicHash;
		let b = extrinsicHash.substr(2, 1);
		let bgcolor = "#FFFFFF";
		switch ( b ) {
		case "0": bgcolor = "#EECCEE"; break;
		case "1": bgcolor = "#CCEEEE"; break;
		case "2": bgcolor = "#EEEECC"; break;
		case "3": bgcolor = "#CCEECC"; break;
		case "4": bgcolor = "#CCCCCC"; break;
		case "5": bgcolor = "#CCCCEE"; break; 
		case "6": bgcolor = "#EEEEFF"; break;
		case "7": bgcolor = "#FFEEFF"; break;
		case "8": bgcolor = "#EEEEFF"; break;
		case "9": bgcolor = "#EEAAEE"; break;
		case "a": bgcolor = "#EEFFEE"; break;
		case "b": bgcolor = "#FFEEEE"; break;
		case "c": bgcolor = "#EEEEFF"; break;
		case "d": bgcolor = "#DDCCEE"; break; 
		case "e": bgcolor = "#CCDDEE"; break;
		case "f": bgcolor = "#EEDDCC"; break;
		}
		console.log("#", bgcolor);
		$(row).css({"background-color":`${bgcolor}`})

            },
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
                [0, "desc"],
                [3, "desc"]
            ],

            columns: [{
                data: 'addTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.sourceTS !== undefined) {
                            let s = presentUTCTime(row.addTS);
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
			let t = getShortHash(row.extrinsicHash);
			if ( row.xcmIndex > 0 || row.transferIndex > 0 ) {
			    t += ` xcmIndex: ${row.xcmIndex} | transferIndex: ${row.transferIndex}`
			}
                        return `${presentChain(row.xcmInfo.origination.id, row.xcmInfo.origination.id)} (${s})<br/> ${t}`
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
                            if (blockNumberDest && row.xcmInfo.destination.id != undefined && row.xcmInfo.destination.chainName) {
                                return presentBlockNumber(row.xcmInfo.destination.id, row.xcmInfo.destination.chainName, blockNumberDest) + "<BR>" + str;
                            } else {
				return row.xcmInfo.destination.chainName
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    } else {

                            return ""
                    }
                }
            }, {
                data: 'sourceTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.sourceTS !== undefined) {
                            let s = presentUTCTime(row.sourceTS);
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
			    let sent = row.xcmInfo.origination.amountSent
                            return sent + " " + row.symbol;
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
			let title = row.stage;
			if ( row.stage == "DestinationFinalized" ) title = "<B> 😀😀😀 DESTINATION FINALIZED 😀😀😀<B>";
			if ( row.stage == "OriginationFinalized" ) title = "Origination finalized 😀";
			if ( row.stage == "OriginationUnfinalized" ) title = "<i> Origination unfinalized 🚀<i>";
                        return presentInstructions(JSON.stringify(row.xcmInfo), "AR" + row.extrinsicHash + row.stage + row.xcmIndex + row.transferIndex, title);

                    }
                    return "-todo-";
                }
            }, {
                data: 'delay',
                render: function(data, type, row, meta) {
                    if (type == 'display') {

                    }
                    return data;
                }
            }]
        });
    }
    
    await loadData2(pathParams, tableName, true)

}
