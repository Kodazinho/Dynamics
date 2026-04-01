-- Esquema Unificado do Banco de Dados Dynamics

-- Tabela de Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    game_name VARCHAR(255) NOT NULL,
    gamepass_name VARCHAR(255) NOT NULL,
    gamepass_price INT NOT NULL,
    roblox_nick VARCHAR(100) NOT NULL,
    pix_payment_id VARCHAR(50),
    status ENUM('PENDING', 'PAID', 'DELIVERED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    channel_id VARCHAR(20) NULL,
    coupon_code VARCHAR(50) DEFAULT NULL,
    original_price DECIMAL(10,2) DEFAULT NULL,
    final_price DECIMAL(10,2) DEFAULT NULL,
    invite_discount_used INT DEFAULT 0,
    balance_used DECIMAL(10,2) DEFAULT 0.00,
    influencer_comission DECIMAL(10,2) DEFAULT 0.00
);

-- Tabela de Cupons
CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_percent INT NOT NULL,
    max_uses INT NOT NULL,
    used_count INT DEFAULT 0,
    expires_at DATETIME NOT NULL,
    booster BOOLEAN DEFAULT 0,
    influencer_id VARCHAR(50) DEFAULT NULL,
    influencer_percent INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Saldo de Usuários
CREATE TABLE IF NOT EXISTS user_balance (
    user_id VARCHAR(50) PRIMARY KEY,
    balance DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Convites (Se necessário pelo InviteHandler)
CREATE TABLE IF NOT EXISTS invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inviter_id VARCHAR(50) NOT NULL,
    invited_id VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
