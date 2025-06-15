import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { auth } from './services/firebase';
import HomePage from './pages/HomePage';
import DashboardPage from './components/Dashboard/DashboardPage';
import WorkoutDayPage from './pages/WorkoutDayPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import AdminPage from './pages/AdminPage';
import ExpertDashboard from './components/Dashboard/ExpertDashboard';
import ExpertInfo from './pages/ExpertInfo';
import ChatPage from './components/chats/ChatPage';
import ExpertsPage from './pages/ExpertsPage';

const AppRoutes = ({ user, loading }) => {
  const location = useLocation();

  if (loading) {
    return (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-50 z-50">
    <div className="text-center p-8">
      <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-blue-100 rounded-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">FitNGro</h2>
      <p className="text-gray-600">Preparing your fitness journey...</p>
    </div>
  </div>
);
  }

  if (user && user.email === 'fitngro@gmail.com' && location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage userEmail={user?.email} />} />
      <Route
        path="/dashboard"
        element={
          user ? (
            <DashboardPage userEmail={user.email} />
          ) : (
            <Navigate to="/?showAuth=true" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/expert-dashboard"
        element={
          user ? (
            <ExpertDashboard userEmail={user.email} />
          ) : (
            <Navigate to="/?showAuth=true" replace state={{ from: location }} />
          )
        }
      />
      <Route path="/experts" element={<ExpertsPage />} />
      <Route
        path="/expert-info"
        element={
          user ? (
            <ExpertInfo />
          ) : (
            <Navigate to="/?showAuth=true" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/chat"
        element={
          user ? (
            <ChatPage />
          ) : (
            <Navigate to="/?showAuth=true" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/workout/:day"
        element={
          user ? (
            <WorkoutDayPage userEmail={user.email} />
          ) : (
            <Navigate to="/?showAuth=true" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/exercise/:userEmail/:workoutName"
        element={
          user ? (
            <ExerciseDetailPage key={location.pathname} userEmail={user.email} />
          ) : (
            <Navigate to="/?showAuth=true" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/admin"
        element={
          user && user.email === 'fitngro@gmail.com' ? (
            <AdminPage />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  const [authState, setAuthState] = useState({
    user: null,
    loading: true,
  });

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker registered:', reg))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }

    // Firebase auth state listener
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        console.log('Auth state changed - User:', user?.email);
        setAuthState({
          user,
          loading: false,
        });

        if (user && sessionStorage.getItem('redirectUrl')) {
          const redirectUrl = sessionStorage.getItem('redirectUrl');
          sessionStorage.removeItem('redirectUrl');
          window.location.href = redirectUrl;
        }
      },
      (error) => {
        console.error('Authentication error:', error);
        setAuthState({
          user: null,
          loading: false,
        });
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <GoogleOAuthProvider clientId="your-actual-client-id.apps.googleusercontent.com">
      <Router>
        <AppRoutes user={authState.user} loading={authState.loading} />
      </Router>
    </GoogleOAuthProvider>
  );
};

export default App;