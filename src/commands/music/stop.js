const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop playing music and disconnect from channel"),
    async execute(interaction, distube) {
        const queue = distube.getQueue(interaction.guild);
        if(!queue) {
            await interaction.reply("Not connected to a voice channel!");
        }

        await distube.stop(interaction.guild);
        await distube.voices.leave(interaction.guild);

        await interaction.reply("Skipped song!");
    },
}