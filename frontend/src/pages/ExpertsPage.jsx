import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth } from '../services/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User, Star, MessageCircle, Award, Mail, Briefcase, IndianRupee } from 'lucide-react';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5 } },
  hover: { 
    scale: 1.02, 
    y: -5,
    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
    transition: { duration: 0.3 }
  }
};

const ExpertsPage = () => {
  const [experts, setExperts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApprovedExperts = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://fitngro-backend-bthfa8hrg7h3etd5.centralindia-01.azurewebsites.net/approved-experts', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch experts');
        const data = await response.json();
        setExperts(data);
      } catch (error) {
        console.error('Error fetching experts:', error);
        alert(`Failed to load experts: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchApprovedExperts();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user?.email || null);
      if (user) {
        try {
          const expertDocRef = doc(db, 'experts', user.email);
          const expertDocSnap = await getDoc(expertDocRef);
          setCurrentUserType(expertDocSnap.exists() ? 'expert' : 'normal');
        } catch (error) {
          console.error('Error checking expert status:', error);
          setCurrentUserType('normal');
        }
      } else {
        setCurrentUserType(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      navigate('/');
    } catch (error) {
      console.error('Sign-Out Error:', error);
    }
  };

  const toggleHamburgerMenu = () => {
    setIsHamburgerOpen(!isHamburgerOpen);
  };

  const handleChatWithExpert = async (expert) => {
    if (!currentUser) {
      navigate('/?showAuth=true');
      return;
    }
    const clientEmail = currentUser;
    const expertEmail = expert.user_email;
    const chatRoomId = `chat_${clientEmail.replace('.', '_')}_${expertEmail.replace('.', '_')}`;
    try {
      await setDoc(doc(db, 'chats', chatRoomId), {
        clientEmail,
        expertEmail,
        createdAt: serverTimestamp(),
      }, { merge: true });
      navigate('/chat', { state: { clientEmail, expertEmail } });
    } catch (error) {
      console.error('Error initializing chat:', error.message, error);
      alert('Failed to start chat. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black from-gray-50 via-white to-blue-50">
      {/* Navigation Bar */}
      <motion.div 
        className="navbar bg-white shadow-lg border-b border-gray-100" 
        variants={containerVariants} 
        initial="hidden" 
        animate="visible"
      >
        <motion.div className="navbar-child" variants={itemVariants} />
        {/* <motion.div 
          className="fitness text-gray-700 hover:text-blue-600 cursor-pointer font-medium transition-colors duration-200" 
          variants={itemVariants} 
          onClick={() => navigate('/fitness')}
        >
          Fitness
        </motion.div> */}
        <motion.div 
          className="about text-gray-700 hover:text-blue-600 cursor-pointer font-medium transition-colors duration-200" 
          variants={itemVariants} 
          onClick={() => navigate('/about')}
        >
          About
        </motion.div>
        <motion.div 
          className="experts text-blue-600 cursor-pointer font-semibold border-b-2 border-blue-600" 
          variants={itemVariants} 
          onClick={() => navigate('/experts')}
        >
          Experts
        </motion.div>
        {currentUserType === 'expert' && (
          <motion.div 
            className="profile text-gray-700 hover:text-blue-600 cursor-pointer font-medium transition-colors duration-200" 
            variants={itemVariants} 
            onClick={() => navigate('/expert-dashboard')}
          >
            Profile
          </motion.div>
        )}
        <motion.div className="login-button-navbar" variants={itemVariants}>
          <motion.div className="login-button-navbar-child" variants={itemVariants} />
          {!currentUser ? (
            <motion.button
              className="login-button-navbar1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-all duration-200 shadow-md hover:shadow-lg"
              variants={itemVariants}
              onClick={() => navigate('/?showAuth=true')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Login
            </motion.button>
          ) : (
            <motion.button
              className="logout-button-navbar bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-full font-medium transition-all duration-200 shadow-md hover:shadow-lg"
              variants={itemVariants}
              onClick={handleSignOut}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Logout
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      {/* Hamburger Menu */}
      <motion.div className="right-navbar" variants={containerVariants}>
        <motion.button
          className="hamburger-button bg-white shadow-lg rounded-full p-3 hover:shadow-xl transition-shadow duration-200"
          variants={itemVariants}
          onClick={toggleHamburgerMenu}
          aria-label="Menu"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <div className="hamburger-line bg-gray-700" />
          <div className="hamburger-line bg-gray-700" />
          <div className="hamburger-line bg-gray-700" />
        </motion.button>

        {isHamburgerOpen && (
          <motion.div
            className="hamburger-menu bg-white shadow-2xl rounded-xl border border-gray-100"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <motion.ul className="hamburger-menu-list p-2">
              <motion.li className="hamburger-menu-item">
                <button
                  className="hamburger-menu-button w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors duration-200"
                  onClick={() => {
                    navigate('/settings');
                    setIsHamburgerOpen(false);
                  }}
                >
                  Settings
                </button>
              </motion.li>
              {currentUser && (
                <motion.li className="hamburger-menu-item">
                  <button
                    className="hamburger-menu-button w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors duration-200"
                    onClick={() => {
                      navigate('/dashboard');
                      setIsHamburgerOpen(false);
                    }}
                  >
                    Dashboard
                  </button>
                </motion.li>
              )}
            </motion.ul>
          </motion.div>
        )}
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl font-bold text-gray-100 mb-4 bg-orange-600 bg-clip-text text-transparent">
            Meet Our Experts
          </h1>
          <p className="text-xl text-white max-w-2xl mx-auto leading-relaxed">
            Connect with certified fitness professionals who will guide you on your wellness journey
          </p>
          <div className="w-24 h-1 bg-orange-600 mx-auto mt-6 rounded-full"></div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600"></div>
          </div>
        )}

        {/* No Experts State */}
        {!loading && experts.length === 0 && (
          <motion.div 
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <User className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <p className="text-xl text-gray-500">No approved experts available at the moment.</p>
            <p className="text-gray-400 mt-2">Check back soon for new fitness professionals!</p>
          </motion.div>
        )}

        {/* Experts Grid */}
        {!loading && experts.length > 0 && (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {experts.map((expert, index) => (
              <motion.div
                key={index}
                className="bg-black rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100"
                variants={cardVariants}
                whileHover="hover"
              >
                {/* Expert Avatar */}
                <div className="relative bg-orange-600 h-32 flex items-center justify-center">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <User className="h-10 w-10 text-black" />
                  </div>
                  <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                    <div className="flex items-center text-white text-sm font-medium">
                      <Star className="h-4 w-4 mr-1 fill-current" />
                      Expert
                    </div>
                  </div>
                </div>

                {/* Expert Info */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-white mb-4">{expert.name}</h3>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-gray-300">
                      <Mail className="h-4 w-4 mr-2 text-blue-500" />
                      <span className="text-sm">{expert.user_email}</span>
                    </div>
                    
                    <div className="flex items-center text-gray-300">
                      <Briefcase className="h-4 w-4 mr-2 text-green-500" />
                      <span className="text-sm font-medium">{expert.specialist}</span>
                    </div>
                    
                    <div className="flex items-center text-gray-300">
                      <Award className="h-4 w-4 mr-2 text-purple-500" />
                      <span className="text-sm">{expert.expertise}</span>
                    </div>
                    
                    <div className="flex items-center text-gray-300">
                      <IndianRupee className="h-4 w-4 mr-2 text-yellow-500" />
                      <span className="text-sm font-semibold">{expert.client_fee} per session</span>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="mb-6">
                    <p className="text-white text-sm leading-relaxed line-clamp-3">
                      {expert.bio}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <motion.button
                      className="w-full bg-orange-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center"
                      onClick={() => handleChatWithExpert(expert)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Chat with Expert
                    </motion.button>
                    
                    <motion.a
                      href={expert.certification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-white hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center text-sm"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Award className="h-4 w-4 mr-2" />
                      View Certificate
                    </motion.a>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ExpertsPage;