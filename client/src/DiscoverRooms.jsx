import React, { useState, useEffect } from 'react';
import './DiscoverRooms.css';

const DiscoverRooms = ({ joinChatRoom, onClose, onJoin, username, email, picture, roomsSignature }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        // Use a relative path for the API request.
        // In development, this will be proxied to the backend server as configured in client/package.json.
        const response = await fetch('https://real-time-chat-app-gl64.onrender.com/api/rooms');
        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }
        const data = await response.json();
        // Sort rooms by the number of messages in descending order
        setRooms(data.sort((a, b) => b.totalMessages - a.totalMessages));
        setError(null);
      } catch (err) {
        setError(err.message);
        setRooms([]); // Clear rooms on error
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [roomsSignature]); // Re-fetch when rooms are updated on the server

  const handleJoinRoom = (roomName) => {
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
                  <button className="participants-button" type="button" title="View participants">
                    <img src={`${process.env.PUBLIC_URL}/participants.png`} alt="View participants" />
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
