import { ENV } from "./config/env"
import { createClient } from "./client"
import { loadCommands } from "./handlers/commandHandler"
import { Logger } from "./utils/logger"
import { TicketHandler } from "./handlers/ticketHandler"
import { WelcomeHandler } from "./handlers/welcomeHandler"
import { InviteHandler } from "./handlers/inviteHandler"
import { StatusService } from "./services/statusService"

if (!ENV.owner) {
    throw new Error("❌ OWNER_ID não definido no .env")
}

const OWNER_IDS = ENV.owner.split(",").map(id => id.trim())

const client = createClient()
new TicketHandler(client)
new WelcomeHandler(client)
new InviteHandler(client)

client.once("ready", async () => {
    Logger.success(`Bot online como ${client.user?.tag}`)
    
    const statusService = StatusService.getInstance()
    await statusService.updateVoiceChannel(client)

    const allowedServerId = ENV.serverid
    if (!allowedServerId) {
        Logger.error("SERVER_ID não definido no .env")
        return
    }

    // Corrigido: Usando for...of para aguardar as operações async
    for (const [id, guild] of client.guilds.cache) {
        if (id !== allowedServerId) {
            try {
                await guild.leave()
                Logger.info(`Sai do servidor: ${guild.name} (${guild.id})`)
            } catch (err) {
                Logger.error(`Falha ao sair do servidor: ${guild.name} (${guild.id})`)
                console.log(err)
            }
        } else {
            Logger.success(`Permanece no servidor permitido: ${guild.name} (${guild.id})`)
        }
    }
})

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return

    if (interaction.commandName !== "invites" && interaction.commandName !== "saldo" && !OWNER_IDS.includes(interaction.user.id)) {
        return interaction.reply({
            content: "❌ Você não tem permissão para usar este comando.",
            ephemeral: true
        })
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return

    try {
        await command.execute(interaction)
    } catch (error) {
        Logger.error(`Erro ao executar comando ${interaction.commandName}`)
        console.log(error)
        
        // Corrigido: Responde ao usuário em caso de erro
        const errorMessage = "❌ Ocorreu um erro ao executar este comando."
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: errorMessage }).catch(() => {})
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {})
        }
    }
})

async function start() {
    await loadCommands(client)
    await client.login(ENV.token)
}

start()
