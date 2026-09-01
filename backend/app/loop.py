import json
import re
from collections.abc import AsyncIterator
from typing import Any

from .challenges import get_challenge
from .config import get_settings
from .demo import DEMO_SEQUENCE
from .executor import run_in_docker
from .llm import effective_demo_mode, llm_ready, planner_generate, summarizer_compress

FLAG_RE = re.compile(r"FLAG\{[^}]+\}")


def _find_flag(text: str) -> str | None:
    m = FLAG_RE.search(text)
    return m.group(0) if m else None


async def stream_run_loop(
    *,
    challenge_id: str,
    max_steps: int | None,
    use_demo_sequence: bool | None,
) -> AsyncIterator[dict[str, Any]]:
    settings = get_settings()
    challenge = get_challenge(challenge_id)
    if not challenge:
        yield {"type": "error", "message": f"Unknown challenge: {challenge_id}"}
        return

    limit = max_steps if max_steps is not None else settings.default_max_steps
    limit = max(1, min(limit, 200))

    if use_demo_sequence is False and not llm_ready(settings):
        yield {
            "type": "error",
            "message": "LLM not configured. Set GROQ_API_KEY (or OPENAI_API_KEY) and OPENAI_BASE_URL (default Groq), or use LLM_PROVIDER=ollama, or pass use_demo_sequence=true.",
        }
        return

    demo = effective_demo_mode(settings, use_demo_sequence)
    yield {
        "type": "meta",
        "challenge": challenge.model_dump(),
        "demo_mode": demo,
        "max_steps": limit,
        "demo_sequence_length": len(DEMO_SEQUENCE) if demo else None,
    }

    history: list[dict[str, Any]] = []
    total_tokens = 0
    steps = 0

    if demo:
        for entry in DEMO_SEQUENCE:
            if steps >= limit:
                yield {"type": "done", "reason": "max_steps", "steps": steps, "total_tokens": total_tokens}
                return
            steps += 1
            planner = entry["planner"]
            output = entry["output"]
            summary = entry["summary"]
            tok = int(entry.get("tokens") or 0)
            total_tokens += tok

            yield {"type": "step", "step": steps, "phase": "planner"}
            yield {
                "type": "planner",
                "command": planner,
                "reasoning": "demo sequence",
                "tokens": tok,
            }
            yield {"type": "step", "step": steps, "phase": "executor"}
            yield {
                "type": "executor",
                "stdout": output,
                "stderr": "",
                "exit_code": 0,
                "timed_out": False,
                "mock": True,
            }
            yield {"type": "step", "step": steps, "phase": "summarizer"}
            yield {"type": "summarizer", "summary": summary, "flag": entry.get("flag"), "tokens": None}

            history.append(
                {
                    "step": steps,
                    "command": planner,
                    "output_excerpt": output[:2000],
                    "summary": summary,
                }
            )

            flag = entry.get("flag") or _find_flag(output)
            if flag:
                yield {
                    "type": "done",
                    "reason": "flag",
                    "flag": flag,
                    "steps": steps,
                    "total_tokens": total_tokens,
                }
                return

        yield {"type": "done", "reason": "sequence_end", "steps": steps, "total_tokens": total_tokens}
        return

    # Live LLM + executor path
    last_summary: str | None = None

    while steps < limit:
        steps += 1
        yield {"type": "step", "step": steps, "phase": "planner"}
        try:
            cmd, reasoning, ptoks = await planner_generate(
                settings,
                challenge_name=challenge.name,
                target=challenge.environment,
                history=history,
                last_summary=last_summary,
            )
        except Exception as exc:  # noqa: BLE001
            yield {"type": "error", "message": f"Planner failed: {exc!s}"}
            return
        if ptoks is not None:
            total_tokens += ptoks
        yield {
            "type": "planner",
            "command": cmd,
            "reasoning": reasoning,
            "tokens": ptoks,
        }

        yield {"type": "step", "step": steps, "phase": "executor"}
        stdout, stderr, exit_code, timed_out, mock = await run_in_docker(settings, cmd)
        yield {
            "type": "executor",
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": exit_code,
            "timed_out": timed_out,
            "mock": mock,
        }

        # If the executor is unavailable (Docker missing / Engine API failing),
        # continuing the planner loop just burns tokens. Stop early.
        if mock:
            yield {"type": "done", "reason": "executor_unavailable", "steps": steps, "total_tokens": total_tokens}
            return

        combined = f"{stdout}\n{stderr}"
        pre_flag = _find_flag(combined)

        yield {"type": "step", "step": steps, "phase": "summarizer"}
        try:
            summary, flag_from_llm, stoks = await summarizer_compress(
                settings,
                command=cmd,
                raw_output=combined,
                challenge_name=challenge.name,
            )
        except Exception as exc:  # noqa: BLE001
            yield {"type": "error", "message": f"Summarizer failed: {exc!s}"}
            return
        if stoks is not None:
            total_tokens += stoks

        final_flag = pre_flag or flag_from_llm
        yield {"type": "summarizer", "summary": summary, "flag": final_flag, "tokens": stoks}

        last_summary = summary

        history.append(
            {
                "step": steps,
                "command": cmd,
                "output_excerpt": combined[:2000],
                "summary": summary,
            }
        )

        if final_flag:
            yield {
                "type": "done",
                "reason": "flag",
                "flag": final_flag,
                "steps": steps,
                "total_tokens": total_tokens,
            }
            return

        if timed_out:
            yield {"type": "done", "reason": "timeout", "steps": steps, "total_tokens": total_tokens}
            return

    yield {"type": "done", "reason": "max_steps", "steps": steps, "total_tokens": total_tokens}
