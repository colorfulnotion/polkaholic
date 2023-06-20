var initcontracts = false;
var tableContracts;

function getLengthMenu() {
    return [
        [10, 20, 25, 50, 100, 500],
        ["max 10", "max 20", "max 500 (25/page)", "max 1K (50/page)", "max 10K (100/page)", "max 10K (500/page)"]
    ];
}

function showcodecontracts(codeHash) {
    if (initcontracts) return;
    else initcontracts = true;
    let tableName = '#tablecontracts'
    tableContracts = $(tableName).DataTable({
        dom: 'lfrtipB',
        buttons: [{
            extend: 'csv',
            text: 'Download CSV',
            filename: `${codeHash}-contracts`,
            exportOptions: {
                orthogonal: 'export'
            }
        }],
        lengthMenu: getLengthMenu(),
        columnDefs: [{
            "className": "dt-center",
            "targets": [3, 2]
        }],
        order: [
            [3, "desc"]
        ],
        columns: [{
            data: 'address',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentIDwithIdenticon(data)
                } else {

                }
                return data;
            }
        }, {
            data: 'extrinsicID',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    try {
                        if (row.extrinsicID != undefined && row.extrinsicHash != undefined) {
                            let s = presentExtrinsicIDHash(row.extrinsicID, row.extrinsicHash, false);
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
            data: 'instantiateBN',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentBlockNumber(row.chainID, row.chainName, data)
		} else {
                    return data;
		}
            }
        }, {
            data: 'deployer',
            render: function(data, type, row, meta) {
                if (type == 'display') {
                    return presentIDwithIdenticon(data)
                } else {
                    return data;
                }
            }
        } ]
    });
    let table = tableContracts;
    table.clear();
    table.rows.add(contracts);
    table.draw();

}

function showcodesource(codeHash, code) {
    let  out = "";
    let i = 0;
    out += `<div><button class="btn-primary" href="https://chainide.com/${codeHash}">Open with ChainIDE</button></div>`
    for (const s of source) {
	const u = new URL(s.srcUrl);
	const p = u.pathname.replaceAll(`/wasmcode/${codeHash}/`, "")
	out = out + `<div><a href="${u}" class="btn btn-link" style="text-transform: none;">${p}</a></div><div id="codesrc${i}"></div>`;
	if ( s.source ) {
	    out = out + "<textarea style='width: 100%; height: 400px; font-family: Courier; font-size: 8pt'>" + JSON.parse(s.source) + "</textarea>";
	}

    }
    document.getElementById("codesourceagg").innerHTML = out;
}

function showcodetab(hash, codeHash) {
    switch (hash) {
        case "#contracts":
        showcodecontracts(codeHash); // contracts: datatables
            break;
        case "#codesource":
        showcodesource(codeHash, code); 
            break;
    }
}


function setuptabs(tabs, codeHash) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/wasmcode/" + codeHash + hash;
            setTimeout(() => {
                showcodetab(hash, codeHash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#overview";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#wasmcodeTab a[href="' + hash + '"]');
    if (triggerEl) {
        mdb.Tab.getInstance(triggerEl).show();
    } else {
        console.log("MISSING: ", hash);
    }
}

$(document).ready(function() {
    setuptabs(tabs, codeHash);
});
