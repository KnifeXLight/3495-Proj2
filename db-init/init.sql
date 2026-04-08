USE analytics_db;

-- 1. Create the Users Table (Used by Authentication Service)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create the Raw Data Table (Used by the Enter Data Web App & Analytics Service)
CREATE TABLE IF NOT EXISTS raw_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    data_value FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Insert some dummy data for testing
INSERT INTO users (username, password) VALUES
    ('admin', 'admin123'),
    ('student', 'pass123');

INSERT INTO raw_data (user_id, data_value) VALUES
    (1, 85.5),
    (1, 92.0),
    (2, 78.5),
    (2, 88.0);