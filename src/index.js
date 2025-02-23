const { Client, Events, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');
const { DisTube, DisTubeVoice, DisTubeVoiceManager, Song, RepeatMode } = require("distube");
const { YouTubePlugin } = require("@distube/youtube");
const path = require("path")
const favicon = require("serve-favicon");

require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 4321;

const { Server } = require("socket.io");
const express = require("express");
const cors = require('cors');
const { channel } = require('diagnostics_channel');
const { getVoiceConnection } = require('@discordjs/voice');
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/static/", express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

// Create http server from express server for socket.io
const server = require("http").createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
    socket.emit("init", "Please provide the guildId", (guildId) => {
        console.log("Client-Socket joining guild: ", guildId);
        socket.join(guildId);

        distube.emit("state-change", guildId);
    });
});

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
        const queue = distube.getQueue(interaction.guild);
        if(queue) queue.textChannel = interaction.channel;

		await command.execute(interaction, distube);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}

    distube.emit("state-change", interaction.guildId);
})

const youtubePlugin = new YouTubePlugin();

const distube = new DisTube(client, {
  plugins: [youtubePlugin],
  joinNewVoiceChannel: true,
  emitNewSongOnly: true,
});

distube.on("error", (error, queue, song) => {
    console.log(`[Error]: ${error.message}`);
});

distube.on("debug", (debug) => {
    console.log(`[Debug]: ${debug}`);
});

distube.on("finish", (queue) => {
    const embed = new EmbedBuilder()
            .setColor("Purple")
            .setDescription("No more songs!");
        
    queue.textChannel?.send({embeds: [embed]});
    console.log(`[DeleteQueue]: ${queue}`);
});

distube.on("playSong", async (queue, song) => {
    const embed = new EmbedBuilder()
        .setColor("Blue")
        .setDescription(`Now playing: [${song.name}](${song.url})`);
    await queue.textChannel?.send({embeds: [embed]});

    distube.emit("state-change", queue.id);
});

distube.on("addSong", async (queue, song) => {
    const embed = new EmbedBuilder()
        .setColor("Green")
        .setDescription(`Added [${song.name}](${song.url}) to playlist!`);
    
    if(song.metadata?.interaction) {
        song.metadata.interaction.followUp({embeds: [embed]});
    } else {
        queue.textChannel?.send({embeds: [embed]});
    }
})

distube.on("state-change", (guildId) => {
    const info = getInfo(guildId);
    io.to(guildId).emit("state-change", info);
});

function getInfo(guildId) {
    const queue = distube.getQueue(guildId);
    const guild = client.guilds.cache.get(guildId);
    let voiceChannel = null;
    let queueInfo = null;

    if (guild) {
        const botMember = guild.members.me; // Gets the bot's member object
        if (botMember && botMember.voice.channel) {
            voiceChannel = {
                name: botMember.voice.channel.name,
                id: botMember.voice.channel.id,
            };
        }
    }

    if (queue) {
        const songs = queue.songs.map(({ source, name: title, duration, url, thumbnail }) => {
            return { source, title, duration, url, thumbnail };
        });

        queueInfo = {
            guild: queue.voiceChannel.guild.name,
            guildId: queue.voiceChannel.guildId,
            songs,
            paused: queue.paused,
            looping: queue.repeatMode,
            currentTime: queue.currentTime,
            volume: queue.volume
        };

        // Ensure voiceChannel is correctly set from queue if available
        voiceChannel = {
            name: queue.voiceChannel.name,
            id: queue.voiceChannel.id,
        };
    }

    if (!voiceChannel && !queueInfo) return null;

    return {
        voiceChannel,
        queueInfo
    };
}

app.post("/query", async (req, res) => {
    const { query } = req.body;

    if(!query) {
        res.status(400);
        return res.send();
    }

    try {
        const result = await distube.handler.resolve(query);

        if(!result || !(result instanceof Song)) {
            console.log("Error");
            res.status(500);
            return res.json({error: "Error occurred while searchig for song!"});
        }

        const { source, name: title, duration, url, thumbnail } = result;
        const song = { source, title, duration, url, thumbnail };

        // console.log(song);

        res.status(200);
        return res.json(song);
    } catch(error) {
        console.error(error);
        res.status(500);
        return res.json(error);
    }
});

// INSECURE!!
app.get("/guilds", async (req, res) => {
    const guilds = client.guilds.cache.map((guild) => {
        return { 
            id : guild.id,
            name: guild.name,
            iconURL: guild.iconURL()
        };
    });

    res.json(guilds);
});

app.get("/channels", async (req, res) => {
    const { guildId } = req.query;
    if(!guildId) {
        res.status(400);
        res.send("Missing ?guildId=");
    }

    const guild = await client.guilds.fetch(guildId);
    if(!guild) {
        res.status(400);
        res.send("Guild not found!");
    }

    const voiceChannels = guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildVoice)
        .map(channel => ({ id: channel.id, name: channel.name }));
        
    res.json(voiceChannels);
});

app.post("/join", async (req, res) => {
    const { guildId, channelId } = req.body;
    
    const channel = await client.channels.fetch(channelId);
    if(!channel) {
        res.status(400);
        res.send("Channel not found!");
    }

    await distube.voices.join(channel);
    distube.emit("state-change", guildId);

    res.status(200);
    res.send();
});

app.post("/add-song", async (req, res) => {
    const { guildId, song } = req.body;

    const channel = await distube.voices.get(guildId)?.channel;
    if(!channel) {
        res.status(400);
        return res.send("Channel not found!");
    }

    try {
        await distube.play(channel, song, {
            skip: false,
        });

        distube.emit("state-change", guildId);

        res.status(200);
        return res.send();
    } catch(error) {
        console.error(error);
        res.status(500);
        res.json(error)
    }
});

app.post("/pause-toggle", async (req, res) => {
    const { guildId } = req.body;

    const queue = distube.getQueue(guildId);
    if(!queue) {
        res.status(400);
        res.send("Channel not found!");
    }

    if(queue.paused) {
        queue.resume();
    } else {
        queue.pause();
    }

    distube.emit("state-change", guildId);

    res.status(200);
    res.send();
});

app.post("/skip", async (req, res) => {
    const { guildId } = req.body;

    const queue = distube.getQueue(guildId);
    if(!queue) {
        res.status(400);
        res.send("Queue not found!");
    }

    try {
        await distube.skip(guildId);

        queue.repeatMode = RepeatMode.DISABLED;
    } catch(error) {
        if(error.code === "NO_UP_NEXT") {
            await distube.stop(guildId);
            distube.emit("finish", queue);
        } else {
            res.status(500);
            res.json(error);
        }
    }

    distube.emit("state-change", guildId);

    res.status(200);
    res.send();
});

app.post("/loop", async (req, res) => {
    const { guildId } = req.body;

    const queue = distube.getQueue(guildId);
    if(!queue) {
        res.status(400);
        res.send("Queue not found!");
    }
    if(queue.repeatMode === RepeatMode.DISABLED) {
        queue.repeatMode = RepeatMode.SONG;
    } else {
        queue.repeatMode = RepeatMode.DISABLED;
    }

    distube.emit("state-change", guildId);

    res.status(200);
    res.json({looping: queue.RepeatMode});
});

client.login(BOT_TOKEN).then(() => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);

    server.listen(PORT, "0.0.0.0", () => {
        console.log(`Server listening on port ${PORT}`);
    });
});