import json
import re
from typing import Any

import httpx

from .config import Settings


def openai_compatible_api_key(settings: Settings) -> str:
    return (settings.groq_api_key or settings.openai_api_key).strip()


def llm_ready(settings: Settings) -> bool:
    if settings.llm_provider == "ollama":
        return bool(settings.ollama_model and settings.ollama_base_url)
    return bool(openai_compatible_api_key(settings))


async def chat_completion(
    settings: Settings,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> tuple[str, int | None]:
    """Returns (content, total_tokens or None)."""
    if settings.llm_provider == "ollama":
        return await _ollama_chat(settings, messages, temperature=temperature, max_tokens=max_tokens)
    return await _openai_compatible_chat(settings, messages, temperature=temperature, max_tokens=max_tokens)


async def _openai_compatible_chat(
    settings: Settings,
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
) -> tuple[str, int | None]:
    key = openai_compatible_api_key(settings)
    if not key:
        raise RuntimeError("LLM API key not configured (set GROQ_API_KEY or OPENAI_API_KEY).")
    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": settings.openai_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage") or {}
    total = usage.get("total_tokens")
    return content, total if isinstance(total, int) else None


async def _ollama_chat(
    settings: Settings,
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
) -> tuple[str, int | None]:
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
    content = data.get("message", {}).get("content") or ""
    return content, None


def _extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        # Fallback: some models occasionally respond with plain text.
        # Treat the first non-empty line as the command.
        first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
        if first:
            return {"command": first, "reasoning": ""}
        raise ValueError("No JSON object in model output")
    return json.loads(m.group())


async def planner_generate(
    settings: Settings,
    *,
    challenge_name: str,
    target: str,
    history: list[dict[str, Any]],
    last_summary: str | None,
) -> tuple[str, str, int | None]:
    system = (
        "You are the Planner module for an authorized cybersecurity lab (CTF). "
        "Output a single next shell command for Debian/Ubuntu-style sandbox. "
        "Respond with JSON only: {\"command\": \"...\", \"reasoning\": \"...\"}. "
        "No markdown fences. The command must be one line, no newlines."
    )
    hist_lines = []
    for h in history[-12:]:
        hist_lines.append(json.dumps(h, ensure_ascii=False))
    user = (
        f"Challenge: {challenge_name}\nTarget: {target}\n"
        f"Recent history (JSON lines):\n" + "\n".join(hist_lines) + "\n"
        f"Last summarizer signal: {last_summary or '(none)'}\n"
        "Propose the single best next command."
    )
    raw, tokens = await chat_completion(
        settings,
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.25,
        max_tokens=512,
    )
    data = _extract_json_object(raw)
    cmd = str(data.get("command", "")).strip().splitlines()[0].strip()
    reason = str(data.get("reasoning", "")).strip()
    if not cmd:
        raise ValueError("Planner returned empty command")
    return cmd, reason, tokens


async def summarizer_compress(
    settings: Settings,
    *,
    command: str,
    raw_output: str,
    challenge_name: str,
) -> tuple[str, str | None, int | None]:
    system = (
        "You are the Summarizer for an authorized CTF lab. "
        "Compress noisy terminal output into a short operational summary for the next planning step. "
        "If you see a flag matching FLAG{...}, extract it. "
        "Respond with JSON only: {\"summary\": \"...\", \"flag\": null or \"FLAG{...}\"}. "
        "No markdown fences."
    )
    excerpt = raw_output[: settings.max_output_chars]
    user = f"Challenge: {challenge_name}\nCommand: {command}\nRaw output:\n{excerpt}"
    raw, tokens = await chat_completion(
        settings,
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.1,
        max_tokens=512,
    )
    data = _extract_json_object(raw)
    summary = str(data.get("summary", "")).strip()
    flag = data.get("flag")
    flag_s = str(flag).strip() if flag else None
    if flag_s in ("", "null", "None"):
        flag_s = None
    if not summary:
        summary = "(empty summary)"
    return summary, flag_s, tokens


def effective_demo_mode(settings: Settings, use_demo_sequence: bool | None) -> bool:
    if use_demo_sequence is True:
        return True
    if use_demo_sequence is False:
        return False
    if settings.demo_mode:
        return True
    return not llm_ready(settings)
