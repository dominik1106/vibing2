const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song")
        .addStringOption(option =>
            option.setName("song")
            .setDescription("Name or URL of the song")
        ),
    async execute(interaction) {
        const song = interaction.options.getString("song") ?? "Error!";
        await interaction.reply("Pong! " + song);
    },
}