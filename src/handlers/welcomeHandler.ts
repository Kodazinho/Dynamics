import { Client, TextChannel, EmbedBuilder } from "discord.js"
import { ENV } from "../config/env"

export class WelcomeHandler {
    private client: Client

    constructor(client: Client) {
        this.client = client
        this.registerEvents()
    }

    private registerEvents() {
        this.client.on("guildMemberAdd", async (member) => {
            
            try {
                const channelId = ENV.welcomeChannelId
                if (!channelId) return

                const channel = await member.guild.channels.fetch(channelId).catch(() => null) as TextChannel
                if (!channel) {
                    console.error(`[WelcomeHandler] Canal de boas-vindas ${channelId} não encontrado.`);
                    return;
                }

                const memberCount = member.guild.memberCount
                const welcomeImageUrl = "https://media.discordapp.net/attachments/1466793876357648600/1470193493770240031/73_Sem_Titulo_20260208200322.png?ex=698f0523&is=698db3a3&hm=56d0f26e2d604dd4a128881792abce58a9483c0d5423cd4564dc0204db34e003&=&format=webp&quality=lossless&width=1768&height=697"

                const embed = new EmbedBuilder( )
                    .setTitle("<:fro:1471955092948258898> .   !   BOAS-VINDAS")
                    .setDescription(`Olá ${member}, seja muito bem-vindo(a) à **Dynamics**! Ficamos felizes em ter você aqui conosco.`)
                    .addFields([
                        { 
                            name: "<a:branco9:1471948803195277497> Membro", 
                            value: `\`${member.user.username}\``, 
                            inline: true 
                        },
                        { 
                            name: "<a:branco9:1471948803195277497> Total de Membros", 
                            value: `\`${memberCount}\` membros`, 
                            inline: true 
                        }
                    ])
                    .setColor("#ffffff")
                    .setImage(welcomeImageUrl)
                    .setThumbnail(member.user.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: `ID do Usuário: ${member.user.id}` })

                await channel.send({
                    content: `Boas-vindas ${member}!`,
                    embeds: [embed]
                })
            } catch (error) {
                console.error("[WelcomeHandler Error]", error)
            }
        })
    }
}
