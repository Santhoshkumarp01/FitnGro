// Centralized utilities for workout monitoring
import { Pose } from 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js';
import { Camera } from 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

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
    return { width: 640, height: 480 };
  }
}

// Initialize MediaPipe Pose (shared across workouts)
async function initPose(modelComplexity) {
  const pose = new Pose({
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
};