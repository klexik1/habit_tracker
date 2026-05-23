package com.habittracker.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habittracker.api.AbstractIntegrationTest;
import com.habittracker.core.dto.CreateHabitRequest;
import com.habittracker.core.dto.HabitDto;
import com.habittracker.core.dto.LoginRequest;
import com.habittracker.core.dto.RegisterRequest;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.HabitType;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class HabitControllerIntegrationTest extends AbstractIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private String baseUrl;
    private String authToken;

    @BeforeAll
    void setUp() {
        baseUrl = "http://localhost:" + port + "/api";
        authToken = registerAndLogin();
    }

    @Test
    void createHabit_shouldReturnCreatedHabit() {
        CreateHabitRequest request = new CreateHabitRequest(
                "Morning Run", "Daily jogging", "SPORT",
                Frequency.DAILY, HabitType.SINGLE, 1,
                "07:00", null, null, false, false
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(authToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<HabitDto> response = restTemplate.exchange(
                baseUrl + "/habits",
                HttpMethod.POST,
                new HttpEntity<>(request, headers),
                HabitDto.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Morning Run");
        assertThat(response.getBody().frequency()).isEqualTo(Frequency.DAILY);
    }

    @Test
    void getAllHabits_shouldReturnList() {
        createTestHabit("Habit 1");
        createTestHabit("Habit 2");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(authToken);

        ResponseEntity<HabitDto[]> response = restTemplate.exchange(
                baseUrl + "/habits?date=2024-01-01",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                HabitDto[].class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody()).hasSizeGreaterThanOrEqualTo(2);
    }

    @Test
    void getHabitById_shouldReturnHabit() {
        HabitDto created = createTestHabit("Single Habit");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(authToken);

        ResponseEntity<HabitDto> response = restTemplate.exchange(
                baseUrl + "/habits/" + created.id() + "?date=2024-01-01",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                HabitDto.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Single Habit");
    }

    @Test
    void updateHabit_shouldModifyHabit() {
        HabitDto created = createTestHabit("Old Name");

        CreateHabitRequest update = new CreateHabitRequest(
                "New Name", "Updated desc", "HEALTH",
                Frequency.WEEKLY, HabitType.MULTIPLE, 3,
                null, "09:00", null, true, false
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(authToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<HabitDto> response = restTemplate.exchange(
                baseUrl + "/habits/" + created.id(),
                HttpMethod.PUT,
                new HttpEntity<>(update, headers),
                HabitDto.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("New Name");
        assertThat(response.getBody().frequency()).isEqualTo(Frequency.WEEKLY);
    }

    @Test
    void deleteHabit_shouldRemoveHabit() {
        HabitDto created = createTestHabit("To Delete");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(authToken);

        ResponseEntity<Void> response = restTemplate.exchange(
                baseUrl + "/habits/" + created.id(),
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                Void.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<HabitDto> getResponse = restTemplate.exchange(
                baseUrl + "/habits/" + created.id() + "?date=2024-01-01",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                HabitDto.class
        );

        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void createHabit_withoutAuth_shouldReturn401() {
        CreateHabitRequest request = new CreateHabitRequest(
                "Test", "Desc", "SPORT",
                Frequency.DAILY, HabitType.SINGLE, 1,
                "07:00", null, null, false, false
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl + "/habits",
                HttpMethod.POST,
                new HttpEntity<>(request, headers),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private String registerAndLogin() {
        String username = "testuser" + System.currentTimeMillis();
        String email = username + "@test.com";
        String password = "password123";

        RegisterRequest register = new RegisterRequest(username, email, password);
        restTemplate.postForEntity(baseUrl + "/auth/register", register, String.class);

        LoginRequest login = new LoginRequest(username, password);
        ResponseEntity<LoginResponse> loginResponse = restTemplate.postForEntity(
                baseUrl + "/auth/login", login, LoginResponse.class);

        return loginResponse.getBody().token();
    }

    private HabitDto createTestHabit(String name) {
        CreateHabitRequest request = new CreateHabitRequest(
                name, "Description", "SPORT",
                Frequency.DAILY, HabitType.SINGLE, 1,
                "07:00", null, null, false, false
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(authToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<HabitDto> response = restTemplate.exchange(
                baseUrl + "/habits",
                HttpMethod.POST,
                new HttpEntity<>(request, headers),
                HabitDto.class
        );

        return response.getBody();
    }

    private record LoginResponse(String token) {}
}
