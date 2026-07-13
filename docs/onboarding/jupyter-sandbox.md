# Jupyter sandbox

Start local sandbox:

```bash
cd apps/kernel-server
docker compose up --build --wait
```

Then run `pnpm dev` from repository root. Web uses `http://localhost:3000`;
admin uses `http://localhost:3002` or host-mounted `http://localhost:3000/admin`.

Security boundary:

```text
Browser + Clerk token
  -> kernel-server :3006
  -> 5-minute HMAC ticket, owner/session check
  -> Jupyter HTTP/WebSocket proxy
  -> container :8888 on private notebook-internal network
```

Sandbox limits: two active sessions, 1 CPU, 2 GiB RAM, 128 PIDs, 15-minute
idle expiry. Containers are non-root, read-only, tmpfs-backed, capability
dropped, no host mount, no public 8888, no egress network. Kernel-server alone
has Docker socket access.

Production: unset `DEV_AUTH_ROLE`; set Clerk `CLERK_JWKS_URL`, random
`SESSION_TICKET_SECRET`, exact HTTPS `ALLOWED_ORIGINS`; put port 3006 behind
HTTPS reverse proxy and firewall. GPU/deep-training workloads exceed free tier.
