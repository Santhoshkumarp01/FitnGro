import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';

const AdminPage = () => {
  const [experts, setExperts] = useState([]);
  const [error, setError] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    const fetchExperts = async () => {
      try {
        const response = await fetch('https://fitngro-backend-bthfa8hrg7h3etd5.centralindia-01.azurewebsites.net/approved-experts');
        if (!response.ok) throw new Error('Failed to fetch experts');
        const data = await response.json();
        setExperts(data.filter(expert => !expert.approved));
      } catch (err) {
        setError('Failed to fetch experts: ' + err.message);
      }
    };
    fetchExperts();
  }, []);

  const handleApprove = async (userEmail) => {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('https://fitngro-backend-bthfa8hrg7h3etd5.centralindia-01.azurewebsites.net/approve-expert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${idToken}`,
        },
        body: `user_email=${encodeURIComponent(userEmail)}`,
      });
      if (!response.ok) throw new Error('Failed to approve expert');
      setExperts(experts.filter(expert => expert.user_email !== userEmail));
      alert('Expert approved successfully');
    } catch (err) {
      setError('Error approving expert: ' + err.message);
    }
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
    },
    heading: {
      fontSize: '24px',
      marginBottom: '20px',
      color: '#333',
    },
    error: {
      color: 'red',
      marginBottom: '10px',
    },
    list: {
      listStyle: 'none',
      padding: 0,
    },
    item: {
      background: '#f9f9f9',
      padding: '15px',
      marginBottom: '10px',
      borderRadius: '5px',
      border: '1px solid #ddd',
    },
    button: {
      background: '#28a745',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      marginTop: '10px',
    },
    link: {
      color: '#007bff',
      textDecoration: 'none',
      marginRight: '10px',
    },
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Pending Expert Approvals</h2>
      {error && <p style={styles.error}>{error}</p>}
      {experts.length === 0 && <p>No pending approvals</p>}
      <ul style={styles.list}>
        {experts.map(expert => (
          <li key={expert.user_email} style={styles.item}>
            <strong>{expert.name}</strong> ({expert.user_email})<br />
            Specialist: {expert.specialist} | Expertise: {expert.expertise}<br />
            Age: {expert.age} | Fee: ${expert.client_fee}<br />
            Bio: {expert.bio}<br />
            <a
              href={expert.certification_url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View Certificate
            </a><br />
            <button
              onClick={() => handleApprove(expert.user_email)}
              style={styles.button}
            >
              Approve
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminPage;