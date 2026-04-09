export const messageRowComparison = (prevProps, nextProps) => {
  const prevMsg = prevProps.msg;
  const nextMsg = nextProps.msg;

  if (prevMsg.id !== nextMsg.id) return false;
  if (prevMsg.status !== nextMsg.status) return false;
  if (prevMsg.content !== nextMsg.content) return false;
  if (prevMsg.isOptimistic !== nextMsg.isOptimistic) return false;
  if (prevMsg.isPinned !== nextMsg.isPinned) return false;
  if (prevMsg.deletedForMe !== nextMsg.deletedForMe) return false;
  if (prevMsg.deletedForAll !== nextMsg.deletedForAll) return false;

  if (prevProps.selectionMode !== nextProps.selectionMode) return false;
  if (prevProps.selectedMessages.has(prevMsg.id) !== nextProps.selectedMessages.has(nextMsg.id))
    return false;

  if (prevProps.searchOpen !== nextProps.searchOpen) return false;
  if (prevProps.searchText !== nextProps.searchText) return false;

  if (prevProps.pinnedMessages.length !== nextProps.pinnedMessages.length) return false;

  if (prevProps.getReadMetaForMessage !== nextProps.getReadMetaForMessage) return false;
  if (prevProps.getMessageStatusIcon !== nextProps.getMessageStatusIcon) return false;

  return true;
};
