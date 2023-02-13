# Phala substrate-etl Summary (Monthly)

_Source_: [phala.polkaholic.io](https://phala.polkaholic.io)

*Relay Chain*: polkadot
*Para ID*: 2035



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-02-01 to 2023-02-13](/substrate-etl/polkadot/2035-phala/2023-02-13.md) | 1,809,602 | 1,895,247 | 85,558 | 88 (0.10%) | 267 | 15 | 3,048 | - | 
| [2023-01-01 to 2023-01-31](/substrate-etl/polkadot/2035-phala/2023-01-31.md) | 1,587,962 | 1,809,601 | 221,640 | none  | 616 | 13 | 3,021 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/polkadot/2035-phala/2022-12-31.md) | 1,367,180 | 1,587,961 | 220,782 | none  | 502 | 11 | 2,979 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/polkadot/2035-phala/2022-11-30.md) | 1,153,086 | 1,367,179 | 214,094 | none  | 812 | 16 | 2,925 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/polkadot/2035-phala/2022-10-31.md) | 932,129 | 1,153,085 | 220,957 | none  | 1,297 | 22 | 2,791 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/polkadot/2035-phala/2022-09-30.md) | 721,408 | 932,128 | 210,721 | none  | 576 | 13 | 2,630 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/polkadot/2035-phala/2022-08-31.md) | 505,584 | 721,407 | 215,824 | none  | 395 | 9 | 2,563 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/polkadot/2035-phala/2022-07-31.md) | 293,542 | 505,583 | 212,042 | none  | 325 | 8 | 2,507 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/polkadot/2035-phala/2022-06-30.md) | 92,105 | 293,541 | 201,437 | none  | 284 | 4 | 2,466 | - | 
| [2022-05-31 to 2022-05-31](/substrate-etl/polkadot/2035-phala/2022-05-31.md) | 90,052 | 92,104 | 2,053 | none  |  |  | 5 | - | 
| [2022-04-01 to 2022-04-15](/substrate-etl/polkadot/2035-phala/2022-04-15.md) | 1 | 90,051 | 90,051 | none  |  |  | 5 | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.polkadot.blocks2035` group by monthDT order by monthDT desc```

