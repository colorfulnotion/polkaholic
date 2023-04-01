const {
    BigQuery
} = require('@google-cloud/bigquery');
const bigquery = new BigQuery({
    projectId: 'substrate-etl'
})

async function main() {
    let rows = [{
        insertId: 'kusama-0-2-17284962-1-35',
        json: {
            relay_chain: 'kusama',
            para_id: 0,
            event_id: '2-17284962-1-35',
            extrinsic_hash: '0xa13ca41bd2ddeb9e9a8449756df1ea30986347aa83742aa9b7c89af8bac45603',
            extrinsic_id: '17284962-1',
            block_number: 17284962,
            block_time: 1680308472,
            block_hash: '0xff53e35341cdc673da59d7e95595be7a4bea9b517f5276043c42c7fd26cff7d1',
            section: 'paraInclusion',
            method: 'CandidateBacked',
            data: "[]",
            data_decoded: "[]"
        }
    }]
    try {
        await bigquery
            .dataset("dotsama_dev")
            .table("events")
            .insert(rows, {
                raw: true
            });
        console.log("SUCCESS");
    } catch (err) {
        console.log(err);
        console.log(JSON.stringify(err));
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });