const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song")
        .addStringOption(option =>
            option.setName("song")
            .setDescription("Name or URL of the song")
        ),
    async execute(interaction, distube) {
        const song = interaction.options.getString("song");
        if(!distube) {
            console.error("Missing distube reference in play!");
            return;
        }

        const voiceChannel = interaction.member.voice.channel;
        if(!voiceChannel) {
            return interaction.reply({ content: 'You are not in a voice channel!', ephemeral: true });
        }

        await interaction.deferReply();
        await distube.play(voiceChannel, song, {
            member: interaction.member,
            skip: false,
            textChannel: interaction.channel
        });

        await interaction.followUp("Pong! " + song);
    },
}