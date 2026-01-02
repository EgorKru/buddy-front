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
    sub.unsubscribe();
  } catch (e) {}
};


