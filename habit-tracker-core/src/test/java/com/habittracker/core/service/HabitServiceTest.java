package com.habittracker.core.service;

import com.habittracker.core.dto.CreateHabitRequest;
import com.habittracker.core.dto.HabitDto;
import com.habittracker.core.entity.Category;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.User;
import com.habittracker.core.repository.HabitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HabitServiceTest {

    @Mock
    private HabitRepository habitRepository;

    private HabitService habitService;

    @BeforeEach
    void setUp() {
        habitService = new HabitService(habitRepository);
    }

    @Test
    void createHabit_shouldReturnHabitDto() {
        User user = new User();
        user.setId(1L);
        user.setUsername("testuser");

        CreateHabitRequest request = new CreateHabitRequest(
                "Morning Run",
                "Daily morning jog",
                Category.SPORT,
                Frequency.DAILY,
                null,
                1,
                "07:00",
                null,
                null,
                false
        );

        Habit savedHabit = new Habit();
        savedHabit.setId(1L);
        savedHabit.setName(request.name());
        savedHabit.setDescription(request.description());
        savedHabit.setCategory(request.category());
        savedHabit.setFrequency(request.frequency());
        savedHabit.setTargetCount(request.targetCount());
        savedHabit.setReminderTime(request.reminderTime());
        savedHabit.setIntervalHours(request.intervalHours());
        savedHabit.setUser(user);

        when(habitRepository.save(any(Habit.class))).thenReturn(savedHabit);

        HabitDto result = habitService.createHabit(request, user);

        assertNotNull(result);
        assertEquals("Morning Run", result.name());
        assertEquals(Category.SPORT, result.category());
        verify(habitRepository).save(any(Habit.class));
    }
}
