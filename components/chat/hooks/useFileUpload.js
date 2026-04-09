import { useState, useRef } from 'react';

export const useFileUpload = () => {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const selectedFileUrlRef = useRef(null);
  const fileInputRef = useRef(null);

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (selectedFileUrlRef.current) {
      URL.revokeObjectURL(selectedFileUrlRef.current);
      selectedFileUrlRef.current = null;
    }
  };

  return {
    uploadingFile,
    setUploadingFile,
    selectedFile,
    setSelectedFile,
    selectedFileUrlRef,
    fileInputRef,
    clearSelectedFile,
  };
};
