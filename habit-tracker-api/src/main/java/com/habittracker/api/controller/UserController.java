package com.habittracker.api.controller;

import com.habittracker.api.service.EmailService;
import com.habittracker.core.dto.ProfileDto;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.BadRequestException;
import com.habittracker.core.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final EmailService emailService;

    public UserController(UserService userService, EmailService emailService) {
        this.userService = userService;
        this.emailService = emailService;
    }

    @GetMapping("/me")
    public ResponseEntity<ProfileDto> getProfile(Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(userService.getProfile(user));
    }

    @PutMapping("/me/email")
    public ResponseEntity<Void> updateEmail(
            @RequestBody Map<String, String> body,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        userService.updateEmail(user, body.get("email"));
        return ResponseEntity.ok().build();
    }

    @PutMapping("/me/email-notifications")
    public ResponseEntity<Void> updateEmailNotifications(
            @RequestBody Map<String, Boolean> body,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        Boolean enabled = body.get("enabled");
        if (Boolean.TRUE.equals(enabled) && !Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new BadRequestException("Сначала подтвердите email");
        }
        userService.updateEmailNotifications(user, enabled);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/me/send-verification-code")
    public ResponseEntity<Void> sendVerificationCode(Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        String email = user.getEmail();
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Сначала укажите email");
        }
        String code = userService.generateVerificationCode(user);
        emailService.sendVerificationCode(email, code);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/me/verify-email")
    public ResponseEntity<Map<String, Boolean>> verifyEmail(
            @RequestBody Map<String, String> body,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        String code = body.get("code");
        boolean success = userService.verifyEmailCode(user, code);
        if (!success) {
            throw new BadRequestException("Неверный или просроченный код");
        }
        return ResponseEntity.ok(Map.of("verified", true));
    }

    @PutMapping("/me/push-notifications")
    public ResponseEntity<Void> updatePushNotifications(
            @RequestBody Map<String, Boolean> body,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        userService.updatePushNotifications(user, body.get("notifyAtMidnight"), body.get("notifyHourBefore"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/me/reset")
    public ResponseEntity<Void> resetProfile(
            @RequestBody Map<String, String> body,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        userService.resetProfile(user, body.get("password"));
        return ResponseEntity.ok().build();
    }
}
