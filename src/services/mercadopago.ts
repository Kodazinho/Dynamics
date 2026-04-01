import { MercadoPagoConfig, Payment } from "mercadopago"
import { Logger } from "../utils/logger"

export class MercadoPago {
    private payment: Payment

    constructor() {
        const accessToken = process.env.MP_ACCESS_TOKEN!
        const client = new MercadoPagoConfig({ accessToken })
        this.payment = new Payment(client)
    }

    async createPixCharge(value: number): Promise<{ id: string; encodedImage: string; payload: string } | null> {
        try {
            const response = await this.payment.create({
                body: {
                    transaction_amount: Math.round(value * 100) / 100,
                    payment_method_id: "pix",
                    payer: { email: "cliente@email.com" }
                }
            });

            if (!response || !response.id) return null

            return {
                id: String(response.id),
                encodedImage: response.point_of_interaction?.transaction_data?.qr_code_base64 ?? "",
                payload: response.point_of_interaction?.transaction_data?.qr_code ?? ""
            }
        } catch (error) {
            Logger.error("Erro ao criar cobrança PIX: " + error)
            console.error(error);
            return null
        }
    }

    async isPixPaid(paymentId: string): Promise<boolean> {
        try {
            const response = await this.payment.get({ id: paymentId })
            return response.status === "approved"
        } catch (error) {
            Logger.error("Erro ao verificar pagamento PIX: " + error)
            return false
        }
    }
}
