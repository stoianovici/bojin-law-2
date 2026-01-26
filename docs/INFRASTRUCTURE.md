# Infrastructure Documentation

Complete guide for managing the Legal Platform infrastructure on Hetzner/Coolify.

## Table of Contents

1. [Server Overview](#server-overview)
2. [Coolify Resource Limits](#coolify-resource-limits)
3. [Monitoring & Alerting](#monitoring--alerting)
4. [SSL Certificate Monitoring](#ssl-certificate-monitoring)
5. [Maintenance Automation](#maintenance-automation)
6. [Firewall Configuration](#firewall-configuration)
7. [Disaster Recovery](#disaster-recovery)
8. [Future Scaling](#future-scaling)

---

## Server Overview

| Property         | Value                            |
| ---------------- | -------------------------------- |
| **Provider**     | Hetzner Cloud                    |
| **Server Type**  | cx33 (4 vCPU, 8GB RAM, 80GB SSD) |
| **Location**     | Helsinki, Finland (hel1)         |
| **IP Address**   | 135.181.44.197                   |
| **Monthly Cost** | ~€13.68                          |
| **OS**           | Ubuntu 22.04 LTS                 |

### Services Running

| Service       | Port | Memory | CPU       | Domain               |
| ------------- | ---- | ------ | --------- | -------------------- |
| PostgreSQL    | 5432 | 2GB    | 1 core    | Internal             |
| Redis         | 6379 | 512MB  | 0.25 core | Internal             |
| Gateway       | 4000 | 1.5GB  | 1 core    | api.bojin-law.com    |
| Web           | 3000 | 1.5GB  | 1 core    | app.bojin-law.com    |
| AI Service    | 3002 | 1GB    | 0.5 core  | Internal             |
| Legacy Import | 3000 | 1GB    | 0.5 core  | import.bojin-law.com |
| Uptime Kuma   | 3001 | 256MB  | 0.25 core | status.bojin-law.com |
| Coolify       | 8000 | 512MB  | 0.5 core  | Direct IP            |

**Total Allocated**: ~8.25GB RAM / 5 cores (slightly overprovisioned)

---

## Coolify Resource Limits

### Setting Resource Limits

1. Go to **Coolify Dashboard** → http://135.181.44.197:8000
2. Select the service
3. Click **"Resources"** tab
4. Set memory and CPU limits

### Recommended Limits

```
┌─────────────────┬────────────┬───────────┬──────────────────────────┐
│ Service         │ Memory     │ CPU       │ Notes                    │
├─────────────────┼────────────┼───────────┼──────────────────────────┤
│ PostgreSQL      │ 2048 MB    │ 1.0 core  │ Critical - needs room    │
│ Redis           │ 512 MB     │ 0.25 core │ Session/cache only       │
│ Gateway         │ 1536 MB    │ 1.0 core  │ Handles all API traffic  │
│ Web             │ 1536 MB    │ 1.0 core  │ Next.js SSR              │
│ AI Service      │ 1024 MB    │ 0.5 core  │ Anthropic API calls      │
│ Legacy Import   │ 1024 MB    │ 0.5 core  │ Document processing      │
│ Uptime Kuma     │ 256 MB     │ 0.25 core │ Lightweight monitoring   │
└─────────────────┴────────────┴───────────┴──────────────────────────┘
```

### How to Apply

For each service in Coolify:

1. Navigate to service → **Configuration** → **Resources**
2. Set **Memory Limit** (e.g., `1536m` or `1.5g`)
3. Set **CPU Limit** (e.g., `1.0` for 1 core)
4. Click **Save**
5. **Redeploy** the service

### Verifying Limits

SSH to server and run:

```bash
docker stats --no-stream
```

---

## Monitoring & Alerting

### Uptime Kuma Setup

**Dashboard**: https://status.bojin-law.com
**Credentials**: admin / BojinLaw2026!

### Required Monitors

| Monitor       | Type     | URL/Target                              | Interval |
| ------------- | -------- | --------------------------------------- | -------- |
| Web App       | HTTP(s)  | https://app.bojin-law.com/api/health    | 60s      |
| Gateway API   | HTTP(s)  | https://api.bojin-law.com/health        | 60s      |
| AI Service    | HTTP(s)  | https://api.bojin-law.com/api/ai/health | 60s      |
| Legacy Import | HTTP(s)  | https://import.bojin-law.com/api/health | 60s      |
| PostgreSQL    | TCP Port | 10.0.1.7:5432                           | 60s      |
| Redis         | TCP Port | 10.0.1.8:6379                           | 60s      |

### Discord Notifications

1. In Uptime Kuma, go to **Settings** → **Notifications**
2. Add **Discord** notification
3. Paste webhook URL from Discord server
4. Enable for all monitors

### Custom Monitoring Scripts

Located in `scripts/maintenance/`:

| Script              | Purpose             | Frequency        |
| ------------------- | ------------------- | ---------------- |
| `disk-monitor.sh`   | Disk space alerts   | Every 6 hours    |
| `memory-monitor.sh` | Memory usage alerts | Every 30 minutes |

---

## SSL Certificate Monitoring

### Adding SSL Monitors in Uptime Kuma

For each HTTPS domain, add a certificate expiry monitor:

1. **Add New Monitor**
2. **Monitor Type**: HTTP(s) - Certificate Expiry
3. **URL**: `https://app.bojin-law.com` (or other domain)
4. **Certificate Expiry Notification**: 14 days
5. **Save**

### Domains to Monitor

| Domain               | Certificate             | Auto-Renew |
| -------------------- | ----------------------- | ---------- |
| app.bojin-law.com    | Let's Encrypt (Coolify) | Yes        |
| api.bojin-law.com    | Let's Encrypt (Coolify) | Yes        |
| import.bojin-law.com | Let's Encrypt (Coolify) | Yes        |
| status.bojin-law.com | Let's Encrypt (Coolify) | Yes        |
| dev.bojin-law.com    | Cloudflare (Tunnel)     | Yes        |

### Manual Certificate Check

```bash
# Check certificate expiry
echo | openssl s_client -servername app.bojin-law.com -connect app.bojin-law.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Maintenance Automation

### Setup on Server

```bash
# SSH to server
ssh root@135.181.44.197

# Clone/pull latest code
cd /opt/legal-platform
git pull

# Run setup (copies scripts, installs crons)
./scripts/maintenance/setup-crons.sh

# Edit environment file with credentials
nano /opt/legal-platform/scripts/.env

# Test backup manually
. /opt/legal-platform/scripts/.env && /opt/legal-platform/scripts/db-backup.sh
```

### Cron Schedule

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAINTENANCE SCHEDULE                         │
├─────────────────────────────────────────────────────────────────┤
│ MONITORING                                                      │
│   */30 * * * *  memory-monitor.sh      (every 30 min)          │
│   0 */6 * * *   disk-monitor.sh        (every 6 hours)         │
├─────────────────────────────────────────────────────────────────┤
│ DAILY                                                           │
│   0 3 * * *     db-backup.sh           (3:00 AM)               │
├─────────────────────────────────────────────────────────────────┤
│ WEEKLY (Sunday)                                                 │
│   0 3 * * 0     docker-cleanup.sh      (3:00 AM)               │
│   0 4 * * 0     db-maintenance.sh      (4:00 AM)               │
│   0 5 * * 0     hetzner-snapshot.sh    (5:00 AM)               │
├─────────────────────────────────────────────────────────────────┤
│ MONTHLY (1st)                                                   │
│   0 2 1 * *     log cleanup            (2:00 AM)               │
│   0 5 1 * *     verify-backup.sh       (5:00 AM)               │
└─────────────────────────────────────────────────────────────────┘
```

### Log Files

```bash
# View logs on server
tail -f /var/log/legal-platform/backup.log
tail -f /var/log/legal-platform/maintenance.log
tail -f /var/log/legal-platform/disk-monitor.log
tail -f /var/log/legal-platform/memory-monitor.log
tail -f /var/log/legal-platform/docker-cleanup.log
tail -f /var/log/legal-platform/snapshot.log
```

---

## Firewall Configuration

### Current Rules (UFW)

```bash
# View current rules
ufw status verbose

# Expected output:
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     LIMIT       Anywhere      # SSH (rate limited)
80/tcp                     ALLOW       Anywhere      # HTTP
443/tcp                    ALLOW       Anywhere      # HTTPS
8000/tcp                   ALLOW       Anywhere      # Coolify Dashboard
```

### Setup Firewall

```bash
# On server
/opt/legal-platform/scripts/setup-firewall.sh
```

### Restrict Coolify Dashboard (Recommended)

```bash
# Remove open access
ufw delete allow 8000/tcp

# Allow only from your IP
ufw allow from YOUR.IP.ADDRESS to any port 8000 proto tcp comment 'Coolify (restricted)'
```

---

## Disaster Recovery

### Backup Strategy

| What            | Where         | Frequency       | Retention   |
| --------------- | ------------- | --------------- | ----------- |
| PostgreSQL dump | Cloudflare R2 | Daily 3 AM      | 30 days     |
| Server snapshot | Hetzner       | Weekly Sun 5 AM | 2 snapshots |
| Code            | GitHub        | On push         | Unlimited   |

### Recovery Procedures

#### Database Restore

```bash
# SSH to server
ssh root@135.181.44.197

# List available backups
aws s3 ls s3://legal-platform-backups/ --endpoint-url $R2_ENDPOINT

# Download latest backup
aws s3 cp s3://legal-platform-backups/legal_platform_backup_YYYYMMDD.sql.gz . \
  --endpoint-url $R2_ENDPOINT

# Restore to database
gunzip -c legal_platform_backup_YYYYMMDD.sql.gz | \
  docker exec -i postgres psql -U legal_platform -d legal_platform
```

#### Server Restore from Snapshot

1. Go to **Hetzner Cloud Console**
2. **Servers** → Select server
3. **Snapshots** tab
4. Click **"Create Server from Snapshot"**
5. Update DNS if IP changes

#### Full Rebuild

```bash
# On new server
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Restore from GitHub
git clone https://github.com/stoianovici/bojin-law-2.git /opt/legal-platform

# Restore database from R2 backup
# Reconfigure Coolify services
```

---

## Future Scaling

### Option 1: Vertical Scaling (Simple)

Upgrade Hetzner server:

| Type           | vCPU | RAM  | SSD   | Price     |
| -------------- | ---- | ---- | ----- | --------- |
| cx33 (current) | 4    | 8GB  | 80GB  | €13.68/mo |
| cx43           | 8    | 16GB | 160GB | €27.39/mo |
| cx53           | 16   | 32GB | 320GB | €54.78/mo |

**How**: Hetzner Console → Server → Rescale (requires reboot)

### Option 2: Horizontal Scaling (Advanced)

Add a second server for redundancy:

```
┌─────────────────────────────────────────────────────────────────┐
│                     FUTURE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Cloudflare (Load Balancer / CDN)                             │
│              │                                                  │
│       ┌──────┴──────┐                                          │
│       │             │                                          │
│   ┌───▼───┐     ┌───▼───┐                                      │
│   │Server1│     │Server2│     ← Application Servers            │
│   │Web    │     │Web    │                                      │
│   │Gateway│     │Gateway│                                      │
│   │AI Svc │     │AI Svc │                                      │
│   └───┬───┘     └───┬───┘                                      │
│       │             │                                          │
│       └──────┬──────┘                                          │
│              │                                                  │
│       ┌──────▼──────┐                                          │
│       │  Database   │     ← Managed PostgreSQL (Hetzner)       │
│       │  (Primary)  │        or self-managed with replica      │
│       └─────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation Steps

1. **Hetzner Managed Database** (~€15/mo)
   - Automatic backups
   - High availability option available
   - Move PostgreSQL off application server

2. **Second Application Server** (~€14/mo)
   - Clone current setup
   - Configure Cloudflare load balancing
   - Share Redis (or use managed Redis)

3. **Cloudflare Load Balancing** (~$5/mo)
   - Health checks
   - Automatic failover
   - Geographic routing

**Total Scaled Cost**: ~€50/mo for full redundancy

### Option 3: Managed Services (Easiest)

If scaling becomes complex, consider:

| Service     | Provider         | Cost      |
| ----------- | ---------------- | --------- |
| Database    | Neon / Supabase  | $25-50/mo |
| Redis       | Upstash          | $10/mo    |
| Application | Railway / Render | $20-50/mo |

Trade-off: Higher cost, less control, but zero infrastructure management.

---

## Quick Reference

### SSH Access

```bash
ssh root@135.181.44.197
```

### Coolify Dashboard

http://135.181.44.197:8000

### Useful Commands

```bash
# Check all containers
docker ps -a

# View container logs
docker logs <container-name> --tail 100 -f

# Check disk space
df -h

# Check memory
free -h

# Check running processes
htop

# Restart a service via Coolify API
curl -X POST "http://135.181.44.197:8000/api/v1/applications/<uuid>/restart" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

### Service UUIDs (Coolify)

| Service       | UUID                     |
| ------------- | ------------------------ |
| Gateway       | t8g4o04gk84ccc4skkcook4c |
| Web           | fkg48gw4c8o0c4gs40wkowoc |
| AI Service    | a4g08w08cokosksswsgcoksw |
| Legacy Import | ys0ok48o0gccs4s8wcoogcw8 |
| PostgreSQL    | fkwgogssww08484wwokw4wc4 |
| Redis         | jok0osgo8w4848cccs4s0o44 |
| Uptime Kuma   | i4kc8ocgcg8wsgcs40w4kswc |
