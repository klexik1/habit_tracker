package com.habittracker.api.controller;

import com.habittracker.api.service.EmailReminderService;
import com.habittracker.api.service.EmailService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/email-test")
public class EmailTestController {

    private final EmailService emailService;
    private final EmailReminderService emailReminderService;

    public EmailTestController(EmailService emailService, EmailReminderService emailReminderService) {
        this.emailService = emailService;
        this.emailReminderService = emailReminderService;
    }

    /**
     * Отправить тестовое письмо на указанный email
     * POST /api/email-test/send?to=email@example.com
     */
    @PostMapping("/send")
    public ResponseEntity<String> sendTestEmail(@RequestParam String to) {
        try {
            emailService.sendHabitReminder(to, "Тестовое напоминание", "Это тестовое письмо из Habit Tracker. Если вы его видите — email-рассылка работает!");
            return ResponseEntity.ok("Тестовое письмо отправлено на " + to);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Ошибка: " + e.getMessage());
        }
    }

    /**
     * Запустить рассылку напоминаний вручную (с теми же фильтрами что и автоматическая)
     * POST /api/email-test/trigger-reminders
     */
    @PostMapping("/trigger-reminders")
    public ResponseEntity<String> triggerReminders() {
        try {
            emailReminderService.sendDailyReminders();
            return ResponseEntity.ok("Рассылка напоминаний запущена вручную (пропущены INTERVAL привычки)");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Ошибка: " + e.getMessage());
        }
    }

    /**
     * Отправить тестовое письмо для конкретной привычки
     * POST /api/email-test/send-habit/{habitId}
     */
    @PostMapping("/send-habit/{habitId}")
    public ResponseEntity<String> sendTestHabitReminder(@PathVariable Long habitId) {
        try {
            emailReminderService.sendTestReminder(habitId);
            return ResponseEntity.ok("Тестовое письмо для привычки " + habitId + " отправлено");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Ошибка: " + e.getMessage());
        }
    }
}
