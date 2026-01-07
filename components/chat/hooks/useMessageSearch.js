import { useState, useRef, useCallback, useEffect } from 'react';
import { MESSAGE_PAGE_SIZE, SEARCH_DEBOUNCE_DELAY } from '../constants/chat';
import { chatAPI } from '@/utils/api';

/**
 * Хук для поиска сообщений в чате
 */
export const useMessageSearch = ({ chatId, onNavigateToMessage }) => {
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
      // Поиск работает для ВСЕХ сообщений в чате через серверный API,
      // а не только для загруженных на клиенте. API ищет по всей истории чата.
      const response = await chatAPI.searchMessages(chatId, query.trim(), pageNum, MESSAGE_PAGE_SIZE);
      const results = Array.isArray(response?.content) ? response.content : (Array.isArray(response) ? response : []);
      
      if (pageNum === 0) {
        setSearchResults(results);
      } else {
        setSearchResults(prev => [...prev, ...results]);
      }
      
      setHasMoreSearchResults(response?.totalPages ? pageNum < response.totalPages - 1 : results.length === MESSAGE_PAGE_SIZE);
      setSearchMode(true);
      setCurrentSearchIndex(-1);
    } catch (error) {
      console.error('Error searching messages:', error);
      alert('Не удалось выполнить поиск');
    } finally {
      setIsSearching(false);
    }
  }, [chatId]);

  // Автопоиск при изменении текста
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

  // Обработка Escape для закрытия поиска
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
    // Состояние
    searchText,
    searchResults,
    isSearching,
    searchMode,
    searchPage,
    hasMoreSearchResults,
    currentSearchIndex,
    searchOpen,
    searchInputRef,
    
    // Setters
    setSearchText,
    setSearchPage,
    setCurrentSearchIndex,
    
    // Обработчики
    handleSearch,
    handleSearchSubmit,
    handleOpenSearch,
    handleCloseSearch,
    handleNavigateToSearchResult
  };
};

