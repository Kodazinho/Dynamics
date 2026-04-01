import { db } from "./database"
import { TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, Client } from "discord.js"
import { ENV } from "../config/env"

export class PaymentService {
    private static instance: PaymentService

    private constructor() {}

    public static getInstance(): PaymentService {
        if (!PaymentService.instance) {
            PaymentService.instance = new PaymentService()
        }
        return PaymentService.instance
    }

    /**
     * Processa a confirmação de um pagamento, atualizando saldo, comissões e status do ticket.
     */
    public async processPayment(ticket: any, client: Client, interaction?: any) {
        if (ticket.status !== 'PENDING') return false

        // 1. Consome o saldo do usuário se foi usado
        if (ticket.balance_used > 0) {
            await db.execute(
                "UPDATE user_balance SET balance = balance - ? WHERE user_id = ?",
                [ticket.balance_used, ticket.user_id]
            )
        }

        // 2. Paga a comissão ao influencer se houver
        if (ticket.influencer_comission > 0 && ticket.coupon_code) {
            const [couponRows]: any = await db.execute("SELECT influencer_id FROM coupons WHERE code = ?", [ticket.coupon_code])
            if (couponRows.length > 0 && couponRows[0].influencer_id) {
                const influencerId = couponRows[0].influencer_id
                await db.execute(
                    "INSERT INTO user_balance (user_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance = balance + ?",
                    [influencerId, ticket.influencer_comission, ticket.influencer_comission]
                )
            }
        }

        // 3. Atualiza status do ticket
        await db.execute("UPDATE tickets SET status = 'PAID' WHERE id = ?", [ticket.id])

        // 4. Notificações e cargos (se houver interação/canal)
        const channel = client.channels.cache.get(ticket.channel_id) as TextChannel
        if (channel) {
            await channel.setName(channel.name.replace("🎟️", "💵")).catch(() => {})
            await channel.send({ content: "@everyone 💵 **Pagamento confirmado!** O pedido já pode ser processado." })

            // Se tiver a mensagem original, atualiza os botões
            if (interaction && interaction.message) {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId("paid_done").setLabel("Pago").setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji("🎉"),
                    new ButtonBuilder().setCustomId("mark_in_service").setLabel("Atender").setStyle(ButtonStyle.Primary).setEmoji("👨‍💻"),
                    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fechar").setStyle(ButtonStyle.Danger).setEmoji("🔒")
                )
                await interaction.message.edit({ components: [row] }).catch(() => {})
            }
        }

        // 5. Atribui cargo de cliente
        if (ENV.roleClienteId) {
            try {
                const guild = client.guilds.cache.get(ENV.serverid!)
                if (guild) {
                    const member = await guild.members.fetch(ticket.user_id).catch(() => null)
                    const role = await guild.roles.fetch(ENV.roleClienteId).catch(() => null)
                    if (member && role) await member.roles.add(role)
                }
            } catch (error) {
                console.error("[PaymentService] Erro ao atribuir cargo:", error)
            }
        }

        return true
    }
}
