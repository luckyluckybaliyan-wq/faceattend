import sqlite3, csv, io, os, json
from datetime import date, datetime
from flask import Flask, request, jsonify, Response

app = Flask(__name__, static_folder="static", static_url_path="")
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "attendance.db")

def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def init():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS students(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            roll TEXT UNIQUE NOT NULL, dept TEXT, descriptor TEXT NOT NULL, created TEXT);
        CREATE TABLE IF NOT EXISTS attendance(
            id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL,
            day TEXT NOT NULL, time TEXT NOT NULL, UNIQUE(student_id, day));
        """)

@app.route("/")
def home():
    return app.send_static_file("index.html")

@app.get("/api/students")
def students():
    with db() as c:
        rows = c.execute("SELECT * FROM students ORDER BY name").fetchall()
    return jsonify([{**dict(r), "descriptor": json.loads(r["descriptor"])} for r in rows])

@app.post("/api/students")
def add_student():
    d = request.get_json(force=True)
    if not all([d.get("name"), d.get("roll"), d.get("descriptor")]):
        return jsonify(error="Name, roll and face are required"), 400
    try:
        with db() as c:
            c.execute("INSERT INTO students(name,roll,dept,descriptor,created) VALUES(?,?,?,?,?)",
                      (d["name"], d["roll"], d.get("dept", ""), json.dumps(d["descriptor"]),
                       datetime.now().isoformat(timespec="seconds")))
    except sqlite3.IntegrityError:
        return jsonify(error="Roll number already registered"), 409
    return jsonify(ok=True), 201

@app.delete("/api/students/<int:sid>")
def del_student(sid):
    with db() as c:
        c.execute("DELETE FROM attendance WHERE student_id=?", (sid,))
        c.execute("DELETE FROM students WHERE id=?", (sid,))
    return jsonify(ok=True)

@app.post("/api/attendance")
def mark():
    sid = request.get_json(force=True).get("student_id")
    now = datetime.now()
    try:
        with db() as c:
            c.execute("INSERT INTO attendance(student_id,day,time) VALUES(?,?,?)",
                      (sid, now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S")))
        return jsonify(ok=True, new=True)
    except sqlite3.IntegrityError:
        return jsonify(ok=True, new=False)

@app.get("/api/attendance")
def records():
    day = request.args.get("day")
    q = ("SELECT a.id,s.name,s.roll,s.dept,a.day,a.time FROM attendance a "
         "JOIN students s ON s.id=a.student_id")
    args = ()
    if day:
        q += " WHERE a.day=?"; args = (day,)
    q += " ORDER BY a.day DESC, a.time DESC"
    with db() as c:
        return jsonify([dict(r) for r in c.execute(q, args).fetchall()])

@app.get("/api/stats")
def stats():
    today = date.today().isoformat()
    with db() as c:
        total = c.execute("SELECT COUNT(*) FROM students").fetchone()[0]
        present = c.execute("SELECT COUNT(*) FROM attendance WHERE day=?", (today,)).fetchone()[0]
        week = c.execute("SELECT day, COUNT(*) n FROM attendance GROUP BY day ORDER BY day DESC LIMIT 7").fetchall()
    return jsonify(total=total, present=present, absent=max(total - present, 0),
                   week=[dict(r) for r in reversed(week)])

@app.get("/api/export")
def export():
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Name", "Roll", "Dept", "Date", "Time"])
    with db() as c:
        for r in c.execute("SELECT s.name,s.roll,s.dept,a.day,a.time FROM attendance a JOIN students s ON s.id=a.student_id ORDER BY a.day DESC"):
            w.writerow(list(r))
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=attendance.csv"})

if __name__ == "__main__":
    init()
    app.run(debug=True, port=5000)
