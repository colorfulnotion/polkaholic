# Equilibrium substrate-etl Summary (Monthly)

_Source_: [equilibrium.polkaholic.io](https://equilibrium.polkaholic.io)

*Relay Chain*: polkadot
*Para ID*: 2011



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-02-01 to 2023-02-13](/substrate-etl/polkadot/2011-equilibrium/2023-02-13.md) | 1,641,356 | 1,726,939 | 85,584 | none  | 840 | 42 | 9,128 | - | 
| [2023-01-01 to 2023-01-31](/substrate-etl/polkadot/2011-equilibrium/2023-01-31.md) | 1,420,268 | 1,641,355 | 221,088 | none  | 1,842 | 36 | 8,979 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/polkadot/2011-equilibrium/2022-12-31.md) | 1,200,017 | 1,420,267 | 220,251 | none  | 1,501 | 31 |  | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/polkadot/2011-equilibrium/2022-11-30.md) | 1,052,777 | 1,200,016 | 147,240 | none  | 1,040 | 27 | 7,491 | - | 
| [2022-10-01 to 2022-10-31](/substrate-etl/polkadot/2011-equilibrium/2022-10-31.md) | 867,209 | 1,052,776 | 185,568 | none  | 1,126 | 36 | 7,532 | - | 
| [2022-09-01 to 2022-09-30](/substrate-etl/polkadot/2011-equilibrium/2022-09-30.md) | 669,640 | 867,208 | 197,569 | none  | 1,299 | 43 | 7,522 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/polkadot/2011-equilibrium/2022-08-31.md) | 463,575 | 669,639 | 206,065 | none  | 1,650 | 52 | 7,362 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/polkadot/2011-equilibrium/2022-07-31.md) | 323,132 | 463,574 | 140,443 | none  | 1,395 | 45 | 7,402 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/polkadot/2011-equilibrium/2022-06-30.md) | 226,944 | 323,131 | 96,188 | none  | 1,429 | 48 | 3,836 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/polkadot/2011-equilibrium/2022-05-31.md) | 132,018 | 226,943 | 94,926 | none  | 1,489 | 48 | 807 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/polkadot/2011-equilibrium/2022-04-30.md) | 38,051 | 132,017 | 93,967 | none  |  |  |  | - | 
| [2022-03-19 to 2022-03-31](/substrate-etl/polkadot/2011-equilibrium/2022-03-31.md) | 1 | 38,050 | 38,050 | none  |  |  |  | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.polkadot.blocks2011` group by monthDT order by monthDT desc```

