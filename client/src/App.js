import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

import GoogleSignIn from './GoogleSignIn';
import EmojiPicker from 'emoji-picker-react';
import { getSocketUrl } from './socket';

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
  const socketRef = useRef(null);
  const pendingJoinRef = useRef(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const backgroundColors = ['#FFFFFF', '#F0F8FF', '#FAEBD7', '#E6E6FA', '#FFF0F5', '#282c34'];
  const [backgroundColor, setBackgroundColor] = useState(backgroundColors[0]);
  const backgroundOptions = [
    'aqua.png',
    'green.png',
    'yellow.png',
    'orange.png',
    'pink.png',
    'red.png',
    'brown.png',
    'navy-blue.png',
    'sky-blue.png',
    'violet.png',
  ];
  const [selectedBackground, setSelectedBackground] = useState('');

  const toggleBackgroundPicker = () => {
    setShowBackgroundPicker((prev) => !prev);
  };

  const selectBackground = (bg) => {
    setSelectedBackground(bg);
    setShowBackgroundPicker(false);
  };

  const changeBackground = () => {
    const currentIndex = backgroundColors.indexOf(backgroundColor);
    const nextIndex = (currentIndex + 1) % backgroundColors.length;
    setBackgroundColor(backgroundColors[nextIndex]);
    setSelectedBackground('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const newSocket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;

    const handleConnect = () => {
      const pendingJoin = pendingJoinRef.current;
      if (pendingJoin) {
        newSocket.emit('set username', pendingJoin.username, pendingJoin.room);
        newSocket.emit('join room', pendingJoin.room);
      }
    };

    const handleChatMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, { ...message, type: 'chat', time: getFormattedTime(message.timestamp) }]);
    };

    const handleSystemMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, { text: message, type: 'system', time: getFormattedTime() }]);
    };

    const handleChatHistory = (history) => {
      const formattedHistory = history.map(msg => ({ ...msg, type: 'chat', time: getFormattedTime(msg.timestamp) }));
      setMessages(formattedHistory);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('chat message', handleChatMessage);
    newSocket.on('system message', handleSystemMessage);
    newSocket.on('chat history', handleChatHistory);

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('chat message', handleChatMessage);
      newSocket.off('system message', handleSystemMessage);
      newSocket.off('chat history', handleChatHistory);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinChatRoom = (roomName, selectedUsername) => {
    const socket = socketRef.current;
    const nextRoom = roomName.trim();
    const nextUsername = selectedUsername.trim() || `GuestUser${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    pendingJoinRef.current = { room: nextRoom, username: nextUsername };

    if (socket?.connected) {
      socket.emit('set username', nextUsername, nextRoom);
      socket.emit('join room', nextRoom);
    } else {
      setMessages((prevMessages) => [...prevMessages, { text: 'Connecting to the chat server...', type: 'system', time: getFormattedTime() }]);
    }

    setUsername(nextUsername);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (room.trim()) {
      joinChatRoom(room, username);
      setIsLoggedIn(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const trimmedMessage = currentMessage.trim();
    if (!trimmedMessage) {
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      setMessages((prevMessages) => [...prevMessages, { text: 'Unable to send right now. Please wait for the connection to finish.', type: 'system', time: getFormattedTime() }]);
      return;
    }

    socket.emit('chat message', trimmedMessage, room.trim());
    setCurrentMessage('');
    setShowEmojiPicker(false);
  };

  const handleGoogleSignIn = (user) => {
    setUsername(user.name);
    setShowRoomForm(true); // Move to the next step automatically
  };

  const handleLeaveRoom = () => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('leave room', room);
    }
    pendingJoinRef.current = null;
    setIsLoggedIn(false);
    setRoom('');
    setMessages([]);
  };

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="top-right-button">
          <button className="btn-success" onClick={() => setShowRoomForm(true)}>Join Room</button>
        </div>
        {!showRoomForm ? (
          <div className="login-form">
            <h2>Join Chat</h2>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <GoogleSignIn onSignIn={handleGoogleSignIn} />
            </div>
            <p style={{ textAlign: 'center', margin: '0 0 15px 0', opacity: 0.7 }}>— OR —</p>

            <button className="btn-primary" type="button" onClick={() => setShowRoomForm(true)}>
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
            <div className="form-actions">
              <button className="btn-primary" type="submit">Join Room</button>
              <button className="btn-secondary" type="button" onClick={() => { setShowRoomForm(false); setUsername(''); }}>Back</button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className={`chat-container${selectedBackground ? ' background-selected' : ''}`} style={{
      backgroundColor: selectedBackground ? 'transparent' : backgroundColor,
      backgroundImage: selectedBackground ? `url(${process.env.PUBLIC_URL}/Backgrounds/${selectedBackground})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      <header className="chat-header">
        <div className="chat-header-info">
          <h1>Room: {room}</h1>
          <p>Welcome, {username}</p>
        </div>
        <div className="chat-header-actions">
          <button className="btn-secondary change-bg-btn" onClick={toggleBackgroundPicker}>Change Background</button>
          <button className="btn-danger" onClick={handleLeaveRoom}>Leave Room</button>
          <button className="btn-success"
            onClick={() => {
              handleLeaveRoom();
              setShowRoomForm(true);
            }}
          >
            Join Room
          </button>
        </div>
      </header>
      {showBackgroundPicker && (
        <div className="background-picker">
          {backgroundOptions.map((bg) => (
            <button
              key={bg}
              type="button"
              className={`background-thumb ${selectedBackground === bg ? 'active' : ''}`}
              onClick={() => selectBackground(bg)}
            >
              <img src={`${process.env.PUBLIC_URL}/Backgrounds/${bg}`} alt={bg} />
            </button>
          ))}
        </div>
      )}

      <main className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message-item ${msg.type === 'system' ? 'system' : ''}`}>
            {msg.type === 'chat' && <span className="username">{msg.username}:</span>}
            <span className="text">{msg.text}</span>
            <span className="timestamp">{msg.time}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <form onSubmit={sendMessage} className="message-form">
        {showEmojiPicker && (
          <div className="emoji-picker-container">
            <EmojiPicker onEmojiClick={(emojiObject) => setCurrentMessage(prev => prev + emojiObject.emoji)} />
          </div>
        )}
        <button type="button" className="emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
          😀
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
        />
        <button className="btn-primary" type="submit">Send</button>
      </form>
    </div>
  );
}
export default App;