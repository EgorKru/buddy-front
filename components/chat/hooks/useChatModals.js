import { useState, useCallback } from 'react';

export const useChatModals = () => {
  const [imageModal, setImageModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [forwardModal, setForwardModal] = useState(null);

  const closeAllModals = useCallback(() => {
    setImageModal(null);
    setDeleteConfirm(null);
    setForwardModal(null);
  }, []);

  return {
    imageModal,
    setImageModal,
    deleteConfirm,
    setDeleteConfirm,
    forwardModal,
    setForwardModal,
    closeAllModals
  };
};

