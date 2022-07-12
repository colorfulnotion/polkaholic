var initextrinsics = false;

function showextrinsics(address) {
    if (initextrinsics) return;
    else initextrinsics = true;
    let pathParams = `account/${address}?group=extrinsics`
    let tableName = '#tableextrinsics'
    var table = $(tableName).DataTable({
        columnDefs: [{
            "className": "dt-right",
            "targets": [3, 4]
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
                                return cover_params(data, row.extrinsicHash);
                            } catch (e) {}
                        } else if (row.decodedInput !== undefined && row.transactionHash !== undefined && row.decodedInput.params !== undefined) {
                            return cover_params(row.decodedInput.params, row.transactionHash);
                        }
                        return "";
                    } else {
                        if (row.method !== undefined) {
                            return row.method;
                        } else {
                            return "-";
                        }
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
        ]
    });

    loadData2(pathParams, tableName, true, "data", 'feed', 'Feeds')
}

var initfeed = false;

function showfeed(address) {
    if (initfeed) return;
    else initfeed = true;
    let pathParams = `account/${address}?group=feed`
    let tableName = '#tablefeed'
    var table = $(tableName).DataTable({
        columnDefs: [{
            "className": "dt-right",
            "targets": [3, 4, 5]
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
            },
            {
                data: 'blockNumber',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentBlockNumber(row.chainID, row.chainName, data)
                    }
                    return data;
                }
            },
            {
                data: 'ts',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return timeConverter(data);
                    }
                    return data;
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
            },
            {
                data: 'params',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return cover_params(data, row.extrinsicHash);
                    } else {
                        if (row.method !== undefined) {
                            return row.method;
                        } else {
                            return "-";
                        }
                    }
                    return data;
                }
            }
        ]
    });

    loadData2(pathParams, tableName, true, "data", 'extrinsics', 'Extrinsics')
}

var inittransfers = false;

function showtransfers(address) {
    if (inittransfers) {
        return;
    } else inittransfers = true;
    let pathParams = `account/${address}?group=transfers`
    let tableName = '#tabletransfers'
    var table = $(tableName).DataTable({
        columnDefs: [{
            "className": "dt-right",
            "targets": [5, 6]
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
            },
            {
                data: 'from',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentIDRow(row, 'from');
                    }
                    return data;
                }
            },
            {
                data: 'to',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentIDRow(row, 'to');
                    }
                    return data;
                }
            },
            {
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
            },
            {
                data: 'rawAmount',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let val = "TODO"; //dechexToInt(data);
                        let dData = row.decodedData
                        if (dData != undefined) {
                            if (dData.symbol != undefined && dData.dataRaw != undefined) {
                                val = dData.dataRaw + " " + dData.symbol
                            } else {
                                val = `${row.rawAmount} Asset (decimal unknown)`
                            }
                        }
                        return val;
                    }
                    return data;
                }
            },
            {
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
            },
            {
                data: 'ts',
                render: function(data, type, row, meta) {
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
            }
        ]
    });
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
    loadData2(pathParams, tableName, true, "data", 'transfers', 'Transfers')
}

var inithistory = false;

function showhistory(address) {
    return;
    if (inithistory) return;
    else inithistory = true;
    let pathParams = `account/${address}?group=history`
    let tableName = '#tablehistory'
    var table = $(tableName).DataTable({
        columnDefs: [{
            "className": "align-top",
            "targets": [0, 1]
        }],
        columns: [{
                data: 'chainID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.assetInfo !== undefined && row.assetInfo.chainID !== undefined && row.assetInfo.chainName !== undefined) {
                            return presentChain(row.assetInfo.chainID, row.assetInfo.chainName);
                        } else {
                            return "unk";
                        }
                    } else {
                        if (row.assetInfo !== undefined && row.assetInfo.chainID !== undefined && row.assetInfo.chainName !== undefined) {
                            return row.assetInfo.chainName;
                        }
                    }
                    return "";
                }
            },
            {
                data: 'asset',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.assetInfo.assetChain !== undefined && row.assetInfo.symbol !== undefined) {
                            return presentAsset(row.assetInfo.assetChain, row.assetInfo.symbol);
                        } else {
                            return "unk";
                        }
                    } else {
                        if (row.assetInfo.assetChain !== undefined && row.assetInfo.symbol !== undefined) {
                            return row.assetInfo.symbol;
                        } else {
                            return "unk";
                        }
                    }
                    return "";
                }
            },
            {
                data: 'states',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.states !== undefined) {
                            let out = [];
                            for (let s = 0; s < row.states.length; s++) {
                                let tsState = row.states[s];
                                if (tsState.length >= 2) {
                                    let ts = tsState[0];
                                    let state = tsState[1];
                                    let extrinsicInfo = (tsState.length > 2) ? tsState[2] : false;
                                    let d = new Date(ts * 1000);
                                    let dateString = d.toISOString().substring(0, 16).replace("T", " ");
                                    let stateString = "";
                                    if (state.free !== undefined) {
                                        stateString = "<td>" + presentTokenCount(state.free) + "</td>";
                                        if (state.freeUSD !== undefined) {
                                            stateString += "<td>" + currencyFormat(state.freeUSD, state.priceUSD, state.priceUSDCurrent) + "</td>";
                                            if (typeof extrinsicInfo == "object") {
                                                stateString += "<td>" + presentExtrinsicInfo(extrinsicInfo) + "</td>";
                                            }
                                        } else {
                                            stateString += "<td></td>";
                                        }
                                    } else {
                                        stateString = "<td>-</td>";
                                    }
                                    out.push("<tr><td>" + dateString + "</td>" + stateString + "</tr>");
                                }
                            }
                            return "<table>" + out.join("") + "</table>";
                        } else {
                            return "unk";
                        }
                    }
                    return "";
                }
            }
        ]
    });
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
    loadData2(pathParams, tableName, true, "data", "history", "History")
}

let initcurrent = false;


var initxcmtransfers = false;

function showxcmtransfers(address) {
    if (initxcmtransfers) return;
    else initxcmtransfers = true;
    let pathParams = `account/${address}?group=xcmtransfers`
    let tableName = '#tablexcmtransfers'
    var table = $(tableName).DataTable({
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 2, 3]
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
            },
            {
                data: 'amountSent',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            let parsedAsset = JSON.parse(row.asset);
                            let symbol = parsedAsset.Token;
                            let assetChain = row.asset + "~" + row.chainID;
                            if (symbol !== undefined) {
                                return presentTokenCount(data) + " " + presentAsset(assetChain, symbol);
                            } else {
                                return row.asset;
                            }
                        } catch (err) {
                            return "unk";
                        }
                    }
                    return data;
                }
            },
            {
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
            },
            {
                data: 'fromAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.fromAddress !== undefined) {
                            return presentID(data);
                        } else {
                            console.log("missing fromAddress", row);
                        }
                    }
                    return data;
                }
            },
            {
                data: 'destAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.destAddress !== undefined) {
                            return presentID(data);
                        } else {
                            console.log("missing destAddress", row);
                        }
                    }
                    return data;
                }
            },
            {
                data: 'id',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                        return `${presentChain(row.id, row.chainName)} (${s})`
                    }
                    return data;
                }
            },
            {
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
            },
            {
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
            }
        ]
    });

    loadData2(pathParams, tableName, true, false, 'xcmtransfers', "XCM Transfers")
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
}

var initrewards = false;

function showrewards(address) {
    if (initrewards) return;
    else initrewards = true;
    let pathParams = `account/${address}?group=rewards`
    let tableName = '#tablerewards'
    var table = $(tableName).DataTable({
        columns: [{
                data: 'asset',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            let parsedAsset = JSON.parse(row.asset);
                            let symbol = parsedAsset.Token;
                            let assetChain = row.asset + "~" + row.chainID;
                            if (symbol !== undefined) {
                                return presentAsset(assetChain, symbol);
                            } else {
                                return row.asset;
                            }
                        } catch (err) {
                            console.log("row.asset", row.asset, err);
                        }
                    }
                    return data;
                }
            },
            {
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
            },
            {
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
            },
            {
                data: 'extrinsicHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                        return `${presentChain(row.chainID, row.chainName)} (${s})`
                    }
                    return data;
                }
            },
            {
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
            },
            {
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
            },
            {
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
            }
        ]
    });
    loadData2(pathParams, tableName, true, "data", "rewards", "Rewards")
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
}


var initcrowdloans = false;
/*
{"chainID":2,"blockNumber":8322280,"blockHash":"0x8b6598fd05fe8119abd7d6d0d5bcad14f8d630eb7cc61b11cc7a5dc31d3503c6","ts":1626157344,"eventID":"2-8322280-2-6","extrinsicID":"8322280-2","extrinsicHash":"0x6bf498a69a32b7d53c82a3cabd47e5a1dc5a422af41a0db0d8fdfb8d36fdbb3f","action":"crowdloan(Contributed)","account":"EkmdfH2Fc6XgPgDwMjye3Nsdj27CCSi9np8Kc7zYoCL2S3G","paraID":2004,"amount":2.03578933,"finalized":true,"genTS":1648901809,"source":"d10","chainName":"Kusama","asset":"{\"Token\":\"KSM\"}","amountUSD":392.95009226593,"priceUSD":193.021,"chainIDDest":"1284","chainDestName":"Moonbeam"}
*/
function showcrowdloans(address) {
    if (initcrowdloans) return;
    else initcrowdloans = true;
    let pathParams = `account/${address}?group=crowdloans`
    let tableName = '#tablecrowdloans'
    var table = $(tableName).DataTable({
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
                            return presentChain(row.chainIDDest, row.chainDestName);
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
            },
            {
                data: 'asset',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            let parsedAsset = JSON.parse(row.asset);
                            let symbol = parsedAsset.Token;
                            let assetChain = row.asset + "~" + row.chainID;
                            if (symbol !== undefined) {
                                return presentAsset(assetChain, symbol);
                            } else {
                                return row.asset;
                            }
                        } catch (err) {
                            console.log("row.asset", row.asset, err);
                        }
                    }
                    return data;
                }
            },
            {
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
            },
            {
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
            },
            {
                data: 'extrinsicHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                        return `${presentChain(row.chainID, row.chainName)} (${s})`
                    }
                    return data;
                }
            },
            {
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
            }
        ]
    });
    loadData2(pathParams, tableName, true, "data", 'crowdloans', 'Crowdloans')
    $(tableName).on('page.dt', function() {
        setupcurrency();
    });
}

var initnfts = false;

function shownfts(address) {
    //setupapidocs("account", "nfts", address);
    if (initnfts) return;
    else initnfts = true;

    let pathParams = `account/${address}?group=nfts`
    let tableName = '#tablenfts'
    var table = $(tableName).DataTable({
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

function showss58h160(address) {
    if (initss58h160) return;
    else initss58h160 = true;
    let pathParams = `account/${address}?group=ss58h160`
    let tableName = '#tabless58h160'
    var table = $(tableName).DataTable({
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

function showoffers(address) {
    if (initoffers) return;
    else initoffers = true;
    let pathParams = `account/${address}?group=offers`
    let tableName = '#tableoffers'

    var table = $(tableName).DataTable({
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

function showrelated(address) {
    if (initrelated) return;
    else initrelated = true;
    let pathParams = `account/${address}?group=related`
    let tableName = '#tablerelated'
    var table = $(tableName).DataTable({
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


function showaccounttab(hash) {
    switch (hash) {
        case "#extrinsics":
            showextrinsics(address);
            setupapidocs("account", "extrinsics", address);
            break;
        case "#transfers":
            showtransfers(address);
            setupapidocs("account", "transfers", address);
            break;
        case "#history":
            showhistory(address);
            setupapidocs("account", "history", address);
            break;
        case "#rewards":
            showrewards(address);
            setupapidocs("account", "rewards", address);
            break;
        case "#crowdloans":
            showcrowdloans(address);
            setupapidocs("account", "crowdloans", address);
            break;
        case "#xcmtransfers":
            showxcmtransfers(address);
            setupapidocs("account", "xcmtransfers", address);
            break;
        case "#ss58h160":
            showss58h160(address);
            setupapidocs("account", "ss58h160", address);
            break;
        case "#offers":
            showoffers(address);
            setupapidocs("account", "offers", address);
            break;
        case "#related":
            showrelated(address);
            setupapidocs("account", "related", address);
            break;
        case "#feed":
            showfeed(address);
            setupapidocs("account", "feed", address);
            break;
        default:
            showextrinsics(address);
            setupapidocs("account", "extrinsics", address);
    }
}

function setuptabs(tabs, address, requestedChainAddress) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/account/" + requestedChainAddress + hash;
            //console.log("shown.mdb.tab", hash, newUrl);
            setTimeout(() => {
                showaccounttab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#extrinsics";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#accountTab a[href="' + hash + '"]');
    //console.log("CAUSE shownmdb.tab for", triggerEl, hash);
    if (triggerEl) mdb.Tab.getInstance(triggerEl).show();
    initTabs(address); //preemptively show the first page of every group
}

function show_unfinalized(address) {
    let pathParams = `account/${address}?group=unfinalized`
    let endpoints = `${baseURL}/${pathParams}`
    let tableName = '#unfinalized'

    var req = new Request(endpoints, {
        method: 'GET',
        headers: new Headers({
            "Accept": "application/json; odata=verbose",
        })
    });
    fetch(req)
        .then((response) => response.json())
        .then((data) => {
            if (Array.isArray(data)) {
                let out = [];
                for (let i = 0; i < data.length; i++) {
                    let row = data[i];
                    let id = row.id
                    let e = presentExtrinsic(id, row.section, row.method)
                    let currentTS = Math.floor(Date.now() / 1000);
                    let secondsAgo = currentTS - row.ts;
                    let tsStr = presentTS(row.ts)
                    if ((row.finalized > 0) && (currentTS - row.ts < 3600)) {
                        let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash)
                        let str = `<table><tr><td width="250">${e}</td><td width="250" style='padding:10px'>${presentChain(id, row.chainName)} ${s}</td><td><B>Finalized</B></td><td> ${tsStr}</td></tr></table>`
                        out.push('<div class="alert alert-info">' + str + '</div>');
                    } else if (row.finalized == 0 && (currentTS - row.ts < 3600)) {
                        let s = presentTxHash(row.extrinsicHash)
                        let str = `<table><tr><td width="250">${e}</td><td width="205" style='padding:10px'>${presentChain(id, row.chainName)} ${s}</td><td><B>Unfinalized</B></td><td> ${tsStr} </td></tr></table>`
                        out.push('<div class="alert alert-warning">' + str + '</div>');
                    }
                    if (out.length >= 5) {
                        i = data.length;
                    }
                }
                if (out.length > 0) {
                    document.getElementById('unfinalized').innerHTML = "<h5>Last 5 Unfinalized / Recently Finalized Extrinsics (last 1 hr)</h5>" + out.join("");
                }
            }
        })
}



function initTabs(address) {
    //showextrinsics(address);
    showunfinalized(address)
    showtransfers(address);
    showxcmtransfers(address);
    showrewards(address);
    showcrowdloans(address);
    showss58h160(address);
    //showoffers(address);
    showrelated(address);
}
var refreshIntervalMS = 6100;
var unfinalizedUpdateIntervalId = false;

function showunfinalized(address) {
    if (!unfinalizedUpdateIntervalId) {
        show_unfinalized(address);
    }
    unfinalizedUpdateIntervalId = setInterval(function() {
        show_unfinalized(address)
    }, refreshIntervalMS);
}

function submitSuggestion(address, nickname, submitter, addressType) {
    let endpoint = `${baseURL}/suggest/${address}`
    let data = {
        nickname,
        submitter,
        addressType
    }
    var req = new Request(endpoint, {
        method: 'POST',
        headers: new Headers({
            "Content-Type": "application/json"
        }),
        body: JSON.stringify(data)
    });

    try {
        console.log("submitSuggestion", endpoint, data)
        fetch(req)
            .then((response) => {
                console.log(response);
                if (response.status == 200) {
                    launchToast("Thank you!  If your suggestion is verified as reasonable it will appear within 24 hrs");
                } else {
                    launchToast("An error has occurred.");
                }
                console.log("HIDING")
                $('#suggestModal').modal('hide');
            })
    } catch (err) {
        console.log(err);
    }

}

$('#submitSuggestion').on('click', function(e) {
    let nickname = document.getElementById("nickname").value;
    let submitter = document.getElementById("submitter").value;
    let addressType = document.getElementById("addressType").value;
    submitSuggestion(address, nickname, submitter, addressType);
});

setuptabs(tabs, address, requestedChainAddress);