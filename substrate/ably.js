const Ably = require('ably');

async function insertRowsAsStream(rows) {
    // Inserts the JSON objects into my_dataset:my_table.
    const {
        BigQuery
    } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery({
        projectId: 'substrate-etl'
    });

    // Insert data into a table
    try {
        await bigquery
            .dataset("polkadot")
            .table("xcmtransferslog")
            .insert(rows);
        console.log(`Inserted ${rows.length} rows`);
    } catch (err) {
        console.log(err);
    }
}

class AblyXCMIndexer {
    ably_client = null;
    ably_channel = null;

    async setup_ably_client() {
        this.ably_client = new Ably.Realtime("DTaENA.R5SR9Q:MwHuRIr84rCik0WzUqp3SVZ9ZKmKCxXc9ytypJXnYgc");
        await this.ably_client.connection.once('connected');
        this.ably_channel = this.ably_client.channels.get("xcm-indexer");
        this.ably_channel.subscribe(function(message) {
            console.log('setup_ably_client Received msg: ', message);
        });
        console.log("setup_ably_client")
    }

    publish_ably_message(msg) {
        if (this.ably_client && this.ably_channel) {
            this.ably_channel.publish("xcm-indexer", msg);
            console.log("published:", msg);
        }
    }

    async sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

async function main() {

    let rows = [{
        symbol: "DOT",
        origination_ts: 1674410916,
        origination_extrinsic_hash: "0x061cb81fecdac97f091cf9617c01aaea04d9f033d79fda0267a8c87299f94ed5",
        origination_xcm_index: 0,
        //origination_transfer_index: 0,
        origination_id: 2034,
        destination_id: 0,
        xcm_info: {
            symbol: "DOT",
            origination: {
                ts: 1674410916,
                id: 2034,
            },
            destination: {
                id: 0
            }
        }
    }];
    await insertRowsAsStream(rows);

    process.exit(0);
    let xcmindexer = new AblyXCMIndexer();
    await xcmindexer.setup_ably_client();
    let cnt = 0;
    while (true) {
        await xcmindexer.sleep(2000);
        xcmindexer.publish_ably_message({
            a: 1,
            b: 2,
            cnt
        });
        cnt++;
    }
}

main()
    .then(() => {

    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });