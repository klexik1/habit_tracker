package com.habittracker.api.controller;

import com.habittracker.core.dto.ProfileDto;
import com.habittracker.core.entity.User;
import com.habittracker.core.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
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

    @PostMapping("/me/reset")
    public ResponseEntity<Void> resetProfile(
            @RequestBody Map<String, String> body,
            Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        userService.resetProfile(user, body.get("password"));
        return ResponseEntity.ok().build();
    }
}
