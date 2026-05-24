import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { isAuthenticated } from '@/utils/api';
import { LandingPage } from '@/surface/marketing';
import { Loader } from '@/shared/ui/Loader';

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/app');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <Loader fullPage text="Загрузка…" />;
  }

  return (
    <>
      <Head>
        <title>Pager — Безопасные сообщения и звонки</title>
        <meta
          name="description"
          content="Безопасные сообщения и звонки для сфокусированных команд. Чат в реальном времени, надёжный reconnect и приватные личные диалоги."
        />
      </Head>
      <LandingPage />
    </>
  );
}
