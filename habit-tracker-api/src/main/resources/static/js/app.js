const API_URL = 'http://localhost:8080/api';
let token = localStorage.getItem('habitTrackerToken');
let currentUser = null;

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showNav();
        loadHabits();
    }
});

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = type + ' show';
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Навигация
function showNav() {
    document.getElementById('nav').style.display = 'block';
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('habits-section').style.display = 'block';
}

function showSection(section) {
    document.getElementById('habits-section').style.display = section === 'habits' ? 'block' : 'none';
    document.getElementById('analytics-section').style.display = section === 'analytics' ? 'block' : 'none';
    
    if (section === 'analytics') {
        // Сбрасываем выбор привычки
        document.getElementById('analytics-habit-select').value = '';
        document.getElementById('analytics-content').innerHTML = '';
        loadOverallAnalytics();
        loadHabitsForAnalytics();
    }
}

// Загрузка привычек для селекта аналитики
async function loadHabitsForAnalytics() {
    const select = document.getElementById('analytics-habit-select');
    select.innerHTML = '<option value=""></option>';

    try {
        const response = await fetch(`${API_URL}/habits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка');

        const habits = await response.json();
        habits.forEach(habit => {
            const option = document.createElement('option');
            option.value = habit.id;
            option.textContent = habit.name;
            select.appendChild(option);
        });
    } catch (error) {
        showNotification('Ошибка загрузки привычек', 'error');
    }
}

// Загрузка общей статистики
async function loadOverallAnalytics() {
    const container = document.getElementById('analytics-overall');
    container.innerHTML = '<div class="loading">Загрузка общей статистики...</div>';

    try {
        const response = await fetch(`${API_URL}/habits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка');

        const habits = await response.json();

        if (habits.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет привычек для статистики</div>';
            return;
        }

        // Собираем общую статистику
        let totalCompletions = 0;
        let maxStreak = 0;
        let maxStreakHabit = '';
        let mostActiveHabit = '';
        let mostActiveCompletions = 0;
        const categoryStats = {};

        for (const habit of habits) {
            totalCompletions += (habit.totalCompletions || 0);

            if ((habit.totalCompletions || 0) > mostActiveCompletions) {
                mostActiveCompletions = habit.totalCompletions;
                mostActiveHabit = habit.name;
            }

            const category = habit.category || 'OTHER';
            categoryStats[category] = (categoryStats[category] || 0) + 1;

            // Получаем аналитику для серии
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const analyticsRes = await fetch(`${API_URL}/analytics/habit/${habit.id}?start=${startDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (analyticsRes.ok) {
                const analytics = await analyticsRes.json();
                if (analytics.longestStreak > maxStreak) {
                    maxStreak = analytics.longestStreak;
                    maxStreakHabit = habit.name;
                }
            }
        }

        // Находим самую популярную категорию
        let topCategory = 'OTHER';
        let topCategoryCount = 0;
        for (const [cat, count] of Object.entries(categoryStats)) {
            if (count > topCategoryCount) {
                topCategoryCount = count;
                topCategory = cat;
            }
        }

        container.innerHTML = `
            <div class="analytics-detail">
                <h3 class="section-title">📊 Общая статистика</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="value">${habits.length}</div>
                        <div class="label">📝 Всего привычек</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${totalCompletions}</div>
                        <div class="label">💪 Всего выполнений</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${maxStreak}</div>
                        <div class="label">🏆 Лучшая серия (${maxStreakHabit || '—'})</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${mostActiveCompletions}</div>
                        <div class="label">⭐ Чаще всего (${mostActiveHabit || '—'})</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${getCategoryName(topCategory)}</div>
                        <div class="label">📂 Популярная категория</div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Ошибка загрузки статистики</div>';
        console.error(error);
    }
}

// Загрузка аналитики по выбранной привычке
async function loadHabitAnalytics() {
    const select = document.getElementById('analytics-habit-select');
    const habitId = select.value;
    const container = document.getElementById('analytics-content');

    if (!habitId) {
        container.innerHTML = '';
        document.getElementById('analytics-overall').style.display = 'block';
        return;
    }

    document.getElementById('analytics-overall').style.display = 'none';
    container.innerHTML = '<div class="loading">Загрузка аналитики...</div>';

    try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const [analyticsRes, completionsRes] = await Promise.all([
            fetch(`${API_URL}/analytics/habit/${habitId}?start=${startDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/completions/habit/${habitId}?start=${startDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!analyticsRes.ok) throw new Error('Ошибка');

        const analytics = await analyticsRes.json();
        const completions = completionsRes.ok ? await completionsRes.json() : [];

        container.innerHTML = `
            <div class="analytics-detail">
                <div class="analytics-header">
                    <h3>📊 ${analytics.habitName}</h3>
                    <span class="category">${getCategoryName(analytics.completionsByCategory ? Object.keys(analytics.completionsByCategory)[0] : 'OTHER')}</span>
                </div>

                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="value">${analytics.currentStreak}</div>
                        <div class="label">🔥 Текущая серия</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.longestStreak}</div>
                        <div class="label">🏆 Лучшая серия</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.periodCompletions}</div>
                        <div class="label">📅 Выполнений за 30 дней</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.totalCompletions}</div>
                        <div class="label">💪 Всего выполнений</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.completionRate}%</div>
                        <div class="label">📈 Процент выполнения</div>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="fill" style="width: ${analytics.completionRate}%"></div>
                </div>
                <p style="text-align: center; margin-top: 10px; color: #666;">Прогресс за последние 30 дней</p>

                <div class="charts-row">
                    <div class="chart-card">
                        <h4>📅 Выполнения по дням</h4>
                        <div class="chart-container">
                            <canvas id="dailyChart"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <h4>📊 Статус выполнения</h4>
                        <div class="chart-container">
                            <canvas id="statusChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // График по дням - линейный график вместо баров
        const dailyData = {};
        for (let i = 29; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            dailyData[dateStr] = 0;
        }

        completions.forEach(c => {
            if (c.completed) {
                const date = new Date(c.completedDate);
                const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                if (dailyData[dateStr] !== undefined) {
                    dailyData[dateStr]++;
                }
            }
        });

        new Chart(document.getElementById('dailyChart'), {
            type: 'line',
            data: {
                labels: Object.keys(dailyData),
                datasets: [{
                    label: 'Выполнения',
                    data: Object.values(dailyData),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, display: false },
                        grid: { display: false }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });

        // Круговая диаграмма - считаем только реально пропущенные
        const completed = analytics.periodCompletions;
        const totalDaysSinceCreation = Math.min(30, Math.ceil((new Date() - new Date(analytics.habitCreatedAt || new Date())) / (1000 * 60 * 60 * 24)));
        const missed = Math.max(0, totalDaysSinceCreation - completed);

        new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: {
                labels: ['Выполнено', 'Не выполнено'],
                datasets: [{
                    data: [completed, missed],
                    backgroundColor: ['#27ae60', '#ecf0f1'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                }
            }
        });

    } catch (error) {
        container.innerHTML = '<div class="empty-state">Ошибка загрузки аналитики</div>';
        console.error(error);
    }
}

function showRegister() {
    document.querySelector('.auth-container').style.display = 'none';
    document.getElementById('register-container').style.display = 'block';
}

function showLogin() {
    document.getElementById('register-container').style.display = 'none';
    document.querySelector('.auth-container').style.display = 'block';
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('habitTrackerToken');
    document.getElementById('nav').style.display = 'none';
    document.getElementById('habits-section').style.display = 'none';
    document.getElementById('analytics-section').style.display = 'none';
    document.getElementById('auth-section').style.display = 'block';
    showNotification('Вы вышли из системы', 'info');
}

// Авторизация
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) throw new Error('Ошибка входа');

        const data = await response.json();
        token = data.token;
        localStorage.setItem('habitTrackerToken', token);
        currentUser = username;
        
        showNav();
        loadHabits();
        showNotification('Добро пожаловать!', 'success');
    } catch (error) {
        showNotification('Неверное имя пользователя или пароль', 'error');
    }
});

// Регистрация
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        if (!response.ok) throw new Error('Ошибка регистрации');

        showNotification('Аккаунт создан! Теперь войдите.', 'success');
        showLogin();
    } catch (error) {
        showNotification('Ошибка регистрации. Возможно, имя или email уже заняты.', 'error');
    }
});

// Загрузка привычек
async function loadHabits() {
    const container = document.getElementById('habits-list');
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const response = await fetch(`${API_URL}/habits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки');

        const habits = await response.json();
        container.innerHTML = '';

        if (habits.length === 0) {
            container.innerHTML = '<div class="empty-state">У вас пока нет привычек. Создайте первую!</div>';
            return;
        }

        habits.forEach(habit => {
            const card = document.createElement('div');
            card.className = 'habit-card' + (habit.completedToday ? ' completed' : '');
            card.innerHTML = `
                <span class="category">${getCategoryName(habit.category)}</span>
                <h4>
                    <span class="checkmark">✓</span>
                    ${habit.name}
                    ${habit.completedToday ? '<span class="status-badge">✓ Выполнено сегодня</span>' : '<span class="status-badge">⏳ Не выполнено</span>'}
                </h4>
                <p>${habit.description || 'Нет описания'}</p>
                <p>📅 ${habit.frequency === 'DAILY' ? 'Каждый день' : 'Каждую неделю'}</p>
                ${habit.reminderTime ? `<p>⏰ Напоминание: ${habit.reminderTime}</p>` : ''}
                <div class="stats-row">
                    <div class="stat">
                        <div class="value">${habit.totalCompletions || 0}</div>
                        <div class="label">Всего выполнено</div>
                    </div>
                </div>
                <div class="actions">
                    <button class="complete" onclick="toggleComplete(${habit.id}, event)">
                        ${habit.completedToday ? '↩ Отменить' : '✓ Выполнено'}
                    </button>
                    <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Ошибка загрузки привычек</div>';
    }
}

function getCategoryName(category) {
    const names = {
        'SPORT': '🏃 Спорт',
        'READING': '📚 Чтение',
        'STUDY': '📖 Учёба',
        'HEALTH': '💪 Здоровье',
        'OTHER': '📌 Другое'
    };
    return names[category] || category;
}

// Создание привычки
document.getElementById('habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const habit = {
        name: document.getElementById('habit-name').value,
        description: document.getElementById('habit-description').value,
        category: document.getElementById('habit-category').value,
        frequency: document.getElementById('habit-frequency').value,
        reminderTime: document.getElementById('habit-reminder').value || null
    };

    try {
        const response = await fetch(`${API_URL}/habits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(habit)
        });

        if (!response.ok) throw new Error('Ошибка создания');

        showNotification('Привычка создана!', 'success');
        document.getElementById('habit-form').reset();
        loadHabits();
    } catch (error) {
        showNotification('Ошибка создания привычки', 'error');
    }
});

// Переключение выполнения
async function toggleComplete(habitId, event) {
    // Сохраняем позицию скролла
    const scrollPosition = window.scrollY;

    try {
        const response = await fetch(`${API_URL}/completions/habit/${habitId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Ошибка');

        const result = await response.json();
        const message = result.completed ? 'Отличная работа! ✓' : 'Выполнение отменено';
        showNotification(message, result.completed ? 'success' : 'info');
        loadHabits();

        // Восстанавливаем позицию скролла
        setTimeout(() => window.scrollTo(0, scrollPosition), 50);
    } catch (error) {
        showNotification('Ошибка', 'error');
    }
}

// Удаление привычки
async function deleteHabit(habitId) {
    if (!confirm('Удалить эту привычку?')) return;

    try {
        const response = await fetch(`${API_URL}/habits/${habitId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка');

        showNotification('Привычка удалена', 'success');
        loadHabits();
    } catch (error) {
        showNotification('Ошибка удаления', 'error');
    }
}


