// node testDecodeBlock.js

async function main() {
    const {
        ApiPromise,
        WsProvider
    } = require('@polkadot/api');
    const {
        u8aToHex
    } = require("@polkadot/util");
    const {
        encodeAddress
    } = require("@polkadot/keyring");
    const paraTool = require("../paraTool");
    //1239 |     17847190 | 2023-10-23 | 1698060978 | 0xa94a3cfe124e7b90734f95dde74f68212524eed5b1929e3189c4784a4764e388 |
    var [chainID, blockNumber, blockHash] = [0, 17847190, "0xa94a3cfe124e7b90734f95dde74f68212524eed5b1929e3189c4784a4764e388"];
    var WSEndpoints = "wss://rpc.polkadot.io"
    var api = await ApiPromise.create({
        provider: new WsProvider(WSEndpoints) //wss://kusama-rpc.polkadot.io
    });
    await api.isReady;

    var signedBlock = await api.rpc.chain.getBlock(blockHash);
    var sj = signedBlock.toJSON();
    var sn = JSON.parse(JSON.stringify(sj));
    var apiAt = await api.at(blockHash)
    var signedBlock2 = apiAt.registry.createType('SignedBlock', sn);



    const paraTool = require("../paraTool");
    var [chainID, blockNumber, blockHash] = [0, 1325210, "0xa70a75c54a457a823f1a5492a39049869de880ad64486eae5bdf60f5403f6354"];
    var api = await ApiPromise.create({
        provider: new WsProvider((chainID == paraTool.chainIDAcala) ? "wss://acala-polkadot.api.onfinality.io/public-ws" : 'wss://statemine.api.onfinality.io/public-ws') //wss://kusama-rpc.polkadot.io
    });
    await api.isReady;

    var api2 = await ApiPromise.create({
        provider: new WsProvider((chainID == paraTool.chainIDAcala) ? "wss://acala-polkadot.api.onfinality.io/public-ws" : 'wss://kusama-rpc.polkadot.io') //wss://kusama-rpc.polkadot.io
    });
    await api2.isReady;


    var signedBlock = await api.rpc.chain.getBlock(blockHash);
    var sj = signedBlock.toJSON();
    var sn = JSON.parse(JSON.stringify(sj));
    var apiAt = await api.at(blockHash)
    var signedBlock2 = apiAt.registry.createType('SignedBlock', sn);

    //api.query.staking.nominators
    //api.query.staking.currentEra
    //api.query.staking.erasStakers

    // retrieve all the nominator keys
    var keys = await apiAt.query.staking.nominators.keys();

    // extract the first key argument [AccountId] as string
    var nominatorIds = keys.map(({ args: [nominatorId] }) => nominatorId);
    var nominators = JSON.parse(JSON.stringify(nominatorIds))


    console.log('all nominators:', nominatorIds.join(', '));
    JSON.stringify(nominatorIds)


    var query = await apiAt.query.staking.nominators.entriesPaged({
        args: [],

    })

    var query = await apiAt.query.staking.erasStakers.entries()

    var nominators = await apiAt.query.staking.nominators.entries();
    var nominatorMap = {};
    var validatorMap = {};

    decodeStakingNomitors(nominators, nominatorMap, validatorMap)
    console.debug(`got ${nominators.length} entries !!`)

    while (!done) {
        let apiAt = await api.at(finalizedBlockHash)
        console.log("finalizedBlockHash", finalizedBlockHash);
        let query = null;
        try {
            query = await apiAt.query.system.account.entriesPaged({
                args: [],
                pageSize: perPagelimit,
                startKey: last_key
            })
        } catch (err) {
            done = true;
            return (false);
        }
        if (query.length == 0) {
            console.log(`Query Completed: total ${numHolders} accounts`)
            break
        } else {
            console.log(`Query Completed: total ${numHolders} accounts`)
        }

        var cnt = 0
        let out = [];
        let vals = ["ss58Address", "free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN"];
        let replace = ["ss58Address"];
        let lastUpdateBN = ["free", "reserved", "miscFrozen", "frozen", "blockHash", "lastUpdateDT", "lastUpdateBN"];
        let bqRows = [];
        for (const user of query) {
            cnt++
            numHolders++;
            let pub = user[0].slice(-32);
            let pubkey = u8aToHex(pub);
            let account_id = encodeAddress(pub, prefix);
            let nonce = parseInt(user[1].nonce.toString(), 10)
            let balance = user[1].data // check equil/genshiro case
            let free_raw = balance.free ? paraTool.dechexToIntStr(balance.free.toString()) : "";
            let reserved_raw = balance.reserved ? paraTool.dechexToIntStr(balance.reserved.toString()) : "";
            let misc_frozen_raw = balance.miscFrozen ? paraTool.dechexToIntStr(balance.miscFrozen.toString()) : "";
            let frozen_raw = balance.feeFrozen ? paraTool.dechexToIntStr(balance.feeFrozen.toString()) : "";
            let flags_raw = balance.flags ? balance.flags.toString() : "";
            if (chainID == 22024 || chainID == 2011) {
                balance = balance.toJSON();
                if (balance.v0 && balance.v0.balance) {
                    balance = balance.v0.balance;
                    console.log(balance)
                    // String {"nonce":0,"consumers":0,"providers":3,"sufficients":0,"data":{"v0":{"lock":0,"balance":[[6450786,{"positive":170000000}],[6648164,{"positive":408318303}],[6648936,{"positive":40143961}],[1651864420,{"positive":2852210857}],[1734700659,{"positive":80714784622320}],[1751412596,{"positive":22000000000}],[2019848052,{"positive":50000000000}],[517081101362,{"positive":42000000000}]]}}}
                    for (let b of balance) {
                        if (b.length == 2) {
                            let currencyID = b[0];
                            if (((currencyID == 1734700659) || (currencyID == 25969)) && b[1].positive) {
                                free_raw = b[1].positive.toString()
                            }
                        }
                    }
                } else {
                    console.log("CHECK genshiro", balance);
                }
            }
            let free = (free_raw.length > 0) ? free_raw / 10 ** decimals : 0;
            let reserved = (reserved_raw.length > 0) ? reserved_raw / 10 ** decimals : 0;
            let misc_frozen = (misc_frozen_raw.length > 0) ? misc_frozen_raw / 10 ** decimals : 0;
            let frozen = (frozen_raw.length > 0) ? frozen_raw / 10 ** decimals : 0;

            let stateHash = u8aToHex(user[1].createdAtHash)
            if ((chainID == 2004 || chainID == 22023) && (pubkey.length >= 40)) {
                pubkey = "0x" + pubkey.substr(pubkey.length - 40, 40); // evmaddress is the last 20 bytes (40 chars) of the storagekey
                account_id = "";
            }
            let rowKey = pubkey.toLowerCase()
            if (logDT) {
                let free_usd = (priceUSD > 0) ? free * priceUSD : 0;
                let reserved_usd = (priceUSD > 0) ? reserved * priceUSD : 0;
                let misc_frozen_usd = (priceUSD > 0) ? misc_frozen * priceUSD : 0;
                let frozen_usd = (priceUSD > 0) ? frozen * priceUSD : 0;

                if ((free > 0) || (reserved > 0) || (misc_frozen > 0) || (frozen > 0)) {
                    bqRows.push({
                        chain_name: chainName,
                        id,
                        para_id: paraID,
                        address_pubkey: pubkey,
                        address_ss58: account_id,
                        asset,
                        symbol,
                        free,
                        reserved,
                        misc_frozen,
                        frozen,
                        free_raw,
                        reserved_raw,
                        misc_frozen_raw,
                        frozen_raw,
                        free_usd,
                        reserved_usd,
                        misc_frozen_usd,
                        frozen_usd,
                        flags_raw,
                        ts: blockTS,
                        price_usd: priceUSD,
                        nonce: nonce
                    });
                    if ((logDT == yesterdayDT) || (logDT == todayDT)) {
                        rows.push(this.generate_btRealtimeRow(rowKey, encodedAssetChain,
                            id, relayChain, paraID, symbol, decimals,
                            free, reserved, misc_frozen, frozen,
                            free_usd, reserved_usd, misc_frozen_usd, frozen_usd,
                            free_raw, reserved_raw, misc_frozen_raw, frozen_raw,
                            flags_raw,
                            blockTS, bn));
                    }
                }
            }
        }
        if (rows.length > 0) {
            await this.insertBTRows(tblRealtime, rows, "balances");
            rows = []
        }

        console.log("writing", `${chainID}#${logDT}#${jobID} with PUBKEY${encodedAssetChain}`, bqRows.length);
        if (logDT) {
            // write rows to balances
            let tblBalances = this.instance.table("balances")
            let rawRows = bqRows.map((r) => {
                let key = `${chainID}#${logDT}#${jobID}#${r.address_pubkey}#${encodedAssetChain}`
                let hres = {
                    key,
                    data: {
                        balances: {}
                    }
                }
                hres['data']['balances']['last'] = {
                    value: JSON.stringify(r),
                    timestamp: this.getCurrentTS() * 1000000
                };
                return (hres)
            });
            if (rawRows.length > 0) {
                console.log("WRITING", rawRows.length);
                await this.insertBTRows(tblBalances, rawRows, "balances");
            }
        }
        last_key = (query.length > 999) ? query[query.length - 1][0] : "";

        const gbRounded = this.gb_heap_used();
        console.log(`system.account page: `, page++, last_key.toString(), "recs=", query.length, `Heap allocated ${gbRounded} GB`, query.length);
        // save last_key state in db and get out if memory is getting lost (>1GB heap) -- we will pick it up again
        let sql1 = `insert into chainbalancecrawler (chainID, logDT, jobID, lastDT, lastKey, tally) values ('${chainID}', '${logDT}', '${jobID}', Now(), '${last_key.toString()}', '${query.length}') on duplicate key update jobID = values(jobID), lastDT = values(lastDT), lastKey = values(lastKey), tally = tally + values(tally)`
        console.log(sql1);
        this.batchedSQL.push(sql1);
        await this.update_batchedSQL();
        if (last_key == "") done = true;
        if (gbRounded > 1) {
            // when we come back, we'll pick this one
            console.log(`EXITING with last key stored:`, last_key.toString());
            // update lastUpdateAddressBalancesAttempts back to 0
            let sql = `update blocklog set lastUpdateAddressBalancesAttempts = 0 where logDT = '${logDT}' and chainID = '${chainID}'`;
            this.batchedSQL.push(sql1);
            await this.update_batchedSQL();
            process.exit(1);
        }
    }

    for (const ex of signedBlock2.block.extrinsics) {
        let dEx = decode_s_extrinsic(ex, blockNumber, apiAt)
        console.log("output dEx", JSON.stringify(dEx))
    }

    console.log(signedBlock2.toHuman().block.extrinsics[3]);
}

function decorate_call_args(exos) {
    let exoh = false;
    try {
        exoh = JSON.parse(JSON.stringify(extrinsic.toHuman()));
        console.log("exoh", exoh)
        //merge pallet+method from args
        if (exoh && exoh.method.args.calls != undefined) {
            for (let i = 0; i < exoh.method.args.calls.length; i++) {
                let f = {
                    callIndex: exos.method.args.calls[i].callIndex,
                    method: exoh.method.args.calls[i].method,
                    section: exoh.method.args.calls[i].section,
                    args: exos.method.args.calls[i].args
                }
                exos.args.calls[i] = f
            }
        }
    } catch (err1) {
        /// TODO: ....
    }
}

function decodeStakingNomitors(nominators, nominatorMap = {}, validatorMap = {}){
    for (const user of nominators) {
        let pub = user[0].slice(-32);
        let pubkey = u8aToHex(pub);
        let prefix = 0
        let address_ss58 = encodeAddress(pub, prefix);
        //let nonce = parseInt(user[1].nonce.toString(), 10)
        //console.log(`pubkey=${pubkey} account_id=${account_id}`)
        var nomination = JSON.parse(JSON.stringify(user[1]))
        if (nomination.targets){
            nominatorMap[address_ss58] = nomination.targets
        }
        for (const validator of nomination.targets){
            if (validatorMap[validator] == undefined) validatorMap[validator] = []
            validatorMap[validator].push(address_ss58)
        }
    }
}

function decode_s_extrinsic(extrinsic, blockNumber, apiAt) {
    let exos = JSON.parse(extrinsic.toString());
    //    let exoh = JSON.parse(JSON.stringify(extrinsic.toHuman()));
    console.log("exos", exos)


    let exoh = false;
    try {
        exoh = JSON.parse(JSON.stringify(extrinsic.toHuman()));
        console.log("exoh", exoh)
        //merge pallet+method from args
        if (exoh && exoh.method.args.calls != undefined) {
            for (let i = 0; i < exoh.method.args.calls.length; i++) {
                let f = {
                    callIndex: exos.method.args.calls[i].callIndex,
                    method: exoh.method.args.calls[i].method,
                    section: exoh.method.args.calls[i].section,
                    args: exos.method.args.calls[i].args
                }
                exos.method.args.calls[i] = f
            }
        }
    } catch (err1) {
        /// TODO: ....
    }

    if (exos.method.args.call != undefined) {
        let opaqueCall = exos.method.args.call
        let extrinsicCall = false;
        console.log("opaqueCall", opaqueCall)
        try {
            // cater for an extrinsic input...
            extrinsicCall = apiAt.registry.createType('Call', opaqueCall);
            console.log("decoded opaqueCall", extrinsicCall.toString())

            var {
                method,
                section
            } = apiAt.registry.findMetaCall(extrinsicCall.callIndex); // needs change

            let innerexs = JSON.parse(extrinsicCall.toString());
            let innerexh = false
            let innerOutput = {}
            try {
                innerexh = JSON.parse(JSON.stringify(extrinsicCall.toHuman()));;
                //            console.log("exh", JSON.stringify(exh))
                //merge pallet+method from args
                if (innerexh && innerexh.args.calls != undefined) {
                    for (let i = 0; i < innerexh.args.calls.length; i++) {
                        let f = {
                            callIndex: innerexs.args.calls[i].callIndex,
                            method: innerexh.args.calls[i].method,
                            section: innerexh.args.calls[i].section,
                            args: innerexs.args.calls[i].args
                        }
                        innerexs.args.calls[i] = f
                    }
                }

                innerOutput = {
                    callIndex: innerexs.callIndex,
                    method: innerexh.method,
                    section: innerexh.section,
                    args: innerexs
                }
            } catch (err1) {
                /// TODO: ....
            }

            console.log("innerexs", JSON.stringify(innerexs))
            console.log("innerexh", JSON.stringify(innerexh))

            exos.method.args.call = innerOutput
            //exs.method.args.call = extrinsicCall.toJSON()

            //decoded.method.args.call = extrinsicCall.toJSON()

        } catch (e) {
            console.log('try errored')
        }


    }

    let sig = exos.signature
    if (exoh) {
        sig.isSigned = exoh.isSigned
    }

    let out = {
        method: {
            pallet: exoh.method.section,
            method: exoh.method.method
        },
        args: exos.method.args,
        signature: sig,
    }

    return (out)
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
