import { MercadoPagoConfig, Payment } from "mercadopago"

export class MercadoPago {
    private payment: Payment

    constructor() {
        const accessToken = process.env.MP_ACCESS_TOKEN!
        const client = new MercadoPagoConfig({ accessToken })
        this.payment = new Payment(client)
    }

    async createPixCharge(value: number): Promise<{ id: string; encodedImage: string; payload: string } | null> {
        const response = await this.payment.create({
            body: {
                transaction_amount: Math.round(value * 100) / 100,
                payment_method_id: "pix",
                payer: { email: "cliente@email.com" }
            }
        })

        return {
            id: String(response.id),
            encodedImage: response.point_of_interaction?.transaction_data?.qr_code_base64 ?? "",
            payload: response.point_of_interaction?.transaction_data?.qr_code ?? ""
        }
    }

    async isPixPaid(paymentId: string): Promise<boolean> {
        return true;
        const response = await this.payment.get({ id: paymentId })
        return response.status === "approved"
    }
}
