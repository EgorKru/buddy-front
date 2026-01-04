import "@/styles/globals.css";

import { useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { StompProvider } from "@/context/socket";
import { MessagingProvider } from "@/context/messaging";
import { VoicePlayerProvider } from "@/context/voicePlayer";
import GlobalNotifications from "@/component/GlobalNotifications";
import { isAuthenticated } from "@/utils/api";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isPublicRoute = useMemo(() => {
    const path = router?.pathname || "";
    return path === "/login" || path === "/register";
  }, [router?.pathname]);

  const authed = isAuthenticated();

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </Head>
      {isPublicRoute || !authed ? (
        <Component {...pageProps} />
      ) : (
        <StompProvider>
          <MessagingProvider>
            <VoicePlayerProvider>
              <Component {...pageProps} />
              <GlobalNotifications />
            </VoicePlayerProvider>
          </MessagingProvider>
        </StompProvider>
      )}
    </>
  );
}
