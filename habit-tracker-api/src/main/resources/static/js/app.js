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
        loadAnalytics();
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
            card.className = 'habit-card';
            card.innerHTML = `
                <span class="category">${getCategoryName(habit.category)}</span>
                <h4>${habit.name}</h4>
                <p>${habit.description || 'Нет описания'}</p>
                <p>📅 ${habit.frequency === 'DAILY' ? 'Ежедневно' : 'Еженедельно'}</p>
                ${habit.reminderTime ? `<p>⏰ Напоминание: ${habit.reminderTime}</p>` : ''}
                <div class="actions">
                    <button class="complete" onclick="markComplete(${habit.id})">✓ Выполнено</button>
                    <button onclick="deleteHabit(${habit.id})">Удалить</button>
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

// Отметка выполнения
async function markComplete(habitId) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const response = await fetch(`${API_URL}/completions/habit/${habitId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                date: today,
                completed: true,
                note: 'Выполнено!'
            })
        });

        if (!response.ok) throw new Error('Ошибка');

        showNotification('Отличная работа! ✓', 'success');
    } catch (error) {
        showNotification('Ошибка отметки выполнения', 'error');
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

// Загрузка аналитики
async function loadAnalytics() {
    const container = document.getElementById('analytics-content');
    container.innerHTML = '<div class="loading">Загрузка аналитики...</div>';

    try {
        const habitsResponse = await fetch(`${API_URL}/habits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!habitsResponse.ok) throw new Error('Ошибка');

        const habits = await habitsResponse.json();
        
        if (habits.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет данных для аналитики</div>';
            return;
        }

        container.innerHTML = '';
        
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        for (const habit of habits) {
            const analyticsResponse = await fetch(
                `${API_URL}/analytics/habit/${habit.id}?start=${startDate}&end=${endDate}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (analyticsResponse.ok) {
                const analytics = await analyticsResponse.json();
                
                const card = document.createElement('div');
                card.className = 'analytics-card';
                card.innerHTML = `
                    <h4>${habit.name}</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="value">${analytics.currentStreak}</div>
                            <div class="label">Текущая серия</div>
                        </div>
                        <div class="stat-item">
                            <div class="value">${analytics.longestStreak}</div>
                            <div class="label">Лучшая серия</div>
                        </div>
                        <div class="stat-item">
                            <div class="value">${analytics.periodCompletions}</div>
                            <div class="label">Выполнений за 30 дней</div>
                        </div>
                        <div class="stat-item">
                            <div class="value">${analytics.completionRate}%</div>
                            <div class="label">Процент выполнения</div>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="fill" style="width: ${analytics.completionRate}%"></div>
                    </div>
                `;
                container.appendChild(card);
            }
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Ошибка загрузки аналитики</div>';
    }
}
