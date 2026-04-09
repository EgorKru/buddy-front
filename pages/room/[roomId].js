import dynamic from 'next/dynamic';

const RoomPage = dynamic(() => import('@/components/room/RoomPage'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Загрузка комнаты...
    </div>
  ),
});

export default function RoomRoute() {
  return <RoomPage />;
}
