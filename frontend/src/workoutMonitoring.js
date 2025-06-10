
import { Pose } from 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js';
import { Camera } from 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

// Constants for pose detection thresholds
const MIN_SHOULDER_DROP = 0.1; // Normalized shoulder drop for down position
const ELBOW_ANGLE_THRESHOLD = 120; // Degrees for elbow bend in down position
const CONFIDENCE_THRESHOLD = 0.5; // Minimum confidence for landmarks

// IndexedDB setup for offline storage
const DB_NAME = 'FitnGroDB';
const STORE_NAME = 'workoutProgress';
let db;

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

// Get optimal resolution based on device capabilities
async function getOptimalResolution() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const capabilities = stream.getVideoTracks()[0].getCapabilities();
    stream.getTracks().forEach(track => track.stop());
    const targetWidth = Math.min(capabilities.width, 640);
    const targetHeight = Math.min(capabilities.height, targetWidth * (480 / 640));
    return { width: targetWidth, height: targetHeight };
  } catch (error) {
    console.error('Resolution detection error:', error);
    return { width: 640, height: 480 }; // Fallback
  }
}

// Push-ups monitoring function
export async function monitorPushUps({ targetReps, totalSets, currentSet, userEmail, onFeedback, onComplete }) {
  try {
    // Device performance detection
    const cpuCores = navigator.hardwareConcurrency || 4;
    const modelComplexity = cpuCores < 4 ? 0 : 1; // Low-end: 0, High-end: 1
    const frameRate = cpuCores < 4 ? 15 : 30; // Low-end: 15fps, High-end: 30fps
    const { width, height } = await getOptimalResolution();

    // Initialize MediaPipe Pose
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
    });
    pose.setOptions({
      modelComplexity,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: true, // Optimize for front-facing camera
      upperBodyOnly: true, // Focus on push-up relevant landmarks
    });

    // Initialize camera
    const videoElement = document.createElement('video');
    const camera = new Camera(videoElement, {
      onFrame: async () => await pose.send({ image: videoElement }),
      width,
      height,
      frameRate,
    });
    await camera.start();

    // Battery monitoring
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      if (battery.level < 0.2) {
        camera.setOptions({ frameRate: 10 });
        onFeedback('Low battery, reduced frame rate');
      }
    }

    let reps = 0;
    let isDown = false;
    let feedback = '';
    let lastFeedbackTime = 0;
    const feedbackInterval = 2000; // Feedback every 2 seconds

    // Pose detection callback
    pose.onResults((results) => {
      if (!results.poseLandmarks || results.poseLandmarks.length < 33) {
        feedback = 'Ensure upper body is visible';
        onFeedback(feedback);
        return;
      }

      const landmarks = results.poseLandmarks;
      const leftShoulder = landmarks[11]; // Left shoulder
      const rightShoulder = landmarks[12]; // Right shoulder
      const leftElbow = landmarks[13]; // Left elbow
      const rightElbow = landmarks[14]; // Right elbow
      const leftWrist = landmarks[15]; // Left wrist
      const rightWrist = landmarks[16]; // Right wrist
      const leftHip = landmarks[23]; // Left hip

      // Skip if low confidence
      if (
        leftShoulder.score < CONFIDENCE_THRESHOLD ||
        rightShoulder.score < CONFIDENCE_THRESHOLD ||
        leftElbow.score < CONFIDENCE_THRESHOLD ||
        rightElbow.score < CONFIDENCE_THRESHOLD
      ) {
        return;
      }

      // Calculate shoulder drop (normalized to hip height)
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const hipY = leftHip.y;
      const shoulderDrop = hipY - shoulderY;

      // Calculate elbow angle
      const calculateAngle = (a, b, c) => {
        const ab = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        const bc = Math.sqrt(Math.pow(c.x - b.x, 2) + Math.pow(c.y - b.y, 2));
        const ac = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
        const angle = Math.acos((ab * ab + bc * bc - ac * ac) / (2 * ab * bc)) * (180 / Math.PI);
        return angle;
      };
      const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
      const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
      const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

      // Check back straightness
      const shoulderHipAngle = Math.abs(leftShoulder.y - leftHip.y) * 100;
      if (shoulderHipAngle > 0.05) {
        feedback = 'Keep back straight';
      }

      const now = Date.now();
      if (now - lastFeedbackTime >= feedbackInterval) {
        if (shoulderDrop < MIN_SHOULDER_DROP && !isDown) {
          feedback = 'Go lower';
        } else if (avgElbowAngle > ELBOW_ANGLE_THRESHOLD && isDown) {
          feedback = 'Push up higher';
        }
        onFeedback(feedback);
        lastFeedbackTime = now;
      }

      // Detect rep cycle
      if (!isDown && shoulderDrop > MIN_SHOULDER_DROP && avgElbowAngle < ELBOW_ANGLE_THRESHOLD) {
        isDown = true;
      } else if (isDown && shoulderDrop < MIN_SHOULDER_DROP / 2 && avgElbowAngle > 160) {
        isDown = false;
        reps += 1;
        onFeedback(`Rep ${reps} completed`);

        // Store progress locally
        storeProgress({
          userEmail,
          exerciseName: 'Push-ups',
          currentSet,
          totalSets,
          repsCompleted: reps,
          targetReps,
          timestamp: new Date().toISOString(),
        });

        // Check if set is complete
        if (reps >= targetReps || currentSet >= totalSets) {
          camera.stop();
          pose.close();
          onComplete({
            completed: true,
            reps,
            feedback: `Set ${currentSet} completed with ${reps} reps`,
            currentSet,
            totalSets,
          });
          syncProgress(userEmail);
        }
      }
    });

    return {
      stop: () => {
        camera.stop();
        pose.close();
      },
    };
  } catch (error) {
    console.error('Push-ups monitoring error:', error);
    onFeedback('Error starting push-ups monitoring');
    return { stop: () => {} };
  }
}

// Store progress in IndexedDB
async function storeProgress(data) {
  try {
    if (!db) {
      db = await openDB();
    }
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.add(data);
  } catch (error) {
    console.error('Error storing progress:', error);
  }
}

// Sync progress to Firestore when online
async function syncProgress(userEmail) {
  if (!navigator.onLine) return;

  try {
    if (!db) {
      db = await openDB();
    }
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = await store.getAll();

    for (const record of request) {
      try {
        const response = await fetch('/track-exercise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: record.userEmail,
            exerciseName: record.exerciseName,
            currentSet: record.currentSet,
            totalSets: record.totalSets,
            targetReps: record.targetReps,
            currentReps: record.repsCompleted,
          }),
        });
        if (response.ok) {
          const deleteTx = db.transaction(STORE_NAME, 'readwrite');
          const deleteStore = deleteTx.objectStore(STORE_NAME);
          await deleteStore.delete(record.id);
        }
      } catch (error) {
        console.error('Error syncing record:', error);
      }
    }
  } catch (error) {
    console.error('Error syncing progress:', error);
  }
}

// Workout monitoring mapping
export const WORKOUT_MONITORING = {
  'push-ups': monitorPushUps,
};