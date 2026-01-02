import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/socket';
import { useRouter } from 'next/router';

const usePeer = () => {
  const socket = useSocket();
  const { roomId } = useRouter().query;
  const [peer, setPeer] = useState(null);
  const [myId, setMyId] = useState('');
  const isPeerSet = useRef(false);
  const peerRef = useRef(null);

  useEffect(() => {
    if (isPeerSet.current || !roomId || !socket) return;
    isPeerSet.current = true;

    let active = true;

    (async () => {
      try {
        const Peer = (await import('peerjs')).default;
        const myPeer = new Peer();
        peerRef.current = myPeer;
        if (!active) return;
        setPeer(myPeer);

        myPeer.on('open', (id) => {
          setMyId(id);
          socket?.emit('join-room', roomId, id);
        });
      } catch (e) {}
    })();

    return () => {
      active = false;
      const p = peerRef.current;
      if (p && !p.destroyed) {
        p.destroy();
      }
      peerRef.current = null;
    };
  }, [roomId, socket]);

  return { peer, myId };
};

export default usePeer;