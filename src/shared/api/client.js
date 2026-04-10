/**
 * Базовый HTTP-клиент API: apiRequest и загрузка файлов.
 * FSD: shared/api
 */
import { getApiUrl } from '../config';
import { sanitizeApiErrorMessage } from '../lib/sanitizeApiErrorMessage';

function handleUnauthorized() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
}

/**
 * Выполняет HTTP-запрос к API с токеном и обработкой 401/403/ошибок.
 * @param {string} endpoint — путь (например, '/auth/login')
 * @param {RequestInit & { body?: object | string }} options — method, body, headers
 * @returns {Promise<object|null>} JSON-ответ или null
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const { body, ...fetchOptions } = options;

  try {
    const response = await fetch(getApiUrl(endpoint), {
      ...fetchOptions,
      headers,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });

    if (response.status === 401 || response.status === 403) {
      let errorMessage = response.status === 401 ? 'Unauthorized' : 'Forbidden';
      try {
        const errBody = await response.json();
        errorMessage = errBody.message || errorMessage;
      } catch {
        // тело не JSON — оставляем дефолт
      }
      if (token) {
        handleUnauthorized();
      }
      throw new Error(sanitizeApiErrorMessage(errorMessage, response.status));
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        if (response.status === 500) {
          errorMessage = 'Internal server error';
        } else if (response.status === 404) {
          errorMessage = 'Not found';
        }
      }
      throw new Error(sanitizeApiErrorMessage(errorMessage, response.status));
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return null;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Не удалось подключиться к серверу. Проверьте, что бэкенд запущен.');
    }
    throw error;
  }
};

/**
 * Загрузка файла на указанный эндпоинт чата (FormData), с опциональным onProgress через XHR.
 * @param {string} chatId
 * @param {FormData} formData
 * @param {string} pathSuffix — например 'files/voice', 'files/image', 'files/file'
 * @param {((progress: number) => void)|null} onProgress — 0..1
 * @returns {Promise<object>}
 */
export async function uploadFileToEndpoint(chatId, formData, pathSuffix, onProgress) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const uploadUrl = getApiUrl(`/chats/${chatId}/${pathSuffix}`);

  if (onProgress && typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) requestAnimationFrame(() => onProgress(e.loaded / e.total));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 401) {
          handleUnauthorized();
          reject(new Error('Unauthorized'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Failed to parse response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(
              new Error(
                sanitizeApiErrorMessage(
                  error.message || `Upload failed with status ${xhr.status}`,
                  xhr.status
                )
              )
            );
          } catch {
            reject(
              new Error(
                sanitizeApiErrorMessage(`Upload failed with status ${xhr.status}`, xhr.status)
              )
            );
          }
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.open('POST', uploadUrl);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }

  const response = await fetch(uploadUrl, { method: 'POST', headers, body: formData });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(
      sanitizeApiErrorMessage(
        error.message || `Upload failed with status ${response.status}`,
        response.status
      )
    );
  }
  return response.json();
}
