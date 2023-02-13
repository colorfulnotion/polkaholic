# InvArch Tinkernet substrate-etl Summary (Monthly)

_Source_: [tinkernet.polkaholic.io](https://tinkernet.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2125
Status: Only partial index available: Onboarding


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-02-01 to 2023-02-13](/substrate-etl/kusama/2125-tinkernet/2023-02-13.md) | 1,097,041 | 1,169,714 | 41,171 | 31,503 (43.35%) | 937 | 57 | 8,055 | - | 
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2125-tinkernet/2023-01-31.md) | 900,714 | 1,097,040 | 188,754 | 7,573 (3.86%) | 965 | 19 | 1,861 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2125-tinkernet/2022-12-31.md) | 710,911 | 900,713 | 189,803 | none  | 440 | 12 | 1,808 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2125-tinkernet/2022-11-30.md) | 515,885 | 710,910 | 195,026 | none  | 647 | 15 | 1,793 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2125-tinkernet/2022-10-31.md) | 299,895 | 515,884 | 215,990 | none  | 1,003 | 22 | 1,783 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2125-tinkernet/2022-09-30.md) | 135,276 | 299,894 | 69,523 | 95,096 (57.77%) | 26 | 1 | 1,206 | - | 
| [2022-08-08 to 2022-08-31](/substrate-etl/kusama/2125-tinkernet/2022-08-31.md) | 1 | 135,275 | 101,096 | 34,179 (25.27%) | 271 | 6 | 1,189 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2125` group by monthDT order by monthDT desc```

