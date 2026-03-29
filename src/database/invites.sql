CREATE TABLE IF NOT EXISTS invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inviter_id VARCHAR(50) NOT NULL,
    invited_id VARCHAR(50) NOT NULL UNIQUE,
    guild_id VARCHAR(50) NOT NULL,
    status ENUM('ACTIVE', 'LEFT', 'USED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (inviter_id),
    INDEX (invited_id)
);

CREATE TABLE IF NOT EXISTS invite_stats (
    user_id VARCHAR(50) PRIMARY KEY,
    total_invites INT DEFAULT 0,
    active_invites INT DEFAULT 0,
    used_invites INT DEFAULT 0,
    last_reset TIMESTAMP NULL
);
