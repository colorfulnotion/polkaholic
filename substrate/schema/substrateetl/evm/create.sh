


bq mk --project_id=substrate-etl  --schema=schema/substrateetl/evm/blocks.json --time_partitioning_field timestamp --time_partitioning_type DAY --table evm.blocks
bq mk --project_id=substrate-etl  --schema=schema/substrateetl/evm/contracts.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table evm.contracts
bq mk --project_id=substrate-etl  --schema=schema/substrateetl/evm/logs.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table evm.logs
bq mk --project_id=substrate-etl  --schema=schema/substrateetl/evm/token_transfers.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table evm.token_transfers
bq mk --project_id=substrate-etl  --schema=schema/substrateetl/evm/tokens.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table evm.tokens
bq mk --project_id=substrate-etl  --schema=schema/substrateetl/evm/traces.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table evm.traces
bq mk --project_id=substrate-etl  --schema=schema/substrateetl/evm/transactions.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table evm.transactions
