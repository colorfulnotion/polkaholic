#### polkadot-bundle

These bundles have been generated using browserify.
It consists of the core, extension and util libraries which can be used to

- Import needed polkadot modules
- Connect to polkadot network
- Sign transactions via extension

```html
  <script src="polkadot/core.min.js"></script>      <!-- Polkadot core bundle -->
  <script src="polkadot/extension.min.js"></script> <!-- Polkadot extension bundle -->
  <script src="polkadot/utils.min.js"></script>     <!-- helper function which uses above bundle -->

  <!-- OR -->
  <script src="polkadot/all.min.js"></script>       <!-- Bundles all the libraries into one bundle -->
```

##### Utils

- `connect`
- `getBlockTimestamp`
- `getBlockHash`
- `getAddressBalance`
- `web3Enable`
- `getExtensionConnectedAccounts`
- `transferViaExtension`

To sign a transaction using the plugin

```javascript

  const to_address = 'GZoo68t6icqNENrd7CTC9RCwVLszGuubKo5oGp7WSFxRnv2';
  const from_address = 'DDtfcfZG1sErysWu9UET431G8xkdA1qRQ76fst9ZGX11e8E';
  const amount = 10000000000000; // 10 KSM

  // connect to wss endpoint
  polkadot_utils.connect(KUSAMA_ENDPOINT);       

  // enable web3 via dapp
  polkadot_extension_dapp.web3Enable('gitcoin');

  // sign transaction using first address present in browser extension
  polkadot_extension_dapp(amount, to_address);      

  // sign transaction by passing from_address in public format -> this will be converted to substrate format
  polkadot_extension_dapp(amount, to_address, from_address);      

```

##### Generation Steps

```
browserify dependencies.js -p esmify > src/core.js
browserify extension-dependencies.js -p esmify > src/extension.js
npx webpack --config webpack.config.js
```