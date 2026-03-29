import { Client, Collection, Invite, GuildMember, TextChannel, EmbedBuilder } from "discord.js"
import { db } from "../services/database"
import { Logger } from "../utils/logger"
import { ENV } from "../config/env"

export class InviteHandler {
    private client: Client
    private invites: Collection<string, Collection<string, number>> = new Collection()

    constructor(client: Client) {
        this.client = client
        this.registerEvents()
    }

    private async registerEvents() {
        this.client.on("ready", async () => {
            const guildId = ENV.serverid
            if (!guildId) return

            const guild = await this.client.guilds.fetch(guildId).catch(() => null)
            if (!guild) return

            const guildInvites = await guild.invites.fetch().catch(() => new Collection<string, Invite>())
            const inviteCounts = new Collection<string, number>()
            guildInvites.forEach(invite => {
                inviteCounts.set(invite.code, invite.uses || 0)
            })
            this.invites.set(guild.id, inviteCounts)
            Logger.success(`[InviteHandler] Cache de convites inicializado para ${guild.name}`)
        })

        this.client.on("inviteCreate", (invite) => {
            if (!invite.guild) return
            const guildInvites = this.invites.get(invite.guild.id) || new Collection<string, number>()
            guildInvites.set(invite.code, invite.uses || 0)
            this.invites.set(invite.guild.id, guildInvites)
        })

        this.client.on("inviteDelete", (invite) => {
            if (!invite.guild) return
            const guildInvites = this.invites.get(invite.guild.id)
            if (guildInvites) {
                guildInvites.delete(invite.code)
            }
        })

        this.client.on("guildMemberAdd", async (member) => {
            if (member.guild.id !== ENV.serverid) return

            const oldInvites = this.invites.get(member.guild.id)
            const newInvites = await member.guild.invites.fetch().catch(() => new Collection<string, Invite>())
            
            let inviterId: string | null = null
            
            for (const [code, invite] of newInvites) {
                const oldUses = oldInvites?.get(code) || 0
                if (invite.uses && invite.uses > oldUses) {
                    inviterId = invite.inviter?.id || null
                    // Atualiza cache
                    const guildInvites = oldInvites || new Collection<string, number>()
                    guildInvites.set(code, invite.uses)
                    this.invites.set(member.guild.id, guildInvites)
                    break
                }
            }

            if (!inviterId) return

            // Verificação de segurança: conta com pelo menos 2 meses (60 dias)
            const twoMonthsInMs = 60 * 24 * 60 * 60 * 1000
            const accountAge = Date.now() - member.user.createdTimestamp
            if (accountAge < twoMonthsInMs) {
                Logger.info(`[InviteHandler] Convite de ${member.user.tag} ignorado: conta muito nova.`)
                return
            }

            // Evitar auto-convite
            if (inviterId === member.id) return

            try {
                // Tenta inserir o convite (UNIQUE constraint no invited_id evita duplicatas de sair/entrar)
                const [result]: any = await db.execute(
                    "INSERT IGNORE INTO invites (inviter_id, invited_id, guild_id, status) VALUES (?, ?, ?, 'ACTIVE')",
                    [inviterId, member.id, member.guild.id]
                )

                if (result.affectedRows > 0) {
                    // Atualiza estatísticas do convidador
                    await db.execute(
                        "INSERT INTO invite_stats (user_id, total_invites, active_invites) VALUES (?, 1, 1) ON DUPLICATE KEY UPDATE total_invites = total_invites + 1, active_invites = active_invites + 1",
                        [inviterId]
                    )
                    Logger.info(`[InviteHandler] ${member.user.tag} entrou via convite de ${inviterId}.`)
                }
            } catch (error) {
                console.error("[InviteHandler Error]", error)
            }
        })

        this.client.on("guildMemberRemove", async (member) => {
            if (member.guild.id !== ENV.serverid) return

            try {
                // Busca se o membro que saiu era um convite ativo
                const [rows]: any = await db.execute(
                    "SELECT inviter_id FROM invites WHERE invited_id = ? AND status = 'ACTIVE'",
                    [member.id]
                )

                if (rows.length > 0) {
                    const inviterId = rows[0].inviter_id
                    
                    // Marca como LEFT
                    await db.execute(
                        "UPDATE invites SET status = 'LEFT' WHERE invited_id = ? AND status = 'ACTIVE'",
                        [member.id]
                    )

                    // Decrementa convites ativos do convidador
                    await db.execute(
                        "UPDATE invite_stats SET active_invites = GREATEST(0, active_invites - 1) WHERE user_id = ?",
                        [inviterId]
                    )
                    Logger.info(`[InviteHandler] ${member.user.tag} saiu. Convite removido de ${inviterId}.`)
                }
            } catch (error) {
                console.error("[InviteHandler Error]", error)
            }
        })
    }

    public static async getUserInvites(userId: string) {
        const [rows]: any = await db.execute(
            "SELECT * FROM invite_stats WHERE user_id = ?",
            [userId]
        )
        if (rows.length === 0) {
            return { total: 0, active: 0, discount: 0 }
        }
        const stats = rows[0]
        const discount = Math.min(stats.active_invites, 5) // Máximo 5%
        return {
            total: stats.total_invites,
            active: stats.active_invites,
            discount: discount
        }
    }

    public static async consumeInvites(userId: string, amount: number) {
        // Marca os convites mais antigos como USED
        await db.execute(
            "UPDATE invites SET status = 'USED' WHERE inviter_id = ? AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT ?",
            [userId, amount]
        )
        
        // Atualiza estatísticas
        await db.execute(
            "UPDATE invite_stats SET active_invites = GREATEST(0, active_invites - ?), used_invites = used_invites + ? WHERE user_id = ?",
            [amount, amount, userId]
        )
    }
}
