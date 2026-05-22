package com.habittracker.core.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "email_notifications_enabled")
    private Boolean emailNotificationsEnabled = false;

    @Column(name = "notify_at_midnight")
    private Boolean notifyAtMidnight = false;

    @Column(name = "notify_hour_before")
    private Boolean notifyHourBefore = false;

    @Column(name = "email_verified")
    private Boolean emailVerified = false;

    @Column(name = "email_verification_code", length = 6)
    private String emailVerificationCode;

    @Column(name = "email_verification_expires_at")
    private LocalDateTime emailVerificationExpiresAt;

    @Column(name = "reset_token", length = 64)
    private String resetToken;

    @Column(name = "reset_token_expires_at")
    private LocalDateTime resetTokenExpiresAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public User() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public Boolean getEmailNotificationsEnabled() { return emailNotificationsEnabled; }
    public void setEmailNotificationsEnabled(Boolean emailNotificationsEnabled) { this.emailNotificationsEnabled = emailNotificationsEnabled; }

    public Boolean getNotifyAtMidnight() { return notifyAtMidnight; }
    public void setNotifyAtMidnight(Boolean notifyAtMidnight) { this.notifyAtMidnight = notifyAtMidnight; }

    public Boolean getNotifyHourBefore() { return notifyHourBefore; }
    public void setNotifyHourBefore(Boolean notifyHourBefore) { this.notifyHourBefore = notifyHourBefore; }

    public Boolean getEmailVerified() { return emailVerified; }
    public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getEmailVerificationCode() { return emailVerificationCode; }
    public void setEmailVerificationCode(String emailVerificationCode) { this.emailVerificationCode = emailVerificationCode; }

    public LocalDateTime getEmailVerificationExpiresAt() { return emailVerificationExpiresAt; }
    public void setEmailVerificationExpiresAt(LocalDateTime emailVerificationExpiresAt) { this.emailVerificationExpiresAt = emailVerificationExpiresAt; }

    public String getResetToken() { return resetToken; }
    public void setResetToken(String resetToken) { this.resetToken = resetToken; }

    public LocalDateTime getResetTokenExpiresAt() { return resetTokenExpiresAt; }
    public void setResetTokenExpiresAt(LocalDateTime resetTokenExpiresAt) { this.resetTokenExpiresAt = resetTokenExpiresAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
