// src/components/auth/LoginPage.jsx
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import './LoginPage.css';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const LoginPage = ({ onLoginSuccess }) => {
  const navigate = useNavigate();

  const handleSuccess = (response) => {
    const decoded = jwtDecode(response.credential);
    const userEmail = decoded.email;
    console.log('Login successful:', userEmail);
    onLoginSuccess(userEmail); // Update App.jsx state
    navigate('/home'); // Redirect to home
  };

  const handleError = () => {
    console.error('Login failed!');
  };

  return (
    <div className="login-page">
      <h1>Welcome to FitnGro</h1>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        theme="outline"
        size="large"
      />
    </div>
  );
};

export default LoginPage;