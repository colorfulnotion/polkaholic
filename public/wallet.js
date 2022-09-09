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
        } else {
            showWalletModal();
        }
    })()
}

// wallet functions
function showWalletModal() {
    $('#walletModal').modal('show');
}

function hideWalletModal() {
    $('#walletModal').modal('hide');
}

function setWalletHome(selectedAccounts) {
    let addresses = selectedAccounts.join("|")
    try {
        setCookie("homePub", addresses, 3650);
        showWalletHome();
    } catch (e) {
        console.log("setWalletHome", e);
    }
}

function getWalletHome() {
    let homePub = getCookie('homePub');
    if (homePub.length > 20) {
        let addresses = homePub.split("|");
        if (addresses.length > 0) {
            return [`${addresses.length} accounts`, addresses];
        }
    }
    return [`0 accounts`, []];
}

function showWalletHome() {
    let [homeName, addresses] = getWalletHome();
    if (addresses.length > 0) {
        document.getElementById('walletHome').innerHTML = `${homeName}`;
        if (addresses.length == 1) {
            document.getElementById('identicon').style.visibility = 'visible';
            document.getElementById('identicon').src = "/identicon/" + addresses[0];
        }
    } else {
        document.getElementById('walletHome').innerHTML = "-Connect Wallet-";
        document.getElementById('identicon').style.visibility = 'hidden';
    }
}

$('#walletModalClose').on('click', function(e) {
    hideWalletModal();
});

async function connect_evmwallet() {
    return;
    if (window.ethereum) {
        await window.ethereum.request({
            method: "eth_requestAccounts"
        });
        window.web3 = new Web3(window.ethereum);
        const account = web3.eth.accounts;
        const evmAddress = account.givenProvider.selectedAddress;
        //console.log(`EVMWalletAccount: ${evmAddress}`, account);
    } else {
        console.log("No EVM wallet");
    }
}

function presentWalletAccount(name, address, pubKey, checked, isEVM = false) {
    let checkedStr = checked ? " CHECKED" : "";
    let addressStr = isEVM ? `<small>EVM Account: ${getShortHash(address)}</small>` : `<small>SS58 Address: ${getShortHash(address)}<br/>Public Key: ${getShortHash(pubKey)}</small>`;
    let url = isEVM ? `/address/${address}` : `/account/${pubKey}`;
    return `<div type="button" class="btn btn-lg btn-outline-dark  text-capitalize" style="padding-left: 0.25rem; padding-right: 0.25rem; padding-bottom: 0.15rem;padding-bottom: 0.15rem; text-align: left"> 
  <div style='float: left; width: 15%'><img src='/identicon/${address}' width=50/></div>
  <div style='float:right; width: 85%'>
    <div class="form-check form-switch"> <input class="form-check-input" type="checkbox" role="switch" value="${pubKey}" ${checkedStr} />${name}<span style='float:right'><a class='btn btn-link' href='${url}'>View Account</a></span></div>
    <div>${addressStr}</div>
    
  </div>
</div>`
}

$('#walletModal').on('show.bs.modal', async function(event) {
    var button = $(event.relatedTarget) // Button that triggered the modal
    // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
    var modal = $(this)

    let [_, currentAddresses] = getWalletHome();

    //await connect_evmwallet();
    let out = [];
/*    if (window.ethereum) {
        const evmAccounts = web3.eth.accounts;
        //Get the current selected/active wallet
        const evmAddress = evmAccounts.givenProvider.selectedAddress;
        //console.log(`EVMWalletAccount: ${evmAddress}  Accounts:`, evmAccounts);
        let address = evmAddress;
        let addr = evmAddress;
        let name = "EVM";
        out.push(presentWalletAccount("EVM", addr, addr, currentAddresses.includes(addr), true));
    } */

    if (accounts?.length > 0) {
        //accounts?.map(account => console.log(`Address: ${account.address}\t(pubkey: ${getPubkey(account)})`));
        accounts.forEach((w, idx) => {
            let address = getPolkadotAddress(w)
            let pubKeyu8 = polkadotKeyring.decodeAddress(address);
            let pubKey = polkadotUtil.u8aToHex(pubKeyu8);
            let name = w.meta.name;
            //console.log(currentAddresses.includes(pubKey), pubKey, currentAddresses);
            out.push(presentWalletAccount(name, address, pubKey, currentAddresses.includes(pubKey), false));

        });
    }
    //btn-group-vertical mx-auto
    out = `<div class="d-grid gap-2">` + out.join("") + `</div>`;
    $("#walletModal .modal-body").html(out);
});

$('#walletSelect').on('click', async function(e) {
    let selectedAccounts = [];
    document.querySelectorAll('[role="switch"]').forEach(function(el) {
        if (el.checked) {
            selectedAccounts.push(el.value);
        }
    });
    console.log(selectedAccounts);
    hideWalletModal();
    setWalletHome(selectedAccounts);

    if (afterWalletSelected) {
        let res = await afterWalletSelected();
        console.log("afterWalletSelected", acctAddr)
    } else {
        launchToast(`Selected: ${selectedAccounts.length} accounts`);
    }
});

showWalletHome();
