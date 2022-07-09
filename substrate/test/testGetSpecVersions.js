#!/usr/bin/env node
 // Usage:  updateEndpoints
const endpoints = require("../summary/endpoints");

var Manager = require("../manager");
var ParaTool = require("../paraTool");
async function main() {
    var manager = new Manager();
    let chainID = ParaTool.chainIDAcala;

    process.argv.forEach(function(val, index, array) {
        if (index == 2 && val.length > 0) {
            chainID = parseInt(val, 10);
        }
    });

    await manager.getSpecVersions(chainID);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });