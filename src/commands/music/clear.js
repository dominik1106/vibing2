const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear the queue")
        .setDescriptionLocalizations({
            de: "Entferne alle außer dem aktuellen Song aus der Warteschlange"
        }),
    async execute(interaction, distube) {
        const queue = distube.getQueue(interaction.guild);
        if(!queue) {
            const embedNotConnected = new EmbedBuilder()
                .setColor("Red")
                .setDescription("No active queue!");
            return interaction.reply({embeds: [embedNotConnected], flags: MessageFlags.Ephemeral});
        }

        if(queue.songs.length > 1) {
            queue.songs.splice(1);
        }

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setDescription(`Queue cleared!`);
        
        interaction.reply({embeds: [embed]});
    },
}