import React from 'react';

const Admin = ({ socket, onClose }) => {
  return (
    <div className="popup-overlay">
      <div className="login-form" style={{ maxWidth: '500px' }}>
        <h2>🔒</h2>
        <p>Admin controls would be here.</p>
        <p>For example, you could list users or messages to manage.</p>
        <div className="form-actions">
          <button className="btn-secondary" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default Admin;