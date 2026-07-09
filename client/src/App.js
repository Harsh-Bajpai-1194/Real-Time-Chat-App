import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

import GoogleSignIn from './GoogleSignIn';
import EmojiPicker from 'emoji-picker-react';
import { getSocketUrl } from './socket';
import DiscoverRooms from './DiscoverRooms';

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
  const roomRef = useRef();
  const typingTimeoutRef = useRef(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
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
  const [typingUser, setTypingUser] = useState('');
  const [showDiscoverRooms, setShowDiscoverRooms] = useState(false);
  const [showCreateRoomPopup, setShowCreateRoomPopup] = useState(false);
  const [pendingRoomSwitch, setPendingRoomSwitch] = useState(null);
  const [roomsSignature, setRoomsSignature] = useState(Date.now());

  const toggleBackgroundPicker = () => {
    setShowBackgroundPicker((prev) => !prev);
  };

  const selectBackground = (bg) => {
    setSelectedBackground(bg);
    setShowBackgroundPicker(false);
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Keep a ref to the current room name so it can be accessed inside socket event listeners
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    // When the room changes, we should clear out the old messages.
    // This is safer than clearing them inside the functions that change the room.
    setMessages([]);
  }, [room]);

  useEffect(() => {
    const savedSession = localStorage.getItem('chatSession');
    if (savedSession) {
      const { name, room: savedRoom } = JSON.parse(savedSession);
      if (name && savedRoom) {
        setUsername(name);
        setRoom(savedRoom);
        setIsLoggedIn(true);
        // By setting pendingJoinRef, the socket useEffect will handle joining the room
        // once the connection is established.
        pendingJoinRef.current = { room: savedRoom, username: name };
      }
    }
  }, []); // Run only on initial mount

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
      if (message.room === roomRef.current) {
        setMessages((prevMessages) => [...prevMessages, { ...message, type: 'chat', time: getFormattedTime(message.timestamp) }]);
      }
    };

    const handleSystemMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, { text: message, type: 'system', time: getFormattedTime() }]);
    };

    const handleChatHistory = (history, roomName) => {
      // By using a ref, we can check against the *current* room,
      // preventing a race condition where history for a previous room arrives late.
      if (roomRef.current === roomName) {
        const formattedHistory = history.map(msg => ({ ...msg, type: 'chat', time: getFormattedTime(msg.timestamp) }));
        setMessages(formattedHistory);
      }
    };
    const handleRoomsUpdated = () => {
      setRoomsSignature(Date.now());
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('chat message', handleChatMessage);
    newSocket.on('system message', handleSystemMessage);
    newSocket.on('chat history', handleChatHistory);
    newSocket.on('rooms updated', handleRoomsUpdated);
    

      newSocket.on("typing", (username) => {
    setTypingUser(`${username} is typing...`);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
        setTypingUser("");
      }, 2000);
    });

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('chat message', handleChatMessage);
      newSocket.off('system message', handleSystemMessage);
      newSocket.off('chat history', handleChatHistory);
      newSocket.off("typing");
      newSocket.off('rooms updated', handleRoomsUpdated);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinChatRoom = (roomName, selectedUsername) => {
    const socket = socketRef.current;
    const nextRoom = roomName.trim();
    const nextUsername = selectedUsername.trim() || `GuestUser${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const isSwitchingRooms = Boolean(room && room !== nextRoom);

    if (isSwitchingRooms) {
      setPendingRoomSwitch({ roomName: nextRoom, selectedUsername: nextUsername });
      return 'confirm';
    }

    pendingJoinRef.current = { room: nextRoom, username: nextUsername };
    setRoom(nextRoom);
    roomRef.current = nextRoom; // Manually update ref to prevent race condition

    if (socket?.connected) {
      socket.emit('set username', nextUsername, nextRoom);
      socket.emit('join room', nextRoom);
    } else {
      setMessages((prevMessages) => [...prevMessages, { text: 'Connecting to the chat server...', type: 'system', time: getFormattedTime() }]);
    }

    setUsername(nextUsername);

    // Save session to localStorage
    const sessionData = { name: nextUsername, room: nextRoom };
    localStorage.setItem('chatSession', JSON.stringify(sessionData));
    setIsLoggedIn(true);
    return 'joined';
  };

  const confirmRoomSwitch = () => {
    if (!pendingRoomSwitch) {
      return;
    }

    const socket = socketRef.current;
    const nextRoom = pendingRoomSwitch.roomName.trim();
    const nextUsername = pendingRoomSwitch.selectedUsername.trim() || `GuestUser${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    if (socket?.connected && room) {
      socket.emit('leave room', room);
    }

    // Clear messages immediately and update room state
    setRoom(nextRoom);
    roomRef.current = nextRoom; // Manually update ref to prevent race condition
    pendingJoinRef.current = { room: nextRoom, username: nextUsername };
    setUsername(nextUsername);
    setPendingRoomSwitch(null);

    if (socket?.connected) {
      socket.emit('set username', nextUsername, nextRoom);
      socket.emit('join room', nextRoom);
    } else {
      setMessages((prevMessages) => [...prevMessages, { text: 'Connecting to the chat server...', type: 'system', time: getFormattedTime() }]);
    }

    const sessionData = { name: nextUsername, room: nextRoom };
    localStorage.setItem('chatSession', JSON.stringify(sessionData));
    setShowDiscoverRooms(false);
    setIsLoggedIn(true);
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
    // Clear the session from storage
    localStorage.removeItem('chatSession');
  };

  const handleOpenDiscoverRooms = () => {
    setShowDiscoverRooms(true);
  };

  if (showDiscoverRooms) {
    return (
      <>
        <DiscoverRooms
          joinChatRoom={joinChatRoom}
          onClose={() => setShowDiscoverRooms(false)}
          onJoin={() => setShowDiscoverRooms(false)}
          username={username}
          roomsSignature={roomsSignature}
        />
        {pendingRoomSwitch && (
          <div className="popup-overlay">
            <div className="login-form" style={{ maxWidth: '420px' }}>
              <h2>Switch Room?</h2>
              <p style={{ textAlign: 'center', margin: '0 0 20px 0' }}>
                Are you sure you want to join this room? This will make you leave the previous room.
              </p>
              <div className="form-actions">
                <button className="btn-primary" type="button" onClick={confirmRoomSwitch}>Yes, Join Room</button>
                <button className="btn-secondary" type="button" onClick={() => setPendingRoomSwitch(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        {/* top-right corner actions removed per request */}
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
          <div className="login-form">
            <h2>Welcome{username ? `, ${username}` : ''}!</h2>
            <p style={{ textAlign: 'center', margin: '0 0 20px 0' }}>How would you like to join?</p>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleOpenDiscoverRooms}>Discover Rooms</button>
              <button className="btn-primary" onClick={() => setShowCreateRoomPopup(true)}>Create a New Room</button>
              <button className="btn-secondary" type="button" onClick={() => { setShowRoomForm(false); setUsername(''); }}>Back</button>
            </div>
          </div>
        )}

        {showCreateRoomPopup && (
          <div className="popup-overlay">
            <form onSubmit={handleLogin} className="login-form">
              <h2>Create a New Room</h2>
              <input
                type="text"
                placeholder="Enter room name"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                required
                autoFocus
              />
              <div className="form-actions">
                <button className="btn-primary" type="submit">Join</button>
                <button className="btn-secondary" type="button" onClick={() => setShowCreateRoomPopup(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`chat-container${selectedBackground ? ' background-selected' : ''}`} style={{
      backgroundColor: selectedBackground ? 'transparent' : '#FFFFFF',
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
          <button className="change-bg-btn" onClick={toggleBackgroundPicker} title="Change Background">
            <img src={`${process.env.PUBLIC_URL}/change_bg.png`} alt="Change Background" />
          </button>
          <button className="btn-secondary" onClick={handleOpenDiscoverRooms}>Discover Rooms</button>
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

       {typingUser && (
        <div className="typing-indicator">{typingUser}</div>
    )}

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
          onChange={(e) => {
              setCurrentMessage(e.target.value);

            if (socketRef.current && room.trim()) {
                socketRef.current.emit("typing", {
                room: room.trim(),
                username,
              });
            }
          }}
        />
        <button className="btn-primary" type="submit">Send</button>
      </form>
    </div>
  );
}
export default App;
