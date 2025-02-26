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
const { default: axios } = require('axios');
const session = require('express-session');
const app = express();

const apiRoutes = require("./routes/api")(distube, client);
app.use("/", apiRoutes);

const { authRoutes, isAuthenticated } = require("./routes/auth");
app.use("/auth", authRoutes);

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/static/", express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false
    })
);

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

client.login(BOT_TOKEN).then(() => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);

    server.listen(PORT, "0.0.0.0", () => {
        console.log(`Server listening on port ${PORT}`);
    });
});