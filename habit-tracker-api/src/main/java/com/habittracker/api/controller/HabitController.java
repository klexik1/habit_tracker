package com.habittracker.api.controller;

import com.habittracker.core.dto.CreateHabitRequest;
import com.habittracker.core.dto.HabitDto;
import com.habittracker.core.entity.User;
import com.habittracker.core.service.HabitService;
import com.habittracker.core.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/habits")
public class HabitController {
    private final HabitService habitService;
    private final UserService userService;

    public HabitController(HabitService habitService, UserService userService) {
        this.habitService = habitService;
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<HabitDto> create(@Valid @RequestBody CreateHabitRequest request, Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(habitService.createHabit(request, user));
    }

    @GetMapping
    public ResponseEntity<List<HabitDto>> getAll(Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(habitService.getAllHabits(user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<HabitDto> getById(@PathVariable Long id, Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(habitService.getHabitById(id, user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<HabitDto> update(@PathVariable Long id, @Valid @RequestBody CreateHabitRequest request, Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(habitService.updateHabit(id, request, user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        habitService.deleteHabit(id, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<HabitDto> archive(@PathVariable Long id, Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(habitService.archiveHabit(id, user));
    }

    @PostMapping("/{id}/unarchive")
    public ResponseEntity<HabitDto> unarchive(@PathVariable Long id, Authentication auth) {
        User user = userService.findByUsername(auth.getName());
        return ResponseEntity.ok(habitService.unarchiveHabit(id, user));
    }
}
