package com.habittracker.core.dto;

import com.habittracker.core.entity.Category;
import com.habittracker.core.entity.Frequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

public record CreateHabitRequest(
    @NotBlank String name,
    String description,
    @NotNull Category category,
    @NotNull Frequency frequency,
    Integer targetCount,
    LocalTime reminderTime
) {}
