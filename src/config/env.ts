import dotenv from "dotenv"
dotenv.config()

if (!process.env.DISCORD_TOKEN) {
    console.log("[ERROR] DISCORD_TOKEN não definido")
    process.exit(1)
}

export const ENV = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    serverid: process.env.SERVER_ID,
    categoriaid: process.env.CATEGORIA_ID,
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID,
    robuxprice: process.env.ROBUX_PRICE,
    asaasKey: process.env.ASAAS_API_KEY,
    asaasUrl: process.env.ASAAS_BASE_URL,
    asaasCustomer: process.env.ASAAS_DEFAULT_CUSTOMER_ID,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    owner: process.env.OWNER_ID, 
    logChannelId: process.env.LOG_CHANNEL_ID,
    maxPixValue: process.env.MAX_PIX_VALUE ? parseFloat(process.env.MAX_PIX_VALUE) : undefined,
    roleVerificarId: process.env.ROLE_VERIFICAR_ID ? String(process.env.ROLE_VERIFICAR_ID).trim() : undefined,
    roleClienteId: process.env.ROLE_CLIENTE_ID ? String(process.env.ROLE_CLIENTE_ID).trim() : undefined,
    salesChannelId: process.env.SALES_CHANNEL_ID ? String(process.env.SALES_CHANNEL_ID).trim() : undefined,
    statusVoiceChannelId: process.env.STATUS_VOICE_CHANNEL_ID ? String(process.env.STATUS_VOICE_CHANNEL_ID).trim() : undefined,
    ticketLogChannelId: process.env.TICKET_LOG_CHANNEL_ID ? String(process.env.TICKET_LOG_CHANNEL_ID).trim() : undefined,
}
