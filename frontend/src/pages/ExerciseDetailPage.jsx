import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { WORKOUT_MONITORING } from '../workoutMonitoring.js';
import './ExerciseDetailPage.css';

const cleanExerciseName = (name) => {
  return name
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const ExerciseDetailPage = () => {
  const { userEmail, workoutName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [exerciseDetails, setExerciseDetails] = useState(null);
  const [sets, setSets] = useState(3);
  const [targetRepsPerSet, setTargetRepsPerSet] = useState(20);
  const [totalTargetReps, setTotalTargetReps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [workoutList, setWorkoutList] = useState([]);
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [currentSetReps, setCurrentSetReps] = useState(0);
  const [feedback, setFeedback] = useState('Starting workout...');
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('user');
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const restDuration = 30;

  const exerciseDB = {
    "Burpees (No Push-up)": {
      description: "Start in a standing position, drop to push-up position, push back up and jump.",
      videoUrl: "https://www.youtube.com/watch?v=TU8QYVW0gDU"
    },
    "Squats (Holding Chair for Balance)": {
      description: "Stand with feet shoulder-width apart, lower hips until knees bend at 90°.",
      videoUrl: "https://www.youtube.com/watch?v=aclHkVaku9U"
    },
    "Push-ups": {
      description: "Lie face down, place hands shoulder-width apart, push body up until arms are extended, then lower back down.",
      videoUrl: "https://www.youtube.com/watch?v=IODxDxX7oi4"
    }
  };

  const displayExerciseName = cleanExerciseName(workoutName);

  useEffect(() => {
    const fetchExerciseDetails = async () => {
      try {
        setLoading(true);
        if (location.state) {
          const totalSets = location.state?.sets || 3;
          const repsPerSet = location.state?.reps || 20;
          setSets(totalSets);
          setTargetRepsPerSet(repsPerSet);
          setTotalTargetReps(totalSets * repsPerSet);
          setWorkoutList(location.state.workoutList || []);
          setCurrentWorkoutIndex(location.state.currentIndex || 0);
          setExerciseDetails({
            name: workoutName,
            description: exerciseDB[workoutName]?.description || `No description for ${workoutName}`,
            videoUrl: exerciseDB[workoutName]?.videoUrl || null,
            muscle: location.state.muscle || 'General Fitness',
            instructions: location.state.instructions || 'Follow the video and form.'
          });
        }
        const defaultDetails = exerciseDB[workoutName] || {
          description: `No description available for ${workoutName}`,
          videoUrl: null
        };
        setExerciseDetails((prev) => ({ ...prev, ...defaultDetails }));
        const docRef = doc(db, 'exercises', workoutName);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const firebaseData = docSnap.data();
          setExerciseDetails((prev) => ({
            ...prev,
            muscle: firebaseData.muscle,
            instructions: firebaseData.instructions
          }));
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load exercise details.');
      } finally {
        setLoading(false);
      }
    };
    fetchExerciseDetails();
  }, [workoutName, location.state]);

  useEffect(() => {
    if (loading || !workoutStarted) return;

    let monitor = null;
    const startMonitoring = async () => {
      const workoutKey = workoutName.toLowerCase().replace(/\s+/g, '-');
      if (WORKOUT_MONITORING[workoutKey]) {
        try {
          const monitorFn = await WORKOUT_MONITORING[workoutKey]();
          monitor = await monitorFn({
            targetReps: targetRepsPerSet,
            totalSets: sets,
            currentSet,
            userEmail,
            cameraFacing,
            videoRef,
            onFeedback: (message) => {
              setFeedback(message);
              console.log(`[ExerciseDetailPage] Feedback: ${message}`);
            },
            onComplete: async ({ completed, reps, feedback, currentSet: completedSet }) => {
              if (completed) {
                setTotalReps((prev) => prev + reps);
                setCurrentSetReps(reps);
                setFeedback(feedback);

                try {
                  await axios.post(`${process.env.REACT_APP_API_URL}/track-exercise`, {
                    userEmail,
                    exerciseName: workoutName,
                    currentSet: completedSet,
                    totalSets: sets,
                    targetReps: targetRepsPerSet,
                    currentReps: reps,
                  });
                  console.log('[ExerciseDetailPage] Workout progress logged to backend');
                } catch (error) {
                  console.error('[ExerciseDetailPage] Failed to log workout progress:', error);
                }

                if (completedSet < sets) {
                  setIsResting(true);
                  setRestTime(restDuration);
                  setCurrentSet(completedSet + 1);
                  setCurrentSetReps(0);
                } else {
                  handleComplete();
                }
              }
            }
          });
        } catch (error) {
          console.error('[ExerciseDetailPage] Error starting workout:', error);
          setError('Failed to start workout tracking. Please try again.');
          setWorkoutStarted(false);
        }
      } else {
        setError('Workout tracking not available for this exercise.');
        setWorkoutStarted(false);
      }
    };

    startMonitoring();

    return () => {
      if (monitor?.stop) {
        monitor.stop();
        console.log('[ExerciseDetailPage] Workout monitoring stopped');
      }
    };
  }, [loading, workoutName, userEmail, targetRepsPerSet, sets, currentSet, workoutStarted, cameraFacing]);

  useEffect(() => {
    if (isResting) {
      const restInterval = setInterval(() => {
        setRestTime((prev) => {
          const remaining = prev - 1;
          if (remaining <= 0) {
            setIsResting(false);
            setFeedback(`Rest completed! Start Set ${currentSet} of ${sets}.`);
            console.log(`[ExerciseDetailPage] Rest completed for Set ${currentSet}.`);
            return 0;
          }
          return remaining;
        });
      }, 1000);

      return () => clearInterval(restInterval);
    }
  }, [isResting, currentSet, sets]);

  const handleComplete = () => {
    setTimeout(() => {
      if (currentWorkoutIndex < workoutList.length - 1) {
        navigate(`/exercise/${userEmail}/${workoutList[currentWorkoutIndex + 1].name}`, {
          state: {
            ...workoutList[currentWorkoutIndex + 1],
            workoutList,
            currentIndex: currentWorkoutIndex + 1
          }
        });
      } else {
        navigate('/dashboard', { state: { workoutCompleted: true } });
      }
    }, 1000);
  };

  const handleStartWorkout = () => {
    setWorkoutStarted(true);
    setFeedback('Workout started! Position yourself in frame.');
  };

  const handleStopWorkout = () => {
    setWorkoutStarted(false);
    setFeedback('Workout stopped.');
  };

  const toggleCamera = () => {
    setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
  };

  const setRepProgress = (currentSetReps / targetRepsPerSet) * 100;
  const totalRepProgress = (totalReps / totalTargetReps) * 100;

  const handleBackClick = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exercise details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-sm">
          <h3 className="text-xl font-semibold text-red-600">Error</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={handleBackClick}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBackClick}
            className="flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-gray-800 truncate">{displayExerciseName}</h1>
          <div className="w-16"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Exercise Info & Controls */}
          <div className="space-y-6">
            {/* Exercise Info */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">{displayExerciseName}</h2>
              <p className="text-gray-600 text-sm">{exerciseDetails?.description}</p>
              <p className="text-gray-600 text-sm mt-2">
                <strong>Target Muscle:</strong> {exerciseDetails?.muscle || 'General Fitness'}
              </p>
              <p className="text-gray-600 text-sm mt-2">
                <strong>Instructions:</strong> {exerciseDetails?.instructions || 'Follow the video and form.'}
              </p>
            </div>

            {/* Demo Video */}
            <div className="bg-white p-6 rounded-lg shadow">
              <button
                onClick={() => setShowVideo(!showVideo)}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
              >
                {showVideo ? 'Hide Demo Video' : 'Show Demo Video'}
              </button>
              {showVideo && (
                <div className="mt-4">
                  {exerciseDetails?.videoUrl ? (
                    <ReactPlayer
                      url={exerciseDetails.videoUrl}
                      controls
                      width="100%"
                      height="auto"
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      Video demonstration coming soon!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Camera Controls</h3>
              <div className="relative mb-4">
                <button
                  onClick={handleStartWorkout}
                  disabled={workoutStarted}
                  className="relative w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400"
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute top-1 right-1 w-16 h-12 rounded-lg object-cover"
                    style={{ transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
                  />
                  Start Workout
                </button>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleStopWorkout}
                  disabled={!workoutStarted}
                  className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                >
                  Stop Workout
                </button>
                <button
                  onClick={toggleCamera}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
                >
                  Switch to {cameraFacing === 'user' ? 'Back' : 'Front'} Camera
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Progress & Feedback */}
          <div className="md:col-span-2 space-y-6">
            {/* Workout Progress */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Workout Progress</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{currentSet}/{sets}</div>
                  <div className="text-sm text-gray-600">Sets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{currentSetReps}/{targetRepsPerSet}</div>
                  <div className="text-sm text-gray-600">Set Reps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{totalReps}/{totalTargetReps}</div>
                  <div className="text-sm text-gray-600">Total Reps</div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Current Set</span>
                    <span>{currentSetReps}/{targetRepsPerSet}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${setRepProgress}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Total Progress</span>
                    <span>{totalReps}/{totalTargetReps}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${totalRepProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Feedback */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Live Feedback</h3>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-gray-800">{feedback}</p>
              </div>
              {isResting && (
                <div className="mt-4 bg-orange-50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-800">Rest Time</span>
                    <span className="text-lg font-bold text-orange-600">{Math.ceil(restTime)}s</span>
                  </div>
                  <div className="w-full bg-orange-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full"
                      style={{ width: `${((restDuration - restTime) / restDuration) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseDetailPage;