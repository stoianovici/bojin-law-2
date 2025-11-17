# Render Deployment Setup Guide

This guide explains how to configure GitHub Actions to deploy to Render.com using Deploy Hooks.

## Prerequisites

- Render.com account created
- Services created in Render (staging and production environments)
- GitHub repository connected to Render

## Step 1: Get Render Deploy Hooks

Deploy Hooks are unique URLs that trigger deployments when called with an HTTP POST request.

### For Each Service:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your service (e.g., `legal-platform-web-staging`)
3. Navigate to **Settings** tab
4. Scroll to **Deploy Hook** section
5. Click **Create Deploy Hook**
6. Copy the generated URL (looks like: `https://api.render.com/deploy/srv-xxxxx?key=yyyyy`)

### Services to Configure:

You need deploy hooks for:

**Staging Environment:**

- `legal-platform-staging` (or your staging blueprint/service group)

**Production Environment:**

- `legal-platform-production` (or your production blueprint/service group)

> **Note:** If using `render.yaml` with a blueprint, you only need ONE deploy hook per environment that triggers all services. If services are created individually, you may need individual hooks.

## Step 2: Create GitHub Secrets

Navigate to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

### Required Secrets:

| Secret Name                     | Description                                | Example Value                                       |
| ------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `RENDER_DEPLOY_HOOK_STAGING`    | Deploy hook URL for staging environment    | `https://api.render.com/deploy/srv-xxxxx?key=yyyyy` |
| `RENDER_DEPLOY_HOOK_PRODUCTION` | Deploy hook URL for production environment | `https://api.render.com/deploy/srv-zzzzz?key=aaaaa` |

### Optional Secrets (for future Render CLI integration):

| Secret Name      | Description                       | How to Get                                                                             |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `RENDER_API_KEY` | Render API key for CLI operations | [Render Account Settings → API Keys](https://dashboard.render.com/u/settings#api-keys) |

## Step 3: Create GitHub Environment Variables

Navigate to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab:

| Variable Name    | Value                                   | Description                |
| ---------------- | --------------------------------------- | -------------------------- |
| `STAGING_URL`    | `https://your-app-staging.onrender.com` | Staging environment URL    |
| `PRODUCTION_URL` | `https://your-app.onrender.com`         | Production environment URL |

## Step 4: Configure GitHub Environments (Optional but Recommended)

GitHub Environments provide additional protection and approval gates for deployments.

1. Go to **Settings** → **Environments**
2. Create two environments:

### Staging Environment:

- **Name:** `staging`
- **Deployment branches:** `develop`
- **Environment secrets:** (optional, can inherit from repository)
- **Reviewers:** Not required for staging

### Production Environment:

- **Name:** `production`
- **Deployment branches:** `main` only
- **Environment secrets:** (optional, can inherit from repository)
- **Reviewers:** Add 1-2 required reviewers (recommended for production)
- **Wait timer:** Optional (e.g., 5 minutes to allow cancellation)

## Step 5: Verify Workflow Configuration

The workflows are already configured in:

- `.github/workflows/build-publish.yml` → Renamed to **Deploy to Render**
- `.github/workflows/pr-validation.yml` → **PR Validation**

### Deployment Workflow Triggers:

| Branch    | Environment           | Workflow Job        |
| --------- | --------------------- | ------------------- |
| `develop` | Staging               | `deploy-staging`    |
| `main`    | Production            | `deploy-production` |
| Manual    | Staging or Production | `deploy-manual`     |

## Step 6: Test Deployment

### Test Staging Deployment:

```bash
# Make a change and push to develop branch
git checkout develop
echo "test" >> README.md
git add README.md
git commit -m "test: trigger staging deployment"
git push origin develop
```

### Test Production Deployment:

```bash
# Merge to main and push
git checkout main
git merge develop
git push origin main
```

### Manual Deployment:

1. Go to **Actions** tab in GitHub
2. Select **Deploy to Render** workflow
3. Click **Run workflow**
4. Select branch and environment (staging or production)
5. Click **Run workflow**

## Step 7: Monitor Deployments

### In GitHub:

1. Go to **Actions** tab
2. Click on the running workflow
3. View deployment logs and status
4. Check **Summary** for deployment details

### In Render:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your service
3. View **Events** tab for deployment status
4. View **Logs** tab for application logs

## Troubleshooting

### Deployment Hook Returns 404

- Verify the deploy hook URL is correct
- Ensure the service exists in Render
- Check if the service is paused or suspended

### Deployment Triggered But No Changes

- Check Render dashboard for deployment status
- Verify the service is configured for auto-deploy on push
- Check if there are any build errors in Render logs

### GitHub Workflow Fails at Deploy Step

- Verify secrets are set correctly (no typos)
- Check if the secret value includes the full URL with query parameters
- Ensure the deploy hook hasn't been regenerated (old URLs become invalid)

### Deployment Takes Too Long

- The workflow waits 30 seconds by default after triggering
- Render deployments typically take 2-5 minutes
- You can monitor actual status in Render dashboard

## Security Best Practices

1. **Never commit deploy hook URLs** to the repository
2. **Rotate deploy hooks** if accidentally exposed
3. **Use environment protection rules** for production
4. **Limit access** to repository secrets to administrators
5. **Enable branch protection** for `main` and `develop` branches
6. **Use required reviews** for production deployments

## Next Steps

1. ✅ Configure all secrets and variables
2. ✅ Test staging deployment
3. ✅ Test production deployment with approval gates
4. ✅ Set up monitoring alerts in Render
5. ✅ Configure Slack/Discord notifications (optional)
6. ✅ Document deployment procedures for team

## Additional Resources

- [Render Deploy Hooks Documentation](https://render.com/docs/deploy-hooks)
- [GitHub Actions Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

## Support

- **Render Support:** [https://render.com/docs](https://render.com/docs)
- **GitHub Actions Support:** [https://github.com/actions](https://github.com/actions)
