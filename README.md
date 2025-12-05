

# ⭐ **README.md for FitnGro (Showcase Version)**

```markdown
# FitnGro – AI-Powered Fitness Tracking Platform

FitnGro is an AI-driven fitness platform that provides **real-time posture detection, repetition counting, live feedback**, and **trainer–user interaction**.  
The system combines **Computer Vision (OpenPose)**, **FastAPI backend**, and a **React + Firebase frontend** to deliver seamless fitness monitoring without requiring any external hardware.
## 🌐 Live Website
🔗 **https://fitngro.com**
---

## 🚀 Features

### 🎯 Real-Time Exercise Tracking
- Detects human joints using OpenPose
- Calculates joint angles
- Counts repetitions automatically
- Identifies incorrect posture and alerts the user

### 🤖 AI & Computer Vision
- Pose estimation pipeline
- Custom angle-based classification
- Real-time feedback generation

### 🌐 Scalable System Architecture
- **Frontend:** React, Firebase Hosting  
- **Backend:** FastAPI, Python  
- **Database:** Firebase Firestore  
- **Model Processing:** OpenPose (cloud or local execution)

### 👥 Trainer–User Interaction
- Users can connect with trainers/dietitians
- Trainers view progress reports and feedback summaries

### 🏆 Achievements
- Received **$1000 support from Microsoft**  
- Winner – **Smart Innovators Hackathon 2024**  
- Runner-Up – **Smart India Hackathon 2025**  
- Selected for multiple innovation showcases

---

## 📁 Project Structure

```

FitnGro/
│
├── frontend/                 # React + Firebase frontend
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/                  # FastAPI backend APIs
│   ├── main.py               # API entrypoint
│   ├── routers/
│   ├── services/
│   ├── models/
│   └── requirements.txt
│
├── pose_estimation/          # OpenPose processing scripts (optional)
│   ├── angle_calculation.py
│   ├── rep_counter.py
│   ├── feedback_engine.py
│   └── utilities/
│
└── README.md

```

---

## 🧩 System Architecture

```

User Camera → React Frontend → FastAPI Backend → Pose Estimation (OpenPose)
→ Feedback + Repetition Count → Firebase → User Dashboard

````

---

## 🛠️ Tech Stack

**Frontend**
- React.js
- Firebase Authentication
- Firebase Firestore
- Firebase Hosting

**Backend**
- FastAPI (Python)
- OpenPose (Pose Estimation)
- Uvicorn Server

**Other**
- REST APIs
- Cloud deployment support
- Modular architecture for mobile app integration

---

## ▶️ Running the Project

### 🔹 1. Clone the repository
```bash
git clone https://github.com/your-username/fitngro.git
cd fitngro
````

### 🔹 2. Setup Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 🔹 3. Setup Frontend (React)

```bash
cd frontend
npm install
npm start
```

### 🔹 4. Access the app

Frontend → `http://localhost:3000`
Backend → `http://localhost:8000`

---

## 🎥 Demo Links (Add when available)

* **Live Demo:** *Coming soon*
* **Detailed Architecture Document:** *Coming soon*
* **Screenshots / Preview:** *Coming soon*

---

## 🤝 Contributing

FitnGro is a research-driven, innovation-focused project.
Feel free to fork the repository or submit improvements via pull requests.

---

## 📬 Contact

**Santhoshkumar P**
Creator – FitnGro
Email: [santhoshpalanisamy292@gmail.com](mailto:santhoshpalanisamy292@gmail.com)
LinkedIn: [https://www.linkedin.com/in/santhoshkumarps1](https://www.linkedin.com/in/santhoshkumarps1)

