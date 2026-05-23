package com.habittracker.api.controller;

import com.habittracker.api.AbstractTestcontainersTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke test verifying PostgreSQL Testcontainers connectivity in API module.
 * Requires Docker.
 */
class PostgresSmokeTest extends AbstractTestcontainersTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void databaseShouldBePostgreSQL() {
        String version = jdbcTemplate.queryForObject("SELECT version()", String.class);
        assertThat(version).contains("PostgreSQL");
    }
}
