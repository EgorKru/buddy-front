import { chatAPI } from '@/utils/api';

/**
 * Загружает вложение чата с JWT (для blob URL в превью).
 * @param {string} fileUrl — относительный путь files/... или images/...
 * @param {{ download?: boolean, filename?: string }} [options]
 * @returns {Promise<Blob>}
 */
export async function fetchChatFileBlob(fileUrl, options = {}) {
  const { download = false, filename } = options;
  const url = chatAPI.getFileUrl(fileUrl, download, filename);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error(`Failed to load file: ${response.status}`);
  }

  return response.blob();
}
