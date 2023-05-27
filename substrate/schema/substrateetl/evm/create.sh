


bq mk --location=us --project_id=substrate-etl  --schema=blocks.json --time_partitioning_field timestamp --time_partitioning_type DAY --table crypto_astar.blocks
bq mk --location=us --project_id=substrate-etl  --schema=contracts.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table crypto_astar.contracts
bq mk --location=us --project_id=substrate-etl  --schema=logs.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table crypto_astar.logs
bq mk --location=us --project_id=substrate-etl  --schema=token_transfers.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table crypto_astar.token_transfers
bq mk --location=us --project_id=substrate-etl  --schema=tokens.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table crypto_astar.tokens
bq mk --location=us --project_id=substrate-etl  --schema=traces.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table crypto_astar.traces
bq mk --location=us --project_id=substrate-etl  --schema=transactions.json --time_partitioning_field block_timestamp --time_partitioning_type DAY --table crypto_astar.transactions
