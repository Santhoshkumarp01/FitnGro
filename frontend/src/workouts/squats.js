// State variables for squat tracking
let isDown = false;
let lastRepCount = 0;
let poseLandmarker = null;
let vision = null;
let lastKneeAngle = 180;
let currentPhase = "ready";
let formHistory = [];

// Main monitoring function that returns a monitor object
export const monitorSquats = async (config) => {
  const {
    targetReps = 10,
    totalSets = 3,
    currentSet = 1,
    userEmail,
    cameraFacing = 'user',
    videoRef,
    onFeedback,
    onComplete,
    onFormFeedback
  } = config;

  // Initialize MediaPipe Pose Landmarker
  try {
    // Load MediaPipe WASM
    await loadMediaPipeWASM();
    
    poseLandmarker = await window.PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.6,
      minPosePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
      outputSegmentationMasks: false,
    });

    // State tracking
    let currentSetReps = 0;
    let totalReps = 0;
    let totalTargetReps = targetReps * totalSets;
    let fullSquats = 0;
    let partialSquats = 0;
    let animationFrameId = null;
    let isRunning = false;

    // Start pose detection loop
    const startDetection = () => {
      isRunning = true;
      
      const detectPose = async () => {
        if (!isRunning || !videoRef.current) return;
        
        try {
          const results = await poseLandmarker.detectForVideo(videoRef.current, performance.now());
          
          const monitorResult = detectSquats(results, {
            currentSetReps,
            targetRepsPerSet: targetReps,
            totalReps,
            totalTargetReps,
            fullSquats,
            partialSquats
          });

          if (monitorResult.repCount > currentSetReps) {
            currentSetReps = monitorResult.repCount;
            totalReps++;
            
            // Update squat type counts
            if (monitorResult.squatType === 'full') {
              fullSquats++;
            } else if (monitorResult.squatType === 'partial') {
              partialSquats++;
            }
            
            // Check if set is complete
            if (currentSetReps >= targetReps) {
              onComplete({
                completed: true,
                reps: currentSetReps,
                fullSquats,
                partialSquats,
                feedback: `Set ${currentSet} complete! ${currentSetReps}/${targetReps} reps`,
                currentSet
              });
              // Reset for next set
              currentSetReps = 0;
              lastRepCount = 0;
            }
          }

          // Send general feedback
          if (onFeedback) {
            onFeedback({
              ...monitorResult.feedback,
              fullSquats,
              partialSquats,
              currentPhase,
              repCount: currentSetReps
            });
          }

          // Send form feedback if callback provided
          if (onFormFeedback && monitorResult.formFeedback) {
            onFormFeedback(monitorResult.formFeedback);
          }
          
        } catch (error) {
          console.error('Error during pose detection:', error);
        }
        
        if (isRunning) {
          animationFrameId = requestAnimationFrame(detectPose);
        }
      };
      
      detectPose();
    };

    // Start detection
    startDetection();
    
    console.log('Squat monitoring started');

    // Return monitor object with stop method
    return {
      stop: () => {
        isRunning = false;
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        if (poseLandmarker) {
          poseLandmarker.close();
        }
        console.log('Squat monitoring stopped');
      },
      getStats: () => ({
        fullSquats,
        partialSquats,
        totalReps: fullSquats + partialSquats,
        currentSetReps
      })
    };

  } catch (error) {
    console.error('Error initializing squat monitoring:', error);
    throw error;
  }
};

// Core squat detection logic
const detectSquats = (results, { currentSetReps, targetRepsPerSet, totalReps, totalTargetReps, fullSquats, partialSquats }) => {
  if (!results.landmarks || results.landmarks.length === 0) {
    return { 
      feedback: { message: 'No person detected. Please step into view.' },
      repCount: currentSetReps,
      formFeedback: null
    };
  }

  // Analyze squat form
  const formData = analyzeSquatForm(results.landmarks);
  
  // Update squat count and get squat type
  const squatResult = updateSquatCount(formData.kneeAngle, currentSetReps);
  
  // Get form feedback
  const formFeedback = getFormFeedback(formData);
  
  // Generate general feedback message
  let feedbackMessage = 'Starting squats...';
  
  if (currentPhase === 'ready') {
    feedbackMessage = `Ready for rep ${currentSetReps + 1}. Current: ${currentSetReps}/${targetRepsPerSet}`;
  } else if (currentPhase === 'full_squat') {
    feedbackMessage = `Perfect squat! Rep ${squatResult.repCount} completed!`;
  } else if (currentPhase === 'partial_squat') {
    feedbackMessage = `Partial squat counted. Try to go deeper next time!`;
  } else if (isDown) {
    feedbackMessage = 'Push back up to complete the rep!';
  }

  if (squatResult.repCount >= targetRepsPerSet) {
    feedbackMessage = 'Set complete! Take a rest.';
  }

  if (totalReps >= totalTargetReps) {
    feedbackMessage = 'Workout complete! Great job!';
  }

  return { 
    repCount: squatResult.repCount, 
    squatType: squatResult.squatType,
    feedback: {
      message: feedbackMessage,
      avgKneeAngle: Math.round(formData.kneeAngle),
      isDown,
      phase: currentPhase
    },
    formFeedback
  };
};

// Analyze squat form from pose landmarks
const analyzeSquatForm = (landmarks) => {
  const lm = landmarks[0];
  
  // Key landmarks for squat analysis
  const leftHip = lm[23], rightHip = lm[24];
  const leftKnee = lm[25], rightKnee = lm[26];
  const leftAnkle = lm[27], rightAnkle = lm[28];
  const leftShoulder = lm[11], rightShoulder = lm[12];

  // Calculate knee angles
  const leftKneeAngle = calcAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calcAngle(rightHip, rightKnee, rightAnkle);
  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

  // Calculate hip angles for depth analysis
  const leftHipAngle = calcAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = calcAngle(rightShoulder, rightHip, rightKnee);
  const avgHipAngle = (leftHipAngle + rightHipAngle) / 2;

  // Check knee alignment (prevent knee cave)
  const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
  const hipDistance = Math.abs(leftHip.x - rightHip.x);
  const kneeAlignment = hipDistance > 0 ? kneeDistance / hipDistance : 1;

  // Check torso position
  const midHip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const midShoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
  const torsoAngle = Math.atan2(midShoulder.x - midHip.x, midHip.y - midShoulder.y) * (180 / Math.PI);

  return {
    kneeAngle: avgKneeAngle,
    hipAngle: avgHipAngle,
    kneeAlignment: kneeAlignment,
    torsoAngle: Math.abs(torsoAngle),
    leftKneeAngle: leftKneeAngle,
    rightKneeAngle: rightKneeAngle,
    asymmetry: Math.abs(leftKneeAngle - rightKneeAngle)
  };
};

// Calculate angle between three points
const calcAngle = (a, b, c) => {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ac = Math.hypot(c.x - a.x, c.y - a.y);
  const cosAngle = (ab**2 + bc**2 - ac**2) / (2 * ab * bc);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  const angle = Math.acos(clampedCos) * (180 / Math.PI);
  return isNaN(angle) ? 180 : angle;
};

// Update squat count based on knee angle
const updateSquatCount = (kneeAngle, currentReps) => {
  // Thresholds for squat detection
  const FULL_SQUAT_THRESHOLD = 90;
  const PARTIAL_SQUAT_THRESHOLD = 110;
  const STANDING_THRESHOLD = 160;
  const TRANSITION_SMOOTHING = 5;

  // Smooth knee angle for more stable detection
  const smoothedKneeAngle = (lastKneeAngle * 0.7) + (kneeAngle * 0.3);
  lastKneeAngle = smoothedKneeAngle;

  let repCount = currentReps;
  let squatType = null;

  // State transitions with hysteresis to prevent false counts
  if (!isDown && smoothedKneeAngle < FULL_SQUAT_THRESHOLD) {
    isDown = true;
    if (repCount === lastRepCount) {
      repCount++;
      lastRepCount = repCount;
      squatType = 'full';
    }
    currentPhase = "full_squat";
    
  } else if (!isDown && smoothedKneeAngle < PARTIAL_SQUAT_THRESHOLD && smoothedKneeAngle >= FULL_SQUAT_THRESHOLD) {
    isDown = true;
    if (repCount === lastRepCount) {
      repCount++;
      lastRepCount = repCount;
      squatType = 'partial';
    }
    currentPhase = "partial_squat";
    
  } else if (isDown && smoothedKneeAngle > STANDING_THRESHOLD) {
    isDown = false;
    currentPhase = "standing";
    
  } else if (smoothedKneeAngle > STANDING_THRESHOLD + 10) {
    currentPhase = "ready";
  }

  return { repCount, squatType };
};

// Get form feedback based on squat analysis
const getFormFeedback = (formData) => {
  const feedbacks = [];
  let severity = "good";

  // Smooth knee angle for more stable detection
  const smoothedKneeAngle = (lastKneeAngle * 0.7) + (formData.kneeAngle * 0.3);

  // Only give feedback when actively squatting
  if (smoothedKneeAngle > 140) {
    return {
      feedback: "🏃‍♀️ Ready position - Start your squat!",
      className: "good-form",
      severity: "good"
    };
  }

  // Depth feedback
  if (smoothedKneeAngle > 130) {
    feedbacks.push("🔽 Go deeper!");
    severity = "warning";
  } else if (smoothedKneeAngle < 70) {
    feedbacks.push("⚠️ Too deep - careful!");
    severity = "bad";
  } else if (smoothedKneeAngle <= 90) {
    feedbacks.push("🎯 Perfect depth!");
  } else {
    feedbacks.push("✅ Good depth");
  }

  // Knee alignment
  if (formData.kneeAlignment < 0.6) {
    feedbacks.push("📍 Knees caving - push out!");
    severity = "bad";
  } else if (formData.kneeAlignment > 1.4) {
    feedbacks.push("📐 Knees too wide");
    severity = "warning";
  } else {
    feedbacks.push("✅ Knees aligned");
  }

  // Torso position
  if (formData.torsoAngle > 35) {
    feedbacks.push("🏗️ Chest up!");
    severity = "warning";
  } else {
    feedbacks.push("✅ Good posture");
  }

  // Leg symmetry
  if (formData.asymmetry > 20) {
    feedbacks.push("⚖️ Balance both legs");
    severity = "warning";
  }

  // Smooth form feedback to prevent flickering
  const FORM_HISTORY_SIZE = 5;
  const currentFeedback = {
    feedback: feedbacks.join(" | "),
    className: severity === "good" ? "good-form" : 
               severity === "warning" ? "warning-form" : "bad-form",
    severity: severity
  };

  formHistory.push(currentFeedback);
  if (formHistory.length > FORM_HISTORY_SIZE) {
    formHistory.shift();
  }

  // Return most common feedback
  const feedbackCounts = {};
  formHistory.forEach(fb => {
    feedbackCounts[fb.feedback] = (feedbackCounts[fb.feedback] || 0) + 1;
  });

  const mostCommonFeedback = Object.keys(feedbackCounts).reduce((a, b) => 
    feedbackCounts[a] > feedbackCounts[b] ? a : b
  );

  const mostCommonClass = formHistory.find(fb => fb.feedback === mostCommonFeedback)?.className || "good-form";

  return {
    feedback: mostCommonFeedback,
    className: mostCommonClass,
    severity: formHistory.find(fb => fb.feedback === mostCommonFeedback)?.severity || "good"
  };
};

// Load MediaPipe WASM modules
async function loadMediaPipeWASM() {
  return new Promise((resolve, reject) => {
    if (window.PoseLandmarker && window.FilesetResolver) {
      resolve();
      return;
    }

    // Create script element for MediaPipe Vision Bundle
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import {
        FilesetResolver,
        PoseLandmarker,
      } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
      
      // Make available globally
      window.FilesetResolver = FilesetResolver;
      window.PoseLandmarker = PoseLandmarker;
      
      // Initialize vision fileset
      FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      ).then(visionFileset => {
        window.visionFileset = visionFileset;
        window.dispatchEvent(new CustomEvent('mediapipe-loaded'));
      });
    `;
    
    // Listen for load completion
    window.addEventListener('mediapipe-loaded', async () => {
      try {
        vision = window.visionFileset;
        resolve();
      } catch (error) {
        reject(error);
      }
    }, { once: true });

    document.head.appendChild(script);
  });
}