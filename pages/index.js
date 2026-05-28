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
        <title>Pager — Цифровой ассистент для жизни и работы</title>
        <meta
          name="description"
          content="Pager помогает организовывать задачи, встречи, коммуникацию и рабочие процессы — автоматически, с AI-помощью и без хаоса."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&family=Anybody:wght@600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </Head>
      <LandingPage />
    </>
  );
}
