# Kylin substrate-etl Summary (Monthly)

_Source_: [kylin.polkaholic.io](https://kylin.polkaholic.io)

*Relay Chain*: polkadot
*Para ID*: 2052
Status: Only partial index available.


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/polkadot/2052-kylin/2023-01-31.md) | 472,512 | 602,892 | 127,454 | 2,927 | 103 | 3 | 1,108 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/polkadot/2052-kylin/2022-12-31.md) | 335,848 | 472,511 | 136,664 | none | 101 | 3 | 1,106 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/polkadot/2052-kylin/2022-11-30.md) | 227,968 | 335,847 | 95,881 | 11,999 | 92 | 3 | 1,105 | - | 
| [2022-10-26 to 2022-10-31](/substrate-etl/polkadot/2052-kylin/2022-10-31.md) | 209,292 | 227,967 | 18,676 | none | 29 | 4 | 1,104 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.polkadot.blocks2052` group by monthDT order by monthDT desc```

