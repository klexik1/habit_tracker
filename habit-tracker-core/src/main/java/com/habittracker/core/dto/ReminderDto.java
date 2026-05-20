package com.habittracker.core.dto;

import java.time.LocalTime;

public record ReminderDto(
    Long habitId,
    String habitName,
    LocalTime reminderTime
) {}
