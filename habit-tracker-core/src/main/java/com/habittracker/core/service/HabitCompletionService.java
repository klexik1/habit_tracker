package com.habittracker.core.service;

import com.habittracker.core.dto.CompletionDto;
import com.habittracker.core.dto.CompletionRequest;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.HabitCompletion;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.NotFoundException;
import com.habittracker.core.repository.HabitCompletionRepository;
import com.habittracker.core.repository.HabitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class HabitCompletionService {
    private final HabitCompletionRepository completionRepository;
    private final HabitRepository habitRepository;

    public HabitCompletionService(HabitCompletionRepository completionRepository, HabitRepository habitRepository) {
        this.completionRepository = completionRepository;
        this.habitRepository = habitRepository;
    }

    public CompletionDto toggleCompletion(Long habitId, User user) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }

        LocalDate today = LocalDate.now();
        HabitCompletion completion = completionRepository
                .findByHabitIdAndCompletedDate(habitId, today)
                .orElse(null);

        if (completion == null) {
            completion = new HabitCompletion();
            completion.setHabit(habit);
            completion.setCompletedDate(today);
            completion.setCompleted(true);
            completion.setNote("Выполнено");
        } else {
            completion.setCompleted(!completion.isCompleted());
            completion.setNote(completion.isCompleted() ? "Выполнено" : "Отменено");
        }

        return toDto(completionRepository.save(completion));
    }

    public List<CompletionDto> getCompletions(Long habitId, User user, LocalDate start, LocalDate end) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }

        return completionRepository.findByHabitIdAndCompletedDateBetween(habitId, start, end)
                .stream()
                .map(this::toDto)
                .toList();
    }

    public List<CompletionDto> getTodayCompletions(User user) {
        return completionRepository.findByUserIdAndCompletedDate(user.getId(), LocalDate.now())
                .stream()
                .map(this::toDto)
                .toList();
    }

    public long getTotalCompletions(Long habitId) {
        return completionRepository.countCompletedByHabitAndPeriod(
                habitId,
                LocalDate.of(2000, 1, 1),
                LocalDate.now()
        );
    }

    public boolean isCompletedToday(Long habitId) {
        return completionRepository.findByHabitIdAndCompletedDate(habitId, LocalDate.now())
                .map(HabitCompletion::isCompleted)
                .orElse(false);
    }

    private CompletionDto toDto(HabitCompletion completion) {
        return new CompletionDto(
                completion.getId(),
                completion.getHabit().getId(),
                completion.getCompletedDate(),
                completion.isCompleted(),
                completion.getNote()
        );
    }
}
