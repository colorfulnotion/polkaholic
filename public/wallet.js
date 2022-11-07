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

function setWalletHome(selectedAccounts, selectedAccountNames) {
    let addresses = selectedAccounts.join("|")
    let addressesnames = selectedAccountNames.join("|")
    try {
        setCookie("homePub", addresses, 3650);
        setCookie("homePubName", addressesnames, 3650);
        showWalletHome();
        window.location.reload(); // reload here
    } catch (e) {
        console.log("setWalletHome err", e);
    }
}

function getWalletHome() {
    let homePub = getCookie('homePub');
    if (homePub.length > 20) {
        let addresses = homePub.split("|");
        if (addresses.length > 0) {
            return [`${addresses.length} Accounts`, addresses];
        }
    }
    return [`0 Accounts`, []];
}

function showWalletHome() {
    let [homeName, addresses] = getWalletHome();
    if (addresses.length > 0) {
        /*document.getElementById('walletHome').innerHTML = `${homeName}`;
        if (addresses.length == 1) {
            document.getElementById('identicon').style.visibility = 'visible';
            document.getElementById('identicon').src = "/identicon/" + addresses[0];
        } */
    } else {
        // document.getElementById('walletHome').innerHTML = "-Connect Wallet-";
        //    document.getElementById('identicon').style.visibility = 'hidden';
    }
}

$('#walletModalClose').on('click', function(e) {
    hideWalletModal();
});

async function connect_evmwallet() {
    if (window.ethereum) {
        await window.ethereum.request({
            method: "eth_requestAccounts"
        });
        window.web3 = new Web3(window.ethereum);
        const account = web3.eth.accounts;
        const evmAddress = (account.givenProvider != undefined && account.givenProvider.selectedAddress != undefined) ? account.givenProvider.selectedAddress : null
        if (evmAddress == undefined) {
            document.getElementById('evmwallettoggle').checked = false;
            document.getElementById('headerStr').innerHTML = `<span><small>Unable to connect evm wallet.</small></span><span><small><br> Please Download <a href='https://metamask.io/'  target='_new'>Metamask</a> and grant permissions to polkaholic.io</small></span>`;
            //launchToast("Unable to connect evm wallet. Please Download <a href='https://metamask.io/'  target='_new'>Metamask</a> and grant permissions to polkaholic.io");
            return
        }
        let address = evmAddress;
        let addr = evmAddress;
        let name = "EVM";
        console.log(`EVMWalletAccount: ${evmAddress}`, account);
        document.getElementById('evmwallettoggle').checked = true;
        document.getElementById('evmwallettoggle').value = evmAddress;
        document.getElementById('identicon').innerHTML = `${presentBlockiesOrIdenticon(address, 50)}`;
        document.getElementById('headerStr').innerHTML = `<span><small>EVM Address: ${address}</small></span><span style="float:right"><a class='btn btn-link' href='/address/${address}'>View Account</a></span>`;
        document.getElementById('descriptionStr').innerHTML = ``;
    } else {
        document.getElementById('evmwallettoggle').checked = false;
        document.getElementById('headerStr').innerHTML = `<span><small>Unable to connect evm wallet.</small></span><span><small><br> Please Download <a href='https://metamask.io/'  target='_new'>Metamask</a> and grant permissions to polkaholic.io</small></span>`;
        //launchToast("Download <a href='https://metamask.io/'  target='_new'>Metamask</a>, <a href='https://subwallet.app/' target='_new'>Subwallet</a>, or <a href='https://talisman.xyz/'  target='_new'>Talisman</a> and grant permissions to polkaholic.io");
    }
}

async function toggle_evmwallet() {
    let toggle = document.getElementById("evmwallettoggle");
    if (toggle.checked) {
        await connect_evmwallet();
    }
}

function presentEVMWalletConnect(address = null) {
    //if (address != undefined) return
    let checkedStr = "";
    let addressHeaderStr = "<a class='btn btn-link' href='javascript:connect_evmwallet();'>Connect EVM Wallet</a></span>";
    let descriptionStr = "";
    let identiconStr = "";
    if (address) {
        checkedStr = " CHECKED";
        addressHeaderStr = `<span><small>EVM Address: ${address}</small></span><span style="float:right"><a class='btn btn-link' href='/address/${address}'>View Account</a></span>`
        descriptionStr = ``
        //identiconStr = `<img src='/identicon/${address}' width=50/>`;
        identiconStr = presentBlockiesOrIdenticon(address, 50)
    }
    return `<div type="button" class="btn btn-lg btn-outline-dark  text-capitalize" style="padding-left: 0.25rem; padding-right: 0.25rem; padding-bottom: 0.15rem;padding-bottom: 0.15rem; text-align: left">
  <div id="identicon" style='float: left; width: 15%'>${identiconStr}</div>
  <div style='float:right; width: 85%'>
    <div class="form-check form-switch"> <input onclick="javascript:toggle_evmwallet()" class="form-check-input" type="checkbox" id="evmwallettoggle" role="switch" value="${address}" wname="${address}" ${checkedStr}/><span id='headerStr'>${addressHeaderStr}</span></div>
    <div id="descriptionStr">${descriptionStr}</div>
  </div>
</div>`
}

function presentWalletAccount(name, address, pubKey, checked, isEVM = false) {
    let checkedStr = checked ? " CHECKED" : "";
    let addressStr = `<small>SS58 Address: ${getShortHash(address)}<br/>Public Key: ${getShortHash(pubKey)}</small>`;
    let url = `/account/${pubKey}`;
    return `<div type="button" class="btn btn-lg btn-outline-dark  text-capitalize" style="padding-left: 0.25rem; padding-right: 0.25rem; padding-bottom: 0.15rem;padding-bottom: 0.15rem; text-align: left">
  <div style='float: left; width: 15%'><img src='/identicon/${address}' width=50/></div>
  <div style='float:right; width: 85%'>
    <div class="form-check form-switch"> <input class="form-check-input" type="checkbox" role="switch" value="${pubKey}" wname="${name}" ${checkedStr} />${name}<span style='float:right'><a class='btn btn-link' href='${url}'>View Account</a></span></div>
    <div>${addressStr}</div>
  </div>
</div>`
}

$('#walletModal').on('show.bs.modal', async function(event) {
    var button = $(event.relatedTarget) // Button that triggered the modal
    // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
    var modal = $(this)

    let [_, currentAddresses] = getWalletHome();
    let evmAddress = null;
    for (let i = 0; i < currentAddresses.length; i++) {
        console.log(currentAddresses[i].length);
        if (currentAddresses[i].length == 42) {
            evmAddress = currentAddresses[i];
        }
    }
    let out = [];

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
    out.push(presentEVMWalletConnect(evmAddress));
    //btn-group-vertical mx-auto
    out = `<div class="d-grid gap-2">` + out.join("") + `</div>`;
    $("#walletModal .modal-body").html(out);
});

async function selectedWallets(e) {
    let selectedAccounts = [];
    let selectedAccountNames = [];
    document.querySelectorAll('[role="switch"]').forEach(function(el) {
        if (el.checked) {
            //console.log(`el`, el)
            let elVal = el.value
            let walletName = (el.getAttribute('wname') != undefined) ? el.getAttribute('wname') : elVal
            if (elVal != 'null' && elVal != 'undefined') {
                selectedAccounts.push(elVal);
                selectedAccountNames.push(walletName);
            }
        }
    });
    console.log(`selectedAccounts`, selectedAccounts);
    console.log(`selectedAccountNames`, selectedAccountNames);
    hideWalletModal();
    setWalletHome(selectedAccounts, selectedAccountNames);

    if (afterWalletSelected) {
        let res = await afterWalletSelected();
        console.log("afterWalletSelected", acctAddr)
    } else {
        launchToast(`Selected: ${selectedAccounts.length} accounts`);
    }
}


$('#walletSelect').on('click', async function(e) {
    await selectedWallets(e);
});

$('#walletModalClose').on('click', async function(e) {
    // selectedWallets(e);
    launchToast(`Wallet Section Cancelled`);
});

showWalletHome();