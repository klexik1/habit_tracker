package com.habittracker.core.service;

import com.habittracker.core.dto.ProfileDto;
import com.habittracker.core.dto.RegisterRequest;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.BadRequestException;
import com.habittracker.core.repository.AchievementRepository;
import com.habittracker.core.repository.HabitCompletionRepository;
import com.habittracker.core.repository.HabitRepository;
import com.habittracker.core.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;
    private final HabitRepository habitRepository;
    private final HabitCompletionRepository completionRepository;
    private final AchievementRepository achievementRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, HabitRepository habitRepository,
                       HabitCompletionRepository completionRepository,
                       AchievementRepository achievementRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.habitRepository = habitRepository;
        this.completionRepository = completionRepository;
        this.achievementRepository = achievementRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new BadRequestException("Username already exists");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already exists");
        }

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        return userRepository.save(user);
    }

    public User findByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("User not found"));
    }

    public boolean existsByUsername(String username) {
        return userRepository.existsByUsername(username);
    }

    public ProfileDto getProfile(User user) {
        List<Habit> habits = habitRepository.findByUserId(user.getId());
        long habitCount = habits.size();
        long totalCompletions = habits.stream()
                .mapToLong(h -> completionRepository.countCompletedByHabitAndPeriod(
                        h.getId(), java.time.LocalDate.of(2000, 1, 1), java.time.LocalDate.now()))
                .sum();
        return new ProfileDto(user.getId(), user.getUsername(), user.getEmail(),
                user.getEmailNotificationsEnabled(), user.getEmailVerified(), user.getNotifyAtMidnight(), user.getNotifyHourBefore(),
                user.getCreatedAt(), habitCount, totalCompletions);
    }

    public void updateEmailNotifications(User user, Boolean enabled) {
        user.setEmailNotificationsEnabled(enabled);
        userRepository.save(user);
    }

    public void updatePushNotifications(User user, Boolean notifyAtMidnight, Boolean notifyHourBefore) {
        if (notifyAtMidnight != null) user.setNotifyAtMidnight(notifyAtMidnight);
        if (notifyHourBefore != null) user.setNotifyHourBefore(notifyHourBefore);
        userRepository.save(user);
    }

    public void updateEmail(User user, String email) {
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Email не может быть пустым");
        }
        if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
            throw new BadRequestException("Этот email уже используется другим аккаунтом");
        }
        boolean changed = !email.equals(user.getEmail());
        user.setEmail(email);
        if (changed) {
            user.setEmailVerified(false);
            user.setEmailNotificationsEnabled(false);
            user.setEmailVerificationCode(null);
            user.setEmailVerificationExpiresAt(null);
        }
        userRepository.save(user);
    }

    public String generateVerificationCode(User user) {
        String code = String.format("%06d", (int) (Math.random() * 1_000_000));
        user.setEmailVerificationCode(code);
        user.setEmailVerificationExpiresAt(java.time.LocalDateTime.now().plusMinutes(15));
        userRepository.save(user);
        return code;
    }

    public boolean verifyEmailCode(User user, String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String storedCode = user.getEmailVerificationCode();
        java.time.LocalDateTime expiresAt = user.getEmailVerificationExpiresAt();
        if (storedCode == null || expiresAt == null) {
            return false;
        }
        if (java.time.LocalDateTime.now().isAfter(expiresAt)) {
            return false;
        }
        if (!storedCode.equals(code)) {
            return false;
        }
        user.setEmailVerified(true);
        user.setEmailVerificationCode(null);
        user.setEmailVerificationExpiresAt(null);
        userRepository.save(user);
        return true;
    }

    public void clearVerificationCode(User user) {
        user.setEmailVerificationCode(null);
        user.setEmailVerificationExpiresAt(null);
        userRepository.save(user);
    }

    public void resetProfile(User user, String password) {
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("Неверный пароль");
        }
        List<Habit> habits = habitRepository.findByUserId(user.getId());
        habitRepository.deleteAll(habits);
        achievementRepository.deleteByUserId(user.getId());
        user.setLifetimeHabitCount(0);
        user.setLifetimeCompletionCount(0);
        user.setLifetimeBestStreak(0);
        userRepository.save(user);
    }

    public String generateResetToken(String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // Не раскрываем, существует ли email
            return null;
        }
        String token = java.util.UUID.randomUUID().toString().replace("-", "");
        user.setResetToken(token);
        user.setResetTokenExpiresAt(java.time.LocalDateTime.now().plusHours(1));
        userRepository.save(user);
        return token;
    }

    public boolean validateResetToken(String token) {
        if (token == null || token.isBlank()) return false;
        return userRepository.findByResetToken(token)
                .map(u -> u.getResetTokenExpiresAt() != null &&
                        java.time.LocalDateTime.now().isBefore(u.getResetTokenExpiresAt()))
                .orElse(false);
    }

    public void resetPasswordWithToken(String token, String newPassword) {
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new BadRequestException("Неверный или просроченный токен"));
        if (user.getResetTokenExpiresAt() == null ||
                java.time.LocalDateTime.now().isAfter(user.getResetTokenExpiresAt())) {
            throw new BadRequestException("Токен истёк");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new BadRequestException("Пароль должен быть не менее 6 символов");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiresAt(null);
        userRepository.save(user);
    }

    public void changePassword(User user, String currentPassword, String newPassword) {
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new BadRequestException("Неверный текущий пароль");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new BadRequestException("Новый пароль должен быть не менее 6 символов");
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new BadRequestException("Новый пароль должен отличаться от текущего");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}
