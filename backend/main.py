# backend/main.py
from typing import Dict, List
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import calendar
import re
import firebase_admin
from firebase_admin import credentials, firestore, auth
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from workouts import generate_month_plan, EXERCISES, WARMUP_EXERCISES, COOLDOWN_EXERCISES
from workout_calls import normalize_exercise_name, get_today_workouts

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://fitngro.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not firebase_admin._apps:
    firebase_creds = os.getenv("FIREBASE_CREDENTIALS")
    if firebase_creds:
        cred_dict = json.loads(firebase_creds)
        cred = credentials.Certificate(cred_dict)
    else:
        cred = credentials.Certificate(r"C:\Users\RANJITH R\Desktop\New folder (8)\FitnGro---Production\backend\fitngro-dda45-firebase-adminsdk-fbsvc-0af755b9c5.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

class ExerciseRequest(BaseModel):
    userEmail: str
    exerciseName: str
    targetReps: int
    currentSet: int
    totalSets: int

class WorkoutRequest(BaseModel):
    userEmail: str

class PlanRequest(BaseModel):
    user_email: str
    days: int
    focus: str

class ExpertSignupRequest(BaseModel):
    user_email: str
    name: str
    age: int
    specialist: str
    expertise: str
    client_fee: float
    certification_url: str
    bio: str

class CheckExpertRequest(BaseModel):
    user_email: str

class UpdatePlanRequest(BaseModel):
    user_email: str
    selected_workouts: Dict[str, List[dict]]

class TrackExerciseRequest(BaseModel):
    userEmail: str
    exerciseName: str
    currentSet: int
    totalSets: int
    targetReps: int
    currentReps: int

class ChatListRequest(BaseModel):
    expert_email: str

class CreateChatRequest(BaseModel):
    client_email: str
    expert_email: str

async def verify_firebase_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        print("No Bearer token found in Authorization header")
        return None
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        user_email = decoded_token.get("email")
        if user_email:
            premium_user_ref = db.collection("premiumUsers").document(user_email)
            premium_user_ref.set({
                "userEmail": user_email,
                "isPremium": True,
                "timestamp": firestore.SERVER_TIMESTAMP
            }, merge=True)
        return decoded_token
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None

def is_admin(token: dict):
    return token.get("email") in ["fitngro@gmail.com"]

@app.post("/signin")
async def signin(token: dict = Depends(verify_firebase_token)):
    if not token:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    user_email = token.get("email")
    if not user_email:
        raise HTTPException(status_code=400, detail="Email not found in token")
    try:
        premium_user_ref = db.collection("premiumUsers").document(user_email)
        premium_user_ref.set({
            "userEmail": user_email,
            "isPremium": True,
            "timestamp": firestore.SERVER_TIMESTAMP
        }, merge=True)
        return {"message": f"User {user_email} signed in and added to premiumUsers"}
    except Exception as e:
        print(f"Error in signin: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sign in: {str(e)}")

@app.post("/get-exercise-plan")
async def get_exercise_plan(request: ExerciseRequest):
    if not request.userEmail or not request.exerciseName:
        raise HTTPException(status_code=400, detail="Missing email or exercise_name")
    workouts = get_today_workouts(request.userEmail)
    normalized_exercise = normalize_exercise_name(request.exerciseName)
    for workout in workouts:
        if normalize_exercise_name(workout["name"]) == normalized_exercise:
            return workout
    raise HTTPException(status_code=404, detail=f"{request.exerciseName} not found for {request.userEmail}")

@app.get("/approved-experts")
async def get_approved_experts():
    try:
        experts_ref = db.collection("experts")
        experts = [doc.to_dict() for doc in experts_ref.stream()]
        return experts
    except Exception as e:
        print(f"Error fetching experts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/expert-signup")
async def expert_signup(
    user_email: str = Form(...),
    name: str = Form(...),
    age: int = Form(...),
    specialist: str = Form(...),
    expertise: str = Form(...),
    client_fee: float = Form(...),
    certification: UploadFile = File(...),
    bio: str = Form(...),
    token: dict = Depends(verify_firebase_token)
):
    try:
        if token and token.get("email") != user_email:
            raise HTTPException(status_code=403, detail="Unauthorized to register as this expert")
        expert_ref = db.collection("experts").document(user_email)
        expert_doc = expert_ref.get()
        if expert_doc.exists and expert_doc.to_dict().get("approved", False):
            raise HTTPException(status_code=400, detail="Expert already registered and approved")
        certificate_url = f"https://storage.example.com/certificates/{user_email}/{certification.filename}"
        expert_data = {
            "user_email": user_email,
            "name": name,
            "age": age,
            "specialist": specialist,
            "expertise": expertise,
            "client_fee": client_fee,
            "certification_url": certificate_url,
            "bio": bio,
            "approved": False,
            "timestamp": firestore.SERVER_TIMESTAMP
        }
        expert_ref.set(expert_data)
        return {"message": "Expert registration submitted successfully", "certificate_url": certificate_url}
    except Exception as e:
        print(f"Error in expert signup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to register expert: {str(e)}")

@app.post("/check-expert")
async def check_expert(request: CheckExpertRequest):
    try:
        expert_ref = db.collection("experts").document(request.user_email)
        expert_doc = expert_ref.get()
        if not expert_doc.exists:
            raise HTTPException(status_code=404, detail="Expert not found")
        expert_data = expert_doc.to_dict()
        if not expert_data.get("approved", False):
            raise HTTPException(status_code=403, detail="Expert not yet approved")
        return {"message": "Expert verified", "expert": expert_data}
    except Exception as e:
        print(f"Error checking expert: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/send-admin-email")
async def send_admin_email(email_data: dict):
    try:
        msg = MIMEText(email_data["body"])
        msg["Subject"] = email_data["subject"]
        msg["From"] = os.getenv("EMAIL_FROM")
        msg["To"] = email_data["to"]
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(os.getenv("EMAIL_FROM"), os.getenv("EMAIL_PASSWORD"))
            server.send_message(msg)
        return {"status": "success", "message": "Admin email sent"}
    except Exception as e:
        print(f"Failed to send admin email: {str(e)}")
        return {"status": "warning", "message": "Admin email failed, but registration completed"}

@app.post("/approve-expert")
async def approve_expert(
    user_email: str = Form(...),
    token: dict = Depends(verify_firebase_token)
):
    if not is_admin(token):
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        expert_ref = db.collection("experts").document(user_email)
        expert_ref.update({"approved": True})
        return {"message": "Expert approved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start-workout")
async def start_workout(request: WorkoutRequest):
    if not request.userEmail:
        raise HTTPException(status_code=400, detail="Missing user email")
    workouts = get_today_workouts(request.userEmail)
    if not workouts:
        raise HTTPException(status_code=404, detail="No workouts scheduled for today")
    response = {"warmup": [], "main": [], "cooldown": []}
    for workout in workouts:
        normalized_name = normalize_exercise_name(workout["name"])
        if normalized_name in [normalize_exercise_name(ex[0]) for ex in WARMUP_EXERCISES.values()]:
            response["warmup"].append(workout)
        elif normalized_name in [normalize_exercise_name(ex[0]) for ex in COOLDOWN_EXERCISES.values()]:
            response["cooldown"].append(workout)
        else:
            response["main"].append(workout)
    return {
        "message": f"Workout started for {request.userEmail}",
        "workout_plan": response
    }

@app.post("/track-exercise")
async def track_exercise(request: TrackExerciseRequest):
    try:
        user_ref = db.collection('users').document(request.userEmail)
        if not user_ref.get().exists:
            raise HTTPException(status_code=404, detail="User not found")
        exercise_key = normalize_exercise_name(request.exerciseName)
        if exercise_key not in [normalize_exercise_name(ex[0]) for ex in EXERCISES.values()]:
            raise HTTPException(status_code=400, detail="Exercise not supported")
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

@app.post("/generate-plan")
async def generate_plan(request: PlanRequest):
    try:
        user_ref = db.collection('users').document(request.user_email)
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
        user_data = user_doc.to_dict()
        EXPERIENCE_LEVEL_MAP = {"beginner": 0, "intermediate": 1, "advanced": 2}
        exp = EXPERIENCE_LEVEL_MAP.get(user_data.get("experience_level", "beginner"), 0)
        plan = generate_month_plan(
            age=int(user_data.get("age", 25)),
            exp=exp,
            activity=user_data.get("activity_level", "active"),
            goal=5,
            rest_days=user_data.get("rest_days", [])
        )
        valid_exercises = {normalize_exercise_name(ex[0]) for ex in EXERCISES.values()}
        valid_warmups = {normalize_exercise_name(ex[0]) for ex in WARMUP_EXERCISES.values()}
        valid_cooldowns = {normalize_exercise_name(ex[0]) for ex in COOLDOWN_EXERCISES.values()}
        for day in plan["days"]:
            if not day["rest"]:
                day["workouts"] = [w for w in day["workouts"] if normalize_exercise_name(w["name"]) in (valid_exercises | valid_warmups | valid_cooldowns)]
        db.collection('workout_plans').document(request.user_email).set(plan)
        return {
            "message": "Workout plan generated successfully",
            "plan": plan,
            "user_profile": user_data
        }
    except Exception as e:
        import traceback
        print("🚨 ERROR in /generate-plan:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate plan")

@app.get("/get-user-and-workouts")
async def get_user_and_workouts(user_email: str = Query(..., description="User email")):
    try:
        normalized_email = user_email.strip().lower()
        user_ref = db.collection('users').document(normalized_email)
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail=f"User '{normalized_email}' not found")
        user_data = user_doc.to_dict()
        workouts_list = [
            {"id": ex_id, "name": details[0], "type": details[1]}
            for ex_id, details in EXERCISES.items()
        ]
        return {
            "user_profile": user_data,
            "all_workouts": workouts_list
        }
    except Exception as e:
        print(f"🚨 ERROR in /get-user-and-workouts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user and workouts")

@app.get("/get-all-workouts")
async def get_all_workouts():
    try:
        workouts_list = [
            {"id": ex_id, "name": details[0], "type": details[1], "category": "main"}
            for ex_id, details in EXERCISES.items()
        ]
        warmup_list = [
            {"id": f"warmup_{ex_id}", "name": details[0], "type": details[1], "category": "warmup"}
            for ex_id, details in WARMUP_EXERCISES.items()
        ]
        cooldown_list = [
            {"id": f"cooldown_{ex_id}", "name": details[0], "type": details[1], "category": "cooldown"}
            for ex_id, details in COOLDOWN_EXERCISES.items()
        ]
        return {
            "workouts": workouts_list + warmup_list + cooldown_list
        }
    except Exception as e:
        print(f"🚨 ERROR in /get-all-workouts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workouts")

@app.post("/update-user-plan")
async def update_user_plan(request: UpdatePlanRequest):
    try:
        user_ref = db.collection('users').document(request.user_email)
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail=f"User {request.user_email} not found")
        current_date = datetime.now()
        year = current_date.year
        month = current_date.month
        _, total_days_in_month = calendar.monthrange(year, month)
        rest_days_in_month = []
        first_day_of_month = datetime(year, month, 1)
        default_rest_days = [2, 6]  # Wednesday (2) and Sunday (6)
        for day in range(1, total_days_in_month + 1):
            current_date = first_day_of_month + timedelta(days=day - 1)
            if current_date.weekday() in default_rest_days:
                rest_days_in_month.append(day)
        valid_exercises = {normalize_exercise_name(ex[0]) for ex in EXERCISES.values()}
        valid_warmups = {normalize_exercise_name(ex[0]) for ex in WARMUP_EXERCISES.values()}
        valid_cooldowns = {normalize_exercise_name(ex[0]) for ex in COOLDOWN_EXERCISES.values()}
        selected_workouts_dict = {}
        for day, workouts in request.selected_workouts.items():
            filtered_workouts = [
                w for w in workouts
                if normalize_exercise_name(w["name"]) in (valid_exercises | valid_warmups | valid_cooldowns)
            ]
            selected_workouts_dict[day] = filtered_workouts
        plan_ref = db.collection('workout_plans').document(request.user_email)
        existing_plan_doc = plan_ref.get()
        existing_plan = existing_plan_doc.to_dict() if existing_plan_doc.exists else {"days": []}
        existing_workouts_by_day = {f"day{day['day']}": day["workouts"] for day in existing_plan.get("days", [])}
        plan = {
            "days": [
                {
                    "day": i + 1,
                    "workouts": (
                        selected_workouts_dict.get(f"day{i+1}", [])
                        if selected_workouts_dict.get(f"day{i+1}") and len(selected_workouts_dict.get(f"day{i+1}", [])) > 0
                        else existing_workouts_by_day.get(f"day{i+1}", [])
                    ),
                    "rest": (i + 1) in rest_days_in_month
                }
                for i in range(total_days_in_month)
            ]
        }
        if not any(day["workouts"] for day in plan["days"] if not day["rest"]):
            raise HTTPException(status_code=400, detail="No valid workout days provided")
        db.collection('workout_plans').document(request.user_email).set(plan)
        return {"message": f"Plan updated successfully for {request.user_email}"}
    except Exception as e:
        print(f"🚨 ERROR in /update-user-plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user plan: {str(e)}")

@app.post("/create-workout-plan")
async def create_workout_plan(request: UpdatePlanRequest):
    try:
        user_ref = db.collection('users').document(request.user_email)
        user_doc = user_ref.get()
        current_date = datetime.now()
        year = current_date.year
        month = current_date.month
        _, total_days_in_month = calendar.monthrange(year, month)
        rest_days_in_month = []
        first_day_of_month = datetime(year, month, 1)
        default_rest_days = [2, 6]  # Wednesday (2) and Sunday (6)
        for day in range(1, total_days_in_month + 1):
            current_date = first_day_of_month + timedelta(days=day - 1)
            if current_date.weekday() in default_rest_days:
                rest_days_in_month.append(day)
        valid_exercises = {normalize_exercise_name(ex[0]) for ex in EXERCISES.values()}
        valid_warmups = {normalize_exercise_name(ex[0]) for ex in WARMUP_EXERCISES.values()}
        valid_cooldowns = {normalize_exercise_name(ex[0]) for ex in COOLDOWN_EXERCISES.values()}
        selected_workouts_dict = {}
        for day, workouts in request.selected_workouts.items():
            filtered_workouts = [
                w for w in workouts
                if normalize_exercise_name(w["name"]) in (valid_exercises | valid_warmups | valid_cooldowns)
            ]
            selected_workouts_dict[day] = filtered_workouts
        plan = {
            "days": [
                {
                    "day": i + 1,
                    "workouts": selected_workouts_dict.get(f"day{i+1}", []),
                    "rest": (i + 1) in rest_days_in_month
                }
                for i in range(total_days_in_month)
            ]
        }
        if not any(day["workouts"] for day in plan["days"] if not day["rest"]):
            raise HTTPException(status_code=400, detail="No valid workout days provided")
        db.collection('workout_plans').document(request.user_email).set(plan)
        return {"message": f"Workout plan created successfully for {request.user_email}"}
    except Exception as e:
        print(f"🚨 ERROR in /create-workout-plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create workout plan: {str(e)}")

@app.get("/get-plan/{user_email}")
async def get_plan(user_email: str, token: dict = Depends(verify_firebase_token)):
    if not token or token.get("email") != user_email:
        raise HTTPException(status_code=403, detail="Unauthorized to access this plan")
    try:
        doc_ref = db.collection('workout_plans').document(user_email)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Workout plan not found")
        plan = doc.to_dict()
        for day in plan.get("days", []):
            if not day["rest"]:
                workouts = {"warmup": [], "main": [], "cooldown": []}
                for workout in day["workouts"]:
                    normalized_name = normalize_exercise_name(workout["name"])
                    if normalized_name in [normalize_exercise_name(ex[0]) for ex in WARMUP_EXERCISES.values()]:
                        workouts["warmup"].append(workout)
                    elif normalized_name in [normalize_exercise_name(ex[0]) for ex in COOLDOWN_EXERCISES.values()]:
                        workouts["cooldown"].append(workout)
                    else:
                        workouts["main"].append(workout)
                day["workouts"] = workouts
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-chat-list")
async def get_chat_list(request: ChatListRequest):
    try:
        if not request.expert_email:
            raise HTTPException(status_code=400, detail="Missing expert email")
        chats_ref = db.collection("chats")
        chats_query = chats_ref.where("expertEmail", "==", request.expert_email)
        chats = [doc.to_dict() for doc in chats_query.stream()]
        if not chats:
            return {"message": "No chats found", "chats": []}
        chat_list = []
        for chat in chats:
            chat_id = chat.get("chatId", "")
            client_email = chat.get("clientEmail", "")
            messages_ref = db.collection("chats").document(chat_id).collection("messages")
            messages = [msg.to_dict() for msg in messages_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(1).stream()]
            last_message = messages[0] if messages else {"content": "No messages yet", "timestamp": None}
            chat_list.append({
                "chatId": chat_id,
                "clientEmail": client_email,
                "lastMessage": last_message["content"],
                "lastMessageTime": last_message["timestamp"]
            })
        return {"message": "Chat list retrieved", "chats": chat_list}
    except Exception as e:
        print(f"Error fetching chat list: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chat list: {str(e)}")

@app.post("/create-chat")
async def create_chat(request: CreateChatRequest):
    try:
        chat_id = f"chat_{request.client_email.replace('.', '_')}_{request.expert_email.replace('.', '_')}"
        chat_ref = db.collection("chats").document(chat_id)
        chat_doc = chat_ref.get()
        if chat_doc.exists:
            return {"message": "Chat already exists", "chatId": chat_id}
        chat_ref.set({
            "chatId": chat_id,
            "clientEmail": request.client_email,
            "expertEmail": request.expert_email,
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        return {"message": "Chat created successfully", "chatId": chat_id}
    except Exception as e:
        print(f"Error creating chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chat: {str(e)}")

@app.post("/report-device-metrics")
async def report_device_metrics(metrics: dict):
    try:
        db.collection('device_metrics').document().set({
            'userEmail': metrics.get('userEmail'),
            'resolution': metrics.get('resolution'),
            'frameRate': metrics.get('frameRate'),
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        return {"message": "Metrics recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)