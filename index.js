const { Client, Events, GatewayIntentBits } = require('discord.js');
const { DisTube, DisTubeVoice, DisTubeVoiceManager } = require("distube");
const { YouTubePlugin } = require("@distube/youtube");

const { token } = require('./config.json');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

const distube = new DisTube(client, {
  plugins: [new YouTubePlugin()],
});

client.login(token).then(() => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
});