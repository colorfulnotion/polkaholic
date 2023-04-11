	    } else if (false) {
	        let schema = tables[tableId];
	        let r = {
	            id,
	            para_id,
	            relay_chain,
	            extrinsic_id,
	            extrinsic_hash,
	            signer_ss58,
	            signer_pub_key,
	            call_id,
	            call_section,
	            call_method,
	            block_time
	        };
	        let a = JSON.parse(c.call_args);
	        for (const k of Object.keys(schema)) {
	            if (a[k] && r[k] == undefined) {
	                let bq_type = schema[k];
	                switch (bq_type) {
	                    case 'JSON':
	                        r[k] = JSON.stringify(a[k]);
	                        break;
	                    case 'FLOAT64':
	                        r[k] = a[k];
	                        break;
	                    case 'STRING':
	                        r[k] = a[k];
	                        break;
	                    case 'BOOL':
	                        r[k] = a[k];
	                        break;
	                    case 'INT64':
	                        r[k] = a[k];
	                        break;
	                    default:
	                        console.log("UNK", k, bq_type);
	                }
	            } else {
	                // _usd, _raw, ...
	            }
	        }
	        try {
	            // insert single row into tableId 
	            let rows = [];
	            rows.push({
	                insertId: `${extrinsic_id}-${call_id}`,
	                json: r
	            });
	            console.log("WRITE", tableId);
	            await bigquery
	                .dataset(datasetId)
	                .table(tableId)
	                .insert(rows, {
	                    raw: true
	                });
	        } catch (err) {
	            console.log(JSON.stringify(err));
	        }
	    }