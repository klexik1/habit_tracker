package com.habittracker.core.dto;

import java.time.LocalDateTime;

public record ProfileDto(
    Long id,
    String username,
    String email,
    Boolean emailNotificationsEnabled,
    Boolean emailVerified,
    Boolean notifyAtMidnight,
    Boolean notifyHourBefore,
    LocalDateTime createdAt,
    long habitCount,
    long totalCompletions,
    long totalAchievements
) {}
