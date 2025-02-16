// src/ChatPage.tsx
import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import './ChatPage.css';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'llm';
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! How can I help you today? I'm running on the Gemini 2.0 Flash model, so I should be able to respond quickly.",
      sender: 'llm',
    },
    {
      id: 2,
      text: "whats up?",
      sender: 'user',
    },
    {
      id: 3,
      text: "Not much! Just here and ready to assist. How about you? Anything interesting happening on your end?",
      sender: 'llm',
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, text: inputValue.trim(), sender: 'user' },
      ]);
      setInputValue('');
      // For a real app, you might fetch an LLM response here
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-layout">
      <Sidebar />

      <div className="chat-main">
        <div className="chat-messages">
          {messages.map((msg) => (
            <div className={`message ${msg.sender}`} key={msg.id}>
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* BOTTOM INPUT AREA */}
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Type your message here..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="chat-controls">
            <div className="left-controls">
              <button className="model-select">Gemini 2.0 Flash ▼</button>
              <button className="system-settings-btn">System Settings</button>
            </div>
            <div className="right-controls">
              <button className="send-btn" onClick={handleSend}>
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
