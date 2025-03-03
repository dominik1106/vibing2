const express = require("express");
const { Client, Events, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');
const { DisTube, DisTubeVoice, DisTubeVoiceManager, Song, RepeatMode } = require("distube");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = (distube, client) => {
    const router = express.Router();

    router.post("/query", async (req, res) => {
        const { query } = req.body;
    
        if(!query) {
            res.status(400);
            return res.json({
                error: "missing query body parameter!",
            });
        }
    
        try {
            const result = await distube.handler.resolve(query);
    
            if(!result || !(result instanceof Song)) {
                res.status(500);
                return res.json({error: "Error occurred while searchig for song!"});
            }
    
            const { source, name: title, duration, url, thumbnail } = result;
            const song = { source, title, duration, url, thumbnail };
    
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
            return res.json({
                error: "missing guildId query parameter!",
            });
        }
    
        const guild = await client.guilds.fetch(guildId);
        if(!guild) {
            res.status(400);
            return res.json({
                error: "guild not found!",
            });
        }
    
        const voiceChannels = guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildVoice)
            .map(channel => ({ id: channel.id, name: channel.name }));
        
        const textChannels = guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildText)
            .map(channel => ({ id: channel.id, name: channel.name }));
            
        return res.json({
            voiceChannels,
            textChannels
        });
    });
    
    router.post("/join", async (req, res) => {
        const { guildId, channelId } = req.body;

        let channel = null
        try {
            channel = await client.channels.fetch(channelId);
        } catch(error) {
            res.status(500);
            return res.json(error);
        }
        
        if(!channel) {
            res.status(400);
            return res.json({
                error: "channel not found!",
            });
        }

        try {
            await distube.voices.join(channel);
        } catch(error) {
            res.status(500);
            return res.json(error);
        }

        distube.emit("state-change", guildId);
    
        res.status(200);
        return res.json({
            success: `joined channel ${channelId}!`
        });
    });

    router.post("/set-text-channel", async (req,res) => {
        try {
            const { guildId, channelId } = req.body;

            const queue = distube.getQueue(guildId);
            if(!queue) {
                res.status(400);
                return res.json({
                    error: "queue not found!",
                });
            }

            const textChannel = await client.channels.fetch(channelId);
            if (!textChannel) {
                res.status(400);
                return res.json({
                    error: "channel not found!",
                });
            }

            if(textChannel.type !== ChannelType.GuildText) {
                res.status(400);
                return res.json({
                    error: "not a text channel!",
                });
            }

            queue.textChannel = textChannel;
            distube.emit("state-change", guildId);

            return res.json({
                success: "set text channel!"
            });
        } catch(error) {
            console.error(error);
            res.status(500);
            return res.json(error);
        }
    });

    router.post("/remove-at-index", async (req, res) => {
        try {
            const { guildId, songIndex } = req.body;

            const queue = distube.getQueue(guildId);
            if(!queue) {
                res.status(400);
                return res.json({
                    error: "queue not found!",
                });
            }

            if(songIndex < 1 || songIndex >= queue.songs.length) {
                res.status(400);
                return res.json({
                    error: "index not in range!",
                });
            }
            queue.songs.splice(songIndex, 1)[0];
            distube.emit("state-change", guildId);

            res.status(200);
            return res.json({
                success: `removed song at index ${songIndex}!`
            });
        } catch(error) {
            console.error(error);
            res.status(500);
            return res.json(error);
        }
    });
    
    router.post("/add-song", async (req, res) => {
        const { guildId, song } = req.body;
    
        const channel = await distube.voices.get(guildId)?.channel;
        if(!channel) {
            res.status(400);
            return res.json({
                error: "channel not found!",
            });
        }
    
        try {
            await distube.play(channel, song, {
                skip: false,
            });
    
            distube.emit("state-change", guildId);
    
            res.status(200);
            return res.json({
                success: "added to queue!"
            });
        } catch(error) {
            console.error(error);
            res.status(500);
            return res.json(error);
        }
    });

    router.post("/play-immediately", async (req, res) => {
        const { guildId, song } = req.body;
    
        const channel = await distube.voices.get(guildId)?.channel;
        if(!channel) {
            res.status(400);
            return res.json({
                error: "channel not found!",
            });
        }

        const queue = distube.getQueue(guildId);
    
        try {
            await distube.play(channel, song, {
                position: 1
            });
            if(queue) {
                await distube.skip(guildId);
            }
    
            distube.emit("state-change", guildId);
    
            res.status(200);
            return res.json({
                success: "playing song now!"
            });
        } catch(error) {
            console.error(error);
            res.status(500);
            return res.json(error)
        }
    });
    
    router.post("/pause-toggle", async (req, res) => {
        const { guildId } = req.body;
    
        const queue = distube.getQueue(guildId);
        if(!queue) {
            res.status(400);
            return res.json({
                error: "queue not found!",
            });
        }
    
        if(queue.paused) {
            await queue.resume();
        } else {
            await queue.pause();
        }
    
        distube.emit("state-change", guildId);
    
        res.status(200);
        return res.json({
            success: queue.paused
        });
    });
    
    router.post("/skip", async (req, res) => {
        const { guildId } = req.body;
    
        const queue = distube.getQueue(guildId);
        if(!queue) {
            res.status(400);
            return res.json({
                error: "queue not found!",
            });
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
        return res.json({
            success: "skipped!"
        });
    });
    
    router.post("/loop", async (req, res) => {
        const { guildId } = req.body;
    
        const queue = distube.getQueue(guildId);
        if(!queue) {
            res.status(400);
            return res.json({
                error: "queue not found!",
            });
        }
        if(queue.repeatMode === RepeatMode.DISABLED) {
            queue.repeatMode = RepeatMode.SONG;
        } else {
            queue.repeatMode = RepeatMode.DISABLED;
        }
    
        distube.emit("state-change", guildId);
    
        res.status(200);
        return res.json({
            success: queue.RepeatMode
        });
    });

    return router;
}