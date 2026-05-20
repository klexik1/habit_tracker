package com.habittracker.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.habittracker")
@EnableJpaRepositories(basePackages = "com.habittracker.core.repository")
@EntityScan(basePackages = "com.habittracker.core.entity")
public class HabitTrackerApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(HabitTrackerApiApplication.class, args);
    }
}
