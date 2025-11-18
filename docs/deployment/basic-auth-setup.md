# HTTP Basic Auth Setup for Render

This guide explains how to enable password protection for your Render deployment.

## Overview

The application includes HTTP Basic Auth middleware that protects the entire site with a username and password prompt. This is useful for:

- Protecting staging/development deployments
- Preventing public access before launch
- Demo environments

**Note:** Authentication is automatically disabled on `localhost` for local development.

## Setup Instructions

### 1. In Render Dashboard

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your web service: `legal-platform-web`
3. Click **Environment** in the left sidebar
4. Add the following environment variables:

   ```
   BASIC_AUTH_USER=your-username
   BASIC_AUTH_PASSWORD=your-secure-password
   ```

5. Click **Save Changes**
6. Render will automatically redeploy with the new configuration

### 2. Test the Protection

1. Visit your deployment: https://legal-platform-web.onrender.com/
2. You should see a browser authentication prompt
3. Enter the username and password you configured
4. The site should load normally after authentication

### 3. To Disable Authentication

Simply remove or clear the `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` environment variables in Render.

## Security Recommendations

1. **Use Strong Passwords**: Generate a random password (16+ characters)
2. **Don't Commit Credentials**: Never commit actual credentials to git
3. **Rotate Regularly**: Change passwords periodically
4. **Use Different Credentials**: Use different passwords for staging vs production

## Example Strong Password Generation

```bash
# Generate a random password
openssl rand -base64 24
```

## How It Works

- **Middleware**: `/apps/web/src/middleware.ts` intercepts all requests
- **Environment Check**: Only applies auth when NOT on localhost
- **Configuration**: Reads credentials from environment variables
- **Standards**: Uses HTTP Basic Auth (RFC 7617)

## Troubleshooting

### Authentication Not Working

- Verify environment variables are set in Render dashboard
- Check for typos in variable names
- Ensure Render has redeployed after adding variables

### Can't Access Site Locally

- Middleware should skip auth on localhost automatically
- Verify `.env.local` does NOT have BASIC_AUTH variables set
- Check browser console for errors

### Browser Keeps Asking for Password

- Clear browser cache and saved passwords
- Try incognito/private browsing mode
- Verify credentials are correct

## Alternative: Environment-Based Protection

If you want to only protect specific environments:

```typescript
// In middleware.ts, modify the hostname check:
if (
  hostname.includes('localhost') ||
  hostname.includes('127.0.0.1') ||
  hostname.includes('yourapp.com') // Skip auth on production domain
) {
  return NextResponse.next();
}
```

This allows production to be public while protecting staging deployments.
