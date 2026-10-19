# FaceAttend – Face Recognition Attendance System

A full-stack website that marks attendance automatically using face recognition.

## Tech Stack
- **Backend:** Python, Flask, SQLite (REST API)
- **Frontend:** HTML, CSS (glassmorphism), JavaScript
- **AI:** face-api.js (128-D face descriptors, runs in the browser)

## Features
- Register students with webcam (name, roll, department)
- Live multi-face scanning with auto attendance (one entry per student per day)
- Dashboard with totals and 7-day chart
- Records page with date filter and CSV export

## Folder Structure
```
FaceAttend/
├── app.py              # Flask backend + API
├── requirements.txt
├── attendance.db       # created automatically
└── static/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## How to Run
1. Install Python 3.9+
2. `pip install -r requirements.txt`
3. `python app.py`
4. Open **http://localhost:5000** in Chrome and allow camera access.

> Internet is needed on first load (face-api.js and its models load from a CDN). Camera works on `localhost` or HTTPS only.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | /api/students | List / register student |
| DELETE | /api/students/<id> | Remove student |
| POST | /api/attendance | Mark attendance |
| GET | /api/attendance?day=YYYY-MM-DD | Records |
| GET | /api/stats | Dashboard data |
| GET | /api/export | CSV download |

## Usage
Register → Scan → check Dashboard / Records.
