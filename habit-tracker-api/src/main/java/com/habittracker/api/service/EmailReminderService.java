package com.habittracker.api.service;

import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.User;
import com.habittracker.core.repository.HabitRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class EmailReminderService {

    private static final Logger log = LoggerFactory.getLogger(EmailReminderService.class);

    private final HabitRepository habitRepository;
    private final EmailService emailService;

    public EmailReminderService(HabitRepository habitRepository, EmailService emailService) {
        this.habitRepository = habitRepository;
        this.emailService = emailService;
    }

    /**
     * Запускается каждый день в 00:00 для отправки напоминаний на текущий день
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional(readOnly = true)
    public void sendDailyReminders() {
        log.info("🕛 Запуск рассылки напоминаний на сегодня (00:00)...");

        List<Habit> allHabits = habitRepository.findAllWithUsers();
        int sentCount = 0;
        int skippedCount = 0;

        for (Habit habit : allHabits) {
            try {
                User user = habit.getUser();
                
                // Пропускаем INTERVAL привычки с периодом меньше суток
                if ("INTERVAL".equals(habit.getFrequency() != null ? habit.getFrequency().name() : "")) {
                    Integer intervalMinutes = habit.getIntervalMinutes();
                    if (intervalMinutes == null || intervalMinutes < 1440) {
                        log.debug("⏭ Пропущена INTERVAL привычка '{}' — период {} мин (меньше суток)",
                            habit.getName(), intervalMinutes != null ? intervalMinutes : "не задан");
                        skippedCount++;
                        continue;
                    }
                    // INTERVAL >= 24ч — отправляем напоминание каждый день
                }

                // Проверяем, включены ли email-уведомления у пользователя
                if (user == null || !Boolean.TRUE.equals(user.getEmailNotificationsEnabled())) {
                    log.debug("⏭ Пропущена привычка '{}' - у пользователя отключены уведомления", habit.getName());
                    skippedCount++;
                    continue;
                }
                
                // Проверяем, включены ли уведомления у привычки
                if (!Boolean.TRUE.equals(habit.getNotificationsEnabled())) {
                    log.debug("⏭ Пропущена привычка '{}' - у привычки отключены уведомления", habit.getName());
                    skippedCount++;
                    continue;
                }
                
                // Проверяем, нужно ли сегодня напоминание (для WEEKLY/MONTHLY)
                if (!isReminderDay(habit)) {
                    log.debug("⏭ Пропущена привычка '{}' - сегодня не день напоминания", habit.getName());
                    skippedCount++;
                    continue;
                }
                
                // Отправляем email
                String userEmail = user.getEmail();
                if (userEmail != null && !userEmail.isBlank()) {
                    emailService.sendHabitReminder(userEmail, habit.getName(), habit.getDescription());
                    log.info("✅ Отправлено напоминание для привычки '{}' пользователю {}", habit.getName(), userEmail);
                    sentCount++;
                }
            } catch (Exception e) {
                log.error("❌ Ошибка при отправке напоминания для привычки {}: {}", habit.getId(), e.getMessage());
            }
        }
        
        log.info("📊 Рассылка завершена: отправлено {}, пропущено {}", sentCount, skippedCount);
    }
    
    /**
     * Ручная отправка тестового письма
     */
    @Transactional(readOnly = true)
    public void sendTestReminder(Long habitId) {
        Habit habit = habitRepository.findById(habitId).orElse(null);
        if (habit == null) {
            log.warn("Привычка {} не найдена", habitId);
            return;
        }
        User user = habit.getUser();
        if (user == null || user.getEmail() == null) {
            log.warn("У привычки {} нет пользователя или email", habitId);
            return;
        }
        emailService.sendHabitReminder(user.getEmail(), habit.getName(), habit.getDescription());
        log.info("Тестовое письмо отправлено для привычки '{}' на {}", habit.getName(), user.getEmail());
    }

    /**
     * Проверяет, нужно ли сегодня отправлять напоминание для этой привычки
     */
    private boolean isReminderDay(Habit habit) {
        String frequency = habit.getFrequency() != null ? habit.getFrequency().name() : "DAILY";
        
        if ("DAILY".equals(frequency) || "INTERVAL".equals(frequency)) {
            return true;
        }
        
        if ("WEEKLY".equals(frequency)) {
            int currentDayOfWeek = java.time.LocalDate.now().getDayOfWeek().getValue(); // 1=Пн, 7=Вс
            String reminderValue = habit.getReminderTime();
            if (reminderValue != null && !reminderValue.isBlank()) {
                try {
                    int reminderDay = Integer.parseInt(reminderValue);
                    return currentDayOfWeek == reminderDay;
                } catch (NumberFormatException e) {
                    return false;
                }
            }
            return false;
        }
        
        if ("MONTHLY".equals(frequency)) {
            int currentDayOfMonth = java.time.LocalDate.now().getDayOfMonth();
            String reminderValue = habit.getReminderTime();
            if (reminderValue != null && !reminderValue.isBlank()) {
                try {
                    int reminderDay = Integer.parseInt(reminderValue);
                    // Если выбранный день больше дней в месяце, уведомляем в последний день
                    int lastDayOfMonth = java.time.LocalDate.now().lengthOfMonth();
                    int targetDay = Math.min(reminderDay, lastDayOfMonth);
                    return currentDayOfMonth == targetDay;
                } catch (NumberFormatException e) {
                    return false;
                }
            }
            return false;
        }
        
        return true;
    }
}
