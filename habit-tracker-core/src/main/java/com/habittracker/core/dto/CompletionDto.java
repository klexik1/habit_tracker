package com.habittracker.core.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record CompletionDto(
    Long id,
    Long habitId,
    LocalDate completedDate,
    LocalDateTime completedAt,
    boolean completed,
    String note
) {}
