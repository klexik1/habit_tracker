package com.habittracker.core.repository;

import com.habittracker.core.AbstractRepositoryTest;
import com.habittracker.core.entity.Frequency;
import com.habittracker.core.entity.Habit;
import com.habittracker.core.entity.HabitType;
import com.habittracker.core.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HabitRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setUsername("habituser");
        testUser.setEmail("habit@test.com");
        testUser.setPassword("pass");
        testUser = userRepository.save(testUser);
    }

    @Test
    void save_shouldPersistHabit() {
        Habit habit = new Habit();
        habit.setName("Test Habit");
        habit.setCategory("SPORT");
        habit.setFrequency(Frequency.DAILY);
        habit.setHabitType(HabitType.SINGLE);
        habit.setUser(testUser);

        Habit saved = habitRepository.save(habit);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getName()).isEqualTo("Test Habit");
    }

    @Test
    void findByUserId_shouldReturnUserHabits() {
        Habit h1 = createHabit("Habit 1", "SPORT");
        Habit h2 = createHabit("Habit 2", "HEALTH");
        createHabitForOtherUser("Other Habit");

        List<Habit> found = habitRepository.findByUserId(testUser.getId());

        assertThat(found).hasSize(2);
        assertThat(found).extracting(Habit::getName).containsExactlyInAnyOrder("Habit 1", "Habit 2");
    }

    @Test
    void findByUserIdAndCategory_shouldFilterByCategory() {
        createHabit("Sport Habit", "SPORT");
        createHabit("Health Habit", "HEALTH");

        List<Habit> sportHabits = habitRepository.findByUserIdAndCategory(testUser.getId(), "SPORT");

        assertThat(sportHabits).hasSize(1);
        assertThat(sportHabits.get(0).getName()).isEqualTo("Sport Habit");
    }

    @Test
    void findByUserId_shouldReturnEmpty_whenNoHabits() {
        User other = new User();
        other.setUsername("other");
        other.setEmail("other@test.com");
        other.setPassword("pass");
        other = userRepository.save(other);

        List<Habit> found = habitRepository.findByUserId(other.getId());
        assertThat(found).isEmpty();
    }

    private Habit createHabit(String name, String category) {
        Habit habit = new Habit();
        habit.setName(name);
        habit.setCategory(category);
        habit.setFrequency(Frequency.DAILY);
        habit.setHabitType(HabitType.SINGLE);
        habit.setUser(testUser);
        return habitRepository.save(habit);
    }

    private void createHabitForOtherUser(String name) {
        User other = new User();
        other.setUsername("other" + System.currentTimeMillis());
        other.setEmail("other" + System.currentTimeMillis() + "@test.com");
        other.setPassword("pass");
        other = userRepository.save(other);

        Habit habit = new Habit();
        habit.setName(name);
        habit.setCategory("SPORT");
        habit.setFrequency(Frequency.DAILY);
        habit.setHabitType(HabitType.SINGLE);
        habit.setUser(other);
        habitRepository.save(habit);
    }
}
