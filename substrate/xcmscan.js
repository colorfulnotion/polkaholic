#!/usr/bin/env node
 // Usage: node xcmscan.js

const WebSocket = require('ws');
const fs = require("fs");
const XCMTracer = require("./xcmtracer");

async function main() {
    let tracer = new XCMTracer();
    await tracer.assetManagerInit();
    let chain = await tracer.getChain(0);
    await tracer.setupAPI(chain);

    const port = 9101
    const wss = new WebSocket.Server({
        port
    });
    console.log(`XCMScan Listening on ${port}`);

    wss.on('connection', function connection(ws) {
        ws.on('message', async function message(data) {
            try {
                let line = data.toString();
                console.log(line);
                fs.appendFileSync("/root/xcmscan.log", line + "\n")
                tracer.receiveMsg(JSON.parse(line), 300);
                await tracer.match()
            } catch (err) {
                console.log(err);
            }
        });
    });
}

main()
    .then(() => {
        //process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });
