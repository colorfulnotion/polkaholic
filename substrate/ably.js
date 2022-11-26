async function main() {

    const Ably = require('ably');
    // setup ably realtime client and channel -- use your own API key here
    var client = new Ably.Realtime("DTaENA.C13wMg:WBLRXZd-9u73gBtrFc19WPFrkeX0ACnW0dhRrYPaRuU");
    await client.connection.once('connected');
    // channel name: "xcminfo" can be replaced with "moonbeam", "astar", "interlay", etc.
    var channel = client.channels.get("xcminfo");
    console.log("open")
    await channel.subscribe(function(message) {
        console.log('Received xcminfo: ', message);
    });
}

main()
    .then(() => {

    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });