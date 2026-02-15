import axios, { AxiosInstance } from "axios"
import chalk from "chalk"

export class Asaas {
    private client: AxiosInstance
    private defaultCustomerId: string

    constructor() {
        const apiKey = process.env.ASAAS_API_KEY
        const baseUrl = process.env.ASAAS_BASE_URL
        const customerId = process.env.ASAAS_DEFAULT_CUSTOMER_ID

        if (!apiKey || !baseUrl || !customerId) {
            console.log(
                chalk.redBright("[ASAAS ERROR] Variáveis de ambiente não configuradas corretamente")
            )
            process.exit(1)
        }

        this.defaultCustomerId = customerId

        this.client = axios.create({
            baseURL: baseUrl,
            headers: {
                "Content-Type": "application/json",
                access_token: apiKey
            }
        })

        console.log(chalk.greenBright("[ASAAS] Serviço inicializado com sucesso"))
    }

    async createPixCharge(value: number): Promise<{ id: string, encodedImage: string, payload: string } | null> {
        if (value <= 0) return null
    
        try {
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 1)
    
            const response = await this.client.post("/payments", {
                customer: this.defaultCustomerId,
                billingType: "PIX",
                value,
                dueDate: dueDate.toISOString().split("T")[0],
                description: "Pagamento via PIX"
            })
    
            const payment = response.data
            
            const qrCodeResponse = await this.client.get(`/payments/${payment.id}/pixQrCode`)
            const qrCodeData = qrCodeResponse.data
    
            console.log(chalk.greenBright(`[ASAAS] Cobrança e QR Code criados com sucesso: ${payment.id}`))
    
            return {
                id: payment.id,
                encodedImage: qrCodeData.encodedImage,
                payload: qrCodeData.payload
            }
        } catch (error: any) {
            console.log(chalk.redBright("[ASAAS ERROR] Falha ao criar cobrança"))
            console.log(chalk.gray(JSON.stringify(error.response?.data) || error.message))
            return null
        }
    }
    

    async isPixPaid(paymentId: string): Promise<boolean> {
        if (!paymentId) {
            console.log(
                chalk.yellowBright("[ASAAS WARNING] paymentId inválido")
            )
            return false
        }

        try {
            const response = await this.client.get(`/payments/${paymentId}`)

            const status: string = response.data.status

            if (status === "RECEIVED" || status === "CONFIRMED" || status == "RECEIVED_IN_CASH") {
                console.log(
                    chalk.greenBright(`[ASAAS] Pagamento confirmado: ${paymentId}`)
                )
                return true
            }

            console.log(
                chalk.blueBright(`[ASAAS] Pagamento ainda não confirmado: ${status}`)
            )

            return false
        } catch (error: any) {
            console.log(
                chalk.redBright("[ASAAS ERROR] Falha ao verificar pagamento")
            )
            console.log(chalk.gray(JSON.stringify(error.response?.data) || error.message))
            return false
        }
    }
}
