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
      {messages.map(message => (
        <ChatMessageComponent key={message.id} {...message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
