import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../services/geminiService';
import ChatMessageComponent from './ChatMessage';

interface ChatContainerProps {
  messages: ChatMessage[];
}

export default function ChatContainer({ messages }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className='flex-1 overflow-y-auto p-4 space-y-4'>
      {messages.length === 0 ? (
        <div className='flex items-center justify-center h-full'>
          <div className='text-center text-gray-500'>
            <div className='text-6xl mb-4'>🤖</div>
            <h3 className='text-xl font-semibold mb-2'>Welcome to AI Chat</h3>
            <p className='text-sm'>Start a conversation with Gemini AI</p>
          </div>
        </div>
      ) : (
        messages.map(message => (
          <ChatMessageComponent key={message.id} {...message} />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
