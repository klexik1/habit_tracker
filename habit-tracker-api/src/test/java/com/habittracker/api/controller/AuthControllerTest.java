package com.habittracker.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habittracker.core.dto.RegisterRequest;
import com.habittracker.core.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void register_shouldReturnSuccess() throws Exception {
        RegisterRequest req = new RegisterRequest(
                "testuser" + System.currentTimeMillis(),
                "test" + System.currentTimeMillis() + "@example.com",
                "password123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully"));
    }

    @Test
    void login_shouldReturnToken() throws Exception {
        String username = "logintest" + System.currentTimeMillis();
        String email = "login" + System.currentTimeMillis() + "@example.com";
        String password = "password123";

        // Register first
        RegisterRequest reg = new RegisterRequest(username, email, password);
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg)))
                .andExpect(status().isOk());

        // Then login
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    void forgotPassword_shouldReturnSuccessEvenForUnknownEmail() throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"unknown@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void resetPassword_shouldFailWithInvalidToken() throws Exception {
        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"invalid\",\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isBadRequest());
    }
}
