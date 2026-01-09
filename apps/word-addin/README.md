# Legal AI Assistant - Word Add-in

AI-powered legal document assistance directly within Microsoft Word.

## Features

- **Suggestions** - Get AI-powered clause completions, alternatives, and legal precedents
- **Explain** - Plain-language explanations of legal text with references to Romanian law
- **Improve** - Improve text for clarity, formality, brevity, or legal precision

## Development Setup

### Prerequisites

1. **Microsoft Word** for Mac (or Windows) with Office Add-in support
2. **Gateway running** on `localhost:4000` (the backend API)
3. **Node.js** 18+ and pnpm

### Quick Start

```bash
# 1. Start the gateway (from repo root)
pnpm --filter gateway dev

# 2. Start the Word add-in dev server
cd apps/word-addin
pnpm start

# 3. Sideload the add-in into Word (Mac)
pnpm sideload:mac

# 4. Open Word and look for the "Legal AI" tab in the ribbon
```

### Manual Sideloading (if script doesn't work)

**Mac:**

1. Open Finder
2. Press `Cmd+Shift+G` and go to: `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`
3. Copy `manifest.dev.xml` to this folder
4. Restart Word

**Windows:**

1. Open Word
2. Go to Insert → My Add-ins → Upload My Add-in
3. Browse to `apps/word-addin/manifest.dev.xml`

### Trusting the HTTPS Certificate

The add-in runs on `https://localhost:3005`. On first run, you may need to trust the certificate:

1. Open `https://localhost:3005` in your browser
2. Accept the security warning / add certificate exception
3. Reload Word

### Remove Sideloaded Add-in

```bash
pnpm sideload:mac:remove
# Then restart Word
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Microsoft Word                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  "Legal AI" Ribbon Tab                               │    │
│  │  [Suggestions] [Explain] [Improve]                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Task Pane (https://localhost:3005)                  │    │
│  │  - React app embedded in Word                        │    │
│  │  - Office.js for document interaction                │    │
│  │  - Calls Gateway API for AI features                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Gateway (localhost:4000)                                    │
│  /api/ai/word/suggest   - Get AI suggestions                │
│  /api/ai/word/explain   - Explain legal text                │
│  /api/ai/word/improve   - Improve text                      │
│  /api/ai/word/context   - Get case context                  │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
apps/word-addin/
├── manifest.dev.xml      # Development manifest (localhost:3005)
├── manifest.xml          # Production manifest template
├── taskpane.html         # Entry point for task pane
├── commands.html         # Entry point for ribbon commands
├── public/
│   └── assets/           # Icons and static assets
├── src/
│   ├── taskpane/
│   │   ├── TaskPane.tsx  # Main task pane component
│   │   └── index.tsx     # React entry point
│   ├── components/
│   │   ├── SuggestionsTab.tsx
│   │   ├── ExplainTab.tsx
│   │   └── ImproveTab.tsx
│   ├── services/
│   │   ├── api-client.ts # Gateway API client
│   │   ├── auth.ts       # Microsoft SSO
│   │   └── word-api.ts   # Office.js wrappers
│   └── styles/
│       └── taskpane.css  # Fluent Design styles
└── scripts/
    └── create-png-icons.js
```

## Troubleshooting

### Add-in doesn't appear in Word

- Make sure the dev server is running (`pnpm start`)
- Check that the manifest was copied to the wef folder
- Restart Word completely (Cmd+Q, then reopen)

### "App is having trouble loading"

- Open `https://localhost:3005` in browser and accept the certificate
- Make sure the gateway is running on port 4000

### API errors

- Check that you're logged in (the task pane shows a login button if not)
- Verify the gateway is running: `curl https://localhost:4000/health`

### Selection not detected

- Click in the document and select some text
- Wait 2 seconds (the add-in polls for selection changes)
