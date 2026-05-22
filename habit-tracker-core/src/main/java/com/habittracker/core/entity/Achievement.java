package com.habittracker.core.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "achievements")
public class Achievement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AchievementType type;

    @Column(name = "unlocked_at")
    private LocalDateTime unlockedAt = LocalDateTime.now();

    public Achievement() {}

    public Achievement(User user, AchievementType type) {
        this.user = user;
        this.type = type;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public AchievementType getType() { return type; }
    public void setType(AchievementType type) { this.type = type; }

    public LocalDateTime getUnlockedAt() { return unlockedAt; }
    public void setUnlockedAt(LocalDateTime unlockedAt) { this.unlockedAt = unlockedAt; }
}
