function showassettab(hash) {
    switch (hash) {
        case "#accountassets":
            showaccountassets(asset, chainID);
            break;
        case "#pools":
            showpools(asset, "assetChain", chainID);
            break;
        case "#assetholders":
            setupapidocs("asset", "assetholders");
            showassetholders(asset, chainID);
            break;
    }
}

function setuptabs(tabs, asset, chainID) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/asset/" + chainID + "/" + currencyID + hash;
            //console.log("shown.mdb.tab", hash, newUrl);
            setTimeout(() => {
                showassettab(hash);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#accountassets";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#assetTab a[href="' + hash + '"]');
    //console.log("CAUSE shownmdb.tab for", triggerEl, hash);
    mdb.Tab.getInstance(triggerEl).show();
}

setuptabs(tabs, asset, chainID);