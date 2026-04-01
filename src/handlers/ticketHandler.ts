import { Client, ModalSubmitInteraction, ButtonInteraction, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, GuildMember } from "discord.js"
import { db } from "../services/database"
import { MercadoPago } from "../services/mercadopago"
import { ENV } from "../config/env"
import { RobloxService } from "../services/roblox"
import { StatusService } from "../services/statusService"
import { InviteHandler } from "./inviteHandler"
import { PaymentService } from "../services/paymentService"

export class TicketHandler {
    private client: Client
    private mp: MercadoPago
    private statusService: StatusService
    private paymentService: PaymentService

    constructor(client: Client) {
        this.client = client
        this.mp = new MercadoPago()
        this.statusService = StatusService.getInstance()
        this.paymentService = PaymentService.getInstance()
        this.registerEvents()
    }

    private registerEvents() {
        this.client.on("interactionCreate", async (interaction) => {
            try {
                if (interaction.isButton()) {
                    const isOpen = this.statusService.getStatus()

                    if (["open_ticket", "open_support"].includes(interaction.customId) && !isOpen) {
                        return await interaction.reply({
                            content: "🔴 **Desculpe!** Nossos serviços de vendas e tickets estão fechados no momento. Por favor, tente novamente mais tarde.",
                            ephemeral: true
                        })
                    }

                    switch (interaction.customId) {
                        case "open_ticket":
                            await this.handleBuyButton(interaction)
                            break
                        case "open_support":
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
        let influencerComission = 0

        // Aplica desconto por convites (máximo 5%)
        const inviteStats = await InviteHandler.getUserInvites(interaction.user.id)
        const inviteDiscount = inviteStats.discount
        if (inviteDiscount > 0) {
            discountApplied += inviteDiscount
            finalValue = originalValue * (1 - discountApplied / 100)
        }

        if (data.couponCode) {
            const [couponRows]: any = await db.execute(
                "SELECT * FROM coupons WHERE code = ? AND expires_at > NOW() AND used_count < max_uses",
                [data.couponCode]
            )

            if (couponRows.length > 0) {
                const coupon = couponRows[0]
                // Corrigido: Soma o desconto do cupom ao desconto de convites
                discountApplied += coupon.discount_percent
                finalValue = originalValue * (1 - discountApplied / 100)

                if (coupon.booster == true) {
                    if (!interaction.guild) {
                        return await interaction.reply({ content: "Este comando só pode ser usado em um servidor.", ephemeral: true })
                    }
                    const member = await interaction.guild.members.fetch(interaction.user.id)
                    if (!member.premiumSince) {
                        return await interaction.editReply({ content: "Para você utilizar este cupom precisa ser booster no servidor." })
                    }
                }

                // Calcula comissão do influencer se houver
                if (coupon.influencer_id && coupon.influencer_percent > 0) {
                    influencerComission = finalValue * (coupon.influencer_percent / 100)
                }

                await db.execute("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id])
            } else {
                return await interaction.editReply({ content: "Cupom inválido, expirado ou com limite de uso atingido." })
            }
        }

        // Sistema de Saldo
        const [balanceRows]: any = await db.execute("SELECT balance FROM user_balance WHERE user_id = ?", [interaction.user.id])
        let userBalance = balanceRows.length > 0 ? parseFloat(balanceRows[0].balance) : 0
        let balanceUsed = 0

        if (userBalance > 0) {
            const minPayment = 2.50
            if (finalValue > minPayment) {
                const maxDeductible = finalValue - minPayment
                balanceUsed = Math.min(userBalance, maxDeductible)
                finalValue -= balanceUsed
            }
        }

        // Arredonda para 2 casas decimais
        finalValue = Math.round(finalValue * 100) / 100
        originalValue = Math.round(originalValue * 100) / 100
        balanceUsed = Math.round(balanceUsed * 100) / 100
        influencerComission = Math.round(influencerComission * 100) / 100

        // Valor mínimo da API de pagamento é 2.50 conforme solicitado
        if (finalValue < 2.50) return await interaction.editReply({ content: `Valor mínimo para pagamento é R$ 2,50. Valor atual: R$ ${finalValue.toFixed(2)}` })

        const channel = await this.createTicketChannel(interaction, `🎟️-${interaction.user.username}`)
        if (!channel) return

        const pixCharge = await this.mp.createPixCharge(finalValue);
        if (!pixCharge) {
            await channel.delete().catch(() => {})
            return await interaction.editReply({ content: "Erro ao gerar PIX." })
        }

        // Salva ticket com novas colunas
        await db.execute(
            "INSERT INTO tickets (user_id, game_name, gamepass_name, gamepass_price, roblox_nick, pix_payment_id, status, coupon_code, original_price, final_price, channel_id, invite_discount_used, balance_used, influencer_comission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [interaction.user.id, data.gameName, data.gamepassName, gamepassPrice, data.robloxNick, pixCharge.id, "PENDING", data.couponCode, originalValue, finalValue, channel.id, inviteDiscount, balanceUsed, influencerComission]
        )

        const embed = new EmbedBuilder()
            .setTitle("<:fro:1471955092948258898> ﹒！PAGAMENTOㅤㅤ୨୧")
            .setDescription(`Olá ${interaction.user}, realize o pagamento para processarmos seu pedido.\n\n**Copia e Cola:**\n\`\`\`${pixCharge.payload}\`\`\``)
            .addFields([
                { name: "👤 Nick", value: `\`${data.robloxNick}\``, inline: true },
                { name: "💎 Robux", value: `${gamepassPrice}`, inline: true },
                { name: "💰 Valor", value: `R$ ${finalValue.toFixed(2)}`, inline: true }
            ])
            .setColor("#FFFFFF")
            .setTimestamp()
            .setImage("attachment://pix.png")

        if (discountApplied > 0) {
            embed.addFields({ name: "🎟️ Desconto", value: `${discountApplied}%`, inline: true })
        }
        if (balanceUsed > 0) {
            embed.addFields({ name: "💵 Saldo Usado", value: `R$ ${balanceUsed.toFixed(2)}`, inline: true })
        }

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
        const isPaid = await this.mp.isPixPaid(paymentId)

        if (isPaid) {
            const [ticketRows]: any = await db.execute("SELECT * FROM tickets WHERE pix_payment_id = ?", [paymentId])
            const ticket = ticketRows[0]

            if (ticket && ticket.status === 'PENDING') {
                await this.paymentService.processPayment(ticket, this.client, interaction)
                await interaction.editReply({ content: "Pagamento confirmado!" })
            } else {
                await interaction.editReply({ content: "Pagamento já processado ou ticket não encontrado." })
            }
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
            if ((b.data as any).custom_id === "mark_in_service") {
                return new ButtonBuilder().setCustomId("mark_delivered").setLabel("Entregar").setStyle(ButtonStyle.Success).setEmoji("📦")
            }
            return ButtonBuilder.from(b as any)
        })

        await interaction.message.edit({
            content: `${interaction.message.content}\n\n👨‍💻 **Em atendimento por:** ${interaction.user}`,
            components: [row]
        })
    }

    private async handleMarkDelivered(interaction: ButtonInteraction) {
        const owners = ENV.owner?.split(",") || []
        if (!owners.includes(interaction.user.id)) return await interaction.reply({ content: "❌ Apenas staff.", ephemeral: true })

        await interaction.deferUpdate()
        const row = ActionRowBuilder.from(interaction.message.components[0] as any) as ActionRowBuilder<ButtonBuilder>
        row.components = row.components.map(b => {
            if ((b.data as any).custom_id === "mark_delivered") {
                return new ButtonBuilder().setCustomId("delivered_done").setLabel("Entregue").setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji("✅")
            }
            return ButtonBuilder.from(b as any)
        })

        await interaction.message.edit({
            content: `${interaction.message.content}\n\n📦 **Entregue por:** ${interaction.user}`,
            components: [row]
        })

        const channel = interaction.channel as TextChannel
        const [rows]: any = await db.execute(
            "SELECT * FROM tickets WHERE channel_id = ? LIMIT 1",
            [channel.id]
        )
        const ticket = rows?.[0]
        if (!ticket) return

        await db.execute("UPDATE tickets SET status = 'DELIVERED' WHERE id = ?", [ticket.id])

        if (ticket.invite_discount_used > 0) {
            await InviteHandler.consumeInvites(ticket.user_id, ticket.invite_discount_used)
        }

        if (ENV.salesChannelId) {
            const salesChannel = await this.client.channels.fetch(ENV.salesChannelId) as TextChannel
            if (salesChannel) {
                const robloxAvatar = await RobloxService.getUserAvatar(ticket.roblox_nick)
                const embed = new EmbedBuilder()
                    .setTitle("<:fro:1471955092948258898> ﹒！NOVA VENDAㅤㅤ୨୧")
                    .setDescription("Mais uma entrega concluída com sucesso em nossa loja!")
                    .addFields([
                        { name: "<a:branco9:1471948803195277497> Produto", value: `\`${ticket.gamepass_name}\``, inline: true },
                        { name: "<a:branco9:1471948803195277497> Quantidade", value: `\`${ticket.gamepass_price} Robux\``, inline: true },
                        { name: "<a:branco9:1471948803195277497> Jogo", value: `\`${ticket.game_name}\``, inline: true },
                        { name: "<a:branco9:1471948803195277497> Jogador", value: `\`${ticket.roblox_nick}\``, inline: true },
                        { name: "<a:branco9:1471948803195277497> Atendido por", value: `${interaction.user}`, inline: true }
                    ])
                    .setImage("https://media.discordapp.net/attachments/1464406013255090309/1471958305604632689/70_Sem_Titulo_20250213165633.png?ex=69917c3f&is=69902abf&hm=d63280836f56c02e2c2db04c50d4ff0d48d51981d3f6720625acb63224ed546a&=&format=webp&quality=lossless")
                    .setColor("#FFFFFF")
                    .setTimestamp()

                if (robloxAvatar) embed.setThumbnail(robloxAvatar)
                await salesChannel.send({ embeds: [embed] })
            }
        }
    }

    private async handleCloseTicket(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true })
        const channel = interaction.channel as TextChannel

        const [rows]: any = await db.execute(
            "SELECT * FROM tickets WHERE channel_id = ? LIMIT 1",
            [channel.id]
        )
        const ticket = rows?.[0]

        if (ticket) {
            if (ticket.status === "PENDING") {
                const isPaid = await this.mp.isPixPaid(ticket.pix_payment_id)
                if (isPaid) {
                    // BUG FIX: Agora processa o pagamento completo (saldo, comissão, etc) se detectar pago no fechamento
                    await this.paymentService.processPayment(ticket, this.client)
                    ticket.status = "PAID"
                }
            }

            if (ticket.status === "PAID") {
                return await interaction.editReply({
                    content: "❌ **Este ticket está pago e ainda não foi entregue.** Marque como entregue antes de fechar."
                })
            }
        }

        const messages = await channel.messages.fetch({ limit: 100 })
        const transcript = messages
            .reverse()
            .map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`)
            .join("\n")

        const logChannelId = ENV.ticketLogChannelId || ENV.logChannelId
        if (logChannelId) {
            const logChannel = await this.client.channels.fetch(logChannelId) as TextChannel
            if (logChannel) {
                const attachment = new AttachmentBuilder(Buffer.from(transcript), { name: `transcript-${channel.name}.txt` })
                const embed = new EmbedBuilder()
                    .setTitle(`Ticket Fechado - ${channel.name}`)
                    .addFields([
                        { name: "Usuário", value: ticket ? `<@${ticket.user_id}>` : "Desconhecido", inline: true },
                        { name: "Fechado por", value: `${interaction.user}`, inline: true },
                        { name: "Status", value: ticket?.status ?? "SUPORTE", inline: true }
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
