const { Client, Events, GatewayIntentBits } = require('discord.js');
const { DisTube, DisTubeVoice, DisTubeVoiceManager, Song } = require("distube");
const { YouTubePlugin } = require("@distube/youtube");
const path = require("path")
const favicon = require("serve-favicon");

require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 4321;

const { Server } = require("socket.io");
const express = require("express");
const cors = require('cors');
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

        const info = getInfo(guildId);
        socket.emit("state-change", info);
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
});

distube.on("error", (error, queue, song) => {
    console.log(`[Error]: ${error.message}`);
});

distube.on("debug", (debug) => {
    console.log(`[Debug]: ${debug}`);
});

distube.on("deleteQueue", (queue) => {
    if(queue.textChannel && queue.voiceChannel) {
        queue.textChannel.send("No more songs!");
    }
    console.log(`[DeleteQueue]: ${queue}`);
});

distube.on("state-change", (guildId) => {
    const info = getInfo(guildId);
    io.to(guildId).emit("state-change", info);
});

function getInfo(guildId) {
    const queue = distube.getQueue(guildId);
    // console.log(queue.songs);
    if(!queue) {
        return null;
    }

    const songs = queue.songs.map(({ source, name: title, duration, url, thumbnail }) => {
        return { source, title, duration, url, thumbnail }
    });

    const voiceChannel = {
        name: queue.voiceChannel.name,
        id: queue.voiceChannel.id,
    };

    const info = {
        guild: queue.voiceChannel.guild.name,
        guildId: queue.voiceChannel.guildId,
        songs,
        voiceChannel,
        paused: queue.paused,
        looping: queue.repeatMode,
        currentTime: queue.currentTime,
        volume: queue.volume
    };

    return info;
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

    const channel = await client.channels.fetch(channelId);
    if(!channel) {
        res.status(400);
        res.send("Channel not found!");
    }

    try {
        await distube.play(channel, song, {
            skip: false,
        });

        distube.emit("state-change", guildId);

        res.status(200);
        res.send();
    } catch(error) {
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

    try {
        await distube.skip(guildId);

        distube.emit("state-change", guildId);

        const queue = distube.getQueue(guildId);
        if(!queue) {
            res.status(400);
            res.send("Queue not found!");
        }
        queue.repeatMode = RepeatMode.DISABLED;
    } catch(error) {
        if(error.code === "NO_UP_NEXT") {
            await distube.stop(guildId);
        } else {
            res.status(500);
            res.json(error);
        }
    }

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