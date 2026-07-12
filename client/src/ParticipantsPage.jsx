import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './ParticipantsPage.css';

const ParticipantsPage = () => {
  const { roomName } = useParams();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/participants`);
        if (!response.ok) {
          throw new Error('Failed to fetch participants');
        }
        const data = await response.json();
        setParticipants(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setParticipants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [roomName]);

  return (
    <div className="participants-page">
      <header className="participants-header">
        <Link to="/discover" className="back-link">← Back to Rooms</Link>
        <h2>Participants in "{roomName}"</h2>
      </header>
      <main className="participants-list">
        {loading && <p>Loading participants...</p>}
        {error && <p className="error-message">{error}</p>}
        {!loading && !error && (
          <ul>
            {participants.map((participant, index) => (
              <li key={index} className="participant-item">
                <img
                  src={participant.picture || `${process.env.PUBLIC_URL}/default-avatar.png`}
                  alt={participant.username}
                  className="participant-avatar"
                />
                <span className="participant-name">{participant.username}</span>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && participants.length === 0 && (
          <p>There are currently no participants in this room.</p>
        )}
      </main>
    </div>
  );
};

export default ParticipantsPage;