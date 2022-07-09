bq mk --schema=schema/bq/events.json --time_partitioning_field ts --time_partitioning_type DAY   --table $GCPROJECT:$GC_BIGQUERY_DATASET.events
bq mk --schema=schema/bq/extrinsics.json --time_partitioning_field ts --time_partitioning_type DAY   --table $GCPROJECT:$GC_BIGQUERY_DATASET.extrinsics
bq mk --schema=schema/bq/transfers.json --time_partitioning_field ts --time_partitioning_type DAY   --table $GCPROJECT:$GC_BIGQUERY_DATASET.transfers
bq mk --schema=schema/bq/evmtxs.json --time_partitioning_field ts --time_partitioning_type DAY   --table $GCPROJECT:$GC_BIGQUERY_DATASET.evmtxs
bq mk --schema=schema/bq/rewards.json --time_partitioning_field ts --time_partitioning_type DAY   --table $GCPROJECT:$GC_BIGQUERY_DATASET.rewards
bq mk --schema=schema/bq/xcm.json --time_partitioning_field ts --time_partitioning_type DAY   --table $GCPROJECT:$GC_BIGQUERY_DATASET.xcm
