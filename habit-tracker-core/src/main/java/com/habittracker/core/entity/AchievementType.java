package com.habittracker.core.entity;

public enum AchievementType {
    FIRST_HABIT("🎯 Первая привычка", "Создайте свою первую привычку", 1),
    FIRST_COMPLETION("✅ Первое выполнение", "Отметьте выполнение привычки впервые", 1),
    STREAK_7("🔥 7 дней подряд", "Выполняйте привычку 7 дней подряд", 7),
    STREAK_30("🔥🔥 30 дней подряд", "Выполняйте привычку 30 дней подряд", 30),
    STREAK_100("🔥🔥🔥 100 дней подряд", "Выполняйте привычку 100 дней подряд", 100),
    COMPLETIONS_10("🏆 10 выполнений", "Всего 10 выполнений любых привычек", 10),
    COMPLETIONS_50("🏆🏆 50 выполнений", "Всего 50 выполнений любых привычек", 50),
    COMPLETIONS_100("🏆🏆🏆 100 выполнений", "Всего 100 выполнений любых привычек", 100),
    HABITS_5("📚 5 привычек", "Создайте 5 привычек", 5),
    HABITS_10("📚📚 10 привычек", "Создайте 10 привычек", 10);

    private final String displayName;
    private final String description;
    private final int threshold;

    AchievementType(String displayName, String description, int threshold) {
        this.displayName = displayName;
        this.description = description;
        this.threshold = threshold;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
    public int getThreshold() { return threshold; }
}
