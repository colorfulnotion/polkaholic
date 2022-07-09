const mysql = require("mysql2");
const paraTool = require("../paraTool");
const ChainParser = require("./chainparser");

module.exports = class BifrostParser extends ChainParser {
    constructor() {
        super()
    }
}