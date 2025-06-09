import time
import cv2
import mediapipe as mp
import numpy as np

# Pose setup
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=False, 
                   min_detection_confidence=0.7,
                   min_tracking_confidence=0.7)
mp_drawing = mp.solutions.drawing_utils

def calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
        
    return angle

# Frame-by-frame processing logic
pose_live = mp_pose.Pose(static_image_mode=False, 
                         min_detection_confidence=0.7,
                         min_tracking_confidence=0.7)

def give_feedback(message):
    print(f"FEEDBACK: {message}")
    return message  # Return for API use

def high_knee(webcam_index, sets, target_reps):
    total_reps = 0
    for current_set in range(1, sets + 1):
        rep_count = 0
        left_knee_state = "down"
        right_knee_state = "down"
        frame_count = 0
        cooldown_frames = 15
        last_rep_frame = -cooldown_frames
        left_knee_buffer = []
        right_knee_buffer = []
        smoothing_window = 3

        cap = cv2.VideoCapture(webcam_index)
        if not cap.isOpened():
            return {"completed": False, "reps": total_reps}

        while cap.isOpened() and rep_count < target_reps:
            ret, frame = cap.read()
            if not ret:
                break
            frame_count += 1
            frame = cv2.resize(frame, (800, 600))
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Left leg landmarks
                left_hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x, 
                           landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
                left_knee = [landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].x, 
                            landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y]
                left_ankle = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x, 
                             landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y]
                
                # Right leg landmarks
                right_hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, 
                            landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                right_knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, 
                             landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
                right_ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, 
                              landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]
                
                # Smooth knee positions
                left_knee_buffer.append(left_knee)
                if len(left_knee_buffer) > smoothing_window:
                    left_knee_buffer.pop(0)
                left_knee_smooth = np.mean(left_knee_buffer, axis=0)
                
                right_knee_buffer.append(right_knee)
                if len(right_knee_buffer) > smoothing_window:
                    right_knee_buffer.pop(0)
                right_knee_smooth = np.mean(right_knee_buffer, axis=0)
                
                # Calculate angles
                left_knee_angle = calculate_angle(left_hip, left_knee_smooth, left_ankle)
                right_knee_angle = calculate_angle(right_hip, right_knee_smooth, right_ankle)
                
                # Check if knees are high enough (distance threshold)
                knee_height_threshold = 0.04
                left_knee_high = abs(left_hip[1] - left_knee_smooth[1]) > knee_height_threshold
                right_knee_high = abs(right_hip[1] - right_knee_smooth[1]) > knee_height_threshold
                
                # Define angle thresholds
                knee_up_angle_threshold = 90
                knee_down_angle = 30
                
                # Left knee logic
                if left_knee_high and left_knee_angle > knee_up_angle_threshold and left_knee_state == "down":
                    left_knee_state = "up"
                elif left_knee_angle < knee_down_angle and left_knee_state == "up":
                    left_knee_state = "down"
                    if frame_count - last_rep_frame > cooldown_frames:
                        rep_count += 1
                        last_rep_frame = frame_count
                        give_feedback(f"High-knee {rep_count}")
                
                # Right knee logic
                if right_knee_high and right_knee_angle > knee_up_angle_threshold and right_knee_state == "down":
                    right_knee_state = "up"
                elif right_knee_angle < knee_down_angle and right_knee_state == "up":
                    right_knee_state = "down"
                    if frame_count - last_rep_frame > cooldown_frames:
                        rep_count += 1
                        last_rep_frame = frame_count
                        give_feedback(f"High-knee {rep_count}")

                mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                
                # Display info on frame
                cv2.putText(image, f"Set: {current_set}/{sets}", (10, 30), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(image, f"Reps: {rep_count}/{target_reps}", (10, 60), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            cv2.imshow("High-Knee Workout", image)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        total_reps += rep_count
        give_feedback(f"Set {current_set} complete. Reps: {rep_count}")
        
        # Add rest period between sets (except after last set)
        if current_set < sets:
            give_feedback(f"Resting for 20 seconds before next set...")
            time.sleep(20)
        
        cv2.destroyAllWindows()
    return {"completed": True, "reps": total_reps}

def process_high_knee_frame(frame, user_state=None):
    if user_state is None:
        user_state = {}
    
    # Initialize required state variables
    user_state.setdefault("left_knee_state", "down")
    user_state.setdefault("right_knee_state", "down")
    user_state.setdefault("rep", 0)
    user_state.setdefault("last_rep_time", time.time())
    user_state.setdefault("rest_start_time", None)
    user_state.setdefault("rest_completed", False)
    user_state.setdefault("set_completed", False)

    # Check if we're in rest period
    if user_state.get("set_completed", False):
        if user_state.get("rest_start_time") is None:
            user_state["rest_start_time"] = time.time()
            return {
                "repDetected": False,
                "feedback": "Set completed! Starting rest period.",
                "setCompleted": True,
                "restPeriod": True,
                "restTimeRemaining": 20,
                "shouldTurnOffCamera": True
            }
        else:
            rest_elapsed = time.time() - user_state["rest_start_time"]
            rest_remaining = max(0, 20 - rest_elapsed)
            
            if rest_remaining > 0:
                return {
                    "repDetected": False,
                    "feedback": f"Resting: {rest_remaining:.1f}s remaining",
                    "setCompleted": True,
                    "restPeriod": True,
                    "restTimeRemaining": rest_remaining,
                    "shouldTurnOffCamera": True
                }
            else:
                if not user_state.get("rest_completed", False):
                    user_state.update({
                        "rep": 0,
                        "left_knee_state": "down",
                        "right_knee_state": "down",
                        "last_rep_time": time.time(),
                        "rest_start_time": None,
                        "rest_completed": True,
                        "set_completed": False
                    })
                return {
                    "repDetected": False,
                    "feedback": "Rest completed! Start next set.",
                    "setCompleted": False,
                    "restPeriod": False,
                    "restTimeRemaining": 0,
                    "shouldTurnOffCamera": False
                }

    # Normal frame processing
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose_live.process(image)

    rep_detected = False
    feedback = "Keep going!"

    if results.pose_landmarks:
        print("[Pose] Landmarks detected ✅")
        landmarks = results.pose_landmarks.landmark

        try:
            left_hip_y = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y
            right_hip_y = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y
            left_knee_y = landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y
            right_knee_y = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y

            left_knee_height = left_hip_y - left_knee_y
            right_knee_height = right_hip_y - right_knee_y

            print(f"↕️ Heights | L-Knee: {left_knee_height:.3f}, R-Knee: {right_knee_height:.3f}")

            knee_height_threshold = 0.02
            current_time = time.time()
            time_since_last = current_time - user_state["last_rep_time"]
            cooldown_active = time_since_last < 0.5

            print(f"🕒 Cooldown: {cooldown_active}, Time Since Last Rep: {time_since_last:.2f}s")

            # Left knee logic
            if left_knee_height > knee_height_threshold and user_state["left_knee_state"] == "down":
                user_state["left_knee_state"] = "up"
                feedback = "Left knee up - good height!"
            elif left_knee_height < 0.01 and user_state["left_knee_state"] == "up":
                user_state["left_knee_state"] = "down"
                if not cooldown_active:
                    rep_detected = True
                    user_state["rep"] += 1
                    user_state["last_rep_time"] = current_time
                    feedback = f"High-knee rep {user_state['rep']} detected!"

            # Right knee logic
            if right_knee_height > knee_height_threshold and user_state["right_knee_state"] == "down":
                user_state["right_knee_state"] = "up"
                feedback = "Right knee up - good height!"
            elif right_knee_height < 0.01 and user_state["right_knee_state"] == "up":
                user_state["right_knee_state"] = "down"
                if not cooldown_active and not rep_detected:
                    rep_detected = True
                    user_state["rep"] += 1
                    user_state["last_rep_time"] = current_time
                    feedback = f"High-knee rep {user_state['rep']} detected!"

            if not rep_detected and left_knee_height < knee_height_threshold and right_knee_height < knee_height_threshold:
                feedback = "Lift your knees higher!"

        except (IndexError, AttributeError) as e:
            print(f"❌ Landmark error: {str(e)}")
            feedback = "Pose detection failed, adjust position."

    else:
        print("❌ No pose landmarks detected")
        feedback = "No pose detected."

    print(f"📊 repDetected: {rep_detected}, repCount: {user_state['rep']}, feedback: {feedback}")

    response = {
        "repDetected": rep_detected,
        "feedback": feedback,
        "state": user_state,
        "left_knee_height": left_knee_height if results.pose_landmarks else None,
        "right_knee_height": right_knee_height if results.pose_landmarks else None,
        "cooldown_active": cooldown_active if results.pose_landmarks else None,
        "time_since_last_rep": time_since_last,
        "left_knee_state": user_state["left_knee_state"],
        "right_knee_state": user_state["right_knee_state"],
        "setCompleted": False,
        "restPeriod": False,
        "restTimeRemaining": 0,
        "shouldTurnOffCamera": False
    }

    # Check if set is completed
    if user_state.get("rep", 0) >= user_state.get("target_reps", 10):
        user_state["set_completed"] = True
        response.update({
            "setCompleted": True,
            "feedback": "Set completed! Starting rest period.",
            "restPeriod": True,
            "restTimeRemaining": 20,
            "shouldTurnOffCamera": True
        })

    return response



def process_step_back_lunge_frame(frame, user_state=None):
    # Initialize user state
    if user_state is None:
        user_state = {}
    user_state.setdefault("left_lunge_state", "standing")
    user_state.setdefault("right_lunge_state", "standing")
    user_state.setdefault("rep", 0)
    user_state.setdefault("last_rep_time", time.time())
    user_state.setdefault("left_knee_buffer", [])
    user_state.setdefault("right_knee_buffer", [])
    user_state.setdefault("hip_buffer", [])
    user_state.setdefault("last_detection_time", time.time())
    user_state.setdefault("no_detection_count", 0)
    user_state.setdefault("previous_set", 0)  # Track the previous set number


    currentSet = user_state.get("currentSet", 1)
    if currentSet != user_state["previous_set"]:
        print(f"[Lunge] Set changed from {user_state['previous_set']} to {currentSet}. Resetting per-set state.")
        # user_state["rep"] = 0  # Removed
        user_state["last_rep_time"] = time.time()
        user_state["left_lunge_state"] = "standing"
        user_state["right_lunge_state"] = "standing"
        user_state["left_knee_buffer"] = []
        user_state["right_knee_buffer"] = []
        user_state["hip_buffer"] = []
        user_state["previous_set"] = currentSet

    # Validate states to prevent 'unknown'
    if user_state["left_lunge_state"] not in ["standing", "lunging"]:
        user_state["left_lunge_state"] = "standing"
    if user_state["right_lunge_state"] not in ["standing", "lunging"]:
        user_state["right_lunge_state"] = "standing"

    # Constants
    smoothing_window = 3  # Reduced to minimize smoothing impact
    knee_angle_threshold = 120  # Looser: front knee < 120°
    knee_height_threshold = 0.01  # Looser: back knee-hip height
    hysteresis_angle = 125  # Looser: front knee > 125° for standing
    cooldown_duration = 0.1
    max_no_detection_duration = 3.0  # More lenient reset

    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose_live.process(image)

    rep_detected = False
    feedback = ""
    left_knee_height = 0.0
    right_knee_height = 0.0
    left_knee_angle = 180.0
    right_knee_angle = 180.0
    cooldown_active = False
    time_since_last = time.time() - user_state["last_rep_time"]
    avg_hip_y = 0.0
    smooth_left_knee_y = 0.0
    smooth_right_knee_y = 0.0

    if not results.pose_landmarks:
        user_state["no_detection_count"] += 1
        if time.time() - user_state["last_detection_time"] > max_no_detection_duration:
            user_state["left_lunge_state"] = "standing"
            user_state["right_lunge_state"] = "standing"
            feedback = "No pose detected. Move closer to the camera."
        else:
            feedback = "No pose detected. Stay in frame."
        # Reps: {user_state['rep']},
        print(f"[Lunge]  Detected: {rep_detected}, Feedback: {feedback}")
        print(f"[DEBUG] Left knee angle: {left_knee_angle:.1f}, Right knee angle: {right_knee_angle:.1f}")
        print(f"[DEBUG] Left knee height: {left_knee_height:.3f}, Right knee height: {right_knee_height:.3f}")
        return {
            "repDetected": rep_detected,
            "feedback": feedback,
            "state": user_state,
            "left_knee_height": left_knee_height,
            "right_knee_height": right_knee_height,
            "cooldown_active": cooldown_active,
            "time_since_last_rep": time_since_last,
            "left_lunge_state": user_state["left_lunge_state"],
            "right_lunge_state": user_state["right_lunge_state"]
        }

    user_state["no_detection_count"] = 0
    user_state["last_detection_time"] = time.time()
    landmarks = results.pose_landmarks.landmark

    # Extract positions
    left_hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x, 
                landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
    right_hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, 
                 landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
    left_knee = [landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].x, 
                 landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y]
    right_knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, 
                  landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
    left_ankle = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x, 
                  landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y]
    right_ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, 
                   landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]

    # Smooth positions
    user_state["hip_buffer"].append((left_hip[1] + right_hip[1]) / 2)
    user_state["left_knee_buffer"].append(left_knee[1])
    user_state["right_knee_buffer"].append(right_knee[1])

    if len(user_state["hip_buffer"]) > smoothing_window:
        user_state["hip_buffer"].pop(0)
        user_state["left_knee_buffer"].pop(0)
        user_state["right_knee_buffer"].pop(0)

    # Use simple mean if buffer underfilled
    if len(user_state["hip_buffer"]) < smoothing_window:
        avg_hip_y = np.mean(user_state["hip_buffer"]) if user_state["hip_buffer"] else 0.0
        smooth_left_knee_y = np.mean(user_state["left_knee_buffer"]) if user_state["left_knee_buffer"] else left_knee[1]
        smooth_right_knee_y = np.mean(user_state["right_knee_buffer"]) if user_state["right_knee_buffer"] else right_knee[1]
    else:
        weights = np.linspace(0.5, 1.0, len(user_state["hip_buffer"]))
        weights /= weights.sum()
        avg_hip_y = np.average(user_state["hip_buffer"], weights=weights)
        smooth_left_knee_y = np.average(user_state["left_knee_buffer"], weights=weights)
        smooth_right_knee_y = np.average(user_state["right_knee_buffer"], weights=weights)

    # Calculate heights
    left_knee_height = max(0, avg_hip_y - smooth_left_knee_y)
    right_knee_height = max(0, avg_hip_y - smooth_right_knee_y)

    # Calculate knee angles
    left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
    right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)

    current_time = time.time()
    time_since_last = current_time - user_state["last_rep_time"]
    cooldown_active = time_since_last < cooldown_duration

    # Left leg lunge (right leg forward)
    if (right_knee_angle < knee_angle_threshold and user_state["left_lunge_state"] == "standing"):
        user_state["left_lunge_state"] = "lunging"
        feedback = "Left leg lunge - good depth!"
    elif (right_knee_angle > hysteresis_angle and 
          left_knee_height < knee_height_threshold / 2 and 
          user_state["left_lunge_state"] == "lunging"):
        user_state["left_lunge_state"] = "standing"
        if not cooldown_active:
            rep_detected = True
            user_state["rep"] += 1
            user_state["last_rep_time"] = current_time
            feedback = f"Lunge rep {user_state['rep']}!"

    # Right leg lunge (left leg forward) - only if left didn't trigger
    if not rep_detected:
        if (left_knee_angle < knee_angle_threshold and user_state["right_lunge_state"] == "standing"):
            user_state["right_lunge_state"] = "lunging"
            feedback = "Right leg lunge - good depth!"
        elif (left_knee_angle > hysteresis_angle and 
              right_knee_height < knee_height_threshold / 2 and 
              user_state["right_lunge_state"] == "lunging"):
            user_state["right_lunge_state"] = "standing"
            if not cooldown_active:
                rep_detected = True
                user_state["rep"] += 1
                user_state["last_rep_time"] = current_time
                feedback = f"Lunge rep {user_state['rep']}!"

    if not feedback:
        if left_knee_angle > knee_angle_threshold and right_knee_angle > knee_angle_threshold:
            if min(left_knee_angle, right_knee_angle) < knee_angle_threshold + 10:
                feedback = "Almost there! Bend your front knee a bit more!"
            else:
                feedback = "Bend your front knee more!"
        else:
            feedback = "Lower your back knee!"

    print(f"[Lunge] Reps: {user_state['rep']}, Detected: {rep_detected}, Feedback: {feedback}")
    print(f"[DEBUG] Left knee angle: {left_knee_angle:.1f}, Right knee angle: {right_knee_angle:.1f}")
    print(f"[DEBUG] Left knee height: {left_knee_height:.3f}, Right knee height: {right_knee_height:.3f}")
    print(f"[DEBUG] Hip Y: {avg_hip_y:.3f}, Left knee Y: {smooth_left_knee_y:.3f}, Right knee Y: {smooth_right_knee_y:.3f}")

    return {
        "repDetected": rep_detected,
        "feedback": feedback or "Keep going!",
        "state": user_state,
        "left_knee_height": left_knee_height,
        "right_knee_height": right_knee_height,
        "cooldown_active": cooldown_active,
        "time_since_last_rep": time_since_last,
        "left_lunge_state": user_state["left_lunge_state"],
        "right_lunge_state": user_state["right_lunge_state"]
    }

def step_back_lunge(webcam_index, sets, target_reps):
    total_reps = 0
    for current_set in range(1, sets + 1):
        rep_count = 0
        left_lunge_state = "standing"
        right_lunge_state = "standing"
        left_knee_buffer = []
        right_knee_buffer = []
        hip_buffer = []
        smoothing_window = 3
        cooldown_duration = 0.1
        last_rep_time = time.time() - cooldown_duration
        last_detection_time = time.time()
        no_detection_count = 0
        max_no_detection_duration = 3.0

        cap = cv2.VideoCapture(webcam_index)
        if not cap.isOpened():
            return {"completed": False, "reps": total_reps}

        while cap.isOpened() and rep_count < target_reps:
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.resize(frame, (800, 600))
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                last_detection_time = time.time()
                no_detection_count = 0

                # Extract positions
                left_hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x, 
                           landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
                right_hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, 
                            landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                left_knee = [landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].x, 
                            landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y]
                right_knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, 
                             landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
                left_ankle = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x, 
                             landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y]
                right_ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, 
                              landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]

                # Smooth positions
                hip_buffer.append((left_hip[1] + right_hip[1]) / 2)
                left_knee_buffer.append(left_knee[1])
                right_knee_buffer.append(right_knee[1])

                if len(hip_buffer) > smoothing_window:
                    hip_buffer.pop(0)
                    left_knee_buffer.pop(0)
                    right_knee_buffer.pop(0)

                if len(hip_buffer) < smoothing_window:
                    avg_hip_y = np.mean(hip_buffer) if hip_buffer else left_hip[1]
                    smooth_left_knee_y = np.mean(left_knee_buffer) if left_knee_buffer else left_knee[1]
                    smooth_right_knee_y = np.mean(right_knee_buffer) if right_knee_buffer else right_knee[1]
                else:
                    weights = np.linspace(0.5, 1.0, len(hip_buffer))
                    weights /= weights.sum()
                    avg_hip_y = np.average(hip_buffer, weights=weights)
                    smooth_left_knee_y = np.average(left_knee_buffer, weights=weights)
                    smooth_right_knee_y = np.average(right_knee_buffer, weights=weights)

                # Calculate heights
                left_knee_height = max(0, avg_hip_y - smooth_left_knee_y)
                right_knee_height = max(0, avg_hip_y - smooth_right_knee_y)

                # Calculate knee angles
                left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
                right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)

                # Left leg lunge (right leg forward)
                if (right_knee_angle < 120 and left_lunge_state == "standing"):
                    left_lunge_state = "lunging"
                    give_feedback("Left leg lunge - good depth!")
                elif (right_knee_angle > 125 and 
                      left_knee_height < 0.005 and 
                      left_lunge_state == "lunging"):
                    left_lunge_state = "standing"
                    if time.time() - last_rep_time > cooldown_duration:
                        rep_count += 1
                        last_rep_time = time.time()
                        give_feedback(f"Lunge rep {rep_count}")

                # Right leg lunge (left leg forward)
                if (left_knee_angle < 120 and right_lunge_state == "standing"):
                    right_lunge_state = "lunging"
                    give_feedback("Right leg lunge - good depth!")
                elif (left_knee_angle > 125 and 
                      right_knee_height < 0.005 and 
                      right_lunge_state == "lunging"):
                    right_lunge_state = "standing"
                    if time.time() - last_rep_time > cooldown_duration:
                        rep_count += 1
                        last_rep_time = time.time()
                        give_feedback(f"Lunge rep {rep_count}")

                mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                cv2.putText(image, f"Set: {current_set}/{sets}", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(image, f"Reps: {rep_count}/{target_reps}", (10, 60), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            else:
                no_detection_count += 1
                if time.time() - last_detection_time > max_no_detection_duration:
                    left_lunge_state = "standing"
                    right_lunge_state = "standing"
                    give_feedback("No pose detected. Move closer to the camera.")
                else:
                    give_feedback("No pose detected. Stay in frame.")
                cv2.putText(image, "No pose detected", (10, 90), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            cv2.imshow("Step-Back Lunge Workout", image)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        total_reps += rep_count
        give_feedback(f"Set {current_set} complete. Reps: {rep_count}")
        cv2.destroyAllWindows()
    return {"completed": True, "reps": total_reps}