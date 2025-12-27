# Этап 1: Сборка приложения
FROM node:18-alpine AS builder
WORKDIR /app

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение (переменные окружения должны быть установлены во время сборки)
ARG NEXT_PUBLIC_API_URL=http://158.160.148.204:8080/api
ARG NEXT_PUBLIC_SOCKET_URL=http://158.160.148.204:8080

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NODE_ENV=production

RUN npm run build

# Этап 2: Финальный образ
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем package.json для установки только production зависимостей
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Устанавливаем только production зависимости.ю
RUN npm ci --only=production && npm cache clean --force

# Копируем собранное приложение
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]

