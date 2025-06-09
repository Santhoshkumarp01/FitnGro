from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
import re

# Import from workouts.py
from workouts import EXERCISES, generate_month_plan

# FastAPI App Initialization
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://fitngro.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Firebase Initialization
if not firebase_admin._apps:
    firebase_creds = os.getenv("FIREBASE_CREDENTIALS")
    if firebase_creds:
        cred_dict = json.loads(firebase_creds)
        cred = credentials.Certificate(cred_dict)
    else:
        # Fallback for local development (update path as needed)
        cred = credentials.Certificate(r"C:\Users\Santhosh kumar P\OneDrive\Desktop\FitnGro - Trail\FitnGro-Integr\backend\fitngro-dda45-firebase-adminsdk-fbsvc-0af755b9c5.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Pydantic Models
class ExerciseRequest(BaseModel):
    email: str
    exercise_name: str

class WorkoutRequest(BaseModel):
    userEmail: str

class TrackExerciseRequest(BaseModel):
    userEmail: str
    exerciseName: str
    currentSet: int
    totalSets: int
    targetReps: int
    currentReps: int  # Client sends detected reps

# Normalize Exercise Name
def normalize_exercise_name(name: str) -> str:
    cleaned = re.sub(r"[^\w\s\(\)-]", "", name)
    return cleaned.strip().lower().replace(" ", "-")

# Workout Function Mappings (Placeholders for JS Monitoring)
WORKOUT_FUNCTIONS = {
    normalize_exercise_name("Squats"): None,
    normalize_exercise_name("Lunges"): None,
    normalize_exercise_name("Jumping Jacks"): None,
    normalize_exercise_name("Push-ups"): None,
    normalize_exercise_name("Plank"): None,
    normalize_exercise_name("Mountain Climbers"): None,
    normalize_exercise_name("Burpees"): None,
    normalize_exercise_name("High Knees"): None,
    normalize_exercise_name("Side Lunges"): None,
    normalize_exercise_name("Glute Bridges"): None,
    normalize_exercise_name("Bicycle Crunches"): None,
    normalize_exercise_name("Russian Twists"): None,
}

# Helper Functions
def get_today_workouts(user_email: str):
    """
    Fetch today's workouts from Firestore.
    
    Args:
        user_email (str): User's email
        
    Returns:
        List of workouts or empty list if none found
    """
    try:
        doc_ref = db.collection("workout_plans").document(user_email)
        doc = doc_ref.get()
        if not doc.exists:
            print(f"[!] No workout plan found for: {user_email}")
            return []

        user_data = doc.to_dict()
        today = datetime.now().day
        for day in user_data.get("days", []):
            if day["day"] == today and not day["rest"]:
                return day["workouts"]
        print(f"[i] No workouts scheduled for today (Day {today}) or it's a rest day.")
        return []
    except Exception as e:
        print(f"[!] Error fetching workouts: {e}")
        return []

def get_user_exercise_plan(email: str, exercise_name: str):
    """
    Fetch specific exercise plan for user.
    
    Args:
        email (str): User's email
        exercise_name (str): Name of exercise
        
    Returns:
        Dict with exercise details or error
    """
    workouts = get_today_workouts(email)
    normalized_exercise = normalize_exercise_name(exercise_name)
    for workout in workouts:
        if normalize_exercise_name(workout["name"]) == normalized_exercise:
            return workout
    return {"error": f"{exercise_name} not found for {email}"}

def prepare_workout_response(workouts):
    """
    Structure workouts into warmup, main, and cooldown for client.
    
    Args:
        workouts (list): List of workout dicts
        
    Returns:
        Dict with categorized workouts
    """
    response = {"warmup": [], "main": [], "cooldown": []}
    for workout in workouts:
        name = workout["name"]
        normalized_name = normalize_exercise_name(name)
        if normalized_name in [normalize_exercise_name(ex[0]) for ex in WARMUP_EXERCISES.values()]:
            response["warmup"].append(workout)
        elif normalized_name in [normalize_exercise_name(ex[0]) for ex in COOLDOWN_EXERCISES.values()]:
            response["cooldown"].append(workout)
        else:
            response["main"].append(workout)
    return response

# API Routes
@app.post("/get-exercise-plan")
async def get_exercise_plan(request: ExerciseRequest):
    """
    Get specific exercise plan for user.
    
    Args:
        request (ExerciseRequest): Email and exercise name
        
    Returns:
        Dict with exercise details
    """
    if not request.email or not request.exercise_name:
        raise HTTPException(status_code=400, detail="Missing email or exercise_name")
    plan = get_user_exercise_plan(request.email, request.exercise_name)
    if "error" in plan:
        raise HTTPException(status_code=404, detail=plan["error"])
    return plan

@app.post("/start-workout")
async def start_workout(request: WorkoutRequest):
    """
    Start user's workout by fetching today's plan.
    
    Args:
        request (WorkoutRequest): User email
        
    Returns:
        Dict with structured workout plan
    """
    if not request.userEmail:
        raise HTTPException(status_code=400, detail="Missing user email")
    workouts = get_today_workouts(request.userEmail)
    if not workouts:
        raise HTTPException(status_code=404, detail="No workouts scheduled for today")
    return {
        "message": f"Workout started for {request.userEmail}",
        "workout_plan": prepare_workout_response(workouts)
    }

@app.post("/track-exercise")
async def track_exercise(request: TrackExerciseRequest):
    """
    Track exercise progress and store in Firestore.
    
    Args:
        request (TrackExerciseRequest): Exercise details from client
        
    Returns:
        Dict with tracking results
    """
    try:
        user_ref = db.collection('users').document(request.userEmail)
        if not user_ref.get().exists:
            raise HTTPException(status_code=404, detail="User not found")

        exercise_key = normalize_exercise_name(request.exerciseName)
        if exercise_key not in WORKOUT_FUNCTIONS:
            raise HTTPException(status_code=400, detail="Exercise not supported")

        # Store progress in Firestore
        workout_ref = db.collection('workout_progress').document()
        workout_ref.set({
            'userEmail': request.userEmail,
            'exerciseName': request.exerciseName,
            'setsCompleted': request.currentSet,
            'totalSets': request.totalSets,
            'repsCompleted': request.currentReps,
            'targetReps': request.targetReps,
            'timestamp': firestore.SERVER_TIMESTAMP
        })

        completed = request.currentReps >= request.targetReps or request.currentSet >= request.totalSets

        return {
            "completed": completed,
            "reps": request.currentReps,
            "feedback": f"Set {request.currentSet} logged with {request.currentReps} reps",
            "currentSet": request.currentSet,
            "totalSets": request.totalSets
        }
    except Exception as e:
        print(f"[TrackExercise] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))