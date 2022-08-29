// Copyright 2022 Colorful Notion, Inc.
// This file is part of Polkaholic.

// Polkaholic is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Polkaholic is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Polkaholic.  If not, see <http://www.gnu.org/licenses/>.

const Web3 = require("web3");
const web3 = new Web3();
const util = require('util');
const rlp = require('rlp')
const paraTool = require("./paraTool");
const {
    CodePromise,
    ContractPromise
} = require('@polkadot/api-contract');

const exec = util.promisify(require("child_process").exec);

module.exports = {
    //TODO
};