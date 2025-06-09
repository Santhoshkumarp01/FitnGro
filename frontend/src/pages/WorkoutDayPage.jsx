// frontend/src/pages/WorkoutDayPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import './WorkoutDayPage.css';

const WorkoutDayPage = ({ userEmail }) => {
  const { day } = useParams();
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchDayData = async () => {
      try {
        const docRef = doc(db, 'workout_plans', userEmail);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const foundDay = data.days.find(d => d.day === parseInt(day));
          if (foundDay) {
            setDayData(foundDay);
          } else {
            throw new Error(`Day ${day} not found in your plan`);
          }
        } else {
          throw new Error('No workout plan found');
        }
      } catch (err) {
        console.error("Error fetching day data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDayData();
  }, [userEmail, day]);

  const handleWorkoutClick = async (workout, index) => {
    try {
      const docRef = doc(db, 'exercises', workout.name);
      const docSnap = await getDoc(docRef);
  
      const extraData = docSnap.exists() ? docSnap.data() : {};
  
      navigate(`/exercise/${userEmail}/${workout.name}`, {
        state: {
          ...workout,
          ...extraData,
          workoutList: dayData.workouts,
          currentIndex: index
        }
      });
    } catch (err) {
      console.error("Error fetching exercise details:", err);
      navigate(`/exercise/${userEmail}/${workout.name}`, {
        state: {
          ...workout,
          workoutList: dayData.workouts,
          currentIndex: index
        }
      });
    }
  };  

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading day {day} workouts...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Workouts</h2>
      <p>{error}</p>
      <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
    </div>
  );

  return (
    <div className="workout-day-container">
      <button className="back-button" onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </button>

      <h1>Day {day} Workouts</h1>

      {dayData?.rest ? (
        <div className="rest-day-message">
          <h2>Rest Day</h2>
          <p>Take this day to recover and come back stronger tomorrow!</p>
        </div>
      ) : (
        <div className="workouts-list">
          {dayData?.workouts?.map((workout, index) => (
            <div
              key={index}
              className="workout-card"
              onClick={() => handleWorkoutClick(workout, index)}
            >
              <div className="workout-header">
                <h3>{workout.name}</h3>
                <div className="workout-details">
                  {workout.sets} sets × {workout.reps} {workout.type}
                </div>
              </div>
              <div className="workout-arrow">→</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkoutDayPage;