## Custom Parser Tutorial:

Available resources within this directory:
* [common_chainparser](https://github.com/colorfulnotion/xcm-global-registry/blob/main/chainParsers/common_chainparser.js) - Implements common registry parsing logics sahred among different parachains.
* [custom_parser_template](https://github.com/colorfulnotion/xcm-global-registry/blob/main/chainParsers/custom_parser_template.js) - Fork this template to create new custom parser for a project.

## Overview
In this tutorial, we will go through how to implement a custom chain parser for your project under 30 min.

The custom parser must implement {`fetchGar`, `fetchXcGar`}. Optional augmentation {`automatic on-chain inferring`, `manualRegistry`} can be included to include chain-specific xcGar coverage, but it's not strictly required.

Usually parachain teams deployed identical pallets on both production and canary networks, therefore the same custom parser can be used for both of its Polkadot and Kusama parachain. Additionally, most parachains define their xc(Asset) and xcm registry using similar logics - all the hardcore XCMV1Multilocation standardization logic have be extracted away from the custom parser.

## Quick Start

In this tutorial, I will go over how moonbeam.js was created using [custom_parser_template.js](https://github.com/colorfulnotion/xcm-global-registry/blob/main/chainParsers/custom_parser_template.js), Hopefully, this should give you some basic ideas how to spin up a new custom parser effortlessly.

## Step 1 - Fork Template:
Fork [custom_parser_template.js](https://github.com/colorfulnotion/xcm-global-registry/blob/main/chainParsers/custom_parser_template.js) and rename it `YourProjectID.js`.

```
chainParsers# cp custom_parser_template.js moonbeam.js
```
In this case, we will use 'moonbeam' as projectID. Note that both moonbeam/moonriver has same logic for its registry nNo need to create two custom parser). As a convention, we will use *production network name over canary network name* for naming purposes whenever possible. (i.e moonbeam over moonriver)


## Step 2 - Rename Project:

Rename `Sample` into `YourProjectName` in `YourProjectID.js`. For example:

```
## run sed -i 's/Sample/YourProjectName/g' YourProjectID.js
sed -i 's/Sample/Moonbeam/g' moonbeam.js
```

If you open the file, you should find a skeleton custom parser code already set up for you:

```
/*
Fork this template to create new custom parser. And replace all [YourProjectName] in this
file with para name

Support chains
[relaychain-paraID|projectName]
*/
```

Change `[relaychain-paraID|projectName]` to something like
```
polkadot-2004|moonbeam
kusama-2023|moonriver
```
So it's easily understandable by other developers/contributors


## Step 3 - Specify Registry Location:

Change `garPallet:garPallet` and `xcGarPallet:xcGarStorage` to the correct location used by your parachain. For example, moonbeam has its asset registry located `assets:metadata`, and xcm registry located at `assetManager:assetIdType`. This enables common parser to automatically query data at proper location for your custom parser.


```
//change [garPallet:garPallet] to the location where the asset registry is located.  ex: [assets:metadata]
garPallet = 'assets';
garStorage = 'metadata';

//change [xcGarPallet:xcGarStorage] to the location where the xc registry is located.  ex: [assetManager:assetIdType]
xcGarPallet = 'assetManager'
xcGarStorage = 'assetIdType'
```
*Note: some projects like Interlay/Mangatax/Oak... use same `pallet:storage` for both asset registry and xcm registry. simply define it as is. the common parser will still work*

## Step 4 - Select Asset Parser for fetchGar():

Modify `process{projectName}Gar` Called by `fetchGar()`. For example:

```
    //step 1: parse gar pallet, storage for parachain's asset registry
async fetchGar(chainkey) {
    // implement your gar parsing function here.
    await this.processMoonbeamGar(chainkey)
}

// Implement Moonbeam gar parsing function here
async processMoonbeamGar(chainkey) {
    console.log(`[${chainkey}] ${this.parserName} custom GAR parser`)
    //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
    let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
    if (a) {
        // step 1: use common Asset pallet parser func available at generic chainparser.
        let assetList = this.processGarAssetPallet(chainkey, a)
        // step 2: load up results
        for (const assetChainkey of Object.keys(assetList)) {
            let assetInfo = assetList[assetChainkey]
            this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
        }
    }
}
```

There are two variations where parachain implements its assets - via Tokens (like Acala/Interlay/..) or via Assets/currencyID (like Moonbeam/Astar/..)

Depend on how the parachain is defined, change `process{projectName}Gar`
```
// step 1: use common Asset pallet parser func available at generic chainparser.
let assetList = this.processGarAssetPallet(chainkey, a)
```
to use either `processGarAssetPallet()` or `processGarTokensPallet()`


## Step 5 - Select XCM Registry Parser for fetchXcGar():

Modify `process{projectName}XcGar` Called by `fetchXcGar()`. For example:
```
//step 2: parse xcGar pallet, storage for parachain's xc asset registry
async fetchXcGar(chainkey) {
    if (!this.isXcRegistryAvailable) {
        // skip if xcGar parser is unavailable
        console.log(`[${chainkey}] ${this.parserName} xcGar NOT IMPLEMENTED - SKIP`)
        return
    }
    // implement your xcGar parsing function here.
    await this.processMoonbeamXcGar(chainkey)
}

// Implement Moonbeam xcgar parsing function here
async processMoonbeamXcGar(chainkey) {
    console.log(`[${chainkey}] ${this.parserName} custom xcGAR parser`)
    let pieces = chainkey.split('-')
    let relayChain = pieces[0]
    let paraIDSource = pieces[1]
    //step 0: use fetchQuery to retrieve xc registry at the location [assetManager:assetIdType]
    var a = await super.fetchQuery(chainkey, this.xcGarPallet, this.xcGarStorage, 'xcGAR')
    if (!a) return
    if (a) {
        // step 1: use common XcmAssetIdType parser func available at generic chainparser.
        let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processXcmAssetIdType(chainkey, a)
        console.log(`custom xcAssetList=[${Object.keys(xcAssetList)}], updatedAssetList=[${Object.keys(updatedAssetList)}], unknownAsset=[${Object.keys(unknownAsset)}], assetIDList=[${Object.keys(assetIDList)}]`, xcAssetList)
        // step 2: load up results
        for (const xcmInteriorKey of Object.keys(xcAssetList)) {
            let xcmAssetInfo = xcAssetList[xcmInteriorKey]
            let assetID = assetIDList[xcmInteriorKey]
            this.manager.setXcmAsset(xcmInteriorKey, xcmAssetInfo, chainkey)
            // update global xcRegistry to include assetID used by this parachain
            this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, assetID, chainkey)
        }
        for (const assetChainkey of Object.keys(updatedAssetList)) {
            let assetInfo = updatedAssetList[assetChainkey]
            this.manager.setChainAsset(chainkey, assetChainkey, assetInfo, true)
        }
    }
}
```

xcm registry usually falls into one of the following pattern :
* `processXcmAssetIdType`: Used by Moonbeam/Parallel/...
* `processXcmForeignAssetLocations`: Used by Acala/Bifrost..
* `processXcmAssetIdToLocation`: Used by Astar/Shadow..
* `processXcmAssetsRegistryAssetMetadata`: Used by Interlay/Mangatax/..

Depend on how the parachain is defined, change `process{projectName}XcGar`:
```
// step 1: use common XcmAssetIdType parser func available at generic chainparser.
let [xcAssetList, assetIDList, updatedAssetList, unknownAsset] = await this.processXcmAssetIdType(chainkey, a)
```
to use one of the commonly recognized xcmRegistry parsers. If there's no proper match, you are welcome implement one or submit an issue.

## Step 6 - Add Custom Parser to xcmgarManager:
Now that custom parser is ready we will add it to xcmgarManager. In [xcmgarManager](https://github.com/colorfulnotion/xcm-global-registry/blob/main/xcmgarManager.js), you can see how custom parser get included:

```
const xcmgarTool = require("./xcmgarTool");
const endpoints = require("./endpoints");

//const SampleParser = require("./chainParsers/custom_parser_template") // fork this file to include new chain parser
const CommonChainParser = require("./chainParsers/common_chainparser");
```

First add your custom parser `{projectName}Parser` from `./chainParsers/{projectID.js}`, for example:

```
const CommonChainParser = require("./chainParsers/common_chainparser");
...
// Add new custom parser
const MoonbeamParser = require("./chainParsers/moonbeam")
...
```
Custom parser is used by `chainParserInit(chainkey, api, manager)`:
```
/*
chainParserInit returns generic chainParser by default. If a custom
chainParser implemented, use it instead.
*/
chainParserInit(chainkey, api, manager) {
    console.log(`chainParserInit start`)
    let chainParser;
    if (this.isMatched(chainkey, ['fullchainkey',...])) {
        chainParser = new AcalaParser(api, manager)
    } else if (this.isMatched(chainkey, ['fullchainkey,...])) {
        ....
    } else {
        chainParser = new CommonChainParser(api, manager, false) // set isCustomParser to false
    }
    return chainParser
}
```

Specify the custom chainparser using fullchainkey format `{relaychain}-{paraID}|{projectID}`. For example, to use `MoonbeamParser` for both moonbeam and moonriver chains, we added the following if clause:
```
} else if (this.isMatched(chainkey, ['polkadot-2004|moonbeam', 'kusama-2023|moonriver'])) {
    chainParser = new MoonbeamParser(api, manager)
} else if (
```

## Step 6c - Optional Augmentation:
Two types of Augmentation are supported: Automatic-Inferring and Manual Registration

### Automatic-Inferring

(experimental) use Polkaholic's more powerful xcm parser to automatically infer the mapping between localAsset's `currencyID <-> XcmInteriorKey` by providing a list of extrinsicIDs to infer from. See the example below where the Listen ('kusama-2118') parser automatically picks up KSM from  registry is not published/maintained by the team:

```
augment = {
    'kusama-2118': [{
        paraID: 2118,
        extrinsicIDs: ['118722-2']
    }]
}
```

(TODO): Use Polkaholic's generic `XcmDecHexCurrencyID` parser

### Manual Registration

Most parachain teams don't publish XCM/MultiLocation for "native" assets originated from their own parachain. By manually providing the xcmInteriorkey, native xcAsset can be augmented with xcmInteriorkey like other asset.

In the following example, we will go over how to add Moonbeam's GLMR and Moonriver's MOVR into global xcm asset registry:

```
manualRegistry = {
    "polkadot-2004": [{
        asset: {
            "Token": "GLMR"
        },
        xcmInteriorKey: '[{"network":"polkadot"},{"parachain":2004},{"palletInstance":10}]'
    }],
    'kusama-2023': [{
        asset: {
            "Token": "MOVR"
        },
        xcmInteriorKey: '[{"network":"kusama"},{"parachain":2023},{"palletInstance":10}]'
    }]
}

```

Note: xcmInteriorkey format is documented [here](https://github.com/colorfulnotion/xcm-global-registry/blob/main/docs/DETAILS.md)


## Step 7 - Test Custom Parser

Test your custom parser by inspecting with xcmgar cli available at [Main Directory](https://github.com/colorfulnotion/xcm-global-registry/tree/main/).

```
# See available from xcmgar cli
node xcmgar
Usage: xcmgar [options] [command]

XCM Global Asset Registry. Repo: https://github.com/colorfulnotion/xcm-global-registry

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  registry [options]  Fetch on-chain Asset Registry and XCM MultiLocation Registry
  endpoint [options]  Update public endpoints
  help [command]      display help for command
```

If your parser cover both production and canary network, make sure to test both:
```
# generate moonbeam's (xc)Asset registry:
node xcmgar registry -r polkadot -p 2004
...
✅ Success: polkadot-2004 Local Asset Regsitry (Found:14) cahced @
    assets/polkadot/polkadot_2004_assets.json

# dry-run moonriver's (xc)Asset registry for debugging:
node xcmgar registry -r kusama -p 2023
```
