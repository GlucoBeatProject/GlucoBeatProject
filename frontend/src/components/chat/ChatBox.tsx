'use client';

import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import ChatInput from '../ChatInput';
import { SyncLoader } from 'react-spinners';
import { DataTable } from '../table/DataTable';
import { CodeBlock } from './CodeBlock';
import { parseNestedJsonString } from '@/lib/parseNestedJsonString';

interface StreamEventData {
  type: 'text' | 'tool_call' | 'error' | 'tool_result';
  content: any;
}

interface Message {
  msg_id: number;
  date: Date;
  who: 'user' | 'assistant' | 'system' | 'tool' | 'tool_call' | 'tool_result';
  msg: string | object;
  tool_title?: string;
}

interface Props {
  chat_id: string | number;
  initialData: Message[];
  initMsg?: string;
}

function ChatBox({ chat_id, initialData, initMsg }: Props) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const scrollToBottom = () => {
    if (window) {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleSend = async (msg: string) => {
    if (!msg.trim() || isLoading) return;

    setIsLoading(true);

    const userMessage: Message = {
      msg_id: Date.now(),
      date: new Date(),
      who: 'user',
      msg,
    };

    const initialAssistantMsgId = Date.now() + 1;
    const firstAssistantPlaceholder: Message = {
      msg_id: initialAssistantMsgId,
      date: new Date(),
      who: 'assistant',
      msg: '',
    };
    setData((prev) => [...prev, userMessage, firstAssistantPlaceholder]);

    try {
      const response = await fetch(
        `http://127.0.0.1:4000/chat/${chat_id}/message/stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msg }),
        }
      );

      if (!response.body) throw new Error('응답 스트림이 없습니다.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let isFirstChunk = true;
      let currentAssistantMsgId = initialAssistantMsgId;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventStr of events) {
          if (eventStr.startsWith('data:')) {
            const jsonStr = eventStr.substring(6).trim();
            if (jsonStr) {
              try {
                const eventData: StreamEventData = JSON.parse(jsonStr);
                if (isFirstChunk) {
                  isFirstChunk = false;

                  if (eventData.type !== 'text') {
                    setData((prev) =>
                      prev.filter((m) => m.msg_id !== initialAssistantMsgId)
                    );
                  }
                }

                switch (eventData.type) {
                  case 'text':
                    setData((prev) =>
                      prev.map((m) =>
                        m.msg_id === currentAssistantMsgId
                          ? { ...m, msg: m.msg + (eventData.content as string) }
                          : m
                      )
                    );
                    break;

                  case 'tool_call':
                    const toolCallMsg: Message = {
                      msg_id: Date.now() + Math.random(),
                      date: new Date(),
                      who: 'tool_call',
                      msg: `${eventData.content.args.query}`,
                      tool_title: `[요청] ${eventData.content.name}`,
                    };
                    setData((prev) => [...prev, toolCallMsg]);
                    break;

                  case 'tool_result':
                    const toolResultMsg: Message = {
                      msg_id: Date.now() + Math.random(),
                      date: new Date(),
                      who: 'tool',
                      msg: eventData.content.output,
                      tool_title: `[응답] ${eventData.content.name}`,
                    };

                    const newAssistantPlaceholder: Message = {
                      msg_id: Date.now() + Math.random() + 1,
                      date: new Date(),
                      who: 'assistant',
                      msg: '',
                    };

                    currentAssistantMsgId = newAssistantPlaceholder.msg_id;

                    setData((prev) => [
                      ...prev,
                      toolResultMsg,
                      newAssistantPlaceholder,
                    ]);
                    break;

                  case 'error':
                    const errorMsg: Message = {
                      msg_id: Date.now() + Math.random(),
                      date: new Date(),
                      who: 'system',
                      msg: `[오류] ${eventData.content}`,
                    };
                    setData((prev) => [...prev, errorMsg]);
                    break;
                }
              } catch (error) {
                console.error('JSON 파싱 오류:', jsonStr, error);
              }
            }
          }
        }
      }
    } catch (e) {
      const errorMsg: Message = {
        msg_id: Date.now(),
        date: new Date(),
        who: 'system',
        msg: '죄송합니다. 메시지 전송 중 오류가 발생했습니다.',
      };
      setData((prev) => [...prev, errorMsg]);
    } finally {
      setData((prev) =>
        prev.filter((m) => !(m.who === 'assistant' && m.msg === ''))
      );
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (initMsg) {
      handleSend(initMsg);
    }
  }, []);

  return (
    <>
      <div className="flex flex-col gap-4">
        {data.length > 0 &&
          data.map((data: any) => {
            switch (data.who) {
              case 'user':
                return (
                  <div
                    key={data.msg_id}
                    className="flex justify-end gap-1 items-end"
                  >
                    <span className="text-xs text-gray-300">
                      {format(data.date, 'HH:mm')}
                    </span>
                    <p className="p-3 rounded-md bg-primary text-white w-fit">
                      {data.msg}
                    </p>
                  </div>
                );
              case 'assistant':
                if (data.msg === '') {
                  return (
                    <div key={data.msg_id} className="flex items-end gap-1">
                      <p className="p-3 px-4 rounded-2xl bg-gluco-chat-gray w-fit max-w-4/5">
                        <SyncLoader
                          size={8}
                          color="#acacac"
                          speedMultiplier={0.6}
                        />
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={data.msg_id} className="flex items-end gap-1">
                    <p className="p-3 rounded-md bg-gluco-chat-gray w-fit max-w-4/5 whitespace-pre-wrap">
                      {data.msg as string}
                    </p>
                    <span className="text-xs text-gray-300">
                      {format(data.date, 'HH:mm')}
                    </span>
                  </div>
                );
              case 'tool_result':
              case 'tool':
                try {
                  if (data.tool_title) {
                    const jsonString = data.msg.replace(/'/g, '"');
                    const obj = JSON.parse(jsonString);
                    const columns = obj.columns.map((column: any) => ({
                      accessorKey: column,
                      header: column,
                    }));
                    const rows = obj.rows;
                    return (
                      <div key={data.msg_id} className="pb-5">
                        <DataTable columns={columns} data={rows} />
                      </div>
                    );
                  }

                  const obj = parseNestedJsonString(data.msg);
                  if (!obj) return null;
                  const columns = obj.output.columns.map((column: any) => ({
                    accessorKey: column,
                    header: column,
                  }));
                  const rows = obj.output.rows;
                  return (
                    <div key={data.msg_id} className="pb-5">
                      <DataTable columns={columns} data={rows} />
                    </div>
                  );
                } catch (e) {
                  return (
                    <div
                      key={data.msg_id}
                      className="text-red-500 text-sm text-center"
                    >
                      테이블 렌더링에 오류가 발생하였습니다.
                    </div>
                  );
                }
              case 'tool_call':
                if (data.tool_title) {
                  return (
                    <div
                      key={data.msg_id}
                      className="w-full p-3 rounded-md border border-border"
                    >
                      <p className="text-sm text-gray-400">
                        {data.tool_title as string}
                      </p>
                      <CodeBlock content={`\`\`\`${data.msg}\`\`\``} />
                    </div>
                  );
                } else {
                  const jsonString = data.msg.replace(/'/g, '"');
                  const obj = JSON.parse(jsonString);
                  return (
                    <div
                      key={data.msg_id}
                      className="w-full p-3 rounded-md border border-border"
                    >
                      <p className="text-sm text-gray-400">
                        {obj.name as string}
                      </p>
                      <CodeBlock content={`\`\`\`${obj.args.query}\`\`\``} />
                    </div>
                  );
                }
            }
          })}
      </div>
      <ChatInput isDisabled={isLoading} onSend={handleSend} />
    </>
  );
}

export default ChatBox;