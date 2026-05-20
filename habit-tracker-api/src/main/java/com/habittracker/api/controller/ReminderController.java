package com.habittracker.api.controller;

import com.habittracker.core.dto.ReminderDto;
import com.habittracker.core.entity.User;
import com.habittracker.core.service.ReminderService;
import com.habittracker.core.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {
    private final ReminderService reminderService;
    private final UserService userService;

    public ReminderController(ReminderService reminderService, UserService userService) {
        this.reminderService = reminderService;
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<ReminderDto>> getPendingReminders(Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(reminderService.getPendingReminders(user));
    }
}
