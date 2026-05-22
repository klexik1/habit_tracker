package com.habittracker.core.repository;

import com.habittracker.core.entity.Achievement;
import com.habittracker.core.entity.AchievementType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AchievementRepository extends JpaRepository<Achievement, Long> {
    List<Achievement> findByUserId(Long userId);
    boolean existsByUserIdAndType(Long userId, AchievementType type);
    void deleteByUserId(Long userId);
}
