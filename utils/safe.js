export const noop = () => {};

export const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
};

export const safeUnsubscribe = (sub) => {
  if (!sub) return;
  try {
    if (typeof sub.unsubscribe === 'function') {
      sub.unsubscribe();
    }
  } catch (e) {
    const errorMsg = e?.message || String(e || '');
    if (errorMsg.includes('CLOSING') || errorMsg.includes('CLOSED') || errorMsg.includes('WebSocket')) {
      return;
    }
  }
};

