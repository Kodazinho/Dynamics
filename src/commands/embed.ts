import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    Attachment
} from "discord.js"
import fs from "fs"

export default {
    data: new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Envia um embed a partir de um arquivo JSON")
        .addAttachmentOption(option =>
            option
                .setName("file")
                .setDescription("Arquivo JSON do embed")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const attachment = interaction.options.getAttachment("file", true)

        if (!attachment.name?.endsWith(".json")) {
            await interaction.reply({
                content: "O arquivo precisa ser um JSON.",
                ephemeral: true
            })
            return
        }

        try {
            const response = await fetch(attachment.url)
            const json = await response.json()

            const embed = new EmbedBuilder()

            if (json.title) embed.setTitle(json.title)
            if (json.description) embed.setDescription(json.description)
            if (json.color) embed.setColor(json.color)
            if (json.image?.url) embed.setImage(json.image.url)
            if (json.thumbnail?.url) embed.setThumbnail(json.thumbnail.url)
            if (json.url) embed.setURL(json.url)
            if (json.footer?.text) {
                embed.setFooter({
                    text: json.footer.text,
                    iconURL: json.footer.icon_url
                })
            }

            if (Array.isArray(json.fields)) {
                embed.addFields(
                    json.fields.map((field: any) => ({
                        name: field.name,
                        value: field.value,
                        inline: field.inline ?? false
                    }))
                )
            }

            await interaction.reply({ embeds: [embed] })
        } catch (err) {
            console.error(err)
            await interaction.reply({
                content: "Falha ao ler ou processar o JSON.",
                ephemeral: true
            })
        }
    }
}
