/**
 * Shared API layer: один вход для всех HTTP-запросов к бэкенду.
 * FSD: shared — импортируется из features, entities, widgets, pages.
 * Реэкспорт модулей: client, auth, room, chat, user, turn, notification.
 */

export { apiRequest } from './client';
export { authAPI, getCurrentUser, setCurrentUser, isAuthenticated, getToken } from './auth';
export { roomAPI } from './room';
export { chatAPI } from './chat';
export { userAPI } from './user';
export { turnAPI } from './turn';
export { notificationAPI } from './notification';
export { cryptoAPI } from './crypto';
