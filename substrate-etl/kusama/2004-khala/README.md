# Khala substrate-etl Summary (Monthly)

_Source_: [khala.polkaholic.io](https://khala.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2004
Status: Only partial index available.


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2004-khala/2023-01-31.md) | 3,021,555 | 3,224,779 | 203,225 | none | 4,363,437 | 1,406 | 23,240 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2004-khala/2022-12-31.md) | 2,822,145 | 3,021,554 | 198,885 | 525 | 3,081,769 | 1,534 | 22,893 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2004-khala/2022-11-30.md) | 2,627,833 | 2,822,144 | 194,307 | 5 | 3,913,797 | 1,954 | 19,611 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2004-khala/2022-10-31.md) | 2,426,072 | 2,627,832 | 201,754 | 7 | 4,080,004 | 1,890 | 18,546 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2004-khala/2022-09-30.md) | 2,242,788 | 2,426,071 | 183,282 | 2 | 3,676,744 | 1,699 | 17,683 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2004-khala/2022-08-31.md) | 2,067,816 | 2,242,787 | 174,972 | none | 3,514,891 | 1,722 | 17,257 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2004-khala/2022-07-31.md) | 1,893,934 | 2,067,815 | 173,882 | none | 3,533,401 | 2,097 | 17,299 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/2004-khala/2022-06-30.md) | 1,713,500 | 1,893,933 | 180,434 | none | 3,648,150 | 2,279 | 16,813 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/2004-khala/2022-05-31.md) | 1,546,024 | 1,713,499 | 167,476 | none | 3,318,867 | 2,028 | 15,917 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/kusama/2004-khala/2022-04-30.md) | 1,440,156 | 1,546,023 | 105,868 | none | 1,819,275 | 1,102 | 14,797 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/kusama/2004-khala/2022-03-31.md) | 1,320,455 | 1,440,155 | 119,701 | none | 1,706,949 | 781 | 13,765 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/kusama/2004-khala/2022-02-28.md) | 1,197,043 | 1,320,454 | 112,318 | 11,094 | 1,399,984 | 839 | 13,715 | - | 
| [2022-01-09 to 2022-01-31](/substrate-etl/kusama/2004-khala/2022-01-31.md) | 1,054,436 | 1,197,042 | 92,470 | 50,137 | 1,388,537 | 986 | 13,669 | - | 
| [2021-12-17 to 2021-12-31](/substrate-etl/kusama/2004-khala/2021-12-31.md) | 909,212 | 1,003,114 | 24,789 | 69,114 | 343,018 | 839 | 13,764 | - | 
| [2021-11-29 to 2021-11-30](/substrate-etl/kusama/2004-khala/2021-11-30.md) | 814,183 | 818,137 | 2 | 3,953 |  |  | 13,550 | - | 
| [2021-09-02 to 2021-09-18](/substrate-etl/kusama/2004-khala/2021-09-18.md) | 310,830 | 417,426 | 35 | 106,562 | 2 |  | 6,451 | - | 
| [2021-08-25 to 2021-08-31](/substrate-etl/kusama/2004-khala/2021-08-31.md) | 257,527 | 303,066 | 21 | 45,519 |  |  | 3,198 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2004` group by monthDT order by monthDT desc```

