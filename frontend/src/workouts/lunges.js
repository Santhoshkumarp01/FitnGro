// State variables for lunge tracking
let isInLunge = false;
let lastRepCount = 0;
let poseLandmarker = null;
let framesSinceLastRep = 0;
let lastFormFeedback = "";
let lungeStartTime = null;
let totalLungeTime = 0;
let averageLungeTime = 0;

// Constants
const FRAMES_BETWEEN_REPS = 20; // Minimum frames between rep counts
const DETECTION_CONFIDENCE = 0.6;
const MIN_LUNGE_HOLD_TIME = 1000; // Minimum hold time in milliseconds for a quality lunge

// Main monitoring function that returns a monitor object
export const monitorLunges = async (config) => {
  const {
    targetReps = 10,
    totalSets = 3,
    currentSet = 1,
    userEmail,
    cameraFacing = 'user',
    videoRef,
    canvasRef,
    onFeedback,
    onComplete,
    onTimingUpdate
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
      minPoseDetectionConfidence: DETECTION_CONFIDENCE,
      minPosePresenceConfidence: DETECTION_CONFIDENCE,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });

    // State tracking
    let currentSetReps = 0;
    let totalReps = 0;
    let totalTargetReps = targetReps * totalSets;
    let isRunning = true;
    let lastVideoTime = -1;

    // Set up canvas for drawing
    const canvas = canvasRef?.current;
    const canvasCtx = canvas?.getContext('2d');
    let drawingUtils = null;
    
    if (canvasCtx && window.DrawingUtils) {
      drawingUtils = new window.DrawingUtils(canvasCtx);
    }

    // Detection loop
    const detectPose = async () => {
      if (!videoRef.current || !poseLandmarker || !isRunning) return;

      const currentTime = videoRef.current.currentTime;
      if (currentTime === lastVideoTime) {
        requestAnimationFrame(detectPose);
        return;
      }
      lastVideoTime = currentTime;

      try {
        const results = poseLandmarker.detectForVideo(videoRef.current, performance.now());
        
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Draw pose on canvas if available
          if (drawingUtils && canvasCtx) {
            drawPoseKeypoints(landmarks, canvasCtx, drawingUtils);
          }
          
          framesSinceLastRep++;
          
          const monitorResult = detectLunges(results, {
            currentSetReps,
            targetRepsPerSet: targetReps,
            totalReps,
            totalTargetReps
          });

          if (monitorResult.repCount > currentSetReps) {
            currentSetReps = monitorResult.repCount;
            totalReps++;
            
            // Update timing statistics
            if (onTimingUpdate) {
              onTimingUpdate({
                totalLungeTime,
                averageLungeTime,
                lastLungeTime: monitorResult.lastLungeTime
              });
            }
            
            // Check if set is complete
            if (currentSetReps >= targetReps) {
              onComplete({
                completed: true,
                reps: currentSetReps,
                feedback: `Set ${currentSet} complete! ${currentSetReps}/${targetReps} reps`,
                currentSet,
                timingStats: {
                  totalTime: totalLungeTime,
                  averageTime: averageLungeTime
                }
              });
              // Reset for next set
              currentSetReps = 0;
              lastRepCount = 0;
              framesSinceLastRep = 0;
            }
          }

          // Send feedback
          if (onFeedback) {
            onFeedback(monitorResult.feedback);
          }
        } else {
          if (onFeedback) {
            onFeedback({
              message: "❌ Person not detected - step into frame",
              class: "warning-form"
            });
          }
        }
      } catch (error) {
        console.error("❌ Pose detection error:", error);
        if (onFeedback) {
          onFeedback({
            message: "Detection error occurred",
            class: "error"
          });
        }
      }

      if (isRunning) {
        requestAnimationFrame(detectPose);
      }
    };

    // Start detection loop
    detectPose();
    
    console.log('Lunge monitoring started');

    // Return monitor object with stop method
    return {
      stop: () => {
        isRunning = false;
        if (poseLandmarker) {
          poseLandmarker.close();
        }
        console.log('Lunge monitoring stopped');
      },
      getStats: () => ({
        totalTime: totalLungeTime,
        averageTime: averageLungeTime,
        totalReps: totalReps
      })
    };

  } catch (error) {
    console.error('Error initializing lunge monitoring:', error);
    throw error;
  }
};

// Core lunge detection logic with timing
const detectLunges = (results, { currentSetReps, targetRepsPerSet, totalReps, totalTargetReps }) => {
  if (!results.landmarks || results.landmarks.length === 0) {
    return { 
      feedback: { message: 'No person detected.', class: 'warning-form' }, 
      repCount: currentSetReps 
    };
  }

  const landmarks = results.landmarks[0];
  
  // Key landmarks for lunge detection
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const nose = landmarks[0];

  if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    return { 
      feedback: { message: 'Please position yourself sideways to the camera.', class: 'warning-form' }, 
      repCount: currentSetReps 
    };
  }

  const isCurrentlyLunge = isLungePosition(landmarks);
  const currentTime = Date.now();
  let repCount = currentSetReps;
  let feedback = { message: 'Ready for next lunge...', class: 'neutral-form' };
  let lastLungeTime = 0;

  if (isCurrentlyLunge) {
    const formAnalysis = analyzeLungeForm(landmarks);
    
    // Start timing if entering lunge position
    if (!isInLunge && framesSinceLastRep > FRAMES_BETWEEN_REPS) {
      isInLunge = true;
      lungeStartTime = currentTime;
      feedback = { message: "🔥 Lunge detected! Hold the position...", class: "processing" };
    } else if (isInLunge) {
      const holdTime = currentTime - lungeStartTime;
      feedback = {
        message: `${formAnalysis.feedback} | Hold time: ${Math.round(holdTime/1000)}s`,
        class: formAnalysis.class
      };
    }
  } else {
    // Exiting lunge position
    if (isInLunge && framesSinceLastRep > FRAMES_BETWEEN_REPS) {
      const lungeHoldTime = currentTime - lungeStartTime;
      
      // Only count as rep if held for minimum time
      if (lungeHoldTime >= MIN_LUNGE_HOLD_TIME) {
        isInLunge = false;
        repCount++;
        framesSinceLastRep = 0;
        lastLungeTime = lungeHoldTime;
        
        // Update timing statistics
        totalLungeTime += lungeHoldTime;
        averageLungeTime = totalLungeTime / repCount;
        
        feedback = {
          message: `💪 Rep completed! Time: ${Math.round(lungeHoldTime/1000)}s | Total: ${repCount}/${targetRepsPerSet}`,
          class: "good-form"
        };
      } else {
        isInLunge = false;
        feedback = {
          message: `⏱️ Hold longer! Minimum ${MIN_LUNGE_HOLD_TIME/1000}s required (held ${Math.round(lungeHoldTime/1000)}s)`,
          class: "warning-form"
        };
      }
      
      lungeStartTime = null;
    } else if (!isInLunge) {
      feedback = { 
        message: "👀 Position yourself for a lunge", 
        class: "neutral-form" 
      };
    }
  }

  if (repCount >= targetRepsPerSet) {
    feedback = { 
      message: `Set complete! Average lunge time: ${Math.round(averageLungeTime/1000)}s`, 
      class: "good-form" 
    };
  }

  if (totalReps >= totalTargetReps) {
    feedback = { 
      message: 'Workout complete! Great job!', 
      class: "good-form" 
    };
  }

  return { 
    repCount, 
    feedback,
    isInLunge,
    lastLungeTime
  };
};

// Helper functions from original code
function calculateAngle(a, b, c) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ac = Math.hypot(c.x - a.x, c.y - a.y);
  const angle = Math.acos((ab**2 + bc**2 - ac**2) / (2 * ab * bc)) * (180 / Math.PI);
  return isNaN(angle) ? 180 : angle;
}

function isLungePosition(landmarks) {
  const leftHip = landmarks[23], rightHip = landmarks[24];
  const leftKnee = landmarks[25], rightKnee = landmarks[26];
  const leftAnkle = landmarks[27], rightAnkle = landmarks[28];
  
  // Calculate knee angles
  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
  
  // Check if one leg is significantly more bent than the other
  const angleDifference = Math.abs(leftKneeAngle - rightKneeAngle);
  
  // Check foot separation for lunge stance
  const footSeparation = Math.abs(leftAnkle.x - rightAnkle.x);
  
  // Lunge criteria: one knee bent < 135°, significant angle difference, adequate foot separation
  const hasLungeStance = (leftKneeAngle < 135 || rightKneeAngle < 135) && 
                        angleDifference > 25 && 
                        footSeparation > 0.08;
  
  return hasLungeStance;
}

function analyzeLungeForm(landmarks) {
  const leftHip = landmarks[23], rightHip = landmarks[24];
  const leftKnee = landmarks[25], rightKnee = landmarks[26];
  const leftAnkle = landmarks[27], rightAnkle = landmarks[28];
  const nose = landmarks[0];
  
  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
  
  let formFeedback = [];
  let formClass = "good-form";
  
  // Determine front leg (more bent)
  const frontLeg = leftKneeAngle < rightKneeAngle ? 'left' : 'right';
  const frontKneeAngle = frontLeg === 'left' ? leftKneeAngle : rightKneeAngle;
  const backKneeAngle = frontLeg === 'left' ? rightKneeAngle : leftKneeAngle;
  const frontKnee = frontLeg === 'left' ? leftKnee : rightKnee;
  const frontAnkle = frontLeg === 'left' ? leftAnkle : rightAnkle;
  
  // Form analysis
  if (frontKnee.x > frontAnkle.x + 0.06) {
    formFeedback.push("⚠️ Keep front knee behind toes");
    formClass = "poor-form";
  }
  
  if (frontKneeAngle > 130) {
    formFeedback.push("📉 Go deeper - bend front knee more");
    formClass = "warning-form";
  } else if (frontKneeAngle < 60) {
    formFeedback.push("⬆️ Don't go too low - maintain control");
    formClass = "warning-form";
  }
  
  if (backKneeAngle < 130) {
    formFeedback.push("📏 Keep back leg straighter");
    if (formClass !== "poor-form") formClass = "warning-form";
  }
  
  // Check torso alignment
  const hipCenter = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const torsoLean = Math.abs(nose.x - hipCenter.x);
  if (torsoLean > 0.12) {
    formFeedback.push("📐 Keep torso upright");
    if (formClass !== "poor-form") formClass = "warning-form";
  }
  
  if (formFeedback.length === 0) {
    formFeedback.push("✅ Excellent form!");
  }
  
  return { feedback: formFeedback.join(" | "), class: formClass };
}

function drawPoseKeypoints(landmarks, canvasCtx, drawingUtils) {
  // Clear canvas
  canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
  
  // Draw pose connections
  drawingUtils.drawLandmarks(landmarks, {
    radius: (data) => window.DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
  });
  
  drawingUtils.drawConnectors(landmarks, window.PoseLandmarker.POSE_CONNECTIONS, {
    color: '#00FF00',
    lineWidth: 2
  });
  
  // Highlight key joints for lunge analysis
  const keyJoints = [23, 24, 25, 26, 27, 28]; // hips, knees, ankles
  keyJoints.forEach(index => {
    const landmark = landmarks[index];
    if (landmark) {
      canvasCtx.beginPath();
      canvasCtx.arc(
        landmark.x * canvasCtx.canvas.width,
        landmark.y * canvasCtx.canvas.height,
        8, 0, 2 * Math.PI
      );
      canvasCtx.fillStyle = '#FF6B6B';
      canvasCtx.fill();
    }
  });
}

// Load MediaPipe scripts dynamically
async function loadMediaPipeScripts() {
  return new Promise((resolve, reject) => {
    if (window.FilesetResolver && window.PoseLandmarker && window.DrawingUtils) {
      resolve();
      return;
    }

    // Load MediaPipe Tasks Vision
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import {
        FilesetResolver,
        PoseLandmarker,
        DrawingUtils
      } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
      
      window.FilesetResolver = FilesetResolver;
      window.PoseLandmarker = PoseLandmarker;
      window.DrawingUtils = DrawingUtils;
      
      window.dispatchEvent(new Event('mediapipe-loaded'));
    `;
    
    window.addEventListener('mediapipe-loaded', () => {
      resolve();
    }, { once: true });
    
    script.onerror = () => reject(new Error('Failed to load MediaPipe Tasks Vision'));
    document.head.appendChild(script);
  });
}