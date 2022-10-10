var initcontract = false;
var contract = null;

function presentSourceCode(contract)
{
    let out = [];
    out.push(`<b>Contract Name:</b> <b>${contract.ContractName}</b>`);
    out.push(`<b>Compiler Version:</b> ${contract.CompilerVersion}`);
    out.push(`<b>Constructor Arguments:</b><br/><textarea rows=12 cols=80>${contract.ConstructorArguments}</textarea>`);
    out.push(`<b>EVM Version:</b> ${contract.EVMVersion}`);
    let sourceCode = contract.SourceCode;
    if ( sourceCode.length > 4 && sourceCode.substring(0, 2) == "{{") {
	sourceCode = JSON.parse(sourceCode.substring(1, sourceCode.length-1));
	let sources = sourceCode.sources;
	for (const source of Object.keys(sources) ) {
	    let content = sources[source].content;
	    out.push(`<code>${source}:</code><br/><textarea rows=12 style='width:100%; font-family: Courier; font-size: 8pt'>${content}</textarea>`);
	}
    } else {
	out.push(`<textarea rows=12 style='width:100%; font-family: Courier; font-size: 8pt'>${sourceCode}</textarea>`);
    }
	
    return out.join("<br/>");
}

function executeRead(n, nm) {
    try {
	let inputs = []
	for (let i=0; i < args[n].length; i++) {
	    let id = args[n][i]
	    let typ = typs[n][i]
	    let inp = document.getElementById(id).value;
	    if ( typ.includes("[]") ) {
		console.log("parse", inp, typ);
		inp = JSON.parse(inp);
	    }
	    inputs.push(inp);
	}
	console.log("executeRead", _contractInstance[nm], inputs);
	try {
	    let res = _contractInstance[nm].apply(null, inputs)
	    res.then( (x) => {
		let xstr = x.map( (o) => {
		    return o.toString();
		}).join(",")
		console.log(n, xstr)
		document.getElementById(`ro${n}`).innerHTML = xstr;
	    })
		.catch(err => {
		    document.getElementById(`ro${n}`).innerHTML = err.toString();
		    console.log("ERR", err);
		})
	} catch (err) {
	    console.log("ERR", err);
	}
    } catch (err) {
	console.log(err);
	document.getElementById(`ro${n}`).innerHTML = "error";
    }
}

function executeWrite(n, nm) {
    try {
	alert("EVM Write Contract functionality is disabled pending further testing.  Contact info@polkaholic.io to volunteer in testing!");
	return;
	let inputs = []
	for ( const id of args[n]) {
	    let inp = document.getElementById(id).value;
	    inputs.push(inp);
	}
	console.log("executeWrite", _contractInstance[nm], inputs);
	let res = _contractInstance[nm].apply(null, inputs)
	res.then( (x) => {
	    let xstr = x.map( (o) => {
		return o.toString();
	    }).join(",")
	    console.log(n, xstr)
	    document.getElementById(`wo${n}`).innerHTML = xstr;
	})
    } catch (err) {
	document.getElementById(`wo${n}`).innerHTML = "error";
    }
}
let args = {}
let typs = {}

function presentContract(contract, provider, contractInstance)
{
    _contractInstance = contractInstance;
    let ABI = contract.ABI;
    let constructors = [];
    let reads = [];
    let events = [];
    let writes = [];
    for ( const x of ABI) {
	if ( x.type == 'function' ) {
	    if ( x.stateMutability == "view" ) {
		reads.push(x);
	    } else if ( x.stateMutability == "nonpayable" ) {
		writes.push(x);
	    } else {
		console.log(x);
	    }
	} else if ( x.type == "event" ) {
	    events.push(x);
	} else if ( x.type == "constructor" ) {
	    constructors.push(x);
	} else {
	    console.log(x);
	}
    }

    let rout = [];
    let todos = [];
    for (let n=0; n < reads.length; n++) {
	let r = reads[n];
	let inputs = r.inputs;
	let name = r.name;
	let outputs = r.outputs;
	let iout = [];
	if ( inputs.length > 0 ) {
	    let args0 = [];
	    let typs0 = [];
	    for ( let i = 0; i < inputs.length; i++ ) {
		let inp = inputs[i];
		let nm = inp.name;
		let typ = inp.type;
		let str = `${nm} (${typ})`
		let id = `p${n}-${i}`
		args0.push(id);
		typs0.push(typ);
		iout.push(`${str}<br/><input type=text style='width:100%' id="${id}" value="" placeholder="${str}">`)
	    }
	    args[n] = args0
	    typs[n] = typs0
	    iout.push(`<a href="javascript:executeRead(${n}, '${name}')" class="btn btn-sm">Query</a>`);
	    let outputstr = outputs.map( (o) => { return o.type } ).join(",")
	    iout.push("<img src='https://moonscan.io/images/svg/shapes/shape-1.svg' width=8 height=8>" + outputstr);
	    iout.push(`<div id='ro${n}'></div>`);
	} else {
	    try {
		iout.push(`<span id='read${n}'></span>`);
		todos.push(new Promise((resolve, reject) => {
		    let id = `read${n}`;
		    contractInstance[name]([]).then( (x) => {
			document.getElementById(id).innerHTML = x.toString(); 
		    })
		}));
	    } catch (err) {
		console.log(err)
	    }
	    let outputstr = outputs.map( (o) => { return o.type } ).join(",")
	    iout.push("<img src='https://moonscan.io/images/svg/shapes/shape-1.svg' width=8 height=8>" + outputstr);
	}
	let body = iout.join("<br>");

	rout.push(`<div class="accordion-item">
      <h6 class="accordion-header" id="heading${n}">
      <button class="accordion-button collapsed" type="button" data-mdb-toggle="collapse" data-mdb-target="#collapse${n}" aria-expanded="false" aria-controls="collapse${n}">
      <i class="fas fa-question-circle fa-sm me-2 opacity-70"></i>${name}</button>
      </h6>
      <div id="collapse${n}" class="accordion-collapse collapse" aria-labelledby="heading${n}" data-mdb-parent="#accordionRead">
        <div class="accordion-body">${body}</div>
      </div>
    </div>`)
    }
    let readstr = `<div class="accordion" id="reads">${rout.join("\n")}</div>`

    let wout = [];
    for (let n=0; n < writes.length; n++) {
	let r = writes[n];
	let inputs = r.inputs;
	let name = r.name;
	let outputs = r.outputs;
	let iout = [];
	if ( inputs.length > 0 ) {
	    for ( let i = 0; i < inputs.length; i++ ) {
		let inp = inputs[i];
		let nm = inp.name;
		let typ = inp.type;
		let str = `${nm} (${typ})`
		iout.push(`${str}<br/><input type=text style='width:100%' name="${nm}" value="" placeholder="${str}">`)
	    }
	    iout.push(`<a href="javascript:executeWrite(${n}, '${name}')" class="btn btn-sm">Write</a>`);
	} 
	let body = iout.join("<br>");

	wout.push(`<div class="accordion-item">
      <h6 class="accordion-header" id="heading${n}">
      <button class="accordion-button collapsed" type="button" data-mdb-toggle="collapse" data-mdb-target="#wcollapse${n}" aria-expanded="false" aria-controls="wcollapse${n}">
      <i class="fas fa-question-circle fa-sm me-2 opacity-70"></i>${name}</button>
      </h6>
      <div id="wcollapse${n}" class="accordion-collapse collapse" aria-labelledby="heading${n}" data-mdb-parent="#accordionWrite">
        <div class="accordion-body">${body}</div>
      </div>
    </div>`)

    }
    let writestr = `<div class="accordion" id="writes">${wout.join("\n")}</div>`
    
    return [readstr, writestr, todos];
}

async function showcontract(address, chain) {
    if (initcontract) return;
    else initcontract = true;
    let endpoint = `${baseURL}/contract/${address}`
    var req = new Request(endpoint, {
        method: 'GET',
        headers: new Headers({
            "Content-Type": "application/json"
        })
    });
    console.log("showcontract", endpoint);
	
    const provider = new ethers.providers.StaticJsonRpcProvider( chain.RPCBackfill, {
        chainId: chain.evmChainID,
        name: chain.chainName
    });
    
    let bozo = await fetch(req)
        .then((response) => response.json())
        .then( async (data) => {
            try {
		contract = data;
		if ( contract.ABI ) {
		    let contractInstance = new ethers.Contract( contract.asset , contract.ABI , provider);
		    let [readContract, writeContract, todos] = presentContract(contract, provider, contractInstance);
		    document.getElementById("v-tabs-read").innerHTML = readContract;
		    document.getElementById("v-tabs-write").innerHTML = writeContract;
		    try {
			document.getElementById("v-tabs-code").innerHTML = presentSourceCode(contract);
		    } catch ( err ) {
			console.log(err);
		    }
		    return(todos);
		} else {
		    let note = `<div class="alert" role="alert" data-mdb-color="warning">Unable to read contract info!</div>`
		    document.getElementById("v-tabs-read").innerHTML = note;
		    document.getElementById("v-tabs-write").innerHTML = note;
		    document.getElementById("v-tabs-code").innerHTML = note;
		    return [];
		}
            } catch (err) {
                console.log(err);
            }
        })
    let xxx = await Promise.all(bozo);
    console.log("DONE", xxx);
}


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
