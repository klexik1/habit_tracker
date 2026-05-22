package com.habittracker.api.controller;

import com.habittracker.core.dto.AchievementDto;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.User;
import com.habittracker.core.service.AchievementService;
import com.habittracker.core.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/achievements")
public class AchievementController {

    private final AchievementService achievementService;
    private final UserService userService;

    public AchievementController(AchievementService achievementService, UserService userService) {
        this.achievementService = achievementService;
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<AchievementDto>> getMyAchievements(
            @RequestParam(required = false, defaultValue = "DAILY") String frequency,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        Frequency freq = Frequency.valueOf(frequency.toUpperCase());
        return ResponseEntity.ok(achievementService.getAllAchievementsWithProgress(user, freq));
    }
}
