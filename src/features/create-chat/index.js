/**
 * Фича "создание чата": поиск пользователей, создание личного/группового чата. FSD: features
 */
import { useState } from 'react';
import { useRouter } from 'next/router';
import { chatAPI, userAPI, getCurrentUser } from '@/shared/api';
import { useUserSearch } from './lib/useUserSearch';
import { getErrorMessage } from './lib/getErrorMessage';

export const useCreateChat = () => {
  const router = useRouter();
  const user = getCurrentUser();

  const [chatType, setChatType] = useState('DIRECT');
  const [chatName, setChatName] = useState('');
  const [participantUsernames, setParticipantUsernames] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const {
    searchResults,
    searching,
    showSearchResults,
    setShowSearchResults,
    searchInputRef,
    handleSearchInputChange: handleSearchInputChangeBase,
    clearSearch,
  } = useUserSearch({
    userAPI,
    currentUserId: user?.id,
    setError: setCreateError,
  });

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setParticipantUsernames(value);
    handleSearchInputChangeBase(value);
  };

  const handleSelectParticipant = (selectedUser) => {
    if (selectedParticipants.some((p) => p.id === selectedUser.id)) return;
    setSelectedParticipants([...selectedParticipants, selectedUser]);
    setParticipantUsernames('');
    setShowSearchResults(false);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleRemoveParticipant = (userId) => {
    setSelectedParticipants(selectedParticipants.filter((p) => p.id !== userId));
  };

  const handleCreateChat = async (onSuccess) => {
    setCreateError('');
    if (chatType === 'GROUP' && !chatName.trim()) {
      setCreateError('Название группы обязательно');
      return;
    }
    const participantIds = selectedParticipants.map((p) => p.id);
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
        chat = await chatAPI.createChat({
          type: 'GROUP',
          name: chatName.trim(),
          participantIds,
        });
      }
      if (onSuccess) await onSuccess();
      router.push(`/chat/${chat.id}`);
      return chat;
    } catch (error) {
      setCreateError(getErrorMessage(error));
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
    setCreateError('');
    clearSearch();
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
