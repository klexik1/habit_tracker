package com.habittracker.core.dto;

import java.util.List;
import java.util.Map;

public record AnalyticsDto(
    Long habitId,
    String habitName,
    Long totalCompletions,
    Long periodCompletions,
    double completionRate,
    int currentStreak,
    int longestStreak,
    List<CompletionDto> recentCompletions,
    Map<String, Long> completionsByCategory
) {}
