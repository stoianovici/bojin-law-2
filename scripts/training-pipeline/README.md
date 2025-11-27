# Training Pipeline CLI

Local CLI tool for generating document embeddings from OneDrive-categorized documents and storing them in PostgreSQL.

## Overview

This tool runs **on your local machine** to:
1. Sign in with your Microsoft account (interactive browser login)
2. Download categorized documents from OneDrive `/AI-Training/` folders
3. Extract text from PDFs and Word documents
4. Generate embeddings using `multilingual-e5-base` model (768 dimensions)
5. Store embeddings in your PostgreSQL database for semantic search

**No external API costs** - the embedding model runs locally on your CPU.

## One-Time Setup

### 1. Create Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click **New registration**
3. Fill in:
   - **Name:** `Legal Platform Training CLI`
   - **Supported account types:** Single tenant (your org only)
   - **Redirect URI:** Select "Public client/native" and enter: `http://localhost:3847/callback`
4. Click **Register**
5. Copy the **Application (client) ID** - you'll need this

### 2. Add API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `Files.Read.All` (read OneDrive files)
   - `User.Read` (read user profile)
   - `offline_access` (refresh tokens)
4. Click **Grant admin consent** (if you're an admin)

### 3. Configure Environment

Add to your project's `.env` file:

```bash
# Azure AD App Registration
AZURE_CLIENT_ID=your-client-id-from-step-1

# PostgreSQL connection
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### 4. Install Dependencies

```bash
cd scripts/training-pipeline
pnpm install
```

## Usage

### Sign In

```bash
# Opens browser for Microsoft sign-in (one time)
pnpm run login
```

This will:
1. Open your browser to Microsoft login
2. You sign in with your Microsoft account
3. Token is cached locally at `~/.legal-platform/ms-token-cache.json`
4. Token auto-refreshes - you rarely need to login again

### Check Status

```bash
pnpm run status
```

Shows:
- Login status
- Environment configuration

### Test the Embedding Model

```bash
# Verify the model works (downloads ~1.1GB on first run)
pnpm run test-model
```

### Process Documents

```bash
# Dry run - see what would be processed
pnpm run train:dry-run

# Process all new documents
pnpm run train

# Process only a specific category
pnpm run train -- --category "Contract"
```

### Sign Out

```bash
# Clear cached credentials
pnpm run logout
```

## Example Session

```
$ pnpm run login

🔐 Microsoft Sign-In

Opening browser for authentication...
Waiting for callback on port 3847...
Exchanging code for tokens...

✅ Logged in successfully!
   Account: user@yourfirm.com
   Token cached at: ~/.legal-platform/ms-token-cache.json

$ pnpm run train

📚 Training Pipeline - Local Embedding Generator

Model: multilingual-e5-base (768 dimensions)
Running on: your local machine

Signed in as: user@yourfirm.com

✔ Connected to database
Found 45 already processed documents

✔ Loading multilingual-e5-base model...
✔ Model loaded successfully

✔ Found 23 new documents in 3 categories (45 already processed)

  📁 Contract: 12 documents
  📁 Notificare Avocateasca: 8 documents
  📁 Intampinare: 3 documents

Processing Contract...
  ✔ contract-vanzare-2019.pdf - 1523 words, 4 chunks, ro (2.3s)
  ✔ agreement-services.docx - 892 words, 2 chunks, en (1.8s)
  ...

✅ Processing complete!

   Discovered:  23
   Processed:   21
   Failed:      2
   Skipped:     45
   Total time:  47.2s
```

## How Authentication Works

```
┌─────────────────────────────────────────────────────────────┐
│                     First Login                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   CLI                    Browser                  Microsoft  │
│    │                        │                         │      │
│    │──── Opens browser ────>│                         │      │
│    │                        │──── Login page ────────>│      │
│    │                        │<─── Enter credentials ──│      │
│    │                        │<─── Auth code ──────────│      │
│    │<─── Callback ──────────│                         │      │
│    │                                                         │
│    │──── Exchange code for tokens ───────────────────>│      │
│    │<─── Access token + Refresh token ────────────────│      │
│    │                                                         │
│    │  Tokens cached at ~/.legal-platform/ms-token-cache.json │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Subsequent Runs                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   CLI                                             Microsoft  │
│    │                                                   │     │
│    │  Load cached tokens                               │     │
│    │                                                   │     │
│    │  If token expired:                                │     │
│    │──── Use refresh token to get new access token ───>│     │
│    │<─── New access token ─────────────────────────────│     │
│    │                                                   │     │
│    │  Proceed with OneDrive access                     │     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance

| Metric | Value |
|--------|-------|
| Model size | ~1.1GB (downloaded once) |
| Memory usage | ~1.5GB RAM |
| Processing speed | ~100-150ms per document (CPU) |
| Embedding dimensions | 768 |
| Token refresh | Automatic (lasts ~90 days) |

On an M-series Mac, expect ~50-100ms per document.

## Troubleshooting

### "AZURE_CLIENT_ID environment variable required"

You need to create an Azure AD app registration. Follow the setup steps above.

### "Not logged in. Please run: pnpm run login"

Your cached token has expired or doesn't exist. Run `pnpm run login` to sign in.

### "Access token expired"

The refresh token has expired (rare, usually lasts 90 days). Run `pnpm run login` again.

### Browser doesn't open

Copy the URL shown in the terminal and paste it into your browser manually.

### "Model loading failed"

The model is downloaded to `~/.cache/huggingface/`. Check:
- You have ~2GB free disk space
- Internet connection is working
- Try deleting the cache and re-running

### "Admin consent required"

Ask your Azure AD admin to grant consent for the app, or use a personal Microsoft account.

## Files

```
scripts/training-pipeline/
├── src/
│   ├── cli.ts              # Main CLI entry point
│   ├── auth.ts             # Microsoft authentication (MSAL)
│   ├── embedding-service.ts # Local embedding generation
│   ├── onedrive-client.ts  # OneDrive API integration
│   ├── text-extractor.ts   # PDF/DOCX text extraction
│   ├── database.ts         # PostgreSQL operations
│   └── test-model.ts       # Model verification script
├── package.json
├── tsconfig.json
└── README.md
```

## Security Notes

- **Tokens are stored locally** at `~/.legal-platform/ms-token-cache.json`
- Tokens are **not** committed to git (stored outside project)
- The app only requests **read** permissions for OneDrive
- No data is sent to external services except Microsoft (auth) and your database
