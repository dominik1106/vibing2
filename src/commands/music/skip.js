const { SlashCommandBuilder } = require("discord.js");
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
            await interaction.reply("Not connected to a voice channel!");
        }

        try {
            await distube.skip(interaction.guild);
            queue.repeatMode = RepeatMode.DISABLED;
        } catch(error) {
            if(error.code === "NO_UP_NEXT") {
                await distube.stop(interaction.guild);
            } else {
                console.log(error);
            }
        }

        await interaction.reply("Skipped song!");
    },
}