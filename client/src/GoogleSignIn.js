import React from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
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

    return (
        <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com"}>
            <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => console.log('Google Login Failed')}
            />
        </GoogleOAuthProvider>
    );
};

export default GoogleSignIn;