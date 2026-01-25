# /tunnel - Start Development with Cloudflare Tunnel

Run this command:

```bash
./scripts/start.sh --tunnel
```

This starts:

- Cloudflare tunnel (dev.bojin-law.com → localhost:4000)
- SSH tunnel to **Coolify production database** (port 5433)
- Local Redis via Docker

To use local Docker PostgreSQL instead of Coolify:

```bash
./scripts/start.sh --tunnel --local-db
```

That's it. The script handles everything.
