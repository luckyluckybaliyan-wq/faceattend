const $ = s => document.querySelector(s);
const MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
let students = [], matcher = null, ready = false, stream = null, timer = null;
const marked = new Set();

function go(t) {
  document.querySelectorAll(".tab").forEach(e => e.classList.toggle("active", e.id === t));
  document.querySelectorAll(".links a").forEach(e => e.classList.toggle("active", e.dataset.tab === t));
  stopScan();
  if (t === "dashboard") loadStats();
  if (t === "records") loadRecords();
  if (t === "register") { loadStudents(); startCam("#video2"); }
  if (t === "scan") startScan();
}
document.querySelectorAll(".links a").forEach(a => a.onclick = () => go(a.dataset.tab));

async function api(url, opt) { const r = await fetch(url, opt); return r.json(); }
const post = (u, b) => api(u, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(b)});

async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS);
  ready = true;
}
const modelsP = loadModels();

async function startCam(sel) {
  stopCam();
  stream = await navigator.mediaDevices.getUserMedia({video: {width: 640, height: 480}});
  $(sel).srcObject = stream;
}
function stopCam() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
function stopScan() { clearInterval(timer); stopCam(); }

async function loadStudents() {
  students = await api("/api/students");
  $("#stuList").innerHTML = students.map(s =>
    `<li><span>${s.name} (${s.roll})</span><button onclick="del(${s.id})">✕</button></li>`).join("") || "<li>No students yet</li>";
  matcher = students.length ? new faceapi.FaceMatcher(students.map(s =>
    new faceapi.LabeledFaceDescriptors(String(s.id), [new Float32Array(s.descriptor)])), 0.5) : null;
}
async function del(id) { if (confirm("Delete student?")) { await api("/api/students/" + id, {method: "DELETE"}); loadStudents(); } }

$("#capBtn").onclick = async () => {
  const msg = $("#rMsg");
  const name = $("#rName").value.trim(), roll = $("#rRoll").value.trim();
  if (!name || !roll) return msg.textContent = "Enter name and roll number.";
  msg.textContent = "Detecting face…"; await modelsP;
  const det = await faceapi.detectSingleFace($("#video2"), new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
  if (!det) return msg.textContent = "No face found. Look straight at the camera.";
  const r = await post("/api/students", {name, roll, dept: $("#rDept").value, descriptor: Array.from(det.descriptor)});
  msg.textContent = r.error || "✅ Student registered!";
  if (!r.error) { $("#rName").value = $("#rRoll").value = $("#rDept").value = ""; loadStudents(); }
};

async function startScan() {
  const st = $("#status"); st.textContent = "Loading AI models…";
  await modelsP; await loadStudents();
  if (!matcher) { st.textContent = "No students registered yet."; return; }
  await startCam("#video");
  const v = $("#video"), c = $("#overlay");
  st.textContent = "Scanning…";
  timer = setInterval(async () => {
    if (!v.videoWidth) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height);
    const dets = await faceapi.detectAllFaces(v, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
    for (const d of dets) {
      const m = matcher.findBestMatch(d.descriptor), b = d.detection.box;
      const s = students.find(x => String(x.id) === m.label);
      ctx.strokeStyle = s ? "#34d399" : "#f87171"; ctx.lineWidth = 3; ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.save(); ctx.scale(-1, 1); ctx.fillStyle = ctx.strokeStyle; ctx.font = "18px Poppins";
      ctx.fillText(s ? s.name : "Unknown", -(b.x + b.width), b.y - 8); ctx.restore();
      if (s && !marked.has(s.id)) {
        marked.add(s.id);
        const r = await post("/api/attendance", {student_id: s.id});
        $("#live").insertAdjacentHTML("afterbegin", `<li><span>${s.name}</span><span>${r.new ? "✅ Marked" : "Already marked"}</span></li>`);
      }
    }
  }, 700);
}

async function loadStats() {
  const s = await api("/api/stats");
  $("#sTotal").textContent = s.total; $("#sPresent").textContent = s.present; $("#sAbsent").textContent = s.absent;
  const max = Math.max(1, ...s.week.map(w => w.n));
  $("#chart").innerHTML = s.week.map(w => `<div class="bcol"><i style="height:${w.n / max * 150}px"></i>${w.n}<br>${w.day.slice(5)}</div>`).join("") || "No data yet";
}
async function loadRecords() {
  const d = $("#fDay").value, r = await api("/api/attendance" + (d ? "?day=" + d : ""));
  $("#rows").innerHTML = r.map(x => `<tr><td>${x.name}</td><td>${x.roll}</td><td>${x.dept || "-"}</td><td>${x.day}</td><td>${x.time}</td></tr>`).join("") || "<tr><td colspan=5>No records</td></tr>";
}
$("#fBtn").onclick = loadRecords;
