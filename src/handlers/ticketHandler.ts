import { Client, ModalSubmitInteraction, ButtonInteraction, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, GuildMember } from "discord.js"
import { db } from "../services/database"
import { Asaas } from "../services/asaas"
import { ENV } from "../config/env"
import { RobloxService } from "../services/roblox"
import { StatusService } from "../services/statusService"

export class TicketHandler {
    private client: Client
    private asaas: Asaas
    private statusService: StatusService

    constructor(client: Client) {
        this.client = client
        this.asaas = new Asaas()
        this.statusService = StatusService.getInstance()
        this.registerEvents()
    }

    private registerEvents() {
        this.client.on("interactionCreate", async (interaction) => {
            try {
                if (interaction.isButton()) {
                    const isOpen = this.statusService.getStatus()
                    
                    // Botões que dependem do status aberto
                    if (["open_ticket", "open_support"].includes(interaction.customId) && !isOpen) {
                        return await interaction.reply({ 
                            content: "🔴 **Desculpe!** Nossos serviços de vendas e tickets estão fechados no momento. Por favor, tente novamente mais tarde.", 
                            ephemeral: true 
                        })
                    }

                    switch (interaction.customId) {
                        case "open_ticket": // Botão de Compra
                            await this.handleBuyButton(interaction)
                            break
                        case "open_support": // Botão de Suporte Geral
                            await this.handleSupportButton(interaction)
                            break
                        case "close_ticket":
                            await this.handleCloseTicket(interaction)
                            break
                        case "mark_in_service":
                            await this.handleMarkInService(interaction)
                            break
                        case "mark_delivered":
                            await this.handleMarkDelivered(interaction)
                            break
                        case "verify_member":
                            await this.handleVerifyMember(interaction)
                            break
                        default:
                            if (interaction.customId.startsWith("check_payment_")) {
                                await this.handlePaymentCheck(interaction)
                            }
                            break
                    }
                } else if (interaction.isModalSubmit()) {
                    if (interaction.customId === "ticket_modal") {
                        await this.handleModal(interaction)
                    }
                }
            } catch (error) {
                console.error("[TicketHandler Error]", error)
            }
        })
    }

    private async handleVerifyMember(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true })
        const roleId = ENV.roleVerificarId
        if (!roleId) return await interaction.editReply({ content: "❌ Cargo de verificação não configurado." })

        if (interaction.member instanceof GuildMember) {
            try {
                const role = await interaction.guild?.roles.fetch(roleId)
                if (!role) return await interaction.editReply({ content: "❌ Cargo não encontrado." })
                await interaction.member.roles.add(role)
                await interaction.editReply({ content: "✅ Você foi verificado com sucesso!" })
            } catch (error) {
                await interaction.editReply({ content: "❌ Erro ao atribuir cargo. Verifique as permissões do bot." })
            }
        }
    }

    private async handleBuyButton(interaction: ButtonInteraction) {
        const modal = new ModalBuilder()
            .setCustomId("ticket_modal")
            .setTitle("Informações da Compra")

        const fields = [
            { id: "game_name", label: "Nome do jogo", style: TextInputStyle.Short, required: true },
            { id: "gamepass_name", label: "Nome da Gamepass", style: TextInputStyle.Short, required: true },
            { id: "gamepass_price", label: "Preço da Gamepass (Robux)", style: TextInputStyle.Short, required: true },
            { id: "roblox_nick", label: "Nick no Roblox", style: TextInputStyle.Short, required: true },
            { id: "coupon_code", label: "Cupom de Desconto (Opcional)", style: TextInputStyle.Short, required: false }
        ].map(f => new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.style).setRequired(f.required)
        ))

        modal.addComponents(...fields)
        await interaction.showModal(modal)
    }

    private async handleSupportButton(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true })
        
        const channel = await this.createTicketChannel(interaction, `📌-${interaction.user.username}`)
        if (!channel) return

        const embed = new EmbedBuilder()
            .setTitle("<:fro:1471955092948258898> ﹒！SUPORTEㅤㅤ୨୧")
            .setDescription(`Olá ${interaction.user}, bem-vindo ao seu ticket de suporte!\n\nPor favor, descreva sua dúvida ou problema e aguarde um de nossos atendentes.`)
            .setColor("#FFFFFF")
            .setTimestamp()

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger)
        )

        await channel.send({ content: `${interaction.user} | @everyone`, embeds: [embed], components: [row] })
        await interaction.editReply({ content: `Seu ticket de suporte foi criado: ${channel}` })
    }

    private async createTicketChannel(interaction: ButtonInteraction | ModalSubmitInteraction, name: string) {
        const categoryId = ENV.categoriaid
        try {
            return await interaction.guild?.channels.create({
                name,
                type: 0,
                parent: categoryId,
                permissionOverwrites: [
                    { id: interaction.guild!.roles.everyone.id, deny: ["ViewChannel"] },
                    { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "AttachFiles"] }
                ]
            }) as TextChannel
        } catch (error) {
            console.error("Erro ao criar canal:", error)
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: "❌ Erro ao criar canal de ticket." })
            }
            return null
        }
    }

    private async handleModal(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true })

        const data = {
            gameName: interaction.fields.getTextInputValue("game_name"),
            gamepassName: interaction.fields.getTextInputValue("gamepass_name"),
            priceStr: interaction.fields.getTextInputValue("gamepass_price"),
            robloxNick: interaction.fields.getTextInputValue("roblox_nick"),
            couponCode: interaction.fields.getTextInputValue("coupon_code")?.toUpperCase() || null
        }
        
        const gamepassPrice = parseInt(data.priceStr)
        if (isNaN(gamepassPrice)) return await interaction.editReply({ content: "❌ Preço inválido." })

        const robuxPrice = parseFloat(ENV.robuxprice || "0")
        let originalValue = gamepassPrice * robuxPrice
        let finalValue = originalValue
        let discountApplied = 0

        // Validação de Cupom
        if (data.couponCode) {
            const [couponRows]: any = await db.execute(
                "SELECT * FROM coupons WHERE code = ? AND expires_at > NOW() AND used_count < max_uses",
                [data.couponCode]
            )

            if (couponRows.length > 0) {
                const coupon = couponRows[0]
                discountApplied = coupon.discount_percent
                finalValue = originalValue * (1 - discountApplied / 100)
                
                // Incrementa o uso do cupom
                await db.execute("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id])
            } else {
                return await interaction.editReply({ content: "❌ Cupom inválido, expirado ou com limite de uso atingido." })
            }
        }

        if (finalValue < 5.00) return await interaction.editReply({ content: `❌ Valor mínimo R$ 5,00 (Aprox. ${Math.ceil(5 / robuxPrice)} Robux).` })

        const channel = await this.createTicketChannel(interaction, `🎟️-${interaction.user.username}`)
        if (!channel) return

        const pixCharge = await this.asaas.createPixCharge(finalValue)
        if (!pixCharge) {
            await channel.delete().catch(() => {})
            return await interaction.editReply({ content: "❌ Erro ao gerar PIX." })
        }

        await db.execute(
            "INSERT INTO tickets (user_id, game_name, gamepass_name, gamepass_price, roblox_nick, pix_payment_id, status, coupon_code, original_price, final_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [interaction.user.id, data.gameName, data.gamepassName, gamepassPrice, data.robloxNick, pixCharge.id, 'PENDING', data.couponCode, originalValue, finalValue]
        )

        const embed = new EmbedBuilder()
            .setTitle("<:fro:1471955092948258898> ﹒！PAGAMENTOㅤㅤ୨୧")
            .setDescription(`Olá ${interaction.user}, realize o pagamento para processarmos seu pedido.\n\n**Copia e Cola:**\n\`\`\`${pixCharge.payload}\`\`\``)
            .addFields([
                { name: "👤 Nick", value: `\`${data.robloxNick}\``, inline: true },
                { name: "💎 Robux", value: `${gamepassPrice}`, inline: true },
                { name: "💰 Valor", value: discountApplied > 0 ? `~~R$ ${originalValue.toFixed(2)}~~ **R$ ${finalValue.toFixed(2)}** (-${discountApplied}%)` : `R$ ${finalValue.toFixed(2)}`, inline: true }
            ])
            .setColor("#FFFFFF")
            .setImage("attachment://pix.png")

        const robloxAvatar = await RobloxService.getUserAvatar(data.robloxNick)
        if (robloxAvatar) embed.setThumbnail(robloxAvatar)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`check_payment_${pixCharge.id}`).setLabel("Verificar").setStyle(ButtonStyle.Success).setEmoji("✅"),
            new ButtonBuilder().setCustomId("mark_in_service").setLabel("Atender").setStyle(ButtonStyle.Primary).setEmoji("👨‍💻"),
            new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger).setEmoji("🔒")
        )

        const buffer = Buffer.from(pixCharge.encodedImage, "base64")
        const file = new AttachmentBuilder(buffer, { name: "pix.png" })

        await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row], files: [file] })
        await interaction.editReply({ content: `Ticket criado: ${channel}` })
    }

    private async handlePaymentCheck(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true })
        const paymentId = interaction.customId.replace("check_payment_", "")
        const isPaid = await this.asaas.isPixPaid(paymentId)

        if (isPaid) {
            await db.execute("UPDATE tickets SET status = 'PAID' WHERE pix_payment_id = ?", [paymentId])
            
            // Cargo de cliente
            if (ENV.roleClienteId && interaction.member instanceof GuildMember) {
                const role = await interaction.guild?.roles.fetch(ENV.roleClienteId)
                if (role) await interaction.member.roles.add(role)
            }

            const channel = interaction.channel as TextChannel
            await channel.setName(channel.name.replace("🎟️", "💵"))
            await channel.send({ content: "@everyone 💵 **Pagamento confirmado!** O pedido já pode ser processado." })
            
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId("paid_done").setLabel("Pago").setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji("🎉"),
                new ButtonBuilder().setCustomId("mark_in_service").setLabel("Atender").setStyle(ButtonStyle.Primary).setEmoji("👨‍💻"),
                new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger).setEmoji("🔒")
            )
            await interaction.message.edit({ components: [row] })
            await interaction.editReply({ content: "Pagamento confirmado!" })
        } else {
            await interaction.editReply({ content: "Pagamento não detectado." })
        }
    }

    private async handleMarkInService(interaction: ButtonInteraction) {
        const owners = ENV.owner?.split(",") || []
        if (!owners.includes(interaction.user.id)) return await interaction.reply({ content: "❌ Apenas staff.", ephemeral: true })

        await interaction.deferUpdate()
        const row = ActionRowBuilder.from(interaction.message.components[0] as any) as ActionRowBuilder<ButtonBuilder>
        row.components = row.components.map(b => {
            if (b.data.custom_id === "mark_in_service") {
                return new ButtonBuilder().setCustomId("mark_delivered").setLabel("Entregar").setStyle(ButtonStyle.Success).setEmoji("📦")
            }
            return ButtonBuilder.from(b as any)
        })

        await interaction.message.edit({
            content: `${interaction.message.content}\n\n👨‍💻 **Atendido por:** ${interaction.user}`,
            components: [row]
        })
    }

    private async handleMarkDelivered(interaction: ButtonInteraction) {
        const owners = ENV.owner?.split(",") || []
        if (!owners.includes(interaction.user.id)) return await interaction.reply({ content: "❌ Apenas staff.", ephemeral: true })

        await interaction.deferUpdate()
        const row = ActionRowBuilder.from(interaction.message.components[0] as any) as ActionRowBuilder<ButtonBuilder>
        row.components = row.components.map(b => {
            if (b.data.custom_id === "mark_delivered") {
                return new ButtonBuilder().setCustomId("delivered_done").setLabel("Entregue").setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji("✅")
            }
            return ButtonBuilder.from(b as any)
        })

        await interaction.message.edit({
            content: `${interaction.message.content}\n\n📦 **Entregue por:** ${interaction.user}`,
            components: [row]
        })

        // Log de venda
        if (ENV.salesChannelId) {
            const salesChannel = await this.client.channels.fetch(ENV.salesChannelId) as TextChannel
            if (salesChannel) {
                const [ticketData]: any = await db.execute(
                    "SELECT * FROM tickets WHERE user_id = ? OR ? LIKE CONCAT('%', user_id, '%') ORDER BY created_at DESC LIMIT 1",
                    [interaction.user.id, interaction.message.content]
                )
                if (ticketData?.[0]) {
                    const t = ticketData[0]
                    const robloxAvatar = await RobloxService.getUserAvatar(t.roblox_nick)
                    const embed = new EmbedBuilder()
                        .setTitle("<:fro:1471955092948258898> ﹒！NOVA VENDAㅤㅤ୨୧")
                        .setDescription("Mais uma entrega concluída com sucesso em nossa loja!")
                            .addFields([
                                { name: "<a:branco9:1471948803195277497> Produto", value: `\`${t.gamepass_name}\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Quantidade", value: `\`${t.gamepass_price} Robux\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Jogo", value: `\`${t.game_name}\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Jogador", value: `\`${t.roblox_nick}\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Atendido por", value: `${interaction.user}`, inline: true }
                            ])
                        .setImage("https://media.discordapp.net/attachments/1464406013255090309/1471958305604632689/70_Sem_Titulo_20260213165633.png?ex=69917c3f&is=69902abf&hm=d63280836f56c02e2c2db04c50d4ff0d48d51981d3f6720625acb63224ed546a&=&format=webp&quality=lossless")
                        .setColor("#FFFFFF")
                        .setTimestamp();

                        if (robloxAvatar) {
                            embed.setThumbnail(robloxAvatar)
                        }
                    await salesChannel.send({ embeds: [embed] })
                }
            }
        }
    }

    private async handleCloseTicket(interaction: ButtonInteraction) {
        await interaction.deferReply()
        const channel = interaction.channel as TextChannel
        const messages = await channel.messages.fetch({ limit: 100 })
        const transcript = messages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join("\n")

        const logChannelId = ENV.ticketLogChannelId || ENV.logChannelId
        if (logChannelId) {
            const logChannel = await this.client.channels.fetch(logChannelId) as TextChannel
            if (logChannel) {
                const attachment = new AttachmentBuilder(Buffer.from(transcript), { name: `transcript-${channel.name}.txt` })
                const embed = new EmbedBuilder()
                    .setTitle(`Ticket Fechado - ${channel.name}`)
                    .addFields([
                        { name: "Usuário", value: `${interaction.user}`, inline: true },
                        { name: "Fechado por", value: `${interaction.user}`, inline: true }
                    ])
                    .setColor("#FF0000")
                    .setTimestamp()
                await logChannel.send({ embeds: [embed], files: [attachment] })
            }
        }

        await interaction.editReply({ content: "🔒 O ticket será fechado em 5 segundos..." })
        setTimeout(() => channel.delete().catch(() => {}), 5000)
    }
}
