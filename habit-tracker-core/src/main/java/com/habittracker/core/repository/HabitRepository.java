package com.habittracker.core.repository;

import com.habittracker.core.entity.Habit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface HabitRepository extends JpaRepository<Habit, Long> {
    List<Habit> findByUserId(Long userId);
    List<Habit> findByUserIdAndCategory(Long userId, String category);

    @Query("SELECT h FROM Habit h JOIN FETCH h.user")
    List<Habit> findAllWithUsers();
}
