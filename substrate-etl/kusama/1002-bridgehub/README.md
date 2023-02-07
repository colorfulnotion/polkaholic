# BridgeHub substrate-etl Summary (Monthly)

_Source_: [bridgehub.polkaholic.io](https://bridgehub.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 1002
Status: Only partial index available.


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-30 to 2023-01-31](/substrate-etl/kusama/1002-bridgehub/2023-01-31.md) | 72,758 | 86,879 | 14,122 | none |  |  | 4 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks1002` group by monthDT order by monthDT desc```

