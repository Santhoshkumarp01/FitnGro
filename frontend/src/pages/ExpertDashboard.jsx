// frontend/src/pages/ExpertDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { db } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const containerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
};

const ExpertDashboard = ({ userEmail }) => {
  const [expertData, setExpertData] = useState(null);
  const [error, setError] = useState(null);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [chatList, setChatList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExpertData = async () => {
      try {
        const expertDocRef = doc(db, 'experts', userEmail);
        const expertDocSnap = await getDoc(expertDocRef);
        if (!expertDocSnap.exists()) {
          throw new Error('No expert profile found for this email');
        }
        const data = expertDocSnap.data();
        if (!data.approved) {
          throw new Error('Your expert account is still pending admin approval');
        }
        setExpertData(data);
      } catch (err) {
        setError('Error loading profile: ' + err.message);
      }
    };

    const fetchChatList = async () => {
      try {
        const chatsRef = collection(db, 'chats');
        const chatSnapshot = await getDocs(chatsRef);
        const chatData = [];
        for (const chatDoc of chatSnapshot.docs) {
          const chatId = chatDoc.id;
          if (chatId.includes(userEmail.replace('.', '_'))) {
            const parts = chatId.replace('chat_', '').split('_');
            const clientEmail = parts.find(part => part !== userEmail.replace('.', '_'))?.replace('_', '.');
            if (clientEmail) {
              const messagesRef = collection(db, 'chats', chatId, 'messages');
              const lastMessageQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
              const lastMessageSnapshot = await getDocs(lastMessageQuery);
              let lastMessage = null;
              let unreadCount = 0;
              if (!lastMessageSnapshot.empty) {
                lastMessage = lastMessageSnapshot.docs[0].data();
                const unreadQuery = query(
                  messagesRef,
                  where('sender', '==', clientEmail),
                  where('read', '==', false)
                );
                const unreadSnapshot = await getDocs(unreadQuery);
                unreadCount = unreadSnapshot.size;
              }
              chatData.push({
                id: chatId,
                clientEmail,
                lastMessage,
                unreadCount,
                timestamp: lastMessage?.timestamp
              });
            }
          }
        }
        chatData.sort((a, b) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return b.timestamp.toDate() - a.timestamp.toDate();
        });
        setChatList(chatData);
      } catch (err) {
        console.error('Error fetching chats:', err);
        setChatList([]);
      }
    };

    if (userEmail) {
      fetchExpertData();
      fetchChatList();
    }
  }, [userEmail]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Sign-Out Error:', error);
    }
  };

  const toggleHamburgerMenu = () => {
    setIsHamburgerOpen(!isHamburgerOpen);
  };

  const openChat = (clientEmail) => {
    navigate('/chat', {
      state: {
        clientEmail: clientEmail,
        expertEmail: userEmail
      }
    });
  };

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

  const tabStyle = {
    display: 'flex',
    marginBottom: '20px',
    borderBottom: '1px solid #444'
  };

  const tabButtonStyle = (isActive) => ({
    padding: '10px 20px',
    backgroundColor: isActive ? '#ffd700' : 'transparent',
    color: isActive ? '#1e1e1e' : '#f0f0f0',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '5px 5px 0 0',
    marginRight: '5px'
  });

  const chatItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#2a2a2a',
    marginBottom: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  };

  return (
    <>
      <motion.div className="navbar" variants={containerVariants} initial="hidden" animate="visible">
        <motion.div className="navbar-child" variants={itemVariants} />
        <motion.div className="fitness" variants={itemVariants} onClick={() => navigate('/fitness')}>
          Fitness
        </motion.div>
        <motion.div className="about" variants={itemVariants} onClick={() => navigate('/about')}>
          About
        </motion.div>
        <motion.div className="experts" variants={itemVariants} onClick={() => navigate('/experts')}>
          Experts
        </motion.div>
        <motion.div className="profile" variants={itemVariants} onClick={() => navigate('/expert-dashboard')}>
          Profile
        </motion.div>
        <motion.div className="login-button-navbar" variants={itemVariants}>
          <motion.div className="login-button-navbar-child" variants={itemVariants} />
          <motion.button
            className="logout-button-navbar"
            variants={itemVariants}
            onClick={handleSignOut}
          >
            Logout
          </motion.button>
        </motion.div>
      </motion.div>

      <motion.div className="right-navbar" variants={containerVariants}>
        <motion.button
          className="hamburger-button"
          variants={itemVariants}
          onClick={toggleHamburgerMenu}
          aria-label="Menu"
        >
          <div className="hamburger-line" />
          <div className="hamburger-line" />
          <div className="hamburger-line" />
        </motion.button>

        {isHamburgerOpen && (
          <motion.div
            className="hamburger-menu"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <motion.ul className="hamburger-menu-list">
              <motion.li className="hamburger-menu-item">
                <button
                  className="hamburger-menu-button"
                  onClick={() => {
                    navigate('/settings');
                    setIsHamburgerOpen(false);
                  }}
                >
                  Settings
                </button>
              </motion.li>
              <motion.li className="hamburger-menu-item">
                <button
                  className="hamburger-menu-button"
                  onClick={() => {
                    navigate('/dashboard');
                    setIsHamburgerOpen(false);
                  }}
                >
                  Dashboard
                </button>
              </motion.li>
            </motion.ul>
          </motion.div>
        )}
      </motion.div>

      <div style={containerStyle}>
        {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
        
        <div style={tabStyle}>
          <button 
            style={tabButtonStyle(activeTab === 'profile')}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button 
            style={tabButtonStyle(activeTab === 'chats')}
            onClick={() => setActiveTab('chats')}
          >
            Chats ({chatList.length})
          </button>
        </div>

        {activeTab === 'profile' && (
          <>
            {!expertData ? (
              <p style={{ color: '#f0f0f0', textAlign: 'center' }}>Loading profile...</p>
            ) : (
              <>
                <h2 style={{ color: '#ffd700', marginBottom: '15px', textAlign: 'center' }}>
                  Welcome, {expertData.name}
                </h2>
                <p style={{ fontSize: '16px', lineHeight: '1.5', margin: '8px 0'}}>Email: {expertData.user_email}</p>
                <p style={{ fontSize: '16px', lineHeight: '1.5', margin: '8px 0' }}>Specialist: {expertData.specialist}</p>
                <p style={{ fontSize: '16px', lineHeight: '1.5', margin: '8px 0' }}>Expertise: {expertData.expertise}</p>
                <p style={{ fontSize: '16px', lineHeight: '1.5', margin: '8px 0' }}>Client Fee: ${expertData.client_fee}</p>
                <p style={{ fontSize: '16px', lineHeight: '1.5', margin: '8px 0' }}>Bio: {expertData.bio}</p>
                <a
                  href={expertData.certification_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    marginTop: '15px',
                    color: '#1e90ff',
                    textDecoration: 'none',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  View Certificate
                </a>
              </>
            )}
          </>
        )}

        {activeTab === 'chats' && (
          <div>
            <h3 style={{ color: '#ffd700', marginBottom: '20px' }}>Client Chats</h3>
            {chatList.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888' }}>No active chats</p>
            ) : (
              chatList.map((chat) => (
                <div
                  key={chat.id}
                  style={chatItemStyle}
                  onClick={() => openChat(chat.clientEmail)}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {chat.clientEmail}
                    </div>
                    <div style={{ color: '#bbb', fontSize: '14px' }}>
                      {chat.lastMessage ? chat.lastMessage.text.substring(0, 50) + '...' : 'No messages yet'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {chat.unreadCount > 0 && (
                      <div style={{
                        backgroundColor: '#ff4444',
                        color: 'white',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        marginBottom: '4px'
                      }}>
                        {chat.unreadCount}
                      </div>
                    )}
                    <div style={{ color: '#888', fontSize: '12px' }}>
                      {chat.timestamp ? new Date(chat.timestamp.toDate()).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ExpertDashboard;