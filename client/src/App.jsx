import './App.css';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

import GoogleSignIn from './GoogleSignIn';
import EmojiPicker from 'emoji-picker-react';
import { getSocketUrl } from './socket';
import DiscoverRooms from './DiscoverRooms.jsx';
import Admin from './Admin';
import ParticipantsPage from './ParticipantsPage.jsx';
import { getAvatarUrl } from './utils/getAvatarUrl.js';
import { FaMusic, FaVolumeMute } from 'react-icons/fa';

const getFormattedTime = (timestamp) => {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const songPlaylist = [
  'Imagine_Dragons-Believer.mp4',
  'John-Cena-The-Time-is-Now-WWE.mp3',
];

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
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const audioRef = useRef(null);
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
  const [showCreateRoomPopup, setShowCreateRoomPopup] = useState(false);
  const [pendingRoomSwitch, setPendingRoomSwitch] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [roomsSignature, setRoomsSignature] = useState(Date.now());
  const scrollHeightBeforeUpdate = useRef(null);
  const [showDiscoverRooms, setShowDiscoverRooms] = useState(false);
  const [viewingMembersOf, setViewingMembersOf] = useState(null);
  
  // startMusic MUST be declared before joinChatRoomCallback to avoid no-use-before-define error
  const startMusic = useCallback(() => {
    setIsMusicPlaying(true);
  }, []);

  const joinChatRoomCallback = useCallback((roomName, selectedUsername, userEmail = '', userPicture = '') => {
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
    roomRef.current = nextRoom;

    if (socket?.connected) {
      socket.emit('join room', nextRoom);
      socket.emit('set username', nextUsername, nextRoom, userEmail, finalPicture);
    } else {
      setMessages((prevMessages) => [...prevMessages, { text: 'Connecting to the chat server...', type: 'system', time: getFormattedTime() }]);
    }

    setUsername(nextUsername);
    if (userEmail) setEmail(userEmail);
    setPicture(finalPicture);

    const sessionData = { name: nextUsername, room: nextRoom, email: userEmail, picture: finalPicture };
    localStorage.setItem('chatSession', JSON.stringify(sessionData));
    setIsLoggedIn(true);

    const believerIndex = songPlaylist.findIndex(song => song === 'Imagine_Dragons-Believer.mp4');
    if (believerIndex !== -1) {
      setCurrentSongIndex(believerIndex);
    }
    startMusic();
    return 'joined'; 
  }, [room, startMusic, setCurrentSongIndex]); 
  
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
    roomRef.current = room;
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
        pendingJoinRef.current = {
          room: savedRoom,
          username: name,
          email: savedEmail,
          picture: savedPicture,
        };
      }
    }
  }, []);

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
      setMessages((prevMessages) => [...prevMessages, { text: message, type: 'system', time: getFormattedTime(), room: roomRef.current, timestamp: Date.now() }]);
    };

    const handleChatHistory = (history, roomName) => {
      if (roomRef.current === roomName) {
        const formattedHistory = history.map(msg => ({
          ...msg,
          type: msg.username ? 'chat' : 'system', 
          time: getFormattedTime(msg.timestamp)
        }));
        setMessages(prevMessages => {
          const otherMessages = prevMessages.filter(msg => msg.room !== roomName);
          return [...otherMessages, ...formattedHistory];
        });
      }
    };

    const handleOlderMessages = (olderMessages, roomName) => {
      if (roomRef.current === roomName && olderMessages.length > 0) {
        const container = messagesContainerRef.current;
        if (container) {
          scrollHeightBeforeUpdate.current = container.scrollHeight;
        }
        const formattedHistory = olderMessages.map(msg => ({
          ...msg,
          type: msg.username ? 'chat' : 'system', 
          time: getFormattedTime(msg.timestamp)
        }));
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const playNextSong = () => {
      setCurrentSongIndex((prevIndex) => (prevIndex + 1) % songPlaylist.length);
    };

    if (isMusicPlaying) {
      // Ensure the audio source is set before attempting to play
      if (audio.src !== `${process.env.PUBLIC_URL}/sounds/${songPlaylist[currentSongIndex]}`) {
        audio.src = `${process.env.PUBLIC_URL}/sounds/${songPlaylist[currentSongIndex]}`;
      }
      const playPromise = audio.play(); // Attempt to play
      if (playPromise !== undefined) { // Check if play() returns a Promise
        playPromise.catch(error => { // Catch potential autoplay errors
          console.error("Audio play failed. User interaction is required or browser autoplay restrictions.", error);
          setIsMusicPlaying(false);
        });
      }
    } else {
      audio.pause();
    }

    audio.addEventListener('ended', playNextSong);

    return () => { 
      audio.removeEventListener('ended', playNextSong);
    };
  }, [isMusicPlaying, currentSongIndex]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const handleScroll = () => {
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
    };

    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [messages, isFetchingOlderMessages, room]);

  const joinChatRoom = joinChatRoomCallback;

  const confirmRoomSwitch = () => {
    if (!pendingRoomSwitch) return;

    const socket = socketRef.current;
    const { roomName: nextRoom, selectedUsername: nextUsername, picture: userPicture } = pendingRoomSwitch;
    const userEmail = email;

    if (socket?.connected && room) {
      socket.emit('leave room', room);
    }

    setRoom(nextRoom);
    roomRef.current = nextRoom;
    pendingJoinRef.current = { room: nextRoom, username: nextUsername, email: userEmail, picture: userPicture };
    setUsername(nextUsername);
    setPicture(userPicture);
    setPendingRoomSwitch(null);

    if (socket?.connected) {
      socket.emit('join room', nextRoom);
      socket.emit('set username', nextUsername, nextRoom, userEmail, userPicture);
    }

    const sessionData = { name: nextUsername, room: nextRoom, email: userEmail, picture: userPicture };
    localStorage.setItem('chatSession', JSON.stringify(sessionData));
    if (userEmail === 'harshbajpai1194@gmail.com') setIsAdmin(true);
    
    setShowDiscoverRooms(false);
    const believerIndex = songPlaylist.findIndex(song => song === 'Imagine_Dragons-Believer.mp4');
    if (believerIndex !== -1) {
      setCurrentSongIndex(believerIndex);
    }
    startMusic(); // This will now just set isMusicPlaying(true)
    setIsLoggedIn(true);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (room.trim()) {
      joinChatRoomCallback(room, username, email, picture);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const trimmedMessage = currentMessage.trim();
    if (!trimmedMessage) return;

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
    setShowRoomForm(true);
  };

  const handleDeleteMessage = (messageId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('delete message', messageId, room);
    }
  };

  const handleLeaveRoom = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave room', room);
    }
    pendingJoinRef.current = null;
    setIsLoggedIn(false);
    setRoom('');
    setEmail('');
    setPicture('');
    setIsAdmin(false);
    localStorage.removeItem('chatSession');
  };

  const handleOpenDiscoverRooms = () => {
    setShowDiscoverRooms(true);
  };

  const handleViewMembers = (roomName) => {
    setViewingMembersOf(roomName);
  };

  const toggleMusic = async () => {
    setIsMusicPlaying((prev) => !prev);
  };

  return (
    <>
      <audio ref={audioRef} preload="auto"/>
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

      {viewingMembersOf && (
        <ParticipantsPage
          roomName={viewingMembersOf}
          onClose={() => setViewingMembersOf(null)}
        />
      )}

      {showDiscoverRooms ? (
        <DiscoverRooms
          joinChatRoom={joinChatRoom}
          onClose={() => setShowDiscoverRooms(false)}
          onJoin={() => setShowDiscoverRooms(false)}
          username={username}
          email={email}
          picture={picture}
          onViewMembers={handleViewMembers}
          roomsSignature={roomsSignature}
        />
      ) : !isLoggedIn ? (
        <div className="login-container">
          {!showRoomForm ? (
            <div className="login-form">
              <h2>Join Chat <div className="release-link-wrapper">
                <a href="https://github.com/Harsh-Bajpai-1194/Real-Time-Chat-App" target="_blank" rel="noopener noreferrer" className="release-link">
                  <img src="https://img.shields.io/badge/Release-v1.3.0-deeppink?style=for-the-the-badge&logo=github" alt="v1.3.0" className="release-badge" />
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
        </div>
      ) : (
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
              <button onClick={toggleMusic} className="btn-secondary" title={isMusicPlaying ? "Mute Music" : "Play Music"}>
                {isMusicPlaying ? <FaVolumeMute /> : <FaMusic />}
              </button>
              <button className="change-bg-btn" onClick={toggleBackgroundPicker} title="Change Background">
                <img src={`${process.env.PUBLIC_URL}/change_bg.png`} alt="Change Background" />
              </button>
              {isAdmin && (
              <button className="btn-primary" onClick={() => setShowAdminPanel(true)} title="Admin Panel">🔒</button>
              )}
              <button className="btn-secondary" onClick={handleOpenDiscoverRooms}>Discover Rooms</button>
              <button className="btn-danger" onClick={handleLeaveRoom}>Leave Room</button>
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
            {messages
              .filter(msg => msg.room === room || !msg.room)
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
              .map((msg) => {
              if (msg.type !== 'chat') {
                return (
                  <div key={msg._id || msg.time + msg.text} className="message-item system">
                    <span className="system-text">{msg.text}</span>
                  </div>
                );
              }

              const isOwnMessage = msg.username === username;
              
                return (
                <div key={msg._id || msg.time + msg.text} className={`message-wrapper ${isOwnMessage ? 'own-message-wrapper' : ''}`}>
                  <div className={`message-item ${isOwnMessage ? 'own-message' : 'other-message'}`}>
                    <img className="avatar" src={getAvatarUrl(msg.username, msg.picture, msg.email)} alt={`${msg.username}'s avatar`} />
                    <div className="message-content">
                      <div className="message-header">
                        <span className="username">{msg.username}</span>
                        <span className="timestamp">{msg.time}</span>
                        </div>
                      <span className="text">{msg.text}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDeleteMessage(msg._id)} className="delete-btn" title="Delete message">
                      🗑️
                    </button>
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
      )}
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
export default App;