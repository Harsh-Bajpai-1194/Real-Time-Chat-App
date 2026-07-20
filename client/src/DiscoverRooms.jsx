import React, { useState, useEffect } from 'react';
import './DiscoverRooms.css';

// Automatically import ALL .mp4 files from the './sounds' directory
const soundContext = require.context('./sounds', false, /\.mp4$/);
const allSounds = soundContext.keys().map(soundContext);

// GLOBAL variable to track the audio even when this component is closed/unmounted
let globalAudio = null;

const DiscoverRooms = ({ joinChatRoom, onClose, onJoin, username, email, picture, roomsSignature, onViewMembers }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/rooms');
        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }
        const data = await response.json();
        setRooms(data.sort((a, b) => b.totalMessages - a.totalMessages));
        setError(null);
      } catch (err) {
        setError(err.message);
        setRooms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [roomsSignature]);

  const handleJoinRoom = (roomName) => {
    // 1. STOP whatever is currently playing globally
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.currentTime = 0; // Rewind the old track
      globalAudio.onended = null;  // Remove the old loop listener
    }

    // 2. Define the continuous play function
    const playContinuousSounds = () => {
      if (allSounds.length > 0) {
        const randomSound = allSounds[Math.floor(Math.random() * allSounds.length)];
        const audio = new Audio(randomSound);
        
        // Save this new audio object to our global variable
        globalAudio = audio;

        // When this audio finishes, loop again
        globalAudio.onended = playContinuousSounds;
        
        globalAudio.play().catch(err => console.log("Playback prevented or failed:", err));
      } else {
        console.warn("No sounds were found in the ./sounds folder!");
      }
    };

    // 3. Start the brand new infinite playlist
    playContinuousSounds();
    
    const result = joinChatRoom(roomName, username, email, picture);
    if (result !== 'confirm') {
      onJoin();
    }
  };

  return (
    <div className="discover-rooms-overlay">
      <div className="discover-rooms-container">
        <header className="discover-rooms-header">
          <h2>Discover Rooms</h2>
          <button onClick={onClose} className="close-btn" title="Close">×</button>
        </header>
        <main className="discover-rooms-list">
          {loading && <p>Loading rooms...</p>}
          {error && <p className="error-message">{error}</p>}
          {!loading && !error && rooms.map((room) => (
            <div key={room.name} className="room-card">
              <div className="room-icon">{room.icon}</div>
              <div className="room-details">
                <h3>{room.name}</h3>
                <p>{room.desc}</p>
              </div>
              <div className="room-stats">
                <div className="stat-item">
                  <strong>{room.memberCount}</strong>
                  <span>Members</span>
                </div>
                <div className="stat-item">
                  <strong>{room.totalMessages}</strong>
                  <span>Messages</span>
                </div>
              </div>
              <div className="room-actions">
                <button className="btn-primary" onClick={() => handleJoinRoom(room.name)}>
                  Join Room
                </button>
                <div className="room-sub-actions">
                  <button className="participants-button" type="button" title="View members" onClick={() => onViewMembers(room.name)}>
                    <img src={`${process.env.PUBLIC_URL}/participants.png`} alt="View members" />
                  </button>
                  <button className="settings-button" type="button" title="Room settings">
                    <img src={`${process.env.PUBLIC_URL}/settings.png`} alt="Room settings" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && !error && rooms.length === 0 && (
            <p>No rooms available to display.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default DiscoverRooms;