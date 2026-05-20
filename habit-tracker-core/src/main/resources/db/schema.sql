-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(20) NOT NULL,
    frequency VARCHAR(10) NOT NULL DEFAULT 'DAILY',
    target_count INTEGER DEFAULT 1,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Habit completions table
CREATE TABLE IF NOT EXISTS habit_completions (
    id BIGSERIAL PRIMARY KEY,
    habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    note TEXT,
    UNIQUE (habit_id, completed_date)
);

CREATE INDEX idx_habit_completions_date ON habit_completions(completed_date);
CREATE INDEX idx_habits_user ON habits(user_id);
