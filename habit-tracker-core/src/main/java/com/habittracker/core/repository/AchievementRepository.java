package com.habittracker.core.repository;

import com.habittracker.core.entity.Achievement;
import com.habittracker.core.entity.AchievementType;
import com.habittracker.core.entity.Frequency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AchievementRepository extends JpaRepository<Achievement, Long> {
    List<Achievement> findByUserId(Long userId);
    List<Achievement> findByUserIdAndFrequency(Long userId, Frequency frequency);
    long countByUserId(Long userId);
    boolean existsByUserIdAndTypeAndFrequency(Long userId, AchievementType type, Frequency frequency);
    void deleteByUserId(Long userId);
}
