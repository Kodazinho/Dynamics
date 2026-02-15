import chalk from "chalk"

export class Logger {
    static success(message: string) {
        console.log(chalk.greenBright(`[SUCCESS] ${message}`))
    }

    static error(message: string) {
        console.log(chalk.redBright(`[ERROR] ${message}`))
    }

    static warning(message: string) {
        console.log(chalk.yellowBright(`[WARNING] ${message}`))
    }

    static info(message: string) {
        console.log(chalk.cyanBright(`[INFO] ${message}`))
    }
}
