# ChainIDE-Polkaholic WASM Contract Verification API

This documents the WASM Contract API between ChainIDE and Polkaholic.io.  It is a development stage effort in Summer 2023, supported by Inkubator parent bounty.  

Other IDEs and block explorers may use the same paradigm and use the Polkaholic.io WASM Contract Verification API in the future.

* API Endpoint: [https://api.polkaholic.io](https://api.polkaholic.io)
* [swagger.json](https://swagger.polkaholic.io/swagger.json)

### Background

In principle, blockchain users of WASM Smart Contracts can trust a trustless smart contract because they can read source code, compile it themselves, and check that the compiled results
matches on-chain results.  In practice, blockchain users won't do this -- they instead will rely on block explorers like Polkaholic.io to ensure that that third-party verifiers generated
the on-chain code correctly and verify their results.

### Flow

The flow developed here is:

* **Step 1: WASM Code Generation**. Developer compiles a WASM Contract and posts it on-chain within ChainIDE, with a `codeHash` of the RAW WASM Bytes targeting a specific network (e.g. Astar, Shiden, Shibuya)
* **Step 2: IDE Signing/Verify**. With developer permission, ChainIDE posts a _signed_ `codeHash` (`signature`) along with the source (`package`) to the Polkaholic `verify` API.
* **Step 3: Polkaholic Verification**.  Polkaholic `verify` will check the signature against valid IDE addresses and store the results for viewing in its block explorer.  Anyone can get the source code for any `codeHash` calling the Polkaholic `info` API endpoint

Because the WASM Code Generation is done by the developer already within ChainIDE, the above process is done in the amount of time it takes to post the zip file, which is less than 15 seconds.  Note that this is different from the Sirato API, where the developer must wait for the Sirato verifier to complete its verification.  It is believed that online IDEs may be strongly preferred for this reason.

### Public Test case

To support development

* WASM Source Test case: [flipper.zip](https://raw.github.com) with Code Hash `0x396418ff533172de8407004f53051b5409f6892564ddeba12f75cc855cb16fe0`
* Verify API Test case: with Signature `0xe209e220e80cc196f033e48a9e4a9bb178144372cdefb711a0ba211a1013fc3171d3b537fd3c3d2716753d664b7c6b3a3f887738672d484efd5d7da73bda89f71b` 
```
curl -X POST -F "package=@flipper.zip" -F "signature=0xe209e220e80cc196f033e48a9e4a9bb178144372cdefb711a0ba211a1013fc3171d3b537fd3c3d2716753d664b7c6b3a3f887738672d484efd5d7da73bda89f71b" https://api.polkaholic.io/verify/shibuya/0x396418ff533172de8407004f53051b5409f6892564ddeba12f75cc855cb16fe0
```

To support the option where a developer can submit metadata without supplying source code, we have a `publishSource=0` optional flag:

```
curl -X POST -F "package=@flipper.zip" -F "signature=0xe209e220e80cc196f033e48a9e4a9bb178144372cdefb711a0ba211a1013fc3171d3b537fd3c3d2716753d664b7c6b3a3f887738672d484efd5d7da73bda89f71b" https://api.polkaholic.io/verify/shibuya/0x396418ff533172de8407004f53051b5409f6892564ddeba12f75cc855cb16fe0?publishSource=0
```

The zip source, if provided, is copied into a private bucket but is not available for viewing. 


* Info API Test case: 
```
curl "https://api.polkaholic.io/info/shibuya/0x396418ff533172de8407004f53051b5409f6892564ddeba12f75cc855cb16fe0"
```

### In-depth Review of Flow - Public Test case

#### Step 1: WASM Code Generation

User compiles a WASM contract in an IDE, e.g. flipper.zip, which contains the WASM Contract metadata in a single file, e.g. flipper.contract with into code bytes.


#### Step 2. IDE Signing

***WASM Code Hash Computation/Signing.***

IDE computes the code hash programmaticaly (using blake2-256):

```
const codeHash = blake2AsHex(hexToU8a(wasm), 256)
console.log('WASM Code Hash:', codeHash, codeHash.length);
// WASM Code Hash: 0x396418ff533172de8407004f53051b5409f6892564ddeba12f75cc855cb16fe0 66
```

***Code Hash Signing***

IDE signs the `codeHash` bytes using an Ethereum wallet. 

```
// sign codeHash using a openly private key (from https://wiki.polkadot.network/docs/learn-accounts)
let messageBytes = ethers.utils.toUtf8Bytes(codeHash);
const mnemonic = 'caution juice atom organ advance problem want pledge someone senior holiday very';
let validAddr = "0x58E0fB1aAB0B04Bd095AbcdF34484DA47Fe9fF77";
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const signature = await wallet.signMessage(messageBytes);
console.log("Private Key (Dev only):", mnemonic)
console.log('Signature:', signature, signature.length);
// Signature: 0xe209e220e80cc196f033e48a9e4a9bb178144372cdefb711a0ba211a1013fc3171d3b537fd3c3d2716753d664b7c6b3a3f887738672d484efd5d7da73bda89f71b 132
```

#### Step 3. Polkaholic.io Verification process

```
// verify signature by checking it matched validAddr "0x58E0fB1aAB0B04Bd095AbcdF34484DA47Fe9fF77";
const signerAddr = await ethers.utils.verifyMessage(codeHash, signature);
console.log("Signer Address:", signerAddr);
if (signerAddr == validAddr) {
   console.log("PASS");
} else {
   console.log("FAIL", signerAddr, "should be", validAddr);
}
// Signer Address: 0x58E0fB1aAB0B04Bd095AbcdF34484DA47Fe9fF77
```

Note the above private key mnemonic / validAddr is for development / test purposes only.  

Production will only expose a set of public addresses from the IDE (like 1-2 per IDE).  We may expose in open source code safely.

Multiple IDEs can be supported, but ChainIDE is the only case we consider at this point.  

#### Polkaholic Verification API Implementation

Core implmentation is in query.js `postChainWASMContractVerification`, used in api.js 

The Verification API will return an 4XX error:
* invalid network 
* TODO: invalid size of `codeHash` or `signature` 
* the `signature` does not match the `codeHash` and resolve to a set of valid addresses
* the zip file is unzippable into a local `/tmp` directory (not a zip file, excessive size, etc.)
* there is no .contract file in the zip file which form the metadata
* there is no WASM code in the metadata
* the provided `codeHash` does not match the actual hash of the WASM Code

## Security Considerations

The above process depends on the IDE's ability to keep its secret key
private.  Should the IDE key be compromised, any submissions after
this time should be considered suspect and be resubmitted / reverified
according to a different public address.  Polkaholic records the
verification time, signature, and verifier address to support this
potential scenario.

A background audit could be conducted against a second verifier
(Sirato) or additional verifiers, who could each attest to the
validity of the zip file by signing the codeHash.  This is not
reasonable to do at this time, because the number of datapoints are
small, and it is believed the results would not be available for any
WASM Contract for several minutes to up to an hour.  However, once
there are a dozen ChainIDE verified contracts on chain (that are more
sophisticated than flipper), this process is reasonable to generate
statistics for, and we expect to document the results.  Failure to
generate consensus between ChainIDE and Sirato will be raised with
ChainIDE.


