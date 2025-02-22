const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { Song } = require("distube");

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

        const voice = interaction.member.voice.channel;
        if(!voice) {
            const embedNotConnected = new EmbedBuilder()
                .setColor("Red")
                .setDescription("Not connected to a voice channel!");
            return interaction.reply({embeds: [embedNotConnected], flags: MessageFlags.Ephemeral});
        }

        await interaction.deferReply();
        try {
            const songInfo = await distube.handler.resolve(song);
            if(!(songInfo instanceof Song)) {
                throw Error("Playlist are not supported!");
            }
            distube.play(voice, songInfo, {
                member: interaction.member,
                skip: false,
                textChannel: interaction.channel,
                metadata: {
                    interaction
                }
            });
        } catch(error) {
            console.error(error);
            const embedNotConnected = new EmbedBuilder()
                .setColor("Red")
                .setDescription(`[Error]: ${error}`);
            return interaction.followUp({embeds: [embedNotConnected], flags: MessageFlags.Ephemeral});
        }
    },
}