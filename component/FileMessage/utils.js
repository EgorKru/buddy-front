export const FILE_PREVIEW_KIND = {
  TEXT: 'text',
  PDF: 'pdf',
  VIDEO: 'video',
  OFFICE: 'office',
  NONE: 'none',
};

const TEXT_EXTENSIONS = new Set([
  'txt',
  'log',
  'md',
  'json',
  'xml',
  'html',
  'htm',
  'css',
  'js',
  'ts',
  'jsx',
  'tsx',
  'csv',
  'yaml',
  'yml',
  'ini',
  'conf',
  'config',
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);

const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const normalizeExtension = (extension) =>
  extension ? String(extension).toLowerCase().replace(/^\./, '') : '';

export const getFileName = (fileUrl, originalFileName) => {
  if (originalFileName) {
    const lastDotIndex = originalFileName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      return {
        name: originalFileName.substring(0, lastDotIndex),
        extension: originalFileName.substring(lastDotIndex + 1),
      };
    }
    return { name: originalFileName, extension: '' };
  }

  if (!fileUrl) return { name: 'Файл', extension: '' };
  const parts = fileUrl.split('/');
  const lastPart = parts[parts.length - 1];
  const match = lastPart.match(/\.([^.]+)$/);
  if (match) {
    return { name: 'Файл', extension: match[1] };
  }
  return { name: 'Файл', extension: '' };
};

/**
 * @param {string|null|undefined} mimeType
 * @param {string|null|undefined} extension
 * @returns {'text'|'pdf'|'video'|'office'|'none'}
 */
export const getFilePreviewKind = (mimeType, extension) => {
  const ext = normalizeExtension(extension);
  const mime = mimeType ? mimeType.toLowerCase() : '';

  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) {
    return FILE_PREVIEW_KIND.VIDEO;
  }
  if (mime.includes('pdf') || ext === 'pdf') {
    return FILE_PREVIEW_KIND.PDF;
  }
  if (
    mime.includes('openxmlformats') ||
    mime.includes('msword') ||
    mime.includes('ms-excel') ||
    mime.includes('ms-powerpoint') ||
    OFFICE_EXTENSIONS.has(ext)
  ) {
    return FILE_PREVIEW_KIND.OFFICE;
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    (mime.includes('xml') && !mime.includes('openxmlformats')) ||
    mime.includes('html') ||
    mime.includes('javascript') ||
    TEXT_EXTENSIONS.has(ext)
  ) {
    return FILE_PREVIEW_KIND.TEXT;
  }
  return FILE_PREVIEW_KIND.NONE;
};

/** @deprecated use getFilePreviewKind */
export const canViewInBrowser = (mimeType) => {
  const kind = getFilePreviewKind(mimeType, '');
  return kind === FILE_PREVIEW_KIND.TEXT || kind === FILE_PREVIEW_KIND.PDF;
};

export const canOpenInViewer = (previewKind) =>
  previewKind === FILE_PREVIEW_KIND.TEXT ||
  previewKind === FILE_PREVIEW_KIND.PDF ||
  previewKind === FILE_PREVIEW_KIND.OFFICE;

export const isInlineVideoPreview = (previewKind) => previewKind === FILE_PREVIEW_KIND.VIDEO;
