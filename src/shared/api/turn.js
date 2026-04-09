/**
 * API TURN (WebRTC).
 * FSD: shared/api
 */
import { apiRequest } from './client';

export const turnAPI = {
  getCredentials: async () => apiRequest('/turn/credentials'),
};
