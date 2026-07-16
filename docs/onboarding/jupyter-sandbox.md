# Jupyter sandbox

Start local sandbox:

```bash
cd apps/kernel-server
docker compose up --build --wait
```

Then run `pnpm dev:js` from repository root (compose already owns port 3006).
Web uses `http://localhost:3000`;
admin uses `http://localhost:3002` or host-mounted `http://localhost:3000/admin`.

Security boundary:

```text
Browser + Clerk token
  -> kernel-server :3006
  -> 5-minute rotating HttpOnly __Secure-kernel-ticket cookie
  -> Jupyter HTTP/WebSocket proxy
  -> container :8888 on private notebook-internal network

kernel-server
  -> authenticated fixed-shape API on broker-control
  -> docker-broker :3007
  -> Docker socket
```

Sandbox limits: two active sessions, one session per owner, 1 CPU, 2 GiB RAM,
128 PIDs, 15-minute idle expiry. Runtime containers are non-root, read-only,
tmpfs-backed, capability-dropped, without host mounts, public 8888, or egress.
Kernel-server and broker run as UID 10001. Only broker mounts Docker socket;
broker rejects caller resource/volume arguments and controls containers carrying
`notebook.managed-by=kernel-broker` label.

Production: unset `DEV_AUTH_ROLE`; set Clerk issuer/JWKS/audience, random
`SESSION_TICKET_SECRET`, `JUPYTER_BROKER_URL`, random 32+ byte
`JUPYTER_BROKER_TOKEN`, and exact HTTPS `ALLOWED_ORIGINS`. Put port 3006 behind
HTTPS reverse proxy and firewall. On Linux, set `DOCKER_GID` to Docker socket
group ID for broker access. Never publish broker port 3007.
