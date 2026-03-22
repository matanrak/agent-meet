import { MeetingRoom } from "@/components/MeetingRoom";

interface RoomPageProps {
  params: Promise<{ room_code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { room_code } = await params;

  return <MeetingRoom roomCode={room_code} />;
}
