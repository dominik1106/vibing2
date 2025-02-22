const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { RepeatMode } = require("distube");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip current song")
        .setDescriptionLocalizations({
            de: "Überspringt aktuelles Lied, deaktiviert außerdem Wiederholung"
        }),
    async execute(interaction, distube) {
        const queue = distube.getQueue(interaction.guild);
        if(!queue) {
            const embedNotConnected = new EmbedBuilder()
                .setColor("Red")
                .setDescription("No active queue!");
            return interaction.reply({embeds: [embedNotConnected], flags: MessageFlags.Ephemeral});
        }

        try {
            await distube.skip(interaction.guild);
            queue.repeatMode = RepeatMode.DISABLED;
        } catch(error) {
            if(error.code === "NO_UP_NEXT") {
                await distube.stop(interaction.guild);
                distube.emit("finish", queue);
            } else {
                console.log(error);
            }
        }

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setDescription("Skipped!");
        
        return interaction.reply({embeds: [embed]});
    },
}