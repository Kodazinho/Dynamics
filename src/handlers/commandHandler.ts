import fs from "fs"
import path from "path"
import { REST, Routes } from "discord.js"
import { ENV } from "../config/env"
import { Logger } from "../utils/logger"

export async function loadCommands(client: any) {
    const commandsPath = path.join(__dirname, "../commands")
    const commandFiles = fs.readdirSync(commandsPath)

    const commands = []

    for (const file of commandFiles) {
        const command = await import(`../commands/${file}`)
        client.commands.set(command.default.data.name, command.default)
        commands.push(command.default.data.toJSON())
    }

    const rest = new REST({ version: "10" }).setToken(ENV.token)

    await rest.put(
        Routes.applicationCommands(ENV.clientId as string),
        { body: commands }
    )

    Logger.success("Comandos carregados com sucesso")
}
