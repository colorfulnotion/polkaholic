// node testDecodeBlock.js

async function main() {
    const {
        ApiPromise,
        WsProvider
    } = require('@polkadot/api');
    const paraTool = require("./paraTool");
    var [chainID, blockNumber, blockHash] = [0, 1325210, "0xa70a75c54a457a823f1a5492a39049869de880ad64486eae5bdf60f5403f6354"];
    var api = await ApiPromise.create({
        provider: new WsProvider((chainID == paraTool.chainIDAcala) ? "wss://acala-polkadot.api.onfinality.io/public-ws" : 'wss://rpc.polkadot.io') //wss://kusama-rpc.polkadot.io
    });
    await api.isReady;

    const paraTool = require("./paraTool");
    var [chainID, blockNumber, blockHash] = [0, 1325210, "0xa70a75c54a457a823f1a5492a39049869de880ad64486eae5bdf60f5403f6354"];
    var api = await ApiPromise.create({
        provider: new WsProvider((chainID == paraTool.chainIDAcala) ? "wss://acala-polkadot.api.onfinality.io/public-ws" : 'wss://statemine.api.onfinality.io/public-ws') //wss://kusama-rpc.polkadot.io
    });
    await api.isReady;

    var api2 = await ApiPromise.create({
        provider: new WsProvider((chainID == paraTool.chainIDAcala) ? "wss://acala-polkadot.api.onfinality.io/public-ws" : 'wss://kusama-rpc.polkadot.io') //wss://kusama-rpc.polkadot.io
    });
    await api2.isReady;




    // polkadot multisig (as_multi) https://polkadot.subscan.io/block/1325210
    var signedBlock = await api.rpc.chain.getBlock(blockHash);
    var sj = signedBlock.toJSON();
    var sn = JSON.parse(JSON.stringify(sj));
    var apiAt = await api.at(blockHash)
    var signedBlock2 = apiAt.registry.createType('SignedBlock', sn);

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