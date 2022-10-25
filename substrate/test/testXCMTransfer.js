    async getTestcasesAutomated(limit = 30) {
        let sql = `select xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM as isBeneficiaryEVM, 0 as isSenderEVM, count(*) cnt from xcmtransfer join xcmasset on
        xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey, chain where
        sourceTS > unix_timestamp(date_sub(Now(), interval 30 day)) and
        chain.chainID = xcmtransfer.chainIDDest and xcmtransfer.chainID >= 0 and
        xcmtransfer.chainIDDest >= 0 and incomplete = 0 and length(xcmtransfer.xcmInteriorKey) > 4 and
        xcmtransfer.sectionMethod not in ( 'xTokens:TransferredMultiAssets', 'xTransfer:transfer' )
        group by xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM
        having count(*) > 10 order by count(*) desc limit ${limit}`
        console.log(paraTool.removeNewLine(sql))
        let testcases = await this.poolREADONLY.query(sql);
        let autoTestcases = []
        for (const testcase of testcases) {
            if (testcase.chainID == paraTool.chainIDMoonriver || testcase.chainID == paraTool.chainIDMoonbeam || testcase.chainID == paraTool.chainIDMoonbaseAlpha || testcase.chainID == paraTool.chainIDMoonbaseBeta ||
                testcase.chainID == paraTool.chainIDAstar || testcase.chainID == paraTool.chainIDShiden || testcase.chainID == paraTool.chainIDShibuya
            ) {
                autoTestcases.push(testcase)
                let testcase2 = JSON.parse(JSON.stringify(testcase))
                testcase2.isSenderEVM = 1
                autoTestcases.push(testcase2)
            } else {
                autoTestcases.push(testcase)
            }
        }
        console.log("TESTCASES", autoTestcases.length);
        return autoTestcases;
    }

    async getTestcasesAutomatedEVM(limit = 30) {
        let sql = `select xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM as isBeneficiaryEVM, 0 as isSenderEVM, count(*) cnt from xcmtransfer join xcmasset on
        xcmtransfer.xcmInteriorKey = xcmasset.xcmInteriorKey, chain where
        xcmtransfer.chainID in (${paraTool.chainIDMoonriver}, ${paraTool.chainIDMoonbeam}) and
        sourceTS > unix_timestamp(date_sub(Now(), interval 30 day)) and
        chain.chainID = xcmtransfer.chainIDDest and xcmtransfer.chainID >= 0 and
        xcmtransfer.chainIDDest >= 0 and incomplete = 0 and length(xcmtransfer.xcmInteriorKey) > 4 and
        xcmtransfer.sectionMethod not in ('xTransfer:transfer' )
        group by xcmtransfer.chainID, xcmtransfer.chainIDDest, xcmasset.symbol, chain.isEVM
        having count(*) > 10 order by count(*) desc limit ${limit}`
        console.log(paraTool.removeNewLine(sql))
        let testcases = await this.poolREADONLY.query(sql);
        let autoTestcases = []
        for (const testcase of testcases) {
            if (testcase.chainID == paraTool.chainIDMoonriver || testcase.chainID == paraTool.chainIDMoonbeam) {
                testcase.isSenderEVM = 1
            }
            autoTestcases.push(testcase)
        }
        console.log("TESTCASES", autoTestcases.length);
        return autoTestcases;
    }

    async getTestcasesManualEVM() {
        return [{
                chainID: 22023,
                chainIDDest: 2,
                symbol: 'KSM',
                isBeneficiaryEVM: 0,
                isSenderEVM: 1,
                cnt: 100
            },
            {
                chainID: 22023, //0xb9f813ff
                chainIDDest: 22007,
                symbol: 'MOVR',
                isBeneficiaryEVM: 0,
                isSenderEVM: 1,
                cnt: 64
            },
            {
                chainID: 2004,
                chainIDDest: 2000,
                symbol: 'ACA',
                isBeneficiaryEVM: 0,
                isSenderEVM: 1,
                cnt: 64
            },
            {
                chainID: 2006,
                chainIDDest: 2004,
                symbol: 'GLMR',
                isBeneficiaryEVM: 1,
                isSenderEVM: 1,
                cnt: 64
            },
            {
                chainID: 2006,
                chainIDDest: 0,
                symbol: 'DOT',
                isBeneficiaryEVM: 0,
                isSenderEVM: 1,
                cnt: 64
            },
        ]
    }

    async getTestcasesManual() {
        return [{
                chainID: 2,
                chainIDDest: 21000,
                symbol: 'KSM',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 100
            },
            {
                chainID: 2006,
                chainIDDest: 2000,
                symbol: 'ACA',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 64
            },
            {
                chainID: 2006,
                chainIDDest: 2000,
                symbol: 'AUSD',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 47
            },
            {
                chainID: 2000,
                chainIDDest: 2006,
                symbol: 'AUSD',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 45
            },
            {
                chainID: 2,
                chainIDDest: 22024,
                symbol: 'KSM',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 20
            },
            {
                chainID: 0,
                chainIDDest: 1000,
                symbol: 'DOT',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 16
            },
            {
                chainID: 21000,
                chainIDDest: 22000,
                symbol: 'USDT',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 12
            },
            {
                chainID: 21000,
                chainIDDest: 22001,
                symbol: 'RMRK',
                isBeneficiaryEVM: 0,
                isSenderEVM: 0,
                cnt: 12
            }
        ]
    }

    if (chainID == -1) {
        let testcases = []
        switch (test) {
            case 'auto':
                testcases = await xcmtransfer.getTestcasesAutomated();
                break;
            case 'manuals':
                testcases = xcmtransfer.getTestcasesManual();
                break;
            case 'autoSubstrate':
                testcases = await xcmtransfer.getTestcasesAutomated();
                break;
            case 'manualSubstrate':
                testcases = xcmtransfer.getTestcasesManual();
                break;
            case 'autoEVM':
                testcases = await xcmtransfer.getTestcasesAutomatedEVM();
                break;
            case 'manualEVM':
                //TODO
                testcases = await xcmtransfer.getTestcasesManualEVM();
                break;
            default:
        }
        console.log(testcases)
        for (let i = 0; i < testcases.length; i++) {
            try {
                let t = testcases[i];
                chainID = t.chainID;
                chainIDDest = t.chainIDDest;
                symbol = t.symbol;
                amount = 1.0;
                let beneficiary = beneficiarySubstrate
                console.log(`******* CASE ${i}`);
                console.log(t);
                /*
                if (t.isEVM != undefined) {
                    beneficiary = beneficiaryEVM;
                }
                if (test == 'manualEVM'){
                    beneficiary = (t.isBeneficiaryEVM)? beneficiaryEVM : beneficiarySubstrate
                }
                */
                beneficiary = (t.isBeneficiaryEVM) ? beneficiaryEVM : beneficiarySubstrate
                let executionInput = {
                    execute: false,
                    origination: chainID,
                    destination: chainIDDest,
                    symbol: symbol,
                    amount: amount,
                    beneficiary: beneficiary,
                }
                let [sectionMethod, func, args, isEVMTx] = await xcmtransfer.xcmtransfer(chainID, chainIDDest, symbol, amount, beneficiary, t.isSenderEVM);
                let argsStr = JSON.stringify(args, null, 4)
                console.log(`xcmtransfer cli executionInput`, executionInput)
                console.log(`xcmtransfer cli transcribed ${sectionMethod} args`, argsStr);
                if (isEVMTx) {
                    var txStruct = args
                    var web3Api = func
                    var signedTx = await ethTool.signEvmTx(web3Api, txStruct, xcmtransfer.evmpair)
                    var decodedTx = ethTool.decodeRLPTransaction(signedTx.rawTransaction)
                    console.log(`signedTx`, signedTx)
                    console.log(`decodedTx`, decodedTx)
                }
            } catch (e) {
                console.log(`xcmtransfer cli error`, e.toString());
            }
        }
    }

    let test = 'auto' // ['autoSubstrate', 'manualSubstrate', 'autoEVM', 'manualEVM', 'auto', 'manuals']