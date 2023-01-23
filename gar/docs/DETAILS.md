## How it works
*Long version*:
* Given a relaychain, retrieve a list of its partIDs on-chain via `api.query.paras.paraLifecycles`. exclude parathread, as its not live yet.

* Crawl polkadot.js's [public endpoint registry](https://github.com/polkadot-js/apps/blob/master/packages/apps-config/src/endpoints/), reject invalid endpoint like polkadex. Also remove endpoints that are unreachable or have no public endpoints
* Spin up chainParser (using public wss endpoint from previous step) for every reachable parachains(paraIDs).
* If custom chainparser is implemented for a parachain, use it. If not, fallback to less powerful generic parser.
* Every custom chainParser will go through a 3-step process to:
  * Step 1 - Implement `fetchGar()` to process its Asset registry located at `garLocation` on-chain    
  * Step 2 - Implement `fetchXcGar()` to process its XCM/Multilocation registry located at `xcGarLocation` on-chain.
  * Step 3 - [optional] Implement `fetchAugments()` to Augment the XCM result from previous step if certain assets are missing. Two types of augmentations are available:
      * Auto Inferring - supply a list extrinsicIDs containing unpublished xcAsset Xtokens transfers. An xcmInteriorkey will be inserted to result from step2 if we can succesfully infer the asset using other chains' published XCM registry
      * Manual-Registry - most parachain teams don't publish XCM/Multilocation for "native" assets originated from their own parachain. By manually providing the xcmInteriorkey, native xcAsset can be augmented with xcmInteriorkey as well.

* Aggregate multiple parachains' XCM Registry into one map keyed by the standardized xcmInteriorkey. Update "confidence" per each xcAsset. Dump the result as a file by calling `xcmgar.updateXcmGar()` `xcmgar.updateLocalAsset()`

## Repo Structure
This repo has been organized as following:
```
xcm-global-registry~$tree
.
├── LICENSE
├── README.md
├── assets
│   ├── kusama
│   │   ├── kusama_paraID_assets.json
│   │   └── ...
│   └── polkadot
│       ├── polkadot_paraID_assets.json
│       └── ...
├── chainParsers
│   ├── README.md
│   ├── common_chainparser.js
│   ├── custom_parser_template.js
│   └── custom_chainparser ...
├── docs
│   ├── CONTRIBUTING.md
│   ├── DETAILS.md
│   └── STATUS.md
├── endpoints.js
├── node_modules
│   ├── packages...
├── publicEndpoints
│   ├── kusama_publicEndpoints.json
│   ├── polkadot_publicEndpoints.json
│   └── rococo_publicEndpoints.json
├── xcmRegistry
│   ├── kusama_xcmRegistry.json
│   └── polkadot_xcmRegistry.json
├── xcmgar
├── xcmgarManager.js
└── xcmgarTool.js
```

### [Main Directory](https://github.com/colorfulnotion/xcm-global-registry/tree/main/)
* [xcmgar](https://github.com/colorfulnotion/xcm-global-registry/blob/main/xcmgar): command line tool for xc gar registry generation & public endpoint generation.
* [xcmgarTool](https://github.com/colorfulnotion/xcm-global-registry/blob/main/xcmgarTool.js): Stand-alone library forked from [polkaholic](https://github.com/colorfulnotion/polkaholic) to supports various data transformation
* [xcmgarManager](https://github.com/colorfulnotion/xcm-global-registry/blob/main/xcmgarManager.js): main driver for on-chain crawling + local read/write tasks


### [chainParsers directory](https://github.com/colorfulnotion/xcm-global-registry/tree/main/chainParsers)
* [common_chainparser](https://github.com/colorfulnotion/xcm-global-registry/blob/main/chainParsers/common_chainparser.js) - Implements common registry parsing logics sahred among different parachains.
* [custom_parser_template](https://github.com/colorfulnotion/xcm-global-registry/blob/main/chainParsers/custom_parser_template.js) - Fork this template to create new custom parser for a project. Usually parachain teams deployed identical pallets on both production and canary networks, therefore the same custom parser can be used for both Polkadot and Kusama parachain. The custom parser must implement {`fetchGar`, `fetchXcGar`}. Optional augmentation {`automatic on-chain inferring`, `manualRegistry`} can be included to include chain-specific xcGar coverage, but it's not strictly required.

If custom parser is not specified, the parachain will be parsed using generic parser; (xc)Assets will likely be missing if parachain does not have use commonly recognizable `pallet:storage` selection for their registry. More: see detailed tutorial of [how to implement a custom parser](https://github.com/colorfulnotion/xcm-global-registry/blob/main/chainParsers/README.md) under 30min.


### [Assets directory](https://github.com/colorfulnotion/xcm-global-registry/tree/main/assets)  
* `relaychain_paraID_assets.json`: In this directory, you can find each parachain's (xc)Assets covered by the chainParser, which is then used to power [XCM Global Asset Registry](https://github.com/colorfulnotion/xcm-global-registry/tree/main/xcmRegistry)  - aggregated at relaychain level.

Ideally, Parachain-specific Assest Regsitry will enable teams/contributors examine any given parachain and quickly identify missing asset.

### [xcmRegistry directory](https://github.com/colorfulnotion/xcm-global-registry/tree/main/xcmRegistry)  
* `relaychain_xcmRegistry.json`: In this directory, you can find global xcm asset registry aggregated at relaychain level. Currently only support polkadot/kusama but can be easily extended to include Westend and Rococo.  

### [PublicEndpoints directory](https://github.com/colorfulnotion/xcm-global-registry/tree/main/assets)
* `relaychain_publicEndpoints.json`: A list public parachain endpointss generated by [updateEndpoints](https://github.com/colorfulnotion/xcm-global-registry/blob/main/updateEndpoints) - organized at relaychain level

## Design Choice

*Disclaimer: as initial implementer, I've made some arbitrary decisions just to get the system working. I welcome all feedbacks & criticism to make this project maximally usable. Thank you - mkchungs*

| Glossary   |      Defined As      |  Example |  Rationale/Use case |
|----------|:-------------|:-------------|:------|
| chainkey |  `relaychain-paraID` | polkadot-1000 |chainkey is used to identify a parachain within relaychain and potentially across different relaychains in the future |
| fullchainkey |  <code>relaychain-paraID&#124;projectID</code> | polkadot-1000&#124;statemint | fullchainkey is used as filter within common parser. The projectID portion makes the codeblock more readable for human (other developers)|
| xcmInteriorkey |  `'[{“network”:"relaychain"},{parachain:"paraID"}, {palletInstance/generalKey/generalIndex: 'val'}, ...]'` | '[{"network":"polkadot"},{"parachain":1000},{"palletInstance":50},{"generalIndex":1984}]' | xcmInteriorkey is used to identify a xcAsset within relaychain and potentially across different relaychains in the future. Specifically, (1) The network {polkadot, kusama, named:byte} has been added to the front to support global registry.  (2) X1/X2/.../X7 has been convered to flat array for easier serialization. |
| garLocation |  `garPallet:garStorage` | assets:metadata | garLocation is where a parachain's asset registry is located on-chain `api.query[garPallet][garStorage]`.  |
| xcGarLocation |  `xcGarPallet:xcGarStorage` | assetManager:assetIdType | xcGarLocation is where a parachain's xcm registry is located on-chain `api.query[xcGarPallet][xcGarStorage]`. |
| fetchGar |  `SampleParser.fetchGar()` | AcalaParser.fetchGar() | step 1 of registry crawling - Parsing parachain’s asset Registry using result from `garLocation`. Parsing logic is independent of querying data on-chain and can be categorized into certain common garParser in common_parser. |
| fetchXcGar |  `SampleParser.fetchXcGar()` | AcalaParser.fetchXcGar() | step 2 of registry crawling - Parsing parachain’s xc Registry using result from `xcGarLocation`. Can be categorized into certain common xcgarParser in common_parser. |
| fetchAugments |  `SampleParser.fetchAugments()` | AcalaParser.fetchAugments() | step 3 of registry crawling - since on-chain registry are not perfact, Augmentation step allows us to improve registry coverage by auto-inferring xcmInteriorkey via certain extrinsics or by manually including some known asset<->xcmInteriorkey mapping |
