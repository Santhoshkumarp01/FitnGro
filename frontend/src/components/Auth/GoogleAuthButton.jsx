// src/components/auth/GoogleAuthButton.jsx
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

const GoogleAuthButton = ({ onSuccess, onError }) => {
  return (
    <GoogleLogin
      onSuccess={(credentialResponse) => {
        console.log('Google Login Success:', credentialResponse);
        if (onSuccess) onSuccess(credentialResponse);
      }}
      onError={() => {
        console.error('Google Login Failed');
        if (onError) onError();
      }}
    />
  );
};

export default GoogleAuthButton;
