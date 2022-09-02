// "accounts" is global, but is only populated with selectWalletAccount
var accounts = [];
var afterWalletSelected = false;

function getPolkadotAddress(w) {
    let addressType = w.type
    let address = w.address;
    if (addressType == 'sr25519') {
        address = polkadotKeyring.encodeAddress(address, 0) //polkadot address here
    }
    return address
}


async function selectWalletAccount() {
    // on EVERY page load, we do this to set up the "accounts" variable, which is used to populate the walletModal
    (async () => {
        // check for the extension https://polkadot.js.org/docs/extension/
        const extensions = await polkadot_extension_dapp.web3Enable('Polkaholic');
        if (extensions.length === 0) {
            // show toast of this instead
            launchToast("Download <a href='https://polkadot.js.org/extension/'>Polkadot extension</a> and grant permissions to polkaholic.io");
            return;
        }

        // get all the accounts from the extension
        accounts = await polkadot_extension_dapp.web3Accounts();

        // now that we have some accounts, show the modal
        if (accounts.length == 0) {
            launchToast("Please configure Polkadot extension with at least 1 account")
        } else if (accounts.length == 1) {
            let w = accounts[0];
            let acctAddr = getPolkadotAddress(w)
            let pubkey = getPubkey(w)
            setWalletHome(w.meta.name, acctAddr, pubkey);
            launchToast(`Selected: ${w.meta.name}(${acctAddr} !`);
            if (afterWalletSelected) {
                let res = await afterWalletSelected();
                console.log("afterWalletSelected 1", res)
            }
        } else {
            showWalletModal();
        }
    })()
}

function getWalletAccount() {
    let [homeName, homeAcct] = getWalletHome();
    console.log("getWalletAccount", homeName, homeAcct, accounts);
    for (let i = 0; i < accounts.length; i++) {
        if (accounts[i].address == homeAcct) { // TODO: check?
            return (accounts[i]);
        }
    }
    return (false);
}


$('#walletClear').on('click', function(e) {
    clearWallet();
    hideWalletModal();
});

$('#walletModalClose').on('click', function(e) {
    hideWalletModal();
});

$('#walletModal').on('show.bs.modal', async function(event) {
    var button = $(event.relatedTarget) // Button that triggered the modal
    // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
    var modal = $(this)

    if (accounts?.length > 0) {
        //accounts?.map(account => console.log(`Address: ${account.address}\t(pubkey: ${getPubkey(account)})`));
        var out = accounts.map((w, idx) => {
            let address = getPolkadotAddress(w)
            //let addr = w.address.substring(0, 20) + "..."; //16DWzV....ueH4Nz
            //let addr = (address.length > 20)? `${address.substring(0, 6)}....${address.slice(-6)}`: address
            let addr = address
            let name = w.meta.name;
            let walletid = "wallet" + idx;
            //console.log('account', walletid, name, addr);
            return `<a id="${walletid}" type="button" class="btn btn-lg btn-outline-dark" style="padding-left: 0.25rem; padding-right: 0.25rem; padding-bottom: 0.15rem;padding-bottom: 0.15rem"> <div style='float: left; width: 10%'><img src='/identicon/${address}' width=50/></div><div style='float:right; width: 90%'>${name}<br/><p class="text-capitalize" style="margin-padding:0rem">${addr}</p></div></a>`;
        });
        //btn-group-vertical mx-auto
        out = '<div class="d-grid gap-2">' + out.join("") + '</div>';
        $("#walletModal .modal-body").html(out);
        // register click handlers
        accounts?.forEach(async (w, idx) => {
            let walletid = "wallet" + idx;
            $('#' + walletid).on('click', async function(e) {
                let acctAddr = getPolkadotAddress(w)
                let pubkey = getPubkey(w)
                setWalletHome(w.meta.name, acctAddr, pubkey);
                hideWalletModal();
                if (afterWalletSelected) {
                    let res = await afterWalletSelected();
                    console.log("afterWalletSelected 2+", acctAddr)
                } else {
                    launchToast(`Selected: ${w.meta.name}(${acctAddr}`);
                }
            });
        });
    } else {

    }
});

showWalletHome();