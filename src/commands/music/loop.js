const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { RepeatMode } = require("distube");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Toggle looping the current song")
        .setDescriptionLocalizations({
            de: "Wiederholen des aktuellen Songs umschalten"
        }),
    async execute(interaction, distube) {
        const queue = distube.getQueue(interaction.guild);
        if(!queue) {
            const embedNotConnected = new EmbedBuilder()
                .setColor("Red")
                .setDescription("No active queue!");
            return interaction.reply({embeds: [embedNotConnected], flags: MessageFlags.Ephemeral});
        }

        if(queue.repeatMode === RepeatMode.DISABLED) {
            queue.repeatMode = RepeatMode.SONG;

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setDescription("Looping current song!");
            
            return interaction.reply({embeds: [embed]});
        } else {
            queue.repeatMode = RepeatMode.DISABLED;

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setDescription("No longer looping current song!");
            
            return interaction.reply({embeds: [embed]});
        }
    },
}