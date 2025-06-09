// frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, updateDoc, where } from 'firebase/firestore';
import './ChatPage.css';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.2 } },
};

const messageVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = auth.currentUser;
  const messagesEndRef = useRef(null);

  const { clientEmail: stateClientEmail, expertEmail } = location.state || {};
  const userEmail = currentUser?.email.trim().toLowerCase();
  const isExpert = userEmail === expertEmail;

  const clientEmail = (stateClientEmail || userEmail).trim().toLowerCase();
  const otherUserEmail = isExpert ? clientEmail : expertEmail;

  const chatRoomId = clientEmail && expertEmail
    ? `chat_${clientEmail.replace('.', '_')}_${expertEmail.replace('.', '_')}`
    : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!currentUser || !clientEmail || !expertEmail) {
      console.error('Missing auth or chat room details', { currentUser, clientEmail, expertEmail });
      navigate('/?showAuth=true');
    }
  }, [currentUser, clientEmail, expertEmail, navigate]);

  useEffect(() => {
    if (!chatRoomId) return;

    const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(messagesData);
      scrollToBottom();
    
      const unreadQuery = query(
        messagesRef,
        where('sender', '==', isExpert ? clientEmail : expertEmail),
        where('read', '==', false)
      );
      const unreadSnapshot = await getDocs(unreadQuery);
      unreadSnapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, { read: true });
      });
    }, (error) => {
      console.error('Error fetching messages:', error);
      alert(`Failed to load messages: ${error.message}`);
    });

    return () => unsubscribe();
  }, [chatRoomId, isExpert, clientEmail, expertEmail]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatRoomId) return;

    try {
      const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
      await addDoc(messagesRef, {
        sender: userEmail,
        text: newMessage,
        timestamp: serverTimestamp(),
        senderType: isExpert ? 'expert' : 'client',
        read: false,
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const CreateWorkoutPlanModal = ({ clientEmail, onClose }) => {
    const [allWorkouts, setAllWorkouts] = useState([]);
    const [selectedWorkoutsByDay, setSelectedWorkoutsByDay] = useState({});
    const [selectedDay, setSelectedDay] = useState('day1');
    const [calendarDays, setCalendarDays] = useState([]);

    useEffect(() => {
      const fetchWorkouts = async () => {
        try {
          const response = await fetch('http://localhost:8000/get-all-workouts', {
            headers: { 'Authorization': `Bearer ${await auth.currentUser.getIdToken()}` }
          });
          if (!response.ok) throw new Error('Failed to fetch workouts');
          const data = await response.json();
          setAllWorkouts(data.workouts);
        } catch (error) {
          console.error('Error fetching workouts:', error);
          alert('Failed to fetch workouts');
        }
      };

      const initializeCalendar = () => {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const restDays = [2, 6]; // Wednesday and Sunday
        const days = [];
        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, month, i);
          days.push({
            day: i,
            isRest: restDays.includes(date.getDay()),
            isToday: i === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear()
          });
        }
        setCalendarDays(days);
        const initialDays = {};
        for (let i = 1; i <= daysInMonth; i++) {
          initialDays[`day${i}`] = [];
        }
        setSelectedWorkoutsByDay(initialDays);
      };

      fetchWorkouts();
      initializeCalendar();
    }, []);

    const toggleWorkout = (workout, sets, reps, duration) => {
      setSelectedWorkoutsByDay(prev => {
        const dayWorkouts = prev[selectedDay] || [];
        const exists = dayWorkouts.find(w => w.name === workout.name);
        let updatedDayWorkouts;
        if (exists) {
          updatedDayWorkouts = dayWorkouts.filter(w => w.name !== workout.name);
        } else {
          const newWorkout = { name: workout.name };
          if (workout.category === 'main') {
            newWorkout.sets = parseInt(sets) || 3;
            newWorkout.reps = parseInt(reps) || 10;
          } else {
            newWorkout.duration = duration || 30; // seconds
          }
          updatedDayWorkouts = [...dayWorkouts, newWorkout];
        }
        return { ...prev, [selectedDay]: updatedDayWorkouts };
      });
    };

    const handleSubmit = async () => {
      try {
        const response = await fetch('http://localhost:8000/create-workout-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
          },
          body: JSON.stringify({
            user_email: clientEmail,
            selected_workouts: selectedWorkoutsByDay
          })
        });
        if (!response.ok) throw new Error('Failed to create plan');
        alert('Workout plan created successfully!');
        onClose();
      } catch (error) {
        console.error('Error creating plan:', error);
        alert('Failed to create workout plan');
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>Create Workout Plan for {clientEmail}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '20px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontWeight: 'bold' }}>{day}</div>
            ))}
            {calendarDays.map(day => (
              <div
                key={day.day}
                style={{
                  textAlign: 'center',
                  padding: '10px',
                  backgroundColor: day.isRest ? '#ffcccc' : day.isToday ? '#ccffcc' : selectedDay === `day${day.day}` ? '#e0e0e0' : '#fff',
                  border: '1px solid #ddd',
                  cursor: day.isRest ? 'default' : 'pointer',
                  opacity: day.isRest ? 0.6 : 1
                }}
                onClick={() => !day.isRest && setSelectedDay(`day${day.day}`)}
              >
                {day.day}
              </div>
            ))}
          </div>
          <h4>Workouts for Day {selectedDay.replace('day', '')}</h4>
          <div style={{ maxHeight: '200px', overflowY: 'scroll', marginBottom: '10px' }}>
            {allWorkouts.map(workout => (
              <div key={workout.id} style={{ marginBottom: '10px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={(selectedWorkoutsByDay[selectedDay] || []).some(w => w.name === workout.name)}
                    onChange={() => toggleWorkout(workout, 3, 10, 30)}
                  />
                  {workout.name} ({workout.category})
                </label>
                {workout.category === 'main' && (selectedWorkoutsByDay[selectedDay] || []).some(w => w.name === workout.name) && (
                  <div style={{ marginLeft: '20px' }}>
                    <label>Sets: <input type="number" min="1" defaultValue="3" onChange={(e) => toggleWorkout(workout, e.target.value, null, null)} /></label>
                    <label style={{ marginLeft: '10px' }}>Reps: <input type="number" min="1" defaultValue="10" onChange={(e) => toggleWorkout(workout, null, e.target.value, null)} /></label>
                  </div>
                )}
                {(workout.category === 'warmup' || workout.category === 'cooldown') && (selectedWorkoutsByDay[selectedDay] || []).some(w => w.name === workout.name) && (
                  <div style={{ marginLeft: '20px' }}>Duration: 30 seconds</div>
                )}
              </div>
            ))}
          </div>
          <button onClick={handleSubmit}>Save Plan</button>
          <button onClick={onClose} style={{ marginLeft: '10px' }}>Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <motion.div className="chat-page" variants={containerVariants} initial="hidden" animate="visible">
      <button onClick={() => navigate(isExpert ? '/expert-dashboard' : '/dashboard')} className="back-button">Back</button>
      <h2>Chat with {otherUserEmail}</h2>
      <div className="chat-container">
        <div className="messages-container">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              className={`message ${message.sender === userEmail ? 'sent' : 'received'}`}
              variants={messageVariants}
            >
              <p><strong>{message.senderType}:</strong> {message.text}</p>
              <span className="timestamp">
                {message.timestamp?.toDate().toLocaleTimeString()}
              </span>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="message-input"
          />
          <button type="submit" className="send-button">Send</button>
        </form>
      </div>
      {isExpert && (
        <button
          onClick={() => setShowCreatePlan(true)}
          className="change-plan-button"
          style={{ marginTop: '10px' }}
        >
          Create Workout Plan
        </button>
      )}
      {showCreatePlan && (
        <CreateWorkoutPlanModal
          clientEmail={clientEmail}
          onClose={() => setShowCreatePlan(false)}
        />
      )}
    </motion.div>
  );
};

export default ChatPage;