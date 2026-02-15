import axios from "axios"

export class RobloxService {
    /**
     * Busca o ID do usuário pelo nick e depois a URL do avatar (headshot)
     */
    static async getUserAvatar(username: string): Promise<string | null> {
        try {
            const userResponse = await axios.post("https://users.roblox.com/v1/usernames/users", {
                usernames: [username],
                excludeBannedUsers: true
            })

            const userData = userResponse.data.data[0]
            if (!userData) return null

            const userId = userData.id

            const avatarResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`)
            
            const avatarData = avatarResponse.data.data[0]
            return avatarData ? avatarData.imageUrl : null
        } catch (error) {
            console.error("[Roblox API Error]", error)
            return null
        }
    }
}
