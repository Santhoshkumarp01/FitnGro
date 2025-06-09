import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import PrimaryButton from '../buttons/PrimaryButton';
import './ExpertDashboard.css'; // Create this CSS file

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

const ExpertDashboard = () => {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const [chatNotifications, setChatNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch chat notifications
  useEffect(() => {
    if (!currentUser?.email) {
      navigate('/?showAuth=true');
      return;
    }

    const chatsQuery = query(
      collection(db, 'chats'),
      where('expertEmail', '==', currentUser.email)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const notifications = [];
      const promises = [];

      snapshot.forEach((doc) => {
        const chatId = doc.id;
        const data = doc.data();
        const clientEmail = data.clientEmail;

        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const messagesQuery = query(
          messagesRef,
          where('sender', '==', clientEmail),
          where('read', '==', false)
        );

        promises.push(
          new Promise((resolve) => {
            onSnapshot(messagesQuery, (msgSnapshot) => {
              const unreadCount = msgSnapshot.size;
              if (unreadCount > 0) {
                notifications.push({ clientEmail, unreadCount, chatId });
              }
              resolve();
            }, (error) => {
              console.error(`Error fetching messages for ${clientEmail}:`, error);
              // Log the error but don't add to notifications since experts should have access
              resolve();
            });
          })
        );
      });

      Promise.all(promises).then(() => {
        setChatNotifications([...notifications]);
      });
    }, (error) => {
      console.error('Error fetching chats:', error);
      alert(`Failed to fetch chats: ${error.message}`);
    });

    return () => unsubscribe();
  }, [currentUser, navigate]);


  // Toggle notification dropdown
  const handleChatIconClick = () => {
    setShowNotifications(!showNotifications);
  };

  // Navigate to chat
  const handleChatWithClient = (clientEmail, chatId) => {
    navigate('/chat', { state: { clientEmail, expertEmail: currentUser.email } });
    setShowNotifications(false);
  };

  if (!currentUser) return null;

  return (
    <motion.div
      className="expert-dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <h2>Welcome, Expert {currentUser.email}</h2>
      <p>Manage your clients and create workout plans.</p>

      {/* Chat Icon */}
      <motion.div
        className="chat-icon"
        variants={itemVariants}
        onClick={handleChatIconClick}
        style={{ position: 'absolute', top: '20px', right: '20px', cursor: 'pointer' }}
      >
        <img src="/chat-icon.svg" alt="Chat" width="30" height="30" />
        {chatNotifications.length > 0 && (
          <span className="notification-badge">
            {chatNotifications.reduce((sum, n) => sum + n.unreadCount, 0)}
          </span>
        )}
      </motion.div>

      {/* Notification Dropdown */}
      {showNotifications && (
        <motion.div
          className="notification-dropdown"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {chatNotifications.length === 0 ? (
            <p>No new messages</p>
          ) : (
            chatNotifications.map((notification, index) => (
              <div
                key={index}
                className="notification-item"
                onClick={() => handleChatWithClient(notification.clientEmail, notification.chatId)}
                style={{ cursor: 'pointer' }}
              >
                <p>
                  {notification.clientEmail}: {notification.unreadCount} new message(s)
                  {notification.isPremium && <span style={{ color: 'gold', marginLeft: '5px' }}> (Premium)</span>}
                </p>
              </div>
            ))
          )}
        </motion.div>
      )}

      <PrimaryButton onClick={() => navigate('/manage-clients')}>
        Manage Clients
      </PrimaryButton>
      <PrimaryButton onClick={() => navigate('/create-workout')}>
        Create Workout Plan
      </PrimaryButton>
      <PrimaryButton onClick={() => auth.signOut().then(() => navigate('/'))}>
        Logout
      </PrimaryButton>
    </motion.div>
  );
};

export default ExpertDashboard;