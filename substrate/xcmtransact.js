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
const fs = require('fs');
//const AssetManager = require('./assetManager');
const paraTool = require('./paraTool');
const ethTool = require('./ethTool');

module.exports = class XCMTransact {
    // holds keyring / evm wallet keys
    pair = null;
    evmpair = null
    
    // holds observed extrinsic objects, each which has xcmInfo + msgHashes updated
    extrinsics = {};

    // used to parse traces
    storageKeys = {};
    parsedTraces = {};

    // holds msghash mappings
    msgHash = {};

    // holds evmblocks of destination chain
    evmBlocks = {};

    async init() {
        await cryptoWaitReady()
    }

    async getAPI(chainID) {
	let wsEndpoints = {
	    60000: "ws://moonbase-internal.polkaholic.io:9945",
	    60888: "ws://moonbase-beta-internal.polkaholic.io:9944",
	    61000: "ws://moonbase-internal.polkaholic.io:9944"
	}
	let wssEndpoint = wsEndpoints[chainID];
	if ( wssEndpoint == undefined ) {
	    console.log("No API Endpoint for chainID", chainID);
	    return(null);
	}
	console.log("Connecting to chainID", chainID, wssEndpoint);
	
	var api = await ApiPromise.create({
	    provider: new WsProvider(wssEndpoint)
	});
	await api.isReady;
	return api;
    }

    // substrate keys
    setupPair(FN = "/root/.wallet", name = "polkadot") {
        const privateSeed = fs.readFileSync(FN, 'utf8');
        var keyring = new Keyring({
            type: 'sr25519'
        });
        this.pair = keyring.addFromUri(privateSeed, {
            name: name
        })
    }

    // evm keys (Substrate style), for extrinsics
    async setupEvmPairFromMnemonic(FN = "/root/.walletevm", name = "evm") {
    	const keyringECDSA = new Keyring({ type: 'ethereum' });
	var mnemonic = fs.readFileSync(FN, 'utf8');
	const index = 0;
	const ethDerPath = "m/44'/60'/0'/0/" + index;
	const newPairEth = keyringECDSA.addFromUri(`${mnemonic}/${ethDerPath}`);
	const privateKey = u8aToHex(
	    hdEthereum(mnemonicToLegacySeed(mnemonic, '', false, 64), ethDerPath).secretKey
	);
	this.pair = await keyringECDSA.addFromUri(privateKey);
    }

    // evm keys (Ethereum style), for evmtxs
    setupEvmPair(FN = "/root/.walletevm2", name = "evm") {
        var pk = fs.readFileSync(FN, 'utf8');
        pk = pk.replace(/\r|\n/g, '');
        this.evmpair = ethTool.loadWallet(pk)
    }

    // setup backedup from Relay chain trace 
    ParaInclusionPendingAvailabilityBackedMap(traces) {
        let backedMap = {}
        for (const t of traces) {
            if (t.p == "ParaInclusion" && (t.s == "PendingAvailability")) {
                try {
                    if (t.v == '0x') continue
                    let pendingAvailability = t.pv ? JSON.parse(t.pv) : null; // pv:
                    if (pendingAvailability) {
                        let k = JSON.parse(t.pk)
                        let paraID = paraTool.toNumWithoutComma(k[0])
                        backedMap[paraID] = pendingAvailability
                    }
                } catch (err) {
                    console.log(`ParaInclusionPendingAvailabilityFilter error`, err)
                }
            }
        }
        return backedMap
    }

    async indexRelayChainTrace(traces, blockHash, blockNumber, blockTS, finalized, chainID, relayChain) {
        let backedMap = this.ParaInclusionPendingAvailabilityBackedMap(traces)
        let mp = {}
        for (const t of traces) {
	    
            if (t.p == "ParaInclusion" && (t.s == "PendingAvailabilityCommitments")) {
                try {
                    let commitments = t.pv ? JSON.parse(t.pv) : null; 
                    if (commitments && (commitments.upwardMessages.length > 0 || commitments.horizontalMessages.length > 0)) {
			let k = JSON.parse(t.pk)
                        let paraID = parseInt(paraTool.toNumWithoutComma(k[0]), 10)
                        let backed = backedMap[paraID]
                        let sourceSentAt = backed.relayParentNumber // this is the true "sentAt" at sourceChain, same as commitments.hrmpWatermark
                        let relayedAt = blockNumber // "relayedAt" -- aka backed at this relay blockNumber
                        let includedAt = blockNumber + 1 // "includedAt" -- aka when it's being delivered to destChain
			for (const msgHex of commitments.upwardMessages) {
                            let msgHash = '0x' + paraTool.blake2_256_from_hex(msgHex);
                            let umpMsg = {
                                msgType: "ump",
                                chainID: paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain),
                                chainIDDest: this.chainID,
                                paraID: paraID,
                                paraIDDest: 0,
                                sentAt: sourceSentAt,
                                relayedAt: relayedAt,
                                includedAt: includedAt,
                                msgHex: msgHex,
                                msgHash: msgHash,
                                relayedBlockHash: blockHash,
                                blockTS: blockTS,
                                relayChain: relayChain,
                                finalized: finalized,
                                ctx: t.s,
                            }
                            this.init_msgHash(msgHash, umpMsg, blockNumber, blockHash, finalized)
                        }
                        for (const h of commitments.horizontalMessages) {
                            /*
                            {
                                "recipient": 2004,
                                "data":"0x000210010400010200411f06080001000b3cbef64bc1240a1300010200411f06080001000b3cbef64bc124010700f2052a010d0100040001030024a304386099637e578c02ffeaf2cf3dcfbab751"
                            }
                            */
                            let paraIDDest = parseInt(paraTool.toNumWithoutComma(h.recipient), 10)
                            let msgHex = '0x' + h.data.substring(4).toString();
			    let msgHash = '0x' + paraTool.blake2_256_from_hex(msgHex);
                            let hrmpMsg = {
                                msgType: "hrmp",
                                chainID: paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain),
                                chainIDDest: paraTool.getChainIDFromParaIDAndRelayChain(paraIDDest, relayChain),
                                paraID: paraID,
                                paraIDDest: paraIDDest,
                                sentAt: sourceSentAt,
                                relayedAt: relayedAt,
                                includedAt: includedAt,
                                msgHex: msgHex,
                                msgHash: msgHash,
                                relayedBlockHash: blockHash,
                                blockTS: blockTS,
                                relayChain: relayChain,
                                finalized: finalized,
                                ctx: t.s,
                            }
                            this.init_msgHash(msgHash, hrmpMsg, blockNumber, blockHash, finalized)
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
                        let paraIDDest = parseInt(paraTool.toNumWithoutComma(k[0]), 10)
                        for (const q of queues) {
                            let sentAt = q.sentAt; // NO QUESTION on dmp (this is usually always the same block where xcmtransfer is initiated), sentAt = includedAt = relayedAt
                            let msgHex = q.msg;
			    let msgHash = '0x' + paraTool.blake2_256_from_hex(msgHex);
                            let dmpMsg = {
                                msgType: "dmp",
                                chainID: this.chainID,
                                chainIDDest: paraTool.getChainIDFromParaIDAndRelayChain(paraIDDest, relayChain),
                                paraID: 0,
                                paraIDDest: paraIDDest,
                                sentAt: sentAt,
                                relayedAt: sentAt,
                                includedAt: sentAt,
                                msgHex: msgHex,
                                msgHash: msgHash,
                                //relayedBlockHash: TODO: blockHash for sentAt
                                blockTS: blockTS,
                                relayChain: relayChain,
                                finalized: finalized,
                                ctx: t.s,
                            }
                            this.init_msgHash(msgHash, dmpMsg, blockNumber, blockHash, finalized)
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

    async indexDestinationChainTrace(traces, blockHash, blockNumber, blockTS, results, finalized = false) {
	// for now, just get the EVM Block out of the destination block trace
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
                    let bnCand = parseInt(paraTool.toNumWithoutComma(pkExtraArr[0]), 10);
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
	    if ( this.evmBlocks[blockNumber] == undefined ) {
		this.evmBlocks[blockNumber] = {};
	    } else if ( finalized ) {
		this.evmBlocks[blockNumber] = {}; // clean out everything else 
	    }
	    //console.log("STORE EVM BLOCK", blockNumber, blockHash, newEVMBlock);
            //console.log("NEW RECEIPTS", JSON.stringify(newReceipts, null, 4));
            this.evmBlocks[blockNumber][blockHash] = newEVMBlock;
        }
    }
    
    // because of lots of different capitalization and underscoring techniques in different pallets/sections/methods 
    canonicalize_name(p) {
	return p.toLowerCase().replaceAll("_", "")
    }

    filter_pallet(pallet) {
	let pallet_canonical = this.canonicalize_name(pallet);
	let pallets = ["system", "ethereum", "set", "timestamp", "assets_withdraw", "polkadotXcm", "XcmpQueue", "xcmPallet", "xcmTransactor", "xTokens", "xTransfer", "ParaInclusion", "Dmp", "Ump", "Hrmp", "parachainSystem"].map( (p) => this.canonicalize_name(p) )
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
                    let storageKey = paraTool.twox_128(palletName) + paraTool.twox_128(storageName);
		    if ( this.filter_pallet(palletName) ) {
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
        let p = paraTool.firstCharLowerCase(o.p);
        let s = paraTool.firstCharLowerCase(o.s);
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
            var skey = new StorageKey(api.registry, '0x' + key); // ???
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
		let v = (val.length >= 2) ? val.substr(2).slice() : "";
                parsev = hexToBn(v, {
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
        if (!api) { 	return (false);}
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
		    if ( events[index] == undefined ) {
			events[index] = [];
		    }
                    events[index].push(event)
                }
            }
        }
        return events;
    }

    async getBlockEvents(api, blockHash) {
        const signedBlock = await api.rpc.chain.getBlock(blockHash);
        let eventsRaw = await api.query.system.events.at(blockHash);
        let eventsIndexed = this.processEvents(api, eventsRaw);
        let events = [];
	for ( const e of eventsRaw ) {
            let eh = e.event.toHuman();
            let ej = e.event.toJSON();
	    if ( this.filter_pallet(eh.section) ) {
		let out = JSON.parse(JSON.stringify(e));
		let data = out.event.data;
		out.event = {};
		out.event.data = data;
		out.event.method = {};
		out.event.method['pallet'] = eh.section;
		out.event.method['method'] = eh.method;
		events.push(out);
		//console.log("included event", out);
	    }
        }

        let block = signedBlock.block;
        let header = block.header;
        let blockNumber = header.number;
        let isSet = false;
	let extrinsics = [];
        for (let i = 0; i < block.extrinsics.length; i++) {
            let ex = block.extrinsics[i];
            let extrinsicHash = ex.hash.toHex();
            let exh = ex.method.toHuman()
            if (exh.method == "set" && exh.section == 'timestamp' && (!isSet)) {
		let exj = ex.method.toJSON();
                block.blockTS = Math.round((exj.args.now) / 1000);
                isSet = true;
            }
	    if ( this.filter_pallet(exh.section) ) {
		let extrinsic = this.decode_s_extrinsic(ex, blockNumber, i, api);
		extrinsic.extrinsicHash = extrinsicHash;
		extrinsic.extrinsicID = `${blockNumber}-${i}`;
		extrinsic.events = eventsIndexed[i];
		extrinsics.push(extrinsic)
		//console.log("included extrinsic", extrinsic);
	    }
        }
	block.number = blockNumber

        return [block, extrinsics, events];
    }

    getMethodSection(callIndex, api) {
        try {
            var {
                method,
                section
            } = api.registry.findMetaCall(paraTool.hexAsU8(callIndex))
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

        let lifetime = {
            isImmortal: 0
        }
        if (sig.era != undefined) {
            // either mortal or immortal
            if (sig.era.immortalEra != undefined) {
                //usually unsined tx here
                lifetime.isImmortal = 1
            } else if (sig.era.mortalEra != undefined) {
                try {
                    var r = api.registry.createType('MortalEra', paraTool.hexAsU8(sig.era.mortalEra))
                    let [birth, death] = paraTool.getLifetime(blockNumber, r)
                    lifetime.birth = birth
                    lifetime.death = death
                    sig.era = r.toHuman()
                } catch (e) {
                    console.log(`[${extrinsicID}] ${extrinsicHash} error computing lifetime + era`, e)
                }
            }
        }
        let out = {
            method: {
                callIndex: callIndex,
                pallet: section,
                method: method,
            },
            args: exos.method.args,
            signature: sig,
            lifetime: lifetime
        }
        return (out)
    }

    // as extrinsics (filtered by xcmtransfer/xcmtransact) are seen in the origination chain (initiated by user or not),
    // they are placed in the "extrinsics" map, keyed by extrinsicHash, with an empty skeleton
    init_extrinsic(extrinsicHash, extrinsic = null) {
	if ( this.extrinsics[extrinsicHash] == undefined ) {

	    this.extrinsics[extrinsicHash] = {
		extrinsic: null, // this will be filled in by the user initation or on the first unfinalized blockshould be filled in at s
		xcmInfo: {
		    origination: {
			// if this extrinsic initiates a EVMTx or extrinsic, an observed extrinsic event will set these in index_origination_extrinsic
			remoteEVMTx: null,      // holds *requested* remote evmtx, filled in when first seen 
			//remoteExtrinsic: null,  // holds *requested* remote extrinsic, filled in when first seen 
			unfinalized: {}, // holds unfinalized blockHash => extrinsic until finalization
			extrinsicID: null, // filled in on origination finalization 
		    },
		    relayed: {
			unfinalized: {}
		    },
		    destination: {
			remoteEVMTx: null, // holds finalized EVMTx (from EVM Block), filled in on destination finalization
			//remoteExtrinsic: null, // holds finalized execution (from Substrate Block), filled in on destination finalization
			unfinalized: {}, // holds unfinalized blockHash => { remoteEVMTx, remoteExtrinsic } until finalization
		    },
		},
		msgHashes: [], // holds what msgHashes are initially sent by this extrinsic -- index_origination_extrinsic
	    }
	}
	if ( extrinsic ) {
	    this.extrinsics[extrinsicHash].extrinsic = extrinsic;
	}
    }

    timeStr() {
	return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }
    
    finalizedStr(finalized, bn) {
	return finalized ? ` FINALIZED ${bn}`: ` UNFINALIZED ${bn}`;
    }
    
    
    // as messages come in (either observed from the relay chain or from the origination blocks), they fill in this 
    init_msgHash(msgHash, msg = null, blockNumber, blockHash, finalized = false) {
	if ( this.msgHash[msgHash] == undefined ) {
	    this.msgHash[msgHash] = {
		extrinsicHash: {},
		msg: null
	    }
	}
	if ( msg ) {
	    this.msgHash[msgHash].msg = msg
	    let extrinsicHashes = this.msgHash[msgHash].extrinsicHash
	    for ( const extrinsicHash of Object.keys(extrinsicHashes) ) {
		if ( this.extrinsics[extrinsicHash] != undefined ) {
		    let e = this.extrinsics[extrinsicHash];
		    if ( e.xcmInfo.relayed == undefined ) {
			console.log("ERROR: MISSING xcmInfo.relayed");
		    } else if ( e.xcmInfo.relayed.finalized == undefined ) {
			if ( finalized ) {
			    e.xcmInfo.relayed.finalized = msg;
			} else {
			    e.xcmInfo.relayed.unfinalized[blockHash] = msg;
			}
			console.log(this.timeStr(), "XCMINFO: RELAY CHAIN MESSAGE", this.finalizedStr(finalized, blockNumber), "extrinsicHash", extrinsicHash, "msgHash", msgHash, "xcmInfo", JSON.stringify(e.xcmInfo, null, 4));
		    }
		} else {
		    console.log("ERROR: MISSING extrinsicHash", extrinsicHash);
		}
	    }
	}
	// TODO: treat blockNumber, blockHash, finalized for the situation where msgHashes are sent at different relay chain blockHashes
    }

    // processes an extrinsic on the origination chain
    async index_origination_extrinsic(extrinsic, orig_blockHash, orig_blockNumber, finalized = false) {
	let orig_extrinsicHash = extrinsic.extrinsicHash;
	let orig_extrinsicID = extrinsic.extrinsicID;
	
	this.init_extrinsic(orig_extrinsicHash, extrinsic) // NOTE: this is the same if finalized or not
	if ( finalized ) {
	    // a given extrinsicHash has a precise extrinsicID when finalized
	    this.extrinsics[orig_extrinsicHash].xcmInfo.origination.extrinsicID = orig_extrinsicID;
	    // clean out old extrinsicIDs
	    //delete this.extrinsics[orig_extrinsicHash].xcmInfo.origination.unfinalized;

	} else {
	    // a given extrinsicHash may be submitted at different blockHashes, thus with different extrinsicIDs and even different events
	    if ( this.extrinsics[orig_extrinsicHash] == undefined ) {

	    } else if ( this.extrinsics[orig_extrinsicHash].xcmInfo == undefined ) {

	    } else if ( this.extrinsics[orig_extrinsicHash].xcmInfo.origination == undefined ) {

	    } else if ( this.extrinsics[orig_extrinsicHash].xcmInfo.origination.unfinalized == undefined ) {

	    } else {
		this.extrinsics[orig_extrinsicHash].xcmInfo.origination.unfinalized[orig_blockHash] = extrinsic
	    }
	}
	let events = extrinsic.events;
	if ( events ) {
	    for (let i=0; i < events.length; i++) {
		let event = events[i];
		if ( event.section == "xcmpQueue" ) {
		    if ( event.method == "XcmpMessageSent" ) {
			let data = event.data;
			let msgHash = data.messageHash
			// store the extrinsic => msgHash relation
			if ( ! this.extrinsics[orig_extrinsicHash].msgHashes.includes(msgHash) ) {
			    this.extrinsics[orig_extrinsicHash].msgHashes.push(msgHash);
			}
			console.log(this.timeStr(), "XCMINFO: ORIGINATION MSGHASH", this.finalizedStr(finalized, orig_blockNumber), "extrinsicHash=", orig_extrinsicHash, "msgHash=", msgHash);
			if ( this.msgHash[msgHash] == undefined ) {
			    this.init_msgHash(msgHash);
			}
			if ( this.msgHash[msgHash].extrinsicHash[orig_extrinsicHash] == undefined ) {
			    this.msgHash[msgHash].extrinsicHash[orig_extrinsicHash] = {}
			}
			this.msgHash[msgHash].extrinsicHash[orig_extrinsicHash][orig_blockHash] = finalized;
		    }
		} else if ( event.section == "xcmTransactor" && event.method == "TransactedSigned" ) {
		    let data = event.data;
		    // map the call (which is an ethereumXcm:transact typically, right now)
		    let internalCall = this.apis["origination"].api.registry.createType('Call', data.call);
		    // internalCallHuman {"args":{"xcm_transaction":{"V1":{"gasLimit":"300,000","feePayment":"Auto","action":{"Call":"0x49ba58e2ef3047b1f90375c79b93578d90d24e24"},"value":"0","input":"0xcde4efa9","accessList":null}}},"method":"transact","section":"ethereumXcm"}
		    let internalCallHuman = internalCall.toHuman()
		    // this could be in proxy, multisig, utility batch, so this is by no means perfect...
		    if ( internalCallHuman.section == "ethereumXcm" && internalCallHuman.method == "transact" ) {
			// we store the origination call here to match on it later
			let paraID = this.apis["origination"].paraID;
			let [from, _] = this.calculateMultilocationDerivative(this.apis["origination"].api, paraID, data.feePayer);
			this.extrinsics[orig_extrinsicHash].xcmInfo.origination.remoteEVMTx = {
			    from:  from,
			    transact: internalCallHuman
			}
			console.log(this.timeStr(), "XCMINFO: ORIGINATION EXTRINSIC", this.finalizedStr(finalized, orig_blockNumber), "extrinsicHash=", orig_extrinsicHash, "xcmInfo", JSON.stringify(this.extrinsics[orig_extrinsicHash].xcmInfo, null, 4))
		    }
		}
		// TODO: other extrinsics with events may generate remoteExtrinsic
	    }
	}
    }
    
    async indexOriginationChainBlock(api, blockHash, blockNumber, blockTS, paraID, finalized = false) {
	let [block, extrinsics, events] = await this.getBlockEvents(api, blockHash)
	//console.log("indexOriginationChainBlock - getBlockEvents",  blockHash);
	//console.log("origination", block.number.toString(), block.blockTS, blockHash, extrinsics.length);

	for (let i=0; i < extrinsics.length; i++) {
	    await this.index_origination_extrinsic(extrinsics[i], blockHash, blockNumber, finalized)
	}
    }

    get_extrinsics_by_msgHash_destblockHash(msgHash, dest_blockNumber, dest_blockHash) {
	if ( this.msgHash[msgHash] == undefined ) return(null);
	let m = this.msgHash[msgHash];
	//console.log("get_extrinsics_by_msgHash", msgHash, this.msgHash, m)
	// TODO: given the specific dest_blockNumber / dest_blockHash, filter to get the precise extrinsics sent
	return m.extrinsicHash
    }

    get_transaction_by_remoteEVMTx(remoteExecution, dest_blockNumber, dest_blockHash) {
	//console.log("get_transaction_by_remoteEVMTx", dest_blockNumber, dest_blockHash, "remoteExecution", remoteExecution)
	
	if ( this.evmBlocks[dest_blockNumber] == undefined ) {
	    console.log("WARNING: get_transaction_by_remoteEVMTx NO EVM BLOCK", dest_blockNumber, "bns", Object.keys(this.evmBlocks));
	    return(null);
	}
	if ( this.evmBlocks[dest_blockNumber][dest_blockHash] == undefined ) {
	    console.log("WARNING: get_transaction_by_remoteEVMTx NO EVM BLOCK", dest_blockNumber, "need:", dest_blockHash, Object.keys(this.evmBlocks[dest_blockNumber]));
	    return(null);
	}
	let evmBlock = this.evmBlocks[dest_blockNumber][dest_blockHash];
	let txs = evmBlock.transactions;
	let remoteExecution_from = remoteExecution.from;
	let remoteExecution_xcm_transaction = remoteExecution.xcm_transaction;
	for (const tx of txs) {
	    if ( tx.from == remoteExecution_from ) {
		return(tx);
	    }
	}
    }    
    
    async indexDestinationChainBlock(api, dest_blockHash, dest_blockNumber, blockTS, finalized = false) {
	let [block, extrinsics, events] = await this.getBlockEvents(api, dest_blockHash)
	// for any extrinsics/events in the origination chain that are executing calls on a destination chains, lets record that they are interesting and should be watched
	
	for (let i=0; i < extrinsics.length; i++) {
	    let extrinsic = extrinsics[i];
	    if ( extrinsic.events ) {
		let dest_extrinsicHash = extrinsic.extrinsicHash;
		let dest_extrinsicID = extrinsic.extrinsicID;
		for (let j =0; j < extrinsic.events.length; j++) {
		    let event = extrinsic.events[j];
		    if ( event.section == "xcmpQueue" ) {
			// data is the hash 0x32ff99bb5ad70677b286d99bf3220cb7671b7442d385aaa291426d9a0b045dad
			let data = event.data;
			let msgHash = data.messageHash;
			let error = null
			if ( event.method == "Success" ) {
			} else if ( event.method == "Fail" ) {
			    error = data.error;
			}

			let weight = data.weight;
			//  match the msgHash to some origination chain extrinsicID/Hash, that has a remoteEVMTx [or remoteExtrinsic]
			let orig_extrinsicMap = this.get_extrinsics_by_msgHash_destblockHash(msgHash, dest_blockNumber, dest_blockHash);
			if ( orig_extrinsicMap ) {
			    for ( const orig_extrinsicHash of Object.keys(orig_extrinsicMap) ) {
				let orig_extrinsic = this.extrinsics[orig_extrinsicHash];
				if ( orig_extrinsic ) {
				    if ( orig_extrinsic.xcmInfo.origination && orig_extrinsic.xcmInfo.origination.remoteEVMTx ) {
					let remoteEVMTx = orig_extrinsic.xcmInfo.origination.remoteEVMTx;
					//  if it does, find transactionHash from the EVM block [obtained from the trace]  
					let evmtx = this.get_transaction_by_remoteEVMTx(remoteEVMTx, dest_blockNumber, dest_blockHash)
					if ( evmtx ) {
					    // link evmtx to destination blockHash
					    if ( finalized ) {
						orig_extrinsic.xcmInfo.destination.remoteEVMTx = evmtx;
					    } else {
						orig_extrinsic.xcmInfo.destination.unfinalized[dest_blockHash] = {
						    remoteEVMTx: evmtx
						}
					    }
					    console.log(this.timeStr(), "XCMINFO: DEST RemoteEVMTX", this.finalizedStr(finalized, dest_blockNumber), JSON.stringify(orig_extrinsic.xcmInfo, null, 4))
					}
				    } else {
					console.log("FAILURE: remoteEVMTx not found in origination", orig_extrinsic)
				    }
				}			
			    }
			} 
		    }
		}
	    }
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
                id: u8aToHex(decodeAddress(address))
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

        const DescendOriginAddress20 = u8aToHex(api.registry.hash(toHash).slice(0, 20));
        const DescendOriginAddress32 = u8aToHex(api.registry.hash(toHash).slice(0, 32));
        //console.log("calculateMultilocationDerivative", multilocation.toString(), DescendOriginAddress20, DescendOriginAddress32);
        // multilocation {"parents":1,"interior":{"x2":[{"parachain":1000},{"accountKey20":{"network":{"any":null},"key":"0x44236223ab4291b93eed10e4b511b37a398dee55"}}]}}
        // 20 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45c
        // 32 byte: 0x5c27c4bb7047083420eddff9cddac4a0a120b45cdfa7831175e442b8f14391aa
        return [DescendOriginAddress20, DescendOriginAddress32]
    }

    async processBlockUnfinalizedOrFinalized(finalized, api, resultsOrHeader, role, chainID, paraID, paraIDDest, relayChain = "moonbase-relay") {
	let blockHash = null
	let blockNumber = null
	let blockTS = 0;
	let traces = [];

	// parse the traces
	if ( finalized == false ) {

	    let results = resultsOrHeader;
	    blockHash = results.block.toHex();
	    let traceBlock = await api.rpc.state.traceBlock(blockHash, "state", "", "Put");
	    let rawTraces = traceBlock.toJSON().blockTrace.events.map( (e) => {
		let sv = e.data.stringValues
		let v = ( sv.value ==  'None' ) ? sv.value_encoded :  sv.value.replaceAll("Some(", "").replaceAll(")", "");
		return ({
                    k: sv.key,
                    v: v
                })
	    });

	    const signedBlock = await api.rpc.chain.getBlock(blockHash);
	    blockNumber = parseInt(signedBlock.block.header.number.toString(), 10);
	
            for ( const r of rawTraces ) {
		let [x, succ] = this.parse_trace(r, api, blockNumber, chainID, role)
		if ( succ ) {
		    traces.push(x);
		    if ( x.method == "Now" ) {
			blockTS = parseInt(t.pv, 10)
		    }
		}
	    }
	    //console.log("subscribestorage ***** ", role, blockNumber, blockHash, "numTraces", traces.length) 
	    if ( this.parsedTraces[blockNumber] == undefined ) {
		this.parsedTraces[blockNumber] = {}
	    }
	    this.parsedTraces[blockNumber][blockHash] = traces
	} else {
	    let header = resultsOrHeader;
	    blockNumber = parseInt(header.number.toString(), 10);
	    blockHash = header.hash.toString();
	    //console.log("finalized", blockNumber, blockHash);
	    // get traces from cache, if we can
	    if ( this.parsedTraces[blockNumber] != undefined ) {
		if ( this.parsedTraces[blockNumber][blockHash] != undefined ) {
		    traces = this.parsedTraces[blockNumber][blockHash];
		    // delete from the cache 
		}
		delete this.parsedTraces[blockNumber];
	    }		
	}

	if ( role == "relay" ) {
	    if ( traces && traces.length > 0) { 
		console.log("relay TRACE", blockHash, blockNumber, finalized);
		await this.indexRelayChainTrace(traces, blockHash, blockNumber, blockTS, finalized, chainID, relayChain);
	    }
	} else if ( role == "origination" ) { 
	    console.log("origination BLOCK", blockHash, blockNumber, finalized);
	    await this.indexOriginationChainBlock(api, blockHash, blockNumber, blockTS, paraID, finalized);
	} else if ( role == "destination" ) {
	    if ( traces && traces.length > 0 ) {
		console.log("destination TRACE", blockHash, blockNumber, finalized);
		await this.indexDestinationChainTrace(traces,  blockHash, blockNumber, blockTS, finalized)
	    }
	    console.log("destination BLOCK", blockHash, blockNumber, finalized);
	    await this.indexDestinationChainBlock(api, blockHash, blockNumber, blockTS,  paraIDDest, finalized);
	}
    }

    async processSubscribeStorage(api, role, chainID, results, paraID, paraIDDest)
    {
	try {
	    this.processBlockUnfinalizedOrFinalized(false, api, results, role, chainID, paraID, paraIDDest)
	} catch (err) {
	    console.log(err);
	}
    }

    async processFinalizedHead(api, role, chainID, header, paraID, paraIDDest)
    {
	try {
	    this.processBlockUnfinalizedOrFinalized(true, api, header, role, chainID, paraID, paraIDDest);
	} catch (err) {
	    console.log(err);
	}
    }
    async setupAPIs( paraID, paraIDDest, chainIDRelay = 60000) {
	let apis = {
	    "origination": { api: null, paraID, chainID: paraID + chainIDRelay},
	    "relay": { api: null, paraID: 0, chainID: chainIDRelay},
	    "destination": { api: null, paraID: paraIDDest, chainID: paraIDDest + chainIDRelay}
	}
	for ( const role of Object.keys(apis) ) {
	    let chainID = apis[role].chainID
	    let api = await this.getAPI(chainID);
	    await this.getSpecVersionMetadata(api)
	    console.log("API OPEN -- ", role, chainID);
	    // subscribeStorage returns changes from ALL blockHashes, including the ones that eventually get dropped upon finalization
	    api.rpc.state.subscribeStorage(async (results) => {
		this.processSubscribeStorage(api, role, chainID, results, paraID, paraIDDest)
	    })
	    // subscribeFinalized returns finalized headers
            api.rpc.chain.subscribeFinalizedHeads(async (header) => {
		this.processFinalizedHead(api, role, chainID, header, paraID, paraIDDest);
	    })
	    apis[role].api  = api
	}
	this.apis = apis;
	return(apis);
    }
    
    // execute xcmTransactor.transactThroughSigned and observe blocks
    // assumes setupAPIs has been set up
    async xcmTransactor_transactThroughSigned(account, paraID, paraIDDest, currencyID, contract, input, chainIDRelay = 60000) {
	let api = this.apis["origination"].api;
	// ***** TODO: get ethereum call from ethers contract ABI, estimate gasLimit
	const gasLimit = 300000;
	const xcmTransaction = {
	    V1: {
		gasLimit,
		feePayment: "Auto",
		action: {
		    Call: contract
		},
		value: 0,
		input,
		accessList: null
	    }
	}

	// map internaltx to encodedCall

	const internaltx = api.tx.ethereumXcm.transact(xcmTransaction)

	let encodedCall = internaltx.toHex();
	encodedCall = encodedCall.replace("0x810104", "0x");
	console.log("GENERATED ethereumXcm.transact", encodedCall);

	// ***** TODO: compute this more precisely using paraID / paraIDDest fee model from on chain data + check balances on derivedaccount are sufficient
	// 30000000000000000 => 0x0000000000000000006a94d74f430000
	const feeAmount = "30000000000000000"  // check if really optional wrt AssetsTrapped
	const transactRequiredWeightAtMost = "8000000000" // required
	const overallWeight = null   // check if really optional wrt AssetsTrapped

	//console.log(api.tx.ethereumXcm.transact.toJSON());
	//console.log(api.tx.xcmTransactor.transactThroughSigned.toJSON());
	// VersionedMultiLocation
	let dest = {
	    V1: {
		parents: 1,
		interior: {
		    X1: {
			Parachain: paraIDDest
		    }
		}
	    }
	};
	// CurrencyPayment<CurrencyIdOf<T>>
	let fee = {
	    currency: {
		AsCurrencyId: {
		    ForeignAsset: currencyID, 
		}
	    },
	    feeAmount
	}
	// TransactWeights
	let weightInfo = {
	    transactRequiredWeightAtMost,
	    overallWeight
	}
	
	let sectionMethod = "xcmTransactor:transactThroughSigned";
	let func = api.tx.xcmTransactor.transactThroughSigned;
	let args = [dest, fee, encodedCall, weightInfo];
	let isEVMTx = false;
	return [sectionMethod, func, args, isEVMTx];	
    }
}
