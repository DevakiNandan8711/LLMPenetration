FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dnsutils \
    iputils-ping \
    netcat-openbsd \
    nmap \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /work

CMD ["bash", "-lc", "echo hacksynth sandbox ready && sleep infinity"]
