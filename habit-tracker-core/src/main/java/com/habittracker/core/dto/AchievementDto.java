package com.habittracker.core.dto;

public record AchievementDto(
    String type,
    String name,
    String description,
    boolean unlocked,
    int progress,
    int threshold,
    String unlockedAt
) {}
