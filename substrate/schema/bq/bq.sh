bq mk --schema=schema/bq/events.json --time_partitioning_field ts --time_partitioning_type DAY   --table polkaholic.events
bq mk --schema=schema/bq/extrinsics.json --time_partitioning_field ts --time_partitioning_type DAY   --table polkaholic.extrinsics
bq mk --schema=schema/bq/transfers.json --time_partitioning_field ts --time_partitioning_type DAY   --table polkaholic.transfers
bq mk --schema=schema/bq/evmtxs.json --time_partitioning_field ts --time_partitioning_type DAY   --table polkaholic.evmtxs
bq mk --schema=schema/bq/rewards.json --time_partitioning_field ts --time_partitioning_type DAY   --table polkaholic.rewards
bq mk --schema=schema/bq/xcm.json --time_partitioning_field ts --time_partitioning_type DAY   --table polkaholic.xcm
