const API_URL = '/api';
let token = localStorage.getItem('habitTrackerToken');
let currentUser = null;

let dailyChartInstance = null;
let statusChartInstance = null;

// Смещение дней для тестирования (кнопка "пропустить сутки")
let testDayOffset = parseInt(localStorage.getItem('testDayOffset') || '0');

function getTestDate(base = new Date()) {
    const d = new Date(base);
    d.setDate(d.getDate() + testDayOffset);
    return d;
}

function toLocalIso(date) {
    const d = getTestDate(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function getTodayDate() {
    return getTestDate();
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

// Извлекает человекочитаемое сообщение из ответа сервера
function extractServerError(text) {
    if (!text) return null;
    text = text.trim();
    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            const json = JSON.parse(text);
            return json.error || json.message || text;
        } catch {
            return text;
        }
    }
    return text;
}

function getWeekKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return toLocalIso(monday);
}

function getMonthKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isCompletedInPeriod(habit, todayComps, yesterdayComps) {
    if (habit.frequency !== 'INTERVAL') {
        return todayComps.length > 0;
    }
    const { start, end } = getCurrentPeriodBounds(habit);
    const allComps = [...(yesterdayComps || []), ...(todayComps || [])];
    return allComps.some(c => {
        if (!c.completedAt) return false;
        const t = new Date(c.completedAt).getTime();
        return t >= start.getTime() && t < end.getTime();
    });
}

function getCurrentPeriodBounds(habit) {
    const now = getTestDate();
    const reminderTime = habit.reminderTime || '00:00';
    const intervalMinutes = habit.intervalMinutes || 240;
    const [rh, rm] = reminderTime.split(':').map(Number);
    const baseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), rh || 0, rm || 0, 0);
    const intervalMs = intervalMinutes * 60 * 1000;
    const diff = now.getTime() - baseTime.getTime();
    const periodIndex = Math.floor(diff / intervalMs);
    const periodStart = new Date(baseTime.getTime() + periodIndex * intervalMs);
    const periodEnd = new Date(periodStart.getTime() + intervalMs);
    return { start: periodStart, end: periodEnd };
}

function countCompletionsInPeriod(habit, todayComps, yesterdayComps) {
    if (habit.frequency !== 'INTERVAL') return 0;
    const { start, end } = getCurrentPeriodBounds(habit);
    const allComps = [...(yesterdayComps || []), ...(todayComps || [])];
    return allComps.filter(c => {
        if (!c.completedAt) return false;
        const t = new Date(c.completedAt).getTime();
        return t >= start.getTime() && t < end.getTime();
    }).length;
}

function calculateStreak(habit, completions) {
    if (!completions || completions.length === 0) return 0;
    const frequency = habit.frequency || 'DAILY';
    if (frequency === 'INTERVAL') {
        // Для интервальных привычек серия = количество выполнений подряд
        // (все выполнения считаются, так как каждое сбрасывает таймер)
        return completions.length;
    }
    const periods = new Set();
    for (const c of completions) {
        if (!c.completedDate) continue;
        if (frequency === 'DAILY') periods.add(c.completedDate);
        else if (frequency === 'WEEKLY') periods.add(getWeekKey(c.completedDate));
        else if (frequency === 'MONTHLY') periods.add(getMonthKey(c.completedDate));
    }
    if (periods.size === 0) return 0;

    if (frequency === 'DAILY') {
        let streak = 0;
        let check = new Date();
        if (!periods.has(toLocalIso(check))) {
            check.setDate(check.getDate() - 1);
        }
        while (periods.has(toLocalIso(check))) {
            streak++;
            check.setDate(check.getDate() - 1);
        }
        return streak;
    } else if (frequency === 'WEEKLY') {
        let streak = 0;
        let check = new Date();
        const day = check.getDay();
        const diff = check.getDate() - day + (day === 0 ? -6 : 1);
        check.setDate(diff);
        if (!periods.has(toLocalIso(check))) {
            check.setDate(check.getDate() - 7);
        }
        while (periods.has(toLocalIso(check))) {
            streak++;
            check.setDate(check.getDate() - 7);
        }
        return streak;
    } else if (frequency === 'MONTHLY') {
        let streak = 0;
        let year = new Date().getFullYear();
        let month = new Date().getMonth() + 1;
        const currentKey = `${year}-${String(month).padStart(2, '0')}`;
        if (!periods.has(currentKey)) {
            month--;
            if (month === 0) { month = 12; year--; }
        }
        while (true) {
            const key = `${year}-${String(month).padStart(2, '0')}`;
            if (periods.has(key)) {
                streak++;
                month--;
                if (month === 0) { month = 12; year--; }
            } else break;
        }
        return streak;
    }
    return 0;
}

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    initSkipDayButton();
    initPushNotifications();
    initReminderPicker();

    // Обработчик переключения архива: снимаем фильтры типов
    const archivedToggle = document.getElementById('filter-archived');
    if (archivedToggle) {
        archivedToggle.addEventListener('change', () => {
            if (archivedToggle.checked) {
                document.getElementById('filter-single').checked = false;
                document.getElementById('filter-multiple').checked = false;
            }
            loadHabits();
        });
    }

    // Проверка токена сброса пароля в URL
    const hash = window.location.hash;
    if (hash.startsWith('#reset-password')) {
        const params = new URLSearchParams(hash.split('?')[1]);
        const resetToken = params.get('token');
        if (resetToken) {
            showResetPassword(resetToken);
        }
    } else if (token) {
        showNav();
        loadHabits();
    }
});

// ============ ПИКЕР ПЛАНИРОВАНИЯ (день/время) ============
function initReminderPicker() {
    const freqSelect = document.getElementById('habit-frequency');
    if (!freqSelect) return;
    freqSelect.addEventListener('change', updateReminderPicker);
    updateReminderPicker();
}

function updateReminderPicker() {
    const freq = document.getElementById('habit-frequency').value;
    const timeInput = document.getElementById('habit-reminder');
    const weeklyPicker = document.getElementById('weekly-picker');
    const monthlyPicker = document.getElementById('monthly-picker');
    const intervalGroup = document.getElementById('interval-group');
    const label = document.getElementById('reminder-label');
    const hidden = document.getElementById('habit-reminder-value');

    timeInput.style.display = 'none';
    weeklyPicker.style.display = 'none';
    monthlyPicker.style.display = 'none';
    intervalGroup.style.display = 'none';

    if (freq === 'DAILY') {
        label.textContent = '⏰ Планируемое время выполнения';
        timeInput.style.display = 'block';
    } else if (freq === 'WEEKLY') {
        label.textContent = '📆 Выберите день и время';
        weeklyPicker.style.display = 'block';
        renderWeekPicker();
    } else if (freq === 'MONTHLY') {
        label.textContent = '📅 Выберите день и время';
        monthlyPicker.style.display = 'block';
        renderMonthCalendar();
    } else if (freq === 'INTERVAL') {
        intervalGroup.style.display = 'flex';
        intervalGroup.style.flexDirection = 'column';
        label.textContent = '⏱️ Начальное время первого выполнения';
        timeInput.style.display = 'block';
    }
}

function renderWeekPicker() {
    const container = document.getElementById('week-days-container');
    if (!container) return;
    container.innerHTML = '';
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const now = getTestDate();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dayNum = d.getDate();
        const dayName = dayNames[d.getDay()];
        const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Пн, 7=Вс
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'week-day-btn';
        btn.dataset.day = dow;
        btn.innerHTML = `<span class="day-num">${dayNum}</span><span class="day-name">${dayName}</span>`;
        btn.onclick = () => selectWeekDay(btn);
        container.appendChild(btn);
    }
}

function selectWeekDay(btn) {
    const container = document.getElementById('week-days-container');
    container.querySelectorAll('.week-day-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('habit-reminder-value').value = btn.dataset.day;
}

function renderMonthCalendar() {
    const grid = document.getElementById('month-calendar-grid');
    if (!grid || grid.children.length > 0) return; // уже отрисован

    const headers = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    headers.forEach(h => {
        const el = document.createElement('div');
        el.className = 'cal-header';
        el.textContent = h;
        grid.appendChild(el);
    });

    const now = getTestDate();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Вс,1=Пн
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day empty';
        grid.appendChild(el);
    }

    const today = now.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const el = document.createElement('div');
        el.className = 'cal-day' + (d === today ? ' today' : '');
        el.textContent = d;
        el.dataset.day = d;
        el.onclick = () => selectMonthDay(el);
        grid.appendChild(el);
    }
}

function selectMonthDay(el) {
    const grid = document.getElementById('month-calendar-grid');
    grid.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('habit-reminder-value').value = el.dataset.day;
}

function resetReminderPicker() {
    const container = document.getElementById('week-days-container');
    if (container) container.innerHTML = '';
    const grid = document.getElementById('month-calendar-grid');
    if (grid) grid.innerHTML = '';
    document.getElementById('habit-reminder-value').value = '';
    updateReminderPicker();
}

// ============ ПИКЕР ДЛЯ РЕДАКТИРОВАНИЯ ============
function updateEditReminderPicker() {
    const freq = document.getElementById('edit-habit-frequency').value;
    const timeInput = document.getElementById('edit-habit-reminder');
    const weeklyPicker = document.getElementById('edit-weekly-picker');
    const monthlyPicker = document.getElementById('edit-monthly-picker');
    const intervalGroup = document.getElementById('edit-interval-group');
    const label = document.getElementById('edit-reminder-label');

    timeInput.style.display = 'none';
    weeklyPicker.style.display = 'none';
    monthlyPicker.style.display = 'none';
    intervalGroup.style.display = 'none';

    if (freq === 'DAILY') {
        label.textContent = '⏰ Планируемое время выполнения';
        timeInput.style.display = 'block';
    } else if (freq === 'WEEKLY') {
        label.textContent = '📆 Выберите день и время';
        weeklyPicker.style.display = 'block';
        renderEditWeekPicker();
    } else if (freq === 'MONTHLY') {
        label.textContent = '📅 Выберите день и время';
        monthlyPicker.style.display = 'block';
        renderEditMonthCalendar();
    } else if (freq === 'INTERVAL') {
        intervalGroup.style.display = 'flex';
        intervalGroup.style.flexDirection = 'column';
        label.textContent = '⏱️ Начальное время первого выполнения';
        timeInput.style.display = 'block';
    }
}

function renderEditWeekPicker() {
    const container = document.getElementById('edit-week-days-container');
    if (!container) return;
    container.innerHTML = '';
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const now = getTestDate();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dayNum = d.getDate();
        const dayName = dayNames[d.getDay()];
        const dow = d.getDay() === 0 ? 7 : d.getDay();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'week-day-btn';
        btn.dataset.day = dow;
        btn.innerHTML = `<span class="day-num">${dayNum}</span><span class="day-name">${dayName}</span>`;
        btn.onclick = () => selectEditWeekDay(btn);
        container.appendChild(btn);
    }
}

function selectEditWeekDay(btn) {
    const container = document.getElementById('edit-week-days-container');
    container.querySelectorAll('.week-day-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('edit-habit-reminder-value').value = btn.dataset.day;
}

function renderEditMonthCalendar() {
    const grid = document.getElementById('edit-month-calendar-grid');
    if (!grid || grid.children.length > 0) return;

    const headers = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    headers.forEach(h => {
        const el = document.createElement('div');
        el.className = 'cal-header';
        el.textContent = h;
        grid.appendChild(el);
    });

    const now = getTestDate();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day empty';
        grid.appendChild(el);
    }

    const today = now.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const el = document.createElement('div');
        el.className = 'cal-day' + (d === today ? ' today' : '');
        el.textContent = d;
        el.dataset.day = d;
        el.onclick = () => selectEditMonthDay(el);
        grid.appendChild(el);
    }
}

function selectEditMonthDay(el) {
    const grid = document.getElementById('edit-month-calendar-grid');
    grid.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('edit-habit-reminder-value').value = el.dataset.day;
}

// ============ ЧАСЫ И КНОПКА ПРОПУСКА ДНЯ ============
function startClock() {
    const update = () => {
        const now = getTestDate();
        document.getElementById('clock-time').textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('clock-date').textContent = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        updateTimers();
    };
    update();
    setInterval(update, 1000);

    // Автообновление списка привычек каждую минуту, чтобы таймеры оставались актуальными
    setInterval(() => {
        if (token && document.getElementById('habits-section').style.display !== 'none') {
            loadHabits(true);
        }
    }, 60000);
}

function initSkipDayButton() {
    const btn = document.getElementById('skip-day-btn');
    const resetBtn = document.getElementById('reset-day-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        testDayOffset++;
        localStorage.setItem('testDayOffset', testDayOffset);
        showNotification(`⏭ Сутки пропущены! Текущая дата: ${toLocalIso(new Date())}`, 'info');
        if (token) loadHabits();
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            testDayOffset = 0;
            localStorage.setItem('testDayOffset', '0');
            showNotification('↺ Дата сброшена к текущей', 'info');
            if (token) loadHabits();
        });
    }
}

// ============ ПУШ-УВЕДОМЛЕНИЯ ============
function initPushNotifications() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
    window._lastCheckedMinuteKey = null;
    setInterval(checkReminders, 1000);
    checkReminders();
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

async function checkReminders() {
    if (!token || Notification.permission !== 'granted') return;
    const now = getTestDate();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const todayStr = toLocalIso(now);
    const minuteKey = `${todayStr}-${nowMinutes}`;

    // Вся логика — ровно один раз в минуту
    if (window._lastCheckedMinuteKey === minuteKey) return;
    window._lastCheckedMinuteKey = minuteKey;

    try {
        const res = await fetch(`${API_URL}/habits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const habits = await res.json();

        const notifyMidnight = window.profileEmailNotifications;
        const notifyHourBefore = window.profileNotifyHourBefore;

        for (const habit of habits) {
            if (habit.archived) continue;
            if (!habit.notificationsEnabled) continue;
            const freq = habit.frequency || 'DAILY';
            const val = habit.reminderTime || '';
            const hour = habit.reminderHour || '00:00';

            // Сегодня ли день напоминания?
            let isToday = false;
            if (freq === 'DAILY' || freq === 'INTERVAL') {
                isToday = true;
            } else if (freq === 'WEEKLY') {
                const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
                isToday = parseInt(val) === dayOfWeek;
            } else if (freq === 'MONTHLY') {
                const day = parseInt(val) || 1;
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                isToday = now.getDate() === day || (day > lastDay && now.getDate() === lastDay);
            }

            // Время привычки в минутах от 00:00
            let targetMinutes = null;
            if (freq === 'DAILY' || freq === 'INTERVAL') {
                targetMinutes = parseTimeToMinutes(val);
            } else if (isToday) {
                targetMinutes = parseTimeToMinutes(hour);
            }

            // 1. Точное уведомление в запланированное время
            if (targetMinutes !== null && targetMinutes === nowMinutes) {
                new Notification('⏰ Напоминание о привычке', {
                    body: `Пора выполнить: «${habit.name}»`,
                    icon: '📊',
                    tag: `habit-exact-${habit.id}-${todayStr}-${nowMinutes}`
                });
            }

            // 2. Уведомление в 00:00
            if (nowMinutes === 0 && notifyMidnight && isToday) {
                new Notification('📅 Напоминания на сегодня', {
                    body: `Сегодня запланировано: «${habit.name}»`,
                    icon: '📅',
                    tag: `habit-midnight-${habit.id}-${todayStr}`
                });
            }

            // 3. Уведомление за час до (только если остался ровно 1 час)
            if (notifyHourBefore && targetMinutes !== null) {
                let diff = targetMinutes - nowMinutes;
                if (diff < 0) diff += 24 * 60;
                if (diff === 60) {
                    new Notification('⏰ Скоро время привычки', {
                        body: `Через час: «${habit.name}»`,
                        icon: '⏳',
                        tag: `habit-1h-${habit.id}-${todayStr}-${nowMinutes}`
                    });
                }
            }
        }
    } catch (e) {
        // игнорируем ошибки проверки
    }
}

// Переключить уведомления для привычки
async function toggleNotifications(habitId, enabled) {
    try {
        const habitRes = await fetch(`${API_URL}/habits/${habitId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!habitRes.ok) throw new Error('Ошибка');
        const habit = await habitRes.json();

        const updated = {
            name: habit.name,
            description: habit.description,
            category: habit.category,
            frequency: habit.frequency,
            habitType: habit.habitType,
            targetCount: habit.targetCount || 1,
            reminderTime: habit.reminderTime,
            notificationsEnabled: enabled
        };

        const response = await fetch(`${API_URL}/habits/${habitId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updated)
        });

        if (!response.ok) throw new Error('Ошибка');

        if (enabled) {
            showNotification('🔔 Уведомления включены', 'success');
        } else {
            showNotification('🔕 Уведомления выключены', 'info');
        }
    } catch (error) {
        showNotification('Ошибка переключения уведомлений', 'error');
    }
}

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
    document.getElementById('profile-section').style.display = section === 'profile' ? 'block' : 'none';

    if (section === 'analytics') {
        document.getElementById('analytics-habit-select').value = '';
        document.getElementById('analytics-content').innerHTML = '';
        loadOverallAnalytics();
        loadHabitsForAnalytics();
    } else if (section === 'profile') {
        loadProfile();
    }
}

function showRegister() {
    document.querySelector('.auth-container').style.display = 'none';
    document.getElementById('register-container').style.display = 'block';
}

function showLogin() {
    document.getElementById('register-container').style.display = 'none';
    document.getElementById('forgot-password-container').style.display = 'none';
    document.getElementById('reset-password-container').style.display = 'none';
    document.querySelector('.auth-container').style.display = 'block';
}

function showForgotPassword() {
    document.querySelector('.auth-container').style.display = 'none';
    document.getElementById('register-container').style.display = 'none';
    document.getElementById('reset-password-container').style.display = 'none';
    document.getElementById('forgot-password-container').style.display = 'block';
}

function showResetPassword(token) {
    document.querySelector('.auth-container').style.display = 'none';
    document.getElementById('register-container').style.display = 'none';
    document.getElementById('forgot-password-container').style.display = 'none';
    document.getElementById('reset-password-container').style.display = 'block';
    document.getElementById('reset-token').value = token;
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('habitTrackerToken');
    document.getElementById('nav').style.display = 'none';
    document.getElementById('habits-section').style.display = 'none';
    document.getElementById('analytics-section').style.display = 'none';
    document.getElementById('profile-section').style.display = 'none';
    document.getElementById('auth-section').style.display = 'block';
    showNotification('Вы вышли из системы', 'info');
}

// ============ ПРОФИЛЬ ============
async function loadProfile() {
    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка');
        const profile = await response.json();

        document.getElementById('profile-username').textContent = profile.username;
        document.getElementById('profile-email-input').value = profile.email || '';
        document.getElementById('profile-email-notifications').checked = profile.emailNotificationsEnabled || false;
        window.profileEmailNotifications = profile.emailNotificationsEnabled || false;
        window.profileEmailVerified = profile.emailVerified || false;
        window._profileEmail = profile.email || '';
        const hourBeforeEl = document.getElementById('profile-notify-hour-before');
        if (hourBeforeEl) hourBeforeEl.checked = profile.notifyHourBefore || false;
        window.profileNotifyHourBefore = profile.notifyHourBefore || false;
        document.getElementById('profile-created').textContent = profile.createdAt
            ? new Date(profile.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
            : '—';
        document.getElementById('profile-habit-count').textContent = profile.habitCount || 0;
        document.getElementById('profile-total-completions').textContent = profile.totalCompletions || 0;

        // Обновляем UI верификации email
        updateEmailVerificationUI(profile.emailVerified, profile.email);

        // Сбрасываем вкладку достижений на DAILY
        currentAchievementTab = 'DAILY';
        document.querySelectorAll('.achievement-tab').forEach(b => b.classList.remove('active'));
        const defaultTab = document.querySelector('.achievement-tab[data-tab="DAILY"]');
        if (defaultTab) defaultTab.classList.add('active');
        await loadAchievements();
    } catch (error) {
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

let currentAchievementTab = 'DAILY';

function switchAchievementTab(frequency, btn) {
    currentAchievementTab = frequency;
    document.querySelectorAll('.achievement-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadAchievements();
}

async function loadAchievements() {
    const container = document.getElementById('profile-achievements');
    if (!container) return;

    if (currentAchievementTab === 'INTERVAL') {
        container.innerHTML = '<div class="empty-state">🏗 Достижения для интервальных привычек скоро появятся</div>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/achievements?frequency=${currentAchievementTab}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка');
        const achievements = await response.json();

        if (achievements.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет достижений</div>';
            return;
        }

        const unlockedCount = achievements.filter(a => a.unlocked).length;
        let html = `<div style="margin-bottom: 12px; font-size: 0.9rem; color: #667eea; font-weight: 600;">🏆 ${unlockedCount} / ${achievements.length} разблокировано</div>`;
        html += '<div class="achievements-grid">';
        for (const a of achievements) {
            const percent = Math.min(100, Math.round(a.progress * 100 / a.threshold));
            const icon = a.unlocked ? '🏅' : '🔒';
            html += `
                <div class="achievement-card ${a.unlocked ? 'unlocked' : ''}">
                    <div class="achievement-icon">${icon}</div>
                    <div class="achievement-name">${a.name}</div>
                    <div class="achievement-desc">${a.description}</div>
                    <div class="achievement-progress"><div class="fill" style="width: ${percent}%"></div></div>
                    <div class="achievement-progress-text">${a.progress} / ${a.threshold}${a.unlocked ? ' ✅' : ''}</div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div style="color: #e74c3c; font-size: 0.9rem;">Ошибка загрузки достижений</div>';
    }
}

function updateEmailVerificationUI(verified, email) {
    const statusEl = document.getElementById('email-verification-status');
    const blockEl = document.getElementById('email-verification-block');
    const notifyCheckbox = document.getElementById('profile-email-notifications');
    const notifyHint = document.getElementById('email-notify-hint');
    const pushDetails = document.getElementById('push-notifications-details');

    if (!email) {
        if (statusEl) statusEl.innerHTML = '<span style="color: #e74c3c;">❌ Email не указан</span>';
        if (blockEl) blockEl.style.display = 'none';
        if (notifyCheckbox) { notifyCheckbox.disabled = true; notifyCheckbox.checked = false; }
        if (pushDetails) pushDetails.style.display = 'none';
        return;
    }

    if (verified) {
        if (statusEl) statusEl.innerHTML = '<span style="color: #27ae60;">✅ Email подтверждён</span>';
        if (blockEl) blockEl.style.display = 'none';
        if (notifyCheckbox) notifyCheckbox.disabled = false;
        if (notifyHint) {
            notifyHint.innerHTML = '📨 Напоминания приходят каждый день в 00:00 (работает только для привычек с интервалом ≥ 24 часа)';
            notifyHint.style.color = '#888';
        }
        if (pushDetails) pushDetails.style.display = notifyCheckbox?.checked ? 'block' : 'none';
    } else {
        if (statusEl) {
            statusEl.innerHTML = '<span style="color: #e74c3c;">⚠️ Email не подтверждён</span> <button class="btn-save" style="padding: 4px 10px; font-size: 0.8rem; margin-left: 8px;" onclick="startEmailVerification()">📩 Подтвердить почту</button>';
        }
        if (blockEl && !window._emailVerificationOpened) blockEl.style.display = 'none';
        if (notifyCheckbox) { notifyCheckbox.disabled = true; notifyCheckbox.checked = false; }
        if (notifyHint) {
            notifyHint.innerHTML = '🔒 Сначала подтвердите email, чтобы включить уведомления';
            notifyHint.style.color = '#e74c3c';
        }
        if (pushDetails) pushDetails.style.display = 'none';
    }
}

async function startEmailVerification() {
    const email = document.getElementById('profile-email-input').value.trim();
    if (!email) {
        showNotification('Сначала укажите и сохраните email', 'error');
        return;
    }
    if (email !== window._profileEmail) {
        showNotification('Сначала сохраните изменения email', 'error');
        return;
    }
    window._emailVerificationOpened = true;
    const blockEl = document.getElementById('email-verification-block');
    if (blockEl) blockEl.style.display = 'block';
    syncResendButtonState();
    await sendVerificationCode();
}

function syncResendButtonState() {
    const btn = document.getElementById('btn-resend-code');
    const timerEl = document.getElementById('verification-timer');
    if (!btn) return;
    const lastSent = window._lastCodeSentAt || 0;
    const elapsed = Date.now() - lastSent;
    if (elapsed < 60000) {
        btn.disabled = true;
        const remaining = Math.ceil((60000 - elapsed) / 1000);
        if (timerEl) timerEl.textContent = `Повторная отправка через ${remaining} сек`;
        setTimeout(() => {
            btn.disabled = false;
            if (timerEl) timerEl.textContent = '';
        }, 60000 - elapsed);
    } else {
        btn.disabled = false;
        if (timerEl) timerEl.textContent = '';
    }
}

function editProfileEmail() {
    const input = document.getElementById('profile-email-input');
    input.removeAttribute('readonly');
    input.focus();
    document.getElementById('btn-edit-email').style.display = 'none';
    document.getElementById('btn-save-email').style.display = 'inline-block';
}

async function saveProfileEmail() {
    const email = document.getElementById('profile-email-input').value.trim();
    if (!email) {
        showNotification('Введите email', 'error');
        return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        showNotification('Введите корректный email', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/me/email`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(extractServerError(text) || 'Ошибка');
        }
        const changed = email !== window._profileEmail;
        const input = document.getElementById('profile-email-input');
        input.setAttribute('readonly', 'true');
        document.getElementById('btn-edit-email').style.display = 'inline-block';
        document.getElementById('btn-save-email').style.display = 'none';
        if (changed) {
            showNotification('Email обновлён! Теперь отправьте код подтверждения.', 'success');
            window.profileEmailVerified = false;
            window._emailVerificationOpened = false;
            window._profileEmail = email;
            updateEmailVerificationUI(false, email);
        } else {
            showNotification('Email сохранён', 'success');
        }
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

async function sendVerificationCode() {
    const now = Date.now();
    const lastSent = window._lastCodeSentAt || 0;
    const cooldown = 60000;
    if (now - lastSent < cooldown) {
        const remaining = Math.ceil((cooldown - (now - lastSent)) / 1000);
        showNotification(`Подождите ${remaining} сек перед повторной отправкой`, 'error');
        return;
    }

    const btn = document.getElementById('btn-resend-code');
    if (btn) btn.disabled = true;
    try {
        const response = await fetch(`${API_URL}/users/me/send-verification-code`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка');
        window._lastCodeSentAt = Date.now();
        showNotification('📩 Код отправлен на ваш email', 'success');
        startVerificationTimer();
    } catch (error) {
        showNotification('Ошибка отправки кода', 'error');
        if (btn) btn.disabled = false;
    }
}

function startVerificationTimer() {
    const timerEl = document.getElementById('verification-timer');
    const btn = document.getElementById('btn-resend-code');
    if (!timerEl) return;
    let seconds = 60;
    if (btn) btn.disabled = true;
    timerEl.textContent = `Повторная отправка через ${seconds} сек`;
    const interval = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
            clearInterval(interval);
            timerEl.textContent = '';
            if (btn) btn.disabled = false;
        } else {
            timerEl.textContent = `Повторная отправка через ${seconds} сек`;
        }
    }, 1000);
}

async function verifyEmailCode() {
    const code = document.getElementById('profile-verification-code').value.trim();
    if (!code || code.length !== 6) {
        showNotification('Введите 6-значный код', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/users/me/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(extractServerError(text) || 'Неверный код');
        }
        showNotification('✅ Email подтверждён!', 'success');
        document.getElementById('profile-verification-code').value = '';
        window.profileEmailVerified = true;
        window._emailVerificationOpened = false;
        updateEmailVerificationUI(true, document.getElementById('profile-email-input').value);
    } catch (error) {
        showNotification('Неверный или просроченный код', 'error');
    }
}

async function saveEmailNotifications(enabled) {
    const pushDetails = document.getElementById('push-notifications-details');
    if (enabled && !window.profileEmailVerified) {
        showNotification('Сначала подтвердите email', 'error');
        document.getElementById('profile-email-notifications').checked = false;
        if (pushDetails) pushDetails.style.display = 'none';
        return;
    }
    try {
        const response = await fetch(`${API_URL}/users/me/email-notifications`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ enabled })
        });

        if (!response.ok) throw new Error('Ошибка');
        window.profileEmailNotifications = enabled;
        if (pushDetails) pushDetails.style.display = enabled ? 'block' : 'none';
        showNotification(enabled ? '📧 Email-уведомления включены' : '📧 Email-уведомления выключены', 'success');
    } catch (error) {
        showNotification('Ошибка сохранения настроек', 'error');
        document.getElementById('profile-email-notifications').checked = !enabled;
        if (pushDetails) pushDetails.style.display = !enabled ? 'none' : 'block';
    }
}

async function savePushNotificationSettings() {
    const notifyHourBefore = document.getElementById('profile-notify-hour-before')?.checked || false;
    window.profileNotifyHourBefore = notifyHourBefore;
    try {
        const response = await fetch(`${API_URL}/users/me/push-notifications`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ notifyAtMidnight: false, notifyHourBefore })
        });
        if (!response.ok) throw new Error('Ошибка');
        showNotification('🔔 Настройки push-уведомлений сохранены', 'success');
    } catch (error) {
        showNotification('Ошибка сохранения настроек push-уведомлений', 'error');
    }
}

async function sendTestEmail() {
    const email = document.getElementById('profile-email-input').value;
    if (!email) {
        showNotification('Сначала укажите email в профиле', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/email-test/send?to=${encodeURIComponent(email)}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const text = await response.text();
        if (response.ok) {
            showNotification('📧 Тестовое письмо отправлено! Проверьте почту', 'success');
        } else {
            showNotification('Ошибка: ' + extractServerError(text), 'error');
        }
    } catch (error) {
        showNotification('Ошибка отправки: ' + error.message, 'error');
    }
}

async function triggerReminders() {
    try {
        const response = await fetch(`${API_URL}/email-test/trigger-reminders`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const text = await response.text();
        if (response.ok) {
            showNotification('🚀 Рассылка запущена! Проверьте логи IDE', 'success');
        } else {
            showNotification('Ошибка: ' + extractServerError(text), 'error');
        }
    } catch (error) {
        showNotification('Ошибка запуска: ' + error.message, 'error');
    }
}

function openResetProfileModal() {
    document.getElementById('reset-profile-modal').style.display = 'flex';
}

function closeResetProfileModal() {
    document.getElementById('reset-profile-modal').style.display = 'none';
    document.getElementById('reset-profile-password').value = '';
}

async function resetProfile() {
    const password = document.getElementById('reset-profile-password').value;
    if (!password) {
        showNotification('Введите пароль', 'error');
        return;
    }

    const confirmed = confirm('⚠️ Вы уверены, что хотите УДАЛИТЬ ВСЁ?\n\nВсе привычки и вся статистика будут безвозвратно удалены. Это действие необратимо.');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/users/me/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            if (response.status === 400) {
                showNotification('Неверный пароль', 'error');
                return;
            }
            throw new Error('Ошибка');
        }

        closeResetProfileModal();
        showNotification('Профиль полностью сброшен', 'success');
        loadHabits();
        loadProfile();
    } catch (error) {
        showNotification('Ошибка сброса профиля', 'error');
    }
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

    if (username.length < 6) {
        showNotification('Имя пользователя должно быть от 6 символов', 'error');
        return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        showNotification('Введите корректный email', 'error');
        return;
    }

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

// Восстановление пароля
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    try {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) throw new Error('Ошибка');
        showNotification('📩 Если email зарегистрирован, письмо отправлено', 'success');
        showLogin();
    } catch (error) {
        showNotification('Ошибка отправки. Попробуйте позже.', 'error');
    }
});

// Сброс пароля по токену
document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tokenReset = document.getElementById('reset-token').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (newPassword !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenReset, newPassword })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(extractServerError(text) || 'Ошибка');
        }
        showNotification('✅ Пароль изменён! Войдите с новым паролем.', 'success');
        showLogin();
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// Смена пароля в профиле
async function changePassword() {
    const current = document.getElementById('profile-current-password').value;
    const newPass = document.getElementById('profile-new-password').value;
    const confirm = document.getElementById('profile-confirm-password').value;

    if (!current || !newPass || !confirm) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    if (newPass !== confirm) {
        showNotification('Новые пароли не совпадают', 'error');
        return;
    }
    if (newPass.length < 6) {
        showNotification('Новый пароль должен быть не менее 6 символов', 'error');
        return;
    }
    if (newPass === current) {
        showNotification('Новый пароль должен отличаться от текущего', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/me/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(extractServerError(text) || 'Ошибка');
        }
        showNotification('🔐 Пароль успешно изменён', 'success');
        document.getElementById('profile-current-password').value = '';
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// Создание привычки
document.getElementById('habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const freq = document.getElementById('habit-frequency').value;
    let reminderValue = null;
    let reminderHourValue = null;
    if (freq === 'DAILY' || freq === 'INTERVAL') {
        reminderValue = document.getElementById('habit-reminder').value || null;
    } else {
        reminderValue = document.getElementById('habit-reminder-value').value || null;
        if (freq === 'WEEKLY') {
            reminderHourValue = document.getElementById('habit-reminder-hour').value || null;
        } else if (freq === 'MONTHLY') {
            reminderHourValue = document.getElementById('habit-reminder-hour-monthly').value || null;
        }
    }

    let intervalMinutes = null;
    if (freq === 'INTERVAL') {
        const hours = parseInt(document.getElementById('habit-interval-hours').value) || 0;
        const minutes = parseInt(document.getElementById('habit-interval-minutes').value) || 0;
        intervalMinutes = hours * 60 + minutes;
        if (intervalMinutes <= 0) intervalMinutes = 240; // default 4 hours
    }

    const habit = {
        name: document.getElementById('habit-name').value,
        description: document.getElementById('habit-description').value,
        category: document.getElementById('habit-category').value,
        frequency: freq,
        habitType: document.getElementById('habit-type').value,
        targetCount: 1,
        reminderTime: reminderValue,
        reminderHour: reminderHourValue,
        intervalMinutes: intervalMinutes,
        notificationsEnabled: false
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
        resetReminderPicker();
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

    if (isMultiple && !filterMultiple) return;
    if (!isMultiple && !filterSingle) return;

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const card = document.createElement('div');
    card.className = 'habit-card' + (isMultiple ? ' multiple' : '');
    card.id = `habit-card-${habit.id}`;
    card.style.opacity = '0';
    card.style.transform = 'translateY(-15px)';
    card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';

    const targetPart = (habit.targetCount && habit.targetCount > 0) ? ` / ${habit.targetCount} раз` : ' раз';
    const notifChecked = habit.notificationsEnabled ? 'checked' : '';
    const notifActive = habit.notificationsEnabled ? 'active' : '';
    const reminderLabel = formatReminderLabel(habit);

    let extraHtml = '';
    if (isMultiple) {
        extraHtml = `
            <div class="today-completions">
                <h5>🔥 Сегодня выполнено: 0${targetPart}</h5>
                <div id="completions-info-${habit.id}"></div>
            </div>
        `;
    } else {
        extraHtml = `<div id="single-completion-${habit.id}" class="completion-time-single"></div>`;
    }

    const streakLabel = !isMultiple ? getStreakLabel(habit.frequency) : '';
    const isIntervalNew = habit.frequency === 'INTERVAL';
    const statsHtml = isMultiple
        ? `<div class="stats-row">
            <div class="stat"><div class="value">0</div><div class="label">Всего</div></div>
            <div class="stat"><div class="value" id="stat-today-${habit.id}">0</div><div class="label">Сегодня</div></div>
            ${isIntervalNew ? `<div class="stat"><div class="value" id="stat-period-${habit.id}">0</div><div class="label">За период</div></div>` : ''}
            <div class="stat"><div class="value" id="stat-yesterday-${habit.id}">0</div><div class="label">Вчера</div></div>
           </div>`
        : `<div class="stats-row"><div class="stat"><div class="value">0</div><div class="label">Всего</div></div><div class="stat"><div class="value">0</div><div class="label">${streakLabel}</div></div></div>`;

    card.innerHTML = `
        <span class="category">${getCategoryName(habit.category)} ${isMultiple ? '🔁' : '☑️'}</span>
        <h4>
            <span class="checkmark">✓</span>
            ${habit.name}
            ${!isMultiple ? '<span class="status-badge">⏳ Не выполнено</span>' : ''}
        </h4>
        <p>${habit.description || 'Нет описания'}</p>
        <p>📅 ${getFrequencyName(habit.frequency)} · ${reminderLabel}</p>
        ${statsHtml}
        ${extraHtml}
        <div class="actions">
            <button class="complete ${isMultiple ? 'add-completion' : ''}" onclick="handleComplete(${habit.id}, ${isMultiple}, event)">
                ${isMultiple ? '➕ Добавить выполнение' : '✓ Выполнено'}
            </button>
            <button class="edit" onclick="openEditModal(${habit.id})">✏️ Редактировать</button>
            <button class="edit" onclick="archiveHabit(${habit.id})">📦 Архивировать</button>
            <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
        </div>
        <label class="notification-toggle ${notifActive}">
            <input type="checkbox" ${notifChecked} onchange="toggleNotifications(${habit.id}, this.checked)">
            <span>🔔 ${habit.notificationsEnabled ? 'Уведомления вкл' : 'Уведомления выкл'}</span>
        </label>
    `;

    container.insertBefore(card, container.firstChild);

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
    }
    const currentHeight = container.offsetHeight;
    if (currentHeight > 0) {
        container.style.minHeight = currentHeight + 'px';
    }
    if (!preserveScroll) {
        container.innerHTML = '<div class="loading">Загрузка...</div>';
    }

        const filterSingle = document.getElementById('filter-single').checked;
        const filterMultiple = document.getElementById('filter-multiple').checked;
        const filterUpcoming = document.getElementById('filter-upcoming').checked;
        const showArchived = document.getElementById('filter-archived').checked;

        // В архиве показываем все типы подряд
        const effectiveFilterSingle = showArchived ? true : filterSingle;
        const effectiveFilterMultiple = showArchived ? true : filterMultiple;

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
                document.getElementById('analytics-section').style.display = 'none';
                document.getElementById('profile-section').style.display = 'none';
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

        // Фильтрация по архиву и типу
        habits = habits.filter(h => {
            const isArchived = !!h.archived;
            if (isArchived !== showArchived) return false;
            if (h.habitType === 'SINGLE' && effectiveFilterSingle) return true;
            if (h.habitType === 'MULTIPLE' && effectiveFilterMultiple) return true;
            return false;
        });

        // Фильтр "Ближайшие" — только невыполненные, отсортированные по времени
        if (filterUpcoming && !showArchived) {
            habits = habits.filter(h => {
                if (h.habitType === 'SINGLE') return !h.completedToday;
                if (h.habitType === 'MULTIPLE') return (h.todayCompletions || 0) < (h.targetCount || 1);
                return true;
            });
            habits.sort((a, b) => getUpcomingScore(a) - getUpcomingScore(b));
        } else if (effectiveFilterSingle && effectiveFilterMultiple) {
            // Сначала SINGLE, потом MULTIPLE (или наоборот — давайте сначала SINGLE)
            habits.sort((a, b) => {
                if (a.habitType !== b.habitType) {
                    return a.habitType === 'SINGLE' ? -1 : 1;
                }
                return (b.totalCompletions || 0) - (a.totalCompletions || 0);
            });
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
            const isArchived = !!habit.archived;
            // Не используем habit.completedToday / habit.todayCompletions — вычислим на фронтенде
            card.className = 'habit-card' + (isMultiple ? ' multiple' : '') + (isArchived ? ' archived' : '');
            card.id = `habit-card-${habit.id}`;

            const targetPart = (habit.targetCount && habit.targetCount > 0) ? ` / ${habit.targetCount} раз` : ' раз';
            const notifChecked = habit.notificationsEnabled ? 'checked' : '';
            const notifActive = habit.notificationsEnabled ? 'active' : '';
            const reminderLabel = formatReminderLabel(habit);

            let extraHtml = '';
            if (isMultiple) {
                extraHtml = `
                    <div class="today-completions">
                        <h5 id="today-title-${habit.id}">🔥 Сегодня выполнено: —${targetPart}</h5>
                        <div id="completions-info-${habit.id}"><span class="loading">Загрузка...</span></div>
                    </div>
                `;
            } else {
                extraHtml = `<div id="single-completion-${habit.id}" class="completion-time-single"></div>`;
            }

            const streakLabel = !isMultiple ? getStreakLabel(habit.frequency) : '';
            // Для многоразовых — три цифры: Всего / Сегодня / Вчера
            // Для INTERVAL — четыре: Всего / Сегодня / За период / Вчера
            const isInterval = habit.frequency === 'INTERVAL';
            const statsHtml = isMultiple
                ? `<div class="stats-row">
                    <div class="stat"><div class="value">${habit.totalCompletions || 0}</div><div class="label">Всего</div></div>
                    <div class="stat"><div class="value" id="stat-today-${habit.id}">—</div><div class="label">Сегодня</div></div>
                    ${isInterval ? `<div class="stat"><div class="value" id="stat-period-${habit.id}">—</div><div class="label">За период</div></div>` : ''}
                    <div class="stat"><div class="value" id="stat-yesterday-${habit.id}">—</div><div class="label">Вчера</div></div>
                   </div>`
                : `<div class="stats-row">
                    <div class="stat"><div class="value">${habit.totalCompletions || 0}</div><div class="label">Всего</div></div>
                    <div class="stat"><div class="value" id="streak-${habit.id}">—</div><div class="label">${streakLabel}</div></div>
                   </div>`;

            card.innerHTML = `
                ${habit.archived ? `<div class="archived-name">${habit.name}</div><div class="archived-overlay"><span>⏸ Приостановлено</span></div>` : ''}
                <span class="category">${getCategoryName(habit.category)} ${isMultiple ? '🔁' : '☑️'}</span>
                <h4>
                    <span class="checkmark">✓</span>
                    ${habit.archived ? '⏸ Приостановлено' : habit.name}
                    <span class="status-badge" id="status-${habit.id}">⏳ Не выполнено</span>
                </h4>
                <p>${habit.description || 'Нет описания'}</p>
                <p>📅 ${getFrequencyName(habit.frequency)} · ${reminderLabel}</p>
                ${statsHtml}
                ${extraHtml}
                ${!habit.archived ? `
                <div class="actions">
                    <button class="complete ${isMultiple ? 'add-completion' : ''}" id="btn-complete-${habit.id}" onclick="handleComplete(${habit.id}, ${isMultiple}, event)">
                        ${isMultiple ? '➕ Добавить выполнение' : '✓ Выполнено'}
                    </button>
                    <button class="edit" onclick="openEditModal(${habit.id})">✏️ Редактировать</button>
                    <button class="edit" onclick="archiveHabit(${habit.id})">📦 Архивировать</button>
                    <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
                </div>
                <label class="notification-toggle ${notifActive}">
                    <input type="checkbox" ${notifChecked} onchange="toggleNotifications(${habit.id}, this.checked)">
                    <span>🔔 ${habit.notificationsEnabled ? 'Уведомления вкл' : 'Уведомления выкл'}</span>
                </label>
                ` : `
                <div class="actions" style="justify-content: center; margin-top: 10px;">
                    <button class="edit" onclick="unarchiveHabit(${habit.id})">📤 Достать из архива</button>
                </div>
                `}
            `;
            container.appendChild(card);
            habitsNeedingData.push(habit);
        }

        const today = toLocalIso(new Date());
        const yearStart = toLocalIso(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

        // Параллельная загрузка выполнений для всех видимых привычек
        await Promise.all(habitsNeedingData.map(async (habit) => {
            if (habit.archived) return; // архивные не обновляем динамически
            const isMultiple = habit.habitType === 'MULTIPLE';
            const [todayComps, yesterdayComps] = await Promise.all([
                fetchTodayCompletions(habit.id),
                isMultiple ? fetchYesterdayCompletions(habit.id) : Promise.resolve([])
            ]);

            // Для SINGLE загружаем выполнения за год для подсчёта серии
            let yearComps = [];
            if (!isMultiple) {
                yearComps = await fetchCompletions(habit.id, yearStart, today);
            }

            const isIntervalSingle = !isMultiple && habit.frequency === 'INTERVAL';
            const completedToday = isIntervalSingle
                ? isCompletedInPeriod(habit, todayComps, yesterdayComps)
                : (!isMultiple && todayComps.length > 0);
            const todayCount = todayComps.length;
            const streak = !isMultiple ? calculateStreak(habit, yearComps) : 0;

            // Обновляем карточку
            const card = document.getElementById(`habit-card-${habit.id}`);
            if (card) {
                if (completedToday) card.classList.add('completed');
                else card.classList.remove('completed');
            }

            // Статус-бейдж для single
            const statusBadge = document.getElementById(`status-${habit.id}`);
            if (statusBadge) {
                if (isMultiple) {
                    statusBadge.style.display = 'none';
                } else {
                    statusBadge.textContent = completedToday ? '✓ Выполнено' : '⏳ Не выполнено';
                    statusBadge.style.background = completedToday ? '#27ae60' : '#e74c3c';
                }
            }

            // Кнопка выполнения для single
            const btnComplete = document.getElementById(`btn-complete-${habit.id}`);
            if (btnComplete && !isMultiple) {
                btnComplete.textContent = completedToday ? '↩ Отменить' : '✓ Выполнено';
            }

            // Статистика для multiple / single
            if (isMultiple) {
                const statToday = document.getElementById(`stat-today-${habit.id}`);
                const statYesterday = document.getElementById(`stat-yesterday-${habit.id}`);
                if (statToday) statToday.textContent = todayCount;
                if (statYesterday) statYesterday.textContent = yesterdayComps.length;

                const statPeriod = document.getElementById(`stat-period-${habit.id}`);
                if (statPeriod) {
                    const periodCount = countCompletionsInPeriod(habit, todayComps, yesterdayComps);
                    statPeriod.textContent = periodCount;
                }

                const title = document.getElementById(`today-title-${habit.id}`);
                if (title) {
                    const targetPart = (habit.targetCount && habit.targetCount > 0) ? ` / ${habit.targetCount} раз` : ' раз';
                    title.textContent = `🔥 Сегодня выполнено: ${todayCount}${targetPart}`;
                }
            } else {
                const streakEl = document.getElementById(`streak-${habit.id}`);
                if (streakEl) streakEl.textContent = streak;
            }

            // Заполняем список выполнений
            if (isMultiple) {
                const div = document.getElementById(`completions-info-${habit.id}`);
                if (!div) return;

                if (todayComps.length === 0) {
                    div.innerHTML = '';
                    return;
                }

                todayComps.sort((a, b) => {
                    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                    return tb - ta;
                });

                const last = todayComps[0];
                const lastTime = formatTime(last.completedAt);
                const rest = todayComps.slice(1);

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

                const todayComp = todayComps.find(c => c.completed);
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
        container.style.minHeight = '';
        if (preserveScroll) {
            window.scrollTo(0, scrollY);
        }
    }
}

// Загрузка выполнений за конкретную дату
async function fetchCompletionsForDate(habitId, dateIso) {
    try {
        const response = await fetch(`${API_URL}/completions/habit/${habitId}?start=${dateIso}&end=${dateIso}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return [];
        const completions = await response.json();
        return completions
            .map(c => ({ ...c, completedDate: normalizeDate(c.completedDate) }))
            .filter(c => c.completedDate === dateIso && c.completed);
    } catch (error) {
        return [];
    }
}

// Загрузка сегодняшних выполнений (сырые данные)
async function fetchTodayCompletions(habitId) {
    const today = toLocalIso(new Date());
    return fetchCompletionsForDate(habitId, today);
}

// Загрузка вчерашних выполнений
async function fetchYesterdayCompletions(habitId) {
    const yesterday = toLocalIso(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return fetchCompletionsForDate(habitId, yesterday);
}

// Загрузка всех выполнений за период
async function fetchCompletions(habitId, start, end) {
    try {
        const response = await fetch(`${API_URL}/completions/habit/${habitId}?start=${start}&end=${end}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return [];
        const completions = await response.json();
        return completions
            .map(c => ({ ...c, completedDate: normalizeDate(c.completedDate) }))
            .filter(c => c.completed);
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
// Инициализация обработчика частоты в модалке
function initEditFrequencyHandler() {
    const sel = document.getElementById('edit-habit-frequency');
    if (sel) sel.addEventListener('change', updateEditReminderPicker);
}
document.addEventListener('DOMContentLoaded', initEditFrequencyHandler);

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
        document.getElementById('edit-habit-category').value = getCategoryName(habit.category || 'OTHER');
        document.getElementById('edit-habit-frequency').value = habit.frequency || 'DAILY';
        document.getElementById('edit-habit-notifications').checked = !!habit.notificationsEnabled;
        const intervalMins = habit.intervalMinutes || 240;
        document.getElementById('edit-habit-interval-hours').value = Math.floor(intervalMins / 60);
        document.getElementById('edit-habit-interval-minutes').value = intervalMins % 60;

        // Установка пикера в зависимости от частоты
        updateEditReminderPicker();
        const freq = habit.frequency || 'DAILY';
        const val = habit.reminderTime || '';
        const hourVal = habit.reminderHour || '';
        if (freq === 'DAILY') {
            document.getElementById('edit-habit-reminder').value = val;
            document.getElementById('edit-habit-reminder-value').value = val;
        } else if (freq === 'WEEKLY') {
            const day = parseInt(val) || 1;
            renderEditWeekPicker();
            const btn = document.querySelector(`#edit-week-days-container .week-day-btn[data-day="${day}"]`);
            if (btn) selectEditWeekDay(btn);
            document.getElementById('edit-habit-reminder-value').value = String(day);
            document.getElementById('edit-habit-reminder-hour').value = hourVal;
        } else if (freq === 'MONTHLY') {
            const day = parseInt(val) || 1;
            renderEditMonthCalendar();
            const cell = document.querySelector(`#edit-month-calendar-grid .cal-day[data-day="${day}"]`);
            if (cell) selectEditMonthDay(cell);
            document.getElementById('edit-habit-reminder-value').value = String(day);
            document.getElementById('edit-habit-reminder-hour-monthly').value = hourVal;
        }

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
    // сброс пикеров редактирования
    const editWeekly = document.getElementById('edit-week-days-container');
    const editMonthly = document.getElementById('edit-month-calendar-grid');
    if (editWeekly) editWeekly.innerHTML = '';
    if (editMonthly) editMonthly.innerHTML = '';
    document.getElementById('edit-habit-reminder-value').value = '';
}

async function resetHabitStats() {
    const habitId = document.getElementById('edit-habit-id').value;
    if (!habitId) return;

    const firstConfirm = confirm('⚠️ Вы уверены, что хотите сбросить ВСЮ статистику для этой привычки?\n\nВсе выполнения будут безвозвратно удалены. Сама привычка останется.');
    if (!firstConfirm) return;

    const secondConfirm = confirm('🔴 ЭТО ДЕЙСТВИЕ НЕОБРАТИМО!\n\nУдалить все выполнения привычки?');
    if (!secondConfirm) return;

    try {
        const response = await fetch(`${API_URL}/completions/habit/${habitId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка');

        showNotification('📊 Статистика сброшена', 'success');
        closeEditModal();
        await refreshHabitCard(habitId);
    } catch (error) {
        showNotification('Ошибка сброса статистики', 'error');
    }
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

        const editFreq = document.getElementById('edit-habit-frequency').value;
        let editReminder = null;
        let editReminderHour = null;
        if (editFreq === 'DAILY' || editFreq === 'INTERVAL') {
            editReminder = document.getElementById('edit-habit-reminder').value || null;
        } else {
            editReminder = document.getElementById('edit-habit-reminder-value').value || null;
            if (editFreq === 'WEEKLY') {
                editReminderHour = document.getElementById('edit-habit-reminder-hour').value || null;
            } else if (editFreq === 'MONTHLY') {
                editReminderHour = document.getElementById('edit-habit-reminder-hour-monthly').value || null;
            }
        }
        let editInterval = null;
        if (editFreq === 'INTERVAL') {
            const editHours = parseInt(document.getElementById('edit-habit-interval-hours').value) || 0;
            const editMins = parseInt(document.getElementById('edit-habit-interval-minutes').value) || 0;
            editInterval = editHours * 60 + editMins;
            if (editInterval <= 0) editInterval = 240;
        }

        const updated = {
            name,
            description,
            category: document.getElementById('edit-habit-category').value,
            frequency: editFreq,
            habitType: habit.habitType,
            targetCount: habit.habitType === 'MULTIPLE' ? targetCount : (habit.targetCount || 1),
            reminderTime: editReminder,
            reminderHour: editReminderHour,
            intervalMinutes: editInterval,
            notificationsEnabled: document.getElementById('edit-habit-notifications').checked
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
        const today = toLocalIso(new Date());
        const yearStart = toLocalIso(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

        const [habitRes, todayComps, yesterdayComps] = await Promise.all([
            fetch(`${API_URL}/habits/${habitId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetchTodayCompletions(habitId),
            fetchYesterdayCompletions(habitId)
        ]);

        if (!habitRes.ok) throw new Error('Ошибка');
        const habit = await habitRes.json();
        const isMultiple = habit.habitType === 'MULTIPLE';
        const isIntervalSingle = !isMultiple && habit.frequency === 'INTERVAL';
        const completedToday = isIntervalSingle
            ? isCompletedInPeriod(habit, todayComps, yesterdayComps)
            : (!isMultiple && todayComps.length > 0);
        const todayCount = todayComps.length;

        let streak = 0;
        if (!isMultiple) {
            const yearComps = await fetchCompletions(habitId, yearStart, today);
            streak = calculateStreak(habit, yearComps);
        }

        // Собираем новый HTML карточки
        let extraHtml = '';
        const targetPart = (habit.targetCount && habit.targetCount > 0) ? ` / ${habit.targetCount} раз` : ' раз';
        const notifChecked = habit.notificationsEnabled ? 'checked' : '';
        const notifActive = habit.notificationsEnabled ? 'active' : '';
        const reminderLabel = formatReminderLabel(habit);

        if (isMultiple) {
            extraHtml = `
                <div class="today-completions">
                    <h5>🔥 Сегодня выполнено: ${todayCount}${targetPart}</h5>
                    <div id="completions-info-${habit.id}"><span class="loading">Загрузка...</span></div>
                </div>
            `;
        } else {
            extraHtml = `<div id="single-completion-${habit.id}" class="completion-time-single"></div>`;
        }

        const streakLabel = !isMultiple ? getStreakLabel(habit.frequency) : '';
        const isIntervalRefresh = habit.frequency === 'INTERVAL';
        const periodCountRefresh = isIntervalRefresh ? countCompletionsInPeriod(habit, todayComps, yesterdayComps) : 0;
        const statsHtml = isMultiple
            ? `<div class="stats-row">
                <div class="stat"><div class="value">${habit.totalCompletions || 0}</div><div class="label">Всего</div></div>
                <div class="stat"><div class="value">${todayCount}</div><div class="label">Сегодня</div></div>
                ${isIntervalRefresh ? `<div class="stat"><div class="value">${periodCountRefresh}</div><div class="label">За период</div></div>` : ''}
                <div class="stat"><div class="value">${yesterdayComps.length}</div><div class="label">Вчера</div></div>
               </div>`
            : `<div class="stats-row">
                <div class="stat"><div class="value">${habit.totalCompletions || 0}</div><div class="label">Всего</div></div>
                <div class="stat"><div class="value">${streak}</div><div class="label">${streakLabel}</div></div>
               </div>`;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="habit-card${completedToday ? ' completed' : ''}${isMultiple ? ' multiple' : ''}${habit.archived ? ' archived' : ''}" id="habit-card-${habit.id}">
                ${habit.archived ? `<div class="archived-name">${habit.name}</div><div class="archived-overlay"><span>⏸ Приостановлено</span></div>` : ''}
                <span class="category">${getCategoryName(habit.category)} ${isMultiple ? '🔁' : '☑️'}</span>
                <h4>
                    <span class="checkmark">✓</span>
                    ${habit.archived ? '⏸ Приостановлено' : habit.name}
                    ${!isMultiple && completedToday ? '<span class="status-badge">✓ Выполнено</span>' : ''}
                    ${!isMultiple && !completedToday ? '<span class="status-badge">⏳ Не выполнено</span>' : ''}
                </h4>
                <p>${habit.description || 'Нет описания'}</p>
                <p>📅 ${getFrequencyName(habit.frequency)} · ${reminderLabel}</p>
                ${statsHtml}
                ${extraHtml}
                ${!habit.archived ? `
                <div class="actions">
                    <button class="complete ${isMultiple ? 'add-completion' : ''}" onclick="handleComplete(${habit.id}, ${isMultiple}, event)">
                        ${isMultiple ? '➕ Добавить выполнение' : (completedToday ? '↩ Отменить' : '✓ Выполнено')}
                    </button>
                    <button class="edit" onclick="openEditModal(${habit.id})">✏️ Редактировать</button>
                    <button class="edit" onclick="archiveHabit(${habit.id})">📦 Архивировать</button>
                    <button class="delete" onclick="deleteHabit(${habit.id})">🗑 Удалить</button>
                </div>
                <label class="notification-toggle ${notifActive}">
                    <input type="checkbox" ${notifChecked} onchange="toggleNotifications(${habit.id}, this.checked)">
                    <span>🔔 ${habit.notificationsEnabled ? 'Уведомления вкл' : 'Уведомления выкл'}</span>
                </label>
                ` : `
                <div class="actions" style="justify-content: center; margin-top: 10px;">
                    <button class="edit" onclick="unarchiveHabit(${habit.id})">📤 Достать из архива</button>
                </div>
                `}
            </div>
        `;
        const newCard = wrapper.firstElementChild;

        // Заменяем старую карточку на новую
        oldCard.replaceWith(newCard);

        // Заполняем данные выполнений
        if (isMultiple) {
            const div = document.getElementById(`completions-info-${habit.id}`);
            if (!div) return;

            if (todayComps.length === 0) {
                div.innerHTML = '';
                return;
            }

            todayComps.sort((a, b) => {
                const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return tb - ta;
            });

            const last = todayComps[0];
            const lastTime = formatTime(last.completedAt);
            const rest = todayComps.slice(1);

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
                const todayComp = todayComps.find(c => c.completed);
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

// Архивирование привычки
async function archiveHabit(habitId) {
    try {
        const response = await fetch(`${API_URL}/habits/${habitId}/archive`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка');
        showNotification('Привычка архивирована', 'info');
        await loadHabits(true);
    } catch (error) {
        showNotification('Ошибка архивирования', 'error');
    }
}

// Разархивирование привычки
async function unarchiveHabit(habitId) {
    try {
        const response = await fetch(`${API_URL}/habits/${habitId}/unarchive`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка');
        showNotification('Привычка восстановлена из архива', 'success');
        await loadHabits(true);
    } catch (error) {
        showNotification('Ошибка разархивирования', 'error');
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
    if (!category) return '📌 Другое';
    // Если категория уже содержит эмодзи, возвращаем как есть
    if (category.startsWith('🏃') || category.startsWith('📚') || category.startsWith('📖') ||
        category.startsWith('💪') || category.startsWith('📌')) {
        return category;
    }
    // Маппинг старых значений
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
        'MONTHLY': 'Каждый месяц',
        'INTERVAL': 'Каждый период'
    };
    return names[freq] || freq;
}

function getStreakLabel(freq) {
    const names = {
        'DAILY': 'Дней подряд',
        'WEEKLY': 'Недель подряд',
        'MONTHLY': 'Месяцев подряд',
        'INTERVAL': 'Выполнений'
    };
    return names[freq] || 'Серия';
}

// Чем меньше score, тем ближе привычка по времени
function getUpcomingScore(habit) {
    const now = getTestDate();
    const freq = habit.frequency || 'DAILY';
    const val = habit.reminderTime || '';
    const hour = habit.reminderHour || '00:00';
    const [rh, rm] = hour.split(':').map(Number);
    const reminderMinutes = (rh || 0) * 60 + (rm || 0);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    if (freq === 'DAILY' || freq === 'INTERVAL') {
        if (!val) return Infinity;
        const [h, m] = val.split(':').map(Number);
        const rMin = (h || 0) * 60 + (m || 0);
        let diff = rMin - nowMinutes;
        if (diff < 0) diff += 24 * 60;
        return diff;
    }
    if (freq === 'WEEKLY') {
        const day = parseInt(val) || 1;
        const today = now.getDay() === 0 ? 7 : now.getDay();
        let daysDiff = day - today;
        if (daysDiff < 0) daysDiff += 7;
        let totalMin = daysDiff * 24 * 60 + (reminderMinutes - nowMinutes);
        if (totalMin < 0) totalMin += 24 * 60;
        return totalMin;
    }
    if (freq === 'MONTHLY') {
        const day = parseInt(val) || 1;
        const today = now.getDate();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const targetDay = Math.min(day, lastDay);
        let daysDiff = targetDay - today;
        if (daysDiff < 0) daysDiff += lastDay;
        let totalMin = daysDiff * 24 * 60 + (reminderMinutes - nowMinutes);
        if (totalMin < 0) totalMin += 24 * 60;
        return totalMin;
    }
    return Infinity;
}

function formatReminderLabel(habit) {
    const freq = habit.frequency || 'DAILY';
    const val = habit.reminderTime || '';
    const hour = habit.reminderHour || '';
    const timeSuffix = hour ? ` в ${hour}` : '';

    function wrapTimer(timer) {
        if (!timer) return '';
        const safeVal = (val || '').replace(/"/g, '&quot;');
        const safeHour = (hour || '').replace(/"/g, '&quot;');
        return ` · <span class="habit-timer" data-freq="${freq}" data-val="${safeVal}" data-hour="${safeHour}" data-interval="${habit.intervalMinutes || ''}">${timer}</span>`;
    }

    if (freq === 'DAILY') {
        const timer = getTimeUntil(freq, val, null, null);
        return val ? `⏰ ${val}${wrapTimer(timer)}` : 'Без времени';
    }
    if (freq === 'WEEKLY') {
        const dayData = {
            1: { name: 'понедельник', prefix: 'Каждый' },
            2: { name: 'вторник', prefix: 'Каждый' },
            3: { name: 'среду', prefix: 'Каждую' },
            4: { name: 'четверг', prefix: 'Каждый' },
            5: { name: 'пятницу', prefix: 'Каждую' },
            6: { name: 'субботу', prefix: 'Каждую' },
            7: { name: 'воскресенье', prefix: 'Каждое' }
        };
        const day = parseInt(val) || 1;
        const data = dayData[day] || dayData[1];
        const timer = getTimeUntil(freq, val, hour, null);
        return `📅 ${data.prefix} ${data.name}${timeSuffix}${wrapTimer(timer)}`;
    }
    if (freq === 'MONTHLY') {
        const day = parseInt(val) || 1;
        const base = day >= 29 ? `📅 Каждый месяц (${day}-е или последний день)` : `📅 Каждое ${day}-е число`;
        const timer = getTimeUntil(freq, val, hour, null);
        return `${base}${timeSuffix}${wrapTimer(timer)}`;
    }
    if (freq === 'INTERVAL') {
        const totalMinutes = habit.intervalMinutes || 240;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const start = val || '--:--';
        const timer = getTimeUntil(freq, val, val, totalMinutes);
        let intervalText;
        if (hours > 0 && minutes > 0) {
            intervalText = `${hours} ч ${minutes} м`;
        } else if (hours > 0) {
            intervalText = `${hours} ч`;
        } else {
            intervalText = `${minutes} м`;
        }
        return `⏱️ Каждые ${intervalText} (с ${start})${wrapTimer(timer)}`;
    }
    return '';
}

function getTimeUntil(freq, val, hour, intervalMinutes) {
    const now = getTestDate();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    if (freq === 'DAILY') {
        if (!val) return '';
        const [h, m] = val.split(':').map(Number);
        const reminderMinutes = (h || 0) * 60 + (m || 0);
        let diff = reminderMinutes - nowMinutes;
        if (diff < 0) diff += 24 * 60;
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hrs > 0) return `через ${hrs}ч ${mins}м`;
        return `через ${mins}м`;
    }

    if (freq === 'INTERVAL') {
        const interval = intervalMinutes || 240;
        if (!hour) return '';
        const [h, m] = hour.split(':').map(Number);
        const startMinutes = (h || 0) * 60 + (m || 0);
        const elapsed = nowMinutes - startMinutes;
        let diff;
        if (elapsed < 0) {
            diff = -elapsed;
        } else {
            diff = interval - (elapsed % interval);
        }
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hrs > 0) return `через ${hrs}ч ${mins}м`;
        return `через ${mins}м`;
    }

    if (!hour) return '';
    const [h, m] = hour.split(':').map(Number);
    const reminderMinutes = (h || 0) * 60 + (m || 0);
    let days = 0;

    if (freq === 'WEEKLY') {
        const day = parseInt(val) || 1;
        const today = now.getDay() === 0 ? 7 : now.getDay();
        days = day - today;
        if (days < 0) days += 7;
    } else if (freq === 'MONTHLY') {
        const day = parseInt(val) || 1;
        const today = now.getDate();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const targetDay = Math.min(day, lastDay);
        days = targetDay - today;
        if (days < 0) days += lastDay;
    } else {
        return '';
    }

    let totalMinutes = days * 24 * 60 + (reminderMinutes - nowMinutes);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const d = Math.floor(totalMinutes / (24 * 60));
    const hrs = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    if (d > 0) return `через ${d}д ${hrs}ч`;
    if (hrs > 0) return `через ${hrs}ч ${mins}м`;
    return `через ${mins}м`;
}

function updateTimers() {
    document.querySelectorAll('.habit-timer').forEach(span => {
        const freq = span.dataset.freq;
        const val = span.dataset.val;
        let hour = span.dataset.hour;
        const interval = span.dataset.interval;
        // Для INTERVAL время хранится в reminderTime (val), reminderHour пустой
        if (freq === 'INTERVAL') {
            hour = val;
        }
        const timer = getTimeUntil(freq, val, hour, interval ? parseInt(interval) : null);
        if (timer) {
            span.textContent = timer;
        }
    });
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
        let maxStreakDays = 0;
        let maxStreakDaysHabit = '';
        let maxStreakWeeks = 0;
        let maxStreakWeeksHabit = '';
        let maxStreakMonths = 0;
        let maxStreakMonthsHabit = '';
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
                    if (analytics.longestStreak > maxStreakDays) {
                        maxStreakDays = analytics.longestStreak;
                        maxStreakDaysHabit = habit.name;
                    }
                    if (analytics.longestStreakWeeks > maxStreakWeeks) {
                        maxStreakWeeks = analytics.longestStreakWeeks;
                        maxStreakWeeksHabit = habit.name;
                    }
                    if (analytics.longestStreakMonths > maxStreakMonths) {
                        maxStreakMonths = analytics.longestStreakMonths;
                        maxStreakMonthsHabit = habit.name;
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
                        <div class="value">${maxStreakDays}</div>
                        <div class="label">🏆 Лучшая серия по дням (${maxStreakDaysHabit || '—'})</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${maxStreakWeeks}</div>
                        <div class="label">🏆 Лучшая серия по неделям (${maxStreakWeeksHabit || '—'})</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${maxStreakMonths}</div>
                        <div class="label">🏆 Лучшая серия по месяцам (${maxStreakMonthsHabit || '—'})</div>
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
                        <div class="value category-value">${getCategoryName(topCategory).replace(/^\S+\s/, '')}</div>
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
        const chartStartDate = toLocalIso(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
        const historyStartDate = toLocalIso(new Date(Date.now() - 364 * 24 * 60 * 60 * 1000));

        const [analyticsRes, chartCompletionsRes, historyCompletionsRes, habitRes] = await Promise.all([
            fetch(`${API_URL}/analytics/habit/${habitId}?start=${chartStartDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/completions/habit/${habitId}?start=${chartStartDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/completions/habit/${habitId}?start=${historyStartDate}&end=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/habits/${habitId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!analyticsRes.ok) throw new Error('Ошибка загрузки аналитики');

        const analytics = await analyticsRes.json();
        const chartAllCompletions = chartCompletionsRes.ok ? await chartCompletionsRes.json() : [];
        const historyAllCompletions = historyCompletionsRes.ok ? await historyCompletionsRes.json() : [];
        const habit = habitRes.ok ? await habitRes.json() : null;
        const isMultiple = habit && habit.habitType === 'MULTIPLE';

        // ===== ДАННЫЕ ДЛЯ ГРАФИКОВ (30 дней) =====
        const chartCompletions = chartAllCompletions
            .map(c => ({ ...c, completedDate: normalizeDate(c.completedDate) }))
            .filter(c => c.completedDate && c.completed);

        const days = [];
        const countsByIso = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const iso = toLocalIso(d);
            const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            days.push({ iso, label });
            countsByIso[iso] = 0;
        }
        chartCompletions.forEach(c => {
            if (countsByIso[c.completedDate] !== undefined) {
                countsByIso[c.completedDate]++;
            }
        });

        const labels = days.map(d => d.label);
        const dataValues = days.map(d => countsByIso[d.iso]);
        const completedDays = dataValues.filter(v => v > 0).length;
        const totalDays = days.length;
        const displayRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
        const missedDays = totalDays - completedDays;

        // ===== ДАННЫЕ ДЛЯ ИСТОРИИ (весь период) =====
        const historyCompletions = historyAllCompletions
            .map(c => ({ ...c, completedDate: normalizeDate(c.completedDate) }))
            .filter(c => c.completedDate && c.completed)
            .sort((a, b) => b.completedDate.localeCompare(a.completedDate) || (new Date(b.completedAt || 0) - new Date(a.completedAt || 0)));

        const daysMap = new Map();
        for (const c of historyCompletions) {
            if (!daysMap.has(c.completedDate)) {
                daysMap.set(c.completedDate, []);
            }
            daysMap.get(c.completedDate).push(c);
        }

        let daysListHtml = '';
        if (isMultiple) {
            daysListHtml = '<div class="days-list">';
            let idx = 0;
            for (const [date, comps] of daysMap) {
                const label = new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                daysListHtml += `
                    <div class="day-item">
                        <button class="day-btn" onclick="toggleDayDetails(${idx})">
                            📅 ${label} · ${comps.length} выполнени${comps.length === 1 ? 'е' : (comps.length < 5 ? 'я' : 'й')}
                        </button>
                        <div class="day-details" id="day-details-${idx}" style="display:none;">
                            <div class="times-list">
                                ${comps.map(c => `<div class="time-item">⏰ ${formatTime(c.completedAt)}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
                idx++;
            }
            daysListHtml += '</div>';
        } else {
            daysListHtml = '<div class="days-list">';
            for (const [date, comps] of daysMap) {
                const label = new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                const time = formatTime(comps[0]?.completedAt);
                daysListHtml += `
                    <div class="day-item single">
                        <span class="day-label">📅 ${label}</span>
                        <span class="day-time">${time ? '⏰ ' + time : ''}</span>
                    </div>
                `;
            }
            daysListHtml += '</div>';
        }
        if (daysMap.size === 0) {
            daysListHtml = '<div class="empty-state">Пока нет выполнений для отображения</div>';
        }

        // Уничтожаем старые графики
        if (dailyChartInstance) { dailyChartInstance.destroy(); dailyChartInstance = null; }
        if (statusChartInstance) { statusChartInstance.destroy(); statusChartInstance = null; }

        container.innerHTML = `
            <div class="analytics-detail">
                <div class="analytics-header">
                    <h3>📊 ${analytics.habitName} ${isMultiple ? '🔁' : '☑️'}</h3>
                    <span class="category">${getCategoryName(habit.category || 'OTHER')}</span>
                </div>

                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="value">${analytics.currentStreak}</div>
                        <div class="label">🔥 Текущая серия</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.longestStreak}</div>
                        <div class="label">🏆 Лучшая серия (дни)</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.longestStreakWeeks}</div>
                        <div class="label">🏆 Лучшая серия (недели)</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">${analytics.longestStreakMonths}</div>
                        <div class="label">🏆 Лучшая серия (месяцы)</div>
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

                <div class="heatmap-container">
                    <h4>🔥 Активность за месяц</h4>
                    <div id="heatmap-${habitId}" class="heatmap"></div>
                    <div class="heatmap-legend">
                        <span>Меньше</span>
                        <div class="legend-box" style="background: #ebedf0;"></div>
                        <div class="legend-box" style="background: #c6e48b;"></div>
                        <div class="legend-box" style="background: #7bc96f;"></div>
                        <div class="legend-box" style="background: #239a3b;"></div>
                        <div class="legend-box" style="background: #196127;"></div>
                        <span>Больше</span>
                    </div>
                </div>

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

                <h4 class="section-title">📋 История выполнений</h4>
                ${daysListHtml}
            </div>
        `;

        // === Heatmap ===
        const heatmapEl = document.getElementById(`heatmap-${habitId}`);
        if (heatmapEl) {
            const heatmapDays = 30;
            const heatmapCounts = {};
            for (let i = 0; i < heatmapDays; i++) {
                const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                heatmapCounts[toLocalIso(d)] = 0;
            }
            historyCompletions.forEach(c => {
                if (heatmapCounts[c.completedDate] !== undefined) {
                    heatmapCounts[c.completedDate]++;
                }
            });

            const weeks = [];
            let currentWeek = [];
            const startOfPeriod = new Date(Date.now() - (heatmapDays - 1) * 24 * 60 * 60 * 1000);
            const startDow = (startOfPeriod.getDay() + 6) % 7; // 0=Пн
            for (let i = 0; i < startDow; i++) currentWeek.push(null);

            for (let i = heatmapDays - 1; i >= 0; i--) {
                const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const iso = toLocalIso(d);
                currentWeek.push({ iso, count: heatmapCounts[iso] || 0, date: d });
                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }
            if (currentWeek.length > 0) {
                while (currentWeek.length < 7) currentWeek.push(null);
                weeks.push(currentWeek);
            }

            let heatmapHtml = '';
            for (let dow = 0; dow < 7; dow++) {
                heatmapHtml += '<div class="heatmap-col">';
                for (const week of weeks) {
                    const day = week[dow];
                    if (!day) {
                        heatmapHtml += '<div class="heatmap-cell" style="background: transparent;"></div>';
                    } else {
                        let level = 0;
                        if (isMultiple) {
                            if (day.count >= 4) level = 4;
                            else if (day.count >= 3) level = 3;
                            else if (day.count >= 2) level = 2;
                            else if (day.count >= 1) level = 1;
                        } else {
                            level = day.count > 0 ? 4 : 0;
                        }
                        const title = `${day.date.toLocaleDateString('ru-RU')}: ${day.count} выполнени${day.count === 1 ? 'е' : (day.count < 5 ? 'я' : 'й')}`;
                        heatmapHtml += `<div class="heatmap-cell${level > 0 ? ' level-' + level : ''}" title="${title}"></div>`;
                    }
                }
                heatmapHtml += '</div>';
            }
            heatmapEl.innerHTML = heatmapHtml;
        }

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
                    tension: isMultiple ? 0.3 : 0,
                    stepped: isMultiple ? false : 'after',
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
                        ticks: { stepSize: 1, display: isMultiple },
                        grid: { display: isMultiple, color: 'rgba(0,0,0,0.05)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } }
                    }
                }
            }
        });

        // === График статуса ===
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
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 12 } } },
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

function toggleDayDetails(idx) {
    const el = document.getElementById(`day-details-${idx}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

