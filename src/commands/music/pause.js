const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pause")
        .setDescription("pause/resume current song")
        .setDescriptionLocalizations({
            de: "Pausiert/Setzt aktuelles Lied fort"
        }),
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