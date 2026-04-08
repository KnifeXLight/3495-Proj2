USE analytics_db;

-- 1. Create Users Table with ROLES
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'student') NOT NULL DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Grades Table
CREATE TABLE IF NOT EXISTS grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    score FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Insert Dummy Data (1 Admin, 2 Students)
INSERT INTO users (username, password, role) VALUES 
('teacher_admin', 'admin123', 'admin'),
('student_alice', 'pass123', 'student'),
('student_bob', 'pass123', 'student');

INSERT INTO grades (student_id, score) VALUES 
(2, 85.5),
(2, 92.0),
(3, 78.5),
(3, 88.0);