/**
 * Login form — v2 design system.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import ds from '@/design-system/primitives.module.css';

function LoginUsernameField({ formData, handleChange, handleBlur, usernameError }) {
  return (
    <div className={ds.field}>
      <label htmlFor="login-username">Email or username</label>
      <span className={ds.fieldHint}>Use the same identifier you registered with.</span>
      <input
        type="text"
        id="login-username"
        name="username"
        value={formData.username}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="you@company.com or username"
        autoComplete="username"
        className={`${ds.input} ${usernameError ? ds.inputInvalid : ''}`}
        aria-invalid={usernameError ? 'true' : 'false'}
        aria-describedby={usernameError ? 'login-username-error' : undefined}
      />
      {usernameError ? (
        <p id="login-username-error" className={ds.fieldError} role="alert">
          {usernameError}
        </p>
      ) : null}
    </div>
  );
}

function LoginPasswordField({ formData, handleChange, handleBlur, passwordError, error }) {
  const [showPassword, setShowPassword] = useState(false);

  const describedBy = [passwordError ? 'login-password-error' : null, error ? 'login-error' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={ds.field}>
      <label htmlFor="login-password">Password</label>
      <div className={ds.passwordWrap}>
        <input
          type={showPassword ? 'text' : 'password'}
          id="login-password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Enter your password"
          autoComplete="current-password"
          className={`${ds.input} ${passwordError ? ds.inputInvalid : ''}`}
          aria-invalid={passwordError ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
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
        <p id="login-password-error" className={ds.fieldError} role="alert">
          {passwordError}
        </p>
      ) : null}
    </div>
  );
}

export function LoginForm({
  formData,
  error,
  loading,
  usernameError,
  passwordError,
  handleChange,
  handleBlur,
  handleLogin,
}) {
  return (
    <>
      <form className={ds.formStack} onSubmit={handleLogin} noValidate>
        <LoginUsernameField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          usernameError={usernameError}
        />
        <LoginPasswordField
          formData={formData}
          handleChange={handleChange}
          handleBlur={handleBlur}
          passwordError={passwordError}
          error={error}
        />
        {error ? (
          <div id="login-error" className={ds.formError} role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" disabled={loading} className={ds.btnPrimary}>
          {loading ? 'Signing in...' : 'Log in'}
        </button>
      </form>
      <p className={ds.footerLink}>
        Don&apos;t have an account? <Link href="/register">Get started</Link>
      </p>
    </>
  );
}
