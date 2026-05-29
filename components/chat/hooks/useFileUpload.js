import { useState, useRef, useCallback, useMemo } from 'react';
import { mergeSelectedFiles } from '@/shared/lib/chat/multiFileSelection';

function revokePreviewUrl(map, key) {
  const url = map.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    map.delete(key);
  }
}

export const useFileUpload = () => {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const previewUrlsRef = useRef(new Map());
  const fileInputRef = useRef(null);

  const syncImagePreviews = useCallback((files) => {
    const map = previewUrlsRef.current;
    const nextKeys = new Set();

    for (const file of files) {
      if (!file?.type?.startsWith('image/')) continue;
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      nextKeys.add(key);
      if (!map.has(key)) {
        map.set(key, URL.createObjectURL(file));
      }
    }

    for (const [key] of [...map.entries()]) {
      if (!nextKeys.has(key)) {
        revokePreviewUrl(map, key);
      }
    }
  }, []);

  const addSelectedFiles = useCallback(
    (incoming) => {
      if (!incoming?.length) return;
      setSelectedFiles((prev) => {
        const next = mergeSelectedFiles(prev, incoming);
        syncImagePreviews(next);
        return next;
      });
    },
    [syncImagePreviews]
  );

  const removeSelectedFileAt = useCallback((index) => {
    setSelectedFiles((prev) => {
      const file = prev[index];
      if (file?.type?.startsWith('image/')) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        revokePreviewUrl(previewUrlsRef.current, key);
      }
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
  }, []);

  const clearSelectedFiles = useCallback(() => {
    const map = previewUrlsRef.current;
    for (const key of [...map.keys()]) {
      revokePreviewUrl(map, key);
    }
    setSelectedFiles([]);
  }, []);

  const setSelectedFile = useCallback(
    (file) => {
      if (!file) {
        clearSelectedFiles();
        return;
      }
      clearSelectedFiles();
      addSelectedFiles([file]);
    },
    [addSelectedFiles, clearSelectedFiles]
  );

  const selectedFile = useMemo(() => selectedFiles[0] ?? null, [selectedFiles]);

  /** @deprecated используйте previewUrlsRef + ключ файла */
  const selectedFileUrlRef = useRef(null);

  const clearSelectedFile = clearSelectedFiles;

  return {
    uploadingFile,
    setUploadingFile,
    selectedFiles,
    setSelectedFiles,
    selectedFile,
    setSelectedFile,
    addSelectedFiles,
    removeSelectedFileAt,
    previewUrlsRef,
    selectedFileUrlRef,
    fileInputRef,
    clearSelectedFiles,
    clearSelectedFile,
  };
};
