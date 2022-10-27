//const Web3 = require('web3');

class XCMClient {
    // holds observed extrinsic objects, each which has xcmInfo + msgHashes updated
    extrinsics = {};

    // used to parse traces
    storageKeys = {};
    parsedTraces = {};

    // holds msghash mappings ( msgHash => extrinsicHash => .. )
    msgHash = {};

    // holds assetsSent ( beneficiary => extrinsicHash => event
    assetsSent = {};

    // holds evmblocks of destination chain
    evmBlocks = {};
    contractABISignatures = {};

    clear() {
	this.extrinsics = {};
	this.msgHash = {};
	this.evmBlocks = {};
    }

    async getAPI(chainID) {
        const {
            WsProvider,
            ApiPromise,
        } = polkadotApi;
        const {
	    Keyring
	} = polkadotKeyring;

        let wsEndpoints = {
            60000: "ws://moonbase-internal.polkaholic.io:9945",
            60888: "ws://moonbase-beta-internal.polkaholic.io:9944",
            61000: "ws://moonbase-internal.polkaholic.io:9944"
        }
        let wssEndpoint = wsEndpoints[chainID];
        if (wssEndpoint == undefined) {
            console.log("No API Endpoint for chainID", chainID);
            return (null);
        }
        console.log("Connecting to chainID", chainID, wssEndpoint);

        var api = await ApiPromise.create({
            provider: new WsProvider(wssEndpoint)
        });
        await api.isReady;
        return api;
    }

    getParaIDExtra(relayChain) {
	switch (relayChain) {
        case 'polkadot':
            return 0
            break;
        case 'kusama':
            return 20000
            break;
        case 'westend':
            return 30000
            break;
        case 'rococo':
            return 40000
            break;
        case 'moonbase-relay':
            return 60000
            break;
        case 'shibuya-relay':
            return 80000
            break;
        default:
            //unknown
            return 90000
            break;
	}
    }
    getChainIDFromParaIDAndRelayChain(paraID, relayChain) {
	let paraIDExtra = this.getParaIDExtra(relayChain)
	//if ((paraID == 0) || (paraID == 2) || (paraID == 60000)) return (paraID)
	return paraIDExtra + paraID
    }

    firstCharLowerCase(inp) {
        if (inp.toUpperCase() == inp) { // if the whole thing is uppercase, then return all lowercase
            return inp.toLowerCase();
        }
        return inp.substr(0, 1).toLowerCase() + inp.substr(1)
    }
    twox_128(s) {
        let res = polkadotUtilCrypto.xxhashAsHex(s, 128)
        return res.slice(2)
    }
    toNumWithoutComma(numb)
    {
	var str = numb.toString().split(".");
	str[0] = str[0].replace(/,/g, '')
	let res = str.join(".");
	if (isNaN(res)) {
            return numb
	} else {
            return res
	}
    }

    blake2_256_from_hex(inp) {
	let res = polkadotUtilCrypto.blake2AsHex(polkadotUtil.hexToU8a(inp), 256)
	return res.slice(2)
    }
    
    // setup backedup from Relay chain trace
    ParaInclusionPendingAvailabilityBackedMap(traces) {
        let backedMap = {}
        let blockTS = 0;
        for (const t of traces) {
            if (t.p == "ParaInclusion" && (t.s == "PendingAvailability")) {
                try {
                    if (t.v == '0x') continue
                    let pendingAvailability = t.pv ? JSON.parse(t.pv) : null; // pv:
                    if (pendingAvailability) {
                        let k = JSON.parse(t.pk)
                        let paraID = this.toNumWithoutComma(k[0])
                        backedMap[paraID] = pendingAvailability
                    }
                } catch (err) {
                    console.log(`ParaInclusionPendingAvailabilityFilter error`, err)
                }
            } else if (t.p == "Timestamp" && (t.s == "Now")) {
                blockTS = Math.floor(t.pv / 1000);
            }
        }
        return [backedMap, blockTS]
    }

    get_xcm_instructions(api, msgHex) {
        try {
            let msgHash = '0x' + this.blake2_256_from_hex(msgHex);
            let xcmObj = api.registry.createType("XcmVersionedXcm", msgHex);
            return [msgHash, xcmObj.toJSON()];
        } catch (err) {
	    console.log(err);
            return [null, null];
        }
    }
    
    async indexRelayChainTrace(api, traces, blockHash, blockNumber, finalized, chainID, relayChain) {
        let [backedMap, blockTS] = this.ParaInclusionPendingAvailabilityBackedMap(traces)

        // holds a map of affected extrinsicHashes
        let extrinsicHashes = {}
        for (const t of traces) {

            if (t.p == "ParaInclusion" && (t.s == "PendingAvailabilityCommitments")) {
                try {
                    let k = JSON.parse(t.pk)
                    let paraID = parseInt(this.toNumWithoutComma(k[0]), 10)
                    let commitments = t.pv ? JSON.parse(t.pv) : null;
                    if (commitments && (commitments.upwardMessages.length > 0 || commitments.horizontalMessages.length > 0)) {
                        let backed = backedMap[paraID]
                        let sourceSentAt = backed.relayParentNumber // this is the true "sentAt" at sourceChain, same as commitments.hrmpWatermark
                        let relayedAt = blockNumber // "relayedAt" -- aka backed at this relay blockNumber
                        let includedAt = blockNumber + 1 // "includedAt" -- aka when it's being delivered to destChain
                        for (const msgHex of commitments.upwardMessages) {
                            let [msgHash, msg] = this.get_xcm_instructions(api, msgHex);
                            let umpMsg = {
                                msgType: "ump",
                                chainID: this.getChainIDFromParaIDAndRelayChain(paraID, relayChain),
                                chainIDDest: this.chainID,
                                paraID: paraID,
                                paraIDDest: 0,
                                sentAt: sourceSentAt,
                                relayedAt: relayedAt,
                                includedAt: includedAt,
                                msgHex: msgHex,
                                msg: msg,
                                msgHash: msgHash,
                                relayedBlockHash: blockHash,
                                ts: blockTS,
                                relayChain: relayChain,
                                finalized: finalized,
                                ctx: t.s,
                            }
                            let extrinsicHash = this.init_msgHash(msgHash, umpMsg, blockNumber, blockHash, finalized)
                            if (extrinsicHash) {
                                extrinsicHashes[extrinsicHash] = msgHash;
                            }
                        }
                        for (const h of commitments.horizontalMessages) {
                            let paraIDDest = parseInt(this.toNumWithoutComma(h.recipient), 10)
                            let msgHex = '0x' + h.data.substring(4).toString();
                            let [msgHash, msg] = this.get_xcm_instructions(api, msgHex);
                            let hrmpMsg = {
                                msgType: "hrmp",
                                chainID: this.getChainIDFromParaIDAndRelayChain(paraID, relayChain),
                                chainIDDest: this.getChainIDFromParaIDAndRelayChain(paraIDDest, relayChain),
                                paraID: paraID,
                                paraIDDest: paraIDDest,
                                sentAt: sourceSentAt,
                                relayedAt: relayedAt,
                                includedAt: includedAt,
                                msgHex: msgHex,
                                msg: msg,
                                msgHash: msgHash,
                                relayedBlockHash: blockHash,
                                ts: blockTS,
                                relayChain: relayChain,
                                finalized: finalized,
                                ctx: t.s,
                            }
                            let extrinsicHash = this.init_msgHash(msgHash, hrmpMsg, blockNumber, blockHash, finalized)
			    // if the msgHash has been associated with an extrinsic on the origination chain, we will emit a log
                            if (extrinsicHash) {
                                extrinsicHashes[extrinsicHash] = msgHash;
                            }
			    if (paraID == 1000 || paraID == 888) {
				console.log("HORIZONTAL", extrinsicHash, hrmpMsg)
			    }
                        }
                    }
                } catch (err) {
                    console.log(err);
                }
            } else if ((t.p == "Dmp") && (t.s == "DownwardMessageQueues")) {
                try {
                    let queues = t.pv ? JSON.parse(t.pv) : null;
                    if (queues && queues.length > 0) {
                        let k = JSON.parse(t.pk)
                        let paraIDDest = parseInt(this.toNumWithoutComma(k[0]), 10)
                        for (const q of queues) {
                            let sentAt = q.sentAt; // NO QUESTION on dmp (this is usually always the same block where xcmtransfer is initiated), sentAt = includedAt = relayedAt
                            let msgHex = q.msg;
                            let [msgHash, msg] = this.get_xcm_instructions(api, msgHex);
                            let dmpMsg = {
                                msgType: "dmp",
                                chainID: this.chainID,
                                chainIDDest: this.getChainIDFromParaIDAndRelayChain(paraIDDest, relayChain),
                                paraID: 0,
                                paraIDDest: paraIDDest,
                                sentAt: sentAt,
                                relayedAt: sentAt,
                                includedAt: sentAt,
                                msg,
                                msgHex,
                                msgHash,
                                //relayedBlockHash: TODO: blockHash for sentAt
                                ts: blockTS,
                                relayChain: relayChain,
                                finalized: finalized,
                                ctx: t.s,
                            }
                            let extrinsicHash = this.init_msgHash(msgHash, dmpMsg, blockNumber, blockHash, finalized)
                            if (extrinsicHash) {
                                extrinsicHashes[extrinsicHash] = msgHash;
                            }
                        }
                    }
                } catch (err) {
                    console.log({
                        "op": "indexRelayChainTrace - Dmp:DownwardMessageQueues",
                        "traceID": t.traceID,
                        "trace": JSON.stringify(t),
                        "err": err
                    })
                }
            }
        }
        for (const extrinsicHash of Object.keys(extrinsicHashes)) {
            let msgHash = extrinsicHashes[extrinsicHash];
            this.emitXCMInfoLog(extrinsicHash, "relaychain", finalized, blockNumber, `msgHash=${msgHash}`)
        }
    }

    combine_tx_with_receipt_status(rawTx, rawReceipt, rawTransactionStatus, idx, blockHash, blockNumber, blockTS, prevCumulativeGasUsed) {
        // TODO: reformat to match
        let tx = null;
        let gasUsed = null;
        let typ = "legacy";
        if (rawTx.eip1559) {
            tx = JSON.parse(JSON.stringify(rawTx.eip1559))
            tx.type = 2;
            typ = "eip1559";
            gasUsed = rawReceipt.eip1559.gasUsed;
        } else if (rawTx.legacy) {
            tx = JSON.parse(JSON.stringify(rawTx.legacy))
            tx.type = 1;
            gasUsed = rawReceipt.legacy.gasUsed;
        }
        if (tx) {
            tx.ts = blockTS;
            tx.timestamp = blockTS;
            tx.blockNumber = blockNumber;
            tx.transactionIndex = rawTransactionStatus.transactionIndex
            tx.hash = rawTransactionStatus.transactionHash
            tx.from = rawTransactionStatus.from
            tx.to = rawTransactionStatus.to
            tx.logs = rawTransactionStatus.logs
            //tx.gasUsed = rawReceipt[typ].usedGas
            tx.statusCode = rawReceipt[typ].statusCode
        }
        let dtx = {
            rawTx,
            rawTransactionStatus,
            rawReceipt,
            tx
        };
        let receipt = (typ == "eip1559") ? JSON.parse(JSON.stringify(rawReceipt.eip1559)) : JSON.parse(JSON.stringify(rawReceipt.legacy));
        receipt.blockHash = blockHash;
        receipt.blockNumber = blockNumber;
        receipt.contractAddress = rawTransactionStatus.contractAddress;
        receipt.cumulativeGasUsed = prevCumulativeGasUsed + receipt.usedGas
        //receipt.effectiveGasPrice = "" // check
        receipt.gasUsed = receipt.usedGas; // check
        receipt.status = receipt.statusCode; // check
        receipt.from = rawTransactionStatus.from;
        receipt.to = rawTransactionStatus.to;
        receipt.transactionHash = rawTransactionStatus.transactionHash;
        receipt.transactionIndex = rawTransactionStatus.transactionIndex
        return [tx, receipt];
    }

    convertUnfinalizedRawTraceData(current) {
        if (current.Block && current.Receipts && current.TransactionStatuses && current.evmBlockHash) {
            try {
                let receipts = [];
                let b = JSON.parse(JSON.stringify(current.Block.header));
                b.hash = current.evmBlockHash;
                b.ts = current.blockTS;
                b.timestamp = current.blockTS;
                b.transactions = [];
                let prevCumulativeGasUsed = 0;
                for (let idx = 0; idx < current.Block.transactions.length; idx++) {
                    let rawTransaction = current.Block.transactions[idx];
                    let rawReceipt = current.Receipts[idx];
                    let rawTransactionStatus = current.TransactionStatuses[idx];
                    let [tx, receipt] = this.combine_tx_with_receipt_status(rawTransaction, rawReceipt, rawTransactionStatus, idx, current.evmBlockHash, current.blockNumber, current.blockTS, prevCumulativeGasUsed);
                    if (receipt) {
                        prevCumulativeGasUsed = receipt.cumulativeGasUsed
                    }
                    b.transactions.push(tx);
                    receipts.push(receipt);
                }
                return [b, receipts];
            } catch (err) {
                console.log(err);
            }
        }
        return [null, null];
    }

    async indexDestinationChainTrace(traces, blockHash, blockNumber, results, finalized = false, paraID, id) {
        // for now, just get the EVM Block out of the destination block trace
        let [backedMap, blockTS] = this.ParaInclusionPendingAvailabilityBackedMap(traces)
        let current = {
            Block: null,
            Receipts: null,
            TransactionStatuses: null,
            blockHash,
            blockNumber,
            blockTS,
            evmBlockHash: null
        }; // note that blockHash is the Substrate block hash
        for (const t of traces) {
            if ((t.p == "Ethereum" && t.s == "CurrentBlock") && t.pv) {
                current.Block = JSON.parse(t.pv)
            }
            if ((t.p == "Ethereum" && t.s == "CurrentReceipts") && t.pv) {
                current.Receipts = JSON.parse(t.pv)
            }
            if ((t.p == "Ethereum" && t.s == "CurrentTransactionStatuses") && t.pv) {
                current.TransactionStatuses = JSON.parse(t.pv);
            }
            if ((t.p == "Ethereum" && t.s == "BlockHash")) {
                let pkExtraArr = JSON.parse(t.pk);
                if (Array.isArray(pkExtraArr) && pkExtraArr.length > 0) {
                    let bnCand = parseInt(this.toNumWithoutComma(pkExtraArr[0]), 10);
                    if (bnCand == blockNumber) {
                        // TODO: fix this -- evmBlockHash is not coming in
                        current.evmBlockHash = true;
                    }
                }
            }
        }
        let [newEVMBlock, newReceipts] = this.convertUnfinalizedRawTraceData(current);
        if (newEVMBlock && newReceipts) {
            let evmBlock = newEVMBlock;
            let evmReceipts = newReceipts;
            if (this.evmBlocks[blockNumber] == undefined) {
                this.evmBlocks[blockNumber] = {};
            } else if (finalized) {
                this.evmBlocks[blockNumber] = {}; // clean out everything else
            }
            this.evmBlocks[blockNumber][blockHash] = newEVMBlock;
            if (newEVMBlock.transactions.length > 0) {
                console.log("indexDestinationChainTrace", blockNumber, blockTS, paraID, id, newEVMBlock);
            }
        }
    }

    // because of lots of different capitalization and underscoring techniques in different pallets/sections/methods
    canonicalize_name(p) {
        return p.toLowerCase().replaceAll("_", "")
    }

    filter_pallet(pallet) {
        let pallet_canonical = this.canonicalize_name(pallet);
        let pallets = ["ethereum", "set", "timestamp", "assets_withdraw", "polkadotXcm", "XcmpQueue", "xcmPallet", "xcmTransactor", "xTokens", "xTransfer", "ParaInclusion", "assets", "Dmp", "Ump", "Hrmp", "parachainSystem"].map((p) => this.canonicalize_name(p))
        return pallets.includes(pallet_canonical);
    }

    // getSpecVersionMetadata sets up storage keys using the "pallets"
    async getSpecVersionMetadata(api) {
        let metadataRaw = await api.rpc.state.getMetadata();
        let metadata = metadataRaw.asV14.toJSON();
        var pallets = metadata.pallets;

        for (const pallet of pallets) {
            var palletName = pallet.name; // Tokens
            var storage = pallet.storage;
            if (storage && storage.items) {
                for (const item of storage.items) {
                    let storageName = item.name;
                    let storageKey = this.twox_128(palletName) + this.twox_128(storageName);
                    if (this.filter_pallet(palletName)) {
                        this.storageKeys[storageKey] = {
                            palletName,
                            storageName
                        };
                    }
                }
            }
        }
    }

    parse_trace(e, api, blockNumber, chainID, role) {
        let decodeFailed = false
        let key = e.k.slice()
        var query = api.query;
        if (key.substr(0, 2) == "0x") key = key.substr(2)

        let val = "0x"; // this is essential to cover "0" balance situations where e.v is null ... we cannot return otherwise we never zero out balances
        if (e.v) {
            val = e.v.slice()
            if (val.substr(0, 2) == "0x") val = val.substr(2)
        }

        let k = key.slice();
        if (k.length > 64) k = k.substr(0, 64);
        let sk = this.storageKeys[k];
        let o = {};
        if (!sk) {
            o.p = 'unknown'
            o.s = 'unknown'
            o.k = e.k
            o.v = e.v
            return [o, false]
        }
        // add the palletName + storageName to the object, if found
        o.p = sk.palletName;
        o.s = sk.storageName;
        if (!o.p || !o.s) {
            console.log(`k=${k} not found (${key},${val})`)
            decodeFailed = true
            o.p = 'unknown'
            o.s = 'unknown'
            o.k = e.k
            o.v = e.v
            return [o, false]
            //return ([false, false]);
        }

        let parsev = false;
        let p = this.firstCharLowerCase(o.p);
        let s = this.firstCharLowerCase(o.s);
        let kk = ''
        let vv = ''
        let pk = ''
        let pv = ''
        let debugCode = 0
        let palletSection = `${o.p}:${o.s}` //firstChar toUpperCase to match the testParseTraces tbl

        try {
            if (!query[p]) decodeFailed = true;
            if (!query[p][s]) decodeFailed = true;
            if (!query[p][s].meta) decodeFailed = true;
        } catch (er) {
            console.log("failed", p, s, er);
            decodeFailed = true
        }

        if (decodeFailed) {
            o.p = p
            o.s = s
            o.k = e.k
            o.v = e.v
            return [o, false]
        }

        let queryMeta = query[p][s].meta;
        // parse key
        try {
            kk = key;
            var skey = new polkadotTypes.StorageKey(api.registry, '0x' + key); // ???
            skey.setMeta(api.query[p][s].meta); // ????
            var parsek = skey.toHuman();
            var decoratedKey = JSON.stringify(parsek)
            o.pk = decoratedKey
        } catch (err) {
            o.pk = null;
            pk = "err"
        }
        o.k = e.k
        o.v = e.v

        // let flagged =  ( ( o.p == "ParaInclusion" && o.s == "PendingAvailabilityCommitments" || ( (o.p == "Dmp") && (o.s == "DownwardMessageQueues") ) ) && ( o.pk == '["888"]'  || o.pk == '["1,000"]'  ) && chainID == 60000 )

        let valueType = (queryMeta.type.isMap) ? queryMeta.type.asMap.value.toJSON() : queryMeta.type.asPlain.toJSON();
        try {
            let valueTypeDef = api.registry.metadata.lookup.getTypeDef(valueType).type;
            if (valueTypeDef == "u128" || valueTypeDef == "u64" || valueTypeDef == "u32" || valueTypeDef == "u64" || valueTypeDef == "Balance") {
                let v = (val.length >= 2) ? val.substr(0).slice() : "";
                parsev = polkadotUtil.hexToBn(v, {
                    isLe: true
                }).toString();
            } else {
                parsev = api.createType(valueTypeDef, "0x" + val).toString();
            }
            o.pv = parsev;
        } catch (err) {
            //console.log("parse_trace ERROR", valueType, blockNumber, role, chainID, o.k, err)
            //process.stdout.write("val=" + val);
            o.pv = null;
        }
        return [o, true]
    }

    parseEvent(evt, api = false) {
        if (!api) {
            return (false);
        }
        if (!api.events) {
            return (false);
        }

        var section = evt.section;
        var method = evt.method;
        if (!api.events[section]) {
            return (false);
        }

        var e = api.events[section][method];
        if (!e) {
            return (false);
        }
        var data = evt.data;
        var fields = e.meta.fields;

        var dType = [];
        let dEvent = {}
        dEvent.docs = e.meta.docs.toString()
        dEvent.section = section
        dEvent.method = method
        let dData = evt.data
        for (var i = 0; i < dData.length; i++) {
            let dData_i = dData[i]
            try {
                if (dData_i != undefined) {
                    if (dEvent.section == "system" && dEvent.method == "ExtrinsicFailed" && dData_i.module != undefined) {
                        // dData_i.module.msg = this.getErrorDoc(dData_i.module, api)
                        dData[i] = dData_i
                    } else if (dData_i.err != undefined && dData_i.err.module != undefined) {
                        //dData_i.err.module.msg = this.getErrorDoc(dData_i.err.module, api)
                        dData[i] = dData_i
                    }
                }
            } catch (e) {
                console.log(`parseEvent error`, e, `dData`, dData)
            }
        }
        dEvent.data = dData
        for (var i = 0; i < fields.length; i++) {
            var fld = fields[i]
            var valueType = fld.type.toJSON();
            var typeDef = api.registry.metadata.lookup.getTypeDef(valueType).type
            var name = fld.name.toString();
            var typeName = fld.typeName.toString();
            dType.push({
                typeDef: typeDef,
                name: name
            })
        }
        dEvent.dataType = dType
        return dEvent
    }

    // processEvents organizes events by index, and relays interesting events to
    processEvents(api, eventsRaw) {
        var events = {};
        for (let j = 0; j < eventsRaw.length; j++) {
            let e = eventsRaw[j].toJSON()
            let ev = eventsRaw[j].toHuman()
            let index = -1;
            if (e.phase.applyExtrinsic != undefined) {
                index = e.phase.applyExtrinsic;
            }
            if (e.phase.initialization !== undefined || e.phase.finalization !== undefined) {
                // index 0 holds { moonbeam/moonriver reward events in e.phase.initialization.
                index = 0;
            }
            if (index >= 0) {
                let event = this.parseEvent(ev.event, api);
                if (event) {
                    if (events[index] == undefined) {
                        events[index] = [];
                    }
                    events[index].push(event)
                }
            }
        }
        return events;
    }

    decorateExtrinsicArgs(extrinsic) {
        let args = extrinsic.args;
        let section = extrinsic.method.pallet;
        let method = extrinsic.method.method;
        if (section == 'ethereum' && method == 'transact') {
            if (args.transaction != undefined) {
                let evmTx = false;
                if (args.transaction.eip1559 != undefined) {
                    evmTx = args.transaction.eip1559
                } else if (args.transaction.legacy != undefined) {
                    evmTx = args.transaction.legacy
                }
                if (args.transaction.v1 != undefined) {
                    evmTx = args.transaction.v1
                }
                if (args.transaction.v2 != undefined) {
                    evmTx = args.transaction.v2
                }
                if (evmTx) {
                  /*  let output = ethTool.decodeTransactionInput(evmTx, this.contractABIs, this.contractABISignatures)
                    if (output != undefined) {
                        args.decodedEvmInput = output
                    } */
                }
            }
        }
        if (section == 'ethereumXcm' && method == 'transactThroughProxy') {
            if (args.xcm_transaction != undefined) {
                let evmTx = false;
                if (args.xcm_transaction.v1 != undefined) evmTx = args.xcm_transaction.v1
                if (args.xcm_transaction.v2 != undefined) evmTx = args.xcm_transaction.v2
                if (evmTx) {
                  /*
                    let output = ethTool.decodeTransactionInput(evmTx, this.contractABIs, this.contractABISignatures)
                    if (output != undefined) {
                        args.decodedEvmInput = output
                    } */
                }
            }
        }
    }

    async getBlockEvents(api, blockHash, blockNumber) {
        const signedBlock = await api.rpc.chain.getBlock(blockHash);
        let eventsRaw = await api.query.system.events.at(blockHash);
        let eventsIndexed = this.processEvents(api, eventsRaw);
        let events = [];
        let blockTS = 0;
        for (const e of eventsRaw) {
            let eh = e.event.toHuman();
            let ej = e.event.toJSON();

            let out = JSON.parse(JSON.stringify(e));
            let data = out.event.data;
            out.event = {};
            out.event.data = data;
            out.event.method = {};
            out.event.method['pallet'] = eh.section;
            out.event.method['method'] = eh.method;
            events.push(out);

        }

        let block = signedBlock.block;
        let header = block.header;
        //let blockNumber = header.number;
        let isSet = false;
        let extrinsics = [];
        for (let i = 0; i < block.extrinsics.length; i++) {
            let ex = block.extrinsics[i];
            let extrinsicHash = ex.hash.toHex();
            let exh = ex.method.toHuman()
            if (exh.method == "set" && exh.section == 'timestamp' && (!isSet)) {
                let exj = ex.method.toJSON();
                blockTS = Math.round((exj.args.now) / 1000);
                isSet = true;
            }
            if (this.filter_pallet(exh.section)) {
                let extrinsic = this.decode_s_extrinsic(ex, blockNumber, i, api);
                extrinsic.extrinsicHash = extrinsicHash;
                extrinsic.extrinsicID = `${blockNumber}-${i}`;
                extrinsic.blockNumber = blockNumber;
                extrinsic.ts = blockTS;
                extrinsic.events = eventsIndexed[i];
                extrinsics.push(extrinsic)
                //console.log("included extrinsic", extrinsic);
            }
        }
        block.number = blockNumber

        return [block, extrinsics, events, blockTS];
    }

    getMethodSection(callIndex, api) {
        try {
            var {
                method,
                section
            } = api.registry.findMetaCall(polkadotUtil.hexToU8a(callIndex))
            return [method, section]
        } catch (e) {
            //console.log(`getMethodSection unable to decode ${callIndex}`)
        }
        return [null, null]
    }

    decode_s_extrinsic(extrinsic, blockNumber, index, api) {
        let exos = JSON.parse(extrinsic.toString());
        let extrinsicHash = extrinsic.hash.toHex()
        let extrinsicID = blockNumber + "-" + index
        let callIndex = exos.method.callIndex
        let [method, section] = this.getMethodSection(callIndex, api)
        let pv = `${section}:${method}`

        /*
        try {
            // this is picking up utility batch with "calls" array
            if (exos && exos.method.args.calls != undefined && Array.isArray(exos.method.args.calls)) {
                this.recursive_batch_all(exos.method, api, extrinsicHash, extrinsicID, `0`)
                let exosArgsCall = exos.method.args.calls
                for (let i = 0; i < exosArgsCall.length; i++) {
                    let f = exosArgsCall[i]
                    exosArgsCall[i] = f
                }
                exos.method.args.calls = exosArgsCall
            }
        } catch (err1) {

        }
        if (exos.method.args.call != undefined) {
            this.decode_opaque_call(exos.method, api, extrinsicHash, extrinsicID, `0`)
        }
	*/
        let sig = exos.signature
        let sigTest = extrinsic.signature.toString()
        if (sigTest == '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' || sigTest == '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000') {
            sig.isSigned = false
        } else {
            sig.isSigned = true
        }

        let out = {
            method: {
                callIndex: callIndex,
                pallet: section,
                method: method,
            },
            args: exos.method.args,
            signature: sig,
        }
        return (out)
    }

    // as extrinsics (filtered by xcmtransfer/xcmtransact) are seen in the origination chain (initiated by user or not),
    // they are placed in the "extrinsics" map, keyed by extrinsicHash, with an empty skeleton
    init_extrinsic(extrinsicHash, extrinsic, paraID, id, relayChain) {
        if (this.extrinsics[extrinsicHash] == undefined) {
            this.extrinsics[extrinsicHash] = {
                extrinsic: null, // this will be filled in by the user initation or on the first unfinalized blockshould be filled in at s
                xcmInfo: {
                    origination: {
                        id: id,
                        paraID: paraID,
                        // if this extrinsic initiates a EVMTx or extrinsic, an observed extrinsic event will set these in index_origination_extrinsic
                        remoteEVMTx: null, // holds *requested* remote evmtx, filled in when first seen
                        //remoteExtrinsic: null,  // holds *requested* remote extrinsic, filled in when first seen
                        unfinalized: {}, // holds unfinalized blockHash => extrinsic until finalization
                        //finalized will hold the extrinsic
                    },
                    relayed: {
                        unfinalized: {} // holds the blockHash => msgHash => msg mapping for this extrinsic  (there can be multiple)
                        //finalized will hold the msgHash => msg
                    },
                    destination: {
                        unfinalized: {}, // holds unfinalized blockHash => { blockNumber, remoteEVMTx, remoteExtrinsic } until finalization
                        // finalized will hold the { blockNumber, remoteEVMTx, remoteExtrinsic }
                    },
                    msgHashes: [], // holds what msgHashes are initially sent by this extrinsic
                },

            }
        }
        this.extrinsics[extrinsicHash].xcmInfo.origination.id = id
        this.extrinsics[extrinsicHash].xcmInfo.origination.paraID = paraID
        if (extrinsic) {
            this.extrinsics[extrinsicHash].extrinsic = extrinsic;
            this.decorateExtrinsicArgs(extrinsic)
        }

    }


    // as messages come in (either observed from the relay chain or from the origination chain), they fill in
    // (a) this.msgHash[msgHash].msg
    // (b) this.extrinsics[extrinsicHash].xcmInfo.relayed
    //     (1) finalized[msgHash] = msg
    //     (2) unfinalized[blockHash][msgHash] = msg
    init_msgHash(msgHash, msg = null, blockNumber, blockHash, finalized = false) {
        if (this.msgHash[msgHash] == undefined) {
            this.msgHash[msgHash] = {
                extrinsicHash: {},
		relayed: {
		    unfinalized: {}
		},
                msg: null
            }
	}
	console.log("init_msgHash INIT", this.msgHash);
        if (msg) {
            // due to utility batch multiple msgHashes from the same extrinsic are possible, which is covered with this map
            // note this does not cover the situation where the same extrinsic has multiple messages with the same msgHash
            this.msgHash[msgHash].msg = msg
            if (this.msgHash[msgHash].relayed == undefined) {
                console.log("ERROR: MISSING relayed");
            } else if (finalized) {
                if ( this.msgHash[msgHash].relayed.finalized == undefined ) {
		    this.msgHash[msgHash].relayed.finalized = {};
		}
		this.msgHash[msgHash].relayed.finalized[blockHash] = msg;
                this.msgHash[msgHash].relayed.unfinalized = {}
		console.log("INIT_MSGHASH FINALIZED", this.msgHash[msgHash], blockNumber);
            } else {
		console.log("INIT_MSGHASH UNFINALIZED0", this.msgHash[msgHash], blockNumber);
                this.msgHash[msgHash].relayed.unfinalized[blockHash] = msg;
		console.log("INIT_MSGHASH UNFINALIZED1", this.msgHash[msgHash], blockNumber);
            }
	    for ( const extrinsicHash of Object.keys(this.msgHash[msgHash].extrinsicHash) ) {
		// given a msgHash that can be associated with an extrinsic, this actually makes the association
		// in the the xcmInfo of the extrinsic (set in the origination), using the xcmInfo of the msgHash (set from relay)
		// This process is necessary because it is possible we receive either orig first or relay first.
		// It is conceivable we somehow receive dest first, but we skip this possiiblity.
		this.extrinsics[extrinsicHash].xcmInfo.relayed = this.msgHash[msgHash].relayed;
		this.msgHash[msgHash].extrinsicHash[extrinsicHash] = finalized;
		console.log("INIT_MSGHASH MSGHASH", msgHash, this.msgHash[msgHash]);
		console.log("INIT_MSGHASH EXTRINSICS", extrinsicHash, this.extrinsics[extrinsicHash].xcmInfo);
		return(extrinsicHash);
	    }
        }
        return null;
    }

    relayed(msgHash) {
	if ( this.msgHash[msgHash] == undefined ) return(false);
	if ( this.msgHash[msgHash].relayed == undefined ) return(false);
	if ( this.msgHash[msgHash].relayed.unfinalized != undefined && Object.keys(this.msgHash[msgHash].relayed.unfinalized) > 0 ) return(true);
	if ( this.msgHash[msgHash].relayed.finalized != undefined && Object.keys(this.msgHash[msgHash].relayed.finalized) > 0 ) return(true);
	return(false);
    }

    // processes an extrinsic on the origination chain
    //  (a) adds extrinsic to this.extrinsics[extrinsicHash].extrinsic with init_extrinsic [this is not xcm dependent]
    //      (1)
    //  (2) adds msgHash to this.extrinsics[extrinsicHash].xcmInfo.msgHashes Array
    async index_origination_extrinsic(extrinsic, orig_blockHash, orig_blockNumber, blockTS, finalized, paraID, id, relayChain) {
        let orig_extrinsicHash = extrinsic.extrinsicHash;
        let orig_extrinsicID = extrinsic.extrinsicID;
        // qualify this extrinsic as being xcm related by its events
        if (!extrinsic.events) return (false);
        let eventSections = ["xcmpQueue", "xcmTransactor", "transactionPayment", "system", "xTokens", "assets"]
        let events = extrinsic.events.filter((event) => {
            return eventSections.includes(event.section);
        });
        if (events.length == 0) return (false);

        this.init_extrinsic(orig_extrinsicHash, extrinsic, paraID, id, relayChain) // NOTE: this is the same if finalized or not
        let ext = this.extrinsics[orig_extrinsicHash];
        if (finalized) {
            // a given extrinsicHash has a precise extrinsic (with specific events) when finalized, we can nuke the unfinalized
            ext.xcmInfo.origination.finalized = extrinsic;
            ext.xcmInfo.origination.unfinalized = {}
        } else {
            // a given extrinsicHash may be included at different blockHashes, thus with different extrinsicIDs and even different events
            if (ext.xcmInfo && ext.xcmInfo.origination && ext.xcmInfo.origination.unfinalized) {
                ext.xcmInfo.origination.unfinalized[orig_blockHash] = extrinsic
            }
        }
        let emit = false;
        for (let i = 0; i < events.length; i++) {
            let event = events[i];
            if (event.section == "xcmpQueue") {
                if (event.method == "XcmpMessageSent") {
		    let data = event.data;
                    let msgHash = data.messageHash
                    // store the extrinsic => msgHash relation
                    if (!ext.xcmInfo.msgHashes.includes(msgHash)) {
                        ext.xcmInfo.msgHashes.push(msgHash);
                    }
                    emit = true;
                    console.log("******* ORIGINATION EVENT", msgHash, orig_extrinsicHash, orig_extrinsicID);
                    if (this.msgHash[msgHash] == undefined) {
                        this.init_msgHash(msgHash);
                    }
                    if (this.msgHash[msgHash].extrinsicHash == undefined) {
                        this.msgHash[msgHash].extrinsicHash = {}
                    }
		    this.msgHash[msgHash].extrinsicHash[orig_extrinsicHash] = finalized;
		    if ( this.relayed(msgHash) ) {
			this.extrinsics[orig_extrinsicHash].xcmInfo.relayed = this.msgHash[msgHash].relayed
			console.log("RELAY CHAIN HIT FIRST copying this:", msgHash, this.msgHash[msgHash].relayed);
			console.log("RELAY CHAIN HIT FIRST -- xcmInfo:", orig_extrinsicHash, this.extrinsics[orig_extrinsicHash].xcmInfo);
		    } else {
			this.extrinsics[orig_extrinsicHash].xcmInfo.relayed = {
			    unfinalized: {
			    }
			}
			console.log("ORIGINATION HIT FIRST - relayed set up", orig_extrinsicHash, this.extrinsics[orig_extrinsicHash].xcmInfo);
		    }
                }
            } else if (event.section == "xcmTransactor" && event.method == "TransactedSigned") {
                let data = event.data;
                // map the call (which is an ethereumXcm:transact typically, right now)
                let internalCall = this.apis["origination"].api.registry.createType('Call', data.call);
                // internalCallHuman {"args":{"xcm_transaction":{"V1":{"gasLimit":"300,000","feePayment":"Auto","action":{"Call":"0x49ba58e2ef3047b1f90375c79b93578d90d24e24"},"value":"0","input":"0xcde4efa9","accessList":null}}},"method":"transact","section":"ethereumXcm"}
                let internalCallHuman = internalCall.toHuman()
                // this could be in proxy, multisig, utility batch, so this is by no means perfect...
                if (internalCallHuman.section == "ethereumXcm" && internalCallHuman.method == "transact") {
                    // we store the origination call here to match on it later
                    let paraID = this.apis["origination"].paraID;
                    let [from, _] = this.calculateMultilocationDerivative(this.apis["origination"].api, paraID, data.feePayer);
                    ext.xcmInfo.origination.remoteEVMTx = {
                        from: from,
                        transact: internalCallHuman
                    }
		    emit = true;
		    console.log("******* ORIGINATION REMOTETX", ext.xcmInfo.origination.remoteEVMTx);
                }
            } else if (event.section == "xTokens") {
                if (event.method == "TransferredMultiAssets") {
                    let data = event.data;
                    let sender = data.sender;
                    let assets = data.assets;
                    let fee = data.fee;
                    let dest = data.dest;
                    // extract beneficiary from dest
                    let beneficiary = this.get_dest_beneficiary(dest);
                    ext.xcmInfo.origination.assetsSent = assets;
                    if (beneficiary) {
                        ext.xcmInfo.origination.beneficiary = beneficiary;
                    }
                    ext.xcmInfo.origination.fee = fee;
                    console.log("TransferredMultiAssets DEST", beneficiary, dest)
                    if (this.assetsSent[beneficiary] == undefined) {
                        this.assetsSent[beneficiary] = {}
                    }
                    this.assetsSent[beneficiary][orig_extrinsicHash] = event;
                    emit = true;
		    console.log("******* ORIGINATION TRANSFERRED MULTI ASSETS", event);
                }
            } else if (event.section == "transactionPayment") {
                if (event.method == "TransactionFeePaid") {
                    ext.xcmInfo.origination.transactionFeePaid = event
                    emit = true;
                }
            } else if (event.section == "system") {
                if (event.method == "ExtrinsicSuccess") {
                    ext.xcmInfo.origination.success = event
                }
            }
            // TODO: treat other events, then refactor this class
        }
        if (emit) {
            this.emitXCMInfoLog(orig_extrinsicHash, "origination", finalized, orig_blockNumber);
        }
    }

    // TODO: make this work across all extrinsic asset sends events, by exhaustive case by case analysis (x1, x2, x3, ...) and/or through feature detection (accountKey20/32)
    get_dest_beneficiary(d) {
        try {
            // TransferredMultiAssets DEST undefined { parents: '1', interior: { X2: [ [Object], [Object] ] } }
            if (d.interior) {
                if (d.interior.X2) {
                    console.log("FOUNDX2", d.interior.X2);
                    if (d.interior.X2[1].AccountKey20) {
                        let beneficiary = d.interior.X2[1].AccountKey20.key.toLowerCase();
                        console.log("FOUNDBENEFICIARY", beneficiary);
                        return beneficiary;
                    }
                }
            }
        } catch (err) {
            console.log("get_dest_beneficiary", d, err);
        }
    }
    async indexOriginationChainBlock(api, blockHash, blockNumber, finalized, paraID, id, relayChain) {
        let [block, extrinsics, events, blockTS] = await this.getBlockEvents(api, blockHash, blockNumber)

        for (let i = 0; i < extrinsics.length; i++) {
            await this.index_origination_extrinsic(extrinsics[i], blockHash, blockNumber, blockTS, finalized, paraID, id, relayChain)
        }
    }

    get_extrinsics_by_msgHash_destblockHash(msgHash, dest_blockNumber, dest_blockHash) {
        if (this.msgHash[msgHash] == undefined) return (null);
        let m = this.msgHash[msgHash];
        console.log("get_extrinsics_by_msgHash", msgHash, "RESULT", m)
        // TODO: given the specific dest_blockNumber / dest_blockHash, filter to get the precise extrinsics sent
        return m.extrinsicHash
    }

    get_transaction_by_remoteEVMTx(remoteExecution, dest_blockNumber, dest_blockHash) {
        //console.log("get_transaction_by_remoteEVMTx", dest_blockNumber, dest_blockHash, "remoteExecution", remoteExecution)

        if (this.evmBlocks[dest_blockNumber] == undefined) {
            console.log("WARNING: get_transaction_by_remoteEVMTx NO EVM BLOCK", dest_blockNumber, "bns", Object.keys(this.evmBlocks));
            return (null);
        }
        if (this.evmBlocks[dest_blockNumber][dest_blockHash] == undefined) {
            console.log("WARNING: get_transaction_by_remoteEVMTx NO EVM BLOCK", dest_blockNumber, "need:", dest_blockHash, Object.keys(this.evmBlocks[dest_blockNumber]));
            return (null);
        }
        let evmBlock = this.evmBlocks[dest_blockNumber][dest_blockHash];
        let txs = evmBlock.transactions;
        let remoteExecution_from = remoteExecution.from;
        let remoteExecution_xcm_transaction = remoteExecution.xcm_transaction;
        for (const tx of txs) {
            if (tx.from == remoteExecution_from) {
                // TODO: match on "to"
                return (tx);
            }
        }
    }

    get_extrinsics_by_beneficiary(beneficiary, dest_blockNumber, dest_blockHash, assetId, assetsReceived) {
        // let extrinsic_beneficiary
        console.log("get_extrinsics_by_beneficiary beneficiary-", beneficiary, "dest_blockNumber=", dest_blockNumber, "dest_blockHash", dest_blockHash, "assetId", assetId, "assetsReceived", assetsReceived);
        if (this.assetsSent[beneficiary] == undefined) {
            console.log("get_extrinsics_by_beneficiary beneficiary not found", beneficiary)
            return (null);
        }
        let extrinsicHashes = this.assetsSent[beneficiary];
        console.log("get_extrinsics_by_beneficiary beneficiary found", extrinsicHashes)
        return extrinsicHashes;
    }

    async indexDestinationChainBlock(api, dest_blockHash, dest_blockNumber, finalized, paraID, id) {
        let [block, extrinsics, events, blockTS] = await this.getBlockEvents(api, dest_blockHash, dest_blockNumber)
        // holds affected extrinsicHashes

        let extrinsicHashes = {}
        for (let i = 0; i < extrinsics.length; i++) {
            let extrinsic = extrinsics[i];
            if (extrinsic.events) {
                let dest_extrinsicHash = extrinsic.extrinsicHash;
                let dest_extrinsicID = extrinsic.extrinsicID;
                for (let j = 0; j < extrinsic.events.length; j++) {
                    let event = extrinsic.events[j];
                    let orig_extrinsicMap = null;
                    let assetsIssued = null;
                    if (event.section.toLowerCase() == "assets") {
                        if (event.method == "Issued") {
                            let data = event.data;
                            let assetId = data.assetId;
                            let owner = data.owner.toLowerCase();
                            let totalSupply = data.totalSupply
                            orig_extrinsicMap = this.get_extrinsics_by_beneficiary(owner, dest_blockNumber, dest_blockHash, assetId, totalSupply);
                            console.log("ASSETSISSUED", data, assetId, owner, totalSupply, orig_extrinsicMap);
                            assetsIssued = data;
                        }
                    }
                    if (event.section == "xcmpQueue") {
                        console.log("FOUND XCM EVENT", event);
                        // data is the hash 0x32ff99bb5ad70677b286d99bf3220cb7671b7442d385aaa291426d9a0b045dad
                        let data = event.data;
                        let msgHash = data.messageHash;
                        let error = null
                        if (event.method == "Success") {} else if (event.method == "Fail") {
                            error = data.error;
                        }

                        let weight = data.weight;
                        //  match the msgHash to some origination chain extrinsicID/Hash, that has a remoteEVMTx [or remoteExtrinsic]
                        orig_extrinsicMap = this.get_extrinsics_by_msgHash_destblockHash(msgHash, dest_blockNumber, dest_blockHash);
                    }
                    // orig_extrinsicMap holds some extrinsicHashes in an origination chain that needs to be linked to activity on a destination chain
                    if (orig_extrinsicMap) {
                        for (const h of Object.keys(orig_extrinsicMap)) {
                            if (this.extrinsics[h]) {
                                if (this.extrinsics[h].xcmInfo.origination) {
                                    this.extrinsics[h].xcmInfo.destination.id = id;
                                    this.extrinsics[h].xcmInfo.destination.paraID = paraID;
                                    if (finalized) {
                                        if (this.extrinsics[h].xcmInfo.destination.finalized == undefined) {
                                            this.extrinsics[h].xcmInfo.destination.finalized = {}
                                        }
                                        this.extrinsics[h].xcmInfo.destination.finalized.blockNumber = dest_blockNumber
                                        this.extrinsics[h].xcmInfo.destination.finalized.ts = blockTS
                                        this.extrinsics[h].xcmInfo.destination.unfinalized = {};
                                    } else {
                                        if (this.extrinsics[h].xcmInfo.destination.unfinalized[dest_blockHash] == undefined) {
                                            this.extrinsics[h].xcmInfo.destination.unfinalized[dest_blockHash] = {}
                                        }
                                        this.extrinsics[h].xcmInfo.destination.unfinalized[dest_blockHash].blockNumber = dest_blockNumber
                                        this.extrinsics[h].xcmInfo.destination.unfinalized[dest_blockHash].ts = blockTS;
                                    }
                                    extrinsicHashes[h] = true;
                                    if (assetsIssued) {
                                        if (finalized) {
                                            this.extrinsics[h].xcmInfo.destination.finalized.assetsIssued = assetsIssued;
                                            console.log("ASSETSISSUED:FINAL", assetsIssued, this.extrinsics[h].xcmInfo.destination);
                                        } else {
                                            this.extrinsics[h].xcmInfo.destination.unfinalized[dest_blockHash].assetsIssued = assetsIssued;
                                            console.log("ASSETSISSUED:UNFIN", assetsIssued, this.extrinsics[h].xcmInfo.destination);
                                        }
                                        console.log("ASSETSISSUED:CHECK", JSON.stringify(this.extrinsics[h], null, 4));
                                    }
                                    if (this.extrinsics[h].xcmInfo.origination.remoteEVMTx) {
                                        // if it does, find transactionHash from the EVM block [obtained from the trace]
                                        let remoteEVMTx = this.extrinsics[h].xcmInfo.origination.remoteEVMTx;
                                        let evmtx = this.get_transaction_by_remoteEVMTx(remoteEVMTx, dest_blockNumber, dest_blockHash)
                                        if (evmtx) {
                                            if (finalized) {
                                                this.extrinsics[h].xcmInfo.destination.finalized.remoteEVMTx = evmtx;
                                            } else {
                                                this.extrinsics[h].xcmInfo.destination.unfinalized[dest_blockHash].remoteEVMTx = evmtx;
                                            }
                                        }
                                    }
                                } else {
                                    console.log("FAILURE: remoteEVMTx not found in origination", h);
                                }
                            } else {
                                console.log("FAILURE: extrinsic not found", h);
                            }
                        }
                    }

                }
            }
        }
        for (const extrinsicHash of Object.keys(extrinsicHashes)) {
            this.emitXCMInfoLog(extrinsicHash, "destination", finalized, dest_blockNumber);
        }
    }

    emitXCMInfoLog(extrinsicHash, role, finalized, blockNumber, extra = '') {
        let extrinsic = this.extrinsics[extrinsicHash];
        let timeStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
        let finalizedStr = finalized ? `FINALIZED ${blockNumber}` : `UNFINALIZED ${blockNumber}`;
        if (extrinsic) {
	    xcmInfo = extrinsic.xcmInfo;
            console.log(timeStr, `XCMINFO:${role} ${finalizedStr} ${extra}`, xcmInfo);
	    showxcmexecutor(xcmInfo);
        }
    }

    // { "parents": 1, "interior": { "X1": [{ "Parachain": 1000 }]}}
    make_multilocation(paraID = null, address = null, namedNetwork = 'Any') {
        const ethAddress = address.length === 42;
        const named = (namedNetwork != 'Any') ? {
            Named: namedNetwork
        } : namedNetwork;
        const account = ethAddress ? {
            AccountKey20: {
                network: named,
                key: address
            }
        } : {
            AccountId32: {
                network: named,
                id: polkadotUtil.u8aToHex(polkadotUtilCrypto.decodeAddress(address))
            }
        };
        // make a multilocation object
        let interior = {
            here: null
        }
        if (paraID && account) {
            interior = {
                X2: [{
                    Parachain: paraID
                }, account]
            }
        } else if (paraID) {
            interior = {
                X1: {
                    Parachain: paraID
                }
            }
        } else if (account) {
            interior = {
                X1: account
            }
        }
        return {
            parents: 1,
            interior: interior
        }
    }

    // Converts a given MultiLocation into a 20/32 byte accountID by hashing with blake2_256 and taking the first 20/32 bytes
    calculateMultilocationDerivative(api, paraID = null, address = null, namedNetwork = 'Any') {
        let multilocationStruct = this.make_multilocation(paraID, address, namedNetwork)
        const multilocation = api.createType('XcmV1MultiLocation', multilocationStruct)
        const toHash = new Uint8Array([
            ...new Uint8Array([32]),
            ...new TextEncoder().encode('multiloc'),
            ...multilocation.toU8a(),
        ]);

        const DescendOriginAddress20 = polkadotUtil.u8aToHex(api.registry.hash(toHash).slice(0, 20));
        const DescendOriginAddress32 = polkadotUtil.u8aToHex(api.registry.hash(toHash).slice(0, 32));
        //console.log("calculateMultilocationDerivative", multilocation.toString(), DescendOriginAddress20, DescendOriginAddress32);
        // multilocation {"parents":1,"interior":{"x2":[{"parachain":1000},{"accountKey20":{"network":{"any":null},"key":"0x44236223ab4291b93eed10e4b511b37a398dee55"}}]}}
        // 20 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45c
        // 32 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45cdfa7831175e442b8f14391aa
        return [DescendOriginAddress20, DescendOriginAddress32]
    }

    async processBlockUnfinalizedOrFinalized(finalized, api, resultsOrHeader, role, chainID, paraID, id, relayChain = "moonbase-relay") {
        let blockHash = null
        let blockNumber = null
        let blockTS = 0;
        let traces = [];

        // parse the traces
        if (finalized == false) {

            let results = resultsOrHeader;
            blockHash = results.block.toHex();
            let traceBlock = await api.rpc.state.traceBlock(blockHash, "state", "", "Put");
            if (traceBlock ) {
		if  ( traceBlock.isBlockTrace ) {
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
                    }
		} else if ( traceBlock.isError ) { 
		    console.log("trace block FAILURE", blockHash, traceBlock.asTraceError, chainID, paraID)
                }
            } else {
                console.log("trace block FAIL")
            }
        } else {
            let header = resultsOrHeader;
            blockNumber = parseInt(header.number.toString(), 10);
            blockHash = header.hash.toString();
            //console.log("finalized", blockNumber, blockHash);
            // get traces from cache, if we can
            if (this.parsedTraces[blockNumber] != undefined) {
                if (this.parsedTraces[blockNumber][blockHash] != undefined) {
                    traces = this.parsedTraces[blockNumber][blockHash];
                    // delete from the cache
                }
                delete this.parsedTraces[blockNumber];
            }
        }

        if (role == "relay") {
            if (traces && traces.length > 0) {
                console.log("relay TRACE", blockHash, blockNumber, finalized, "# traces", traces.length, this.msgHash);
                await this.indexRelayChainTrace(api, traces, blockHash, blockNumber, finalized, chainID, relayChain);
            }
        } else if (role == "origination") {
            console.log("origination BLOCK", blockHash, blockNumber, finalized, paraID, id, relayChain);
	    
            await this.indexOriginationChainBlock(api, blockHash, blockNumber, finalized, paraID, id, relayChain);
        } else if (role == "destination") {
            if (traces && traces.length > 0) {
                console.log("destination TRACE", blockHash, blockNumber, finalized, "# traces", traces.length);
                await this.indexDestinationChainTrace(traces, blockHash, blockNumber, finalized, paraID, id, relayChain)
            }
            console.log("destination BLOCK", blockHash, blockNumber, finalized);
            await this.indexDestinationChainBlock(api, blockHash, blockNumber, finalized, paraID, id, relayChain);
        }
    }

    get_id(paraID, relayChain = "moonbase-relay") {
        if (relayChain == "moonbase-relay") {
            switch (paraID) {
                case 0:
                    return "moonbase-relay";
                    break;
                case 1000:
                    return "moonbase-alpha";
                    break;
                case 888:
                    return "moonbase-beta";
                    break;
            }
        }

    }

    async processSubscribeStorage(role, results) {
        try {
            let api = this.apis[role];

            this.processBlockUnfinalizedOrFinalized(false, api.api, results, role, api.chainID, api.paraID, api.id);
        } catch (err) {
            console.log(err);
        }
    }

    async processFinalizedHead(role, header) {
        try {
            let api = this.apis[role];

            this.processBlockUnfinalizedOrFinalized(true, api.api, header, role, api.chainID, api.paraID, api.id);
        } catch (err) {
            console.log(err);
        }
    }
    async setupAPIs(paraID, paraIDDest, chainIDRelay = 60000, relayChain = "moonbase-relay") {
        let apis = {
            "origination": {
                api: null,
                paraID,
                chainID: paraID + chainIDRelay
            },
            "relay": {
                api: null,
                paraID: 0,
                id: "moonbase-relay",
                chainID: chainIDRelay
            },
            "destination": {
                api: null,
                paraID: paraIDDest,
                id: "moonbase-beta",
                chainID: paraIDDest + chainIDRelay
            }
        }

        // TODO: instead of hardcoded rpcURL+evmChainID, use "origination" chainID
        const rpcURL = "http://moonbase-internal.polkaholic.io:9100"
        this.evmChainID = 1287;
        var web3Api = new Web3(rpcURL)
        var bn = await web3Api.eth.getBlockNumber()
        console.log(`web3Api ${rpcURL} is ready currentBN=${bn}`)
        this.web3Api = web3Api;
        for (const role of Object.keys(apis)) {
            apis[role].id = this.get_id(apis[role].paraID, relayChain);
            apis[role].api = await this.getAPI(apis[role].chainID);
            await this.getSpecVersionMetadata(apis[role].api)
            console.log("API OPEN -- ", role);
        }


        for (const role of Object.keys(apis)) {
            // subscribeStorage returns changes from ALL blockHashes, including the ones that eventually get dropped upon finalization
            apis[role].api.rpc.state.subscribeStorage(async (results) => {
                this.processSubscribeStorage(role, results)
            })
            // subscribeFinalized returns finalized headers
            apis[role].api.rpc.chain.subscribeFinalizedHeads(async (header) => {
                this.processFinalizedHead(role, header)
            })
        }
        this.apis = apis;
        return (apis);
    }

}

let xcmclient = new XCMClient();

async function init_xcmClient() {
    let paraID = 1000;
    let paraIDDest = 888;
    let chainIDRelay = 60000;
    let relayChain = "moonbase-relay";
    await xcmclient.setupAPIs(paraID, paraIDDest, chainIDRelay, relayChain);
}

function xcmclient_clear() {
    xcmclient.clear();
}
