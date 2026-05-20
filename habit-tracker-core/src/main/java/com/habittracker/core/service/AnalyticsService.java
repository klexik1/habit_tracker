package com.habittracker.core.service;

import com.habittracker.core.dto.AnalyticsDto;
import com.habittracker.core.dto.CompletionDto;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.HabitCompletion;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.NotFoundException;
import com.habittracker.core.repository.HabitCompletionRepository;
import com.habittracker.core.repository.HabitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {
    private final HabitRepository habitRepository;
    private final HabitCompletionRepository completionRepository;

    public AnalyticsService(HabitRepository habitRepository, HabitCompletionRepository completionRepository) {
        this.habitRepository = habitRepository;
        this.completionRepository = completionRepository;
    }

    public AnalyticsDto getHabitAnalytics(Long habitId, User user, LocalDate start, LocalDate end) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }

        List<HabitCompletion> completions = completionRepository.findByHabitIdAndCompletedDateBetween(habitId, start, end);
        List<HabitCompletion> allCompletions = completionRepository.findByHabitId(habitId);

        long periodCompleted = completions.stream().filter(HabitCompletion::isCompleted).count();
        long totalCompleted = allCompletions.stream().filter(HabitCompletion::isCompleted).count();

        int days = (int) java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        double rate = days > 0 ? (periodCompleted * 100.0 / days) : 0;

        int currentStreak = calculateCurrentStreak(allCompletions);
        int longestStreak = calculateLongestStreak(allCompletions);

        List<CompletionDto> recent = completions.stream()
                .sorted(Comparator.comparing(HabitCompletion::getCompletedDate).reversed())
                .limit(30)
                .map(c -> new CompletionDto(c.getId(), c.getHabit().getId(), c.getCompletedDate(), c.isCompleted(), c.getNote()))
                .toList();

        Map<String, Long> byCategory = Map.of(habit.getCategory().name(), totalCompleted);

        return new AnalyticsDto(
                habit.getId(),
                habit.getName(),
                totalCompleted,
                periodCompleted,
                Math.round(rate * 100.0) / 100.0,
                currentStreak,
                longestStreak,
                recent,
                byCategory,
                habit.getCreatedAt() != null ? habit.getCreatedAt().toString() : null
        );
    }

    private int calculateCurrentStreak(List<HabitCompletion> all) {
        List<LocalDate> dates = all.stream()
                .filter(HabitCompletion::isCompleted)
                .map(HabitCompletion::getCompletedDate)
                .sorted(Comparator.reverseOrder())
                .toList();

        if (dates.isEmpty()) return 0;
        int streak = 0;
        LocalDate today = LocalDate.now();
        LocalDate check = today;
        for (LocalDate date : dates) {
            if (date.equals(check) || date.equals(check.minusDays(1))) {
                streak++;
                check = date;
            } else if (date.isBefore(check.minusDays(1))) {
                break;
            }
        }
        return streak;
    }

    private int calculateLongestStreak(List<HabitCompletion> all) {
        List<LocalDate> dates = all.stream()
                .filter(HabitCompletion::isCompleted)
                .map(HabitCompletion::getCompletedDate)
                .sorted()
                .distinct()
                .toList();

        if (dates.isEmpty()) return 0;
        int max = 1;
        int current = 1;
        for (int i = 1; i < dates.size(); i++) {
            if (dates.get(i).equals(dates.get(i - 1).plusDays(1))) {
                current++;
                max = Math.max(max, current);
            } else {
                current = 1;
            }
        }
        return max;
    }
}
