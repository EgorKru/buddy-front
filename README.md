# Pager Frontend

Клиент мессенджера и видеозвонков на **Next.js 13** и **React 18**. API и WebSocket ходят на бэкенд Pager (см. репозиторий backend).

## Требования

- **Node.js 20** (рекомендуется LTS)
- npm 9+

## Быстрый старт

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000). URL API и WebSocket задаются в `.env.local` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`); подробности — в **`.env.example`**.

## Скрипты

| Команда           | Назначение                       |
| ----------------- | -------------------------------- |
| `npm run dev`     | Режим разработки                 |
| `npm run build`   | Продакшен-сборка                 |
| `npm run start`   | Запуск после `build`             |
| `npm run lint`    | ESLint (Next.js)                 |
| `npm test`        | Jest, локально                   |
| `npm run test:ci` | Jest для CI (`--ci --forceExit`) |

## Сквозное шифрование (E2EE)

Включение: в `.env.local` задать **`NEXT_PUBLIC_E2EE_ENABLED=true`**. Нужен бэкенд с миграцией **V3**, эндпоинтами **`/api/crypto/*`** и поддержкой **`encryptionVersion`** у сообщений.

- Шифруется **текст** в **личных (DIRECT) чатах** на клиенте (Web Crypto: ECDH P-256, HKDF, AES-GCM). Приватный ключ хранится в **IndexedDB**; на сервер уходит публичный ключ и opaque `content`.
- **Групповые чаты** и **вложения/медиа** этим флагом не охватываются.

Подробности переменных — в **`.env.example`**.

## CI

В репозитории настроен GitHub Actions workflow **Frontend CI**: `npm ci`, тесты, лint, `next build` (с тестовыми `NEXT_PUBLIC_*` для сборки).

## Структура

- **`pages/`** — маршруты Next.js (Pages Router)
- **`components/`**, **`component/`** — UI чата, комнат, сообщений
- **`src/shared/`** — API-клиент, конфиг, утилиты, модуль **`src/shared/lib/e2ee/`**
