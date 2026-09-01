# Run HackSynth

**Project root:** this folder (`hacksynth-ui`).  
**You need:** Python 3.12+, Node.js 20+, Docker Desktop (for real command execution).

---

## 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GROQ_API_KEY=your_key_here
```

(Optional: `OPENAI_BASE_URL`, `OPENAI_MODEL` — defaults target Groq.)

Start the API (from `backend`, venv active):

```powershell
python main.py
```

Check: http://127.0.0.1:8000/health

---

## 2. Frontend

Open a **second** terminal at the **project root** (same folder as `package.json`):

```powershell
npm install
npm run dev
```

Open the URL shown (usually http://localhost:5173), then **Start Run**.

---

## 3. Docker sandbox (real commands)

From the **project root**:

```powershell
cd sandbox
docker build -t hacksynth-sandbox:latest .
```

If Docker is unavailable, set `USE_MOCK_EXECUTOR=true` in `backend/.env`.

---

## Docker Compose (full stack)

From the **project root**:

```powershell
docker compose build
docker compose up
```

- UI: http://localhost:8080  
- API: http://localhost:8000  

Set `GROQ_API_KEY` in Compose `environment` or an env file — do not commit keys.
