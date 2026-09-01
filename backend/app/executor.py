import asyncio
import shutil
import subprocess
from typing import TYPE_CHECKING

from .config import Settings

if TYPE_CHECKING:
    pass


def _truncate(s: str, max_chars: int) -> str:
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 20] + "\n...[truncated]..."


async def run_in_docker(
    settings: Settings,
    command: str,
) -> tuple[str, str, int, bool, bool]:
    """
    Returns stdout, stderr, exit_code, timed_out, mock.
    """
    if settings.use_mock_executor:
        return (
            f"[mock executor] Would run: {command}\n(mock: set USE_MOCK_EXECUTOR=false and build sandbox image)",
            "",
            0,
            False,
            True,
        )

    docker_bin = shutil.which("docker")
    if not docker_bin:
        # In Docker-Compose, the API container may not have docker CLI installed,
        # but it DOES have access to the Docker Engine socket (/var/run/docker.sock).
        # Use the Engine API via docker-py as a fallback.
        try:
            return await _run_via_docker_engine_api(settings, command)
        except Exception:  # noqa: BLE001
            return (
                "[mock executor] Docker CLI not found on PATH (and Docker Engine API unavailable).",
                "",
                0,
                False,
                True,
            )

    cmd = [
        docker_bin,
        "run",
        "--rm",
        "-i",
        settings.sandbox_image,
        "sh",
        "-c",
        command,
    ]

    def _run() -> tuple[bytes, bytes, int]:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            timeout=settings.command_timeout_sec,
        )
        return proc.stdout, proc.stderr, proc.returncode

    try:
        stdout_b, stderr_b, code = await asyncio.to_thread(_run)
    except subprocess.TimeoutExpired:
        return "", "Command timed out", -1, True, False
    except FileNotFoundError:
        return (
            f"[mock executor] Failed to spawn docker for image {settings.sandbox_image}",
            "",
            0,
            False,
            True,
        )
    except Exception as exc:  # noqa: BLE001
        return f"[mock executor] {exc!s}", "", 0, False, True

    out = _truncate(stdout_b.decode(errors="replace"), settings.max_output_chars)
    err = _truncate(stderr_b.decode(errors="replace"), settings.max_output_chars)
    return out, err, int(code), False, False


async def _run_via_docker_engine_api(
    settings: Settings,
    command: str,
) -> tuple[str, str, int, bool, bool]:
    import docker  # type: ignore

    def _run() -> tuple[str, str, int]:
        client = docker.from_env()

        # Fast path: run synchronously, let docker-py remove container after completion.
        # This avoids the detach/remove timing issues that can lead to "container does not exist".
        try:
            stdout_b, stderr_b = client.containers.run(
                image=settings.sandbox_image,
                command=["sh", "-c", command],
                remove=True,
                stdout=True,
                stderr=True,
                demux=True,
                timeout=settings.command_timeout_sec,
            )
            out = stdout_b.decode(errors="replace") if stdout_b else ""
            err = stderr_b.decode(errors="replace") if stderr_b else ""
            return out, err, 0
        except Exception:
            # Slow path: create -> start -> wait -> logs -> remove
            container = client.containers.create(
                image=settings.sandbox_image,
                command=["sh", "-c", command],
                stdin_open=False,
                tty=False,
            )
            try:
                container.start()
                result = container.wait(timeout=settings.command_timeout_sec)
                code = int(result.get("StatusCode", 0))
                logs = container.logs(stdout=True, stderr=True)
                # docker-py returns combined logs; keep stderr empty for now.
                return logs.decode(errors="replace"), "", code
            except Exception:
                try:
                    container.kill()
                except Exception:  # noqa: BLE001
                    pass
                raise
            finally:
                try:
                    container.remove(force=True)
                except Exception:  # noqa: BLE001
                    pass

    try:
        out, err, code = await asyncio.to_thread(_run)
        return _truncate(out, settings.max_output_chars), _truncate(err, settings.max_output_chars), code, False, False
    except Exception as exc:  # noqa: BLE001
        return f"[mock executor] Docker Engine API error: {exc!s}", "", 0, False, True
