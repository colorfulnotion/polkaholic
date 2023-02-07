# Collectives substrate-etl Summary (Monthly)

_Source_: [collectives.polkaholic.io](https://collectives.polkaholic.io)

*Relay Chain*: polkadot
*Para ID*: 1001
Status: Only partial index available.


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-13 to 2023-01-31](/substrate-etl/polkadot/1001-collectives/2023-01-31.md) | 374,918 | 510,349 | 128,342 | 7,090 | 2 |  | 18 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.polkadot.blocks1001` group by monthDT order by monthDT desc```

