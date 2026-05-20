package com.habittracker.core.service;

import com.habittracker.core.dto.ReminderDto;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.User;
import com.habittracker.core.repository.HabitRepository;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
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
                .filter(h -> {
                    LocalTime t = h.getReminderTime();
                    return !t.isBefore(windowStart) && !t.isAfter(windowEnd);
                })
                .map(h -> new ReminderDto(h.getId(), h.getName(), h.getReminderTime()))
                .toList();
    }
}
