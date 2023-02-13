# Turing substrate-etl Summary (Monthly)

_Source_: [turing.polkaholic.io](https://turing.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2114



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-02-01 to 2023-02-13](/substrate-etl/kusama/2114-turing/2023-02-13.md) | 1,865,173 | 1,949,451 | 84,279 | none  | 828 | 53 | 7,573 | - | 
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/2114-turing/2023-01-31.md) | 1,648,489 | 1,865,172 | 216,684 | none  | 11,432 | 209 | 7,476 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/2114-turing/2022-12-31.md) | 1,440,187 | 1,648,488 | 208,302 | none  | 3,717 | 47 | 1,716 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/2114-turing/2022-11-30.md) | 1,239,418 | 1,440,186 | 200,769 | none  | 1,747 | 42 | 1,694 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/2114-turing/2022-10-31.md) | 1,024,223 | 1,239,417 | 215,195 | none  | 2,072 | 48 | 1,671 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/2114-turing/2022-09-30.md) | 825,217 | 1,024,222 | 199,006 | none  | 2,965 | 57 | 1,640 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/2114-turing/2022-08-31.md) | 643,580 | 825,216 | 181,637 | none  | 4,436 | 64 | 1,567 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/2114-turing/2022-07-31.md) | 463,738 | 643,579 | 179,842 | none  | 1,858 | 40 | 1,516 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/2114-turing/2022-06-30.md) | 277,932 | 463,737 | 185,806 | none  | 1,348 | 23 | 1,471 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/2114-turing/2022-05-31.md) | 103,439 | 277,931 | 174,493 | none  | 1,564 | 2 | 1,435 | - | 
| [2022-04-03 to 2022-04-30](/substrate-etl/kusama/2114-turing/2022-04-30.md) | 1 | 103,438 | 103,438 | none  | 27 |  | 20 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2114` group by monthDT order by monthDT desc```

