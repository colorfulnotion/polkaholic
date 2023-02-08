# Shiden substrate-etl Summary (Monthly)

_Source_: [shiden.polkaholic.io](https://shiden.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2007



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2007-shiden/2023-01-31.md) | 3,069,580 | 3,287,876 | 217,971 | 326 | 17,090 | 140 | 637,257 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2007-shiden/2022-12-31.md) | 2,859,394 | 3,069,579 | 210,186 | none | 15,726 | 119 | 636,067 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2007-shiden/2022-11-30.md) | 2,649,806 | 2,859,393 | 209,588 | none | 12,267 | 115 | 635,192 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2007-shiden/2022-10-31.md) | 2,433,486 | 2,649,805 | 216,320 | none | 5,958 | 87 | 633,901 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2007-shiden/2022-09-30.md) | 2,234,541 | 2,433,485 | 198,945 | none | 15,125 | 102 | 633,257 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2007-shiden/2022-08-31.md) | 2,052,181 | 2,234,540 | 182,360 | none | 6,197 | 99 | 632,709 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2007-shiden/2022-07-31.md) | 1,871,723 | 2,052,180 | 180,458 | none | 6,801 | 102 | 556,293 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/2007-shiden/2022-06-30.md) | 1,681,515 | 1,871,722 | 190,208 | none | 6,185 | 108 | 554,344 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/2007-shiden/2022-05-31.md) | 1,506,027 | 1,681,514 | 175,488 | none | 16,590 | 259 | 549,658 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/kusama/2007-shiden/2022-04-30.md) | 1,393,224 | 1,506,026 | 112,803 | none | 31,761 | 426 | 537,814 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/kusama/2007-shiden/2022-03-31.md) | 1,257,181 | 1,393,223 | 136,043 | none | 16,283 | 157 | 120,763 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/kusama/2007-shiden/2022-02-28.md) | 1,129,425 | 1,257,180 | 127,756 | none | 9,896 | 141 | 43,459 | - | 
| [2022-01-01 to 2022-01-31](/substrate-etl/kusama/2007-shiden/2022-01-31.md) | 936,835 | 1,129,424 | 192,590 | none | 18,672 | 245 | 41,991 | - | 
| [2021-12-01 to 2021-12-31](/substrate-etl/kusama/2007-shiden/2021-12-31.md) | 745,467 | 936,834 | 191,368 | none | 15,588 | 186 | 33,830 | - | 
| [2021-11-01 to 2021-11-30](/substrate-etl/kusama/2007-shiden/2021-11-30.md) | 596,952 | 745,466 | 142,086 | 6,429 | 29,780 | 737 | 31,176 | - | 
| [2021-10-01 to 2021-10-31](/substrate-etl/kusama/2007-shiden/2021-10-31.md) | 430,379 | 596,951 | 152,562 | 14,011 | 13,452 | 182 | 26,217 | - | 
| [2021-09-01 to 2021-09-30](/substrate-etl/kusama/2007-shiden/2021-09-30.md) | 255,429 | 430,378 | 174,915 | 35 | 17,923 | 258 | 21,211 | - | 
| [2021-08-01 to 2021-08-31](/substrate-etl/kusama/2007-shiden/2021-08-31.md) | 114,737 | 255,428 | 59,730 | 80,962 | 11,452 | 202 | 15,856 | - | 
| [2021-07-06 to 2021-07-31](/substrate-etl/kusama/2007-shiden/2021-07-31.md) | 1 | 114,736 |  | 114,736 |  |  | 12,144 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2007` group by monthDT order by monthDT desc```

