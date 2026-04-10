/**
 * Форма регистрации: поля и кнопка, отображение ошибок. FSD: features/auth
 */
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { VerificationCodeModal } from '../VerificationCodeModal';
import styles from '@/styles/login.module.css';

function RegisterUsernameField({ formData, handleChange, handleBlur, usernameError }) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor="register-username">Имя пользователя</label>
      <input
        type="text"
        id="register-username"
        name="username"
        value={formData.username}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Введите имя пользователя"
        autoComplete="username"
        className={usernameError ? styles.inputInvalid : undefined}
        aria-invalid={usernameError ? 'true' : 'false'}
        aria-describedby={usernameError ? 'register-username-error' : undefined}
      />
      {usernameError ? (
        <p id="register-username-error" className={styles.fieldError} role="alert">
          {usernameError}
        </p>
      ) : null}
    </div>
  );
}

function RegisterEmailField({ formData, handleChange, handleBlur, emailError }) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor="register-email">Email</label>
      <input
        type="email"
        id="register-email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Введите email"
        autoComplete="email"
        className={emailError ? styles.inputInvalid : undefined}
        aria-invalid={emailError ? 'true' : 'false'}
        aria-describedby={emailError ? 'register-email-error' : undefined}
      />
      {emailError ? (
        <p id="register-email-error" className={styles.fieldError} role="alert">
          {emailError}
        </p>
      ) : null}
    </div>
  );
}

function RegisterDisplayNameField({ formData, handleChange, handleBlur }) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor="register-displayName">Отображаемое имя (необязательно)</label>
      <input
        type="text"
        id="register-displayName"
        name="displayName"
        value={formData.displayName}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Как вас называть?"
        autoComplete="name"
      />
    </div>
  );
}

function RegisterPasswordField({
  formData,
  handleChange,
  handleBlur,
  passwordError,
  onPasswordFocus,
  onPasswordBlur,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
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
          onBlur={(e) => {
            handleBlur(e);
            onPasswordBlur?.();
          }}
          onMouseEnter={onPasswordFocus}
          onMouseLeave={onPasswordBlur}
          placeholder="Минимум 6 символов"
          autoComplete="new-password"
          className={passwordError ? styles.inputInvalid : undefined}
          aria-invalid={passwordError ? 'true' : 'false'}
          aria-describedby={passwordError ? 'register-password-error' : undefined}
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
      {passwordError ? (
        <p id="register-password-error" className={styles.fieldError} role="alert">
          {passwordError}
        </p>
      ) : null}
    </div>
  );
}

function RegisterPasswordConfirmationField({
  formData,
  handleChange,
  handleBlur,
  passwordConfirmationError,
  onPasswordFocus,
  onPasswordBlur,
}) {
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  return (
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
          onBlur={(e) => {
            handleBlur(e);
            onPasswordBlur?.();
          }}
          onMouseEnter={onPasswordFocus}
          onMouseLeave={onPasswordBlur}
          placeholder="Повторите пароль"
          autoComplete="new-password"
          className={passwordConfirmationError ? styles.inputInvalid : undefined}
          aria-invalid={passwordConfirmationError ? 'true' : 'false'}
          aria-describedby={
            passwordConfirmationError ? 'register-passwordConfirmation-error' : undefined
          }
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
      {passwordConfirmationError ? (
        <p id="register-passwordConfirmation-error" className={styles.fieldError} role="alert">
          {passwordConfirmationError}
        </p>
      ) : null}
    </div>
  );
}

export function RegistrationForm({
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
  onPasswordFocus,
  onPasswordBlur,
}) {
  return (
    <>
      <form onSubmit={handleRegister} noValidate>
        <RegisterUsernameField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          usernameError={usernameError}
        />
        <RegisterEmailField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          emailError={emailError}
        />
        <RegisterDisplayNameField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
        />
        <RegisterPasswordField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          passwordError={passwordError}
          onPasswordFocus={onPasswordFocus}
          onPasswordBlur={onPasswordBlur}
        />
        <RegisterPasswordConfirmationField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          passwordConfirmationError={passwordConfirmationError}
          onPasswordFocus={onPasswordFocus}
          onPasswordBlur={onPasswordBlur}
        />
        {!showCodeModal && error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Отправка кода...' : 'Зарегистрироваться'}
        </button>
      </form>

      {showCodeModal ? (
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
          onVerificationCodeBlur={handleVerificationCodeBlur}
          formatTime={formatTime}
          error={error}
          verificationCodeError={verificationCodeError}
        />
      ) : null}
    </>
  );
}
