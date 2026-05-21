package com.habittracker.core.dto;

public record ReminderDto(
    Long habitId,
    String habitName,
    String reminderTime
) {}
