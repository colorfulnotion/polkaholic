//var baseURL is set at header

function rendereventdata(data, id = "datascope") {
    var script = document.createElement("script");
    document.getElementById(id).innerHTML = "";
    script.innerHTML = `document.getElementById("${id}").appendChild(renderjson.set_show_to_level(5)(` + JSON.stringify(data) + `))`;
    document.body.appendChild(script);
}

function fetcheventdata(eventID) {
    let endpoint = `${baseURL}/event/${eventID}`
    console.log(`requesting endpoint:${endpoint}`)
    var req = new Request(endpoint, {
        method: 'GET',
        headers: new Headers({
            "Content-Type": "application/json"
        })
    });
    fetch(req)
        .then((response) => response.json())
        .then((data) => {
            try {
                rendereventdata(data, "data" + eventID);
            } catch (err) {
                console.log(err);
            }
        });
}


function parseEventID(eventID) {
    let ida = eventID.split("-");
    if (ida.length == 4) {
        let extrinsicID = `${ida[1]}-${ida[2]}`
        let eventIndex = ida[3];
        return [extrinsicID, eventIndex];
    }
    return [null, null];
}

function presentEventDetails(eventID) {
    let [extrinsicID, eventIndex] = parseEventID(eventID);
    if (extrinsicID && eventIndex) {
        title = `View ${extrinsicID} Event# ${eventIndex}`;
    } else {
        title = `View ${eventID}`
    }
    return `<div style='width:650px'>
<a class="btn btn-outline-secondary btn-block text-capitalize" data-mdb-toggle="collapse" href="#data${eventID}" role="button" aria-control="data${eventID}" aria-expanded="false" style="text-align:left">${title}</a>
<div class="collapse mt-3 renderjson" id="data${eventID}"></div>
</div><script>document.getElementById('data${eventID}').addEventListener('show.bs.collapse', () => { fetcheventdata("${eventID}") } )</script>`;
}

function presentInstructions(msg, id, hdr = "Instructions", verify = null, width = "600") {
    let rjouter = "rjouter" + id;
    let jhouter = "jhouter" + id;
    let rj = "rj" + id;
    let jh = "jh" + id;
    let dec = "dec" + id;
    let vc = "vc" + id;
    let copyA = "ca" + id;
    let copyB = "cb" + id;
    let verifyA = "va" + id;
    let verifyB = "vb" + id;
    let verifyAButton = verify ? `<button id="${verifyA}" type="button" class="btn btn-link">Verify</button>` : "";
    let verifyBButton = verify ? `<button id="${verifyB}" type="button" class="btn btn-link">Verify</button>` : "";
    return `<div class="accordion  accordion-flush" style="width: ${width}px">
  <div class="accordion-item">
    <h2 class="accordion-header" id="heading${id}">
      <button class="accordion-button collapsed" type="button" data-mdb-toggle="collapse"
        data-mdb-target="#flush${id}" aria-expanded="true" aria-controls="flush${id}">${hdr}</button>
    </h2>
    <div id="flush${id}" class="accordion-collapse collapse" aria-labelledby="heading${id}">
      <div class="accordion-body">
<div id="${rjouter}" style="display:none; overflow: hidden">
  <div id="${rj}" class="renderjson" style="overflow-y: scroll; max-width: 800px; max-height: 600px"></div>
  <button id="${dec}" type="button" class="btn btn-link">View Decoded</button>
  <button id="${copyA}" type="button" class="btn btn-link">Copy</button>
  ${verifyAButton}
</div>
<div id="${jhouter}" style="display: block; overflow: hidden">
  <div id="${jh}" class="jsontable" style="overflow-y: scroll; max-width: 800px; max-height: 600px"></div>
  <button id="${vc}" type="button" class="btn btn-link">View Raw</button>
  <button id="${copyB}" type="button" class="btn btn-link">Copy</button>
  ${verifyBButton}
<div>
<script>presentJSONObject(${msg}, "${id}", ${JSON.stringify(verify)});</script>
<form id="verifyForm${id}" method="POST" action="/verify" target="VW${id}"><input type="hidden" name="verify" value=""/><input type="hidden" name="obj" value=""/></form>
</div>
    </div>
  </div>
</div>`
}

function verifyExec(id, verify, obj) {
    console.log("verifyExec", id, "obj", obj, "verify", verify)
    if (verify) {
        // https://stackoverflow.com/questions/3951768/window-open-and-pass-parameters-by-post-method
        window.open('', `VW${id}`);
        var f = document.getElementById(`verifyForm${id}`);
        if (f) {
            f[`verify`].value = JSON.stringify(verify);
            f[`obj`].value = JSON.stringify(obj);
            document.getElementById(`verifyForm${id}`).submit();
        } else {
            console.log(`verifyForm${id} not found`);
        }
    }
}

function presentJSONObject(obj, id, verify = null) {
    let renderjsonIDOuter = "rjouter" + id;
    let jsontableIDOuter = "jhouter" + id;
    let renderjsonID = "rj" + id;
    let jsontableID = "jh" + id;
    let decodeButtonID = "dec" + id;
    let viewcodeButtonID = "vc" + id;
    let copyAButtonID = "ca" + id;
    let copyBButtonID = "cb" + id;
    let verifyAButtonID = "va" + id;
    let verifyBButtonID = "vb" + id;
    if ((Array.isArray(obj) && obj.length == 0) || Object.keys.length == 0) {
        document.getElementById(renderjsonID).style.display = "none";
        document.getElementById(jsontableID).style.display = "none";
        return;
    }
    $(`#${decodeButtonID}`).on('click', function(e) {
        document.getElementById(renderjsonIDOuter).style.display = "none";
        document.getElementById(jsontableIDOuter).style.display = "block";
    });
    $(`#${viewcodeButtonID}`).on('click', function(e) {
        document.getElementById(renderjsonIDOuter).style.display = "block";
        document.getElementById(jsontableIDOuter).style.display = "none";
    });
    $(`#${copyAButtonID}`).on('click', function(e) {
        copyToClipboard(JSON.stringify(obj));
    });
    $(`#${copyBButtonID}`).on('click', function(e) {
        copyToClipboard(JSON.stringify(obj));
    });
    document.getElementById(renderjsonID).appendChild(renderjson.set_show_to_level(3)(obj));
    document.getElementById(jsontableID).innerHTML = JSONToHTMLTable(obj);
    if (verify) {
        $(`#${verifyAButtonID}`).on('click', function(e) {
            verifyExec(id, verify, obj);
        });
        $(`#${verifyBButtonID}`).on('click', function(e) {
            verifyExec(id, verify, obj);
        });
    }
}


function JSONToHTMLTable(data) {
    let mid = Object.keys(data).map((k) => {
        let p = ''
        if (!Array.isArray(data)) {
            p += `<td width="20%"><b>${k}</b></td>`
        }
        if (data[k] && typeof data[k] === 'object') {
            p += `<td width="80%">` + JSONToHTMLTable(data[k]) + '</td>';
        } else {
            p += `<td width="80%">${data[k]}</td>`;
        }
        return `<tr>${p}</tr>`;
    });
    return `<table class="jsontable" width="100%"><tbody>${mid.join("")}</tbody></table>`;
}

function showProcessing(processing) {
    let processing2 = document.getElementById("processing");
    if (processing2) {
        if (processing) {
            processing2.style.visibility = 'visible'
        } else {
            processing2.style.visibility = 'hidden'
        }
    }
}


function postData(pathParams, data, tableName, fld = false) {
    let endpoint = `${baseURL}/${pathParams}`
    console.log(`requesting endpoint:${endpoint}`)
    var req = new Request(endpoint, {
        method: 'POST',
        headers: new Headers({
            "Content-Type": "application/json"
        }),
        body: JSON.stringify(data)
    });
    showProcessing(true);
    fetch(req)
        .then((response) => response.json())
        .then((data) => {
            let dataLen = (data[fld] != undefined) ? data[fld].length : data.length
            if (fld) {
                if (data[fld] != undefined) {
                    var table = $(tableName).DataTable();
                    table.clear();
                    table.rows.add(data[fld])
                    table.draw();
                    //console.log(`loadData done. selected fld=${fld}. endpoint:${endpoints}`)
                } else {
                    console.log(`selected fld=${fld} not found! endpoint:${endpoints}`)
                }
            } else {
                var table = $(tableName).DataTable();
                table.clear();
                table.rows.add(data)
                table.draw();
                //console.log(`load (${tableName}) done. endpoint:${endpoints}`)
                showProcessing(false);
            }
        });
}

async function loadData2(pathParams, tableName, includeCurrency = true, fld = false, tabName = false, tabTitle = false, maxCap = 50) {
    let endpoints = `${baseURL}/${pathParams}`
    var table = $(tableName).DataTable();
    let info = table.page.info();
    let limit = info.length;
    let separator = pathParams.includes("?") ? "&" : "?";
    if (limit >= 100) {
        endpoints += separator + "limit=10000";
    } else if (limit == 50) {
        endpoints += separator + "limit=1000";
    } else if (limit == 25) {
        endpoints += separator + "limit=500";
    } else {
        endpoints += separator + "limit=" + limit;
    }
    console.log("loadData2", endpoints, info);
    var req = new Request(endpoints, {
        method: 'GET',
        headers: new Headers({
            "Accept": "application/json; odata=verbose",
        })
    });
    showProcessing(true);
    fetch(req)
        .then((response) => response.json())
        .then((data) => {
            let dataLen = (data[fld] != undefined) ? data[fld].length : data.length
            if (fld) {
                if (data[fld] != undefined) {
                    table.clear();
                    table.rows.add(data[fld])
                    table.draw();
                    //console.log(`loadData done. selected fld=${fld}. endpoint:${endpoints}`)
                } else {
                    console.log(`selected fld=${fld} not found! endpoint:${endpoints}`)
                }
            } else {
                table.clear();
                table.rows.add(data)
                table.draw();
                if (includeCurrency) {
                    setupcurrency()
                }
                //console.log(`load (${tableName}) done. endpoint:${endpoints}`)
            }
            showProcessing(false);
            if (tabName && tabTitle && dataLen > 0) {
                if (dataLen >= maxCap) {
                    dataLen = `${maxCap}+`
                }
                if (document.getElementById(`${tabName}-tab`)) {
                    document.getElementById(`${tabName}-tab`).innerHTML = `${tabTitle} (${dataLen})`
                } else {
                    console.log(`tabName notfound`, `${tabName}-tab = ${tabTitle}`);
                }
            } else {
                //console.log(`notfound`, `${tabName}-tab = ${tabTitle} (${dataLen})`)
            }
        });
}

function getShortHash(hash, allowCopy = true) {
    if (hash) {
        let out = (hash.length >= 30) ? `<code>${hash.substr(0,8)}...${hash.substr(-6)}</code>` : `<code>${hash}</code>`;
        if (allowCopy) {
            const clipboardIcon = '<i class="fa-regular fa-copy"></i>';
            out += "<a href='javascript:copyToClipboard(\"" + hash + "\")'>" + clipboardIcon + "</a>";
        }
        return (out);
    } else {
        return "-";
    }
}

function getFullHash(hash, allowCopy = true) {
    if (hash) {
        let out = `<code>${hash}</code>`;
        if (allowCopy) {
            const clipboardIcon = '<i class="fa-regular fa-copy"></i>';
            out += "<a href='javascript:copyToClipboard(\"" + hash + "\")'>" + clipboardIcon + "</a>";
        }
        return (out);
    } else {
        return "-";
    }
}

function timeSince(seconds) {
    var days = Math.floor(seconds / 86400);
    seconds = seconds % 86400;
    var hours = Math.floor(seconds / 3600);
    seconds = seconds % 3600;
    var minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;

    if (days >= 1) {
        let pl = (days > 1) ? "s" : ""
        let out = days + " day" + pl;
        let pl2 = (hours > 1) ? "s" : ""
        out += " " + hours + " hr" + pl2;
        return out;
    }
    if (hours >= 1) {
        let pl = (hours > 1) ? "s" : ""
        let out = hours + " hr" + pl;
        let pl2 = (minutes > 1) ? "s" : ""
        out += " " + minutes + " min" + pl2;
        return out;
    }
    if (minutes >= 1) {
        let pl = (minutes > 1) ? "s" : ""
        let out = minutes + " min" + pl;
        let pl2 = (seconds > 1) ? "s" : "";
        out += " " + seconds + " sec" + pl2;
        return out;
    }
    return seconds + " secs";
}

function timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp * 1000);
    var year = a.getUTCFullYear();
    var month = (a.getUTCMonth() + 1).toString().padStart(2, '0');
    var date = a.getUTCDate().toString().padStart(2, '0');
    var hour = a.getUTCHours().toString().padStart(2, '0');
    var min = a.getUTCMinutes().toString().padStart(2, '0');;
    var secs = a.getUTCSeconds().toString().padStart(2, '0');
    var time = year + '-' + month + '-' + date + ' ' + hour + ':' + min + ":" + secs + " (+UTC)";
    return time;
}

function shorttimeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp * 1000);
    var hour = a.getUTCHours().toString().padStart(2, '0');
    var min = a.getUTCMinutes().toString().padStart(2, '0');;
    var secs = a.getUTCSeconds().toString().padStart(2, '0');
    var time = hour + ':' + min + ":" + secs;
    return time;
}

function beautifyCamelCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function presentSpecVersion(chainID, specVersion) {
    return '<a href="/specversion/' + chainID + '/' + specVersion + '">' + specVersion.toString() + '</a>';
}

function presentBlockNumber(id, chainName, blockNumber) {
    if (!blockNumber) return "-";
    let txt = (typeof blockNumber == "string") ? blockNumber : blockNumber.toString();
    let out = '<a href="/block/' + id + '/' + blockNumber + '"><code>' + txt + '</code></a>';
    if (chainName) out = chainName + " " + out;
    return out;
}

function presentEvent(data) {
    let res = JSON.stringify(data)
    try {
        res = JSON5_TO_TABLE.generateHTMLTable([data])
    } catch (e) {
        //console.log(e)
        res = JSON.stringify(data, undefined, 2)
    }
    return res
}

function presentBlockHash(chainID, chainName, blockNumber, blockHash) {
    if (!blockHash) return ("NA");
    if (typeof blockHash == "string") {
        if (blockHash.length < 64) return ("NA");
        let urlPath = `/block/${chainID}/${blockNumber}`
        return '<a href="' + urlPath + '">' + getShortHash(blockHash) + '</a>';
    } else if (Array.isArray(blockHash)) {
        let out = [];
        for (let i = 0; i < blockHash.length; i++) {
            let urlPath = `/block/${chainID}/${blockNumber}?blockhash=${blockHash[i]}`
            let o = '<a href="' + urlPath + '">' + getShortHash(blockHash[i]) + '</a>';
            out.push(o);
        }
        return out.join(" | ")
    }
    return ("NA");
}

function presentTS(ts) {
    if (!ts) return ("");
    if (ts == 0) return ("");
    try {
        let secondsago = Math.floor(Date.now() / 1000) - ts;
        let str = timeSince(secondsago) + " ago";
        const dateObject = new Date(ts * 1000)
        let utctime = dateObject.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        utctime += " (+UTC)";
        return `<button type="button" class="btn btn-link text-lowercase" style="font-size:0.9rem;font-style:normal" data-mdb-placement="right" title="${utctime}" >${str}</button>`
    } catch (err) {
        return "";
    }
}

function presentExtrinsicInfo(i) {
    let out = [];
    if (i.extrinsicHash !== undefined) {
        out.push('<a href="/tx/' + i.extrinsicHash + '">' + getShortHash(i.extrinsicHash) + '</a>');
    }
    if (i.chainID !== undefined && i.section !== undefined && i.method !== undefined) {
        out.push(presentExtrinsic(i.chainID, i.section, i.method));
    }
    if (out.length > 0) {
        return out.join("");
    }
    return "";
}

function presentExtrinsicIDHash(extrinsicID, txHash, allowCopy = true) {
    let out = `<a href='/tx/${txHash}'>` + getFullHash(extrinsicID, false) + `</a>`;
    if (allowCopy) {
        const clipboardIcon = '<i class="fa-regular fa-copy"></i>';
        out += "<a href='javascript:copyToClipboard(\"" + txHash + "\")'>" + clipboardIcon + "</a>";
    }
    return out;
}

function presentTxHash(txHash) {
    return '<a href="/tx/' + txHash + '">' + getShortHash(txHash) + '</a>';
}

function presentXCMTimeline(hash, hashType, blockNumber) {
    return `<a href="/timeline/${hash}/${hashType}/${blockNumber}">timeline</a>`
}

function presentXCMMessageHash(msgHash, blockNumber, allowCopy = true) {
    return `<a href="/xcmmessage/${msgHash}/${blockNumber}">` + getShortHash(msgHash, allowCopy) + '</a>';
}

function presentChain(id, chainName, iconURL = false, crawlingStatus = "") {
    if (!chainName) chainName = "chain" + id;
    let i = iconURL ? `<img width=24 src="${iconURL}" style="margin: 3px; padding: 3px;"/>` : "";
    let s = crawlingStatus.length > 0 ? `<span data-mdb-placement="right" title="${crawlingStatus}" ><i class="fas fa-exclamation-triangle"></i></span>` : '';
    return i + '<a href="/chain/' + id + '">' + beautifyCamelCase(chainName) + '</a>' + s;
}

function encodeURIComponent2(assetChain) {
    return encodeURIComponent(assetChain).replace("#", "%23");
}

function presentAsset(asset) {
    let chainID = asset.chainID;
    let asset0 = asset.asset;
    let symbol = asset.symbol;
    console.log("presentAsset", asset);
    return `<a href="/symbol/${symbol}">` + symbol + '</a>';
}

function presentAssetPair(row) {
    try {
	/*
asset: "0x05cae890aa5b30f19dcc38ba2ea525e9eb9ae995"
assetChain: "0x05cae890aa5b30f19dcc38ba2ea525e9eb9ae995~2004"
assetName: "Stella LP"
assetType: "ERC20LP"
chainID: 2004
chainName: "Moonbeam"
decimals: 18
isUSD: 0
nativeAssetChain: null
numHolders: 2
priceUSDpaths: false
routeDisabled: 0
symbol: "STELLA LP"
token0: "0x322e86852e492a7ee17f28a78c663da38fb33bfb"
token0Decimals: 18
token0Symbol: "FRAX"
token1: "0xffffffffa922fef94566104a6e5a35a4fcddaa9f"
token1Decimals: 12
token1Symbol: "xcACA" */
	let asset0 = row.token0
	let asset1 = row.token1
	let assetPair = `<a href='${row.chainID}/${row.asset}'>${row.symbol}</a>`
	return `${assetPair}: <a href="/asset/${row.chainID}/` + encodeURIComponent2(row.token0) + '">' + row.token0Symbol + `</a> / <a href="/asset/${row.chainID}/` + encodeURIComponent2(row.token1) + '">' + row.token1Symbol + '</a>';
    } catch (e) {
	console.log("presentAssetPair", row);
    }
}

function presentID(id) {
    return '<a href="/account/' + id + '">' + getShortHash(id) + '</a>';
}

function presentAddress(id) {
    return '<a href="/address/' + id + '">' + getShortHash(id) + '</a>';
}

function presentOffer(offer) {
    let id = offer.offerID;
    let scr = `document.getElementById("related${id}").appendChild(renderjson.set_show_to_level(2)(` + JSON.stringify(offer) + `))`;
    return "<div id='related" + id + "' class='renderjson'></div><script>" + scr + "</script>";
}

function presentXCMMessage(msg, id) {
    try {
        let scr = `
      <a class="btn  btn-light btn-sm text-capitalize" data-mdb-toggle="modal" data-mdb-target="#message${id}">Details</a>
      <!-- Modal -->
      <div class="modal fade" id="message${id}" data-mdb-backdrop="static" data-mdb-keyboard="false" tabindex="-1" aria-labelledby="msgLabel${id}" aria-hidden="true">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="messageLabel${id}">XCM Message</h5>
              <button type="button" class="btn btn-light btn-close" data-mdb-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" style="overflow-x: auto;">
              <div id="msg${id}" class="renderjson"></div>
              <script type="text/javascript">
                document.getElementById("msg${id}").appendChild(renderjson.set_show_to_level(5)(${JSON.stringify(msg)}));
              </script>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-mdb-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>`
        return scr;
    } catch (err) {
        console.log("presentXCMMessage", err);
        return "-"
    }
}

function presentIDRow(row, fld) {
    if (row[fld] == undefined) return "";
    let id = row[fld];
    let res = '<a href="/account/' + id + '">' + getShortHash(id) + '</a>';
    let hit = null;
    if (row[fld + "Address"] != undefined) {
        hit = fld + "Address";
    } else if (row[fld] != undefined) {
        hit = fld;
    }
    if (hit != null) {
        if (row[hit + "_nickname"] != undefined) {
            res += "<BR>" + row[hit + "_nickname"]
        } else if (row[hit + "_subIdentityName"] != undefined) {
            res += "<BR>" + row[hit + "_subIdentityName"]
            if (row[hit + "_parent"] != undefined) {
                //res += "<BR>(<a href='/account/" + row[hit + "_parent"] + "'>parent</a>)";
            }
        } else if (row[hit + "_info"] != undefined) {
            try {
                let info = row[hit + "_info"];
                if (info.display != undefined) {
                    res += "<BR>" + info.display;
                }
            } catch (err) {
                console.log("presentIDRow err", err, row)
            }
        }
        if (row[hit + "_related"] != undefined) {
            for (let i = 0; i < row[hit + "_related"].length; i++) {
                let r = row[hit + "_related"][i];
                if (r.accountType == "multisig") {
                    res += `<BR>MULTISIG (${r.threshold} / ${r.signatorycnt})`
                } else if (r.accountType == "proxyDelegateOf" && (r.chainID != undefined) && (row.chainID != undefined) && (r.chainID == row.chainID)) {
                    res += `<BR>PROXY Delegate of <a href='/account/${r.delegateOf}'>${getShortHash(r.delegateOf)}</a>`;
                }
            }

        }
    }
    return res;
}

function presentIDwithIdenticon(id) {
    return '<img src="/identicon/' + id + '" class="rounded-start"  height="100%"  loading="lazy" class="card-img-center"/><a href="/account/' + id + '">' + getShortHash(id) + '</a>';
}


function presentFullAddress(addr) {
    return '<a href="/account/' + addr + '">' + getFullHash(addr) + '</a>';
}

function presentEVMAddress(evm) {
    if (evm != undefined) {
        let h160 = evm.H160
        let ss58 = evm.SS58
        if (h160 != undefined && ss58 != undefined) {
            return '<a href="/account/' + ss58 + '">' + getFullHash(h160) + '</a>';
        }
    }
    return '<a > - </a>'
}

function presentRelated(row, id) {

    let scr = `document.getElementById("related${id}").appendChild(renderjson.set_show_to_level(2)(` + JSON.stringify(row) + `))`;
    return "<div id='related" + id + "' class='renderjson'></div><script>" + scr + "</script>";
}

function presentSS58H160(url, linktype, title, description, metadata) {
    let out = '<a href="' + url + '">' + title + '</a>';
    if (description && description.length > 0) {
        out += "<br>" + description
    }
    return (out);
}

function presentIDs(ids) {
    let out = [];
    for (let i = 0; i < ids.length; i++) {
        out.push(presentID(ids[i]));
    }
    return out.join(",");
}


function cover_params(params, id, depth = 2) {
    try {
        let scr = `document.getElementById("params${id}").appendChild(renderjson.set_show_to_level(${depth})(` + JSON.stringify(params) + `))`;
        return "<div id='params" + id + "' class='renderjson'></div><script>" + scr + "</script>";
    } catch (e) {
        console.log("FAIL", e);
    }
}

function cover_utility(decodedParams) {
    let out = '<table class="table table-striped table-hover  table-sm"><thead><tr><th>#</th><th>Call</th><th>Params</th></tr></thead><tbody>';
    for (let i = 0; i < decodedParams.length; i++) {
        let c = decodedParams[i];
        let pallet_method = c.method + ":" + c.section;
        if (pallet_method) {
            let c_module = c.method;
            let c_function = c.section;
            let d0 = '<button type="button" class="btn btn-outline-primary">' + c_module + ':' + c_function + '</button>';
            out += '<tr><th>' + i + '</th><td>' + d0 + '</td><td>' + cover_params(c) + '</td></tr>';
        }
    }
    out += '</tbody></table>';
    return (out);
}

function currency_format(c) {
    var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    });
    return formatter.format(c);
}

function presentTokenAttribute(t, attr) {
    if (t[attr] > 0) {
        let str = "";
        str = attr + ": " + (Math.round(t[attr] * 100000) / 100000);
        let v = t[attr + "USD"];
        if (v && v > 0) {
            str = str + " (" + currency_format(v) + ")";
        }
        return str;
    }
    return false;
}

function presentTokenAsset(asset) {
    if (asset.Token) {
        return asset.Token;
    } else if (asset.ForeignAsset) {
        switch (asset.ForeignAsset) {
            case "0":
                return "RMRK";
            default:
                return "ForeignAsset:" + asset.ForeignAsset;
        }
    } else if (asset.LiquidCrowdloan) {
        switch (asset.LiquidCrowdloan) {
            case 13:
                return "lcDOT";
                break;
            default:
                return "ACALA(" + asset.LiquidCrowdloan + ")";
        }
    } else if (Array.isArray(asset)) {
        let tok0 = presentTokenAsset(asset[0]);
        let tok1 = presentTokenAsset(asset[1]);
        return tok0 + "/" + tok1;
    }
    return JSON.stringify(asset);
}

function presentToken(token) {
    let asset = JSON.parse(token.asset);
    let out = 'Token: ' + presentTokenAsset(asset) + ':';
    let pieces = ["free", "miscFrozen", "feeFrozen", "frozen"];
    let res = [];
    for (const a of pieces) {
        let piece = presentTokenAttribute(token, a);
        if (piece) {
            res.push(piece);
        }
    }
    out += res.join("; ");
    return out;
}

//return camelCase palletMethod
function presentExtrinsic(chainID, palletName, moduleName, isEVM = false) {
    if (palletName == undefined || (palletName == null)) palletName = "unknown";
    if (moduleName == undefined || (moduleName == null)) moduleName = "unknown";
    let palletMethod = `${beautifyCamelCase(palletName)}:${beautifyCamelCase(moduleName)}`
    if (isEVM) {
        if ((palletName == "unknown" && moduleName == "0x") || palletName == "nativeTransfer") {
            palletName = "nativeTransfer";
            moduleName = "";
            palletMethod = "nativeTransfer";
        }

        return `<a href="/evmtxs/${chainID}/${palletName}/${moduleName}" class="btn btn-outline-primary text-capitalize">${palletMethod}</a>`;
    } else {
        return `<a href="/extrinsics/${chainID}/${palletName}/${moduleName}" class="btn btn-outline-primary text-capitalize">${palletMethod}</a>`;
    }
}

function presentLoan(loan) {
    if (!loan) return ("");
    let asset = JSON.parse(loan.asset);
    let out = '<B>Loan:</B> Borrowed: ' + loan.borrowedAsset + ';  Collateral: ' + presentTokenAsset(asset) + ';  Exchange Rate: ' + loan.exchangeRate + '<br/>';
    return (out);
}


function copyToClipboardId(id) {
    let textToCopy = document.getElementById(id).innerHTML;
    copyToClipboard(textToCopy);
}

// return a promise
function copyToClipboard(textToCopy) {
    // navigator clipboard api needs a secure context (https)
    if (false && navigator.clipboard && window.isSecureContext) {
        // navigator clipboard api method'
        return navigator.clipboard.writeText(textToCopy);
    } else {
        // text area method
        let textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        // make the textarea out of viewport
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise((res, rej) => {
            // here the magic happens
            if (document.execCommand('copy')) {
                launchToast("Copied");
                res()
            } else {
                rej();
            }
            console.log("copied", textToCopy, this);
            textArea.remove();
        });
    }
}

let stackCount = 0;

function launchToast(txt, title = false) {
    stackCount++;
    const toast = document.createElement('div');
    let toastTitle = (title) ? title : "Polkaholic Notification"
    toast.innerHTML = `
    <div class="toast-header">
      <strong class="me-auto">${toastTitle}</strong>
      <small>now</small>
      <button type="button" class="btn-close" data-mdb-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body text-start">` + txt + `</div>`;
    toast.classList.add('toast', 'fade');
    document.body.appendChild(toast);

    const toastInstance = new mdb.Toast(toast, {
        stacking: true,
        hidden: true,
        width: '450px',
        position: 'top-center',
        autohide: true,
        delay: 4000,
    });
    toastInstance.show();
}

function presentTokenCount(amt) {
    if (!amt) return 0;
    let a = (typeof amt == 'string') ? parseFloat(amt, 10) : amt;
    if (typeof a == 'float' || typeof a == "number") {
        return (new Intl.NumberFormat('en-US', {
            maximumSignificantDigits: 10
        }).format(amt));
    } else {
        return a;
    }
}

function presentNumber(a) {
    if (!a) return 0
    if (a >= 1000000000000) {
        let amt = a / 1000000000000;
        return (new Intl.NumberFormat('en-US', {
            maximumSignificantDigits: 3
        }).format(amt) + "T");
    }
    if (a >= 1000000000) {
        let amt = a / 1000000000;
        return (new Intl.NumberFormat('en-US', {
            maximumSignificantDigits: 3
        }).format(amt) + "B");
    }
    if (a >= 1000000) {
        let amt = a / 1000000;
        return (new Intl.NumberFormat('en-US', {
            maximumSignificantDigits: 3
        }).format(amt) + "M");
    }
    if (a >= 1000) {
        let amt = a / 1000;
        return (new Intl.NumberFormat('en-US', {
            maximumSignificantDigits: 3
        }).format(amt) + "K");
    }
    return (a.toString());
}

function getPubkey(account) {
    try {
        let pubkey = polkadotKeyring.decodeAddress(account.address);
        return polkadotUtil.u8aToHex(pubkey);
    } catch (err) {
        console.log(err);
    }
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/;domain=polkaholic.io";
}


function setConsent(consent) {
    try {
        var x = document.getElementById("cookieconsent");
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
        console.log("setConsent!!!", consent);
        setCookie('consent', consent);
    } catch (e) {
        console.log("setConsent FAIL!!!", e);
    }
}


function home() {
    let [homeName, homeAcct] = getWalletHome();

    if (homeAcct != undefined && homeAcct.length > 0) {
        window.location.href = "/home/";
    } else {
        //showWalletModal();
        selectWalletAccount();
    }
}

function currencyFormat(c, priceUSD = false, priceUSDCurrent = false, isDefaultOriginal = true) {
    if (isNaN(c)) {
        return `-`
    }
    let msd = {
        style: 'currency',
        currency: 'USD',
    }
    if (c <= .01) {
        msd.minimumSignificantDigits = 5;
        msd.maximumSignificantDigits = 5;
    } else if (c <= .10) {
        msd.minimumSignificantDigits = 4;
        msd.maximumSignificantDigits = 4;
    } else if (c <= 1.0) {
        msd.minimumSignificantDigits = 3;
        msd.maximumSignificantDigits = 3;
    }
    // : (c < .10) ? 4 : ( c < 1 ) ? 3
    var formatter = new Intl.NumberFormat('en-US', msd);
    if (priceUSD && priceUSDCurrent && priceUSD > 0 && priceUSDCurrent > 0) {
        let originalUSD = formatter.format(c);
        let currentUSD = formatter.format(c * (priceUSDCurrent / priceUSD));
        if (isDefaultOriginal) {
            //present original USD as default value
            let msgTitle = "Displaying value at the time of Txn; Click to show current value"
            return `<button type="button" class="btn btn-link" style="font-size:0.9rem;font-style:normal" currency="usd" original="0"  originalUSD="${originalUSD}" currentUSD="${currentUSD}" data-mdb-placement="right" title="${msgTitle}" >${originalUSD}</button>`
        } else {
            //present current USD as default value
            let msgTitle = "Displaying current value; Click to show value are the time of Txn"
            return `<button type="button" class="btn btn-link" style="font-size:0.9rem;font-style:normal" currency="usd" original="1"  originalUSD="${originalUSD}" currentUSD="${currentUSD}" data-mdb-placement="right" title="${msgTitle}" >${currentUSD}</button>`
        }
    }
    return formatter.format(c);
}


function setupapidocs(major = "", minor = "", input = "", chainfilterStr = false) {
    let docsSection = false;
    let apiUrl = false;
    let extra = "";
    switch (major) {
        case "account":
            //apiUrl = (input == "") ? "/account/<Address>" : `/account/${input}`
            apiUrl = "/account"
            switch (minor) {
                case "realtime":
                    apiUrl += "/realtime";
                    docsSection = "get-account-realtime";
                    break;
                case "feed":
                    apiUrl += "/feed";
                    docsSection = "get-account-feed";
                    break;
                case "related":
                    apiUrl += "/related";
                    docsSection = "get-account-related";
                    break;
                case "nft":
                    apiUrl += "/nft";
                    docsSection = "get-account-nft";
                    break;
                case "history":
                    apiUrl += "/history";
                    docsSection = "get-account-history";
                    break;
                case "extrinsics":
                    apiUrl += "/extrinsics";
                    docsSection = "get-account-extrinsics";
                    break;
                case "transfers":
                    apiUrl += "/transfers";
                    docsSection = "get-account-transfers";
                    break;
                case "crowdloans":
                    apiUrl += "/crowdloans";
                    docsSection = "get-account-crowdloans";
                    break;
                case "rewards":
                    apiUrl += "/rewards";
                    docsSection = "get-account-rewards";
                    break;
                case "xcmtransfers":
                    apiUrl += "/xcmtransfers";
                    docsSection = "get-account-xcmtransfers";
                    break;
                default:
                    apiUrl += "/404";
                    docsSection = "404";
                    break;
            }
            if (input == "") {
                apiUrl += "/<Address>"
            } else {
                apiUrl += `/${input}`
            }
            if (chainfilterStr && chainfilterStr != 'all') {
                apiUrl += `?chainfilters=${chainfilterStr}`
            }
            break;
        case "block":
            apiUrl = (input == "") ? "/block/&lt;ChainID&gt;/&lt;BlockNumber&gt;" : `/block/${input}`
            docsSection = "get-block";
            break;
        case "trace":
            apiUrl = (input == "") ? "/trace/&lt;ChainID&gt;/&lt;BlockNumber&gt;" : `/trace/${input}`
            console.log("TRACE", apiUrl);
            docsSection = "get-trace";
            break;
        case "asset":
            //apiUrl = (input == "")? "/asset/&lt;assetChain&gt;": `/asset/${input}`
            apiUrl = "/asset/&lt;assetChain&gt;";
            switch (minor) {
                case "assetholders":
                    apiUrl += "/assetholders";
                    docsSection = "get-asset-assetholders";
                    break;
                case "assetsrelated":
                    apiUrl += "/assetsrelated";
                    docsSection = "get-asset-assetsrelated";
                    break;
            }
            break;
        case "chain":
            apiUrl = (input == "") ? "/chain/&lt;ChainID&gt;" : `/chain/${input}`
            switch (minor) {
                case "assets":
                    apiUrl = `/chain/assets/${input}`;
                    docsSection = "get-chain-assets";
                    break;
                case "chainlog":
                    apiUrl = `/chainlog/${input}`;
                    docsSection = "get-chain-log";
                    break;
                case "specversions":
                    apiUrl = `/specversions/${input}`;
                    docsSection = "get-chain-specversions";
                    break;
                case "specversion":
                    apiUrl = `/specversion/${input}`;
                    docsSection = "get-chain-specversions";
                    break;
                case "info":
                    apiUrl += "/info";
                    docsSection = "get-chain-info";
                    break;
                default:
                case "recentblocks":
                    //apiUrl += "/recentblocks";
                    docsSection = "get-chaininfo-and-recent-blocks";
                    break;
            }
            break;
        case "xcmtransfers":
            apiUrl = "/xcmtransfers";
            docsSection = "get-xcmtransfers";
            break;
        case "addresstopn":
            //apiUrl += "/addresston";
            //docsSection = "get-addresstopn";
            apiUrl += "/404";
            docsSection = "404";
            break;
        case "chains":
            switch (minor) {
                case "list":
                    apiUrl = "/chains";
                    docsSection = "get-all-chains"
                    break;
            }
            break;
        case "tx":
            apiUrl = (input == "") ? "/tx/&lt;TxHash&gt;" : `/tx/${input}`
            //apiUrl = "/tx/&lt;TxHash&gt;";
            docsSection = "get-transaction-substratetx";
            break;
        case "search":
            apiUrl = `/search/${minor}`;
            docsSection = `search-${minor}`;
            extra = `-X POST -H "Content-Type: application/json" -d '${JSON.stringify(input)}' `
            console.log("setupapidocs", apiUrl, docsSection, input)
    }
    let apidocs = document.getElementById("apidocs");
    if (apidocs) {
        if (docsSection && docsSection != '404') {
            let docsUrl = "https://docs.polkaholic.io/" + "#" + docsSection;
            let docsUrlLink = document.getElementById("docsUrl");
            if (docsUrlLink) {
                docsUrlLink.href = docsUrl;
                //console.log("setupapidocs - docsUrl", docsUrl);
            } else {
                //console.log("setupapidocs - docsUrlLink not found");
            }
            let apiUrlSpan = document.getElementById("apiUrl");
            if (apiUrlSpan) {
                apiUrlSpan.innerHTML = apiUrl
                //console.log("setupapidocs - apiUrl", apiUrl);
            } else {
                //console.log("setupapidocs - apiUrlSpan not found");
            }
            let apiextraSpan = document.getElementById("apiextra");
            if (apiextraSpan && (extra.length > 0)) {
                apiextraSpan.innerHTML = extra;
            }
            apidocs.style = "display:block";
        } else {
            apidocs.style = "display:none";
            //console.log("setupapidocs MISSING docsSection", major, minor);
        }
    }
}




function setupcurrency() {
    if (document.querySelector('button[currency="usd"]')) {
        //console.log("setupcurrency found - start");
        document.querySelectorAll('button[currency="usd"]').forEach((elem) => {
            //console.log("found currency element", elem);
            elem.addEventListener("click", function(event) {
                let original = elem.getAttribute("original");
                switch (original) {
                    case "0":
                        elem.setAttribute("original", "1");
                        elem.innerHTML = `${elem.getAttribute("currentUSD")}`;
                        elem.setAttribute("title", "Current Value");
                        elem.style.fontStyle = "italic"
                        break;
                    case "1":
                        elem.setAttribute("original", "0");
                        elem.innerHTML = `${elem.getAttribute("originalUSD")}`;
                        elem.setAttribute("title", "Estimated Value at the time of Txn");
                        elem.style.fontStyle = "normal"
                        break;
                    default:
                }
            });
        });
    } else {
        //console.log("no currency elements");
    }
}

function parseErrorMsg(errorMsg) {
    //'Failed(RequiredContractPreApproval) To register a contract, pre-approval is needed for this address'
    let idx = errorMsg.indexOf(')')
    let e = errorMsg.substring(0, idx + 1) //Failed(RequiredContractPreApproval)
    let desc = errorMsg.substring(idx + 2) //To register a contract, pre-approval is needed for this address'
    return [e, desc]
}

function presentFinalized(finalized, pMsg = false) {
    if (finalized) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-square" viewBox="0 0 16 16">
  <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
  <path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.235.235 0 0 1 .02-.022z"/>
</svg>`;
    } else {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clock-history" viewBox="0 0 16 16">
  <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.025 8.025 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z"/>
  <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
  <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/>
</svg>`
    }

}

function presentSuccessFailure(isSuccess, pMsg = false) {
    let out = ''
    if (isSuccess) {
        let sMsg = (pMsg) ? pMsg : 'Success';
        out = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-square" viewBox="0 0 16 16">
      <title>${sMsg}</title>
      <path d="M 8,1 C 4.1340066,1 1,4.1340066 1,8 c 0,3.865993 3.1340066,7 7,7 3.865993,0 7,-3.134007 7,-7 C 15,4.1340066 11.865993,1 8,1 z m 3.3125,3.0625 1.5625,1.40625 -5.25,6.9375 -4.0625,-3.5 1.34375,-1.78125 2.375,2.0625 4.03125,-5.125 z"
        inkscape:connector-curvature="0" id="path2922-6-6-0"
        style="color:#000000;fill:#4e9a06;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:0.84323651;marker:none;visibility:visible;display:inline;overflow:visible;enable-background:accumulate" />
    </svg>`
    } else {
        let eMsg = (pMsg) ? pMsg : 'Failed';
        let [e, desc] = parseErrorMsg(eMsg)
        out = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clock-history" viewBox="0 0 16 16">
      <title>${e}:\n${desc}</title>
      <path fill=#c93636 fill-rule="evenodd"
        d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
    </svg>`
    }
    return out
}



var module, window, define, renderjson = (function() {
    var themetext = function( /* [class, text]+ */ ) {
        var spans = [];
        while (arguments.length)
            spans.push(append(span(Array.prototype.shift.call(arguments)),
                text(Array.prototype.shift.call(arguments))));
        return spans;
    };
    var append = function( /* el, ... */ ) {
        var el = Array.prototype.shift.call(arguments);
        for (var a = 0; a < arguments.length; a++)
            if (arguments[a].constructor == Array)
                append.apply(this, [el].concat(arguments[a]));
            else
                el.appendChild(arguments[a]);
        return el;
    };
    var prepend = function(el, child) {
        el.insertBefore(child, el.firstChild);
        return el;
    }
    var isempty = function(obj, pl) {
        var keys = pl || Object.keys(obj);
        for (var i in keys)
            if (Object.hasOwnProperty.call(obj, keys[i])) return false;
        return true;
    }
    var text = function(txt) {
        return document.createTextNode(txt)
    };
    var div = function() {
        return document.createElement("div")
    };
    var span = function(classname) {
        var s = document.createElement("span");
        if (classname) s.className = classname;
        return s;
    };
    var A = function A(txt, classname, callback) {
        var a = document.createElement("a");
        if (classname) a.className = classname;
        a.appendChild(text(txt));
        a.href = '#';
        a.onclick = function(e) {
            callback();
            if (e) e.stopPropagation();
            return false;
        };
        return a;
    };

    function _renderjson(json, indent, dont_indent, show_level, options) {
        var my_indent = dont_indent ? "" : indent;

        var disclosure = function(open, placeholder, close, type, builder) {
            var content;
            var empty = span(type);
            var show = function() {
                if (!content) append(empty.parentNode,
                    content = prepend(builder(),
                        A(options.hide, "disclosure",
                            function() {
                                content.style.display = "none";
                                empty.style.display = "inline";
                            })));
                content.style.display = "inline";
                empty.style.display = "none";
            };
            append(empty,
                A(options.show, "disclosure", show),
                themetext(type + " syntax", open),
                A(placeholder, null, show),
                themetext(type + " syntax", close));

            var el = append(span(), text(my_indent.slice(0, -1)), empty);
            if (show_level > 0 && type != "string")
                show();
            return el;
        };

        if (json === null) return themetext(null, my_indent, "keyword", "null");
        if (json === void 0) return themetext(null, my_indent, "keyword", "undefined");

        if (typeof(json) == "string" && json.length > options.max_string_length)
            return disclosure('"', json.substr(0, options.max_string_length) + " ...", '"', "string", function() {
                return append(span("string"), themetext(null, my_indent, "string", JSON.stringify(json)));
            });

        if (typeof(json) != "object" || [Number, String, Boolean, Date].indexOf(json.constructor) >= 0) // Strings, numbers and bools
            return themetext(null, my_indent, typeof(json), JSON.stringify(json));

        if (json.constructor == Array) {
            if (json.length == 0) return themetext(null, my_indent, "array syntax", "[]");

            return disclosure("[", options.collapse_msg(json.length), "]", "array", function() {
                var as = append(span("array"), themetext("array syntax", "[", null, "\n"));
                for (var i = 0; i < json.length; i++)
                    append(as,
                        _renderjson(options.replacer.call(json, i, json[i]), indent + "    ", false, show_level - 1, options),
                        i != json.length - 1 ? themetext("syntax", ",") : [],
                        text("\n"));
                append(as, themetext(null, indent, "array syntax", "]"));
                return as;
            });
        }

        // object
        if (isempty(json, options.property_list))
            return themetext(null, my_indent, "object syntax", "{}");

        return disclosure("{", options.collapse_msg(Object.keys(json).length), "}", "object", function() {
            var os = append(span("object"), themetext("object syntax", "{", null, "\n"));
            for (var k in json) var last = k;
            var keys = options.property_list || Object.keys(json);
            if (options.sort_objects)
                keys = keys.sort();
            for (var i in keys) {
                var k = keys[i];
                if (!(k in json)) continue;
                append(os, themetext(null, indent + "    ", "key", '"' + k + '"', "object syntax", ': '),
                    _renderjson(options.replacer.call(json, k, json[k]), indent + "    ", true, show_level - 1, options),
                    k != last ? themetext("syntax", ",") : [],
                    text("\n"));
            }
            append(os, themetext(null, indent, "object syntax", "}"));
            return os;
        });
    }

    var renderjson = function renderjson(json) {
        var options = new Object(renderjson.options);
        options.replacer = typeof(options.replacer) == "function" ? options.replacer : function(k, v) {
            return v;
        };
        var pre = append(document.createElement("pre"), _renderjson(json, "", false, options.show_to_level, options));
        pre.className = "renderjson";
        return pre;
    }
    renderjson.set_icons = function(show, hide) {
        renderjson.options.show = show;
        renderjson.options.hide = hide;
        return renderjson;
    };
    renderjson.set_show_to_level = function(level) {
        renderjson.options.show_to_level = typeof level == "string" &&
            level.toLowerCase() === "all" ? Number.MAX_VALUE :
            level;
        return renderjson;
    };
    renderjson.set_max_string_length = function(length) {
        renderjson.options.max_string_length = typeof length == "string" &&
            length.toLowerCase() === "none" ? Number.MAX_VALUE :
            length;
        return renderjson;
    };
    renderjson.set_sort_objects = function(sort_bool) {
        renderjson.options.sort_objects = sort_bool;
        return renderjson;
    };
    renderjson.set_replacer = function(replacer) {
        renderjson.options.replacer = replacer;
        return renderjson;
    };
    renderjson.set_collapse_msg = function(collapse_msg) {
        renderjson.options.collapse_msg = collapse_msg;
        return renderjson;
    };
    renderjson.set_property_list = function(prop_list) {
        renderjson.options.property_list = prop_list;
        return renderjson;
    };
    // Backwards compatiblity. Use set_show_to_level() for new code.
    renderjson.set_show_by_default = function(show) {
        renderjson.options.show_to_level = show ? Number.MAX_VALUE : 0;
        return renderjson;
    };
    renderjson.options = {};
    renderjson.set_icons('⊕', '⊖');
    renderjson.set_show_by_default(false);
    renderjson.set_sort_objects(false);
    renderjson.set_max_string_length(80);
    renderjson.set_replacer(void 0);
    renderjson.set_property_list(void 0);
    renderjson.set_collapse_msg(function(len) {
        return len + " item" + (len == 1 ? "" : "s")
    })
    return renderjson;
})();

if (define) define({
    renderjson: renderjson
})
else(module || {}).exports = (window || {}).renderjson = renderjson;


function renderjsontable(data) {
    let out = "<table><tbody>";
    for (const k of Object.keys(data)) {
        out += "<tr>";
        if (!Array.isArray(data)) {
            out += "<td>" + k.replace(/_/g, ' ') + "</td>";
        }
        if (data[k] && typeof data[k] === 'object') {
            out += "<td>" + renderjsontable(data[k]) + "</td>";
        } else {
            out += "<td>" + data[k] + "</td>";
        }
        out += "</tr>";
    }
    out += "</tbody></table>";
    return (out);
}

function verifyIcon() {
    return `<i class="fa-solid fa-question"></i>`;
}

function presentVerifyXCMMessage(row) {
    let r = JSON.stringify(row);
    let s = `<script>$('#vxcm${row.msgHash}').on('click', function(e) { verifyXCMMessage(${r}) })</script>`
    return `<a class="btn btn-sm text-capitalize" id="vxcm${row.msgHash}">${verifyIcon()}</a>` + s;
}

function presentVerifyExtrinsic(id, blockNumber, extrinsicID, extrinsicHash, params = null) {
    // TODO: add params
    return `<a class="btn btn-sm text-capitalize" href="javascript:verifyExtrinsic('${id}', '${blockNumber}', '${extrinsicID}', '${extrinsicHash}')">${verifyIcon()}</a>`;
}

function presentVerifyEvent(id, blockNumber, eventID, params = null) {
    // TODO: add params
    return `<a class="btn btn-sm text-capitalize" href="javascript:verifyEvent('${id}', '${blockNumber}', '${eventID}')">${verifyIcon()}</a>`;
}

function presentVerifyBlock(id, blockNumber, params = null) {
    // TODO: add params
    return `<a class="btn btn-sm text-capitalize" href="javascript:verifyBlock('${id}', '${blockNumber}')">${verifyIcon()}</a>`;
}

function presentWASMCodeHash(codeHash) {
    return `<a href='/wasmcode/${codeHash}'>` + getShortHash(codeHash) + `</a>`
}

function presentWASMContract(contractAddress) {
    return `<a href='/wasmcontract/${contractAddress}'>` + getShortHash(contractAddress) + `</a>`
}
