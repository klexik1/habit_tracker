package com.habittracker.api;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Base class for tests running against real PostgreSQL via Testcontainers.
 * Requires Docker to be available.
 * Profile "testcontainers" activates group: test + testcontainers-postgres.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("testcontainers")
@Transactional
public abstract class AbstractTestcontainersTest {
}
