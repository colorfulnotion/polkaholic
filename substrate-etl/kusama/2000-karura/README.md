# Karura substrate-etl Summary (Monthly)

_Source_: [karura.polkaholic.io](https://karura.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2000



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-02-01 to 2023-02-13](/substrate-etl/kusama/2000-karura/2023-02-13.md) | 3,607,765 | 3,692,653 | 84,889 | none  | 21,072 | 181 | 94,934 | - | 
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2000-karura/2023-01-31.md) | 3,389,850 | 3,607,764 | 217,915 | none  | 51,356 | 164 | 94,704 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2000-karura/2022-12-31.md) | 3,179,458 | 3,389,849 | 210,392 | none  | 40,476 | 151 | 94,197 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2000-karura/2022-11-30.md) | 2,969,258 | 3,179,457 | 210,200 | none  | 68,151 | 200 | 93,716 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2000-karura/2022-10-31.md) | 2,752,934 | 2,969,257 | 216,324 | none  | 56,987 | 198 | 92,737 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2000-karura/2022-09-30.md) | 2,554,061 | 2,752,933 | 198,873 | none  | 55,398 | 194 | 92,017 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2000-karura/2022-08-31.md) | 2,372,225 | 2,554,060 | 181,836 | none  | 78,793 | 340 | 91,546 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2000-karura/2022-07-31.md) | 2,191,498 | 2,372,224 | 180,727 | none  | 67,402 | 318 | 90,538 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/2000-karura/2022-06-30.md) | 2,001,860 | 2,191,497 | 189,638 | none  | 93,487 | 528 | 89,296 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/2000-karura/2022-05-31.md) | 1,826,040 | 2,001,859 | 175,820 | none  | 97,311 | 451 | 89,097 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/kusama/2000-karura/2022-04-30.md) | 1,708,908 | 1,826,039 | 117,132 | none  | 83,474 | 441 | 88,349 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/kusama/2000-karura/2022-03-31.md) | 1,573,195 | 1,708,907 | 135,713 | none  | 112,247 | 635 | 88,208 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/kusama/2000-karura/2022-02-28.md) | 1,438,238 | 1,573,194 | 134,957 | none  | 64,507 | 352 | 78,235 | - | 
| [2022-01-01 to 2022-01-31](/substrate-etl/kusama/2000-karura/2022-01-31.md) | 1,223,751 | 1,438,237 | 214,487 | none  | 69,908 | 346 | 77,495 | - | 
| [2021-12-01 to 2021-12-31](/substrate-etl/kusama/2000-karura/2021-12-31.md) | 1,025,217 | 1,223,750 | 198,534 | none  | 66,143 | 329 | 69,235 | - | 
| [2021-11-01 to 2021-11-30](/substrate-etl/kusama/2000-karura/2021-11-30.md) | 857,478 | 1,025,216 | 167,739 | none  | 81,005 | 457 | 68,244 | - | 
| [2021-10-01 to 2021-10-31](/substrate-etl/kusama/2000-karura/2021-10-31.md) | 657,328 | 857,477 | 200,150 | none  | 94,656 | 582 | 67,187 | - | 
| [2021-09-01 to 2021-09-30](/substrate-etl/kusama/2000-karura/2021-09-30.md) | 448,090 | 657,327 | 209,238 | none  | 110,591 | 637 | 65,409 | - | 
| [2021-08-01 to 2021-08-31](/substrate-etl/kusama/2000-karura/2021-08-31.md) | 242,391 | 448,089 | 205,699 | none  | 122,340 | 830 | 63,306 | - | 
| [2021-07-01 to 2021-07-31](/substrate-etl/kusama/2000-karura/2021-07-31.md) | 53,371 | 242,390 | 189,020 | none  | 51,477 | 1,055 |  | - | 
| [2021-06-22 to 2021-06-30](/substrate-etl/kusama/2000-karura/2021-06-30.md) | 1 | 53,370 | 53,370 | none  | 95 | 5 | 39,691 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2000` group by monthDT order by monthDT desc```

