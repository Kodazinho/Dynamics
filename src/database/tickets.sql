CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    game_name VARCHAR(255) NOT NULL,
    gamepass_name VARCHAR(255) NOT NULL,
    gamepass_price INT NOT NULL,
    roblox_nick VARCHAR(100) NOT NULL,
    pix_payment_id VARCHAR(50),
    status ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
