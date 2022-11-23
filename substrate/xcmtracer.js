#!/usr/bin/env node
 // Usage: xcmTrace trace.json
const fs = require('fs');
const paraTool = require("./paraTool");
const AssetManager = require("./assetManager");
const events = require('events');
const readline = require('readline');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const xcmInstructions = require("./xcmInstructions");

module.exports = class XCMTracer extends AssetManager {
    xcm = {};
    extrinsic = {};
    dest = {};
    spans = {};
    remoteexecution = {};
    covered = {};
    idhash(id) {
        return paraTool.twox_128("cn" + id).substring(0, 16);
    }

    // maps dest like "{ parents: 0, interior: { x1: { parachain: 2000 } } }" into just "2000"
    dest_to_chainID(dest, relayChain = "polkadot") {
        if (dest && dest.interior && dest.interior.x1 && dest.interior.x1.parachain) {
            let paraID = dest.interior.x1.parachain;
            return (paraTool.getChainIDFromParaIDAndRelayChain(paraID, relayChain));
        }
        return (null)
    }

    compute_instruction_weight(instruction, id, relayChain) {
        // Polkadot per instruction
        if (relayChain == "polkadot") {
            let DOTWeightToFeeCoefficient = (10 ** 10 / (10 * 100 * 85212000));
            let XCMDotCost = 1000000000 * DOTWeightToFeeCoefficient / 10 ** 10; // per instruction
            return XCMDotCost;
        }
        if (relayChain == "kusama") {
            let weight_per_read = 25000000;
            let weight_per_write = 100000000;
            let model = xcmInstructions.getInstructionSet();
            let reads = model.reads ? model.reads : 0;
            let writes = model.writes ? model.writes : 0;
            let ExtrinsicBaseWeight = 86309000;
            let TotalWeight = reads * weight_per_read + writes * weight_per_write + ExtrinsicBaseWeight;
            let KSMWeightToFeeCoefficient = (10 ** 12 / (10 * 30000 * 86309000))
            let XCMKSMCost = (TotalWeight * KSMWeightToFeeCoefficient) / (10 ** 12);
            return XCMKSMCost;
        }

        if (id == "moonbeam" || id == "moonriver") {
            // all instructions have fixed amount of weight per instruction.
            let weight = 200000000
            // TODO:
            return weight;
        } else if (id == "moonbase-alpha" || id == "moonbase-beta") {
            // generic XCM instructions benchmarked, fungible XCM instructions fixed amount of weight per instruction.
            let weight_per_read = 25000000;
            let weight_per_write = 100000000;
            // TODO:
            return 0;
        }

        return 1000000;
    }
    generate_span_trace(extrinsicID, finalized = true, blockHash = "") {
        return this.idhash((finalized === false) ? `${extrinsicID}UNF${blockHash}` : extrinsicID);
    }

    generate_span_extrinsic(extrinsicID, finalized = true, blockHash = "", xcmIndex = 0, transferIndex = 0) {
        let base = `${extrinsicID}${xcmIndex}${transferIndex}`
        return this.idhash((finalized === false) ? `${base}UNF${blockHash}` : base);
    }

    generate_span_remoteexecution(xcmid, transactIdx, finalized = true, blockHash = "") {
        let base = `${xcmid}${transactIdx}`
        return this.idhash((finalized === false) ? `${base}UNF${blockHash}` : base);
    }

    generate_span_dest(destEventID, finalized = true, blockHash = "") {
        return this.idhash((finalized === false) ? `${destEventID}UNF${blockHash}` : destEventID);
    }

    generate_span_xcmmessage(msgHash, finalized = true, stateRoot = "") {
        return this.idhash((finalized === false) ? `${msgHash}UNF${stateRoot}` : msgHash);
    }

    async submitleg(extrinsicID, ext, msgHash, destEventID, parentspanid = null, chainIDDest = null) {
        let traceId = this.generate_span_trace(extrinsicID, ext ? ext.finalized : true, ext ? ext.blockHash : "");
        let sectionMethod = "extrinsic";
        let id = "origination"
        let idDest = "destination";
        if (ext) {
            let exttags = {};
            let chainID = ext.chainID;
            let chainIDDest = ext.chainIDDest;
            let [__, _id] = this.getNameByChainID(ext.chainID)
            let [_, _idDest] = this.getNameByChainID(ext.chainIDDest)
            id = _id;
            idDest = _idDest;

            for (const [k, v] of Object.entries(ext)) {
                if (v) {
                    switch (k) {
                        case "chainID":
                        case "chainIDDest":
                        case "incomplete":
                        case "isFeeItem":
                        case "msgHash":
                        case "relayChain":
                        case "xcmIndex":
                        case "transferIndex":
                        case "sourceTS":
                        case "sentAt":
                        case "xcmType":
                            break;
                        case "amountSent":
                            exttags[k.toString()] = v.toString();
                            let p = await this.computePriceUSD({
                                symbol: ext.xcmSymbol,
                                relayChain: ext.relayChain,
                                ts: ext.sourceTS
                            });
                            if (p) {
                                exttags[`amountSentRaw`] = ext.amountSent.toString();
                                exttags[`amountSent`] = `${ext.amountSent/10**p.assetInfo.decimals} ${ext.xcmSymbol}`;
                                exttags["amountSentUSD"] = (p.priceUSD * ext.amountSent / 10 ** p.assetInfo.decimals).toString();
                            }
                            break;
                        case "extrinsicHash":
                            exttags[k.toString()] = v.toString();
                            exttags["extrinsicURL"] = `https://polkaholic.io/extrinsic/${v}`
                            break;
                        case "blockNumber":
                            exttags[k.toString()] = v.toString();
                            exttags["blockNumberURL"] = `https://polkaholic.io/block/${id}/${v}`
                            break;
                        case "sectionMethod":
                            sectionMethod = v.toString();
                            break;
                        default:
                            exttags[k.toString()] = v.toString();
                    }
                }
            }
            let spanextrinsic = this.generate_span_extrinsic(extrinsicID, ext.finalized, ext.blockHash, ext.xcmIndex, ext.transferIndex);
            this.push_span(extrinsicID, {
                id: spanextrinsic,
                traceId: traceId,
                timestamp: ext.sourceTS * 1000000,
                duration: 1000000,
                name: sectionMethod,
                tags: exttags,
                localEndpoint: {
                    serviceName: id
                }
            })
            if (parentspanid == null) {
                parentspanid = spanextrinsic;
            }
        } else {
            if (chainIDDest != null) {
                try {
                    let [_, _idDest] = this.getNameByChainID(chainIDDest)
                    idDest = _idDest;
                } catch (err) {
                    console.log("this.getNameByChainID FAIL0", chainIDDest);
                }
            }
        }

        let xcm = this.xcm[msgHash];
        let xcmid = this.generate_span_xcmmessage(msgHash, xcm.finalized, xcm.relayStateRoot);
        let msgtags = {}
        let msgType = "xcmp";
        let msgHex = null;
        let prevspanid = parentspanid;
        if (xcm) {
            for (const [k, v] of Object.entries(xcm)) {
                if (v) {
                    let k0 = k.toString();
                    let v0 = v.toString();
                    switch (k) {
                        case "msgType":
                            msgType = v.toString();
                            // messages processed on relay chain
                            if (msgType == "ump") {
                                idDest = xcm.relayChain
                            } else {
                                try {
                                    let [_chainID, _idDest] = this.getNameByChainID(xcm.chainIDDest.toString())
                                    idDest = _idDest;
                                    chainIDDest = _chainID;

                                } catch (err) {
                                    console.log(err)
                                    console.log("this.getNameByChainID FAIL1", xcm.chainIDDest, JSON.stringify(Object.keys(this.chainInfos)));
                                }
                            }
                            break;
                        case "instructions":
                        case "blockTS":
                        case "chainID":
                        case "chainIDDest":
                        case "isIncoming":
                        case "relayChain":
                            break;
                        case "msgHex":
                            msgHex = xcm.msgHex;
                            break;
                        case "msgStr":
                            //let xcm = JSON.parse(v0);
                            msgtags[k0] = v0;
                            break;
                        default:
                            msgtags[k0] = v0;
                    }
                }
            }
            this.push_span(extrinsicID, {
                id: xcmid,
                traceId: traceId,
                timestamp: xcm.blockTS * 1000000,
                duration: 1000000,
                name: `xcm:${msgType}`,
                parentId: prevspanid,
                tags: msgtags,
                localEndpoint: {
                    serviceName: xcm.relayChain
                }
            })
            prevspanid = xcmid;
            if (xcm.instructions) {
                // the xcm message received by the dest may result in one or more legs
                //   in receive_msg, we precomputed which instructions actually have recursive xcm instructions inside them
                let ts = xcm.blockTS * 1000000;

                for (let i = 0; i < xcm.instructions.length; i++) {
                    let {
                        instruction,
                        hex,
                        childinstruction,
                        childhex
                    } = xcm.instructions[i];
                    let spanid = this.idhash(prevspanid + hex);
                    let [opcode, params] = this.get_instruction_opcode_params(xcm.instructions[i].instruction.toJSON());
                    let weight = this.compute_instruction_weight(instruction, idDest, this.relayChain);
                    let duration = weight / 10 ** 6; // microseconds
                    let instructiontags = {
                        "hex": xcm.instructions[i].hex
                    };
                    let requireWeightAtMost = 8000000000;
                    if (params) {
                        if (Array.isArray(params)) {
                            instructiontags["params"] = JSON.stringify(params)
                        } else if (typeof params === 'object') {
                            for (const [k, v] of Object.entries(params)) {
                                if (v) {
                                    switch (k) {
                                        case "requireWeightAtMost":
                                            requireWeightAtMost = v;
                                            break;
                                    }
                                }
                                instructiontags[k] = JSON.stringify(v);
                            }
                        }
                    }
                    this.push_span(extrinsicID, {
                        id: spanid,
                        parentId: prevspanid,
                        traceId: traceId,
                        timestamp: ts,
                        duration: duration,
                        name: `xcvm:${opcode}`,
                        tags: instructiontags,
                        localEndpoint: {
                            serviceName: idDest // this is the parachain executing the instruction -- compute it using "dest" multilocation
                        }
                    })
                    ts += duration;
                    ts++;
                    prevspanid = spanid;

                    if (msgHash && opcode == "transact" && (this.remoteexecution[msgHash] != undefined)) {
                        let remoteexecution = this.remoteexecution[msgHash];
                        let remoteexecutiontags = {}
                        let remoteexecutionts = ts;
                        let childextrinsicID = null;
                        for (const [k, v] of Object.entries(remoteexecution)) {
                            if (v) {
                                let k0 = k.toString();
                                let v0 = v.toString();
                                switch (k) {
                                    case "chainID":
                                    case "msgHash":
                                    case "isConnectedCall":
                                        break;
                                    case "timestamp":
                                        remoteexecutionts = v * 1000000;
                                        break;
                                    case "swaps":
                                    case "transfers":
                                    case "accessList":
                                        if (Array.isArray(v) && v.length > 0) {
                                            v0 = JSON.stringify(v);
                                            if (v0.length > 0) {
                                                remoteexecutiontags[k0] = v0;
                                            }
                                        }
                                        break;
                                    case "substrate":
                                        if (v.extrinsicID) {
                                            childextrinsicID = v.extrinsicID;
                                            remoteexecutiontags[k0] = JSON.stringify(v);
                                        }
                                        break;
                                    case "decodedInput":
                                    case "decodedLogs":
                                        v0 = JSON.stringify(v);
                                        if (v0.length > 0) {
                                            remoteexecutiontags[k0] = v0;
                                        }
                                        break;
                                    default:
                                        remoteexecutiontags[k0] = v0;
                                }
                            }
                        }
                        let duration = requireWeightAtMost / 10 ** 6; // requireAtMost is in picoseconds (10^12), but spans are in microseconds thus 10^6/10^12 = /10^6
                        // NOTE: in case there are multiple transacts caused by the xcm message
                        let remoteexecspanid = this.generate_span_remoteexecution(xcmid, i, remoteexecution.finalized, remoteexecution.blockHash);

                        this.push_span(extrinsicID, {
                            id: remoteexecspanid,
                            traceId: traceId,
                            timestamp: ts,
                            duration: duration,
                            name: `xcvm:remoteexecution`,
                            parentId: prevspanid, // parent is the transact instruction
                            tags: remoteexecutiontags,
                            localEndpoint: {
                                serviceName: idDest
                            }
                        })
                        if (remoteexecution.childMsgHash) {
                            if (this.xcm[remoteexecution.childMsgHash]) {
                                console.log("READY", remoteexecution.childMsgHash);
                                await this.submitleg(extrinsicID, null, remoteexecution.childMsgHash, null, remoteexecspanid, chainIDDest);
                            } else {
                                console.log("NOT READY", remoteexecution.childMsgHash);
                            }
                        }

                        if (childextrinsicID) {
                            if (this.extrinsic[childextrinsicID]) {
                                // there is a child extrinsic!  so we continue to child extrinsicID.  BUT:
                                // (a) msgHash: no msgHash, so we pass null
                                // (b) destEventID: no destEventID, so we pass null
                                // (c) remoteexecspanid is PASSED so the "transact" span is the parent of the child extrinsic
                                // (d) destChainID: we are on the same chain still with this remote execution
                                console.log("***** REMOTE EXECUTION CHILD DATA with XCM data", remoteexecspanid, destChainID);
                                await this.submitleg(extrinsicID, this.extrinsic[childextrinsicID], null, null, remoteexecspanid, chainIDDest);
                            } else {
                                console.log("REMOTE EXECUTION CHILD DATA, but not XCM");
                            }
                        } else {
                            console.log("REMOTE EXECUTION NO CHILD data");
                        }

                        ts += duration;
                        ts++;
                    }

                    if (childhex.length > 0) {
                        let childxcm = this.find_xcm_by_hex(childhex, xcm.blockTS);
                        if (childxcm) {
                            if (params.dest) {
                                let destChainID = this.dest_to_chainID(params.dest, xcm.relayChain);
                                if (destChainID) {
                                    // RECURSION: we found a new dest and the next leg is not an extrinsic, but we link all tracing to a single extrinsicID
                                    let childdest = this.find_dest(childxcm.msgHash, childxcm.sentAt);
                                    let childdestEventID = null
                                    if (childdest) {
                                        childdestEventID = childdest.eventID;
                                        //console.log("CHILDDEST", childxcm.msgHash, childdestEventID, childdest);
                                    }
                                    await this.submitleg(extrinsicID, null, childxcm.msgHash, childdestEventID, spanid, destChainID);
                                } else {
                                    console.log("----- DEST UNK0", params)
                                }
                            } else {
                                console.log("----- DEST UNK1", params)
                            }

                        }
                    }

                }
            }

        } else {
            console.log("Missing", msgHash);
        }
        if (destEventID && this.dest[destEventID]) {
            let dest = this.dest[destEventID];
            let destid = this.generate_span_dest(destEventID, dest.finalized, dest.blockHash);
            let desttags = {}
            let idDest = "destination";
            let [_chainIDDest, _idDest] = this.getNameByChainID(dest.chainIDDest)
            if (_idDest) idDest = _idDest;
            for (const [k, v] of Object.entries(dest)) {
                switch (k) {
                    case "chainIDDest":
                        break;
                    case "method":
                    case "pallet":
                        //case "msgHash":
                    case "xcmSymbol":
                    case "relayChain":
                    case "xcmInteriorKey":
                    case "sentAt":
                        break;
                    case "amountReceived":
                        desttags[k.toString()] = v.toString();

                        let p = await this.computePriceUSD({
                            symbol: dest.xcmSymbol,
                            relayChain: dest.relayChain,
                            ts: dest.destTS
                        });
                        if (p) {
                            desttags[`amountReceivedRaw`] = dest.amountReceived.toString();
                            desttags[`amountReceived`] = `${dest.amountReceived/10**p.assetInfo.decimals} ${dest.xcmSymbol}`;
                            desttags["amountReceivedUSD"] = (p.priceUSD * dest.amountReceived / 10 ** p.assetInfo.decimals).toString();
                            if (p.priceUSD) {
                                desttags["priceUSD"] = p.priceUSD.toString();
                            }
                        } else {
                            console.log("miss computePriceUSD lookup", dest.xcmSymbol, dest.relayChain, dest.xcmInteriorKey);
                        }
                        break;
                    case "blockNumberDest":
                        desttags["blockNumber"] = v.toString();
                        desttags["blockNumberURL"] = `https://polkaholic.io/block/${idDest}/${v.toString()}`
                        break;
                    default:
                        if (k && v) {
                            desttags[k.toString()] = v.toString();
                        }
                }
            }
            let dest_eventName = `${dest.pallet}:${dest.method}`;
            this.push_span(extrinsicID, {
                id: destid,
                parentId: prevspanid,
                traceId: traceId,
                timestamp: dest.destTS * 1000000,
                duration: 1000000,
                name: dest_eventName,
                tags: desttags,
                localEndpoint: {
                    serviceName: idDest
                }
            })
        }
        return traceId;
    }

    get_instruction_opcode_params(instruction) {
        for (const opcode of Object.keys(instruction)) {
            return [opcode, instruction[opcode]]
        }
        return [null, null];
    }
    compute_inclusion(childhex, c) {
        //console.log("compute_inclusion", childhex, c);
        // cnt0 = # of elements of childhex in fp1
        let cnt0 = 0;
        for (let i = 0; i < childhex.length; i++) {
            for (let j = 0; j < c.length; j++) {
                if (c[j].hex == childhex[i]) {
                    cnt0++;
                }
            }
        }
        return (cnt0 == childhex.length);

    }
    find_xcm_by_hex(childhex, parentTS) {
        // given the parentTS
        for (const msgHash of Object.keys(this.xcm)) {
            if (this.xcm[msgHash].instructions) {
                if (this.compute_inclusion(childhex, this.xcm[msgHash].instructions)) {
                    return (this.xcm[msgHash]);
                }
            } else {
                console.log("find_xcm_by_hex - MISSING INST", msgHash);
            }
        }
        return (null);

    }

    push_span(extrinsicID, span) {
        if (this.spans[extrinsicID] == undefined) {
            this.spans[extrinsicID] = [];
        }
        if (this.covered[span.id] != undefined) return;
        this.spans[extrinsicID].push(span);
        this.covered[span.id] = true
    }

    dump() {
        console.log("extrinsics", Object.keys(this.extrinsic).length)
        console.log("xcm", Object.keys(this.xcm).length)
        console.log("remoteexecution", Object.keys(this.remoteexecution).length)
        console.log("dest", Object.keys(this.dest).length)
    }

    find_dest(msgHash, sentAt = 0) {
        for (const eventID of Object.keys(this.dest)) {
            let diff = this.dest[eventID].sentAt - sentAt;
            if (this.dest[eventID].msgHash == msgHash && diff >= 0 && diff <= 6) {
                return (this.dest[eventID]);
            }
        }
        return (null);
    }

    find_dest_extrinsic(e) {
        let cand = [];
        for (const eventID of Object.keys(this.dest)) {
            let d = this.dest[eventID];
            let diff = d.sentAt - e.sentAt;
            if (e.destAddress == d.fromAddress && e.xcmInteriorKey == d.xcmInteriorKey && (diff >= 0 && diff <= 6)) {
                cand.push(d);
            }
        }
        if (cand.length == 1) {
            //console.log("SINGLE", e, cand[0])
            return (cand[0]);
        }
        if (cand.length > 1) {
            console.log("MULTIPLE", e, cand)
        }
        return null;
    }

    async match() {
        // for all the extrinsics that have msgHash

        for (const extrinsicID of Object.keys(this.extrinsic)) {
            let e = this.extrinsic[extrinsicID];
            let traceID = null;

            if (e.incomplete == 1) {
                //console.log("0 extrinsic incomplete.. skip emit span with event");
            } else if (e.msgHash && this.xcm[e.msgHash]) {
                // we can link the extrinsic to a message so:
                let dest = this.find_dest(e.msgHash, e.sentAt);
                if (dest) {
                    traceID = await this.submitleg(e.extrinsicID, this.extrinsic[extrinsicID], e.msgHash, dest.eventID)
                    // 123 extrinsic+xcm+dest span 3001855-2 0x80436201761cb8f6df1714deb2ba1156881911a24ed42a07b2d6859ba55b365e 22092-1816245-1-8 https://xcmscan.polkaholic.io/trace/1c530049b0f7892c?uiEmbed=v0
                    console.log("123 extrinsic+xcm+dest leg", e.extrinsicID, e.msgHash);
                    // send unfinalized/finalized xcminfo
                    this.build_send_xcminfo(this.extrinsic[extrinsicID], dest);
                } else {
                    // don't really need dest anymore.
                    console.log("12 extrinsic+xcm span only, no dest", e.extrinsicID, e.msgHash);
                    traceID = await this.submitleg(e.extrinsicID, this.extrinsic[extrinsicID], e.msgHash, null)
                }
            } else {
                // no messagehash in extrinsic, find dest by
                let dest = this.find_dest_extrinsic(e);

                if (dest && this.xcm[dest.msgHash] != undefined) {
                    e.msgHash = dest.msgHash;
                    traceID = await this.submitleg(e.extrinsicID, this.extrinsic[extrinsicID], e.msgHash, dest.eventID)
                    console.log("123 extrinsic+xcm+dest leg (without ext msgHash)");
                    // send xcminfo 
                    this.build_send_xcminfo(this.extrinsic[extrinsicID], dest);
                } else {
                    //console.log("extrinsic sentAt / beneficiaries dest match required");
                }
            }
            if (e.incomplete == 0) {
                let spans = this.spans[extrinsicID];
                let endpoint = "http://efinity-internal.polkaholic.io:9411"
                let cmd = `curl -X POST ${endpoint} -H 'Content-Type: application/json' -d '${JSON.stringify(spans, null, 4)}'`
                if (spans) {
                    //console.log(cmd);
                    const {
                        stdout,
                        stderr
                    } = await exec(cmd, {
                        maxBuffer: 1024 * 64000
                    });
                    if (traceID) {
                        if (this.covered[traceID] == undefined) {
                            this.batchedSQL.push(`update xcmtransfer set traceID = '${traceID}' where extrinsicID='${extrinsicID}'`)
                            this.update_batchedSQL();
                            this.covered[traceID] = true;
                        }
                    }
                } else {
                    console.log("NO SPANS");
                }
            } else {
                console.log("INCOMPLETE");
            }
        }
        await this.flushWSProviderQueue()
    }


    build_send_xcminfo(ext, dest) {
        try {
            let xcmInfo = ext.xcmInfo;
            let o = xcmInfo.origination;
            let d = xcmInfo.destination;
            let xcminfoHash = paraTool.twox_128(`${dest.eventID}${dest.finalized}`);
            if (o && d && dest && (dest.destTS > this.getCurrentTS() - 120) && (this.covered[xcminfoHash] == undefined)) {
                if (dest.amountReceived && o.decimals != undefined) {
                    d.amountReceived = dest.amountReceived / (10 ** o.decimals);
                    d.teleportFee = o.amountSent - d.amountReceived;
                    if (xcmInfo.priceUSD) {
                        d.amountReceivedUSD = d.amountReceived * xcmInfo.priceUSD;
                        d.teleportFeeUSD = d.teleportFee * xcmInfo.priceUSD;
                    }
                    // d.teleportFeeChainSymbol already set
                }
                if (dest.eventID) d.eventID = dest.eventID;
                if (dest.blockNumberDest) d.blockNumber = dest.blockNumberDest;
                if (dest.destTS) d.ts = dest.destTS;
                d.finalized = dest.finalized;
                if (d.finalized && d.executionStatus == "pending") {
                    d.executionStatus = "success";
                }
		console.log("build_send_xcminfo -> sendExternalWSProvider", dest.eventID, dest.finalized, JSON.stringify(xcmInfo, null, 4))
                this.sendExternalWSProvider("name", xcmInfo);
		this.covered[xcminfoHash] = true;
            }
        } catch (err) {
            console.log("build_send_xcminfo", err);
        }
    }

    decodeXcmVersionedXcms(api, xcm) {
        var o = this.api.registry.createType('XcmVersionedXcm', xcm.msgHex)
        return;
        let msgHash = '0x' + paraTool.blake2_256_from_hex(data)
        try {
            let fragments = [];
            let msgHashes = [];
            let remainingMessage = data;
            while (remainingMessage.length >= 0 && remainingMessage != '0x') {
                let instructions = api.registry.createType('XcmVersionedXcm', remainingMessage);
                let instructionsJSON = instructions.toJSON()
                let instructionHex = instructions.toHex()
                let instructionLen = instructionHex.length
                let mhash = '0x' + paraTool.blake2_256_from_hex(instructionHex)
                //console.log(`instructionHex=${instructionHex} -> msgHash=${mhash}`)
                msgHashes.push(mhash)
                //console.log(`instruction(len=${instructionLen})`, instructionsJSON)
                remainingMessage = '0x' + remainingMessage.slice(instructionLen)
                let f = {
                    msg: instructionsJSON,
                    hex: instructionHex,
                    msgHash: mhash,
                    len: instructionHex.length - 2,
                }
                fragments.push(f)
            }
            return fragments;
        } catch (e) {
            return false
        }
    }

    receiveMsg(msg, lookbackSeconds = 3600) {
        let recursiveInstructions = [
            ["isTransferReserveAsset", "asTransferReserveAsset"],
            ["isDepositReserveAsset", "asDepositReserveAsset"],
            ["isInitiateReserveWithdraw", "asInitiateReserveWithdraw"],
            ["isInitiateTeleport", "asInitiateTeleport"],
            ["isExchangeAsset", "asExchangeAsset"]
        ];
        let startTS = this.getCurrentTS() - lookbackSeconds;
        switch (msg.type) {
            case "xcmtransfer":
                let ext = msg.msg;
                let extrinsicID = ext.extrinsicID;
                //if (this.extrinsic[extrinsicID] || (ext.sourceTS < startTS)) return;
                this.extrinsic[extrinsicID] = ext;
                break;
            case "xcmmessage":
                let xcm = msg.msg;
                if (this.xcm[xcm.msgHash] || xcm.blockTS < startTS) return;
                this.xcm[xcm.msgHash] = xcm
                //should just use msgStr directly
                var o = this.api.registry.createType('XcmVersionedXcm', xcm.msgHex)
                /*
                //var o = this.api.registry.createType('XcmVersionedXcm', JSON.parse(xcm.msgStr))
                let derivedInstructionHex = o.toHex()
                if (derivedInstructionHex != xcm.msgHash) {
                    console.error(`msgHex mismatch. raw=${xcm.msgHex}, derived:${derivedInstructionHex}`);
                }
                */
                xcm.instructions = [];
                if (o.isV2) {
                    for (let i = 0; i < o.asV2.length; i++) {
                        let inst = o.asV2[i];
                        let instruction = {
                            instruction: inst,
                            hex: inst.toHex(),
                            childinstruction: [],
                            childhex: []
                        }
                        xcm.instructions.push(instruction);
                    }
                } else if (o.isV1) {
                    let inst = o.asV1;
                    xcm.instructions.push({
                        instruction: inst,
                        hex: inst.toHex(),
                        childinstruction: [],
                        childhex: []
                    })
                }
                for (let i = 0; i < xcm.instructions.length; i++) {
                    // for all the instructions in the message, see if they could exhibit recursive
                    let instruction = xcm.instructions[i];
                    let inst = instruction.instruction;
                    for (let j = 0; j < recursiveInstructions.length; j++) {
                        let is = recursiveInstructions[j][0];
                        let as = recursiveInstructions[j][1];
                        if (inst[is]) { // ok, this instruction could exhibit recursion
                            let o2 = inst[as];
                            if (o2.xcm != undefined) { // ok, this instruction actually does exhibit recursion, containing one or more of "xcm" messages
                                // for each of the "child" instructions within "xcm", store the hex
                                for (let k = 0; k < o2.xcm.length; k++) {
                                    instruction.childinstruction.push(o2.xcm[k]);
                                    instruction.childhex.push(o2.xcm[k].toHex());
                                }
                            }
                        }
                    }
                }
                break;
            case "xcmtransferdestcandidate":
                let dest = msg.msg;
                if (dest.destTS && (dest.destTS < startTS)) return;
                if (msg.finalized != undefined) dest.finalized = msg.finalized;
                this.dest[dest.eventID] = dest
                break;
            case "remoteExecution":
                let remoteexecution = msg.msg;
                this.remoteexecution[remoteexecution.msgHash] = remoteexecution
                break;
        }
    }
}
