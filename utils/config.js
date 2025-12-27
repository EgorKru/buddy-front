/**
 * Конфигурация приложения
 * Все настройки API и других сервисов
 */

export const config = {
  // API Configuration
  api: {
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
    timeout: 30000, // 30 секунд
  },
  
  // Socket.io Configuration
  socket: {
    url: process.env.NEXT_PUBLIC_SOCKET_URL || 
         process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 
         'http://localhost:8080',
    options: {
      transports: ['polling', 'websocket'], // Polling более надежен, особенно при проблемах с WebSocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    },
  },
  
  // App Configuration
  app: {
    name: 'Buddy',
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

