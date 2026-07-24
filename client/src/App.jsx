import './App.css';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import io from 'socket.io-client';

import GoogleSignIn from './GoogleSignIn';
import EmojiPicker from 'emoji-picker-react';
import { getSocketUrl } from './socket';
import DiscoverRooms from './DiscoverRooms.jsx';
import RoomSettingsPage from './RoomSettingsPage.jsx';
import Admin from './Admin';
import ParticipantsPage from './ParticipantsPage.jsx';
import { getAvatarUrl } from './utils/getAvatarUrl.js';
import { FaMusic, FaVolumeMute } from 'react-icons/fa';

const getFormattedTime = (timestamp) => {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

let soundFiles = [];
try {
  const soundsContext = require.context('./sounds', false, /\.(mp3|mp4|wav|ogg|m4a)$/);
  soundFiles = soundsContext.keys().map(key => ({
    name: key.replace('./', ''),
    src: soundsContext(key).default || soundsContext(key)
  }));
} catch (e) {
  soundFiles = [
    { name: 'Bliss-Realme.mp4', src: `${process.env.PUBLIC_URL}/sounds/Bliss-Realme.mp4` },
    { name: 'ding-dong.mp4', src: `${process.env.PUBLIC_URL}/sounds/ding-dong.mp4` }
  ];
}

const songPlaylist = soundFiles.length > 0 ? soundFiles : [
  { name: 'Bliss-Realme.mp4', src: `${process.env.PUBLIC_URL}/sounds/Bliss-Realme.mp4` },
  { name: 'ding-dong.mp4', src: `${process.env.PUBLIC_URL}/sounds/ding-dong.mp4` }
];

function App() {
  const navigate = useNavigate();
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
  const [newRoomName, setNewRoomName] = useState('');
  const [pendingRoomSwitch, setPendingRoomSwitch] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [roomsSignature, setRoomsSignature] = useState(Date.now());
  const scrollHeightBeforeUpdate = useRef(null);
  const skipScrollToBottomRef = useRef(false);
  const prevMessagesCountRef = useRef(0);
  
  // startMusic MUST be declared before joinChatRoomCallback to avoid no-use-before-define error
  const startMusic = useCallback(() => {
    setIsMusicPlaying(true);
  }, []);

  const joinChatRoomCallback = useCallback((roomName, selectedUsername, userEmail = '', userPicture = '') => {
    setShowCreateRoomPopup(false);
    const socket = socketRef.current;
    const nextRoom = (roomName || '').trim();
    const nextUsername = (selectedUsername || '').trim() || `GuestUser${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
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
      setMessages((prevMessages) => {
        const hasConnectingMsg = prevMessages.some(m => m.text === 'Connecting to the chat server...' && (m.room || '').trim().toLowerCase() === nextRoom.toLowerCase());
        if (hasConnectingMsg) return prevMessages;
        return [...prevMessages, { text: 'Connecting to the chat server...', type: 'system', time: getFormattedTime(), room: nextRoom }];
      });
    }

    setUsername(nextUsername);
    if (userEmail) setEmail(userEmail);
    setPicture(finalPicture);

    const sessionData = { name: nextUsername, room: nextRoom, email: userEmail, picture: finalPicture };
    localStorage.setItem('chatSession', JSON.stringify(sessionData));
    setIsLoggedIn(true);

    if (songPlaylist.length > 0) {
      const randomIndex = Math.floor(Math.random() * songPlaylist.length);
      setCurrentSongIndex(randomIndex);
    }
    startMusic();
    navigate(`/chat/${encodeURIComponent(nextRoom)}`);
    return 'joined'; 
  }, [room, startMusic, setCurrentSongIndex, navigate]); 
  
  const toggleBackgroundPicker = () => { 
    setShowBackgroundPicker((prev) => !prev);
  };

  const selectBackground = (bg) => {
    setSelectedBackground(bg);
    setShowBackgroundPicker(false);
  };

  const scrollToBottom = useCallback((instant = false) => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? "auto" : "smooth" });
    }
  }, []);

  useLayoutEffect(() => {
    const isDeletion = skipScrollToBottomRef.current || (prevMessagesCountRef.current > 0 && messages.length < prevMessagesCountRef.current);
    skipScrollToBottomRef.current = false;
    prevMessagesCountRef.current = messages.length;

    if (isDeletion) {
      return;
    }

    if (scrollHeightBeforeUpdate.current !== null) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight - scrollHeightBeforeUpdate.current;
      }
      scrollHeightBeforeUpdate.current = null;
    } else {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    roomRef.current = room;
    if (room && isLoggedIn) {
      scrollToBottom(true);
      const timer1 = setTimeout(() => scrollToBottom(true), 50);
      const timer2 = setTimeout(() => scrollToBottom(true), 150);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [room, isLoggedIn, scrollToBottom]);

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
      } else if (roomRef.current) {
        newSocket.emit('join room', roomRef.current);
      }
    };

    const handleChatMessage = (message) => {
      if (!message) return;
      const currentRoom = (roomRef.current || '').trim().toLowerCase();
      const msgRoom = (message.room || '').trim().toLowerCase();
      if (!msgRoom || msgRoom === currentRoom) {
        setMessages((prevMessages) => [...prevMessages, { ...message, room: message.room || roomRef.current, type: 'chat', time: getFormattedTime(message.timestamp) }]);
      }
    };

    const handleSystemMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, { text: message, type: 'system', time: getFormattedTime(), room: roomRef.current, timestamp: Date.now() }]);
    };

    const handleChatHistory = (history, roomName) => {
      const currentRoom = (roomRef.current || '').trim().toLowerCase();
      const historyRoom = (roomName || '').trim().toLowerCase();
      if (!currentRoom || currentRoom === historyRoom) {
        const safeHistory = Array.isArray(history) ? history : [];
        const formattedHistory = safeHistory.map(msg => ({
          ...msg,
          room: msg.room || roomName,
          type: msg.username ? 'chat' : 'system', 
          time: getFormattedTime(msg.timestamp)
        }));
        setMessages(prevMessages => {
          const otherMessages = prevMessages.filter(msg => {
            if (!msg.room) return false;
            return msg.room.trim().toLowerCase() !== historyRoom;
          });
          return [...otherMessages, ...formattedHistory];
        });
        setTimeout(() => scrollToBottom(true), 50);
        setTimeout(() => scrollToBottom(true), 150);
      }
    };

    const handleOlderMessages = (olderMessages, roomName) => {
      const currentRoom = (roomRef.current || '').trim().toLowerCase();
      const historyRoom = (roomName || '').trim().toLowerCase();
      if (currentRoom === historyRoom && Array.isArray(olderMessages) && olderMessages.length > 0) {
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
      skipScrollToBottomRef.current = true;
      setMessages((prevMessages) => prevMessages.filter((msg) => msg._id !== messageId));
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('chat message', handleChatMessage);
    newSocket.on('system message', handleSystemMessage);
    newSocket.on('chat history', handleChatHistory);
    newSocket.on('older messages', handleOlderMessages);
    newSocket.on('rooms updated', handleRoomsUpdated);
    newSocket.on('message deleted', handleMessageDeleted);

    if (newSocket.connected) {
      handleConnect();
    }

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
  }, [scrollToBottom]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const playNextSong = () => {
      if (songPlaylist.length <= 1) {
        audio.currentTime = 0;
        audio.play().catch(() => setIsMusicPlaying(false));
        return;
      }
      setCurrentSongIndex((prevIndex) => {
        let nextIndex;
        do {
          nextIndex = Math.floor(Math.random() * songPlaylist.length);
        } while (nextIndex === prevIndex);
        return nextIndex;
      });
    };

    if (isMusicPlaying && songPlaylist.length > 0) {
      const currentTrack = songPlaylist[currentSongIndex];
      const songPath = typeof currentTrack === 'string'
        ? `${process.env.PUBLIC_URL}/sounds/${currentTrack}`
        : currentTrack.src;

      if (audio.src !== songPath) {
        audio.src = songPath;
      }
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
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
    setShowCreateRoomPopup(false);

    if (socket?.connected) {
      socket.emit('join room', nextRoom);
      socket.emit('set username', nextUsername, nextRoom, userEmail, userPicture);
    }

    const sessionData = { name: nextUsername, room: nextRoom, email: userEmail, picture: userPicture };
    localStorage.setItem('chatSession', JSON.stringify(sessionData));
    if (userEmail === 'harshbajpai1194@gmail.com') setIsAdmin(true);
    
    const believerIndex = songPlaylist.findIndex(song => song === 'Imagine_Dragons-Believer.mp4');
    if (believerIndex !== -1) {
      setCurrentSongIndex(believerIndex);
    }
    startMusic(); // This will now just set isMusicPlaying(true)
    setIsLoggedIn(true);
    navigate(`/chat/${encodeURIComponent(nextRoom)}`);
  };

  const handleOpenCreateRoomPopup = () => {
    setNewRoomName('');
    setShowCreateRoomPopup(true);
  };

  const handleCreateRoomSubmit = (e) => {
    e.preventDefault();
    const targetRoom = (newRoomName || '').trim();
    if (targetRoom) {
      setShowCreateRoomPopup(false);
      setNewRoomName('');
      joinChatRoomCallback(targetRoom, username, email, picture);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const trimmedMessage = (currentMessage || '').trim();
    if (!trimmedMessage) return;

    const socket = socketRef.current;
    if (!socket?.connected) {
      setMessages((prevMessages) => [...prevMessages, { text: 'Unable to send right now. Please wait for the connection to finish.', type: 'system', time: getFormattedTime() }]);
      return;
    }

    socket.emit('chat message', trimmedMessage, (room || '').trim());
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
    skipScrollToBottomRef.current = true;
    if (socketRef.current?.connected) {
      socketRef.current.emit('delete message', messageId, room);
    }
  };

  const handleLeaveRoom = () => {
    if (socketRef.current?.connected && room) {
      socketRef.current.emit('leave room', room);
    }
    pendingJoinRef.current = null;
    setIsLoggedIn(false);
    setRoom('');
    setEmail('');
    setPicture('');
    setIsAdmin(false);
    localStorage.removeItem('chatSession');
    navigate('/login');
  };

  const handleOpenDiscoverRooms = () => {
    navigate('/discover');
  };

  const handleAdminLogin = () => {
    const adminUsername = username.trim() || 'AdminUser';
    const adminEmail = 'harshbajpai1194@gmail.com';
    const avatarUrl = getAvatarUrl(adminUsername, '', adminEmail);
    setUsername(adminUsername);
    setEmail(adminEmail);
    setPicture(avatarUrl);
    setIsAdmin(true);
    setShowRoomForm(true);
  };

  const handleViewMembers = (roomName) => {
    navigate(`/participants/${encodeURIComponent(roomName)}`);
  };

  const handleOpenRoomSettings = (roomName) => {
    navigate(`/settings/${encodeURIComponent(roomName)}`);
  };

  const toggleMusic = async () => {
    setIsMusicPlaying((prev) => !prev);
  };

  return (
    <>
      <audio ref={audioRef} preload="auto"/>

      {showCreateRoomPopup && (
        <div className="popup-overlay">
          <form onSubmit={handleCreateRoomSubmit} className="login-form">
            <h2>Create a New Room</h2>
            <input
              type="text"
              placeholder="Enter room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              required
              autoFocus
            />
            <div className="form-actions">
              <button className="btn-primary" type="submit">Join</button>
              <button className="btn-secondary" type="button" onClick={() => { setShowCreateRoomPopup(false); setNewRoomName(''); }}>Cancel</button>
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

      <Routes>
        <Route path="/" element={
          isLoggedIn && room ? (
            <Navigate to={`/chat/${encodeURIComponent(room)}`} replace />
          ) : (
            <LoginView
              showRoomForm={showRoomForm}
              setShowRoomForm={setShowRoomForm}
              username={username}
              setUsername={setUsername}
              handleGoogleSignIn={handleGoogleSignIn}
              handleOpenDiscoverRooms={handleOpenDiscoverRooms}
              handleOpenCreateRoomPopup={handleOpenCreateRoomPopup}
              handleAdminLogin={handleAdminLogin}
              isAdmin={isAdmin}
            />
          )
        } />

        <Route path="/login" element={
          isLoggedIn && room ? (
            <Navigate to={`/chat/${encodeURIComponent(room)}`} replace />
          ) : (
            <LoginView
              showRoomForm={showRoomForm}
              setShowRoomForm={setShowRoomForm}
              username={username}
              setUsername={setUsername}
              handleGoogleSignIn={handleGoogleSignIn}
              handleOpenDiscoverRooms={handleOpenDiscoverRooms}
              handleOpenCreateRoomPopup={handleOpenCreateRoomPopup}
              handleAdminLogin={handleAdminLogin}
              isAdmin={isAdmin}
            />
          )
        } />

        <Route path="/discover" element={
          <DiscoverRooms
            joinChatRoom={joinChatRoom}
            onClose={() => {
              if (room && isLoggedIn) {
                navigate(`/chat/${encodeURIComponent(room)}`);
              } else {
                navigate('/login');
              }
            }}
            onJoin={(joinedRoom) => {
              if (joinedRoom) {
                navigate(`/chat/${encodeURIComponent(joinedRoom)}`);
              }
            }}
            username={username}
            email={email}
            picture={picture}
            onViewMembers={handleViewMembers}
            onOpenSettings={handleOpenRoomSettings}
            roomsSignature={roomsSignature}
          />
        } />

        <Route path="/settings/:roomName" element={
          <RoomSettingsRoute
            room={room}
            isLoggedIn={isLoggedIn}
          />
        } />

        <Route path="/participants/:roomName" element={
          <ParticipantsRoute
            room={room}
            isLoggedIn={isLoggedIn}
          />
        } />

        <Route path="/chat/:roomName" element={
          <ChatRoomRoute
            room={room}
            setRoom={setRoom}
            isLoggedIn={isLoggedIn}
            username={username}
            email={email}
            picture={picture}
            joinChatRoomCallback={joinChatRoomCallback}
            selectedBackground={selectedBackground}
            toggleMusic={toggleMusic}
            isMusicPlaying={isMusicPlaying}
            toggleBackgroundPicker={toggleBackgroundPicker}
            isAdmin={isAdmin}
            handleOpenAdminPanel={() => navigate('/admin')}
            handleOpenDiscoverRooms={handleOpenDiscoverRooms}
            handleLeaveRoom={handleLeaveRoom}
            showBackgroundPicker={showBackgroundPicker}
            backgroundOptions={backgroundOptions}
            selectBackground={selectBackground}
            showAdminPanel={showAdminPanel}
            setShowAdminPanel={setShowAdminPanel}
            socketRef={socketRef}
            messagesContainerRef={messagesContainerRef}
            isFetchingOlderMessages={isFetchingOlderMessages}
            messages={messages}
            handleDeleteMessage={handleDeleteMessage}
            messagesEndRef={messagesEndRef}
            typingUser={typingUser}
            sendMessage={sendMessage}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            setCurrentMessage={setCurrentMessage}
            currentMessage={currentMessage}
          />
        } />

        <Route path="/admin" element={
          <AdminRoute
            socketRef={socketRef}
            room={room}
            isLoggedIn={isLoggedIn}
            isAdmin={isAdmin}
          />
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function LoginView({ showRoomForm, setShowRoomForm, username, setUsername, handleGoogleSignIn, handleOpenDiscoverRooms, handleOpenCreateRoomPopup, handleAdminLogin, isAdmin }) {
  const isDevTesting = process.env.NODE_ENV !== 'production' || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.includes('dev');

  return (
    <div className="login-container">
      {!showRoomForm ? (
        <div className="login-form">
          <h2>Join Chat <div className="release-link-wrapper">
            <a href="https://github.com/Harsh-Bajpai-1194/Real-Time-Chat-App" target="_blank" rel="noopener noreferrer" className="release-link">
              <img src="https://img.shields.io/badge/Release-v1.3.1-deeppink?style=for-the-the-badge&logo=github" alt="v1.3.1" className="release-badge" />
            </a>
          </div>
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
            <GoogleSignIn onSignIn={handleGoogleSignIn} />
          </div>
          <p style={{ textAlign: 'center', margin: '0 0 15px 0', opacity: 0.7 }}>— OR —</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn-primary" type="button" onClick={() => setShowRoomForm(true)}>
              Join as a Guest User
            </button>
            {isDevTesting && (
              <button
                className="btn-secondary"
                type="button"
                onClick={handleAdminLogin}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px dashed #e02424', color: '#ff6b6b' }}
                title="Only visible for local and development testing"
              >
                🛡️ Login as Admin <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>(Local Testing Only)</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="login-form">
          <h2>Welcome{username ? `, ${username}` : ''}! {isAdmin && <span style={{ fontSize: '0.8rem', background: '#e02424', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', marginLeft: '6px', verticalAlign: 'middle', fontWeight: 'bold' }}>Admin</span>}</h2>
          <p style={{ textAlign: 'center', margin: '0 0 20px 0' }}>How would you like to join?</p>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleOpenDiscoverRooms}>Discover Rooms</button>
            <button className="btn-primary" onClick={handleOpenCreateRoomPopup}>Create a New Room</button>
            <button className="btn-secondary" type="button" onClick={() => { setShowRoomForm(false); setUsername(''); }}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantsRoute({ room, isLoggedIn }) {
  const { roomName } = useParams();
  const decodedRoomName = decodeURIComponent(roomName || '');
  const navigate = useNavigate();

  const handleClose = () => {
    if (room && isLoggedIn) {
      navigate(`/chat/${encodeURIComponent(room)}`);
    } else {
      navigate('/discover');
    }

    function RoomSettingsRoute({ room, isLoggedIn }) {
      const navigate = useNavigate();
      const { roomName } = useParams();

      if (!roomName) {
        return <Navigate to="/discover" replace />;
      }

      const decodedRoomName = decodeURIComponent(roomName);

      return (
        <RoomSettingsPage
          roomName={decodedRoomName}
          onClose={() => {
            if (room && isLoggedIn) {
              navigate(`/chat/${encodeURIComponent(room)}`);
            } else {
              navigate('/discover');
            }
          }}
        />
      );
    }
  };

  return (
    <ParticipantsPage
      roomName={decodedRoomName}
      onClose={handleClose}
    />
  );
}

function AdminRoute({ socketRef, room, isLoggedIn, isAdmin }) {
  const navigate = useNavigate();

  const handleClose = () => {
    if (room && isLoggedIn) {
      navigate(`/chat/${encodeURIComponent(room)}`);
    } else {
      navigate('/login');
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Admin socket={socketRef.current} onClose={handleClose} />;
}

function ChatRoomRoute({
  room,
  setRoom,
  isLoggedIn,
  username,
  email,
  picture,
  joinChatRoomCallback,
  selectedBackground,
  toggleMusic,
  isMusicPlaying,
  toggleBackgroundPicker,
  isAdmin,
  handleOpenAdminPanel,
  handleOpenDiscoverRooms,
  handleLeaveRoom,
  showBackgroundPicker,
  backgroundOptions,
  selectBackground,
  showAdminPanel,
  setShowAdminPanel,
  socketRef,
  messagesContainerRef,
  isFetchingOlderMessages,
  messages,
  handleDeleteMessage,
  messagesEndRef,
  typingUser,
  sendMessage,
  showEmojiPicker,
  setShowEmojiPicker,
  setCurrentMessage,
  currentMessage
}) {
  const { roomName } = useParams();
  const decodedRoomName = decodeURIComponent(roomName || '');

  useEffect(() => {
    if (decodedRoomName && decodedRoomName !== room) {
      if (isLoggedIn && username) {
        joinChatRoomCallback(decodedRoomName, username, email, picture);
      } else {
        const savedSession = localStorage.getItem('chatSession');
        if (savedSession) {
          const { name, email: savedEmail, picture: savedPicture } = JSON.parse(savedSession);
          if (name) {
            joinChatRoomCallback(decodedRoomName, name, savedEmail, savedPicture);
            return;
          }
        }
        setRoom(decodedRoomName);
      }
    }
  }, [decodedRoomName, room, isLoggedIn, username, email, picture, joinChatRoomCallback, setRoom]);

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
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
          <button onClick={toggleMusic} className="btn-secondary" title={isMusicPlaying ? "Mute Music" : "Play Music"}>
            {isMusicPlaying ? <FaVolumeMute /> : <FaMusic />}
          </button>
          <button className="change-bg-btn" onClick={toggleBackgroundPicker} title="Change Background">
            <img src={`${process.env.PUBLIC_URL}/change_bg.png`} alt="Change Background" />
          </button>
          {isAdmin && (
            <button className="btn-primary" onClick={handleOpenAdminPanel} title="Admin Panel">🔒</button>
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
          .filter(msg => {
            if (!msg.room) return true;
            return msg.room.trim().toLowerCase() === (room || '').trim().toLowerCase();
          })
          .sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
          })
          .map((msg, idx) => {
            const keyVal = msg._id || `${msg.timestamp || ''}-${msg.username || 'sys'}-${idx}`;
            if (msg.type !== 'chat') {
              return (
                <div key={keyVal} className="message-item system">
                  <span className="system-text">{msg.text}</span>
                </div>
              );
            }

            const isOwnMessage = msg.username === username;
            
            return (
              <div key={keyVal} className={`message-wrapper ${isOwnMessage ? 'own-message-wrapper' : ''}`}>
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
                {(isAdmin || isOwnMessage) && (
                  <button onClick={() => handleDeleteMessage(msg._id)} className="delete-btn" title="Delete message" aria-label="Delete message">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M10 2h4a1 1 0 0 1 1 1v1h4a1 1 0 0 1 1 1v1.5a0.5 0.5 0 0 1-0.5 0.5H3.5A0.5 0.5 0 0 1 3 6.5V5a1 1 0 0 1 1-1h4V3a1 1 0 0 1 1-1zm1 2v1h2V4h-2zM4.5 9h15l-1.15 12.05A2 2 0 0 1 16.36 23H7.64a2 2 0 0 1-1.99-1.95L4.5 9zM9.5 12a0.75 0.75 0 0 0-0.75 0.75v6.5a0.75 0.75 0 0 0 1.5 0v-6.5A0.75 0.75 0 0 0 9.5 12zm2.5 0a0.75 0.75 0 0 0-0.75 0.75v6.5a0.75 0.75 0 0 0 1.5 0v-6.5A0.75 0.75 0 0 0 12 12zm2.5 0a0.75 0.75 0 0 0-0.75 0.75v6.5a0.75 0.75 0 0 0 1.5 0v-6.5A0.75 0.75 0 0 0 14.5 12z" />
                    </svg>
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
            if (socketRef.current && (room || '').trim()) {
              socketRef.current.emit("typing", {
                room: (room || '').trim(),
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