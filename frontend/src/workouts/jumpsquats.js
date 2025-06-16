// State variables for jump squat tracking
let reps = 0;
let state = 'standing'; // 'standing', 'descending', 'squatting', 'jumping', 'landing'
let lastHipY = null;
let lastRepCount = 0;
let poseLandmarker = null;

// Thresholds for jump squat detection
const SQUAT_THRESHOLD = 95;
const ASCEND_THRESHOLD = 130;
const JUMP_DETECT_THRESHOLD_Y = 0.015;
const LANDING_DETECT_THRESHOLD_Y = 0.005;
const STANDING_THRESHOLD = 160;

// Main monitoring function that returns a monitor object
export const monitorJumpSquats = async (config) => {
  const {
    targetReps = 10,
    totalSets = 3,
    currentSet = 1,
    userEmail,
    cameraFacing = 'user',
    videoRef,
    onFeedback,
    onComplete
  } = config;

  // Initialize MediaPipe Pose Landmarker
  try {
    // Load MediaPipe scripts
    await loadMediaPipeScripts();
    
    const vision = await window.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    
    poseLandmarker = await window.PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });

    // State tracking
    let currentSetReps = 0;
    let totalReps = 0;
    let totalTargetReps = targetReps * totalSets;
    let isRunning = true;

    // Process video frames
    const processFrame = () => {
      if (!isRunning || !poseLandmarker || !videoRef.current) return;

      try {
        const results = poseLandmarker.detectForVideo(videoRef.current, performance.now());
        
        if (results.landmarks && results.landmarks.length > 0) {
          const monitorResult = detectJumpSquats(results, {
            currentSetReps,
            targetRepsPerSet: targetReps,
            totalReps,
            totalTargetReps
          });

          if (monitorResult.repCount > currentSetReps) {
            currentSetReps = monitorResult.repCount;
            totalReps++;
            
            // Check if set is complete
            if (currentSetReps >= targetReps) {
              onComplete({
                completed: true,
                reps: currentSetReps,
                feedback: `Set ${currentSet} complete! ${currentSetReps}/${targetReps} reps`,
                currentSet
              });
              // Reset for next set
              currentSetReps = 0;
              lastRepCount = 0;
              reps = 0;
              state = 'standing';
              lastHipY = null;
            }
          }

          // Send feedback
          if (onFeedback) {
            onFeedback(monitorResult.feedback);
          }
        }
      } catch (error) {
        console.error("Error processing frame:", error);
      }

      if (isRunning) {
        requestAnimationFrame(processFrame);
      }
    };

    // Start processing
    processFrame();
    
    console.log('Jump squat monitoring started');

    // Return monitor object with stop method
    return {
      stop: () => {
        isRunning = false;
        if (poseLandmarker) {
          poseLandmarker.close();
        }
        console.log('Jump squat monitoring stopped');
      }
    };

  } catch (error) {
    console.error('Error initializing jump squat monitoring:', error);
    throw error;
  }
};

// Core jump squat detection logic
const detectJumpSquats = (results, { currentSetReps, targetRepsPerSet, totalReps, totalTargetReps }) => {
  if (!results.landmarks || results.landmarks.length === 0) {
    return { feedback: 'No person detected.', repCount: currentSetReps };
  }

  const landmarks = results.landmarks[0];
  
  // Key landmarks for jump squat detection
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle || !leftShoulder || !rightShoulder) {
    return { feedback: 'Please position yourself correctly in the frame.', repCount: currentSetReps };
  }

  // Analyze form and get angles
  const formData = analyzeJumpSquatForm([landmarks]);
  const avgKneeAngle = formData.kneeAngle;
  const currentHipY = formData.midHipY;

  let feedback = 'Starting jump squats...';
  let repCount = currentSetReps;

  // State machine for jump squat detection
  switch (state) {
    case 'standing':
      if (avgKneeAngle < STANDING_THRESHOLD) {
        state = 'descending';
        feedback = "⬇️ Descending into squat...";
      } else {
        feedback = "📈 Stand ready. Begin your squat.";
      }
      break;
      
    case 'descending':
      if (avgKneeAngle <= SQUAT_THRESHOLD) {
        state = 'squatting';
        feedback = "🎯 At squat depth. Prepare to jump!";
      } else if (avgKneeAngle > STANDING_THRESHOLD) {
        state = 'standing';
        feedback = "📈 Back to standing. Start your squat.";
      } else {
        feedback = "⬇️ Keep descending...";
      }
      break;
      
    case 'squatting':
      if (currentHipY !== null && lastHipY !== null) {
        const deltaY = lastHipY - currentHipY;
        if (deltaY > JUMP_DETECT_THRESHOLD_Y && avgKneeAngle > ASCEND_THRESHOLD) {
          state = 'jumping';
          feedback = "🚀 Jumping!";
          // Only increment if this is a new rep
          if (repCount === lastRepCount) {
            repCount++;
            reps = repCount;
            lastRepCount = repCount;
          }
        } else {
          feedback = "🎯 Hold squat position, then explode up!";
        }
      }
      break;
      
    case 'jumping':
      if (currentHipY !== null && lastHipY !== null) {
        const deltaY = currentHipY - lastHipY;
        if (deltaY > LANDING_DETECT_THRESHOLD_Y) {
          state = 'landing';
          feedback = "🛬 Landing...";
        } else {
          feedback = "🚀 In the air!";
        }
      }
      break;
      
    case 'landing':
      if (avgKneeAngle > STANDING_THRESHOLD - 5 && avgKneeAngle < STANDING_THRESHOLD + 5) {
        state = 'standing';
        feedback = `✅ Jump Squat Completed! Reps: ${repCount}/${targetRepsPerSet}. Ready for next.`;
      } else if (avgKneeAngle < SQUAT_THRESHOLD) {
        state = 'descending';
        feedback = `✅ Jump Squat Completed! Reps: ${repCount}/${targetRepsPerSet}. Descending for next.`;
      } else {
        feedback = "🛬 Stabilizing landing...";
      }
      break;
  }

  lastHipY = currentHipY;

  // Set completion feedback
  if (repCount >= targetRepsPerSet) {
    feedback = 'Set complete! Take a rest.';
  }

  if (totalReps >= totalTargetReps) {
    feedback = 'Workout complete! Great job!';
  }

  return { 
    repCount, 
    feedback,
    avgKneeAngle: Math.round(avgKneeAngle),
    currentState: state,
    formData
  };
};

// Calculate angle between three points
function calcAngle(a, b, c) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ac = Math.hypot(c.x - a.x, c.y - a.y);
  const cosAngle = (ab**2 + bc**2 - ac**2) / (2 * ab * bc);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(clampedCos) * (180 / Math.PI);
}

// Analyze jump squat form
function analyzeJumpSquatForm(landmarks) {
  const lm = landmarks[0];
  const leftHip = lm[23], rightHip = lm[24];
  const leftKnee = lm[25], rightKnee = lm[26];
  const leftAnkle = lm[27], rightAnkle = lm[28];
  const leftShoulder = lm[11], rightShoulder = lm[12];

  const leftKneeAngle = calcAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calcAngle(rightHip, rightKnee, rightAnkle);
  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

  const leftHipAngle = calcAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = calcAngle(rightShoulder, rightHip, rightKnee);
  const avgHipAngle = (leftHipAngle + rightHipAngle) / 2;

  const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
  const hipDistance = Math.abs(leftHip.x - rightHip.x);
  const kneeAlignment = hipDistance > 0 ? kneeDistance / hipDistance : 1;

  const midHipY = (leftHip.y + rightHip.y) / 2;

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
    midHipY: midHipY
  };
}

// Load MediaPipe scripts dynamically
async function loadMediaPipeScripts() {
  return new Promise((resolve, reject) => {
    if (window.FilesetResolver && window.PoseLandmarker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import {
        FilesetResolver,
        PoseLandmarker,
      } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
      
      window.FilesetResolver = FilesetResolver;
      window.PoseLandmarker = PoseLandmarker;
    `;
    
    script.onload = () => {
      // Wait a bit for the imports to be available
      setTimeout(resolve, 100);
    };
    script.onerror = () => reject(new Error('Failed to load MediaPipe Vision Tasks'));
    document.head.appendChild(script);
  });
}