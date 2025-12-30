#!/bin/bash
# Supabase Setup Script for Railway Backend
# This script helps set up Supabase database for the clinic management system

set -e

echo "🚀 Supabase Setup for Seth Clinic Management System"
echo "=================================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    
    # Try npm installation first (if Node.js is available)
    if command -v npm &> /dev/null; then
        echo "Using npm to install Supabase CLI..."
        npm install -g supabase
    elif command -v brew &> /dev/null; then
        echo "Using Homebrew to install Supabase CLI..."
        brew install supabase/tap/supabase
    else
        echo "⚠️  Please install Supabase CLI manually:"
        echo "   Option 1: npm install -g supabase"
        echo "   Option 2: Visit https://supabase.com/docs/guides/cli"
        echo ""
        echo "Or proceed with web-based setup (recommended for first-time users)"
        exit 1
    fi
fi

echo "✅ Supabase CLI installed"
echo ""

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "🔐 You need to log in to Supabase"
    echo "   Run: supabase login"
    echo "   This will open your browser for authentication"
    echo ""
    read -p "Press Enter after you've logged in, or Ctrl+C to exit..."
fi

echo ""
echo "📋 Next Steps:"
echo "1. Create a new Supabase project at https://supabase.com/dashboard"
echo "2. Get your project reference ID from the project URL"
echo "3. Run: supabase link --project-ref YOUR_PROJECT_REF"
echo "4. Run migrations using the SQL file: scripts/create_all_tables.sql"
echo ""
echo "Or use the web dashboard to run SQL directly (easier for first setup)"

