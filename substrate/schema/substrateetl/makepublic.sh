# to expose BQ datasets publicly
bq show --format=prettyjson us-west1-wlk:polkadot > polkadot.json
bq show --format=prettyjson us-west1-wlk:kusama > kusama.json
# manually adjust the above files with "allAuthenticatedUsers", and then:
bq update --source polkadot.json us-west1-wlk:polkadot
bq update --source kusama.json us-west1-wlk:kusama
