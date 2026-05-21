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
    reminder_time VARCHAR(10),
    interval_hours INTEGER,
    notifications_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT habits_frequency_check CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL'))
);

-- Обновить constraint и добавить колонку если таблица уже существовала
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_frequency_check;
ALTER TABLE habits ADD CONSTRAINT habits_frequency_check CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS interval_hours INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_hour VARCHAR(5);

-- Habit completions table
CREATE TABLE IF NOT EXISTS habit_completions (
    id BIGSERIAL PRIMARY KEY,
    habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL,
    completed_at TIMESTAMP,
    completed BOOLEAN NOT NULL DEFAULT false,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(completed_date);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
