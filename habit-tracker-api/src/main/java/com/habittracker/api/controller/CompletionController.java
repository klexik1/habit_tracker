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
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime clientDateTime,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(completionService.markCompletion(habitId, user, date, clientDateTime));
    }

    @DeleteMapping("/{completionId}")
    public ResponseEntity<Void> cancelCompletion(
            @PathVariable Long completionId,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        completionService.cancelCompletion(completionId, user);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/habit/{habitId}")
    public ResponseEntity<Void> resetCompletions(
            @PathVariable Long habitId,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        completionService.resetAllCompletions(habitId, user);
        return ResponseEntity.ok().build();
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
