const fs = require('fs');
const path = require("path");
const xcmgarTool = require("./xcmgarTool");
const endpoints = require("./endpoints");

async function generateURL(){
    let manefest = {}
    let dirs = ['assets', 'xcAssets', 'xcmRegistry']
    let relayChains = ['polkadot', 'kusama'] //skip moonbase, rococo for now
    let endpointMap = readAllEndpoints()
    for (const dir of dirs){
        switch (dir) {
            case 'xcmRegistry':
                let xcmRegistryFnList = genFilelist("", dir, endpointMap)
                manefest[dir] = xcmRegistryFnList
                break;
            case 'assets':
                manefest[dir] = {}
                for (const relayChain of relayChains){
                    let assetFnList = genFilelist(relayChain, dir, endpointMap)
                    manefest[dir][relayChain] = assetFnList
                }
            case 'xcAssets':
                manefest[dir] = {}
                for (const relayChain of relayChains){
                    let xcAssetsFnList = genFilelist(relayChain, dir, endpointMap)
                    manefest[dir][relayChain] = xcAssetsFnList
                }
            default:
        }
    }
    await writeMetaFn('metadata', 'xcmgar_url', manefest)
}

async function generateMeta(){
    let manefest = {}
    let dirs = ['assets', 'xcAssets', 'xcmRegistry']
    let relayChains = ['polkadot', 'kusama'] //skip moonbase, rococo for now
    let endpointMap = readAllEndpoints()
    for (const dir of dirs){
        switch (dir) {
            case 'xcmRegistry':
                let xcmRegistryFnList = genFilelist("", dir, endpointMap, true)
                manefest[dir] = xcmRegistryFnList
                break;
            case 'assets':
                manefest[dir] = {}
                for (const relayChain of relayChains){
                    let assetFnList = genFilelist(relayChain, dir, endpointMap, true)
                    manefest[dir][relayChain] = assetFnList
                }
            case 'xcAssets':
                manefest[dir] = {}
                for (const relayChain of relayChains){
                    let xcAssetsFnList = genFilelist(relayChain, dir, endpointMap, true)
                    manefest[dir][relayChain] = xcAssetsFnList
                }
            default:
        }
    }
    await writeMetaFn('metadata', 'xcmgar', manefest)
}

function genFilelist(relayChain = 'polkadot', fExt = 'assets', endpointMap = false, includeContent = false, defaultURL = 'https://cdn.jsdelivr.net/gh/colorfulnotion/xcm-global-registry', branch = '') {
    const logDir = ""
    let fnDir = path.join(logDir, fExt, relayChain);
    if (fExt == 'xcmRegistry'){
        fnDir = path.join(logDir, fExt);
    }
    let fn = ``
    let fnDirFn = false
    let files = false
    try {
        fnDirFn = path.join(fnDir, fn)
        files = fs.readdirSync(fnDirFn, 'utf8');
    } catch (err) {
        console.log(err, "readJSONFn", fnDirFn);
        return false
    }
    let meta = []
    switch (fExt) {
        case 'xcmRegistry':
            for (const fn of files){
                let r = fn.split('/').pop().split('_')
                let fnDirFn = path.join(fnDir, fn)
                const fnContent = fs.readFileSync(fnDirFn, 'utf8');
                let jsonObj = JSON.parse(fnContent)
                let res = {
                    relayChain: `${r[0]}`,
                    registryCnt: `${Object.keys(jsonObj).length}`,
                }
                if (!includeContent) res.url = `${defaultURL}/${branch}/${fnDir}/${fn}`
                if (includeContent) res.data = jsonObj
                if (r[0] == 'polkadot' || r[0] == 'kusama') meta.push(res) // skip moonbase, rococo for now
            }
            break;
        case 'assets':
            for (const fn of files){
                let r = fn.split('/').pop().split('_')
                let fnDirFn = path.join(fnDir, fn)
                const fnContent = fs.readFileSync(fnDirFn, 'utf8');
                let jsonObj = JSON.parse(fnContent)
                let id = null
                let chainkey = `${r[0]}-${r[1]}`
                if (endpointMap && endpointMap[chainkey] != undefined){
                    let ep = endpointMap[chainkey]
                    if (ep.id != undefined) id = ep.id
                }
                let res = {
                    relayChain: `${r[0]}`,
                    paraID: parseInt(r[1]),
                    id: id,
                    assetCnt: `${jsonObj.length}`,
                }

                if (!includeContent) res.url = `${defaultURL}/${branch}/${fnDir}/${fn}`
                if (includeContent) res.data = jsonObj
                meta.push(res)
            }
            break;
        case 'xcAssets':
            for (const fn of files){
                let r = fn.split('/').pop().split('_')
                let fnDirFn = path.join(fnDir, fn)
                const fnContent = fs.readFileSync(fnDirFn, 'utf8');
                let jsonObj = JSON.parse(fnContent)
                let id = null
                let chainkey = `${r[0]}-${r[1]}`
                if (endpointMap && endpointMap[chainkey] != undefined){
                    let ep = endpointMap[chainkey]
                    if (ep.id != undefined) id = ep.id
                }
                let res = {
                    relayChain: `${r[0]}`,
                    paraID: parseInt(r[1]),
                    id: id,
                    xcAssetCnt: `${jsonObj.length}`,
                }
                if (!includeContent) res.url = `${defaultURL}/${branch}/${fnDir}/${fn}`
                if (includeContent) res.data = jsonObj
                meta.push(res)
            }
            break;
        default:

    }
    return meta
}

function readAllEndpoints(){
    let relayChains = ['polkadot', 'kusama', 'rococo', 'moonbase'] //skip moonbase, rococo for now
    let endpointMap = {}
    for (const relayChain of relayChains){
        let publicEndpoints = readJSONFn(relayChain, 'publicEndpoints')
        for (const p of Object.keys(publicEndpoints)){
            endpointMap[p] = publicEndpoints[p]
        }
    }
    return endpointMap
}

function readFilelist(relayChain = 'polkadot', fExt = 'assets') {
    const logDir = ""
    let fnDir = path.join(logDir, fExt, relayChain);
    if (fExt == 'xcmRegistry'){
        fnDir = path.join(logDir, fExt);
    }
    let fn = ``
    let fnDirFn = false
    let files = false
    try {
        fnDirFn = path.join(fnDir, fn)
        files = fs.readdirSync(fnDirFn, 'utf8');
    } catch (err) {
        console.log(err, "readJSONFn", fnDirFn);
        return false
    }
    return files
}

function readParachainFiles(relayChain = 'polkadot', fn = 'polkadot_2000_assets.json') {
    const logDir = ""
    let pieces = fn.split('_')
    let paraID = xcmgarTool.dechexToInt(pieces[1])
    let fExt = pieces[2].split('.')[0]
    let chainkey = `${relayChain}-${paraID}`
    let fnDir = path.join(logDir, fExt, relayChain);
    let fnDirFn = false
    let jsonObj = false
    try {
        fnDirFn = path.join(fnDir, fn)
        const fnContent = fs.readFileSync(fnDirFn, 'utf8');
        jsonObj = JSON.parse(fnContent)
    } catch (err) {
        console.log(err, "readParachainAssets", fnDirFn);
        return [false, false]
    }
    let assetMap = {}
    if (fExt == 'assets'){
        for (const a of jsonObj){
            let rawAsset = a.asset
            let assetString = JSON.stringify(rawAsset)
            if (a.xcmInteriorKey != undefined) a.xcmInteriorKeyV1 = xcmgarTool.convertXcmInteriorKeyV2toV1(a.xcmInteriorKey)
            let assetChain = xcmgarTool.makeAssetChain(assetString, chainkey)
            delete a.asset
            assetMap[assetChain] = a
        }
    }else if (fExt == 'xcAssets'){
        for (const x of jsonObj){
            let xcmInteriorKeyV2 = JSON.stringify(x.xcmV1Standardized)
            //Add back the removed fields: xcCurrencyID, xcContractAddress, source, confidence
            x.xcCurrencyID = {}
            x.xcContractAddress = {}
            x.source = [paraID]
            x.confidence = 1
            x.xcCurrencyID[paraID] = x.asset
            if (x.contractAddress != undefined){
                x.xcContractAddress[paraID] = x.contractAddress
                delete x.contractAddress
            }
            delete x.Asset
            assetMap[xcmInteriorKeyV2] = x
        }
    }
    return [chainkey, assetMap]
}

function readJSONFn(relayChain, fExt = 'endpoint') {
    const logDir = "./"
    let fnDir = path.join(logDir, fExt);
    let fn = `${relayChain}_${fExt}.json`
    let fnDirFn = false
    let jsonObj = false
    try {
        fnDirFn = path.join(fnDir, fn)
        const fnContent = fs.readFileSync(fnDirFn, 'utf8');
        jsonObj = JSON.parse(fnContent)
    } catch (err) {
        console.log(err, "readJSONFn", fnDirFn);
        return false
    }
    return jsonObj
}

//asset/{relaychain}/{relaychain_paraID_fExt}
async function writeParaJSONFn(relayChain, paraID, fExt = 'assets', jsonObj = {}) {
    let jsonStr = JSON.stringify(jsonObj, null, 4)
    if (jsonObj == undefined) {
        console.log(`jsonObj missing`)
        return false
    }
    const logDir = "./"
    let fn = `${relayChain}_${paraID}_${fExt}.json`
    let fnDirFn = false
    try {
        // create fnDir directory
        let fnDir = path.join(logDir, fExt, relayChain);
        if (!fs.existsSync(fnDir)) {
            await fs.mkdirSync(fnDir);
        }
        // set up fnDir fn  (deleting old file if exists)
        try {
            fnDirFn = path.join(fnDir, fn);
            //console.log("****open_file****", fnDirFn);
            await fs.closeSync(fs.openSync(fnDirFn, 'w'));
        } catch (err) {
            console.log(`❌ Error setting up ${fnDir}`, err);
            process.exit(0)
        }
    } catch (err0) {
        console.log(`❌ Error Opening ${fn}:`, err0);
        process.exit(0)
    }
    try {
        await fs.appendFileSync(fnDirFn, jsonStr);
    } catch (err1) {
        console.log(`❌ Error writing ${fnDirFn}:`, err1);
        process.exit(0)
    }
    switch (fExt) {
        case 'assets':
            let assetCnt = jsonObj.length
            console.log(`✅ Success: ${relayChain}-${paraID} Local Asset Registry (Found:${assetCnt}) cached @\n    ${fnDirFn}`)
            break;
        case 'xcAssets':
            let xcAssetCnt = jsonObj.length
            console.log(`✅ Success: ${relayChain}-${paraID} XCM/MultiLocation Registry (Found:${xcAssetCnt}) cached @\n    ${fnDirFn}`)
            break;
        default:
            console.log(`✅ Success: ${relayChain}-${paraID} cached @n    ${fnDirFn}`)
    }
    return fnDirFn
}

async function writeJSONFn(relayChain, fExt = 'publicEndpoints', jsonObj = {}) {
    let jsonStr = JSON.stringify(jsonObj, null, 4)
    if (jsonObj == undefined) {
        console.log(`jsonObj missing`)
        return false
    }
    const logDir = "./"
    let fn = `${relayChain}_${fExt}.json`
    let fnDirFn = false
    try {
        // create fnDir directory
        let fnDir = path.join(logDir, fExt);
        if (!fs.existsSync(fnDir)) {
            await fs.mkdirSync(fnDir);
        }
        // set up fnDir fn  (deleting old file if exists)
        try {
            fnDirFn = path.join(fnDir, fn);
            //console.log("****open_file****", fnDirFn);
            await fs.closeSync(fs.openSync(fnDirFn, 'w'));
        } catch (err) {
            console.log(`❌ Error setting up ${fnDir}`, err);
            process.exit(0)
        }
    } catch (err0) {
        console.log(`❌ Error Opening ${fn}:`, err0);
        process.exit(0)
    }
    try {
        //console.log("***** write_json ***** ", fnDirFn)
        await fs.appendFileSync(fnDirFn, jsonStr);
    } catch (err1) {
        console.log(`❌ Error writing ${fnDirFn}:`, err1);
        process.exit(0)
    }

    switch (fExt) {
        case 'publicEndpoints':
            let reachableCnt = Object.keys(jsonObj).length
            console.log(`✅ Success: ${relayChain} ${reachableCnt} reachable parachain endpoints cached @\n    ${fnDirFn}`)
            break;
        case 'xcmRegistry':
            let xcmAsseCnt = Object.keys(jsonObj).length
            console.log(`✅ Success: ${relayChain} XCM Global Asset Registry (Found:${xcmAsseCnt}) cached @\n    ${fnDirFn}`)
            break;
        default:
            console.log(`✅ Success: ${relayChain} ${fExt} cached @\n    ${fnDirFn}`)
    }
    return fnDirFn
}

async function writeMetaFn(fExt = 'metadata', fType = 'xcmgarUrl', jsonObj = {}) {
    let jsonStr = JSON.stringify(jsonObj, null, 4)
    if (jsonObj == undefined) {
        console.log(`jsonObj missing`)
        return false
    }
    const logDir = "./"
    let fn = `${fType}.json`
    let fnDirFn = false
    try {
        // create fnDir directory
        let fnDir = path.join(logDir, fExt);
        if (!fs.existsSync(fnDir)) {
            await fs.mkdirSync(fnDir);
        }
        // set up fnDir fn  (deleting old file if exists)
        try {
            fnDirFn = path.join(fnDir, fn);
            //console.log("****open_file****", fnDirFn);
            await fs.closeSync(fs.openSync(fnDirFn, 'w'));
        } catch (err) {
            console.log(`❌ Error setting up ${fnDir}`, err);
            process.exit(0)
        }
    } catch (err0) {
        console.log(`❌ Error Opening ${fn}:`, err0);
        process.exit(0)
    }
    try {
        //console.log("***** write_json ***** ", fnDirFn)
        await fs.appendFileSync(fnDirFn, jsonStr);
    } catch (err1) {
        console.log(`❌ Error writing ${fnDirFn}:`, err1);
        process.exit(0)
    }

    switch (fExt) {
        default:
            console.log(`✅ Success: ${fExt} cached @\n    ${fnDirFn}`)
    }
    return fnDirFn
}

module.exports = {
    generateURL: generateURL,
    generateMeta: generateMeta,
    writeMetaFn: writeMetaFn,
    genFilelist: genFilelist,
    readAllEndpoints: readAllEndpoints,
    readFilelist: readFilelist,
    readParachainFiles: readParachainFiles,
    readJSONFn: readJSONFn,
    writeParaJSONFn: writeParaJSONFn,
    writeJSONFn: writeJSONFn,

}
