

function showaddresstab(hash) {
    console.log("showaddresstab", hash);
    switch (hash) {
    case "#evmtxs":
        showevmtxs(address);
        setupapidocs("account", "evmtxs", address);
        break;
    case "#transfers":
        showtransfers(address)
        setupapidocs("account", "transfers", address);
        break;
    case "#xcmtransfers":
        showxcmtransfers(address)
        setupapidocs("account", "xcmtransfers", address)
        break;
    case "#erc20":
        showerc20(address)
        setupapidocs("address", "erc20", address);
        break;
    case "#internal":
        showinternal(address);
        setupapidocs("address", "internal", address);
        break;
    }
}

function setuptabs(tabs, address) {
    if (chainListStr == '') chainListStr = 'all'
    console.log(`setuptabs chainListStr=${chainListStr}`)
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = `/address/` + address + `#${t.target}`
            console.log("shown.mdb.tab", hash, newUrl);
            setTimeout(() => {
                showaddresstab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#evmtxs";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#accountTab a[href="' + hash + '"]');
    console.log(hash);
    if (triggerEl) mdb.Tab.getInstance(triggerEl).show();
    //preemptively show the first page of every group
    showevmtxs(address, chainListStr);
}
setuptabs(tabs, address);
