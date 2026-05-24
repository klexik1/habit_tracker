-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email_notifications_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_at_midnight BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_hour_before BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_habit_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_completion_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_best_streak INTEGER DEFAULT 0;

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    frequency VARCHAR(10) NOT NULL DEFAULT 'DAILY',
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT achievements_user_type_freq UNIQUE (user_id, type, frequency)
);
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS frequency VARCHAR(10) NOT NULL DEFAULT 'DAILY';
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_user_type;
ALTER TABLE achievements ADD CONSTRAINT IF NOT EXISTS achievements_user_type_freq UNIQUE (user_id, type, frequency);

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
    interval_minutes INTEGER,
    notifications_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT habits_frequency_check CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL'))
);

-- Обновить constraint и добавить колонку если таблица уже существовала
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_frequency_check;
ALTER TABLE habits ADD CONSTRAINT habits_frequency_check CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL'));
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_category_check;
ALTER TABLE habits ALTER COLUMN category TYPE VARCHAR(50);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS interval_minutes INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_hour VARCHAR(5);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

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
