import "@/styles/globals.css";

import { StompProvider } from "@/context/socket";
import { MessagingProvider } from "@/context/messaging";
import GlobalNotifications from "@/component/GlobalNotifications";

export default function App({ Component, pageProps }) {
  return (
    <StompProvider>
      <MessagingProvider>
        <Component {...pageProps} />
        <GlobalNotifications />
      </MessagingProvider>
    </StompProvider>
  );
}
