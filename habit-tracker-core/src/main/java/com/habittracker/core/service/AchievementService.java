package com.habittracker.core.service;

import com.habittracker.core.dto.AchievementDto;
import com.habittracker.core.entity.Achievement;
import com.habittracker.core.entity.AchievementType;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.User;
import com.habittracker.core.repository.AchievementRepository;
import com.habittracker.core.repository.HabitCompletionRepository;
import com.habittracker.core.repository.HabitRepository;
import com.habittracker.core.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
public class AchievementService {

    private final AchievementRepository achievementRepository;
    private final HabitRepository habitRepository;
    private final HabitCompletionRepository completionRepository;
    private final UserRepository userRepository;

    public AchievementService(AchievementRepository achievementRepository,
                              HabitRepository habitRepository,
                              HabitCompletionRepository completionRepository,
                              UserRepository userRepository) {
        this.achievementRepository = achievementRepository;
        this.habitRepository = habitRepository;
        this.completionRepository = completionRepository;
        this.userRepository = userRepository;
    }

    public List<Achievement> getUserAchievements(User user) {
        return achievementRepository.findByUserId(user.getId());
    }

    public List<AchievementDto> getAllAchievementsWithProgress(User user, Frequency frequency) {
        if (frequency == Frequency.INTERVAL) {
            return List.of();
        }

        List<Achievement> unlocked = achievementRepository.findByUserId(user.getId());
        Set<AchievementType> unlockedTypes = new HashSet<>();
        for (Achievement a : unlocked) unlockedTypes.add(a.getType());

        List<Habit> habits = habitRepository.findByUserId(user.getId()).stream()
                .filter(h -> h.getFrequency() == frequency)
                .toList();
        long habitCount = habits.size();
        long completionsSum = user.getLifetimeCompletionCount() != null ? user.getLifetimeCompletionCount() : 0;
        int bestStreak = user.getLifetimeBestStreak() != null ? user.getLifetimeBestStreak() : 0;

        List<AchievementDto> result = new ArrayList<>();
        for (AchievementType type : AchievementType.values()) {
            int progress = switch (type) {
                case FIRST_HABIT -> (int) Math.min(habitCount, type.getThreshold());
                case HABITS_5, HABITS_10 -> (int) Math.min(habitCount, type.getThreshold());
                case FIRST_COMPLETION, COMPLETIONS_10, COMPLETIONS_50, COMPLETIONS_100 ->
                        (int) Math.min(completionsSum, type.getThreshold());
                case STREAK_7, STREAK_30, STREAK_100 ->
                        (int) Math.min(bestStreak, type.getThreshold());
            };
            result.add(new AchievementDto(
                    type.name(),
                    type.getDisplayName(),
                    type.getDescription(),
                    unlockedTypes.contains(type),
                    progress,
                    type.getThreshold(),
                    unlockedTypes.contains(type) ? unlocked.stream()
                            .filter(a -> a.getType() == type).findFirst()
                            .map(a -> a.getUnlockedAt().toString()).orElse(null) : null
            ));
        }
        return result;
    }

    public void checkAndAward(User user, Frequency frequency) {
        if (frequency == Frequency.INTERVAL) {
            return;
        }

        List<Habit> habits = habitRepository.findByUserId(user.getId()).stream()
                .filter(h -> h.getFrequency() == frequency)
                .toList();
        long habitCount = habits.size();

        int currentBestStreak = 0;
        for (Habit h : habits) {
            int streak = calculateLongestStreak(h.getId());
            if (streak > currentBestStreak) currentBestStreak = streak;
        }

        int lifetimeBest = user.getLifetimeBestStreak() != null ? user.getLifetimeBestStreak() : 0;
        if (currentBestStreak > lifetimeBest) {
            user.setLifetimeBestStreak(currentBestStreak);
            userRepository.save(user);
        }

        long completionsSum = user.getLifetimeCompletionCount() != null ? user.getLifetimeCompletionCount() : 0;
        int bestStreak = Math.max(lifetimeBest, currentBestStreak);

        awardIfNotExists(user, AchievementType.FIRST_HABIT, habitCount >= 1);
        awardIfNotExists(user, AchievementType.HABITS_5, habitCount >= 5);
        awardIfNotExists(user, AchievementType.HABITS_10, habitCount >= 10);
        awardIfNotExists(user, AchievementType.FIRST_COMPLETION, completionsSum >= 1);
        awardIfNotExists(user, AchievementType.COMPLETIONS_10, completionsSum >= 10);
        awardIfNotExists(user, AchievementType.COMPLETIONS_50, completionsSum >= 50);
        awardIfNotExists(user, AchievementType.COMPLETIONS_100, completionsSum >= 100);
        awardIfNotExists(user, AchievementType.STREAK_7, bestStreak >= 7);
        awardIfNotExists(user, AchievementType.STREAK_30, bestStreak >= 30);
        awardIfNotExists(user, AchievementType.STREAK_100, bestStreak >= 100);
    }

    private void awardIfNotExists(User user, AchievementType type, boolean condition) {
        if (condition && !achievementRepository.existsByUserIdAndType(user.getId(), type)) {
            achievementRepository.save(new Achievement(user, type));
        }
    }

    private int calculateLongestStreak(Long habitId) {
        var completions = completionRepository.findByHabitId(habitId);
        List<java.time.LocalDate> dates = completions.stream()
                .filter(c -> c.isCompleted())
                .map(c -> c.getCompletedDate())
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
