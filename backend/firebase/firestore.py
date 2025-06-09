from firebase_admin import firestore
from models.workout import WorkoutPlan

def save_workout_plan(plan: WorkoutPlan):
    db = firestore.client()
    plan_ref = db.collection("workout_plans").document(plan.user_email)
    plan_ref.set(plan.dict())

def get_workout_plan(email: str) -> WorkoutPlan:
    doc = firestore.client() \
        .collection("workout_plans") \
        .document(email) \
        .get()
    
    if not doc.exists:
        return None
        
    return WorkoutPlan(**doc.to_dict())