#!/usr/bin/env node

const {
    BigQuery
} = require('@google-cloud/bigquery');

async function main() {
    for (let s = 1; s <= 3; s++) {
        for (let test = 1; test <= 2; test++) {
            let key = `/root/.bq_keys/s${s}.json`;
            let bigquery = new BigQuery({
                projectId: 'substrate-etl',
                keyFilename: key
            });
            let sql = "";
            if (test == 1) {
                // Test 1: Row-level security
                // Service Key 1+2+3 will all be able to execute on Test 1 ... but m1 will differ between the 3 service keys:  Service Key 1 will only get data up to 24 hours ago, Key 2 will only get data up to 1 hour ago, Key 3 will get data within the last few minutes -- this is because of (b)'s row-level security applied to block_time
                sql = "select symbol, sum(amount) amount, min(block_time) m0, max(block_time) m1 from substrate-etl.substrate_internal.transfers where symbol = 'DOT' group by symbol order by amount desc limit 1";
            } else {
                // Test 2: Column-level security
                // Service Key 1 will NOT be able to execute this because it cannot access price_usd and amount_usd because of (a)'s column-level security applied to these two columns.
                // Service Key 2 will get a SLIGHTLY SMALLER number for amount_usd_total than Service Key 3 because it is missing the the last hour of transfers
                sql = "select symbol, min(block_time) m0, max(block_time) m0, avg(price_usd) price_usd, sum(amount_usd) amount_usd_total from substrate-etl.substrate_internal.transfers where symbol = 'DOT'  group by symbol order by amount_usd_total desc";
            }
            console.log("TEST", test, "KEY", key, "SQL", sql);
            try {
                const response = await bigquery.createQueryJob({
                    query: sql,
                    location: 'us-central1',
                });
                const job = response[0];
                // run bigquery job with suitable credentials
                const [rows] = await job.getQueryResults();
                console.log(rows);
            } catch (err) {
                console.log(err.errors);
            }
        }
    }
    process.exit(0);
}

main()
    .then(() => {
        // do not process.exit(0) here
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
