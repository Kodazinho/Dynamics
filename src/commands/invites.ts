import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js"
import { InviteHandler } from "../handlers/inviteHandler"

export default {
    data: new SlashCommandBuilder()
        .setName("invites")
        .setDescription("Veja seus convites e desconto na próxima compra."),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true })

        const stats = await InviteHandler.getUserInvites(interaction.user.id)

        const embed = new EmbedBuilder()
            .setTitle("<:fro:1471955092948258898> ﹒！SEUS CONVITESㅤㅤ୨୧")
            .setDescription(`Olá ${interaction.user}, aqui estão suas estatísticas de convites:`)
            .addFields([
                { 
                    name: "<a:branco9:1471948803195277497> Convites Ativos", 
                    value: `\`${stats.active}\` convites`, 
                    inline: true 
                },
                { 
                    name: "<a:branco9:1471948803195277497> Desconto Atual", 
                    value: `\`${stats.discount}%\` de desconto`, 
                    inline: true 
                },
                { 
                    name: "<a:branco9:1471948803195277497> Total de Convites", 
                    value: `\`${stats.total}\` convites`, 
                    inline: true 
                }
            ])
            .setFooter({ text: "O desconto máximo é de 5% (5 convites ativos)." })
            .setColor("#FFFFFF")
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    }
}
