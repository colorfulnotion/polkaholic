# GM Parachain substrate-etl Summary (Monthly)

_Source_: [gm.polkaholic.io](https://gm.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 2123
Status: Only partial index available: Onboarding


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-17](/substrate-etl/kusama/2123-gm/2023-01-17.md) | 740,806 | 827,654 | 83,080 | 3,769 (4.34%) | 300 | 4 | 9,098 | - | 
| [2022-12-31 to 2022-12-31](/substrate-etl/kusama/2123-gm/2022-12-31.md) | 737,233 | 740,805 | 2,503 | 1,070 (29.96%) | 7 | 2 |  | - | 
| [2022-11-01 to 2022-11-18](/substrate-etl/kusama/2123-gm/2022-11-18.md) | 419,791 | 514,562 | 94,772 |  **BROKEN**  | 2,350 | 12 |  | - | 
| [2022-10-26 to 2022-10-31](/substrate-etl/kusama/2123-gm/2022-10-31.md) | 392,561 | 419,790 | 27,112 | 118 (0.43%) | 671 | 14 |  | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks2123` group by monthDT order by monthDT desc```

