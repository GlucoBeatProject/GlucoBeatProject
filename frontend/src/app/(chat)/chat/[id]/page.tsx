import ChatBox from '@/components/chat/ChatBox';

async function ChatDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const chatData = await (
    await fetch(`http://127.0.0.1:4000/chat/${id}`)
  ).json();

  return (
    <>
      <ChatBox chat_id={id} initialData={chatData.messages} />
    </>
  );
}

export default ChatDetailPage;
