/**
 * Модальное окно ввода кода подтверждения. FSD: features/auth
 */
import { useRef, useEffect } from 'react';
import styles from '@/styles/login.module.css';

export function VerificationCodeModal({
  email,
  onClose,
  onSubmit,
  onResend,
  loading,
  sendingCode,
  codeTimer,
  resendTimer,
  verificationCode,
  onChange,
  onVerificationCodeBlur,
  formatTime,
  error,
  verificationCodeError,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={styles.codeModalOverlay} onClick={handleOverlayClick}>
      <div className={styles.codeModalContainer}>
        <div className={styles.codeModalContent}>
          <h2>Введите код подтверждения</h2>
          <p className={styles.codeModalHint}>Код отправлен на {email}</p>
          {codeTimer > 0 && (
            <p className={styles.codeModalTimer}>Код действителен {formatTime(codeTimer)}</p>
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            name="verificationCode"
            value={verificationCode}
            onChange={onChange}
            onBlur={onVerificationCodeBlur}
            maxLength={6}
            placeholder="000000"
            className={`${styles.verificationCodeInput}${
              verificationCodeError ? ` ${styles.inputInvalid}` : ''
            }`}
            onKeyDown={handleKeyDown}
            aria-label="Код подтверждения из email"
            aria-invalid={verificationCodeError ? 'true' : 'false'}
            aria-describedby={
              [
                verificationCodeError ? 'register-verification-code-error' : null,
                error ? 'register-code-api-error' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
          />
          {verificationCodeError ? (
            <p id="register-verification-code-error" className={styles.fieldError} role="alert">
              {verificationCodeError}
            </p>
          ) : null}
          {error ? (
            <div id="register-code-api-error" className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
          {resendTimer > 0 ? (
            <p className={styles.codeModalResendWait}>Отправить повторно через {resendTimer}с</p>
          ) : (
            <button
              type="button"
              className={styles.codeModalResendButton}
              onClick={onResend}
              disabled={sendingCode}
            >
              {sendingCode ? 'Отправка...' : 'Отправить код повторно'}
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className={`${styles.button} ${styles.codeModalButtonFull}`}
          >
            {loading ? 'Регистрация...' : 'Подтвердить'}
          </button>
          <button type="button" onClick={onClose} className={styles.codeModalCancelButton}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
