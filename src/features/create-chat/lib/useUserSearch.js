/**
 * Хук поиска пользователей с debounce и очисткой таймера при размонтировании.
 * FSD: features/create-chat/lib
 */
import { useState, useRef, useEffect } from 'react';
import { SEARCH_DELAY, MIN_SEARCH_LENGTH } from './constants';
import { getErrorMessage } from './getErrorMessage';

/**
 * @param {object} options
 * @param {import('@/shared/api').userAPI} options.userAPI
 * @param {string|number|null|undefined} options.currentUserId — исключить из результатов
 * @param {(message: string) => void} options.setError — callback для отображения ошибки (очищается при новом поиске)
 */
export function useUserSearch({ userAPI, currentUserId, setError }) {
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const searchUsers = async (query) => {
    if (!query || query.trim().length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const users = await userAPI.searchUsers(query);
      if (Array.isArray(users)) {
        const filtered = users.filter((u) => String(u.id) !== String(currentUserId));
        setSearchResults(filtered);
        setShowSearchResults(filtered.length > 0);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      setSearchResults([]);
      setShowSearchResults(false);
      const message = error?.message || '';
      if (!message.includes('404') && !message.includes('Not found')) {
        setError(getErrorMessage(error));
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInputChange = (value) => {
    setError('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value || value.trim().length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => searchUsers(value.trim()), SEARCH_DELAY);
  };

  const clearSearch = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = null;
    setSearchResults([]);
    setShowSearchResults(false);
    setError('');
  };

  return {
    searchResults,
    searching,
    showSearchResults,
    setShowSearchResults,
    searchInputRef,
    handleSearchInputChange,
    clearSearch,
  };
}
