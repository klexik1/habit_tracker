package com.habittracker.api.controller;

import com.habittracker.core.dto.LoginRequest;
import com.habittracker.core.dto.RegisterRequest;
import com.habittracker.core.entity.User;
import com.habittracker.core.service.UserService;
import com.habittracker.api.security.JwtUtil;
import com.habittracker.api.service.EmailService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authManager;
    private final EmailService emailService;

    public AuthController(UserService userService, JwtUtil jwtUtil, AuthenticationManager authManager, EmailService emailService) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
        this.authManager = authManager;
        this.emailService = emailService;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest request) {
        userService.register(request);
        return ResponseEntity.ok(Map.of("message", "User registered successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@Valid @RequestBody LoginRequest request) {
        authManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        String token = jwtUtil.generateToken(request.username());
        return ResponseEntity.ok(Map.of("token", token));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String token = userService.generateResetToken(email);
        if (token != null) {
            emailService.sendPasswordResetEmail(email, token);
        }
        // Всегда возвращаем success, чтобы не раскрывать существование email
        return ResponseEntity.ok(Map.of("message", "Если email зарегистрирован, письмо отправлено"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String newPassword = body.get("newPassword");
        userService.resetPasswordWithToken(token, newPassword);
        return ResponseEntity.ok(Map.of("message", "Пароль успешно изменён"));
    }

    @GetMapping("/validate-reset-token")
    public ResponseEntity<Map<String, Boolean>> validateResetToken(@RequestParam String token) {
        boolean valid = userService.validateResetToken(token);
        return ResponseEntity.ok(Map.of("valid", valid));
    }
}
