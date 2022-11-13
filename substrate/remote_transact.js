const ethers = require('ethers');
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
    evmToAddress,
    addressToEvm
} = require('@polkadot/util-crypto');

const fs = require('fs');

class XCMClient {
    providerRPCs = {
        collator1: {
            name: 'shibuya1',
            WSEndpoint: "wss://shiden-internal.polkaholic.io:6945", // Substrate
            rpc: 'http://shiden-internal.polkaholic.io:8545',
            chainId: 81,
            SS58Prefix: 5
        },
        collator2: {
            name: 'shibuya2',
            WSEndpoint: "wss://shiden-internal.polkaholic.io:6946", // Substrate
            rpc: 'http://shiden-internal.polkaholic.io:8546', // EVM RPC
            chainId: 81,
            SS58Prefix: 5
        },
    }
    providers = {};
    apis = {};
    address = {};
    wallet = {};

    // holds keyring / evm wallet keys
    pair = null;
    evmpair = null

    async init() {
        await cryptoWaitReady()
    }

    getSudoDev(sudo, id) {
        const keyring = new Keyring({
            type: 'sr25519'
        });
        let ss58Prefix = 5 // TODO: get from RPCprovider list
        keyring.setSS58Format(ss58Prefix);
        return keyring.createFromUri(sudo);
    }

    getEVMWallet(id) {
        var raw = fs.readFileSync("/root/.walletevm2", 'utf8');
        raw = raw.trim();
        let wallet = new ethers.Wallet(raw, this.providers[id]);
        return wallet;
    }

    async setupProvider(id) {
        let providerRPC = this.providerRPCs[id]
        // setup EVM connection
        this.providers[id] = new ethers.providers.StaticJsonRpcProvider(providerRPC.rpc, {
            chainId: providerRPC.chainId,
            name: providerRPC.name,
        });

        // setup Substrate api connection
        let WSEndpoint = providerRPC.WSEndpoint
        var api = await ApiPromise.create({
            provider: new WsProvider(WSEndpoint)
        });
        await api.isReady;
        this.apis[id] = api
    }

    async sendDev(sudo = "//Alice", addressTo = "WhPMw3gxuF6amuTnpYR6N3oaWgwZwia6y9TCSxE9UwNyAbN", id = "collator1") {
        let sudodev = this.getSudoDev(sudo, id);
        console.log("sending from", sudodev.address, "to:", addressTo);

        const txHash = await this.apis[id].tx.balances
            .transfer(addressTo, "125000000000000000")
            .signAndSend(sudodev);
        console.log(txHash.toString());
    }

    async balancesSS58(addresses, provider) {
        for (const address of addresses) {
            let x = await this.apis[provider].query.system.account(address);
            let balances = x.toHuman();
            console.log("balancesSS58", address, balances);
        }
    }

    async balancesEVM(addresses, id = "collator1") {
        for (const address of addresses) {
            const balance = ethers.utils.formatEther(await this.providers[id].getBalance(address));
            console.log(`The balance of ${address} is: ${balance}`);
        }
    }

    async sendEVM(from, addressTo = "", amount = "1") {
        console.log(`Attempting to send transaction from ${wallet.address} to ${addressTo}`);

        const tx = {
            to: addressTo,
            value: ethers.utils.parseEther(amount),
        };

        const createReceipt = await wallet.sendTransaction(tx);
        await createReceipt.wait();
        console.log(`Transaction successful with hash: ${createReceipt.hash}`);
    }

    async deployFlipper(id) {
        const contractFile = require('./flipper');

        const abi = contractFile.abi;
        const bytecode = contractFile.evm.bytecode.object;

        let wallet = this.getEVMWallet(id)
        const flipper = new ethers.ContractFactory(abi, bytecode, wallet);

        const contract = await flipper.deploy([false])
        console.log(`Attempting to deploy contract on ${id}`, contract)
        await contract.deployed();
        console.log(`Contract deployed at address: ${contract.address} on ${id}`);
        return contract.address;
    }

    async getflipcount(contractAddress, id) {
        const {
            abi
        } = require('./flipper');
        console.log(`Making a call to contract at address: ${contractAddress}`);
        const flipper = new ethers.Contract(contractAddress, abi, this.providers[id]);
        const data = await flipper.getCounter();
        const data2 = await flipper.get();
        console.log(`READ Flipper Contract on ${id} -- getCounter() => ${data} |  get() ==> ${data2}`);
    }

    async flip(contractAddress, id) {
        const {
            abi
        } = require('./flipper');
        let wallet = this.getEVMWallet(id)
        const flipper = new ethers.Contract(contractAddress, abi, wallet);
        console.log(`Calling the flip function on ${id} at address: ${contractAddress}`);
        const createReceipt = await flipper.flip();
        await createReceipt.wait();
        console.log(`flip Tx successful on ${id} with hash: ${createReceipt.hash}`);
    }

    get_encoded_ethereum_transact(api, source, contract, input, gasLimit = 600000, maxFeePerGas = 20000000, maxPriorityFeePerGas = 20000000) {
        // map internaltx to evm.call -- what we want is a nonceless/signatureless encodedcall 
        //const internaltx = api.tx.evm.call(source, contract, input, 0, gasLimit, maxFeePerGas, maxPriorityFeePerGas, -1, [])
        const internaltx = api.tx.ethereum.transact({
            Legacy: {
                nonce: 0,
                gasPrice: 20000000,
                gasLimit,
                action: {
                    Call: contract
                },
                value: 0,
                input,
                signature: {
                    v: "0x",
                    r: "0x0000000000000000000000000000000000000000000000000000000000000000",
                    s: "0x0000000000000000000000000000000000000000000000000000000000000000"
                }
            }
        })
        let encodedCall = internaltx.toHex();
        encodedCall = "0x" + encodedCall.substring(8) // why?
        return encodedCall;
    }

    async remote_transact(id, parachain_id, is_relay, payment_asset_id, payment_amount, call, transact_weight) {
        let abi = [{
            "inputs": [{
                "internalType": "address[]",
                "name": "asset_id",
                "type": "address[]"
            }, {
                "internalType": "uint256[]",
                "name": "asset_amount",
                "type": "uint256[]"
            }, {
                "internalType": "address",
                "name": "recipient_account_id",
                "type": "address"
            }, {
                "internalType": "bool",
                "name": "is_relay",
                "type": "bool"
            }, {
                "internalType": "uint256",
                "name": "parachain_id",
                "type": "uint256"
            }, {
                "internalType": "uint256",
                "name": "fee_index",
                "type": "uint256"
            }],
            "name": "assets_reserve_transfer",
            "outputs": [{
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }],
            "stateMutability": "nonpayable",
            "type": "function"
        }, {
            "inputs": [{
                "internalType": "address[]",
                "name": "asset_id",
                "type": "address[]"
            }, {
                "internalType": "uint256[]",
                "name": "asset_amount",
                "type": "uint256[]"
            }, {
                "internalType": "bytes32",
                "name": "recipient_account_id",
                "type": "bytes32"
            }, {
                "internalType": "bool",
                "name": "is_relay",
                "type": "bool"
            }, {
                "internalType": "uint256",
                "name": "parachain_id",
                "type": "uint256"
            }, {
                "internalType": "uint256",
                "name": "fee_index",
                "type": "uint256"
            }],
            "name": "assets_reserve_transfer",
            "outputs": [{
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }],
            "stateMutability": "nonpayable",
            "type": "function"
        }, {
            "inputs": [{
                "internalType": "address[]",
                "name": "asset_id",
                "type": "address[]"
            }, {
                "internalType": "uint256[]",
                "name": "asset_amount",
                "type": "uint256[]"
            }, {
                "internalType": "bytes32",
                "name": "recipient_account_id",
                "type": "bytes32"
            }, {
                "internalType": "bool",
                "name": "is_relay",
                "type": "bool"
            }, {
                "internalType": "uint256",
                "name": "parachain_id",
                "type": "uint256"
            }, {
                "internalType": "uint256",
                "name": "fee_index",
                "type": "uint256"
            }],
            "name": "assets_withdraw",
            "outputs": [{
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }],
            "stateMutability": "nonpayable",
            "type": "function"
        }, {
            "inputs": [{
                "internalType": "address[]",
                "name": "asset_id",
                "type": "address[]"
            }, {
                "internalType": "uint256[]",
                "name": "asset_amount",
                "type": "uint256[]"
            }, {
                "internalType": "address",
                "name": "recipient_account_id",
                "type": "address"
            }, {
                "internalType": "bool",
                "name": "is_relay",
                "type": "bool"
            }, {
                "internalType": "uint256",
                "name": "parachain_id",
                "type": "uint256"
            }, {
                "internalType": "uint256",
                "name": "fee_index",
                "type": "uint256"
            }],
            "name": "assets_withdraw",
            "outputs": [{
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }],
            "stateMutability": "nonpayable",
            "type": "function"
        }, {
            "inputs": [{
                "internalType": "uint256",
                "name": "parachain_id",
                "type": "uint256"
            }, {
                "internalType": "bool",
                "name": "is_relay",
                "type": "bool"
            }, {
                "internalType": "address",
                "name": "payment_asset_id",
                "type": "address"
            }, {
                "internalType": "uint256",
                "name": "payment_amount",
                "type": "uint256"
            }, {
                "internalType": "bytes",
                "name": "call",
                "type": "bytes"
            }, {
                "internalType": "uint64",
                "name": "transact_weight",
                "type": "uint64"
            }],
            "name": "remote_transact",
            "outputs": [{
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }],
            "stateMutability": "nonpayable",
            "type": "function"
        }]

        let wallet = this.getEVMWallet(id)
        let systemContractAddress = "0x0000000000000000000000000000000000005004";
        const systemcontract = new ethers.Contract(systemContractAddress, abi, wallet);
        console.log(`Calling ${systemContractAddress} remote_transact on ${id}:`);
        const createReceipt = await systemcontract.remote_transact(parachain_id, is_relay, payment_asset_id, payment_amount, call, transact_weight, {
            gasLimit: 800000
        });
        await createReceipt.wait();
        console.log(`remote_transact Tx on ${id} successful with hash: ${createReceipt.hash}`);
    }

    async registerAssetLocation(assetLocation, assetId, sudo = "//Alice", id) {
        let sudodev = this.getSudoDev(sudo, id)
        const txHash = await this.apis[id].tx.xcAssetConfig.registerAssetLocation(assetLocation, assetId)
            .signAndSend(sudodev);
        console.log(txHash.toString());
    }
    async setAssetsUnitPerSecond(assetLocation, unitsPerSecond, sudo = "//Alice", id) {
        let sudodev = this.getSudoDev(sudo, id)
        const txHash = await this.apis[id].tx.xcAssetConfig.registerAssetLocation(assetLocation, assetId)
            .signAndSend(sudodev);
        console.log(txHash.toString());
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

    async test(op) {
        let id = "collator1"; // 2000
        let id2 = "collator2"; // 2007
        await this.setupProvider(id);
        await this.setupProvider(id2);
        let api = this.apis[id];
        let sudoAlice = "//Alice";
        let ss58Alice = "ajYMsCKsEAhEvHpeA4XqsfiA9v1CdzZPrCfS6pEfeGHW9j8"
        let coreEVMAddress = "0xDcB4651B5BbD105CDa8d3bA5740b6C4f02b9256D";
        let coress58Address = evmToAddress(coreEVMAddress); // sending from Alice to this ss58 address funds the coreEVMAddress (WhPMw3gxuF6amuTnpYR6N3oaWgwZwia6y9TCSxE9UwNyAbN)

        // replace these based on deployFlipper(id) -- this will be the  2007->2000 remote execution
        let contractAddress2000 = "0xdb49e85E263614520115e14Dbb3CFc85967ffc69"
        // replace these based on deployFlipper(id2) --  this will be the 2000->2007 remote execution
        let contractAddress2007 = "0xdb49e85E263614520115e14Dbb3CFc85967ffc69"
        let input = "0xcde4efa9" // flip method

        // fund this 2007 to support 2000 => 2007 remote execution
        let [derivative2000EVMAddress, derivative2000SS58Address] = this.calculateMultilocationDerivative(api, 2000, coreEVMAddress);
        // fund this 2000 to support 2007 => 2000 remote execution
        let [derivative2007EVMAddress, derivative2007SS58Address] = this.calculateMultilocationDerivative(api, 2007, coreEVMAddress);

        let derivative2007SS58Address2 = evmToAddress(derivative2007EVMAddress); // fund derivative account on 2000, to support 2007=>2000 remote execution by coreEVMAddress originated on 2007
        let derivative2000SS58Address2 = evmToAddress(derivative2000EVMAddress); // fund derivative account on 2007, to support 2000=>2007 remote execution by coreEVMAddress originated on 2000

        console.log("coreEVMAddress:", coreEVMAddress, "coress58Address:", coress58Address);
        console.log("derivative 2000 evm:", derivative2000EVMAddress, "ss58:", derivative2000SS58Address, "alt:", derivative2000SS58Address2);
        console.log("derivative 2007 evm:", derivative2007EVMAddress, "ss58:", derivative2007SS58Address, "alt:", derivative2007SS58Address2);
        console.log("contractAddress2000:", contractAddress2000, "contractAddress2007:", contractAddress2007);

        // show balances on both parachains
        switch (op) {
            case "checkbalances":
                let ss58AddressList = [ss58Alice, coress58Address, derivative2000SS58Address, derivative2007SS58Address, derivative2000SS58Address2, derivative2007SS58Address2];
                let evmAddressList = [coreEVMAddress, derivative2000EVMAddress, derivative2007EVMAddress]
                await this.balancesSS58(ss58AddressList, id);
                await this.balancesSS58(ss58AddressList, id2);
                await this.balancesEVM(evmAddressList, id);
                await this.balancesEVM(evmAddressList, id2);
                break;
            case "fundaccounts":
                // Send funds to the evmAddress("0xDcB4651B5BbD105CDa8d3bA5740b6C4f02b9256D") on both chains, which will enable local execution
                await this.sendDev(sudoAlice, coress58Address, id); // enables flip on 2000 by coreEVMAddress
                await this.sendDev(sudoAlice, coress58Address, id2); // enabled flip on 2007 by coreEVMAddress
                break;
            case "fundderivatives2000":
                // send to the derivative ss58 addresses (origin: 2000/2007) on 2000 to support "remoteexecution2007=>2000"
                await this.sendDev(sudoAlice, derivative2007SS58Address2, id);
                break;
            case "fundderivatives2007":
                // send to the derivative ss58 addresses (origin: 2000/2007) on 2007 to support "remoteexecution2000=>2007"
                await this.sendDev(sudoAlice, derivative2000SS58Address2, id2);
                break;
            case "deploycontracts":
                contractAddress2000 = await this.deployFlipper(id);
                contractAddress2007 = await this.deployFlipper(id2);
                break;
            case "testlocalcontract2000":
                // test flip on 2000
                await this.getflipcount(contractAddress2000, id);
                await this.flip(contractAddress2000, id);
                break;
            case "testlocalcontract2007":
                // test flip on 2007
                await this.getflipcount(contractAddress2007, id2);
                await this.flip(contractAddress2007, id2);
                break;
            case "registerassets2000":
            // hrmp channels already in place, but UNCLEAR what has to be done next
            // on 2000, register 2007 assets
            {
                let unitsPerSecond = 10000000;
                await this.registerAssetLocation({
                    v1: {
                        parents: 1,
                        x1: {
                            Parachain: 2007
                        }
                    }
                }, 2007, sudoAlice, id);
                await this.setAssetUnitsPerSecond({
                    v1: {
                        parents: 1,
                        x1: {
                            Parachain: 2007
                        }
                    }
                }, unitsPerSecond, sudoAlice, id);
            }
            break;
            case "registerassets2007":
            // on 2007, register 2000 assets
            {
                let unitsPerSecond = 10000000;
                await this.registerAssetLocation({
                    v1: {
                        parents: 1,
                        x1: {
                            Parachain: 2000
                        }
                    }
                }, 2000, sudoAlice, id2);
                await this.setAssetUnitsPerSecond({
                    v1: {
                        parents: 1,
                        x1: {
                            Parachain: 2000
                        }
                    }
                }, unitsPerSecond, sudoAlice, id2);
            }
            break;
            case "remoteexecution2000=>2007": // 2000 => 2007 contractAddress2007 flip, which requires derivative account on 2007 to have balance
            {
                let call2007 = this.get_encoded_ethereum_transact(api, coreEVMAddress, contractAddress2007, input);

                // 7D7 = 2007 in hex
                let payment_amount = "4941000000000000";
                let transact_weight = "4941000000";
                let payment_address = ethers.utils.getAddress("0xffffffff000000000000000000000000000007d7");
                console.log("payment_address", payment_address, "call", call2007);
                await this.remote_transact(id, 2007, false, payment_address, payment_amount, call2007, transact_weight);
            }
            break;
            case "remoteexecution2000=>2007": // 2007 => 2000 contractAddress2000 flip, which requires derivative account on 2000 to have balance
            {
                let call2000 = this.get_encoded_ethereum_transact(api, coreEVMAddress, contractAddress2000, input);
                console.log(call2000);

                // 7D7 = 2000 in hex
                let payment_amount = "4941000000000000";
                let transact_weight = "9941000000";
                let payment_address = ethers.utils.getAddress("0xffffffff000000000000000000000000000007d0");
                console.log("payment_address", payment_address, "call", call2000);
                await this.remote_transact(id2, 2000, false, payment_address, payment_amount, call2000, transact_weight);
            }
            break;
        }
    }
}

async function main() {
    let client = new XCMClient();

    // standard EVM stuff: fund your account, deploy a contract (flipper on 2000/2007), test read/writes (getflipcount/flip)
    //await client.test("fundaccounts")      // fund 2 EVM accounts from "Alice" to deploy "flip" contracts on 2000/2007
    //await client.test("checkbalances")     // after "fundaccounts", check that the local+derivate accounts have balances
    //await client.test("deploycontracts")   // after "fundaccounts" done, set up "flip" contracts on 2000/2007 
    //await client.test("testlocalcontract2000") // after "deploycontracts", update contractAddress2000/2007 in "test" function and test reads/writes
    //await client.test("testlocalcontract2007") // after "deploycontracts", update contractAddress2000/2007 in "test" function and test reads/writes

    // XCM remote_transact (2000=>2007 flip)
    // register assets (https://docs.astar.network/docs/xcm/building-with-xcm/create-xc20-assets https://docs.astar.network/docs/xcm/building-with-xcm/send-xc20-evm)
    // (1) Register 0xffffffff000000000000000000000000000007D7 on 2000, which is necessary for 2000=>2007  since we are paying for execution on 2007 with 2007 assets
    // await client.test("registerassets2000")
    // (2) Fund derivative account on 2007 
    //await client.test("fundderivatives2007")   
    // (3) remote_transact (2000=>2007) SEE: https://docs.astar.network/docs/xcm/building-with-xcm/xc-remote-transact
    await client.test("remoteexecution2000=>2007")

    /*
    // XCM remote_transact (2007=>2000 flip) -- SAME as above, just the opposite direction
    // (1) Register 0xffffffff000000000000000000000000000007D0 on 2007, which is necessary for 2007=>2000 since we are paying for execution on 2000 with 2000 assets
    // await client.test("registerassets2007")
    // (2) Fund derivative account on 2000 
    // await client.test("fundderivatives2000")
    // (3) remote_transact (2007=>2000) SEE: https://docs.astar.network/docs/xcm/building-with-xcm/xc-remote-transact
    // await client.test("remoteexecution2007=>2000")
    */
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });