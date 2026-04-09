/**
 * Форма регистрации: поля и кнопка, отображение ошибок. FSD: features/auth
 */
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { VerificationCodeModal } from '../VerificationCodeModal';
import styles from '@/styles/login.module.css';

export function RegistrationForm({
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
  onPasswordFocus,
  onPasswordBlur,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  return (
    <>
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
              type={showPassword ? 'text' : 'password'}
              id="register-password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={onPasswordFocus}
              onBlur={onPasswordBlur}
              onMouseEnter={onPasswordFocus}
              onMouseLeave={onPasswordBlur}
              required
              minLength={6}
              placeholder="Минимум 6 символов"
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="register-passwordConfirmation">Подтверждение пароля</label>
          <div className={styles.passwordContainer}>
            <input
              type={showPasswordConfirmation ? 'text' : 'password'}
              id="register-passwordConfirmation"
              name="passwordConfirmation"
              value={formData.passwordConfirmation}
              onChange={handleChange}
              onFocus={onPasswordFocus}
              onBlur={onPasswordBlur}
              onMouseEnter={onPasswordFocus}
              onMouseLeave={onPasswordBlur}
              required
              minLength={6}
              placeholder="Повторите пароль"
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
              aria-label={showPasswordConfirmation ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPasswordConfirmation ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {passwordError && <div className={styles.passwordError}>{passwordError}</div>}
        </div>
        {!showCodeModal && error && <div className={styles.error}>{error}</div>}
        <button type="submit" disabled={loading || !!passwordError} className={styles.button}>
          {loading ? 'Отправка кода...' : 'Зарегистрироваться'}
        </button>
      </form>

      {showCodeModal && (
        <VerificationCodeModal
          email={formData.email}
          onClose={() => setShowCodeModal(false)}
          onSubmit={handleSubmitCode}
          onResend={handleResendCode}
          loading={loading}
          sendingCode={sendingCode}
          codeTimer={codeTimer}
          resendTimer={resendTimer}
          verificationCode={formData.verificationCode}
          onChange={handleChange}
          formatTime={formatTime}
          error={error}
        />
      )}
    </>
  );
}
