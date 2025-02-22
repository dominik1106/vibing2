const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");

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
            const embedNotConnected = new EmbedBuilder()
                .setColor("Red")
                .setDescription("No active queue!");
            return interaction.reply({embeds: [embedNotConnected], flags: MessageFlags.Ephemeral});
        }

        if(queue.paused) {
            queue.resume();

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setDescription("Resumed!");
            
            return interaction.reply({embeds: [embed]});
        } else {
            queue.pause();

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setDescription("Paused!");
            
            return interaction.reply({embeds: [embed]});
        }
    },
}