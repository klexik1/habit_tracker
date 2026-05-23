package com.habittracker.core.service;

import com.habittracker.core.dto.CompletionDto;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.HabitCompletion;
import com.habittracker.core.entity.HabitType;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.NotFoundException;
import com.habittracker.core.repository.HabitCompletionRepository;
import com.habittracker.core.repository.HabitRepository;
import com.habittracker.core.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class HabitCompletionService {
    private static final Logger log = LoggerFactory.getLogger(HabitCompletionService.class);
    private final HabitCompletionRepository completionRepository;
    private final HabitRepository habitRepository;
    private final AchievementService achievementService;
    private final UserRepository userRepository;

    public HabitCompletionService(HabitCompletionRepository completionRepository, HabitRepository habitRepository,
                                  AchievementService achievementService, UserRepository userRepository) {
        this.completionRepository = completionRepository;
        this.habitRepository = habitRepository;
        this.achievementService = achievementService;
        this.userRepository = userRepository;
    }

    /**
     * Отметить выполнение привычки.
     * Для SINGLE — переключает выполнено/не выполнено за сегодня.
     * Для MULTIPLE — всегда создаёт новую запись выполнения.
     */
    public CompletionDto markCompletion(Long habitId, User user, LocalDate clientDate) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }

        LocalDate today = clientDate != null ? clientDate : LocalDate.now();

        if (habit.getHabitType() == HabitType.MULTIPLE) {
            // Многоразовая — создаём новую запись каждый раз
            HabitCompletion completion = new HabitCompletion();
            completion.setHabit(habit);
            completion.setCompletedDate(today);
            completion.setCompletedAt(LocalDateTime.now());
            completion.setCompleted(true);
            completion.setNote("Выполнено в " + completion.getCompletedAt().toLocalTime().withSecond(0).withNano(0));
            HabitCompletion saved = completionRepository.save(completion);
            user.setLifetimeCompletionCount((user.getLifetimeCompletionCount() != null ? user.getLifetimeCompletionCount() : 0) + 1);
            userRepository.save(user);
            achievementService.checkAndAward(user, habit.getFrequency());
            return toDto(saved);
        } else {
            // Одноразовая — переключаем
            HabitCompletion completion = completionRepository
                    .findByHabitIdAndCompletedDate(habitId, today)
                    .stream().findFirst().orElse(null);

            if (completion == null) {
                completion = new HabitCompletion();
                completion.setHabit(habit);
                completion.setCompletedDate(today);
                completion.setCompletedAt(LocalDateTime.now());
                completion.setCompleted(true);
                completion.setNote("Выполнено");
            } else {
                completion.setCompleted(!completion.isCompleted());
                completion.setNote(completion.isCompleted() ? "Выполнено" : "Отменено");
                if (completion.isCompleted()) {
                    completion.setCompletedAt(LocalDateTime.now());
                }
            }

            HabitCompletion saved = completionRepository.save(completion);
            if (saved.isCompleted()) {
                user.setLifetimeCompletionCount((user.getLifetimeCompletionCount() != null ? user.getLifetimeCompletionCount() : 0) + 1);
                userRepository.save(user);
                achievementService.checkAndAward(user, habit.getFrequency());
            }
            return toDto(saved);
        }
    }

    /**
     * Отменить конкретное выполнение (для многоразовых привычек)
     */
    public void cancelCompletion(Long completionId, User user) {
        HabitCompletion completion = completionRepository.findById(completionId)
                .orElseThrow(() -> new NotFoundException("Completion not found"));
        if (!completion.getHabit().getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Completion not found");
        }
        completionRepository.delete(completion);
    }

    public void resetAllCompletions(Long habitId, User user) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }
        List<HabitCompletion> completions = completionRepository.findByHabitId(habitId);
        completionRepository.deleteAll(completions);
    }

    public List<CompletionDto> getCompletions(Long habitId, User user, LocalDate start, LocalDate end) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }

        List<HabitCompletion> completions = completionRepository.findByHabitIdAndCompletedDateBetween(habitId, start, end);
        return completions.stream()
                .map(this::toDto)
                .toList();
    }

    public List<CompletionDto> getTodayCompletions(User user) {
        return getTodayCompletions(user, LocalDate.now());
    }

    public List<CompletionDto> getTodayCompletions(User user, LocalDate date) {
        return completionRepository.findByUserIdAndCompletedDate(user.getId(), date)
                .stream()
                .map(this::toDto)
                .toList();
    }

    public long getTotalCompletions(Long habitId) {
        return getTotalCompletions(habitId, LocalDate.now());
    }

    public long getTotalCompletions(Long habitId, LocalDate endDate) {
        return completionRepository.countCompletedByHabitAndPeriod(
                habitId,
                LocalDate.of(2000, 1, 1),
                endDate
        );
    }

    public long getTodayCompletionCount(Long habitId) {
        return getTodayCompletionCount(habitId, LocalDate.now());
    }

    public long getTodayCompletionCount(Long habitId, LocalDate date) {
        return completionRepository.countCompletedToday(habitId, date);
    }

    public boolean isCompletedToday(Long habitId) {
        return isCompletedToday(habitId, LocalDate.now());
    }

    public boolean isCompletedToday(Long habitId, LocalDate date) {
        return completionRepository.findByHabitIdAndCompletedDate(habitId, date)
                .stream()
                .anyMatch(HabitCompletion::isCompleted);
    }

    public List<CompletionDto> getTodayDetailedCompletions(Long habitId) {
        return getTodayDetailedCompletions(habitId, LocalDate.now());
    }

    public List<CompletionDto> getTodayDetailedCompletions(Long habitId, LocalDate date) {
        return completionRepository.findByHabitIdAndCompletedDateAndCompletedTrue(habitId, date)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private CompletionDto toDto(HabitCompletion completion) {
        return new CompletionDto(
                completion.getId(),
                completion.getHabit().getId(),
                completion.getCompletedDate(),
                completion.getCompletedAt(),
                completion.isCompleted(),
                completion.getNote()
        );
    }
}
