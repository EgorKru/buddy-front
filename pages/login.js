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
        <title>Log in — Pager</title>
      </Head>
      {showLoader ? (
        <div className={ds.loaderOverlay}>
          <Loader text="Signing in..." />
        </div>
      ) : null}
      <AuthLayout title="Welcome back" subtitle="Log in to continue your conversations.">
        <LoginForm {...login} />
      </AuthLayout>
    </>
  );
}
