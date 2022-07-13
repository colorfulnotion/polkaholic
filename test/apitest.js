const axios = require("axios");

class PolkaholicAPI {
    endpoint = "https://api.polkaholic.io";
    authKey = "<FILLIN>";
    timeoutMS = 10000;

    constructor(k) {
        this.authKey = k;
    }

    async doAPICall(url) {
        let headers = {
            "Content-Type": "application/json",
            "Authorization": this.authKey
        };
        let fullUrl = this.endpoint + url;
        let startTS = new Date().getTime();
        let result = await axios.get(fullUrl, {
            headers: headers,
            timeout: this.timeoutMS
        });
        let ts = (new Date().getTime() - startTS) / 1000
        console.log("doAPICall", ts, fullUrl);

        return (result.data);
    }

    async getChains() {
        return await this.doAPICall("/chains")
    }

    async getChain(chainID) {
        return await this.doAPICall(`/chain/${chainID}`)
    }

    async getChainAssets(chainID) {
        return await this.doAPICall(`/chain/assets/${chainID}`)
    }

    async getBlock(chainID, blockNumber) {
        return await this.doAPICall(`/block/${chainID}/${blockNumber}`);
    }

    async getBlockByBlockHash(blockHash) {
        return await this.doAPICall(`/hash/blockhash/${blockHash}`);
    }

    async getTx(extrinsicHash) {
        return await this.doAPICall(`/tx/${extrinsicHash}`);
    }

    async getXCMTransfers() {
        return await this.doAPICall("/xcmtransfers");
    }

    async getSpecVersions(chainID) {
        return await this.doAPICall(`/specversions/${chainID}`);
    }

    async getAccount(address, section = "realtime") {
        // sections: [ "extrinsics", "transfers", "crowdloans", "rewards", "xcmtransfers", "realtime", "history", "related", "balances" ]
        return await this.doAPICall(`/account/${section}/${address}`)
    }

    async getAsset(assetChain) {
        return await this.doAPICall(`/asset/${encodeURIComponent(assetChain)}`)
    }

    async getAssetPriceFeed(assetChain) {
        return await this.doAPICall(`/asset/pricefeed/${encodeURIComponent(assetChain)}`)
    }

    async getAssetHolders(assetChain) {
        return await this.doAPICall(`/asset/holders/${encodeURIComponent(assetChain)}`)
    }

    async getAssetRelated(assetChain) {
        return await this.doAPICall(`/asset/related/${encodeURIComponent(assetChain)}`)
    }
}

async function main() {
    let polkaholic = new PolkaholicAPI("<FILLIN>")

    // getChains
    let chains = await polkaholic.getChains();
    console.log("getChains", chains.length);

    // getChain
    let chain = chains[0];
    let chainID = chain.id;
    let chainInfo = await polkaholic.getChain(chainID);
    console.log("getChain");
    let blocks = chainInfo.blocks;
    let chainInfoChain = chainInfo.chain;
    let blockNumber = blocks[0].blockNumber;

    // getBlock
    let block = await polkaholic.getBlock(chainID, blockNumber)
    console.log("getBlock", chainID, blockNumber);
    let blockHeader = block.header;
    let blockExtrinsics = block.extrinsics;
    let extrinsic = blockExtrinsics[0];

    // getTx
    let extrinsicHash = extrinsic.extrinsicHash;
    let tx = await polkaholic.getTx(extrinsicHash);
    console.log("getTx", extrinsicHash);

    // getSpecVersions
    let specVersions = await polkaholic.getSpecVersions(chainID);
    console.log("getSpecVersions");
    let specVersion = specVersions[0];

    // getXCMTransfers
    let xcmtransfers = await polkaholic.getXCMTransfers();
    console.log("getXCMTransfers", xcmtransfers.length);
    let xcmtransfer = xcmtransfers[0];

    // getAccount [with various sections]
    let fromAddress = xcmtransfer.fromAddress;
    let sections = ["extrinsics", "transfers", "crowdloans", "rewards", "xcmtransfers", "realtime", "history", "related"]
    for (const section of sections) {
        let result = await polkaholic.getAccount(fromAddress, section);
        console.log("getAccount", section);
    }

    let assetChain = '{"Token":"DOT"}#0';
    let asset = await polkaholic.getAsset(assetChain);
    console.log("getAsset", asset);

    let assetPriceFeed = await polkaholic.getAssetPriceFeed(assetChain);
    console.log("getAssetPriceFeed", assetPriceFeed);

    let assetHolders = await polkaholic.getAssetHolders(assetChain);
    console.log("getAssetHolders", assetHolders);

    let assetRelated = await polkaholic.getAssetRelated(assetChain);
    console.log("getAssetRelated", assetRelated);

    console.log("done");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });