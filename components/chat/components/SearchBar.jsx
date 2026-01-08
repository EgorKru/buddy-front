import { formatChatTime } from '@/utils/dateHelpers';
import styles from '@/styles/chat.module.css';

export default function SearchBar({
  searchMode,
  searchResults,
  searchText,
  user,
  onNavigateToResult,
  onCloseSearch
}) {
  if (!searchMode || !searchText.trim()) {
    return null;
  }
  
  if (searchResults.length === 0) {
    return (
      <div className={styles.searchResultsDropdown}>
        <div className={styles.searchResultsInfo}>
          <span className={styles.searchResultsEmpty}>
            Ничего не найдено
          </span>
        </div>
      </div>
    );
  }

  const getPreviewText = (msg) => {
    if (!msg.content || !searchText) return msg.content || '';
    
    const searchLower = searchText.toLowerCase();
    const contentLower = msg.content.toLowerCase();
    const matchIndex = contentLower.indexOf(searchLower);
    
    if (matchIndex === -1) {
      return msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
    }
    
    const contextLength = 40;
    const start = Math.max(0, matchIndex - contextLength);
    const end = Math.min(msg.content.length, matchIndex + searchText.length + contextLength);
    
    let preview = msg.content.substring(start, end);
    if (start > 0) preview = '...' + preview;
    if (end < msg.content.length) preview = preview + '...';
    
    return preview;
  };

  const highlightText = (text, searchText) => {
    if (!text || !searchText) return text;
    
    const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchText})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      part.toLowerCase() === searchText.toLowerCase() ? (
        <mark key={i} className={styles.searchHighlight}>{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className={styles.searchResultsDropdown}>
      <div className={styles.searchResultsInfo}>
        <span className={styles.searchResultsCount}>
          {searchResults.length} найдено
        </span>
      </div>
      <div className={styles.searchResultsList}>
        {searchResults.map((msg) => {
          const isOwn = msg.senderId === user?.id;
          const previewText = getPreviewText(msg);
          
          return (
            <div
              key={msg.id}
              className={styles.searchResultItem}
              onClick={async () => {
                await onNavigateToResult(msg.id);
                onCloseSearch();
              }}
            >
              <div className={styles.searchResultContent}>
                <div className={styles.searchResultSender}>
                  {isOwn ? 'Вы' : (msg.senderDisplayName || msg.senderUsername)}
                </div>
                <div className={styles.searchResultText}>
                  {highlightText(previewText, searchText)}
                </div>
                <div className={styles.searchResultTime}>
                  {formatChatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

