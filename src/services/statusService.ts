import fs from "fs"
import path from "path"
import { Client, VoiceChannel } from "discord.js"
import { ENV } from "../config/env"
import { Logger } from "../utils/logger"
import { joinVoiceChannel } from "@discordjs/voice"

const STATUS_FILE = path.join(__dirname, "../../status.json")

export class StatusService {
    private static instance: StatusService
    private isOpen: boolean = true

    private constructor() {
        this.loadStatus()
    }

    public static getInstance(): StatusService {
        if (!StatusService.instance) {
            StatusService.instance = new StatusService()
        }
        return StatusService.instance
    }

    private loadStatus() {
        try {
            if (fs.existsSync(STATUS_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"))
                this.isOpen = data.isOpen
            }
        } catch (error) {
            Logger.error("Erro ao carregar status.json")
        }
    }

    private saveStatus() {
        try {
            fs.writeFileSync(STATUS_FILE, JSON.stringify({ isOpen: this.isOpen }))
        } catch (error) {
            Logger.error("Erro ao salvar status.json")
        }
    }

    public getStatus(): boolean {
        return this.isOpen
    }

    public async setStatus(isOpen: boolean, client: Client) {
        this.isOpen = isOpen
        this.saveStatus()
        
        // Executa a atualização do canal de voz em segundo plano para não travar a resposta do comando
        this.updateVoiceChannel(client).catch(err => {
            Logger.error("Erro assíncrono ao atualizar canal de voz")
            console.error(err)
        })
    }

    public async updateVoiceChannel(client: Client) {
        const channelId = ENV.statusVoiceChannelId
        if (!channelId) return

        try {
            const channel = await client.channels.fetch(channelId) as VoiceChannel
            if (!channel || !channel.isVoiceBased()) return

            const emoji = this.isOpen ? "🟢" : "🔴"
            const currentName = channel.name
            
            // Lógica melhorada para mudar apenas o emoji inicial
            let newName: string
            if (currentName.includes("﹕status﹒")) {
                const parts = currentName.split("﹕status﹒")
                newName = `${emoji}﹕status﹒${parts[1]}`
            } else {
                newName = `${emoji}﹕status﹒status﹒`
            }

            if (currentName !== newName) {
                // Rate limit do Discord para mudar nome de canal é rigoroso (2 vezes a cada 10 min)
                // Usamos catch para evitar que erros de rate limit quebrem o fluxo
                await channel.setName(newName).catch(e => Logger.error(`Rate limit ao mudar nome do canal: ${e.message}`))
            }

            // Conectar ao canal de voz (isso geralmente é rápido)
            joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: true
            })

            Logger.info(`Status atualizado para ${this.isOpen ? "ABERTO" : "FECHADO"} no canal de voz.`)
        } catch (error) {
            Logger.error("Erro ao atualizar canal de voz de status")
            console.error(error)
        }
    }
}
