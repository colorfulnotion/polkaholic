// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic

const AssetManager = require("../../polkaholic/substrate/assetManager");
const mysql = require("mysql2");
const paraTool = require("../../polkaholic/substrate/paraTool");

module.exports = class XCMManager extends AssetManager {
    constructor() {
        super("manager")
    }

    lastupdateTS = 0

    xcmAddresses = [];
    assetChains = {};

    async xcm_init() {
        await this.init_chain_asset_and_nativeAsset() // this will init assetInfo and assetLog
        console.log(`this.xcmAssetInfo`, this.xcmAssetInfo)
    }

    getNativeChainAsset(chainID) {
        let asset = this.getChainAsset(chainID)
        let nativeAssetChain = paraTool.makeAssetChain(asset, chainID);
        //console.log(`Convert to nativeAssetChain ${chainID} -> ${nativeAssetChain}`)
        return nativeAssetChain
    }

    getXCMAsset(interiorStr, relayChain) {
        let xcmInteriorKey = paraTool.makeXcmInteriorKey(interiorStr, relayChain);
        let xcmAsset = this.getXcmAssetInfoByInteriorkey(xcmInteriorKey)
        if (xcmAsset && xcmAsset.nativeAssetChain != undefined) {
            console.log(`Found ${xcmInteriorKey} -> ${xcmAsset.nativeAssetChain}`)
            return xcmAsset.nativeAssetChain
        } else {
            console.log(`getXCMAsset NOT Found/Missing ${xcmInteriorKey}`)
            return false
        }
    }

    getParaIDfromChainID(chainID) {
        let paraID;
        if (chainID == 0 || chainID == 2) {
            paraID = 0
        } else if (chainID > 20000) {
            paraID = chainID - 20000
        } else {
            paraID = chainID
        }
        return paraID
    }

    get_concrete_assetChain(c, chainID, chainIDDest) {
        let paraID = this.getParaIDfromChainID(chainID)
        let paraIDDest = this.getParaIDfromChainID(chainIDDest)
        //let paraIDDest = (chainIDDest > 20000) ? chainIDDest - 20000 : chainIDDest;
        let relayChain = (chainIDDest > 20000 || chainIDDest == 2) ? "kusama" : "polkadot";
        let relayChainID = (relayChain == 'polkadot') ? 0 : 2

        if (c.parents !== undefined && c.interior !== undefined) {
            let parents = c.parents;
            let interior = c.interior;
            let interiorType = Object.keys(interior)[0]

            if (interiorType == 'here') {
                /*
                ??? NOT sure which one is correct
                  parents: 0 -> referring to itself
                  parents: 1 -> referring to parents (relaychain)
                */
                let targetAsset = (parents == 0) ? this.getNativeChainAsset(chainIDDest) : this.getNativeChainAsset(relayChainID)
                //let targetAsset = (parents == 0) ? this.getNativeChainAsset(relayChainID) : this.getNativeChainAsset(relayChainID)
                //console.log(`[paranets=${parents}] ${chainID} ${chainIDDest} ${JSON.stringify(interior)} -> ${targetAsset}`)
                return targetAsset
            } else {
                let interiorVal = interior[interiorType]
                if (parents == 1 || (chainIDDest == relayChainID)) {
                    // easy case: no expansion if it's from relaychain's perspective
                } else {
                    // expand the key
                    let new_interiorVal = []
                    let expandedParachainPiece = {
                        parachain: paraIDDest
                    }
                    new_interiorVal.push(expandedParachainPiece)
                    if (interiorType == 'x1') {
                        new_interiorVal.push(interiorVal)

                    } else if (Array.isArray(interiorVal)) {
                        //x2/x3/x4/..
                        for (const v of interiorVal) {
                            new_interiorVal.push(v)
                        }
                        //new_interiorVal.concat(interiorVal)
                    } else {
                        console.log(`expansion error. expecting array`, JSON.stringify(interior))
                        return false
                    }
                    console.log(`${chainID}, ${chainIDDest} [parents=${parents}] expandedkey ${JSON.stringify(interiorVal)} ->  ${JSON.stringify(new_interiorVal)}`)
                    interiorVal = new_interiorVal
                }
                let interiorVStr = JSON.stringify(interiorVal)
                let res = this.getXCMAsset(interiorVStr, relayChain)
                if (res) {
                    //console.log(`get_concrete_assetChain FOUND ${chainID}, ${chainIDDest} [parents=${parents}] [${interiorType}] ${JSON.stringify(interior)} -> ${res}`)
                    return res;
                } else {
                    console.log(`get_concrete_assetChain error ${chainID}, ${chainIDDest} [parents=${parents}] [${interiorType}] ${JSON.stringify(interior)}`)
                    return false
                }
            }

        } else {
            console.log("get_concrete_assetChain FAILED2 - parents/interior not set", c);
            return null;
        }
    }

    // All instructions with "MultiAsset" type should be decorated with assetChain / symbols / decimals + USD value at the time of message
    analyzeXCM_MultiAsset(c, chainID, chainIDDest, ctx) {
        if (c.id != undefined) {
            if (c.id.concrete != undefined) {
                if (ctx == "buyExecution") {} else {
                    let assetChain = this.get_concrete_assetChain(c.id.concrete, chainID, chainIDDest);
                    if (assetChain) {
                        this.assetChains[assetChain] = 1;
                    } else {
                        console.log("analyzeXCM_MultiAsset MISS PROBLEM", ctx, chainID, chainIDDest, JSON.stringify(c.id.concrete));
                    }
                }
            } else {
                console.log("analyzeXCM_MultiAsset NOT CONCRETE PROBLEM", chainID, chainIDDest, JSON.stringify(c))
            }
        } else {
            console.log("analyzeXCM_MultiAsset NO ID PROBLEM", chainID, chainIDDest, JSON.stringify(c))
        }
    }

    analyzeXCM_MultiAssetFilter(c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        if (c[fld].wild) {} else if (c[fld].definite) {
            //console.log("analyzeXCM_MultiAssetFilter", chainID, chainIDDest, JSON.stringify(c[fld].definite));
        } else {
            // analyzeXCM_MultiAssetFilter 22085 2 {"definite":[{"id":{"concrete":{"parents":0,"interior":{"here":null}}},"fun":{"fungible":10000000000}}]}
            console.log("analyzeXCM_MultiAssetFilter", ctx, chainID, chainIDDest);
        }
    }

    // All instructions with "MultiLocation" (parachain, accountID32/ accountID20, here) should be decorated with chain.id, chain.chainName or the "identity" using lookup_account
    analyzeXCM_MultiLocation(c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;

        let interior = c[fld].interior;
        if (interior == undefined) return;
        let x1 = interior.x1;
        if (x1 == undefined) return;
        if (x1.accountId32) {
            this.xcmAddresses.push(x1.accountId32.id);
        } else if (x1.accountKey20) {
            this.xcmAddresses.push(x1.accountKey20.key);
        } else {
            //console.log("analyzeXCM_MultiLocation MISS ", ctx, chainID, chainIDDest, interior);
            return;
        }
    }

    analyzeXCM_Call(c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        if (c[fld].encoded != undefined) {
            // analyzeXCM_Call 22000 2 0x1801010006010f23ada31bd3bb06
            //console.log("analyzeXCM_Call", ctx, chainID, chainIDDest, c[fld].encoded)
            // extrinsicCall = apiAt.registry.createType('Call', opaqueCall);
            // ISSUE: How do we get the right api since the indexer needs the "receiving chain" api? -- can we do a mini-API call for this?
        }
    }

    getInstructionSet() {
        let instructionSet = {
            'withdrawAsset': { // Remove the on-chain asset(s) (assets) and accrue them into Holding
                MultiAssets: ['assets']
            },
            'reserveAssetDeposited': { // Accrue into Holding derivative assets to represent the asset(s) (assets) on Origin.
                MultiAssets: ['assets']
            },
            'receiveTeleportedAsset': {
                MultiAssets: ['assets']
            },
            'queryResponse': {},
            'transferAsset': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary'],
            },
            'transferReserveAsset': {
                MultiAsset: ['assets'],
                MultiLocation: ['destination'],
                XCM: ['xcm']
            },
            'transact': {
                Call: ['call']
            },
            'hrmpNewChannelOpenRequest': {},
            'hrmpChannelAccepted': {},
            'hrmpChannelClosing': {},
            'clearOrigin': {},
            'descendOrigin': {},
            'reportError': {},
            'depositAsset': { // Subtract the asset(s) (assets) from Holding and deposit on-chain equivalent assets under the ownership of beneficiary.
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary']
            },
            'depositReserveAsset': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['beneficiary'],
                XCM: ['xcm']
            },
            'exchangeAsset': {
                MultiAssetFilter: ['give'],
                MultiAssets: ['receive']
            },
            'initiateReserveWithdraw': {
                MultiAssetFilter: ['assets'],
                XCM: ['xcm']
            },
            'initiateTeleport': {
                MultiAssetFilter: ['assets'],
                MultiLocation: ['destination'],
                XCM: ['xcm']
            },
            'queryHolding': {
                MultiLocation: ['destination'],
                MultiAssetFilter: ['assets']
            },
            'buyExecution': { //Pay for the execution of the current message from Holding.
                MultiAsset: ['fees']
            },
            'refundSurplus': {},
            'setErrorHandler': {},
            'setAppendix': {},
            'clearError': {},
            'claimAsset': {
                MultiAsset: ['assets'],
                MultiLocation: ['ticket']
            },
            'trap': {},
            'subscribeVersion': {},
            'unsubscribeVersion': {},
            'burnAsset': {
                MultiAsset: ['assets']
            },
            'expectAsset': {
                MultiAsset: ['assets']
            },
            'expectOrigin': {
                MultiLocation: ['origin']
            },
            'expectError': {},
        }
        return instructionSet
    }

    getXCMParentFingerprintsOfChild(o) {
        let fps = [];
        let xcmInstructions = [
            ["isTransferReserveAsset", "asTransferReserveAsset"],
            ["isDepositReserveAsset", "asDepositReserveAsset"],
            ["isInitiateReserveWithdraw", "asInitiateReserveWithdraw"],
            ["isInitiateTeleport", "asInitiateTeleport"],
            ["isExchangeAsset", "asExchangeAsset"]
        ];

        for (let i = 0; i < o.asV2.length; i++) {
            let instruction = o.asV2[i];
            for (let j = 0; j < xcmInstructions.length; j++) {
                let is = xcmInstructions[j][0];
                let as = xcmInstructions[j][1];
                if (instruction[is]) {
                    let o2 = instruction[as];
                    if (o2.xcm != undefined) {
                        for (let k = 0; k < o2.xcm.length; k++) {
                            let fp = o2.xcm[k].toHex();
                            //console.log("CHILD", as, k, o2.xcm[k].toHex(), JSON.stringify(o2.xcm[k].toJSON()));
                            fps.push(fp);
                        }
                    }
                }
            }
        }

        return fps;
    }

    getXCMChildFingerprints(o) {
        let fps = [];
        for (let i = 0; i < o.asV2.length; i++) {
            let instruction = o.asV2[i];
            let fp = instruction.toHex();
            //console.log(instruction.toJSON(), instruction.toHex());
            fps.push(fp);
        }
        return fps;
    }

    compute_fingerprints_inclusion(fp0, fp1) {
        // cnt0 = # of elements of fp0 in fp1
        let cnt0 = 0;
        for (let i = 0; i < fp0.length; i++) {
            if (fp1.includes(fp0[i])) {
                cnt0++;
            }
        }
        // cnt1 = # of elements of fp1 in fp0
        let cnt1 = 0;
        for (let i = 0; i < fp1.length; i++) {
            if (fp0.includes(fp0[i])) {
                cnt1++;
            }
        }
        if (cnt0 == fp0.length) return (true);
        if (cnt1 == fp1.length) return (true);
        return (false);
    }

    /*
Test:
var Manager = require("./manager");
var manager = new Manager();
var chain = await manager.getChain(2000);
await manager.setupAPI(chain);
var xcmParentHex = "0x021000040000000007007dec26010a130000000003803e7693010700f2052a010e010004000100451f08130001000003803e7693010700f2052a010d01000400010100e27d987db9ed2a7a48f4137c997d610226dc93bf256c9026268b0b8489bb9862";
var xcmParentObj = this.api.registry.createType('XcmVersionedXcm', xcmParentHex);

Try one of thses:
XcmV0JunctionBodyId, XcmV0JunctionBodyPart, XcmV0JunctionNetworkId, XcmV0MultiAsset, XcmV0MultiLocation, XcmV0Order, XcmV0OriginKind, XcmV0Response, XcmV0Xcm, XcmV1Junction, XcmV1MultiAsset, XcmV1MultiLocation, XcmV1MultiassetAssetId, XcmV1MultiassetAssetInstance, XcmV1MultiassetFungibility, XcmV1MultiassetMultiAssetFilter, XcmV1MultiassetMultiAssets, XcmV1MultiassetWildFungibility, XcmV1MultiassetWildMultiAsset, XcmV1MultilocationJunctions, XcmV1Order, XcmV1Response, XcmV1Xcm, XcmV2Instruction, XcmV2Response, XcmV2TraitsError, XcmV2TraitsOutcome, XcmV2WeightLimit, XcmV2Xcm, XcmVersionedMultiAssets, XcmVersionedMultiLocation, XcmVersionedResponse, XcmVersionedXcm
    */

    async decodeXCMv2(hex) {
        var obj = this.api.registry.createType('XcmVersionedXcm', hex);
        return obj.toJSON();
    }

    // for any xcmmessages which have not been fingerprinted (instructionFingerprints is Null), fill in xcmmessages.{parentInclusionFingerprints, instructionFingerprints} using getXCMParentFingerprintsOfChild + getXCMChildFingerprints
    //    this is the raw data for the next step which matches fingerprints across time
    async computeXCMFingerprints(startTS, endTS) {

        let sql = `select incoming, msgHash, blockNumber, sentAt, msgHex from xcmmessages where blockTS >= ${startTS} and blockTS <= ${endTS} and instructionFingerprints is Null order by blockTS desc limit 100000`
        console.log("computeXCMFingerprints:", sql)
        let xcmRecs = await this.poolREADONLY.query(sql);
        let out = [];
        let vals = ["parentInclusionFingerprints", "instructionFingerprints"];
        for (let r = 0; r < xcmRecs.length; r++) {
            let rec = xcmRecs[r];
            let msgHex = xcmRecs[r].msgHex.toString();
            try {
                var xcmObj = this.api.registry.createType('XcmVersionedXcm', msgHex);
                if (xcmObj.isV2) {
                    let parentInclusionFingerprints = this.getXCMParentFingerprintsOfChild(xcmObj);
                    let instructionFingerprints = this.getXCMChildFingerprints(xcmObj);
                    out.push(`('${rec.msgHash}', '${rec.blockNumber}', '${rec.incoming}', '${JSON.stringify(parentInclusionFingerprints)}', '${JSON.stringify(instructionFingerprints)}')`);
                    if (out.length > 20) {
                        console.log("computeXCMFingerprints", out.length);
                        await this.upsertSQL({
                            "table": "xcmmessages",
                            "keys": ["msgHash", "blockNumber", "incoming"],
                            "vals": vals,
                            "data": out,
                            "replace": vals
                        });
                        out = [];
                    }
                }
            } catch (err) {
                console.log(err, msgHex);
            }
        }
        if (out.length > 0) {
            console.log("computeXCMFingerprints", out.length);
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
            out = [];
        }
        console.log("computeXCMFingerprints DONE");
    }

    getXCMInstructionsFromHex(hex) {
        var obj = this.api.registry.createType('XcmVersionedXcm', hex);
        return obj.toJSON();
    }


    analyzeXCMInstruction(instruction, chainID, chainIDDest, ctx = "") {
        let instructionSet = this.getInstructionSet();

        for (const i of Object.keys(instructionSet)) {
            if (instruction[i] != undefined) {
                let features = instructionSet[i];
                if (features.MultiAssets != undefined) {
                    for (let j = 0; j < instruction[i].length; j++) {
                        this.analyzeXCM_MultiAsset(instruction[i][j], chainID, chainIDDest, i);
                    }
                }
                if (features.MultiAsset != undefined) {
                    for (const fld of features.MultiAsset) {
                        if (instruction[i][fld] != undefined) {
                            this.analyzeXCM_MultiAsset(instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }
                if (features.MultiAssetFilter != undefined) {
                    for (const fld of features.MultiAssetFilter) {
                        this.analyzeXCM_MultiAssetFilter(instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
                if (features.MultiLocation != undefined) {
                    for (const fld of features.MultiLocation) {
                        this.analyzeXCM_MultiLocation(instruction[i], fld, chainID, chainIDDest, i);
                    }
                }

                if (features.XCM != undefined) {
                    for (const fld of features.XCM) {
                        if (instruction[i][fld] != undefined) {
                            //console.log("analyzing instruction containing XCM ", instruction);
                            // recursive call
                            let xcmChild = instruction[i][fld];
                            // console.log( "  ... xcmChild:", xcmChild);
                            this.analyzeXCMInstructions(instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }
                if (features.Call != undefined) {
                    for (const fld of features.Call) {
                        this.analyzeXCM_Call(instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
            }
        }
    }

    analyzeXCMInstructions(instructions, chainID, chainIDDest, ctx) {
        for (const instruction of instructions) {
            this.analyzeXCMInstruction(instruction, chainID, chainIDDest, ctx)
        }
    }

    // computeXCMMessageParentMsgHash updates xcmmessages.{parentMsgHash, childMsgHash} using special xcmmessages (those with parentInclusionFingerprints)
    // with these parent-child linkages, a "tree" (really, short chains) can be established
    async computeXCMMessageParentMsgHash(startTS, endTS) {
        let sql = `select incoming, msgHash, blockNumber, sentAt, msgHex, parentInclusionFingerprints, instructionFingerprints, blockTS, chainID, chainIDDest from xcmmessages where parentInclusionFingerprints != '[]' and incoming = 0 and childMsgHash is Null and blockTS >= ${startTS} and blockTS <= ${endTS} order by blockTS desc limit 100000`
        console.log("computeXCMMessageParentMsgHash: ", sql);
        let xcmRecs = await this.poolREADONLY.query(sql);
        let sqlout = [];
        for (let r = 0; r < xcmRecs.length; r++) {
            let rec = xcmRecs[r];
            let parentInclusionFingerprints = JSON.parse(rec.parentInclusionFingerprints);
            //console.log("PARENT: ", rec.msgHash, rec.sentAt, rec.chainID, rec.chainIDDest, "parentInclusionFingerprints", parentInclusionFingerprints, JSON.stringify(this.getXCMInstructionsFromHex(rec.msgHex), null, 2));

            let sqlchild = `select incoming, msgHash, blockNumber, sentAt, instructionFingerprints, blockTS, msgHex, chainID, chainIDDest from xcmmessages where blockTS >= ${rec.blockTS} and blockTS <= ${rec.blockTS+60} and instructionFingerprints is not null and incoming = 0 order by blockTS limit 20`
            let childRecs = await this.poolREADONLY.query(sqlchild);
            for (let c = 0; c < childRecs.length; c++) {
                let childRec = childRecs[c];
                var childObj = this.api.registry.createType('XcmVersionedXcm', rec.msgHex.toString());
                let instructionFingerprints = JSON.parse(childRec.instructionFingerprints);
                let inclusion = this.compute_fingerprints_inclusion(parentInclusionFingerprints, instructionFingerprints);
                //console.log("CHILD", inclusion, childRec.msgHash, childRec.sentAt, childRec.chainID, childRec.chainIDDest, "delay", childRec.blockTS - rec.blockTS, childRec.instructionFingerprints, JSON.stringify(this.getXCMInstructionsFromHex(childRec.msgHex), null, 2));
                if (inclusion) {
                    let updsql = `update xcmmessages set parentMsgHash = '${rec.msgHash}', parentSentAt='${rec.sentAt}' where msgHash = '${childRec.msgHash}' and blockNumber = '${childRec.blockNumber}' and incoming = '${childRec.incoming}'`;
                    console.log(updsql);
                    this.batchedSQL.push(updsql);
                    await this.update_batchedSQL();
                    c = childRecs.length;

                    let updsql2 = `update xcmmessages set childMsgHash = '${childRec.msgHash}', childSentAt='${childRec.sentAt}' where msgHash = '${rec.msgHash}' and blockNumber = '${rec.blockNumber}' and incoming = '${rec.incoming}'`;
                    console.log(updsql2);
                    this.batchedSQL.push(updsql2);
                }
            }
            //console.log("---");
        }

        // match xcmmessages to xcmtransfer records with sentAt < 4 difference
        let sql1 = `update xcmtransfer, xcmmessages set xcmmessages.extrinsicID = xcmtransfer.extrinsicID, xcmmessages.extrinsicHash = xcmtransfer.extrinsicHash 
   where xcmtransfer.msgHash = xcmmessages.msgHash and 
     xcmtransfer.msgHash is not null and
     xcmmessages.blockTS >= ${startTS} and xcmmessages.blockTS <= ${endTS} and
     xcmtransfer.sourceTS >= ${startTS} and xcmtransfer.sourceTS <= ${endTS} and
     abs(xcmmessages.sentAt - xcmtransfer.sentAt) <= 4`;
        this.batchedSQL.push(sql1);
        console.log(sql1);
        await this.update_batchedSQL();

        // match children xcmmessages to parent xcmmessages
        let sql2 = `update xcmmessages as c, xcmmessages as p  set c.extrinsicID = p.extrinsicID, c.extrinsicHash = p.extrinsicHash where 
p.childMsgHash is not null and p.extrinsicID is not null and c.msgHash = p.childMsgHash and
 abs(c.sentAt - p.childSentAt) <= 4 and 
 c.extrinsicID is null and
 p.blockTS >= ${startTS} and p.blockTS <= ${endTS} and
 c.blockTS >= ${startTS} and c.blockTS <= ${endTS}`
        this.batchedSQL.push(sql2);
        console.log(sql2);
        await this.update_batchedSQL();

        console.log("computeXCMMessageParentMsgHash DONE");
    }

    async xcmmatch2_matcher(startTS, endTS, lookbackSeconds = 120) {
        // ((d.asset = xcmmessages.asset) or (d.nativeAssetChain = xcmmessages.nativeAssetChain and d.nativeAssetChain is not null)) and
        // No way to get "sentAt" in xcmtransferdestcandidate to tighten this?
        let fld = (this.getCurrentTS() % 2 == 0) ? "" : "2"
        let sql = `select  xcmmessages.chainID, xcmmessages.chainIDDest, 
          (d.destts - xcmmessages.blockTS) as diffTS,
          xcmmessages.msgHash,
          xcmmessages.blockNumber,
          xcmmessages.incoming,
          xcmmessages.extrinsicHash,
          xcmmessages.extrinsicID,
          xcmmessages.blockTS,
          xcmmessages.beneficiaries${fld},
          d.eventID, d.asset, d.rawAsset, d.nativeAssetChain, d.amountReceived, d.blockNumberDest, d.destTS
        from xcmmessages, xcmtransferdestcandidate as d
 where  d.fromAddress = xcmmessages.beneficiaries${fld} and
        d.chainIDDest = xcmmessages.chainIDDest and
        xcmmessages.blockTS >= ${startTS} and
        xcmmessages.blockTS < ${endTS} and
        d.destTS >= ${startTS} and
        d.destTS < ${endTS+lookbackSeconds} and
        d.destTS - xcmmessages.blockTS >= 0 and
        d.destTS - xcmmessages.blockTS < ${lookbackSeconds} and
        length(xcmmessages.extrinsicID) > 0 and	xcmmessages.assetsReceived is null
order by chainID, extrinsicHash, diffTS`;
        console.log(sql);
        try {
            let matches = await this.pool.query(sql);
            let vals = ["assetsReceived"];
            let assetsReceived = {};
            let assetsReceivedXCMTransfer = {};
            for (const m of matches) {
                let k = `${m.msgHash}-${m.blockNumber}-${m.incoming}`;
                if (assetsReceived[k] == undefined) {
                    assetsReceived[k] = [];
                }
                let priceUSD = 0;
                let amountReceivedUSD = 0;
                let decimals = this.getAssetDecimal(m.asset, m.chainID)
                if (decimals === false) {
                    decimals = this.getAssetDecimal(m.asset, m.chainIDDest)
                }
                if (decimals !== false) {
                    let [_, __, priceUSDblockTS] = await this.computeUSD(1.0, m.asset, m.chainID, m.blockTS);
                    if (priceUSDblockTS > 0) {
                        priceUSD = priceUSDblockTS;
                        let amountReceived = parseFloat(m.amountReceived) / 10 ** decimals;
                        amountReceivedUSD = (amountReceived > 0) ? priceUSD * amountReceived : 0;
                    }
                }
                let destMatch = {
                    chainID: m.chainIDDest,
                    asset: m.asset,
                    rawAsset: m.rawAsset,
                    amountReceived: m.amountReceived,
                    amountReceivedUSD: amountReceivedUSD,
                    eventID: m.eventID,
                    blockNumber: m.blockNumber,
                    ts: m.destTS
                };
                assetsReceived[k].push(destMatch);

                if (m.extrinsicHash && m.extrinsicHash.length > 0) {
                    let k2 = `${m.extrinsicHash}:${m.extrinsicID}:${m.msgHash}`
                    if (assetsReceivedXCMTransfer[k2] == undefined) {
                        assetsReceivedXCMTransfer[k2] = [];
                    }
                    assetsReceivedXCMTransfer[k2].push(destMatch);
                }
            }

            let out = [];
            for (const k of Object.keys(assetsReceived)) {
                let [msgHash, blockNumber, incoming] = k.split("-");
                let r = assetsReceived[k];
                let ar = JSON.stringify(r);
                if (ar.length < 1024) {
                    out.push(`('${msgHash}', '${blockNumber}', '${incoming}', ${mysql.escape(ar)})`);
                } else {
                    console.log("LONG VAL", k, "RECS", ar.length, "assetsreceived=", ar);
                }
            }
            console.log(out.length);
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });

            out = [];
            for (const k of Object.keys(assetsReceivedXCMTransfer)) {
                let [extrinsicHash, extrinsicID, msgHash] = k.split(":");
                let r = assetsReceivedXCMTransfer[k];
                let ar = JSON.stringify(r);
                if (ar.length < 1024) {
                    let sql = `update xcmtransfer set assetsReceived = ${mysql.escape(ar)} where extrinsicHash = '${extrinsicHash}' and extrinsicID = '${extrinsicID}' and msgHash = '${msgHash}'`;
                    console.log(sql);
                    this.batchedSQL.push(sql);
                    await this.update_batchedSQL();
                } else {
                    console.log("LONG VAL", k, "RECS", ar.length, "assetsreceived=", ar);
                }
            }

        } catch (e) {
            console.log(e);
        }
    }

    // computeAssetChainsAndBeneficiaries reads any unanalyzed OUTGOING messages and updates xcmmessages.assetChains + beneficiaries for any assets mentioned in the instructions using analyzeXCMInstructions 
    async computeAssetChainsAndBeneficiaries(startTS, endTS) {
        await this.assetManagerInit();

        let ts = this.getCurrentTS() - 86400 * 180;
        let sql = `select msgHash, blockNumber, sentAt, incoming, chainID, chainIDDest, msgStr, blockTS from xcmmessages where ( assetChains is Null or beneficiaries2 is null ) and ( blockTS >= ${startTS} and blockTS <= ${endTS} )  order by blockTS desc`;
        let msgs = await this.pool.query(sql);
        console.log("computeAssetChains: ", sql);
        let vals = ["assetChains", "beneficiaries2"]
        let out = [];
        for (const msg of msgs) {
            let m = JSON.parse(msg.msgStr);
            if (m.v2) {
                this.xcmAddresses = [];
                this.assetChains = {};
                this.analyzeXCMInstructions(m.v2, msg.chainID, msg.chainIDDest, "computeAssetChains")
                let assetChains = Object.keys(this.assetChains);
                let xcmAddresses = this.xcmAddresses.length > 1 ? "" : (this.xcmAddresses.length == 1) ? this.xcmAddresses[0] : ""; // JSON.stringify(this.xcmAddresses)
                out.push(`('${msg.msgHash}', '${msg.blockNumber}', '${msg.incoming}', ${mysql.escape(JSON.stringify(assetChains))}, '${xcmAddresses}')`)
                if (out.length > 100) {
                    console.log(out.length);
                    await this.upsertSQL({
                        "table": "xcmmessages",
                        "keys": ["msgHash", "blockNumber", "incoming"],
                        "vals": vals,
                        "data": out,
                        "replace": vals
                    });
                    out = [];
                }
            }
        }
        if (out.length > 0) {
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
            out = [];
        }
        console.log("computeAssetChains DONE");
    }

    /* because the indexer may insert multiple xcmmessages record when a partcular xcmmessage sits in the chains message queue for 1 or more blocks, this xcmmessages_dedup process cleans out any records that exist after the above matching process */
    async xcmmessages_dedup(startTS, endTS, lookbackSeconds = 120) {
        let sql = `select
          s.msgHash, s.blockNumber as s_blockNumber, s.incoming, (d.sentAt - s.sentAt) as diffSentAt
        from xcmmessages as s, xcmmessages as d
 where  d.msgHash = s.msgHash and
        d.chainID = s.chainID and
        d.chainIDDest = s.chainIDDest and
        ( ( s.incoming = 0 and  d.incoming = 1 ) or ( s.incoming = 1 and d.incoming = 0 ) ) and
        s.blockTS >= ${startTS} and
        s.blockTS < ${endTS} and
        d.blockTS >= ${startTS} and
        d.blockTS < ${endTS+lookbackSeconds} and
        s.matched = 0 and
        d.matched = 1
having (diffSentAt >= 0 and diffSentAt <= 4)
order by msgHash`
        console.log("xcmmessages_match", sql)
        try {
            let xcmsingles = await this.poolREADONLY.query(sql);
            let vals = ["matched"];
            let out = [];
            for (let i = 0; i < xcmsingles.length; i++) {
                let s = xcmsingles[i];
                out.push(`('${s.msgHash}', ${s.s_blockNumber}, ${s.incoming}, '-1')`)
            }
            console.log(`xcmmessages_singles_dedup`, out);
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
        } catch (err) {
            console.log("xcmmessages_match", err)
        }
    }

    async xcmanalytics(lookbackDays) {
        let chain = await this.getChain(2);
        await this.setupAPI(chain);


        let endTS = this.currentTS();
        let startTS = endTS - lookbackDays * 86400;
        for (let ts = startTS; ts < endTS; ts += 86400) {
            let t0 = ts;
            let t1 = ts + 86400;

            // this.computeXCMFingerprints updates any xcmmessages which have not been fingerprinted, fill in xcmmessages.{parentInclusionFingerprints, instructionFingerprints}
            await this.computeXCMFingerprints(t0, t1);

            // computeXCMMessageParentMsgHash updates xcmmessages.{parentMsgHash/SentAt, childMsgHash/SentAt} using special xcmmessages (those with parentInclusionFingerprints)
            // with these parent-child linkages, a "tree" (currently just short chains) can be established
            await this.computeXCMMessageParentMsgHash(t0, t1);

            // computerAssetChainsAndBeneficiaries updates xcmmessages.assetChains for any assets mentioned in the instructions
            await this.computeAssetChainsAndBeneficiaries(t0, t1);

            // computes assetsReceived
            await this.xcmmatch2_matcher(t0, t1)

            // marks duplicates in xcmmessages
            await this.xcmmessages_dedup(t0, t1);
        }
    }

}