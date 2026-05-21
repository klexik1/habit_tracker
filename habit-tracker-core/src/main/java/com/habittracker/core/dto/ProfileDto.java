package com.habittracker.core.dto;

import java.time.LocalDateTime;

public record ProfileDto(
    Long id,
    String username,
    String email,
    LocalDateTime createdAt,
    long habitCount,
    long totalCompletions
) {}
