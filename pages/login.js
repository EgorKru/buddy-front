import Head from 'next/head';
import { useLogin } from '@/features/auth/lib/useLogin';
import { LoginForm } from '@/features/auth/ui/LoginForm';
import { AuthLayout } from '@/surface/auth';
import { Loader } from '@/shared/ui/Loader';
import ds from '@/design-system/primitives.module.css';

export default function Login() {
  const login = useLogin();
  const { showLoader } = login;

  return (
    <>
      <Head>
        <title>Вход — Pager</title>
      </Head>
      {showLoader ? (
        <div className={ds.loaderOverlay}>
          <Loader text="Вход…" />
        </div>
      ) : null}
      <AuthLayout
        mode="login"
        title="С возвращением"
        subtitle="Войдите, чтобы продолжить переписку."
      >
        <LoginForm {...login} />
      </AuthLayout>
    </>
  );
}
