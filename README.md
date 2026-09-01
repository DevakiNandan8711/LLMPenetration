# HackSynth

This folder (`hacksynth-ui`) is the **project root**.

## Project Structure

| Path | Role |
|------|------|
| `src/` | React + Vite frontend |
| `backend/` | FastAPI backend (planner, summarizer, executor, run-loop) |
| `sandbox/` | Docker image used by backend for command execution |
| `docker-compose.yml` | Runs UI + API + sandbox services |

---

## 1) Install Prerequisites (Windows)

### A. Install Python
- Install Python 3.12+ from [python.org](https://www.python.org/downloads/windows/)
- During install, check **Add Python to PATH**

### B. Install Node.js
- Install Node.js 20+ from [nodejs.org](https://nodejs.org/)
- Verify:

```powershell
node -v
npm -v
```

### C. Install Docker Desktop
1. Download Docker Desktop: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Install and restart if prompted
3. Open Docker Desktop and wait until status shows Docker is running
4. Verify:

```powershell
docker --version
docker compose version
```

---

## 2) Configure Backend Environment

Open terminal at this folder (`hacksynth-ui`) and run:

```powershell
cd backend
copy .env.example .env
```

Edit `backend/.env` and set at least:

```env
GROQ_API_KEY=your_real_groq_key
DEMO_MODE=false
```

Optional defaults already point to Groq:
- `OPENAI_BASE_URL=https://api.groq.com/openai/v1`
- `OPENAI_MODEL=openai/gpt-oss-120b`

---

## 3) Run Backend (Local)

From `hacksynth-ui/backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Backend runs at: [http://127.0.0.1:8000](http://127.0.0.1:8000)  
Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 4) Run Frontend (Local)

Open a **second terminal** at `hacksynth-ui` root:

```powershell
npm install
npm run dev
```

Frontend opens at: [http://localhost:5173](http://localhost:5173)

---

## 5) Build Sandbox Image (for real command execution)

From `hacksynth-ui` root:

```powershell
cd sandbox
docker build -t hacksynth-sandbox:latest .
```

If not built, executor may use mock behavior depending on settings.

---

## 6) Run Entire Stack with Docker Compose

From `hacksynth-ui` root:

```powershell
docker compose build
docker compose up
```

URLs:
- UI: [http://localhost:8080](http://localhost:8080)
- API: [http://localhost:8000](http://localhost:8000)

Stop services:

```powershell
docker compose down
```

Rebuild only API:

```powershell
docker compose build api
docker compose up api
```

View logs:

```powershell
docker compose logs -f
docker compose logs -f api
docker compose logs -f ui
```

---

## 7) Daily Run Commands (Quick)

### Local dev mode
Terminal 1:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python main.py
```

Terminal 2:

```powershell
npm run dev
```

### Full Docker mode

```powershell
docker compose up --build
```

---

## 8) Common Issues

- `docker: command not found` -> Docker Desktop not installed or not started.
- `401/403` from API provider -> invalid `GROQ_API_KEY`.
- API not reachable from UI -> ensure backend is running on port `8000`.
- PowerShell script execution blocked -> run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
