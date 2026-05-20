package com.habittracker.core.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CompletionRequest(
    @NotNull LocalDate date,
    boolean completed,
    String note
) {}
