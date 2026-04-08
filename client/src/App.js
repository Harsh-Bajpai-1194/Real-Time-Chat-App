import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

import GoogleSignIn from './GoogleSignIn';
import EmojiPicker from 'emoji-picker-react';

// Connect to the backend server (dynamic for production vs local/codespaces)
const socket = io(process.env.NODE_ENV === 'production' ? undefined : "https://miniature-tribble-v6546w6q6wxrhr6j-3000.app.github.dev");

const getFormattedTime = (timestamp) => {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};


function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const messagesEndRef = useRef(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for incoming chat messages
    socket.on('chat message', (message) => {
      setMessages((prevMessages) => [...prevMessages, { ...message, type: 'chat', time: getFormattedTime(message.timestamp) }]);
    });

    // Listen for system messages (e.g., user joins)
    socket.on('system message', (message) => {
      setMessages((prevMessages) => [...prevMessages, { text: message, type: 'system', time: getFormattedTime() }]);
    });

    // Load chat history sent from server
    socket.on('chat history', (history) => {
      const formattedHistory = history.map(msg => ({ ...msg, type: 'chat', time: getFormattedTime(msg.timestamp) }));
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
    if (room.trim()) {
      let finalUsername = username;
      // Generate a random guest username if they didn't sign in with Google
      if (!username.trim()) {
        finalUsername = `GuestUser${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        setUsername(finalUsername);
      }
      socket.emit('set username', finalUsername, room);
      socket.emit('join room', room);
      setIsLoggedIn(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (currentMessage.trim()) {
      socket.emit('chat message', currentMessage, room);
      
      setCurrentMessage('');
      setShowEmojiPicker(false); // Hide picker after sending message
    }
  };

  const handleGoogleSignIn = (user) => {
    setUsername(user.name);
    setShowRoomForm(true); // Move to the next step automatically
  };

  const handleLeaveRoom = () => {
    socket.emit('leave room', room);
    setIsLoggedIn(false);
    setRoom('');
    setMessages([]);
  };

  if (!isLoggedIn) {
    return (
      <div className="login-container" style={{ position: 'relative' }}>
        <button 
          onClick={() => setShowRoomForm(true)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '20px',
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Join Room
        </button>
        {!showRoomForm ? (
          <div className="login-form">
            <h2>Join Chat</h2>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <GoogleSignIn onSignIn={handleGoogleSignIn} />
            </div>
            <p style={{ textAlign: 'center', margin: '0 0 15px 0', opacity: 0.7 }}>— OR —</p>

            <button type="button" onClick={() => setShowRoomForm(true)}>
              Join as a Guest User
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="login-form">
            <h2>Join Room</h2>
            
            {!username ? (
              <p style={{ textAlign: 'center', margin: '0 0 15px 0' }}>Joining as <strong>Guest</strong></p>
            ) : (
              <p style={{ textAlign: 'center', margin: '0 0 15px 0' }}>Welcome, <strong>{username}</strong>!</p>
            )}

            <input
              type="text"
              placeholder="Enter room name"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              required
            />
            <button type="submit">Join Room</button>
            <button type="button" onClick={() => { setShowRoomForm(false); setUsername(''); }} style={{ backgroundColor: '#e9ecef', color: '#333' }}>Back</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0' }}>Room: {room}</h1>
          <p style={{ margin: 0 }}>Welcome, {username}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleLeaveRoom}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff4d4d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Leave Room
          </button>
          <button 
            onClick={() => {
              handleLeaveRoom();
              setShowRoomForm(true);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Join Room
          </button>
        </div>
      </header>

      <main className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message-item ${msg.type === 'system' ? 'system' : ''}`}>
            {msg.type === 'chat' && <span className="username">{msg.username}:</span>}
            <span className="text">{msg.text}</span>
              <span className="timestamp" style={{ fontSize: '0.75rem', color: '#888', marginLeft: '10px' }}>{msg.time}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <form onSubmit={sendMessage} className="message-form" style={{ position: 'relative' }}>
        {showEmojiPicker && (
          <div style={{ position: 'absolute', bottom: '100%', left: '0', zIndex: 100, marginBottom: '10px' }}>
            <EmojiPicker onEmojiClick={(emojiObject) => setCurrentMessage(prev => prev + emojiObject.emoji)} />
          </div>
        )}
        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0 10px' }}>
          😀
        </button>
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
