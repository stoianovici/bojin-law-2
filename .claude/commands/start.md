# /start - Start Local Development

Run this command:

```bash
./scripts/start.sh
```

This connects to **Coolify production database** via SSH tunnel (port 5433) by default.

To use local Docker PostgreSQL instead:

```bash
./scripts/start.sh --local-db
```

That's it. The script handles everything.
