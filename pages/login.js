import { useState, useRef } from 'react';
import InteractiveBackground from '@/component/InteractiveBackground';
import { usePagerEyes } from '@/shared/lib/hooks/usePagerEyes';
import { PagerEyes } from '@/shared/ui/PagerEyes';
import { useLogin } from '@/features/auth/lib/useLogin';
import { useAuthTheme } from '@/features/auth/lib/useAuthTheme';
import { LoginForm } from '@/features/auth/ui/LoginForm';
import { AuthThemeToggle } from '@/features/auth/ui/AuthThemeToggle';
import styles from '@/styles/login.module.css';

export default function Login() {
  const logoRef = useRef(null);
  const [isPagerEyesClosed, setIsPagerEyesClosed] = useState(false);
  const { theme, toggleTheme } = useAuthTheme();

  const login = useLogin();
  const { showLoader } = login;

  const pupilOffset = usePagerEyes(logoRef, isPagerEyesClosed, {
    useViewportCenter: showLoader,
    maxOffset: showLoader ? 6 : 4.5,
  });

  return (
    <>
      {showLoader && (
        <div
          className={`${styles.loaderOverlay} ${theme === 'light' ? styles.loaderOverlayLight : ''}`}
        >
          <PagerEyes variant="loader" isClosed={false} pupilOffset={pupilOffset} styles={styles} />
        </div>
      )}
      <div className={styles.container} data-theme={theme}>
        <AuthThemeToggle theme={theme} onToggle={toggleTheme} />
        <InteractiveBackground />
        <div className={styles.decorativeElements}>
          <div className={styles.floatingCircle} style={{ '--delay': '0s', '--duration': '20s' }} />
          <div className={styles.floatingCircle} style={{ '--delay': '5s', '--duration': '25s' }} />
          <div
            className={styles.floatingCircle}
            style={{ '--delay': '10s', '--duration': '30s' }}
          />
        </div>
        <div className={styles.formContainer}>
          <div className={styles.logoContainer}>
            <div className={styles.logoIcon} ref={logoRef}>
              <PagerEyes
                variant="logo"
                isClosed={isPagerEyesClosed}
                pupilOffset={pupilOffset}
                styles={styles}
              />
            </div>
          </div>
          <div className={styles.authHeader}>
            <h1>Вход</h1>
            <p className={styles.authSubtitle}>Войдите в аккаунт, чтобы продолжить</p>
          </div>
          <LoginForm
            {...login}
            onPasswordFocus={() => setIsPagerEyesClosed(true)}
            onPasswordBlur={() => setIsPagerEyesClosed(false)}
          />
        </div>
      </div>
    </>
  );
}
