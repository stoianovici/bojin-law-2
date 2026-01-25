# /tunnel-quick - Start Tunnel Without Data Sync

Run this command:

```bash
./scripts/start.sh --tunnel --skip-sync
```

Note: With the new Coolify database setup, `--skip-sync` has minimal effect since we connect directly to the production database via SSH tunnel. The flag is kept for backwards compatibility.

To use local Docker PostgreSQL instead:

```bash
./scripts/start.sh --tunnel --local-db
```

That's it. The script handles everything.
