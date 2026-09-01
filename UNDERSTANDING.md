# HackSynth Website - Quick Understanding Document

## What this website is
This website is a **frontend prototype** for the HackSynth final year project.  
It demonstrates how an autonomous LLM-based pentesting agent would be controlled, monitored, and explained during a project demo.

## What the website currently does
- Lets you select a challenge scenario.
- Runs a **simulation loop**: Planner -> Executor -> Summarizer.
- Shows live terminal-style logs and command timeline.
- Displays runtime metrics (steps, tokens, errors, status).
- Shows final flag output when the simulation completes.
- Stores session data in browser local storage, so refresh does not lose progress.

## Main sections in the UI
- **Simulation Control**: start, pause, reset, and clear storage.
- **Live Terminal Output**: streaming simulated system logs.
- **Planner Command Timeline**: step-by-step generated commands and summaries.
- **Result Snapshot**: current target, difficulty, errors, and final flag.
- **Technical Dossier**: architecture, APIs, safety controls, evaluation metrics, and stack.
- **Expected Final Result** button: explains what full integrated system will deliver.

## What is partial vs final
Current website is a **partial prototype**:
- Uses predefined simulation data (not real backend execution).
- Used for demonstration of workflow, UI, and project understanding.

Final integrated version will include:
- Live FastAPI backend connection.
- Real command execution in Docker sandbox.
- Real LLM planner/summarizer calls.
- End-to-end report generation with evidence logs.

## Browser storage details
The website saves selected challenge, logs, history, metrics, final flag, and UI state in `localStorage`.  
This improves demo reliability because state is preserved after refresh.

## Why this website is useful for viva/demo
- Helps students explain architecture and execution flow clearly.
- Helps teachers quickly understand technical scope and implementation strategy.
- Shows both current prototype capability and final project roadmap in one place.
