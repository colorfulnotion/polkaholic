# Statemine substrate-etl Summary (Monthly)

_Source_: [statemine.polkaholic.io](https://statemine.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 1000



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/1000-statemine/2023-01-31.md) | 3,578,790 | 3,796,174 | 217,385 | none | 2,227 | 29 | 49,102 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/1000-statemine/2022-12-31.md) | 3,370,335 | 3,578,789 | 208,455 | none | 4,541 | 54 | 48,909 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/1000-statemine/2022-11-30.md) | 3,161,591 | 3,370,334 | 208,744 | none | 5,023 | 44 | 48,531 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/1000-statemine/2022-10-31.md) | 2,948,490 | 3,161,590 | 213,101 | none | 1,757 | 26 | 46,389 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/1000-statemine/2022-09-30.md) | 2,749,976 | 2,948,489 | 198,514 | none | 1,941 | 33 | 46,090 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/1000-statemine/2022-08-31.md) | 2,567,600 | 2,749,975 | 182,376 | none | 3,368 | 58 | 45,786 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/1000-statemine/2022-07-31.md) | 2,386,348 | 2,567,599 | 181,252 | none | 17,770 | 527 | 55,623 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/1000-statemine/2022-06-30.md) | 2,196,871 | 2,386,347 | 189,477 | none | 12,976 | 340 | 55,762 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/1000-statemine/2022-05-31.md) | 2,020,396 | 2,196,870 | 176,475 | none | 3,260 | 32 | 22,377 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/kusama/1000-statemine/2022-04-30.md) | 1,906,932 | 2,020,395 | 113,464 | none | 5,076 | 51 | 21,963 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/kusama/1000-statemine/2022-03-31.md) | 1,771,429 | 1,906,931 | 135,503 | none | 6,497 | 124 | 20,900 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/kusama/1000-statemine/2022-02-28.md) | 1,640,988 | 1,771,428 | 130,441 | none | 3,560 | 43 | 20,895 | - | 
| [2022-01-01 to 2022-01-31](/substrate-etl/kusama/1000-statemine/2022-01-31.md) | 1,444,785 | 1,640,987 | 196,203 | none | 7,322 | 79 | 18,855 | - | 
| [2021-12-01 to 2021-12-31](/substrate-etl/kusama/1000-statemine/2021-12-31.md) | 1,248,708 | 1,444,784 | 196,077 | none | 7,623 | 66 | 17,426 | - | 
| [2021-11-01 to 2021-11-30](/substrate-etl/kusama/1000-statemine/2021-11-30.md) | 1,072,793 | 1,248,707 | 175,915 | none | 5,475 | 69 | 15,154 | - | 
| [2021-10-01 to 2021-10-31](/substrate-etl/kusama/1000-statemine/2021-10-31.md) | 868,216 | 1,072,792 | 204,577 | none | 5,060 | 71 | 13,639 | - | 
| [2021-09-01 to 2021-09-30](/substrate-etl/kusama/1000-statemine/2021-09-30.md) | 656,943 | 868,215 | 211,273 | none | 16,472 | 407 | 12,360 | - | 
| [2021-08-01 to 2021-08-31](/substrate-etl/kusama/1000-statemine/2021-08-31.md) | 442,400 | 656,942 | 214,543 | none | 243 | 3 | 10,227 | - | 
| [2021-07-01 to 2021-07-31](/substrate-etl/kusama/1000-statemine/2021-07-31.md) | 233,379 | 442,399 | 209,021 | none | 488 | 3 | 10,170 | - | 
| [2021-06-03 to 2021-06-30](/substrate-etl/kusama/1000-statemine/2021-06-30.md) | 66,687 | 233,378 | 166,692 | none | 93 | 1 | 80 | - | 
| [2020-01-01 to 2020-01-01](/substrate-etl/kusama/1000-statemine/2020-01-01.md) | 1 | 66,686 | 66,680 | 6 |  |  |  | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks1000` group by monthDT order by monthDT desc```

