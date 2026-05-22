package com.habittracker.core.service;

import com.habittracker.core.dto.RegisterRequest;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.BadRequestException;
import com.habittracker.core.repository.HabitCompletionRepository;
import com.habittracker.core.repository.HabitRepository;
import com.habittracker.core.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock HabitRepository habitRepository;
    @Mock HabitCompletionRepository completionRepository;
    @Mock PasswordEncoder passwordEncoder;

    @InjectMocks
    UserService userService;

    @BeforeEach
    void setUp() {
        when(passwordEncoder.encode(any())).thenReturn("encoded");
    }

    @Test
    void register_shouldCreateUser() {
        when(userRepository.existsByUsername("testuser")).thenReturn(false);
        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        RegisterRequest req = new RegisterRequest("testuser", "test@example.com", "password123");
        User user = userService.register(req);

        assertThat(user.getUsername()).isEqualTo("testuser");
        assertThat(user.getEmail()).isEqualTo("test@example.com");
        assertThat(user.getPassword()).isEqualTo("encoded");
    }

    @Test
    void register_shouldThrowWhenUsernameExists() {
        when(userRepository.existsByUsername("testuser")).thenReturn(true);

        RegisterRequest req = new RegisterRequest("testuser", "test@example.com", "password123");
        assertThatThrownBy(() -> userService.register(req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Username already exists");
    }

    @Test
    void changePassword_shouldUpdatePassword() {
        User user = new User();
        user.setPassword("oldEncoded");
        when(passwordEncoder.matches("oldpass", "oldEncoded")).thenReturn(true);
        when(passwordEncoder.encode("newpass123")).thenReturn("newEncoded");

        userService.changePassword(user, "oldpass", "newpass123");

        assertThat(user.getPassword()).isEqualTo("newEncoded");
        verify(userRepository).save(user);
    }

    @Test
    void changePassword_shouldThrowWhenCurrentPasswordWrong() {
        User user = new User();
        user.setPassword("oldEncoded");
        when(passwordEncoder.matches("wrong", "oldEncoded")).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(user, "wrong", "newpass123"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Неверный текущий пароль");
    }

    @Test
    void generateResetToken_shouldCreateToken() {
        User user = new User();
        user.setEmail("test@example.com");
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        String token = userService.generateResetToken("test@example.com");

        assertThat(token).isNotNull().hasSize(32);
        assertThat(user.getResetToken()).isEqualTo(token);
        assertThat(user.getResetTokenExpiresAt()).isNotNull();
    }

    @Test
    void generateResetToken_shouldReturnNullForUnknownEmail() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        String token = userService.generateResetToken("unknown@example.com");

        assertThat(token).isNull();
    }

    @Test
    void resetPasswordWithToken_shouldUpdatePassword() {
        User user = new User();
        user.setResetToken("validtoken");
        user.setResetTokenExpiresAt(java.time.LocalDateTime.now().plusMinutes(30));
        when(userRepository.findByResetToken("validtoken")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newpass")).thenReturn("newEncoded");

        userService.resetPasswordWithToken("validtoken", "newpass");

        assertThat(user.getPassword()).isEqualTo("newEncoded");
        assertThat(user.getResetToken()).isNull();
    }

    @Test
    void resetPasswordWithToken_shouldThrowWhenExpired() {
        User user = new User();
        user.setResetToken("expiredtoken");
        user.setResetTokenExpiresAt(java.time.LocalDateTime.now().minusMinutes(1));
        when(userRepository.findByResetToken("expiredtoken")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.resetPasswordWithToken("expiredtoken", "newpass"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Токен истёк");
    }
}
