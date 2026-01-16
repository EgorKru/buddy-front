import { useState, useRef, useCallback, useEffect } from 'react';
import { MESSAGE_PAGE_SIZE, SEARCH_DEBOUNCE_DELAY } from '../constants/chat';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { chatAPI } from '@/utils/api';

const sortSearchResults = (results, searchText) => {
  if (!searchText || results.length === 0) return results;
  
  const searchLower = searchText.toLowerCase();
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
  
  return [...results].sort((a, b) => {
    const contentA = (a.content || '').toLowerCase();
    const contentB = (b.content || '').toLowerCase();

    const priorityA = calculateMatchPriority(contentA, searchLower, searchWords);
    const priorityB = calculateMatchPriority(contentB, searchLower, searchWords);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });
};

const calculateMatchPriority = (content, searchLower, searchWords) => {
  if (!content) return 999;

  const exactWordMatch = searchWords.some(word => {
    const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return wordRegex.test(content);
  });
  if (exactWordMatch) return 1;

  const startOfWordMatch = searchWords.some(word => {
    const startRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    return startRegex.test(content);
  });
  if (startOfWordMatch) return 2;

  if (content.startsWith(searchLower)) return 3;

  if (content.includes(searchLower)) return 4;

  const partialMatch = searchWords.some(word => content.includes(word));
  if (partialMatch) return 5;
  
  return 999;
};

export const useMessageSearch = ({ chatId, onNavigateToMessage, upsertMessage }) => {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(true);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const handleSearch = useCallback(async (query, pageNum = 0) => {
    if (!query.trim() || !chatId) {
      setSearchResults([]);
      setSearchMode(false);
      return;
    }

    setIsSearching(true);
    try {

      const response = await chatAPI.searchMessages(chatId, query.trim(), pageNum, MESSAGE_PAGE_SIZE);
      const results = Array.isArray(response?.content) ? response.content : (Array.isArray(response) ? response : []);

      const sortedResults = sortSearchResults(results, query.trim());

      if (upsertMessage) {
        for (const msg of sortedResults) {
          
          if ((msg.type === 'FILE' || msg.type === 'IMAGE') && msg.fileUrl && typeof window !== 'undefined') {
            const metadataKey = `file_metadata_${msg.fileUrl}`;
            if (msg.fileSize && msg.fileName && msg.mimeType) {
              const fileMetadata = { 
                fileSize: msg.fileSize, 
                fileName: msg.fileName, 
                mimeType: msg.mimeType, 
                timestamp: Date.now() 
              };
              localStorage.setItem(metadataKey, JSON.stringify(fileMetadata));
            }
          }
          upsertMessage({ ...msg, status: MESSAGE_STATUS.SENT, isOptimistic: false }, { unreadDelta: 0 });
        }
      }
      
      if (pageNum === 0) {
        setSearchResults(sortedResults);
      } else {
        setSearchResults(prev => [...prev, ...sortedResults]);
      }
      
      setHasMoreSearchResults(response?.totalPages ? pageNum < response.totalPages - 1 : results.length === MESSAGE_PAGE_SIZE);
      setSearchMode(true);
      setCurrentSearchIndex(-1);
    } catch (error) {
      
      alert('Не удалось выполнить поиск');
    } finally {
      setIsSearching(false);
    }
  }, [chatId, upsertMessage]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchText.trim() && chatId) {
      searchTimeoutRef.current = setTimeout(() => {
        setSearchPage(0);
        handleSearch(searchText, 0);
      }, 300);
    } else {
      setSearchResults([]);
      setSearchMode(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText, chatId, handleSearch]);

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchPage(0);
    handleSearch(searchText, 0);
  }, [searchText, handleSearch]);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, SEARCH_DEBOUNCE_DELAY);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchText('');
    setSearchResults([]);
    setSearchMode(false);
    setCurrentSearchIndex(-1);
  }, []);

  const handleNavigateToSearchResult = useCallback(async (messageId) => {
    if (onNavigateToMessage) {
      await onNavigateToMessage(messageId);
      handleCloseSearch();
    }
  }, [onNavigateToMessage, handleCloseSearch]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && searchOpen) {
        handleCloseSearch();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [searchOpen, handleCloseSearch]);

  return {
    
    searchText,
    searchResults,
    isSearching,
    searchMode,
    searchPage,
    hasMoreSearchResults,
    currentSearchIndex,
    searchOpen,
    searchInputRef,

    setSearchText,
    setSearchPage,
    setCurrentSearchIndex,

    handleSearch,
    handleSearchSubmit,
    handleOpenSearch,
    handleCloseSearch,
    handleNavigateToSearchResult
  };
};

