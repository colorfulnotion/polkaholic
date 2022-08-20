// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic

const AssetManager = require("./assetManager");
const mysql = require("mysql2");
const paraTool = require("./paraTool");

module.exports = class XCMManager extends AssetManager {
    constructor() {
        super("manager")
    }

    lastupdateTS = 0

    // xcmtransfer_match matches cross transfers between SENDING events held in "xcmtransfer"  and CANDIDATE destination events (from various xcm received messages on a destination chain)
    // this will be phased out soon
    async xcmtransfer_match(startTS, endTS = null, ratMin = .99, lookbackSeconds = 7200) {
        let endWhere = endTS ? `and xcmtransfer.sourceTS < ${endTS} and d.destTS < ${endTS+lookbackSeconds}` : ""
        // match xcmtransferdestcandidate of the last 2 hours
        //   (a) > 95% amountReceived / amountSent
        //   (b) asset match
        //   (c) time difference matching has to be less than 7200 (and greater than 0)
        //   (d) TODO: require xcmtransferdestcandidate.paraIDs to match xcmtransfer.chainIDDest (this is NOT guarateed to be present)
        // In case of ties, the FIRST one ( "order by diffTS" ) covers this
        let sql = `select
          chainID, extrinsicHash, d.chainIDDest, d.fromAddress, xcmtransfer.asset, xcmtransfer.rawAsset,
          (d.destts - xcmtransfer.sourceTS) as diffTS,
          xcmtransfer.extrinsicID,
          xcmtransfer.amountSent,
          xcmtransfer.transferIndex,
          xcmtransfer.sourceTS,
          xcmtransfer.fromAddress as senderAddress,
          xcmtransfer.destAddress,
          xcmtransfer.msgHash,
          d.eventID,
          d.extrinsicID as destExtrinsicID,
          d.blockNumberDest,
          d.amountReceived,
          d.destTS,
          d.amountReceived / xcmtransfer.amountSent as rat
        from xcmtransfer, xcmtransferdestcandidate as d
 where  d.fromAddress = xcmtransfer.destAddress and
        d.chainIDDest = xcmtransfer.chainIDDest and
        ((d.asset = xcmtransfer.asset) or (d.nativeAssetChain = xcmtransfer.nativeAssetChain and d.nativeAssetChain is not null)) and
        xcmtransfer.sourceTS >= ${startTS} and
        xcmtransfer.xcmInteriorKey = d.xcmInteriorKey and
        d.destTS >= ${startTS} and
        xcmtransfer.matched = 0 and
        d.matched = 0 and
        xcmtransfer.incomplete = 0 and
        d.destTS - xcmtransfer.sourceTS >= 0 and
        d.destTS - xcmtransfer.sourceTS < ${lookbackSeconds} and
        length(xcmtransfer.extrinsicID) > 0 and
        xcmtransfer.amountSent >= d.amountReceived
having ( ( rat > ${ratMin} and rat <= 1.0 ) or
(asset = '{"Token":"DOT"}' and amountSent - amountReceived < 500000000) or
(asset = '{"Token":"KSM"}' and amountSent - amountReceived < 1000000000) or
(asset = '{"Token":"KAR"}' and amountSent - amountReceived < 10000000000 ) )
order by chainID, extrinsicHash, diffTS`
        let [logDTS, hr] = paraTool.ts_to_logDT_hr(startTS)
        let windowTS = (endTS != undefined) ? endTS - startTS : 'NA'
        console.log(`match_xcm [${logDTS} ${hr}] windowTS=${windowTS},lookbackSeconds=${lookbackSeconds}, ratMin=${ratMin}`)
        console.log("match_xcm", sql)
        try {
            let xcmmatches = await this.poolREADONLY.query(sql);
            let addressextrinsic = []
            let hashes = []
            let matched = {}
            let matches = 0;
            if (xcmmatches.length > 0) {
                console.log("[Found] match_xcm", sql)
            } else {
                //enable this for debugging
                //console.log("[Empty] match_xcm", sql)
            }
            for (let i = 0; i < xcmmatches.length; i++) {
                let d = xcmmatches[i];
                if (matched[d.extrinsicHash] == undefined && matched[d.eventID] == undefined) {
                    let priceUSD = 0;
                    let amountSentUSD = 0;
                    let amountReceivedUSD = 0;
                    let chainID = d.chainID
                    let asset = d.asset
                    let rawAsset = d.rawAsset
                    let [isXCMAssetFound, standardizedXCMInfo] = this.getStandardizedXCMAssetInfo(chainID, asset, rawAsset)
                    if (isXCMAssetFound) {
                        let priceTS = d.sourceTS
                        let decimals = standardizedXCMInfo.decimals;
                        let nativeAssetChain = standardizedXCMInfo.nativeAssetChain;
                        let [nativeAsset, nativeChainID] = paraTool.parseAssetChain(standardizedXCMInfo.nativeAssetChain)
                        if (this.assetInfo[nativeAssetChain]) {
                            if (decimals !== false) {
                                let [_, priceUSDsourceTS, __] = await this.computeUSD(1.0, nativeAsset, nativeChainID, priceTS);
                                if (priceUSDsourceTS > 0) {
                                    priceUSD = priceUSDsourceTS;
                                    let amountSent = parseFloat(d.amountSent) / 10 ** decimals;
                                    let amountReceived = parseFloat(d.amountReceived) / 10 ** decimals;
                                    amountSentUSD = (amountSent > 0) ? priceUSD * amountSent : 0;
                                    amountReceivedUSD = (amountReceived > 0) ? priceUSD * amountReceived : 0;
                                }
                            }
                        } else {
                            console.log(`NativeAssetChain NOT FOUND [${m.extrinsicHash}] nativeAsset=${nativeAsset}, nativeChainID=${nativeChainID}, asset=${asset}, rawAsset=${rawAsset}`)
                        }
                    }
                    let sql = `update xcmtransfer
            set blockNumberDest = ${d.blockNumberDest},
                destTS = ${d.destTS},
                amountSentUSD = '${amountSentUSD}',
                amountReceived = '${d.amountReceived}',
                amountReceivedUSD = '${amountReceivedUSD}',
                priceUSD = '${priceUSD}',
                matched = 1,
                matchedExtrinsicID = '${d.destExtrinsicID}',
                matchedEventID = '${d.eventID}'
            where extrinsicHash = '${d.extrinsicHash}' and transferIndex = '${d.transferIndex}'`
                    //console.log(sql);
                    this.batchedSQL.push(sql);
                    matches++;
                    // (a) with extrinsicID, we get both the fee (rat << 1) ANDthe transferred item for when one is isFeeItem=0 and another is isFeeItem=1; ... otherwise we get (b) with just the eventID
                    let w = d.destExtrinsicID && (d.destExtrinsicID.length > 0) ? `extrinsicID = '${d.destExtrinsicID}'` : `eventID = '${d.eventID}'`;
                    let sql2 = `update xcmtransferdestcandidate set matched = 1, matchedExtrinsicHash = '${d.extrinsicHash}' where ${w}`
                    console.log(sql2);
                    this.batchedSQL.push(sql2);
                    // never match more than once, by marking both the sending record and the receiving record
                    matched[d.extrinsicHash] = true;
                    matched[d.eventID] = true;

                    // problem: this does not store the "dust" fee (which has rat << 1) in bigtable
                    let match = {
                        chainID: d.chainID,
                        chainIDDest: d.chainIDDest,
                        blockNumberDest: d.blockNumberDest,
                        asset: d.asset,
                        amountSent: d.amountSent,
                        amountReceived: d.amountReceived,
                        fromAddress: d.senderAddress, //from xcmtransfer.fromAddress
                        destAddress: d.fromAddress, //from xcmtransferdestcandidate.fromAddress
                        msgHash: (d.msgHash != undefined) ? d.msgHash : '0x',
                        extrinsicHash: d.extrinsicHash,
                        extrinsicID: d.extrinsicID,
                        destExtrinsicID: d.destExtrinsicID,
                        eventID: d.eventID,
                        sourceTS: d.sourceTS,
                        destTS: d.destTS
                    }

                    // 1. write "addressExtrinsic" feedxcmdest with row key address-extrinsicHash and column extrinsicHash#chainID-extrinsicID-transferIndex
                    //    * we use the SENDING chainID + the sender extrinsicID as the column for the "feedxcmdest" column family
                    let rowKey = `${d.fromAddress.toLowerCase()}#${d.extrinsicHash}` // NOTE: this matches "feed"
                    let cres = {
                        key: rowKey,
                        data: {
                            feedxcmdest: {},
                        }
                    };
                    let extrinsicHashEventID = `${d.extrinsicHash}#${d.chainID}-${d.extrinsicID}-${d.transferIndex}`
                    cres['data']['feedxcmdest'][extrinsicHashEventID] = {
                        value: JSON.stringify(match),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };
                    addressextrinsic.push(cres);

                    // 2. write "hashes" feedxcmdest with row key extrinsicHash and column extrinsicHash#chainID-extrinsicID (same as 1)
                    let hres = {
                        key: d.extrinsicHash,
                        data: {
                            feedxcmdest: {}
                        }
                    }
                    hres['data']['feedxcmdest'][extrinsicHashEventID] = {
                        value: JSON.stringify(match),
                        timestamp: d.sourceTS * 1000000 // NOTE: to support rematching, we do NOT use d.destTS
                    };
                    console.log("MATCH#", matches, "hashes rowkey", d.extrinsicHash, "col", "addressExtrinsic rowkey=", rowKey, "col", extrinsicHashEventID);
                    hashes.push(hres)
                } else {
                    //console.log("SKIP", matched[d.extrinsicHash], matched[d.eventID]);
                }
            }
            if (addressextrinsic.length > 0) {
                await this.insertBTRows(this.btAddressExtrinsic, addressextrinsic, "addressextrinsic")
            }
            if (hashes.length > 0) {
                await this.insertBTRows(this.btHashes, hashes, "addressextrinsic")
            }
            if (addressextrinsic.length > 0 || hashes.length > 0) {
                await this.update_batchedSQL();
            }
        } catch (err) {
            console.log("WRITE_FEEDXCMDEST", err)
        }
        let logDT = new Date(startTS * 1000)
        console.log(`match_xcm ${startTS} covered ${logDT}`)
    }

    // This is the key workhorse that matches xcmmessages with
    // match xcmmessages incoming = 0 (s) with incoming = 1 (d)
    //   (a) msgHash + chainID + chainIDDest matching between s and d
    //   (b) time difference between sentAt to be less than 4
    //   (c) with s and d blockTS being within lookbackSeconds (default 120) of each other
    // In case of ties, the FIRST one ( "order by diffTS" ) covers this
    async xcmmessages_match(startTS, endTS = null, lookbackSeconds = 120) {
        let endWhere = endTS ? `and s.blockTS < ${endTS} and d.blockTS < ${endTS+lookbackSeconds}` : ""

        let sql = `select
          s.msgHash, s.blockNumber as s_blockNumber, d.blockNumber as d_blockNumber, s.sentAt as s_sentAt, d.sentAt as d_sentAt, s.chainID, s.chainIDDest, d.blockTS as destTS, s.blockTS as sourceTS, abs(d.blockTS - s.blockTS) as diffTS, (d.sentAt - s.sentAt) as diffSentAt, d.errorDesc as d_errorDesc, d.destStatus as d_destStatus, d.executedEventID as d_executedEventID
        from xcmmessages as s, xcmmessages as d
 where  d.msgHash = s.msgHash and
        d.chainID = s.chainID and
        d.chainIDDest = s.chainIDDest and
        s.incoming = 0 and
        d.incoming = 1 and
        s.blockTS >= ${startTS} and
        d.blockTS >= ${startTS} and
        s.matched = 0 and
        d.matched = 0 ${endWhere}
having (diffSentAt >= 0 and diffSentAt <= 4)
order by msgHash, diffSentAt, diffTS`
        //console.log("xcmmessages_match", sql)
        try {
            let xcmmatches = await this.pool.query(sql);
            let matched = {}
            let numRecs = 0;
            if (xcmmatches.length > 0) {
                console.log(`[Found] xcmmessages_match ${xcmmatches.length}`, sql)
            } else {
                //enable this for debugging
                //console.log("[Empty] match_xcm", sql)
            }
            let vals = ["chainID", "chainIDDest", "sourceTS", "destTS", "matched", "sourceSentAt", "destSentAt", "sourceBlocknumber", "destBlocknumber", "matchDT", "errorDesc", "destStatus", "executedEventID"];
            let out = [];
            for (let i = 0; i < xcmmatches.length; i++) {
                let s = xcmmatches[i];
                // to protect against the same dest message matched more than once we keep in the "matched" map a set of msgHash-sentAt (for xcmmessages dest candidates)
                // Note in case of multiple matches, the "order by diffTS" in the SQL statment picks the FIRST one in time closest with the smallest diffTS
                let k = `${s.msgHash}:${s.d_sentAt}`
                if (matched[k] == undefined) {
                    out.push(`( '${s.msgHash}', ${s.s_blockNumber}, 0, '${s.chainID}', '${s.chainIDDest}', ${s.sourceTS}, ${s.destTS}, 1, '${s.s_sentAt}', '${s.d_sentAt}', '${s.s_blockNumber}', '${s.d_blockNumber}', Now(), ${mysql.escape(s.d_errorDesc)}, ${mysql.escape(s.d_destStatus)}, ${mysql.escape(s.d_executedEventID)} )`)
                    out.push(`( '${s.msgHash}', ${s.d_blockNumber}, 1, '${s.chainID}', '${s.chainIDDest}', ${s.sourceTS}, ${s.destTS}, 1, '${s.s_sentAt}', '${s.d_sentAt}', '${s.s_blockNumber}', '${s.d_blockNumber}', Now(), ${mysql.escape(s.d_errorDesc)}, ${mysql.escape(s.d_destStatus)}, ${mysql.escape(s.d_executedEventID)} )`)
                    matched[k] = true;
                } else {
                    numRecs++;
                }
            }
            let logDT = new Date(startTS * 1000)
            console.log(`xcmmessages_match ${startTS} covered ${logDT} MATCHES: `, out.length);
            await this.upsertSQL({
                "table": "xcmmessages",
                "keys": ["msgHash", "blockNumber", "incoming"],
                "vals": vals,
                "data": out,
                "replace": vals
            });
            return (numRecs);
        } catch (err) {
            console.log("xcmmessages_match", err)
        }
    }

    async xcmAUSDUpdate() {
        // deleted
    }

    async xcm_init() {
        await this.init_chain_asset_and_nativeAsset() // this will init assetInfo and assetLog
        console.log(`this.xcmAssetInfo`, this.xcmAssetInfo)
    }

    get_concrete_assetChain(analysis, c, chainID, chainIDDest) {
        let paraID = paraTool.getParaIDfromChainID(chainID)
        let paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let relayChainID = paraTool.getRelayChainID(relayChain)

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
    analyzeXCM_MultiAsset(analysis, c, chainID, chainIDDest, ctx) {
        if (c.id != undefined) {
            if (c.id.concrete != undefined) {
                if (ctx == "buyExecution") {} else {
                    let assetChain = this.get_concrete_assetChain(analysis, c.id.concrete, chainID, chainIDDest);
                    if (assetChain && (analysis.assetChains[assetChain] == undefined)) {
                        analysis.assetChains[assetChain] = 1;
                        //console.log("PUSHING", assetChain, c.id.concrete);
                        return assetChain;
                    } else {
                        console.log("analyzeXCM_MultiAsset MISS PROBLEM", ctx, chainID, chainIDDest, JSON.stringify(c.id.concrete));
                    }
                }
            } else {
                console.log("analyzeXCM_MultiAsset NOT CONCRETE PROBLEM", chainID, chainIDDest, JSON.stringify(c))
            }
        } else if (c.concreteFungible != undefined) {
            let assetChain = this.get_concrete_assetChain(analysis, c.concreteFungible.id, chainID, chainIDDest);
            if (assetChain && (analysis.assetChains[assetChain] == undefined)) {
                analysis.assetChains[assetChain] = 1;
                //console.log("PUSHING", assetChain, c.id.concrete);
                return assetChain;
            } else {
                console.log("analyzeXCM_MultiAsset V0 MISS PROBLEM", ctx, chainID, chainIDDest, JSON.stringify(c.concreteFungible.id));
            }
        } else {
            console.log("analyzeXCM_MultiAsset NO ID PROBLEM", chainID, chainIDDest, JSON.stringify(c))
        }
        return (false);
    }

    analyzeXCM_MultiAssetFilter(analysis, c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        if (c[fld].wild) {} else if (c[fld].definite) {
            //console.log("analyzeXCM_MultiAssetFilter", chainID, chainIDDest, JSON.stringify(c[fld].definite));
        } else {
            // analyzeXCM_MultiAssetFilter 22085 2 {"definite":[{"id":{"concrete":{"parents":0,"interior":{"here":null}}},"fun":{"fungible":10000000000}}]}
            if (Array.isArray(c[fld])) {
                for (let i = 0; i < c[fld].length; i++) {
                    let ac = this.analyzeXCM_MultiAsset(analysis, c[fld][i], chainID, chainIDDest, "multiassetfilter")
                    if (ac) {
                        console.log("analyzeXCM_MultiAssetFilter", ctx, chainID, chainIDDest, JSON.stringify(c[fld][i]), ac);
                    }
                }
            }
        }
    }

    // All instructions with "MultiLocation" (parachain, accountID32/ accountID20, here) should be decorated with chain.id, chain.chainName or the "identity" using lookup_account
    analyzeXCM_MultiLocation(analysis, c, fld, chainID, chainIDDest, ctx) {
        if (c[fld] == undefined) return;
        let relayChain = paraTool.getRelayChainByChainID(chainID)
        let destAddress = this.chainParser.processBeneficiary(false, c[fld], relayChain);
        if (destAddress) {
            analysis.xcmAddresses.push(destAddress)
            //console.log(`${msg.msgHash} analyzeXCM_MultiLocation destFound:${destAddress}`)
        }
    }

    analyzeXCM_Call(analysis, c, fld, chainID, chainIDDest, ctx) {
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
                MultiAssets: ['assets'],
                MultiAssetFilter: ['assets'], //v0
                Effects: ['effects'] //v0
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
            //V1
            'reserveAssetDeposited': {
                MultiAssetFilter: ['assets'],
                Effects: ['effects'],
            },
            //V0
            'teleportAsset': {
                MultiAsset: ['assets'],
                Effects: ['effects'],
            },
            'reserveAssetDeposit': {
                MultiAsset: ['assets'],
                Effects: ['effects'],
            }

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

    async decodeXCM(hex) {
        var obj = this.api.registry.createType('XcmVersionedXcm', hex);
        return obj.toJSON();
    }

    analyzeXCMInstruction(analysis, instruction, chainID, chainIDDest, ctx = "") {
        let instructionSet = this.getInstructionSet();

        for (const i of Object.keys(instructionSet)) {
            if (instruction[i] != undefined) {
                let features = instructionSet[i];
                if (features.MultiAssets != undefined) {
                    for (let j = 0; j < instruction[i].length; j++) {
                        this.analyzeXCM_MultiAsset(analysis, instruction[i][j], chainID, chainIDDest, i);
                    }
                }
                if (features.MultiAsset != undefined) {
                    for (const fld of features.MultiAsset) {
                        if (instruction[i][fld] != undefined) {
                            this.analyzeXCM_MultiAsset(analysis, instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }
                if (features.MultiAssetFilter != undefined) {
                    for (const fld of features.MultiAssetFilter) {
                        this.analyzeXCM_MultiAssetFilter(analysis, instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
                if (features.MultiLocation != undefined) {
                    for (const fld of features.MultiLocation) {
                        this.analyzeXCM_MultiLocation(analysis, instruction[i], fld, chainID, chainIDDest, i);
                    }
                }

                if (features.XCM != undefined) {
                    for (const fld of features.XCM) {
                        if (instruction[i][fld] != undefined) {
                            //console.log("analyzing instruction containing XCM ", instruction);
                            // recursive call
                            let xcmChild = instruction[i][fld];
                            // console.log( "  ... xcmChild:", xcmChild);
                            this.analyzeXCMInstructions(analysis, instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }

                if (features.Effects != undefined) {
                    for (const fld of features.Effects) {
                        if (instruction[i][fld] != undefined) {
                            //console.log("analyzing instruction containing effects ", instruction);
                            // recursive call
                            let xcmChild = instruction[i][fld];

                            this.analyzeXCMInstructions(analysis, instruction[i][fld], chainID, chainIDDest, i);
                        }
                    }
                }

                if (features.Call != undefined) {
                    for (const fld of features.Call) {
                        this.analyzeXCM_Call(analysis, instruction[i], fld, chainID, chainIDDest, i);
                    }
                }
            }
        }
    }

    analyzeXCMInstructionsV1(analysis, xcmMsgV1, chainID, chainIDDest, ctx) {
        this.analyzeXCMInstruction(analysis, xcmMsgV1, chainID, chainIDDest, ctx)
    }

    analyzeXCMInstructionsV0(analysis, xcmMsgV0, chainID, chainIDDest, ctx) {
        this.analyzeXCMInstruction(analysis, xcmMsgV0, chainID, chainIDDest, ctx)
    }

    analyzeXCMInstructions(analysis, instructions, chainID, chainIDDest, ctx) {
        for (const instruction of instructions) {
            this.analyzeXCMInstruction(analysis, instruction, chainID, chainIDDest, ctx)
        }
    }

    async match_parentInclusionFingerprints(parentInclusionFingerprints, rec) {
        if (parentInclusionFingerprints == "[]") return (false);
        let sqlchild = `select incoming, msgHash, blockNumber, sentAt, instructionFingerprints, blockTS, msgHex, chainID, chainIDDest from xcmmessages where blockTS >= ${rec.blockTS} and blockTS <= ${rec.blockTS+60} and instructionFingerprints is not null and incoming = 0 order by blockTS limit 20`
        let childRecs = await this.pool.query(sqlchild);
        for (let c = 0; c < childRecs.length; c++) {
            let childRec = childRecs[c];
            if (this.compute_fingerprints_inclusion(parentInclusionFingerprints, childRec.instructionFingerprints)) {
                let updsql = `update xcmmessages set parentMsgHash = '${rec.msgHash}', parentBlocknumber='${rec.blockNumber}', parentSentAt='${rec.sentAt}' where msgHash = '${childRec.msgHash}' and blockNumber = '${childRec.blockNumber}' and incoming = '${childRec.incoming}'`;
                this.batchedSQL.push(updsql);
                // assume chain of messages, not doing tree yet
                let updsql2 = `update xcmmessages set childMsgHash = '${childRec.msgHash}', childBlockNumber='${childRec.blockNumber}', childSentAt='${childRec.sentAt}' where msgHash = '${rec.msgHash}' and blockNumber = '${rec.blockNumber}' and incoming = '${rec.incoming}'`;
                this.batchedSQL.push(updsql2);
                await this.update_batchedSQL();
                return (true);
            }
        }
        return (false);
    }

    performAnalysisInstructions(msg, chainID, chainIDDest) {
        let analysis = {
            xcmAddresses: [],
            assetChains: {}
        }
        this.chainParserInit(chainID, this.debugLevel);
        let version = Object.keys(msg)[0]
        switch (version) {
            case 'v2':
                this.analyzeXCMInstructions(analysis, msg.v2, chainID, chainIDDest, "computeAssetChains")
                break;
            case 'v1':
                this.analyzeXCMInstructionsV1(analysis, msg.v1, chainID, chainIDDest, "computeAssetChains")
                break;
            case 'v0':
                this.analyzeXCMInstructionsV0(analysis, msg.v0, chainID, chainIDDest, "computeAssetChains")
                break;
            default:
                console.log("unknown version", version);
        }
        return analysis;
    }


    // for any xcmmessages in a period:
    //  (a) update instructionFingerprints + parentInclusionFingerprints using getXCMParentFingerprintsOfChild + getXCMChildFingerprints
    //  (b) if there are parentfingerprints detected, look for childfingerprints in the next step
    //  (c) compute assetChains and beneficiaries
    async computeXCMFingerprints(startTS, endTS = null) {
        let lastTS = endTS;
        let endWhere = (endTS) ? ` and blockTS <= ${endTS} ` : "";
        let sql = `select msgHash, msgHex, blockNumber, sentAt, incoming, chainID, chainIDDest, msgStr, blockTS, assetChains, beneficiaries2, instructionFingerprints from xcmmessages where blockTS >= ${startTS} ${endWhere} order by blockTS desc`;
        let xcmRecs = await this.pool.query(sql);
        let out = [];
        let vals = ["chainID", "chainIDDest", "parentInclusionFingerprints", "instructionFingerprints", "assetChains", "beneficiaries2"];
        let parentIncFingerprints = [];
        console.log("computeXCMFingerprints:", xcmRecs.length, sql)
        for (let r = 0; r < xcmRecs.length; r++) {
            let rec = xcmRecs[r];
            let msg = JSON.parse(rec.msgStr);
            try {
                if (r == 0) lastTS = rec.blockTS;
                let analysis = this.performAnalysisInstructions(msg, rec.chainID, rec.chainIDDest)
                let assetChains = Object.keys(analysis.assetChains);
                let beneficiaries2 = (analysis.xcmAddresses.length > 0) ? `'${analysis.xcmAddresses.join('|')}'` : `'Null'`
                var xcmObj = this.api.registry.createType('XcmVersionedXcm', rec.msgHex.toString());
                let parentInclusionFingerprints = [];
                let instructionFingerprints = []
                if (xcmObj.isV2) {
                    parentInclusionFingerprints = this.getXCMParentFingerprintsOfChild(xcmObj);
                    instructionFingerprints = this.getXCMChildFingerprints(xcmObj);
                    if (parentInclusionFingerprints.length > 0) {
                        parentIncFingerprints.push({
                            parentInclusionFingerprints,
                            rec
                        });
                    }
                }

                out.push(`('${rec.msgHash}', '${rec.blockNumber}', '${rec.incoming}', '${rec.chainID}', '${rec.chainIDDest}', '${JSON.stringify(parentInclusionFingerprints)}', '${JSON.stringify(instructionFingerprints)}', ${mysql.escape(JSON.stringify(assetChains))}, ${beneficiaries2})`);
            } catch (err) {
                console.log(err);
                process.exit(0);
            }
        }

        for (let i = 0; i < parentIncFingerprints.length; i++) {
            let p = parentIncFingerprints[i];
            await this.match_parentInclusionFingerprints(p.parentInclusionFingerprints, p.rec);
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
        return lastTS;
    }

    async xcmmatch2_matcher(startTS, endTS = null, lookbackSeconds = 120) {
        let endWhere = endTS ? `and xcmmessages.blockTS <= ${endTS} and xcmtransfer.sourceTS <= ${endTS}` : "";
        // set xcmmessages.{extrinsicID,extrinsicHash} based on xcmtransfer.msgHash / sentAt <= 4 difference
        let sql1 = `update xcmtransfer, xcmmessages set xcmmessages.extrinsicID = xcmtransfer.extrinsicID, xcmmessages.extrinsicHash = xcmtransfer.extrinsicHash, xcmmessages.sectionMethod = xcmtransfer.sectionMethod, xcmmessages.amountSentUSD = xcmtransfer.amountSentUSD
               where xcmtransfer.msgHash = xcmmessages.msgHash and
                 xcmtransfer.chainIDDest = xcmmessages.chainIDDest and xcmtransfer.chainID = xcmmessages.chainID and
                 xcmtransfer.msgHash is not null and
                 xcmmessages.blockTS >= ${startTS} and
                 xcmtransfer.sourceTS >= ${startTS} and
                 abs(xcmmessages.sentAt - xcmtransfer.sentAt) <= 4 ${endWhere}`;
        this.batchedSQL.push(sql1);
        let [logDTS, hr] = paraTool.ts_to_logDT_hr(startTS)
        let windowTS = (endTS != undefined) ? endTS - startTS : 'NA'
        console.log(`[${logDTS} ${hr}] windowTS=${windowTS},lookbackSeconds=${lookbackSeconds}`)
        console.log(sql1);
        await this.update_batchedSQL();

        // update xcmmessages of children
        endWhere = endTS ? `and p.blockTS <= ${endTS} and c.blockTS <= ${endTS}` : "";
        let sql2 = `update xcmmessages as c, xcmmessages as p  set c.extrinsicID = p.extrinsicID, c.extrinsicHash = p.extrinsicHash where
            p.childMsgHash is not null and p.extrinsicID is not null and c.msgHash = p.childMsgHash and
             c.chainID = p.chainIDDest and
             abs(c.sentAt - p.childSentAt) <= 4 and
             c.extrinsicID is null and
             p.blockTS >= ${startTS} and
             c.blockTS >= ${startTS} ${endWhere}`
        this.batchedSQL.push(sql2);
        console.log(sql2);
        await this.update_batchedSQL();

        // update
        // ((d.asset = xcmmessages.asset) or (d.nativeAssetChain = xcmmessages.nativeAssetChain and d.nativeAssetChain is not null)) and
        // No way to get "sentAt" in xcmtransferdestcandidate to tighten this?
        let fld = (this.getCurrentTS() % 2 == 0) ? "" : "2"
        endWhere = endTS ? `and xcmmessages.blockTS < ${endTS} and d.destTS < ${endTS+lookbackSeconds}` : "";
        let sql = `select  xcmmessages.chainID, xcmmessages.chainIDDest,
          (d.destts - xcmmessages.blockTS) as diffTS,
          (d.sentAt - xcmmessages.sentAt) as diffSentAt,
          xcmmessages.msgHash,
          xcmmessages.blockNumber,
          xcmmessages.incoming,
          xcmmessages.extrinsicHash,
          xcmmessages.extrinsicID,
          xcmmessages.blockTS,
          xcmmessages.beneficiaries${fld},
          xcmmessages.executedEventID,
          xcmmessages.destStatus,
          xcmmessages.errorDesc,
          d.eventID, d.asset, d.rawAsset, d.nativeAssetChain, d.amountReceived, d.blockNumberDest, d.destTS, d.msgHash as candidateMsgHash
        from xcmmessages, xcmtransferdestcandidate as d
 where  d.fromAddress = xcmmessages.beneficiaries and
        d.chainIDDest = xcmmessages.chainIDDest and
        d.msgHash = xcmmessages.msgHash and
        d.sentAt - xcmmessages.sentAt >= 0 and d.sentAt - xcmmessages.sentAt <= 4 and
        xcmmessages.blockTS >= ${startTS} and
        d.addDT is not null and
        d.destTS >= ${startTS} and
        d.destTS - xcmmessages.blockTS >= 0 and
        d.destTS - xcmmessages.blockTS < ${lookbackSeconds} and
        xcmmessages.assetsReceived is Null and
        length(xcmmessages.extrinsicID) > 0  ${endWhere}
order by chainID, extrinsicHash, eventID, diffTS`;
        console.log(sql);
        try {
            let matches = await this.pool.query(sql);
            let assetsReceived = {};
            let assetsReceivedXCMTransfer = {};
            let statusXCMTransfer = {};
            let prevEventK = false
            let prevDestMatch = false
            let incoming = {};
            let outgoing = {};
            for (const m of matches) {
                let k = `${m.msgHash}-${m.blockNumber}-${m.chainID}-${m.chainIDDest}`; //asset received is direction less
                if (m.incoming == 1) {
                    incoming[`${m.msgHash}-${m.blockNumber}`] = 1
                } else {
                    outgoing[`${m.msgHash}-${m.blockNumber}`] = 1
                }
                if (assetsReceived[k] == undefined) {
                    assetsReceived[k] = [];
                }
                let priceUSD = 0;
                let amountReceivedUSD = 0;
                let amountReceived = m.amountReceived;
                let targetChainID = m.chainIDDest
                let asset = m.asset
                let rawAsset = m.rawAsset
                let decimals = false
                let symbol = false
                let xcmInteriorKey = false
                let isIncompleteRec = true

                let [isXCMAssetFound, standardizedXCMInfo] = this.getStandardizedXCMAssetInfo(targetChainID, asset, rawAsset)
                if (isXCMAssetFound) {
                    decimals = standardizedXCMInfo.decimals;
                    symbol = standardizedXCMInfo.symbol;
                    let nativeAssetChain = standardizedXCMInfo.nativeAssetChain;
                    xcmInteriorKey = standardizedXCMInfo.xcmInteriorKey
                    let [nativeAsset, nativeChainID] = paraTool.parseAssetChain(standardizedXCMInfo.nativeAssetChain)
                    if (decimals !== false) {
                        let [_, priceUSDblockTS, __] = await this.computeUSD(1.0, nativeAsset, nativeChainID, m.blockTS);
                        //console.log(`getting price targetAsset=${targetAsset}, targetChainID=${targetChainID}, ts=${m.blockTS}, priceUSDblockTS=${priceUSDblockTS}`)
                        if (priceUSDblockTS > 0) {
                            priceUSD = priceUSDblockTS;
                            amountReceived = parseFloat(m.amountReceived) / 10 ** decimals;
                            amountReceivedUSD = (amountReceived > 0) ? priceUSD * amountReceived : 0;
                            isIncompleteRec = false
                        } else {

                        }
                    }
                } else {
                    //not found..
                }
                let destMatch = {
                    chainID: m.chainIDDest,
                    xcmInteriorKey: xcmInteriorKey,
                    asset: m.asset,
                    rawAsset: m.rawAsset,
                    symbol: symbol,
                    decimal: decimals,
                    amountReceived: amountReceived,
                    amountReceivedUSD: amountReceivedUSD,
                    blockNumber: m.blockNumber,
                    ts: m.destTS
                };
                if (isIncompleteRec) {
                    console.log(`Incomplete destMatch`, destMatch)
                } else {
                    console.log(`OK destMatch`, destMatch)
                }
                let isNewEventK = false; //let currEventID = m.eventID
                let currEventK = `${m.candidateMsgHash}-${m.amountReceived}`
                if (prevEventK != currEventK) isNewEventK = true
                if (isNewEventK) {
                    assetsReceived[k].push(destMatch);
                }

                if (m.extrinsicHash && m.extrinsicHash.length > 0) {
                    let k2 = `${m.extrinsicHash}:${m.extrinsicID}:${m.msgHash}`
                    if (assetsReceivedXCMTransfer[k2] == undefined) {
                        assetsReceivedXCMTransfer[k2] = [];
                    }
                    if (isNewEventK) {
                        assetsReceivedXCMTransfer[k2].push(destMatch);
                    }
                    statusXCMTransfer[k2] = {
                        destStatus: m.destStatus,
                        errorDesc: m.errorDesc,
                        executedEventID: m.executedEventID,
                    }
                }
                prevEventK = currEventK
                prevDestMatch = destMatch
            }

            let out = [];
            for (const k of Object.keys(assetsReceived)) {
                let [msgHash, blockNumber, chainID, chainIDDest] = k.split("-");
                let r = assetsReceived[k];
                let ar = JSON.stringify(r);
                if (ar.length < 1024) {
                    let valueUSD = this.sum_assetsReceived(r);
                    // console.log("*****", valueUSD, r);
                    if (outgoing[`${msgHash}-${blockNumber}`] != undefined) out.push(`('${msgHash}', '${blockNumber}', '0', ${mysql.escape(ar)}, '${valueUSD}', '${chainID}', '${chainIDDest}')`);
                    if (incoming[`${msgHash}-${blockNumber}`] != undefined) out.push(`('${msgHash}', '${blockNumber}', '1', ${mysql.escape(ar)}, '${valueUSD}', '${chainID}', '${chainIDDest}')`);
                } else {
                    console.log("LONG VAL", k, "RECS", ar.length, "assetsreceived=", ar);
                }
            }
            console.log(out.length);
            let vals = ["assetsReceived", "amountReceivedUSD", "chainID", "chainIDDest"];
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
                    let valueUSD = this.sum_assetsReceived(r);
                    const {
                        destStatus,
                        errorDesc,
                        executedEventID
                    } = statusXCMTransfer[k];
                    let sql = `update xcmtransfer set assetsReceived = ${mysql.escape(ar)}, amountReceivedUSD2 = '${valueUSD}', destStatus = '${destStatus}', errorDesc = ${mysql.escape(errorDesc)}, executedEventID = ${mysql.escape(executedEventID)} where extrinsicHash = '${extrinsicHash}' and extrinsicID = '${extrinsicID}' and msgHash = '${msgHash}'`;
                    //console.log(sql);
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

    sum_assetsReceived(r) {
        let valueUSD = 0;
        let events = {};
        if (r && Array.isArray(r)) {
            for (let i = 0; i < r.length; i++) {
                if (events[r[i].eventID] == undefined) {
                    valueUSD += r[i].amountReceivedUSD;
                    events[r[i].eventID] = true;
                }
            }
        }
        return (valueUSD);
    }
    /* because the indexer may insert multiple xcmmessages record when a partcular xcmmessage sits in the chains message queue for 1 or more blocks, this xcmmessages_dedup process cleans out any records that exist after the above matching process */
    async xcmmessages_dedup(startTS, endTS = null, lookbackSeconds = 120) {
        let endWhere = endTS ? `and s.blockTS < ${endTS} and d.blockTS < ${endTS+lookbackSeconds}` : "";
        let sql = `select
          s.msgHash, s.blockNumber as s_blockNumber, s.incoming, (d.sentAt - s.sentAt) as diffSentAt
        from xcmmessages as s, xcmmessages as d
 where  d.msgHash = s.msgHash and
        d.chainID = s.chainID and
        d.chainIDDest = s.chainIDDest and
        ( ( s.incoming = 0 and  d.incoming = 1 ) or ( s.incoming = 1 and d.incoming = 0 ) ) and
        s.blockTS >= ${startTS} and
        d.blockTS >= ${startTS} and
        s.matched = 0 and
        d.matched = 1 ${endWhere}
having (diffSentAt >= 0 and diffSentAt <= 4)
order by msgHash`
        console.log("xcmmessages_match", sql)
        try {
            let xcmsingles = await this.pool.query(sql);
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

    async waitForNewXCMMessage(minTS, waitMS = 2000, maxIterations = 10) {
        let iterations = 0;
        do {
            let sql = `select msgHash, blockTS from xcmmessages where blockTS > ${minTS} order by blockTS`
            console.log(sql);
            let x = await this.poolREADONLY.query(sql);
            if (x.length > 0) {
                return x[0].blockTS;
            } else {
                await this.sleep(waitMS);
            }
            iterations++;
        } while (iterations < maxIterations);
    }

    async xcmanalytics_period(chain, t0, t1 = null) {
        // xcmmessages_match matches incoming=0 and incoming=1 records
        let numRecs = await this.xcmmessages_match(t0, t1);

        // computeXCMFingerprints updates any xcmmessages which have not been fingerprinted, fill in xcmmessages.{parentInclusionFingerprints, instructionFingerprints, beneficiaries2}
        let lastTS = await this.computeXCMFingerprints(t0, t1);

        // xcmmatch2_matcher computes assetsReceived by matching xcmmessages.beneficiaries(2) to xcmtransferdestcandidate
        await this.xcmmatch2_matcher(t0, t1)

        // marks duplicates in xcmmessages
        await this.xcmmessages_dedup(t0, t1);

        await this.xcmtransfer_match(t0, t1, .97);

        // do it again
        //return [0, 0];
        numRecs = await this.xcmmessages_match(t0, t1);
        return [numRecs, lastTS];
    }

    async xcmanalytics(chain, lookbackDays) {
        let endTS = this.currentTS();
        let startTS = endTS - lookbackDays * 86400;
        for (let ts = startTS; ts < endTS; ts += 86400) {
            let t0 = ts;
            let t1 = ts + 86400;
            await this.xcmanalytics_period(chain, t0, t1);
        }
    }

    // xcmtransfer_match matches cross transfers between SENDING events held in "xcmtransfer"  and CANDIDATE destination events (from various xcm received messages on a destination chain)
    // this will be phased out soon
    async xcm_reanalytics(startTS, endTS = null, ratMin = .99, lookbackSeconds = 7200) {
        let endWhere = endTS ? `and xcmtransfer.sourceTS < ${endTS}` : ""
        let sql = `select chainID, chainIDDest, extrinsicHash, extrinsicID, asset, rawAsset, amountSent, amountReceived, transferIndex, xcmIndex, sourceTS, destTS from xcmtransfer
 where  sourceTS >= ${startTS} and asset not like '%BTC%'  and incomplete = 0 ${endWhere}
order by chainID, extrinsicHash`
        let [logDTS, hr] = paraTool.ts_to_logDT_hr(startTS)
        let windowTS = (endTS != undefined) ? endTS - startTS : 'NA'
        console.log(`match_reanalytics [${logDTS} ${hr}] windowTS=${windowTS},lookbackSeconds=${lookbackSeconds}, ratMin=${ratMin}`)
        console.log(sql)
        try {
            let xcmmatches = await this.poolREADONLY.query(sql);
            let out = [];
            let vals = ["amountSentUSD", "amountReceivedUSD"];
            for (let i = 0; i < xcmmatches.length; i++) {
                let m = xcmmatches[i];
                let chainID = m.chainID
                let asset = m.asset
                let rawAsset = m.rawAsset
                let [isXCMAssetFound, standardizedXCMInfo] = this.getStandardizedXCMAssetInfo(chainID, asset, rawAsset)
                if (isXCMAssetFound) {
                    let decimals = standardizedXCMInfo.decimals;
                    let nativeAssetChain = standardizedXCMInfo.nativeAssetChain;
                    let [nativeAsset, nativeChainID] = paraTool.parseAssetChain(standardizedXCMInfo.nativeAssetChain)
                    if (this.assetInfo[nativeAssetChain]) {
                        let priceTS = (m.destTS != undefined) ? m.destTS : m.sourceTS
                        let [_, priceUSD, priceUSDCurrent] = await this.computeUSD(1.0, nativeAsset, nativeChainID, priceTS);
                        if (priceUSD > 0) {
                            let asset = m.asset;
                            let amountSent = parseFloat(m.amountSent) / 10 ** decimals;
                            let amountReceived = parseFloat(m.amountReceived) / 10 ** decimals;
                            let amountSentUSD = (amountSent > 0) ? priceUSD * amountSent : 0;
                            let amountReceivedUSD = (amountReceived > 0) ? priceUSD * amountReceived : 0;
                            let sql = `update xcmtransfer set amountSentUSD = '${amountSentUSD}', amountReceivedUSD = '${amountReceivedUSD}' where extrinsicHash = '${m.extrinsicHash}' and  transferIndex = '${m.transferIndex}' and xcmIndex = '${m.xcmIndex}'`;
                            console.log(sql);
                            this.batchedSQL.push(sql);
                            await this.update_batchedSQL()
                        }
                    } else {
                        console.log(`NativeAssetChain NOT FOUND [${m.extrinsicHash}] nativeAsset=${nativeAsset}, nativeChainID=${nativeChainID}, asset=${asset}, rawAsset=${rawAsset}`)
                    }
                }
            }

        } catch (err) {
            console.log("xcmtransfer_reanalytics", err)
        }
    }

    async xcmReanalytics(lookbackDays) {
        let endTS = this.currentTS();
        let startTS = endTS - lookbackDays * 86400;
        for (let ts = startTS; ts < endTS; ts += 86400) {
            let t0 = ts;
            let t1 = ts + 86400;
            await this.xcm_reanalytics(t0, t1);
        }
    }

}
