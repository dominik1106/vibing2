const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pause")
        .setDescription("Toggle Pause"),
    async execute(interaction, distube) {
        const queue = distube.getQueue(interaction.guild);
        if(!queue) {
            return;
        }
        if(queue.paused) {
            queue.resume();
        } else {
            queue.pause();
        }
        
        await interaction.reply("Toggled :)");
    },
}