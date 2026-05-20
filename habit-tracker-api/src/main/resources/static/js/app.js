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
        document.getElementById('analytics-habit-select').value = '';
        document.getElementById('analytics-content').innerHTML = '';
        loadOverallAnalytics();
        loadHabitsForAnalytics();
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

// Создание привычки
document.getElementById('habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const habit = {
        name: document.getElementById('habit-name').value,
        description: document.getElementById('habit-description').value,
        category: document.getElementById('habit-category').value,
        frequency: document.getElementById('habit-frequency').value,
        habitType: document.getElementById('habit-type').value,
        targetCount: 1,
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

// Загрузка привычек
async function loadHabits(preserveScroll = false) {
    const container = document.getElementById('habits-list');
    let scrollY = 0;

    if (preserveScroll) {
        scrollY = window.scrollY;
        const currentHeight = container.offsetHeight;
        container.style.minHeight = currentHeight + 'px';
    } else {
        container.innerHTML = '<div class="loading">Загрузка...</div>';
    }

    try {
        const response = await fetch(`${API_URL}/habits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('habitTrackerToken');
                token = null;
                document.getElementById('nav').style.display = 'none';
                document.getElementById('habits-section').style.display = 'none';
                document.getElementById('auth-section').style.display = 'block';
                container.innerHTML = '';
                showNotification('Сессия истекла. Войдите снова', 'error');
                return;
            }
            throw new Error(`Ошибка ${response.status}`);
        }

        const habits = await response.json();
        container.innerHTML = '';

        if (habits.length === 0) {
            container.innerHTML = '<div class="empty-state">У вас пока нет привычек. Создайте первую!</div>';
            return;
        }

        // Сначала создаем все карточки
        const multipleHabits = [];
        for (const habit of habits) {
            const card = document.createElement('div');
            const isMultiple = habit.habitType === 'MULTIPLE';
            card.className = 'habit-card' + (habit.completedToday ? ' completed' : '') + (isMultiple ? ' multiple' : '');
            card.id = `habit-card-${habit.id}`;

            let completionsPlaceholder = '';
            if (isMultiple) {
                const todayCount = habit.todayCompletions || 0;
                completionsPlaceholder = `
                    <div class="today-completions">
                        <h5>🔥 Сегодня выполнено: ${todayCount} раз</h5>
                        <div id="completions-${habit.id}"><span class="loading">Загрузка...</span></div>
                    </div>
                `;
                multipleHabits.push(habit.id);
            }

            card.innerHTML = `
                <span class="category">${getCategoryName(habit.category)} ${isMultiple ? '🔁' : '☑️'}</span>
                <h4>
                    <span class="checkmark">✓</span>
                    ${habit.name}
                    ${!isMultiple && habit.completedToday ? '<span class="status-badge">✓ Выполнено</span>' : ''}
                    ${!isMultiple && !habit.completedToday ? '<span class="status-badge">⏳ Не выполнено</span>' : ''}
                </h4>
                <p>${habit.description || 'Нет описания'}</p>
                <p>📅 ${habit.frequency === 'DAILY' ? 'Каждый день' : 'Каждую неделю'}</p>
                ${habit.reminderTime ? `<p>⏰ Напоминание: ${habit.reminderTime}</p>` : ''}
                <div class="stats-row">
                    <div class="stat">
                        <div class="value">${habit.totalCompletions || 0}</div>
                        <div class="label">Всего</div>
                    </div>
                </div>
                ${completionsPlaceholder}
                <div class="actions">
                    <button class="complete ${isMultiple ? 'add-completion' : ''}" onclick="handleComplete(${habit.id}, ${isMultiple}, event)">
                        ${isMultiple ? '➕ Добавить выполнение' : (habit.completedToday ? '↩ Отменить' : '✓ Выполнено')}
                    </button>
                    <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
                </div>
            `;
            container.appendChild(card);
        }

        // Параллельная загрузка выполнений для всех MULTIPLE привычек
        if (multipleHabits.length > 0) {
            await Promise.all(multipleHabits.map(async (habitId) => {
                const html = await loadTodayCompletions(habitId);
                const div = document.getElementById(`completions-${habitId}`);
                if (div) div.innerHTML = html || '<p style="color:#999; font-size:0.9rem;">Пока нет выполнений сегодня</p>';
            }));
        }
    } catch (error) {
        console.error('Load habits error:', error);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки привычек. Обновите страницу.</div>';
    } finally {
        if (preserveScroll) {
            container.style.minHeight = '';
            window.scrollTo(0, scrollY);
        }
    }
}

// Загрузка сегодняшних выполнений для многоразовой привычки
async function loadTodayCompletions(habitId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_URL}/completions/habit/${habitId}?start=${today}&end=${today}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return '';

        const completions = await response.json();
        const todayCompletions = completions.filter(c => c.completedDate === today && c.completed);

        if (todayCompletions.length === 0) return '<p style="color:#999; font-size:0.9rem;">Пока нет выполнений сегодня</p>';

        return todayCompletions.map(c => {
            const time = c.completedAt ? new Date(c.completedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="completion-item">
                    <span class="time">⏰ ${time}</span>
                    <button class="remove-btn" onclick="removeCompletion(${c.id}, ${habitId}, event)">✕</button>
                </div>
            `;
        }).join('');
    } catch (error) {
        return '';
    }
}

// Обработка выполнения
async function handleComplete(habitId, isMultiple, event) {
    try {
        const response = await fetch(`${API_URL}/completions/habit/${habitId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Ошибка');

        if (isMultiple) {
            showNotification('Выполнение добавлено! ✓', 'success');
        } else {
            const result = await response.json();
            const message = result.completed ? 'Отличная работа! ✓' : 'Выполнение отменено';
            showNotification(message, result.completed ? 'success' : 'info');
        }

        await loadHabits(true);
    } catch (error) {
        showNotification('Ошибка', 'error');
    }
}

// Удалить конкретное выполнение (для многоразовых)
async function removeCompletion(completionId, habitId, event) {
    event.stopPropagation();

    try {
        const response = await fetch(`${API_URL}/completions/${completionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка');

        showNotification('Выполнение удалено', 'info');
        await loadHabits(true);
    } catch (error) {
        showNotification('Ошибка удаления', 'error');
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
        await loadHabits(true);
    } catch (error) {
        showNotification('Ошибка удаления', 'error');
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

// ==================== АНАЛИТИКА ====================

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
            option.textContent = `${habit.name} ${habit.habitType === 'MULTIPLE' ? '🔁' : '☑️'}`;
            select.appendChild(option);
        });
    } catch (error) {
        showNotification('Ошибка загрузки привычек', 'error');
    }
}

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

        const singleHabits = habits.filter(h => h.habitType === 'SINGLE');
        const multipleHabits = habits.filter(h => h.habitType === 'MULTIPLE');

        let totalCompletions = 0;
        let maxStreak = 0;
        let maxStreakHabit = '';
        let mostActiveHabit = '';
        let mostActiveCompletions = 0;
        let mostActiveMultiple = '';
        let mostActiveMultipleCount = 0;
        const categoryStats = {};

        for (const habit of habits) {
            totalCompletions += (habit.totalCompletions || 0);

            if ((habit.totalCompletions || 0) > mostActiveCompletions) {
                mostActiveCompletions = habit.totalCompletions;
                mostActiveHabit = habit.name;
            }

            if (habit.habitType === 'MULTIPLE' && (habit.todayCompletions || 0) > mostActiveMultipleCount) {
                mostActiveMultipleCount = habit.todayCompletions;
                mostActiveMultiple = habit.name;
            }

            const category = habit.category || 'OTHER';
            categoryStats[category] = (categoryStats[category] || 0) + 1;

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
                        <div class="value">${singleHabits.length}</div>
                        <div class="label">☑️ Одноразовых</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${multipleHabits.length}</div>
                        <div class="label">🔁 Многоразовых</div>
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
                        <div class="label">⭐ Топ привычка (${mostActiveHabit || '—'})</div>
                    </div>
                    ${mostActiveMultiple ? `
                    <div class="stat-item">
                        <div class="value">${mostActiveMultipleCount}</div>
                        <div class="label">🔥 Топ сегодня (${mostActiveMultiple})</div>
                    </div>
                    ` : ''}
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

        const [analyticsRes, completionsRes, habitRes] = await Promise.all([
            fetch(`${API_URL}/analytics/habit/${habitId}?start=${startDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/completions/habit/${habitId}?start=${startDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/habits/${habitId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!analyticsRes.ok) throw new Error('Ошибка');

        const analytics = await analyticsRes.json();
        const allCompletions = completionsRes.ok ? await completionsRes.json() : [];
        const habit = habitRes.ok ? await habitRes.json() : null;
        const isMultiple = habit && habit.habitType === 'MULTIPLE';

        // Фильтруем по датам на фронтенде
        const completions = allCompletions.filter(c => c.completedDate >= startDate && c.completedDate <= endDate);

        console.log('Analytics:', analytics);
        console.log('Completions:', completions);
        console.log('Habit:', habit);

        // Вычисляем данные для графиков
        const dailyData = {};
        for (let i = 29; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            dailyData[dateStr] = 0;
        }

        completions.forEach(c => {
            if (c.completed) {
                // completedDate приходит как YYYY-MM-DD
                const [year, month, day] = c.completedDate.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                if (dailyData[dateStr] !== undefined) {
                    dailyData[dateStr]++;
                }
            }
        });

        const completedDays = Object.values(dailyData).filter(v => v > 0).length;
        const totalDays = Object.keys(dailyData).length;
        const displayRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
        const missed = Math.max(0, totalDays - completedDays);

        container.innerHTML = `
            <div class="analytics-detail">
                <div class="analytics-header">
                    <h3>📊 ${analytics.habitName} ${isMultiple ? '🔁' : '☑️'}</h3>
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
                        <div class="label">📅 За 30 дней</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.totalCompletions}</div>
                        <div class="label">💪 Всего</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${displayRate}%</div>
                        <div class="label">📈 Процент</div>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="fill" style="width: ${displayRate}%"></div>
                </div>
                <p style="text-align: center; margin-top: 10px; color: #666;">Прогресс за последние 30 дней</p>

                <div class="charts-row">
                    <div class="chart-card">
                        <h4>📅 Динамика выполнения</h4>
                        <div class="chart-container">
                            <canvas id="dailyChart"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <h4>📊 Статус</h4>
                        <div class="chart-container">
                            <canvas id="statusChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        new Chart(document.getElementById('dailyChart'), {
            type: 'line',
            data: {
                labels: Object.keys(dailyData),
                datasets: [{
                    label: isMultiple ? 'Количество' : 'Выполнено',
                    data: Object.values(dailyData),
                    borderColor: isMultiple ? '#f39c12' : '#667eea',
                    backgroundColor: isMultiple ? 'rgba(243, 156, 18, 0.1)' : 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: isMultiple ? '#f39c12' : '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { display: false }, grid: { display: false } },
                    x: { grid: { display: false } }
                }
            }
        });

        new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: {
                labels: ['Выполнено', 'Не выполнено'],
                datasets: [{
                    data: [completedDays, missed],
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
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15 } }
                }
            }
        });

    } catch (error) {
        container.innerHTML = '<div class="empty-state">Ошибка загрузки аналитики</div>';
        console.error(error);
    }
}
