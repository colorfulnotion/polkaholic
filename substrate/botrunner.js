const fs = require('fs');
const paraTool = require("./paraTool");
const TelegramBot = require("./telegramBot");

async function main() {
    // Create a bot that uses 'polling' to fetch new updates
    var telegrambot = new TelegramBot();

    await telegrambot.initTelegramUsers();
    await telegrambot.initBot();
    telegrambot.start();

}

main()
    .then(() => console.log(`BOT Running`))
    .catch((e) => {
        console.error('ERROR', e);
        process.exit(1);
    });