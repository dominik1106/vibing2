const express = require("express");
const { Client, Events, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');
const { DisTube, DisTubeVoice, DisTubeVoiceManager, Song, RepeatMode } = require("distube");

module.exports = (distube, client) => {
    const router = express.Router();

    router.post("/query", async (req, res) => {
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
    router.get("/guilds", async (req, res) => {
        const guilds = client.guilds.cache.map((guild) => {
            return { 
                id : guild.id,
                name: guild.name,
                iconURL: guild.iconURL()
            };
        });
    
        res.json(guilds);
    });
    
    router.get("/channels", async (req, res) => {
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
        
        const textChannels = guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildText)
            .map(channel => ({ id: channel.id, name: channel.name }));
            
        res.json({
            voiceChannels,
            textChannels
        });
    });
    
    router.post("/join", async (req, res) => {
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
    
    router.post("/add-song", async (req, res) => {
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
    
    router.post("/pause-toggle", async (req, res) => {
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
    
    router.post("/skip", async (req, res) => {
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
    
    router.post("/loop", async (req, res) => {
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

    return router;
}