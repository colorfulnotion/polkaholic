
// https://docs.sourcify.dev/docs/api/server/verify/
const axios = require("axios");
const fs = require("fs");

async function sourcify_eth(address, rawfiles, evmChainID = 1287) {
  let files = {};
  for ( const fn of rawfiles ) {
      let rawfile = await fs.readFileSync(fn, "utf8")
    if (fn){
      files[fn] = rawfile;
    }
  }
  let data = {
        "address": address,
        "chain": evmChainID,
        "files": files,
        "chosenContract": 1
    }
    console.log(data);
    let headers = {
        "Content-Type": "application/json"
    };
    let endpoint = "https://sourcify.dev/server"
    try {
	let verificationData = await axios.post(endpoint, JSON.stringify(data), {
            headers: headers,
            //timeout: timeoutMS
	})
	console.log("RESULT", verificationData.response);
    } catch (err) {
	console.log("ERR", err.response);
    }
}

async function main() {
  let address = "0x3a7798ca28cfe64c974f8196450e1464f43a0d1e"
  let evmChainID = 1287;
  let files = ["Flipper.sol","metadata3.json"];
  await sourcify_eth(address, files, evmChainID)
}


main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
