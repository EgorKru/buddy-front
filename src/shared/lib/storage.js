/**
 * Обёртка над localStorage для тестируемости (можно подменить в тестах).
 * FSD: shared/lib
 */

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

/**
 * @param {string} key
 * @returns {string | null}
 */
export function getItem(key) {
  try {
    const storage = getStorage();
    return storage ? storage.getItem(key) : null;
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
export function setItem(key, value) {
  try {
    const storage = getStorage();
    if (storage) storage.setItem(key, value);
  } catch (e) {
    throw e;
  }
}

/**
 * @param {string} key
 */
export function removeItem(key) {
  try {
    const storage = getStorage();
    if (storage) storage.removeItem(key);
  } catch (e) {
    throw e;
  }
}
