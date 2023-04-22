const fs = require("fs");
const { parse } = require("csv-parse");
const paraTool = require("./paraTool");

fs.createReadStream("./user_export.csv")
  .pipe(parse({ delimiter: ",", from_line: 2 }))
    .on("data", function (row) {
	// id,evmAddress,substrateAddress,twitterHandle,username,twitterUrl
	let r = {
	    id: row[0]
	}
	if ( row[1]) 
	    r.evm_address = row[1];
	if ( row[2] ){
	    r.ss58_address = row[2];
	    r.account_pubkey = paraTool.getPubKey(row[2]);
	}
	console.log(JSON.stringify(r));
  })
