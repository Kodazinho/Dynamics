import { Client, GatewayIntentBits, Collection } from "discord.js"

export interface BotClient extends Client {
    commands: Collection<string, any>
}

export function createClient(): BotClient {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent 
        ]
    }) as BotClient

    client.commands = new Collection()

    return client
}
