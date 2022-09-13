function showcodetab(hash) {
    switch (hash) {
        case "#contract":
            setupapidocs("contract", "");
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