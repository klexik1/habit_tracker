package com.habittracker.core.service;

import com.habittracker.core.dto.CreateHabitRequest;
import com.habittracker.core.dto.HabitDto;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.HabitType;
import com.habittracker.core.entity.User;
import com.habittracker.core.exception.NotFoundException;
import com.habittracker.core.repository.HabitRepository;
import com.habittracker.core.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class HabitService {
    private final HabitRepository habitRepository;
    private final HabitCompletionService completionService;
    private final AchievementService achievementService;
    private final UserRepository userRepository;

    public HabitService(HabitRepository habitRepository, HabitCompletionService completionService,
                        AchievementService achievementService, UserRepository userRepository) {
        this.habitRepository = habitRepository;
        this.completionService = completionService;
        this.achievementService = achievementService;
        this.userRepository = userRepository;
    }

    public HabitDto createHabit(CreateHabitRequest request, User user) {
        Habit habit = new Habit();
        habit.setName(request.name());
        habit.setDescription(request.description());
        habit.setCategory(request.category());
        habit.setFrequency(request.frequency());
        habit.setHabitType(request.habitType() != null ? request.habitType() : HabitType.SINGLE);
        habit.setTargetCount(request.targetCount() != null ? request.targetCount() : 1);
        habit.setReminderTime(request.reminderTime());
        habit.setReminderHour(request.reminderHour());
        habit.setIntervalMinutes(request.intervalMinutes());
        habit.setNotificationsEnabled(request.notificationsEnabled() != null ? request.notificationsEnabled() : false);
        habit.setArchived(request.archived() != null ? request.archived() : false);
        habit.setUser(user);
        user.setLifetimeHabitCount((user.getLifetimeHabitCount() != null ? user.getLifetimeHabitCount() : 0) + 1);
        userRepository.save(user);
        HabitDto dto = toDto(habitRepository.save(habit));
        achievementService.checkAndAward(user, request.frequency());
        return dto;
    }

    public List<HabitDto> getAllHabits(User user) {
        return habitRepository.findByUserId(user.getId()).stream()
                .map(this::toDto)
                .toList();
    }

    public HabitDto getHabitById(Long id, User user) {
        return toDto(findHabitEntityById(id, user));
    }

    private Habit findHabitEntityById(Long id, User user) {
        Habit habit = habitRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Habit not found"));
        if (!habit.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Habit not found");
        }
        return habit;
    }

    public HabitDto updateHabit(Long id, CreateHabitRequest request, User user) {
        Habit habit = findHabitEntityById(id, user);
        habit.setName(request.name());
        habit.setDescription(request.description());
        habit.setCategory(request.category());
        habit.setFrequency(request.frequency());
        habit.setHabitType(request.habitType() != null ? request.habitType() : habit.getHabitType());
        habit.setTargetCount(request.targetCount() != null ? request.targetCount() : 1);
        habit.setReminderTime(request.reminderTime());
        habit.setReminderHour(request.reminderHour());
        habit.setIntervalMinutes(request.intervalMinutes());
        habit.setNotificationsEnabled(request.notificationsEnabled() != null ? request.notificationsEnabled() : habit.getNotificationsEnabled());
        habit.setArchived(request.archived() != null ? request.archived() : habit.getArchived());
        return toDto(habitRepository.save(habit));
    }

    public void deleteHabit(Long id, User user) {
        Habit habit = findHabitEntityById(id, user);
        habitRepository.delete(habit);
    }

    public HabitDto archiveHabit(Long id, User user) {
        Habit habit = findHabitEntityById(id, user);
        habit.setArchived(true);
        return toDto(habitRepository.save(habit));
    }

    public HabitDto unarchiveHabit(Long id, User user) {
        Habit habit = findHabitEntityById(id, user);
        habit.setArchived(false);
        return toDto(habitRepository.save(habit));
    }

    public HabitDto toDto(Habit habit) {
        Long totalCompletions = completionService.getTotalCompletions(habit.getId());
        Long todayCompletions = completionService.getTodayCompletionCount(habit.getId());
        boolean completedToday = completionService.isCompletedToday(habit.getId());
        return new HabitDto(
                habit.getId(),
                habit.getName(),
                habit.getDescription(),
                habit.getCategory(),
                habit.getFrequency(),
                habit.getHabitType(),
                habit.getTargetCount(),
                habit.getReminderTime(),
                habit.getReminderHour(),
                habit.getIntervalMinutes(),
                habit.getNotificationsEnabled(),
                habit.getArchived(),
                habit.getCreatedAt(),
                totalCompletions,
                todayCompletions,
                completedToday
        );
    }
}
