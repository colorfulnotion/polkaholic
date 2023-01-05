//const paraTool = require("./paraTool");
const endpoints = require("./endpoints");

const {
    ApiPromise,
    WsProvider
} = require("@polkadot/api");

const fs = require('fs');
const path = require("path");

module.exports = class GlobalAssetRegistry {

    fnDirFn = {};
    chains = {};
    debugLevel;

    constructor(debugLevel = false) {
        if (debugLevel) {
            this.debugLevel = debugLevel;
        }
    }

    getEndpoints(){
        return endpoints.getAllEndpoints();
    }

    readJSONFn(relayChain, fExt = 'endpoint') {
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

    async writeJSONFn(relayChain, fExt = 'endpoint', jsonObj = {}){
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
                console.log("****open_file****", fnDirFn);
                await fs.closeSync(fs.openSync(fnDirFn, 'w'));
            } catch (err) {
                console.log(err);
            }
        } catch (err) {
            console.log(err, "open_file", fn);
        }
        try {
            console.log("***** write_json ***** ", fnDirFn)
            await fs.appendFileSync(fnDirFn, jsonStr);
        } catch (err1) {
            console.log(err1, "write_json", fnDirFn, jsonObj);
        }
    }

    async open_log(relayChain, fType = 'endpoint') {
        const logDir = "./"
        let fn = `${relayChain}_${fType}.json`
        try {
            // create fnDir directory
            let fnDir = path.join(logDir, fType);
            if (!fs.existsSync(fnDir)) {
                await fs.mkdirSync(fnDir);
            }
            // set up fnDir fn  (deleting old file if exists)
            try {
                this.fnDirFn = path.join(fnDir, fn);
                console.log("****open_log****", this.fnDirFn);
                await fs.closeSync(fs.openSync(this.fnDirFn, 'w'));
            } catch (err) {
                console.log(err);
            }
        } catch (err) {
            console.log(err, "open_log", fn);
        }
    }

    async write_log(list = []) {
        if (list.length > 0) {
            list.push("");
            try {
                console.log("***** write_log ***** ", this.fnDirFn)
                await fs.appendFileSync(this.fnDirFn, list.join("\n"));
            } catch (err) {
                console.log(err, "write_log", this.fnDirFn, list);
            }
        }
    }

    async write_json(jsonObj = {}) {
        if (jsonObj != undefined) {
            let jsonStr = JSON.stringify(jsonObj, null, 4)
            try {
                console.log("***** write_json ***** ", this.fnDirFn)
                await fs.appendFileSync(this.fnDirFn, jsonStr);
            } catch (err) {
                console.log(err, "write_json", this.fnDirFn, jsonObj);
            }
        }
    }
    /*
    async setupAPI(wsEndpoint='') {
        const provider = new WsProvider(wsEndpoint);
        const api = await ApiPromise.create({
            provider
        });
        await api.isReady;
        console.log(`${wsEndpoint} ready`)
    }
    */
}
