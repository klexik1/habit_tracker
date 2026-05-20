package com.habittracker.core.repository;

import com.habittracker.core.entity.HabitCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HabitCompletionRepository extends JpaRepository<HabitCompletion, Long> {
    List<HabitCompletion> findByHabitIdAndCompletedDate(Long habitId, LocalDate date);
    List<HabitCompletion> findByHabitIdAndCompletedDateBetween(Long habitId, LocalDate start, LocalDate end);
    List<HabitCompletion> findByHabitId(Long habitId);

    @Query("SELECT hc FROM HabitCompletion hc JOIN hc.habit h WHERE h.user.id = :userId AND hc.completedDate = :date")
    List<HabitCompletion> findByUserIdAndCompletedDate(@Param("userId") Long userId, @Param("date") LocalDate date);

    @Query("SELECT COUNT(hc) FROM HabitCompletion hc WHERE hc.habit.id = :habitId AND hc.completed = true AND hc.completedDate BETWEEN :start AND :end")
    Long countCompletedByHabitAndPeriod(@Param("habitId") Long habitId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COUNT(hc) FROM HabitCompletion hc WHERE hc.habit.id = :habitId AND hc.completed = true AND hc.completedDate = :date")
    Long countCompletedToday(@Param("habitId") Long habitId, @Param("date") LocalDate date);

    List<HabitCompletion> findByHabitIdAndCompletedDateAndCompletedTrue(Long habitId, LocalDate date);

    @Query("SELECT hc FROM HabitCompletion hc WHERE hc.habit.id = :habitId AND hc.completedDate BETWEEN :start AND :end")
    List<HabitCompletion> findAllWithDates(@Param("habitId") Long habitId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT hc FROM HabitCompletion hc WHERE hc.habit.id = :habitId")
    List<HabitCompletion> findAllByHabitId(@Param("habitId") Long habitId);
}
