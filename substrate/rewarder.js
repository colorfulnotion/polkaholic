const AssetManager = require("./assetManager");
const {
    Keyring
} = require("@polkadot/api");
const fs = require('fs');

const FN = ''
const NAME = ''
class Rewarder extends AssetManager {
    async sendHOLIC(toAddress, amount) {
        // HOLIC is assetID 1107
        const assetID = 1107;
        // statemine chainID 21000
        let chain = await this.getChain(21000)
        await this.setupAPI(chain)

        const privateSeed = fs.readFileSync(FN, 'utf8');
        var keyring = new Keyring();
        var rewardBot = keyring.addFromUri(
            privateSeed, {
                name: NAME,
            },
            "sr25519"
        );

        var hash = await this.api.tx.assets.transfer(assetID, {
            id: toAddress
        }, amount.toString()).signAndSend(rewardBot);
        return hash.toHex();
    }
}

async function main() {
    const rewarder = new Rewarder();
    let toAddress = "E5uyaZNkQPiaB6t5xfU7QPt4npcpkeTwfoFXRUtpRkmSscj";
    let amount = 31415926535
    let hash = await rewarder.sendHOLIC(toAddress, amount);
    console.log("Transfer sent with hash", hash);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });