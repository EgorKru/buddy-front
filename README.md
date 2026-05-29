# Pager Frontend

Клиент мессенджера и видеозвонков на **Next.js 13** и **React 18**. REST и WebSocket/STOMP — на бэкенд Pager (репозиторий `buddy`).

## Требования

- **Node.js 20** (LTS)
- npm 9+
- Запущенный бэкенд (`http://localhost:8080`) и Redis/PostgreSQL (см. README бэкенда)

## Быстрый старт

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000). URL API и WebSocket — в `.env.local` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`); см. **`.env.example`**.

Для E2E часто используется порт **3002** — задай `E2E_BASE_URL` в `.env.e2e.local`.

## Возможности (кратко)

| Область       | Описание                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| Realtime      | STOMP: сообщения, read receipts, presence                                 |
| Звонки 1-on-1 | Аудио/видео, busy-статус, TURN с бэкенда                                  |
| Pager Meet    | Групповые комнаты, превью камеры/мика                                     |
| Медиа         | Двухфазный захват: микрофон сразу, камера ≤ 1.5 с; фильтр фона (размытие) |
| Файлы         | Вложения, просмотр PDF/текста/видео в чате                                |
| E2EE          | Опционально: DIRECT-чаты, текст (см. ниже)                                |

Модуль медиа: `src/shared/lib/media/` (`acquireMediaStream`, `applyBackgroundEffect`).

## Скрипты

| Команда                | Назначение             |
| ---------------------- | ---------------------- |
| `npm run dev`          | Режим разработки       |
| `npm run build`        | Продакшен-сборка       |
| `npm run start`        | Запуск после `build`   |
| `npm run lint`         | ESLint                 |
| `npm run format:check` | Prettier (как в CI)    |
| `npm test`             | Все Jest-тесты         |
| `npm run test:ci`      | Jest для CI + coverage |

### Тесты по областям (Jest)

| Команда                 | Что проверяет                                     |
| ----------------------- | ------------------------------------------------- |
| `npm run test:realtime` | Read receipts, messaging reducer, realtime hooks  |
| `npm run test:call`     | `useCallProtocol` (звонки)                        |
| `npm run test:meet`     | `useRoomProtocol` (комнаты)                       |
| `npm run test:files`    | Превью файлов, PDF/видео в чате                   |
| `npm run test:media`    | Захват камеры/мика, SLA, фон (unit + integration) |

### Smoke (живой бэкенд)

| Команда                    | Назначение                              |
| -------------------------- | --------------------------------------- |
| `npm run test:ws-smoke`    | WebSocket/STOMP чат                     |
| `npm run test:call-smoke`  | Сигналинг 1-on-1                        |
| `npm run test:room-smoke`  | Комнаты                                 |
| `npm run test:media-smoke` | TURN `/api/turn/credentials` (< 500 ms) |

Нужны переменные из `.env.e2e.local` (`E2E_SENDER_*`, `E2E_API_URL` и т.д.).

### E2E (Playwright)

Сначала: `npm run test:e2e:setup` (создаёт `.env.e2e.local`).

| Команда                     | Сценарий                     |
| --------------------------- | ---------------------------- |
| `npm run test:e2e:realtime` | Read receipts, realtime UI   |
| `npm run test:e2e:call`     | 1-on-1 аудиозвонок           |
| `npm run test:e2e:meet`     | Meet preview и комната       |
| `npm run test:e2e:files`    | Вложения и просмотр в чате   |
| `npm run test:e2e:media`    | SLA камеры/мика, фильтр фона |

Комплексные прогоны: `test:realtime:all`, `test:call:all`, `test:meet:all`, `test:media:all`.

E2E поднимает prod-сервер на `E2E_PORT` (по умолчанию **3002**). В `.env.e2e.local` укажи `E2E_BASE_URL=http://localhost:3002`.

## Сквозное шифрование (E2EE)

Включение: **`NEXT_PUBLIC_E2EE_ENABLED=true`** в `.env.local`. Нужен бэкенд с миграцией **V3** и `/api/crypto/*`.

- Шифруется **текст** в **DIRECT**-чатах (Web Crypto на клиенте).
- **Группы** и **вложения** этим флагом не покрываются.

Подробности — **`.env.example`** и **`docs/E2EE.md`** в репозитории backend.

## CI/CD

Workflow **CI/CD Pipeline** (`.github/workflows/ci.yml`):

1. **Build & Test** — `npm ci`, `npm run test:ci`
2. **Code Quality** — lint, format
3. **Production build** — на `main`
4. **Deploy** — см. `.github/workflows/deploy.yml`

## Структура

- **`pages/`** — маршруты Next.js (Pages Router)
- **`components/`**, **`component/`** — UI чата, звонков, файлов
- **`hooks/`** — `useCallProtocol`, `useRoomProtocol`, `useMediaDevices`, realtime
- **`src/shared/`** — API, `lib/media/`, `lib/e2ee/`
- **`src/features/room/`** — Meet, `MediaPreviewModal`
- **`e2e/`** — Playwright-спеки и `helpers/`

## Связь с бэкендом

| Клиент                | Бэкенд                            |
| --------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_URL` | REST, Swagger: `/swagger-ui.html` |
| `NEXT_PUBLIC_WS_URL`  | STOMP (чат, звонки, комнаты)      |
| TURN                  | `GET /api/turn/credentials`       |

Документация API: после запуска бэкенда открой Swagger UI и выбери сервер **Development (localhost)**.
