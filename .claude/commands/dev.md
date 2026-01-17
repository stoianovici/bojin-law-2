# /dev - Development Commands Reference

| Command         | Script                                    | Description              |
| --------------- | ----------------------------------------- | ------------------------ |
| `/start`        | `./scripts/start.sh`                      | Local dev (localhost)    |
| `/tunnel`       | `./scripts/start.sh --tunnel`             | Tunnel + fresh prod data |
| `/tunnel-quick` | `./scripts/start.sh --tunnel --skip-sync` | Tunnel, no data sync     |
| `/staging`      | `./scripts/start.sh --staging`            | Prod-like environment    |

Use `/tunnel` for Word Add-in testing. Use `/start` for regular dev work.
