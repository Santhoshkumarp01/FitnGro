// State variables for burpee tracking
let currentPhase = 'standing';
let burpeeCount = 0;
let partialBurpees = 0;
let lastRepCount = 0;
let phaseStartTime = 0;
let phaseConfidence = 0;
let framesSincePhaseChange = 0;
let pushupCompleted = false;
let pushupDetectionFrames = 0;
let minElbowAngleInPhase = 180;
let completedPhases = {
  squat: false,
  pushup: false,
  return: false,
  jump: false
};

let poseLandmarker = null;
let vision = null;
let camera = null;
let animationFrameId = null;

// Main monitoring function that returns a monitor object
export const monitorBurpees = async (config) => {
  const {
    targetReps = 10,
    totalSets = 3,
    currentSet = 1,
    userEmail,
    cameraFacing = 'user',
    videoRef,
    onFeedback,
    onComplete,
    onPhaseChange
  } = config;

  try {
    // Load MediaPipe Tasks Vision
    await loadMediaPipeTasksVision();
    
    // Initialize MediaPipe Pose Landmarker
    vision = await window.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    
    poseLandmarker = await window.PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.7,
      minPosePresenceConfidence: 0.7,
      minTrackingConfidence: 0.7,
      outputSegmentationMasks: false,
    });

    // State tracking
    let currentSetReps = 0;
    let totalReps = 0;
    let totalTargetReps = targetReps * totalSets;

    // Initialize camera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: cameraFacing === 'user' ? 'user' : 'environment'
      }
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      
      videoRef.current.onloadeddata = () => {
        processVideo();
      };
    }

    // Video processing function
    const processVideo = async () => {
      if (!poseLandmarker || !videoRef.current) return;

      try {
        const currentTime = performance.now();
        const results = poseLandmarker.detectForVideo(videoRef.current, currentTime);
        
        const monitorResult = detectBurpees(results, {
          currentSetReps,
          targetRepsPerSet: targetReps,
          totalReps,
          totalTargetReps
        });

        // Update rep counts
        if (monitorResult.repCount > currentSetReps) {
          currentSetReps = monitorResult.repCount;
          totalReps++;
          
          // Check if set is complete
          if (currentSetReps >= targetReps) {
            onComplete({
              completed: true,
              reps: currentSetReps,
              feedback: `Set ${currentSet} complete! ${currentSetReps}/${targetReps} reps`,
              currentSet,
              partialReps: monitorResult.partialReps
            });
            // Reset for next set
            currentSetReps = 0;
            lastRepCount = 0;
            resetBurpeeState();
          }
        }

        // Send feedback
        if (onFeedback) {
          onFeedback(monitorResult.feedback);
        }

        // Send phase change updates
        if (onPhaseChange && monitorResult.phaseChanged) {
          onPhaseChange({
            currentPhase: monitorResult.currentPhase,
            completedPhases: monitorResult.completedPhases
          });
        }
        
      } catch (error) {
        console.error("Error processing video frame:", error);
      }

      animationFrameId = requestAnimationFrame(processVideo);
    };

    console.log('Burpee monitoring started');

    // Return monitor object with stop method
    return {
      stop: () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        if (poseLandmarker) {
          poseLandmarker.close();
        }
        resetBurpeeState();
        console.log('Burpee monitoring stopped');
      },
      
      reset: () => {
        resetBurpeeState();
        currentSetReps = 0;
        totalReps = 0;
        lastRepCount = 0;
      },
      
      getStats: () => ({
        perfectReps: burpeeCount,
        partialReps: partialBurpees,
        totalReps: burpeeCount + partialBurpees,
        currentPhase,
        completedPhases
      })
    };

  } catch (error) {
    console.error('Error initializing burpee monitoring:', error);
    throw error;
  }
};

// Core burpee detection logic
const detectBurpees = (results, { currentSetReps, targetRepsPerSet, totalReps, totalTargetReps }) => {
  if (!results.landmarks || results.landmarks.length === 0) {
    return { 
      feedback: 'No person detected. Please stay in camera view.',
      repCount: currentSetReps,
      partialReps: partialBurpees,
      currentPhase,
      completedPhases,
      phaseChanged: false
    };
  }

  const posture = analyzePosture(results.landmarks);
  const previousPhase = currentPhase;
  const burpeeResult = processBurpeeMovement(posture);
  
  // Check if rep count changed
  let repCount = currentSetReps;
  if (burpeeResult.repCompleted && repCount === lastRepCount) {
    repCount++;
    lastRepCount = repCount;
  }

  return {
    repCount,
    partialReps: partialBurpees,
    feedback: burpeeResult.feedback,
    currentPhase,
    completedPhases: { ...completedPhases },
    phaseChanged: previousPhase !== currentPhase,
    avgKneeAngle: Math.round(posture.avgKneeAngle),
    avgElbowAngle: Math.round(posture.avgElbowAngle)
  };
};

// Analyze body posture from landmarks
const analyzePosture = (landmarks) => {
  const lm = landmarks[0];
  
  // Key landmarks
  const nose = lm[0];
  const leftShoulder = lm[11], rightShoulder = lm[12];
  const leftElbow = lm[13], rightElbow = lm[14];
  const leftWrist = lm[15], rightWrist = lm[16];
  const leftHip = lm[23], rightHip = lm[24];
  const leftKnee = lm[25], rightKnee = lm[26];
  const leftAnkle = lm[27], rightAnkle = lm[28];

  // Calculate key angles
  const leftKneeAngle = calcAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calcAngle(rightHip, rightKnee, rightAnkle);
  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

  const leftElbowAngle = calcAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = calcAngle(rightShoulder, rightElbow, rightWrist);
  const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

  // Calculate body positions
  const shoulderHeight = (leftShoulder.y + rightShoulder.y) / 2;
  const hipHeight = (leftHip.y + rightHip.y) / 2;
  const handHeight = (leftWrist.y + rightWrist.y) / 2;
  const noseHeight = nose.y;

  // Position analysis
  const isSquatting = avgKneeAngle < 130 && shoulderHeight > hipHeight - 0.1;
  const isInPushupPosition = handHeight > shoulderHeight && 
                            Math.abs(shoulderHeight - hipHeight) < 0.15 &&
                            noseHeight > shoulderHeight - 0.1;
  const isJumping = avgKneeAngle > 160 && noseHeight < shoulderHeight - 0.1;
  const isStanding = avgKneeAngle > 150 && shoulderHeight < hipHeight;

  return {
    avgKneeAngle,
    avgElbowAngle,
    isSquatting,
    isInPushupPosition,
    isJumping,
    isStanding,
    shoulderHeight,
    hipHeight,
    handHeight,
    noseHeight
  };
};

// Process burpee movement and phase transitions
const processBurpeeMovement = (posture) => {
  framesSincePhaseChange++;
  const minFramesForPhaseChange = 5;
  let feedback = '';
  let repCompleted = false;

  switch(currentPhase) {
    case 'standing':
      if (posture.isSquatting && framesSincePhaseChange > minFramesForPhaseChange) {
        currentPhase = 'squatting';
        framesSincePhaseChange = 0;
        completedPhases.squat = true;
        feedback = "🏋️ Good squat! Now go into push-up position";
      } else {
        feedback = "Ready to start! Squat down to begin your burpee";
      }
      break;

    case 'squatting':
      if (posture.isInPushupPosition && framesSincePhaseChange > minFramesForPhaseChange) {
        currentPhase = 'pushup';
        framesSincePhaseChange = 0;
        pushupCompleted = false;
        pushupDetectionFrames = 0;
        minElbowAngleInPhase = 180;
        feedback = "💪 Perfect! In push-up position - now do the push-up!";
      } else if (framesSincePhaseChange > 60) {
        feedback = "⚠️ Place hands on ground and extend legs back for push-up position";
      } else {
        feedback = "Transition to push-up position";
      }
      break;

    case 'pushup':
      minElbowAngleInPhase = Math.min(minElbowAngleInPhase, posture.avgElbowAngle);
      
      if (posture.avgElbowAngle < 100 && !pushupCompleted) {
        pushupDetectionFrames++;
        if (pushupDetectionFrames >= 3) {
          pushupCompleted = true;
          completedPhases.pushup = true;
          feedback = "💪 Excellent push-up! Now jump back to squat position";
        } else {
          feedback = "Good form! Complete the push-up movement";
        }
      } else if (posture.avgElbowAngle >= 100) {
        pushupDetectionFrames = 0;
        if (!pushupCompleted) {
          feedback = "⚠️ Bend your arms more for a proper push-up";
        }
      }
      
      if (posture.isSquatting && framesSincePhaseChange > minFramesForPhaseChange) {
        if (pushupCompleted) {
          currentPhase = 'returning';
          framesSincePhaseChange = 0;
          completedPhases.return = true;
          feedback = "🔄 Great! Back to squat - now jump up!";
        } else {
          feedback = "⚠️ Complete the push-up first! Bend your arms to at least 90 degrees";
          framesSincePhaseChange = Math.max(0, framesSincePhaseChange - 10);
        }
      } else if (framesSincePhaseChange > 120) {
        if (!pushupCompleted) {
          feedback = "⚠️ Do a proper push-up: bend your arms to 90 degrees or less!";
        } else {
          feedback = "⚠️ Jump your feet back to squat position";
        }
      }
      break;

    case 'returning':
      if ((posture.isJumping || posture.isStanding) && framesSincePhaseChange > minFramesForPhaseChange) {
        currentPhase = 'jumping';
        framesSincePhaseChange = 0;
        feedback = "🚀 Jump higher! Extend fully!";
      } else if (framesSincePhaseChange > 45) {
        feedback = "⚠️ Jump up explosively from squat position!";
      } else {
        feedback = "Jump up from squat position";
      }
      break;

    case 'jumping':
      if (posture.isStanding && framesSincePhaseChange > 10) {
        if (completedPhases.squat && completedPhases.pushup && completedPhases.return) {
          burpeeCount++;
          completedPhases.jump = true;
          feedback = `🎉 Burpee #${burpeeCount} completed! Excellent work!`;
          repCompleted = true;
        } else {
          partialBurpees++;
          feedback = `⚠️ Partial rep #${partialBurpees} - make sure to complete all phases properly!`;
        }
        
        resetBurpeeState();
        
      } else if (posture.isSquatting && framesSincePhaseChange > 5) {
        partialBurpees++;
        currentPhase = 'squatting';
        framesSincePhaseChange = 0;
        pushupCompleted = false;
        pushupDetectionFrames = 0;
        minElbowAngleInPhase = 180;
        completedPhases = { squat: true, pushup: false, return: false, jump: false };
        feedback = `⚠️ Partial rep #${partialBurpees} - jump higher and extend fully next time!`;
      } else {
        feedback = "Extend fully and land on your feet";
      }
      break;
  }

  // Additional form feedback
  if (currentPhase === 'pushup' && Math.abs(posture.shoulderHeight - posture.hipHeight) > 0.25) {
    feedback = "⚠️ Keep your body straight - avoid sagging or piking";
  }

  if (currentPhase === 'squatting' && posture.avgKneeAngle > 140) {
    feedback = "⚠️ Squat deeper - bend your knees more";
  }

  return { feedback, repCompleted };
};

// Calculate angle between three points
const calcAngle = (a, b, c) => {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ac = Math.hypot(c.x - a.x, c.y - a.y);
  const cosAngle = (ab**2 + bc**2 - ac**2) / (2 * ab * bc);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(clampedCos) * (180 / Math.PI);
};

// Reset burpee state for next rep
const resetBurpeeState = () => {
  currentPhase = 'standing';
  framesSincePhaseChange = 0;
  pushupCompleted = false;
  pushupDetectionFrames = 0;
  minElbowAngleInPhase = 180;
  completedPhases = { squat: false, pushup: false, return: false, jump: false };
};

// Load MediaPipe Tasks Vision scripts dynamically
async function loadMediaPipeTasksVision() {
  return new Promise((resolve, reject) => {
    if (window.FilesetResolver && window.PoseLandmarker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import { FilesetResolver, PoseLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
      window.FilesetResolver = FilesetResolver;
      window.PoseLandmarker = PoseLandmarker;
      window.mediaPipeLoaded = true;
    `;
    
    script.onload = () => {
      // Wait for the module to set the global variables
      const checkLoaded = () => {
        if (window.mediaPipeLoaded) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    };
    
    script.onerror = () => reject(new Error('Failed to load MediaPipe Tasks Vision'));
    document.head.appendChild(script);
  });
}