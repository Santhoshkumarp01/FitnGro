import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawLandmarks } from '@mediapipe/drawing_utils';
import { calculateAngle, getLandmarkPoint, validateExerciseConfig } from '../components/utils/poseDetection';
import axios from 'axios';
import './ExerciseDetailPage.css';

// Function to remove emojis and special characters for display
const cleanExerciseName = (name) => {
  return name
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, '') // Emojis (Emoticons)
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc Symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .replace(/[\u{2300}-\u{23FF}]/gu, '') // Miscellaneous Technical (includes ⏰)
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

const ExerciseDetailPage = () => {
  const { userEmail, workoutName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [exerciseDetails, setExerciseDetails] = useState(null);
  const [sets, setSets] = useState(2);
  const [targetRepsPerSet, setTargetRepsPerSet] = useState(20);
  const [totalTargetReps, setTotalTargetReps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [workoutList, setWorkoutList] = useState([]);
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [totalReps, setTotalReps] = useState(0);
  const [currentSetReps, setCurrentSetReps] = useState(0);
  const [feedback, setFeedback] = useState('Starting workout...');
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [sessionState, setSessionState] = useState({
    lastRepTime: Date.now(),
    rep: 0,
    setCompleted: false,
  });
  const previousStateRef = useRef(sessionState);
  const angleThresholdsRef = useRef({}); // Store dynamic angle thresholds
  const restDuration = 10;

  const exerciseDB = {
    "Burpees (No Push-up)": {
      description: "Start in a standing position, drop to push-up position, push back up and jump.",
      videoUrl: "https://www.youtube.com/watch?v=TU8QYVW0gDU"
    },
    "Squats (Holding Chair for Balance)": {
      description: "Stand with feet shoulder-width apart, lower hips until knees bend at 90°.",
      videoUrl: "https://www.youtube.com/watch?v=aclHkVaku9U"
    }
  };

  const displayExerciseName = cleanExerciseName(workoutName);
  const config = useMemo(() => validateExerciseConfig(displayExerciseName), [displayExerciseName]);

  // Initialize session state and angle thresholds
  useEffect(() => {
    const initialState = {
      ...sessionState,
      ...config.initialStates,
      rep: 0,
      lastRepTime: Date.now(),
    };
    setSessionState(initialState);
    previousStateRef.current = initialState;

    // Initialize dynamic angle thresholds
    if (config.type === 'knee-lift') {
      angleThresholdsRef.current = {
        kneeUpAngleThreshold: config.kneeUpAngleThreshold, // Initial value from config
        kneeDownAngle: config.kneeDownAngle, // Initial value from config
        angleTolerance: 10, // Allow a tolerance range for flexibility
        calibrationReps: 0, // Track initial reps for calibration
        calibrationAngles: [], // Store angles for calibration
      };
    }
  }, [workoutName]);

  // Fetch exercise details (unchanged)
  useEffect(() => {
    const fetchExerciseDetails = async () => {
      try {
        setLoading(true);
        if (location.state) {
          const totalSets = location.state?.sets || 2;
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

  const handleExercise = async (results) => {
    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    canvasCtx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (!results.poseLandmarks) {
      setFeedback('No pose detected.');
      console.log('[ExerciseDetailPage] No pose landmarks detected in frame.');
      return;
    }

    drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: 'red',
      lineWidth: 2,
    });

    const landmarks = results.poseLandmarks;
    const { hip, knee, ankle } = config.landmarks;
    const leftHip = getLandmarkPoint(landmarks, hip.left);
    const leftKnee = getLandmarkPoint(landmarks, knee.left);
    const leftAnkle = getLandmarkPoint(landmarks, ankle.left);
    const rightHip = getLandmarkPoint(landmarks, hip.right);
    const rightKnee = getLandmarkPoint(landmarks, knee.right);
    const rightAnkle = getLandmarkPoint(landmarks, ankle.right);

    const leftKneeHeight = leftHip.y - leftKnee.y;
    const rightKneeHeight = rightHip.y - rightKnee.y;
    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const hipDepth = (leftHip.y + rightHip.y) / 2;
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    const currentTime = Date.now();
    const timeSinceLast = currentTime - sessionState.lastRepTime;
    const cooldownActive = timeSinceLast < config.cooldownDuration;

    let newState = { ...previousStateRef.current };
    let newFeedback = 'Keep going!';
    let repDetected = false;

    console.log(`[ExerciseDetailPage] Processing exercise: ${displayExerciseName}`);
    console.log(`[ExerciseDetailPage] Current state: ${JSON.stringify(newState)}`);
    console.log(`[ExerciseDetailPage] Angles - Left Knee: ${leftKneeAngle.toFixed(2)}, Right Knee: ${rightKneeAngle.toFixed(2)}, Avg: ${avgKneeAngle.toFixed(2)}`);
    console.log(`[ExerciseDetailPage] Heights - Left Knee: ${leftKneeHeight.toFixed(3)}, Right Knee: ${rightKneeHeight.toFixed(3)}, Hip Depth: ${hipDepth.toFixed(3)}`);
    console.log(`[ExerciseDetailPage] Cooldown Active: ${cooldownActive}, Time Since Last Rep: ${timeSinceLast}ms`);
    console.log(`[ExerciseDetailPage] Thresholds - kneeHeightThreshold: ${config.kneeHeightThreshold}, kneeUpAngleThreshold: ${angleThresholdsRef.current.kneeUpAngleThreshold || config.kneeUpAngleThreshold}, kneeDownAngle: ${angleThresholdsRef.current.kneeDownAngle || config.kneeDownAngle}`);

    switch (config.type) {
      case 'knee-lift': {
        const leftStateKey = config.states.left;
        const rightStateKey = config.states.right;
        let { kneeUpAngleThreshold, kneeDownAngle, angleTolerance, calibrationReps, calibrationAngles } = angleThresholdsRef.current;

        // Calibrate angle thresholds based on initial reps
        if (calibrationReps < 5) {
          calibrationAngles.push(leftKneeAngle, rightKneeAngle);
          if (calibrationAngles.length >= 10) { // Collect 5 cycles (left + right)
            const avgAngle = calibrationAngles.reduce((sum, angle) => sum + angle, 0) / calibrationAngles.length;
            kneeUpAngleThreshold = Math.max(90, avgAngle - 20); // Relax threshold based on user movement
            kneeDownAngle = Math.min(170, avgAngle + 20); // Relax threshold based on user movement
            angleThresholdsRef.current = {
              ...angleThresholdsRef.current,
              kneeUpAngleThreshold,
              kneeDownAngle,
              calibrationReps: 5,
            };
            console.log(`[ExerciseDetailPage] Calibrated angle thresholds - kneeUpAngleThreshold: ${kneeUpAngleThreshold}, kneeDownAngle: ${kneeDownAngle}`);
          }
        }

        if (
          leftKneeHeight > config.kneeHeightThreshold &&
          leftKneeAngle > (kneeUpAngleThreshold - angleTolerance) &&
          newState[leftStateKey] === 'down'
        ) {
          newState[leftStateKey] = 'up';
          newFeedback = 'Left knee up - good height!';
          console.log('[ExerciseDetailPage] Left knee up detected.');
          console.log(`[ExerciseDetailPage] Left Knee - Height: ${leftKneeHeight}, Angle: ${leftKneeAngle}`);
        } else if (leftKneeAngle < (kneeDownAngle + angleTolerance) && newState[leftStateKey] === 'up') {
          newState[leftStateKey] = 'down';
          if (!cooldownActive) {
            newState.rep += 1;
            newState.lastRepTime = currentTime;
            repDetected = true;
            newFeedback = `High-knee rep ${newState.rep} detected!`;
            angleThresholdsRef.current.calibrationReps += 1;
            console.log(`[ExerciseDetailPage] High-knee rep detected. Rep count: ${newState.rep}/${targetRepsPerSet}`);
          }
        }

        if (
          rightKneeHeight > config.kneeHeightThreshold &&
          rightKneeAngle > (kneeUpAngleThreshold - angleTolerance) &&
          newState[rightStateKey] === 'down'
        ) {
          newState[rightStateKey] = 'up';
          newFeedback = 'Right knee up - good height!';
          console.log('[ExerciseDetailPage] Right knee up detected.');
          console.log(`[ExerciseDetailPage] Right Knee - Height: ${rightKneeHeight}, Angle: ${rightKneeAngle}`);
        } else if (rightKneeAngle < (kneeDownAngle + angleTolerance) && newState[rightStateKey] === 'up') {
          newState[rightStateKey] = 'down';
          if (!cooldownActive && !repDetected) {
            newState.rep += 1;
            newState.lastRepTime = currentTime;
            repDetected = true;
            newFeedback = `High-knee rep ${newState.rep} detected!`;
            angleThresholdsRef.current.calibrationReps += 1;
            console.log(`[ExerciseDetailPage] High-knee rep detected. Rep count: ${newState.rep}/${targetRepsPerSet}`);
          }
        }

        if (!repDetected && leftKneeHeight < config.kneeHeightThreshold && rightKneeHeight < config.kneeHeightThreshold) {
          newFeedback = 'Lift your knees higher!';
          console.log('[ExerciseDetailPage] Knees not high enough.');
        }
        break;
      }

      case 'burpee': {
        const stateKey = config.state;
        const feetHeight = (leftAnkle.y + rightAnkle.y) / 2;

        if (avgKneeAngle < config.hipKneeAngleThreshold && newState[stateKey] === 'standing') {
          newState[stateKey] = 'squatting';
          newFeedback = 'Good squat position!';
          console.log('[ExerciseDetailPage] Burpee: Squatting position detected.');
        } else if (
          avgKneeAngle > config.kneeExtensionAngle &&
          feetHeight < hipDepth - config.jumpHeightThreshold &&
          newState[stateKey] === 'squatting'
        ) {
          newState[stateKey] = 'jumping';
          console.log('[ExerciseDetailPage] Burpee: Jumping position detected.');
        } else if (
          avgKneeAngle > config.kneeExtensionAngle &&
          feetHeight > hipDepth - config.jumpHeightThreshold &&
          newState[stateKey] === 'jumping'
        ) {
          newState[stateKey] = 'standing';
          if (!cooldownActive) {
            newState.rep += 1;
            newState.lastRepTime = currentTime;
            repDetected = true;
            newFeedback = `Burpee rep ${newState.rep} detected!`;
            console.log(`[ExerciseDetailPage] Burpee rep detected. Rep count: ${newState.rep}/${targetRepsPerSet}`);
          }
        }

        if (!repDetected && newState[stateKey] === 'standing') {
          newFeedback = 'Squat down to start the burpee!';
          console.log('[ExerciseDetailPage] Burpee: Awaiting squat to start.');
        }
        break;
      }

      case 'squat': {
        const stateKey = config.state;

        if (
          avgKneeAngle < config.hipKneeAngleThreshold &&
          hipDepth > config.hipDepthThreshold &&
          newState[stateKey] === 'up'
        ) {
          newState[stateKey] = 'down';
          newFeedback = 'Good squat depth!';
          console.log('[ExerciseDetailPage] Squat: Down position detected.');
        } else if (avgKneeAngle > config.kneeExtensionAngle && newState[stateKey] === 'down') {
          newState[stateKey] = 'up';
          if (!cooldownActive) {
            newState.rep += 1;
            newState.lastRepTime = currentTime;
            repDetected = true;
            newFeedback = `Squat rep ${newState.rep} detected!`;
            console.log(`[ExerciseDetailPage] Squat rep detected. Rep count: ${newState.rep}/${targetRepsPerSet}`);
          }
        }

        if (!repDetected && newState[stateKey] === 'up') {
          newFeedback = 'Lower your hips to squat!';
          console.log('[ExerciseDetailPage] Squat: Awaiting deeper squat.');
        }
        break;
      }

      default:
        console.warn(`[ExerciseDetailPage] Unsupported exercise type: ${config.type}`);
        newFeedback = 'Exercise not supported for tracking.';
    }

    if (repDetected) {
      if (!displayExerciseName.toLowerCase().includes(config.type)) {
        console.warn(
          `[ExerciseDetailPage] Detection mismatch! Expected exercise: ${displayExerciseName}, but detected movement matches ${config.type}.`
        );
      } else {
        console.log(`[ExerciseDetailPage] Detection verified: Movement matches expected exercise ${displayExerciseName}.`);
      }

      const newTotalReps = totalReps + 1;
      setTotalReps(newTotalReps);
      setCurrentSetReps(newState.rep);

      if (newState.rep >= targetRepsPerSet && !newState.setCompleted) {
        newState.setCompleted = true;
        setIsResting(true);
        setRestTime(restDuration);
        setFeedback(`Great job! Set ${currentSet} of ${sets} completed. Take a 10-second break!`);
        console.log(
          `[ExerciseDetailPage] Set ${currentSet}/${sets} completed. Reps: ${newState.rep}/${targetRepsPerSet}. Starting rest period.`
        );

        try {
          const response = await axios.post('REACT_APP_API_URL=https://fitngro-backend-bthfa8hrg7h3etd5.centralindia-01.azurewebsites.net/track-exercise', {
            userEmail,
            exerciseName: workoutName,
            currentSet,
            totalSets: sets,
            targetReps: targetRepsPerSet,
            currentReps: newState.rep,
          });
          console.log('[ExerciseDetailPage] Workout progress logged to backend:', response.data);
        } catch (error) {
          console.error('[ExerciseDetailPage] Failed to log workout progress:', error);
        }
      }
    }

    setFeedback(newFeedback);
    setSessionState(newState);
    previousStateRef.current = newState;
  };

  // Handle rest period countdown (unchanged)
  useEffect(() => {
    if (isResting) {
      const restInterval = setInterval(() => {
        setRestTime((prev) => {
          const remaining = prev - 1;
          if (remaining <= 0) {
            setIsResting(false);
            const isFinalSet = currentSet === sets;
            setFeedback(
              isFinalSet
                ? `Awesome work! All ${sets} sets completed for ${displayExerciseName}!`
                : `Rest completed! Start Set ${currentSet + 1} of ${sets}.`
            );
            console.log(`[ExerciseDetailPage] Rest completed for Set ${currentSet}.`);

            const newState = {
              ...sessionState,
              rep: 0,
              lastRepTime: Date.now(),
              setCompleted: false,
              ...config.initialStates,
            };
            setSessionState(newState);
            previousStateRef.current = newState;
            setCurrentSetReps(0);

            if (isFinalSet) {
              console.log('[ExerciseDetailPage] All sets completed! Triggering handleComplete.');
              handleComplete();
            } else {
              setCurrentSet((prev) => prev + 1);
            }

            return 0;
          }
          return remaining;
        });
      }, 1000);

      return () => clearInterval(restInterval);
    }
  }, [isResting, currentSet, sets, handleComplete]);

  // Setup pose detection
  // Setup pose detection
useEffect(() => {
  if (loading || !videoRef.current || !canvasRef.current) return;

  canvasRef.current.width = 640;
  canvasRef.current.height = 480;

  console.log(`[ExerciseDetailPage] Starting workout tracking for ${displayExerciseName}`);
  console.log(`[ExerciseDetailPage] Initial Parameters - Target Reps Per Set: ${targetRepsPerSet}, Total Sets: ${sets}, Current Set: ${currentSet}`);

  let pose;
  let camera;
  let animationFrameId;

  const processFrame = async () => {
    const video = videoRef.current; // Type assertion for TypeScript
    if (!video || video.readyState !== 4 || isResting) {
      console.log('[ExerciseDetailPage] Frame processing skipped:', {
        videoReady: video?.readyState,
        isResting,
      });
      animationFrameId = requestAnimationFrame(processFrame);
      return;
    }

    console.log('[ExerciseDetailPage] Processing frame manually.');
    try {
      await pose.send({ image: video });
    } catch (err) {
      console.error('[ExerciseDetailPage] Error processing frame manually:', err);
    }
    animationFrameId = requestAnimationFrame(processFrame);
  };

  const setupPoseDetection = async () => {
    try {
      pose = new Pose({
        locateFile: (file) => {
          const url = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@latest/${file}`;
          console.log(`[ExerciseDetailPage] Loading MediaPipe Pose file: ${url}`);
          return url;
        },
      });

      console.log('[ExerciseDetailPage] MediaPipe Pose instance created successfully.');

      pose.setOptions({
        modelComplexity: 1,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.1,
        enableSmoothing: true,
        enableSegmentation: true,
      });

      console.log('[ExerciseDetailPage] Pose options set successfully.');

      pose.onResults((results) => {
        console.log('[ExerciseDetailPage] Pose results received:', {
          hasLandmarks: !!results.poseLandmarks,
          landmarksCount: results.poseLandmarks ? results.poseLandmarks.length : 0,
        });
        handleExercise(results);
      });

      await pose.initialize();
      console.log('[ExerciseDetailPage] MediaPipe Pose initialized successfully.');
    } catch (err) {
      console.error('[ExerciseDetailPage] Error creating MediaPipe Pose instance:', err);
      setFeedback('Error loading pose detection. Please refresh the page.');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('[ExerciseDetailPage] Available video devices:', videoDevices);
      if (videoDevices.length === 0) {
        setFeedback('No video devices found. Please ensure a camera is connected.');
        return;
      }
    } catch (err) {
      console.error('[ExerciseDetailPage] Error enumerating devices:', err);
      setFeedback('Failed to enumerate video devices. Please check your camera and permissions.');
      return;
    }

    const video = videoRef.current; // Type assertion for TypeScript
    const videoLoadTimeout = 10000;
    const cameraStartTimeout = 10000;

    camera = new Camera(video, {
      onFrame: async () => {
        console.log('[ExerciseDetailPage] onFrame triggered. isResting:', isResting);
        if (!isResting) {
          if (!video || video.readyState !== 4) {
            console.log('[ExerciseDetailPage] Video not ready:', {
              videoElement: video,
              readyState: video?.readyState,
            });
            return;
          }
          console.log('[ExerciseDetailPage] Sending frame to MediaPipe Pose via Camera onFrame.');
          try {
            await pose.send({ image: video });
          } catch (err) {
            console.error('[ExerciseDetailPage] Error processing frame via Camera onFrame:', err);
          }
        }
      },
      width: 640,
      height: 480,
    });

    try {
      await Promise.race([
        camera.start(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Camera failed to start within 10 seconds.'));
          }, cameraStartTimeout);
        }),
      ]);
      console.log('[ExerciseDetailPage] Camera started successfully.');
    } catch (err) {
      console.error('[ExerciseDetailPage] Failed to start camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setFeedback('Camera access denied. Please allow camera access in your browser settings and refresh.');
      } else if (err.name === 'NotFoundError') {
        setFeedback('No camera found. Please ensure a camera is connected and try again.');
      } else if (err.message === 'Camera failed to start within 10 seconds.') {
        setFeedback('Camera failed to start. It might be in use by another application. Please close other apps and try again.');
      } else {
        setFeedback('Failed to access camera. Please allow camera access and refresh the page.');
      }
      return;
    }

    try {
      if (video.readyState < 4) {
        console.log('[ExerciseDetailPage] Waiting for video to load...');
        await Promise.race([
          new Promise((resolve) => {
            const readyStateInterval = setInterval(() => {
              console.log('[ExerciseDetailPage] Video readyState check:', video.readyState);
            }, 2000);
            video.onerror = () => {
              console.error('[ExerciseDetailPage] Video element error:', video.error);
              clearInterval(readyStateInterval);
              resolve(); // Resolve even on error to avoid hanging
            };
            video.onloadedmetadata = () => { // Removed duplicate assignment
              console.log('[ExerciseDetailPage] Video metadata loaded. Ready state:', video.readyState);
              clearInterval(readyStateInterval);
              resolve();
            };
          }),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Video failed to load within 10 seconds.'));
            }, videoLoadTimeout);
          }),
        ]);
      }

      if (video.paused) {
        console.log('[ExerciseDetailPage] Video is paused.');
        await video.play();
        console.log('[ExerciseDetailPage] Video playback started.');
      } else {
        console.log('[ExerciseDetailPage] Video is already playing.');
      }

      console.log('[ExerciseDetailPage] Starting manual frame processing loop.');
      animationFrameId = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error('[ExerciseDetailPage] Video loading failed:', err.message);
      setFeedback('Failed to load webcam video. Please try again.');
      return;
    }
  };

  setupPoseDetection();

  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      console.log('[ExerciseDetailPage] Manual frame loop stopped.');
    }
    if (camera) {
      camera.stop();
      console.log('[ExerciseDetailPage] Camera stopped.');
    }
    if (pose) {
      pose.close();
      console.log('[ExerciseDetailPage] Pose instance closed.');
    }
    console.log('[ExerciseDetailPage] Camera and Pose instance cleaned up.');
  };
}, [isResting, loading]);

  // Rest of the component (JSX rendering, other methods) remains unchanged
  const setRepProgress = (currentSetReps / targetRepsPerSet) * 100;
  const totalRepProgress = (totalReps / totalTargetReps) * 100;

  const handleBackClick = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p className="loading-text">Loading exercise details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h3 className="error-heading">Error</h3>
          <p className="error-text">{error}</p>
          <button onClick={handleBackClick} className="error-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exercise-detail-container">
      <div className="exercise-detail-wrapper">
        <div className="header-section">
          <button onClick={handleBackClick} className="back-button">
            ← Back
          </button>
          <h1 className="exercise-title">{displayExerciseName}</h1>
          <div className="header-spacer"></div>
        </div>

        <div className="exercise-content">
          <div className="video-section">
            <h2 className="section-heading">Demonstration & Monitoring</h2>
            <div className="video-container">
              {exerciseDetails?.videoUrl ? (
                <ReactPlayer
                  url={exerciseDetails.videoUrl}
                  controls
                  width="100%"
                  height="auto"
                  className="react-player"
                />
              ) : (
                <div className="video-placeholder">
                  <p className="video-placeholder-text">Video demonstration coming soon!</p>
                </div>
              )}
            </div>
            <div className="webcam-container">
              <video ref={videoRef} autoPlay style={{ display: 'block' }} />
              <canvas ref={canvasRef} className="webcam-feed" />
              <div className="sets-reps-display">
                <h3 className="progress-heading">Workout Progress</h3>
                <div className="reps-info">
                  <span className="info-label">Current Set Reps:</span>
                  <span className="reps-count">{currentSetReps}/{targetRepsPerSet}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${setRepProgress}%` }}></div>
                </div>
                <div className="reps-info">
                  <span className="info-label">Total Reps:</span>
                  <span className="reps-count">{totalReps}/{totalTargetReps}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${totalRepProgress}%` }}></div>
                </div>
                <div className="sets-info">
                  <span className="info-label">Sets:</span>
                  <span className="sets-count">{currentSet}/{sets}</span>
                </div>
              </div>
              <div className="tracker-info">
                <p className="tracker-exercise"><strong>Exercise:</strong> {displayExerciseName}</p>
                <p className="tracker-feedback"><strong>Feedback:</strong> {feedback}</p>
                {isResting && (
                  <div className="rest-info">
                    <p className="rest-time"><strong>Rest Time:</strong> {Math.ceil(restTime)}s</p>
                    <div className="rest-progress-bar">
                      <div
                        className="rest-progress-bar-fill"
                        style={{ width: `${((restDuration - restTime) / restDuration) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="exercise-instructions">
            <h2 className="section-heading">Execution Guide</h2>
            <p className="instruction-text">{exerciseDetails?.description}</p>
            <p className="instruction-text">
              <strong>Target Muscle:</strong> {exerciseDetails?.muscle || 'General Fitness'}
            </p>
            <p className="instruction-text">
              <strong>Instructions:</strong>{' '}
              {exerciseDetails?.instructions || 'Follow the video and form.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseDetailPage;