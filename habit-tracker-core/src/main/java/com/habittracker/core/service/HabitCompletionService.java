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

    public CompletionDto markCompletion(Long habitId, CompletionRequest request, User user) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }

        HabitCompletion completion = completionRepository
                .findByHabitIdAndCompletedDate(habitId, request.date())
                .orElse(new HabitCompletion());

        if (completion.getId() == null) {
            completion.setHabit(habit);
            completion.setCompletedDate(request.date());
        }

        completion.setCompleted(request.completed());
        completion.setNote(request.note());

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
