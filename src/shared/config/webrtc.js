/**
 * Конфиг ICE-серверов для WebRTC. Можно переопределить через env или расширить в приложении.
 * FSD: shared/config
 */
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
