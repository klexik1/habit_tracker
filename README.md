# Персональный трекер привычек

Многомодульное веб-приложение для отслеживания личных привычек и формирования статистики.

## Структура проекта

- **habit-tracker-core** — доменная модель, репозитории, сервисы
- **habit-tracker-api** — REST API, безопасность (JWT), контроллеры

## Технологии

- Java 21
- Spring Boot 3.3
- Spring Data JPA
- Spring Security + JWT
- PostgreSQL / H2
- Maven

## Запуск

### Быстрый старт (встроенная H2, без установки PostgreSQL)

```bash
mvn clean install
mvn -pl habit-tracker-api spring-boot:run -Dspring-boot.run.profiles=dev
```

Приложение: http://localhost:8080  
Консоль H2: http://localhost:8080/h2-console (URL: `jdbc:h2:mem:habit_tracker`)

### С PostgreSQL

1. Создать БД:
   ```sql
   CREATE DATABASE habit_tracker;
   ```
2. Настроить логин/пароль в `application.yml`
3. Запустить:
   ```bash
   mvn -pl habit-tracker-api spring-boot:run
   ```

## API Endpoints

### Аутентификация
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход (возвращает JWT)

### Привычки (требуется Bearer токен)
- `POST /api/habits` — создать привычку
- `GET /api/habits` — список привычек
- `GET /api/habits/{id}` — детали привычки
- `PUT /api/habits/{id}` — обновить
- `DELETE /api/habits/{id}` — удалить

### Выполнение
- `POST /api/completions/habit/{habitId}` — отметить выполнение
- `GET /api/completions/habit/{habitId}?start=...&end=...` — история
- `GET /api/completions/today` — сегодняшние отметки

### Аналитика
- `GET /api/analytics/habit/{habitId}?start=...&end=...` — статистика

### Напоминания
- `GET /api/reminders` — ожидающие напоминания

## Пример запроса

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"user","email":"user@test.com","password":"password"}'

curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"password"}'

curl http://localhost:8080/api/habits \
  -H "Authorization: Bearer <TOKEN>"
```
