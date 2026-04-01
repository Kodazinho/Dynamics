import fs from "fs"
import path from "path"
import { REST, Routes } from "discord.js"
import { ENV } from "../config/env"
import { Logger } from "../utils/logger"

export async function loadCommands(client: any) {
    const commandsPath = path.join(__dirname, "../commands")
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'))

    const commands = []

    for (const file of commandFiles) {
        const command = await import(`../commands/${file}`)
        if (command.default && command.default.data) {
            client.commands.set(command.default.data.name, command.default)
            commands.push(command.default.data.toJSON())
        }
    }

    const rest = new REST({ version: "10" }).setToken(ENV.token)

    try {
        await rest.put(
            Routes.applicationCommands(ENV.clientId as string),
            { body: commands }
        )
        Logger.success("Comandos carregados com sucesso")
    } catch (error) {
        Logger.error("Erro ao registrar comandos: " + error)
    }
}
