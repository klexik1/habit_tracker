package com.habittracker.api.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private final JwtUtil jwtUtil = new JwtUtil(
            "test-secret-key-must-be-at-least-32-bytes-long!!!",
            3600000 // 1 hour
    );

    @Test
    void generateToken_shouldCreateValidToken() {
        String token = jwtUtil.generateToken("testuser");

        assertThat(token).isNotBlank();
        assertThat(token.split("\\.")).hasSize(3); // header.payload.signature
    }

    @Test
    void extractUsername_shouldReturnCorrectUsername() {
        String token = jwtUtil.generateToken("john_doe");

        String username = jwtUtil.extractUsername(token);

        assertThat(username).isEqualTo("john_doe");
    }

    @Test
    void validateToken_shouldReturnTrue_forValidToken() {
        String token = jwtUtil.generateToken("validuser");

        assertThat(jwtUtil.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_shouldReturnFalse_forExpiredToken() {
        JwtUtil shortLived = new JwtUtil("test-secret-key-must-be-at-least-32-bytes-long!!!", -1000);
        String token = shortLived.generateToken("user");

        assertThat(jwtUtil.validateToken(token)).isFalse();
    }

    @Test
    void validateToken_shouldReturnFalse_forTamperedToken() {
        String token = jwtUtil.generateToken("user");
        String tampered = token.substring(0, token.length() - 5) + "XXXXX";

        assertThat(jwtUtil.validateToken(tampered)).isFalse();
    }

    @Test
    void validateToken_shouldReturnFalse_forEmptyToken() {
        assertThat(jwtUtil.validateToken("")).isFalse();
        assertThat(jwtUtil.validateToken(null)).isFalse();
    }
}
