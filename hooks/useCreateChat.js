import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { chatAPI, userAPI, getCurrentUser } from '@/utils/api';

const SEARCH_DELAY = 300;
const MIN_SEARCH_LENGTH = 2;

export const useCreateChat = () => {
  const router = useRouter();
  const user = getCurrentUser();

  const [chatType, setChatType] = useState('DIRECT');
  const [chatName, setChatName] = useState('');
  const [participantUsernames, setParticipantUsernames] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  const searchUsers = async (query) => {
    if (!query || query.trim().length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    setCreateError('');
    try {
      const users = await userAPI.searchUsers(query);
      if (Array.isArray(users)) {
        const filteredUsers = users.filter(u => u.id !== user?.id);
        setSearchResults(filteredUsers);
        setShowSearchResults(filteredUsers.length > 0);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      setSearchResults([]);
      setShowSearchResults(false);
      
      const errorMessage = error.message || '';
      if (errorMessage.includes('500') || errorMessage.includes('Internal server error')) {
        setCreateError('Сервер временно недоступен. Попробуйте позже.');
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setCreateError('Необходима авторизация');
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        setCreateError('Доступ запрещен');
      } else if (errorMessage.includes('404') || errorMessage.includes('Not found')) {
        setSearchResults([]);
        setShowSearchResults(false);
      } else {
        setCreateError('Ошибка при поиске пользователей');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setParticipantUsernames(value);
    setCreateError('');

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value || value.trim().length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value.trim());
    }, SEARCH_DELAY);
  };

  const handleSelectParticipant = (selectedUser) => {
    if (selectedParticipants.some(p => p.id === selectedUser.id)) {
      return;
    }

    setSelectedParticipants([...selectedParticipants, selectedUser]);
    setParticipantUsernames('');
    setSearchResults([]);
    setShowSearchResults(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveParticipant = (userId) => {
    setSelectedParticipants(selectedParticipants.filter(p => p.id !== userId));
  };

  const handleCreateChat = async (onSuccess) => {
    setCreateError('');

    if (chatType === 'GROUP' && !chatName.trim()) {
      setCreateError('Название группы обязательно');
      return;
    }

    const participantIds = selectedParticipants.map(p => p.id);

    if (participantIds.length === 0) {
      setCreateError('Выберите хотя бы одного участника');
      return;
    }

    if (chatType === 'DIRECT' && participantIds.length !== 1) {
      setCreateError('Для прямого чата выберите одного пользователя');
      return;
    }

    setCreating(true);
    try {
      let chat;
      if (chatType === 'DIRECT') {
        chat = await chatAPI.getDirectChat(participantIds[0]);
      } else {
        const chatData = {
          type: 'GROUP',
          name: chatName.trim(),
          participantIds: participantIds,
        };
        chat = await chatAPI.createChat(chatData);
      }

      if (onSuccess) {
        await onSuccess();
      }

      router.push(`/chat/${chat.id}`);
      return chat;
    } catch (error) {
      setCreateError(error.message || 'Ошибка при создании чата');
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setChatType('DIRECT');
    setChatName('');
    setParticipantUsernames('');
    setSelectedParticipants([]);
    setSearchResults([]);
    setShowSearchResults(false);
    setCreateError('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  return {
    chatType,
    setChatType,
    chatName,
    setChatName,
    participantUsernames,
    selectedParticipants,
    searchResults,
    searching,
    showSearchResults,
    creating,
    createError,
    searchInputRef,
    handleSearchInputChange,
    handleSelectParticipant,
    handleRemoveParticipant,
    handleCreateChat,
    resetForm,
    setShowSearchResults,
  };
};
