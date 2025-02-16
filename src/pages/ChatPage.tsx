// src/ChatPage.tsx
import React, { useState } from 'react';

import './ChatPage.css';
import Sidebar from './Sidebar';

const ChatPage: React.FC = () => {
  // Example initial messages
  const [messages, setMessages] = useState<string[]>([
    "Ok, I can definitely aid you more! To give you the most relevant and interesting information, could you let me know more about?\n\n" +
    "For example, you might be interested in:\n" +
    "1) My new capabilities (how I work, the technology behind me - GPT-4?),\n" +
    "2) A specific topic? (history, science, current events, a hobby, etc),\n" +
    "3) Something practical? (help with a task, a recommendation, a definition)\n\n" +
    "The more specific you are, the better I can tailor my response!"
  ]);
  
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages(prev => [...prev, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="chat-layout">
      {/* LEFT SIDEBAR */}
      <Sidebar />

      {/* MAIN CHAT AREA */}
      <div className="chat-main">
        {/* HEADER */}
        <div className="chat-header">
          <button className="tell-me-more-btn">tell me more</button>
        </div>

        {/* MESSAGES */}
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div className="message" key={index}>
              {msg}
            </div>
          ))}
        </div>

        {/* INPUT BAR */}
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Type your message here..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="send-btn" onClick={handleSend}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
