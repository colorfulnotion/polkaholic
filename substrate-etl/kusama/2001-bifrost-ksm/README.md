# Bifrost-Kusama substrate-etl Summary (Monthly)

_Source_: [bifrost-ksm.polkaholic.io](https://bifrost-ksm.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2001



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2001-bifrost-ksm/2023-01-31.md) | 3,225,421 | 3,444,039 | 218,619 | none  | 43,582 | 168 | 101,184 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2001-bifrost-ksm/2022-12-31.md) | 3,014,958 | 3,225,420 | 210,463 | none  | 30,796 | 115 | 100,939 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2001-bifrost-ksm/2022-11-30.md) | 2,804,503 | 3,014,957 | 210,455 | none  | 23,381 | 117 | 100,775 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2001-bifrost-ksm/2022-10-31.md) | 2,587,488 | 2,804,502 | 217,015 | none  | 13,533 | 96 | 100,561 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2001-bifrost-ksm/2022-09-30.md) | 2,387,266 | 2,587,487 | 200,222 | none  | 13,162 | 110 | 100,405 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2001-bifrost-ksm/2022-08-31.md) | 2,204,050 | 2,387,265 | 183,216 | none  | 27,346 | 205 | 100,175 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2001-bifrost-ksm/2022-07-31.md) | 2,023,126 | 2,204,049 | 180,924 | none  | 22,130 | 149 | 99,607 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/2001-bifrost-ksm/2022-06-30.md) | 1,834,935 | 2,023,125 | 188,191 | none  | 22,351 | 159 | 99,396 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/2001-bifrost-ksm/2022-05-31.md) | 1,660,921 | 1,834,934 | 174,014 | none  | 25,973 | 200 | 99,134 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/kusama/2001-bifrost-ksm/2022-04-30.md) | 1,544,029 | 1,660,920 | 116,892 | none  | 23,780 | 170 | 98,761 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/kusama/2001-bifrost-ksm/2022-03-31.md) | 1,413,189 | 1,544,028 | 130,840 | none  | 22,488 | 203 | 98,241 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/kusama/2001-bifrost-ksm/2022-02-28.md) | 1,280,330 | 1,413,188 | 132,859 | none  | 12,760 | 117 | 95,289 | - | 
| [2022-01-01 to 2022-01-31](/substrate-etl/kusama/2001-bifrost-ksm/2022-01-31.md) | 1,066,657 | 1,280,329 | 213,673 | none  | 40,270 | 220 | 95,109 | - | 
| [2021-12-01 to 2021-12-31](/substrate-etl/kusama/2001-bifrost-ksm/2021-12-31.md) | 854,160 | 1,066,656 | 212,497 | none  | 65,997 | 445 | 94,834 | - | 
| [2021-11-01 to 2021-11-30](/substrate-etl/kusama/2001-bifrost-ksm/2021-11-30.md) | 673,631 | 854,159 | 180,529 | none  | 147,150 | 1,551 | 93,407 | - | 
| [2021-10-01 to 2021-10-31](/substrate-etl/kusama/2001-bifrost-ksm/2021-10-31.md) | 480,188 | 673,630 | 193,443 | none  | 35,019 | 707 | 57,560 | - | 
| [2021-09-01 to 2021-09-30](/substrate-etl/kusama/2001-bifrost-ksm/2021-09-30.md) | 274,582 | 480,187 | 205,606 | none  | 11,127 | 77 | 55,959 | - | 
| [2021-08-01 to 2021-08-31](/substrate-etl/kusama/2001-bifrost-ksm/2021-08-31.md) | 74,124 | 274,581 | 200,458 | none  | 1,139 | 3 | 55,215 | - | 
| [2021-07-20 to 2021-07-31](/substrate-etl/kusama/2001-bifrost-ksm/2021-07-31.md) | 1 | 74,123 | 74,123 | none  | 27 | 2 | 51,949 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2001` group by monthDT order by monthDT desc```

