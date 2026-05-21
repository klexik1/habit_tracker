const API_URL = 'http://localhost:8080/api';
let token = localStorage.getItem('habitTrackerToken');
let currentUser = null;

let dailyChartInstance = null;
let statusChartInstance = null;

function toLocalIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function normalizeDate(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'string') return dateValue.split('T')[0];
    if (Array.isArray(dateValue) && dateValue.length >= 3) {
        const [y, m, d] = dateValue;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    if (typeof dateValue === 'object' && dateValue !== null) {
        const y = dateValue.year || dateValue[0];
        const m = dateValue.monthValue || dateValue.month || dateValue[1] || 1;
        const d = dateValue.dayOfMonth || dateValue.day || dateValue[2] || 1;
        if (y !== undefined && m !== undefined && d !== undefined) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }
    return String(dateValue);
}

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

        const newHabit = await response.json();
        showNotification('Привычка создана!', 'success');
        document.getElementById('habit-form').reset();
        await addHabitToList(newHabit);
    } catch (error) {
        showNotification('Ошибка создания привычки', 'error');
    }
});

// Добавить новую карточку привычки в список без перерисовки
async function addHabitToList(habit) {
    const container = document.getElementById('habits-list');
    const filterSingle = document.getElementById('filter-single').checked;
    const filterMultiple = document.getElementById('filter-multiple').checked;
    const isMultiple = habit.habitType === 'MULTIPLE';

    // Проверяем фильтры
    if (isMultiple && !filterMultiple) return;
    if (!isMultiple && !filterSingle) return;

    // Убираем empty-state если есть
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const card = document.createElement('div');
    card.className = 'habit-card' + (isMultiple ? ' multiple' : '');
    card.id = `habit-card-${habit.id}`;
    card.style.opacity = '0';
    card.style.transform = 'translateY(-15px)';
    card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';

    let extraHtml = '';
    const targetPart = (habit.targetCount && habit.targetCount > 0) ? ` / ${habit.targetCount} раз` : ' раз';
    if (isMultiple) {
        extraHtml = `
            <div class="today-completions">
                <h5>🔥 Сегодня выполнено: 0${targetPart}</h5>
                <div id="completions-info-${habit.id}"><p style="color:#999; font-size:0.9rem;">Пока нет выполнений сегодня</p></div>
            </div>
        `;
    } else {
        extraHtml = `<div id="single-completion-${habit.id}" class="completion-time-single"></div>`;
    }

    card.innerHTML = `
        <span class="category">${getCategoryName(habit.category)} ${isMultiple ? '🔁' : '☑️'}</span>
        <h4>
            <span class="checkmark">✓</span>
            ${habit.name}
            ${!isMultiple ? '<span class="status-badge">⏳ Не выполнено</span>' : ''}
        </h4>
        <p>${habit.description || 'Нет описания'}</p>
        <p>📅 ${getFrequencyName(habit.frequency)}</p>
        ${habit.reminderTime ? `<p>⏰ Напоминание: ${habit.reminderTime}</p>` : ''}
        <div class="stats-row">
            <div class="stat">
                <div class="value">0</div>
                <div class="label">Всего</div>
            </div>
        </div>
        ${extraHtml}
        <div class="actions">
            <button class="complete ${isMultiple ? 'add-completion' : ''}" onclick="handleComplete(${habit.id}, ${isMultiple}, event)">
                ${isMultiple ? '➕ Добавить выполнение' : '✓ Выполнено'}
            </button>
            <button class="edit" onclick="openEditModal(${habit.id})">✏️ Редактировать</button>
            <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
        </div>
    `;

    container.insertBefore(card, container.firstChild);

    // Анимация появления
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    });
}

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

    const filterSingle = document.getElementById('filter-single').checked;
    const filterMultiple = document.getElementById('filter-multiple').checked;

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

        let habits = await response.json();
        container.innerHTML = '';

        if (habits.length === 0) {
            container.innerHTML = '<div class="empty-state">У вас пока нет привычек. Создайте первую!</div>';
            return;
        }

        // Фильтрация по типу
        habits = habits.filter(h => {
            if (h.habitType === 'SINGLE' && filterSingle) return true;
            if (h.habitType === 'MULTIPLE' && filterMultiple) return true;
            return false;
        });

        // Если оба фильтра включены — сортируем по частоте (убывание)
        if (filterSingle && filterMultiple) {
            habits.sort((a, b) => (b.totalCompletions || 0) - (a.totalCompletions || 0));
        }

        if (habits.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет привычек выбранного типа</div>';
            return;
        }

        // Создаём карточки с placeholder'ами для данных
        const habitsNeedingData = [];
        for (const habit of habits) {
            const card = document.createElement('div');
            const isMultiple = habit.habitType === 'MULTIPLE';
            card.className = 'habit-card' + (habit.completedToday ? ' completed' : '') + (isMultiple ? ' multiple' : '');
            card.id = `habit-card-${habit.id}`;

            let extraHtml = '';
            const targetPart = (habit.targetCount && habit.targetCount > 0) ? ` / ${habit.targetCount} раз` : ' раз';
            if (isMultiple) {
                extraHtml = `
                    <div class="today-completions">
                        <h5>🔥 Сегодня выполнено: ${habit.todayCompletions || 0}${targetPart}</h5>
                        <div id="completions-info-${habit.id}"><span class="loading">Загрузка...</span></div>
                    </div>
                `;
            } else {
                extraHtml = `<div id="single-completion-${habit.id}" class="completion-time-single"></div>`;
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
                <p>📅 ${getFrequencyName(habit.frequency)}</p>
                ${habit.reminderTime ? `<p>⏰ Напоминание: ${habit.reminderTime}</p>` : ''}
                <div class="stats-row">
                    <div class="stat">
                        <div class="value">${habit.totalCompletions || 0}</div>
                        <div class="label">Всего</div>
                    </div>
                </div>
                ${extraHtml}
                <div class="actions">
                    <button class="complete ${isMultiple ? 'add-completion' : ''}" onclick="handleComplete(${habit.id}, ${isMultiple}, event)">
                        ${isMultiple ? '➕ Добавить выполнение' : (habit.completedToday ? '↩ Отменить' : '✓ Выполнено')}
                    </button>
                    <button class="edit" onclick="openEditModal(${habit.id})">✏️ Редактировать</button>
                    <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
                </div>
            `;
            container.appendChild(card);
            habitsNeedingData.push(habit);
        }

        // Параллельная загрузка сегодняшних выполнений для всех видимых привычек
        await Promise.all(habitsNeedingData.map(async (habit) => {
            const completions = await fetchTodayCompletions(habit.id);
            const isMultiple = habit.habitType === 'MULTIPLE';

            if (isMultiple) {
                const div = document.getElementById(`completions-info-${habit.id}`);
                if (!div) return;

                if (completions.length === 0) {
                    div.innerHTML = '<p style="color:#999; font-size:0.9rem;">Пока нет выполнений сегодня</p>';
                    return;
                }

                // Сортируем по времени (сначала последние)
                completions.sort((a, b) => {
                    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                    return tb - ta;
                });

                const last = completions[0];
                const lastTime = formatTime(last.completedAt);
                const rest = completions.slice(1);

                let html = `<div class="last-completion">⏰ Последнее: ${lastTime}</div>`;

                if (rest.length > 0) {
                    const moreText = `Ещё ${rest.length} выполнени${rest.length === 1 ? 'е' : (rest.length < 5 ? 'я' : 'й')}...`;
                    html += `
                        <div class="completions-collapse">
                            <button class="collapse-btn" id="collapse-btn-${habit.id}" data-more-text="${moreText}" onclick="toggleCompletions(${habit.id})">${moreText}</button>
                            <div class="completions-list" id="completions-list-${habit.id}">
                                ${rest.map(c => {
                                    const t = formatTime(c.completedAt);
                                    return `<div class="completion-item"><span class="time">⏰ ${t}</span><button class="remove-btn" onclick="removeCompletion(${c.id}, ${habit.id}, event)">✕</button></div>`;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }

                div.innerHTML = html;
            } else {
                const div = document.getElementById(`single-completion-${habit.id}`);
                if (!div) return;

                const todayComp = completions.find(c => c.completed);
                if (todayComp && todayComp.completedAt) {
                    div.innerHTML = `⏰ Выполнено в ${formatTime(todayComp.completedAt)}`;
                } else {
                    div.innerHTML = '';
                }
            }
        }));

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

// Загрузка сегодняшних выполнений (сырые данные)
async function fetchTodayCompletions(habitId) {
    try {
        const today = toLocalIso(new Date());
        const response = await fetch(`${API_URL}/completions/habit/${habitId}?start=${today}&end=${today}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return [];
        const completions = await response.json();
        return completions
            .map(c => ({ ...c, completedDate: normalizeDate(c.completedDate) }))
            .filter(c => c.completedDate === today && c.completed);
    } catch (error) {
        return [];
    }
}

// Форматирование времени выполнения
function formatTime(completedAt) {
    if (!completedAt) return '';
    try {
        return new Date(completedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

// Развернуть / свернуть список выполнений
function toggleCompletions(habitId) {
    const list = document.getElementById(`completions-list-${habitId}`);
    const btn = document.getElementById(`collapse-btn-${habitId}`);
    if (!list || !btn) return;
    if (list.classList.contains('expanded')) {
        list.classList.remove('expanded');
        btn.textContent = btn.dataset.moreText || 'Показать ещё';
    } else {
        list.classList.add('expanded');
        btn.textContent = 'Свернуть';
    }
}

// Модалка редактирования
async function openEditModal(habitId) {
    try {
        const response = await fetch(`${API_URL}/habits/${habitId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка');
        const habit = await response.json();

        document.getElementById('edit-habit-id').value = habit.id;
        document.getElementById('edit-habit-name').value = habit.name;
        document.getElementById('edit-habit-description').value = habit.description || '';
        document.getElementById('edit-habit-category').value = habit.category || 'OTHER';
        document.getElementById('edit-habit-frequency').value = habit.frequency || 'DAILY';

        const targetGroup = document.getElementById('edit-target-group');
        if (habit.habitType === 'MULTIPLE') {
            targetGroup.style.display = 'flex';
            targetGroup.style.flexDirection = 'column';
            document.getElementById('edit-habit-target').value = habit.targetCount ?? 1;
        } else {
            targetGroup.style.display = 'none';
        }

        document.getElementById('edit-modal').style.display = 'flex';
    } catch (error) {
        showNotification('Ошибка загрузки привычки', 'error');
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('edit-habit-form').reset();
}

async function saveHabitEdit(e) {
    e.preventDefault();
    const habitId = document.getElementById('edit-habit-id').value;
    const name = document.getElementById('edit-habit-name').value.trim();
    const description = document.getElementById('edit-habit-description').value.trim();
    const rawTarget = document.getElementById('edit-habit-target').value;
    const targetCount = rawTarget === '' ? 0 : parseInt(rawTarget);

    try {
        const habitRes = await fetch(`${API_URL}/habits/${habitId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!habitRes.ok) throw new Error('Ошибка');
        const habit = await habitRes.json();

        const updated = {
            name,
            description,
            category: document.getElementById('edit-habit-category').value,
            frequency: document.getElementById('edit-habit-frequency').value,
            habitType: habit.habitType,
            targetCount: habit.habitType === 'MULTIPLE' ? targetCount : (habit.targetCount || 1),
            reminderTime: habit.reminderTime
        };

        const response = await fetch(`${API_URL}/habits/${habitId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updated)
        });

        if (!response.ok) throw new Error('Ошибка сохранения');

        showNotification('Привычка обновлена!', 'success');
        closeEditModal();
        await refreshHabitCard(habitId);
    } catch (error) {
        showNotification('Ошибка обновления привычки', 'error');
    }
}

// Обновить одну карточку привычки без перерисовки всего списка
async function refreshHabitCard(habitId) {
    const oldCard = document.getElementById(`habit-card-${habitId}`);
    if (!oldCard) {
        await loadHabits();
        return;
    }

    // Сохраняем состояние collapse
    const oldList = document.getElementById(`completions-list-${habitId}`);
    const wasExpanded = oldList && oldList.classList.contains('expanded');

    try {
        const [habitRes, completions] = await Promise.all([
            fetch(`${API_URL}/habits/${habitId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetchTodayCompletions(habitId)
        ]);

        if (!habitRes.ok) throw new Error('Ошибка');
        const habit = await habitRes.json();
        const isMultiple = habit.habitType === 'MULTIPLE';

        // Собираем новый HTML карточки
        let extraHtml = '';
        const targetPart = (habit.targetCount && habit.targetCount > 0) ? ` / ${habit.targetCount} раз` : ' раз';
        if (isMultiple) {
            extraHtml = `
                <div class="today-completions">
                    <h5>🔥 Сегодня выполнено: ${habit.todayCompletions || 0}${targetPart}</h5>
                    <div id="completions-info-${habit.id}"><span class="loading">Загрузка...</span></div>
                </div>
            `;
        } else {
            extraHtml = `<div id="single-completion-${habit.id}" class="completion-time-single"></div>`;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="habit-card${habit.completedToday ? ' completed' : ''}${isMultiple ? ' multiple' : ''}" id="habit-card-${habit.id}">
                <span class="category">${getCategoryName(habit.category)} ${isMultiple ? '🔁' : '☑️'}</span>
                <h4>
                    <span class="checkmark">✓</span>
                    ${habit.name}
                    ${!isMultiple && habit.completedToday ? '<span class="status-badge">✓ Выполнено</span>' : ''}
                    ${!isMultiple && !habit.completedToday ? '<span class="status-badge">⏳ Не выполнено</span>' : ''}
                </h4>
                <p>${habit.description || 'Нет описания'}</p>
                <p>📅 ${getFrequencyName(habit.frequency)}</p>
                ${habit.reminderTime ? `<p>⏰ Напоминание: ${habit.reminderTime}</p>` : ''}
                <div class="stats-row">
                    <div class="stat">
                        <div class="value">${habit.totalCompletions || 0}</div>
                        <div class="label">Всего</div>
                    </div>
                </div>
                ${extraHtml}
                <div class="actions">
                    <button class="complete ${isMultiple ? 'add-completion' : ''}" onclick="handleComplete(${habit.id}, ${isMultiple}, event)">
                        ${isMultiple ? '➕ Добавить выполнение' : (habit.completedToday ? '↩ Отменить' : '✓ Выполнено')}
                    </button>
                    <button class="edit" onclick="openEditModal(${habit.id})">✏️ Редактировать</button>
                    <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
                </div>
            </div>
        `;
        const newCard = wrapper.firstElementChild;

        // Заменяем старую карточку на новую
        oldCard.replaceWith(newCard);

        // Заполняем данные выполнений
        if (isMultiple) {
            const div = document.getElementById(`completions-info-${habit.id}`);
            if (!div) return;

            if (completions.length === 0) {
                div.innerHTML = '<p style="color:#999; font-size:0.9rem;">Пока нет выполнений сегодня</p>';
                return;
            }

            completions.sort((a, b) => {
                const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return tb - ta;
            });

            const last = completions[0];
            const lastTime = formatTime(last.completedAt);
            const rest = completions.slice(1);

            let html = `<div class="last-completion">⏰ Последнее: ${lastTime}</div>`;
            if (rest.length > 0) {
                const moreText = `Ещё ${rest.length} выполнени${rest.length === 1 ? 'е' : (rest.length < 5 ? 'я' : 'й')}...`;
                html += `
                    <div class="completions-collapse">
                        <button class="collapse-btn" id="collapse-btn-${habit.id}" data-more-text="${moreText}" onclick="toggleCompletions(${habit.id})">${moreText}</button>
                        <div class="completions-list${wasExpanded ? ' expanded' : ''}" id="completions-list-${habit.id}">
                            ${rest.map(c => {
                                const t = formatTime(c.completedAt);
                                return `<div class="completion-item"><span class="time">⏰ ${t}</span><button class="remove-btn" onclick="removeCompletion(${c.id}, ${habit.id}, event)">✕</button></div>`;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
            div.innerHTML = html;

            // Восстанавливаем текст кнопки если был развёрнут
            if (wasExpanded) {
                const btn = document.getElementById(`collapse-btn-${habit.id}`);
                if (btn) btn.textContent = 'Свернуть';
            }
        } else {
            const div = document.getElementById(`single-completion-${habit.id}`);
            if (div) {
                const todayComp = completions.find(c => c.completed);
                if (todayComp && todayComp.completedAt) {
                    div.innerHTML = `⏰ Выполнено в ${formatTime(todayComp.completedAt)}`;
                } else {
                    div.innerHTML = '';
                }
            }
        }
    } catch (error) {
        console.error('refreshHabitCard error:', error);
        await loadHabits();
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

        await refreshHabitCard(habitId);
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
        await refreshHabitCard(habitId);
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

function getFrequencyName(freq) {
    const names = {
        'DAILY': 'Каждый день',
        'WEEKLY': 'Каждую неделю',
        'MONTHLY': 'Каждый месяц'
    };
    return names[freq] || freq;
}

// ==================== АНАЛИТИКА ====================

async function loadHabitsForAnalytics() {
    const select = document.getElementById('analytics-habit-select');
    select.innerHTML = '<option value="">📊 Общая статистика</option>';

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

            const endDate = toLocalIso(new Date());
            const startDate = toLocalIso(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

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
                        <div class="value" style="font-size:1.3rem; line-height:1.4;">${getCategoryName(topCategory)}</div>
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
        const endDate = toLocalIso(new Date());
        const startDate = toLocalIso(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

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

        if (!analyticsRes.ok) throw new Error('Ошибка загрузки аналитики');

        const analytics = await analyticsRes.json();
        const allCompletions = completionsRes.ok ? await completionsRes.json() : [];
        const habit = habitRes.ok ? await habitRes.json() : null;
        const isMultiple = habit && habit.habitType === 'MULTIPLE';

        const completions = allCompletions
            .map(c => ({ ...c, completedDate: normalizeDate(c.completedDate) }))
            .filter(c => c.completedDate && c.completedDate >= startDate && c.completedDate <= endDate && c.completed);

        // === Формируем 30 дней: ISO-ключ + отображаемая метка ===
        const days = [];
        const countsByIso = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const iso = toLocalIso(d);
            const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            days.push({ iso, label });
            countsByIso[iso] = 0;
        }

        completions.forEach(c => {
            if (countsByIso[c.completedDate] !== undefined) {
                countsByIso[c.completedDate]++;
            }
        });

        const labels = days.map(d => d.label);
        const dataValues = days.map(d => countsByIso[d.iso]);

        console.log('Date range:', startDate, 'to', endDate);
        console.log('Days map:', days);
        console.log('Completions raw:', allCompletions);
        console.log('Completions normalized:', completions);
        console.log('Data values:', dataValues);

        const completedDays = dataValues.filter(v => v > 0).length;
        const totalDays = days.length;
        const displayRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
        const missedDays = totalDays - completedDays;

        // Уничтожаем старые графики перед созданием новых
        if (dailyChartInstance) {
            dailyChartInstance.destroy();
            dailyChartInstance = null;
        }
        if (statusChartInstance) {
            statusChartInstance.destroy();
            statusChartInstance = null;
        }

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
                        <div class="label">📈 Процент дней</div>
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

        // === График динамики ===
        const dailyCtx = document.getElementById('dailyChart').getContext('2d');
        const mainColor = isMultiple ? '#f39c12' : '#667eea';
        const mainBg = isMultiple ? 'rgba(243, 156, 18, 0.15)' : 'rgba(102, 126, 234, 0.15)';

        dailyChartInstance = new Chart(dailyCtx, {
            type: isMultiple ? 'bar' : 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: isMultiple ? 'Количество выполнений' : 'Выполнено',
                    data: dataValues,
                    borderColor: mainColor,
                    backgroundColor: mainBg,
                    borderWidth: 2,
                    fill: !isMultiple,
                    tension: 0.3,
                    pointBackgroundColor: mainColor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: isMultiple ? 0 : 4,
                    borderRadius: isMultiple ? 4 : 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                                if (isMultiple) return `Выполнений: ${val}`;
                                return val > 0 ? '✅ Выполнено' : '❌ Не выполнено';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: isMultiple ? undefined : 1,
                        ticks: {
                            stepSize: 1,
                            display: isMultiple
                        },
                        grid: { display: isMultiple, color: 'rgba(0,0,0,0.05)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });

        // === График статуса (doughnut с процентом в центре) ===
        const statusCtx = document.getElementById('statusChart').getContext('2d');

        statusChartInstance = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Выполнено', 'Пропущено'],
                datasets: [{
                    data: [completedDays, missedDays],
                    backgroundColor: ['#27ae60', '#e0e0e0'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 12, font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                const pct = totalDays > 0 ? Math.round((val / totalDays) * 100) : 0;
                                return ` ${context.label}: ${val} дн. (${pct}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw: function(chart) {
                    const { width, height, ctx } = chart;
                    ctx.save();
                    const fontSize = Math.min(height / 5, 32);
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.textBaseline = 'middle';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#333';
                    ctx.fillText(displayRate + '%', width / 2, height / 2 - 6);

                    ctx.font = `${Math.min(height / 10, 14)}px sans-serif`;
                    ctx.fillStyle = '#888';
                    ctx.fillText('выполнено', width / 2, height / 2 + 14);
                    ctx.restore();
                }
            }]
        });

    } catch (error) {
        container.innerHTML = '<div class="empty-state">Ошибка загрузки аналитики</div>';
        console.error('loadHabitAnalytics error:', error);
    }
}
