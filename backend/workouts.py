from typing import List
import random
import json
from pathlib import Path
import datetime

# ---------- EXERCISE DATA ----------
EXERCISES = {
    # General Fitness Exercises (12 core exercises for monitoring)
    0: ("Squats", "reps"),
    1: ("Lunges", "reps"),  # Includes forward and backward
    2: ("Jumping Jacks", "reps"),
    3: ("Push-ups", "reps"),
    4: ("Plank", "timing"),  # Static hold
    5: ("Mountain Climbers", "reps"),
    6: ("Burpees", "reps"),
    7: ("High Knees", "reps"),
    8: ("Side Lunges", "reps"),
    9: ("Glute Bridges", "reps"),
    10: ("Bicycle Crunches", "reps"),
    11: ("Russian Twists", "reps"),
}

WARMUP_EXERCISES = {
    0: ("Arm Circles", "timing"),
    1: ("Marching in Place", "timing"),
    2: ("Torso Twists", "reps"),
    3: ("Leg Swings", "reps"),
    4: ("Neck Rolls", "timing"),
}

COOLDOWN_EXERCISES = {
    0: ("Standing Quad Stretch", "timing"),
    1: ("Hamstring Stretch", "timing"),
    2: ("Shoulder Stretch", "timing"),
    3: ("Seated Spinal Twist", "timing"),
    4: ("Calf Stretch", "timing"),
}

# ---------- BASES ----------
BASE_REPS = {0: 10, 1: 15, 2: 20}  # Beginner, Intermediate, Advanced
BASE_TIMINGS = {0: 20, 1: 30, 2: 40}  # Seconds
WEEK_INCREMENTS = [0, 2, 4, 6]  # Incremental increases per week
MONTHLY_INCREMENT = 4
SETS = {
    0: {"reps": 10, "sets": 2},
    1: {"reps": 12, "sets": 3},
    2: {"reps": 15, "sets": 4}
}

# Mapping for experience levels to exercise IDs
GOAL_EXPERIENCE_MAPPING = {
    5: {  # General Fitness goal
        "beginner": [0, 1, 2, 3, 4, 9],  # Squats, Lunges, Jumping Jacks, Push-ups, Plank, Glute Bridges
        "intermediate": [0, 1, 5, 7, 8, 10, 11],  # Squats, Lunges, Mountain Climbers, High Knees, Side Lunges, Bicycle Crunches, Russian Twists
        "advanced": [0, 1, 6, 7, 8, 10, 11],  # Squats, Lunges, Burpees, High Knees, Side Lunges, Bicycle Crunches, Russian Twists
    }
}

def get_exercises_by_goal_and_experience(goal, exp):
    level = ["beginner", "intermediate", "advanced"][exp]
    return [EXERCISES[i] for i in GOAL_EXPERIENCE_MAPPING.get(goal, {}).get(level, [])]

def generate_workout(age, exp, activity, goal, week=None, month=1):
    """
    Generate a structured workout plan: warmup, main, and cooldown blocks.
    
    Args:
        age (int): Age of the user
        exp (int): Experience level (0: beginner, 1: intermediate, 2: advanced)
        activity (str): Activity level ("sedentary", "active", "highly_active")
        goal (int): Fitness goal index (5 for general fitness)
        week (int): Week number (1-4)
        month (int): Program month (default 1)
        
    Returns:
        Dict with warmup, main, and cooldown, each a list of formatted exercises
    """
    # Defaults
    week = week or 1

    # Base values
    base_reps = BASE_REPS[exp]
    base_timing = BASE_TIMINGS[exp]
    sets = SETS[exp]

    # Adjustments
    activity_adj = {"sedentary": -3, "active": 0, "highly_active": 3}[activity]
    age_factor = 0.8 if age >= 50 else 1.0

    # Scaled intensity
    reps = int((base_reps + (MONTHLY_INCREMENT * (month - 1) + WEEK_INCREMENTS[week - 1]) + activity_adj) * age_factor)
    timing = int((base_timing + (MONTHLY_INCREMENT * (month - 1) * 2 + WEEK_INCREMENTS[week - 1] * 2) + activity_adj * 2) * age_factor)

    # Select appropriate experience level range
    exp_level_str = ["beginner", "intermediate", "advanced"][exp]
    goal_exercises = GOAL_EXPERIENCE_MAPPING[goal][exp_level_str]

    # Warmup: 2 exercises
    warmup_ex = random.sample(list(WARMUP_EXERCISES.keys()), 2)
    warmup = [
        {
            "name": WARMUP_EXERCISES[ex][0],
            "sets": 1,
            "reps": 10 if WARMUP_EXERCISES[ex][1] == "reps" else 30,
            "type": WARMUP_EXERCISES[ex][1]
        }
        for ex in warmup_ex
    ]

    # Main workout: 4-6 exercises from goal
    main_ex = random.sample(goal_exercises, min(len(goal_exercises), random.randint(4, 6)))
    main = [
        {
            "name": EXERCISES[ex][0],
            "sets": sets["sets"],
            "reps": reps if EXERCISES[ex][1] == "reps" else timing,
            "type": EXERCISES[ex][1]
        }
        for ex in main_ex
    ]

    # Cooldown: 2 exercises
    cooldown_ex = random.sample(list(COOLDOWN_EXERCISES.keys()), 2)
    cooldown = [
        {
            "name": COOLDOWN_EXERCISES[ex][0],
            "sets": 1,
            "reps": 30,  # All cooldowns are timing-based
            "type": COOLDOWN_EXERCISES[ex][1]
        }
        for ex in cooldown_ex
    ]

    return {"warmup": warmup, "main": main, "cooldown": cooldown}

def generate_month_plan(age, exp, activity, goal, rest_days: List[str]):
    """
    Generate a month-long workout plan with rest days.
    
    Args:
        age (int): Age of the user
        exp (int): Experience level (0: beginner, 1: intermediate, 2: advanced)
        activity (str): Activity level ("sedentary", "active", "highly_active")
        goal (int): Fitness goal index (5 for general fitness)
        rest_days (List[str]): Days to rest (e.g., ["Sat", "Sun"])
        
    Returns:
        Dict with days, each containing day number, rest status, and workouts
    """
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    all_days = []
    day_counter = 1
    current_date = datetime.datetime.now()
    year = current_date.year
    month = current_date.month
    _, total_days_in_month = calendar.monthrange(year, month)

    for day in range(1, total_days_in_month + 1):
        week = (day - 1) // 7 + 1
        day_name = day_names[(day - 1) % 7]
        if day_name in rest_days:
            all_days.append({
                "day": day,
                "rest": True,
                "workouts": []
            })
        else:
            workout = generate_workout(age, exp, activity, goal, week, month)
            workouts = []
            workouts.extend(workout["warmup"])
            workouts.extend(workout["main"])
            workouts.extend(workout["cooldown"])
            all_days.append({
                "day": day,
                "rest": False,
                "workouts": workouts
            })
        day_counter += 1

    return {"days": all_days}

def save_response_to_json(data, filename='responses.json'):
    """
    Save workout plan to JSON for local storage.
    
    Args:
        data: Data to save
        filename: JSON file name (default: responses.json)
        
    Returns:
        bool: True if saved successfully, False otherwise
    """
    try:
        file_path = Path(filename).absolute()
        if not file_path.exists():
            with open(file_path, 'w') as f: json.dump([], f)
        with open(file_path, 'r') as f:
            existing_data = json.load(f)
        existing_data.append(data)
        with open(file_path, 'w') as f:
            json.dump(existing_data, f, indent=4)
        return True
    except Exception as e:
        print(f"Error saving JSON: {e}")
        return False