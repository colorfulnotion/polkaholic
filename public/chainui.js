var initrecentblocks = false;
var initchainlog = false;
var initspecversions = false;
var initwasmcontracts = false;
var initwasmcode = false;
var initchannels = false;
var refreshIntervalMS = 5000;
var recentBlocksIntervalId = false;

function build_filter_string(filter) {
    console.log("filter", filter);
    if (!filter) return "";
    let out = [];
    if (filter.chainID != undefined && filter.chainIDDest != undefined) {
        out.push(`chainID=${filter.chainID}`);
        out.push(`chainIDDest=${filter.chainIDDest}`);
    } else if (filter.chainList != undefined && Array.isArray(filter.chainList) && filter.chainList.length > 0) {
        out.push(`chainfilters=${filter.chainList.join(',')}`);
    } else if (filter.chainID != undefined) {
        out.push(`chainfilters=${filter.chainID}`);
    }
    if (filter.symbol != undefined) {
        out.push(`symbol=${filter.symbol}`);
    }
    console.log("filter out", out);
    if (out.length > 0) {
        let filterStr = "?" + out.join("&");
        return filterStr;
    }
    return "";
}

let xcmmessagesTable = null;
let initxcmmessages = false;
async function showxcmmessages(filter = {}) {
    let pathParams = 'xcmmessages' + build_filter_string(filter)
    let tableName = '#tablexcmmessages'
    if (initxcmmessages) {
        // if table is already initiated, update the rows
    } else {
        initxcmmessages = true;
        xcmmessagesTable = $(tableName).DataTable({
            dom: 'lfrtipB',
            buttons: [{
                extend: 'csv',
                text: 'Download CSV',
                filename: `xcmmessages`,
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
                "className": "dt-center",
                "targets": [1]
            }, {
                "className": "dt-left",
                "targets": [2, 3, 7]
            }],
            order: [
                [7, "desc"]
            ],
            columns: [{
                data: 'msgHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let str = "";
                        if (row.parentMsgHash && row.parentSentAt) {
                            str = "<BR><i>Parent Msg:</i> " + presentXCMMessageHash(row.parentMsgHash, row.parentBlocknumber);
                        }
                        if (row.childMsgHash && row.childSentAt) {
                            str = "<BR><i>Child Msg:</i> " + presentXCMMessageHash(row.childMsgHash, row.childBlocknumber);
                        }
                        return presentXCMMessageHash(row.msgHash, row.blockNumber) + str;
                        //return presentXCMMessageHash(row.msgHash, row.sentAt) + str;
                    } else {
                        return data;
                    }
                }
            }, {
                data: 'extrinsicID',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let str = "";
                        if (row.extrinsicID && row.extrinsicHash) {
                            str = `${row.chainName} Extrinsic: ` + presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                        } else {
                            str = `${row.chainName} Extrinsic: Unknown`;
                        }
                        if (row.sectionMethod) {
                            str += '<button type="button" class="btn btn-outline-primary text-capitalize">' + row.sectionMethod + '</button>';
                        }
                        return str;
                    } else {
                        let str = "";
                        if (row.extrinsicID && row.extrinsicHash) {
                            str = row.extrinsicID + "  " + row.extrinsicHash;
                        } else {
                            str = "Unknown";
                        }
                        if (row.sectionMethod) {
                            str += row.sectionMethod;
                        }
                        return str + " " + data;
                    }
                }
            }, {
                data: 'msgType',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let str = "";
                        let relayChain = (row.relayChain != undefined) ? row.relayChain : "";
                        if (row.matched == 1) {
                            str = '<button type="button" class="btn transfer" style="background-color:rgba(0,201,167,.2); color:#02977e">' + `${relayChain} ${data} (${row.version})` + '</button>';
                            return str;
                        } else {
                            let color = (row.incoming == 1) ? "0,0,0,.2" : "255,255,255,.2";
                            str = `<button type="button" class="btn transfer" style="background-color:rgba(${color}); color:#b47d00">` + `${relayChain} ${data} (${row.version})` + '</button>';
                            return str;
                        }
                    } else {
                        return row.relayChain + " " + data + " " + row.version
                    }

                }
            }, {
                data: 'sourceTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let bn = (row.blockNumberOutgoing !== undefined) ? presentBlockNumber(row.id, row.chainName, row.blockNumberOutgoing) : row.chainName;
                        bn += "<br>";
                        if (row.sourceTS != undefined && row.sourceTS > 0) {
                            return bn + shorttimeConverter(data);
                        } else {
                            return bn + shorttimeConverter(row.blockTS);
                        }
                    } else {
                        if (row.sourceTS != undefined && row.sourceTS > 0) {
                            return row.chainName + " " + data;
                        }
                    }
                    return 0;
                }
            }, {
                data: 'destTS',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let bn = (row.blockNumber !== undefined && row.incoming == 1) ? presentBlockNumber(row.idDest, row.chainDestName, row.blockNumber) : row.chainDestName;
                        bn += "<br>";
                        if (row.destTS != undefined && row.destTS > 0) {
                            return bn + shorttimeConverter(data);
                        } else {
                            return bn + shorttimeConverter(row.blockTS);
                        }
                    } else {
                        if (row.destTS != undefined && row.destTS > 0) {
                            return data + " " + row.chainDestName;
                        }
                        return "unmatched";
                    }
                    return 0;
                }
            }, {
                data: 'msg',
                render: function(data, type, row, meta) {
                    if (row.msg != undefined) {
                        let assetsReceived = "";
                        let valueUSD = 0.0;
                        try {
                            if (row.assetsReceived && row.assetsReceived.length > 0) {
                                let ar = row.assetsReceived;
                                //let assetsReceivedStr = JSON.stringify(row.assetsReceived);
                                let symbols = [];
                                ar.forEach((r) => {
                                    if (r.symbol && !symbols.includes(r.symbol)) {
                                        symbols.push(r.symbol);
                                    }
                                    if (r.amountReceivedUSD != undefined && r.amountReceivedUSD > 0) {
                                        valueUSD += r.amountReceivedUSD;
                                    }
                                });
                                let symbolsStr = (symbols.length > 0) ? symbols.join(", ") : "Assets";
                                let title = `${symbolsStr} Received`
                                if (valueUSD > 0) {
                                    title += " : " + currencyFormat(valueUSD);
                                    if (row.amountSentUSD > 0) {
                                        let feesUSD = row.amountSentUSD - valueUSD;
                                        title += " (Est fees: " + currencyFormat(feesUSD) + ")";
                                    }
                                }
                                assetsReceived = presentInstructions(JSON.stringify(row.assetsReceived), "AR" + row.msgHash + row.blockNumber + row.incoming, title);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                        if (type == 'display') {
                            return assetsReceived + presentInstructions(JSON.stringify(row.msg), row.msgHash + row.blockNumber + row.incoming);
                        } else {
                            return valueUSD;
                        }
                    }
                }
            }, {
                data: 'beneficiaries',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (data && data.length > 0) {
                            if (row.destAddress !== undefined) {
                                return presentIDwithIdenticon(row.destAddress);
                            } else {
                                return presentIDwithIdenticon(data);
                            }
                        } else {
                            return "";
                        }
                    } else {
                        return data;
                    }

                }
            }, {
                data: 'relayChain',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.pending != undefined) {
                            return "Pending";
                        } else {
                            let unk = true;
                            if (row.destStatus == -1) {
                                let secondsago = Math.floor(Date.now() / 1000) - row.blockTS;
                                if (secondsago < 90) {
                                    return `<button type="button" class="btn btn-info text-capitalize">Pending</button>`;
                                } else {
                                    return `<button type="button" class="btn btn-warning text-capitalize">Unknown</button>`;
                                }
                            } else if (row.destStatus == 0) {
                                if (row.errorDesc) {
                                    unk = false;
                                    return `<button type="button" class="btn btn-danger text-capitalize">${row.errorDesc}</button>`;
                                } else {
                                    unk = false;
                                    return `<button type="button" class="btn btn-danger text-capitalize">FAIL</button>`;
                                }
                            } else if (row.destStatus == 1) {
                                return `<button type="button" class="btn btn-success text-capitalize">Success</button>`;
                            }
                        }
                    }
                    if (row.relayChain) {
                        return row.relayChain;
                    } else {
                        return "";
                    }
                }
            }]
        });
    }

    //load data here: warning this function is technically async
    if (filter) {
        await loadData2(pathParams, tableName, true)
    } else {
        console.log("MANUAL SETUP");
    }
}


let xcmtransfersTable = null;
let initxcmtransfers = false;
async function showxcmtransfers(filter = {}) {
    let pathParams = `xcmtransfers` + build_filter_string(filter)
    let tableName = '#tablexcmtransfers'
    if (initxcmtransfers) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initxcmtransfers = true;
        xcmtransfersTable = $(tableName).DataTable({
            /*
            [0] section (+method)
            [1] amountSent (+symbol)
            [2] amountSentUSD
            [3] fromAddress
            [4] destAddress
            [5] id (+chainName)
            [6] chainIDDest (+chainDestName)
            [7] sourceTS
            [8] relayChain
            */
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
            }, {
                "targets": [8],
                "visible": false
            }],
            order: [
                [7, "desc"]
            ],
            columns: [{
                data: 'section',
                render: function(data, type, row, meta) {
                    let sectionMethod = `${data}:${row.method}`
                    if (type == 'display') {
                        let xcmtraceLink = row.traceID ? presentXCMTrace(row.traceID) : "";
                        return '<button type="button" class="btn btn-outline-primary text-capitalize">' + sectionMethod + '</button>' + xcmtraceLink;
                    }
                    return sectionMethod;
                }
            }, {
                data: 'amountSent',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            let symbol = row.symbol;
                            let amountSent = row.amountSent;
                            if (symbol && amountSent) {
                                return presentTokenCount(data) + " " + symbol
                            }
                        } catch (err) {
                            console.log("rowsymbol", row, err);
                        }
                    } else {
                        try {
                            let symbol = row.symbol
                            let amountSent = row.amountSent;
                            if (symbol && amountSent) {
                                return data + " " + symbol
                            }
                        } catch (err) {
                            return ""
                        }
                    }
                    return "";
                }
            }, {
                data: 'amountSentUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.amountSentUSD !== undefined && row.amountSentUSD > 0) {
                            //
                            return currencyFormat(row.amountSentUSD, row.priceUSD, row.priceUSDCurrent);
                        } else {
                            //console.log("missing amountSentUSD", row);
                            return "--";
                        }
                    } else {
                        if (row.amountSentUSD !== undefined && row.amountSentUSD > 0) {
                            return data
                        } else {
                            return 0;
                        }
                    }
                    return;
                }
            }, {
                data: 'fromAddress',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.sender !== undefined) {
                            return presentIDwithIdenticon(row.sender);
                        } else if (row.fromAddress !== undefined) {
                            return presentIDwithIdenticon(data);
                            //return presentID(data);
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
                        if (row.beneficiary !== undefined) {
                            return presentIDwithIdenticon(row.beneficiary);
                        } else if (row.destAddress !== undefined) {
                            return presentIDwithIdenticon(data);
                            //return presentID(data);
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
                        let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
                        return `${presentChain(row.id, row.chainName)} (${s}) `
                    } else {
                        try {
                            return data + " " + row.extrinsicID + " " + row.extrinsicHash;
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
                            if (row.xcmInfo && row.xcmInfo.destination) {
                                if (row.xcmInfo.destination.status) {
                                    str = `<button type="button" class="btn btn-success text-capitalize">Success</button>`
                                    unk = false;
                                } else if (row.xcmInfo.destination.error) {
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
                            if (row.chainIDDest != undefined && row.chainDestName && row.blockNumberDest != undefined) {
                                return presentBlockNumber(row.idDest, row.chainDestName, row.blockNumberDest) + "<BR>" + str;
                            } else if (row.chainIDDest != undefined && row.chainDestName && row.blockNumberDest == undefined) {
                                return `${row.chainDestName}` + "<BR>" + str;
                            } else {
                                return "-"
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    } else {
                        try {
                            if ((row.isMsgSent !== undefined && row.isMsgSent == false)) {
                                return row.idDest + " Incomplete"
                            } else if ((row.incomplete !== undefined && row.incomplete > 0)) {
                                return row.idDest + " Incomplete"
                            } else {
                                return row.idDest + " " + row.blockNumberDest;
                            }
                        } catch (e) {
                            return ""
                        }
                    }
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
                data: 'relayChain', //this is the 'hidden' column that we use to supprt filter
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return data;
                    }
                    return data;
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

var initassets = false;
let xcmassetsTable = null;

function showxcmassets(chainID) {
    if (initassets) return;
    else initassets = true;
    let chainIDstr = (chainID == undefined) ? "all" : chainID.toString();
    let pathParams = `chain/assets/${chainIDstr}`

    let tableName = '#tablexcmassets'
    xcmassetsTable = $(tableName).DataTable({
        order: [
            [1, "desc"],
            [6, "desc"],
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 3, 4, 5, 6, 7, 8]
        }, {
            "className": "dt-left",
            "targets": [2]
        }, {
            "targets": [9],
            "visible": false
        }],
        columns: [{
            data: 'symbol',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.assetType == "ERC20LP") {
                        return presentAssetPair(row.assetChain, row.symbol, row.token0, row.token1, row.token0Symbol, row.token1Symbol, chainID);
                    } else if (row.assetType == "Loan") {
                        return presentLoan(row.assetChain, row.asset);
                    } else {
                        return `<A href="/symbol/${row.symbol}">${row.symbol}</A>`;
                    }
                }
                return data;
            }
        }, {
            data: 'asset',
            render: function(data, type, row, meta) {
                if (row.asset != undefined) {
                    try {
                        let str = (row.localSymbol != undefined && row.localSymbol) ? row.localSymbol : "";
                        let [accountState, balanceUSD] = get_accountState(row.asset, row.chainID, row.assetChain);
                        if (!accountState) {
                            if (type == 'display') {
                                if (balanceUSD == null) {
                                    return `-Connect Wallet [${str}]-`
                                } else {
                                    return "-";
                                }
                            } else {
                                return 0;
                            }
                        } else if (accountState && accountState.free !== undefined) {
                            if (type == 'display') {

                                return presentTokenCount(accountState.free) + " " + str + " (" + currencyFormat(balanceUSD) + ")";
                            } else {
                                return balanceUSD + .000000001 * accountState.free;
                            }
                            return 0;
                        } else {
                            if (type == 'display') {
                                return str;
                            }
                        }
                        return 0;
                    } catch (err) {
                        console.log(err);
                        return "-"
                    }
                }
            }
        }, {
            data: 'chainID',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.chainID != undefined && row.currencyID != undefined) {

                        let str = `${row.chainName} ${row.localSymbol}`;
                        if (row.currencyID != row.localSymbol && row.currencyID != row.symbol) {
                            str += ` (${row.currencyID})`
                        }
                        return `<a href='/asset/${row.chainID}/${row.currencyID}'>${str}</a>`
                    } else {
                        //console.log(row);
                        return `<a href='/xcmassets/${row.chainID}'>${row.chainName} ${row.symbol}</a>`
                    }
                } else {
                    return row.assetName;
                }
                return data;
            }
        }, {
            data: 'numHolders',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'priceUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }, {
            data: 'totalFree',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.totalFree !== undefined) {
                        return presentTokenCount(data);
                    }
                }
                if (row.totalFree !== undefined) {
                    return data;
                } else {
                    return 0;
                }
            }
        }, {
            data: 'tvlFree',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.tvlFree != undefined) {
                        return currencyFormat(data);
                    }
                } else {
                    if (row.tvlFree != undefined) {
                        return data;
                    }
                }
                return 0;
            }
        }, {
            data: 'totalReserved',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.totalReserved !== undefined) {
                        return presentTokenCount(data);
                    }
                }
                if (row.totalReserved !== undefined) {
                    return data;
                } else {
                    return 0;
                }
            }
        }, {
            data: 'tvlReserved',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.tvlReserved != undefined) {
                        return currencyFormat(data);
                    }
                } else {
                    if (row.tvlReserved != undefined) {
                        return data;
                    }
                }
                return 0;
            }
        }, {
            data: 'relayChain',
            render: function(data, type, row, meta) {
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}


var inittokens = false;
let tokensTable = null;

function showtokens(chainID) {
    if (inittokens) return;
    else inittokens = true;
    let chainIDstr = (chainID == undefined) ? "all" : chainID.toString();
    let pathParams = `chain/token/${chainIDstr}`
    console.log(pathParams);
    let tableName = '#tabletokens'
    tokensTable = $(tableName).DataTable({
        order: [
            [1, "desc"],
            [6, "desc"],
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [1, 3, 4, 5, 6]
        }, {
            "className": "dt-left",
            "targets": [2]
        }],
        columns: [{
            data: 'assetName',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.assetType == "ERC20LP") {
                        return "x" // presentAssetPair(row.assetChain, row.symbol, row.token0, row.token1, row.token0Symbol, row.token1Symbol, chainID);
                    } else if (row.assetType == "Loan") {
                        return presentLoan(row.assetChain, row.asset);
                    } else {

                        return `<A href="/asset/${row.chainID}/${row.asset}">${row.assetName}</A>`;
                    }
                }
                return data;
            }
        }, {
            data: 'asset',
            render: function(data, type, row, meta) {
                if (row.asset != undefined) {
                    try {
                        let str = (row.localSymbol != undefined && row.localSymbol) ? row.localSymbol : "";
                        let [accountState, balanceUSD] = get_accountState(row.asset, row.chainID, row.assetChain);
                        if (!accountState) {
                            if (type == 'display') {
                                if (balanceUSD == null) {
                                    return `-Connect Wallet [${str}]-`
                                } else {
                                    return "-";
                                }
                            } else {
                                return 0;
                            }
                        } else if (accountState && accountState.free !== undefined) {
                            if (type == 'display') {

                                return presentTokenCount(accountState.free) + " " + str + " (" + currencyFormat(balanceUSD) + ")";
                            } else {
                                return balanceUSD + .000000001 * accountState.free;
                            }
                            return 0;
                        } else {
                            if (type == 'display') {
                                return str;
                            }
                        }
                        return 0;
                    } catch (err) {
                        console.log(err);
                        return "-"
                    }
                }
            }
        }, {
            data: 'chainID',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.chainID != undefined && row.currencyID != undefined) {

                        let str = `${row.chainName} ${row.localSymbol}`;
                        if (row.currencyID != row.localSymbol && row.currencyID != row.symbol) {
                            str += ` (${row.currencyID})`
                        }
                        return `<a href='/asset/${row.chainID}/${row.currencyID}'>${str}</a>`
                    } else {
                        return "-";
                    }
                } else {
                    return row.assetName;
                }
                return data;
            }
        }, {
            data: 'numHolders',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'priceUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }, {
            data: 'totalFree',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.totalFree !== undefined) {
                        return presentTokenCount(data);
                    }
                }
                if (row.totalFree !== undefined) {
                    return data;
                } else {
                    return 0;
                }
            }
        }, {
            data: 'tvlFree',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.tvlFree != undefined) {
                        return currencyFormat(data);
                    }
                } else {
                    if (row.tvlFree != undefined) {
                        return data;
                    }
                }
                return 0;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}

var initrouters = false;
let routersTable = null;

function showrouters(chainID) {
    if (initrouters) return;
    else initrouters = true;
    let chainIDstr = (chainID == undefined) ? "all" : chainID.toString();
    let pathParams = `chain/routers/${chainIDstr}`
    console.log(pathParams);
    let tableName = '#tablerouters'
    routersTable = $(tableName).DataTable({
        order: [
            [2, "desc"]
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [2]
        }, {
            "className": "dt-left",
            "targets": [0]
        }],
        columns: [{
            data: 'routerName',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return `<A href="/router/${row.routerAssetChain}">${row.routerName}</A>`;
                }
                return data;
            }
        }, {
            data: 'chainName',
            render: function(data, type, row, meta) {
                if (row.chainName) {
                    if (type == 'display') {
                        return `<A href="/projects/${row.id}">${row.chainName}</A>`;
                    }
                    return data;
                }
                return "-"
            }
        }, {
            data: 'tvl',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                } else
                    return data;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}

var initassets = false;
let assetsTable = null;

function showassets(chainID, assetType) {
    if (initassets) return;
    else initassets = true;
    let chainIDstr = (chainID == undefined) ? "all" : chainID.toString();
    let pathParams = `chain/${assetType}/${chainIDstr}`
    let tableName = '#tableassets'
    console.log("showassets", pathParams);
    assetsTable = $(tableName).DataTable({
        order: [
            [0, "asc"]
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": []
        }, {
            "className": "dt-left",
            "targets": [0, 1]
        }],
        columns: [{
            data: 'asset',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return `<A href="/address/${row.asset}/${row.chainID}">${row.asset}</A>`;
                }
                return data;
            }
        }, {
            data: 'assetName',
            render: function(data, type, row, meta) {
                return data;
            }
        }, {
            data: 'assetType',
            render: function(data, type, row, meta) {
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}

function stoprecentblocks(chainID) {
    if (recentBlocksIntervalId) {
        clearInterval(recentBlocksIntervalId);
        recentBlocksIntervalId = false
    }
}

function showrecentblocks(chainID) {
    if (!recentBlocksIntervalId) {
        show_recentblocks(chainID)
    }
    recentBlocksIntervalId = setInterval(function() {
        show_recentblocks(chainID)
    }, refreshIntervalMS);
}

function show_recentblocks(chainID) {

    let pathParams = `chain/${chainID}`

    let tableName = '#tablerecentblocks'
    if (initrecentblocks) {

    } else {
        initrecentblocks = true;
        var table = $(tableName).DataTable({
            order: [
                [0, "desc"]
            ],
            columnDefs: [{
                "className": "dt-center",
                "targets": "_all"
            }],
            columns: [{
                data: 'blockNumber',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentBlockNumber(chainID, false, data)
                    }
                    return data;
                }
            }, {
                data: 'blockHash',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let f = (row.finalized == 0) ? presentFinalized(false) : "";
                        return f + " " + presentBlockHash(chainID, false, row.blockNumber, data);
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
            }, {
                data: 'numExtrinsics',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        // in the evm case, we show numTransactions
                        if (row.numTransactionsEVM != undefined) {
                            return `<a href='/txs/${chainID}/${row.blockNumber}'>` + presentNumber(row.numTransactionsEVM) + "</a>";
                        } else {
                            return `<a href='/block/${chainID}/${row.blockNumber}#extrinsics'>` + presentNumber(data) + "</a>";
                        }
                    } else {
                        if (row.numTransactionsEVM != undefined) {
                            return row.numTransactionsEVM;
                        } else {
                            return data;
                        }
                    }
                    return data;
                }
            }, {
                data: 'numSignedExtrinsics',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.gasUsed != undefined) {
                            return presentNumber(row.gasUsed);
                        } else {
                            return presentNumber(data);
                        }
                    } else {
                        if (row.gasUsed != undefined) {
                            return row.gasUsed;
                        } else {
                            return data;
                        }
                    }
                    return data;
                }
            }, {
                data: 'numXCMTransfersOut',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        let out = [];
                        let xcmtransfers = `/xcmtransfers?chainfilters=${chainID}&blockNumber=${row.blockNumber}`
                        let xcmlink = `/xcmmessages?chainfilters=${chainID}&blockNumber=${row.blockNumber}`
                        if (data > 0) {
                            out.push(`<a href='${xcmtransfers}'>${data} XCM transfers</a>`);
                            if (row.numXCMMessagesOut > 0 && row.numXCMMessagesOut > row.numXCMTransfers) {
                                out.push(`<a href='${xcmlink}'>${numXCMMessagesOut} additional outgoing XCMs</a>`);
                            }
                        } else {
                            if (row.numXCMMessagesOut > 0) {
                                out.push(`<a href='${xcmlink}'>${row.numXCMMessagesOut} outgoing</a>`);
                            }
                        }
                        if (row.numXCMMessagesIn > 0) {
                            out.push(`<a href='${xcmlink}'>${row.numXCMMessagesIn} incoming XCM</a>`);
                        }
                        return out.join(", ");
                    } else {
                        return data + row.numXCMMessagesIn;
                    }
                }
            }, {
                data: 'numEvents',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return `<a href='/block/${chainID}/${row.blockNumber}#events'>` + presentNumber(data) + "</a>";
                    }
                    return data;
                }
            }, {
                data: 'numTransfers',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return presentNumber(data);
                    }
                    return data;
                }
            }, {
                data: 'valueTransfersUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        return currencyFormat(data);
                    }
                    return data;
                }
            }, ]
        });
    }

    $(tableName).on('page.dt', function() {
        stoprecentblocks();
    });
    loadData2(pathParams, tableName, false, 'blocks')
}

function showspecversions(chainID) {
    if (initspecversions) return;
    else initspecversions = true;
    let pathParams = `specversions/${chainID}`
    let tableName = '#tablespecversions'
    var table = $(tableName).DataTable({
        order: [
            [0, "desc"]
        ],
        columnDefs: [{
            "className": "dt-center",
            "targets": "_all"
        }],
        columns: [{
            data: 'specVersion',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentSpecVersion(chainID, data)
                }
                return data;
            }
        }, {
            data: 'blockNumber',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentBlockNumber(chainID, false, data)
                }
                return data;
            }
        }, {
            data: 'blockHash',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentBlockHash(chainID, false, row.blockNumber, data);
                }
                return data;
            }
        }, {
            data: 'firstSeenTS',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentTS(data);
                }
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, false)
}

function showchannels(chainID) {
    if (initchannels) return;
    else initchannels = true;
    let pathParams = `chain/channels/${chainID}`
    let tableName = '#tablechannels'
    var table = $(tableName).DataTable({
        order: [
            [6, "desc"],
            [7, "desc"],
            [4, "desc"],
        ],
        columnDefs: [{
            "className": "dt-center",
            "targets": "_all"
        }],
        columns: [{
            data: 'id',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.chainID == chainID || row.id == chainID) {
                        return "<B>" + row.chainName + "</B>";
                    } else {
                        return presentChain(row.id, row.chainName, false, "", "#channels");
                    }
                }
                return data;
            }
        }, {
            data: 'idDest',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    if (row.chainIDDest == chainID || row.idDest == chainID) {
                        return "<B>" + row.chainNameDest + "</B>";
                    } else {
                        return presentChain(row.idDest, row.chainNameDest, false, "", "#channels");
                    }
                }
                return data;
            }
        }, {
            data: 'status',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'openRequestTS',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let s = presentXCMMessageHash(row.msgHashOpenRequest, row.sentAtOpenRequest);
                    return presentTS(data) + s;
                }
                return data;
            }
        }, {
            data: 'acceptTS',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let s = presentXCMMessageHash(row.msgHashAccepted, row.sentAtAccepted);
                    return presentTS(data) + s;
                }
                return data;
            }
        }, {
            data: 'symbols',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    let out = [];
                    if (data) {
                        for (const symbolChain of data) {
                            let [symbol, relayChain] = parseAssetChain(symbolChain);
                            out.push(`<a href='/channel/${row.chainID}/${row.chainIDDest}/${symbol}'>${symbol}</a>`);
                            console.log(symbolChain, row.chainID, row.chainIDDest);
                        }
                        return out.join(" | ");
                    }
                }
                return data;
            }
        }, {
            data: 'numXCMMessagesOutgoing7d',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    console.log(row);
                    // todo: 1d/7d/30d
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'valXCMMessagesOutgoingUSD7d',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    // todo: 1d/7d/30d
                    return currencyFormat(data)
                }
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, false)
}


function showwasmcontracts(chainID) {
    if (initwasmcontracts) return;
    else initwasmcontracts = true;
    let pathParams = `wasmcontracts/${chainID}`
    let tableName = '#tablewasmcontracts'
    var table = $(tableName).DataTable({
        order: [
            [5, "desc"]
        ],
        columnDefs: [{
            "className": "dt-center",
            "targets": "_all"
        }],
        columns: [{
            data: 'address',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentWASMContract(data);
                }
                return data;
            }
        }, {
            data: 'status',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'deployer',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentID(data)
                }
                return data;
            }
        }, {
            data: 'codeHash',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentWASMCodeHash(data);
                }
                return data;
            }
        }, {
            data: 'instantiateBN',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
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
    loadData2(pathParams, tableName, false)
}

function showwasmcode(chainID) {
    if (initwasmcode) return;
    else initwasmcode = true;
    let pathParams = `wasmcode/${chainID}`
    let tableName = '#tablewasmcode'
    var table = $(tableName).DataTable({
        order: [
            [6, "desc"]
        ],
        columnDefs: [{
            "className": "dt-center",
            "targets": "_all"
        }],
        columns: [{
            data: 'codeHash',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentWASMCodeHash(data);
                }
                return data;
            }
        }, {
            data: 'status',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'storer',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentID(data)
                }
                return data;
            }
        }, {
            data: 'codeStoredBN',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash);
                }
                return data;
            }
        }, {
            data: 'language',
            render: function(data, type, row, meta) {
                return data;
            }
        }, {
            data: 'compiler',
            render: function(data, type, row, meta) {
                return data;
            }
        }, {
            data: 'codeStoredTS',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentTS(data);
                }
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, false)
}

function presentLoan(assetChain, assetString) {
    let asset = JSON.parse(assetString)
    let symbol = "UNK";

    try {
        if (asset.Loan != undefined && asset.Loan.Token != undefined) {
            symbol = asset.Loan.Token;
        }
        return '<a href="/asset/' + encodeURIComponent2(assetChain) + '"> Loan: ' + symbol + '</a>';
    } catch (e) {
        return "Loan: UNK"
    }
}

function showchaininfo(chainID) {
    // no datatable
}

function showchainlog(chainID, address) {
    if (initchainlog) return;
    else initchainlog = true;
    let pathParams = `chainlog/${chainID}`

    let tableName = '#tablechainlog'
    var table = $(tableName).DataTable({
        order: [
            [0, "desc"]
        ],
        columnDefs: [{
            "className": "dt-right",
            "targets": [6, 7, 10, 11]
        }, {
            "className": "dt-center",
            "targets": [1, 2, 3, 4, 5, 8, 9, 12, 13]
        }],
        columns: [{
            data: 'logDT',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data
                }
                return data;
            }
        }, {
            data: 'numAccountsActive',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'numAddresses',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'numSignedExtrinsics',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'numTransactionsEVM',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'numTransfers',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentNumber(data);
                }
                return data;
            }
        }, {
            data: 'valueTransfersUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }, {
            data: 'fees',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentTokenCount(data);
                } else {
                    return data;
                }
            }
        }, {
            data: 'numXCMTransfersIn',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                } else {
                    return data;
                }
            }
        }, {
            data: 'numXCMTransfersOut',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'valXCMTransferIncomingUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }, {
            data: 'valXCMTransferOutgoingUSD',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return currencyFormat(data);
                }
                return data;
            }
        }, {
            data: 'numXCMMessagesIn',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }, {
            data: 'numXCMMessagesOut',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return data;
                }
                return data;
            }
        }]
    });
    loadData2(pathParams, tableName, true)
}
