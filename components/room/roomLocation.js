export function parseRoomLocation(location) {
  const pathname = location?.pathname || '';
  const match = pathname.match(/\/room\/([^/?]+)/);
  const params = new URLSearchParams(location?.search || '');

  return {
    roomId: match?.[1] ? decodeURIComponent(match[1]) : null,
    audio: params.has('audio') ? params.get('audio') : undefined,
    video: params.has('video') ? params.get('video') : undefined,
  };
}
