package com.habittracker.api.controller;

import com.habittracker.core.dto.AnalyticsDto;
import com.habittracker.core.entity.User;
import com.habittracker.core.service.AnalyticsService;
import com.habittracker.core.service.UserService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
    private final AnalyticsService analyticsService;
    private final UserService userService;

    public AnalyticsController(AnalyticsService analyticsService, UserService userService) {
        this.analyticsService = analyticsService;
        this.userService = userService;
    }

    @GetMapping("/habit/{habitId}")
    public ResponseEntity<AnalyticsDto> getHabitAnalytics(
            @PathVariable Long habitId,
            @RequestParam(defaultValue = "#{T(java.time.LocalDate).now().minusDays(30)}") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(defaultValue = "#{T(java.time.LocalDate).now()}") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(analyticsService.getHabitAnalytics(habitId, user, start, end));
    }
}
