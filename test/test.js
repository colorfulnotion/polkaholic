//run with: npx mocha test/test.js

var isProduction = false
var endpoint = "https://api.polkaholic.io"
if (isProduction && process.env.POLKAHOLIC_API_URL != undefined) {
    endpoint = 'http://moonriver-internal.polkaholic.io:3001'
}
const request = require("supertest")(endpoint);
const {
    assert
} = require('chai')

function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

let attributeNameType = {
    "apiversion": "string",
    "borrowedUSD": "number",
    "borrowedAssetRate": "number",
    "target": "string",
    "pair": "string",
    "desired_amounts": "string",
    "minimum_amounts": "string",
    "amount_in": "ANY",
    "min_amount_out": "ANY",
    "collateralRatio": "number",
    "id": "ANY",
    "prefix": "number",
    "chainID": "number",
    "chainName": "string",
    "symbol": "string",
    "lastFinalizedTS": "number",
    "iconUrl": "string",
    "numExtrinsics": "number",
    "numSignedExtrinsics": "number",
    "numTransfers": "number",
    "numEvents": "number",
    "numHolders": "number",
    "relayChain": "string",
    "totalIssuance": "number",
    "numGenesisHolders": "number",
    "isEVM": "number",
    "blocksCovered": "number",
    "blocksFinalized": "number",
    "extrinsicHash": "string",
    "extrinsicID": "string",
    "chainIDDest": "number",
    "blockNumber": "number",
    "fromAddress": "string",
    "asset": "string",
    "sourceTS": "number",
    "amountSent": "number",
    "amountReceived": "number",
    "status": "string",
    "amountSentUSD": "number",
    "priceUSD": "number",
    "priceUSDCurrent": "number",
    "amountReceivedUSD": "number",
    "idDest": "string",
    "chainDestName": "string",
    "blockNumberDest": "number",
    "destTS": "number",
    "lastCrawlDT": "string",
    "lastFinalizedDT": "string",
    "numExtrinsics7d": "number",
    "numExtrinsics30d": "number",
    "numSignedExtrinsics7d": "number",
    "numSignedExtrinsics30d": "number",
    "numTransfers7d": "number",
    "numTransfers30d": "number",
    "numEvents7d": "number",
    "numEvents30d": "number",
    "numNewAccounts": "number",
    "numNewAccounts7d": "number",
    "numNewAccounts30d": "number",
    "numKilledAccounts": "number",
    "numKilledAccounts7d": "number",
    "numKilledAccounts30d": "number",
    "numTransactionsEVM": "number",
    "numTransactionsEVM7d": "number",
    "numTransactionsEVM30d": "number",
    "numReceiptsEVM": "number",
    "numReceiptsEVM7d": "number",
    "numReceiptsEVM30d": "number",
    "gasUsed": "string",
    "gasUsed7d": "string",
    "gasUsed30d": "string",
    "gasLimit": "string",
    "gasLimit7d": "string",
    "gasLimit30d": "string",
    "finalized": "number",
    "blockHash": "string",
    "blockDT": "string",
    "blockTS": "number",
    "specVersion": "number",
    "firstSeenTS": "number",
    "parentHash": "string",
    "number": "number",
    "stateRoot": "string",
    "extrinsicsRoot": "string",
    "signer": "string",
    "ed25519": "string",
    "immortalEra": "string",
    "nonce": "number",
    "tip": "number",
    "isSigned": "boolean",
    "fee": "number",
    "isImmortal": "number",
    "result": "number",
    "section": "string",
    "method": "string",
    "now": "number",
    "time": "string",
    "payload": "string",
    "validatorIndex": "number",
    "signature": "string",
    "paraId": "number",
    "relayParent": "string",
    "collator": "string",
    "persistedValidationDataHash": "string",
    "povHash": "string",
    "erasureRoot": "string",
    "paraHead": "string",
    "validationCodeHash": "string",
    "headData": "string",
    "processedDownwardMessages": "number",
    "hrmpWatermark": "number",
    "explicit": "string",
    "implicit": "string",
    "validatorIndices": "string",
    "eventID": "string",
    "docs": "string",
    "commitmentsHash": "string",
    "typeDef": "string",
    "name": "string",
    "weight": "number",
    "class": "string",
    "paysFee": "string",
    "data": "ANY",
    "period": "string",
    "phase": "string",
    "birth": "number",
    "death": "number",
    "value": "ANY",
    "dest": "string",
    "sr25519": "string",
    "index": "number",
    "relayChainSymbol": "string",
    "hash": "string",
    "evmBlock": "boolean",
    "ts": "number",
    "addr": "string",
    "chainSymbol": "string",
    "feeUSD": "number",
    "dataRaw": "number",
    "dataUSD": "number",
    "assetChain": "string",
    "assetType": "string",
    "assetName": "string",
    "decimals": "number",
    "token0": "string",
    "token0Symbol": "string",
    "token0Decimals": "number",
    "token1": "string",
    "token1Symbol": "string",
    "token1Decimals": "number",
    "isUSD": "number",
    "priceUSDpaths": "boolean",
    "free": "number",
    "route": "string",
    "s": "number",
    "freeUSD": "number",
    "rate": "number",
    "reserved": "number",
    "miscFrozen": "number",
    "feeFrozen": "number",
    "frozen": "number",
    "reservedUSD": "number",
    "miscFrozenUSD": "number",
    "feeFrozenUSD": "number",
    "frozenUSD": "number",
    "LiquidCrowdloan": "string",
    "collateral": "number",
    "debit": "number",
    "exchangeRate": "number",
    "Token": "string",
    "borrowed": "number",
    "collateralUSD": "number",
    "collateralAssetRate": "number",
    "exchangeRateCurrent": "number",
    "relaychain_account_id": "string",
    "parachain_account_id": "string",
    "leafHash": "string",
    "contribution": "string",
    "identity_proof": "string",
    "contribution_proof": "string",
    "asset_id": "ANY",
    "mint_amount": "number",
    "error": "string",
    "evm": "string",
    "contract_id": "string",
    "token": "string",
    "amount": "ANY",
    "parents": "number",
    "dest_weight": "number",
    "fungible": "number",
    "currency": "string",
    "redeemer": "string",
    "collateral_adjustment": "number",
    "debit_adjustment": "number",
    "collateralAdjustment": "string",
    "debitAdjustment": "string",
    "allow_fast_match": "boolean",
    "liquidCrowdloan": "number",
    "max_amount_a": "number",
    "max_amount_b": "number",
    "min_share_increment": "number",
    "stake_increment_share": "boolean",
    "currencyA": "string",
    "currencyB": "string",
    "maxAmountA": "string",
    "maxAmountB": "string",
    "supply_amount": "number",
    "min_target_amount": "number",
    "path": "string",
    "supplyAmount": "string",
    "minTargetAmount": "string",
    "dexShare": "string",
    "owner": "string",
    "currency_id_a": "string",
    "currency_id_b": "string",
    "amount_a": "number",
    "amount_b": "number",
    "amountA": "string",
    "amountB": "string",
    "address": "string",
    "callIndex": "string",
    "remark": "string",
    "parachain": "number",
    "fee_asset_item": "number",
    "complete": "number",
    "dest.": "string",
    "memo": "string",
    "remove_share": "number",
    "min_withdrawn_a": "number",
    "min_withdrawn_b": "number",
    "by_unstake": "boolean",
    "minWithdrawnA": "string",
    "minWithdrawnB": "string",
    "liquid_amount": "number",
    "additional_fee": "number",
    "liquidAmount": "string",
    "additionalFee": "string",
    "target_amount": "number",
    "max_supply_amount": "number",
    "targetAmount": "string",
    "maxSupplyAmount": "string",
    "from": "string",
    "to": "string",
    "genTS": "number",
    "source": "string",
    "action": "string",
    "account": "string",
    "paraID": "number",
    "amountUSD": "number",
    "era": "number",
    "module_name": "string",
    "module_function": "string",
    "module_section": "string",
    "module_method": "string",
    "rawAsset": "ANY",
    "tvl": "number", // added
    "totalFree": "number", // added
    "traceType": "string", // added
    "k": "string", // added
    "v": "string", // added
    "storage": "string", // added
    "multisigAddress": "string", // added
    "delegateOf_nickname": "string", // added
    "datasource": "string", // added
    "url": "string", // added
    "title": "string", // added
    "description": "string", // added
    "linktype": "string", // added
    "holder": "string", // added
    "Raw": "string", // added
    "WSEndpoint": "string", // added
    "WSEndpoint2": "string", // added
    "accountAddress": "string", // added
    "accountType": "string", // added
    "adjustedPrincipal": "number", // added
    "adjustedPrincipalUSD": "number", // added
    "adjustedVoucher": "number", // added
    "adjustedVoucherUSD": "number", // added
    "amount_in_value": "string", // added
    "asset_id_symbol": "string", // added
    "balance": "number", // added
    "balanceUSD": "number", // added
    "borrow_amount": "number", // added
    "borrow_amount_value": "string", // added
    "call_hash": "string", // added
    "collateral_adjustment_USD": "number", // added
    "collateral_adjustment_priceUSD": "number", // added
    "collateral_adjustment_priceUSDCurrent": "number", // added
    "collateral_adjustment_symbol": "string", // added
    "crawling": "number", // added
    "crawlingStatus": "string", // added
    "currency_id": "number", // added
    "debitUSD": "number", // added
    "debit_adjustment_USD": "number", // added
    "debit_adjustment_priceUSD": "number", // added
    "debit_adjustment_priceUSDCurrent": "number", // added
    "debit_adjustment_symbol": "string", // added
    "delay": "number", // added
    "delegateOf": "string", // added
    "destAddress": "string", // added
    "destAddress_display": "string", // added
    "destAddress_nickname": "string", // added
    "destAddress_parent": "string", // added
    "destAddress_subIdentityName": "string", // added
    "display": "string", // added
    "email": "string", // added
    "enable": "boolean", // added
    "err": "string", // added
    "force_proxy_type": "string", // added
    "fromAddress_display": "string", // added
    "fromAddress_nickname": "string", // added
    "fromAddress_parent": "string", // added
    "fromAddress_subIdentityName": "string", // added
    "height": "number", // added
    "idAddress": "string", // added
    "idAddress_nickname": "string", // added
    "idAddress_parent": "string", // added
    "idAddress_subIdentityName": "string", // added
    "incomplete": "number", // added
    "info_info": "string", // added
    "isCollateral": "number", // added
    "kusamaAddress": "string", // added
    "lastCrawlTS": "number", // added
    "legal": "string", // added
    "max_fee": "number", // added
    "max_weight": "number", // added
    "min_amount_out_value": "string", // added
    "mint_amount_value": "string", // added
    "msg": "string", // added
    "nativeAssetChain": "string", // added
    "nextPage": "string", // added
    "nickname": "string", // added
    "now_decorated": "string", // added
    "numTraces": "number", // added
    "numXCMTransferIncoming": "number", // added
    "numXCMTransferIncoming30d": "number", // added
    "numXCMTransferIncoming7d": "number", // added
    "numXCMTransferOutgoing": "number", // added
    "numXCMTransferOutgoing30d": "number", // added
    "numXCMTransferOutgoing7d": "number", // added
    "polkadotAddress": "string", // added
    "proxyType": "string", // added
    "raw": "string", // added
    "rawAmount": "number", // added
    "real": "string", // added
    "realAddress": "string", // added
    "realAddress_nickname": "string", // added
    "redeem_amount": "number", // added
    "reg_index": "number", // added
    "registrarIndex": "number", // added
    "remark_decorated": "string", // added
    "repay_amount": "number", // added
    "repay_amount_value": "string", // added
    "riot": "string", // added
    "route_symbols": "string", // added
    "signatorycnt": "number", // added
    "ss58Format": "number", // added
    "store_call": "boolean", // added
    "supplied": "number", // added
    "threshold": "number", // added
    "tipUSD": "number", // added
    "toAddress": "string", // added
    "toAddress_display": "string", // added
    "toAddress_nickname": "string", // added
    "toAddress_parent": "string", // added
    "toAddress_subIdentityName": "string", // added
    "transferType": "string", // added
    "transferable": "number", // added
    "transferableUSD": "number", // added
    "twitter": "string", // added
    "valXCMTransferIncomingUSD": "number", // added
    "valXCMTransferIncomingUSD30d": "number", // added
    "valXCMTransferIncomingUSD7d": "number", // added
    "valXCMTransferOutgoingUSD": "number", // added
    "valXCMTransferOutgoingUSD30d": "number", // added
    "valXCMTransferOutgoingUSD7d": "number", // added
    "valueTransfersUSD": "number", // added
    "valueTransfersUSD30d": "number", // added
    "valueTransfersUSD7d": "number", // added
    "value_USD": "number", // added
    "value_priceUSD": "number", // added
    "value_priceUSDCurrent": "number", // added
    "value_symbol": "string", // added
    "web": "string", // added
};

let numAttributes = 0;

function typecheck(obj, ctx) {
    // if this object is an array, loop over the elements of the array
    if (typeof obj == "object" && Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            typecheck(obj[i], ctx);
        }
        return;
    }

    for (let k in obj) {
        if (typeof obj[k] == "object" && obj[k] !== null) {
            typecheck(obj[k], ctx);
        } else {
            let typ = typeof obj[k];
            let v = obj[k];
            if (v == null) {} else if (attributeNameType[k] == undefined) {
                if (typeof k == "number" || typeof k == "string" && isNumeric(k)) {} else {
                    attributeNameType[k] = typ;
                    console.log(`"${k}": "${typ}", // added`)
                }
            } else if (attributeNameType[k] != typ) {
                // should match! but ignore for now
                if (attributeNameType[k] == "ANY") {} else {
                    console.log("typecheck FAILURE", "attribute", k, "observed=", typ, "expected=", attributeNameType[k], "value=", JSON.stringify(v), "context=", ctx);
                }
            }
        }
    }
}

describe("GET /chains", function() {
    it("returns all chains", async function() {
        const response = await request.get("/chains");
        assert(response.status == 200, "chains");
        assert(Array.isArray(response.body), "body");
        assert(response.body.length > 30, "30+ chains");
        let chain = response.body[0];
        assert(typeof chain.chainID == "number", "chainID");
        assert(typeof chain.chainName == "string", "symbol");
        assert(typeof chain.symbol == "string", "symbol");
        assert(chain.chainName.length > 0, "chainName set");
        typecheck(response.body, "/chains");
    });
});

describe("GET /xcmtransfers", function() {
    it("returns all chains", async function() {
        const response = await request.get("/xcmtransfers");
        assert(response.status == 200, "xcmtransfers");
        typecheck(response.body, "/xcmtransfers");
    });
});

describe("GET /chain/0", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/chain/0");
        assert(response.status == 200, "chains");
        assert(typeof response.body === "object", "object");
        assert(typeof response.body.chain === "object", "object");
        assert(Array.isArray(response.body.blocks), "Array");
        assert(response.body.blocks.length >= 50, "50+ blocks");

        // check chain object
        let chain = response.body.chain;
        assert(typeof chain.chainID == "number", "chainID");
        assert(typeof chain.chainName == "string", "chainName string");
        assert(chain.chainName == "Polkadot", "chainName == polkadot");
        assert(typeof chain.symbol == "string", "symbol is string");
        //assert(chain.symbol == "DOT", "symbol is DOT");

        // check a block in blocks array
        let block = response.body.blocks[0];
        assert(typeof block.blockNumber == "number", "blockNumber is number");
        assert(Array.isArray(block.blockHash), "blockHash is array");
        typecheck(response.body, "/chain/0");
    });
});

describe("GET /chain/polkadot", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/chain/polkadot");
        assert(response.status == 200, "chain");
        assert(typeof response.body === "object", "object");
        assert(typeof response.body.chain === "object", "object");
        typecheck(response.body, "/chain/polkadot");
    });
});

describe("GET /chain/boguschain", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/chain/boguschain");
        assert(response.status == 400, "bogus chain id");
    });
});

describe("GET /chain/666", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/chain/666");
        assert(response.status == 400, "bogus chainID");
    });
});


describe("GET /chain/assets/polkadot", function() {
    it("returns specific chain assets", async function() {
        const response = await request.get("/chain/assets/polkadot");
        assert(response.status == 200, "chain");
        assert(Array.isArray(response.body), "array");
        typecheck(response.body, "/chain/assets/polkadot");
    });
});

describe("GET /chain/assets/boguschain", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/chain/boguschain");
        assert(response.status == 400, "bogus chain id");
    });
});

describe("GET /chain/assets/666", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/chain/666");
        assert(response.status == 400, "bogus chainID");
    });
});

// TODO: /hash/blockhash/:blockHash

describe("GET /specversions/polkadot", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/specversions/polkadot");
        assert(response.status == 200, "specversions");
        //      assert(typeof response.body === "object", "object");
        assert(Array.isArray(response.body), "array elems");
        typecheck(response.body, "/specversions/polkadot");
    });
});

describe("GET /specversions/666", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/specversions/666");
        assert(response.status == 400, "bogus chainID");
    });
});

describe("GET /specversions/boguschain", function() {
    it("returns specific chain", async function() {
        const response = await request.get("/specversions/boguschain");
        assert(response.status == 400, "bogus chainID");
    });
});

describe("GET /block/0/10027468", function() {
    it("returns specific block", async function() {
        const response = await request.get("/block/0/10027468");
        assert(response.status == 200, "block");
        assert(typeof response.body === "object", "object");
        assert(Array.isArray(response.body.extrinsics), "Array");
        assert(response.body.extrinsics.length == 4, "4 Extrinsics");
        typecheck(response.body, "/block/0/10027468");
        //assert(response.body.events.length == 0, "0 Events at the top block");  // ??

        // check extrinsics[2]
        let e2 = response.body.extrinsics[2];
        assert(typeof e2.signer == "string", "signer");
        assert(e2.signer == "12hMLjjJPPpNgchiE8K3UGpSpWqV6PqSd6hcbuW5JUmuyrsF", "signer");

        assert(typeof e2.extrinsicHash == "string", "extrinsicHash");
        assert(e2.extrinsicID == "10027468-2");
        assert(e2.extrinsicHash == "0x412a0f402bc9277c59923c26df2fd4a3c0ae101329f8c656e7120e9f2c192c7c", "extrinsicHash");

        assert(e2.section == "balances", "balances cap check");
        assert(e2.method == "transferKeepAlive", "transferKeepAlive cap check");

        // check extrinsics[3]
        let e3 = response.body.extrinsics[3];
        assert(typeof e3.signer == "string", "signer");
        assert(e3.signer == "1RYqAPohUzZxkgGrw6S5Zd3yNcr7M4A6e992qJUQ2hQqLkv", "signer");

        assert(typeof e3.extrinsicHash == "string", "extrinsicHash");
        assert(e3.extrinsicID == "10027468-3");
        assert(e3.extrinsicHash == "0x2128adcf56bd3376b23cdec8d55f730d3b51d633eb3d822584535a4a38e4b80b", "extrinsicHash");

        assert(e3.section == "crowdloan", "crowdloan cap check");
        assert(e3.method == "contribute", "contribute cap check");
    });
});

describe("GET /block/polkadot/10092680", function() {
    it("returns specific block", async function() {
        const response = await request.get("/block/polkadot/10027468");
        assert(response.status == 200, "block");
        typecheck(response.body, "/block/0/10092680");
        assert(typeof response.body === "object", "object");
        assert(Array.isArray(response.body.extrinsics), "Array");
        assert(response.body.extrinsics.length == 4, "4 Extrinsics");
        //assert(response.body.events.length == 0, "0 Events at the top block");  // ??
    });
});

describe("GET /trace/polkadot/10092680", function() {
    it("returns specific block", async function() {
        const response = await request.get("/trace/polkadot/10027468");
        assert(response.status == 200, "trace");
        typecheck(response.body, "/trace/0/10092680");
        assert(typeof response.body === "object", "object");
    });
});

describe("GET /trace/boguschain/10092680", function() {
    it("returns specific block", async function() {
        const response = await request.get("/trace/boguschain/10027468");
        assert(response.status == 400, "trace");
        typecheck(response.body, "/trace/0/10092680");
        assert(typeof response.body === "object", "object");
    });
});

describe("GET /trace/666/10092680", function() {
    it("returns specific trace", async function() {
        const response = await request.get("/trace/boguschain/10027468");
        assert(response.status == 400, "trace");
        assert(typeof response.body === "object", "object");
    });
});

describe("GET /trace/polkadot/99999999999", function() {
    it("returns specific trace", async function() {
        const response = await request.get("/trace/polkadot/99999999999");
        assert(response.status == 400, "trace");
        assert(typeof response.body === "object", "object");
    });
});

describe("GET /block/boguschain/10092680", function() {
    it("returns error when specifying bogus chain id ", async function() {
        const response = await request.get("/block/boguschain/1009260");
        assert(response.status == 400, "bogus chain");
    });
});

describe("GET /block/666/10092680", function() {
    it("returns error when specifying bogus chainID ", async function() {
        const response = await request.get("/block/600/10092680");
        assert(response.status == 400, "bogus chainID");
    });
});

describe("GET /block/polkadot/9999999999", function() {
    it("returns error when specifying bogus blockNumber", async function() {
        const response = await request.get("/block/polkadot/9999999999");
        assert(response.status == 400, "bogus blockNumber");
    });
});

describe("GET /tx/0x26ad18d443ad9afc5e967ceb354e9367e1432f9a8078962d702219df45369a59", function() {
    it("returns specific tx", async function() {
        const response = await request.get("/tx/0x26ad18d443ad9afc5e967ceb354e9367e1432f9a8078962d702219df45369a59");
        assert(response.status == 200, "tx status");
        assert(typeof response.body === "object", "object");
        typecheck(response.body, "/tx/0x26ad..");

        let tx = response.body;
        assert(typeof tx.extrinsicID == "string", "extrinsicID is string");
        assert(tx.extrinsicID == "10092680-2", "extrinsicID check");
        assert(typeof tx.blockNumber == "number", "blockNumber is number");
        // FAIL: assert(tx.fromAddress == "string", "fromAddress check");
        assert(tx.section == "balances", "balances cap check");
        assert(tx.method == "transfer", "transfer cap check");
    });
});

describe("GET invalid / missing tx", function() {
    it("returns missing tx", async function() {
        const response = await request.get("/tx/0x1111111111ad9afc5e967ceb354e9367e1432f9a8078962d702219df45369a59");
        assert(response.status == 400, "tx status");
        assert(typeof response.body.error === "string", "error string");
        assert(response.body.error.includes("Transaction not found"), "error should be Transaction not found");
    });

    it("returns invalid tx", async function() {
        const response = await request.get("/tx/0x26ad");
        assert(response.status == 400, "tx status");
        assert(response.body.error.includes("Invalid Extrinsic Hash"), "error should be Invalid Extrinsic Hash");
    });

});

// account group checks for EXISTING/NON-EXISTENT/INVALID account
describe("GET /account", function() {
    const addressesMap = {
        "EXISTING": "0x2534454d30f8a028e42654d6b535e0651d1d026ddf115cef59ae1dd71bae074e";
        "NON-EXISTENT": "0xaaaaaaaaa5f7094e8fb7398ca7c1af73310015b25b22e144ddbe5dc175cdbbbb",
        "INVALID": "0xaaaa"
    }
    const accountGroups = ["xcmtransfers", // "feed", "offers",
        "related", "extrinsics", "unfinalized", "transfers", "crowdloans", "rewards", "realtime", "ss58h160", "balances", "history"
    ];

    this.timeout(15000);
    for (const condition of Object.keys(addressesMap)) {
        let address = addressesMap[condition];
        for (const accountGroup of accountGroups) {
            describe(`GET /account/${accountGroup}/${address}`, function() {
                it(`returns ${condition} account ${accountGroup}`, async function() {
                    let response = await request.get(`/account/${accountGroup}/${address}`);
                    let expectedError = null;
                    if (condition == "NON-EXISTENT") {
                        expectedError = "Account not found";
                    } else if (condition == "INVALID") {
                        expectedError = "Invalid address";
                    }
                    if (expectedError != null) {
                        console.log(`${condition} ${accountGroup}`, response.body, response.status)
                        assert(response.status == 400, `account ${accountGroup} for ${condition} account should be 400`);
                        assert(response.body.error.includes(expectedError), `${accountGroup} error should be: ${expectedError}`);
                    } else {
                        assert(response.status == 200, "account ${accountGroup} for ${condition} account should be 200");
                        assert((Array.isArray(response.body) && response.body.length >= 0) || (Array.isArray(response.body.data) && response.body.data.length >= 0), "length");
                        typecheck(response.body, "/account/${accountGroup}");
                    }
                });
            });
        }
    }
});



// account crowdloans, transfers pagination (should add more for additional accounts group
describe("GET /account", function() {
    const address = "0x81f06d1ca5f7094e8fb7398ca7c1af73310015b25b22e144ddbe5dc175cd26cb";
    let nextPage = null;

    this.timeout(15000);
    // transfers -- this has nextpage ... many times so we just do it 2x
    describe("GET /account/transfers/<address>", function() {
        it("returns specific account transfers", async function() {
            const response = await request.get(`/account/transfers/${address}`);
            assert(response.status == 200, "account transfers");
            assert(response.body.data.length == 1000, "length");
            assert(typeof response.body.nextPage == "string", "nextPage");
            nextPage = response.body.nextPage;
        });
    });

    describe("GET /account/transfers/<address> PAGE 2", function() {
        it("returns specific account transfers", async function() {
            const response = await request.get(nextPage);
            assert(response.status == 200, "account transfers PAGE 2");
            assert(response.body.data.length == 1000);
            assert(typeof response.body.nextPage == "string", "nextPage");
            nextPage = response.body.nextPage;
        });
    });

    describe("GET /account/crowdloans/<address>", function() {
        it("returns specific account crowdloans", async function() {
            const response = await request.get(`/account/crowdloans/${address}`);
            assert(response.status == 200, "account crowdloans");
            assert(response.body.data.length == 1000, "length");
            assert(typeof response.body.nextPage == "string", "nextPage");
            nextPage = response.body.nextPage;
        });
    });

    describe("GET /account/crowdloans/<address> PAGE 2", function() {
        it("returns specific account crowdloans", async function() {
            const response = await request.get(nextPage);
            assert(response.status == 200, "account crowdloans PAGE 2");
            assert(response.body.data.length > 0, "next page not exist");
            nextPage = response.body.nextPage;
        });
    });
});

// asset group checks for EXISTING/NON-EXISTENT/INVALID assetChain
describe("GET /asset/{assetGroup}/{assetChain}", function() {
    const assetChainMap = {
        "EXISTING": `{"Token":"DOT"}~0`,
        "NON-EXISTENT": `{"Token":"BOGUS"}~999`,
        "INVALID": `{`
    }
    const assetGroups = ["pricefeed", "holders", "related"];
    this.timeout(15000);
    for (const condition of Object.keys(assetChainMap)) {
        let assetChain = assetChainMap[condition];
        for (const assetGroup of assetGroups) {
            describe(`GET /asset/${assetGroup}/${encodeURIComponent(assetChain)}`, function() {
                it(`returns ${condition} assetChain ${assetChain}`, async function() {
                    let response = await request.get(`/asset/${assetGroup}/${encodeURIComponent(assetChain)}`);
                    let expectedError = null;
                    if (condition == "NON-EXISTENT") {
                        expectedError = "Invalid asset";
                    } else if (condition == "INVALID") {
                        expectedError = "Invalid asset";
                    }
                    if (expectedError != null) {
                        console.log(`${condition} ${assetGroup}`, response.body, response.status)
                        assert(response.status == 400, `asset ${assetGroup} for ${condition} asset should be 400`);
                        assert(response.body.error.includes(expectedError), `${assetGroup} error should be: ${expectedError}`);
                    } else {
                        assert(response.status == 200, `asset ${assetGroup} for ${condition} asset should be 200`);
                        assert((Array.isArray(response.body) && response.body.length >= 0) || (Array.isArray(response.body.data) && response.body.data.length >= 0), "length");
                        typecheck(response.body, "/asset/${assetGroup}");
                    }
                });
            });
        }
    }
})


/*
{
    "hash": "0x4a42752a0b54b859961c1858eb0c591a579ca7bc864b79b37adee3dcb082b391",
    "hashType": "substrateBlockHash",
    "status": "finalized",
    "chainID": 2004,
    "blockNumber": 808508
}
*/
describe("GET /hash/{hash}", function() {
    const searchMap = {
        //substrateBlockHash/evmBlockHash/extrinsicHash/transactionHash
        "EXISTING": ["0x4a42752a0b54b859961c1858eb0c591a579ca7bc864b79b37adee3dcb082b391", "0xd62500cbc13a6d68aa3ad9131b54951a11bed3bc19ba8aebfda933fca6f443a2", "0x4a9d94960923f796eb1100fe7b8587ae6e30d2e0b1295900605c8e38156ac154", "0x972b7b456ddec41fcc437702f72e163bf0e8d916da2487b4252c5059e72a1343"],
        "NON-EXISTENT": ["999999999", "0xaaaaaaaaa5f7094e8fb7398ca7c1af73310015b25b22e144ddbe5dc175cdbbbb", "BOGUS", "0x1111111111ad9afc5e967ceb354e9367e1432f9a8078962d702219df45369a59"],
        "INVALID": [`{`, "?"]
    }
    let foundType = ['substrateBlockHash', 'evmBlockHash', 'extrinsicHash', 'transactionHash']
    this.timeout(15000);
    for (const condition of Object.keys(searchMap)) {
        let searches = searchMap[condition];
        let i = 0
        for (const hash of searches) {
            let expectedOutcome = null;
            let expectedFoundType = 'Not Found'
            if (condition == "EXISTING") {
                expectedOutcome = "found";
                expectedFoundType = foundType[i]
                i++
            } else if (condition == "NON-EXISTENT") {
                expectedOutcome = "notFound";
            } else if (condition == "INVALID") {
                expectedOutcome = "Invalid search";
            }
            describe(`GET /hash/${hash}`, function() {
                it(`returns ${condition} ${hash} ${expectedFoundType}`, async function() {
                    let response = await request.get(`/hash/${hash}`);

                    if (expectedOutcome == "Invalid search") {
                        //assert(response.status == 400, `search ${hash} for ${condition} search should be 400`);
                        //assert(response.body.error.includes(expectedOutcome), `${search} error should be: ${expectedError}`);
                    } else if (expectedOutcome == "Not found") {
                        assert(response.status == 200, `search ${hash} for ${condition} search should be 200`);
                        assert(typeof response.body.hashType == "string", 'hashType should be string');
                        assert(response.body.hashType == expectedFoundType, `foundType should be ${expectedFoundType}`);
                        assert(response.body.chainID == null, 'expected null');
                        assert(response.body.blockNumber == null, 'expected null');
                        typecheck(response.body, `/hash/${hash}`);
                    } else if (expectedOutcome == "found") {
                        assert(response.status == 200, `search ${hash} for ${condition} search should be 200`);
                        assert(typeof response.body.hashType == "string", 'hashType should be string');
                        assert(response.body.hashType == expectedFoundType, `foundType should be ${expectedFoundType}`);
                        assert(typeof response.body.chainID == "number", `chainID is number`);
                        assert(typeof response.body.blockNumber == "number", `blockNumber is number`);
                        typecheck(response.body, "/hash/${hash}");
                    }
                });
            });
        }
    }
})

// TODO: /search/{extrinsics, transfers, events, xcmtransfers}'
// curl -X POST -H "Content-Type: application/json" -d '{"chainID":"polkadot", "startDate": "2022-05-01", "endDate": "2022-05-14", "section": "balances", "method": "transfer"}'  http://karura.polkaholic.io:3001/search/extrinsics/polkadot


describe("POST /search/{table}", function() {
    const searchMap = {
        //substrateBlockHash/evmBlockHash/extrinsicHash/transactionHash
        "EXISTING": ["extrinsics", "evmtxs", "transfers", "events", "xcmtransfers"],
        "NON-EXISTENT": ["chain"],
        //"INVALID": [`{`, "?"]
    }
    let query = ['{"chainID":"moonbeam", "startDate": "2022-05-01", "endDate": "2022-05-14"}']
    this.timeout(15000);
    for (const condition of Object.keys(searchMap)) {
        let searches = searchMap[condition];
        let i = 0
        for (const table of searches) {
            describe(`POST /search/${table}`, function() {
                let expectedOutcome = null;
                if (condition == "EXISTING") {
                    expectedOutcome = "found";
                    i++
                } else if (condition == "NON-EXISTENT") {
                    expectedOutcome = "notFound";
                } else if (condition == "INVALID") {
                    expectedOutcome = "InvalidSearch";
                }
                it(`returns ${condition} ${table}`, async function() {
                    let response;
                    if (expectedOutcome == "found") {
                        response = await request.post(`/search/${table}`)
                            .send(JSON.parse(query[0]))
                            .expect('Content-Type', /json/)
                            .expect(200)
                    } else {
                        response = await request.post(`/search/${table}`)
                            .send(JSON.parse(query[0]))
                    }

                    if (expectedOutcome == "Invalid search") {
                        //assert(response.status == 400, `search ${hash} for ${condition} search should be 400`);
                        //assert(response.body.error.includes(expectedOutcome), `${search} error should be: ${expectedError}`);
                    } else if (expectedOutcome == "notFound") {
                        assert(response.status == 404, `search ${table} for ${condition} search should be 404`);
                    } else if (expectedOutcome == "found") {
                        assert(response.status == 200, `search ${table} for ${condition} search should be 200`);
                        assert((Array.isArray(response.body) && response.body.length >= 0) || (Array.isArray(response.body.data) && response.body.data.length >= 0), "length");
                        typecheck(response.body, "/search/${table}");
                    }
                });
            });
        }
    }
})