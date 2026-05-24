/**
 * Registration form — v2 design system.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { VerificationCodeModal } from '../VerificationCodeModal';
import ds from '@/design-system/primitives.module.css';

function RegisterUsernameField({ formData, handleChange, handleBlur, usernameError }) {
  return (
    <div className={ds.field}>
      <label htmlFor="register-username">Username</label>
      <input
        type="text"
        id="register-username"
        name="username"
        value={formData.username}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Choose a username"
        autoComplete="username"
        className={`${ds.input} ${usernameError ? ds.inputInvalid : ''}`}
        aria-invalid={usernameError ? 'true' : 'false'}
        aria-describedby={usernameError ? 'register-username-error' : undefined}
      />
      {usernameError ? (
        <p id="register-username-error" className={ds.fieldError} role="alert">
          {usernameError}
        </p>
      ) : null}
    </div>
  );
}

function RegisterEmailField({ formData, handleChange, handleBlur, emailError }) {
  return (
    <div className={ds.field}>
      <label htmlFor="register-email">Email</label>
      <input
        type="email"
        id="register-email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="you@company.com"
        autoComplete="email"
        className={`${ds.input} ${emailError ? ds.inputInvalid : ''}`}
        aria-invalid={emailError ? 'true' : 'false'}
        aria-describedby={emailError ? 'register-email-error' : undefined}
      />
      {emailError ? (
        <p id="register-email-error" className={ds.fieldError} role="alert">
          {emailError}
        </p>
      ) : null}
    </div>
  );
}

function RegisterPasswordField({ formData, handleChange, handleBlur, passwordError }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={ds.field}>
      <label htmlFor="register-password">Password</label>
      <span className={ds.fieldHint}>At least 6 characters.</span>
      <div className={ds.passwordWrap}>
        <input
          type={showPassword ? 'text' : 'password'}
          id="register-password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Create a password"
          autoComplete="new-password"
          className={`${ds.input} ${passwordError ? ds.inputInvalid : ''}`}
          aria-invalid={passwordError ? 'true' : 'false'}
          aria-describedby={passwordError ? 'register-password-error' : undefined}
        />
        <button
          type="button"
          className={ds.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {passwordError ? (
        <p id="register-password-error" className={ds.fieldError} role="alert">
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
}) {
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  return (
    <div className={ds.field}>
      <label htmlFor="register-passwordConfirmation">Confirm password</label>
      <div className={ds.passwordWrap}>
        <input
          type={showPasswordConfirmation ? 'text' : 'password'}
          id="register-passwordConfirmation"
          name="passwordConfirmation"
          value={formData.passwordConfirmation}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Repeat your password"
          autoComplete="new-password"
          className={`${ds.input} ${passwordConfirmationError ? ds.inputInvalid : ''}`}
          aria-invalid={passwordConfirmationError ? 'true' : 'false'}
          aria-describedby={
            passwordConfirmationError ? 'register-passwordConfirmation-error' : undefined
          }
        />
        <button
          type="button"
          className={ds.passwordToggle}
          onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
          aria-label={showPasswordConfirmation ? 'Hide password' : 'Show password'}
        >
          {showPasswordConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {passwordConfirmationError ? (
        <p id="register-passwordConfirmation-error" className={ds.fieldError} role="alert">
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
}) {
  const submitLabel = loading
    ? sendingCode
      ? 'Sending code...'
      : 'Creating account...'
    : 'Get started';

  return (
    <>
      <form className={ds.formStack} onSubmit={handleRegister} noValidate>
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
        <RegisterPasswordField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          passwordError={passwordError}
        />
        <RegisterPasswordConfirmationField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          passwordConfirmationError={passwordConfirmationError}
        />
        {!showCodeModal && error ? (
          <div className={ds.formError} role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" disabled={loading} className={ds.btnPrimary}>
          {submitLabel}
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

      <p className={ds.footerLink}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
