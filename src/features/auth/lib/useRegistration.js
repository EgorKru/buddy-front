/**
 * Хук логики регистрации: форма, отправка кода, подтверждение, таймеры. FSD: features/auth
 */
import { useState } from 'react';
import { useRouter } from 'next/router';
import { authAPI, setCurrentUser } from '@/shared/api';
import { useCodeTimer } from './useCodeTimer';

const CODE_TTL = 600;
const RESEND_DELAY = 60;

const initialFormData = {
  username: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  verificationCode: '',
  displayName: '',
};

function getRegisterErrorMessage(err) {
  const msg = err?.message || '';
  if (msg.includes('Passwords do not match')) return 'Пароли не совпадают';
  if (msg.includes('Invalid or expired verification code'))
    return 'Неверный или истекший код подтверждения';
  if (msg.includes('username already exists')) return 'Пользователь с таким именем уже существует';
  if (msg.includes('email already exists')) return 'Пользователь с таким email уже существует';
  if (msg.includes('already exists')) return 'Пользователь с таким email уже зарегистрирован';
  return msg || 'Ошибка при регистрации';
}

export function useRegistration() {
  const router = useRouter();
  const { codeTimer, resendTimer, startTimers } = useCodeTimer(CODE_TTL, RESEND_DELAY);

  const [formData, setFormData] = useState(initialFormData);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'verificationCode') {
      const numericValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData((prev) => ({ ...prev, verificationCode: numericValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (name === 'password' || name === 'passwordConfirmation') {
      const pwd = name === 'password' ? value : formData.password;
      const conf = name === 'passwordConfirmation' ? value : formData.passwordConfirmation;
      setPasswordError(conf && pwd && pwd !== conf ? 'Пароли не совпадают' : '');
    }
    setError('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.passwordConfirmation) {
      setPasswordError('Пароли не совпадают');
      return;
    }
    if (!formData.email) {
      setError('Введите email');
      return;
    }
    setLoading(true);
    setSendingCode(true);
    try {
      await authAPI.sendVerificationCode(formData.email);
      startTimers();
      setShowCodeModal(true);
    } catch (err) {
      setError(getRegisterErrorMessage(err));
    } finally {
      setLoading(false);
      setSendingCode(false);
    }
  };

  const handleSubmitCode = async () => {
    if (formData.verificationCode.length !== 6) {
      setError('Введите 6-значный код подтверждения');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const registerData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        passwordConfirmation: formData.passwordConfirmation,
        verificationCode: formData.verificationCode,
      };
      if (formData.displayName) registerData.displayName = formData.displayName;
      const data = await authAPI.register(registerData);
      setCurrentUser(data.user, data.token);
      if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_E2EE_ENABLED === 'true') {
        import('@/shared/lib/e2ee/directTextE2ee')
          .then((m) => m.ensureIdentityKeyPublished())
          .catch(() => {});
      }
      router.push('/');
    } catch (err) {
      setError(getRegisterErrorMessage(err));
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setError('');
    setSendingCode(true);
    try {
      await authAPI.sendVerificationCode(formData.email);
      startTimers();
    } catch (err) {
      setError(err?.message || 'Ошибка при отправке кода');
    } finally {
      setSendingCode(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    formData,
    error,
    passwordError,
    loading,
    sendingCode,
    showCodeModal,
    setShowCodeModal,
    codeTimer,
    resendTimer,
    handleChange,
    handleRegister,
    handleSubmitCode,
    handleResendCode,
    formatTime,
  };
}
