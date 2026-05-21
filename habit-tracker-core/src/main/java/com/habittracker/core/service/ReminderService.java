package com.habittracker.core.service;

import com.habittracker.core.dto.ReminderDto;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.User;
import com.habittracker.core.repository.HabitRepository;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class ReminderService {
    private final HabitRepository habitRepository;

    public ReminderService(HabitRepository habitRepository) {
        this.habitRepository = habitRepository;
    }

    public List<ReminderDto> getPendingReminders(User user) {
        LocalTime now = LocalTime.now();
        LocalTime windowStart = now.minusMinutes(30);
        LocalTime windowEnd = now.plusMinutes(30);

        List<Habit> habits = habitRepository.findByUserId(user.getId());
        return habits.stream()
                .filter(h -> h.getReminderTime() != null)
                .filter(h -> h.getFrequency() != null && h.getFrequency().name().equals("DAILY"))
                .filter(h -> {
                    try {
                        LocalTime t = LocalTime.parse(h.getReminderTime(), DateTimeFormatter.ofPattern("HH:mm"));
                        return !t.isBefore(windowStart) && !t.isAfter(windowEnd);
                    } catch (DateTimeParseException e) {
                        return false;
                    }
                })
                .map(h -> new ReminderDto(h.getId(), h.getName(), h.getReminderTime()))
                .toList();
    }
}
