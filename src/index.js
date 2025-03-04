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
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "./views"));

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
        // console.log("Client-Socket joining guild: ", guildId);
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

client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.id === client.user.id) {
        const guildId = newState.guild.id;
        if (newState.channelId !== oldState.channelId) {
            distube.emit("state-change", guildId);
        }
    }
});

const youtubePlugin = new YouTubePlugin();

const distube = new DisTube(client, {
  plugins: [youtubePlugin],
  joinNewVoiceChannel: true,
});

const apiRoutes = require("./routes/api")(distube, client);
const { authRoutes, isAuthenticated } = require("./routes/auth");

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

    distube.emit("state-change", queue.id);
});

distube.on("playSong", async (queue, song) => {
    if(!song.metadata?.repeat) {
        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setDescription(`Now playing: [${song.name}](${song.url})`);
        await queue.textChannel?.send({embeds: [embed]});
        song.metadata.repeat = true;
    }

    if(song.metadata?.startTime) {
        queue.seek(song.metadata.startTime);
    }

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

    distube.emit("state-change", queue.id);
})

distube.on("state-change", async (guildId) => {
    const info = await getInfo(guildId);
    io.to(guildId).emit("state-change", info);
});

async function getInfo(guildId) {
    const queue = distube.getQueue(guildId);
    const guild = await client.guilds.fetch(guildId);
    let voiceChannel = null;
    let queueInfo = null;

    if (guild) {
        const botMember = await guild.members.fetch(client.user.id);
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

        let textChannel = null;
        if(queue.textChannel) {
            textChannel = {
                name: queue.textChannel.name,
                id: queue.textChannel.id
            };
        }

        let looping = (queue.repeatMode === 1) ? true : false;

        queueInfo = {
            guild: queue.voiceChannel.guild.name,
            guildId: queue.voiceChannel.guildId,
            songs,
            paused: queue.paused,
            looping,
            currentTime: queue.currentTime,
            volume: queue.volume,
            textChannel: textChannel
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

async function getMutualServer(access_token) {
    try {
        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${access_token}`
            }
        });

        const commonGuilds = guildsResponse.data.filter(guild => 
            client.guilds.cache.has(guild.id)
        ).map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon
        }));

        return commonGuilds;
    } catch(error) {
        console.error("Error while fetching guilds from discord api!");
    }
}

async function checkMembership(guildId, userId) {
    const guild = await client.guilds.fetch(guildId);

    if(!guild) {
        return null;
    }

    try {
        const member = await guild.members.fetch(userId);

        const channels = await guild.channels.fetch();

        const voiceChannels = channels
            .filter(channel => channel.type === ChannelType.GuildVoice)
            .map(channel => ({ id: channel.id, name: channel.name }));

        const textChannels = channels
            .filter(channel => channel.type === ChannelType.GuildText)
            .map(channel => ({ id: channel.id, name: channel.name }));

        return {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            voiceChannels,
            textChannels,
            systemChannelId: guild.systemChannelId
        };
    } catch(error) {
        return null;
    }
}

// filter out access_token and refresh_token before passing to ejs
function getFrontendUser(user) {
    if(!user) return null;

    return {
        id: user.id,
        username: user.username,
        global_name: user.global_name
    };
}

app.get("/", async (req, res) => {
    let guilds = null;
    let user = null;
    if(req.session.user) {
        guilds = await getMutualServer(req.session.user.access_token);
        user = getFrontendUser(req.session.user);
    }
    
    res.render("index", { user, guilds, URL: process.env.URL });
});

app.get("/dashboard", isAuthenticated, async (req, res) => {
    const { guildId } = req.query;
    const guild = await checkMembership(guildId, req.session.user.id);
    const user = getFrontendUser(req.session.user);

    if(!guild) {
        res.status(400).send("Either this guild does not exist, you are not a member, or the bot is not in this guild!");
    }

    // console.log(guild);
    res.render("dashboard", { user, guild, URL: process.env.URL })
});

app.use("/", apiRoutes);
app.use("/auth", authRoutes);

client.login(BOT_TOKEN).then(() => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);

    server.listen(PORT, "0.0.0.0", () => {
        console.log(`Server listening on port ${PORT}`);
    });
});