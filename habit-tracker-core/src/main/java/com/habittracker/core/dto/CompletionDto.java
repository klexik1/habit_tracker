package com.habittracker.core.dto;

import java.time.LocalDate;

public record CompletionDto(
    Long id,
    Long habitId,
    LocalDate completedDate,
    boolean completed,
    String note
) {}
