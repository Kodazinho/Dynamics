import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import { db } from "../services/database"

export default {
    data: new SlashCommandBuilder()
        .setName("cupom")
        .setDescription("Gerencia os cupons de desconto")
        .addSubcommand(sub =>
            sub.setName("criar")
                .setDescription("Cria um novo cupom")
                .addStringOption(opt => opt.setName("codigo").setDescription("Código do cupom").setRequired(true))
                .addIntegerOption(opt => opt.setName("desconto").setDescription("Porcentagem de desconto (1-100)").setRequired(true))
                .addIntegerOption(opt => opt.setName("usos").setDescription("Quantidade máxima de usos").setRequired(true))
                .addStringOption(opt => opt.setName("validade").setDescription("Data de validade (DD/MM/AAAA HH:MM)").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("deletar")
                .setDescription("Deleta um cupom existente")
                .addStringOption(opt => opt.setName("codigo").setDescription("Código do cupom").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("listar")
                .setDescription("Lista todos os cupons ativos")
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand()
        await interaction.deferReply({ ephemeral: true })

        try {
            if (subcommand === "criar") {
                const code = interaction.options.getString("codigo", true).toUpperCase()
                const discount = interaction.options.getInteger("desconto", true)
                const maxUses = interaction.options.getInteger("usos", true)
                const expiryStr = interaction.options.getString("validade", true)

                // Parse da data DD/MM/AAAA HH:MM
                const [datePart, timePart] = expiryStr.split(" ")
                const [day, month, year] = datePart.split("/").map(Number)
                const [hour, minute] = timePart ? timePart.split(":").map(Number) : [23, 59]
                const expiryDate = new Date(year, month - 1, day, hour, minute)

                if (isNaN(expiryDate.getTime())) {
                    return await interaction.editReply({ content: "❌ Formato de data inválido. Use: DD/MM/AAAA HH:MM" })
                }

                await db.execute(
                    "INSERT INTO coupons (code, discount_percent, max_uses, expires_at) VALUES (?, ?, ?, ?)",
                    [code, discount, maxUses, expiryDate]
                )

                const embed = new EmbedBuilder()
                    .setTitle("🎟️ Cupom Criado")
                    .setDescription(`O cupom **${code}** foi criado com sucesso!`)
                    .addFields([
                        { name: "Desconto", value: `${discount}%`, inline: true },
                        { name: "Máximo de Usos", value: `${maxUses}`, inline: true },
                        { name: "Validade", value: expiryDate.toLocaleString("pt-BR"), inline: false }
                    ])
                    .setColor("#FFFFFF")
                    .setTimestamp()

                await interaction.editReply({ embeds: [embed] })

            } else if (subcommand === "deletar") {
                const code = interaction.options.getString("codigo", true).toUpperCase()
                await db.execute("DELETE FROM coupons WHERE code = ?", [code])
                await interaction.editReply({ content: `✅ Cupom **${code}** deletado com sucesso.` })

            } else if (subcommand === "listar") {
                const [rows]: any = await db.execute("SELECT * FROM coupons WHERE expires_at > NOW() AND used_count < max_uses")
                
                if (rows.length === 0) {
                    return await interaction.editReply({ content: "Nenhum cupom ativo no momento." })
                }

                const embed = new EmbedBuilder()
                    .setTitle("🎟️ Cupons Ativos")
                    .setColor("#FFFFFF")
                    .setTimestamp()

                rows.forEach((c: any) => {
                    embed.addFields({
                        name: `Código: ${c.code}`,
                        value: `Desconto: ${c.discount_percent}% | Usos: ${c.used_count}/${c.max_uses} | Expira em: ${new Date(c.expires_at).toLocaleString("pt-BR")}`,
                        inline: false
                    })
                })

                await interaction.editReply({ embeds: [embed] })
            }
        } catch (error: any) {
            console.error(error)
            if (error.code === 'ER_DUP_ENTRY') {
                await interaction.editReply({ content: "❌ Já existe um cupom com este código." })
            } else {
                await interaction.editReply({ content: "❌ Ocorreu um erro ao processar o comando." })
            }
        }
    }
}
