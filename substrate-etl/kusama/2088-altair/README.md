# Altair substrate-etl Summary (Monthly)

_Source_: [altair.polkaholic.io](https://altair.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2088



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2088-altair/2023-01-31.md) | 2,219,295 | 2,416,884 | 197,590 | none  | 1,270 | 27 | 29,408 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2088-altair/2022-12-31.md) | 2,020,464 | 2,219,294 | 198,831 | none  | 1,544 | 30 | 29,354 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2088-altair/2022-11-30.md) | 1,834,463 | 2,020,463 | 186,001 | none  | 1,213 | 23 | 29,264 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2088-altair/2022-10-31.md) | 1,646,489 | 1,834,462 | 187,974 | none  | 1,269 | 28 | 29,215 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2088-altair/2022-09-30.md) | 1,471,997 | 1,646,488 | 174,492 | none  | 1,538 | 32 | 29,140 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2088-altair/2022-08-31.md) | 1,310,983 | 1,471,996 | 161,014 | none  | 2,295 | 48 | 29,085 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2088-altair/2022-07-31.md) | 1,154,655 | 1,310,982 | 156,328 | none  | 2,357 | 46 | 22,390 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/2088-altair/2022-06-30.md) | 1,061,018 | 1,154,654 | 93,637 | none  | 974 | 22 | 22,206 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/2088-altair/2022-05-31.md) | 977,312 | 1,061,017 | 83,706 | none  | 943 | 23 | 22,136 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/kusama/2088-altair/2022-04-30.md) | 915,097 | 977,311 | 62,215 | none  | 2,236 | 44 | 22,027 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/kusama/2088-altair/2022-03-31.md) | 840,047 | 915,096 | 75,050 | none  | 3,470 | 75 | 21,631 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/kusama/2088-altair/2022-02-28.md) | 743,672 | 840,046 | 96,375 | none  | 6,800 | 153 | 21,277 | - | 
| [2022-01-01 to 2022-01-31](/substrate-etl/kusama/2088-altair/2022-01-31.md) | 554,725 | 743,671 | 188,947 | none  | 1,070 | 24 | 20,704 | - | 
| [2021-12-01 to 2021-12-31](/substrate-etl/kusama/2088-altair/2021-12-31.md) | 355,076 | 554,724 | 199,649 | none  | 1,318 | 28 | 20,225 | - | 
| [2021-11-01 to 2021-11-30](/substrate-etl/kusama/2088-altair/2021-11-30.md) | 203,157 | 355,075 | 151,919 | none  | 1,177 | 25 | 17,251 | - | 
| [2021-10-01 to 2021-10-31](/substrate-etl/kusama/2088-altair/2021-10-31.md) | 9,926 | 203,156 | 193,229 | 2 (0.00%) | 1,393 | 14 | 11,590 | - | 
| [2021-09-29 to 2021-09-30](/substrate-etl/kusama/2088-altair/2021-09-30.md) | 1 | 9,925 | 9,925 | none  | 7 | 4 | 10 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2088` group by monthDT order by monthDT desc```

