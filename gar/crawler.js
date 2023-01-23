const xcmgarTool = require("./xcmgarTool");

const {
    ApiPromise,
    WsProvider
} = require("@polkadot/api");

const fs = require('fs');
const path = require("path");

module.exports = class crawler {

    chainkey;
    chainParser;
    api;
    paraID;

    exitOnDisconnect = true;
    isDisconneted = false;
    isConneted = false;
    disconnectedCnt = 0;
    isErrored = false;
    debugLevel = xcmgarTool.debugVerbose;

    constructor(chainkey = "relaychain-paraID", debugLevel = false) {
        this.chainkey = chainkey
        if (debugLevel) {
            this.debugLevel = debugLevel;
        }
    }

    getExitOnDisconnect() {
        let exitOnDisconnect = this.exitOnDisconnect
        return exitOnDisconnect
    }

    setExitOnDisconnect(exitOnDisconnect) {
        this.exitOnDisconnect = exitOnDisconnect
        //console.log(`*** setting ExitOnDisconnect=${this.exitOnDisconnect}`)
    }

    getDisconnectedCnt() {
        let disconnectedCnt = this.disconnectedCnt
        return disconnectedCnt
    }

    getDisconnected() {
        let disconnected = this.isDisconneted
        return disconnected
    }

    getConnected() {
        let connected = this.isConneted
        return connected
    }

    setConnected() {
        //successful connection will overwrite its previous error state
        this.isConneted = true
        this.isDisconneted = false
        this.isErrored = false
        this.disconnectedCnt = 0
    }

    setDisconnected() {
        this.isConneted = false
        this.isDisconneted = true
        this.disconnectedCnt += 1
    }

    getErrored() {
        let errored = this.isErrored
        return errored
    }

    setErrored() {
        this.isConneted = false
        this.isErrored = true
        this.disconnectedCnt += 1
    }

    async init_api(wsEndpoint) {
        let chainkey = this.chainkey
        const provider = new WsProvider(wsEndpoint);
        provider.on('disconnected', () => {
            this.setDisconnected()
            let isDisconneted = this.getDisconnected()
            let exitOnDisconnect = this.getExitOnDisconnect()
            let disconnectedCnt = this.getDisconnectedCnt()
            console.log(`*CHAIN API DISCONNECTED [exitOnDisconnect=${exitOnDisconnect}]  [disconnected=${isDisconneted}]`, chainkey);
            //if (exitOnDisconnect) process.exit(1);
            if (disconnectedCnt >= 10) {
                console.log(`*CHAIN API DISCONNECTED max fail reached!`, chainkey);
                return false
            }
        });
        provider.on('connected', () => {
            this.setConnected()
            let exitOnDisconnect = this.getExitOnDisconnect()
            console.log(`*CHAIN API connected [exitOnDisconnect=${exitOnDisconnect}]`, chainkey)
        });
        provider.on('error', (error) => {
            this.setErrored()
            let isErrored = this.getErrored()
            let exitOnDisconnect = this.getExitOnDisconnect()
            console.log(`CHAIN API error [exitOnDisconnect=${exitOnDisconnect}] [errored=${isErrored}]`, chainkey)
        });

        var api = await ApiPromise.create({
            provider: provider
        });

        api.on('disconnected', () => {
            this.setDisconnected()
            console.log('CHAIN API DISCONNECTED', chainkey);
            //if (this.exitOnDisconnect) process.exit(1);
        });
        api.on('connected', () => {
            this.setConnected()
            console.log('CHAIN API connected', chainkey)
        });
        api.on('error', (error) => {
            this.setErrored()
            console.log('CHAIN API error', chainkey, error)
        });
        return api;
    }

    async setupAPI(wsEndpoint) {
        if (!this.api) {
            this.api = await this.init_api(wsEndpoint);
        }
    }


    waitMaxAPIRetry(callback, self, chainkey, maxDisconnectedCnt) {
        let checkIntervalMS = 500
        let maxInteration = 30
        return new Promise((_, reject) => {
            let iteration = 0;
            const interval = setInterval(async () => {
                let apiInitStatus = await callback(self, chainkey, maxDisconnectedCnt, interval)
                if (apiInitStatus == 'terminate') {
                    //console.log(`waitInterval`, callback)
                    clearInterval(interval);
                    //setTimeout(() => reject(new Error(`TERMINATING ${chainkey} checkAPIStatus maxDisconnectedCnt reached!!!`)), 10);
                    return reject(new Error(`TERMINATING ${chainkey} checkAPIStatus maxDisconnectedCnt reached!!!`))
                } else if (apiInitStatus == "done") {
                    clearInterval(interval);
                }
                if (iteration >= maxInteration) {
                    clearInterval(interval);
                }
                iteration++;
            }, checkIntervalMS);
        });
    }

    wait(maxTimeMS) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`TIMEOUT in ${maxTimeMS/1000}s`)), maxTimeMS);
        });
    }

    async validateApi() {
        //TODO
        if (this.debugLevel > xcmgarTool.debugVerbose) console.log(`[chainkey=${this.chainkey}], connected=${this.getConnected()}, exitOnDisconnect=${this.getExitOnDisconnect()}`)
    }

    checkAPIStatus(self, chainkey, maxDisconnectedCnt) {
        let connected = self.getConnected()
        let disconnectedCnt = self.getDisconnectedCnt()
        // If the condition below is true the timer finishes
        let apiInitStatus = 'pending'
        if (disconnectedCnt >= maxDisconnectedCnt) {
            console.log(`${chainkey} checkAPIStatus MaxDisconnectedCnt(${maxDisconnectedCnt}) reached`)
            apiInitStatus = 'terminate'
        }
        if (connected) {
            console.log(`${chainkey} checkAPIStatus connected!`)
            apiInitStatus = 'done'
        }
        return apiInitStatus
    }

    async setupAPIWithTimeout(wsEndpoint) {
        let maxTimeMS = 30000
        let maxDisconnectedCnt = 3
        let chainkey = this.chainkey
        let resolve = this.setupAPI(wsEndpoint);
        //race: {maxTimeMS reached, maxDisconnectedCnt reached, successfully initiated} whichever comes first
        try {
            await Promise.race([this.wait(maxTimeMS), resolve, this.waitMaxAPIRetry(this.checkAPIStatus, this, chainkey, maxDisconnectedCnt)]);
        } catch (err) {
            if (this.debugLevel > xcmgarTool.debugInfo) console.log(`race error caught`, err);
        }

        let resolve2 = this.validateApi();
        await new Promise((resolve2, reject) => {
            setTimeout(() => {
                if (this.getConnected()) {
                    resolve2();
                } else {
                    console.log(`${chainkey} endpoints:${wsEndpoint} unreachable !!!`)
                    return reject(new Error(`${chainkey} endpoints:${wsEndpoint} Exit!`));
                }
            }, 10);
        });
        return true;
    }


}