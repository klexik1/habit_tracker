package com.habittracker.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RateLimitFilterTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void tooManyAuthRequests_shouldReturn429() {
        String url = "http://localhost:" + port + "/api/auth/forgot-password";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>("{\"email\":\"test@test.com\"}", headers);

        int okCount = 0;
        int tooManyCount = 0;

        for (int i = 0; i < 15; i++) {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK) {
                okCount++;
            } else if (response.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                tooManyCount++;
            }
        }

        assertThat(okCount).isEqualTo(10); // MAX_REQUESTS
        assertThat(tooManyCount).isGreaterThanOrEqualTo(1);
    }

    @Test
    void nonAuthEndpoints_shouldNotBeRateLimited() {
        String url = "http://localhost:" + port + "/index.html";

        for (int i = 0; i < 15; i++) {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }
}
