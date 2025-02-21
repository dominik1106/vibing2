const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear the queue"),
    async execute(interaction, distube) {
        const queue = distube.getQueue(interaction.guild);
        if(!queue) {
            return;
        }

        if(queue.songs.length > 1) {
            queue.songs.splice(1);
            interaction.reply("Queue cleared!");
        }
    },
}