import "@/styles/globals.css";

import { StompProvider } from "@/context/socket";

export default function App({ Component, pageProps }) {
  return (
    <StompProvider>
      <Component {...pageProps} />
    </StompProvider>
  );
}
