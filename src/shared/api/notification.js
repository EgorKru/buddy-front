/**
 * API уведомлений.
 * FSD: shared/api
 */
import { apiRequest } from './client';

export const notificationAPI = {
  getNotifications: async (page = 0, size = 20) =>
    apiRequest(`/notifications?page=${page}&size=${size}`),
  getUnreadNotifications: async () => apiRequest('/notifications/unread'),
  getUnreadCount: async () => {
    const response = await apiRequest('/notifications/unread/count');
    return response.count || 0;
  },
  markAsRead: async (notificationId) =>
    apiRequest(`/notifications/${notificationId}/read`, { method: 'PUT' }),
  deleteNotification: async (notificationId) =>
    apiRequest(`/notifications/${notificationId}`, { method: 'DELETE' }),
};
