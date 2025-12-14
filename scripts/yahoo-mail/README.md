# Yahoo Mail Reader

Read emails from Yahoo Mail via IMAP.

## Setup

### 1. Get a Yahoo App Password

1. Go to [Yahoo Account Security](https://login.yahoo.com/account/security)
2. Enable **2-step verification** (required for app passwords)
3. Scroll to "Generate app password"
4. Select **"Other app"** and name it (e.g., "Claude Script")
5. Copy the 16-character password

### 2. Configure Environment

```bash
cd scripts/yahoo-mail
cp .env.example .env
# Edit .env with your credentials
```

### 3. Install Dependencies

```bash
pnpm install
```

## Usage

```bash
# Read 10 most recent emails
pnpm read

# Read more emails
pnpm read -- --limit 20

# Search for emails
pnpm search -- "search term"

# Read full email by UID
pnpm read -- --uid 12345

# List all folders
pnpm read -- --folders
```

## Security Notes

- Never commit your `.env` file
- App passwords can be revoked anytime from Yahoo security settings
- The script only reads emails (no write/delete operations)
