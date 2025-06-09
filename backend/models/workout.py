from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Workout(BaseModel):
    name: str
    sets: int
    reps: int
    type: str  # "reps" or "timing"

class DayPlan(BaseModel):
    day_number: int
    rest_day: bool
    completed: bool
    workouts: List[Workout]

class WorkoutPlan(BaseModel):
    user_email: str
    generated_date: datetime
    fitness_goal: str
    days: List[DayPlan]

class UserData(BaseModel):
    email: str
    age: int
    gender: str
    height: float
    weight: float
    fitness_goal: str
    experience_level: int  # 0=beginner, 1=intermediate, 2=advanced
    rest_days: List[str]  # ["Mon", "Wed"]