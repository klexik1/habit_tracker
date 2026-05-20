package com.habittracker.api.controller;

import com.habittracker.core.dto.CompletionDto;
import com.habittracker.core.dto.CompletionRequest;
import com.habittracker.core.entity.User;
import com.habittracker.core.service.HabitCompletionService;
import com.habittracker.core.service.UserService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/completions")
public class CompletionController {
    private final HabitCompletionService completionService;
    private final UserService userService;

    public CompletionController(HabitCompletionService completionService, UserService userService) {
        this.completionService = completionService;
        this.userService = userService;
    }

    @PostMapping("/habit/{habitId}")
    public ResponseEntity<CompletionDto> markCompletion(
            @PathVariable Long habitId,
            @Valid @RequestBody CompletionRequest request,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(completionService.markCompletion(habitId, request, user));
    }

    @GetMapping("/habit/{habitId}")
    public ResponseEntity<List<CompletionDto>> getCompletions(
            @PathVariable Long habitId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(completionService.getCompletions(habitId, user, start, end));
    }

    @GetMapping("/today")
    public ResponseEntity<List<CompletionDto>> getToday(Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(completionService.getTodayCompletions(user));
    }
}
