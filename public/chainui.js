function build_filter_string(filter) {
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
            pageLength: 25,
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
                        str += "<BR><small>" + presentXCMTimeline(row.msgHash, "xcm", row.blockNumber) + "</small>";
                        return presentXCMMessageHash(row.msgHash, row.blockNumber) + str;
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

                            if (row.destStatus == -1) {
                                return `<button type="button" class="btn btn-warning text-capitalize">Unknown</button>`;
                            } else if (row.destStatus == 0) {
                                if (row.errorDesc) {
                                    return `<button type="button" class="btn btn-danger text-capitalize">${row.errorDesc}</button>`;
                                } else {
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
        const selectElement = document.querySelector('#relaychain');
        if (selectElement) {
            setchainfilter(selectElement.value);
        }
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
            pageLength: 25,
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
                        return '<button type="button" class="btn btn-outline-primary text-capitalize">' + sectionMethod + '</button>';
                    }
                    return sectionMethod;
                }
            }, {
                data: 'amountSent',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        try {
                            let parsedAsset = JSON.parse(row.asset);
                            let symbol = parsedAsset.Token;
                            let assetChain = row.asset + "~" + row.chainID;
                            if (symbol !== undefined) {
                                return presentTokenCount(data) + " " + presentAsset(row);
                            } else {
                                return row.asset;
                            }
                        } catch (err) {
                            console.log("row.asset", row.asset, err);
                        }
                    } else {
                        try {
                            let parsedAsset = JSON.parse(row.asset);
                            let symbol = parsedAsset.Token;
                            if (symbol !== undefined) {
                                return data + " " + symbol
                            } else {
                                return data + " " + row.asset;
                            }
                        } catch (err) {
                            return ""
                        }
                    }
                    return data;
                }
            }, {
                data: 'amountSentUSD',
                render: function(data, type, row, meta) {
                    if (type == 'display') {
                        if (row.amountSentUSD !== undefined) {
                            //
                            return currencyFormat(row.amountSentUSD, row.priceUSD, row.priceUSDCurrent);
                        } else {
                            console.log("missing amountSentUSD", row);
                            return "--";
                        }
                    } else {
                        if (row.amountSentUSD !== undefined) {
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
                        let timelineURL = `/timeline/${row.extrinsicHash}`
                        let timelineLink = `<div class="explorer"><a href="${timelineURL}">timeline</a></div>`
                        return `${presentChain(row.id, row.chainName)} (${s}) ` + timelineLink
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
                            if (row.chainIDDest != undefined && row.chainDestName) {
                                if (row.incomplete !== undefined && row.incomplete > 0) {
                                    return "Incomplete " + presentSuccessFailure(false);
                                } else if (row.blockNumberDest) {
                                    return presentBlockNumber(row.idDest, row.chainDestName, row.blockNumberDest) + presentSuccessFailure(true);
                                } else {
                                    return presentChain(row.idDest, row.chainDestName);
                                }
                            } else {
                                return "-"
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    } else {
                        try {
                            if ((row.incomplete !== undefined && row.incomplete > 0)) {
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
                        return `<a href='/chain/${row.chainID}#xcmassets'>${row.chainName} ${row.symbol}</a>`
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

function filterchains(relaychain = "all") {
    if (relaychain == "kusama" || relaychain == "polkadot") {
        console.log("filterchains", relaychain);
        if (chainsTable) chainsTable.column(8).search(relaychain).draw();
        if (xcmassetsTable) xcmassetsTable.column(9).search(relaychain).draw();
        if (xcmtransfersTable) xcmtransfersTable.column(8).search(relaychain).draw();
        if (xcmmessagesTable) xcmmessagesTable.column(7).search(relaychain).draw();
    } else {
        // empty search effectively removes the filter
        if (chainsTable) chainsTable.search('').columns().search('').draw();
        if (xcmassetsTable) xcmassetsTable.search('').columns().search('').draw();
        if (xcmtransfersTable) xcmtransfersTable.search('').columns().search('').draw();
        if (xcmmessagesTable) xcmmessagesTable.search('').columns().search('').draw();
    }
}

function setchainfilter(relaychain) {
    relaychainfilter = relaychain;
    filterchains(relaychainfilter);
}


const selectElement = document.querySelector('#relaychain');
if (selectElement) {
    selectElement.addEventListener('change', (event) => {
        setchainfilter(event.target.value);
    });
}