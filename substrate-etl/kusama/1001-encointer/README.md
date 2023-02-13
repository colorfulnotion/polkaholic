# Encointer substrate-etl Summary (Monthly)

_Source_: [encointer.polkaholic.io](https://encointer.polkaholic.io)

*Relay Chain*: kusama
*Para ID*: 1001
Status: Only partially indexed: Old decoding errors


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-02-01 to 2023-02-13](/substrate-etl/kusama/1001-encointer/2023-02-13.md) | 2,190,832 | 2,275,634 | 84,580 | 223 (0.26%) | 24 | 1 | 938 | - | 
| [2023-01-01 to 2023-01-31](/substrate-etl/kusama/1001-encointer/2023-01-31.md) | 1,972,773 | 2,190,831 | 217,517 | 542 (0.25%) | 2 |  | 900 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/kusama/1001-encointer/2022-12-31.md) | 1,791,307 | 1,972,772 | 180,844 | 622 (0.34%) | 5 |  | 863 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/kusama/1001-encointer/2022-11-30.md) | 1,580,907 | 1,791,306 | 209,719 | 681 (0.32%) | 73 | 1 | 825 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/kusama/1001-encointer/2022-10-31.md) | 1,364,286 | 1,580,906 | 216,221 | 400 (0.18%) | 126 | 1 | 721 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/kusama/1001-encointer/2022-09-30.md) | 1,164,726 | 1,364,285 | 199,111 | 449 (0.22%) | 65 | 1 | 651 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/kusama/1001-encointer/2022-08-31.md) | 996,274 | 1,164,725 | 168,205 | 247 (0.15%) | 88 | 1 | 528 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/kusama/1001-encointer/2022-07-31.md) | 842,430 | 996,273 | 153,570 | 274 (0.18%) | 132 | 1 | 511 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/kusama/1001-encointer/2022-06-30.md) | 682,655 | 842,429 | 158,473 | 1,302 (0.81%) | 82 | 1 | 469 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/kusama/1001-encointer/2022-05-31.md) | 518,228 | 682,654 | 164,032 | 395 (0.24%) | 88 | 1 | 105 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/kusama/1001-encointer/2022-04-30.md) | 405,493 | 518,227 | 112,735 | none  | 49 | 1 | 17 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/kusama/1001-encointer/2022-03-31.md) | 293,071 | 405,492 | 112,422 | none  | 16 |  | 7 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/kusama/1001-encointer/2022-02-28.md) | 156,173 | 293,070 | 136,898 | none  | 1 |  | 3 | - | 
| [2022-01-09 to 2022-01-31](/substrate-etl/kusama/1001-encointer/2022-01-31.md) | 1 | 156,172 | 156,172 | none  |  |  | 1 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.kusama.blocks1001` group by monthDT order by monthDT desc```

