// State variables for plank tracking
let isInPlankPosition = false;
let plankStartTime = null;
let currentSessionTime = 0;
let totalPlankTime = 0;
let consecutiveGoodFrames = 0;
let consecutiveBadFrames = 0;
let sessionCount = 0;
let sessionHistory = [];
let poseLandmarker = null;
let vision = null;
let isRunning = false;
let animationFrameId = null;

// Constants
const REQUIRED_GOOD_FRAMES = 10; // Require frames for stability
const REQUIRED_BAD_FRAMES = 15; // Require frames before stopping
const FPS = 30; // Target FPS for processing
const FRAME_INTERVAL = 1000 / FPS;

// Main monitoring function that returns a monitor object
export const monitorPlank = async (config) => {
  const {
    targetDuration = 60, // Target plank duration in seconds
    totalSets = 3,
    currentSet = 1,
    userEmail,
    cameraFacing = 'user',
    videoRef,
    onFeedback,
    onComplete,
    onProgress
  } = config;

  try {
    // Load MediaPipe Vision Tasks
    await loadMediaPipeScripts();
    
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
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });

    console.log('✅ PoseLandmarker initialized successfully');

    // State tracking
    let currentSetDuration = 0;
    let lastProcessTime = 0;

    // Start video processing
    isRunning = true;
    
    const processVideoFrame = async () => {
      if (!isRunning || !poseLandmarker || !videoRef.current) return;
      
      const now = performance.now();
      
      // Limit processing to target FPS
      if (now - lastProcessTime >= FRAME_INTERVAL) {
        try {
          const results = poseLandmarker.detectForVideo(videoRef.current, now);
          
          const monitorResult = detectPlank(results, {
            targetDuration,
            currentSetDuration,
            totalPlankTime,
            sessionCount
          });

          // Update timing
          currentSetDuration = monitorResult.currentDuration;
          
          // Send progress updates
          if (onProgress) {
            onProgress({
              currentDuration: currentSetDuration,
              targetDuration,
              totalTime: totalPlankTime + currentSetDuration,
              sessionCount: monitorResult.sessionCount,
              isActive: monitorResult.isInPlank
            });
          }

          // Check if target duration reached
          if (currentSetDuration >= targetDuration && isInPlankPosition) {
            onComplete({
              completed: true,
              duration: currentSetDuration,
              feedback: `Set ${currentSet} complete! Held for ${formatTime(currentSetDuration)}`,
              currentSet,
              totalTime: totalPlankTime + currentSetDuration
            });
            
            // Add to total time and reset for next set
            totalPlankTime += currentSetDuration;
            sessionCount++;
            sessionHistory.push({
              duration: currentSetDuration,
              timestamp: new Date()
            });
            
            // Reset for next set
            resetPlankSession();
          }

          // Send feedback
          if (onFeedback) {
            onFeedback(monitorResult.feedback);
          }
          
          lastProcessTime = now;
        } catch (error) {
          console.error("Error processing frame:", error);
        }
      }
      
      // Continue processing
      if (isRunning) {
        animationFrameId = requestAnimationFrame(processVideoFrame);
      }
    };

    // Start processing
    processVideoFrame();
    
    console.log('Plank monitoring started');

    // Return monitor object with stop method
    return {
      stop: () => {
        isRunning = false;
        
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        
        // Stop current session if active
        if (isInPlankPosition && plankStartTime !== null) {
          const sessionTime = Date.now() / 1000 - plankStartTime;
          totalPlankTime += sessionTime;
          sessionCount++;
          sessionHistory.push({
            duration: sessionTime,
            timestamp: new Date()
          });
        }
        
        // Reset timing variables
        resetPlankSession();
        
        if (poseLandmarker) {
          poseLandmarker.close();
        }
        
        console.log('Plank monitoring stopped');
      },
      
      getStats: () => ({
        totalPlankTime,
        sessionCount,
        sessionHistory,
        currentSessionTime: isInPlankPosition ? (Date.now() / 1000 - plankStartTime) : 0
      }),
      
      reset: () => {
        // Stop current session
        if (isInPlankPosition && plankStartTime !== null) {
          const sessionTime = Date.now() / 1000 - plankStartTime;
          totalPlankTime += sessionTime;
        }
        
        // Reset all timing variables
        resetPlankSession();
        totalPlankTime = 0;
        sessionCount = 0;
        sessionHistory = [];
        
        console.log('🔄 Plank timer and statistics reset');
      }
    };

  } catch (error) {
    console.error('Error initializing plank monitoring:', error);
    throw error;
  }
};

// Core plank detection logic
const detectPlank = (results, { targetDuration, currentSetDuration, totalPlankTime, sessionCount }) => {
  if (!results.landmarks || results.landmarks.length === 0) {
    // No pose detected
    handleNoPoseDetected();
    return { 
      feedback: '🔍 Move into camera view for pose detection',
      currentDuration: getCurrentSessionDuration(),
      sessionCount,
      isInPlank: false
    };
  }

  const analysis = analyzePlankForm(results.landmarks);
  const feedback = provideFeedback(analysis);
  
  return {
    feedback: feedback.message,
    currentDuration: getCurrentSessionDuration(),
    sessionCount,
    isInPlank: isInPlankPosition,
    formQuality: analysis.isGoodForm ? 'good' : 'needs-improvement',
    debug: analysis.debug
  };
};

// Analyze plank form from pose landmarks
function analyzePlankForm(landmarks) {
  const lm = landmarks[0];
  
  // Key body points (MediaPipe pose landmarks)
  const nose = lm[0];
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  const leftElbow = lm[13];
  const rightElbow = lm[14];
  const leftWrist = lm[15];
  const rightWrist = lm[16];
  const leftHip = lm[23];
  const rightHip = lm[24];
  const leftKnee = lm[25];
  const rightKnee = lm[26];
  const leftAnkle = lm[27];
  const rightAnkle = lm[28];

  // Calculate average positions for stability
  const avgShoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
  const avgElbow = { x: (leftElbow.x + rightElbow.x) / 2, y: (leftElbow.y + rightElbow.y) / 2 };
  const avgWrist = { x: (leftWrist.x + rightWrist.x) / 2, y: (leftWrist.y + rightWrist.y) / 2 };
  const avgHip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const avgKnee = { x: (leftKnee.x + rightKnee.x) / 2, y: (leftKnee.y + rightKnee.y) / 2 };
  const avgAnkle = { x: (leftAnkle.x + rightAnkle.x) / 2, y: (leftAnkle.y + rightAnkle.y) / 2 };

  // Plank position detection
  const isOnForearms = avgElbow.y > avgShoulder.y && avgWrist.y > avgElbow.y;
  const kneesOffGround = avgKnee.y < (avgAnkle.y - 0.04);
  
  // Body alignment checks
  const hipShoulderDiff = avgHip.y - avgShoulder.y;
  const hipTooHigh = hipShoulderDiff < -0.06;
  const hipTooLow = hipShoulderDiff > 0.06;
  
  // Shoulder-elbow alignment
  const shoulderElbowDistance = Math.abs(avgShoulder.x - avgElbow.x);
  const shouldersOverElbows = shoulderElbowDistance < 0.08;
  
  // Body straightness check
  const bodySlope = Math.abs((avgHip.y - avgShoulder.y) / (avgHip.x - avgShoulder.x + 0.001));
  const isBodyStraight = bodySlope < 0.25;

  // Form feedback messages
  let formFeedback = [];
  let isGoodForm = true;

  if (!isOnForearms) {
    formFeedback.push("🔽 Get into plank position - forearms on ground");
    isGoodForm = false;
  }

  if (!kneesOffGround) {
    formFeedback.push("⬆️ Lift your knees off the ground");
    isGoodForm = false;
  }

  if (hipTooHigh) {
    formFeedback.push("⬇️ Lower your hips - they're too high");
    isGoodForm = false;
  } else if (hipTooLow) {
    formFeedback.push("⬆️ Raise your hips - they're sagging");
    isGoodForm = false;
  }

  if (!shouldersOverElbows && isOnForearms) {
    formFeedback.push("📐 Position shoulders directly over elbows");
    isGoodForm = false;
  }

  if (!isBodyStraight && isOnForearms && kneesOffGround) {
    formFeedback.push("📏 Keep your body in a straight line");
    isGoodForm = false;
  }

  // Core plank requirements
  const isValidPlank = isOnForearms && kneesOffGround && !hipTooHigh && !hipTooLow;
  const isPerfectForm = isValidPlank && shouldersOverElbows && isBodyStraight;

  // Debug information
  const debugInfo = {
    isOnForearms,
    kneesOffGround,
    hipTooHigh,
    hipTooLow,
    shouldersOverElbows,
    isBodyStraight,
    bodySlope: bodySlope.toFixed(3),
    hipShoulderDiff: hipShoulderDiff.toFixed(3)
  };

  return {
    isInPlank: isValidPlank,
    isGoodForm: isPerfectForm,
    feedback: formFeedback.length > 0 ? formFeedback : ["🎉 Perfect form! Keep it up!"],
    debug: debugInfo
  };
}

// Provide real-time feedback and manage timing
function provideFeedback(analysis) {
  const now = Date.now() / 1000;
  
  if (analysis.isInPlank) {
    consecutiveGoodFrames++;
    consecutiveBadFrames = 0;
    
    const feedbackMessage = analysis.feedback.join(" • ");
    
    // Start timing after consecutive good frames
    if (!isInPlankPosition && consecutiveGoodFrames >= REQUIRED_GOOD_FRAMES) {
      plankStartTime = now;
      isInPlankPosition = true;
      currentSessionTime = 0;
      console.log("🟢 Plank started!");
    }
    
    return {
      message: feedbackMessage,
      type: analysis.isGoodForm ? "good-form" : "bad-form"
    };
  } else {
    consecutiveBadFrames++;
    consecutiveGoodFrames = 0;
    
    const feedbackMessage = analysis.feedback.join(" • ");
    
    // Stop timing after consecutive bad frames
    if (isInPlankPosition && consecutiveBadFrames >= REQUIRED_BAD_FRAMES) {
      if (plankStartTime !== null) {
        const sessionTime = now - plankStartTime;
        totalPlankTime += sessionTime;
        sessionCount++;
        sessionHistory.push({
          duration: sessionTime,
          timestamp: new Date()
        });
        
        console.log("🔴 Plank ended. Session time:", formatTime(sessionTime));
      }
      resetPlankSession();
    }
    
    return {
      message: feedbackMessage,
      type: "bad-form"
    };
  }
}

// Handle when no pose is detected
function handleNoPoseDetected() {
  if (isInPlankPosition) {
    consecutiveBadFrames++;
    if (consecutiveBadFrames >= REQUIRED_BAD_FRAMES) {
      // Stop timing due to no pose detection
      if (plankStartTime !== null) {
        const sessionTime = Date.now() / 1000 - plankStartTime;
        totalPlankTime += sessionTime;
        sessionCount++;
        sessionHistory.push({
          duration: sessionTime,
          timestamp: new Date()
        });
      }
      resetPlankSession();
    }
  }
}

// Get current session duration
function getCurrentSessionDuration() {
  if (isInPlankPosition && plankStartTime !== null) {
    return Date.now() / 1000 - plankStartTime;
  }
  return currentSessionTime;
}

// Reset plank session variables
function resetPlankSession() {
  plankStartTime = null;
  isInPlankPosition = false;
  currentSessionTime = 0;
  consecutiveGoodFrames = 0;
  consecutiveBadFrames = 0;
}

// Format time in MM:SS format
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Calculate angle between three points
function calcAngle(a, b, c) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ac = Math.hypot(c.x - a.x, c.y - a.y);
  const angle = Math.acos((ab**2 + bc**2 - ac**2) / (2 * ab * bc)) * (180 / Math.PI);
  return isNaN(angle) ? 180 : angle;
}

// Load MediaPipe scripts dynamically
async function loadMediaPipeScripts() {
  return new Promise((resolve, reject) => {
    if (window.FilesetResolver && window.PoseLandmarker) {
      resolve();
      return;
    }

    // Load MediaPipe Vision Tasks bundle
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import {
        FilesetResolver,
        PoseLandmarker,
      } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
      
      window.FilesetResolver = FilesetResolver;
      window.PoseLandmarker = PoseLandmarker;
      
      window.dispatchEvent(new CustomEvent('mediapipe-loaded'));
    `;
    
    window.addEventListener('mediapipe-loaded', () => {
      resolve();
    }, { once: true });
    
    script.onerror = () => reject(new Error('Failed to load MediaPipe Vision Tasks'));
    document.head.appendChild(script);
  });
}