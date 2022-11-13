const {
    ApiPromise,
    WsProvider,
    Keyring
} = require("@polkadot/api");
const {
    u8aToHex,
    hexToBn,
    hexToU8a,
} = require('@polkadot/util');
const {
    StorageKey
} = require('@polkadot/types');
const {
    cryptoWaitReady,
    decodeAddress,
    mnemonicToLegacySeed,
    hdEthereum
} = require('@polkadot/util-crypto');
const {
    MultiLocation
} = require('@polkadot/types/interfaces');
const Web3 = require('web3');

class ZombieNetRelayCrawler {
    crawlers = {};

    async processBlockUnfinalizedOrFinalized(finalized, api, resultsOrHeader, chainID) {
        let blockHash = null
        let blockNumber = null
        let blockTS = 0;
        let traces = [];

        // parse the traces
        if (finalized == false) {
            let results = resultsOrHeader;
            blockHash = results.block.toHex();
            console.log("processBlockUnfinalizedOrFinalized unfinalized", chainID, blockHash);
            /*let traceBlock = await api.rpc.state.traceBlock(blockHash, "state", "", "Put");
            if (traceBlock) {
                let traceBlockJSON = traceBlock.toJSON();
                if (traceBlockJSON && traceBlockJSON.blockTrace) {
                    let rawTraces = traceBlockJSON.blockTrace.events.map((e) => {
                        let sv = e.data.stringValues
                        let v = (sv.value == 'None') ? sv.value_encoded : sv.value.replaceAll("Some(", "").replaceAll(")", "");
                        return ({
                            k: sv.key,
                            v: v
                        })
                    });

                    const signedBlock = await api.rpc.chain.getBlock(blockHash);
                    blockNumber = parseInt(signedBlock.block.header.number.toString(), 10);

                    for (const r of rawTraces) {
                        let [x, succ] = this.parse_trace(r, api, blockNumber, chainID, role)
                        if (succ) {
                            traces.push(x);
                            if (x.method == "Now") {
                                blockTS = parseInt(t.pv, 10)
                            }
                        }
                    }
                    //console.log("subscribestorage ***** ", role, blockNumber, blockHash, "numTraces", traces.length) 
                    if (this.parsedTraces[blockNumber] == undefined) {
                        this.parsedTraces[blockNumber] = {}
                    }
                    this.parsedTraces[blockNumber][blockHash] = traces
                } else {
                    console.log("trace block FAILURE", blockHash, traceBlock, chainID, paraID)
                }
            } else {
                console.log("trace block FAIL")
            } */
        } else {
            let header = resultsOrHeader;
            blockNumber = parseInt(header.number.toString(), 10);
            blockHash = header.hash.toString();
            console.log("processBlockUnfinalizedOrFinalized finalized", chainID, blockNumber, blockHash);
            // get traces from cache, if we can
            /*if (this.parsedTraces[blockNumber] != undefined) {
                if (this.parsedTraces[blockNumber][blockHash] != undefined) {
                    traces = this.parsedTraces[blockNumber][blockHash];
                    // delete from the cache 
                }
                delete this.parsedTraces[blockNumber];
            } */
        }

        if (chainID == 0) {
            /*if (traces && traces.length > 0) {
                console.log("relay TRACE", blockHash, blockNumber, finalized, "# traces", traces.length);
                await this.indexRelayChainTrace(api, traces, blockHash, blockNumber, finalized, chainID, relayChain);
            } */
        } else {
            //await this.indexBlock(api, blockHash, blockNumber, finalized, paraID, id, relayChain);
        }
    }

    async processSubscribeStorage(chainID, results) {
        //console.log("processSubscribeStorage", chainID);
        try {
            let api = this.crawlers[chainID].api;
            this.processBlockUnfinalizedOrFinalized(false, api.api, results, chainID);
        } catch (err) {
            console.log(err);
        }
    }


    async processFinalizedHead(chainID, header) {
        //console.log("processFinalized", chainID);
        try {
            let api = this.crawlers[chainID].api;
            this.processBlockUnfinalizedOrFinalized(true, api.api, header, chainID);
        } catch (err) {
            console.log(err);
        }
    }


    async setupAPI(chainID, WSEndpoint) {
        var api = await ApiPromise.create({
            provider: new WsProvider(WSEndpoint)
        });
        await api.isReady;
        console.log("setupAPI", chainID);
        // subscribeStorage returns changes from ALL blockHashes, including the ones that eventually get dropped upon finalization
        api.rpc.state.subscribeStorage(async (results) => {
            await this.processSubscribeStorage(chainID, results)
        })
        // subscribeFinalized returns finalized headers
        api.rpc.chain.subscribeFinalizedHeads(async (header) => {
            await this.processFinalizedHead(chainID, header)
        })
        this.crawlers[chainID] = {
            WSEndpoint,
            chainID,
            api
        }
    }

    async setup(wsEndpoints) {
        for (const chainID of Object.keys(wsEndpoints)) {
            let wsEndpoint = wsEndpoints[chainID];
            console.log("Connecting to chainID", chainID, wsEndpoint);
            await this.setupAPI(chainID, wsEndpoint)
        }
    }
}

async function main() {
    let crawler = new ZombieNetRelayCrawler()
    let wsEndpoints = {
        0: "ws://127.0.0.1:44463",
        2000: "ws://127.0.0.1:41581",
        2007: "ws://127.0.0.1:37077",
    }

    await crawler.setup(wsEndpoints)
}

main()
    .then(() => {
        //process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });