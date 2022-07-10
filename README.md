# Polkaholic.io

Polkaholic.io indexes Polkadot, Kusama and their Substrate based parachains, and exposes a
multi-chain block explorer at https://polkaholic.io powered by APIs https://api.polkaholic.io.

## Running the Polkaholic.io Block explorer

Assuming the indexer has been set up (see "Set up Indexing"), to run the polkaholic.io Block explorer:
```
# node index.js
```
By default, the configs use https://api.polkaholic.io.  
To use your local index, set `POLKAHOLIC_API_URL` in your environment

```
# node api.js
```

## Set up Indexing

The polkaholic index is stored in mysql, BigTable and BigQuery, where we make heavy use of Google Cloud.

Setup of the backend tables:

* mysql (5.7): substrate/schema/polkaholic.sql
* BigQuery: substrate/cbt.sh
* BigTable: substrate/bq/bq.sh

The PolkaholicDB class manages the connections to the above tables with a `POLKAHOLIC_DB` variable (see 
also `POLKAHOLIC_DB_REPLICA`, which support multiple replicas in load balanced instance groups in 3+ regions).
managing "ini" file credentials in one place:
```
[client]
host = polkaholic
user = polkaholic
password = ******
database = polkaholic
default-character-set=utf8mb4

[email]
email = info@polkaholic.io
password = ******

[gc]
projectName = us-west1-wlk
bigqueryDataset = polkaholic
bigtableInstance = polkaholic
bigtableCluster = polkaholic
storageBucket = polkaholic
```

Each chain's blocks are stored in a `block${chainID}` table in mysql and a BigTable `chain${chainID}`,
with the state of the chain kept in a single record in the `chain` table.  ChainIDs are 0 + 2 for Polkadot and Kusama, and then `paraID` and `paraID + 20000` for Polkadot parachains and Kusama parachains.

Indexing is managed with `crawlBlocks ${chainID}` -- to kick off indexing of a chain, you will need to add a record into the `chain` table with a valid WSEndpoint (e.g. wss://rpc.polkadot.io)
```
mysql> select * from chain where chainID = 0 \G
*************************** 1. row ***************************
                     chainID: 0
                          id: polkadot
                      prefix: 0
                   chainName: Polkadot
                  relayChain: polkadot
                  WSEndpoint: wss://rpc.polkadot.io
                 WSEndpoint2:
                 WSEndpoint3: NULL
...
               blocksCovered: 11092165
             blocksFinalized: 11092162
            lastCleanChainTS: NULL
               blocksCleaned: 9729723
                 displayName: Polkadot Relay Chain
             standardAccount: *25519
                    decimals: [10]
                     symbols: ["DOT"]
                     website: https://polkadot.network
                 coingeckoID: polkadot
```
Then run `crawlBlocks 0`, which will fill up the `block${chainID}` table and `chain${chainID}` BigTable.  (Polkaholic runs 2-3 crawler services for each chain for redundancy.)
While most parachains support `subscribeStorage` to support the fetching of traces, most public endpoints do not support "unsafe" trace calls.  All gaps in traces have to be covered using our internal nodes (currently 10-12)  and onfinality nodes.  However, onfinality does not have 100% coverage of all parachains so some chains have only partial indexes.  New parachains tend to need a few weeks.

Because not
The end setup for mysql:
```
mysql> show tables;
+--------------------------+
| Tables_in_defi           |
+--------------------------+
| account                  |
| address                  |
| addressTopN              |
| addressoffer             |
| apikey                   |
| asset                    |
| assetInit                |
| assetholder0             |
| assetholder1000          |
| assetholder2             |
| assetholder2000          |
| assetholder2002          |
...
| assetlog                 |
| auditHashes              |
| block0                   |
| block1000                |
| block2                   |
| block2000                |
| block2002                |
...
| blocklog                 |
| blockunfinalized         |
| bqlog                    |
| chain                    |
| chainEndpoint            |
| chainPalletStorage       |
| chainhostnameendpoint    |
| chainparachain           |
| coingecko                |
| coingecko_market_chart   |
| contractabi              |
| crowdloan                |
| events                   |
| eventslog                |
| evmtxs                   |
| evmtxslog                |
| extrinsicdocs            |
| extrinsics               |
| extrinsicslog            |
| extrinsicsrecent         |
| follow                   |
| indexlog                 |
| method                   |
| multisigaccount          |
| offer                    |
| proxyaccount             |
| rewards                  |
| rewardslog               |
| specVersions             |
| subaccount               |
| talismanEndpoint         |
| testParseTraces          |
| token1155holder          |
| tokenholder              |
| transfers                |
| transferslog             |
| transfersrecent          |
| user                     |
| xcmlog                   |
| xcmmap                   |
| xcmmessages              |
| xcmmessagesrecent        |
| xcmtransfer              |
| xcmtransferdestcandidate |
+--------------------------+
```
BigTable:
```
# cbt ls
2022/07/09 10:55:56 -creds flag unset, will use gcloud credential
accounthistory
accountrealtime
addressextrinsic
apikeys
chain0
chain1000
chain2
chain2000
...
hashes
```
BigQuery:
```
# bq ls polkaholic
   tableId     Type    Labels   Time Partitioning   Clustered Fields  
 ------------ ------- -------- ------------------- ------------------
  events       TABLE            DAY (field: ts)                       
  evmtxs       TABLE            DAY (field: ts)                       
  extrinsics   TABLE            DAY (field: ts)                       
  rewards      TABLE            DAY (field: ts)                       
  transfers    TABLE            DAY (field: ts)                       
  xcm          TABLE            DAY                                 
```

The crawling service listens for new blocks and storage events over WebSockets (`ws://`).  It should be run on at least 2 nodes and is managed with a service powered by `crawlBlocks ${chainID}`.

The WS-based crawler stores all blocks and trace data in BigTable tables `chain${chainID}` using 6 column families:
```
# cbt ls chain0
Family Name	GC Policy
-----------	---------
blockraw	versions() > 1
events		versions() > 1
feed	   	versions() > 1
finalized	versions() > 1
n		      versions() > 1
trace		  versions() > 1
````

Block numbers are keyed by 8 digit hex (instead of decimal) to support prefix scans by the indexer.

* The `subscribeStorage` events result in a call to fetch the block and turn it _manually_ into sidecar compatible form, resulting in cells in both the `block` and `trace` column family with a call to `processBlock` and `processTrace`.
* The `subscribeFinalizedHeads` events result in cells in only the `finalized` column family.  Multiple block candidates at a given height result in multiple columns, but when a block is finalized, other non-finalized candidates are deleted.

Here is the crawlBlocks process on chain 8 (karura), run _manually_ on one node:
```
# root@moonriver:~/go/src/github.com/colorfulnotion/polkaholic/substrate# ./crawlBlocks 2000
chain API connected 2000
2022-07-09 11:42:51        API/INIT: RPC methods not decorated: evm_blockLimits
You are connected to ACALA chain 2000 endpoint=... with types + rpc + signedExt
...
subscribeStorage Acala bn=1396814 0x0d5aaa4b68bce292eafe392b52870a13d0e3f416beb86b69b6d6c90185049c03: cbt read chain2000 prefix=0x0015504e
subscribeFinalizedHeads Acala 1396812 CHECK: cbt read chain2000 prefix=0x0015504c |   update chain set blocksFinalized = '1396812', lastFinalizedDT = Now() where chainID = '2000'
...
```

Here is a single block for chain 2000:
```
# cbt read chain2000 prefix=0x0015504c
----------------------------------------
0x0015504c
  blockraw:0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e @ 2022/07/09-11:43:18.000000
    "{\"header\":{\"parentHash\":\"0x6a288a32a987d87db925bd030424594a4f6365c7feb8ab87428ab9c95f0cc2c0\",\"number\":1396812,\"stateRoot\":\"0x001b9629fc78a4fb04305c99d57e033325c5226484a178d738b8b1b90a7842ec\",\"extrinsicsRoot\":\"0xaa605341d6f38461921df4d0ef72c8607e41b818e56d7daabb5d5842bd949b18\",\"digest\":{\"logs\":[{\"preRuntime\":[\"0x61757261\",\"0xb07b3b0800000000\"]},{\"seal\":[\"0x61757261\",\"0x184eb4cf21f21a502091d9cb3a0aa6b54d20321a514a050a40df0b850c4d914f6c4b2ba83f5b96e7fc29cb2c084ea847a248d5b0d1d91b967c92ee7fd8f09989\"]}]}},\"extrinsics\":[\"0x280401000bd5f245e48101\",\"0xcd..."],\"number\":1396812,\"hash\":\"0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e\",\"blockTS\":1657392198}"
  events:0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e @ 2022/07/09-11:43:18.000000
    "[{\"phase\":{\"initialization\":null},\"event\":{\"data\":[{\"token\":\"AUSD\"},...]"
  feed:0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e @ 2022/07/09-11:43:18.000000
    "{\"header\":{\"parentHash\":\"0x6a288a32a987d87db925bd030424594a4f6365c7feb8ab87428ab9c95f0cc2c0\",\"number\":1396812,\"stateRoot\":\"0x001b9629fc78a4fb04305c99d57e033325c5226484a178d738b8b1b90a7842ec\",\"extrinsicsRoot\":\"0xaa605341d6f38461921df4d0ef72c8607e41b818e56d7daabb5d5842bd949b18\",\"digest\":{\"logs\":[{\"preRuntime\":[\"0x61757261\",\"0xb07b3b0800000000\"]},{\"seal\":[\"0x61757261\",\"0x184eb4cf21f21a502091d9cb3a0aa6b54d20321a514a050a40df0b850c4d914f6c4b2ba83f5b96e7fc29cb2c084ea847a248d5b0d1d91b967c92ee7fd8f09989\"]}]}},\"extrinsics\":[{\"chainID\":2000,\"ts\":1657392198,\"blockHash\":\"0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e\",\"blockNumber\":1396812,\"extr...
  finalized:0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e @ 2022/07/09-11:43:49.843000
    "1"
  finalized:0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e @ 2022/07/09-11:43:49.600000
    "1"
  n:traceType                              @ 2022/07/09-11:43:18.000000
    "subscribeStorage"
  trace:0x7414093b4997ab781fd2e01e4a502c5c48e58ba0cff565a6864220366196009e @ 2022/07/09-11:43:18.000000
    "[{\"k\":\"0x027a4e29b47efb389eca0f0ba7a8d619057d256c2b189477f5441f02ad1f0fd6\",\"v\":null},{\"k\":\"0x15464cac3378d46f113cd5b7a4d71c8436cf781e2bdd3b2fe1ce339b2858e5682f857e6151a46fd95ac09ed30bf9c17475373689bb8965cf5c3cd9cff1894f407310acd892d4f165\",\"v\":\"0x100a000000\"},{\"k\":\"0x1da53b775b270400e7e61ed5cbc5a146c726478796bad0b9cabd7481dbe64983\",\"v\":null},{\"k\":\"0x26aa394eea5630e07c48ae0c9558cef702a5c1b19ab7a04f536c519aca4983ac\",\"v\":\"0x104c501500\"},{\"k\":\"0x26aa394eea5630e07c48ae0c9558cef70a98fdbe9ce6c55837576c60c7af3850\",\"v\":\"0x100c000000\"},{\"k\":\"0x26aa394eea5630e07c48ae0c9558cef734abf5cb34d6244378cddbf18e849d96\",\"v\":\"0x60a8f44824000000000000000000000000708435b502000000\"},{\"k\":\"0x26aa394eea5630...
```
The above log shows how to inspect with `cbt` on the command line.
In most cases there will be multiple cells for `finalized` due to multiple indexers, but any row with a `finalized` cell should have only one block/trace matching column.

The tip of each crawled chain is held in the `chain` table in the `blocksCovered` column.
```
mysql> select chainID, chainName, lastCrawlDT, blocksCovered from chain where crawling = 1;
+---------+---------------------+---------------------+---------------+
| chainID | chainName           | lastCrawlDT         | blocksCovered |
+---------+---------------------+---------------------+---------------+
|       0 | Polkadot            | 2022-07-09 18:55:00 |      11092883 |
|       2 | Kusama              | 2022-07-09 18:55:06 |      13489228 |
|    1000 | Statemint           | 2022-07-09 18:55:02 |       1662966 |
|    2000 | Acala               | 2022-07-09 18:55:01 |       1396867 |
|    2002 | Clover              | 2022-07-09 18:54:50 |       1331088 |
...
```

At the end of each hour, for each chain, an hourly index is built from JSON files that is loaded into the above BigQuery tables with `indexChain`.

### Backfill of Blocks and Traces

The crawling service is NOT perfect due to missing traces or connectivity issues.
The `auditChain` script identifies missing blocks and traces, whereas the `crawlBackfill` and `crawlTraces` scripts crawl the blocks + traces that are missing.  

Because no public WSEndpoints exist that support 'unsafe' traces (that are not obtained from `subscribeStorage`),
we use `chain.WSBackfill` and `chain.RPCBackfill` to refer to internal full nodes and temporary onfinality nodes.
Onfinality does a wonderful job with their "Lightning sync" and maintaining the latest releases for dozens of chains.  

### Other Processes

The following script are put in cron jobs:
```
* updateBQLog - hourly -- updates the BigQuery tables
* getPricefeed - 3-5 mins -- fetches the latest prices from the coingecko API
* updateXCMTransfer - 3-5 mins - fills in some data in the xcmtransfer table
* updateIdentity0, updateIdentity2 - daily -- fetches new identities from Polkadot and Kusama
```
At present, we manually:
* acquire WSEndpoints from polkadot.js.org and attempt to update `summary/endpoints.js` with `updateEndpoints`
* manually updated chain.prefix
* supervise `computePriceUSDPaths`
* supervise onfinality fetches of missing blocks (for new chains) with `crawlBackfill` + trace data with `crawlTraces`, `crawlBackfill`
* supervise reindexes with `indexReindex`

### Google Cloud Deployment

At present, 44 chains are crawled/indexed by 10 nodes (4 core, 16GB), where each of the 10 nodes are running 8-10 services (running `crawlBlocks` and `indexChain`) _and_ one of the top 10 chains.  Ansible is used with auto generated YAML (see `yaml`) with `generateCrawlerYAML` and deployment is managed with `Makefile`:
* `make indexers` - updates 10 indexers
* `make ui` - updates US/AS/EU endpoints

### Size of Index

The current size of the index (as of July 9, 2022) is:
* mysql - 109GB (master only, not including 3+ replicas)
* BigTable - 5.4TB (US based)
* BigQuery - 331G (US based)

```
mysql> select relaychain, round(sum(blocksFinalized)/1000000,1) as blocksMM from chain where  lastCrawlDT > date_sub(Now(), interval 1 day) group by relaychain;             
+------------+----------+
| relaychain | blocksMM |
+------------+----------+
| kusama     |     41.3 |
| polkadot   |     25.0 |
+------------+----------+
```

Other:
* Backup is done on mysql via GCP
* Backup of BigTable is done with a script generated by `backupChains`

## Contributing

### Contributing Guidelines

[Contribution Guidelines](CONTRIBUTING.md)

### Contributor Code of Conduct

[Code of Conduct](CODE_OF_CONDUCT.md)

## License

Polkaholic is [GPL 3.0 licensed](LICENSE).
