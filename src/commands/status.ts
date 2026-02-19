import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import { StatusService } from "../services/statusService"

export default {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Altera o status de vendas e tickets do bot")
        .addStringOption(option =>
            option
                .setName("estado")
                .setDescription("O novo estado do bot")
                .setRequired(true)
                .addChoices(
                    { name: "Aberto (ON)", value: "on" },
                    { name: "Fechado (OFF)", value: "off" }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const estado = interaction.options.getString("estado", true)
        const isOpen = estado === "on"
        const statusService = StatusService.getInstance()

        // Responde imediatamente para evitar o "pensando" infinito
        await interaction.deferReply({ ephemeral: true })

        try {
            // Atualiza o status (a atualização do canal de voz agora é assíncrona dentro do serviço)
            await statusService.setStatus(isOpen, interaction.client)

            const embed = new EmbedBuilder()
                .setTitle("Status Atualizado")
                .setDescription(`O sistema de vendas e tickets agora está **${isOpen ? "ABERTO 🟢" : "FECHADO 🔴"}**.`)
                .setColor(isOpen ? "#32CD32" : "#FF0000") // Rosa se aberto, Vermelho se fechado
                .setTimestamp()

            await interaction.editReply({ embeds: [embed] })
        } catch (error) {
            console.error(error)
            await interaction.editReply({ content: "❌ Ocorreu um erro ao atualizar o status." })
        }
    }
}
