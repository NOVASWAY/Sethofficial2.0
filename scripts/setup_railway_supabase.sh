#!/bin/bash

# Script to set up Railway connection to Supabase
# Usage: ./scripts/setup_railway_supabase.sh

set -e

echo "🚂 Railway + Supabase Connection Setup"
echo "========================================"
echo ""

# Supabase project details
SUPABASE_PROJECT_REF="aiisqfannytexwpvgpjx"
SUPABASE_HOST="db.${SUPABASE_PROJECT_REF}.supabase.co"
SUPABASE_PORT="5432"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed."
    echo "   Install it with: npm i -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI found: $(railway --version)"
echo ""

# Get password from argument or environment variable, or prompt
if [ -n "$1" ]; then
    SUPABASE_PASSWORD="$1"
    echo "📝 Using password from command line argument"
elif [ -n "$SUPABASE_PASSWORD" ]; then
    echo "📝 Using password from SUPABASE_PASSWORD environment variable"
else
    echo "📝 Enter your Supabase database password:"
    echo "   (The password you set when creating the Supabase project)"
    read -s SUPABASE_PASSWORD
fi

if [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ Password cannot be empty!"
    echo ""
    echo "Usage:"
    echo "  $0 [password]"
    echo "  or"
    echo "  SUPABASE_PASSWORD='your-password' $0"
    exit 1
fi

echo ""
echo "🔐 Password received (${#SUPABASE_PASSWORD} characters)"
echo ""

# URL encode the password (basic encoding for common special characters)
# Note: This is a simple implementation. For production, use a proper URL encoder.
ENCODED_PASSWORD=$(echo -n "$SUPABASE_PASSWORD" | sed 's/@/%40/g; s/#/%23/g; s/\$/%24/g; s/%/%25/g; s/&/%26/g; s/+/%2B/g; s/=/%3D/g; s/?/%3F/g')

# Build connection string
CONNECTION_STRING="postgresql://${SUPABASE_USER}:${ENCODED_PASSWORD}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}?sslmode=require"

echo "📋 Connection String (masked):"
echo "   postgresql://${SUPABASE_USER}:***@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}?sslmode=require"
echo ""

# Check if Railway is logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Railway login required..."
    railway login
fi

echo "🔗 Linking to Railway project..."
if [ ! -f ".railway" ]; then
    railway link
fi

echo ""
echo "⚙️  Setting DATABASE_URL in Railway..."
railway variables set DATABASE_URL="$CONNECTION_STRING"

echo ""
echo "✅ DATABASE_URL has been set in Railway!"
echo ""
echo "🔄 Railway will automatically redeploy your service."
echo "   Check your Railway dashboard for deployment status."
echo ""
echo "📊 To verify the connection:"
echo "   1. Check Railway logs: railway logs"
echo "   2. Look for: 'Database connection established successfully'"
echo "   3. Test health endpoint: curl https://your-app.railway.app/health"
echo ""

