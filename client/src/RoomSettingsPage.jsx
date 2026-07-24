import React, { useState } from 'react';
import './RoomSettingsPage.css';

const RoomSettingsPage = ({ roomName, onClose }) => {
  const [enterIsSend, setEnterIsSend] = useState(true);
  const [spamProtection, setSpamProtection] = useState(true);

  return (
    <div className="room-settings-overlay">
      <div className="room-settings-container">
        <header className="room-settings-header">
          <h2>{roomName ? `${roomName} Settings` : 'Room Settings'}</h2>
          <button onClick={onClose} className="close-btn" title="Close">×</button>
        </header>

        <main className="room-settings-content">
          <label className="setting-toggle">
            <span>Enter is Send</span>
            <input
              type="checkbox"
              checked={enterIsSend}
              onChange={(event) => setEnterIsSend(event.target.checked)}
            />
          </label>

          <label className="setting-toggle">
            <span>Spam Protection</span>
            <input
              type="checkbox"
              checked={spamProtection}
              onChange={(event) => setSpamProtection(event.target.checked)}
            />
          </label>
        </main>
      </div>
    </div>
  );
};

export default RoomSettingsPage;
