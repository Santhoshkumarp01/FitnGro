// Remove the problematic import and use the utilities properly
import { UTILS } from '../workoutMonitoring.js';

const MIN_SHOULDER_DROP = 0.1;
const ELBOW_ANGLE_THRESHOLD = 120;
const CONFIDENCE_THRESHOLD = 0.5;

export async function monitorPushUps({
  targetReps,
  totalSets,
  currentSet,
  userEmail,
  cameraFacing = 'user',
  videoRef,
  onFeedback,
  onComplete
}) {
  try {
    const cpuCores = navigator.hardwareConcurrency || 4;
    const modelComplexity = cpuCores < 4 ? 0 : 1;
    const frameRate = cpuCores < 4 ? 15 : 30;
    const { width, height } = await UTILS.getOptimalResolution();

    const pose = await UTILS.initPose(modelComplexity);
    const videoElement = videoRef?.current || document.createElement('video');
    videoElement.width = width;
    videoElement.height = height;

    // Use the Camera from global scope (loaded by workoutMonitoring.js)
    const camera = await UTILS.initCamera(videoElement, async () => {
      if (videoElement.readyState === 4) {
        await pose.send({ image: videoElement });
      } else {
        onFeedback('Camera not ready, please check permissions');
      }
    });

    // Configure camera options
    camera.setOptions({
      width,
      height,
      frameRate,
      facingMode: cameraFacing
    });

    try {
      await camera.start();
      if (!videoRef?.current) {
        videoElement.play();
      }
      console.log('Camera started with facingMode:', cameraFacing);
    } catch (error) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        onFeedback('Camera access denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError') {
        onFeedback('No camera found. Please connect a camera.');
      } else {
        onFeedback('Failed to start camera. Please try again.');
      }
      return { stop: () => {} };
    }

    // Battery optimization
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        if (battery.level < 0.2) {
          camera.setOptions({ frameRate: 10 });
          onFeedback('Low battery, reduced frame rate');
        }
      } catch (e) {
        // Battery API not supported, continue normally
      }
    }

    let reps = 0;
    let isDown = false;
    let feedback = '';
    let lastFeedbackTime = 0;
    const feedbackInterval = 2000;

    pose.onResults((results) => {
      if (!results.poseLandmarks || results.poseLandmarks.length < 33) {
        feedback = 'Ensure upper body is visible';
        onFeedback(feedback);
        return;
      }

      const landmarks = results.poseLandmarks;
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      const leftHip = landmarks[23];

      if (
        leftShoulder.score < CONFIDENCE_THRESHOLD ||
        rightShoulder.score < CONFIDENCE_THRESHOLD ||
        leftElbow.score < CONFIDENCE_THRESHOLD ||
        rightElbow.score < CONFIDENCE_THRESHOLD
      ) {
        return;
      }

      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const hipY = leftHip.y;
      const shoulderDrop = hipY - shoulderY;

      const calculateAngle = (a, b, c) => {
        const ab = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        const bc = Math.sqrt(Math.pow(c.x - b.x, 2) + Math.pow(c.y - b.y, 2));
        const ac = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
        return Math.acos((ab * ab + bc * bc - ac * ac) / (2 * ab * bc)) * (180 / Math.PI);
      };

      const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
      const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
      const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

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

      if (!isDown && shoulderDrop > MIN_SHOULDER_DROP && avgElbowAngle < ELBOW_ANGLE_THRESHOLD) {
        isDown = true;
      } else if (isDown && shoulderDrop < MIN_SHOULDER_DROP / 2 && avgElbowAngle > 160) {
        isDown = false;
        reps += 1;
        onFeedback(`Rep ${reps} completed`);

        UTILS.storeProgress({
          userEmail,
          exerciseName: 'Push-ups',
          currentSet,
          totalSets,
          repsCompleted: reps,
          targetReps,
          timestamp: new Date().toISOString(),
        });

        if (reps >= targetReps || currentSet >= totalSets) {
          camera.stop();
          pose.close();
          onComplete({
            completed: true,
            reps,
            feedback: `Set ${currentSet} completed with ${reps} reps`,
            currentSet,
            totalSets
          });
          UTILS.syncProgress(userEmail);
        }
      }
    });

    return {
      stop: () => {
        camera.stop();
        pose.close();
      }
    };
  } catch (error) {
    console.error('Push-ups monitoring error:', error);
    onFeedback('Error starting push-ups monitoring');
    return { stop: () => {} };
  }
}