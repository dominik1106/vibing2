const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song")
        .setDescriptionLocalizations({
            de: "Spiele einen Song ab",
        })
        .addStringOption(option =>
            option.setName("query")
            .setNameLocalizations({
                de: "suchanfrage",
            })
            .setDescription("Name or Youtube-URL of the song")
            .setDescriptionLocalizations({
                de: "Name oder Youtube-URL des Songs",
            })
            .setRequired(true)
        ),
    async execute(interaction, distube) {
        const song = interaction.options.getString("query");
        if(!distube) {
            console.error("Missing distube reference in play!");
            return;
        }

        const voiceChannel = interaction.member.voice.channel;
        if(!voiceChannel) {
            return interaction.reply({ content: 'You are not in a voice channel!', flags: MessageFlags.Ephemeral });
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