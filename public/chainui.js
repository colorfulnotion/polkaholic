let initxcmmessages = false;
async function showxcmmessages(chainID = null) {
    let pathParams = 'xcmmessages'
    if (chainID != null) {
        pathParams += `?chainfilters=${chainID}`
    }
    let tableName = '#tablexcmmessages'
    if (initxcmmessages) {
        // if table is already initiated, update the rows
        //loadData2(pathParams, tableName, true)
    } else {
        initxcmmessages = true;
        xcmmessagesTable = $(tableName).DataTable({
            pageLength: 100,
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
                },
                {
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
                },
                {
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
                },
                {
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
                },
                {
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
                },
                {
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
                                        console.log(`r`, r)
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
                },
                {
                    data: 'beneficiaries',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (data && data.length > 0) {
                                return presentID(data);
                            } else {
                                return "";
                            }
                        } else {
                            return data;
                        }

                    }
                },
                {
                    data: 'blockTS',
                    render: function(data, type, row, meta) {
                        if (type == 'display') {
                            if (row.pending != undefined) {
                                return "Pending";
                            } else {
                                let str = (row.matchTS != undefined && row.matchTS > 0) ? presentTS(row.matchTS) : "";
                                return presentSuccessFailure(row.matched) + " " + str;
                            }
                        }
                        return data;
                    }
                }
            ]
        });
    }

    //load data here: warning this function is technically async
    await loadData2(pathParams, tableName, true)
    const selectElement = document.querySelector('#relaychain');
    if (selectElement) {
        setchainfilter(selectElement.value);
    }
}