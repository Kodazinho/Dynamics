import mysql from "mysql2/promise"
import { ENV } from "../config/env"
import { Logger } from "../utils/logger"

export const db = mysql.createPool({
    host: ENV.DB_HOST,
    port: ENV.DB_PORT ? Number(ENV.DB_PORT) : undefined,
    user: ENV.DB_USER,
    password: ENV.DB_PASSWORD,
    database: ENV.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

db.getConnection()
    .then(() => Logger.success("Conectado ao MySQL com sucesso"))
    .catch((err) => Logger.error("Erro ao conectar MySQL: " + err.message))
