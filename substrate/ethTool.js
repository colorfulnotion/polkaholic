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
    Transaction
} = require('@ethereumjs/tx')

const abiDecoder = require('abi-decoder');
const exec = util.promisify(require("child_process").exec);

function shexdec(inp) {
    return parseInt(inp.replace("0x", ""), 16);
}

function dechex(number) {
    return parseInt(number, 10).toString(16);
}

function dechexToInt(number) {
    if ((number.length > 2) && number.substring(0, 2) == "0x") {
        return parseInt(number)
    } else {
        return parseInt(number);
    }
}

function firstCharUpperCase(inp) {
    return inp.substr(0, 1).toUpperCase() + inp.substr(1)
}

function execPromise(command) {
    return new Promise(function(resolve, reject) {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stdout.trim());
        });
    });
}

//ipfs://bafkreid5dy3f75af7snusqe3nopbi5tryiqxbs7uxwv5ypcckaomez4opi
function convert_ifps_link(ipfsURL) {
    let gatewayID = 0
    let gateway;
    switch (gatewayID) {
        case 1:
            gateway = 'https://gateway.pinata.cloud'
            break;
        default:
            gateway = 'https://ipfs.io'
    }

    if (ipfsURL.length >= 8 && ipfsURL.substr(0, 7) == 'ipfs://') {
        return `${gateway}/ipfs/${ipfsURL.substr(7)}`
    }
    return ipfsURL
}

async function crawl_link(url) {
    if (url.length >= 53 && url.substr(0, 7) == 'ipfs://') {
        url = `https://ipfs.io/ipfs/${url.substr(7)}`
    }
    const cmd = `curl --max-time 60 --connect-timeout 30 '${url}'`
    let result
    try {
        //console.log("CRAWLING " + bn)
        //console.log(cmd)
        result = await execPromise(cmd)
        let r = JSON.parse(result)
        return r
    } catch (e) {
        console.error(`call failed ${url} [${result}]`, e.toString())
        return false;
    }
}

//var routerContract = initContract(web3Api, routerABI, '0x7a3909C7996EFE42d425cD932fc44E3840fCAB71') // 0x4c660218a62367a7cfe4cd47f654a503ada1bb4a2adb0de1678aabc0ced320a1

var uniswapV2ReservesABI = JSON.parse('[{"constant":true,"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"},{"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"}]')
var zenLinkReservesABI = JSON.parse('[{"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"}],"stateMutability":"view","type":"function"}]')

var routerABI = JSON.parse('[{"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"WETH","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"amountADesired","type":"uint256"},{"internalType":"uint256","name":"amountBDesired","type":"uint256"},{"internalType":"uint256","name":"amountAMin","type":"uint256"},{"internalType":"uint256","name":"amountBMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"addLiquidity","outputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"amountB","type":"uint256"},{"internalType":"uint256","name":"liquidity","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountTokenDesired","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"addLiquidityETH","outputs":[{"internalType":"uint256","name":"amountToken","type":"uint256"},{"internalType":"uint256","name":"amountETH","type":"uint256"},{"internalType":"uint256","name":"liquidity","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"reserveIn","type":"uint256"},{"internalType":"uint256","name":"reserveOut","type":"uint256"}],"name":"getAmountIn","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"reserveIn","type":"uint256"},{"internalType":"uint256","name":"reserveOut","type":"uint256"}],"name":"getAmountOut","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsIn","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"reserveA","type":"uint256"},{"internalType":"uint256","name":"reserveB","type":"uint256"}],"name":"quote","outputs":[{"internalType":"uint256","name":"amountB","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountAMin","type":"uint256"},{"internalType":"uint256","name":"amountBMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"removeLiquidity","outputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"amountB","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"removeLiquidityETH","outputs":[{"internalType":"uint256","name":"amountToken","type":"uint256"},{"internalType":"uint256","name":"amountETH","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"bool","name":"approveMax","type":"bool"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"removeLiquidityETHWithPermit","outputs":[{"internalType":"uint256","name":"amountToken","type":"uint256"},{"internalType":"uint256","name":"amountETH","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountAMin","type":"uint256"},{"internalType":"uint256","name":"amountBMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"bool","name":"approveMax","type":"bool"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"removeLiquidityWithPermit","outputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"amountB","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapETHForExactTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactETHForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForETH","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMax","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapTokensForExactETH","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMax","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapTokensForExactTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]')

var swapABI = JSON.parse('[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount0Out","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1Out","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Swap","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint112","name":"reserve0","type":"uint112"},{"indexed":false,"internalType":"uint112","name":"reserve1","type":"uint112"}],"name":"Sync","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MINIMUM_LIQUIDITY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"PERMIT_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"},{"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_token0","type":"address"},{"internalType":"address","name":"_token1","type":"address"}],"name":"initialize","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"kLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"mint","outputs":[{"internalType":"uint256","name":"liquidity","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"nonces","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"price0CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"price1CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"skim","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount0Out","type":"uint256"},{"internalType":"uint256","name":"amount1Out","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"sync","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]')


//var lpcontract = initContract(web3Api, swapABI, '0xa0799832fb2b9f18acf44b92fbbedcfd6442dd5e') // 0x4c660218a62367a7cfe4cd47f654a503ada1bb4a2adb0de1678aabc0ced320a1
//var nonlpcontract = initContract(web3Api, swapABI, '0xacc15dc74880c9944775448304b263d191c6077f') // 0x4c660218a62367a7cfe4cd47f654a503ada1bb4a2adb0de1678aabc0ced320a1


var erc721ViewABI = JSON.parse('[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}, {"inputs":[],"name":"baseURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}]')

const erc20ABI = JSON.parse('[{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]')

const erc721ABI = JSON.parse('[{"constant":true,"inputs":[{"name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":true,"name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"approved","type":"address"},{"indexed":true,"name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"operator","type":"address"},{"indexed":false,"name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"constant":true,"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"tokenId","type":"uint256"}],"name":"transfer","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"tokenId","type":"uint256"},{"name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]')

const erc1155ABI = JSON.parse('[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"values","type":"uint256[]"}],"name":"TransferBatch","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"TransferSingle","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"value","type":"string"},{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"}],"name":"URI","type":"event"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"accounts","type":"address[]"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"}],"name":"balanceOfBatch","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeBatchTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"uri","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}]')

function initContract(web3Api, contractABI, contractAddress) {
    try {
        let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
        let contract = new web3Api.eth.Contract(contractABI, checkSumContractAddr);
        return contract
    } catch (err) {
        console.log(`initContract ${contractAddress}`, err)
    }
    return false
}

async function getERC721NFTMeta(web3Api, contractAddress, tokenID, fetchMeta = false, bn = 'latest') {
    //tokenID space (uint256) is too large. must convert to hexString
    let tokenIDHex = web3.utils.toHex(tokenID);
    let tokenIDBN = web3.utils.toBN(tokenIDHex).toString();
    let ERC721MetadataID = '0x5b5e139f'
    let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
    let erc721ViewContract = initContract(web3Api, erc721ViewABI, checkSumContractAddr)
    let isMetadata = false
    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }

    var statusesPromise = Promise.allSettled([
        erc721ViewContract.methods.supportsInterface(ERC721MetadataID).call({}, bn),
        erc721ViewContract.methods.tokenURI(tokenIDHex).call({}, bn),
        erc721ViewContract.methods.ownerOf(tokenIDHex).call({}, bn)
    ])
    var [isERC721MetadataTest, tokenURI, ownerOf] = await statusesPromise;
    if (isERC721MetadataTest.status == 'fulfilled') {
        isMetadata = isERC721MetadataTest.value
    }
    if (isMetadata) {
        let nftURI = (tokenURI.status == 'fulfilled') ? tokenURI.value : 'nonexistent token'
        let tokenOwner = (ownerOf.status == 'fulfilled') ? ownerOf.value : 'nonexistent token'
        let nftTokenMetadata = {
            blockNumber: bn,
            tokenAddress: checkSumContractAddr,
            tokenType: 'ERC721Token',
            isMetadataSupported: isMetadata,
            tokenID: tokenIDBN,
        }
        if (tokenOwner == 'nonexistent token') {
            nftTokenMetadata.error = 'tokenID not exist'
            return false
        } else {
            nftTokenMetadata.tokenURI = nftURI
            if (nftURI != 'nonexistent token' && fetchMeta) {
                let fetchedMeta = await crawl_link(nftURI)
                if (fetchedMeta) {
                    nftTokenMetadata.metadata = fetchedMeta
                }
            }
            nftTokenMetadata.owner = tokenOwner
        }
        return nftTokenMetadata
    }
    return false
}

//check if a contract is erc721 by checking interfaceId
async function getERC721ContractInfo(web3Api, contractAddress, bn = 'latest') {
    let ERC721ID = '0x80ac58cd'
    let ERC721MetadataID = '0x5b5e139f' // optional function available: (name, symbol, tokenURI, baseURI)
    let ERC721EnumerableID = '0x780e9d63' // optional function available: (totalSupply, tokenByIndex,tokenOfOwnerByIndex)

    let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
    let erc721ViewContract = initContract(web3Api, erc721ViewABI, checkSumContractAddr)
    let isERC721 = false
    let isMetadata = false
    let isEnumerable = false
    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }

    var statusesPromise = Promise.allSettled([
        erc721ViewContract.methods.supportsInterface(ERC721ID).call({}, bn),
        erc721ViewContract.methods.supportsInterface(ERC721MetadataID).call({}, bn),
        erc721ViewContract.methods.supportsInterface(ERC721EnumerableID).call({}, bn),
        erc721ViewContract.methods.name().call({}, bn),
        erc721ViewContract.methods.symbol().call({}, bn),
        erc721ViewContract.methods.baseURI().call({}, bn),
        erc721ViewContract.methods.totalSupply().call({}, bn)
    ])

    var [isERC721Test, isERC721MetadataTest, isERC721EnumerableIDTest, name, symbol, baseURI, totalSupply] = await statusesPromise;
    if (isERC721Test.status == 'fulfilled') {
        isERC721 = isERC721Test.value
    }

    let metadata = {}
    if (isERC721MetadataTest.status == 'fulfilled') {
        isMetadata = isERC721MetadataTest.value
        if (isMetadata) {
            //name, symbol, tokenURI is available
            metadata.name = name.value
            metadata.symbol = symbol.value
            metadata.baseURI = (baseURI.value != undefined) ? baseURI.value : null
        }
    }

    let tokenTotalSupply = -1
    if (isERC721EnumerableIDTest.status == 'fulfilled') {
        isEnumerable = isERC721EnumerableIDTest.value
        if (isEnumerable) {
            tokenTotalSupply = totalSupply.value
        }
    }

    if (isERC721) {
        let tokenInfo = {
            blockNumber: bn,
            tokenAddress: checkSumContractAddr,
            tokenType: 'ERC721',
            isMetadataSupported: isMetadata,
            isEnumerable: isEnumerable,
            metadata: metadata,
            totalSupply: tokenTotalSupply,
            numHolders: 0
        }
        return tokenInfo
    }
    return false
}

async function getTokenTotalSupply(web3Api, contractAddress, bn = 'latest', decimals = false) {
    let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
    let erc20Contract = initContract(web3Api, erc20ABI, checkSumContractAddr)
    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }
    try {
        var totalSupply;
        if (decimals !== false) {
            console.log("HI");
            totalSupply = await Promise.all([
                erc20Contract.methods.totalSupply().call({}, bn)
            ]);
        } else {
            [decimals, totalSupply] = await Promise.all([
                erc20Contract.methods.decimals().call({}, bn),
                erc20Contract.methods.totalSupply().call({}, bn)
            ]);
        }
        let tokenTotalSupply = totalSupply / 10 ** decimals
        return [tokenTotalSupply, bn]
    } catch (err) {
        //console.log(`getTokenTotalSupply ERROR ${checkSumContractAddr}`, err)
        return [false, bn]
    }
}


//return symbol, name, deciaml, totalSupply
async function getERC20TokenInfo(web3Api, contractAddress, bn = 'latest') {
    let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
    let erc20Contract = initContract(web3Api, erc20ABI, checkSumContractAddr)
    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }
    try {
        var [name, symbol, decimals, totalSupply] = await Promise.all([
            erc20Contract.methods.name().call({}, bn),
            erc20Contract.methods.symbol().call({}, bn),
            erc20Contract.methods.decimals().call({}, bn),
            erc20Contract.methods.totalSupply().call({}, bn)
        ]);
        // for a contract to be erc20, {name, symbol, decimals, totalSupply} call return successful
        let tokenInfo = {
            blockNumber: bn,
            tokenAddress: checkSumContractAddr,
            tokenType: 'ERC20',
            name: name,
            symbol: symbol,
            decimal: decimals,
            totalSupply: totalSupply / 10 ** decimals,
            numHolders: 0
        }
        return tokenInfo
    } catch (err) {
        //console.log(`getERC20TokenInfo ERROR ${checkSumContractAddr}`, err)
        return false
    }
}

// StellaLP|0x1234-0xabcd:WGLMR/USDC
//(platform|ShortAddr0-ShortAddr1:Symbol0/Symbol1)
function getAssetPairKey(name, token0Addr, token1Addr, token0Symbol, token1Symbol) {
    let pieces = name.split(" ");
    let s = []
    for (const p of pieces) {
        if (p.toLowerCase() != 'token') {
            s.push(p)
        }
    }
    let token0ShortAddr = token0Addr.toLowerCase().substr(0, 6)
    let token1ShortAddr = token1Addr.toLowerCase().substr(0, 6)
    let ap = `${s.join('')}|${token0ShortAddr}-${token1ShortAddr}:${token0Symbol}/${token1Symbol}`
    return ap
}

async function getERC20LiquidityPairRawReserve(web3Api, contractAddress, bn = 'latest') {
    let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
    let uniswapV2Reserves = initContract(web3Api, uniswapV2ReservesABI, checkSumContractAddr)
    let zenLinkReserves = initContract(web3Api, zenLinkReservesABI, checkSumContractAddr)
    let reserve0 = false;
    let reserve1 = false;
    let blockTimestampLast = false;

    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }
    var statusesPromise = Promise.allSettled([
        uniswapV2Reserves.methods.getReserves().call({}, bn),
        zenLinkReserves.methods.getReserves().call({}, bn)
    ])

    var [uniswapV2ReservesTest, zenLinkReservesTest] = await statusesPromise;
    if (uniswapV2ReservesTest.status == 'fulfilled') {
        let res = uniswapV2ReservesTest.value
        reserve0 = res['_reserve0']
        reserve1 = res['_reserve1']
        blockTimestampLast = res['_blockTimestampLast']
    }
    if (zenLinkReservesTest.status == 'fulfilled') {
        let res = zenLinkReservesTest.value
        reserve0 = res['_reserve0']
        reserve1 = res['_reserve1']
    }
    return [reserve0, reserve1, blockTimestampLast]
}

//todo this currently reject uniswap fork that doesn't implement PERMIT_TYPEHASH
// zen link: missing both PERMIT_TYPEHASH and the timestamp in getReserves
async function getERC20LiquidityPairTokenInfo(web3Api, contractAddress, bn = 'latest') {
    let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
    let erc20LPContract = initContract(web3Api, swapABI, checkSumContractAddr)
    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }
    //var domainSeparator, permitTypehash
    try {
        let [domainSeparator, permitTypehash] = await Promise.all([
            erc20LPContract.methods.DOMAIN_SEPARATOR().call({}, bn),
            erc20LPContract.methods.PERMIT_TYPEHASH().call({}, bn)
        ]);
        //console.log(`${domainSeparator}, ${permitTypehash}`)
        if (permitTypehash != '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9') {
            console.log(`PERMIT_TYPEHASH mismatch ${permitTypehash}`)
            //return false
        }

    } catch (err) {
        console.log(`warning ${contractAddress} does not implement DOMAIN_SEPARATOR and/or PERMIT_TYPEHASH`)
        //return false
    }

    var [reserve0, reserve1, blockTimestampLast] = await getERC20LiquidityPairRawReserve(web3Api, checkSumContractAddr, bn)
    if (!reserve0 || !reserve1) {
        console.log(`${contractAddress} not LP token (reserves not found)`)
        return false
    }

    try {
        var [token0, token1, totalSupply] = await Promise.all([
            erc20LPContract.methods.token0().call({}, bn),
            erc20LPContract.methods.token1().call({}, bn),
            erc20LPContract.methods.totalSupply().call({}, bn)
        ]);

        let token0Contract = initContract(web3Api, swapABI, token0)
        let token1Contract = initContract(web3Api, swapABI, token1)
        var [name, lpDecimal, token0Decimal, token1Decimal, token0Symbol, token1Symbol] = await Promise.all([
            erc20LPContract.methods.name().call({}, bn),
            erc20LPContract.methods.decimals().call({}, bn),
            token0Contract.methods.decimals().call({}, bn),
            token1Contract.methods.decimals().call({}, bn),
            token0Contract.methods.symbol().call({}, bn),
            token1Contract.methods.symbol().call({}, bn)
        ]);
        // for a contract to be erc20, {name, symbol, decimals, totalSupply} call return successful
        let token0Supply = reserve0
        let token1Supply = reserve1
        let assetpairkey = getAssetPairKey(name, token0, token1, token0Symbol, token1Symbol) //name, token0Addr, token1Addr, token0Symbol, token1Symbol
        let tokenInfo = {
            blockNumber: bn,
            tokenAddress: checkSumContractAddr,
            tokenType: 'ERC20LP',
            assetPair: assetpairkey,
            token0: token0,
            token1: token1,
            token0Symbol: token0Symbol,
            token1Symbol: token1Symbol,
            decimals: lpDecimal,
            token0Decimals: token0Decimal,
            token1Decimals: token1Decimal,
            token0Supply: token0Supply / 10 ** token0Decimal,
            token1Supply: token1Supply / 10 ** token1Decimal,
            totalSupply: totalSupply / 10 ** lpDecimal
        }
        return tokenInfo
    } catch (err) {
        console.log(`${contractAddress} not LP token`, err)
        return false
    }
}

async function getNativeChainBalances(web3Api, holders, bn = 'latest') {
    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }
    let ether = 10 ** 18
    var checkSumholders = holders.map((holder) => {
        return web3.utils.toChecksumAddress(holder)
    })
    let holderBalancesAsync = await checkSumholders.map(async (checkSumholder) => {
        try {
            return web3Api.eth.getBalance(checkSumholder, bn)
        } catch (err) {
            console.log(`getNativeChainBalances ${checkSumholder}`, err)
            return false
        }
    });
    let holderBalances;
    try {
        holderBalances = await Promise.allSettled(holderBalancesAsync);
        //{ status: 'fulfilled', value: '503872893109922' },
        //{ status: 'rejected', reason: Error: '.....'}
        //console.log(holderBalances.map(promise => [promise.status, promise.value]));
    } catch (e) {
        console.log(`getNativeChainBalances error`, e, holderBalances)
    }
    let res = {
        blockNumber: bn,
        holders: []
    }

    for (i = 0; i < checkSumholders.length; i += 1) {
        let holderAddress = checkSumholders[i]
        let holderBalance = holderBalances[i]
        let holderRes = {
            holderAddress: holderAddress,
            balance: 0
        }
        //console.log(`holderBalance[${i}]`, holderBalance)
        if (holderBalance['status'] == 'fulfilled') {
            holderRes.balance = holderBalance['value'] / ether
        } else {
            holderRes.error = holderBalance['reason']
        }
        res.holders.push(holderRes)
    }
    return res
}

//await getTokenHoldersRawBalances(web3Api, tokenAddress, holders.slice(44,48), false, 255220)
async function getTokenHoldersRawBalances(web3Api, contractAddress, holders, tokenDecimal = false, bn = 'latest') {
    let checkSumContractAddr = web3.utils.toChecksumAddress(contractAddress)
    let erc20Contract = initContract(web3Api, erc20ABI, checkSumContractAddr)
    if (bn == 'latest') {
        bn = await web3Api.eth.getBlockNumber()
    }
    let res = {
        blockNumber: bn,
        tokenAddress: checkSumContractAddr,
        holders: []
    }

    if (tokenDecimal == false) {
        try {
            tokenDecimal = await erc20Contract.methods.decimals().call({}, bn)
        } catch (err) {
            console.log(`getHolderRawTokenBalance ${contractAddress} fetch tokenDecimal error`, err)
            return res
        }
    }

    var checkSumholders = holders.map((holder) => {
        return web3.utils.toChecksumAddress(holder)
    })
    let holderBalancesAsync = await checkSumholders.map(async (checkSumholder) => {
        return erc20Contract.methods.balanceOf(checkSumholder).call({}, bn)
    });
    if (holderBalancesAsync.length != holders.length) {
        console.log("holderBalancesAsync.length", holderBalancesAsync.length, "holders.length", holders.length);
    }
    if (checkSumholders.length != holders.length) {
        console.log("checkSumholders.length", checkSumholders.length, "holders.length", holders.length);
    }
    let holderBalances = [];
    try {
        holderBalances = await Promise.allSettled(holderBalancesAsync);
        //{ status: 'fulfilled', value: '503872893109922' },
        //{ status: 'rejected', reason: Error: '.....'}
        //console.log(holderBalances.map(promise => [promise.status, promise.value]));
    } catch (e) {
        console.log(`getHolderRawTokenBalance ${contractAddress} error`, e, holderBalances)
    }
    if (holderBalances.length != holders.length) {
        console.log("holderBalances.length", holderBalances.length, "holders.length", holders.length);
    }
    for (i = 0; i < checkSumholders.length; i += 1) {
        let holderAddress = checkSumholders[i]
        let holderBalance = holderBalances[i]
        let bal = 0
        let failedReson;
        let holderRes = {
            holderAddress: holderAddress,
            balance: 0
        }
        //console.log(`holderBalance[${i}]`, holderBalance)
        if (holderBalance['status'] == 'fulfilled') {
            holderRes.balance = holderBalance['value'] / 10 ** tokenDecimal
        } else {
            holderRes.error = holderBalance['reason']
        }
        res.holders.push(holderRes)
    }
    return res
}


// this function decorates and generate a "full" txn using decodedTxn and decodedReceipts
function decorateTxn(dTxn, dReceipt, dInternal, blockTS = false, chainID = false) {
    if (!dReceipt || dReceipt.transactionHash === undefined) {
        console.log(`decorateTxn: missing receipts`, dReceipt)
        process.exit(0);
    }
    if (dTxn.hash != dReceipt.transactionHash) {
        console.log(`decorateTxn: txnHash mismatch (tx:${dTxn.hash}) vs (receipt: ${dReceipt.transactionHash})`, dTxn)
        process.exit(0);
        return
    }
    //todo: how to detect reverted but successful case?
    //todo compute txfee (1559 vs legacy), current using 1284 for prototype
    /* For 1559
    baseFeePerGas: subsequently burned.
    maxPriorityFeePerGas: tip that goes to miner
    maxFeePerGas: max amount user is willing to pay. if baseFeePerGas+maxPriorityFeePerGas >=maxFeePerGas, maxPriorityFeePerGas is set to maxFeePerGas-baseFeePerGas
    txSaving: maxFeePerGas - (maxPriorityFeePerGas+maxFeePerGas)
    */
    let gWei = 10 ** 9
    let ether = 10 ** 18
    let value = paraTool.dechexToInt(dTxn.value)
    let gasLimit = dTxn.gas ? paraTool.dechexToInt(dTxn.gas) : 0
    let gasPrice = dTxn.gasPrice ? paraTool.dechexToInt(dTxn.gasPrice) : 0
    let gasUsed = dReceipt.gasUsed ? paraTool.dechexToInt(dReceipt.gasUsed) : 0
    let txLegacyType = 0
    let tx1559Type = 2
    let txType = (dTxn.type != undefined) ? dTxn.type : txLegacyType
    if (txType != txLegacyType && txType != tx1559Type) {
        console.log(`unknown txType=${dTxn.type}, dTxn`, dTxn)
        //process.exit(0)
    }
    let fee = gasUsed * gasPrice
    let maxFeePerGas = (dTxn.maxFeePerGas != undefined) ? paraTool.dechexToInt(dTxn.maxFeePerGas) : 0
    let maxPriorityFeePerGas = (dTxn.maxPriorityFeePerGas != undefined) ? paraTool.dechexToInt(dTxn.maxPriorityFeePerGas) : 0
    //console.log(`dReceipt effectiveGasPrice`, paraTool.dechexToInt(dReceipt.effectiveGasPrice))
    let baseFeePerGas = (dTxn.maxPriorityFeePerGas != undefined) ? paraTool.dechexToInt(dReceipt.effectiveGasPrice) : 0 //paraTool.dechexToInt("0x174876e800")
    let burnedFee = gasUsed * baseFeePerGas
    let txnSaving = (maxFeePerGas - baseFeePerGas) * gasUsed
    if (gasPrice >= baseFeePerGas) {
        baseFeePerGas = gasPrice - maxPriorityFeePerGas
    }

    let fTxn = {
        chainID: chainID,
        transactionHash: dTxn.hash,
        substrate: null,
        status: dReceipt.status,
        blockHash: dTxn.blockHash,
        blockNumber: dTxn.blockNumber,
        transactionIndex: dTxn.transactionIndex,
        timestamp: (blockTS) ? blockTS : null, // not part of the txn
        from: dTxn.from,
        to: dTxn.to,
        creates: dTxn.creates,
        transfers: dReceipt.transfers, //TODO.. also transaction actions
        swaps: dReceipt.swaps,
        value: value / ether,
        txType: dTxn.type,
        fee: fee / ether,
        burnedFee: burnedFee / ether,
        txnSaving: txnSaving / ether,
        gasLimit: gasLimit,
        gasUsed: gasUsed,
        maxFeePerGas: maxFeePerGas / gWei,
        maxPriorityFeePerGas: maxPriorityFeePerGas / gWei,
        baseFeePerGas: baseFeePerGas / gWei,
        gasPrice: gasPrice / gWei,
        nonce: dTxn.nonce,
        accessList: null,
        input: dTxn.input,
        decodedInput: dTxn.decodedInput,
        decodedLogs: dReceipt.decodedLogs,
    }
    if (txType == txLegacyType) {
        delete fTxn.maxFeePerGas
        delete fTxn.maxPriorityFeePerGas
        delete fTxn.txnSaving
    }
    if (fTxn.txnSaving < 0) {
        delete fTxn.txnSaving
    }
    if (dTxn.accessList) {
        fTxn.accessList = dTxn.accessList
    } else {
        delete fTxn.accessList
    }
    if (dInternal.length > 0) {
        fTxn.transactionsInternal = dInternal;
    }
    return fTxn
}

function decodeRLPTransaction(rawTxHex) {
    try {
        var tx = Transaction.fromRlpSerializedTx(rawTxHex)
        var txJSON = tx.toJSON()
        let from = web3.eth.accounts.recoverTransaction(rawTxHex);
        txJSON.from = from.toLowerCase()
        return txJSON
    } catch (error) {
        console.log(`decodeRLPTransaction rawTxHex=${rawTxHex}, error=${error.toString()}`)
        return false
    }
}

async function signEvmTx(web3Api, txStruct, wallet) {
    var signedTX = false
    try {
        signedTX = await web3Api.eth.accounts.signTransaction(txStruct, wallet.privateKey)
        console.log(`signEvmTx [acct=${wallet.address}], txHash=${signedTX.transactionHash}, txStruct=`, txStruct)
    } catch (e) {
        console.log(`signEvmTx [acct=${wallet.address}], txStruct=${txStruct} error=${error.toString()}`)
    }
    return signedTX
}

async function sendSignedTx(web3Api, signedTx) {
    var isError = 0
    let txHash = signedTx.transactionHash
    let rawTransaction = signedTx.rawTransaction
    try {
        console.log(`sendSignedTx txhHash=${txHash}, rawTransaction=${rawTransaction}`)
        await web3Api.eth.sendSignedTransaction(signedTx.rawTransaction)
    } catch (error) {
        console.log(`sendSignedTx txhHash=${txHash}, rawTransaction=${rawTransaction} error=${error.toString()}`)
        isError = error.toString()
    }
    return isError
}

async function sendSignedRLPTx(web3Api, rlpTx) {
    var isError = 0
    let txHash = web3.utils.keccak256(rlpTx)
    console.log(`sendSignedTx txhHash=${txHash}, rawTransaction=${rlpTx}`)
    try {
        await web3Api.eth.sendSignedTransaction(rlpTx)
    } catch (error) {
        console.log(`sendSignedTx txhHash=${txHash}, rawTransaction=${rlpTx} error=${error.toString()}`)
        isError = error.toString()
    }
    return isError
}

function decodeTransactionInput(txn, contractABIs, contractABISignatures) {
    //etherscan is marking native case as "Transfer"
    let contractcreationAddress = false
    let txInput = txn.input
    let methodID = '0x';
    let decodedTxnInput = {};

    if (!contractcreationAddress) {
        if (txInput.length >= 10) {
            methodID = txInput.slice(0, 10)
        } else if (txInput >= '0x') {
            // TODO: check weird case
            // console.log(`check txhash ${txn.hash}`)
            methodID = txInput
        }
    }

    if (methodID != '0x') {
        let foundApi = fetchABI(methodID, contractABIs, contractABISignatures)
        if (foundApi) {
            let methodSignature = foundApi.signature
            //console.log(`${methodID} -> ${methodSignature}`)
            let methodABIStr = foundApi.abi
            let cachedDecoder = foundApi.decoder
            let decodedInput = decode_txn_input(txn, methodABIStr, methodSignature, cachedDecoder)
            if (decodedInput.decodeStatus == 'null' || decodedInput.decodeStatus == 'error') {
                decodedTxnInput.decodeStatus = decodedInput.name
                decodedTxnInput.methodID = methodID
                decodedTxnInput.txInput = txInput
            } else {
                //sucessfully decoded, dropping txInput
                decodedTxnInput.decodeStatus = 'success'
                decodedTxnInput.methodID = methodID
                decodedTxnInput.signature = methodSignature
                decodedTxnInput.params = decodedInput.params
            }
        } else {
            //methodID not found
            decodedTxnInput.decodeStatus = 'unknown'
            decodedTxnInput.methodID = methodID
            decodedTxnInput.txInput = txInput
        }
    } else {
        //native transfer case or contract creation
        if (contractcreationAddress) {
            //contract creation
            decodedTxnInput.decodeStatus = 'contractCreation'
            decodedTxnInput.contractAddress = contractcreationAddress
            decodedTxnInput.methodID = methodID
            decodedTxnInput.signature = `contractCreation`
        } else {
            //native transfer
            decodedTxnInput.decodeStatus = 'success'
            decodedTxnInput.methodID = methodID
            decodedTxnInput.signature = `nativeTransfer`
            decodedTxnInput.params = []
        }
    }
    return decodedTxnInput
}

function decodeTransaction(txn, contractABIs, contractABISignatures, chainID) {
    //etherscan is marking native case as "Trafer"
    let contractcreationAddress = (txn.creates != undefined) ? txn.creates : false
    let txInput = txn.input
    let methodID = '0x';
    let decodedTxnInput = {};
    let output = txn

    if (!contractcreationAddress) {
        if (txInput.length >= 10) {
            methodID = txInput.slice(0, 10)
        } else if (txInput >= '0x') {
            // TODO: check weird case
            // console.log(`check txhash ${txn.hash}`)
            methodID = txInput
        }
    }

    if (methodID != '0x') {
        let foundApi = fetchABI(methodID, contractABIs, contractABISignatures)
        if (foundApi) {
            let methodSignature = foundApi.signature
            //console.log(`${methodID} -> ${methodSignature}`)
            let methodABIStr = foundApi.abi
            let cachedDecoder = foundApi.decoder
            let decodedInput = decode_txn_input(txn, methodABIStr, methodSignature, cachedDecoder)
            if (decodedInput.decodeStatus == 'null' || decodedInput.decodeStatus == 'error') {
                decodedTxnInput.decodeStatus = decodedInput.name
                decodedTxnInput.methodID = methodID
                decodedTxnInput.txInput = txInput
            } else {
                //sucessfully decoded, dropping txInput
                decodedTxnInput.decodeStatus = 'success'
                decodedTxnInput.methodID = methodID
                decodedTxnInput.signature = methodSignature
                decodedTxnInput.params = decodedInput.params
            }
        } else {
            //methodID not found
            decodedTxnInput.decodeStatus = 'unknown'
            decodedTxnInput.methodID = methodID
            decodedTxnInput.txInput = txInput
        }
    } else {
        //native transfer case or contract creation
        if (contractcreationAddress) {
            //contract creation
            decodedTxnInput.decodeStatus = 'contractCreation'
            decodedTxnInput.methodID = methodID
            decodedTxnInput.signature = `contractCreation`
            decodedTxnInput.contractAddress = contractcreationAddress
        } else {
            //native transfer
            decodedTxnInput.decodeStatus = 'success'
            decodedTxnInput.methodID = methodID
            decodedTxnInput.signature = `nativeTransfer`
            decodedTxnInput.params = []
        }
    }
    output.chainID = chainID
    output.decodedInput = decodedTxnInput
    return output
}

//'0x38ed1739'
//decodeMethod
function decode_txn_input(txn, methodABIStr, methodSignature, abiDecoder) {
    //const abiDecoder = require('abi-decoder');
    //abiDecoder.addABI(methodABIStr)
    //abiDecoder.addABI(JSON.parse(methodABIStr));
    if (txn.hash == undefined) txn.hash = null
    try {
        let txInput = txn.input
        let methodID = txn.input.slice(0, 10)
        let decodedData = abiDecoder.decodeMethod(txInput);
        if (decodedData != null) {
            //success case with {name: 'swapExactTokensForTokens', params: []}
            decodedData.decodeStatus = 'success'
            return decodedData
        } else {
            //decode null
            console.log(`decodeErr null txHash=${txn.hash} methodID=${methodID} `)
            console.log(`decodeErr null methodSignature=${methodSignature}`)
            console.log(`decodeErr input=${txn.input}`)
            abiDecoder.discardNonDecodedLogs()
        }
        let decodeNull = {
            decodeStatus: 'null'
        }
        return decodeNull
    } catch (e) {
        //error decoding inputs
        console.log(`decodeErr txHash=${txn.hash}`)
        console.log(`decodeErr methodSignature=${methodSignature}`)
        console.log(`decodeErr input=${txn.input}`)
        console.log(`decodeErr`, e)
        let decodeErr = {
            decodeStatus: 'error'
        }
        return decodeErr
    }
}

//return function signature like transferFrom(address sender, address recipient, uint256 amount) from abi
//Deposit(index_topic_1 address dst, uint256 wad) -- added index_topic for events
function getMethodSignature(e) {
    var inputs = []
    var indexedCnt = 0 //topic0 is signatureID
    for (const inp of e.inputs) {
        let isIndexed = false
        if (inp.indexed != undefined) {
            isIndexed = inp.indexed
        }
        let typeName;
        if (Array.isArray(inp.components)) {
            let t = []
            for (const c of inp.components) {
                let cTypeName = `${c.type} ${c.name}`.trim()
                t.push(cTypeName)
            }
            typeName = `(${t.join(', ')})`
        } else {
            typeName = `${inp.type} ${inp.name}`.trim()
        }
        if (isIndexed) {
            indexedCnt++
            inputs.push(`index_topic_${indexedCnt} ${typeName}`)
        } else {
            inputs.push(typeName)
        }
    }
    let topicLen = (e.type == 'event') ? indexedCnt + 1 : 0
    return [`${e.name}(${inputs.join(', ')})`, topicLen]
}

// goal: generate uniqueID for func + indexed events
function getMethodFingureprint(e) {
    var inputs = []
    var indexedCnt = 0 //topic0 is signatureID
    for (const inp of e.inputs) {
        let isIndexed = false
        if (inp.indexed != undefined) {
            isIndexed = inp.indexed
        }
        let typeName;
        if (Array.isArray(inp.components)) {
            let t = []
            for (const c of inp.components) {
                let cTypeName = `${c.type}`.trim()
                t.push(cTypeName)
            }
            typeName = `(${t.join(',')})`
        } else {
            typeName = `${inp.type}`.trim()
        }
        if (isIndexed) {
            indexedCnt++
            inputs.push(`index_topic_${indexedCnt} ${typeName}`)
        } else {
            inputs.push(typeName)
        }
    }
    return `${e.name}(${inputs.join(',')})`
}



function getMethodSignatureRawOld(e) {
    let inputRaw = `${e.name}(${e.inputs.map(e => e.type)})`
    return inputRaw
}

//return raw function signature like transferFrom(address,address,uint256) from abi, which is then used to compute methodID using keccak256(raw_func_sig)
//encodeSelector('transfer(address,uint256,(uint8,bytes[]),uint64)', 10)
//0xb9f813ff
function getMethodSignatureRaw(e) {
    let inputRaw = `${e.name}`
    let inputs = []
    for (const inp of e.inputs) {
        if (Array.isArray(inp.components)) {
            let t = []
            for (const c of inp.components) {
                t.push(c.type)
            }
            let rawTuple = `(${t.join(',')})`
            inputs.push(rawTuple)
        } else {
            inputs.push(inp.type)
        }
    }
    let finalRaw = `${inputRaw}(${inputs.join(',')})`
    return finalRaw
}

// keccak256 input to certain length
function encodeSelector(f, encodeLen = false) {
    let k = web3.utils.sha3(f)
    if (encodeLen) {
        return k.slice(0, encodeLen)
    }
    return k
}

function parseAbiSignature(abiStrArr) {
    var contractABI = JSON.parse(abiStrArr)
    var intputs = contractABI.filter(e => e.type === "event" || e.type === "function")
    var output = []
    intputs.forEach(function(e) {
        let abiType = e.type
        let [signature, topicLen] = getMethodSignature(e)
        let signatureRaw = getMethodSignatureRaw(e)
        let signatureID = (abiType == 'function') ? encodeSelector(signatureRaw, 10) : encodeSelector(signatureRaw, false)
        let fingerprint = getMethodFingureprint(e)
        let fingerprintID = (abiType == 'function') ? encodeSelector(signatureRaw, 10) : `${signatureID}-${topicLen}-${encodeSelector(fingerprint, 10)}` //fingerprintID=sigID-topicLen-4BytesOfkeccak256(fingerprint)
        let abiStr = JSON.stringify([e])
        output.push({
            fingerprint: fingerprint,
            fingerprintID: fingerprintID,
            signatureID: signatureID,
            signatureRaw: signatureRaw,
            signature: signature,
            name: firstCharUpperCase(e.name),
            abi: abiStr,
            abiType: abiType,
            topicLength: topicLen
        })
    });
    return output
}

/*
{
  blockHash: '0x98e4197c2675d6d87df6ef9051ed56319f10a79841d21afc8920c80f5c2b2c89',
  blockNumber: 506717,
  contractAddress: null,
  cumulativeGasUsed: 953597,
  effectiveGasPrice: 100000000000,
  from: '0x44cdc2d3f73c76c9cbb097fff3bbb261ae850f6e',
  gasUsed: 198200,
  logs: [
    [Object], [Object],
    [Object], [Object],
    [Object], [Object],
    [Object], [Object],
    [Object], [Object]
  ],
  logsBloom: '0x0020000000800000000000008000400000000000000000800000000000000000000000000000000000000000000002000000000000200800000000000000000000000000000400000000004800000020020000000000000000000000400000000000000000000000000008000000000000000000000000010000011000000000000000000000000100000000000000010000000000008008000000c000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000002000001000000000001100000000000002000020080000000000000000100000000100000080010000000004400000000002',
  status: true,
  to: '0xdfdb4de0801ef57969a9e368654b391812d23fb8',
  transactionHash: '0x4e43e2aa5cfed7669048dc435a555dabe0e3f9a624a5d45ab9c8748375700597',
  transactionIndex: 6
}
*/

async function fuse_block_transaction_receipt(evmBlk, dTxns, dReceipts, dTrace, chainID) {
    let fBlk = evmBlk
    let blockTS = fBlk.timestamp
    let fTxns = []
    let fTxnsInternal = [];
    if (dTxns.length != dReceipts.length) {
        console.log(`[${fBlk.blockNumber}][${fBlk.blockHash}] txns/receipts len mismatch: txnLen=${dTxns.length}, receiptLen=${dReceipts.length}`)
    }
    // recurse through all the trace records in dTrace, and for any with value, accumulate in feedTrace
    let feedtrace = []
    if (dTrace) {
        process_evm_trace(dTrace, feedtrace, 0, [0], dTxns);
    }
    let feedtraceMap = {};
    if (feedtrace.length > 0) {
        for (let t = 0; t < feedtrace.length; t++) {
            let internalTx = feedtrace[t];
            if (feedtraceMap[internalTx.transactionHash] == undefined) {
                feedtraceMap[internalTx.transactionHash] = [];
            }
            feedtraceMap[internalTx.transactionHash].push(internalTx);
        }
    }

    for (i = 0; i < dTxns.length; i += 1) {
        let dTxn = dTxns[i]
        let dReceipt = dReceipts[i]
        let dInternal = feedtraceMap[dTxn.hash] ? feedtraceMap[dTxn.hash] : []
        let fTxn = decorateTxn(dTxn, dReceipt, dInternal, blockTS, chainID)
        fTxns.push(fTxn)
        if (fTxn.transactionsInternal && fTxn.transactionsInternal.length > 0) {
            for (let j = 0; j < fTxn.transactionsInternal.length; j++) {
                fTxnsInternal.push(fTxn.transactionsInternal[j]);
            }
        }
    }
    fBlk.transactions = fTxns
    fBlk.transactionsInternal = fTxnsInternal
    return fBlk
}

async function processTranssctions(txns, contractABIs, contractABISignatures) {
    let decodeTxns = []
    let txnsAsync = await txns.map(async (txn) => {
        try {
            return decodeTransaction(txn, contractABIs, contractABISignatures)
        } catch (err) {
            console.log(`processTranssctions ${txns}`, err)
            return false
        }
    });
    let decodeTxnsRes = await Promise.all(txnsAsync);
    for (const dTxn of decodeTxnsRes) {
        decodeTxns.push(dTxn)
    }
    return decodeTxns
}

async function processReceipts(evmReceipts, contractABIs, contractABISignatures) {
    let decodedReceipts = []
    /*
    for (const receipt of evmReceipts) {
        let decodedReceipt = decodeReceipt(receipt, contractABIs, contractABISignatures)
        decodedReceipts.push(decodedReceipt)
    }
    */
    let recptAsync = await evmReceipts.map(async (receipt) => {
        try {
            return decodeReceipt(receipt, contractABIs, contractABISignatures)
        } catch (err) {
            console.log(`processReceipts ${receipt}`, err)
            return false
        }
    });
    let decodedReceiptsRes = await Promise.all(recptAsync);
    for (const dReceipt of decodedReceiptsRes) {
        decodedReceipts.push(dReceipt)
    }
    return decodedReceipts
}


function decodeReceipt(r, contractABIs, contractABISignatures) {
    // shallow copy throws error here... not sure why?
    //let res = JSON.parse(JSON.stringify(r))
    var res = Object.assign({}, r);
    if (!res) return;
    let decodedLogs = []
    if (res.logs) {
        for (const log of res.logs) {
            let decodedRes = decode_log(log, contractABIs, contractABISignatures)
            decodedLogs.push(decodedRes)
        }
        delete res.logs
    }
    res.decodedLogs = decodedLogs
    let transfers = []
    let swaps = []
    let syncs = []
    let transferActions = [] //todo
    for (let i = 0; i < decodedLogs.length; i++) {
        let dLog = decodedLogs[i]
        if (dLog.decodeStatus == "success") {
            let transfer = categorizeTokenTransfers(dLog)
            if (transfer) {
                transfers.push(transfer)
                continue
            }
            let swap = categorizeTokenSwaps(dLog)
            if (swap) {
                swaps.push(swap)
                continue
            }
        }
    }
    res.transfers = transfers
    res.swaps = swaps
    //res.syncs = syncs
    return res
}

function categorizeTokenSync(dLog) {
    if (dLog.decodeStatus == "success") {
        let dSig = dLog.signature
        let dEvents = dLog.events
        switch (dSig) {
            //0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1-1-0x1c411e9a (uniswamp v2), 2 args
            case 'Sync(uint112 reserve0, uint112 reserve1)':
                /*
                {
                  "decodeStatus": "success",
                  "address": "0xAc2657ba28768FE5F09052f07A9B7ea867A4608f",
                  "transactionLogIndex": "0x5",
                  "data": "0x000000000000000000000000000000000000000000000000000005858933350b00000000000000000000000000000000000000000000036c97b724a65ece0138",
                  "topics": [
                    "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1"
                  ],
                  "signature": "Sync(uint112 reserve0, uint112 reserve1)",
                  "events": [
                    {
                      "name": "reserve0",
                      "type": "uint112",
                      "value": "6071090623755"
                    },
                    {
                      "name": "reserve1",
                      "type": "uint112",
                      "value": "16170280055487006114104"
                    }
                  ]
                }
                */
                let syncV2 = {
                    type: 'syncV2',
                    reserve0: dEvents[0].value,
                    reserve1: dEvents[1].value,
                    lpTokenAddress: dLog.address
                }
                return syncV2
                break;

            default:
                break;
        }
    }
    return false
}

//swapV2 is guranteed to have sync before it
function categorizeTokenSwaps(dLog) {
    if (dLog.decodeStatus == "success") {
        let dSig = dLog.signature
        let dEvents = dLog.events

        // swap xxx (token0) for yyy (token1) [sender='taker', to='maker']
        switch (dSig) {
            //0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822-3-0x1cdd7c22 (uniswamp v2), 6 args
            case 'Swap(index_topic_1 address sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, index_topic_2 address to)':
                /*
                {
                    "decodeStatus": "success",
                    "address": "0xa0799832FB2b9F18Acf44B92FbbEDCfD6442DD5e",
                    "transactionLogIndex": "0x9",
                    "data": "0x0000000000000000000000000000000000000000000000000000000002831ba800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002490807a22397be44",
                    "topics": [
                        "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
                        "0x000000000000000000000000a6baa075fb5cf4721b43fe068ee81b56f34fa06d",
                        "0x000000000000000000000000a6baa075fb5cf4721b43fe068ee81b56f34fa06d"
                    ],
                    "signature": "Swap(index_topic_1 address sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, index_topic_2 address to)",
                    "events": [{
                            "name": "sender",
                            "type": "address",
                            "value": "0xa6baa075fb5cf4721b43fe068ee81b56f34fa06d"
                        },
                        {
                            "name": "amount0In",
                            "type": "uint256",
                            "value": "42146728"
                        },
                        {
                            "name": "amount1In",
                            "type": "uint256",
                            "value": "0"
                        },
                        {
                            "name": "amount0Out",
                            "type": "uint256",
                            "value": "0"
                        },
                        {
                            "name": "amount1Out",
                            "type": "uint256",
                            "value": "42155952704964771396"
                        },
                        {
                            "name": "to",
                            "type": "address",
                            "value": "0xa6baa075fb5cf4721b43fe068ee81b56f34fa06d"
                        }
                    ]
                }
                */
                let uniswapV2 = {
                    type: 'swapV2',
                    maker: dEvents[0].value,
                    taker: dEvents[5].value,
                    amount0In: dEvents[1].value,
                    amount1In: dEvents[2].value,
                    amount0Out: dEvents[3].value,
                    amount1Out: dEvents[4].value,
                    path: (dEvents[1].value != '0' && dEvents[4].value != '0') ? 'token0 -> token1' : 'token1 -> token0',
                    lpTokenAddress: dLog.address
                }
                return uniswapV2
                break;

            default:
                break;
        }
    }
    return false
}

function categorizeTokenTransfers(dLog) {
    if (dLog.decodeStatus == "success") {
        let dSig = dLog.signature
        let dEvents = dLog.events
        switch (dSig) {
            case 'Transfer(index_topic_1 address from, index_topic_2 address to, uint256 value)':
            case 'Transfer(index_topic_1 address from, index_topic_2 address to, uint256 amount)':
                //ERC20
                let erc20Transfer = {
                    type: 'ERC20',
                    from: dEvents[0].value,
                    to: dEvents[1].value,
                    value: dEvents[2].value,
                    tokenAddress: dLog.address
                }
                return erc20Transfer
                break;

            case 'Transfer(index_topic_1 address from, index_topic_2 address to, index_topic_3 uint256 tokenId)':
                //ERC721
                let er721Transfer = {
                    type: 'ERC721',
                    from: dEvents[0].value,
                    to: dEvents[1].value,
                    tokenId: dEvents[2].value,
                    tokenAddress: dLog.address
                }
                return er721Transfer
                break;

            case 'TransferSingle(index_topic_1 address operator, index_topic_2 address from, index_topic_3 address to, uint256 id, uint256 value)':
                //ERC1155 - single -- tranform it into batch case
                /*
                @dev Either `TransferSingle` or `TransferBatch` MUST emit when tokens are transferred, including zero value transfers as well as minting or burning (see "Safe Transfer Rules" section of the standard).
                The `_operator` argument MUST be the address of an account/contract that is approved to make the transfer (SHOULD be msg.sender).
                The `_from` argument MUST be the address of the holder whose balance is decreased.
                The `_to` argument MUST be the address of the recipient whose balance is increased.
                The `_id` argument MUST be the token type being transferred.
                The `_value` argument MUST be the number of tokens the holder balance is decreased by and match what the recipient balance is increased by.
                When minting/creating tokens, the `_from` argument MUST be set to `0x0` (i.e. zero address).
                When burning/destroying tokens, the `_to` argument MUST be set to `0x0` (i.e. zero address).

                event TransferSingle(address indexed _operator, address indexed _from, address indexed _to, uint256 _id, uint256 _value);
                */
                let er1151SingleTransfer = {
                    type: 'ERC1155',
                    operator: dEvents[0].value,
                    from: dEvents[1].value,
                    to: dEvents[2].value,
                    tokenIds: [dEvents[3].value],
                    values: [dEvents[4].value],
                    tokenAddress: dLog.address,
                    isBatch: false
                }
                return er1151SingleTransfer
                break;

            case 'TransferBatch(index_topic_1 address operator, index_topic_2 address from, index_topic_3 address to, uint256[] ids, uint256[] values)':
                //ERC1155 - batch
                /*
                @dev Either `TransferSingle` or `TransferBatch` MUST emit when tokens are transferred, including zero value transfers as well as minting or burning (see "Safe Transfer Rules" section of the standard).
                The `_operator` argument MUST be the address of an account/contract that is approved to make the transfer (SHOULD be msg.sender).
                The `_from` argument MUST be the address of the holder whose balance is decreased.
                The `_to` argument MUST be the address of the recipient whose balance is increased.
                The `_ids` argument MUST be the list of tokens being transferred.
                The `_values` argument MUST be the list of number of tokens (matching the list and order of tokens specified in _ids) the holder balance is decreased by and match what the recipient balance is increased by.
                When minting/creating tokens, the `_from` argument MUST be set to `0x0` (i.e. zero address).
                When burning/destroying tokens, the `_to` argument MUST be set to `0x0` (i.e. zero address).

                event TransferBatch(address indexed _operator, address indexed _from, address indexed _to, uint256[] _ids, uint256[] _values);
                */
                let er1151BatchTransfer = {
                    type: 'ERC1155',
                    operator: dEvents[0].value,
                    from: dEvents[1].value,
                    to: dEvents[2].value,
                    tokenIds: dEvents[3].value,
                    values: dEvents[4].value,
                    tokenAddress: dLog.address,
                    isBatch: true
                }
                return er1151BatchTransfer
                break;

            default:
                break;
        }
    }
    return false
}

//more expensive decode when cached decoder fails..
function decode_event_fresh(log, eventAbIStr, eventSignature) {
    var abiDecoder = require('abi-decoder');
    abiDecoder.addABI(eventAbIStr)
    try {
        let decodedLogs = abiDecoder.decodeLogs([log])
        let decodedLog = decodedLogs[0] //successful result should have name, events, address
        let res = {
            decodeStatus: 'success',
            address: decodedLog.address,
            transactionLogIndex: log.transactionLogIndex,
            data: log.data,
            topics: log.topics,
            signature: eventSignature,
            events: decodedLog.events
        }
        return res
    } catch (e) {
        abiDecoder.discardNonDecodedLogs()
        let topic0 = log.topics[0]
        let topicLen = log.topics.length
        console.log(`decodeErr txHash=${log.transactionHash} LogIndex=${log.transactionLogIndex} fingerprintID=${topic0}-${topicLen}`)
        console.log(`decodeErr signatureID=${topic0} eventSignature=${eventSignature}`)
        console.log(`decodeErr`, e)
        let unknown = {
            decodeStatus: 'error',
            address: log.address,
            transactionLogIndex: log.transactionLogIndex,
            data: log.data,
            topics: log.topics
        }
        return unknown
    }
}

// for a transfer event the "address" is the contract address
// minimum requirement topics, data, address + abi
function decode_event(log, eventAbIStr, eventSignature, abiDecoder) {
    //var abiDecoder = require('abi-decoder');
    //abiDecoder.addABI(eventAbIStr)
    try {
        let decodedLogs = abiDecoder.decodeLogs([log])
        let decodedLog = decodedLogs[0] //successful result should have name, events, address
        //console.log(`decodedLog`, JSON.stringify(decodedLog,null, 2))
        let res = {
            decodeStatus: 'success',
            address: decodedLog.address,
            transactionLogIndex: log.transactionLogIndex,
            data: log.data,
            topics: log.topics,
            signature: eventSignature,
            events: decodedLog.events
        }
        return res
    } catch (e) {
        abiDecoder.discardNonDecodedLogs()
        let topic0 = log.topics[0]
        let topicLen = log.topics.length
        console.log(`fallback decode txHash=${log.transactionHash} LogIndex=${log.transactionLogIndex} fingerprintID=${topic0}-${topicLen}`)
        return decode_event_fresh(log, eventAbIStr, eventSignature)
    }
}

function fetchABI(fingerprintID, contractABIs, contractABISignatures) {
    let signatureID = fingerprintID.split('-')[0]
    let matchedABI = contractABIs[fingerprintID]
    let cachedFingerprintID = contractABISignatures[signatureID]
    if (matchedABI != undefined) {
        if (matchedABI.decoder == undefined) {
            if (cachedFingerprintID != undefined && cachedFingerprintID != fingerprintID) {
                //console.log(`fingerprintID changed!! ${cachedFingerprintID}(cached) -> ${fingerprintID}(current)`)
            }
            const abiDecoder = require('abi-decoder');
            abiDecoder.addABI(matchedABI.abi)
            matchedABI.decoder = abiDecoder
            contractABIs[fingerprintID] = matchedABI
            contractABISignatures[signatureID] = fingerprintID
            //console.log(`cache decoder -> ${fingerprintID}`)
            //console.log(`cache decoder ${fingerprintID} -> ${JSON.stringify(matchedABI.abi)}`)
        } else if (cachedFingerprintID != fingerprintID) {
            //console.log(`fingerprintID changed!! ${cachedFingerprintID}(cached) -> ${fingerprintID}(current)`)
            const abiDecoder = require('abi-decoder');
            abiDecoder.addABI(matchedABI.abi)
            matchedABI.decoder = abiDecoder
            contractABISignatures[signatureID] = fingerprintID
            //console.log(`re-cache decoder -> ${fingerprintID}`)
            //console.log(`re-cache decoder ${fingerprintID} -> ${JSON.stringify(matchedABI.abi)}`)
        }
        return matchedABI
    }
    return false
}

function decode_log(log, contractABIs, contractABISignatures) {
    let topics = log.topics
    let topicLen = log.topics.length
    let topic0 = topics[0]
    let fingerprintID = `${topic0}-${topicLen}`
    let foundApi = fetchABI(fingerprintID, contractABIs, contractABISignatures)
    if (foundApi) {
        let eventSignature = foundApi.signature
        //console.log(`${topic0} -> ${eventSignature}`)
        let eventABIStr = foundApi.abi
        let cachedDecoder = foundApi.decoder
        let decodedRes = decode_event(log, eventABIStr, eventSignature, cachedDecoder)
        return decodedRes
    }
    //console.log(`[#${log.blockNumber}-${log.transactionIndex}] decode_log: topic not found ${topic0} (topicLen ${topicLen})`)
    let unknown = {
        decodeStatus: 'unknown',
        address: log.address,
        transactionLogIndex: log.transactionLogIndex,
        data: log.data,
        topics: log.topics
    }
    return unknown
}

//curl https://rpc.moonriver.moonbeam.network -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getLogs","params":[{"fromBlock": "0x10cca1", "toBlock": "0x10cca1"}],"id":1}'
//curl https://rpc.moonriver.moonbeam.network -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getLogs","params":[{"blockHash": "0x5843b718bd8310095c078643fbb33020bfe8a98efb99906a1980c95a5d8da04e"}],"id":1}'

//retrive both block and log
//https://rpc.astar.network:8545
//https://rpc.moonriver.moonbeam.network
//https://rpc.api.moonbeam.network

async function crawl_evm_logs(web3Api, bn) {
    var queryOpt = {
        fromBlock: bn,
        toBlock: bn
    }
    try {
        var logs = await web3Api.eth.getPastLogs(queryOpt)
        return logs;
    } catch (e) {
        console.log(`crawl_evm_logs err ${bn}`, e)
    }
    return false
}

async function crawl_evm_block(web3Api, bn) {
    let returnFullTx = true
    try {
        return await web3Api.eth.getBlock(bn, returnFullTx)
    } catch (e) {
        console.log(`crawl_evm_block err ${bn}`, e)
    }
    return false
}

async function crawl_evm_receipts(web3Api, blk) {
    if (blk.transactions == undefined) {
        return false
    }
    let txns = blk.transactions
    let receiptAsync = await txns.map(async (txn) => {
        try {
            let txHash = txn.hash
            //let tIndex = txn.transactionIndex
            //console.log(`${tIndex} ${txHash}`)
            let res = web3Api.eth.getTransactionReceipt(txHash)
            return res
        } catch (err) {
            console.log("ERR-index_blocks_period", err);
        }
    });
    // this will fail unless we get back all receipt from a block
    let receipt = await Promise.all(receiptAsync);

    // this "null check" protects against bad data being stored in BT evmreceipts
    if (receipt.length > 0) {
        for (let i = 0; i < receipt.length; i++) {
            if (receipt[i] == null) {
                return (false);
            }
        }
    }
    return receipt
}

//curl -k -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x10cac1", true],"id":1}' https://rpc.moonriver.moonbeam.network

//https://blockscout.moonbeam.network/blocks/221001/transactions
//eth frontier header {"parentHash":"0x64547fb5b03d218d8510c328b11d7ee4639f5cf6e1504aa2a6fbe1772af6161e","ommersHash":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347","beneficiary":"0xb3e64ef8fc9df438c9a54f4b189eddc1807b55a5","stateRoot":"0xa39ce439c1e3df9d548d975ffe4dde01d20f88c589d312e0ba735480671304b5","transactionsRoot":"0x82dc0ce6a21d855276668568ab2d98ab83dddfb7b978c47bff483823a3af89b8","receiptsRoot":"0x5bea5f91118ac331208e518a00cfb06f253d091aea82cff10aa53e6dbcf10b58","logsBloom":"0x043000000000020008000400800000402000020004000000020000020088000000010020900000020002000022000200080000000084000000000200002000000000008000000000000000080000002000000000000080000000001040000040028000000300000000008000000018000011000000000001000000102000020000000204000400000000000000000100040000000001000840400040000000000202004000000101000001000000102020020100000000001000000c000000c000018002800000400000000000001000020000000000001000000000040020000110200010000000000000000000000040000000408000122004020000000009","difficulty":0,"number":221001,"gasLimit":15000000,"gasUsed":532067,"timestamp":1642513176312,"extraData":"0x","mixHash":"0x0000000000000000000000000000000000000000000000000000000000000000","nonce":"0x0000000000000000"}
//expectedHash: 0x70a75c7e0fcf0fb9c658fa08457546e08adb032d859841cbf784c9558906180e
//this is frontier format
function compute_EVM_BlockHash(h) {
    let difficulty = (h.difficulty == 0) ? '0x' : web3.utils.toHex(h.gasUsed)
    let gasUsed = (h.gasUsed == 0) ? '0x' : web3.utils.toHex(h.gasUsed)
    let ommerHash = (h.ommerHash != undefined) ? h.ommerHash : h.sha3Uncles
    let beneficiary = (h.beneficiary != undefined) ? h.beneficiary : h.author
    let mixHash = (h.mixHash != undefined) ? h.mixHash : '0x0000000000000000000000000000000000000000000000000000000000000000'
    let nonce = (h.nonce != undefined) ? h.nonce : '0x0000000000000000'
    if (h.sealFields != undefined) {
        mixHash = h.sealFields[0]
        nonce = h.sealFields[1]
    }

    let headerArr = [h.parentHash, ommerHash, beneficiary,
        h.stateRoot, h.transactionsRoot, h.receiptsRoot, h.logsBloom,
        difficulty, web3.utils.toHex(h.number), web3.utils.toHex(h.gasLimit), gasUsed, web3.utils.toHex(h.timestamp),
        h.extraData, mixHash, nonce
    ]
    console.log(headerArr)
    console.log(rlp.encode(headerArr).toString('hex'))
    let blockHash = web3.utils.keccak256(rlp.encode(headerArr))
    return blockHash
}

function compute_num_evm_logs(evmReceipts) {
    if (Array.isArray(evmReceipts)) {
        let numLog = 0
        for (const receipt of evmReceipts) {
            if (receipt && receipt.logs && receipt.logs.length !== undefined) {
                numLog += receipt.logs.length
            }
        }
        return numLog
    }
    return 0
}

async function createWeb3Api(rpcURL) {
    const Web3 = require('web3')
    if (rpcURL) {
        console.log("RPCURL", rpcURL);

        var web3Api = new Web3(rpcURL)
        var bn = await web3Api.eth.getBlockNumber()
        console.log(`web3Api ${rpcURL} is ready currentBN=${bn}`)
        return web3Api
    }
    return false
}

function loadWallet(pk) {
    const Web3 = require("web3");
    const web3 = new Web3();
    try {
        let wallet = web3.eth.accounts.privateKeyToAccount(pk);
        console.log(`evmWallet loaded: ${wallet.address}`)
        return wallet
    } catch (error) {
        console.log(`loadWallet error=${error.toString()}`)
    }
    return false
}

/* 0.1MOVR to 22023 -> 22007
Function: transfer(address, uint256, (uint8,bytes[]), uint64)
#	Name	Type	Data
1	currency_address	address	0x0000000000000000000000000000000000000802
2	amount	uint256	100000000000000000
2	destination.parents	uint8	1
2	destination.interior	bytes	0x00000007d7,0x015c88c4cdb316381d45d7dfbe59623516cfe5805808313e76f7ce6af6333a443700

Byte Value	Selector	Data Type
0x00	Parachain	bytes4
0x01	AccountId32	bytes32
0x02	AccountIndex64	u64
0x03	AccountKey20	bytes20
0x04	PalletInstance	byte
0x05	GeneralIndex	u128
0x06	GeneralKey	bytes[]

Selector	    Data Value	            Represents
Parachain	    "0x00+000007E7"	        Parachain ID 2023
AccountId32	    "0x01+AccountId32+00"	AccountId32, Network Any
AccountKey20	"0x03+AccountKey20+00"	AccountKey20, Network Any
PalletInstance	"0x04+03"	            Pallet Instance 3

see: https://docs.moonbeam.network/builders/xcm/xc20/xtokens/#xtokens-transfer-function
*/

function xTokenBuilder(web3Api, currency_address = '0x0000000000000000000000000000000000000802', amount = 1, decimals = 18, beneficiary = '0xd2473025c560e31b005151ebadbc3e1f14a2af8fa60ed87e2b35fa930523cd3c', chainIDDest = 22006) {
    console.log(`xTokenBuilder currency_address=${currency_address}, amount=${amount}, decimals=${decimals}, beneficiary=${beneficiary}, chainIDDest=${chainIDDest}`)
    var xTokensContractAbiStr = '[{"inputs":[{"internalType":"address","name":"currency_address","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint8","name":"parents","type":"uint8"},{"internalType":"bytes[]","name":"interior","type":"bytes[]"}],"internalType":"struct IxTokens.Multilocation","name":"destination","type":"tuple"},{"internalType":"uint64","name":"weight","type":"uint64"}],"name":"transfer","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
    var xTokensContractAbi = JSON.parse(xTokensContractAbiStr)
    var xTokensContractAddress = '0x0000000000000000000000000000000000000804' //this is the precompiled interface
    var xTokensContract = new web3Api.eth.Contract(xTokensContractAbi, xTokensContractAddress);
    let weight = 6000000000
    let relayChain = paraTool.getRelayChainByChainID(chainIDDest)
    let paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)
    let junction = []
    let junctionInterior = []
    junction.push(1) // local asset would have 0. (but this is not xcm?)
    if (paraIDDest != 0) {
        let parachainHex = paraTool.bnToHex(paraIDDest).substr(2)
        parachainHex = '0x' + parachainHex.padStart(10, '0')
        junctionInterior.push(parachainHex)
    }
    //assume "any"
    if (beneficiary.length == 66) {
        let accountId32 = `0x01${beneficiary.substr(2)}00`
        junctionInterior.push(accountId32)
    } else if (beneficiary.length == 42) {
        let accountKey20 = `0x03${beneficiary.substr(2)}00`
        junctionInterior.push(accountKey20)
    }
    let rawAmount = paraTool.toBaseUnit(`${amount}`, decimals)
    junction.push(junctionInterior)
    console.log(`junction`, junction)
    console.log(`junctionInterior`, junctionInterior)
    //[1,["0x00000007d4","0x01108cb67dcbaab765b66fdb99e3c4997ead09f1f82186e425dc9fec271e97aa7e00"]]
    console.log(`xTokenBuilder currency_address=${currency_address}, Human Readable Amount=${amount}(rawAmount=${rawAmount}, using decimals=${decimals}), junction=${junction}, weight=${weight}`)
    var data = xTokensContract.methods.transfer(currency_address, rawAmount, junction, weight).encodeABI()
    let txStruct = {
        to: xTokensContractAddress,
        value: '0',
        gas: 2000000,
        data: data
    }
    console.log(`xTokenBuilder txStruct=`, txStruct)
    return txStruct
}

function xc20AssetWithdrawBuilder(web3Api, currency_address = '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF', amount = 1, decimals = 18, beneficiary = '0xd2473025c560e31b005151ebadbc3e1f14a2af8fa60ed87e2b35fa930523cd3c', chainIDDest = 0) {
    let isBeneficiaryEVM = (beneficiary.length == 42) ? true : false
    console.log(`xc20Builder currency_address=${currency_address}, amount=${amount}, decimals=${decimals}, beneficiary=${beneficiary}(isEVM=${isBeneficiaryEVM}), chainIDDest=${chainIDDest}`)
    //https://github.com/AstarNetwork/astar-frame/blob/polkadot-v0.9.28/precompiles/xcm/XCM.sol
    var xc20ContractAbiStr = '[{"inputs":[{"internalType":"address[]","name":"asset_id","type":"address[]"},{"internalType":"uint256[]","name":"asset_amount","type":"uint256[]"},{"internalType":"bytes32","name":"recipient_account_id","type":"bytes32"},{"internalType":"bool","name":"is_relay","type":"bool"},{"internalType":"uint256","name":"parachain_id","type":"uint256"},{"internalType":"uint256","name":"fee_index","type":"uint256"}],"name":"assets_withdraw","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"asset_id","type":"address[]"},{"internalType":"uint256[]","name":"asset_amount","type":"uint256[]"},{"internalType":"address","name":"recipient_account_id","type":"address"},{"internalType":"bool","name":"is_relay","type":"bool"},{"internalType":"uint256","name":"parachain_id","type":"uint256"},{"internalType":"uint256","name":"fee_index","type":"uint256"}],"name":"assets_withdraw","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]'

    var xc20ContractAbi = JSON.parse(xc20ContractAbiStr)
    var xc20ContractAddress = '0x0000000000000000000000000000000000005004' //this is the precompiled interface
    var xc20Contract = new web3Api.eth.Contract(xc20ContractAbi, xc20ContractAddress);
    let weight = 6000000000
    let relayChain = paraTool.getRelayChainByChainID(chainIDDest)
    let paraIDDest = paraTool.getParaIDfromChainID(chainIDDest)
    /*
    function assets_withdraw(
    address[] calldata asset_id,
    uint256[] calldata asset_amount,
    bytes32/address  recipient_account_id,
    bool      is_relay,
    uint256   parachain_id,
    uint256   fee_index
    ) external returns (bool);
    */
    let currency_address_list = []
    let amountList = []
    let isRelay = true
    let feeIndex = 0
    let data = '0x'
    if (paraIDDest != 0) {
        isRelay = false
    }
    //only teleport one asset for now
    currency_address_list.push(currency_address)
    let rawAmount = paraTool.toBaseUnit(`${amount}`, decimals)
    amountList.push(rawAmount)
    if (isBeneficiaryEVM) {
        //0xecf766ff  /BeneficiaryEVM
        console.log(`xc20Builder method=0xecf766ff, currency_address_list=${currency_address_list}, Human Readable Amount=${amount}(amountList=${amountList}, beneficiary=${beneficiary}, using decimals=${decimals})`)
        data = xc20Contract.methods['0xecf766ff'](currency_address_list, amountList, beneficiary, isRelay, paraIDDest, feeIndex).encodeABI()
    } else if (beneficiary.length == 66) {
        //0x019054d0 /BeneficiarySubstrate
        console.log(`xc20Builder method=0x019054d0, currency_address_list=${currency_address_list}, Human Readable Amount=${amount}(amountList=${amountList}, using decimals=${decimals})`)
        data = xc20Contract.methods['0x019054d0'](currency_address_list, amountList, beneficiary, isRelay, paraIDDest, feeIndex).encodeABI()
    }
    let txStruct = {
        to: xc20ContractAddress,
        gasPrice: web3.utils.numberToHex('30052000000'), //30.052Gwei
        value: '0',
        gas: 2000000,
        data: data
    }
    console.log(`xc20Builder txStruct=`, txStruct)
    return txStruct
}

function is_tx_contract_create(tx) {
    if (!tx) return (false);
    let isCreate = (tx.creates != null)
    if (isCreate) return true
    try {
        for (const l of tx.decodedLogs) {
            //PairCreated(address,address,address,uint256)
            if (l.topics.length == 3 && l.topics[0] == '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9') {
                let pairAddr = l.events[2]['value']
                let checkSumContractAddr = web3.utils.toChecksumAddress(pairAddr)
                tx.creates = checkSumContractAddr
                return true
            }
        }
    } catch (e) {
        console.log(`is_tx_contract_create [${tx.transactionHash}] err`, err)
    }
    return isCreate;
}

function is_tx_native_transfer(tx) {
    // when native transfer happens both from and to are changed
    // todoL internal transfer
    if (tx && (tx.value !== undefined) && (tx.value != 0)) {
        return true
    }
    return (false);
}

function is_tx_token_transfer(tx) {
    if (tx !== undefined && (tx.transfers !== undefined) && tx.transfers.length > 0) {
        return true
    }
    return (false);
}

function is_tx_swap(tx) {
    if (tx !== undefined && (tx.swaps !== undefined) && tx.swaps.length > 0) {
        return true
    }
    return (false);
}


function is_tx_lp_sync(tx) {
    if (tx == undefined) return (false);
    if (tx.decodedLogs == undefined) return (false);
    let decodedLogs = tx.decodedLogs
    let syncs = []
    for (let i = 0; i < decodedLogs.length; i++) {
        let dLog = decodedLogs[i]
        if (dLog.decodeStatus == "success") {
            let syncEvent = categorizeTokenSync(dLog)
            if (syncEvent) {
                syncs.push(syncEvent)
                continue
            }
        }
    }
    if (syncs.length == 0) return false
    return syncs;
}

function int_to_hex(id) {
    return web3.utils.toHex(id)
}

function process_evm_trace(evmTrace, res, depth, stack = [], txs) {
    for (let i = 0; i < evmTrace.length; i++) {
        let t = evmTrace[i];
        try {
            if (t.value != "0x0" && stack.length > 1) {
                res.push({
                    transactionHash: txs[stack[1]].hash, //mk check
                    stack: stack,
                    from: t.from,
                    to: t.to,
                    gas: paraTool.dechexToInt(t.gas),
                    gasUsed: paraTool.dechexToInt(t.gasUsed),
                    value: paraTool.dechexToInt(t.value),
                });
            }
            if (t.calls != undefined) {
                let newStack = [...stack];
                newStack.push(i);
                // recursive call
                process_evm_trace(t.calls, res, depth + 1, newStack, txs);
            }
        } catch (err) {
            console.log(`process_evm_trace txs[stack[1]]`, txs[stack[1]])
            console.log(`process_evm_trace err=${err.toString()}`)
            console.log(`process_evm_trace t`, t)
            console.log(`process_evm_trace stack(len=${stack.length})`, stack)
            console.log(`process_evm_trace txs(len=${txs.length})`, txs)
            //process.exit(0);
        }
    }
}

module.exports = {
    toHex: function(bytes) {
        return toHex(bytes);
    },
    fromHex: function(hexStr) {
        var s = hexStr;
        if (hexStr.substr(0, 2).toLowerCase() == "0x") s = hexStr.substr(2);
        if (s == "") return new Uint8Array();
        return new Uint8Array(s.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    },
    crawlEvmBlock: async function(web3Api, bn) {
        return crawl_evm_block(web3Api, bn)
    },
    crawlEvmLogs: async function(web3Api, bn) {
        return crawl_evm_logs(web3Api, bn)
    },
    crawlEvmReceipts: async function(web3Api, blk) {
        return crawl_evm_receipts(web3Api, blk)
    },
    getERC20TokenInfo: async function(web3Api, contractAddress, bn) {
        return getERC20TokenInfo(web3Api, contractAddress, bn)
    },
    getTokenTotalSupply: async function(web3Api, contractAddress, bn) {
        return getTokenTotalSupply(web3Api, contractAddress, bn)
    },
    getERC20LiquidityPairTokenInfo: async function(web3Api, contractAddress, bn) {
        return getERC20LiquidityPairTokenInfo(web3Api, contractAddress, bn)
    },
    getERC20LiquidityPairRawReserve: async function(web3Api, contractAddress, bn) {
        return getERC20LiquidityPairRawReserve(web3Api, contractAddress, bn)
    },
    getTokenHoldersRawBalances: async function(web3Api, contractAddress, holders, tokenDecimal, bn) {
        return getTokenHoldersRawBalances(web3Api, contractAddress, holders, tokenDecimal, bn)
    },
    getNativeChainBalances: async function(web3Api, holders, bn) {
        return getNativeChainBalances(web3Api, holders, bn)
    },
    getERC721ContractInfo: async function(web3Api, contractAddress, bn) {
        return getERC721ContractInfo(web3Api, contractAddress, bn)
    },
    getERC1155ContractInfo: async function(web3Api, contractAddress, bn) {
        // stub.. not sure how to parse 1155 yet.
        return false
    },
    getERC721NFTMeta: async function(web3Api, contractAddress, tokenID, fetchMeta = false, bn = 'latest') {
        return getERC721NFTMeta(web3Api, contractAddress, tokenID, fetchMeta, bn)
    },
    computeNumEvmlogs: function(evmReceipts) {
        return compute_num_evm_logs(evmReceipts)
    },
    computeEVMBlockHash: function(block) {
        return compute_EVM_BlockHash(block)
    },
    createWeb3Api: async function(rpcURL) {
        return createWeb3Api(rpcURL)
    },
    loadWallet: function(pk) {
        return loadWallet(pk)
    },
    decodeRLPTransaction: function(rlpTx) {
        return decodeRLPTransaction(rlpTx)
    },
    signEvmTx: async function(web3Api, txStruct, wallet) {
        return signEvmTx(web3Api, txStruct, wallet)
    },
    sendSignedTx: async function(web3Api, signedTx) {
        return sendSignedTx(web3Api, signedTx)
    },
    sendSignedRLPTx: async function(web3Api, rlpTX) {
        return sendSignedRLPTx(web3Api, rlpTX)
    },
    xTokenBuilder: function(web3Api, currencyAddress, amount, decimal, beneficiary, chainIDDest) {
        return xTokenBuilder(web3Api, currencyAddress, amount, decimal, beneficiary, chainIDDest)
    },
    xc20AssetWithdrawBuilder: function(web3Api, currencyAddress, amount, decimal, beneficiary, chainIDDest) {
        return xc20AssetWithdrawBuilder(web3Api, currencyAddress, amount, decimal, beneficiary, chainIDDest)
    },
    parseAbiSignature: function(abiStrArr) {
        return parseAbiSignature(abiStrArr)
    },
    processReceipts: async function(evmReceipts, contractABIs, contractABISignatures) {
        return processReceipts(evmReceipts, contractABIs, contractABISignatures)
    },
    processTranssctions: async function(txns, contractABIs, contractABISignatures) {
        return processTranssctions(txns, contractABIs, contractABISignatures)
    },
    fuseBlockTransactionReceipt: async function(evmBlk, dTxns, dReceipts, dTrace, chainID) {
        return fuse_block_transaction_receipt(evmBlk, dTxns, dReceipts, dTrace, chainID)
    },
    decorateTxn: function(dTxn, dReceipt, dInternal, blockTS = false, chainID = false) {
        return decorateTxn(dTxn, dReceipt, dInternal, blockTS, chainID);
    },
    decodeTransactionInput: function(txn, contractABIs, contractABISignatures) {
        return decodeTransactionInput(txn, contractABIs, contractABISignatures)
    },
    isTxContractCreate: function(tx) {
        return is_tx_contract_create(tx);
    },
    isTxNativeTransfer: function(tx) {
        return is_tx_native_transfer(tx);
    },
    isTxTokenTransfer: function(tx) {
        return is_tx_token_transfer(tx);
    },
    isTxSwap: function(tx) {
        return is_tx_swap(tx);
    },
    isTxLPSync: function(tx) {
        return is_tx_lp_sync(tx);
    },
    computeTokenIDHex: function(tokenID) {
        return int_to_hex(tokenID);
    },
    crawlLink: async function(ipfsUrl) {
        return crawl_link(ipfsUrl);
    },
    convertIPFSlink: function(ipfsUrl) {
        return convert_ifps_link(ipfsUrl);
    },
    validate_bigint: function(i) {
        if (i > 0 && (i.toString().length < 30)) {
            return i;
        }
        return 0;
    },
    initContract: function(web3Api, contractABI, contractAddress) {
        return initContract(web3Api, contractABI, contractAddress)
    },
    toChecksumAddress: function(addr) {
        try {
            let checkSumAddr = web3.utils.toChecksumAddress(addr)
            return checkSumAddr
        } catch (e) {
            return null
        }
    },
    processEVMTrace: function(evmTrace, evmTxs) {
        let res = []
        process_evm_trace(evmTrace, res, 0, [0], evmTxs);
        return res
    }

};