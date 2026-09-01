import re

from .models import ChallengeCreate, ChallengeOut

CHALLENGES: list[ChallengeOut] = [
    ChallengeOut(
        id="ctf-web-01",
        name="Web Exploit Lab",
        environment="10.0.0.5",
        difficulty="Easy",
        description="Web-facing services; enumerate and pivot toward data stores.",
    ),
    ChallengeOut(
        id="ctf-network-02",
        name="Network Pivot Lab",
        environment="10.0.0.12",
        difficulty="Medium",
        description="Lateral movement across subnets; expect scanning and service discovery.",
    ),
    ChallengeOut(
        id="ctf-privesc-03",
        name="Privilege Escalation Lab",
        environment="10.0.0.25",
        difficulty="Hard",
        description="Assume low shell; escalate privileges and recover protected artifacts.",
    ),
]


def get_challenge(challenge_id: str) -> ChallengeOut | None:
    for c in CHALLENGES:
        if c.id == challenge_id:
            return c
    return None


def add_challenge(body: ChallengeCreate) -> ChallengeOut:
    base = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-") or "custom-ctf"
    candidate = f"custom-{base}"
    existing = {c.id for c in CHALLENGES}
    challenge_id = candidate
    suffix = 2
    while challenge_id in existing:
        challenge_id = f"{candidate}-{suffix}"
        suffix += 1

    challenge = ChallengeOut(
        id=challenge_id,
        name=body.name.strip(),
        environment=body.environment.strip(),
        difficulty=body.difficulty.strip() or "Custom",
        description=body.description.strip(),
    )
    CHALLENGES.append(challenge)
    return challenge
