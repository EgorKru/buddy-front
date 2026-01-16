import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { authAPI, setCurrentUser } from '@/utils/api';
import { Eye, EyeOff } from 'lucide-react';
import InteractiveBackground from '@/component/InteractiveBackground';
import styles from '@/styles/login.module.css';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    verificationCode: '',
    displayName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isPagerEyesClosed, setIsPagerEyesClosed] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeTimer, setCodeTimer] = useState(0);
  const [resendTimer, setResendTimer] = useState(0);
  const verificationCodeInputRef = useRef(null);
  const logoRef = useRef(null);

  useEffect(() => {
    let animationFrameId = null;
    
    const handleMouseMove = (e) => {
      if (isPagerEyesClosed || !logoRef.current) return;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        
        const rect = logoRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        const maxOffset = 4.5;

        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        const distanceFactor = Math.min(dist / 100, 1.2);

        const desiredX = nx * maxOffset * distanceFactor;
        const desiredY = ny * maxOffset * distanceFactor;

        const clampedX = Math.max(-maxOffset, Math.min(maxOffset, desiredX));
        const clampedY = Math.max(-maxOffset, Math.min(maxOffset, desiredY));
        
        setPupilOffset({
          x: clampedX,
          y: clampedY,
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPagerEyesClosed]);

  useEffect(() => {
    if (codeTimer > 0) {
      const timer = setTimeout(() => setCodeTimer(codeTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [codeTimer]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (showCodeModal && verificationCodeInputRef.current) {
      setTimeout(() => {
        verificationCodeInputRef.current?.focus();
      }, 100);
    }
  }, [showCodeModal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'verificationCode') {
      const numericValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData(prev => ({
        ...prev,
        verificationCode: numericValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }

    if (name === 'password' || name === 'passwordConfirmation') {
      const password = name === 'password' ? value : formData.password;
      const passwordConfirmation = name === 'passwordConfirmation' ? value : formData.passwordConfirmation;
      
      if (passwordConfirmation && password && password !== passwordConfirmation) {
        setPasswordError('Пароли не совпадают');
      } else {
        setPasswordError('');
      }
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    
    setError('');
    setSendingCode(true);

    try {
      await authAPI.sendVerificationCode(formData.email);
      setCodeTimer(600); 
      setResendTimer(60); 
    } catch (err) {
      setError(err.message || 'Ошибка при отправке кода');
    } finally {
      setSendingCode(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      setCodeTimer(600); 
      setResendTimer(60); 
      setShowCodeModal(true);
    } catch (err) {
      if (err.message.includes('already exists')) {
        setError('Пользователь с таким email уже зарегистрирован');
      } else {
        setError(err.message || 'Ошибка при отправке кода');
      }
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
      
      if (formData.displayName) {
        registerData.displayName = formData.displayName;
      }

      const data = await authAPI.register(registerData);
      setCurrentUser(data.user, data.token);
      router.push('/');
    } catch (err) {
      let errorMessage = 'Ошибка при регистрации';
      
      if (err.message.includes('Passwords do not match')) {
        errorMessage = 'Пароли не совпадают';
      } else if (err.message.includes('Invalid or expired verification code')) {
        errorMessage = 'Неверный или истекший код подтверждения';
      } else if (err.message.includes('username already exists')) {
        errorMessage = 'Пользователь с таким именем уже существует';
      } else if (err.message.includes('email already exists')) {
        errorMessage = 'Пользователь с таким email уже существует';
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <InteractiveBackground />
      <div className={styles.decorativeElements}>
        <div className={styles.floatingCircle} style={{ '--delay': '0s', '--duration': '20s' }}></div>
        <div className={styles.floatingCircle} style={{ '--delay': '5s', '--duration': '25s' }}></div>
        <div className={styles.floatingCircle} style={{ '--delay': '10s', '--duration': '30s' }}></div>
      </div>
      <div className={styles.formContainer}>
        <div className={styles.logoContainer}>
          <div className={styles.logoIcon} ref={logoRef}>
            <div className={styles.logoIconWrapper}>
              <div
                className={`${styles.pagerEyesRow} ${isPagerEyesClosed ? styles.pagerEyesClosed : ''}`}
              >
                <div className={styles.pagerEye}>
                  <div
                    className={styles.pagerPupil}
                    style={{
                      transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
                    }}
                  />
                </div>
                <div className={styles.pagerEye}>
                  <div
                    className={styles.pagerPupil}
                    style={{
                      transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <h1>Регистрация</h1>
        <form onSubmit={handleRegister}>
          <div className={styles.formGroup}>
            <label htmlFor="register-username">Имя пользователя</label>
            <input
              type="text"
              id="register-username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={20}
              placeholder="Введите имя пользователя"
              autoComplete="username"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="register-email">Email</label>
            <input
              type="email"
              id="register-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Введите email"
              autoComplete="email"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="register-displayName">Отображаемое имя (необязательно)</label>
            <input
              type="text"
              id="register-displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Как вас называть?"
              autoComplete="name"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="register-password">Пароль</label>
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                id="register-password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setIsPagerEyesClosed(true)}
                onBlur={() => setIsPagerEyesClosed(false)}
                onMouseEnter={() => setIsPagerEyesClosed(true)}
                onMouseLeave={() => setIsPagerEyesClosed(false)}
                required
                minLength={6}
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="register-passwordConfirmation">Подтверждение пароля</label>
            <div className={styles.passwordContainer}>
              <input
                type={showPasswordConfirmation ? "text" : "password"}
                id="register-passwordConfirmation"
                name="passwordConfirmation"
                value={formData.passwordConfirmation}
                onChange={handleChange}
                onFocus={() => setIsPagerEyesClosed(true)}
                onBlur={() => setIsPagerEyesClosed(false)}
                onMouseEnter={() => setIsPagerEyesClosed(true)}
                onMouseLeave={() => setIsPagerEyesClosed(false)}
                required
                minLength={6}
                placeholder="Повторите пароль"
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                tabIndex={-1}
              >
                {showPasswordConfirmation ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {passwordError && (
              <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                {passwordError}
              </div>
            )}
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" disabled={loading || passwordError} className={styles.button}>
            {loading ? 'Отправка кода...' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className={styles.link}>
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </div>

      {showCodeModal && (
        <div className={styles.codeModalOverlay} onClick={(e) => e.target === e.currentTarget && setShowCodeModal(false)}>
          <div className={styles.codeModalContainer}>
            <div className={styles.codeModalContent}>
              <h2>Введите код подтверждения</h2>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px' }}>
                Код отправлен на {formData.email}
              </p>
              {codeTimer > 0 && (
                <p style={{ color: '#10b981', fontSize: '12px', marginBottom: '16px' }}>
                  Код действителен {formatTime(codeTimer)}
                </p>
              )}
              <input
                ref={verificationCodeInputRef}
                type="text"
                name="verificationCode"
                value={formData.verificationCode}
                onChange={handleChange}
                maxLength={6}
                placeholder="000000"
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '28px',
                  fontWeight: '600',
                  textAlign: 'center',
                  letterSpacing: '12px',
                  border: '2px solid #3b82f6',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  fontFamily: 'monospace',
                  backgroundColor: '#0f0f14',
                  color: '#ffffff',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#60a5fa';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = 'none';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.verificationCode.length === 6) {
                    handleSubmitCode();
                  }
                }}
              />
              {resendTimer > 0 ? (
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
                  Отправить повторно через {resendTimer}с
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={sendingCode}
                  style={{
                    fontSize: '14px',
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #3b82f6',
                    color: '#3b82f6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '20px'
                  }}
                >
                  {sendingCode ? 'Отправка...' : 'Отправить код повторно'}
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmitCode}
                disabled={loading || formData.verificationCode.length !== 6}
                className={styles.button}
                style={{ width: '100%' }}
              >
                {loading ? 'Регистрация...' : 'Подтвердить'}
              </button>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                style={{
                  marginTop: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
