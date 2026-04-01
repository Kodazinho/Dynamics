import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import { db } from "../services/database"
import { ENV } from "../config/env"

export default {
    data: new SlashCommandBuilder()
        .setName("saldo")
        .setDescription("Gerencia o saldo de usuários")
        .addSubcommand(sub =>
            sub.setName("ver")
                .setDescription("Veja o seu saldo ou de outro usuário")
                .addUserOption(opt => opt.setName("usuario").setDescription("Usuário para ver o saldo").setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName("adicionar")
                .setDescription("Adiciona saldo a um usuário (Apenas Staff)")
                .addUserOption(opt => opt.setName("usuario").setDescription("Usuário que receberá o saldo").setRequired(true))
                .addNumberOption(opt => opt.setName("valor").setDescription("Valor a ser adicionado").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("remover")
                .setDescription("Remove saldo de um usuário (Apenas Staff)")
                .addUserOption(opt => opt.setName("usuario").setDescription("Usuário que terá o saldo removido").setRequired(true))
                .addNumberOption(opt => opt.setName("valor").setDescription("Valor a ser removido").setRequired(true))
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand()
        const owners = ENV.owner?.split(",") || []
        const isOwner = owners.includes(interaction.user.id)

        if ((subcommand === "adicionar" || subcommand === "remover") && !isOwner) {
            return await interaction.reply({ content: "❌ Você não tem permissão para usar este comando.", ephemeral: true })
        }

        await interaction.deferReply({ ephemeral: true })

        try {
            if (subcommand === "ver") {
                const targetUser = interaction.options.getUser("usuario") || interaction.user
                
                const [rows]: any = await db.execute(
                    "SELECT balance FROM user_balance WHERE user_id = ?",
                    [targetUser.id]
                )

                const balance = rows.length > 0 ? parseFloat(rows[0].balance) : 0.00

                const embed = new EmbedBuilder()
                    .setTitle("💰 Saldo de Usuário")
                    .setDescription(`Usuário: ${targetUser}\nSaldo Atual: **R$ ${balance.toFixed(2)}**`)
                    .setColor("#FFFFFF")
                    .setTimestamp()

                await interaction.editReply({ embeds: [embed] })

            } else if (subcommand === "adicionar") {
                const targetUser = interaction.options.getUser("usuario", true)
                const amount = interaction.options.getNumber("valor", true)

                if (amount <= 0) {
                    return await interaction.editReply({ content: "❌ O valor deve ser maior que zero." })
                }

                await db.execute(
                    "INSERT INTO user_balance (user_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance = balance + ?",
                    [targetUser.id, amount, amount]
                )

                const embed = new EmbedBuilder()
                    .setTitle("✅ Saldo Adicionado")
                    .setDescription(`Foram adicionados **R$ ${amount.toFixed(2)}** ao saldo de ${targetUser}.`)
                    .setColor("#00FF00")
                    .setTimestamp()

                await interaction.editReply({ embeds: [embed] })

            } else if (subcommand === "remover") {
                const targetUser = interaction.options.getUser("usuario", true)
                const amount = interaction.options.getNumber("valor", true)

                if (amount <= 0) {
                    return await interaction.editReply({ content: "❌ O valor deve ser maior que zero." })
                }

                const [rows]: any = await db.execute("SELECT balance FROM user_balance WHERE user_id = ?", [targetUser.id])
                const currentBalance = rows.length > 0 ? parseFloat(rows[0].balance) : 0

                if (currentBalance < amount) {
                    return await interaction.editReply({ content: `❌ O usuário possui apenas **R$ ${currentBalance.toFixed(2)}**. Não é possível remover **R$ ${amount.toFixed(2)}**.` })
                }

                await db.execute(
                    "UPDATE user_balance SET balance = balance - ? WHERE user_id = ?",
                    [amount, targetUser.id]
                )

                const embed = new EmbedBuilder()
                    .setTitle("✅ Saldo Removido")
                    .setDescription(`Foram removidos **R$ ${amount.toFixed(2)}** do saldo de ${targetUser}.`)
                    .setColor("#FF0000")
                    .setTimestamp()

                await interaction.editReply({ embeds: [embed] })
            }
        } catch (error) {
            console.error(error)
            await interaction.editReply({ content: "❌ Ocorreu um erro ao processar o comando de saldo." })
        }
    }
}
