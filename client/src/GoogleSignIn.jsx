import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const GoogleSignIn = ({ onSignIn }) => {
    const handleSuccess = (credentialResponse) => {
        try {
            // Decode the JWT token to extract the user's Google info
            const payload = jwtDecode(credentialResponse.credential);
            
            if (payload && payload.name) {
                onSignIn({ name: payload.name, email: payload.email, picture: payload.picture });
            }
        } catch (error) {
            console.error('Error decoding Google JWT', error);
        }
    };

    const isDev = process.env.NODE_ENV !== 'production' || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname.includes('dev');

    // Add a mock login for development/local testing to make testing easier
    if (isDev) {
        const handleMockSignIn = () => {
            onSignIn({
                name: 'Mock Admin',
                email: 'harshbajpai1194@gmail.com',
                // Using a service that provides placeholder avatars
                picture: 'https://i.pravatar.cc/150?u=mockadmin' 
            });
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                <GoogleLogin
                    onSuccess={handleSuccess}
                    onError={() => console.log('Google Login Failed')}
                />
                <button onClick={handleMockSignIn} className="btn-secondary" style={{padding: '8px 12px'}}>
                    Sign In as Mock Admin
                </button>
            </div>
        );
    }

    return (
        <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => console.log('Google Login Failed')}
        />
    );
};

export default GoogleSignIn;