/**
 * Shared config: API base URL, STOMP/WS, app meta.
 * FSD: shared layer — используется в api и по всему приложению.
 */

const getApiBaseURL = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  return url.replace(/\/$/, '');
};

/** WebSocket URL для нативного STOMP (без SockJS). */
const getNativeWsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_NATIVE_URL) return process.env.NEXT_PUBLIC_WS_NATIVE_URL;
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return `${process.env.NEXT_PUBLIC_SOCKET_URL}/ws-native`;
  if (process.env.NEXT_PUBLIC_API_URL)
    return process.env.NEXT_PUBLIC_API_URL.replace('/api', '/ws-native').replace(/^http/, 'ws');
  return 'ws://localhost:8080/ws-native';
};

/** HTTP(S) URL для STOMP поверх SockJS. В dev — http для избежания mixed content. */
const getSockJsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_SOCKJS_URL) return process.env.NEXT_PUBLIC_WS_SOCKJS_URL;
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return `${process.env.NEXT_PUBLIC_SOCKET_URL}/ws`;
  if (process.env.NEXT_PUBLIC_API_URL)
    return process.env.NEXT_PUBLIC_API_URL.replace('/api', '/ws');
  return 'http://localhost:8080/ws';
};

/**
 * Конфигурация приложения: API, STOMP, мета.
 * @type {{ api: { baseURL: string, timeout: number }, stomp: { nativeUrl: string, sockjsUrl: string, options: object }, app: { name: string, version: string } }}
 */
export const config = {
  api: {
    baseURL: getApiBaseURL(),
    timeout: 30000,
  },
  stomp: {
    nativeUrl: getNativeWsUrl(),
    sockjsUrl: getSockJsUrl(),
    options: {
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    },
  },
  app: {
    name: 'Pager',
    version: '1.0.0',
  },
};

/**
 * Проверяет наличие критичных переменных окружения. В production при отсутствии NEXT_PUBLIC_API_URL выбрасывает ошибку.
 * Можно вызывать при инициализации приложения.
 */
export const validateConfig = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL must be defined in production');
  }
};

/**
 * Возвращает полный URL для эндпоинта API.
 * @param {string} endpoint — путь к ресурсу (например, 'users/me' или '/chats')
 * @returns {string} полный URL без дублирования слешей
 */
export const getApiUrl = (endpoint) => {
  const baseURL = config.api.baseURL;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseURL}${path}`;
};

/** true, если код выполняется в браузере. */
export const isBrowser = typeof window !== 'undefined';

/**
 * @returns {'development'|'production'|'test'} текущее окружение
 */
export const getEnvironment = () => {
  return process.env.NODE_ENV || 'development';
};

/** @returns {boolean} */
export const isDevelopment = () => {
  return getEnvironment() === 'development';
};

/** @returns {boolean} */
export const isProduction = () => {
  return getEnvironment() === 'production';
};
