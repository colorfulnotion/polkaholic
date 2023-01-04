# to expose BQ datasets publicly
bq show --format=prettyjson substrate-etl:polkadot > polkadot.json
bq show --format=prettyjson substrate-etl:kusama > kusama.json
# manually adjust the above files with "allAuthenticatedUsers", and then:
bq update --source polkadot.json substrate-etl:polkadot
bq update --source kusama.json substrate-etl:kusama
