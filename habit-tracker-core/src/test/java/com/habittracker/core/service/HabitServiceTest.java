package com.habittracker.core.service;

import com.habittracker.core.dto.CreateHabitRequest;
import com.habittracker.core.dto.HabitDto;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.HabitType;
import com.habittracker.core.entity.User;
import com.habittracker.core.repository.HabitRepository;
import com.habittracker.core.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HabitServiceTest {

    @Mock HabitRepository habitRepository;
    @Mock HabitCompletionService completionService;
    @Mock AchievementService achievementService;
    @Mock UserRepository userRepository;

    @InjectMocks
    HabitService habitService;

    @BeforeEach
    void setUp() {
        when(completionService.getTotalCompletions(any(), any())).thenReturn(0L);
        when(completionService.getTodayCompletionCount(any(), any())).thenReturn(0L);
        when(completionService.isCompletedToday(any(), any())).thenReturn(false);
    }

    @Test
    void createHabit_shouldReturnHabitDto() {
        User user = new User();
        user.setId(1L);

        CreateHabitRequest request = new CreateHabitRequest(
                "Morning Run", "Daily morning jog", "SPORT",
                Frequency.DAILY, HabitType.SINGLE, 1,
                "07:00", null, null, false, false
        );

        Habit savedHabit = new Habit();
        savedHabit.setId(1L);
        savedHabit.setName(request.name());
        savedHabit.setCategory(request.category());
        savedHabit.setFrequency(request.frequency());
        savedHabit.setHabitType(request.habitType());
        savedHabit.setUser(user);

        when(habitRepository.save(any(Habit.class))).thenReturn(savedHabit);

        HabitDto result = habitService.createHabit(request, user);

        assertThat(result.name()).isEqualTo("Morning Run");
        assertThat(result.category()).isEqualTo("SPORT");
        assertThat(result.archived()).isFalse();
        verify(habitRepository).save(any(Habit.class));
    }

    @Test
    void archiveHabit_shouldSetArchivedTrue() {
        User user = new User();
        user.setId(1L);

        Habit habit = new Habit();
        habit.setId(1L);
        habit.setUser(user);
        habit.setArchived(false);

        when(habitRepository.findById(1L)).thenReturn(Optional.of(habit));
        when(habitRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        HabitDto result = habitService.archiveHabit(1L, user);

        assertThat(result.archived()).isTrue();
    }

    @Test
    void unarchiveHabit_shouldSetArchivedFalse() {
        User user = new User();
        user.setId(1L);

        Habit habit = new Habit();
        habit.setId(1L);
        habit.setUser(user);
        habit.setArchived(true);

        when(habitRepository.findById(1L)).thenReturn(Optional.of(habit));
        when(habitRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        HabitDto result = habitService.unarchiveHabit(1L, user);

        assertThat(result.archived()).isFalse();
    }
}
