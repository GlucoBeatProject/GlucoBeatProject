'use client';
import { useState } from 'react';
import ChatInput from '@/components/ChatInput';
import { Button } from '@/components/ui/button';
import ChatBox from '@/components/chat/ChatBox';

export default function ChatUnifiedPage() {
  const [chatId, setChatId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const sendFirstMessage = async (msg: string) => {
    if (!msg.trim()) return;
    setLoading(true);

    setMsg(msg);

    try {
      if (!chatId) {
        const res = await fetch('http://localhost:4000/chat', {
          method: 'POST',
        });
        const data = await res.json();

        setChatId(data.chat_id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 mt-5 pb-5">
      {chatId === null ? (
        <div className="min-h-[calc(100dvh-200px)] flex flex-col items-center justify-center text-center">
          <h2 className="text-lg font-semibold mb-4">무엇을 도와드릴까요?</h2>
          <div className="flex gap-4 mb-6">
            <Button
              className="px-6 py-2 rounded-full"
              onClick={() => sendFirstMessage('보고서 보여줘')}
            >
              보고서 보기
            </Button>
            <Button
              className="px-6 py-2 rounded-full"
              onClick={() => sendFirstMessage('어제 혈당 알려줘')}
            >
              어제의 나
            </Button>
          </div>
        </div>
      ) : (
        <ChatBox chat_id={chatId} initialData={[]} initMsg={msg} />
      )}

      {chatId === null ? (
        <ChatInput onSend={sendFirstMessage} isDisabled={loading} />
      ) : null}
    </div>
  );
}
