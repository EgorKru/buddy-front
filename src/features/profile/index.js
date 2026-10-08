/**
 * Фича "профиль пользователя": форма настроек, сохранение. FSD: features/profile
 */
import { useState, useEffect, useRef } from 'react';
import { userAPI, setCurrentUser, getToken } from '@/shared/api';

function getFriendlyErrorMessage(err) {
  const msg = err?.message || '';
  if (msg.includes('подключиться') || msg.includes('fetch')) {
    return 'Не удалось подключиться к серверу. Проверьте подключение к интернету.';
  }
  return msg || 'Ошибка при обновлении профиля';
}

/**
 * Хук формы настроек профиля: состояние формы, сохранение, сравнение с начальными данными.
 * @param {object|null} user — текущий пользователь (из useAuth или getCurrentUser)
 * @returns {{
 *   formData: object,
 *   loading: boolean,
 *   saving: boolean,
 *   error: string,
 *   success: string,
 *   handleChange: function,
 *   handleSubmit: function
 * }}
 */
export function useProfile(user) {
  const initialFormDataRef = useRef(null);
  const userId = user?.id ?? null;
  const userUsername = user?.username || '';
  const userDisplayName = user?.displayName || '';
  const userEmail = user?.email || '';
  const userAvatarUrl = user?.avatarUrl || '';

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    avatarUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedUser, setSavedUser] = useState(user || null);

  useEffect(() => {
    if (userId != null) {
      const data = {
        displayName: userDisplayName,
        email: userEmail,
        avatarUrl: userAvatarUrl,
      };
      if (!initialFormDataRef.current) {
        initialFormDataRef.current = { ...data };
      }
      setFormData(data);
      setSavedUser({
        id: userId,
        username: userUsername,
        displayName: userDisplayName,
        email: userEmail,
        avatarUrl: userAvatarUrl,
      });
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [userId, userUsername, userDisplayName, userEmail, userAvatarUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const initial = initialFormDataRef.current || {};
      const updateData = {};

      if (formData.displayName !== initial.displayName) {
        updateData.displayName = formData.displayName;
      }
      if (formData.avatarUrl !== initial.avatarUrl) {
        updateData.avatarUrl = formData.avatarUrl;
      }

      if (Object.keys(updateData).length === 0) {
        setSuccess('Нет изменений для сохранения');
        setSaving(false);
        return;
      }

      const updatedUser = await userAPI.updateProfile(updateData);
      setCurrentUser(updatedUser, getToken());
      setSavedUser(updatedUser);
      initialFormDataRef.current = {
        displayName: updatedUser.displayName || '',
        email: updatedUser.email || '',
        avatarUrl: updatedUser.avatarUrl || '',
      };
      setFormData(initialFormDataRef.current);
      setSuccess('Профиль успешно обновлён!');
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    if (!initialFormDataRef.current) return;
    setFormData({ ...initialFormDataRef.current });
    setError('');
    setSuccess('');
  };

  const initial = initialFormDataRef.current;
  const dirty = Boolean(
    initial &&
    (formData.displayName !== initial.displayName || formData.avatarUrl !== initial.avatarUrl)
  );

  return {
    formData,
    loading,
    saving,
    error,
    success,
    dirty,
    savedUser,
    handleChange,
    handleSubmit,
    resetForm,
  };
}
