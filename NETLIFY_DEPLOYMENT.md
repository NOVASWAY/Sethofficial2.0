# Netlify Deployment Guide

This guide will help you deploy your Next.js frontend to Netlify.

## Prerequisites

1. A GitHub account with your repository pushed
2. A Netlify account (sign up at https://app.netlify.com)

## Step 1: Install Netlify CLI (Optional)

If you want to deploy from the command line:

```bash
npm install -g netlify-cli
```

## Step 2: Connect Repository to Netlify

### Option A: Via Netlify Dashboard (Recommended)

1. Go to https://app.netlify.com
2. Click "Add new site" > "Import an existing project"
3. Choose "GitHub" and authorize Netlify to access your repositories
4. Select your repository: `NOVASWAY/Sethofficial2.0`
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next` (or leave blank - Netlify Next.js plugin handles this)
   - **Framework preset**: Next.js (should auto-detect)

### Option B: Via Netlify CLI

```bash
# Login to Netlify
netlify login

# Initialize Netlify in your project
netlify init

# Follow the prompts to connect your site
```

## Step 3: Configure Environment Variables

In Netlify Dashboard:
1. Go to **Site settings** > **Build & deploy** > **Environment variables**
2. Add the following variables:

```
NEXT_PUBLIC_API_URL=https://your-backend-api-url.com
NEXT_PUBLIC_ENVIRONMENT=production
```

Add any other `NEXT_PUBLIC_*` environment variables your app needs.

## Step 4: Install Netlify Next.js Plugin

The `netlify.toml` file already includes the plugin configuration. Netlify will automatically install `@netlify/plugin-nextjs` during the build.

If you want to install it locally:

```bash
npm install --save-dev @netlify/plugin-nextjs
```

## Step 5: Deploy

### Automatic Deployments

Once connected, Netlify will automatically deploy:
- **Production**: Every push to your main branch
- **Preview**: Every pull request

### Manual Deploy via CLI

```bash
# Build and deploy
netlify deploy --prod

# Or deploy a preview
netlify deploy
```

## Step 6: Configure Custom Domain (Optional)

1. Go to **Site settings** > **Domain management**
2. Click "Add custom domain"
3. Follow the DNS configuration instructions

## Important Notes

### Build Settings

- **Build command**: `npm run build`
- **Publish directory**: `.next` (handled by plugin)
- **Node version**: 18.0.0 (specified in `netlify.toml`)

### Environment Variables

All environment variables prefixed with `NEXT_PUBLIC_` will be available in the browser.
Other variables are only available during build time.

### API Routes

If your Next.js app has API routes, they will be automatically handled by the Netlify Next.js plugin as serverless functions.

### Backend API

Make sure your backend API:
1. Has CORS configured to allow requests from your Netlify domain
2. Is accessible from the internet (not localhost)
3. Has proper authentication/security configured

## Troubleshooting

### Build Fails

1. Check build logs in Netlify Dashboard
2. Ensure all dependencies are in `package.json`
3. Verify Node version matches (18.0.0)
4. Check for TypeScript errors: `npm run type-check`

### Environment Variables Not Working

1. Ensure variables are prefixed with `NEXT_PUBLIC_` for client-side access
2. Redeploy after adding new environment variables
3. Check variable names match exactly (case-sensitive)

### Routing Issues

The Netlify Next.js plugin handles all routing automatically. If you have issues:
1. Ensure `netlify.toml` includes the plugin configuration
2. Check that you're using Next.js Link components for navigation
3. Verify API routes are in the `/app/api` directory

## Support

- Netlify Docs: https://docs.netlify.com
- Next.js on Netlify: https://docs.netlify.com/integrations/frameworks/next-js/
- Netlify Community: https://answers.netlify.com

