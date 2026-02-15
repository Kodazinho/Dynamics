import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    TextChannel
} from "discord.js"

export default {
    data: new SlashCommandBuilder()
        .setName("addbutton")
        .setDescription("Adiciona botão a uma mensagem existente do bot")
        .addStringOption(option =>
            option
                .setName("type")
                .setDescription("Tipo do botão")
                .setRequired(true)
                .addChoices(
                    { name: "Ticket", value: "ticket" },
                    { name: "Verificar", value: "verify" }
                )
        )
        .addStringOption(option =>
            option
                .setName("channelid")
                .setDescription("ID do canal da mensagem")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("messageid")
                .setDescription("ID da mensagem do bot")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const type = interaction.options.getString("type", true)
        const channelId = interaction.options.getString("channelid", true)
        const messageId = interaction.options.getString("messageid", true)

        const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel

        if (!channel) {
            await interaction.reply({ content: "Canal não encontrado.", ephemeral: true })
            return
        }

        try {
            const msg = await channel.messages.fetch(messageId)

            if (!msg.author.bot) {
                await interaction.reply({ content: "Só posso adicionar botão em mensagens do bot.", ephemeral: true })
                return
            }

            const button = new ButtonBuilder()
            
            if (type === "ticket") {
                button
                    .setCustomId("open_ticket")
                    .setLabel("Abrir Ticket")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji({ name: "x6_skulls", id: "1390688820483067996" })
            } else {
                button
                    .setCustomId("verify_member")
                    .setLabel("Verificar-se")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("✅")
            }

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

            await msg.edit({ components: [row] })

            await interaction.reply({ content: `Botão de ${type === "ticket" ? "Ticket" : "Verificação"} adicionado com sucesso!`, ephemeral: true })
        } catch (err) {
            console.error(err)
            await interaction.reply({ content: "Falha ao adicionar botão.", ephemeral: true })
        }
    }
}
