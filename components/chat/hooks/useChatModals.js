import { useState, useCallback, useEffect } from 'react';

export const useChatModals = () => {
  const [imageModal, setImageModal] = useState(null);
  const [fileViewerModal, setFileViewerModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteForAll, setDeleteForAll] = useState(false);
  const [forwardModal, setForwardModal] = useState(null);

  useEffect(() => {
    console.log('[useChatModals] imageModal state changed:', imageModal);
  }, [imageModal]);

  useEffect(() => {
    console.log('[useChatModals] fileViewerModal state changed:', fileViewerModal);
  }, [fileViewerModal]);

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

