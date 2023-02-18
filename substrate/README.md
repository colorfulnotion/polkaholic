
Polkaholic backend is run with 3 commands:

* polkaholic - indexes individual Substrate chains
* xcmindexer - indexes XCM activity between chains, and loads in `xcmgar` data
* substrate-etl - exports Polkaholic data to public `substrate-etl` dataset


## polkaholic 

```
Usage: polkaholic [options] [command]

Polkaholic Indexer

Options:
  -V, --version                             output the version number
  -h, --help                                display help for command

Commands:
  crawlblocks <chainID>                     Crawl Blocks Chain
  crawltraces [options] <chainID>           Crawl Traces of chain
  indexchain [options]                      Index Specific Chain or random chain
  auditchain <chainID>                      Audit Chain for any missing blocks
  backfill [options] <chainID>              Backfill missing blocks (can be sharded)
  identity [options] <chainID> <operation>  Update Identites
  indexblock <chainID> <blockNumber>        Index Block
  indexperiods <chainID> <logDT> <hrs>      Index Periods of a specific chain / day / hrs
  indexblocks <chainIDs>                    Index Blocks with SQL
  reindex [options] <chainID>               Reindex chain
  updateassetpricelog [options]             Update Asset Prices derives for chain or across the whole network
  backupchains                              Backup chains
  mapchains                                 Map chains into commands
  help [command]                            display help for command
```

## xcmindexer

```
Usage: xcmindexer [options] [command]

Polkaholic XCM Indexer

Options:
  -V, --version              output the version number
  -h, --help                 display help for command

Commands:
  xcmmessages [options]      Match XCM Messages across origination and destination chain
  xcmtransfer [options]      Find matches for a chainID/extrinsicHash or across the whole system - Usage: ./xcmindexer xcmtransfer -c 2000
  reindex [options]          Rewrite BigTable column data with latest xcmInfo info - Usage: ./xcmindexer reindex
  xcmgarload [options]       XCM GAR Loader - Usage: ./xcmindexer xcmgarload
  xcmgarloadasset [options]  XCM GAR Asset Loader - Usage: ./xcmindexer xcmgarloadasset
  help [command]             display help for command
```

## substrate-etl

```
Usage: substrate-etl [options] [command]

Manage polkaholic export to BigQuery substrate-etl project

Options:
  -V, --version                        output the version number
  -h, --help                           display help for command

Commands:
  dump [options]                       Stream data out to Bigquery
  updatebalances [options]             Update Balances for some chain
  blocklog [options] <chainID>         Crawl Chain for any missing blocks
  accountmetrics [options]             Dump account metrics for a chain
  dotsamametrics [options]             Generate Dotsam aggregates
  auditfix [options]                   Set up crawlBackfill workload for the results of an audit for a specific chain
  auditblocks [options]                Audit blocks
  xcmtransfers [options] <relayChain>  Dump xcmtransfers of relay chain
  polkaholic                           Dump polkaholic.json (for export)
  setuptables <relayChain> <paraID>    Setup BigQuery tables for new relaychain/paraID
  showtables [options]                 Show all substrate etl tables
  deletetables [options]               Generate delete cmd for matching substarte etl tables (Note: will only generate commands, you must manually run them)
  help [command]                       display help for command
```  