/**
 * Модальное окно кода подтверждения — v2 design system.
 */
import { useRef, useEffect } from 'react';
import ds from '@/design-system/primitives.module.css';

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
    <div className={ds.modalOverlay} onClick={handleOverlayClick}>
      <div
        className={ds.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-modal-title"
      >
        <h2 id="code-modal-title" className={ds.modalTitle}>
          Введите код подтверждения
        </h2>
        <p className={ds.modalHint}>Код отправлен на {email}</p>
        {codeTimer > 0 ? (
          <p className={ds.modalTimer}>Код действителен ещё {formatTime(codeTimer)}</p>
        ) : null}
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
          className={`${ds.input} ${verificationCodeError ? ds.inputInvalid : ''}`}
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
          <p id="register-verification-code-error" className={ds.fieldError} role="alert">
            {verificationCodeError}
          </p>
        ) : null}
        {error ? (
          <div id="register-code-api-error" className={ds.formError} role="alert">
            {error}
          </div>
        ) : null}
        {resendTimer > 0 ? (
          <p className={ds.modalTimer}>Повторная отправка через {resendTimer} с</p>
        ) : (
          <button
            type="button"
            className={ds.btnSecondary}
            onClick={onResend}
            disabled={sendingCode}
          >
            {sendingCode ? 'Отправка…' : 'Отправить код повторно'}
          </button>
        )}
        <div className={ds.modalActions}>
          <button type="button" onClick={onSubmit} disabled={loading} className={ds.btnPrimary}>
            {loading ? 'Создание аккаунта…' : 'Подтвердить'}
          </button>
          <button type="button" onClick={onClose} className={ds.modalLinkBtn}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
