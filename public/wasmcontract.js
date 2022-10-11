let contract = null
async function readContract(chainID, metadata, addressSS58) {
    let WSEndpoint
    let myapi = await getAPI(chainID)
    if (!myapi) {
        console.log("failed to connect");
        return (null);
    }
    const {
        ContractPromise
    } = polkadotApiContract;
    contract = new ContractPromise(myapi, metadata, addressSS58);
    var readMessages = [],
        writeMessages = [];
    let rout = [];
    let wout = [];
    messages = contract.abi.messages;
    readMessages = messages.filter((m) => {
        return !m.isMutating;
    });
    writeMessages = messages.filter((m) => {
        return m.isMutating;
    });
    for (let i = 0; i < readMessages.length; i++) {
        let x = await presentWASMContractMessage(readMessages[i], myapi, contract, i);
        rout.push(x);
    }
    for (let i = 0; i < writeMessages.length; i++) {
        let x = await presentWASMContractMessage(writeMessages[i], myapi, contract, i);
        wout.push(x);
    }

    document.getElementById("v-tabs-read").innerHTML = `<div class="accordion" id="reads">${rout.join("\n")}</div>`
    document.getElementById("v-tabs-write").innerHTML = `<div class="accordion" id="writes">${wout.join("\n")}</div>`
}

async function executeRead(n, nm) {
    try {
        let inputs = []
        inputs.push(null);
        inputs.push({
            gasLimit: -1,
            storageDepositLimit: null
        });
        for (const id of args[n]) {
            let inp = document.getElementById(id).value;
            inputs.push(inp);
        }
        let res = contract.query[nm];
        let out = [];
        let f = contract.query[nm];
        const {
            gasRequired,
            storageDeposit,
            result,
            output
        } = await f.apply(null, inputs);
        if (result.isOk) {
            document.getElementById(`ro${n}`).innerHTML = output.toHuman();
        } else {
            console.log('error', nm, result.asErr.toHuman());
        }
    } catch (err) {
        console.log(err); //document.getElementById(`ro${n}`).innerHTML = "error";
    }
}

async function executeWrite(n, nm) {
    try {
        alert("WASM Write Contract functionality is disabled pending further testing.  Contact info@polkaholic.io to volunteer in testing!");
        return;
        let inputs = []
        inputs.push(null);
        inputs.push({
            gasLimit: -1,
            storageDepositLimit: null
        });
        for (const id of args[n]) {
            let inp = document.getElementById(id).value;
            inputs.push(inp);
        }
        console.log(contract.tx);
        let out = [];
        // get the pair to sign with
        await contract.tx[nm].apply(null, inputs)
            .signAndSend(pair, result => {
                if (result.isOk) {
                    document.getElementById(`wo${n}`).innerHTML = output.toHuman();
                } else {
                    document.getElementById(`wo${n}`).innerHTML = result.asErr.toHuman();
                }
            });
    } catch (err) {
        console.log(err); //document.getElementById(`ro${n}`).innerHTML = "error";
    }
}

let args = {}

async function presentWASMContractMessage(m, myapi, contract, n) {
    let out = ``
    let args0 = [];
    for (let j = 0; j < m.args.length; j++) {
        let a = m.args[j];
        let id = `p${n}-${j}`
        args0.push(id);
        out += `${a.name}<br/><input id="${id}" type=text placeHolder="${a.type.displayName} ${a.type.type}" size=80><br/>`;
    }
    if (m.args.length == 0) {
        let f = contract.query[m.method];
        let storageDepositLimit = null;
        let from = "WwjA4NLgbAKgapEvKf86LNk7gcqSQhsNUTN2AXSc6JPjQf4";
        const {
            gasRequired,
            storageDeposit,
            result,
            output
        } = await f("5CMLPVmw5BUrmCsoH5xVDDAFwQz8LVt6vPx16BEsJAePNvVb", {
            gasLimit: -1,
            storageDepositLimit
        });
        if (result.isOk) {
            console.log('success', m.method, output.toHuman());
            out += output.toHuman();
        } else {
            console.log('error', m.method, result.asErr.toHuman());
        }
    } else if (m.isMutating) {
        out += `<a href="javascript:executeWrite(${n}, '${m.method}')"  class="btn btn-primary">Write</a>&nbsp;<small>${m.selector}</small>`;
    } else {
        args[n] = args0
        out += `<a href="javascript:executeRead(${n}, '${m.method}')" class="btn btn-primary">Query</a>`;
        out += `<div id='ro${n}'></div>`

    }

    return (`<div class="accordion-item">
      <h6 class="accordion-header" id="heading${n}">
      <button class="accordion-button collapsed" type="button" data-mdb-toggle="collapse" data-mdb-target="#collapse${n}" aria-expanded="false" aria-controls="collapse${n}">
      <i class="fas fa-question-circle fa-sm me-2 opacity-70"></i>${m.identifier}</button>
      </h6>
      <div id="collapse${n}" class="accordion-collapse collapse" aria-labelledby="heading${n}" data-mdb-parent="#accordionRead">
        <div class="accordion-body">${out}</div>
      </div>
    </div>`)

}


function showcontracttab(hash) {
    switch (hash) {
        case "#contract":
            setupapidocs("contract", "");
            break;
    }
}

function setuptabs(tabs, address) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/wasmcontract/" + address + hash;
            setTimeout(() => {
                //showcontracttab(hash);
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
    const triggerEl = document.querySelector('#wasmcontractTab a[href="' + hash + '"]');
    if (triggerEl) {
        mdb.Tab.getInstance(triggerEl).show();
    } else {
        console.log("MISSING: ", hash);
    }
}

$(document).ready(function() {
    setuptabs(tabs, address);
});