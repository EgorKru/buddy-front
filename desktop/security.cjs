function createTrustedOrigins(urls) {
  return new Set(
    urls.map((value) => new URL(value).origin)
  );
}

function isTrustedUrl(value, trustedOrigins) {
  try {
    return trustedOrigins.has(new URL(value).origin);
  } catch {
    return false;
  }
}

function isExternalHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function selectDisplaySource(sources) {
  return sources.find((source) => source.id?.startsWith('screen:')) || sources[0] || null;
}

module.exports = {
  createTrustedOrigins,
  isTrustedUrl,
  isExternalHttpUrl,
  selectDisplaySource,
};
