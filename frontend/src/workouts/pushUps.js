// State variables for push-up tracking
let isDown = false;
let lastRepCount = 0;

export const monitorPushUps = (results, { currentSetReps, targetRepsPerSet, totalReps, totalTargetReps }) => {
  if (!results.poseLandmarks) return { feedback: 'No person detected.' };

  // Key landmarks for push-up detection (MediaPipe Pose landmarks)
  const leftShoulder = results.poseLandmarks[11];
  const rightShoulder = results.poseLandmarks[12];
  const leftElbow = results.poseLandmarks[13];
  const rightElbow = results.poseLandmarks[14];
  const leftWrist = results.poseLandmarks[15];
  const rightWrist = results.poseLandmarks[16];

  if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist) {
    return { feedback: 'Please position yourself correctly in the frame.' };
  }

  // Calculate angles with the same logic as testpushups.html
  const calcAngle = (a, b, c) => {
    const ab = Math.hypot(b.x - a.x, b.y - a.y);
    const bc = Math.hypot(c.x - b.x, c.y - b.y);
    const ac = Math.hypot(c.x - a.x, c.y - a.y);
    const cosAngle = (ab**2 + bc**2 - ac**2) / (2 * ab * bc);
    // Clamp cosAngle to prevent NaN from Math.acos
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    return Math.acos(clampedCos) * (180 / Math.PI);
  };

  const leftAngle = calcAngle(leftShoulder, leftElbow, leftWrist);
  const rightAngle = calcAngle(rightShoulder, rightElbow, rightWrist);
  const avgElbowAngle = (leftAngle + rightAngle) / 2;

  // Thresholds from testpushups.html
  const ELBOW_BEND_THRESHOLD = 120; // Angle for full rep down position
  const PARTIAL_BEND_THRESHOLD = 145; // Angle for partial rep
  const EXTENDED_THRESHOLD = 160; // Angle for up position

  // State tracking
  let feedback = 'Starting push-ups...';
  let repCount = currentSetReps;
  let partialReps = 0;

  // Push-up detection logic from testpushups.html
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
    // Only increment if this is a new rep (prevent multiple counts)
    if (repCount === lastRepCount) {
      if (avgElbowAngle >= EXTENDED_THRESHOLD) {
        repCount++;
        lastRepCount = repCount;
        feedback = `Rep ${repCount} completed! ${repCount >= targetRepsPerSet ? 'Set complete!' : ''}`;
      } else {
        partialReps++;
        feedback = `Partial rep ${partialReps} - try to extend fully!`;
      }
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
    partialReps, // Optional: track partial reps if you want to display them
    avgElbowAngle: Math.round(avgElbowAngle), // For debugging
    isDown // For debugging
  };
};