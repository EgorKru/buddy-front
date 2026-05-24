/**
 * Хук логики регистрации: форма, отправка кода, подтверждение, таймеры. FSD: features/auth
 */
import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { authAPI, setCurrentUser } from '@/shared/api';
import { useCodeTimer } from './useCodeTimer';
import { sanitizeApiErrorMessage } from '@/shared/lib/sanitizeApiErrorMessage';
import {
  getRegisterUsernameError,
  getRegisterPasswordError,
  getRegisterEmailError,
  getRegisterPasswordConfirmationError,
  getVerificationCodeError,
} from './registrationFieldValidation';

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

const initialTouched = {
  username: false,
  email: false,
  password: false,
  passwordConfirmation: false,
};

function getRegisterErrorMessage(err) {
  const msg = err?.message || '';
  if (msg.includes('Passwords do not match')) return 'Пароли не совпадают';
  if (msg.includes('Invalid or expired verification code'))
    return 'Неверный или истекший код подтверждения';
  if (msg.includes('username already exists')) return 'Пользователь с таким именем уже существует';
  if (msg.includes('email already exists')) return 'Пользователь с таким email уже существует';
  if (msg.includes('already exists')) return 'Пользователь с таким email уже зарегистрирован';
  return sanitizeApiErrorMessage(msg) || 'Ошибка при регистрации';
}

export function useRegistration() {
  const router = useRouter();
  const { codeTimer, resendTimer, startTimers } = useCodeTimer(CODE_TTL, RESEND_DELAY);

  const [formData, setFormData] = useState(initialFormData);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(initialTouched);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [attemptedCodeSubmit, setAttemptedCodeSubmit] = useState(false);

  const requireUsername = touched.username || attemptedSubmit;
  const requireEmail = touched.email || attemptedSubmit;
  const requirePassword = touched.password || attemptedSubmit;
  const requirePasswordConfirmation = touched.passwordConfirmation || attemptedSubmit;
  const requireCodeEmpty = codeTouched || attemptedCodeSubmit;

  const usernameError = useMemo(
    () => getRegisterUsernameError(formData.username, { requireNonEmpty: requireUsername }),
    [formData.username, requireUsername]
  );

  const emailError = useMemo(
    () => getRegisterEmailError(formData.email, { requireNonEmpty: requireEmail }),
    [formData.email, requireEmail]
  );

  const passwordError = useMemo(
    () => getRegisterPasswordError(formData.password, { requireNonEmpty: requirePassword }),
    [formData.password, requirePassword]
  );

  const passwordConfirmationError = useMemo(
    () =>
      getRegisterPasswordConfirmationError(formData.password, formData.passwordConfirmation, {
        requireNonEmpty: requirePasswordConfirmation,
      }),
    [formData.password, formData.passwordConfirmation, requirePasswordConfirmation]
  );

  const verificationCodeError = useMemo(
    () =>
      getVerificationCodeError(formData.verificationCode, { requireNonEmpty: requireCodeEmpty }),
    [formData.verificationCode, requireCodeEmpty]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'verificationCode') {
      const numericValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData((prev) => ({ ...prev, verificationCode: numericValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    if (name in initialTouched) {
      setTouched((prev) => ({ ...prev, [name]: true }));
    }
  };

  const handleVerificationCodeBlur = () => {
    setCodeTouched(true);
  };

  const openCodeModal = () => {
    setAttemptedCodeSubmit(false);
    setCodeTouched(false);
    setShowCodeModal(true);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setAttemptedSubmit(true);
    setTouched({
      username: true,
      email: true,
      password: true,
      passwordConfirmation: true,
    });

    const uErr = getRegisterUsernameError(formData.username, { requireNonEmpty: true });
    const eErr = getRegisterEmailError(formData.email, { requireNonEmpty: true });
    const pErr = getRegisterPasswordError(formData.password, { requireNonEmpty: true });
    const cErr = getRegisterPasswordConfirmationError(
      formData.password,
      formData.passwordConfirmation,
      { requireNonEmpty: true }
    );
    if (uErr || eErr || pErr || cErr) {
      return;
    }

    setLoading(true);
    setSendingCode(true);
    try {
      await authAPI.sendVerificationCode(formData.email.trim());
      startTimers();
      openCodeModal();
    } catch (err) {
      setError(getRegisterErrorMessage(err));
    } finally {
      setLoading(false);
      setSendingCode(false);
    }
  };

  const handleSubmitCode = async () => {
    setAttemptedCodeSubmit(true);
    setCodeTouched(true);
    setError('');

    const codeErr = getVerificationCodeError(formData.verificationCode, { requireNonEmpty: true });
    if (codeErr) {
      return;
    }

    setLoading(true);
    try {
      const registerData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        passwordConfirmation: formData.passwordConfirmation,
        verificationCode: formData.verificationCode,
      };
      if (formData.displayName.trim()) registerData.displayName = formData.displayName.trim();
      const data = await authAPI.register(registerData);
      setCurrentUser(data.user, data.token);
      if (typeof window !== 'undefined') {
        import('@/shared/lib/e2ee/directTextE2ee')
          .then((m) => {
            if (m.isE2eeEnabled()) return m.ensureIdentityKeyPublished();
          })
          .catch(() => {});
      }
      router.push('/app');
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
      await authAPI.sendVerificationCode(formData.email.trim());
      startTimers();
    } catch (err) {
      setError(sanitizeApiErrorMessage(err?.message || '') || 'Ошибка при отправке кода');
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
    loading,
    sendingCode,
    showCodeModal,
    setShowCodeModal,
    codeTimer,
    resendTimer,
    usernameError,
    emailError,
    passwordError,
    passwordConfirmationError,
    verificationCodeError,
    handleChange,
    handleBlur,
    handleVerificationCodeBlur,
    handleRegister,
    handleSubmitCode,
    handleResendCode,
    formatTime,
  };
}
