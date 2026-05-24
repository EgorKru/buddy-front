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
        <title>Pager — чаты, звонки и приватность для команд</title>
        <meta
          name="description"
          content="Pager: групповые и личные чаты, шифрование личных диалогов, голосовые комнаты до 50 человек. Один сервис вместо мессенджера и отдельного созвона."
        />
      </Head>
      <LandingPage />
    </>
  );
}
