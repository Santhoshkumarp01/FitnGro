import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import './DashboardPage.css';

const DashboardPage = ({ userEmail }) => {
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('days');
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();
  const { day } = useParams();

  useEffect(() => {
    if (!userEmail) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    const fetchPlan = async () => {
      setLoading(true);
      setError(null);

      try {
        const docRef = doc(db, 'workout_plans', userEmail);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.days && Array.isArray(data.days)) {
            setPlan(data.days);
            if (day) {
              const dayData = data.days.find(d => d.day === parseInt(day));
              if (dayData) {
                setSelectedDay(dayData);
                setCurrentStep('workouts');
              }
            }
          } else {
            throw new Error('Invalid plan format: missing days array');
          }
        } else {
          throw new Error('No workout plan found');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [userEmail, day]);

  const handleDayClick = (dayData) => {
    if (dayData.rest) return;
    setSelectedDay(dayData);
    setCurrentStep('workouts');
    navigate(`/workout/${dayData.day}`);
  };

  const handleWorkoutClick = (workoutName) => {
    const sanitizedName = workoutName
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    navigate(`/exercise/${sanitizedName}`, {
      state: {
        ...selectedDay.workouts.find(w => w.name === workoutName),
        workoutList: selectedDay.workouts,
        currentIndex: selectedDay.workouts.findIndex(w => w.name === workoutName)
      }
    });
  };

  const goBack = () => {
    if (currentStep === 'workouts') {
      setCurrentStep('days');
      navigate('/dashboard');
    }
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading your workout plan...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Plan</h2>
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Try Again</button>
    </div>
  );

  if (!plan.length) return (
    <div className="empty-plan">
      <h2>No Workout Plan Found</h2>
      <p>Please generate a new workout plan using the chatbot</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <h1>Your FitnGro Workout Plan</h1>
      
      <div className="navigation-steps">
        <div 
          className={`step ${currentStep === 'days' ? 'active' : ''}`}
          onClick={() => setCurrentStep('days')}
        >
          Days
        </div>
        <div 
          className={`step ${currentStep === 'workouts' ? 'active' : 'disabled'}`}
        >
          Workouts
        </div>
      </div>

      <div className={`content-section ${currentStep === 'days' ? 'active' : ''}`}>
        <div className="days-grid">
          {plan.map((dayData) => (
            <div
              key={dayData.day}
              className={`day-card ${dayData.rest ? 'rest-day' : ''}`}
              onClick={() => handleDayClick(dayData)}
            >
              <h3 className='day-header'>Day {dayData.day}</h3>
              {dayData.rest ? (
                <p>Rest Day</p>
              ) : (
                <>
                  <p>{dayData.workouts.length} workouts</p>
                  {/* <div className="more-exercises">Click to view workouts</div> */}

                  {/* <div className="more-exercises">
                    Click to view workouts
                  </div> */}

                </>
              )}
          </div>
          ))}
        </div>
      </div>

      <div className={`content-section ${currentStep === 'workouts' ? 'active' : ''}`}>
        {selectedDay && (
          <>
            <button className="back-button" onClick={goBack}>← Back to Days</button>
            <h2>Day {selectedDay.day} Workouts</h2>
            <div className="workouts-list">
              {selectedDay.workouts.map((workout, index) => (
                <div 
                  key={index} 
                  className="workout-card"
                  onClick={() => handleWorkoutClick(workout.name)}
                >
                  <div className="exercise-header">
                    <h3>{workout.name}</h3>
                    <div className="exercise-sets">
                      {workout.sets} sets × {workout.reps} {workout.type}
                    </div>
                  </div>
                  <div className="exercise-arrow">→</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;