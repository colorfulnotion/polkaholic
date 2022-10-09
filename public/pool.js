

function showpooltab(hash, asset, chainID) {
    switch (hash) {
        case "#charts":
            break;
        case "#assetholders":
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
            let newUrl = `/pool/${asset}/${chainID}` + hash;
            setTimeout(() => {
                showpooltab(hash, asset, chainID);
            }, 250);
            history.replaceState(null, null, newUrl);
        })
    }
    let url = location.href.replace(/\/$/, "");
    let hash = "#charts";
    if (location.hash) {
        const urlhash = url.split("#");
        if (urlhash.length > 1) hash = "#" + urlhash[1];
    }
    const triggerEl = document.querySelector('#poolTab a[href="' + hash + '"]');
    if (triggerEl) {
        mdb.Tab.getInstance(triggerEl).show();
    }
}

setuptabs(tabs, asset, chainID);
