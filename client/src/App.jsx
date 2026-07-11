import './App.css';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

import GoogleSignIn from './GoogleSignIn';
import EmojiPicker from 'emoji-picker-react';
import { getSocketUrl } from './socket';
import DiscoverRooms from './DiscoverRooms.jsx';
import Admin from './Admin';

const getFormattedTime = (timestamp) => {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const md5 = (string) => {
  const utf8 = unescape(encodeURIComponent(string));
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;

  const leftRotate = (x, c) => (x << c) | (x >>> (32 - c));

  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
  const r = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

  const bytes = [];
  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i));
  }
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0x00);
  for (let i = 0; i < 8; i++) {
    bytes.push((bitLen >>> (8 * i)) & 0xff);
  }

  const words = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24));
  }

  for (let i = 0; i < words.length; i += 16) {
    const oldH0 = h0;
    const oldH1 = h1;
    const oldH2 = h2;
    const oldH3 = h3;

    for (let j = 0; j < 64; j++) {
      let f;
      let g;
      if (j < 16) {
        f = (h1 & h2) | (~h1 & h3);
        g = j;
      } else if (j < 32) {
        f = (h3 & h1) | (~h3 & h2);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = h1 ^ h2 ^ h3;
        g = (3 * j + 5) % 16;
      } else {
        f = h2 ^ (h1 | ~h3);
        g = (7 * j) % 16;
      }
      const temp = h3;
      h3 = h2;
      h2 = h1;
      h1 = h1 + leftRotate((h0 + f + k[j] + words[i + g]) >>> 0, r[j]);
      h1 >>>= 0;
      h0 = temp;
    }

    h0 = (h0 + oldH0) >>> 0;
    h1 = (h1 + oldH1) >>> 0;
    h2 = (h2 + oldH2) >>> 0;
    h3 = (h3 + oldH3) >>> 0;
  }

  const toHex = (num) => num.toString(16).padStart(8, '0');
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3);
};

const getAvatarUrl = (username, picture, email = '') => {
  if (picture) return picture;
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail && !normalizedEmail.startsWith('guestuser')) {
    return `https://www.gravatar.com/avatar/${md5(normalizedEmail)}?d=identicon&s=200`;
  }
  const seed = encodeURIComponent(username || 'GuestUser');
  return `https://api.dicebear.com/8.x/identicon/svg?seed=${seed}`;
};

function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [email, setEmail] = useState('');
  const [picture, setPicture] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isFetchingOlderMessages, setIsFetchingOlderMessages] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [roomsSignature, setRoomsSignature] = useState(Date.now());
  const scrollHeightBeforeUpdate = useRef(null);

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

  useLayoutEffect(() => {
    if (scrollHeightBeforeUpdate.current !== null) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight - scrollHeightBeforeUpdate.current;
      }
      scrollHeightBeforeUpdate.current = null;
    } else {
      scrollToBottom();
    }
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
      const { name, room: savedRoom, email: savedEmail, picture: savedPicture } = JSON.parse(savedSession);
      if (name && savedRoom) {
        setUsername(name);
        setRoom(savedRoom);
        if (savedEmail) setEmail(savedEmail);
        if (savedPicture) setPicture(savedPicture);
        if (savedEmail === 'harshbajpai1194@gmail.com') setIsAdmin(true);
        setIsLoggedIn(true);
        // By setting pendingJoinRef, the socket useEffect will handle joining the room
        // once the connection is established.
        pendingJoinRef.current = {
          room: savedRoom,
          username: name,
          email: savedEmail,
          picture: savedPicture,
        };
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
        newSocket.emit('join room', pendingJoin.room);
        newSocket.emit('set username', pendingJoin.username, pendingJoin.room, pendingJoin.email, pendingJoin.picture);
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

    const handleOlderMessages = (olderMessages, roomName) => {
      if (roomRef.current === roomName && olderMessages.length > 0) {
        const container = messagesContainerRef.current;
        if (container) {
          scrollHeightBeforeUpdate.current = container.scrollHeight;
        }
        const formattedHistory = olderMessages.map(msg => ({ ...msg, type: 'chat', time: getFormattedTime(msg.timestamp) }));
        setMessages(prevMessages => [...formattedHistory, ...prevMessages]);
      }
      setIsFetchingOlderMessages(false);
    };
    const handleRoomsUpdated = () => {
      setRoomsSignature(Date.now());
    };

    const handleMessageDeleted = (messageId) => {
      setMessages((prevMessages) => prevMessages.filter((msg) => msg._id !== messageId));
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('chat message', handleChatMessage);
    newSocket.on('system message', handleSystemMessage);
    newSocket.on('chat history', handleChatHistory);
    newSocket.on('older messages', handleOlderMessages);
    newSocket.on('rooms updated', handleRoomsUpdated);
    newSocket.on('message deleted', handleMessageDeleted);
    

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
      newSocket.off('older messages', handleOlderMessages);
      newSocket.off("typing");
      newSocket.off('message deleted', handleMessageDeleted);
      newSocket.off('rooms updated', handleRoomsUpdated);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop <= 20 && !isFetchingOlderMessages && messages.length > 0) {
      const oldestMessageId = messages[0]?._id;
      if (oldestMessageId) {
        setIsFetchingOlderMessages(true);
        socketRef.current.emit('fetch older messages', {
          room: room,
          lastMessageId: oldestMessageId,
        });
      }
    }
  }, [messages, isFetchingOlderMessages, room]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  const joinChatRoom = (roomName, selectedUsername, userEmail = '', userPicture = '') => {
    const socket = socketRef.current;
    const nextRoom = roomName.trim();
    const nextUsername = selectedUsername.trim() || `GuestUser${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const isSwitchingRooms = Boolean(room && room !== nextRoom);
    const finalPicture = userPicture || getAvatarUrl(nextUsername, '', userEmail);

    if (isSwitchingRooms) {
      setPendingRoomSwitch({ roomName: nextRoom, selectedUsername: nextUsername, picture: finalPicture });
      return 'confirm';
    }

    pendingJoinRef.current = { room: nextRoom, username: nextUsername, email: userEmail, picture: finalPicture };
    setRoom(nextRoom);
    roomRef.current = nextRoom; // Manually update ref to prevent race condition

    if (socket?.connected) {
      socket.emit('join room', nextRoom);
      socket.emit('set username', nextUsername, nextRoom, userEmail, finalPicture);
    } else {
      setMessages((prevMessages) => [...prevMessages, { text: 'Connecting to the chat server...', type: 'system', time: getFormattedTime() }]);
    }

    setUsername(nextUsername);
    if (userEmail) setEmail(userEmail);
    setPicture(finalPicture);

    // Save session to localStorage
    const sessionData = { name: nextUsername, room: nextRoom, email: userEmail, picture: finalPicture };
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
    const userEmail = email; // Preserve email from previous session
    const userPicture = pendingRoomSwitch.picture || picture || getAvatarUrl(nextUsername, '', userEmail);

    if (socket?.connected && room) {
      socket.emit('leave room', room);
    }

    // Clear messages immediately and update room state
    setRoom(nextRoom);
    roomRef.current = nextRoom;
    pendingJoinRef.current = { room: nextRoom, username: nextUsername, email: userEmail, picture: userPicture };
    setUsername(nextUsername);
    setPicture(userPicture);
    setPendingRoomSwitch(null);

    if (socket?.connected) {
      socket.emit('join room', nextRoom);
      socket.emit('set username', nextUsername, nextRoom, userEmail, userPicture);
    } else {
      setMessages((prevMessages) => [...prevMessages, { text: 'Connecting to the chat server...', type: 'system', time: getFormattedTime() }]);
    }

    const sessionData = { name: nextUsername, room: nextRoom, email: userEmail, picture: userPicture };
    localStorage.setItem('chatSession', JSON.stringify(sessionData));
    if (userEmail === 'harshbajpai1194@gmail.com') setIsAdmin(true);
    setShowDiscoverRooms(false);
    setIsLoggedIn(true);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (room.trim()) {
      joinChatRoom(room, username, email, picture);
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
    const avatarUrl = user.picture || getAvatarUrl(user.name, '', user.email || '');
    setUsername(user.name);
    setEmail(user.email);
    setPicture(avatarUrl);
    if (user.email === 'harshbajpai1194@gmail.com') {
      setIsAdmin(true);
    }
    setShowRoomForm(true); // Move to the next step automatically
  };

  const handleDeleteMessage = (messageId) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('delete message', messageId, room);
    }
  };

  const handleLeaveRoom = () => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('leave room', room);
    }
    pendingJoinRef.current = null;
    setIsLoggedIn(false);
    setRoom('');
    setEmail('');
    setPicture('');
    setIsAdmin(false);
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
          joinChatRoom={(roomName, uname) => joinChatRoom(roomName, uname, email, picture)}
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
            <h2>Join Chat <div className="release-link-wrapper">
              <a href="https://github.com/Harsh-Bajpai-1194/Real-Time-Chat-App" target="_blank" rel="noopener noreferrer" className="release-link">
                <img src="https://img.shields.io/badge/Release-v1.2.9-deeppink?style=for-the-the-badge&logo=github" alt="v1.2.9" className="release-badge" />
              </a>
            </div>
            </h2>
            
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
          {isAdmin && (
            <button className="btn-primary" onClick={() => setShowAdminPanel(true)}>Admin Panel</button>
          )}
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

      {isAdmin && showAdminPanel && (
        <Admin socket={socketRef.current} onClose={() => setShowAdminPanel(false)} />
      )}

      <main className="chat-messages" ref={messagesContainerRef}>
        {isFetchingOlderMessages && <div className="loading-older-messages" style={{ textAlign: 'center', padding: '10px' }}>Loading...</div>}
        {messages.map((msg) => {
          const isOwnMessage = msg.type === 'chat' && msg.username === username;
          return (
            <div
              key={msg._id || msg.time + msg.text}
              className={`message-item ${msg.type === 'system' ? 'system' : isOwnMessage ? 'own-message' : 'other-message'}`}
            >
              {msg.type === 'chat' ? (
                <>
                  <img className="avatar" src={getAvatarUrl(msg.username, msg.picture, msg.email)} alt={`${msg.username}'s avatar`} />
                  <div className="message-content">
                    <div className="message-header">
                      <span className="username">{msg.username}</span>
                      <span className="timestamp">{msg.time}</span>
                    </div>
                    <span className="text">{msg.text}</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDeleteMessage(msg._id)} className="delete-btn" title="Delete message">
                      🗑️
                    </button>
                  )}
                </>
              ) : (
                <span className="system-text">{msg.text}</span>
              )}
            </div>
          );
        })}
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
