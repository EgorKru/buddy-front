import { useCallback } from 'react';

export const useChatContextMenu = (setContextMenu, messageActions) => {
  const handleContextMenu = useCallback(
    (e, message) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        message,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [setContextMenu]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, [setContextMenu]);

  const handleContextMenuAction = useCallback(
    (action, message) => {
      setContextMenu(null);
      switch (action) {
        case 'reply':
          messageActions.handleReplyMessage(message);
          break;
        case 'pin':
          messageActions.handlePinMessage(message);
          break;
        case 'unpin':
          messageActions.handleUnpinMessage(message);
          break;
        case 'copy':
          messageActions.handleCopyMessage(message);
          break;
        case 'forward':
          messageActions.handleForwardMessage(message);
          break;
        case 'delete':
          messageActions.handleDeleteMessage(message);
          break;
        case 'edit':
          messageActions.handleEditMessage(message);
          break;
        case 'select':
          messageActions.handleSelectMessage(message);
          break;
        default:
          break;
      }
    },
    [setContextMenu, messageActions]
  );

  return { handleContextMenu, handleCloseContextMenu, handleContextMenuAction };
};
