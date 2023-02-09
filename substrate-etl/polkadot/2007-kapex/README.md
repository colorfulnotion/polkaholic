# Kapex substrate-etl Summary (Monthly)

_Source_: [kapex.polkaholic.io](https://kapex.polkaholic.io)

*Relay Chain*: polkadot
*Para ID*: 2007
Status: Only partial index available: Onboarding


| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-18](/substrate-etl/polkadot/2007-kapex/2023-01-18.md) | 755,417 | 880,428 | 124,994 | 18 (0.01%) | 23 | 1 |  | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/polkadot/2007-kapex/2022-12-31.md) | 536,184 | 755,416 | 54,848 | 164,385 (74.98%) |  |  | 3 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/polkadot/2007-kapex/2022-11-30.md) | 322,459 | 536,183 | 143,096 | 70,629 (33.05%) |  |  |  | - | 
| [2022-10-26 to 2022-10-31](/substrate-etl/polkadot/2007-kapex/2022-10-31.md) | 285,207 | 322,458 | 37,252 | none  |  |  |  | - | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.polkadot.blocks2007` group by monthDT order by monthDT desc```

