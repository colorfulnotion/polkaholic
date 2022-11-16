const CrawlerManager = require("../crawlermanager");
const Crawler = require("../crawler");
const {
    ApiPromise,
    WsProvider
} = require('@polkadot/api');
const paraTool = require("../paraTool");
const ethTool = require("../ethTool");
const {
    hexToU8a,
    compactStripLength,
    hexToBn
} = require("@polkadot/util");

let isDevelopment = (process.env.NODE_ENV == "development") ? true : false
var debugLevel = paraTool.debugErrorOnly
if (isDevelopment) {
    //debugLevel = paraTool.debugTracing
    debugLevel = paraTool.debugInfo
    console.log(`[isDevelopment:${isDevelopment}] debugLevel: ${debugLevel}`)
}

let relayChainID = paraTool.chainIDPolkadot;

/*
{
    "15066440": [
        "1666880418|dmp|kusama|15066440|0x5a14d90703613793359bce23a06266c94295753a99b019cda4894b0c28912c82|0x7b3bedcb04330b09bc273387f229074e18a20d874ae6ded480b9a8171faf3045|2|22085|15066440|15066440|15066440|0xdcb8da8d1187088fe75d16ff8dfe0a90ca4614f3ebfa983142b0aa01580087cc"
    ],
    "15066441": [
        "1666880424|hrmp|kusama|15066441|0x0584bfba203155d7a01691d8713b3c614c525378abe3ed0e41ede19a115b9761|0xf3b2df8edf35468925d1a9012a1a1cfdbb65cdb37f0b73cf25c6bc4e3f9b4163|22001|22023|15066440|15066441|15066442|0x92ca282cfdbbb6b94cd96203c86eeb2e1ffc43826a127d0e1d42421b23117cff",
        "1666880424|hrmp|kusama|15066441|0x0584bfba203155d7a01691d8713b3c614c525378abe3ed0e41ede19a115b9761|0xf3b2df8edf35468925d1a9012a1a1cfdbb65cdb37f0b73cf25c6bc4e3f9b4163|22001|22023|15066440|15066441|15066442|0xf7865e76da23b6632892b12fa65c730a737af81b6155ad0fe26fd31fc5d32e33"
    ],
    "15066445": [
        "1666880448|dmp|kusama|15066445|0x99e67d0145cfb9ec2a1c2170ed2343b182fe6e264301e49f265804d89ae4bd27|0x6cdcd3185a601e5818305c301ba5bf2de23b4d976acea4eed10fcf731bbf9780|2|22023|15066445|15066445|15066445|0x873d04f88969898bb1e90a511fda25242e83e1c915aedca81aeb16cb66e7c82b"
    ],
    "15066446": [
        "1666880454|dmp|kusama|15066446|0xfedb7d7ef0b32476a674648d5aea63cc9b3482411df44aa9e02792625d421a88|0xc9d15d34558a6fa84ce56f721fefcab2e944f2b2ca8f495f13ef084808ddbd02|2|22023|15066445|15066445|15066445|0x873d04f88969898bb1e90a511fda25242e83e1c915aedca81aeb16cb66e7c82b"
    ]
}
*/
async function main() {
    let crawlermanager = new CrawlerManager();
    await crawlermanager.initManagerState()
    crawlermanager.setDebugLevel(debugLevel)
    crawlermanager.exitOnDisconnect = true;
    await crawlermanager.initRelayCrawler(relayChainID)
    let targetSQL = `select floor(UNIX_TIMESTAMP(blockTS)/3600)*3600 as indexTS, blockNumber, blockTS, blockHash, stateRoot, convert(xcmMeta using utf8) as xcmMeta from xcmmeta${relayChainID} where blockTS >= 1666879200 and blockTS < 1666882800 order by indexTS;`
    console.log(`targetSQL`, targetSQL)
    let recs = await crawlermanager.poolREADONLY.query(targetSQL);
    let xcmMetaMap = {}
    for (const rec of recs) {
        try {
            xcmMetaMap[rec.blockNumber] = JSON.parse(rec.xcmMeta)
        } catch (e) {
            console.log(`err`, e)
        }
    }
    //console.log(`xcmMetaMap`, xcmMetaMap)
    let xcmMetaMapStr = JSON.stringify(xcmMetaMap)
    let xcmMap = crawlermanager.decodeXcmMetaMap(xcmMetaMapStr)

    console.log(`xcmMap`, xcmMap)
    let [blockRangeMap, hrmpRangeMap] = await crawlermanager.analyzeXcmMap(xcmMap)
    let blockRangeMapStr = JSON.stringify(blockRangeMap)
    console.log(`blockRangeMap(len=${blockRangeMapStr.length})`, blockRangeMapStr)
    console.log(`hrmpRangeMap`, hrmpRangeMap)
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });