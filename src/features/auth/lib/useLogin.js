/**
 * Хук логики входа: форма, отправка, загрузчик, редирект. FSD: features/auth
 */
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { authAPI, setCurrentUser } from '@/shared/api';

const LOADER_DURATION_MS = 2000;

function getLoginErrorMessage(err) {
  const msg = err?.message || '';
  if (msg.includes('подключиться') || msg.includes('fetch') || msg.includes('Network')) {
    return 'Не удалось подключиться к серверу. Проверьте подключение к интернету.';
  }
  return msg || 'Неверное имя пользователя или пароль';
}

export function useLogin() {
  const router = useRouter();
  const isMountedRef = useRef(true);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const username = formData.username.trim();
    const password = formData.password;
    if (!username) {
      setError('Введите имя пользователя');
      return;
    }
    if (!password) {
      setError('Введите пароль');
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.login(username, password);
      setCurrentUser(data.user, data.token);
      if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_E2EE_ENABLED === 'true') {
        import('@/shared/lib/e2ee/directTextE2ee')
          .then((m) => m.ensureIdentityKeyPublished())
          .catch(() => {});
      }
      setShowLoader(true);

      await new Promise((resolve) => setTimeout(resolve, LOADER_DURATION_MS));

      if (isMountedRef.current) {
        router.push('/');
      }
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    error,
    loading,
    showLoader,
    handleChange,
    handleLogin,
  };
}
