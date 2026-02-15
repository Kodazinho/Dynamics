import { Client, ModalSubmitInteraction, ButtonInteraction, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,  ModalBuilder, TextInputBuilder, TextInputStyle, GuildMember } from "discord.js"
import { db } from "../services/database"
import { Asaas } from "../services/asaas"
import { ENV } from "../config/env"
import { RobloxService } from "../services/roblox"

export class TicketHandler {
    private client: Client
    private asaas: Asaas

    constructor(client: Client) {
        this.client = client
        this.asaas = new Asaas()
        this.registerEvents()
    }

    private registerEvents() {
        this.client.on("interactionCreate", async (interaction) => {
            try {
                if (interaction.isButton()) {
                    if (interaction.customId === "open_ticket") {
                        await this.handleButton(interaction)
                    } else if (interaction.customId.startsWith("check_payment_")) {
                        await this.handlePaymentCheck(interaction)
                    } else if (interaction.customId === "close_ticket") {
                        await this.handleCloseTicket(interaction)
                    } else if (interaction.customId === "mark_in_service") {
                        await this.handleMarkInService(interaction)
                    } else if (interaction.customId === "mark_delivered") {
                        await this.handleMarkDelivered(interaction)
                    } else if (interaction.customId === "verify_member") {
                        await this.handleVerifyMember(interaction)
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
        if (!roleId || roleId === "undefined" || roleId === "") {
            return await interaction.editReply({ content: "❌ O ID do cargo de membro não está configurado corretamente no .env (ROLE_VERIFICAR_ID)." })
        }

        if (interaction.member instanceof GuildMember) {
            try {
                const role = await interaction.guild?.roles.fetch(roleId).catch(() => null)
                
                if (!role) {
                    return await interaction.editReply({ content: `❌ O cargo com ID \`${roleId}\` não foi encontrado no servidor. Verifique se o ID no .env está correto.` })
                }

                await interaction.member.roles.add(role)
                await interaction.editReply({ content: "✅ Você foi verificado com sucesso e recebeu o cargo de membro!" })
            } catch (error: any) {
                console.error("[Verify Error]", error)
                let errorMsg = "❌ Erro ao atribuir o cargo."
                if (error.code === 50013) errorMsg += " O bot não tem permissão para gerenciar este cargo (verifique se o cargo do bot está ACIMA deste cargo na hierarquia)."
                await interaction.editReply({ content: errorMsg })
            }
        }
    }

    private async handleButton(interaction: ButtonInteraction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import("discord.js")

        const modal = new ModalBuilder()
            .setCustomId("ticket_modal")
            .setTitle("Informações do Ticket")

        const gameName = new TextInputBuilder()
            .setCustomId("game_name")
            .setLabel("Nome do jogo")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)

        const gamepassName = new TextInputBuilder()
            .setCustomId("gamepass_name")
            .setLabel("Nome da Gamepass")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)

        const price = new TextInputBuilder()
            .setCustomId("gamepass_price")
            .setLabel("Preço da Gamepass (Robux)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)

        const robloxNick = new TextInputBuilder()
            .setCustomId("roblox_nick")
            .setLabel("Nick no Roblox")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)

        modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(gameName),
                new ActionRowBuilder<TextInputBuilder>().addComponents(gamepassName),
                new ActionRowBuilder<TextInputBuilder>().addComponents(price),
                new ActionRowBuilder<TextInputBuilder>().addComponents(robloxNick)
            );

        await interaction.showModal(modal)
    }

    private async handleModal(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true })

        const gameName = interaction.fields.getTextInputValue("game_name")
        const gamepassName = interaction.fields.getTextInputValue("gamepass_name")
        const gamepassPriceStr = interaction.fields.getTextInputValue("gamepass_price")
        const gamepassPrice = parseInt(gamepassPriceStr)
        const robloxNick = interaction.fields.getTextInputValue("roblox_nick")
        
        const categoryId = ENV.categoriaid

        if (isNaN(gamepassPrice)) {
            return await interaction.editReply({ content: "❌ Por favor, insira um valor numérico válido para o preço da Gamepass." })
        }

        const robuxPrice = parseFloat(ENV.robuxprice || "0")
        const value = gamepassPrice * robuxPrice

        if (value < 5.00) {
            return await interaction.editReply({ 
                content: `❌ O valor total da compra (R$ ${value.toFixed(2)}) é inferior ao mínimo permitido pelo sistema de pagamentos (R$ 5,00).\n\nPara prosseguir, a quantidade de Robux deve resultar em pelo menos R$ 5,00 (Aproximadamente ${Math.ceil(5 / robuxPrice)} Robux).` 
            })
        }

        if (ENV.maxPixValue !== undefined && value > ENV.maxPixValue) {
            return await interaction.editReply({
                content: `❌ O valor total da compra (R$ ${value.toFixed(2)}) excede o limite máximo permitido por transação (R$ ${ENV.maxPixValue.toFixed(2)}).\n\nPor favor, reduza a quantidade de Robux ou entre em contato com o suporte.`
            })
        }

        const channel = await interaction.guild?.channels.create({
            name: `🎟️- ${interaction.user.username}`,
            type: 0,
            parent: categoryId,
            permissionOverwrites: [
                { id: interaction.guild!.roles.everyone.id, deny: ["ViewChannel"] },
                { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "AttachFiles"] }
            ]
        }) as TextChannel

        if (!channel) {
            return await interaction.editReply({ content: "❌ Erro ao criar o canal do ticket. Verifique as permissões do bot e o ID da categoria." })
        }

        const pixCharge = await this.asaas.createPixCharge(value)
        
        if (!pixCharge) {
            await channel.delete().catch(() => {})
            return await interaction.editReply({ content: "❌ Erro ao gerar a cobrança PIX. Tente novamente mais tarde." })
        }

        const { id: paymentId, encodedImage, payload } = pixCharge

        const robloxAvatar = await RobloxService.getUserAvatar(robloxNick)

        await db.execute(
            "INSERT INTO tickets (user_id, game_name, gamepass_name, gamepass_price, roblox_nick, pix_payment_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [interaction.user.id, gameName, gamepassName, gamepassPrice, robloxNick, paymentId, 'PENDING']
        )

        const embed = new EmbedBuilder()
            .setTitle("Pagamento PIX")
            .setDescription(`Olá ${interaction.user}, siga o PIX abaixo para pagar sua gamepass!\n\n**Copie e Cole:**\n\`\`\`${payload}\`\`\``)
            .addFields([
                { name: "👤 Nick Roblox", value: `\`${robloxNick}\``, inline: true },
                { name: "🎮 Jogo", value: `\`${gameName}\``, inline: true },
                { name: "🎫 Gamepass", value: `\`${gamepassName}\``, inline: true },
                { name: "💎 Preço (Robux)", value: `${gamepassPrice} Robux`, inline: true },
                { name: "💰 Valor (BRL)", value: `R$ ${value.toFixed(2)}`, inline: true },
                { name: "🆔 ID Pagamento", value: `\`${paymentId}\``, inline: false }
            ])
            .setColor("#FFFFFF")
            .setFooter({ text: "O pagamento é processado automaticamente após a confirmação." })

        if (robloxAvatar) {
            embed.setThumbnail(robloxAvatar)
        }

        const checkButton = new ButtonBuilder()
            .setCustomId(`check_payment_${paymentId}`)
            .setLabel("Verificar Pagamento")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅")

        const closeButton = new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("Fechar Ticket")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🔒")

        const serviceButton = new ButtonBuilder()
            .setCustomId("mark_in_service")
            .setLabel("Em Atendimento")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("👨‍💻")

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(checkButton, serviceButton, closeButton)

        const files: AttachmentBuilder[] = []
        if (encodedImage) {
            const buffer = Buffer.from(encodedImage, "base64")
            files.push(new AttachmentBuilder(buffer, { name: "pix.png" }))
            embed.setImage("attachment://pix.png")
        }

        await channel.send({
            content: `<@${interaction.user.id}>`,
            embeds: [embed],
            components: [row],
            files
        })

        await interaction.editReply({ content: `✅ Seu ticket foi criado com sucesso: ${channel}` })
    }

    private async handlePaymentCheck(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true })
        
        const paymentId = interaction.customId.replace("check_payment_", "")
        const isPaid = await this.asaas.isPixPaid(paymentId)

        if (isPaid) {
            await db.execute(
                "UPDATE tickets SET status = 'PAID' WHERE pix_payment_id = ?",
                [paymentId]
            )

            const roleId = ENV.roleClienteId
            if (roleId && roleId !== "undefined" && roleId !== "" && interaction.member instanceof GuildMember) {
                try {
                    const role = await interaction.guild?.roles.fetch(roleId).catch(() => null)
                    if (role) {
                        await interaction.member.roles.add(role)
                    } else {
                        console.error(`[Role Error] Cargo de cliente com ID ${roleId} não encontrado.`)
                    }
                } catch (err) {
                    console.error("[Role Error] Erro ao adicionar cargo de cliente:", err)
                }
            }

            const channel = interaction.channel as TextChannel
            
            if (channel) {
                const newName = channel.name.replace("🎟️", "💵")
                await channel.setName(newName).catch(console.error)
                
                await channel.send({ content: "@everyone 💵 **Pagamento confirmado!** O pedido já pode ser processado." })
            }

            await interaction.editReply({ content: "Pagamento confirmado com sucesso! ✅" })
            
            const disabledButton = new ButtonBuilder()
                .setCustomId("paid_confirmed")
                .setLabel("Pagamento Confirmado")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji("🎉")

            const closeButton = new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("Fechar Ticket")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("🔒")
            
            const serviceButton = new ButtonBuilder()
                .setCustomId("mark_in_service")
                .setLabel("Em Atendimento")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("👨‍💻")

            await interaction.message.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton, serviceButton, closeButton)]
            })
        } else {
            await interaction.editReply({ content: "Pagamento ainda não detectado. ❌" })
        }
    }

    private async handleMarkInService(interaction: ButtonInteraction) {
        const owners = ENV.owner ? ENV.owner.split(",").map(id => id.trim()) : [];
        if (!owners.includes(interaction.user.id)) {
            return await interaction.reply({ content: "❌ Apenas proprietários podem manusear este botão.", ephemeral: true })
        }

        await interaction.deferUpdate()

        const row = ActionRowBuilder.from(interaction.message.components[0] as any) as ActionRowBuilder<ButtonBuilder>
        const components = row.components.map(button => {
            if (button.data.custom_id === "mark_in_service") {
                return new ButtonBuilder()
                    .setCustomId("mark_delivered")
                    .setLabel("Entregue")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("📦")
            }
            return ButtonBuilder.from(button as any)
        })

        await interaction.message.edit({
            content: `${interaction.message.content}\n\n👨‍💻 **Atendimento assumido por:** ${interaction.user}`,
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)]
        })
    }

    private async handleMarkDelivered(interaction: ButtonInteraction) {
        const owners = ENV.owner ? ENV.owner.split(",").map(id => id.trim()) : [];
        if (!owners.includes(interaction.user.id)) {
            return await interaction.reply({ content: "❌ Apenas proprietários podem manusear este botão.", ephemeral: true })
        }

        await interaction.deferUpdate()

        const row = ActionRowBuilder.from(interaction.message.components[0] as any) as ActionRowBuilder<ButtonBuilder>
        const components = row.components.map(button => {
            if (button.data.custom_id === "mark_delivered") {
                return new ButtonBuilder()
                    .setCustomId("delivered_done")
                    .setLabel("Produto Entregue")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                    .setEmoji("✅")
            }
            return ButtonBuilder.from(button as any)
        })

        await interaction.message.edit({
            content: `${interaction.message.content}\n\n📦 **Produto entregue por:** ${interaction.user}`,
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)]
        })

        try {
            const salesChannelId = ENV.salesChannelId
            if (salesChannelId) {
                const salesChannel = await this.client.channels.fetch(salesChannelId).catch(() => null) as TextChannel
                if (salesChannel) {
                    
                    const [ticketData]: any = await db.execute(
                        "SELECT * FROM tickets WHERE status != 'CLOSED' AND (user_id = ? OR ? LIKE CONCAT('%', user_id, '%')) ORDER BY created_at DESC LIMIT 1",
                        [interaction.user.id, interaction.message.content]
                    )

                    if (ticketData && ticketData.length > 0) {
                        const ticket = ticketData[0]
                        const robloxAvatar = await RobloxService.getUserAvatar(ticket.roblox_nick)

                        const salesEmbed = new EmbedBuilder()
                            .setTitle("<:fro:1471955092948258898> .   !   VENDA REALIZADA")
                            .setDescription("Mais uma entrega concluída com sucesso em nossa loja!")
                            .addFields([
                                { name: "<a:branco9:1471948803195277497> Produto", value: `\`${ticket.gamepass_name}\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Quantidade", value: `\`${ticket.gamepass_price} Robux\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Jogo", value: `\`${ticket.game_name}\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Jogador", value: `\`${ticket.roblox_nick}\``, inline: true },
                                { name: "<a:branco9:1471948803195277497> Atendido por", value: `${interaction.user}`, inline: true }
                            ])
                            .setImage("https://media.discordapp.net/attachments/1464406013255090309/1471958305604632689/70_Sem_Titulo_20260213165633.png?ex=69917c3f&is=69902abf&hm=d63280836f56c02e2c2db04c50d4ff0d48d51981d3f6720625acb63224ed546a&=&format=webp&quality=lossless")
                            .setColor("#ffffff")
                            .setTimestamp()

                        if (robloxAvatar) {
                            salesEmbed.setThumbnail(robloxAvatar)
                        }

                        await salesChannel.send({ embeds: [salesEmbed] })
                    }
                }
            }
        } catch (error) {
            console.error("[Sales Embed Error]", error)
        }
    }

    private async handleCloseTicket(interaction: ButtonInteraction) {
        await interaction.deferReply()

        const channel = interaction.channel as TextChannel
        const messages = await channel.messages.fetch({ limit: 100 })
        const transcript = messages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).join("\n")
        
        const [ticketData]: any = await db.execute(
            "SELECT * FROM tickets WHERE user_id = ? AND status != 'CLOSED' ORDER BY created_at DESC LIMIT 1",
            [interaction.user.id]
        )

        let paymentStatus = "Não verificado"
        let isPaid = false

        if (ticketData && ticketData.length > 0) {
            const ticket = ticketData[0]
            if (ticket.status === 'PAID') {
                isPaid = true
                paymentStatus = "PAGO"
            } else if (ticket.pix_payment_id) {
                isPaid = await this.asaas.isPixPaid(ticket.pix_payment_id)
                paymentStatus = isPaid ? "PAGO" : "NÃO PAGO"
                
                if (isPaid) {
                    await db.execute("UPDATE tickets SET status = 'PAID' WHERE id = ?", [ticket.id])
                }
            }
        }

        const logChannelId = ENV.logChannelId
        if (logChannelId) {
            const logChannel = await this.client.channels.fetch(logChannelId).catch(() => null) as TextChannel
            if (logChannel) {
                const attachment = new AttachmentBuilder(Buffer.from(transcript), { name: `transcript-${channel.name}.txt` })
                
                const logEmbed = new EmbedBuilder()
                    .setTitle(`Ticket Fechado - ${channel.name}`)
                    .addFields([
                        { name: "Usuário", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: "Aberto em", value: ticketData?.[0]?.created_at?.toLocaleString() || "N/A", inline: true },
                        { name: "Fechado em", value: new Date().toLocaleString(), inline: true },
                        { name: "Status de Pagamento", value: `**${paymentStatus}**`, inline: false }
                    ])
                    .setColor(isPaid ? "#00FF00" : "#FF0000")
                    .setTimestamp()

                await logChannel.send({ embeds: [logEmbed], files: [attachment] })
            }
        }

        await interaction.editReply({ content: "O ticket foi processado e será fechado em 5 segundos... 🔒" })
        
        setTimeout(async () => {
            try {
                await channel.delete()
            } catch (error) {
                console.error("[CloseTicket Error]", error)
            }
        }, 5000)
    }
}
