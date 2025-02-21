const { SlashCommandBuilder } = require("discord.js");
const { RepeatMode } = require("distube");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Toggle looping the current song"),
    async execute(interaction, distube) {
        const queue = distube.getQueue(interaction.guild);
        if(!queue) {
            return;
        }
        if(queue.repeatMode === RepeatMode.DISABLED) {
            queue.repeatMode = RepeatMode.SONG;
            await interaction.reply("Looping current song!");
        } else {
            queue.repeatMode = RepeatMode.DISABLED;
            await interaction.reply("No longer looping current song!");
        }
    },
}