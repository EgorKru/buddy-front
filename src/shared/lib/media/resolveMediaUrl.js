import { getApiUrl } from '@/src/shared/config';

/**
 * Resolve media URL for chat files, uploads, and system animated emoji packs.
 */
export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  if (url.startsWith('/system/')) {
    return getApiUrl(url);
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return getApiUrl(`/chats/files/${clean}`);
}
