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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Frequency frequency;

    @Column(name = "unlocked_at")
    private LocalDateTime unlockedAt = LocalDateTime.now();

    public Achievement() {}

    public Achievement(User user, AchievementType type, Frequency frequency) {
        this.user = user;
        this.type = type;
        this.frequency = frequency;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public AchievementType getType() { return type; }
    public void setType(AchievementType type) { this.type = type; }

    public Frequency getFrequency() { return frequency; }
    public void setFrequency(Frequency frequency) { this.frequency = frequency; }

    public LocalDateTime getUnlockedAt() { return unlockedAt; }
    public void setUnlockedAt(LocalDateTime unlockedAt) { this.unlockedAt = unlockedAt; }
}
