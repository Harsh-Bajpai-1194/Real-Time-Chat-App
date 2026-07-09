import React, { useState, useEffect } from 'react';

const fallbackRooms = [
  { name: 'Tech Talk', desc: 'Discuss latest tech trends, programming, gadgets.', icon: '💻' },
  { name: 'Gaming Lair', desc: 'Community for gamers, share tips, find teammates.', icon: '🎮' },
  { name: 'Open Discussions', desc: 'General chat for everyone on various topics.', icon: '🗣️' },
  { name: 'Creative Corner', desc: 'Showcase art, design projects, and get feedback.', icon: '🎨' },
  { name: 'Movie Buffs', desc: 'Talking about films, series, and reviews.', icon: '🍿' },
  { name: 'Book Club', desc: 'Share current reads, recommendations, and reviews.', icon: '📚' },
];

export default function Dashboard({ joinChatRoom, onClose, onJoin, username, roomsSignature }) {

  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState(fallbackRooms);
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        // In development, the server runs on a different port.
        // In production, this would be a relative path like '/api/rooms'.
        const apiUrl = process.env.NODE_ENV === 'production'
          ? '/api/rooms'
          : 'http://localhost:7777/api/rooms';

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        // The backend doesn't provide member/online counts yet, so we add placeholders for the UI.
        const roomsWithPlaceholders = data.map(room => ({
          ...room,
          members: Math.floor(Math.random() * 100) + 1, // Placeholder
          online: Math.floor(Math.random() * 20) + 1,   // Placeholder
        }));
        setRooms(roomsWithPlaceholders);
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
        setRooms(fallbackRooms);
      }
    };

    fetchRooms();
  }, [roomsSignature]);

  const filtered = rooms.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || (r.desc && r.desc.toLowerCase().includes(query.toLowerCase())));

  const handleJoin = (roomName) => {
    const result = joinChatRoom(roomName, username || '');
    if (result !== 'confirm') {
      if (onJoin) onJoin();
      if (onClose) onClose();
    }
  };
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Available Chat Rooms to Join</h2>
        <div className="dashboard-actions">
          <input placeholder="Search for rooms..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="rooms-grid">
        {filtered.map((room) => (
          <div key={room.name} className="room-card">
            <div className="room-card-top">
              <div className="room-icon">{room.icon}</div>
              <div className="room-meta">
                <h3>{room.name}</h3>
                <p className="room-desc">{room.desc}</p>
              </div>
            </div>
            <div className="room-card-bottom">
              <div className="room-stats">👥 {room.members} members · 🟢 {room.online} online</div>
              <button className="btn-primary" onClick={() => handleJoin(room.name)}>Join Room</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
