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
  formatTime,
  error,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && verificationCode.length === 6) onSubmit();
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
            maxLength={6}
            placeholder="000000"
            className={styles.verificationCodeInput}
            onKeyDown={handleKeyDown}
            aria-label="Код подтверждения из email"
          />
          {error && <div className={styles.error}>{error}</div>}
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
            disabled={loading || verificationCode.length !== 6}
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
