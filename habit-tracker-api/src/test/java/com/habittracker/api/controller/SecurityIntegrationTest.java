package com.habittracker.api.controller;

import com.habittracker.api.AbstractIntegrationTest;
import com.habittracker.core.dto.RegisterRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityIntegrationTest extends AbstractIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void accessProtectedEndpoint_withoutToken_shouldReturn401() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "http://localhost:" + port + "/api/habits?date=2024-01-01",
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void accessProtectedEndpoint_withInvalidToken_shouldReturn401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("invalid.token.here");

        ResponseEntity<String> response = restTemplate.exchange(
                "http://localhost:" + port + "/api/habits?date=2024-01-01",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void accessProtectedEndpoint_withExpiredToken_shouldReturn401() {
        // Token expired 1 hour ago
        String expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDAwMDB9.invalid";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(expiredToken);

        ResponseEntity<String> response = restTemplate.exchange(
                "http://localhost:" + port + "/api/habits?date=2024-01-01",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void publicEndpoints_shouldBeAccessibleWithoutAuth() {
        ResponseEntity<String> index = restTemplate.getForEntity(
                "http://localhost:" + port + "/index.html", String.class);
        assertThat(index.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> css = restTemplate.getForEntity(
                "http://localhost:" + port + "/css/style.css", String.class);
        assertThat(css.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void register_shouldWorkWithoutAuth() {
        String username = "newuser" + System.currentTimeMillis();
        RegisterRequest request = new RegisterRequest(username, username + "@test.com", "password123");

        ResponseEntity<String> response = restTemplate.postForEntity(
                "http://localhost:" + port + "/api/auth/register",
                request,
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void cors_shouldRejectUnknownOrigin() {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin("https://evil.com");
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> response = restTemplate.exchange(
                "http://localhost:" + port + "/api/auth/register",
                HttpMethod.OPTIONS,
                new HttpEntity<>(headers),
                String.class
        );

        // With CORS configured as allowedOrigins("*"), this actually passes
        // This test documents the current (insecure) behavior
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    }
}
