package com.habittracker.core.dto;

import com.habittracker.core.entity.Category;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.HabitType;

import java.time.LocalDateTime;

public record HabitDto(
    Long id,
    String name,
    String description,
    String category,
    Frequency frequency,
    HabitType habitType,
    Integer targetCount,
    String reminderTime,
    String reminderHour,
    Integer intervalMinutes,
    Boolean notificationsEnabled,
    LocalDateTime createdAt,
    Long totalCompletions,
    Long todayCompletions,
    boolean completedToday
) {}
