# InvArch Tinkernet substrate-etl Summary (Monthly)

_Source_: [tinkernet.polkaholic.io](https://tinkernet.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2125
Status: Only partial index available: Onboarding


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-30](/substrate-etl/kusama/2125-tinkernet/2023-01-30.md) | 900,714 | 1,090,694 | 188,654 | 1,327 (0.70%) | 965 | 20 | 1,860 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2125-tinkernet/2022-12-31.md) | 710,911 | 900,713 | 189,803 | none  | 440 | 12 | 1,808 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2125-tinkernet/2022-11-30.md) | 515,885 | 710,910 | 195,026 | none  | 647 | 15 | 1,793 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2125-tinkernet/2022-10-31.md) | 299,895 | 515,884 | 215,989 | 1 (0.00%) | 990 | 24 | 1,783 | - | 
| [2022-09-23 to 2022-09-30](/substrate-etl/kusama/2125-tinkernet/2022-09-30.md) | 244,956 | 299,894 | 54,939 | none  |  |  |  | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2125` group by monthDT order by monthDT desc```

