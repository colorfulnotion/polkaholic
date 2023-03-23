#!/usr/bin/env node
 // Usage:  testChainParser
const Indexer = require("../indexer");
const paraTool = require("../paraTool");

async function main() {
    let testcases = {
        2012: [
            // Current: {"Token":"DOT"}  Should be:  {"Token":"101"}  DIFFERENT style: DOT
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "here": null
                        }
                    }
                },
                "fun": {
                    "fungible": 257153032251
                }
            },
            // Current: {"Token":"GLMR"}  Should be: {"Token":"114"}  DIFFERENT style: GLMR
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "x2": [{
                                "parachain": 2004
                            }, {
                                "palletInstance": 10
                            }]
                        }
                    }
                },
                "fun": {
                    "fungible": "0x0000000000000065535d6d0001c6719a"
                }
            },
        ],
        2004: [
            // Current: {"Token":"DOT"}  Should be:  {"Token":"42259045809535163221576417993425387648"}  DIFFERENT: DOT
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "here": null
                        }
                    }
                },
                "fun": {
                    "fungible": 75431473372
                }
            },
            // Current: {"Token":"INTR"} Should be:  {"Token":"101170542313601871197860408087030232491"} DIFFERENT: INTR
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "x2": [{
                                "parachain": 2032
                            }, {
                                "generalKey": "0x0002"
                            }]
                        }
                    }
                },
                "fun": {
                    "fungible": 50756147936
                }
            },
            // Current: {"Token":"AUSD"} Should be:  {"Token":"110021739665376159354538090254163045594"} DIFFERENT: AUSD
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "x2": [{
                                "parachain": 2000
                            }, {
                                "generalKey": "0x0001"
                            }]
                        }
                    }
                },
                "fun": {
                    "fungible": 476659060635117
                }
            }

        ],
        22000: [
            // Current: {"Token":"BSX"}  Should be: {"ForeignAsset":"11"}  DIFFERENT: BSX
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "x2": [{
                                "parachain": 2090
                            }, {
                                "generalIndex": 0
                            }]
                        }
                    }
                },
                "fun": {
                    "fungible": "0x000000000000000000f22a491e8dd34f"
                }
            },
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "x3": [{
                                "parachain": 1000
                            }, {
                                "palletInstance": 50
                            }, {
                                "generalIndex": 8
                            }]
                        }
                    }
                },
                "fun": {
                    "fungible": 850059116249
                }
            }
        ],
        22007: [
            // Current: {"Token":"KINT"}  Should be: {"Token":"18446744073709551622"}  DIFFERENT: KINT
            {
                "id": {
                    "concrete": {
                        "parents": 1,
                        "interior": {
                            "x2": [{
                                "parachain": 2092
                            }, {
                                "generalKey": "0x000c"
                            }]
                        }
                    }
                },
                "fun": {
                    "fungible": 100000000000
                }
            }
        ],
        2030: [{
            "id": {
                "concrete": {
                    "parents": 1,
                    "interior": {
                        "here": null
                    }
                }
            },
            "fun": {
                "fungible": 9864879524
            }
        }]
    };

    let isManual = false
    if (isManual) {
        console.log(`test manual violations`)
        for (const chainID of Object.keys(testcases)) {
            var indexer = new Indexer();
            await indexer.assetManagerInit();
            let chain = await indexer.getChain(chainID);
            await indexer.setup_chainParser(chain, paraTool.debugTracing);
            indexer.relayChain = paraTool.getRelayChainByChainID(chainID);
            indexer.chainID = chainID;
            for (const c of testcases[chainID]) {
                let [targetedSymbol, targetedRelayChain, targetedXcmInteriorKey0] = indexer.chainParser.processV1ConcreteFungible(indexer, c);
                console.log(`relaychain=${indexer.relayChain}, chainID=${chainID},targetedSymbol=${targetedSymbol}, targetedRelayChain=${targetedSymbol}, ${JSON.stringify(c,null,4)}`);
            }
        }
    } else {
        console.log(`auto fetch violations`)
        var defaultIndexer = new Indexer();
        let violationType = 'symbol' //'signal'
        let xcmViolations = await defaultIndexer.getXcmViolation(violationType)
        for (const chainID of Object.keys(xcmViolations)) {
            var indexer = new Indexer();
            await indexer.assetManagerInit();
            let chain = await indexer.getChain(chainID);
            await indexer.setup_chainParser(chain, paraTool.debugTracing);
            indexer.relayChain = paraTool.getRelayChainByChainID(chainID);
            indexer.chainID = chainID;
            let targetedSymbol, targetedRelayChain, targetedXcmInteriorKey0;
            for (const c of xcmViolations[chainID]) {
                let callerFunc = c.caller
                let parserFunc = c.parser
                let instruction = c.instruction
                switch (parserFunc) {
                    case 'processV0ConcreteFungible':
                        [targetedSymbol, targetedRelayChain] = indexer.chainParser.processV0ConcreteFungible(indexer, instruction);
                        break;
                    case 'processV1ConcreteFungible':
                        [targetedSymbol, targetedRelayChain, targetedXcmInteriorKey0] = indexer.chainParser.processV1ConcreteFungible(indexer, instruction);
                        break;
                    case 'processFeeLocation':
                        [targetedSymbol, targetedRelayChain] = indexer.chainParser.processFeeLocation(indexer, instruction)
                        break;
                    case 'getNativeSymbol':
                        targetedSymbol = indexer.chainParser.getNativeSymbol(chainID) // no instruction
                        break;
                    case 'processXcmGenericCurrencyID':
                        targetedSymbol = indexer.chainParser.processXcmGenericCurrencyID(indexer, instruction, chainID)
                        break;
                    case 'processXcmDecHexCurrencyID':
                        targetedSymbol = indexer.chainParser.processXcmDecHexCurrencyID(indexer, instruction, chainID)
                        break;
                    default:
                        console.log(`unhandled ${parserFunc}`)
                        break;
                }
                if (targetedSymbol == false) {
                    console.log(`NOT OK [${parserFunc}] [${callerFunc}] relaychain=${indexer.relayChain}, chainID=${chainID}, targetedSymbol=${targetedSymbol}, targetedRelayChain=${targetedSymbol}, ${JSON.stringify(c,null,4)}`);
                } else {
                    console.log(`[${parserFunc}] [${callerFunc}] relaychain=${indexer.relayChain}, chainID=${chainID}, targetedSymbol=${targetedSymbol}, targetedRelayChain=${targetedSymbol}, ${JSON.stringify(c,null,4)}`);
                }
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
