import React from 'react';
import { useLocation } from 'react-router-dom';
import './ExpertInfo.css'; // Assuming you have a CSS file for additional styles

const ExpertInfo = () => {
  const location = useLocation();
  const { expertData } = location.state || {};

  if (!expertData) {
    return <p style={{ color: 'red', textAlign: 'center' }}>Error: No expert data provided.</p>;
  }

  const containerStyle = {
    backgroundColor: '#1e1e1e',
    color: '#f0f0f0',
    padding: '20px',
    borderRadius: '8px',
    maxWidth: '1000px',
    margin: '30px auto',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  };

  const headingStyle = {
    color: '#ffd700',
    marginBottom: '15px',
  };

  const paragraphStyle = {
    fontSize: '16px',
    lineHeight: '1.5',
    margin: '8px 0',
  };

  const linkStyle = {
    display: 'inline-block',
    marginTop: '15px',
    color: '#1e90ff',
    textDecoration: 'none',
    fontWeight: '600',
    cursor: 'pointer',
  };

  return (
    <div>
    <div style={containerStyle}>
      <h2 style={headingStyle}>Welcome, {expertData.name}</h2>
      <p style={paragraphStyle}>Email: {expertData.email}</p>
      <p style={paragraphStyle}>Specialist: {expertData.specialist}</p>
      <p style={paragraphStyle}>Expertise: {expertData.expertise}</p>
      <p style={paragraphStyle}>Client Fee: {expertData.clientFee}</p>
      <p style={paragraphStyle}>Bio: {expertData.bio}</p>
      <a
        href={expertData.certificationUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
        onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        View Certificate
      </a>
    </div>
    </div>
  );
};

export default ExpertInfo;
