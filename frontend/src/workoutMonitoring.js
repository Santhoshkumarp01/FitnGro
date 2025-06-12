// Centralized utilities for workout monitoring

// Load MediaPipe libraries (they add to global scope)
const MEDIAPIPE_POSE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js';
const MEDIAPIPE_CAMERA_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js';

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

// Sync progress to backend when online
async function syncProgress(userEmail) {
  if (!navigator.onLine) return;

  try {
    if (!db) {
      db = await openDB();
    }
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const records = request.result;
      for (const record of records) {
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
            deleteStore.delete(record.id);
          }
        } catch (error) {
          console.error('Error syncing record:', error);
        }
      }
    };
  } catch (error) {
    console.error('Error syncing progress:', error);
  }
}

// Get optimal resolution based on device capabilities
async function getOptimalResolution() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const capabilities = stream.getVideoTracks()[0].getCapabilities();
    stream.getTracks().forEach(track => track.stop());
    const targetWidth = Math.min(capabilities.width?.max || 640, 640);
    const targetHeight = Math.min(capabilities.height?.max || 480, targetWidth * (480 / 640));
    return { width: targetWidth, height: targetHeight };
  } catch (error) {
    console.error('Resolution detection error:', error);
    return { width: 640, height: 480 };
  }
}

// Load MediaPipe scripts dynamically
async function loadMediaPipeScripts() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
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
    poseScript.src = MEDIAPIPE_POSE_URL;
    poseScript.onload = onScriptLoad;
    poseScript.onerror = () => reject(new Error('Failed to load MediaPipe Pose'));
    document.head.appendChild(poseScript);

    // Load Camera Utils
    const cameraScript = document.createElement('script');
    cameraScript.src = MEDIAPIPE_CAMERA_URL;
    cameraScript.onload = onScriptLoad;
    cameraScript.onerror = () => reject(new Error('Failed to load MediaPipe Camera Utils'));
    document.head.appendChild(cameraScript);
  });
}

// Initialize MediaPipe Pose (shared across workouts)
async function initPose(modelComplexity = 1) {
  try {
    // Load MediaPipe scripts first
    await loadMediaPipeScripts();
    
    // Now use the global Pose class
    const pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
    });
    
    pose.setOptions({
      modelComplexity,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: true,
      upperBodyOnly: true,
    });
    
    await pose.initialize();
    console.log('MediaPipe Pose initialized');
    return pose;
  } catch (error) {
    console.error('Error initializing MediaPipe Pose:', error);
    throw error;
  }
}

// Initialize MediaPipe Camera - FIXED VERSION
async function initCamera(videoElement, onFrame) {
  try {
    await loadMediaPipeScripts();
    
    // Use the global Camera class that was loaded by the scripts
    const camera = new window.Camera(videoElement, {
      onFrame: onFrame,
      width: 640,
      height: 480
    });
    
    return camera;
  } catch (error) {
    console.error('Error initializing MediaPipe Camera:', error);
    throw error;
  }
}

// Workout monitoring mapping with dynamic imports
export const WORKOUT_MONITORING = {
  'push-ups': () => import('./workouts/pushUps.js').then(m => m.monitorPushUps),
  // Add more workouts here, e.g., 'squats': () => import('./workouts/squats.js').then(m => m.monitorSquats),
};

// Shared utilities for workout modules
export const UTILS = {
  openDB,
  storeProgress,
  syncProgress,
  getOptimalResolution,
  initPose,
  initCamera,
  loadMediaPipeScripts,
};