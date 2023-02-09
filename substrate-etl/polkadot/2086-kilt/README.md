# KILT Spiritnet substrate-etl Summary (Monthly)

_Source_: [kilt.polkaholic.io](https://kilt.polkaholic.io)

*Relay Chain*: polkadot
*Para ID*: 2086



| Month | Start Block | End Block | # Blocks | # Missing | # Signed Extrinsics (total) | # Active Accounts (avg) | # Addresses with Balances (max) | Issues |
| ----- | ----------- | --------- | -------- | --------- | --------------------------- | ----------------------- | ------------------------------- | ------ |
| [2023-01-01 to 2023-01-31](/substrate-etl/polkadot/2086-kilt/2023-01-31.md) | 2,843,795 | 3,064,118 | 220,324 | none  | 5,940 | 98 | 17,920 | - | 
| [2022-12-01 to 2022-12-31](/substrate-etl/polkadot/2086-kilt/2022-12-31.md) | 2,626,142 | 2,843,794 | 217,653 | none  | 4,597 | 78 | 17,633 | - | 
| [2022-11-01 to 2022-11-30](/substrate-etl/polkadot/2086-kilt/2022-11-30.md) | 2,418,359 | 2,626,141 | 207,783 | none  | 4,745 | 79 | 17,353 | - | 
| [2022-10-03 to 2022-10-31](/substrate-etl/polkadot/2086-kilt/2022-10-31.md) | 2,241,757 | 2,418,358 | 176,602 | none  | 3,764 | 73 | 16,730 | - | 
| [2022-09-01 to 2022-09-29](/substrate-etl/polkadot/2086-kilt/2022-09-29.md) | 2,056,210 | 2,241,756 | 185,547 | none  | 3,702 | 76 | 16,522 | - | 
| [2022-08-01 to 2022-08-31](/substrate-etl/polkadot/2086-kilt/2022-08-31.md) | 1,874,058 | 2,056,209 | 182,152 | none  | 5,118 | 94 | 16,411 | - | 
| [2022-07-01 to 2022-07-31](/substrate-etl/polkadot/2086-kilt/2022-07-31.md) | 1,693,802 | 1,874,057 | 180,256 | none  | 8,823 | 100 | 16,097 | - | 
| [2022-06-01 to 2022-06-30](/substrate-etl/polkadot/2086-kilt/2022-06-30.md) | 1,508,183 | 1,693,801 | 185,619 | none  | 4,348 | 83 | 15,231 | - | 
| [2022-05-01 to 2022-05-31](/substrate-etl/polkadot/2086-kilt/2022-05-31.md) | 1,336,138 | 1,508,182 | 172,045 | none  | 9,721 | 128 | 15,037 | - | 
| [2022-04-01 to 2022-04-30](/substrate-etl/polkadot/2086-kilt/2022-04-30.md) | 1,219,375 | 1,336,137 | 116,763 | none  | 36,593 | 142 | 14,474 | - | 
| [2022-03-01 to 2022-03-31](/substrate-etl/polkadot/2086-kilt/2022-03-31.md) | 1,085,353 | 1,219,374 | 134,022 | none  | 8,052 | 124 | 13,421 | - | 
| [2022-02-01 to 2022-02-28](/substrate-etl/polkadot/2086-kilt/2022-02-28.md) | 950,499 | 1,085,352 | 134,854 | none  | 6,572 | 118 | 12,553 | - | 
| [2022-01-01 to 2022-01-31](/substrate-etl/polkadot/2086-kilt/2022-01-31.md) | 734,569 | 950,498 | 215,930 | none  | 11,386 | 161 | 12,281 | - | 
| [2021-12-01 to 2021-12-31](/substrate-etl/polkadot/2086-kilt/2021-12-31.md) | 520,151 | 734,568 | 214,418 | none  | 14,201 | 193 | 11,669 | - | 
| [2021-11-01 to 2021-11-30](/substrate-etl/polkadot/2086-kilt/2021-11-30.md) | 331,943 | 520,150 | 188,208 | none  | 9,311 | 119 | 10,423 | - | 
| [2021-10-01 to 2021-10-31](/substrate-etl/polkadot/2086-kilt/2021-10-31.md) | 130,782 | 331,942 | 200,846 | 315 (0.16%) | 513 | 11 | 320 | Decoding failures | 
| [2021-09-08 to 2021-09-30](/substrate-etl/polkadot/2086-kilt/2021-09-30.md) | 1 | 130,781 | 130,542 | 239 (0.18%) | 106 | 2 |  | Decoding failures | 

## # Blocks
```
SELECT LAST_DAY( date(block_time)) as monthDT, Min(date(block_time)) startBN, max(date(block_time)) endBN, min(number) minBN, max(number) maxBN, count(*) numBlocks, max(number)-min(number)+1-count(*) as numBlocks_missing FROM `substrate-etl.polkadot.blocks2086` group by monthDT order by monthDT desc```

