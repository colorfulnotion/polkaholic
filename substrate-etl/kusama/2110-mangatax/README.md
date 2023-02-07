# Mangata substrate-etl Summary (Monthly)

_Source_: [mangatax.polkaholic.io](https://mangatax.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2110
Status: Only partial index available.


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2110-mangatax/2023-01-31.md) |  | 1,495,611 |  | 1,495,612 | 22 | 7 | 1,651 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2110-mangatax/2022-12-31.md) | 1,240,087 | 1,436,132 |  | 196,046 | 156 | 6 | 1,476 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2110-mangatax/2022-11-30.md) | 1,042,543 | 1,240,086 |  | 197,544 | 40 | 3 | 1,449 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2110-mangatax/2022-10-31.md) | 830,803 | 1,042,542 |  | 211,740 | 270 | 14 | 1,395 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2110-mangatax/2022-09-30.md) | 636,740 | 830,802 |  | 194,063 | 800 | 2 | 1,339 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2110-mangatax/2022-08-31.md) | 473,310 | 636,645 |  | 163,336 | 365 | 14 | 1,262 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2110-mangatax/2022-07-31.md) | 326,257 | 473,309 |  | 147,053 | 1,922 | 13 | 1,180 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/2110-mangatax/2022-06-30.md) | 199,153 | 326,256 |  | 127,104 | 4,894 | 34 | 1,158 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/2110-mangatax/2022-05-31.md) | 61,315 | 199,152 |  | 137,838 | 60 |  | 12 | - | 
| [2022-04-12 to 2022-04-30](/substrate-etl/kusama/2110-mangatax/2022-04-30.md) | 1 | 61,314 |  | 61,314 | 12 |  | 8 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2110` group by monthDT order by monthDT desc```

