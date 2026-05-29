/**
 * Чистые операции над Map userId -> timestamp для индикатора «печатает».
 */

export function setTypingUser(prev, userId, timestamp = Date.now()) {
  const id = String(userId);
  const next = new Map(prev);
  next.set(id, timestamp);
  return next;
}

export function removeTypingUser(prev, userId) {
  const id = String(userId);
  if (!prev.has(id)) return prev;
  const next = new Map(prev);
  next.delete(id);
  return next;
}

export function getTypingUserIds(map) {
  return Array.from(map.keys());
}
