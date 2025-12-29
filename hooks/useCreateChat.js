import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { chatAPI, userAPI, getCurrentUser } from '@/utils/api';

/**
 * Хук для создания чатов (прямых и групповых)
 * @returns {Object} Объект с функциями и состоянием для создания чата
 */
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

  /**
   * Поиск пользователей по username
   */
  const searchUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    try {
      const users = await userAPI.searchUsers(query);
      const filteredUsers = users.filter(u => u.id !== user?.id);
      setSearchResults(filteredUsers);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  /**
   * Обработка изменения поля поиска
   */
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setParticipantUsernames(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  /**
   * Выбор участника из результатов поиска
   */
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

  /**
   * Удаление участника из списка
   */
  const handleRemoveParticipant = (userId) => {
    setSelectedParticipants(selectedParticipants.filter(p => p.id !== userId));
  };

  /**
   * Создание чата
   */
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
      console.error('Ошибка создания чата:', error);
      setCreateError(error.message || 'Ошибка при создании чата');
      throw error;
    } finally {
      setCreating(false);
    }
  };

  /**
   * Сброс формы создания чата
   */
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
    // State
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
    
    // Handlers
    handleSearchInputChange,
    handleSelectParticipant,
    handleRemoveParticipant,
    handleCreateChat,
    resetForm,
    setShowSearchResults,
  };
};

