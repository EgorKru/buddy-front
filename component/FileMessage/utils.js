export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const getFileName = (fileUrl, originalFileName) => {
  if (originalFileName) {
    const lastDotIndex = originalFileName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      return {
        name: originalFileName.substring(0, lastDotIndex),
        extension: originalFileName.substring(lastDotIndex + 1)
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

export const canViewInBrowser = (mimeType) => {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return mime.includes('pdf') || mime.startsWith('image/');
};

