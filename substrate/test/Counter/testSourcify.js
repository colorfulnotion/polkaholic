
// https://docs.sourcify.dev/docs/api/server/verify/
const axios = require("axios");
const fs = require("fs");

async function sourcify_eth(address, rawfiles, evmChainID = 1287)
  let files = {};
  for ( const fn of rawfiles ) {
    let rawfile = await fs.readFileSync(fn)
    files[fn] = rawfile;
  }
  let data = {
        "address": address,
        "chain": evmChainID,
        "files": files,
        "chosenContract": 1
    }

    let headers = {
        "Content-Type": "application/json"
    };
    let endpoint = "https://sourcify.dev/server"
    let verificationData = await axios.post(endpoint, JSON.stringify(data), {
        headers: headers,
          //timeout: timeoutMS
    })
    console.log(verificationData);
}

async function main() {
  let address = "0x20C73f83D980d69a7e290f5beA84d648715962Ed"
  let evmChainID = 1287;
  let files = ["Counter_metadata.json", "Counter.sol"];
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
