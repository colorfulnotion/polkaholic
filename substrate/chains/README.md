## Assets and Asset holders

To unify EVM + Substrate chains together, we represent unique assets in the `asset` (mysql) and `btAsset` (bigtable) with strings:

```
{"Token":"ACA"}#10
{"Token":"GLMR"}#1284
{"Token":"ASTR"}#5
{"LiquidCrowdloan":"13"}#10
{"StableAssetPoolToken":"0"}#8
{"Dex":{"DexShare":[{"Token":"KUSD"},{"Token":"LKSM"}]}}#8
{"Dex":{"DexShare":[{"Token":"DOT"},{"LiquidCrowdloan":"13"}]}}#10
{"Loans":{"LiquidCrowdloan":"13"}}#10
0xfa9343c3897324496a05fc75abed6bac29f8a40f#1284
```

* Each string has `#{chainID}` appended to note that the asset "lives" on that chain.  In code, we will use `assetChain` and `asset` to refer to representations.  
* As new assets are created, both tables must be updated with new strings and their associated metadata.  Substrate assets are JSON strings (start with `{`) where as ERC20/721/1155 assets are strings that start with `{`.   
* Decimals must be maintained in both tables, and does not change.
* `totalSupply` should be updated in both tables.   Keeping hourly precision is desirable, but its a secondary concern right now.


* In the `asset` table, we use the `tokenType` field (we could rename this `assetType`) to model ERC token but also include: `LiquidityPair`, `LoanCollateral`, `LoanDebit`, `NFT` where the idea is that native chains will have variability in their asset JSON strings, but the `tokenType` specified a set of `asset` columns

```
mysql> desc asset;
+-----------------+-------------------------------------------------------+------+-----+---------+-------+
| Field           | Type                                                  | Null | Key | Default | Extra |
+-----------------+-------------------------------------------------------+------+-----+---------+-------+
| asset           | varchar(67)                                           | NO   | PRI | NULL    |       |
| chainID         | int(11)                                               | NO   | PRI | 0       |       |
| abiRaw          | mediumblob                                            | YES  |     | NULL    |       |
| numTransactions | int(11)                                               | YES  |     | 0       |       |
| tokenType       | enum('Unknown','Contract','ERC20','ERC721','ERC1155') | YES  |     | Unknown |       |
| tokenName       | varchar(64)                                           | YES  |     | NULL    |       |
| symbol          | varchar(32)                                           | YES  |     | NULL    |       |
| decimals        | int(11)                                               | YES  |     | NULL    |       |
| totalSupply     | decimal(65,18)                                        | YES  |     | NULL    |       |
| lastUpdateBN    | int(11)                                               | YES  |     | 1       |       |
| lastUpdateDT    | datetime                                              | YES  |     | NULL    |       |
| creator         | varchar(67)                                           | YES  |     | NULL    |       |
| createdAtTx     | varchar(67)                                           | YES  |     | NULL    |       |
| createDT        | datetime                                              | YES  |     | NULL    |       |
+-----------------+-------------------------------------------------------+------+-----+---------+-------+
14 rows in set (0.01 sec)
```

The field `tokenName` and `tokenSymbol` can be used to represent "lcDOT", but ideally would come from chain's metadata.

* In an `assetholder` mysql table, we represent the state of the above asset, where `holder` is either an EVM address or Substrate public key:

```
mysql> desc assetholder;
+--------------+----------------+------+-----+---------+-------+
| Field        | Type           | Null | Key | Default | Extra |
+--------------+----------------+------+-----+---------+-------+
| asset        | varchar(67)    | NO   | PRI | NULL    |       |
| chainID      | int(11)        | NO   | PRI | 0       |       |
| holder       | varchar(67)    | NO   | PRI | NULL    |       |
| free         | decimal(65,18) | YES  |     | NULL    |       |
| reserved     | decimal(65,18) | YES  |     | NULL    |       |
| miscFrozen   | decimal(65,18) | YES  |     | NULL    |       |
| frozen       | decimal(65,18) | YES  |     | NULL    |       |
| lastUpdateDT | datetime       | YES  |     | NULL    |       |
| lastUpdateBN | int(11)        | YES  |     | 1       |       |
| lastCrawlBN  | int(11)        | YES  |     | 1       |       |
+--------------+----------------+------+-----+---------+-------+
```

* In mysql `assetholder` ERC20 balances are held in "free", while Substrate tokens use { free, reserved, miscFrozen, frozen }.  This enables us to compute `numHolders` for any asset with `select count(*) from assetholder where free > 0 group by asset`.
* In `btAddress` (keys are EVM + Substrate addresses matching `holder`), a `realtime` column family with a column of the `asset`, holds a JSON string holding `free`, ... for

Questions:
* ASTR can move from the substrate chain to EVM and back, and "belong" to the substrate account and the H160 derived account
* GLMR can exist in both the substrate chain and the EVM chain, and belong to the substrate account and a completely separate EVM account, how should "asset"


## Chain Indexing

Crawling/Indexing finalized blocks at the tip and at hourly interval periods should result in:

* `realtime` models of the IMMEDIATE activity of an address + IMMEDIATE asset, which are kept in the `realtime` column family
* `hourly` summaries that an asset and account, kept in the `hourly` as the last block of an hour is finalized

Currently a single "updateAddressStorage" indexer function models the activity of an account, where we have only addressed Acala/Karura key operations, with a little bit on Astar.

Earlier, we had the hourly summary on a chain built from "sections" of the previous hour of account activity.

1. Moonbeam ERC20 Tokens result in `assetholder` inserts creating the potential, with balances updated as soon as possible (crawlBlocks), or at the top of the hour (indexChain).

2. We need `{"LiquidCrowdloan":"13"}` in the acala metadata, including the decimals  so that we don't have code like this:
```
  if (rAssetkey == '{"LiquidCrowdloan":"13"}#10' || rAssetkey == '{"Token":"DOT"}#10') { aa[fld] = e2[fld] / 10 ** 10; }
```

3. Acala "Claims" is NOT fine -- we were aggregating "claims" and "claimable" hourly
```
updateAddressStorage acala:processRewardsSharesAndWithdrawnRecords-stakedLiquidity 0xc48af63493a8439689e6ccc8c780d0f7c7d81be7ef592e8bc6194e944c777f37 {"Loans":{"LiquidCrowdloan":"13"}}#10
updateAddressStorage acala:processRewardsSharesAndWithdrawnRecords-stakedLiquidity 0x28d8e0b4fdeb9a3805ac64fe2ed49a090c84a912f6a8a94c3268f811e49fc467 {"Dex":{"DexShare":[{"Token":"AUSD"},{"LiquidCrowdloan":"13"}]}}#10
updateAddressStorage acala:processIncentivesPendingMultiRewards-incentives 0x10bb2cd41c134f6c1a0b82df1dd090ad9ff41796ba8badba113dad41b43f7533 {"Loans":{"Token":"ACA"}}#10
updateAddressStorage acala:processIncentivesPendingMultiRewards-incentives 0x9cae1e9b114f87603075cfeda7bb30aae9761ac437460429feef67cfce4d8041 {"Dex":{"DexShare":[{"Token":"KUSD"},{"Token":"LKSM"}]}}#8
updateAddressStorage acala:processIncentivesPendingMultiRewards-incentives 0x9cae1e9b114f87603075cfeda7bb30aae9761ac437460429feef67cfce4d8041 {"Dex":{"DexShare":[{"Token":"KUSD"},{"Token":"LKSM"}]}}#8
```
I think we could do tallying in a new "rewards" column somehow, one cell for each earned reward.



Parallel/Clover/Efinity/interlay/hydradx/centrifuge/composable need checking against the above

The end result should be this:
* in `btAddress` the `realtime` columns will be distinct from each other ALL the time as the column represent different asset concepts
* in `btAsset` the different asset concepts can have their hourly and realtime state managed (totalSupply)
* for both `btAddress` and `btAsset`, any activity in the `realtime` in the last hour can be combine with the previous `hourly` state to generate new `hourly` state.  Fundamentally, this works for "tail" assets
* in ALL cases, the `asset` `tokenType` will unambiguously determine; in most cases, the first key of the JSON object will indicate the `tokenType` (`assetType`)  
* in EVM cases, the 0x will indicate ERC-hood but will not indicate the `tokenType` in the asset string -- however, potentially the `tokenType` can be kept alongside "free" in the JSON string held in `btAddress` such that joins with `btAsset` are not required
