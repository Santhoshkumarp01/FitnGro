import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HomePage.css';
import './HomePageTailwind.css';
import '../components/buttons/buttons.css';
import { motion, AnimatePresence } from 'framer-motion';
import PrimaryButton from '../components/buttons/PrimaryButton';
import SecondaryButton from '../components/buttons/SecondaryButton';
import Chatbot from '../components/Chatbot/Chatbot';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import '../components/Dashboard/ExpertDashboard';
import { db } from '../services/firebase';  // adjust path to match your project
import { doc, getDoc } from 'firebase/firestore';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import heroBg from '../assets/hero-img.jpg';


// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
};

const expertFieldsVariants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
};

const HomePage = ({ userEmail }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [userType, setUserType] = useState('normal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [specialist, setSpecialist] = useState('');
  const [expertise, setExpertise] = useState('Diet');
  const [clientFee, setClientFee] = useState('');
  const [certification, setCertification] = useState(null);
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState({});
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(userEmail || null);
  const [currentUserType, setCurrentUserType] = useState(null);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  // solutions section 
  const [detailedView, setDetailedView] = useState(false);


  const navigate = useNavigate();
  const location = useLocation();
  const storage = getStorage();


  const testimonials = [
    {
      id: 1,
      text: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate",
      image: "frontend/src/assets/customer-1.png",
      username: "Sudharsan",
      role: "Developer"
    },
    {
      id: 2,
      text: "FitnGro revolutionizes fitness training for our institution. Its expert-guided plans and AI-powered workouts are accessible to all, with browser-based technology eliminating app download barriers. The real-time form correction ensures proper technique, making it ideal for both beginners and expert trainers.",
      image: "frontend/src/assets/customer-2.jpeg",
      username: "Vasnath Disha",
      role: "Educational Sports Authority"
    },
    {
      id: 3,
      text: "FitnGro’s AI-powered home training keeps me competition-ready. Its real-time movement analysis ensures precise form, and the browser-based platform allows training anywhere. It’s like having a 24/7 personal coach for consistent, professional-grade results",
      image: "image 6.png",
      username: "Priya S",
      role: "State-Level Javelin Thrower, University Games Champion"
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  // Auto-rotate every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (autoRotate) {
        setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRotate, testimonials.length]);

  const nextTestimonial = () => {
    setAutoRotate(false);
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
    setTimeout(() => setAutoRotate(true), 30000);
  };

  const prevTestimonial = () => {
    setAutoRotate(false);
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
    setTimeout(() => setAutoRotate(true), 30000);
  };



const solutions = [
    {
      icon: '🌐',
      title: 'No App Downloads Required',
      description: 'Access our complete fitness platform directly through your web browser. No storage space needed, no app store downloads, and instant access from any device.',
      color: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      icon: '⚡',
      title: 'Low Battery & Network Usage',
      description: 'Our advanced browser-based processing minimizes battery drain and network consumption, allowing longer workout sessions without performance issues.',
      color: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      icon: '📱',
      title: 'Works on Any Device',
      description: 'Compatible with smartphones, tablets, laptops, and desktops. No specific hardware requirements - just a camera and internet connection.',
      color: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      icon: '🚀',
      title: 'Ready in Seconds',
      description: 'No waiting for downloads or installations. Simply visit our website, set up your device, and start your workout immediately with full AI-powered monitoring.',
      color: 'bg-yellow-50',
      iconColor: 'text-yellow-600'
    },
    {
      icon: '🧠',
      title: 'Smart AI Processing',
      description: 'Advanced pose detection and rep counting happen in real-time directly in your browser, providing instant feedback without external servers.',
      color: 'bg-indigo-50',
      iconColor: 'text-indigo-600'
    },
    {
      icon: '🔒',
      title: 'Your Data Stays Local',
      description: 'All processing happens on your device. Your workout videos and personal data never leave your browser, ensuring complete privacy and security.',
      color: 'bg-red-50',
      iconColor: 'text-red-600'
    }
  ];


// 
// 
  useEffect(() => {
    const fetchApprovedExperts = async () => {
      try {
        const response = await fetch('http://localhost:8000/approved-experts', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch experts');
        const data = await response.json();
        setExperts(data); // Remove .experts since backend now returns array directly
      } catch (error) {
        console.error('Error fetching experts:', error);
        setMessages(prev => [
          ...prev,
          { text: `Failed to load experts: ${error.message}`, sender: 'bot' },
        ]);
      }
    };
    fetchApprovedExperts();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed - User:', user?.email);
      setCurrentUser(user?.email || null);

      if (user) {
        try {
          console.log('Fetching expert document for email:', user.email);
          const expertDocRef = doc(db, 'experts', user.email);
          const expertDocSnap = await getDoc(expertDocRef);
          console.log('Expert document exists:', expertDocSnap.exists());
          setCurrentUserType(expertDocSnap.exists() ? 'expert' : 'normal');
        } catch (error) {
          console.error('Error checking expert status:', error);
          console.log('Error code:', error.code);
          console.log('Error message:', error.message);
          if (error.code === 'permission-denied') {
            console.log('Permission denied for experts document, setting user as normal');
            setCurrentUserType('normal');
          } else {
            setErrors({ form: `Error checking user type: ${error.message}` });
          }
        }
      } else {
        setCurrentUserType(null);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (authMode === 'signup' && userType === 'expert') {
      if (!name || name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';
      if (!age) newErrors.age = 'Age is required';
      else if (isNaN(age) || age < 18 || age > 100) newErrors.age = 'Age must be between 18 and 100';
      if (!specialist || specialist.trim().length < 2) newErrors.specialist = 'Specialist field is required';
      if (!expertise) newErrors.expertise = 'Expertise is required';
      if (!clientFee) newErrors.clientFee = 'Client fee is required';
      else if (isNaN(clientFee) || clientFee <= 0) newErrors.clientFee = 'Client fee must be a positive number';
      if (!certification) newErrors.certification = 'Certificate file is required';
      else if (!certification.name.toLowerCase().endsWith('.pdf')) newErrors.certification = 'Certificate must be a PDF';
      else if (certification.size > 5 * 1024 * 1024) newErrors.certification = 'Certificate must be less than 5MB';
      if (!bio || bio.trim().length < 10) newErrors.bio = 'Bio must be at least 10 characters';
      else if (bio.length > 500) newErrors.bio = 'Bio must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (authMode === 'signup' && userType === 'expert') {
      try {
        let idToken;
        if (auth.currentUser) {
          if (auth.currentUser.email !== email) {
            throw new Error('Current user email does not match the provided email');
          }
          idToken = await auth.currentUser.getIdToken();
        } else {
          const signInMethods = await fetchSignInMethodsForEmail(auth, email);
          if (signInMethods.length > 0) {
            try {
              const userCredential = await signInWithEmailAndPassword(auth, email, password);
              idToken = await userCredential.user.getIdToken();
            } catch (signInError) {
              throw new Error('Invalid password for existing email');
            }
          } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            idToken = await userCredential.user.getIdToken();
          }
        }

        const formData = new FormData();
        formData.append('user_email', email);
        formData.append('name', name);
        formData.append('age', parseInt(age));
        formData.append('specialist', specialist);
        formData.append('expertise', expertise);
        formData.append('client_fee', parseFloat(clientFee));
        formData.append('certification', certification);
        formData.append('bio', bio);

        const signupResponse = await fetch('http://localhost:8000/expert-signup', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` },
          body: formData,
        });

        if (!signupResponse.ok) {
          const errorData = await signupResponse.json();
          throw new Error(errorData.detail || 'Expert signup failed');
        }

        const responseData = await signupResponse.json();
        const certificateUrl = responseData.certificate_url;
        const emailResponse = await fetch('http://localhost:8000/send-admin-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'fitngro@gmail.com',
            subject: 'New Expert Signup Request',
            body: `
            New expert signup request:
            Email: ${email}
            Name: ${name}
            Age: ${age}
            Specialist: ${specialist}
            Expertise: ${expertise}
            Client Fee: ${clientFee}
            Bio: ${bio}
            Certificate URL: ${certificateUrl}
          `,
          }),
        });

        if (!emailResponse.ok) {
          console.warn('Failed to send admin email, but registration succeeded');
        }

        setCurrentUser(email);
        setShowAuth(false);
        setEmail('');
        setPassword('');
        setName('');
        setAge('');
        setSpecialist('');
        setExpertise('Diet');
        setClientFee('');
        setCertification(null);
        setBio('');
        setErrors({});
        alert('Expert registration submitted successfully! You will be notified once approved.');
        // Stay on HomePage after expert signup
      } catch (error) {
        console.error('Expert Signup Failed:', error);
        setErrors({ form: `Signup Error: ${error.message}` });
      }
    } else if (authMode === 'login' && userType === 'expert') {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const expertDocRef = doc(db, 'experts', email);
        const expertDocSnap = await getDoc(expertDocRef);

        if (!expertDocSnap.exists()) {
          throw new Error('No expert profile found for this email');
        }

        const expertData = expertDocSnap.data();

        if (!expertData.approved) {
          throw new Error('Your expert account is still pending admin approval');
        }

        
        setCurrentUser(email);
        setShowAuth(false);
        setEmail('');
        setPassword('');
        setErrors({});

        navigate('/expert-dashboard', { state: { expertData } });
      } catch (error) {
        console.error('Expert Login Failed:', error);
        setErrors({ form: `Login Error: ${error.message}` });
      }
    } else {
      // Normal user login or signup
      try {
        let userCredential;
        if (authMode === 'signup') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        }

        // Call the /signin endpoint to add user to premiumUsers
        const idToken = await userCredential.user.getIdToken();
        const signinResponse = await fetch('http://localhost:8000/signin', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!signinResponse.ok) {
          const errorData = await signinResponse.json();
          throw new Error(errorData.detail || 'Failed to add user to premiumUsers');
        }

        setCurrentUser(email);
        setShowAuth(false);
        setEmail('');
        setPassword('');
        setErrors({});
        navigate('/dashboard');
      } catch (error) {
        console.error(`${authMode === 'signup' ? 'Signup' : 'Login'} Failed:`, error);
        setErrors({ form: `${authMode === 'signup' ? 'Signup' : 'Login'} Error: ${error.message}` });
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      navigate('/');
    } catch (error) {
      console.error('Sign-Out Error:', error);
    }
  };

  const handleFirebaseSignIn = async (e) => {
    e.preventDefault();
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      // Call the /signin endpoint to add user to premiumUsers
      const signinResponse = await fetch('http://localhost:8000/signin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!signinResponse.ok) {
        const errorData = await signinResponse.json();
        throw new Error(errorData.detail || 'Failed to add user to premiumUsers');
      }

      setCurrentUser(result.user.email);
      setShowAuth(false);
      // Stay on HomePage after Google sign-in
    } catch (error) {
      console.error('Firebase Sign-In Failed:', error);
      alert(`Sign-In Error: ${error.message}`);
    }
  };

  const handleGeneratePlan = async (formData) => {
    try {
      const idToken = await auth.currentUser.getIdToken();
      console.log("Request payload:", {
        user_email: currentUser,
        days: formData.days || 21,
        focus: formData.focus || formData.fitness_goal || "strength"
      });
      console.log("Authorization header:", `Bearer ${idToken}`);
      const response = await fetch('http://localhost:8000/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          user_email: currentUser,
          days: formData.days || 21,
          focus: formData.focus || formData.fitness_goal || "strength",
        }),
      });
      if (!response.ok) throw new Error(`Failed to generate plan: ${response.statusText}`);
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        { text: 'Workout plan generated successfully!', sender: 'bot' },
      ]);
      navigate('/dashboard');
    } catch (error) {
      console.error("Plan generation failed:", error);
      setMessages(prev => [
        ...prev,
        { text: `Failed to generate plan: ${error.message}`, sender: 'bot' },
      ]);
    }
  };

  const toggleHamburgerMenu = () => {
    setIsHamburgerOpen(!isHamburgerOpen);
  };



  // plans
  const plans = [
    {
      type: 'Self-Guided',
      title: 'AI Powered Fitness',
      price: 'Free',
      description: 'Smart technology guidance without human experts',
      features: [
        'AI-powered workout plans',
        'Browser-based pose detection',
        'Automated rep counting',
        'Basic progress tracking',
        'Community support forum',
        'Email support (72h response)'
      ],
      cta: 'Start Free',
      popular: false,
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-700'
    },
    {
      type: 'Expert-Guided',
      title: 'Precision Training',
      price: '$49',
      period: '/month',
      description: '1-on-1 coaching with certified fitness experts',
      features: [
        'Personalized workout plans',
        'Live video sessions with experts',
        'Form correction in real-time',
        'Nutrition planning',
        'Weekly progress reviews',
        '24/7 priority support',
        'Customized recovery plans',
        'Advanced analytics dashboard'
      ],
      cta: 'Get Started',
      popular: true,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-400',
      textColor: 'text-blue-700'
    }
  ];

  return (
    <>
      <motion.div className="property-1variant3" variants={containerVariants} initial="hidden" animate="visible">
        {currentUser && <Chatbot userEmail={currentUser} onGeneratePlan={handleGeneratePlan} setMessages={setMessages} />}

        {/* Left Navbar */}
        <motion.div className="navbar" variants={containerVariants}>
          <motion.div className="navbar-child" variants={itemVariants} />
          {/* <motion.div className="fitness" variants={itemVariants}>Fitness</motion.div> */}
          <motion.div className="about" variants={itemVariants}>About</motion.div>
          <motion.div className="experts" variants={itemVariants} onClick={() => navigate('/experts')}>
            Experts
          </motion.div>
          {currentUserType === 'expert' && (
            <motion.div className="profile" variants={itemVariants} onClick={() => navigate('/expert-dashboard')}>
              Profile
            </motion.div>
          )}
          <motion.div className="login-button-navbar" variants={itemVariants}>
            <motion.div className="login-button-navbar-child" variants={itemVariants} />
            {!currentUser ? (
              <motion.button
                className="login-button-navbar1"
                variants={itemVariants}
                onClick={() => setShowAuth(true)}
              >
                Login
              </motion.button>
            ) : (
              <motion.button
                className="logout-button-navbar"
                variants={itemVariants}
                onClick={handleSignOut}
              >
                Logout
              </motion.button>
            )}
          </motion.div>
        </motion.div>

        {/* Right Navbar with Hamburger Menu */}
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
      {currentUser && (
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
      )}
      {currentUserType === 'expert' && (
        <motion.li className="hamburger-menu-item">
          <button
            className="hamburger-menu-button"
            onClick={() => {
              navigate('/expert-dashboard');
              setIsHamburgerOpen(false);
            }}
          >
            Profile
          </button>
        </motion.li>
      )}
    </motion.ul>
  </motion.div>
)}


        </motion.div>

        

        {showAuth && (
          <div className="auth-modal-overlay">
            <div className="auth-modal-content">
              <button className="close-modal" onClick={() => setShowAuth(false)}>×</button>
              <h3>{authMode === 'signup' ? 'Create Account' : 'Welcome Back'}</h3>
              <div className="user-type-selection">
                <label>User Type</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label>
                    <input
                      type="radio"
                      value="normal"
                      checked={userType === 'normal'}
                      onChange={() => setUserType('normal')}
                    />
                    Normal User
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="expert"
                      checked={userType === 'expert'}
                      onChange={() => setUserType('expert')}
                    />
                    Expert
                  </label>
                </div>
              </div>
              <div className="google-login-container">
                <button onClick={handleFirebaseSignIn} style={{ padding: '10px 20px', fontSize: '16px' }}>
                  Sign in with Google
                </button>
              </div>
              <div className="auth-divider">or</div>
              <div className="scrollable-form-container">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'error' : ''}
                    placeholder="Enter your email"
                  />
                  {errors.email && <span className="error-message">{errors.email}</span>}
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'error' : ''}
                    placeholder="Enter your password"
                  />
                  {errors.password && <span className="error-message">{errors.password}</span>}
                </div>
                <AnimatePresence>
                  {authMode === 'signup' && userType === 'expert' && (
                    <motion.div
                      variants={expertFieldsVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                    >
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={errors.name ? 'error' : ''}
                          placeholder="Enter your full name"
                        />
                        {errors.name && <span className="error-message">{errors.name}</span>}
                      </div>
                      <div className="form-group">
                        <label>Age</label>
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className={errors.age ? 'error' : ''}
                          placeholder="Enter your age"
                        />
                        {errors.age && <span className="error-message">{errors.age}</span>}
                      </div>
                      <div className="form-group">
                        <label>Specialist</label>
                        <input
                          type="text"
                          value={specialist}
                          onChange={(e) => setSpecialist(e.target.value)}
                          className={errors.specialist ? 'error' : ''}
                          placeholder="Enter your specialty"
                        />
                        {errors.specialist && <span className="error-message">{errors.specialist}</span>}
                      </div>
                      <div className="form-group">
                        <label>Expertise</label>
                        <div style={{ display: 'flex', gap: '20px' }}>
                          <label>
                            <input
                              type="radio"
                              value="Diet"
                              checked={expertise === 'Diet'}
                              onChange={() => setExpertise('Diet')}
                            />
                            Diet
                          </label>
                          <label>
                            <input
                              type="radio"
                              value="Fitness"
                              checked={expertise === 'Fitness'}
                              onChange={() => setExpertise('Fitness')}
                            />
                            Fitness
                          </label>
                        </div>
                        {errors.expertise && <span className="error-message">{errors.expertise}</span>}
                      </div>
                      <div className="form-group">
                        <label>Client Fee (per session)</label>
                        <input
                          type="number"
                          value={clientFee}
                          onChange={(e) => setClientFee(e.target.value)}
                          className={errors.clientFee ? 'error' : ''}
                          placeholder="Enter your fee"
                        />
                        {errors.clientFee && <span className="error-message">{errors.clientFee}</span>}
                      </div>
                      <div className="form-group">
                        <label>Certificate (PDF)</label>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setCertification(e.target.files[0])}
                          className={errors.certification ? 'error' : ''}
                        />
                        {errors.certification && <span className="error-message">{errors.certification}</span>}
                      </div>
                      <div className="form-group">
                        <label>Short Bio</label>
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          className={errors.bio ? 'error' : ''}
                          placeholder="Enter a short bio (max 500 characters)"
                          rows="4"
                        />
                        {errors.bio && <span className="error-message">{errors.bio}</span>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {errors.form && <span className="error-message">{errors.form}</span>}
              </div>
              <button type="submit" className="auth-submit-btn" onClick={handleSubmit}>
                {authMode === 'signup' ? 'Sign Up' : 'Login'}
              </button>
              <div className="auth-mode-toggle">
                {authMode === 'signup' ? (
                  <span>
                    Already have an account? <button onClick={() => setAuthMode('login')}>Login</button>
                  </span>
                ) : (
                  <span>
                    Need an account? <button onClick={() => setAuthMode('signup')}>Sign Up</button>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}



<div
  className="relative overflow-hidden bg-center bg-cover sm:bg-[url('')] lg:bg-[url('')]"
  style={{
    backgroundImage: window.innerWidth >= 640 ? `url(${heroBg})` : 'none',
  }}
>
  {/* Background pattern (optional) */}
  <div className="absolute inset-0 opacity-10">
    <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent mix-blend-overlay"></div>
  </div>

  {/* Container */}
  <div className="max-w-7xl mx-auto px-4 lg:mt-10 sm:px-6 lg:px-8 py-20 md:py-8 lg:py-50 lg:ml-35">
    {/* Flex container for side-by-side layout */}
    <div className="relative flex flex-col lg:ml-55 lg:mb-70 items-center lg:items-start gap-8 lg:gap-12">
      
      {/* Left content */}
      <div className="flex-1 text-center lg:mb-20 lg:max-w-2xl">
        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-black mb-6">
          <span className="block">Transform Your</span>
          <span className="block text-orange-600">Fitness Journey</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-gray-800 mb-10">
          AI-powered workout plans tailored to your goals. No downloads required - 
          access everything directly in your browser.
        </p>

        {/* CTA Buttons */}
        <div className="flex justify-center sm:flex-row gap-4">
          <button className="px-8 py-3 bg-orange-600 hover:bg-[#000000] hover:text-[#ef4d31] text-white font-bold rounded-lg transition-all transform hover:scale-105 ">
            Get Started Free
          </button>
          <button className="px-8 py-3 bg-transparent border-2 border-black text-black hover:bg-black hover:text-[#ef4d31] font-bold rounded-lg transition-all md:border-4">
            Meet Our Experts
          </button>
        </div>
      </div>

      {/* Right image */}
      {/* <div className="flex-1 flex justify-center lg:justify-end">
        <img 
          src='frontend/src/assets/hero-ai.png' 
          alt="AI Hero" 
          className="w-80 h-80 lg:w-150 lg:h-150 xl:w-[500px] xl:h-[300px] object-contain"
        /> 
      </div> */}
      
    </div>
  </div>
</div>

</motion.div>



    {/* Solutions Section */}
<section className="py-16 bg-black">
  <div className="max-w-7xl mx-auto px-4 sm:mt-0 sm:px-6 lg:px-8">
    <div className="text-center mb-12">
      <h2 className="text-4xl font-bold text-[#e4e4e4] mb-4 ">
        Revolutionizing Fitness with Smart Technology
      </h2>
      <p className="text-xl text-[#e4e4e4] max-w-3xl mx-auto">
        No apps, no downloads, no hassle - just results
      </p>
      
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => setDetailedView(!detailedView)}
          className={`px-4 py-2 rounded-full font-medium transition-all ${detailedView ? 'bg-[#e4e4e4] text-black' : 'bg-[#ef4d31] text-white'}`}
        >
          {detailedView ? 'Show Icon View' : 'Show Detailed View'}
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {solutions.map((solution, index) => (
        <div 
          key={index}
          className={`bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border-t-4 border-[#ef4d31]`}
        >
          {detailedView ? (
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center mb-4">
                <span className={`text-3xl mr-4 text-[#ef4d31]`}>{solution.icon}</span>
                <h3 className="text-xl font-semibold text-gray-800">{solution.title}</h3>
              </div>
              <p className="text-gray-600 flex-grow">{solution.description}</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button className="text-[#ef4d31] font-medium hover:text-[#d0452e] transition-colors">
                  Learn more →
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center text-center h-full">
              <span className={`text-5xl mb-4 text-[#ef4d31]`}>{solution.icon}</span>
              <h3 className="text-lg font-semibold text-gray-800">{solution.title}</h3>
              <button 
                className="mt-4 text-sm text-[#ef4d31] hover:text-[#d0452e] transition-colors"
                onClick={() => setDetailedView(true)}
              >
                + Details
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
</section>

{/* Pricing Section */}
<section className="py-16 bg-white">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-12">
      <h2 className="text-3xl font-extrabold text-gray-900 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] sm:text-4xl">
        Choose Your Fitness Journey
      </h2>
      <p className="mt-4 text-xl text-gray-600">
        Compare our self-guided AI platform with expert-led precision training
      </p>
    </div>

    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
      {/* Self-Guided Plan */}
      <div className="rounded-lg shadow-lg overflow-hidden bg-[#e4e4e4] border-4 border-[#ef4d31]">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center ">
            <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold text-gray-700 bg-white">
              Self-Guided
            </span>
          </div>
          <h3 className="mt-4 text-2xl font-bold text-gray-900">AI Powered Fitness</h3>
          <p className="mt-1 text-gray-600">Smart technology guidance without human experts</p>
          <div className="mt-4 flex items-baseline">
            <span className="text-4xl font-extrabold text-[#ef4d31]">Free</span>
          </div>
        </div>
        
        <div className="px-6 py-6">
          <ul className="space-y-3">
            {plans[0].features.slice(0, 4).map((feature, index) => (
              <li key={index} className="flex items-start">
                <svg className="h-5 w-5 flex-shrink-0 text-[#ef4d31]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="ml-3 text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
          
          <div className="mt-8">
            <button
              onClick={() => currentUser ? navigate('/dashboard') : setShowAuth(true)}
              className="w-full flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-[#ef4d31] hover:bg-[#d0452e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ef4d31]"
            >
              Start Free
            </button>
          </div>
          
          <p className="mt-4 text-center text-sm text-gray-500">
            No credit card required
          </p>
        </div>
      </div>

      {/* Expert-Guided Plan */}
      <div className="rounded-lg shadow-lg overflow-hidden bg-[#e4e4e4] border-4 border-[#000000] transform scale-105 relative">
        <div className="absolute top-0 right-0 bg-[#000000] text-[#ef4d31] px-3 py-1 text-xs font-semibold rounded-bl-lg">
          MOST POPULAR
        </div>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold text-[#ef4d31] bg-black">
              Expert-Guided
            </span>
          </div>
          <h3 className="mt-4 text-2xl font-bold text-gray-900">Precision Training</h3>
          <p className="mt-1 text-gray-600">1-on-1 coaching with certified fitness experts</p>
          <div className="mt-4 flex items-baseline">
            <span className="text-4xl font-extrabold text-[#ef4d31]">PAID</span>
            <span className="ml-1 text-xl font-medium text-gray-500">/month</span>
          </div>
        </div>
        
        <div className="px-6 py-6">
          <ul className="space-y-3">
            {plans[1].features.slice(0, 4).map((feature, index) => (
              <li key={index} className="flex items-start">
                <svg className="h-5 w-5 flex-shrink-0 text-[#ef4d31]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="ml-3 text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
          
          <div className="mt-8">
            <button
              onClick={() => navigate('/experts')}
              className="w-full flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-bold  text-[#ef4d31] bg-[#000000] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ef4d31] "
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-12 bg-[#e4e4e4] rounded-lg p-6 text-center border-4 border-[#000000]">
      <h3 className="text-lg font-medium text-gray-900">Not sure which to choose?</h3>
      <p className="mt-2 text-gray-600">
        Try our free AI plan first, then upgrade to expert guidance when you're ready for personalized coaching.
      </p>
      <button 
        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[#ef4d31] bg-white hover:bg-gray-100"
        onClick={() => navigate('/experts')}
      >
        Compare all features →
      </button>
    </div>
  </div>
</section>

{/* Features Section */}
<section className="py-16 bg-black">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-12">
      <h2 className="text-3xl font-extrabold text-[#e4e4e4] sm:text-4xl">
        Powerful Features
      </h2>
      <p className="mt-4 max-w-2xl text-xl text-[#e4e4e4] mx-auto">
        Everything you need to transform your fitness journey
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
        <div className="w-16 h-16 bg-[#ef4d31] hover:bg-black rounded-full flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-white hover:text-[#ef4d31]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">AI-Powered Workouts</h3>
        <p className="text-gray-600">Get personalized workout plans tailored to your fitness level and goals using advanced AI technology.</p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
        <div className="w-16 h-16 bg-[#ef4d31] hover:bg-black rounded-full flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-white hover:text-[#ef4d31]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">Real-Time Form Correction</h3>
        <p className="text-gray-600">Our AI system monitors your movements and provides instant feedback to improve your form and prevent injuries.</p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
        <div className="w-16 h-16 bg-[#ef4d31] hover:bg-black rounded-full flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-white hover:text-[#ef4d31]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">Progress Tracking</h3>
        <p className="text-gray-600">Track your workout performance, set goals, and achieve better results with data-driven insights.</p>
      </div>
    </div>
  </div>
</section>

{/* Testimonials Section */}
<section className="py-16 bg-white relative overflow-hidden">
  <div className="absolute top-0 left-0 w-full h-full opacity-5">
    <div className="absolute top-1/4 -left-10 w-64 h-64 bg-[#ef4d31] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
    <div className="absolute top-1/2 right-0 w-64 h-64 bg-[#ef4d31] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
    <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-[#ef4d31] rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
  </div>
  
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
    <div className="text-center mb-12">
      <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
        What Our Users Say
      </h2>
      <p className="mt-4 text-xl text-gray-600">
        Hear from people who transformed their fitness with us
      </p>
    </div>

    <div className="relative">
      <div className="relative bg-[#e4e4e4] rounded-xl shadow-lg p-8 md:p-12">
        <div className="absolute top-0 left-0 w-full h-2 bg-[#ef4d31] rounded-4"></div>
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/3 mb-8 md:mb-0 flex justify-center">
            <img 
              src={testimonials[currentIndex].image} 
              alt={testimonials[currentIndex].username}
              className="w-32 h-32 rounded-full object-cover border-4 border-[#ef4d31] shadow-md"
            />
          </div>
          <div className="md:w-2/3 md:pl-8">
            <div className="text-lg text-gray-700 italic mb-6">
              "{testimonials[currentIndex].text}"
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-[#ef4d31]">{testimonials[currentIndex].username}</p>
              <p className="text-gray-600">{testimonials[currentIndex].role}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-8 space-x-4">
        <button 
          onClick={prevTestimonial}
          className="w-12 h-12 rounded-full bg-[#ef4d31] text-white flex items-center justify-center hover:bg-[#d0452e] transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button 
          onClick={nextTestimonial}
          className="w-12 h-12 rounded-full bg-[#ef4d31] text-white flex items-center justify-center hover:bg-[#d0452e] transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</section>

{/* About Us Section */}
<section className="py-16 bg-black">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex flex-col lg:flex-row items-center">
      <div className="lg:w-1/2 mb-12 lg:mb-0 lg:pr-12">
        <h2 className="text-3xl font-extrabold text-[#e4e4e4] sm:text-4xl mb-6">
          About FitnGro
        </h2>
        <p className="text-xl text-[#e4e4e4] mb-8">
          At FitnGro, our team blends fitness expertise and AI technology to personalize your fitness journey. Our app tailors workouts and nutrition plans based on your goals and data, providing real-time tracking and guidance.
        </p>
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-[#ef4d31] bg-opacity-10 p-4 rounded-lg border-l-4 border-[#ef4d31]">
            <h3 className="text-xl font-bold text-[#e4e4e4]">100+</h3>
            <p className="text-[#e4e4e4]">Happy Users</p>
          </div>
          <div className="bg-[#ef4d31] bg-opacity-10 p-4 rounded-lg border-l-4 border-[#ef4d31]">
            <h3 className="text-xl font-bold text-[#e4e4e4]">10+</h3>
            <p className="text-[#e4e4e4]">Certified Experts</p>
          </div>
          <div className="bg-[#ef4d31] bg-opacity-10 p-4 rounded-lg border-l-4 border-[#ef4d31]">
            <h3 className="text-xl font-bold text-[#e4e4e4]">24/7</h3>
            <p className="text-[#e4e4e4]">Support</p>
          </div>
          <div className="bg-[#ef4d31] bg-opacity-10 p-4 rounded-lg border-l-4 border-[#ef4d31]">
            <h3 className="text-xl font-bold text-[#e4e4e4]">AI</h3>
            <p className="text-[#e4e4e4]">Powered</p>
          </div>
        </div>
        {/* <button className="px-6 py-3 bg-[#ef4d31] text-white font-medium rounded-lg hover:bg-[#d0452e] transition-colors">
          Learn More About Us
        </button> */}
      </div>
      <div className="lg:w-1/2 relative">
        <div className="relative">
          <img 
            src="frontend/src/assets/about-us/jj-team.JPG" 
            alt="FitnGro Team" 
            className="rounded-lg shadow-xl w-full h-auto"
          />
          {/* <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[#ef4d31] rounded-lg shadow-lg flex items-center justify-center">
            <span className="text-white text-4xl font-bold">4.9★</span>
          </div> */}
        </div>
      </div>
    </div>
  </div>
</section>

{/* CTA Section */}
<section className="py-16 bg-[#ef4d31]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <h2 className="text-3xl font-extrabold text-white sm:text-4xl mb-6">
      Ready to Transform Your Fitness Journey?
    </h2>
    <p className="text-xl text-gray-300  mb-8 max-w-3xl mx-auto">
      Join thousands of users who are achieving their fitness goals with our AI-powered platform.
    </p>
    <div className="flex flex-col sm:flex-row justify-center gap-4">
      <button 
        onClick={() => currentUser ? navigate('/dashboard') : setShowAuth(true)}
        className="px-8 py-4 bg-white text-[#ef4d31] font-bold rounded-lg hover:bg-gray-100 transition-colors text-lg"
      >
        Get Started for Free
      </button>
      <button 
        onClick={() => navigate('/experts')}
        className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-lg  hover:text-[#ef4d31] hover:bg-black transition-colors text-lg"
      >
        Meet Our Experts
      </button>
    </div>
  </div>
</section>

   <footer className="bg-black text-[#e4e4e4] py-12 px-4 sm:px-6 lg:px-8">
  <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
    {/* Brand Column */}
    <div className="space-y-6">
      <img 
        src="Footer-Logo-FG.png" 
        alt="FitnGro" 
        className="h-12 w-auto"
      />
      <p className="text-sm">
        Revolutionizing fitness with AI-powered technology and expert guidance.
      </p>
      <div className="flex space-x-4">
        <a href="#" className="text-[#e4e4e4] hover:text-[#ef4d31] transition-colors">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
          </svg>
        </a>
        <a href="#" className="text-[#e4e4e4] hover:text-[#ef4d31] transition-colors">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        </a>
        <a href="#" className="text-[#e4e4e4] hover:text-[#ef4d31] transition-colors">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
        </a>
      </div>
    </div>

    {/* Quick Links */}
    <div>
      <h3 className="text-lg font-semibold text-[#ef4d31] mb-4">Quick Links</h3>
      <ul className="space-y-2">
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Home</a></li>
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">About</a></li>
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Features</a></li>
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Pricing</a></li>
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Experts</a></li>
      </ul>
    </div>

    {/* Resources */}
    <div>
      <h3 className="text-lg font-semibold text-[#ef4d31] mb-4">Resources</h3>
      <ul className="space-y-2">
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Blog</a></li>
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Help Center</a></li>
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Tutorials</a></li>
        <li><a href="#" className="hover:text-[#ef4d31] transition-colors">Community</a></li>
      </ul>
    </div>

    {/* Newsletter */}
    <div>
      <h3 className="text-lg font-semibold text-[#ef4d31] mb-4">Stay Updated</h3>
      <p className="mb-4 text-sm">
        Subscribe to our newsletter for the latest fitness tips and updates.
      </p>
      <div className="flex">
        <input 
          type="email" 
          placeholder="Your email" 
          className="px-4 py-2 w-full rounded-l-lg focus:outline-none focus:ring-2 focus:ring-[#ef4d31] text-black"
        />
        <button className="bg-[#ef4d31] hover:bg-[#d0452e] text-white px-4 py-2 rounded-r-lg transition-colors">
          Subscribe
        </button>
      </div>
    </div>
  </div>

  <div className="max-w-7xl mx-auto border-t border-gray-800 mt-12 pt-8 text-center text-sm">
    <p>&copy; {new Date().getFullYear()} FitnGro. All rights reserved.</p>
    <div className="mt-2 space-x-4">
      <a href="#" className="hover:text-[#ef4d31] transition-colors">Privacy Policy</a>
      <a href="#" className="hover:text-[#ef4d31] transition-colors">Terms of Service</a>
      <a href="#" className="hover:text-[#ef4d31] transition-colors">Cookie Policy</a>
    </div>
  </div>
</footer>
    </>
  );
};

export default HomePage;