'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FaArrowUp } from 'react-icons/fa';

interface ChatInputProps {
  isDisabled?: boolean;
  onSend: (message: string) => void;
}

export default function ChatInput({ isDisabled, onSend }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage('');
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 w-full p-4 flex justify-center bg-white">
      <form className="flex items-center gap-2 h-20 border border-gray-300 focus-within:shadow-md rounded-md p-3 bg-white lg:w-[720px] w-full">
        <Input
          className="flex-1 h-10 text-sm border-0 focus:outline-0"
          placeholder="메시지를 입력하세요..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button
          className="disabled:cursor-not-allowed rounded-full w-10 h-10"
          disabled={isDisabled}
          variant="default"
          onClick={handleSend}
        >
          <FaArrowUp size={20} />
        </Button>
      </form>
    </div>
  );
}