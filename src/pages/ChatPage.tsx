import React, { useState, useRef, useEffect } from 'react';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
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
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);

  // Auto-scroll to the bottom when messages change
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
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`app-layout 
        ${!rightSidebarVisible ? 'right-collapsed' : ''} 
        ${!leftSidebarVisible ? 'left-collapsed' : ''}`}
    >
      {/* Left App Menu Sidebar */}
      <LeftSidebar collapsed={!leftSidebarVisible} />

      {/* Toggle Button for the Left Sidebar */}
      <button
        className="toggle-left-sidebar-btn"
        onClick={() => setLeftSidebarVisible((prev) => !prev)}
      >
        {leftSidebarVisible ? '←' : '☰'}
      </button>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-messages">
          {messages.map((msg) => (
            <div className={`message ${msg.sender}`} key={msg.id}>
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
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
              <button className="attachment-btn">📎</button>
            </div>
            <div className="right-controls">
              <button className="send-btn" onClick={handleSend}>
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Message History Sidebar */}
      <RightSidebar collapsed={!rightSidebarVisible} />

      {/* Toggle Button for the Right Sidebar */}
      <button
        className="toggle-right-sidebar-btn"
        onClick={() => setRightSidebarVisible((prev) => !prev)}
      >
        {rightSidebarVisible ? '→' : '☰'}
      </button>
    </div>
  );
};

export default ChatPage;
