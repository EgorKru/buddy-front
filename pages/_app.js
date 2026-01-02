import "@/styles/globals.css";

import { useMemo } from "react";
import { useRouter } from "next/router";
import { StompProvider } from "@/context/socket";
import { MessagingProvider } from "@/context/messaging";
import GlobalNotifications from "@/component/GlobalNotifications";
import { isAuthenticated } from "@/utils/api";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isPublicRoute = useMemo(() => {
    const path = router?.pathname || "";
    return path === "/login" || path === "/register";
  }, [router?.pathname]);

  const authed = isAuthenticated();

  if (isPublicRoute || !authed) {
    return <Component {...pageProps} />;
  }

  return (
    <StompProvider>
      <MessagingProvider>
        <Component {...pageProps} />
        <GlobalNotifications />
      </MessagingProvider>
    </StompProvider>
  );
}
