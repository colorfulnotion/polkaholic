// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic.

// Polkaholic is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Polkaholic is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Polkaholic.  If not, see <http://www.gnu.org/licenses/>.

// Indexes Substrate Chains with WSS and JSON RPC using
//  BigTable chain${chainID}
//   row.id is the HEX of the blockNumber
//   columns: (all cells with timestamp of the block)
//      blockraw:raw/blockHash -- block object holding extrinsics + events
//      trace:raw/blockHash -- array of k/v, deduped
//      finalized:blockHash
//  Mysql    block${chainID})
//      blockNumber (primary key)
//      lastTraceDT -- updated on storage
//      blockDT   -- updated on finalized head
//      blockHash -- updated on finalized head
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const ethTool = require("./ethTool");
const Endpoints = require("./summary/endpoints");
const fs = require('fs');
const path = require("path");
const {
    bnToHex,
    hexToBn,
    hexToU8a,
    isHex,
    stringToU8a,
    u8aToHex,
    hexToString
} = require("@polkadot/util");
const {
    xxhashAsHex,
    blake2AsHex,
    blake2AsU8a
} = require('@polkadot/util-crypto');
const {
    XXHash32,
    XXHash64,
    XXHash3,
    XXHash128
} = require('xxhash-addon');
const {
    Keyring,
    decodeAddress,
    encodeAddress
} = require("@polkadot/keyring");
const {
    StorageKey
} = require('@polkadot/types');


const mysql = require("mysql2");
const Indexer = require("./indexer");
const paraTool = require("./paraTool");
const Ably = require('ably');

const maxTraceAttempts = 10;
const minCrawlTracesToActivateRPCBackfill = 1;

module.exports = class Crawler extends Indexer {
    latestBlockNumber = 0;
    finalizedHashes = {};
    lastmarkedTS = 0;
    lastmarkedlogDT = '2019-01-01';
    coveredtx = {};

    constructor() {
        super("crawler")
    }

    checkAPIStatus(self, chainID, maxDisconnectedCnt) {
        let connected = self.getConnected()
        let disconnectedCnt = self.getDisconnectedCnt()
        // If the condition below is true the timer finishes
        let apiInitStatus = 'pending'
        if (disconnectedCnt >= maxDisconnectedCnt) {
            console.log(`${chainID} checkAPIStatus MaxDisconnectedCnt(${maxDisconnectedCnt}) reached`)
            apiInitStatus = 'terminate'
        }
        if (connected) {
            console.log(`${chainID} checkAPIStatus connected!`)
            apiInitStatus = 'done'
        }
        return apiInitStatus
    }

    waitMaxAPIRetry(callback, self, chainID, maxDisconnectedCnt) {
        let checkIntervalMS = 500
        let maxInteration = 30
        return new Promise((_, reject) => {
            let iteration = 0;
            const interval = setInterval(async () => {
                let apiInitStatus = await callback(self, chainID, maxDisconnectedCnt, interval)
                if (apiInitStatus == 'terminate') {
                    //console.log(`waitInterval`, callback)
                    clearInterval(interval);
                    //setTimeout(() => reject(new Error(`TERMINATING ${chainID} checkAPIStatus maxDisconnectedCnt reached!!!`)), 10);
                    return reject(new Error(`TERMINATING ${chainID} checkAPIStatus maxDisconnectedCnt reached!!!`))
                } else if (apiInitStatus == "done") {
                    clearInterval(interval);
                }
                if (iteration >= maxInteration) {
                    clearInterval(interval);
                }
                iteration++;
            }, checkIntervalMS);
        });
    }

    wait(maxTimeMS) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`TIMEOUT in ${maxTimeMS/1000}s`)), maxTimeMS);
        });
    }

    async validateApi() {
        //TODO
        if (this.debugLevel > paraTool.debugVerbose) console.log(`[chainID=${this.chainID}], connected=${this.getConnected()}, exitOnDisconnect=${this.getExitOnDisconnect()}`)
    }

    async setupParaCrawlerChainAndAPI(chainID, withSpecVersions = true, backfill = false) {
        let maxTimeMS = 30000
        let maxDisconnectedCnt = 3

        let chain = await this.getChain(chainID, withSpecVersions);
        let resolve = this.setupAPI(chain, backfill);
        this.isRelayChain = paraTool.isRelayChain(chainID)
        this.relayChain = chain.relayChain;

        //race: {maxTimeMS reached, maxDisconnectedCnt reached, successfully initiated} whichever comes first
        try {
            await Promise.race([this.wait(maxTimeMS), resolve, this.waitMaxAPIRetry(this.checkAPIStatus, this, chainID, maxDisconnectedCnt)]);
        } catch (err) {
            if (this.debugLevel > paraTool.debugInfo) console.log(`race error cauth`, err);
        }

        let resolve2 = this.validateApi();
        await new Promise((resolve2, reject) => {
            setTimeout(() => {
                if (this.getConnected()) {
                    resolve2();
                } else {
                    return reject(new Error(`${chainID} setupChainAndAPI Errored`));
                }
            }, 10);
        });
        return (chain);
    }

    async setupChainAndAPI(chainID, withSpecVersions = true, backfill = false) {
        let chain = await this.getChain(chainID, withSpecVersions);
        await this.setupAPI(chain, backfill);
        this.isRelayChain = paraTool.isRelayChain(chainID)
        this.relayChain = chain.relayChain;
        return (chain);
    }

    async crawlTrace(chain, blockHash, timeoutMS = 20000) {
        try {
            let headers = {
                "Content-Type": "application/json"
            };
            const data = {
                "id": 1,
                "jsonrpc": "2.0",
                "method": "state_traceBlock",
                "params": [blockHash, "state", "", "Put"]
            }
            if (chain.onfinalityStatus == "Active" && chain.onfinalityID && chain.onfinalityID.length > 32 && this.APIWSEndpoint.includes("onfinality")) {
                chain.RPCBackfill = `https://${chain.id}.api.onfinality.io/rpc?apikey=${chain.onfinalityID}`
                console.log("BACKFILL", chain.RPCBackfill);
            }
            if (!chain.RPCBackfill || chain.RPCBackfill.length == 0) {
                console.log("CANNOT GET TRACE -- no backfill", chain.RPCBackfill);
                return (false);
            }
            let cmd = `curl --silent -H "Content-Type: application/json" --max-time 1800 --connect-timeout 60 -d '{"id":1,"jsonrpc":"2.0","method":"state_traceBlock","params":["${blockHash}","state","","Put"]}' "${chain.RPCBackfill}"`
            const {
                stdout,
                stderr
            } = await exec(cmd, {
                maxBuffer: 1024 * 64000
            });
            let traceData = JSON.parse(stdout);
            if ((!traceData) || (!traceData.result) || (!traceData.result.blockTrace)) {
                console.log("NO data", traceData);
                return false;
            }

            let eventsRaw = traceData.result.blockTrace.events;
            if (!eventsRaw || eventsRaw.length == 0) {
                console.log("eventsRaw empty");
                return [];
            }
            let events = [];
            eventsRaw.forEach((e) => {
                let sv = this.canonicalize_trace_stringValues(e.data.stringValues);
                if (sv) {
                    events.push(sv);
                }
            });
            return (events);
        } catch (error) {
            console.log(error);
            this.logger.warn({
                "op": "crawlTrace",
                "err": error
            })
        }
        return false;
    }

    canonicalize_trace_stringValues(x) {
        let k = "0x" + x.key;
        let v = "";
        if (x.value) {
            let value = x.value
            if (value.includes("Some(")) {
                v = "01" + value.replace("Some(", "").replace(")", "")
            } else if (x.value == "None") {
                v = "00";
            }
            return {
                k,
                v: "0x" + v
            }
        }
        return null;
    }

    async crawlEvmTrace(chain, blockNumber, timeoutMS = 20000) {
        return false;
        if (!chain.RPCBackfill) {
            return (false);
        }
        if (chain.RPCBackfill.length == 0) {
            return (false);
        }
        let hexBlocknumber = paraTool.blockNumberToHex(blockNumber);
        let cmd = `curl ${chain.evmRPCInternal}  -X POST -H "Content-Type: application/json" --data '{"method":"debug_traceBlockByNumber","params":["${hexBlocknumber}", {"tracer": "callTracer"}],"id":1,"jsonrpc":"2.0"}'`
        try {
            const {
                stdout,
                stderr
            } = await exec(cmd, {
                maxBuffer: 1024 * 64000
            });
            let traceData = JSON.parse(stdout);
            if (traceData.result) {
                console.log(blockNumber, traceData.result.length, cmd);
                return (traceData.result);
            }
            //console.log(cmd);
            return (null);
        } catch (error) {
            this.logger.warn({
                "op": "crawlEvmTrace",
                "cmd": cmd,
                "err": error
            })
            console.log(error);
        }
        return false;
    }

    async updateERC20TokenSupply(chain, limitSeconds = 300) {
        let bn = chain.blocksFinalized;
        await this.setupAPI(chain);
        let startTS = this.getCurrentTS();

        let sql = `select asset, decimals, symbol, totalSupply from asset where assetType = 'ERC20' and chainID = '${chain.chainID}' and lastCrawlBN < lastUpdateBN order by numHolders desc`;
        let assets = await this.poolREADONLY.query(sql);
        for (const a of assets) {
            if (this.getCurrentTS() - startTS > limitSeconds) {
                await this.update_batchedSQL();
                return;
            }

            let [tokenSupply, _] = await ethTool.getTokenTotalSupply(this.web3Api, a.asset, bn, a.decimals);
            if ((tokenSupply !== false && a.symbol != '') || tokenSupply) {
                console.log(`#${chain.chainID} [${a.asset}] ${tokenSupply} ${a.symbol} seconds=`, this.getCurrentTS() - startTS, limitSeconds)
                let sql = `update asset set totalSupply = '${tokenSupply}', lastCrawlBN = '${bn}' where asset = '${a.asset}' and chainID = '${chain.chainID}'`
                this.batchedSQL.push(sql);
                if (this.batchedSQL.length > 10) {
                    await this.update_batchedSQL();
                }
            } else {
                console.log(`**#${chain.chainID} [${a.asset}] NO tokenSupply = ${tokenSupply} ${a.symbol} (prev:${a.totalSupply})`)
            }
        }
        await this.update_batchedSQL();
    }

    // crawl_block_trace (used by crawlBackfill) fetches a block using { blockNumber, attempted, crawlTrace } saves in BT with save_block_trace [which updates block${chainID} table]  It does NOT index the block
    async crawl_block_trace(chain, t) {

        try {
            let bn = parseInt(t.blockNumber, 10)
            let header = await this.api.rpc.chain.getBlockHash(bn);
            let blockHash = header.toHex();

            console.log("crawl_block_trace", bn, header.toHex());
            // 1. get the block, ALWAYS
            let [signedBlock, events] = await this.crawlBlock(this.api, blockHash);

            let blockTS = signedBlock.blockTS;
            // 1.a get evmBlock, if web3Api is set
            let evmBlock = false
            let evmReceipts = false
            let evmTrace = false
            let crawlBlockEVM = parseInt(t.crawlBlockEVM, 10) > 0;
            let crawlReceiptsEVM = parseInt(t.crawlReceiptsEVM, 10) > 0;
            let crawlTraceEVM = parseInt(t.crawlTraceEVM, 10) > 0;
            if (this.web3Api) {
                if (crawlBlockEVM) {
                    evmBlock = await ethTool.crawlEvmBlock(this.web3Api, bn)
                }
                if (crawlReceiptsEVM) {
                    // we have a rate limit problem with moonriver/moonbeam so we crawl these separately
                    //warning: evmReceipts is dependent on evmBlock hash
                    if (!evmBlock) evmBlock = await ethTool.crawlEvmBlock(this.web3Api, bn)
                    evmReceipts = await ethTool.crawlEvmReceipts(this.web3Api, evmBlock)
                }
                if (crawlTraceEVM && (this.chainID == 2004 || this.chainID == 22003)) {
                    if (!evmBlock) evmBlock = await ethTool.crawlEvmBlock(this.web3Api, bn)
                    evmTrace = await this.crawlEvmTrace(chain, bn);
                }
            }
            // to avoid 'hash' error, we create the a new block copy without decoration and add hash in
            let block = JSON.parse(JSON.stringify(signedBlock));
            block.number = paraTool.dechexToInt(block.header.number);
            if (typeof blockTS === "undefined") {
                blockTS = this.synthetic_blockTS(chain.chainID, block.number);
            }
            block.hash = blockHash;
            block.blockTS = blockTS;

            // 2. get the trace, if we are running a full node
            let trace = false
            let crawlTrace = parseInt(t.crawlTrace, 10) > 0;
            if (crawlTrace && chain.RPCBackfill && (chain.RPCBackfill.length > 0)) {
                trace = await this.crawlTrace(chain, blockHash, 60000 * (t.attempted + 1));
                console.log("crawl_block_trace trace", trace.length);
            }

            // 3. store finalized state, blockHash + blockTS in mysql + block + trace BT
            let traceType = crawlTrace ? "state_traceBlock" : false
            let success = await this.save_block_trace(chain.chainID, block, blockHash, events, trace, true, traceType, evmBlock, evmReceipts, evmTrace);
            if (success) {
                return {
                    t,
                    block,
                    events,
                    trace,
                    evmBlock,
                    evmReceipts,
                    blockHash
                };
            }
        } catch (err) {
            console.log(err);
            this.logger.warn({
                "op": "crawl_block_trace",
                "chainID": chain.chainID,
                "blockNumber": parseInt(t.blockNumber, 10),
                "err": err
            })
        }
        return {
            t,
            block: false,
            events: false,
            trace: false,
            evmBlock: false,
            evmReceipts: false,
            blockHash: false
        };
    }

    // crawl_trace fetches a block
    async crawl_trace_evm(chain, t, api = false) {
        let bn = t.blockNumber;
        let attemptNumber = t.attempted;
        try {
            let trace = await this.crawlEvmTrace(chain, bn, 60000 * (attemptNumber + 1));
            let success = await this.save_trace_evm(chain.chainID, t, trace, "debug_traceBlockByNumber");
            return [t, trace];
        } catch (err) {
            this.logger.warn({
                "op": "crawl_trace_evm",
                "chainID": chain.chainID,
                "bn": bn,
                "err": err
            })
            console.log("failure!", err);
        }
        return [t, false];
    }
    // save_block_trace stores block+events+trace, and is called
    //  (a) called by crawlBackfill/crawl_block (finalized = true)
    //  (b) subscribeStorage for CANDIDATE blocks (finalized = false)
    // it is NOT called by subscribeFinalizedHeads
    async save_block_trace(chainID, block, blockHash, events, trace, finalized = false, traceType = false, evmBlock = false, evmReceipts = false) {
        let blockTS = block.blockTS;
        let bn = parseInt(block.header.number, 10);
        let parentHash = block.header.parentHash;
        if (bn == 0) {
            blockTS = 0
        }
        let cres = {
            key: paraTool.blockNumberToHex(bn),
            data: {
                blockraw: {},
                blockrawevm: {},
                receiptsevm: {},
                events: {},
                trace: {},
                finalized: {},
                n: {}
            }
        };
        // block object lacks "hash+blockTS" attribute, so we EXPLICITLY add them here
        block = JSON.parse(JSON.stringify(block));
        block.number = bn; // decoration
        block.blockTS = blockTS; // decoration
        block.hash = blockHash; // decoration
        cres['data']['blockraw'][blockHash] = {
            value: JSON.stringify(block),
            timestamp: blockTS * 1000000
        };
        cres['data']['events'][blockHash] = {
            value: JSON.stringify(events),
            timestamp: blockTS * 1000000
        };
        if (trace) {
            cres['data']['trace'][blockHash] = {
                value: JSON.stringify(trace),
                timestamp: blockTS * 1000000
            };
        }
        if (trace && traceType) {
            cres['data']['n']['traceType'] = {
                value: traceType,
                timestamp: blockTS * 1000000
            };
        }
        if (finalized) {
            cres['data']['finalized'][blockHash] = {
                value: "1",
                timestamp: blockTS * 1000000
            };
        }

        if (evmBlock) {
            let evmBlockTS = evmBlock.timestamp;
            let evmBlockhash = evmBlock.blockhash
            cres['data']['blockrawevm'][blockHash] = {
                value: JSON.stringify(evmBlock),
                timestamp: evmBlockTS * 1000000
            };
        }
        if (evmReceipts && Array.isArray(evmReceipts)) {
            cres['data']['receiptsevm'][blockHash] = {
                value: JSON.stringify(evmReceipts),
                timestamp: blockTS * 1000000
            };
        }

        // flush out the mysql + BT updates
        try {
            const tableChain = this.getTableChain(chainID);
            await tableChain.insert([cres]);
            var sql = false;
            let eflds = "";
            let evals = "";
            let eupds = "";
            if (evmReceipts) {
                let numReceiptsEVM = ethTool.computeNumEvmlogs(evmReceipts);
                eflds = ", numReceiptsEVM";
                evals = `, '${numReceiptsEVM}'`;
                eupds = ", numReceiptsEVM = values(numReceiptsEVM)";
            } else if (evmBlock) {
                eflds = ", blockHashEVM, parentHashEVM, numTransactionsEVM, numTransactionsInternalEVM, gasUsed, gasLimit";
                let tl = evmBlock.transactions && evmBlock.transactions.length ? evmBlock.transactions.length : 0;
                let itl = evmBlock.transactionsInternal && evmBlock.transactionsInternal.length ? evmBlock.transactionsInternal.length : 0;
                evals = `, '${evmBlock.hash}', '${evmBlock.parentHash}', '${tl}', '${itl}', '${evmBlock.gasUsed}', '${evmBlock.gasLimit}'`;
                eupds = ", blockHashEVM = values(blockHashEVM), parentHashEVM = values(parentHashEVM), numTransactionsEVM = values(numTransactionsEVM), numTransactionsInternalEVM = values(numTransactionsInternalEVM), gasUsed = values(gasUsed), gasLimit = values(gasLimit)";
            }
            if (trace && finalized) {
                sql = `insert into block${chainID} (blockNumber, blockHash, parentHash, blockDT, crawlBlock, crawlTrace, lastTraceDT ${eflds} ) values (${bn}, '${blockHash}', '${parentHash}', FROM_UNIXTIME(${blockTS}), 0, 0, Now()  ${evals} ) on duplicate key update lastTraceDT = values(lastTraceDT), blockHash = values(blockHash), parentHash = values(parentHash), crawlBlock = values(crawlBlock), crawlTrace = values(crawlTrace), blockDT = values(blockDT) ${eupds} ;`;
            } else if (trace) {
                sql = `insert into block${chainID} (blockNumber, lastTraceDT) values (${bn}, Now()) on duplicate key update lastTraceDT = values(lastTraceDT)`
            } else if (finalized) {
                //check here
                sql = `insert into block${chainID} (blockNumber, blockHash, parentHash, crawlBlock, blockDT ${eflds} ) values (${bn}, '${blockHash}', '${parentHash}', 0, FROM_UNIXTIME(${blockTS})  ${evals} ) on duplicate key update blockHash = values(blockHash), parentHash = values(parentHash), crawlBlock = values(crawlBlock), blockDT = values(blockDT) ${eupds};`;
            }
            if (sql) {
                this.batchedSQL.push(sql);
                await this.update_batchedSQL();
            }
            return (true);
        } catch (err) {
            console.log(err);
            this.logger.warn({
                "op": "save_block_trace",
                chainID,
                bn,
                err
            })
            return (false);
        }
    }

    async save_evm_block(chainID, bn, blockhash, evmBlock = false, evmReceipts = false, evmTrace = false) {
        //todo: store evmBlock
        let cres = {
            key: paraTool.blockNumberToHex(bn),
            data: {}
        };
        let save = false;
        if (evmBlock) {
            let evmBlockTS = evmBlock.timestamp;
            let evmBlockhash = evmBlock.blockhash;
            cres['data']['blockrawevm'] = {};
            cres['data']['blockrawevm'][blockhash] = {
                value: JSON.stringify(evmBlock),
                timestamp: evmBlockTS * 1000000
            };
            save = true;
        }
        let logsTS = (evmBlock && evmBlock.timestamp) ? evmBlock.timestamp : this.getCurrentTS(); // we don't care about logTS
        if (evmReceipts) {
            cres['data']['receiptsevm'] = {};
            cres['data']['receiptsevm'][blockhash] = {
                value: JSON.stringify(evmReceipts),
                timestamp: logsTS * 1000000
            };
            save = true;
        }
        if (evmTrace) {
            cres['data']['traceevm'] = {};
            cres['data']['traceevm'][blockhash] = {
                value: JSON.stringify(evmTrace),
                timestamp: logsTS * 1000000
            };
            save = true;
        }
        //console.log(`save_evm_block: cbt read chain${chainID} prefix=${paraTool.blockNumberToHex(bn)}`);
        // flush out BT updates
        if (save) {
            try {
                const tableChain = this.getTableChain(chainID);
                await tableChain.insert([cres]);
            } catch (err) {
                this.logger.warn({
                    "op": "save_evm_block",
                    chainID,
                    bn,
                    err
                })
                return (false);
            }
        }
    }

    async save_trace(chainID, t, trace, traceType = "state_traceBlock") {
        if (!trace) return (false);
        if (!(trace.length > 0)) return (false);
        let bn = parseInt(t.blockNumber, 10);
        let blockTS = parseInt(t.blockTS, 10);
        let blockHash = t.blockHash;
        let cres = {
            key: paraTool.blockNumberToHex(bn),
            data: {
                trace: {},
                n: {}
            }
        };

        cres['data']['trace'][blockHash] = {
            value: JSON.stringify(trace),
            timestamp: blockTS * 1000000
        };

        cres['data']['n']['traceType'] = {
            value: traceType,
            timestamp: blockTS * 1000000
        };

        // flush out the mysql + BT updates
        try {
            const tableChain = this.getTableChain(chainID);
            await tableChain.insert([cres]);

            var sql = false;
            sql = `insert into block${chainID} (blockNumber, crawlTrace, lastTraceDT) values (${bn}, 0, Now()) on duplicate key update crawlTrace = values(crawlTrace), lastTraceDT = values(lastTraceDT)`
            this.batchedSQL.push(sql);
            await this.update_batchedSQL();
            return (true);
        } catch (err) {
            this.logger.warn({
                "op": "save_trace",
                chainID,
                bn,
                err
            })
            return (false);
        }
    }

    async save_trace_evm(chainID, t, trace, traceEVMType = "debug_traceBlockByHash") {
        if (!trace) return (false);
        let bn = parseInt(t.blockNumber, 10);
        let blockTS = parseInt(t.blockTS, 10);
        let blockHash = t.blockHash;
        let cres = {
            key: paraTool.blockNumberToHex(bn),
            data: {
                traceevm: {},
                n: {}
            }
        };

        cres['data']['traceevm'][blockHash] = {
            value: JSON.stringify(trace),
            timestamp: blockTS * 1000000
        };

        cres['data']['n']['traceEVMType'] = {
            value: traceEVMType,
            timestamp: blockTS * 1000000
        };

        // flush out the mysql + BT updates
        try {
            const tableChain = this.getTableChain(chainID);
            await tableChain.insert([cres]);
            return (true);
        } catch (err) {
            this.logger.warn({
                "op": "save_trace_evm",
                chainID,
                bn,
                err
            })
            console.log(err);
            return (false);
        }
    }


    async audit_blockrawevm(blockEVM, bn) {
        if (blockEVM.hash && (blockEVM.number == bn)) {
            return true;
        }
        console.log("audit_blockrawevm FAIL", blockEVM);
        return (false);
    }

    //audit_blockraw - check { header, extrinsics, number, blockTS, hash }
    async audit_blockraw(blockraw) {
        let bn = 0
        let headerBn = 0
        let blockTS = 0;
        let header = false
        let blockHash = '';
        let parentHash = '';
        if (blockraw.header != undefined) {
            header = blockraw.header
            if (header.parentHash != undefined) parentHash = header.parentHash
            if (header.number != undefined) headerBn = header.number
        }
        if (blockraw.extrinsics == undefined || !Array.isArray(blockraw.extrinsics)) {
            return false
        }
        if (blockraw.number != undefined) bn = blockraw.number
        if (blockraw.blockTS != undefined) blockTS = blockraw.blockTS
        if (blockraw.hash != undefined) blockHash = blockraw.hash
        if (header && blockTS > 1451635200 && bn > 0 && headerBn == bn && parentHash.length == 66 && blockHash.length == 66) {
            //console.log("audit_blockraw ok", bn, blockHash)
            return true
        }
        console.log("audit_blockraw not ok")
        console.log('blockHash', blockHash, 'parentHash', parentHash, 'blockTS', blockTS, 'headerBn', headerBn, 'bn', bn)
        return false
    }

    //audit extrinsic within feed {fromAddress, extrinsicHash, extrinsicID, method, args, events, signature}
    audit_decorated_extrinsic(ex) {
        let fromAddress = ''
        let extrinsicHash = ''
        let extrinsicID = false
        let method = false
        let args = false
        let events = false
        let signature = false
        if (ex.fromAddress != undefined) fromAddress = ex.fromAddress
        if (ex.extrinsicHash != undefined) extrinsicHash = ex.extrinsicHash
        if (ex.extrinsicID != undefined) extrinsicID = ex.extrinsicID
        if (ex.method != undefined) method = ex.method
        if (ex.args != undefined) args = ex.args
        if (ex.events != undefined) events = ex.events
        if (ex.signature != undefined) signature = ex.signature

        if (fromAddress != "NONE" && fromAddress.length != 66 && extrinsicHash.length != 66 && extrinsicID) {
            console.log("ex not ok", "extrinsicHash", extrinsicHash, "extrinsicID", extrinsicID, "fromAddress", fromAddress, )
            return false
        }
        if (method && method.pallet != undefined && method.method != undefined) {} else {
            console.log("ex not ok method not found", "extrinsicHash", extrinsicHash, "extrinsicID", extrinsicID, "method", method)
            return false
        }
        if (args) {
            //TODO: check deep calls?
        } else {
            console.log("ex not ok args", "extrinsicHash", extrinsicHash, "extrinsicID", extrinsicID, "args", args)
            return false
        }
        if (!Array.isArray(events)) {
            console.log("ex not ok - events", "extrinsicHash", extrinsicHash, "extrinsicID", extrinsicID, "events", events)
            return false
        }
        if (signature) {
            //todo
        } else {
            console.log("ex not ok sig", "extrinsicHash", extrinsicHash, "extrinsicID", extrinsicID, "signature", signature)
            return false
        }

        return true
    }
    //audit_blockfeed - check decorated blocks { header, extrinsics, number, blockTS, hash, isFinalized? }
    async audit_indexed_block(feed) {
        let bn = 0
        let headerBn = 0
        let blockTS = 0;
        let header = false
        let blockHash = '';
        let parentHash = '';
        let stateRoot = ''
        let extrinsicsRoot = ''
        let isfinalized = false

        if (feed.hash != undefined) blockHash = feed.hash
        if (feed.number != undefined) bn = feed.number
        if (feed.blockTS != undefined) blockTS = feed.blockTS
        if (feed.finalized != undefined) isfinalized = feed.finalized

        if (feed.header != undefined) {
            header = feed.header
            if (header.parentHash != undefined) parentHash = header.parentHash
            if (header.stateRoot != undefined) stateRoot = header.stateRoot
            if (feed.header.parentHash != undefined) {
                parentHash = feed.header.parentHash
            } else if (feed.parentHash != undefined) {
                parentHash = feed.header.parentHash
            }
            if (header.extrinsicsRoot != undefined) extrinsicsRoot = header.extrinsicsRoot
            if (header.number != undefined) headerBn = header.number
        }

        if (blockTS <= 1451635200 || bn == 0 || headerBn == 0 || headerBn != bn) {
            console.log("audit_indexed_block number not ok", bn, 'blockHash', blockHash, 'headerBn', headerBn, 'blockTS', blockTS)
            return false
        }

        if (parentHash.length != 66 || blockHash.length != 66 || stateRoot.length != 66 || extrinsicsRoot.length != 66) {
            console.log("audit_indexed_block hash not ok", bn, 'blockHash', blockHash, 'parentHash', parentHash, 'stateRoot', stateRoot, 'extrinsicsRoot', extrinsicsRoot)
            return false
        }

        if (feed.extrinsics == undefined || !Array.isArray(feed.extrinsics)) {
            console.log("audit_indexed_block extrinsics not ok - not array", bn, 'blockHash', blockHash)
            return false
        }

        if (!isfinalized) {
            console.log("audit_indexed_block not finalized", bn, 'blockHash', blockHash)
            return false
        }

        for (const ex of feed.extrinsics) {
            //verify ex here
            let isVerifiedEx = this.audit_decorated_extrinsic(ex)
            if (!isVerifiedEx) {
                console.log('audit_indexed_block not ok - ex', JSON.stringify(ex))
                return false
            }
        }

        //console.log(`audit_indexed_block verified. bn=${bn}, blockHash=${blockHash}`)
        //console.log('blockHash', blockHash, 'parentHash', parentHash, 'blockTS', blockTS, 'headerBn', headerBn, 'bn', bn)
        return true
    }

    async audit_chain(chain, startBN, endBN) {
        let chainID = chain.chainID;
        let sql = `select blockNumber, blockDT, lastTraceDT from block${chainID} where blockNumber >= ${startBN} and blockNumber < ${endBN}`;
        let blocksDone = await this.poolREADONLY.query(sql)

        let blocks = {};
        let traces = {};
        blocksDone.forEach(async (b) => {
            if (b.lastTraceDT) traces[b.blockNumber] = 1;
            if (b.blockDT) blocks[b.blockNumber] = 1;
        });

        let out = [];
        let missedBlock = 0;
        let missedTrace = 0;
        let covered = 0;
        for (let i = startBN; i < endBN; i++) {
            if (!blocks[i] && !traces[i]) {
                out.push(`( ${i}, '1', '1')`)
                missedTrace++;
                missedBlock++;
            } else if (!blocks[i]) {
                out.push(`( ${i}, '1', '0')`)
                missedBlock++;
            } else if (!traces[i]) {
                out.push(`( ${i}, '0', '1')`)
                missedTrace++;
            } else {
                out.push(`( ${i}, '0', '0')`)
                covered++;
            }
        }
        if (out.length > 0) {
            this.batchedSQL.push(`insert into block${chainID} (blockNumber, crawlBlock, crawlTrace) values ` + out.join(",") + ` on duplicate key update crawlBlock = values(crawlBlock), crawlTrace = values(crawlTrace)`);
            await this.update_batchedSQL();
        }
        console.log("audit_chain: chainID=", chainID, "startBN=", startBN, "endBN=", endBN, "missed blocks=", missedBlock, " trace=", missedTrace, " covered=", covered);
        let blockHashes = {}
        let parentHashes = {}
        let finalized = {}
        let blockTSes = {}
        let auditRows = []
        const tableChain = this.instance.table("chain" + chainID);
        let writeFinalized = {};
        let parents = {};
        let start = paraTool.blockNumberToHex(startBN);
        let end = paraTool.blockNumberToHex(endBN);
        let families = ["blockraw", "events", "trace", "finalized"]
        if (chain.isEVM > 0) {
            families.push("blockrawevm");
            families.push("receiptsevm");
        }
        let res = tableChain.createReadStream({
            start,
            end,
            family: families
        });
        res.on("error", (err) => {
            console.log(err);
        });
        res.on("end", async () => {});
        res.on("data", async (row) => {
            try {
                let bn = parseInt(row.id.substr(2), 16);
                let rowData = row.data;
                let blockData = rowData["blockraw"];
                let blockEVMData = rowData["blockrawevm"];
                let receiptsEVMData = rowData["receiptsevm"];
                let traceEVMData = rowData["traceevm"];
                let eventsData = rowData["events"];
                let traceData = rowData["trace"];
                let finalizedData = rowData["finalized"];
                let cellBlock = false;
                let cellBlockEVM = false;
                let cellReceiptsEVM = false;
                let cellTraceEVM = false;
                let cellEvents = false;
                let cellTrace = false;
                let crawlBlock = 1;
                let crawlBlockEVM = (chain.isEVM > 0) ? 1 : 0;
                let crawlReceiptsEVM = (chain.isEVM > 0) ? 1 : 0;
                let crawlTraceEVM = (chain.isEVM > 0) ? 1 : 0;
                let crawlTrace = 0;
                let block = false;
                let blockEVM = false;
                let receiptsEVM = false;
                let traceEVM = false;
                let trace = false;
                let events = false;
                let blockStats = false;
                let blockTS = 0;
                let blockHash = '';
                let parentHash = '';
                let write = false;
                if (finalizedData) {
                    for (const h of Object.keys(finalizedData)) {
                        if (blockData && (blockData[h]) && eventsData && eventsData[h]) {
                            cellBlock = blockData[h][0];
                            cellEvents = eventsData[h][0];
                            finalized[bn] = true;
                            blockHash = h;
                        }
                        // QUESTION: is there always only one hash for a bn in evm?
                        if (blockEVMData && (blockEVMData[h])) {
                            cellBlockEVM = blockEVMData[h][0];
                        }
                        // QUESTION: is there always only one hash for a bn in evm?
                        if (receiptsEVMData && (receiptsEVMData[h])) {
                            cellReceiptsEVM = receiptsEVMData[h][0];
                        }
                        if (traceEVMData && (traceEVMData[h])) {
                            cellTraceEVM = traceEVMData[h][0];
                        }
                        if (traceData && traceData[h]) {
                            cellTrace = traceData[h][0];
                        }
                    }
                }

                if (traceData && !cellTrace && traceData["raw"]) {
                    cellTrace = traceData["raw"][0];
                }

                if (cellBlock && cellEvents) {
                    block = JSON.parse(cellBlock.value);
                    events = JSON.parse(cellEvents.value);
                    blockTS = block.blockTS ? block.blockTS : 0;
                    blockHash = block.hash ? block.hash : "";
                    parentHash = block.header.parentHash;
                    blockHashes[bn] = blockHash;
                    parentHashes[bn] = parentHash;
                    blockTSes[bn] = blockTS;

                    //audit_blockraw - check { number, hash, header, blockTS, extrinsics }
                    let isBlockRawVerified = await this.audit_blockraw(block)
                    if ((events.length > 0) && isBlockRawVerified) {
                        crawlBlock = 0;
                    }

                    if (chain.isEVM > 0) {
                        if (cellBlockEVM) {
                            blockEVM = JSON.parse(cellBlockEVM.value);
                            let isBlockEVMRawVerified = await this.audit_blockrawevm(blockEVM, bn);
                            if (isBlockEVMRawVerified) {
                                crawlBlockEVM = 0;
                            }
                        }
                        if (cellReceiptsEVM) {
                            receiptsEVM = JSON.parse(cellReceiptsEVM.value);
                            crawlReceiptsEVM = 0;
                        }
                        if (cellTraceEVM) {
                            traceEVM = JSON.parse(cellTraceEVM.value);
                            crawlTraceEVM = 0;
                        }
                    }
                }

                if (cellTrace) {
                    trace = JSON.parse(cellTrace.value);
                    crawlTrace = 0;
                } else {
                    if (events && events.length < 3) { // TODO: or numSignedExtrinsics = 0?
                        crawlTrace = 0
                    } else {
                        crawlTrace = 1;
                    }
                }

                let esql = (chain.isEVM > 0) ? `, ${crawlBlockEVM}, ${crawlReceiptsEVM}, ${crawlTraceEVM}` : ""
                let sql = `('${bn}', '${blockHash}', '${parentHash}', FROM_UNIXTIME('${blockTS}'), '${crawlBlock}', '${crawlTrace}' ${esql})`
                auditRows.push(sql);
            } catch (err) {
                this.logger.warn({
                    "op": "audit_chain",
                    chainID,
                    err
                })
            }
        });
        await this.finished(res);
        await this.dump_update_block(chain, auditRows);

        // go backwards
        let cnt = 0;
        for (var n = endBN; n > startBN; n--) {
            let parentn = n - 1;
            if (finalized[n] && (!finalized[parentn]) && (blockHashes[parentn]) && (parentHashes[n] == blockHashes[parentn])) {
                console.log("** NEW writefinalized", n, parentn, finalized[n], finalized[parentn]);
                finalized[parentn] = true;
                writeFinalized[parentn] = blockHashes[parentn];
            } else {
                cnt++;
            }
        }
        let newRows = [];
        for (let n of Object.keys(writeFinalized)) {
            let n0 = parseInt(n, 10)
            let h = writeFinalized[n];
            let blockTS = parseInt(blockTSes[n], 10);
            let cres = {
                key: paraTool.blockNumberToHex(n0),
                data: {
                    finalized: {},
                }
            };
            cres['data']['finalized'][h] = {
                value: "1",
                timestamp: blockTS * 1000000
            };
            newRows.push(cres);
        }

        try {
            if (newRows.length > 0) {
                await tableChain.insert(newRows);
                console.log("  WROTE finalized:", newRows.length);
            }
        } catch (err) {
            this.logger.warn({
                "op": "audit_chain",
                chainID,
                err
            })
        }

        return (missedBlock);
    }

    async dump_update_block(chain, auditRows) {
        let chainID = chain.chainID;
        if (auditRows.length == 0) return;

        let eflds = (chain.isEVM > 0) ? ", crawlBlockEVM, crawlReceiptsEVM, crawlTraceEVM" : "";
        let efldsu = (chain.isEVM > 0) ? ", crawlBlockEVM = values(crawlBlockEVM), crawlReceiptsEVM = values(crawlReceiptsEVM), crawlTraceEVM = values(crawlTraceEVM)" : "";

        let i = 0;
        for (i = 0; i < auditRows.length; i += 10000) {
            let j = i + 10000;
            if (j > auditRows.length) j = auditRows.length;
            let sql = `insert into block${chainID} (blockNumber, blockHash, parentHash, blockDT, crawlBlock, crawlTrace ${eflds}) values ` + auditRows.slice(i, j).join(",") + ` on duplicate key update crawlBlock = values(crawlBlock), crawlTrace = values(crawlTrace), blockHash = values(blockHash), parentHash = values(parentHash), blockDT = values(blockDT) ${efldsu}`;
            this.batchedSQL.push(sql)
        }
        auditRows = [];
        await this.update_batchedSQL()
    }

    async auditChain(chain) {
        let chainID = chain.chainID;
        let jmp = 2000;
        console.log(chain);
        for (let i = chain.backfillLookback; i < chain.blocksCovered; i += jmp) {
            let startBN = i;
            let endBN = i + jmp;
            if (endBN > chain.blocksCovered) endBN = chain.blocksCovered;

            let missedBlock = await this.audit_chain(chain, startBN, endBN)
            var sql = `update chain set backfillLookback = ${endBN} where chainID = ${chainID}`;
            this.batchedSQL.push(sql)
            await this.update_batchedSQL();

        }

        await this.update_batchedSQL();
        console.log("auditChain DONE chainID=", chainID);
    }

    async get_chain_period_from_indexTS(chainID, indexTS) {
        var sql = `select sum(numEvents)/count(*) as eventsperblock, sum(numExtrinsics)/count(*) as extrinsicsperblock, min(blockNumber) startBN, max(blockNumber) endBN, sum(numEvents) numEvents from block${chainID} where blockDT >= FROM_UNIXTIME('${indexTS}') and blockDT < FROM_UNIXTIME('${indexTS+3600}');`
        var periods = await this.poolREADONLY.query(sql);

        if (periods.length == 1) {
            let p = periods[0];
            let period = {
                indexTS,
                eventsperblock: p.eventsperblock,
                extrinsicsperblock: p.extrinsicsperblock,
                startBN: p.startBN,
                endBN: p.endBN,
                numEvents: p.numEvents
            }
            return (period);
        }
        return (false);
    }

    async indexChain(chain, lookbackBackfillDays = 60, audit = false, backfill = false, write_bq_log = true, techniqueParams = ["mod", 0, 1]) {
        this.chainID = chain.chainID;
        // (1) audit_chain the period, which marks crawlBlock=1, crawlTrace=1 for the period
        if (audit) {
            console.log("auditChain");
            await this.auditChain(chain);
        }

        // (2) get the missed blocks for the last {lookback} days (assumes 360 blocks per hour)
        if (backfill) {
            console.log("backfill");
            await this.crawlBackfill(chain, ["range", chain.blocksFinalized - lookbackBackfillDays * 360 * 24, chain.blocksFinalized])
        }
        chain = await this.setupChainAndAPI(this.chainID);
        await this.assetManagerInit()
        this.resetTimeUsage()

        var w = "";
        if (techniqueParams[0] == "mod") {
            let n = techniqueParams[1];
            let nmax = techniqueParams[2];
            if (nmax > 1) {
                w = ` and round(indexTS/3600) % ${nmax} = ${n}`;
            }
        }
        var sql = `select chainID, indexTS from indexlog where indexed = 0 and readyForIndexing = 1 and chainID = '${chain.chainID}' and indexTS < UNIX_TIMESTAMP(Now()) - 3600 and ( lastAttemptStartDT is null or lastAttemptStartDT < date_sub(Now(), interval POW(5, attempted) MINUTE) ) ${w} order by attempted, indexTS`;
        var indexlogs = await this.pool.query(sql);
        if (indexlogs.length == 0) {
            console.log(`indexChain ${chain.chainID}: no work to do`, sql)
            return (false);
        }
        let indexPeriodProcessedCnt = 0
        for (let i = 0; i < indexlogs.length; i++) {
            let period = await this.get_chain_period_from_indexTS(chain.chainID, indexlogs[i].indexTS);
            if (period) {
                let eventsperblock = parseFloat(period.eventsperblock);
                let jmp = eventsperblock > 0 ? Math.round(7200 / eventsperblock) : 50;
                if (jmp < 10) jmp = 10;
                // increment attempted, which generally will mean some other indexer won't attempt the same thing until its the last unprocessed hour
                let sql0 = `update indexlog set attempted = attempted + 1, lastAttemptStartDT = Now(), lastAttemptHostname = '${this.hostname}' where chainID = '${chain.chainID}' and indexTS = ${indexlogs[i].indexTS}`
                this.batchedSQL.push(sql0);
                await this.update_batchedSQL();
                try {
                    let elapsedTS = await this.index_blocks_period(chain, period, jmp, write_bq_log);
                    if (elapsedTS > 600) {
                        indexPeriodProcessedCnt++
                        console.log(`indexChain unhealthy after ${indexPeriodProcessedCnt}`)
                        process.exit(1)
                    }
                } catch (err) {
                    console.log(err);
                }
            }
        }
    }

    async indexPeriod(chainID, logDT, hr, write_bq_log = false) {
        let indexTSPeriod = paraTool.logDT_hr_to_ts(logDT, hr);
        var sql = `select floor(UNIX_TIMESTAMP(blockDT)/3600)*3600 as indexTS, min(blockNumber) startBN, max(blockNumber) endBN from block${chainID} where blockDT >= FROM_UNIXTIME(${indexTSPeriod}) and blockDT < FROM_UNIXTIME(${indexTSPeriod+3600}) group by indexTS order by indexTS;`
        if (this.debugLevel >= paraTool.debugInfo) console.log(`indexPeriod sql=`, sql) //why debugLevel doesn't work???
        var periods = await this.poolREADONLY.query(sql);
        let chain = await this.setupChainAndAPI(chainID);
        console.log(chain);

        let indexPeriodProcessedCnt = 0
        for (let i = 0; i < periods.length; i++) {
            let period = await this.get_chain_period_from_indexTS(this.chainID, periods[i].indexTS);
            if (period) {
                console.log(period);
                let eventsperblock = parseFloat(period.eventsperblock);
                let jmp = eventsperblock > 0 ? Math.round(7200 / eventsperblock) : 50;
                if (jmp < 10) jmp = 10;
                let elapsedTS = await this.index_blocks_period(chain, period, jmp, write_bq_log);
                if (elapsedTS > 210) {
                    indexPeriodProcessedCnt++
                    console.log(`indexReindex unhealthy after ${indexPeriodProcessedCnt}`)
                    process.exit(1)
                }
            }
        }
    }

    async maintainIndexer() {
        let sql = `select chainID from chainhostnameendpoint where updateDT < date_sub(Now(), interval 5 minute) and hostname = '${this.hostname}' order by updateDT Desc limit 100`;
        var chains = await this.poolREADONLY.query(sql);
        for (const chain of chains) {
            let chainID = chain.chainID;
            let cmd = `systemctl restart crawler${chainID}.service`
            await exec(cmd);
        }
        sql = `select chainID, CONVERT(auditFailures using utf8) auditFailures from blocklogstats where audited = 'Failure' and monthDT = LAST_DAY(Now()) limit 100`;
        console.log(sql);
        var failures = await this.poolREADONLY.query(sql);
        for (const failure of failures) {
            try {
                let auditFailures = JSON.parse(failure.auditFailures);
                let chainID = parseInt(failure.chainID, 10);
                let total = 0;
                for (const g of auditFailures.gaps) {
                    let blocks = g[1] - g[0];
                    total += blocks;
                }
                console.log(chainID, "TOTAL:", total, auditFailures.gaps);
                if (total < 10000) {
                    let chain = await this.getChain(chainID);
                    await this.crawlBackfill(chain);
                    // indexer => substrateetl => reaudit
                }
            } catch (err) {
                console.log(err);
            }
        }
        //process.exit(0);
    }

    async indexChainRandom(lookbackBackfillDays = 60, audit = true, backfill = true, write_bq_log = true, update_chain_assets = true) {
        // pick a chainID that the node is also crawling
        let hostname = this.hostname;
        var sql = `select chainID, min(from_unixtime(indexTS)) as indexDTLast, count(*) from indexlog where indexed=0 and readyForIndexing = 1 and ( lastAttemptStartDT is null or lastAttemptStartDT < date_sub(Now(), interval POW(5, attempted) MINUTE) )  and chainID in ( select chainID from chainhostnameendpoint where hostname = '${hostname}' ) group by chainID having count(*) < 500 order by rand() desc`;
        console.log(sql);
        var chains = await this.poolREADONLY.query(sql);

        if (chains.length < 1) {
            console.log("indexChainRandom: No chains to index", sql);
            // update asset, chain tables with new info from the hour
            return (false);
        }
        let chainID = chains[0].chainID;
        let chain = await this.getChain(chainID);
        await this.indexChain(chain, lookbackBackfillDays, audit, backfill, write_bq_log);
        await this.update_batchedSQL();


        return (true);
    }

    async updateChainAssets(chainID, daysago = 2) {
        let chain = await this.getChain(chainID);
        let updateChainAssetStartTS = new Date().getTime();
        await this.update_chain_assets(chain, daysago)
    }

    async getChainLookbackBlocks(chainID, defaultLookbackBlocks = 14000) {
        var sql = `select chain.chainID, chain.blocksCovered, min(startBN) startBN, blocksCovered - min(startBN) as lookbackBlocks from blocklogstats join chain on blocklogstats.chainID = chain.chainID where monthDT >= LAST_DAY(date_sub(Now(), interval 90 day)) and audited in ('Failure', 'Unknown') and chain.chainID = ${chainID} limit 1`;
        var stats = await this.poolREADONLY.query(sql);
        if (stats.length > 0 && (stats[0].lookbackBlocks > 0)) {
            return parseInt(stats[0].lookbackBlocks, 10);
        }
        if (defaultLookbackBlocks > 0) {
            return defaultLookbackBlocks;
        }
        return 14000;
    }

    async crawlTracesRandom(lookbackBackfill = 60) {
        var sql = `select chainID, traceTSLast, UNIX_TIMESTAMP( NOW() ) - traceTSLast as ts from chain where crawling = 1 and UNIX_TIMESTAMP( NOW() ) - traceTSLast < 864000 and chainID != 22007 and WSEndpointSelfHosted = 1 order by traceTSLast limit 1`;
        var chains = await this.poolREADONLY.query(sql);

        if (chains.length < 1) {
            console.log("crawlTracesRandom: No chains to index", sql);
            return (false);
        }
        let chainID = chains[0].chainID;
        this.batchedSQL.push(`update chain set traceTSLast = UNIX_TIMESTAMP( NOW() ) where chainID = '${chainID}'`);
        await this.update_batchedSQL();

        await this.crawlTraces(chainID);
        await this.update_batchedSQL();
        return (true);
    }

    // for any missing blocks/traces, this refetches the dataset
    async crawlBackfill(chain, techniqueParams = ["mod", 0, 1], lookbackBlocks = null, wsBackfill = false) {
        let chainID = chain.chainID;
        let sql = false;
        let extraflds = (chain.isEVM > 0) ? " crawlBlockEVM, crawlReceiptsEVM, " : "";
        let extracond = (chain.isEVM > 0) ? " or crawlBlockEVM = 1 or crawlReceiptsEVM = 1 " : "";
        if (lookbackBlocks == null) {
            lookbackBlocks = await this.getChainLookbackBlocks(chainID);
        }

        if (techniqueParams[0] == "mod") {
            let n = techniqueParams[1];
            let nmax = techniqueParams[2];
            let w = (nmax > 1) ? `and blockNumber % ${nmax} = ${n}` : "";
            let w2 = ` and blockNumber > ${chain.blocksCovered} - ${lookbackBlocks}`
            sql = `select blockNumber, crawlBlock, 0 as crawlTrace, ${extraflds} attempted from block${chainID} where ( crawlBlock = 1 ${extracond} ) ${w} ${w2} and blockNumber <= ${chain.blocksFinalized} and ( attemptedDT is null or attemptedDT < Date_sub(Now(), interval POW(3, attempted) MINUTE) ) order by blockNumber desc limit 50000`
            console.log("lookback", sql);
        } else if (techniqueParams[0] == "range") {
            let startBN = techniqueParams[1];
            let endBN = techniqueParams[2];
            sql = `select blockNumber, crawlBlock, 0 as crawlTrace, ${extraflds} attempted from block${chainID} where ( crawlBlock = 1 ${extracond} ) and blockNumber >= ${startBN} and blockNumber <= ${endBN} and ( attemptedDT is null  or attemptedDT < date_sub(Now(), interval POW(3, attempted) MINUTE) ) order by blockNumber desc limit 50000`
            console.log("lookback", sql);
        }
        let tasks = await this.poolREADONLY.query(sql);
        if (tasks.length == 0) return (false);

        await this.setupAPI(chain);
        if (wsBackfill && chain.WSBackfill && (chain.WSBackfill.length > 0)) {
            chain.WSEndpoint = chain.WSBackfill;
        }
        var jmp = 10; // do 10 at a time
        for (var i = 0; i < tasks.length; i += jmp) {
            let j = i + jmp;
            if (j > tasks.length) j = tasks.length;
            let pieces = tasks.slice(i, j);
            console.log("crawlBackfill", "chainID", chainID, i, "/", tasks.length);
            let res = pieces.map((t) => {
                return this.crawl_block_trace(chain, t);
            })
            let res2 = await Promise.all(res);
            res2.forEach(async (t_block_trace) => {
                let {
                    t,
                    block,
                    events,
                    trace,
                    evmBlock,
                    evmReceipts
                } = t_block_trace;
                if (t.attempted > 100) t.attempted = 100;

                let flds = [];
                if (block && events && (t.crawlBlock > 0)) {
                    t.crawlBlock = 0;
                    flds.push(`crawlBlock = '${t.crawlBlock}'`);
                    if (trace && (t.crawlTrace > 0)) {
                        t.crawlTrace = 0;
                        flds.push(`crawlTrace = '${t.crawlTrace}'`);
                    }
                } else {
                    flds.push(`attempted = ${t.attempted + 1}`);
                    flds.push(`attemptedDT = Now()`);
                }
                if (chain.isEVM > 0) {
                    if ((t.crawlBlockEVM > 0) && evmBlock && evmBlock.hash) {
                        t.crawlBlockEVM = 0;
                        flds.push("crawlBlockEVM = 0");
                    }
                    if ((t.crawlReceiptsEVM > 0) && evmReceipts && Array.isArray(evmReceipts)) {
                        t.crawlReceiptsEVM = 0;
                        flds.push("crawlReceiptsEVM = 0");
                    }
                }
                let sql = `update block${chainID} set ${flds.join(", ")} where blockNumber = '${t.blockNumber}'`;
                this.batchedSQL.push(sql)
                await this.mark_indexlog_dirty(chainID, block.blockTS);
                await this.update_batchedSQL();
                return
            });
        }
        await this.update_batchedSQL();
    }

    async getNumRecentCrawlBlocks(chain, lookbackBlocks = 14000) {
        var sql = `select count(*) as numRecentCrawlBlocks from block${chain.chainID} b, chain c where crawlBlock = 1 and blockNumber >= c.blocksFinalized - ${lookbackBlocks} and c.chainID = ${chain.chainID} and attemptedDT < date_sub(Now(), INTERVAL POW(5, attempted) MINUTE) order by attempted limit 1000`;
        let result = await this.poolREADONLY.query(sql);

        if (result.length > 0) {
            return result[0].numRecentCrawlBlocks;
        }
        return (-1);
    }
    // for any missing traces, this refetches the dataset
    async crawlTracesEVM(chainID, techniqueParams = ["mod", 0, 1], lookback = 600) {
        let chain = await this.setupChainAndAPI(chainID);
        let done = false;
        do {
            let sql = `select blockNumber, UNIX_TIMESTAMP(blockDT) as blockTS, blockHash, blockHashEVM, attempted from block${chainID} where crawlTraceEVM > 0 and length(blockHash) > 0 and blockNumber % ${techniqueParams[2]} = ${techniqueParams[1]} and blockDT >= date_sub(Now(), interval ${lookback} DAY) and attempted < ${maxTraceAttempts} order by crawlTraceEVM desc,attempted, blockNumber desc limit 1000`
            if (techniqueParams[0] == "range") {
                let startBN = techniqueParams[1];
                let endBN = techniqueParams[2];
                sql = `select blockNumber, UNIX_TIMESTAMP(blockDT) as blockTS, blockHash, blockHashEVM, attempted from block${chainID} where crawlTraceEVM > 0 and length(blockHash) > 0 and blockNumber >= ${startBN} and blockNumber <= ${endBN} and attempted < ${maxTraceAttempts} order by blockNumber limit 1000`
            }
            let tasks = await this.poolREADONLY.query(sql);

            let jmp = 1;
            for (var i = 0; i < tasks.length; i += jmp) {
                let j = i + jmp;
                if (j > tasks.length) j = tasks.length;
                let pieces = tasks.slice(i, j);
                let res = pieces.map((t1) => {
                    let t2 = {
                        chainID: chainID,
                        blockNumber: t1.blockNumber,
                        blockHash: t1.blockHash,
                        blockHashEVM: t1.blockHashEVM,
                        blockTS: t1.blockTS,
                        attempted: t1.attempted
                    };
                    return this.crawl_trace_evm(chain, t2, this.api);
                });
                let res2 = await Promise.all(res);
                res2.forEach(async (t_trace) => {
                    let [t, trace] = t_trace;
                    if (trace) {
                        let sql = `update block${chainID} set crawlTraceEVM = 0 where blockNumber = ${t.blockNumber}`
                        this.batchedSQL.push(sql)
                    } else {
                        let sql = `update block${chainID} set attempted = attempted + 1, attemptedDT = Now() where blockNumber = ${t.blockNumber}`
                        this.batchedSQL.push(sql)
                    }
                    await this.mark_indexlog_dirty(chainID, t_trace.blockTS)
                    return
                });
                this.batchedSQL.push(`update chain set traceTSLast = UNIX_TIMESTAMP(Now()) where chainID = ${chainID}`)
                await this.update_batchedSQL();
            }
        } while (!done);

    }

    // for any missing traces, this refetches the dataset
    async crawlTraces(chainID, techniqueParams = ["mod", 0, 1], lookbackBlocks = null, skipTrace = true) {
        let chain = await this.setupChainAndAPI(chainID, true, true);
        await this.check_chain_endpoint_correctness(chain);

        let done = false;
        let syncState = await this.api.rpc.system.syncState();
        do {
            let highestBlock = parseInt(syncState.highestBlock.toString(), 10);
            let currentBlock = parseInt(syncState.currentBlock.toString(), 10);
            let startingBlock = parseInt(syncState.startingBlock.toString(), 10);
            //console.log("crawlTraces highestBlock", currentBlock, highestBlock, syncState, startingBlock);
            let lookbackBlocks = await this.getChainLookbackBlocks(chainID);
            let startBN = chain.blocksFinalized - lookbackBlocks;
            let w = ((techniqueParams.length > 2) && (techniqueParams[2] > 0)) ? `and blockNumber % ${techniqueParams[2]} = ${techniqueParams[1]}` : ""
            let w2 = (chainID == 0 || chainID == 2) ? " or crawlTrace = 1 " : ""; // only need traces from relay chains in practice
            let sql = `select blockNumber, UNIX_TIMESTAMP(blockDT) as blockTS, crawlBlock, blockHash, attempted from block${chainID} where ( crawlBlock = 1 ${w2} ) and blockNumber > ${startBN} and ( attemptedDT is Null or attemptedDT < date_sub(Now(), INTERVAL POW(5, attempted) MINUTE) ) ${w} limit 5000`
            if (techniqueParams[0] == "range") {
                let startBN = techniqueParams[1];
                let endBN = techniqueParams[2];
                sql = `select blockNumber, UNIX_TIMESTAMP(blockDT) as blockTS, crawlBlock, blockHash, attempted from block${chainID} where ( crawlBlock = 1 ${w2} ) and blockNumber >= ${startBN} and blockNumber <= ${endBN} order by rand() limit 1000`
            }
            console.log(sql);
            let tasks = await this.poolREADONLY.query(sql);
            let jmp = 1;
            for (var i = 0; i < tasks.length; i += jmp) {
                let j = i + jmp;
                if (j > tasks.length) j = tasks.length;
                let pieces = tasks.slice(i, j);
                let res = pieces.map((t1) => {
                    let t2 = {
                        chainID: chainID,
                        blockNumber: t1.blockNumber,
                        blockHash: t1.blockHash, // could be null
                        blockTS: t1.blockTS, // could be null
                        attempted: t1.attempted // should be
                    };
                    return this.crawl_block_trace(chain, t2)
                });
                let res2 = await Promise.all(res);
                res2.forEach(async (t_trace) => {
                    let {
                        t,
                        block,
                        events,
                        trace,
                        evmBlock,
                        blockHash
                    } = t_trace;
                    let flds = [];
                    if (blockHash) {
                        flds.push('crawlBlock = 0');
                        if (trace) {
                            flds.push('crawlTrace = 0');
                        }
                    } else {
                        flds.push('attempted = attempted + 1');
                        flds.push('attemptedDT = Now()');
                    }
                    let sql = `update block${chainID} set ${flds.join(",")} where blockNumber = ${t.blockNumber}`;
                    console.log(sql)
                    this.batchedSQL.push(sql)
                    //await this.mark_indexlog_dirty(chainID, block.blockTS)
                    return
                });
                this.batchedSQL.push(`update chain set traceTSLast = UNIX_TIMESTAMP(Now()) where chainID = ${chainID}`)
                await this.update_batchedSQL();
            }
            let numRecentCrawlBlocks = await this.getNumRecentCrawlBlocks(chain, lookbackBlocks);
            console.log("crawlTraces numRecentCrawlBlocks=", numRecentCrawlBlocks)
            if (numRecentCrawlBlocks < 3) done = true;
        } while (!done);

    }

    async mark_indexlog_dirty(chainID, ts) {

        if (!(ts > 0)) {
            return (false);
        }
        let indexTS = Math.floor(ts / 3600) * 3600;
        if (indexTS == this.lastmarkedTS) {
            return (false);
        }
        let [logDT, hr] = paraTool.ts_to_logDT_hr(indexTS);
        this.upsertSQL({
            "table": "indexlog",
            "keys": ["chainID", "indexTS"],
            "vals": ["logDT", "hr", "indexed"],
            "data": [`('${chainID}', '${indexTS}', '${logDT}', '${hr}', 0)`],
            "replace": ["indexed"]
        }, true);
        this.lastmarkedTS = indexTS;
    }


    async dedupChanges(changes) {
        let dedupEvents = {};
        for (const r of changes) {
            let k = r[0].toHex();
            let v = r[1].toHex();
            if (v.length == 2) {
                v = null;
            }
            dedupEvents[k] = {
                k,
                v
            };
        }

        let trace = [];
        for (const k of Object.keys(dedupEvents)) {
            trace.push(dedupEvents[k]);
        }
        return (trace);
    }

    async markFinalizedReadyForIndexing(chain, blockTS) {
        let chainID = chain.chainID;
        let indexTS = (Math.floor(blockTS / 3600)) * 3600;
        let prevTS = (Math.floor(blockTS / 3600) - 1) * 3600;
        if (!this.readyForIndexing[prevTS]) {
            this.readyForIndexing[prevTS] = 1;
            let [logDT, hr] = paraTool.ts_to_logDT_hr(prevTS);
            var sql = `insert into indexlog (chainID, indexTS, logDT, hr, readyForIndexing) values ('${chainID}', '${prevTS}', '${logDT}', '${hr}', 1) on duplicate key update readyForIndexing = values(readyForIndexing);`;
            this.batchedSQL.push(sql);

            if (hr == 23) { // since we finalized the last hour, we can kick off fetching end of day balances
                let updateAddressBalanceStatus = "Ready"; // Don't need to ignore if WSEndpointArchive = 1, since we have 128 blocks history?
                await this.upsertSQL({
                    "table": "blocklog",
                    "keys": ["chainID", "logDT"],
                    "vals": ["loaded", "audited", "updateAddressBalanceStatus"],
                    "data": [`('${chainID}', '${logDT}', '0', 'Unknown', '${updateAddressBalanceStatus}')`],
                    "replace": ["loaded", "audited"]
                });
            }
            await this.update_indexlog_hourly(chain)
            if (chain.isEVM > 0 && (chain.evmRPC)) {
                await this.updateERC20TokenSupply(chain);
            }
            await this.updateSpecVersions(chain);
            return (true);
        }
        return (false);
    }

    async crawlBlock(api, blockHash) {
        const signedBlock = await api.rpc.chain.getBlock(blockHash);
        let eventsRaw = [];
        try {
            eventsRaw = await api.query.system.events.at(blockHash);
        } catch (err) {
            console.log(err);
        }
        let events = eventsRaw.map((e) => {
            let eh = e.event.toHuman();
            let ej = e.event.toJSON();

            let out = JSON.parse(JSON.stringify(e));
            let data = out.event.data;
            out.event = {};
            out.event.data = data;
            out.event.method = {};
            out.event.method['pallet'] = eh.section;
            out.event.method['method'] = eh.method;
            return out
        });

        let block = signedBlock.block;
        let header = block.header;
        let blockNumber = header.number;
        let isSet = false;
        for (let i = 0; i < block.extrinsics.length; i++) {
            let ex = block.extrinsics[i];
            let exj = ex.method.toJSON();
            let exh = ex.method.toHuman()
            if (exh.method == "set" && exh.section == 'timestamp' && (!isSet)) {
                block.blockTS = Math.round((exj.args.now) / 1000);
                isSet = true;
            }
        }
        // hacks
        if (blockNumber == 1000465 && this.chainID == 2) {
            block.blockTS = 1581422538;
        }
        if (this.chainID == 22007 && blockNumber < 195653) {
            block.blockTS = Math.round(blockNumber * 19.2191 + 1625570874)
        }
        if (this.chainID == 1000 && blockNumber < 305204) {
            block.blockTS = Math.round(blockNumber * 12.17112 + 1636071000)
        }
        if (this.chainID == 21000 && blockNumber < 66687) {
            block.blockTS = Math.round(blockNumber * 12 + 1621934316)
        }
        // NOTE: does not have block.{number, hash} set
        return [block, events];
    }

    async crawlPendingExtrinsics(chain, crawler) {
        if (crawler.latestBlockNumber > 0) {
            let pendingTXs = await crawler.api.rpc.author.pendingExtrinsics()
            await crawler.processPendingTransactions(pendingTXs, crawler.latestBlockNumber)
        }
    }

    async crawlTxpoolContent(chain, crawler) {
        if (crawler.latestBlockNumber > 0) {
            let cmd = `curl ${chain.RPCBackfill}  -X POST -H "Content-Type: application/json" --data '{"method":"txpool_content","params":[],"id":1,"jsonrpc":"2.0"}'`
            const {
                stdout,
                stderr
            } = await exec(cmd, {
                maxBuffer: 1024 * 64000
            });
            let txs = [];
            let content = JSON.parse(stdout);
            if (content && content.result && content.result.pending) {
                let pending = content.result.pending;
                let ts = crawler.getCurrentTS();
                for (const addr of Object.keys(pending)) {
                    for (const nonce of Object.keys(pending[addr])) {
                        let tx = pending[addr][nonce];
                        // make sure we don't repeat this
                        let transactionHash = tx.hash
                        if (transactionHash && (crawler.coveredtx[transactionHash] == undefined)) {
                            txs.push(tx);
                            crawler.coveredtx[tx.hash] = ts;
                        }
                    }
                }
                if (txs.length) {
                    txs = await ethTool.processTranssctions(txs, crawler.contractABIs, crawler.contractABISignatures);
                    for (let i = 0; i < txs.length; i++) {
                        let tx = txs[i];
                        tx.blockHash = ""; // if ( tx.blockHash != undefined) delete tx.blockHash;
                        tx.blockNumber = 0; // if ( tx.blockNumber != undefined ) delete tx.blockNumber;
                        tx.transactionIndex = -1; // if ( tx.transactionIndex != undefined) delete tx.transactionIndex;
                        tx.chainID = chain.chainID;
                        tx.timestamp = ts;
                    }
                    await crawler.processPendingEVMTransactions(txs);
                } else if (ts % 60 == 0) {

                    for (const txhash of Object.keys(crawler.coveredtx)) {
                        if (crawler.coveredtx[txhash] < ts - 60) {
                            delete crawler.coveredtx[txhash];
                        }
                    }
                }
            }
        }
    }

    async crawl_parachains(chainID = 2) {
        let allEndPoints = Endpoints.getAllEndpoints();
        //console.log(`allEndPoints len=${Object.keys(allEndPoints).length}`, allEndPoints)

        let knownParachains = await this.getKnownParachains()
        //console.log(`knownParachains len=${Object.keys(knownParachains).length}`, knownParachains)

        let chain = await this.setupChainAndAPI(chainID);
        let relaychain = (chainID == paraTool.chainIDPolkadot) ? 'polkadot' : 'kusama'
        var allParaIds = (await this.api.query.paras.paraLifecycles.entries()).map(([key, _]) => key.args[0].toJSON());
        var allParaTypes = (await this.api.query.paras.paraLifecycles.entries()).map(([_, v]) => v.toString()); //Parathread/Parachain

        let newParas = []
        let paraIDs = [];
        this.paraIDs = [];

        for (let x = 0; x < allParaIds.length; x++) {
            let paraID = allParaIds[x]
            let paraType = allParaTypes[x]
            let fullparaID = `${relaychain}-${paraID}`
            let targetEndpoint = allEndPoints[fullparaID]
            let para_name = `${relaychain}-${paraType.toLowerCase()}-${paraID}`

            // update chainparachain table
            paraIDs.push(`('${chainID}', '${paraID}', Now(), Now(), '${relaychain}', '${paraType}') `)
            this.paraIDs.push(paraID);

            if (targetEndpoint == undefined) {
                //console.log(`*** ${fullparaID} NOT FOUND!!!`)
            } else {
                para_name = targetEndpoint.id
                //console.log(`${fullparaID} [${para_name}] found`)
            }
            if (knownParachains[fullparaID] == undefined) {
                console.log(`** NEW para ${fullparaID} [${para_name}]`)
                // insert unknown para into chain table
                // convention: for polkadot parachain: use 4-digits paraID as chainID. for kusama parachain: add 20000 to the paraID. such that paraID is 5-degits number like 2xxxx
                // we will tentatively fill id using endpoint's ID. If it's not available, fill it with "relaychain-paraType-paraID". (we will use talisman convention to update the id in future)
                //"vals": ["id", "relaychain", "paraID", "website",  "WSEndpoint", "WSEndpoint2", "WSEndpoint3"]
                if (targetEndpoint == undefined) {
                    // targetEndpoint not found in endpoints.js. example: kusama-2021
                    let parachainID = (relaychain == 'polkadot') ? paraID : 20000 + paraID
                    newParas.push(`('${parachainID}', '${para_name}', '${relaychain}', '${paraID}', Null, Null, Null, Null) `)
                } else {
                    let parachainID = (relaychain == 'polkadot') ? paraID : 20000 + paraID
                    let website = (targetEndpoint.website != undefined) ? `'${targetEndpoint.website}'` : 'Null'
                    //console.log(`${fullparaID} len=${targetEndpoint.WSEndpoints.length}`, targetEndpoint.WSEndpoints)
                    let WSEndpoint = (targetEndpoint.WSEndpoints.length >= 1) ? `'${targetEndpoint.WSEndpoints[0]}'` : 'Null'
                    let WSEndpoint2 = (targetEndpoint.WSEndpoints.length >= 2) ? `'${targetEndpoint.WSEndpoints[1]}'` : 'Null'
                    let WSEndpoint3 = (targetEndpoint.WSEndpoints.length >= 3) ? `'${targetEndpoint.WSEndpoints[2]}'` : 'Null'
                    newParas.push(`('${parachainID}', '${para_name}', '${relaychain}', '${paraID}', ${website}, ${WSEndpoint}, ${WSEndpoint2}, ${WSEndpoint3}) `)
                }
            } else {
                //console.log(`** KNOWN para ${fullparaID} ${para_name} -- skip`)
            }
        }
        await this.upsertSQL({
            "table": "chainparachain",
            "keys": ["chainID", "paraID"],
            "vals": ["firstSeenDT", "lastUpdateDT", "relaychain", "paratype"],
            "data": paraIDs,
            "replace": ["relaychain", "paratype"],
            "replaceIfNull": ["lastUpdateDT"],
        });
        //console.log(`crawl_parachains relayChain=${relaychain} len=${paraIDs.length}`)

        //console.log(`newParas`, newParas)
        await this.upsertSQL({
            "table": "chain",
            "keys": ["chainID"],
            "vals": ["id", "relaychain", "paraID", "website", "WSEndpoint", "WSEndpoint2", "WSEndpoint3"],
            "data": newParas,
            "replace": ["id", "paraID", "website"],
            "replaceIfNull": ["relaychain", "WSEndpoint", "WSEndpoint2", "WSEndpoint3"],
        });
        this.readyToCrawlParachains = false;
    }

    async processFinalizedHead(chain, chainID, bn, finalizedHash, parentHash, isTip = false) {
        const tableChain = this.getTableChain(chainID);
        await this.initApiAtStorageKeys(chain, finalizedHash, bn);

        let blockStats = false;
        let blockTS = 0;
        let crawlBlockEVM = (chain.isEVM > 0) ? 1 : 0;
        let crawlReceiptsEVM = (chain.isEVM > 0) ? 1 : 0;
        let crawlTraceEVM = (chain.isEVM > 0) ? 1 : 0;
        let crawlBlock = 1;
        let crawlTrace = 1;
        if (bn > this.latestBlockNumber) this.latestBlockNumber = bn;
        // read the row and DELETE all the blockraw:XXX and trace:XXX rows that do NOT match the finalized hash
        // todo: delete evmblock evmreceipt evmtrace and fetch the finalized one
        const filter = {
            column: {
                cellLimit: 30
            }
        };
        let row = null;
        try {
            [row] = await tableChain.row(paraTool.blockNumberToHex(bn)).get({
                filter
            });
        } catch (err) {
            if (err.code == 404) {
                row = null;
            } else {
                console.log(err);
            }
        }
        if (row == null) {
            await this.crawl_block_trace(chain, {
                blockNumber: bn
            });
            [row] = await tableChain.row(paraTool.blockNumberToHex(bn)).get({
                filter
            });
            if (row == null) {
                console.log("no row", bn);
                return (false);
            }
        }
        try {

            let cols = [];
            let rowData = row.data;
            const blockData = rowData["blockraw"];
            const traceData = rowData["trace"];
            const eventsData = rowData["events"];
            const evmBlockData = rowData["blockrawevm"];
            const evmReceiptsData = rowData["receiptsevm"];
            const evmTraceData = rowData["traceevm"];
            let block = false;
            let events = false;
            let trace = false;
            if (blockData && eventsData) {
                for (const blockHash of Object.keys(blockData)) {
                    if (blockHash != finalizedHash) {
                        cols.push("blockraw:" + blockHash);
                        cols.push("events:" + blockHash);
                    } else {
                        crawlBlock = 0;
                        let cell = blockData[blockHash][0];
                        if (cell) {
                            block = JSON.parse(cell.value);
                            blockTS = this.get_block_timestamp(block);
                        }
                        let cellEvent = eventsData[blockHash][0];
                        if (cellEvent) {
                            events = JSON.parse(cellEvent.value);
                        }
                    }
                }
            }

            if (evmBlockData) {
                for (const blockHash of Object.keys(evmBlockData)) {
                    if (blockHash != finalizedHash) {
                        cols.push("blockrawevm:" + blockHash);
                    }
                }
            }

            if (evmReceiptsData) {
                for (const blockHash of Object.keys(evmReceiptsData)) {
                    if (blockHash != finalizedHash) {
                        cols.push("receiptsevm:" + blockHash);
                    }
                }
            }

            if (evmTraceData) {
                for (const blockHash of Object.keys(evmTraceData)) {
                    if (blockHash != finalizedHash) {
                        cols.push("traceevm:" + blockHash);
                    }
                }
            }

            if (traceData) {
                for (const blockHash of Object.keys(traceData)) {
                    if (blockHash != finalizedHash) {
                        cols.push("trace:" + blockHash);
                    } else {
                        crawlTrace = 0;
                        let cellTrace = traceData[blockHash][0];
                        if (cellTrace) {
                            trace = JSON.parse(cellTrace.value);
                        }
                    }
                }
            }
            // if we didn't get a trace, or if we are using onfinality endpoint
            if ((chain.onfinalityStatus == "Active" && chain.onfinalityID && (chain.onfinalityID.length > 0) || (chain.WSEndpointSelfHosted)) &&
                ((trace == false || trace.length == 0 || this.APIWSEndpoint.includes("onfinality")))) {
                let trace2 = await this.crawlTrace(chain, finalizedHash);
                if (trace2.length > 0) {
                    trace = trace2;
                }
            }

            if (cols.length > 0) {
                await row.deleteCells(cols);
            }
            if (block && events) {
                let rRow = {
                    block,
                    events,
                    trace,
                    blockHash: finalizedHash,
                }
                //todo: missing rRow.blockHash

                //store evmBlock here?
                if (this.web3Api) {
                    let evmBlock = await ethTool.crawlEvmBlock(this.web3Api, bn)
                    let evmReceipts = await ethTool.crawlEvmReceipts(this.web3Api, evmBlock) // this is using the result from previous call
                    let evmTrace = false // (chainID == paraTool.chainIDMoonbeam || chainID == paraTool.chainIDMoonriver) ? await this.crawlEvmTrace(chain, bn) : false;

                    await this.save_evm_block(chainID, bn, finalizedHash, evmBlock, evmReceipts, evmTrace)
                    rRow.evmBlock = evmBlock;
                    rRow.evmReceipts = evmReceipts;
                    rRow.evmTrace = evmTrace;
                    if (evmBlock) crawlBlockEVM = 0;
                    if (evmReceipts) crawlReceiptsEVM = 0;
                    if (evmTrace) crawlTraceEVM = 0;
                }
                let isSignedBlock = false

                let refreshAPI = false
                let isTip = true
                let finalized = true
                //index_chain_block_row(r, signedBlock = false, write_bq_log = false, refreshAPI = false, isTip = false, isFinalized = true, traceParseTS = 1670544000)
                let r = await this.index_chain_block_row(rRow, isSignedBlock, false, refreshAPI, isTip, finalized);
                blockStats = r.blockStats;
                // IMMEDIATELY flush all address feed + hashes (txs + blockhashes)
                await this.flush(block.blockTS, bn, false, isTip); //ts, bn, isFullPeriod, isTip
            }
        } catch (err) {
            console.log(`err`, err)
            this.logger.error({
                "op": "subscribeFinalizedHeads",
                chainID,
                bn,
                err
            })
        }

        // write to BigTable
        try {
            let cres = {
                key: paraTool.blockNumberToHex(bn),
                data: {
                    finalized: {}
                }
            };
            cres['data']['finalized'][finalizedHash] = {
                value: "1",
                timestamp: new Date()
            }
            await tableChain.insert([cres]);
            let indexUpdateInterval = Math.floor(Math.random() * 5000);
            // write to MySQL
            if (blockTS > 0) {
                let numExtrinsics = blockStats && blockStats.numExtrinsics ? blockStats.numExtrinsics : 0
                let numSignedExtrinsics = blockStats && blockStats.numSignedExtrinsics ? blockStats.numSignedExtrinsics : 0
                let numTransfers = blockStats && blockStats.numTransfers ? blockStats.numTransfers : 0
                let numEvents = blockStats && blockStats.numEvents ? blockStats.numEvents : 0
                let valueTransfersUSD = blockStats && blockStats.valueTransfersUSD ? blockStats.valueTransfersUSD : 0
                let fees = blockStats && blockStats.fees ? blockStats.fees : 0;
                let eflds = "";
                let evals = "";
                let eupds = "";
                if (chain.isEVM) {
                    let blockHashEVM = blockStats.blockHashEVM ? blockStats.blockHashEVM : "";
                    let parentHashEVM = blockStats.parentHashEVM ? blockStats.parentHashEVM : "";
                    let numTransactionsEVM = blockStats.numTransactionsEVM ? blockStats.numTransactionsEVM : 0;
                    let numTransactionsInternalEVM = blockStats.numTransactionsInternalEVM ? blockStats.numTransactionsInternalEVM : 0;
                    let numReceiptsEVM = blockStats.numReceiptsEVM ? blockStats.numReceiptsEVM : 0;
                    let gasUsed = blockStats.gasUsed ? blockStats.gasUsed : 0;
                    let gasLimit = blockStats.gasLimit ? blockStats.gasLimit : 0;
                    eflds = ", blockHashEVM, parentHashEVM, numTransactionsEVM, numTransactionsInternalEVM, numReceiptsEVM, gasUsed, gasLimit, crawlBlockEVM, crawlReceiptsEVM, crawlTraceEVM";
                    evals = `, '${blockHashEVM}', '${parentHashEVM}', '${numTransactionsEVM}', '${numTransactionsInternalEVM}', '${numReceiptsEVM}', '${gasUsed}', '${gasLimit}', ${crawlBlockEVM}, ${crawlReceiptsEVM}, ${crawlTraceEVM}`;
                    eupds = ", blockHashEVM = values(blockHashEVM), parentHashEVM = values(parentHashEVM), numTransactionsEVM = values(numTransactionsEVM), numTransactionsInternalEVM = values(numTransactionsInternalEVM), numReceiptsEVM = values(numReceiptsEVM), gasUsed = values(gasUsed), gasLimit = values(gasLimit), crawlBlockEVM = values(crawlBlockEVM), crawlReceiptsEVM = values(crawlReceiptsEVM), crawlTraceEVM = values(crawlTraceEVM)";
                }
                let sql = `insert into block${chainID} (blockNumber, blockHash, parentHash, numExtrinsics, numSignedExtrinsics, numTransfers, numEvents, valueTransfersUSD, fees, blockDT, crawlBlock, crawlTrace ${eflds}) values ('${bn}', '${finalizedHash}', '${parentHash}', '${numExtrinsics}', '${numSignedExtrinsics}', '${numTransfers}', '${numEvents}', '${valueTransfersUSD}', '${fees}', FROM_UNIXTIME('${blockTS}'), '${crawlBlock}', '${crawlTrace}' ${evals}) on duplicate key update blockHash=values(blockHash), parentHash = values(parentHash), blockDT=values(blockDT), numExtrinsics = values(numExtrinsics), numSignedExtrinsics = values(numSignedExtrinsics), numTransfers = values(numTransfers), numEvents = values(numEvents), valueTransfersUSD = values(valueTransfersUSD), fees = values(fees), crawlBlock = values(crawlBlock), crawlTrace = values(crawlTrace) ${eupds}`;
                this.batchedSQL.push(sql);
                // mark that the PREVIOUS hour is ready for indexing, since this block is FINALIZED, so that continuously running "indexChain" job can index the newly finalized hour
                await this.markFinalizedReadyForIndexing(chain, blockTS);
                let sql2 = `insert into chain ( chainID, blocksCovered, blocksFinalized, lastFinalizedDT ) values ( '${chainID}', '${bn}', '${bn}', Now() ) on duplicate key update blocksFinalized = values(blocksFinalized), lastFinalizedDT = values(lastFinalizedDT), blocksCovered = IF( blocksCovered < values(blocksFinalized), values(blocksFinalized), blocksCovered )`
                this.batchedSQL.push(sql2);
                if (bn % 10 == 0) {
                    let sqltmp = `update chainhostnameendpoint set updateDT = Now() where chainID = '${chainID}' and hostname = '${this.hostname}'`
                    this.batchedSQL.push(sqltmp);
                }
                if (bn % 5000 == indexUpdateInterval) {
                    // every 5000 blocks, push 24 hours of onto indexlog from blocklog
                    let sqltmp = `select floor(unix_timestamp(blockDT)/3600)*3600 as f from block${chainID} where blockDT >= date(date_sub(Now(), interval 24 hour)) group by f`
                    let blocklog = await this.poolREADONLY.query(sqltmp)
                    let out = [];
                    for (const s of blocklog) {
                        let [logDT0, hr0] = paraTool.ts_to_logDT_hr(s.f);
                        out.push(`('${chainID}', '${s.f}', '${logDT0}', '${hr0}', 1)`)
                    }
                    let valstmp = ["indexTS", "logDT", "hr", "readyForIndexing"]
                    await this.upsertSQL({
                        "table": "indexlog",
                        "keys": ["chainID"],
                        "vals": valstmp,
                        "data": out,
                        "replace": valstmp
                    });
                }
                let sql4 = `delete from blockunfinalized where chainID = '${chainID}' and blockNumber < '${bn}'`
                this.batchedSQL.push(sql4);

                var runtimeVersion = await this.api.rpc.state.getRuntimeVersion(finalizedHash)
                let specVersion = runtimeVersion.toJSON().specVersion;
                if (this.metadata[specVersion] == undefined) {
                    await this.getSpecVersionMetadata(chain, specVersion, finalizedHash, bn);
                }

                console.log("subscribeFinalizedHeads", chain.chainName, bn, `CHECK: cbt read chain${chainID} prefix=` + paraTool.blockNumberToHex(bn), "|  ", sql2);
                await this.update_batchedSQL();

                if (this.readyToCrawlParachains && (chainID == paraTool.chainIDPolkadot || chainID == paraTool.chainIDKusama)) {
                    await this.crawl_parachains(chainID);
                }
                if (bn % 7200 == 0) { // 1-2x/day
                    try {
                        await this.setup_chainParser(chain, paraTool.debugNoLog, true);
                    } catch (e1) {}

                }
            } else {
                if (this.debugLevel > paraTool.debugVerbose) console.log(`!!!! processFinalizedHead bn=${bn}, finalizedHash=${finalizedHash}, parentHash=${parentHash}, isTip=${isTip}, blockTS missing`)
            }
        } catch (err) {
            if (err.toString().includes("disconnected")) {
                console.log(err);
            } else {
                this.logger.error({
                    "op": "subscribeFinalizedHeads",
                    chainID,
                    err
                })
            }
        }
    }

    async check_chain_endpoint_correctness(chain) {
        try {
            let bn = chain.blocksFinalized - 100;
            let sql = `select blockNumber, blockHash, parentHash from block${chain.chainID} where blockNumber >= ${bn} and length(blockHash) > 40 and length(parentHash) > 40 limit 20`
            let blocks = await this.poolREADONLY.query(sql);
            if (blocks.length > 0) {
                let bHash = blocks[0].blockHash;
                let header = await this.api.rpc.chain.getHeader(bHash);
                let parentHash = header.parentHash.toString();
                let success = (blocks[0].parentHash == parentHash);
                if (success == false) {
                    console.log(`FATAL: FAILED to match chain @ blockNumber: ${blocks[0].blockNumber} expected ${blocks[0].parentHash} got ${parentHash}`);
                    process.exit(1);
                } else {
                    console.log(`PASSED check`)
                }
            }
        } catch (e) {
            console.log(e);
        }
    }

    async setup_ably_client(chain) {
        // TODO: bring key in from config, change
        this.ably_client = new Ably.Realtime("DTaENA.R5SR9Q:MwHuRIr84rCik0WzUqp3SVZ9ZKmKCxXc9ytypJXnYgc");
        await this.ably_client.connection.once('connected');
        this.ably_channel_xcmindexer = this.ably_client.channels.get("xcm-indexer");
        this.ably_channel_xcminfo = this.ably_client.channels.get("xcminfo");
        let crawler = this;
        this.ably_channel_xcmindexer.subscribe(async function(message) {
            await crawler.process_indexer_message(chain, message);
        });
    }

    async process_indexer_message(chain, message) {
        // if the incoming xcmtransfer is a chainIDDest matching our indexer's chainID, then record a starting balance in xcmtransfers_beneficiary
        try {
            let msg = message.data;
            if (msg.beneficiary != undefined && (msg.chainIDDest == this.chainID)) {
                await this.process_indexer_xcmtransfer(chain, msg);
            }
        } catch (err) {
            this.logger.error({
                "op": "process_indexer_message ERROR",
                err
            });
        }
    }

    async process_indexer_crawlBlock(chain, crawlBlock) {
        try {
            let blockNumber = crawlBlock.blockNumber;
            if (chain.isEVM) {
                crawlBlock.crawlBlockEVM = 1;
                crawlBlock.crawlReceiptsEVM = 1;
                crawlBlock.crawlTraceEVM = 1;
            }
            await this.crawl_block_trace(chain, crawlBlock)
            let blockHash = await this.getBlockHashFinalized(chain.chainID, blockNumber);
            this.logger.error({
                "op": "process_indexer_crawlBlock READY",
                crawlBlock,
                blockHash,
                chain
            });
            let res = await this.index_block(chain, blockNumber, blockHash);
            this.logger.error({
                "op": "process_indexer_crawlBlock SUCC",
                blockNumber,
                blockHash,
                res
            });
        } catch (err) {
            this.logger.error({
                "op": "process_indexer_crawlBlock ERROR",
                crawlBlock,
                chain
            });
        }
    }

    isWSEndpointSelfHosted() {
        if (this.APIWSEndpoint && ((this.APIWSEndpoint.includes("polkaholic") || this.APIWSEndpoint.includes("dotswap")))) {
            return (true)
        }
        return (false);
    }

    async crawlEVM(chainID) {
        let chain = await this.getChain(chainID);

        const Web3 = require('web3')
        const bigquery = this.get_big_query();
        await this.initEvmSchemaMap()
        if (!(chain.isEVM > 0 && chain.WSEndpoint)) {
            return (false);
        }
        const web3 = new Web3(chain.WSEndpoint);
        this.web3Api = web3;
        this.contractABIs = await this.getContractABI();
        let contractABIs = this.contractABIs;
        let contractABISignatures = this.contractABISignatures;
        await this.assetManagerInit()


	function connectToWeb3Node() {
	    web3.eth.net.isListening()
		.then(() => {
		    console.log('Web3 connected to node', web3.currentProvider.host);
		})
		.catch((err) => {
		    console.log('Web3 connection failed', err);
		    setTimeout(() => {
			connectToWeb3Node();
		    }, 2000);
		})
	}
	
        web3.eth.subscribe('newBlockHeaders', async (error, result) => {
            if (!error) {
                console.log(`newBlockHeaders`, result)
                let blockNumber = result.number;
                let block = null;
                let block_tries = 0;
                do {
                    try {
                        block = await web3.eth.getBlock(result.hash, true);
                        block_tries++;
                    } catch (err) {
                        // console.log("crawlEVM", result, err);
                    }
                } while (!block && block_tries < 10)
                let numTransactions = block && block.transactions ? block.transactions.length : 0;
                let rows_blocks = [];
                let rows_transactions = [];
                let rows_logs = [];
                try {
                    if (numTransactions >= 0) {
                        console.log(`[#${block.number}] ${block.hash} numTransactions=${numTransactions}`)
                        let isParallel = true
                        let log_tries = 0
                        let evmReceipts = false
                        do {
                            try {
                                evmReceipts = await ethTool.crawlEvmReceipts(web3, block, isParallel);
                                console.log(`[#${block.number}] evmReceipts trial${log_tries}`, )
                                log_tries++;
                            } catch (err) {
                                console.log(`crawlEVM Failed ${log_tries}`, err);
                            }
                        } while (!evmReceipts && log_tries < 10)
                        if (!evmReceipts) evmReceipts = [];
                        console.log(`[#${block.number}] evmReceipts DONE (len=${evmReceipts.length})`)
                        var statusesPromise = Promise.all([
                            ethTool.processTranssctions(block.transactions, contractABIs, contractABISignatures),
                            ethTool.processReceipts(evmReceipts, contractABIs, contractABISignatures)
                        ])
                        let [dTxns, dReceipts] = await statusesPromise
                        let evmTrace = false
                        await this.stream_evm(block, dTxns, dReceipts, evmTrace, chainID, contractABIs, contractABISignatures)
                    }
                } catch (err) {
                    console.log(`crawlEvmReceipts err`, err)
                }
            } else {
                console.error(error);
            }
        });
        web3.eth.subscribe('logs', (error, result) => {
            if (!error) {
                //console.log("LOGS", result);
            } else {
                console.error(error);
            }
        });
    }

    async crawlBlocks(chainID) {
        if (chainID == paraTool.chainIDPolkadot || chainID == paraTool.chainIDKusama) {
            this.readyToCrawlParachains = true;
        }
        if (chainID == 1 || chainID == 10 || chainID == 56 || chainID == 137 || chainID == 42161 || chainID == 43114) {
            //console.log("loading evm");
            //await this.load_calls_events("evm_dev");
            this.crawlEVM(chainID);
            return [null, null, null];
        } else {
            console.log("loading substrate");
            await this.load_calls_events("substrate_dev");
        }

        // Subscribe to chain updates and log the current block number on update.
        let chain = await this.setupChainAndAPI(chainID);
        await this.check_chain_endpoint_correctness(chain);
        await this.setup_ably_client(chain);

        await this.setup_chainParser(chain, paraTool.debugNoLog, true);
        if (chain.WSEndpointSelfHosted == 1) {
            if (chain.isEVM) {
                setInterval(this.crawlTxpoolContent, 1000, chain, this);
            }
            setInterval(this.crawlPendingExtrinsics, 1000, chain, this);
        }

        // refresh assets + contractABI every 5-10m
        setInterval(this.autoRefreshAssetManager, Math.round(300000 + Math.random() * 300000), this);

        // health check every min, if stalled for 5min, terminate crawler accordingly
        setInterval(this.selfTerminate, Math.round(60000), this);

        if (chain.blocksFinalized) this.finalizedHashes[chain.blocksFinalized] = "known";
        const unsubscribeFinalizedHeads = await this.api.rpc.chain.subscribeFinalizedHeads(async (header) => {
            this.lastEventReceivedTS = this.getCurrentTS(); // if no event received in 5mins, restart
            let bn = parseInt(header.number.toString(), 10);
            let finalizedHash = header.hash.toString();
            if (chainID == paraTool.chainIDMangataX) {
                let trueFinalizedHash = await this.api.rpc.chain.getBlockHash(header.number);
                if (finalizedHash != trueFinalizedHash) {
                    //if (this.debugLevel > paraTool.debugInfo) console.log(`subscribeFinalizedHeads updateFinalizedHash=${trueFinalizedHash}(was:${finalizedHash})`)
                    finalizedHash = trueFinalizedHash.toHex()
                }
            }
            let parentHash = header.parentHash.toString();
            let subscribeFinalizedHeadsMsg = {
                "bn": bn,
                "chainID": chainID
            }

            await this.processFinalizedHead(chain, chainID, bn, finalizedHash, parentHash, true);
            this.finalizedHashes[bn] = finalizedHash;
            // because we do not always get the finalized hash signal, we brute force use the parentHash => grandparentHash => greatgrandparentHash => greatgreatgrandparentHash  (3 up)
            let b = bn - 1;
            let bHash = parentHash;
            let bMin = (bn > 10) ? bn - 10 : 1;

            let queue = [];
            while (this.finalizedHashes[b] == undefined && (b > bMin)) {
                let bHeader = await this.api.rpc.chain.getHeader(bHash);
                let bparentHash = bHeader.parentHash.toString();
                this.finalizedHashes[b] = bHash;
                queue.push({
                    b,
                    bHash,
                    bparentHash
                });
                b--;
                bHash = bparentHash;
            }
            if (this.debugLevel > paraTool.debugVerbose) console.log(`finalized queue`, queue)
            for (let i = 0; i < queue.length; i++) {
                let q = queue[i];
                await this.processFinalizedHead(chain, chainID, q.b, q.bHash, q.bparentHash, true); // it's safe to pass true here. lastCrawlBN will prevent update using older state
            }
            // clean up old entries to avoid memory explosion
            if (this.finalizedHashes[bn - 11] !== undefined) {
                delete this.finalizedHashes[bn - 11];
            }
        });

        let unsubscribeRuntimeVersion = await this.api.rpc.state.subscribeRuntimeVersion(async (results) => {
            var runtimeVersion = await this.api.rpc.state.getRuntimeVersion()
            let specVersion = runtimeVersion.toJSON().specVersion;
            //this.logger.warn({"op": "subscribeRuntimeVersion", chainID, "specVersion": specVersion})
            // this will refresh the metadata and get new storage keys for the most recent spec
            await this.getSpecVersionMetadata(chain, specVersion, false, 0);

        });

        // subscribeStorage returns changes from ALL blockHashes, including the ones that eventually got dropped
        let unsubscribeStorage = null
        this.blocksCovered = chain.blocksCovered;

        try {
            if (this.isWSEndpointSelfHosted()) {
                unsubscribeStorage = await this.api.rpc.state.subscribeStorage(async (results) => {
                    try {
                        this.lastEventReceivedTS = this.getCurrentTS(); // if not received in 5mins, reset
                        // build block similar to sidecar
                        let blockHash = results.block.toHex();
                        let [signedBlock, events] = await this.crawlBlock(this.api, results.block.toHex());
                        let blockTS = signedBlock.blockTS;

                        // to avoid 'hash' error, we create the a new block copy without decoration and add hash in
                        let block = JSON.parse(JSON.stringify(signedBlock));
                        block.number = paraTool.dechexToInt(block.header.number);
                        block.hash = blockHash;
                        block.blockTS = blockTS;
                        let blockNumber = block.number;
                        let subscribeStorageMsg = {
                            "bn": blockNumber,
                            "chainID": chainID
                        }

                        // get trace from block
                        let trace = [];
                        let traceType = "subscribeStorage";
                        let traceBlock = await this.api.rpc.state.traceBlock(blockHash, "state", "", "Put");
                        let traceBlockJSON = traceBlock.toJSON();
                        if (traceBlockJSON) {
                            if (traceBlockJSON.blockTrace && traceBlockJSON.blockTrace.events) {
                                let events = []
                                let changes = traceBlockJSON.blockTrace.events.forEach((e) => {
                                    let x = this.canonicalize_trace_stringValues(e.data.stringValues);
                                    if (x) {
                                        events.push(x);
                                    }
                                })
                                if (events.length > 0) {
                                    traceType = "state_traceBlock"
                                    trace = events;
                                }
                            }
                        } else {
                            if (this.debugLevel > paraTool.debugVerbose) console.log(`BN#${block.number} ${blockHash} no traceBlock!`)
                        }

                        if (blockNumber > this.latestBlockNumber) this.latestBlockNumber = blockNumber;
                        let evmBlock = false
                        let evmReceipts = false
                        let evmTrace = false

                        // write { blockraw:blockHash => block, trace:blockHash => trace, events:blockHash => events } to bigtable
                        let success = await this.save_block_trace(chainID, block, blockHash, events, trace, false, traceType);
                        if (success) {
                            // write to mysql
                            let blockTS = block.blockTS;
                            if (blockTS > 0) {
                                this.apiAt = this.api //set here for opaqueCall  // TODO: what if metadata changes?
                                let signedExtrinsicBlock = block
                                signedExtrinsicBlock.extrinsics = signedBlock.extrinsics //add signed extrinsics
                                // IMPORTANT NOTE: we only need to do this for evm chains... (review)
                                let isFinalized = false
                                let isTip = true
                                let isTracesPresent = success // true here

                                let autoTraces = await this.processTraceAsAuto(blockTS, blockNumber, blockHash, this.chainID, trace, traceType, this.api, isFinalized);
                                await this.processTraceFromAuto(blockTS, blockNumber, blockHash, this.chainID, autoTraces, traceType, this.api, isFinalized); // use result from rawtrace to decorate

                                //processBlockEvents(chainID, block, eventsRaw, evmBlock = false, evmReceipts, evmTrace, autoTraces, finalized = false, unused = false, isTip = false, tracesPresent = false)
                                let [blockStats, xcmMeta] = await this.processBlockEvents(chainID, signedExtrinsicBlock, events, evmBlock, evmReceipts, evmTrace, autoTraces, isFinalized, false, isTip, isTracesPresent);

                                await this.immediateFlushBlockAndAddressExtrinsics(true) //this is tip
                                if (blockNumber > this.blocksCovered) {
                                    // only update blocksCovered in the DB if its HIGHER than what we have seen before
                                    var sql = `update chain set blocksCovered = '${blockNumber}', lastCrawlDT = Now() where chainID = '${chainID}' and blocksCovered < ${blockNumber}`
                                    this.batchedSQL.push(sql);
                                    this.blocksCovered = blockNumber;
                                }
                                let numExtrinsics = blockStats && blockStats.numExtrinsics ? blockStats.numExtrinsics : 0
                                let numSignedExtrinsics = blockStats && blockStats.numSignedExtrinsics ? blockStats.numSignedExtrinsics : 0
                                let numTransfers = blockStats && blockStats.numTransfers ? blockStats.numTransfers : 0
                                let numEvents = blockStats && blockStats.numEvents ? blockStats.numEvents : 0
                                let valueTransfersUSD = blockStats && blockStats.valueTransfersUSD ? blockStats.valueTransfersUSD : 0
                                let fees = blockStats && blockStats.fees ? blockStats.fees : 0
                                let vals = ["numExtrinsics", "numSignedExtrinsics", "numTransfers", "numEvents", "valueTransfersUSD", "fees", "lastTraceDT"]
                                let evals = "";
                                if (chain.isEVM) {
                                    let blockHashEVM = blockStats.blockHashEVM ? blockStats.blockHashEVM : "";
                                    let parentHashEVM = blockStats.parentHashEVM ? blockStats.parentHashEVM : "";
                                    let numTransactionsEVM = blockStats.numTransactionsEVM ? blockStats.numTransactionsEVM : 0;
                                    let numTransactionsInternalEVM = blockStats.numTransactionsInternalEVM ? blockStats.numTransactionsInternalEVM : 0;
                                    let numReceiptsEVM = blockStats.numReceiptsEVM ? blockStats.numReceiptsEVM : 0;
                                    let gasUsed = blockStats.gasUsed ? blockStats.gasUsed : 0;
                                    let gasLimit = blockStats.gasLimit ? blockStats.gasLimit : 0;
                                    vals.push("blockHashEVM", "parentHashEVM", "numTransactionsEVM", "numTransactionsInternalEVM", "numReceiptsEVM", "gasUsed", "gasLimit");
                                    evals = `, '${blockHashEVM}', '${parentHashEVM}', '${numTransactionsEVM}', '${numTransactionsInternalEVM}', '${numReceiptsEVM}', '${gasUsed}', '${gasLimit}'`;
                                }

                                let out = `('${blockNumber}', '${numExtrinsics}', '${numSignedExtrinsics}', '${numTransfers}', '${numEvents}', '${valueTransfersUSD}', '${fees}', from_unixtime(${blockTS}) ${evals} )`;
                                await this.upsertSQL({
                                    "table": `block${chainID}`,
                                    "keys": ["blockNumber"],
                                    "vals": vals,
                                    "data": [out],
                                    "replace": vals
                                });
                                //store unfinalized blockHashes in a single table shared across chains
                                let outunf = `('${chainID}', '${blockNumber}', '${blockHash}', '${numExtrinsics}', '${numSignedExtrinsics}', '${numTransfers}', '${numEvents}', '${valueTransfersUSD}', '${fees}', from_unixtime(${blockTS}) ${evals} )`;
                                let vals2 = [...vals]; // same as other insert, but with
                                vals2.unshift("blockHash");
                                await this.upsertSQL({
                                    "table": "blockunfinalized",
                                    "keys": ["chainID", "blockNumber"],
                                    "vals": vals2,
                                    "data": [outunf],
                                    "replace": vals
                                })

                                //console.log(`****** subscribeStorage ${chain.chainName} bn=${blockNumber} ${blockHash}: cbt read chain${chainID} prefix=` + paraTool.blockNumberToHex(parseInt(blockNumber, 10)));
                                await this.update_batchedSQL();
                            } else {
                                if (this.debugLevel > paraTool.debugErrorOnly) console.log(`BN#${block.number} ${blockHash} blockTS missing!!!`)
                            }
                        } else {
                            this.logger.warn({
                                "op": "subscribeStorage",
                                chainID,
                                blockNumber
                            })
                        }
                    } catch (err) {
                        if (err.toString().includes("disconnected")) {
                            console.log(err);
                        } else {
                            console.log(err);
                            this.logger.error({
                                "op": "subscribeStorage",
                                chainID,
                                err
                            })
                        }
                    }
                });
            } else {
                // subscribeNewHeads -- most of this code is similar to the above...
                const unsubscribeStorage = await this.api.rpc.chain.subscribeNewHeads(async (header) => {
                    try {
                        this.lastEventReceivedTS = this.getCurrentTS(); // if not received in 5mins, reset
                        // build block similar to sidecar
                        let blockHash = header.hash.toString();
                        let [signedBlock, events] = await this.crawlBlock(this.api, blockHash);
                        let blockTS = signedBlock.blockTS;
                        let traceType = "subscribeStorage";

                        // to avoid 'hash' error, we create the a new block copy without decoration and add hash in
                        let block = JSON.parse(JSON.stringify(signedBlock));
                        block.number = paraTool.dechexToInt(block.header.number);
                        block.hash = blockHash;
                        block.blockTS = blockTS;
                        let blockNumber = block.number;
                        let subscribeStorageMsg = {
                            "bn": blockNumber,
                            "chainID": chainID
                        }
                        if (blockNumber > this.latestBlockNumber) this.latestBlockNumber = blockNumber;
                        let trace = [];
                        // write { blockraw:blockHash => block, trace:blockHash => trace, events:blockHash => events } to bigtable
                        let success = await this.save_block_trace(chainID, block, blockHash, events, trace, false, traceType);
                        if (success) {
                            // write to mysql
                            let blockTS = block.blockTS;
                            if (blockTS > 0) {
                                this.apiAt = this.api //set here for opaqueCall  // TODO: what if metadata changes?
                                let signedExtrinsicBlock = block
                                signedExtrinsicBlock.extrinsics = signedBlock.extrinsics //add signed extrinsics
                                let isFinalized = false
                                let isTip = true
                                let isTracesPresent = false

                                let autoTraces = await this.processTraceAsAuto(blockTS, blockNumber, blockHash, this.chainID, trace, traceType, this.api, isFinalized);

                                await this.processTraceFromAuto(blockTS, blockNumber, blockHash, this.chainID, autoTraces, traceType, this.api, isFinalized); // use result from rawtrace to decorate

                                //processBlockEvents(chainID, block, eventsRaw, evmBlock = false, evmReceipts, evmTrace, autoTraces, finalized = false, unused = false, isTip = false, tracesPresent = false)
                                let [blockStats, xcmMeta] = await this.processBlockEvents(chainID, signedExtrinsicBlock, events, false, false, false, [], isFinalized, false, isTip, isTracesPresent);

                                await this.immediateFlushBlockAndAddressExtrinsics(true) //this is tip
                                if (blockNumber > this.blocksCovered) {
                                    // only update blocksCovered in the DB if its HIGHER than what we have seen before
                                    var sql = `update chain set blocksCovered = '${blockNumber}', lastCrawlDT = Now() where chainID = '${chainID}' and blocksCovered < ${blockNumber}`
                                    this.batchedSQL.push(sql);
                                    this.blocksCovered = blockNumber;
                                }
                                let numExtrinsics = blockStats && blockStats.numExtrinsics ? blockStats.numExtrinsics : 0
                                let numSignedExtrinsics = blockStats && blockStats.numSignedExtrinsics ? blockStats.numSignedExtrinsics : 0
                                let numTransfers = blockStats && blockStats.numTransfers ? blockStats.numTransfers : 0
                                let numEvents = blockStats && blockStats.numEvents ? blockStats.numEvents : 0
                                let valueTransfersUSD = blockStats && blockStats.valueTransfersUSD ? blockStats.valueTransfersUSD : 0
                                let fees = blockStats && blockStats.fees ? blockStats.fees : 0
                                let vals = ["numExtrinsics", "numSignedExtrinsics", "numTransfers", "numEvents", "valueTransfersUSD", "fees", "lastTraceDT"]
                                let evals = "";
                                let out = `('${blockNumber}', '${numExtrinsics}', '${numSignedExtrinsics}', '${numTransfers}', '${numEvents}', '${valueTransfersUSD}', '${fees}', from_unixtime(${blockTS}) ${evals} )`;
                                await this.upsertSQL({
                                    "table": `block${chainID}`,
                                    "keys": ["blockNumber"],
                                    "vals": vals,
                                    "data": [out],
                                    "replace": vals
                                });
                                //store unfinalized blockHashes in a single table shared across chains
                                let outunf = `('${chainID}', '${blockNumber}', '${blockHash}', '${numExtrinsics}', '${numSignedExtrinsics}', '${numTransfers}', '${numEvents}', '${valueTransfersUSD}', '${fees}', from_unixtime(${blockTS}) ${evals} )`;
                                let vals2 = [...vals]; // same as other insert, but with
                                console.log("***** subscribeNewHeads", blockHash, blockNumber);
                                vals2.unshift("blockHash");
                                await this.upsertSQL({
                                    "table": "blockunfinalized",
                                    "keys": ["chainID", "blockNumber"],
                                    "vals": vals2,
                                    "data": [outunf],
                                    "replace": vals
                                })

                                await this.update_batchedSQL();
                            } else {
                                if (this.debugLevel > paraTool.debugErrorOnly) console.log(`BN#${block.number} ${blockHash} blockTS missing!!!`)
                            }
                        } else {
                            this.logger.warn({
                                "op": "subscribeNewHeads",
                                chainID,
                                blockNumber
                            })
                        }

                    } catch (err) {
                        if (err.toString().includes("disconnected")) {
                            console.log(err);
                        } else {
                            console.log(err);
                            this.logger.error({
                                "op": "subscribeStorage",
                                chainID,
                                err
                            })
                        }
                    }
                });
            }
        } catch (errus) {
            console.log(errus);
            unsubscribeStorage = false
        }

        return [unsubscribeFinalizedHeads, unsubscribeStorage, unsubscribeRuntimeVersion];
    }

}
