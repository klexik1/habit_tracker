package com.habittracker.core.service;

import com.habittracker.core.dto.ProfileDto;
import com.habittracker.core.dto.RegisterRequest;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.BadRequestException;
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
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, HabitRepository habitRepository,
                       HabitCompletionRepository completionRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.habitRepository = habitRepository;
        this.completionRepository = completionRepository;
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
                user.getEmailNotificationsEnabled(), user.getCreatedAt(), habitCount, totalCompletions);
    }

    public void updateEmailNotifications(User user, Boolean enabled) {
        user.setEmailNotificationsEnabled(enabled);
        userRepository.save(user);
    }

    public void updateEmail(User user, String email) {
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Email не может быть пустым");
        }
        if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email already exists");
        }
        user.setEmail(email);
        userRepository.save(user);
    }

    public void resetProfile(User user, String password) {
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("Неверный пароль");
        }
        List<Habit> habits = habitRepository.findByUserId(user.getId());
        habitRepository.deleteAll(habits);
    }
}
