/**
 * Фича "авторизация": текущий пользователь, статус, выход. FSD: features
 */
import { getCurrentUser, isAuthenticated, authAPI } from '@/shared/api';

/**
 * Хук авторизации: текущий пользователь, флаг входа и функция выхода.
 * @returns {{ user: object|null, isAuthenticated: boolean, logout: function }}
 */
export function useAuth() {
  return {
    user: getCurrentUser(),
    isAuthenticated: isAuthenticated(),
    logout: authAPI.logout,
  };
}

export { getCurrentUser, isAuthenticated } from '@/shared/api';
