import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Connect to the backend server (dynamic for production vs local/codespaces)
const socket = io(process.env.NODE_ENV === 'production' ? undefined : "https://miniature-tribble-v6546w6q6wxrhr6j-3000.app.github.dev");


function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for incoming chat messages
    socket.on('chat message', (message) => {
      setMessages((prevMessages) => [...prevMessages, { ...message, type: 'chat' }]);
    });

    // Listen for system messages (e.g., user joins)
    socket.on('system message', (message) => {
      setMessages((prevMessages) => [...prevMessages, { text: message, type: 'system' }]);
    });

    // Load chat history sent from server
    socket.on('chat history', (history) => {
      const formattedHistory = history.map(msg => ({ ...msg, type: 'chat' }));
      setMessages(formattedHistory);
    });

    // Clean up listeners on component unmount
    return () => {
      socket.off('chat message');
      socket.off('system message');
      socket.off('chat history');
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() && room.trim()) {
      socket.emit('set username', username, room);
      socket.emit('join room', room);
      setIsLoggedIn(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (currentMessage.trim()) {
      socket.emit('chat message', currentMessage, room);
      
      setCurrentMessage('');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          <h2>Join Chat</h2>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Enter room name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
          />
          <button type="submit">Join</button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Room: {room}</h1>
        <p>Welcome, {username}</p>
      </header>
      <main className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message-item ${msg.type === 'system' ? 'system' : ''}`}>
            {msg.type === 'chat' && <span className="username">{msg.username}:</span>}
            <span className="text">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>
      <form onSubmit={sendMessage} className="message-form">
        <input
          type="text"
          placeholder="Type a message..."
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default App;
