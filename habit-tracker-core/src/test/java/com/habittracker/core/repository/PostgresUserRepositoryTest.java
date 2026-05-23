package com.habittracker.core.repository;

import com.habittracker.core.AbstractTestcontainersTest;
import com.habittracker.core.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PostgreSQL Testcontainers version of UserRepositoryTest.
 * Requires Docker. Run manually or in CI with Docker available.
 */
class PostgresUserRepositoryTest extends AbstractTestcontainersTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void save_shouldPersistUser() {
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@test.com");
        user.setPassword("encodedpass");

        User saved = userRepository.save(user);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getUsername()).isEqualTo("testuser");
    }

    @Test
    void findByUsername_shouldReturnUser() {
        User user = new User();
        user.setUsername("findme");
        user.setEmail("find@test.com");
        user.setPassword("pass");
        userRepository.save(user);

        Optional<User> found = userRepository.findByUsername("findme");

        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("find@test.com");
    }

    @Test
    void findByUsername_shouldReturnEmpty_whenNotExists() {
        Optional<User> found = userRepository.findByUsername("nonexistent");
        assertThat(found).isEmpty();
    }

    @Test
    void existsByUsername_shouldReturnTrue() {
        User user = new User();
        user.setUsername("exists");
        user.setEmail("exists@test.com");
        user.setPassword("pass");
        userRepository.save(user);

        assertThat(userRepository.existsByUsername("exists")).isTrue();
        assertThat(userRepository.existsByUsername("notexists")).isFalse();
    }

    @Test
    void findByEmail_shouldReturnUser() {
        User user = new User();
        user.setUsername("emailtest");
        user.setEmail("unique@test.com");
        user.setPassword("pass");
        userRepository.save(user);

        Optional<User> found = userRepository.findByEmail("unique@test.com");

        assertThat(found).isPresent();
        assertThat(found.get().getUsername()).isEqualTo("emailtest");
    }

    @Test
    void findByResetToken_shouldReturnUser() {
        User user = new User();
        user.setUsername("resettoken");
        user.setEmail("reset@test.com");
        user.setPassword("pass");
        user.setResetToken("abc123");
        userRepository.save(user);

        Optional<User> found = userRepository.findByResetToken("abc123");

        assertThat(found).isPresent();
        assertThat(found.get().getUsername()).isEqualTo("resettoken");
    }
}
