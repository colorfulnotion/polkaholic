# Tanganika substrate-etl Summary (Monthly)

_Source_: [tanganika.polkaholic.io](https://tanganika.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2116
Status: No Public Websocket Endpoint available: Not indexing yet.


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-23 to 2023-01-24](/substrate-etl/kusama/2116-tanganika/2023-01-24.md) | 1,283,096 | 1,296,404 | 13,309 | none  | 149 | 46 |  | - | 
| [2022-12-01 to 2022-12-13](/substrate-etl/kusama/2116-tanganika/2022-12-13.md) | 935,791 | 1,009,889 | 74,036 | 63 (0.09%) | 1,090 | 48 | 3,213 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2116-tanganika/2022-11-30.md) | 770,800 | 935,790 | 162,603 | 2,388 (1.45%) | 2,504 | 44 | 3,057 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2116-tanganika/2022-10-31.md) | 557,446 | 770,799 | 213,354 | none  | 2,405 | 35 | 3,033 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2116-tanganika/2022-09-30.md) | 363,896 | 557,445 | 193,550 | none  | 1,421 | 24 | 2,749 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2116-tanganika/2022-08-31.md) | 201,235 | 363,895 | 162,661 | none  | 1,024 | 15 | 2,617 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2116-tanganika/2022-07-31.md) | 22,739 | 201,234 | 178,496 | none  | 114 | 3 | 2,473 | - | 
| [2022-06-27 to 2022-06-30](/substrate-etl/kusama/2116-tanganika/2022-06-30.md) | 1 | 22,738 | 22,738 | none  | 22 | 3 | 2,470 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2116` group by monthDT order by monthDT desc```

