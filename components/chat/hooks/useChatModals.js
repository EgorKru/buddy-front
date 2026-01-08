import { useState, useCallback } from 'react';

export const useChatModals = () => {
  const [imageModal, setImageModal] = useState(null);
  const [fileViewerModal, setFileViewerModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteForAll, setDeleteForAll] = useState(false);
  const [forwardModal, setForwardModal] = useState(null);

  const closeAllModals = useCallback(() => {
    setImageModal(null);
    setFileViewerModal(null);
    setDeleteConfirm(null);
    setDeleteForAll(false);
    setForwardModal(null);
  }, []);

  return {
    imageModal,
    setImageModal,
    fileViewerModal,
    setFileViewerModal,
    deleteConfirm,
    setDeleteConfirm,
    deleteForAll,
    setDeleteForAll,
    forwardModal,
    setForwardModal,
    closeAllModals
  };
};

