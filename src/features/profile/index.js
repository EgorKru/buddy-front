/**
 * Фича "профиль пользователя": форма настроек, сохранение. FSD: features/profile
 */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { userAPI, setCurrentUser, getToken } from '@/shared/api';

const REDIRECT_DELAY_MS = 2000;

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
  const router = useRouter();
  const initialFormDataRef = useRef(null);
  const redirectTimeoutRef = useRef(null);

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    avatarUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      const data = {
        displayName: user.displayName || '',
        email: user.email || '',
        avatarUrl: user.avatarUrl || '',
      };
      if (!initialFormDataRef.current) {
        initialFormDataRef.current = { ...data };
      }
      setFormData(data);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

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
      initialFormDataRef.current = {
        displayName: updatedUser.displayName || '',
        email: updatedUser.email || '',
        avatarUrl: updatedUser.avatarUrl || '',
      };
      setFormData(initialFormDataRef.current);
      setSuccess('Профиль успешно обновлён!');

      redirectTimeoutRef.current = setTimeout(() => {
        router.push('/');
      }, REDIRECT_DELAY_MS);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return {
    formData,
    loading,
    saving,
    error,
    success,
    handleChange,
    handleSubmit,
  };
}
