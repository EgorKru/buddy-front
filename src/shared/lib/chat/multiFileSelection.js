/** Максимум вложений за одну отправку */
export const MAX_CHAT_ATTACHMENTS = 10;

export function fileSelectionKey(file) {
  if (!file) return '';
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Добавляет файлы без дубликатов (имя + размер + lastModified), с лимитом.
 * @param {File[]} existing
 * @param {File[]} incoming
 * @param {number} [max]
 */
export function mergeSelectedFiles(existing = [], incoming = [], max = MAX_CHAT_ATTACHMENTS) {
  const seen = new Set((existing || []).map(fileSelectionKey));
  const merged = [...(existing || [])];

  for (const file of incoming || []) {
    if (!file) continue;
    const key = fileSelectionKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
    if (merged.length >= max) break;
  }

  return merged.slice(0, max);
}

/**
 * @param {Event & { target?: { files?: FileList } }} event
 * @returns {File[]}
 */
export function filesFromInputEvent(event) {
  const list = event?.target?.files;
  if (!list?.length) return [];
  return Array.from(list);
}

/**
 * @param {Event} event
 * @param {File[]} existing
 */
export function appendFilesFromInputEvent(event, existing = []) {
  return mergeSelectedFiles(existing, filesFromInputEvent(event));
}
