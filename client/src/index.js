import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

if (!clientId) {
  console.error("FATAL: REACT_APP_GOOGLE_CLIENT_ID is not defined in your .env file. Google Sign-In will not work.");
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId || ""}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);