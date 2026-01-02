import "@/styles/globals.css";

import { StompProvider } from "@/context/socket";
import { ChatsProvider } from "@/context/chats";

export default function App({ Component, pageProps }) {
  return (
    <StompProvider>
      <ChatsProvider>
        <Component {...pageProps} />
      </ChatsProvider>
    </StompProvider>
  );
}
