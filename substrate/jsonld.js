function topic_to_jsonld(t, idx) {
    let topic = {};
    // Relates a log topic to its index in the log entry. The log topic index defines the order of the log topics of in log entry. xsd:integer
    topic["ethon:logTopicIndex"] = idx;
    // Relates a log topic to the 32 bytes of data it contains. xsd:hexBinary
    topic["ethon:logTopicData"] = t;
    return topic
}

function kv_to_jsonld(e, idx) {
    switch ( e.type ) {
    case "address":
	return account_to_jsonld(e.value, e.name)
	break;
    default: 
	return {
	    "@type": "evm:" + e.type,
	    "evm:name": e.name,
	    "evm:value": e.value
	}
    }
}

//ethon.consensys.net/class-logentry.html
function log_to_jsonld(l) {
    let log = {};
    log["@type"] = "ethon:LogEntry",
    log["ethon:hasLogTopic"] = l.topics.map( (t, idx) => {
	return topic_to_jsonld(t, idx);
    })
    log["ethon:logData"] = l.data
    log["ethon:loggedBy"] = {
	"@type": "evm:Account",
	"ethon:address": l.address,
	// TODO: balances, nonce, labels
    }
    // The signature of the function in the canonical form which is used to create the functionSelector. Example: `bar(uint32,bool)`
    log["ethon:canonicalSignature"] = l.signature
    log["evm:abi"] = `https://evm.colorfulnotion.com/${l.topics[0]}/` // TODO: add indexed disambiguator
    log["ethon:event"] = l.events.map( (e) => {
	return kv_to_jsonld(e);
    });
    return log
}

function valueUSD_to_jsonld(valueUSD) {
    if ( valueUSD ) {
	return {
	    "@type": "schema:PriceSpecification",
	    "schema:price": valueUSD,
	    "schema:priceCurrency": "USD"
	}
    }
}

// http://ethon.consensys.net/ERC20/class-ethonaccount.html
function account_to_jsonld(address, nm = null) {
    let account = {
	"@type": "ethon:Account", // Note: this could be ERC20Token or ERC721 or ...
	"ethon:address": address,
	// http://ethon.consensys.net/ERC20/prop-ethonerc20dataproperty.html
	//"ethon:name": t.name,
	//"ethon:symbol": t.symbol,
	//"ethon:decimals": t.decimals,
	//"ethon:totalSupply": t.totalSupply,
	//"ens:name": "TODO",
	//"evm:balance": "TODO",
	//"evm:nonce": "nonce",
    }
    if ( nm ) {
	account["evm:name"] = nm
    }
    return account;
}

// http://ethon.consensys.net/ERC20/class-tokentransfer.html
function transfers_to_jsonld(t) {
    let transfer = {
	"@type": "ethon:TokenTransfer",
	"ethon:from": account_to_jsonld(t.from),
	"ethon:to": account_to_jsonld(t.to),
	"ethon:value": t.value
    }
    if ( t.valueUSD ) {
	transfer["price"] = valueUSD_to_jsonld(t.valueUSD);
    }
    return t;
}

// http://ethon.consensys.net/class-tx.html
function tx_to_jsonld(t)
{
    let tx = {}
    tx["@context"] = {
	"schema": "https://schema.org/",
	"ethon": "https://ethon.consensys.net/",
	"evm": "https://polkaholic.io/types/",
    };

    if ( t.creates ) {
	tx["@type"] = "ethon:CreatesTx"; 
    } else if ( t.input && t.input.length >= 10 ) { 
	tx["@type"] = "ethon:CallTx"; 
    } else {  // native transfer or ... some kind of call data
	tx["@type"] = "ethon:ValueTx";
    }
    tx["evm:chain"] = {
	chainID: t.chainID,
	name: t.name
    }

    tx["ethon:txHash"] = t.transactionHash
    // :Account Relates a message to the account it originates from.
    tx["ethon:from"] = account_to_jsonld(t.from)
    // :Account Relates a message with the account it is sent to.
    tx["ethon:to"] = account_to_jsonld(t.to) 
    // 	A scalar value equal to the number of Wei to be transferred to the Message call's recipient. In the case of contract creation it is the initial balance of the contract account, paid by the sending account.
    tx["ethon:value"] = t.value;
    // Price in Wei to be paid per unit of gas for all computation costs incurred as a result of the execution of this transaction. This implies that contract messages resulting from the transaction pay the same gas price.
    tx["ethon:txGasPrice"] = t.gasPrice;
    // The total amount of gas that was used for processing this Tx and all contract messages resulting from it. It is the sum of all msgGasUsed by this Tx and resulting contract messages.
    tx["ethon:txIndex"] = t.transactionIndex; 
    tx["ethon:txNonce"] = t.nonce;

    //TODO: tx["ethon:txStatus"] = t.result ? true : false;
    
    tx["ethon:msgPayload"] = t.input;
    tx["ethon:msgGasLimit"] = t.gasLimit;
    tx["ethon:msgGasUsed"] = t.gasUsed;
    tx["ethon:txGasUsed"] = t.gasUsed;
    //tx[":txR"] = "";
    //tx[":txS"] = "";
    //tx[":txV"] = "";
    //tx[":msgError"] = "";
    //tx[":msgErrorString"] = "";

    tx["evm:blockHash"] = t.blockHash;
    tx["evm:blockNumber"] = t.blockNumber;
    tx["evm:transactionIndex"] = t.transactionIndex;
    tx["evm:txType"] = t.txType;
    tx["evm:accessList"] = t.accessList;
    tx["evm:txFee"] = t.fee;
    tx["evm:burnedFee"] = t.burnedFee;
    tx["evm:txnSaving"] = t.txnSaving;
    tx["evm:cumulativeGasUsed"] = t.cumulativeGasUsed;
    tx["evm:maxFeePerGas"] = t.maxFeePerGas;
    tx["evm:maxPriorityFeePerGas"] = t.maxPriorityFeePerGas
    tx["evm:baseFeePerGas"] = t.baseFeePerGas
    tx["evm:effectiveGasPrice"] = t.effectiveGasPrice
    if ( t.decodedInput ) {
	// A function can be identified by its byte signature. It is generated from the canonical signature. For example the Function `bar(uint32 x, bool y)` returns `(bool r)` has the canonical signature `bar(uint32,bool)`. The first 4 bytes of the Keccac 256 hash of this forms the byte signature of the function, in the example that would be `0xcdcd77c0`. xsd:hexBinary
	tx["ethon:byteSignature"] = t.decodedInput.methodID;
	tx["ethon:canonicalSignature"] = t.decodedInput.signature;
	tx["evm:abi"] = `https://evm.colorfulnotion.com/${t.decodedInput.methodID}/` // TODO: change to actual indexed disambiguator
	// The signature of the function in the canonical form which is used to create the functionSelector. Example: `bar(uint32,bool)`
	tx["evm:decodedInput"] = t.decodedInput.params.map((x, idx) => {
	    return kv_to_jsonld(x, idx);
	});
    }
    tx["evm:decodedLogs"] = t.decodedLogs.map((x, idx) => {
	return log_to_jsonld(x, idx)
    });
    if ( t.transfers ) {
	tx["evm:tokenTransfers"] = t.transfers.map((transfer) => {
	    return transfer_to_jsonld(transfer);
	});
    }
    if ( t.internalTransactions ) {
	// TODO
    }
    return tx;
}

// https://w3c-ccg.github.io/ethereum-eip712-signature-2021-spec/
// https://medium.com/@ashwin.yar/eip-712-structured-data-hashing-and-signing-explained-c8ad00874486

function topic_to_jsonld(t, idx) {
    let topic = {
	"@type": "ethon:LogTopic"
    };
    // Relates a log topic to its index in the log entry. The log topic index defines the order of the log topics of in log entry. xsd:integer
    topic["ethon:logTopicIndex"] = idx;
    // Relates a log topic to the 32 bytes of data it contains. xsd:hexBinary
    topic["ethon:logTopicData"] = t;
    return topic
}

function kv_to_jsonld(e, idx) {
    switch ( e.type ) {
    case "address":
	return account_to_jsonld(e.value, e.name)
	break;
    default: 
	return {
	    "@type": "evm:" + e.type,
	    "evm:name": e.name,
	    "evm:value": e.value
	}
    }
}

//ethon.consensys.net/class-logentry.html
function log_to_jsonld(l) {
    let log = {};
    log["@type"] = "ethon:LogEntry",
    log["ethon:hasLogTopic"] = l.topics.map( (t, idx) => {
	return topic_to_jsonld(t, idx);
    })
    log["ethon:logData"] = l.data
    log["ethon:loggedBy"] = {
	"@type": "evm:Account",
	"ethon:address": l.address,
	// TODO: balances, nonce, labels
    }
    // The signature of the function in the canonical form which is used to create the functionSelector. Example: `bar(uint32,bool)`
    log["ethon:canonicalSignature"] = l.signature
    log["evm:abi"] = `https://evm.colorfulnotion.com/${l.topics[0]}/` // TODO: add indexed disambiguator
    log["ethon:event"] = l.events.map( (e) => {
	return kv_to_jsonld(e);
    });
    return log
}

function valueUSD_to_jsonld(valueUSD) {
    if ( valueUSD ) {
	return {
	    "@type": "schema:PriceSpecification",
	    "schema:price": valueUSD,
	    "schema:priceCurrency": "USD"
	}
    }
    return null;
}

// http://ethon.consensys.net/ERC20/class-ethonaccount.html
function account_to_jsonld(address, nm = null) {
    let account = {
	"@type": "ethon:Account", // Note: this could be ERC20Token or ERC721 or ...
	"ethon:address": address,
	// http://ethon.consensys.net/ERC20/prop-ethonerc20dataproperty.html
	//"ethon:name": t.name,
	//"ethon:symbol": t.symbol,
	//"ethon:decimals": t.decimals,
	//"ethon:totalSupply": t.totalSupply,
	//"ens:name": "TODO",
	//"evm:balance": "TODO",
	//"evm:nonce": "nonce",
    }
    if ( nm ) {
	account["evm:name"] = nm
    }
    return account;
}

// http://ethon.consensys.net/ERC20/class-tokentransfer.html
function transfers_to_jsonld(t) {
    let transfer = {
	"@type": "ethon:TokenTransfer",
	"ethon:from": account_to_jsonld(t.from),
	"ethon:to": account_to_jsonld(t.to),
	"ethon:value": t.value
	// :changesAllowance
	// TODO: add monetaryamount from schema
    }
    if ( t.valueUSD ) {
	transfer["price"] = valueUSD_to_jsonld(t.valueUSD);
    }
    return t;
}


module.exports = {
    txToJSONLD: function(tx) {
	return tx_to_jsonld(tx);
    },
    accountToJSONLD: function(account, nm = null) {
	return account_to_jsonld(address, nm);
    },
}
