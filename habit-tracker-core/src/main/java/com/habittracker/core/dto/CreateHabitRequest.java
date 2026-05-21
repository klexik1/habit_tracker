package com.habittracker.core.dto;

import com.habittracker.core.entity.Category;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.HabitType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateHabitRequest(
    @NotBlank String name,
    String description,
    @NotNull Category category,
    @NotNull Frequency frequency,
    HabitType habitType,
    Integer targetCount,
    String reminderTime,
    String reminderHour,
    Integer intervalMinutes,
    Boolean notificationsEnabled
) {}
