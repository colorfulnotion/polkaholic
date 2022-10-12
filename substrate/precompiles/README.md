Instead of database entries in asset, ABIs for precompiles of EVM chains are loaded into `contractabi` table once with a "updatePrecompiles" script, which works across all chains.
When `query.getAddressContract` runs across a precompiled or system address, it can use the loaded `contractABIs` mark `isSystemContract` to `true`.

* Moonbeam precompiles: https://docs.moonbeam.network/builders/pallets-precompiles/precompiles/ https://github.com/PureStake/moonbeam/tree/master/precompiles
```
batch: 0x0000000000000000000000000000000000000808
call permit: 0x000000000000000000000000000000000000080a  
democracy: 0x0000000000000000000000000000000000000803
native token: 0x0000000000000000000000000000000000000802
proxy: 0x000000000000000000000000000000000000080b
randomness: 0x0000000000000000000000000000000000000809
staking: 0x0000000000000000000000000000000000000800
xtokens: 0x0000000000000000000000000000000000000804
xcmtransactor: 0x000000000000000000000000000000000000080d
```

* Astar precompiles: https://docs.astar.network/docs/EVM/precompiles/ https://github.com/AstarNetwork/astar-frame/tree/polkadot-v0.9.29/precompiles
```
Ethereum Native Precompiles
Precompile	Address
ECRecover	0x0000000000000000000000000000000000000001
Sha256	0x0000000000000000000000000000000000000002
Ripemd160	0x0000000000000000000000000000000000000003
Identity	0x0000000000000000000000000000000000000004
Modexp	0x0000000000000000000000000000000000000005
Bn128Add	0x0000000000000000000000000000000000000006
Bn128Mul	0x0000000000000000000000000000000000000007
Bn128Pairing	0x0000000000000000000000000000000000000008

Astar Specific Precompiles
Precompile	Address
DappsStaking	0x0000000000000000000000000000000000005001
Sr25519	0x0000000000000000000000000000000000005002
````

* XC20 assets will be held in `query.xcContractAddress` and will utilize `IERC20.json` programmatically
* For ERC20, ERC20LP, ERC721, ... Asset types,  IERC20.json, IERC20LP.json, IERC721.json are used as default contract metadata where (a) an asset's assetType is known
but (b) contract code is not available.
* For PSP22/PSP34 assets a similar approach can be used.

TODO:
* generate .json with remix, use updatePrecompiles to load `contractabi`
