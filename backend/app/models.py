from typing import Any

from pydantic import BaseModel, Field


class ChallengeOut(BaseModel):
    id: str
    name: str
    environment: str
    difficulty: str
    description: str = ""


class ChallengeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    environment: str = Field(min_length=2, max_length=120)
    difficulty: str = Field(default="Custom", max_length=32)
    description: str = Field(default="", max_length=500)


class PlannerRequest(BaseModel):
    challenge_id: str
    history: list[dict[str, Any]] = Field(default_factory=list)
    last_summary: str | None = None
    last_command: str | None = None
    last_output_excerpt: str | None = None


class PlannerResponse(BaseModel):
    command: str
    reasoning: str = ""
    tokens: int | None = None


class ExecutorRequest(BaseModel):
    command: str
    challenge_id: str | None = None


class ExecutorResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False
    mock: bool = False


class SummarizerRequest(BaseModel):
    raw_output: str
    command: str = ""
    challenge_id: str = ""


class SummarizerResponse(BaseModel):
    summary: str
    flag: str | None = None
    tokens: int | None = None


class RunLoopRequest(BaseModel):
    challenge_id: str
    max_steps: int | None = None
    use_demo_sequence: bool | None = None


class HealthResponse(BaseModel):
    status: str
    demo_mode: bool
    mock_executor: bool
    llm_configured: bool
    sandbox_image: str
