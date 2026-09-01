import json
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .challenges import CHALLENGES, add_challenge, get_challenge
from .config import get_settings
from .executor import run_in_docker
from .llm import llm_ready, planner_generate, summarizer_compress
from .loop import stream_run_loop
from .models import (
    ChallengeCreate,
    ChallengeOut,
    ExecutorRequest,
    ExecutorResponse,
    HealthResponse,
    PlannerRequest,
    PlannerResponse,
    RunLoopRequest,
    SummarizerRequest,
    SummarizerResponse,
)

app = FastAPI(title="HackSynth API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    s = get_settings()
    return HealthResponse(
        status="ok",
        demo_mode=s.demo_mode,
        mock_executor=s.use_mock_executor,
        llm_configured=llm_ready(s),
        sandbox_image=s.sandbox_image,
    )


@app.get("/challenges")
async def list_challenges() -> dict[str, Any]:
    return {"challenges": [c.model_dump() for c in CHALLENGES]}


@app.post("/challenges", response_model=ChallengeOut)
async def create_challenge(body: ChallengeCreate) -> ChallengeOut:
    return add_challenge(body)


@app.post("/planner", response_model=PlannerResponse)
async def planner(body: PlannerRequest) -> PlannerResponse:
    s = get_settings()
    ch = get_challenge(body.challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Unknown challenge")
    if not llm_ready(s):
        raise HTTPException(status_code=503, detail="LLM not configured")
    cmd, reasoning, tokens = await planner_generate(
        s,
        challenge_name=ch.name,
        target=ch.environment,
        history=body.history,
        last_summary=body.last_summary,
    )
    return PlannerResponse(command=cmd, reasoning=reasoning, tokens=tokens)


@app.post("/executor", response_model=ExecutorResponse)
async def executor(body: ExecutorRequest) -> ExecutorResponse:
    s = get_settings()
    stdout, stderr, exit_code, timed_out, mock = await run_in_docker(s, body.command)
    return ExecutorResponse(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        timed_out=timed_out,
        mock=mock,
    )


@app.post("/summarizer", response_model=SummarizerResponse)
async def summarizer(body: SummarizerRequest) -> SummarizerResponse:
    s = get_settings()
    ch = get_challenge(body.challenge_id) if body.challenge_id else None
    name = ch.name if ch else "Challenge"
    if not llm_ready(s):
        raise HTTPException(status_code=503, detail="LLM not configured")
    summary, flag, tokens = await summarizer_compress(
        s,
        command=body.command,
        raw_output=body.raw_output,
        challenge_name=name,
    )
    return SummarizerResponse(summary=summary, flag=flag, tokens=tokens)


@app.post("/run-loop")
async def run_loop(body: RunLoopRequest) -> StreamingResponse:
    async def gen():
        async for event in stream_run_loop(
            challenge_id=body.challenge_id,
            max_steps=body.max_steps,
            use_demo_sequence=body.use_demo_sequence,
        ):
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")
