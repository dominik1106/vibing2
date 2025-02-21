const { Client, Events, GatewayIntentBits } = require('discord.js');
const { DisTube, DisTubeVoice, DisTubeVoiceManager } = require("distube");
const { YouTubePlugin } = require("@distube/youtube");

const { token } = require('../config.json');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});
client.commands = require("./deploy-commands");

client.on(Events.InteractionCreate, async interaction => {
    if(!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
})

const distube = new DisTube(client, {
  plugins: [new YouTubePlugin()],
  joinNewVoiceChannel: true,
});

distube.on("error", (error, queue, song) => {
    console.log(`[Error]: ${error.message}`);
});

distube.on("debug", (debug) => {
    console.log(`[Debug]: ${debug}`);
});

distube.on("finish", (queue) => {
    console.log(`[Finish]: ${queue}`);
})

distube.on("deleteQueue", (queue) => {
    console.log(`[DeleteQueue]: ${queue}`);
})

async function joinChannel(channelId, song) {
    const channel = await client.channels.fetch(channelId);
    if(!channel) {
        console.error("Did not find channel!");
        return;
    }

    await distube.voices.join(channel);
}

async function addSong(guildId, channelId = null, song) {
    let channel = null;
    if(!channelId) {
        channel = distube.voices.get(guildId).channel;
        if(!channel && !channelId) {
            console.error("Bot not connected to voice channel!");
            return;
        }
    } else {
        channel = await client.channels.fetch(channelId);
    }

    if(!channel) {
        console.error("Did not find channel!");
        return;
    }

    await distube.play(channel, song, {
        skip: false,
    });
}

async function togglePause(guildId) {
    const queue = distube.getQueue(guildId);
    if(!queue) {
        console.error("Queue not found!");
        return;
    }

    if(queue.paused) {
        queue.resume();
    } else {
        queue.pause();
    }
}

async function skip(guildId) {
    try {
        await distube.skip(guildId);
    } catch(error) {
        if(error.code === "NO_UP_NEXT") {
            await distube.stop(guildId);
        }
    }
}

client.login(token).then(() => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
});