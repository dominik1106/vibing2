const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop playing music and disconnect from channel")
        .setDescriptionLocalizations({
            de: "Stoppt die Wiedergabe und trennt die Verbindung"
        }),
    async execute(interaction, distube) {
        const voice = distube.voices.get(interaction.guildId);
        if(!voice) {
            const embedNotConnected = new EmbedBuilder()
                .setColor("Red")
                .setDescription("Not connected to a voice channel!");
            return interaction.reply({embeds: [embedNotConnected], flags: MessageFlags.Ephemeral});
        }

        // await distube.stop(interaction.guild);
        await distube.voices.leave(interaction.guild);

        distube.emit("state-change", queue.id);

        const embed = new EmbedBuilder()
            .setColor("Purple")
            .setDescription("Bye bye!");
        
        return interaction.reply({embeds: [embed]});
    },
}