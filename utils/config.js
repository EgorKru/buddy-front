/**
 * Конфигурация приложения
 * Все настройки API и других сервисов
 */

// Функция для определения baseURL
// После исправления CORS на бэкенде используем прямой URL
const getApiBaseURL = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  
  // CORS настроен на бэкенде, используем прямой URL
  // Прокси больше не нужен, так как бэкенд разрешает origin http://localhost:3000
  return apiUrl;
};

export const config = {
  // API Configuration
  api: {
    baseURL: getApiBaseURL(),
    timeout: 30000, // 30 секунд
  },
  
  // STOMP WebSocket Configuration
  stomp: {
    // WebSocket нельзя проксировать через Next.js, используем прямой URL
    // Production: wss://pager.website/ws -> https://pager.website/ws (для SockJS)
    // Dev: ws://localhost:8080/ws -> http://localhost:8080/ws (для SockJS)
    // Поддерживаем оба варианта переменных для обратной совместимости
    url: process.env.NEXT_PUBLIC_WS_URL || 
         (process.env.NEXT_PUBLIC_SOCKET_URL ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/ws` : null) ||
         (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '/ws') || 'ws://localhost:8080/ws'),
    options: {
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    },
  },
  
  // App Configuration
  app: {
    name: 'Pager',
    version: '1.0.0',
  },
};

/**
 * Получить полный URL для API запроса
 */
export const getApiUrl = (endpoint) => {
  const baseURL = config.api.baseURL.endsWith('/') 
    ? config.api.baseURL.slice(0, -1) 
    : config.api.baseURL;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseURL}${path}`;
};

/**
 * Проверка, что мы в браузере
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Получить текущее окружение
 */
export const getEnvironment = () => {
  return process.env.NODE_ENV || 'development';
};

/**
 * Проверка, что мы в режиме разработки
 */
export const isDevelopment = () => {
  return getEnvironment() === 'development';
};

/**
 * Проверка, что мы в продакшене
 */
export const isProduction = () => {
  return getEnvironment() === 'production';
};

