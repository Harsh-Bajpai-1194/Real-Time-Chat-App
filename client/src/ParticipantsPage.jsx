import React, { useState, useEffect } from 'react';
import './ParticipantsPage.css';

const ParticipantsPage = ({ roomName, onClose }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        // Use a relative path. This requires the `/api/rooms/:roomName/members` endpoint on the server.
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/members`);
        if (!response.ok) {
          throw new Error(`Failed to fetch room members (status: ${response.status})`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setMembers(data);
          setError(null);
        } else {
          throw new Error('Received an invalid response from the server. Expected JSON.');
        }
      } catch (err) {
        setError(err.message);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [roomName]);

  return (
    <div className="members-page">
      <header className="members-header">
        <button onClick={onClose} className="back-link">
          ← Back to Rooms
        </button>
        <h2>All Members in "{roomName}"</h2>
      </header>
      <main className="members-list">
        {loading && (
          <div className="loading-spinner-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}
        {!loading && !error && (
          <ul>
            {members.map((member, index) => (
              <li key={index} className="member-item">
                <img
                  src={member.picture || `${process.env.PUBLIC_URL}/default-avatar.png`}
                  alt={member.username}
                  className="member-avatar"
                />
                <span className="member-name">{member.username}</span>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && members.length === 0 && (
          <p>This room has no members yet.</p>
        )}
      </main>
    </div>
  );
};

export default ParticipantsPage;