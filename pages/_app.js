import "@/styles/globals.css";

import { StompProvider } from "@/context/socket";
import { ChatsProvider } from "@/context/chats";
import GlobalNotifications from "@/component/GlobalNotifications";

export default function App({ Component, pageProps }) {
  return (
    <StompProvider>
      <ChatsProvider>
        <Component {...pageProps} />
        <GlobalNotifications />
      </ChatsProvider>
    </StompProvider>
  );
}
