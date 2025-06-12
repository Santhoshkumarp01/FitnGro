// State variables for push-up tracking
let isDown = false;
let lastRepCount = 0;
let pose = null;
let camera = null;

// Main monitoring function that returns a monitor object
export const monitorPushUps = async (config) => {
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

  // Initialize MediaPipe Pose
  try {
    // Load MediaPipe scripts
    await loadMediaPipeScripts();
    
    pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
    });
    
    await pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: cameraFacing === 'user',
      upperBodyOnly: true,
    });

    // State tracking
    let currentSetReps = 0;
    let totalReps = 0;
    let totalTargetReps = targetReps * totalSets;

    // Set up pose detection callback
    pose.onResults((results) => {
      const monitorResult = detectPushUps(results, {
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
        }
      }

      // Send feedback
      if (onFeedback) {
        onFeedback(monitorResult.feedback);
      }
    });

    // Initialize camera
    camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await pose.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
      facingMode: cameraFacing === 'user' ? 'user' : 'environment'
    });

    await camera.start();
    
    console.log('Push-up monitoring started');

    // Return monitor object with stop method
    return {
      stop: () => {
        if (camera) {
          camera.stop();
        }
        if (pose) {
          pose.close();
        }
        console.log('Push-up monitoring stopped');
      }
    };

  } catch (error) {
    console.error('Error initializing push-up monitoring:', error);
    throw error;
  }
};

// Core push-up detection logic
const detectPushUps = (results, { currentSetReps, targetRepsPerSet, totalReps, totalTargetReps }) => {
  if (!results.poseLandmarks) return { feedback: 'No person detected.', repCount: currentSetReps };

  // Key landmarks for push-up detection (MediaPipe Pose landmarks)
  const leftShoulder = results.poseLandmarks[11];
  const rightShoulder = results.poseLandmarks[12];
  const leftElbow = results.poseLandmarks[13];
  const rightElbow = results.poseLandmarks[14];
  const leftWrist = results.poseLandmarks[15];
  const rightWrist = results.poseLandmarks[16];

  if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist) {
    return { feedback: 'Please position yourself correctly in the frame.', repCount: currentSetReps };
  }

  // Calculate angles
  const calcAngle = (a, b, c) => {
    const ab = Math.hypot(b.x - a.x, b.y - a.y);
    const bc = Math.hypot(c.x - b.x, c.y - b.y);
    const ac = Math.hypot(c.x - a.x, c.y - a.y);
    const cosAngle = (ab**2 + bc**2 - ac**2) / (2 * ab * bc);
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    return Math.acos(clampedCos) * (180 / Math.PI);
  };

  const leftAngle = calcAngle(leftShoulder, leftElbow, leftWrist);
  const rightAngle = calcAngle(rightShoulder, rightElbow, rightWrist);
  const avgElbowAngle = (leftAngle + rightAngle) / 2;

  // Thresholds
  const ELBOW_BEND_THRESHOLD = 120;
  const PARTIAL_BEND_THRESHOLD = 145;
  const EXTENDED_THRESHOLD = 160;

  // State tracking
  let feedback = 'Starting push-ups...';
  let repCount = currentSetReps;

  // Push-up detection logic
  if (!isDown && avgElbowAngle < ELBOW_BEND_THRESHOLD) {
    isDown = true;
    feedback = "Down position detected - push back up!";
  } 
  else if (!isDown && avgElbowAngle < PARTIAL_BEND_THRESHOLD && avgElbowAngle >= ELBOW_BEND_THRESHOLD) {
    isDown = true;
    feedback = "Partial down detected - try to go lower!";
  } 
  else if (isDown && avgElbowAngle > EXTENDED_THRESHOLD) {
    isDown = false;
    // Only increment if this is a new rep
    if (repCount === lastRepCount) {
      repCount++;
      lastRepCount = repCount;
      feedback = `Rep ${repCount} completed! ${repCount >= targetRepsPerSet ? 'Set complete!' : ''}`;
    }
  }

  // Additional feedback for form
  if (!isDown && avgElbowAngle > EXTENDED_THRESHOLD && repCount > 0) {
    feedback = `Ready for rep ${repCount + 1}. Current: ${repCount}/${targetRepsPerSet}`;
  }

  if (repCount >= targetRepsPerSet) {
    feedback = 'Set complete! Take a rest.';
  }

  if (totalReps >= totalTargetReps) {
    feedback = 'Workout complete! Great job!';
  }

  return { 
    repCount, 
    feedback,
    avgElbowAngle: Math.round(avgElbowAngle),
    isDown
  };
};

// Load MediaPipe scripts dynamically
async function loadMediaPipeScripts() {
  return new Promise((resolve, reject) => {
    if (window.Pose && window.Camera) {
      resolve();
      return;
    }

    let scriptsLoaded = 0;
    const totalScripts = 2;

    function onScriptLoad() {
      scriptsLoaded++;
      if (scriptsLoaded === totalScripts) {
        resolve();
      }
    }

    // Load Pose
    const poseScript = document.createElement('script');
    poseScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js';
    poseScript.onload = onScriptLoad;
    poseScript.onerror = () => reject(new Error('Failed to load MediaPipe Pose'));
    document.head.appendChild(poseScript);

    // Load Camera Utils
    const cameraScript = document.createElement('script');
    cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js';
    cameraScript.onload = onScriptLoad;
    cameraScript.onerror = () => reject(new Error('Failed to load MediaPipe Camera Utils'));
    document.head.appendChild(cameraScript);
  });
}