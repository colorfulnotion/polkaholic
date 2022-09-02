#!/usr/bin/env node
 // Usage:  search [query]
const Query = require("../query");

async function main() {
    var query = new Query();

    await query.init();
    let searches = [
        "aUSD",
        "dot",
        // XCM Message
        "0x78ace95311be8df94b6f675c62d7d1ac22b43e26262fb88549582aaf800ac152",
        // WASM code
        "0xe850a3e5834ddbbb23af57c82ab59f168066207f911d9a6587db85fffe6a4088",
        // WASM contract
        "0x64f77a75d762a2e60a741a915cc2d8864de0389d09f97b73ae8f661f17ede096",
        // symbol
        "DOT",
        "AUSD",
        "KUSD",
        // id
        "polkadot",
        // chainID
        "0",
        "22085",
        // chainID ambiguous (statemint+statemine)
        "1000",
        // currencyID
        "42259045809535163221576417993425387648",
        // xcContractAddress
        "0xffffffff1fcacbd218edc0eba20fc2308c778080",
        // erc20
        "0x0d171b55fc8d3bddf17e376fdb2d90485f900888",
        // moonbeam + astar xc cases
        "xcDOT",
        "xcACA"
    ];

    let ts = query.currentTS();
    for (let i = 0; i < searches.length; i++) {
        let search = searches[i];
        let results = await query.getSearchResults(search);
        console.log("SEARCH ", i, "q=", search, "results=", results);
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });