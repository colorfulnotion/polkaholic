function showroutertab(hash, routerAssetChain) {
    switch (hash) {
    case "#pools":
        setupapidocs("router", "pools");
        showpools(routerAssetChain);
        break;
    }
}

function setuptabs(tabs, routerAssetChain) {
    for (let i = 0; i < tabs.length; i++) {
        let t = tabs[i];
        let id = "#" + t.target + "-tab";
        let tabEl = document.querySelector(id);
        tabEl.addEventListener('shown.mdb.tab', function(event) {
            const hash = $(this).attr("href");
            let newUrl = "/router/" + routerAssetChain + hash;
     
            setTimeout(() => {
                showroutertab(hash, routerAssetChain);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#pools";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#assetTab a[href="' + hash + '"]');
    //console.log("CAUSE shownmdb.tab for", triggerEl, hash);
    mdb.Tab.getInstance(triggerEl).show();
}

setuptabs(tabs, routerAssetChain);
