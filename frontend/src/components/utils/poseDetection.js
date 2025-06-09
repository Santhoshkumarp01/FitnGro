export const calculateAngle = (a, b, c) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
};

export const getLandmarkPoint = (landmarks, index) => {
  const landmark = landmarks[index];
  return { x: landmark.x, y: landmark.y, z: landmark.z };
};

// Configuration for exercise detection
export const EXERCISE_CONFIG = {
  'high knees': {
    type: 'knee-lift',
    landmarks: {
      hip: { left: 23, right: 24 },
      knee: { left: 25, right: 26 },
      ankle: { left: 27, right: 28 },
    },
    states: { left: 'leftKneeState', right: 'rightKneeState' },
    initialStates: { leftKneeState: 'down', rightKneeState: 'down' },
    kneeHeightThreshold: -0.1,
    kneeUpAngleThreshold: 100,
    kneeDownAngle: 110,
    cooldownDuration: 500,
  },
  'burpees (no push-up)': {
      type: 'burpee',
      hipKneeAngleThreshold: 120,
      kneeExtensionAngle: 160,
      jumpHeightThreshold: 0.05,
      cooldownDuration: 1000,
      landmarks: {
          hip: { left: 23, right: 24 },
          knee: { left: 25, right: 26 },
          ankle: { left: 27, right: 28 }
      },
      state: 'burpeeState',
      stateSequence: ['standing', 'squatting', 'jumping', 'standing'],
      initialStates: { burpeeState: 'standing' }
  },
  'squats (holding chair for balance)': {
      type: 'squat',
      hipKneeAngleThreshold: 90,
      hipDepthThreshold: 0.1,
      kneeExtensionAngle: 160,
      cooldownDuration: 500,
      landmarks: {
          hip: { left: 23, right: 24 },
          knee: { left: 25, right: 26 },
          ankle: { left: 27, right: 28 }
      },
      state: 'squatState',
      stateSequence: ['up', 'down', 'up'],
      initialStates: { squatState: 'up' }
  }
};

// Function to remove emojis and special characters
const cleanExerciseName = (name) => {
  // Remove emojis (Unicode ranges for emojis) and trim extra spaces
  return name
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '') // Emojis in the main emoji block
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Miscellaneous symbols and pictographs
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental symbols and pictographs
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Miscellaneous symbols (e.g., ⏰)
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/\s+/g, ' ')                   // Replace multiple spaces with a single space
      .trim();                                // Remove leading/trailing spaces
};

// Validate exercise configuration
export const validateExerciseConfig = (exerciseName) => {
  // Clean the exercise name by removing emojis and special characters
  const cleanedName = cleanExerciseName(exerciseName);
  const normalizedName = cleanedName.toLowerCase();
  
  console.log(`[PoseDetection] Validating exercise: Original: ${exerciseName}, Cleaned: ${cleanedName}, Normalized: ${normalizedName}`);

  if (!EXERCISE_CONFIG[normalizedName]) {
      console.warn(`[PoseDetection] No configuration found for exercise: ${normalizedName}. Using default (High Knees).`);
      return EXERCISE_CONFIG['high knees'];
  }
  return EXERCISE_CONFIG[normalizedName];
};