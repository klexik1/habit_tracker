package com.habittracker.core.dto;

import com.habittracker.core.entity.Category;
import com.habittracker.core.entity.Frequency;

import java.time.LocalDateTime;
import java.time.LocalTime;

public record HabitDto(
    Long id,
    String name,
    String description,
    Category category,
    Frequency frequency,
    Integer targetCount,
    LocalTime reminderTime,
    LocalDateTime createdAt,
    Long totalCompletions,
    boolean completedToday
) {}
