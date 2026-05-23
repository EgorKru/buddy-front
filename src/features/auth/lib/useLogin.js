/**
 * Хук логики входа: форма, отправка, загрузчик, редирект. FSD: features/auth
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { authAPI, setCurrentUser } from '@/shared/api';
import { sanitizeApiErrorMessage } from '@/shared/lib/sanitizeApiErrorMessage';
import { getLoginUsernameError, getLoginPasswordError } from './loginFieldValidation';

const LOADER_DURATION_MS = 2000;

function getLoginErrorMessage(err) {
  const msg = err?.message || '';
  if (msg.includes('подключиться') || msg.includes('fetch') || msg.includes('Network')) {
    return 'Не удалось подключиться к серверу. Проверьте подключение к интернету.';
  }
  return sanitizeApiErrorMessage(msg) || 'Неверное имя пользователя или пароль';
}

export function useLogin() {
  const router = useRouter();
  const isMountedRef = useRef(true);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const requireUsernameEmpty = touched.username || attemptedSubmit;
  const requirePasswordEmpty = touched.password || attemptedSubmit;

  const usernameError = useMemo(
    () => getLoginUsernameError(formData.username, { requireNonEmpty: requireUsernameEmpty }),
    [formData.username, requireUsernameEmpty]
  );

  const passwordError = useMemo(
    () => getLoginPasswordError(formData.password, { requireNonEmpty: requirePasswordEmpty }),
    [formData.password, requirePasswordEmpty]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    if (name === 'username' || name === 'password') {
      setTouched((prev) => ({ ...prev, [name]: true }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setAttemptedSubmit(true);
    setTouched({ username: true, password: true });

    const username = formData.username.trim();
    const password = formData.password;

    const uErr = getLoginUsernameError(formData.username, { requireNonEmpty: true });
    const pErr = getLoginPasswordError(password, { requireNonEmpty: true });
    if (uErr || pErr) {
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.login(username, password);
      setCurrentUser(data.user, data.token);
      if (typeof window !== 'undefined') {
        import('@/shared/lib/e2ee/directTextE2ee')
          .then((m) => {
            if (m.isE2eeEnabled()) return m.ensureIdentityKeyPublished();
          })
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
    usernameError,
    passwordError,
    handleChange,
    handleBlur,
    handleLogin,
  };
}
